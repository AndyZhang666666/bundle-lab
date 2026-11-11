import {MODEL_VERSION,simulateStats,validateAssumptions} from './simulate.js';
import {economicDiagnosis} from './economic-diagnosis.js';
import {baselineMetadata,baselineMarkdown} from './baseline-source.js';
export const PLAN_KEY='bundle-lab:validation-plans:v1';
export const MAX_PLANS=10,MAX_OBSERVATIONS=10;
export const emptyPlans=()=>({version:1,plans:[],selectedId:null});
const clone=v=>JSON.parse(JSON.stringify(v));
const str=(v,max,label,optional=false)=>{if(typeof v!=='string'||v.length>max||(!optional&&!v.trim()))throw Error(`${label}请填写${max}字以内内容`);return v.trim();};
export function planSignature(bundle,assumptions){return JSON.stringify({items:bundle.items,prices:bundle.prices,listPrice:bundle.listPrice,hitRate:bundle.hitRate,partialSpend:bundle.partialSpend,assumptions:validateAssumptions(assumptions),modelVersion:MODEL_VERSION});}
export function createValidationPlan(bundle,assumptions,source,fields,{id=globalThis.crypto?.randomUUID?.()||`plan-${Date.now()}`,createdAt=new Date().toISOString()}={}){
 if(!bundle||!Array.isArray(bundle.items)||bundle.items.length<2||bundle.items.length>3||!Array.isArray(bundle.prices)||bundle.prices.length!==bundle.items.length||bundle.items.some(x=>typeof x!=='string'||!x.trim()||x.length>40)||new Set(bundle.items).size!==bundle.items.length||bundle.prices.some(v=>!Number.isFinite(v)||v<0)||Math.abs(bundle.prices.reduce((a,b)=>a+b,0)-bundle.listPrice)>1e-6)throw Error('请先完成有效的商品输入');
 const a=validateAssumptions(assumptions);simulateStats(bundle,a);
 if(!['builtin','manual','csv'].includes(source?.kind))throw Error('计划来源无效');
 const textFields=Object.fromEntries(['title','baselinePeriod','audience','allocation','duration','primaryMetric','guardrails'].map(k=>[k,str(fields[k],k==='title'?80:600,k)]));
 const b={key:bundle.key,items:[...bundle.items],prices:[...bundle.prices],listPrice:bundle.listPrice,hitRate:bundle.hitRate,partialSpend:bundle.partialSpend,matchedCount:100};
 if(!Number.isFinite(Date.parse(createdAt)))throw Error('计划时间无效');
 return {version:1,id:str(id,160,'计划标识'),createdAt,modelVersion:MODEL_VERSION,inputSignature:planSignature(b,a),bundle:b,assumptions:clone(a),source:{kind:source.kind,label:str(source.label,240,'来源'),...baselineMetadata(source,b)},fields:textFields,diagnosis:economicDiagnosis(b,a),pendingVerification:['核实基线期间、商品参考价与成本','分开记录未买齐者新增采纳与原已买齐者领折扣','检查退款、履约、库存、运营成本及跨订单影响'],observations:[]};
}
const count=(v,label)=>{if(v==null||String(v).trim()==='')return null;const n=Number(v);if(!Number.isInteger(n)||n<0||n>1e9)throw Error(`${label}须为非负整数或留空`);return n;};
export function summarizeObservationGroup(group){
 const g=Object.fromEntries(['covered','incomplete','completed','fullRedeemed'].map(k=>[k,count(group?.[k],k)]));
 if(g.covered!=null&&g.incomplete!=null&&g.incomplete>g.covered)throw Error('未买齐者人数不能超过覆盖人数');
 if(g.incomplete!=null&&g.completed!=null&&g.completed>g.incomplete)throw Error('补齐人数不能超过原未买齐人数');
 if(g.covered!=null&&((g.completed!=null&&g.completed>g.covered)||(g.fullRedeemed!=null&&g.fullRedeemed>g.covered)||(g.completed!=null&&g.fullRedeemed!=null&&g.completed+g.fullRedeemed>g.covered)))throw Error('补齐与原已买齐领折扣人数不能超过覆盖人数');
 const full=g.covered!=null&&g.incomplete!=null?g.covered-g.incomplete:null;
 if(full!=null&&g.fullRedeemed!=null&&g.fullRedeemed>full)throw Error('既有领折扣人数不能超过原已买齐人数');
 const adoption=g.incomplete>0&&g.completed!=null?g.completed/g.incomplete:null,redemption=full>0&&g.fullRedeemed!=null?g.fullRedeemed/full:null;
 return {...g,full,adoption,redemption,missing:Object.entries(g).filter(([,v])=>v===null).map(([k])=>k),zeroDenominator:g.incomplete===0||full===0};
}
export function createObservation(input,{id=globalThis.crypto?.randomUUID?.()||`obs-${Date.now()}`,at=new Date().toISOString()}={}){
 const treatment=summarizeObservationGroup(input.treatment),control=summarizeObservationGroup(input.control);
 if([...Object.values(treatment).slice(0,4),...Object.values(control).slice(0,4)].every(v=>v===null))throw Error('至少录入一个计数，再保存观察');
 if(!Number.isFinite(Date.parse(at)))throw Error('观察时间无效');
 return {version:1,id:str(id,160,'观察标识'),at,treatment,control,costSource:str(input.costSource||'',600,'成本来源',true),note:str(input.note||'',600,'观察说明',true),status:'用户录入的描述性观察，未审计；不能自动推断因果提升'};
}
export function addObservation(plan,observation){if(plan.observations.length>=MAX_OBSERVATIONS)throw Error('每份计划最多保留10次观察；请先导出归档');return {...plan,observations:[...plan.observations,clone(observation)]};}
export function observationComparison(group,plan){return {adoption:group.adoption==null?null:{observed:group.adoption,assumed:plan.assumptions.adoption.neutral,delta:group.adoption-plan.assumptions.adoption.neutral},redemption:group.redemption==null?null:{observed:group.redemption,assumed:plan.assumptions.existingRedemption,delta:group.redemption-plan.assumptions.existingRedemption}};}
export function observationComparisonText(group,plan){const c=observationComparison(group,plan),pp=n=>`${n>=0?'+':''}${(n*100).toFixed(1)}个百分点`;return `相对计划冻结假设：补齐率${c.adoption?pp(c.adoption.delta):'暂不可比较'}；既有领折扣率${c.redemption?pp(c.redemption.delta):'暂不可比较'}。缺失字段：${group.missing.length?group.missing.map(k=>({covered:'覆盖数',incomplete:'原未买齐数',completed:'补齐数',fullRedeemed:'原已买齐领折扣数'}[k])).join('、'):'无'}。${group.zeroDenominator?'存在零分母，不将对应未知比例当作0。':''}`;}
export function observationBreakEvenCheck(group,plan){
 const observed=summarizeObservationGroup(group).adoption;
 const boundary=simulateStats(plan.bundle,plan.assumptions).breakEven;
 const conditions='仅核对该计划冻结的模型条件；实际成本、领折扣行为与人群基线仍需核实。不代表因果提升、统计显著或上线许可。';
 const unavailable=plan.bundle.hitRate===1||boundary.incrementalMargin<=0||boundary.rate==null||!Number.isFinite(boundary.rate)||boundary.rate<0||boundary.rate>1;
 if(unavailable)return {state:'unavailable',observed,threshold:null,gapPp:null,title:'暂不能判断保本条件',reason:boundary.reason||'该计划没有可定义的保本采纳率',nextAction:'先核实冻结的人群、成本与折扣条件；需要更改时另存新计划。',conditions};
 if(observed==null)return {state:'unknown',observed:null,threshold:boundary.rate,gapPp:null,title:'暂不能判断保本条件',reason:'原未买齐人数或补齐人数未知，或原未买齐人数为0',nextAction:'补全同口径分母和补齐人数；零分母不按0%判断。',conditions};
 const crossed=observed+1e-12>=boundary.rate;
 return {state:crossed?'crossed':'below',observed,threshold:boundary.rate,gapPp:(observed-boundary.rate)*100,title:crossed?'达到冻结模型的保本采纳条件':'尚未达到冻结模型的保本采纳条件',reason:null,nextAction:crossed?'继续核实实际让利、成本和基线，再结合对照与经营护栏决定下一步。':'先核对计数、成本与领折扣行为；若口径成立，再试减少存量让利或缩小折扣，另存计划后验证。',conditions};
}
export function observationBreakEvenText(group,plan){
 const c=observationBreakEvenCheck(group,plan);
 return `${c.title}。${c.threshold==null?'冻结保本采纳不可用':`冻结保本采纳${(c.threshold*100).toFixed(1)}%`}；${c.observed==null?'观察补齐率未知':`观察补齐率${(c.observed*100).toFixed(1)}%`}。${c.state==='below'?`尚差${Math.abs(c.gapPp).toFixed(1)}个百分点。`:''}${c.reason?c.reason+'。':''}${c.nextAction}${c.conditions}`;
}
export function validationPlanReport(plan){
 return {...clone(plan),frozenBreakEven:simulateStats(plan.bundle,plan.assumptions).breakEven,observations:plan.observations.map(o=>({...clone(o),boundaryChecks:Object.fromEntries(['treatment','control'].map(k=>[k,observationBreakEvenCheck(o[k],plan)]))}))};
}
export function decodePlans(raw){
 if(!raw)return emptyPlans();if(raw.length>512000)throw Error('计划记录过大');const d=JSON.parse(raw);
 if(!d||d.version!==1||!Array.isArray(d.plans)||d.plans.length>MAX_PLANS)throw Error('计划记录格式无效');
 const plans=d.plans.map(p=>{if(p.modelVersion!==MODEL_VERSION||!Array.isArray(p.observations)||p.observations.length>MAX_OBSERVATIONS)throw Error('计划版本或观察记录无效');const fresh=createValidationPlan(p.bundle,p.assumptions,p.source,p.fields,{id:p.id,createdAt:p.createdAt});if(p.inputSignature!==fresh.inputSignature)throw Error('计划绑定的输入不一致');return {...fresh,observations:p.observations.map(o=>createObservation(o,{id:o.id,at:o.at}))};});
 if(new Set(plans.map(p=>p.id)).size!==plans.length||(d.selectedId!==null&&!plans.some(p=>p.id===d.selectedId)))throw Error('计划选择或标识无效');
 return {version:1,plans,selectedId:d.selectedId};
}
const pct=n=>n==null?'未知/分母为0':`${(n*100).toFixed(1)}%`,n=v=>v==null?'未填':String(v);
export function validationPlanMarkdown(p){
 const rows=['## 验证计划：'+p.fields.title,`冻结：${p.createdAt}；模型：${p.modelVersion}`,`来源：${p.source.label}`,...baselineMarkdown(p.source),`商品：${p.bundle.items.map((x,i)=>`${x} ¥${p.bundle.prices[i].toFixed(2)}`).join('＋')}`,`折扣${pct(p.assumptions.discount)}；中档采纳${pct(p.assumptions.adoption.neutral)}；成本${pct(p.assumptions.costRatio)}；既有领折扣${pct(p.assumptions.existingRedemption)}`,`基线期间：${p.fields.baselinePeriod}`,`试验对象：${p.fields.audience}`,`分流/对照：${p.fields.allocation}`,`观察时长：${p.fields.duration}`,`主要指标：${p.fields.primaryMetric}`,`护栏：${p.fields.guardrails}`,'',p.diagnosis.text,'待核实：',...p.pendingVerification.map(t=>'- '+t),''];
 if(!p.observations.length)rows.push('尚无观察结果。');
 for(const o of p.observations){rows.push(`### 用户录入观察 ${o.at}`,o.status,`成本来源：${o.costSource||'未填写，不能当作已核实成本'}`,`说明：${o.note||'未填写'}`);for(const [k,label] of [['treatment','试验组'],['control','对照组']]){const g=o[k];rows.push(`- ${label}：覆盖${n(g.covered)}；原未买齐${n(g.incomplete)}；补齐${n(g.completed)}；原已买齐领折扣${n(g.fullRedeemed)}；补齐率${pct(g.adoption)}；既有领折扣率${pct(g.redemption)}`,`  ${observationComparisonText(g,p)}`,`  ${observationBreakEvenText(g,p)}`);}rows.push('未知与零分母不填0；两组差异是描述性记录，不自动判定显著、增量或全量上线。','');}
 return rows.join('\n');
}
export function validationPlansMarkdown(plans){return plans.length?'\n\n# 已保存验证计划（各自绑定冻结输入）\n\n'+plans.map(validationPlanMarkdown).join('\n\n'):'\n\n## 验证计划\n尚未保存计划，尚无观察结果。';}
