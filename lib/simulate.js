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
 * Δ客单 = 采纳率 × (套餐价 − 匹配订单当前均值)
 *   匹配订单 = 含组合中至少一件商品的订单（这些人是被推的对象）
 *   括号里可能为负 —— 说明这些订单现在的客单已经高于套餐价，
 *   推出去是在做减法。这种情况不藏，直接让它算成负数显示出来。
 *
 * 毛利侧：
 *   原毛利/单 = 匹配订单均值 × (1 − 成本率)
 *   套餐毛利/单 = 套餐价 − 原价 × 成本率
 *   Δ毛利 = 采纳率 × (套餐毛利 − 原毛利)
 */
export function simulateOne({ matchedAOV, bundleP, listPrice, adoption, costRatio = DEFAULT_COST_RATIO }) {
  const aovLift = adoption * (bundleP - matchedAOV);
  const baseMargin = matchedAOV * (1 - costRatio);
  const bundleMargin = bundleP - listPrice * costRatio;
  const marginLift = adoption * (bundleMargin - baseMargin);
  return {
    adoption,
    aovLift,
    aovLiftPct: matchedAOV ? aovLift / matchedAOV : 0,
    baseMargin,
    bundleMargin,
    marginLift,
    marginLiftPct: baseMargin ? marginLift / baseMargin : 0,
  };
}

/**
 * 盈亏平衡采纳率。
 *
 * 一个套餐要不亏，前提是「新增的增量毛利」能盖住「给已经会买的人白让的利」。
 * 记 g = 套餐毛利 − 原毛利（每一单被转化过来的增量毛利），
 * 让利 d = 原价 × 折扣率（每一单让出去的钱）。
 *
 *   平衡采纳率 = d / (d + g)   当 g > 0
 *
 * 推导：设采纳率 a，被转化的订单贡献 a·g；同时这批人里本来就会全买的
 * 那部分（比例按组合命中率 h 近似）白拿了折扣，损失 h·d。
 * a·g = h·d → a = h·d/g。这里取 h 的上界 1 做保守处理，再归一化到
 * (0,1) 区间，得到上面的形式。g ≤ 0 时无论多高采纳率都不赚，返回 null。
 */
export function breakEvenAdoption({ listPrice, bundleP, matchedAOV, discount = DEFAULT_DISCOUNT, costRatio = DEFAULT_COST_RATIO }) {
  const baseMargin = matchedAOV * (1 - costRatio);
  const bundleMargin = bundleP - listPrice * costRatio;
  const g = bundleMargin - baseMargin;
  const d = listPrice * discount;
  if (g <= 0) return { rate: null, incrementalMargin: g, giveaway: d, reason: '套餐毛利低于当前订单毛利，任何采纳率都亏' };
  const rate = d / (d + g);
  return { rate, incrementalMargin: g, giveaway: d, reason: null };
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

  const scenarios = {};
  for (const [name, rate] of Object.entries(adoption)) {
    scenarios[name] = simulateOne({ matchedAOV, bundleP, listPrice, adoption: rate, costRatio });
  }
  const be = breakEvenAdoption({ listPrice, bundleP, matchedAOV, discount, costRatio });

  return {
    key: bundle.key,
    items: bundle.items,
    lift: bundle.lift,
    support: bundle.support,
    matchedCount: matched.length,
    matchedShare: transactions.length ? matched.length / transactions.length : 0,
    matchedAOV,
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
