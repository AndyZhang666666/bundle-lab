// Import/count metadata is independently checked against the canonical bundle.
// It documents composition only; it never upgrades user input to audited data.
export const CSV_UNIT = '一单一商品集合；数量、优惠实付与退款未进入模型';
const close = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b)<1e-8;
export function validateCsvBaseline(b, bundle) {
  if (!b || b.version!==1 || !['totalOrders','coveredOrders','fullOrders','rowCount'].every(k=>Number.isSafeInteger(b[k])&&b[k]>=0&&b[k]<=10000)
    || b.coveredOrders<1 || b.totalOrders<b.coveredOrders || b.fullOrders>b.coveredOrders || b.rowCount<b.totalOrders
    || !Array.isArray(b.referencePrices) || b.referencePrices.length!==bundle.prices.length || b.referencePrices.some((p,i)=>!close(p,bundle.prices[i]))
    || !close(b.fullOrders/b.coveredOrders,bundle.hitRate) || b.unit!==CSV_UNIT || !Array.isArray(b.unusedColumns) || b.unusedColumns.some(c=>typeof c!=='string')) throw Error('CSV基线记录与当前商品、人群不一致');
  return JSON.parse(JSON.stringify(b));
}
export function validateManualBaseline(b, bundle) {
  if (!b || !Number.isSafeInteger(b.covered) || b.covered<1 || b.covered>1e9 || !Number.isSafeInteger(b.full) || b.full<0 || b.full>b.covered || !close(b.full/b.covered,bundle.hitRate)) throw Error('手工计数与已买齐比例不一致');
  return {covered:b.covered,full:b.full};
}
export function baselineMetadata(source, bundle) {
  const out={};
  if(source.kind==='csv')out.baseline=validateCsvBaseline(source.baseline,bundle);
  if(source.kind==='manual'&&source.manualBaseline)out.manualBaseline=validateManualBaseline(source.manualBaseline,bundle);
  return out;
}
export function baselineMarkdown(source) {
  if(source.kind==='csv'&&source.baseline){const b=source.baseline;return [`基线：导入${b.totalOrders}单，所选覆盖${b.coveredOrders}单，原已买齐${b.fullOrders}单；${b.rowCount}条明细。`, `口径：${b.unit}；按确认参考价构成重算，不是促销实付核账；未经审计。`];}
  if(source.manualBaseline){const b=source.manualBaseline;return [`基线：用户录入覆盖${b.covered}单、已买齐${b.full}单，未经核验；结果仍按100覆盖单归一。`];}
  return [];
}
