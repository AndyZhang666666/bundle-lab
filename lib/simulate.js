// 套餐模拟：一个组合真推出去，客单和毛利会怎么动。
//
// 这一层全是估算，不是预测。所有系数都是可调参数，默认值的来源写在
// docs/ASSUMPTIONS.md 里，逐条标了「经验估计」还是有公开依据。
// 宁可让人看见参数在哪，也不要给一个看起来很准的数。

export const DEFAULT_ADOPTION = { conservative: 0.05, neutral: 0.12, optimistic: 0.25 };
export const DEFAULT_DISCOUNT = 0.12;
export const DEFAULT_COST_RATIO = 0.4;

function mean(xs) {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * 套餐原价 = 组合内商品单价之和（按每单只买一件算）。
 * 套餐价 = 原价 × (1 − 折扣率)。
 */
export function bundlePrice(items, priceOf, discount = DEFAULT_DISCOUNT) {
  const listPrice = items.reduce((sum, sku) => sum + (priceOf[sku] || 0), 0);
  return { listPrice, bundleP: listPrice * (1 - discount), discountAmount: listPrice * discount };
}

/**
 * 单档估算。
 *
 * 口径只在「组合涉及的这几件商品」上比较，不拿整单金额做基线：
 * 一个人采纳套餐，变化的只是这几件的花费，整单其余的菜照点。
 *
 *   partialSpend = 被推人群原本在这几件上的平均花费
 *   Δ客单/单 = 采纳率 × (套餐价 − partialSpend)
 *
 * 括号里可能为负 —— 说明这批人原本在这几件上花得已经比套餐价高
 * （常见于「本来就买全套」占比高的组合），推出去是做减法。
 * 这种情况不藏，直接算成负数显示出来。
 *
 * 毛利侧同口径：
 *   原毛利 = partialSpend × (1 − 成本率)
 *   套餐毛利 = 套餐价 − 原价 × 成本率
 */
export function simulateOne({ partialSpend, bundleP, listPrice, adoption, costRatio = DEFAULT_COST_RATIO }) {
  const aovLift = adoption * (bundleP - partialSpend);
  const baseMargin = partialSpend * (1 - costRatio);
  const bundleMargin = bundleP - listPrice * costRatio;
  const marginLift = adoption * (bundleMargin - baseMargin);
  return {
    adoption,
    aovLift,
    aovLiftPct: partialSpend ? aovLift / partialSpend : 0,
    baseMargin,
    bundleMargin,
    marginLift,
    marginLiftPct: baseMargin ? marginLift / baseMargin : 0,
  };
}

/**
 * 盈亏平衡采纳率：套餐至少要有多少人接，才不亏。
 *
 * 口径必须对齐到「套餐涉及的这几件商品」，不能拿整单客单价当基线 ——
 * matchedAOV 是整单金额（含套餐外的菜），bundleP 只是套餐内几件的价格，
 * 两者相减等于要求套餐一个人扛起整单的利润，任何套餐都会算成亏。
 *
 * 记 h = 命中率（被覆盖的人里本来就买全套的比例）：
 *   - 这批人白拿折扣，每单损失让利 d = 原价 × 折扣率
 *   - 剩下 (1−h) 是本来只买部分的人，被转化过来产生增量毛利 g
 *
 * 基线毛利 = 这批人原本在这几件商品上贡献的毛利，按 h 加权：
 *   命中的贡献整份 listPrice，未命中的按其平均购买件数占比折算。
 *
 *   g = 套餐毛利 − 未命中者原毛利
 *   平衡采纳率 a 满足 (1−h)·a·g = h·d  →  a = h·d / ((1−h)·g)
 *
 * g ≤ 0 表示套餐价已低于成本加成，任何采纳率都不赚；h ≥ 1 表示所有人
 * 本来就买全套，套餐纯让利，同样返回 null。
 */
export function breakEvenAdoption({
  listPrice,
  bundleP,
  partialSpend,
  hitRate = 0,
  discount = DEFAULT_DISCOUNT,
  costRatio = DEFAULT_COST_RATIO,
}) {
  const d = listPrice * discount;
  const bundleMargin = bundleP - listPrice * costRatio;
  // 未命中者原本只买了组合里的一部分，这是真正被替换掉的基线
  const baseMargin = partialSpend * (1 - costRatio);
  const g = bundleMargin - baseMargin;

  if (g <= 0) {
    return {
      rate: null,
      incrementalMargin: g,
      giveaway: d,
      reason: '套餐折后毛利低于这批人原本在这几件商品上的毛利，任何采纳率都亏',
    };
  }
  if (hitRate >= 1) {
    return { rate: null, incrementalMargin: g, giveaway: d, reason: '覆盖人群本来就全买，套餐只是纯让利' };
  }
  const rate = (hitRate * d) / ((1 - hitRate) * g);
  return {
    rate: rate > 1 ? null : rate,
    incrementalMargin: g,
    giveaway: d,
    reason: rate > 1 ? '需要的采纳率超过 100%，现实中不可达' : null,
  };
}

/** 一个组合的完整三档模拟。 */
export function simulateBundle({
  bundle,
  transactions,
  priceOf,
  discount = DEFAULT_DISCOUNT,
  costRatio = DEFAULT_COST_RATIO,
  adoption = DEFAULT_ADOPTION,
}) {
  const want = new Set(bundle.items);
  const matched = transactions.filter((t) => t.items.some((i) => want.has(i)));
  const matchedAOV = mean(matched.map((t) => t.total));
  const { listPrice, bundleP, discountAmount } = bundlePrice(bundle.items, priceOf, discount);

  // 被推人群原本在「组合这几件」上花了多少 —— 这才是套餐要替换掉的基线。
  // 用整单 total 会把套餐外的菜算进来，导致任何套餐都显得在亏。
  const partialSpend = mean(
    matched.map((t) => t.items.reduce((s, i) => (want.has(i) ? s + (priceOf[i] || 0) : s), 0)),
  );
  // 命中率：被覆盖的人里本来就买全套的比例，这批人吃折扣不产生增量
  const hitCount = matched.filter((t) => {
    const set = new Set(t.items);
    return bundle.items.every((i) => set.has(i));
  }).length;
  const hitRate = matched.length ? hitCount / matched.length : 0;

  const scenarios = {};
  for (const [name, rate] of Object.entries(adoption)) {
    scenarios[name] = simulateOne({ partialSpend, bundleP, listPrice, adoption: rate, costRatio });
  }
  const be = breakEvenAdoption({ listPrice, bundleP, partialSpend, hitRate, discount, costRatio });

  return {
    key: bundle.key,
    items: bundle.items,
    lift: bundle.lift,
    support: bundle.support,
    // Preserve observed bundle context when enriching it with simulated revenue.
    groupShare: bundle.groupShare,
    dominantDaypart: bundle.dominantDaypart,
    dominantDaypartShare: bundle.dominantDaypartShare,
    matchedCount: matched.length,
    matchedShare: transactions.length ? matched.length / transactions.length : 0,
    matchedAOV,
    partialSpend,
    hitCount,
    hitRate,
    listPrice,
    bundlePrice: bundleP,
    discount,
    discountAmount,
    costRatio,
    scenarios,
    breakEven: be,
    // 排序用：中性档的客单提升 × 覆盖订单数 —— 单看提升率会把只覆盖 30 单的组合排前面
    expectedValue: scenarios.neutral.aovLift * matched.length,
  };
}

/** 多个组合横向比，按「预期提升 × 覆盖订单数」排。 */
export function compareBundles(bundles, ctx) {
  return bundles
    .map((b) => simulateBundle({ ...ctx, bundle: b }))
    .sort((a, b) => b.expectedValue - a.expectedValue);
}
