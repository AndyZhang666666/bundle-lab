import { simulateStats, validateAssumptions, MODEL_VERSION } from './simulate.js';
export const MANUAL_KEY = 'bundle-lab:manual:v1';
export const SOURCE_KEY = 'bundle-lab:source:v1';
export const UNIT = 100;
export const initialManual = () => ({ version: 1, copied: false,
  items: [{name:'商品 A',price:'20'},{name:'商品 B',price:'8'}], fullShare:'20', incompleteSpend:'18',
  discount:0.12,costRatio:0.4,existingRedemption:1,adoption:{conservative:0.05,neutral:0.12,optimistic:0.25} });
function number(value, label, min, max) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim()==='' || !Number.isFinite(Number(value)) || Number(value)<min || Number(value)>max) throw Error(`${label}须为 ${min}–${max} 的数值`);
  return Number(value);
}
export function manualBundle(d) {
  if(!d || d.version!==1 || !Array.isArray(d.items) || d.items.length<2 || d.items.length>3) throw Error('请输入 2–3 件商品');
  const items=d.items.map((i,index)=>{if(typeof i.name!=='string'||!i.name.trim()||i.name.trim().length>40)throw Error(`请填写商品 ${index+1} 的名称（最多40字）`);return i.name.trim();});
  if(new Set(items).size!==items.length)throw Error('商品名称不能重复');
  const prices=d.items.map((i,index)=>number(i.price,`商品 ${index+1} 价格`,0,100000));
  const listPrice=prices.reduce((a,b)=>a+b,0), hitRate=number(d.fullShare,'已买齐者占比（%）',0,100)/100;
  const spend=number(d.incompleteSpend,'未买齐者原有平均消费',0,listPrice);
  if(listPrice<=0)throw Error('商品原价合计须大于0');
  return {key:'manual',items,prices,listPrice,hitRate,
    // The core expects the whole covered population mean, not the incomplete group's mean.
    partialSpend:hitRate*listPrice+(1-hitRate)*spend,
    matchedCount:UNIT,unit:'normalized-covered-orders',source:'user-assumptions'};
}
export function decodeManual(raw) {
  if(!raw)return null;
  if(raw.length>16000)throw Error('自建算例过大');
  const d=JSON.parse(raw);manualBundle(d);validateAssumptions(d);return d;
}
export function copyToManual(bundle, assumptions) {
  const h=bundle.hitRate,q=1-h;
  return {version:1,copied:true,items:bundle.items.map((name,i)=>({name,price:String(bundle.prices[i])})),
    fullShare:String(Number((h*100).toFixed(6))),incompleteSpend:String(q>0?(bundle.partialSpend-h*bundle.listPrice)/q:0),...validateAssumptions(assumptions)};
}
export function assumptionReport(bundle, assumptions, source) {
  const sim=simulateStats(bundle,assumptions);
  return {version:1,modelVersion:MODEL_VERSION,source,unit:'每100个覆盖订单（归一比较单位，不是观测样本量）',
    bundle:{items:bundle.items,prices:bundle.prices,listPrice:bundle.listPrice,fullShare:bundle.hitRate,
      incompleteSpend:bundle.hitRate===1?null:sim.scenarios.neutral.incompleteSpend},assumptions:validateAssumptions(assumptions),
    resultPer100:{addedMargin:sim.scenarios.neutral.addedMargin*UNIT,existingLoss:sim.scenarios.neutral.existingLoss*UNIT,
      marginLift:sim.scenarios.neutral.marginLift*UNIT,breakEven:sim.breakEven},
    nextValidation:['核实商品成本、已买齐占比及未买齐者消费基线','小流量验证新增采纳和既有顾客领券比例，保留对照组','补计履约、库存、运营和跨订单蚕食成本'],
    limits:['条件推演，不代表已发生的收益或因果效果','毛利不等于净利润；不同组合不能相加']};
}
export function assumptionMarkdown(r) {
  const money=n=>`¥${n.toFixed(2)}`,pct=n=>`${(n*100).toFixed(1)}%`,a=r.assumptions,n=r.resultPer100;
  return ['# 套餐假设卡','',`来源：${r.source}`,`模型：${r.modelVersion}`,`比较单位：${r.unit}`,'',
    '## 方案与假设',...r.bundle.items.map((name,i)=>`- ${name}：${money(r.bundle.prices[i])}`),
    `- 已买齐者占比：${pct(r.bundle.fullShare)}`,`- 未买齐者原有平均消费：${r.bundle.incompleteSpend==null?'不适用（没有未买齐者）':money(r.bundle.incompleteSpend)}`,
    `- 折扣率：${pct(a.discount)}；成本率：${pct(a.costRatio)}；既有顾客领折扣率：${pct(a.existingRedemption)}`,
    `- 未买齐者采纳率（低 / 中 / 高）：${Object.values(a.adoption).map(pct).join(' / ')}`,'',
    '## 中档结果（每100个覆盖订单）',`- 新增毛利贡献：${money(n.addedMargin)}`,`- 既有顾客让利损失：${money(n.existingLoss)}`,
    `- 增量毛利：${money(n.marginLift)}`,`- 平衡采纳率：${n.breakEven.rate==null?'不可达':pct(n.breakEven.rate)}。${n.breakEven.reason||'仅在当前假设下成立。'}`,
    '', '## 下一步验证',...r.nextValidation.map(t=>`- ${t}`),'','## 边界',...r.limits.map(t=>`- ${t}`)].join('\n');
}
