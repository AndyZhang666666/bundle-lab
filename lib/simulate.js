// Two-population, one-period scenario model. All amounts use one covered order.
// No price elasticity, exposure selection, inventory, fulfilment or causal uplift is inferred.
export const MODEL_VERSION = "two-population-v2-2026-10-25";
export const DEFAULT_ADOPTION = {
  conservative: 0.05,
  neutral: 0.12,
  optimistic: 0.25,
};
export const DEFAULT_DISCOUNT = 0.12;
export const DEFAULT_COST_RATIO = 0.4;
const mean = (xs) =>
  xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
function finite(v, name, lo = 0, hi = Infinity) {
  if (!Number.isFinite(v) || v < lo || v > hi)
    throw Error(name + "超出有效范围");
  return v;
}
export function validateAssumptions({
  discount = DEFAULT_DISCOUNT,
  costRatio = DEFAULT_COST_RATIO,
  adoption = DEFAULT_ADOPTION,
  existingRedemption = 1,
} = {}) {
  finite(discount, "折扣", 0, 1);
  finite(costRatio, "成本率", 0, 1);
  finite(existingRedemption, "既有整套者领折扣率", 0, 1);
  for (const k of ["conservative", "neutral", "optimistic"])
    finite(adoption[k], "采纳率", 0, 1);
  if (
    adoption.conservative > adoption.neutral ||
    adoption.neutral > adoption.optimistic
  )
    throw Error("采纳率须保持低档 ≤ 中档 ≤ 高档");
  return {
    discount,
    costRatio,
    adoption: {
      conservative: adoption.conservative,
      neutral: adoption.neutral,
      optimistic: adoption.optimistic,
    },
    existingRedemption,
  };
}
export function bundlePrice(items, priceOf, discount = DEFAULT_DISCOUNT) {
  if (
    !Array.isArray(items) ||
    items.length < 2 ||
    new Set(items).size !== items.length
  )
    throw Error("组合须含至少两个不重复商品");
  finite(discount, "折扣", 0, 1);
  const listPrice = items.reduce(
    (s, i) => s + finite(priceOf[i], "商品价格"),
    0,
  );
  return {
    listPrice,
    bundleP: listPrice * (1 - discount),
    discountAmount: listPrice * discount,
    discount,
  };
}
function population({
  partialSpend,
  listPrice,
  bundleP,
  hitRate = 0,
  costRatio = DEFAULT_COST_RATIO,
  existingRedemption = 1,
}) {
  finite(listPrice, "组合原价");
  finite(bundleP, "套餐价", 0, listPrice);
  finite(partialSpend, "原花费", 0, listPrice + 1e-7);
  finite(hitRate, "整套占比", 0, 1);
  finite(costRatio, "成本率", 0, 1);
  finite(existingRedemption, "领折扣率", 0, 1);
  const q = 1 - hitRate,
    residual = partialSpend - hitRate * listPrice;
  if (residual < -1e-7 || (q === 0 && Math.abs(residual) > 1e-7))
    throw Error("人群花费与整套占比不一致");
  const incompleteSpend = q > 0 ? Math.max(0, residual / q) : 0;
  const giveaway = listPrice - bundleP;
  const baseMargin = partialSpend * (1 - costRatio);
  const bundleMargin = bundleP - listPrice * costRatio;
  const incrementalMargin = bundleMargin - incompleteSpend * (1 - costRatio);
  const fixedLoss = hitRate * existingRedemption * giveaway;
  return {
    q,
    incompleteSpend,
    giveaway,
    baseMargin,
    bundleMargin,
    incrementalMargin,
    fixedLoss,
  };
}
// a applies only to people who formerly bought a partial bundle.
// Full-bundle customers redeem with r independently and generate no new items.
export function simulateOne(args) {
  const { adoption } = args;
  finite(adoption, "采纳率", 0, 1);
  const p = population(args),
    {
      q,
      incompleteSpend,
      fixedLoss,
      incrementalMargin,
      baseMargin,
      bundleMargin,
    } = p;
  const addedRevenue = q * adoption * (args.bundleP - incompleteSpend);
  const addedMargin = q * adoption * incrementalMargin;
  const aovLift = addedRevenue - fixedLoss,
    marginLift = addedMargin - fixedLoss;
  return {
    adoption,
    aovLift,
    aovLiftPct: args.partialSpend ? aovLift / args.partialSpend : null,
    marginLift,
    marginLiftPct: baseMargin ? marginLift / baseMargin : null,
    baseMargin,
    bundleMargin,
    incompleteSpend,
    addedRevenue,
    addedMargin,
    existingLoss: fixedLoss,
  };
}
export function breakEvenAdoption(args) {
  const p = population(args),
    { q, incrementalMargin: g, fixedLoss } = p;
  if (q === 0)
    return {
      rate: fixedLoss === 0 ? 0 : null,
      incrementalMargin: g,
      giveaway: p.giveaway,
      reason: fixedLoss
        ? "全部订单原本就买齐，只有让利损失"
        : "没有未买齐人群，不产生增量",
    };
  if (g <= 0)
    return {
      rate: fixedLoss === 0 && g === 0 ? 0 : null,
      incrementalMargin: g,
      giveaway: p.giveaway,
      reason: "未买齐者采纳的增量毛利不为正，不能靠提高采纳率改善",
    };
  const rate = fixedLoss / (q * g);
  return {
    rate: rate <= 1 ? rate : null,
    requiredRate: rate,
    incrementalMargin: g,
    giveaway: p.giveaway,
    reason: rate > 1 ? "平衡采纳率超过100%，当前假设不可达" : null,
  };
}
// Same function serves build-time default cards and client-side custom scenarios.
export function simulateStats(b, assumptions = {}) {
  finite(b.matchedCount, "覆盖订单数", 1);
  const { discount, costRatio, adoption, existingRedemption } =
    validateAssumptions(assumptions);
  const listPrice =
    b.listPrice ?? b.prices?.reduce((s, n) => s + finite(n, "商品价格"), 0);
  const bundleP = listPrice * (1 - discount);
  const args = {
    listPrice,
    bundleP,
    partialSpend: b.partialSpend,
    hitRate: b.hitRate,
    costRatio,
    existingRedemption,
  };
  const scenarios = Object.fromEntries(
    Object.entries(adoption).map(([k, a]) => [
      k,
      simulateOne({ ...args, adoption: a }),
    ]),
  );
  return {
    ...b,
    modelVersion: MODEL_VERSION,
    listPrice,
    bundleP,
    bundlePrice: bundleP,
    discount,
    discountAmount: listPrice * discount,
    costRatio,
    existingRedemption,
    scenarios,
    breakEven: breakEvenAdoption(args),
    expectedValue: scenarios.neutral.marginLift * b.matchedCount,
  };
}
export function simulateBundle({
  bundle,
  transactions,
  priceOf,
  ...assumptions
}) {
  bundlePrice(bundle.items, priceOf, assumptions.discount ?? DEFAULT_DISCOUNT);
  const want = new Set(bundle.items),
    matched = transactions.filter((t) => t.items.some((i) => want.has(i)));
  const partialSpend = mean(
    matched.map((t) =>
      [...new Set(t.items)].reduce(
        (s, i) => s + (want.has(i) ? priceOf[i] : 0),
        0,
      ),
    ),
  );
  const hitCount = matched.filter((t) =>
    bundle.items.every((i) => t.items.includes(i)),
  ).length;
  return simulateStats(
    {
      ...bundle,
      matchedCount: matched.length,
      matchedShare: transactions.length
        ? matched.length / transactions.length
        : 0,
      matchedAOV: mean(matched.map((t) => t.total)),
      partialSpend,
      hitCount,
      hitRate: matched.length ? hitCount / matched.length : 0,
      listPrice: bundle.items.reduce((s, i) => s + priceOf[i], 0),
    },
    assumptions,
  );
}
export function compareBundles(bundles, ctx) {
  return bundles
    .map((bundle) => simulateBundle({ ...ctx, bundle }))
    .sort((a, b) => b.expectedValue - a.expectedValue);
}
