import test from 'node:test';import assert from 'node:assert/strict';
import {createValidationPlan,createObservation,addObservation,decodePlans,validationPlanMarkdown,summarizeObservationGroup} from '../lib/validation-plans.js';import {initialManual,manualBundle} from '../lib/manual-scenario.js';
const fields={title:'小流量试行',baselinePeriod:'上一周',audience:'同一门店订单',allocation:'按用户随机分流；保留不展示优惠组',duration:'一周后检查完整性',primaryMetric:'同口径增量毛利',guardrails:'退款与履约异常'};
test('plans freeze inputs and append observations without modifying a snapshot',()=>{
 const d=initialManual(),b=manualBundle(d),p=createValidationPlan(b,d,{kind:'manual',label:'用户假设'},fields,{id:'p',createdAt:'2026-11-09T00:00:00Z'}),before=JSON.stringify(p);d.discount=.5;b.items[0]='edited';assert.equal(p.assumptions.discount,.12);assert.equal(p.bundle.items[0],'商品 A');
 const o=createObservation({treatment:{covered:'100',incomplete:'80',completed:'24',fullRedeemed:'10'},control:{covered:'100',incomplete:'80',completed:'8',fullRedeemed:'0'},costSource:'用户采购记录，未审计'},{id:'o',at:'2026-11-09T01:00:00Z'}),next=addObservation(p,o);assert.equal(next.observations[0].treatment.adoption,.3);assert.equal(next.observations[0].treatment.redemption,.5);assert.equal(JSON.stringify(p),before);
 const raw=JSON.stringify({version:1,plans:[next],selectedId:'p'});assert.deepEqual(decodePlans(raw).plans[0],next);assert.match(validationPlanMarkdown(next),/描述性观察/);assert.match(validationPlanMarkdown(p),/尚无观察/);
});
test('observation unknowns and zero denominators remain unknown, invalid counts reject',()=>{
 const x=summarizeObservationGroup({covered:'0',incomplete:'0',completed:'0',fullRedeemed:'0'});assert.equal(x.adoption,null);assert.equal(x.redemption,null);assert.equal(summarizeObservationGroup({covered:'10',completed:'2'}).adoption,null);
 for(const v of [{covered:5,incomplete:6},{incomplete:3,completed:4},{covered:10,incomplete:8,fullRedeemed:3},{covered:-1},{covered:'.2'}])assert.throws(()=>summarizeObservationGroup(v));assert.throws(()=>createObservation({treatment:{},control:{}}));
});
test('corrupt or tampered plan storage rejects before any write',()=>{const d=initialManual(),p=createValidationPlan(manualBundle(d),d,{kind:'manual',label:'假设'},fields);const raw=JSON.stringify({version:1,plans:[p],selectedId:p.id});assert.throws(()=>decodePlans(raw.replace('two-population-v2-2026-10-25','old')));assert.throws(()=>decodePlans(raw.replace('"discount":0.12','"discount":0.5')));assert.throws(()=>createValidationPlan(manualBundle(d),d,{kind:'manual',label:'假设'},{...fields,allocation:''}));});
test('observations compare with frozen assumptions while unknown or disjoint counts stay bounded',async()=>{
 const {observationComparison,observationComparisonText}=await import('../lib/validation-plans.js');
 const d=initialManual(),p=createValidationPlan(manualBundle(d),d,{kind:'manual',label:'user'},fields),g=summarizeObservationGroup({covered:100,incomplete:80,completed:24,fullRedeemed:10});
 assert.ok(Math.abs(observationComparison(g,p).adoption.delta-.18)<1e-12);assert.equal(observationComparison(g,p).redemption.delta,-.5);assert.match(observationComparisonText(g,p),/\+18.0个百分点/);assert.match(observationComparisonText(g,p),/缺失字段：无/);
 const partial=summarizeObservationGroup({covered:100,completed:10});assert.equal(observationComparison(partial,p).adoption,null);assert.match(observationComparisonText(partial,p),/原未买齐数/);
 for(const x of [{covered:5,completed:6},{covered:5,fullRedeemed:6},{covered:10,completed:8,fullRedeemed:4}])assert.throws(()=>summarizeObservationGroup(x));
});
test('CSV provenance remains bound across assumptions, snapshots, plans and both Markdown exports',async()=>{
 const {parseBaselineCSV,csvToManual}=await import('../lib/csv-baseline.js');const {assumptionReport,assumptionMarkdown}=await import('../lib/manual-scenario.js');const {createStrategy,addStrategy,emptyStrategies,strategiesReport,strategiesMarkdown}=await import('../lib/strategies.js');
 const draft=csvToManual(parseBaselineCSV('order_id,sku,unit_price\n1,A,20\n1,B,8\n2,A,20\n3,B,8'),['A','B'],{A:20,B:8}),bundle={...manualBundle(draft),baseline:draft.baseline},source={kind:'csv',label:'CSV确认参考价',baseline:draft.baseline};
 const plan=createValidationPlan(bundle,draft,source,fields),snapshot=createStrategy(bundle,draft,source),state=addStrategy(emptyStrategies(),snapshot),report=assumptionReport(bundle,draft,source.label,'csv');
 report.validationPlans=[plan];assert.match(assumptionMarkdown(report),/覆盖3单/);assert.match(assumptionMarkdown(report),/验证计划/);assert.match(strategiesMarkdown(state,[plan]),/最高|折扣边界/);assert.equal(strategiesReport(state,[plan]).snapshots[0].source.baseline.coveredOrders,3);
 assert.equal(decodePlans(JSON.stringify({version:1,plans:[plan],selectedId:plan.id})).plans[0].source.baseline.fullOrders,1);
 assert.throws(()=>createStrategy(bundle,draft,{...source,baseline:{...draft.baseline,fullOrders:2}}));
 const manual={...initialManual(),fullShare:'25',manualBaseline:{covered:200,full:50}},mb={...manualBundle(manual),manualBaseline:manual.manualBaseline};assert.match(assumptionMarkdown(assumptionReport(mb,manual,'用户计数','manual')),/覆盖200单、已买齐50单/);
});
