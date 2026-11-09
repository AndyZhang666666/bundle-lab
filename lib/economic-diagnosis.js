import { simulateOne, simulateStats, validateAssumptions } from './simulate.js';

// A boundary query on the canonical model, not a parallel profit formula.
// With fixed populations/adoption/cost the existing model is affine in discount.
export function breakEvenDiscount(args) {
  const at = discount => simulateOne({ ...args, bundleP: args.listPrice * (1 - discount) }).marginLift;
  const zero = at(0), full = at(1);
  if (zero < -1e-10) return { rate: null, state: 'unreachable', reason: '不打折也不能抵消损失；请先核实输入' };
  if (Math.abs(zero) < 1e-10 && Math.abs(full) < 1e-10) return { rate: 1, state: 'flat', reason: '当前人群与行为不产生增量或让利；全区间持平不等于有收益' };
  if (full >= 0) return { rate: 1, state: 'bounded', reason: '当前模型内0–100%均不为负，仍需验证行为假设' };
  if (zero === 0) return { rate: 0, state: 'zero-only', reason: '当前没有可抵消让利的新增贡献，只有不打折能持平' };
  let lo = 0, hi = 1;
  for (let i = 0; i < 60; i++) { const middle = (lo + hi) / 2; if (at(middle) >= 0) lo = middle; else hi = middle; }
  return { rate: lo, state: 'bounded', reason: '固定当前采纳、人群和成本；不是价格弹性或最优折扣' };
}
export function discountBoundaryLabel(boundary) {
  return boundary.rate == null ? '不可达' : boundary.state === 'flat' ? '全区间持平（无增量）' : `${(Math.floor(boundary.rate * 10000 + 1e-9) / 100).toFixed(2)}%`;
}
export function economicDiagnosis(bundle, assumptions) {
  const a = validateAssumptions(assumptions), sim = simulateStats(bundle, a), n = sim.scenarios.neutral;
  const discountBoundary = breakEvenDiscount({ listPrice: sim.listPrice, partialSpend: bundle.partialSpend, hitRate: bundle.hitRate, costRatio: a.costRatio, existingRedemption: a.existingRedemption, adoption: a.adoption.neutral });
  const money = v => `¥${Math.abs(v).toFixed(2)}`, pct = v => `${(v * 100).toFixed(1)}%`;
  let cause = n.addedMargin < 0 ? '补齐套餐本身产生负增量毛利，不能只靠提高采纳改善' : n.marginLift < 0 ? '既有顾客让利超过新增贡献' : n.marginLift > 0 ? '新增贡献覆盖了既有让利，但行为假设仍需验证' : '当前收支相抵，尚无额外毛利';
  if (bundle.hitRate === 1) cause = a.existingRedemption > 0 && a.discount > 0 ? '原本全部已买齐，只有让利、没有新增购买' : '原本全部已买齐，不产生新增购买';
  const ledger = `原本已买齐者${pct(bundle.hitRate)}；每覆盖单新增贡献${n.addedMargin < 0 ? '−' : '+'}${money(n.addedMargin)}，既有让利−${money(n.existingLoss)}，净变化${n.marginLift < 0 ? '−' : '+'}${money(n.marginLift)}。`;
  const action = discountBoundary.state === 'flat' ? discountBoundary.reason : `固定中档采纳${pct(a.adoption.neutral)}时，折扣边界${discountBoundaryLabel(discountBoundary)}${discountBoundary.rate != null ? '（不高于此值才不为负）' : ''}。${sim.breakEven.rate == null ? `采纳平衡点不可达：${sim.breakEven.reason}。` : `当前折扣下需采纳至少${pct(sim.breakEven.rate)}。`}`;
  return { discountBoundary, currentPerOrder: { addedMargin: n.addedMargin, existingLoss: n.existingLoss, marginLift: n.marginLift }, cause, text: `${cause}。${ledger}${action}`, limits: '条件边界，非最优定价；未扣履约、库存与运营成本。' };
}
