// 关联规则挖掘：从订单明细里找「经常一起买」的商品组合。
//
// 数据量在几千条订单、几十个 SKU 这个量级，Apriori 的逐层剪枝已经够快，
// 没必要上 FP-Growth。真正影响结果可信度的是阈值怎么定，不是算法多快。
//
// 三个指标（README 和 docs/DECISIONS.md 里都写了推导）：
//   supp(S)      = 含 S 全部商品的订单数 / 总订单数
//   conf(A→B)    = supp(A∪B) / supp(A)
//   lift(A→B)    = conf(A→B) / supp(B) = supp(A∪B) / (supp(A)·supp(B))
// lift 对称：lift(A→B) === lift(B→A)，所以组合本身只需要算一次。

export const DEFAULT_MIN_SUPPORT = 0.01;
export const DEFAULT_MIN_LIFT = 1.2;
export const DEFAULT_MIN_CONFIDENCE = 0.1;

/** 组合的稳定 key：排序后用 " + " 连接，保证 {A,B} 和 {B,A} 是同一个 key。 */
export function comboKey(items) {
  return [...items].sort().join(' + ');
}

/**
 * 把订单明细行聚合成「一单一个商品集合」。
 * 同一单买 2 份可乐，在关联规则里只算「出现过可乐」—— 关心的是搭配结构，不是数量。
 */
export function toTransactions(orders) {
  return orders.map((o) => ({
    orderId: o.orderId,
    items: [...new Set(o.lines.map((l) => l.sku))],
    total: o.total,
    partySize: o.partySize,
    daypart: o.daypart,
    isGroup: o.partySize >= 3,
  }));
}

function countItemSets(transactions, candidates) {
  const counts = new Map();
  for (const c of candidates) counts.set(comboKey(c), 0);
  for (const t of transactions) {
    const set = new Set(t.items);
    for (const c of candidates) {
      let hit = true;
      for (const item of c) {
        if (!set.has(item)) {
          hit = false;
          break;
        }
      }
      if (hit) counts.set(comboKey(c), counts.get(comboKey(c)) + 1);
    }
  }
  return counts;
}

/** Apriori 逐层生成候选：k-1 项频繁集自连接，且所有 k-1 子集都必须频繁。 */
function joinCandidates(frequentPrev, k) {
  const prevKeys = new Set(frequentPrev.map((s) => comboKey(s)));
  const out = new Map();
  for (let i = 0; i < frequentPrev.length; i++) {
    for (let j = i + 1; j < frequentPrev.length; j++) {
      const union = [...new Set([...frequentPrev[i], ...frequentPrev[j]])].sort();
      if (union.length !== k) continue;
      const key = comboKey(union);
      if (out.has(key)) continue;
      let allSubsetsFrequent = true;
      for (let drop = 0; drop < union.length; drop++) {
        const subset = union.filter((_, idx) => idx !== drop);
        if (!prevKeys.has(comboKey(subset))) {
          allSubsetsFrequent = false;
          break;
        }
      }
      if (allSubsetsFrequent) out.set(key, union);
    }
  }
  return [...out.values()];
}

/**
 * 挖频繁项集，返回 1 到 maxLen 项的 { items, count, support }。
 */
export function frequentItemsets(transactions, { minSupport = DEFAULT_MIN_SUPPORT, maxLen = 3 } = {}) {
  const n = transactions.length;
  if (n === 0) return { levels: [], supportOf: new Map(), total: 0 };

  const supportOf = new Map();
  const levels = [];

  const singleCounts = new Map();
  for (const t of transactions) {
    for (const item of t.items) singleCounts.set(item, (singleCounts.get(item) || 0) + 1);
  }
  let current = [];
  const level1 = [];
  for (const [item, count] of singleCounts) {
    const support = count / n;
    supportOf.set(item, support);
    if (support >= minSupport) {
      level1.push({ items: [item], count, support });
      current.push([item]);
    }
  }
  level1.sort((a, b) => b.support - a.support);
  levels.push(level1);

  for (let k = 2; k <= maxLen; k++) {
    const candidates = joinCandidates(current, k);
    if (candidates.length === 0) break;
    const counts = countItemSets(transactions, candidates);
    const level = [];
    current = [];
    for (const c of candidates) {
      const count = counts.get(comboKey(c));
      const support = count / n;
      if (support >= minSupport) {
        supportOf.set(comboKey(c), support);
        level.push({ items: c, count, support });
        current.push(c);
      }
    }
    level.sort((a, b) => b.support - a.support);
    levels.push(level);
    if (current.length === 0) break;
  }

  return { levels, supportOf, total: n };
}

/**
 * lift 的定义只对「A→B 两边都非空」成立，组合内部怎么切分会影响 conf。
 * 对 k 项组合，取所有切分里 conf 最高的那个方向当代表 —— 运营真正会用的
 * 是「买了 A 的人有多大概率也买 B」，最强的那个方向最有说服力。
 */
function bestSplit(items, supportOf, jointSupport) {
  const n = items.length;
  let best = null;
  for (let mask = 1; mask < (1 << n) - 1; mask++) {
    const ante = [];
    const cons = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) ante.push(items[i]);
      else cons.push(items[i]);
    }
    const sa = supportOf.get(ante.length === 1 ? ante[0] : comboKey(ante));
    const sc = supportOf.get(cons.length === 1 ? cons[0] : comboKey(cons));
    if (!sa || !sc) continue;
    const confidence = jointSupport / sa;
    const lift = confidence / sc;
    if (!best || confidence > best.confidence) {
      best = { antecedent: ante, consequent: cons, confidence, lift, supportA: sa, supportB: sc };
    }
  }
  return best;
}

/** 组合覆盖的订单：含组合中至少一件商品 —— 套餐能推给谁，用这个口径。 */
export function matchedOrders(transactions, items) {
  const want = new Set(items);
  return transactions.filter((t) => t.items.some((i) => want.has(i)));
}

/** 组合命中的订单：含组合全部商品。 */
export function containingOrders(transactions, items) {
  const want = items;
  return transactions.filter((t) => {
    const set = new Set(t.items);
    return want.every((i) => set.has(i));
  });
}

function mean(xs) {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * 主入口：挖组合并算出运营关心的一整套字段。
 * 返回按 score 降序的候选列表，score = lift × log(1+命中订单数)，
 * 避免只按 lift 排时把「lift 很高但只出现在 20 单里」的噪声推到最前面。
 */
export function mineBundles(
  transactions,
  {
    minSupport = DEFAULT_MIN_SUPPORT,
    minLift = DEFAULT_MIN_LIFT,
    minConfidence = DEFAULT_MIN_CONFIDENCE,
    maxLen = 3,
    limit = 50,
  } = {},
) {
  const n = transactions.length;
  if (n === 0) return [];
  const { levels, supportOf } = frequentItemsets(transactions, { minSupport, maxLen });
  const overallAOV = mean(transactions.map((t) => t.total));

  const out = [];
  for (let k = 2; k <= levels.length; k++) {
    const level = levels[k - 1];
    if (!level) continue;
    for (const fs of level) {
      const split = bestSplit(fs.items, supportOf, fs.support);
      if (!split) continue;
      if (split.lift < minLift) continue;
      if (split.confidence < minConfidence) continue;

      const hit = containingOrders(transactions, fs.items);
      const matched = matchedOrders(transactions, fs.items);
      const hitAOV = mean(hit.map((t) => t.total));
      const groupShare = hit.length ? hit.filter((t) => t.isGroup).length / hit.length : 0;
      const daypartMix = {};
      for (const t of hit) daypartMix[t.daypart] = (daypartMix[t.daypart] || 0) + 1;
      const dominantDaypart = Object.entries(daypartMix).sort((a, b) => b[1] - a[1])[0];

      out.push({
        key: comboKey(fs.items),
        items: fs.items,
        size: fs.items.length,
        support: fs.support,
        count: fs.count,
        confidence: split.confidence,
        lift: split.lift,
        antecedent: split.antecedent,
        consequent: split.consequent,
        hitOrders: hit.length,
        matchedOrders: matched.length,
        hitAOV,
        overallAOV,
        aovDelta: hitAOV - overallAOV,
        groupShare,
        dominantDaypart: dominantDaypart ? dominantDaypart[0] : null,
        dominantDaypartShare: dominantDaypart ? dominantDaypart[1] / hit.length : 0,
        score: split.lift * Math.log(1 + fs.count),
      });
    }
  }

  out.sort((a, b) => b.score - a.score);
  return out.slice(0, limit);
}

/** 按订单分群分别挖 —— 同一个组合在午餐和晚餐的 lift 可能完全不同。 */
export function mineBySegment(transactions, segment, options = {}) {
  const filters = {
    all: () => true,
    group: (t) => t.isGroup,
    single: (t) => !t.isGroup,
    lunch: (t) => t.daypart === 'lunch',
    dinner: (t) => t.daypart === 'dinner',
  };
  const f = filters[segment] || filters.all;
  const subset = transactions.filter(f);
  return { transactions: subset, bundles: mineBundles(subset, options) };
}
