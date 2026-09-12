// 把挖掘 + 估算的结果整理成一份「该给哪类订单推什么套餐」的建议。
//
// 这一层不产生新数字，只做两件事：
//   1. 从已经算好的字段里挑出决策相关的那几个，按运营看的顺序排好
//   2. 判断风险点 —— 哪些场景不要推
// 无 LLM 时模板拼接；有 LLM 时把这里的结构化结果原样交给模型润色。
// 两种情况的数字完全一样，区别只是措辞，所以不会出现「换了说法数字也变了」。

const DAYPART_LABEL = { lunch: '午餐', dinner: '晚餐', tea: '下午茶', breakfast: '早餐' };
const yuan = (v) => `¥${Number(v).toFixed(1)}`;
const pct = (v, d = 1) => `${(Number(v) * 100).toFixed(d)}%`;

/**
 * 挑出值得写进建议的组合：收益可行、覆盖够广、按预期价值排。
 *
 * 关键一步是去重：候选列表里大量组合是彼此的变体
 * （「啤酒+烤鱼」和「啤酒+大瓶可乐+烤鱼」共享啤酒和烤鱼）。
 * 不去重的话，前 5 条建议可能是同一个机会换了 5 种说法，运营会照着做 5 遍。
 * 规则：按价值从高到低遍历，新组合与任何已入选组合的商品重合度
 * 超过 maxOverlap 就跳过。
 *
 * 不可行的和覆盖太窄的不丢掉，单独分组在末尾说明 ——
 * 「现在不该推」本身是结论，藏起来运营就会自己踩坑。
 */
export function pickActions(ranked, { minMatched = 100, topN = 5, maxOverlap = 0.5 } = {}) {
  const feasible = ranked.filter((b) => b.breakEven.rate !== null);
  const wide = feasible.filter((b) => b.matchedCount >= minMatched);

  const byValue = [...wide].sort((a, b) => b.expectedValue - a.expectedValue);
  const chosen = [];
  const dropped = [];

  for (const b of byValue) {
    if (chosen.length >= topN) break;
    const set = new Set(b.items);
    const clash = chosen.find((c) => {
      const inter = c.items.filter((i) => set.has(i)).length;
      return inter / Math.max(c.items.length, b.items.length) > maxOverlap;
    });
    if (clash) {
      dropped.push({ bundle: b, overlapsWith: clash.items });
    } else {
      chosen.push(b);
    }
  }

  return {
    chosen,
    dropped,
    rejected: ranked.filter((b) => b.breakEven.rate === null),
    narrow: feasible.filter((b) => b.matchedCount < minMatched),
  };
}

/** 单个组合的风险点。机器能判断的只有这几类，判断不了的就不写。 */
export function risksOf(b) {
  const out = [];
  if (b.dominantDaypart && b.dominantDaypartShare >= 0.6) {
    out.push({
      level: 'warn',
      text: `${pct(b.dominantDaypartShare, 0)} 出现在${DAYPART_LABEL[b.dominantDaypart] || b.dominantDaypart}，其他时段样本少 —— 只在${DAYPART_LABEL[b.dominantDaypart] || b.dominantDaypart}推，别全天铺。`,
    });
  }
  if (b.hitRate >= 0.3) {
    out.push({
      level: 'bad',
      text: `命中率 ${pct(b.hitRate)} 偏高：这批人本来就成套买，给他们打折是纯让利。更适合加价购（满额换购），不适合降价套餐。`,
    });
  }
  if (b.matchedCount < 300) {
    out.push({
      level: 'warn',
      text: `只覆盖 ${b.matchedCount} 单，样本偏小，收益估算波动大。建议小流量试，别一次全量上线。`,
    });
  }
  if (b.aovDelta < 0) {
    out.push({
      level: 'bad',
      text: `命中订单客单比全体低 ${yuan(Math.abs(b.aovDelta))} —— 买这个组合的人本来客单就偏低，推套餐是往低处拉。`,
    });
  }
  if (out.length === 0) {
    out.push({ level: 'ok', text: '没有触发已知的风险规则（时段集中、高命中率、样本过小、命中客单偏低）。' });
  }
  return out;
}

/** 针对哪类订单推 —— 从组合的人群和历史分布反推。 */
export function audienceOf(b) {
  const who = b.groupShare >= 0.6 ? '多人订单（3 人及以上）' : b.groupShare <= 0.35 ? '单人/双人订单' : '多人和单人都有，不区分';
  const when = b.dominantDaypart
    ? `${DAYPART_LABEL[b.dominantDaypart] || b.dominantDaypart}为主（${pct(b.dominantDaypartShare, 0)}）`
    : '全时段';
  return { who, when };
}

/** 一个组合的建议条目（结构化，供模板和 LLM 共用）。 */
export function actionOf(b, adoption = 0.12) {
  const a = b.scenarios.neutral;
  return {
    bundle: b.items.join(' + '),
    items: b.items,
    lift: b.lift,
    support: b.support,
    audience: audienceOf(b),
    matchedCount: b.matchedCount,
    listPrice: b.listPrice,
    bundlePrice: b.bundlePrice,
    discount: b.discount,
    partialSpend: b.partialSpend,
    hitRate: b.hitRate,
    aovLift: a.aovLift,
    marginLift: a.marginLift,
    breakEven: b.breakEven.rate,
    expectedValue: b.expectedValue,
    risks: risksOf(b),
    adoption,
  };
}

/**
 * 模板拼接。这是无 LLM 时的默认输出，也是 LLM 拿到的输入骨架。
 */
export function buildTemplate(structured) {
  const { meta, actions, rejected, narrow, dropped } = structured;
  const L = [];

  L.push(`# 套餐策略建议`);
  L.push('');
  L.push(
    `基于 ${meta.orderCount} 笔订单（${meta.source}）挖掘。共发现 ${meta.candidateCount} 个候选组合，` +
      `其中 ${meta.feasibleCount} 个收益上可行。下面是值得优先试的几个。`,
  );
  L.push('');

  actions.forEach((a, i) => {
    L.push(`## ${i + 1}. ${a.bundle}`);
    L.push('');
    L.push(`**推给谁**：${a.audience.who}，${a.audience.when}。覆盖 ${a.matchedCount} 单。`);
    L.push('');
    L.push(
      `**为什么是它**：lift ${a.lift.toFixed(2)}（买其中一件的人买齐整套的概率是随机水平的 ${a.lift.toFixed(1)} 倍），` +
        `支持度 ${pct(a.support, 2)}。这批人原本在这几件上平均花 ${yuan(a.partialSpend)}，` +
        `组合原价 ${yuan(a.listPrice)}，打 ${pct(a.discount, 0)} 折后套餐价 ${yuan(a.bundlePrice)}。`,
    );
    L.push('');
    L.push(
      `**预期收益**：按 ${pct(a.adoption, 0)} 采纳率估，每被覆盖订单客单 +${yuan(a.aovLift)}，` +
        `毛利 +${yuan(a.marginLift)}。盈亏平衡采纳率 ${a.breakEven === null ? '不可行' : pct(a.breakEven)}。`,
    );
    L.push('');
    L.push(`**风险点**：`);
    for (const r of a.risks) {
      L.push(`- ${r.level === 'ok' ? '' : r.level === 'bad' ? '⚠ ' : '· '}${r.text}`);
    }
    L.push('');
  });

  if (rejected.length) {
    L.push(`## 不建议做折扣套餐的组合`);
    L.push('');
    L.push(`以下 ${rejected.length} 个组合虽共现显著，但打折算不过来，列出来是为了别踩：`);
    L.push('');
    for (const b of rejected.slice(0, 8)) {
      L.push(`- **${b.items.join(' + ')}** — ${b.breakEven.reason}（命中率 ${pct(b.hitRate)}）`);
    }
    L.push('');
  }

  if (narrow.length) {
    L.push(`## 覆盖太窄，建议先观察`);
    L.push('');
    L.push(`以下 ${narrow.length} 个组合收益可行但覆盖不足 100 单，跑量太小，先看趋势再决定：`);
    L.push('');
    for (const b of narrow.slice(0, 8)) {
      L.push(`- ${b.items.join(' + ')} — 仅 ${b.matchedCount} 单，中性 Δ客单 ${yuan(b.scenarios.neutral.aovLift)}`);
    }
    L.push('');
  }

  if (dropped?.length) {
    L.push(`## 已合并的重复机会`);
    L.push('');
    L.push(
      `候选列表里还有 ${dropped.length} 个组合属于上面某条的变体（共享大部分商品）。` +
        `把同一个人群推两套套餐会互相抢，所以这里不单列：`,
    );
    L.push('');
    for (const d of dropped.slice(0, 10)) {
      L.push(`- ${d.bundle.items.join(' + ')} — 与「${d.overlapsWith.join(' + ')}」重合度过高`);
    }
    L.push('');
  }

  L.push('---');
  L.push('');
  L.push(
    `数字来源：关联规则（支持度/置信度/lift）为订单数据直接计算结果；` +
      `客单与毛利变化为参数化估算，默认采纳率 ${pct(meta.adoption.neutral, 0)}、折扣 ${pct(meta.discount, 0)}、` +
      `成本率 ${pct(meta.costRatio, 0)}。参数口径与来源见仓库 docs/ASSUMPTIONS.md。`,
  );
  return L.join('\n');
}

/** 交给 LLM 的提示：只让它改措辞，禁止它改数字。 */
export function buildLLMPrompt(structured) {
  return [
    '你是一个餐饮/电商运营顾问。下面是一份从订单数据里跑出来的套餐机会分析（JSON）。',
    '请把它改写成一段运营能直接照着做的建议，要求：',
    '1. 数字一个字都不许改、不许补充新数字。只能使用 JSON 里已有的数值。',
    '2. 不要用营销腔，不要用「赋能」「闭环」「抓手」这类词。像同事之间说话。',
    '3. 每个组合说清楚：推给谁、为什么推它、预期能多收多少、什么情况下别推。',
    '4. 用 Markdown，中文。控制在 800 字以内。',
    '',
    '分析结果：',
    JSON.stringify(structured, null, 2),
  ].join('\n');
}
