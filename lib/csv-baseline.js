import { initialManual, manualBundle } from './manual-scenario.js';
import { validateAssumptions } from './simulate.js';
import { CSV_UNIT, validateCsvBaseline } from './baseline-source.js';
export const CSV_KEY='bundle-lab:csv-baseline:v1';
export const CSV_TEMPLATE='order_id,sku,unit_price,model_scope\norder-01,鸡腿饭,24,"按商品出现去重，不含数量、实付与退款"\norder-01,可乐,5,"按商品出现去重，不含数量、实付与退款"\norder-02,鸡腿饭,24,"按商品出现去重，不含数量、实付与退款"\norder-03,可乐,5,"按商品出现去重，不含数量、实付与退款"\norder-04,鸡腿饭,24,"按商品出现去重，不含数量、实付与退款"\n';
const MAX_BYTES=2*1024*1024;
// RFC-style fields (quoted commas, line breaks and escaped quotes). This does not
// touch the legacy synthetic-order loader or silently skip invalid rows.
export function parseBaselineCSV(raw){
 if(typeof raw!=='string'||new TextEncoder().encode(raw).length>MAX_BYTES)throw Error('CSV最多2MB');
 const input=raw.replace(/^\uFEFF/,'');let cell='',row=[],rows=[],quoted=false,closed=false,line=1,start=1;
 const endCell=()=>{row.push(cell);cell='';closed=false;};
 const endRow=()=>{endCell();if(row.some(c=>c.trim()))rows.push({cells:row,line:start});row=[];start=line+1;};
 for(let i=0;i<input.length;i++){
  const c=input[i];
  if(quoted){if(c==='"'){if(input[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else{cell+=c;if(c==='\n'||(c==='\r'&&input[i+1]!=='\n'))line++;}continue;}
  if(c==='"'){if(cell.length||closed)throw Error(`第${line}行：引号位置无效`);quoted=true;continue;}
  if(c===','){endCell();continue;}
  if(c==='\n'||c==='\r'){if(c==='\r'&&input[i+1]==='\n')i++;endRow();line++;start=line;continue;}
  if(closed){if(c===' '||c==='\t')continue;throw Error(`第${line}行：引号结束后只能接分隔符`);}
  cell+=c;
 }
 if(quoted)throw Error(`第${start}行：引号没有闭合`);if(cell.length||row.length||closed)endRow();
 if(rows.length<2)throw Error('CSV至少需要表头和一条明细');
 const header=rows.shift().cells.map(x=>x.trim());
 if(new Set(header).size!==header.length||header.some(x=>!x))throw Error('表头不能重复或留空');
 for(const key of ['order_id','sku'])if(!header.includes(key))throw Error(`缺少必需列：${key}`);
 if(rows.length>10000)throw Error('CSV最多10,000条明细');
 const orders=new Map(),products=new Map();
 for(const r of rows){
  if(r.cells.length!==header.length)throw Error(`第${r.line}行：列数与表头不一致`);
  const v=Object.fromEntries(header.map((key,i)=>[key,r.cells[i].trim()]));
  if(!v.order_id||v.order_id.length>160||!v.sku||v.sku.length>40)throw Error(`第${r.line}行：订单号须为1–160字，商品名须为1–40字`);
  if(!orders.has(v.order_id))orders.set(v.order_id,new Set());orders.get(v.order_id).add(v.sku);
  if(!products.has(v.sku))products.set(v.sku,{prices:new Map(),missingPrices:0});
  if(products.size>100)throw Error('CSV最多100个SKU');
  if(v.unit_price!==undefined&&v.unit_price!==''){
   const price=Number(v.unit_price);if(!Number.isFinite(price)||price<0||price>100000)throw Error(`第${r.line}行：参考单价须为0–100000的数字`);
   const prices=products.get(v.sku).prices;prices.set(price,(prices.get(price)||0)+1);
  }else products.get(v.sku).missingPrices++;
 }
 return {version:1,rowCount:rows.length,orders:[...orders].map(([id,items])=>({id,items:[...items]})),products:[...products].map(([sku,data])=>({sku,prices:[...data.prices.keys()].sort((a,b)=>a-b),priceCounts:[...data.prices].map(([price,rows])=>({price,rows})).sort((a,b)=>a.price-b.price),missingPrices:data.missingPrices})),unusedColumns:header.filter(k=>!['order_id','sku','unit_price'].includes(k)),unit:CSV_UNIT};
}
export function csvToManual(parsed,selection,prices,assumptions=initialManual()){
 if(!Array.isArray(selection)||selection.length<2||selection.length>3||new Set(selection).size!==selection.length)throw Error('请选择2–3个不同商品');
 const known=new Set(parsed.products.map(p=>p.sku));
 const items=selection.map(name=>{if(!known.has(name))throw Error('所选商品不在当前CSV里');const raw=prices[name];if(raw==null||String(raw).trim()===''||!Number.isFinite(Number(raw))||Number(raw)<0||Number(raw)>100000)throw Error(`请确认「${name}」的统一参考单价`);return {name,price:String(Number(raw))};});
 const covered=parsed.orders.filter(o=>selection.some(s=>o.items.includes(s)));
 if(!covered.length)throw Error('没有包含所选商品的覆盖订单');
 const full=covered.filter(o=>selection.every(s=>o.items.includes(s))),incomplete=covered.filter(o=>!selection.every(s=>o.items.includes(s)));
 const spend=incomplete.length?incomplete.reduce((sum,o)=>sum+items.reduce((v,item)=>v+(o.items.includes(item.name)?Number(item.price):0),0),0)/incomplete.length:0;
 const draft={...initialManual(),...validateAssumptions(assumptions),items,fullShare:String(full.length/covered.length*100),incompleteSpend:String(spend),copied:false,baseline:{version:1,totalOrders:parsed.orders.length,coveredOrders:covered.length,fullOrders:full.length,rowCount:parsed.rowCount,unusedColumns:parsed.unusedColumns,referencePrices:items.map(i=>Number(i.price)),unit:parsed.unit},provenance:`CSV派生基线；${covered.length}个覆盖订单/${parsed.orders.length}个导入订单，按确认参考价重算；未审计`};
 manualBundle(draft);return draft;
}
export function decodeCsvDraft(raw){if(!raw)return null;if(raw.length>24000)throw Error('CSV基线草稿过大');const d=JSON.parse(raw),bundle=manualBundle(d);validateAssumptions(d);validateCsvBaseline(d.baseline,bundle);return d;}
export function countsToShare(covered,full){if(String(covered).trim()===''||String(full).trim()===''||!Number.isSafeInteger(Number(covered))||!Number.isSafeInteger(Number(full))||Number(covered)<1||Number(covered)>1e9||Number(full)<0||Number(full)>Number(covered))throw Error('覆盖数须为1–10亿的整数，已买齐数须为0到覆盖数的整数');return Number(full)/Number(covered)*100;}
