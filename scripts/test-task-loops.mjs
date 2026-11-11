import test from 'node:test';
import assert from 'node:assert/strict';
import {rankedBundles} from '../lib/dataset.js';
import {defaultScenario,decodeScenario} from '../lib/scenario.js';
import {simulateStats,MODEL_VERSION} from '../lib/simulate.js';
import {initialManual,manualBundle} from '../lib/manual-scenario.js';
import {parseBaselineCSV,csvToManual,decodeCsvDraft} from '../lib/csv-baseline.js';
import {TARGETING_PRESETS,applyTargetingPreset,targetingPreset} from '../lib/targeting.js';
import {emptyStrategies,createStrategy,addStrategy,createSensitivityPreview,saveSensitivityPreview,sensitivityPreviewIsCurrent,nextStrategySlot,decodeStrategies,strategyResult} from '../lib/strategies.js';
import {createValidationPlan,summarizeObservationGroup,observationBreakEvenCheck,observationBreakEvenText,addObservation,createObservation,validationPlanReport,validationPlanMarkdown,decodePlans} from '../lib/validation-plans.js';
const fields={title:'Frozen condition check',baselinePeriod:'Synthetic week',audience:'Covered orders',allocation:'Descriptive fixture only',duration:'One period',primaryMetric:'Incremental contribution',guardrails:'Refunds and fulfilment'};
const source={kind:'manual',label:'Unverified manual assumptions'};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} ≈ ${b}`);

test('real cola+rice presets use canonical arithmetic: -49.51, -1.70, +31.76 with nonzero leakage',()=>{
 const bundles=rankedBundles(),b=bundles.find(b=>b.key==='可乐 + 鸡腿饭'),a=defaultScenario(bundles);
 assert.equal(a.pickKey,b.key);
 const sims=TARGETING_PRESETS.map(p=>simulateStats(b,applyTargetingPreset(a,p.id)));
 assert.deepEqual(sims.map(s=>s.scenarios.neutral.marginLift.toFixed(12)),['-0.495071287129','-0.017001980198','0.317646534653']);
 assert.deepEqual(sims.map(s=>(s.scenarios.neutral.marginLift*100).toFixed(2)),['-49.51','-1.70','31.76']);
 for(let i=0;i<sims.length;i++){
  near(sims[i].scenarios.neutral.addedMargin,sims[0].scenarios.neutral.addedMargin);
  near(sims[i].scenarios.neutral.existingLoss,sims[0].scenarios.neutral.existingLoss*TARGETING_PRESETS[i].rate);
 }
 assert.ok(sims[2].scenarios.neutral.existingLoss>0);
});
test('all-full baskets and zero adoption still lose existing discounts under every preset',()=>{
 const a=initialManual(),b=manualBundle({...a,fullShare:'100'});
 for(const preset of TARGETING_PRESETS){
  const next=applyTargetingPreset(a,preset.id),sim=simulateStats(b,next);
  near(sim.scenarios.neutral.addedMargin,0);assert.ok(sim.scenarios.neutral.marginLift<0);assert.equal(sim.breakEven.rate,null);
  const zero=simulateStats(manualBundle(a),{...next,adoption:{conservative:0,neutral:0,optimistic:0}});
  assert.equal(zero.scenarios.neutral.addedMargin,0);assert.ok(zero.scenarios.neutral.marginLift<0);
 }
});
test('presets preserve all other assumptions, custom values and independent source drafts',()=>{
 const builtin=defaultScenario(rankedBundles()),manual={...initialManual(),existingRedemption:.37,provenance:'kept'};
 const csv=csvToManual(parseBaselineCSV('order_id,sku,unit_price\n1,A,20\n1,B,8\n2,A,20\n3,B,8'),['A','B'],{A:20,B:8});
 const originals=JSON.stringify({builtin,manual,csv});
 for(const draft of [builtin,manual,csv]){
  const next=applyTargetingPreset(draft,'checkout-addon');
  assert.deepEqual({...next,existingRedemption:draft.existingRedemption},draft);
  assert.equal(targetingPreset(next.existingRedemption).id,'checkout-addon');
 }
 assert.equal(targetingPreset(.37),null);assert.equal(targetingPreset(.5).id,'manual-coupon');
 assert.equal(decodeScenario(JSON.stringify(applyTargetingPreset(builtin,'manual-coupon')),rankedBundles()).existingRedemption,.5);
 assert.equal(decodeCsvDraft(JSON.stringify(applyTargetingPreset(csv,'checkout-addon'))).existingRedemption,.15);
 assert.equal(JSON.stringify({builtin,manual,csv}),originals);
 assert.throws(()=>applyTargetingPreset(manual,'missing'));
});
test('direct preview save reuses snapshot constructor; exact preview and CSV provenance survive reload without draft mutation',()=>{
 const a=csvToManual(parseBaselineCSV('order_id,sku,unit_price\n1,A,20\n1,B,8\n2,A,20\n3,B,8'),['A','B'],{A:20,B:8});
 const b={...manualBundle(a),baseline:a.baseline},src={kind:'csv',label:'CSV reference-price fixture',baseline:a.baseline};
 const state=addStrategy(emptyStrategies(),createStrategy(b,a,src,{name:'Named baseline',id:'A'})),draft={name:'Uncommitted label',reason:'Uncommitted reason'};
 const before=JSON.stringify({state,a,b,src,draft}),preview=createSensitivityPreview(b,a,.05,.4,src);
 assert.equal(JSON.stringify({state,a,b,src,draft}),before); // cancelling the preview has no state transition
 const next=saveSensitivityPreview(state,preview,b,a,src,{id:'B'}),saved=next.snapshots[1];
 assert.equal(nextStrategySlot(state),'B');assert.equal(saved.name,'方案 B');
 assert.deepEqual(saved.assumptions,preview.point.assumptions);assert.deepEqual(saved.source.baseline,a.baseline);
 near(strategyResult(saved).marginLift,preview.point.marginLift);assert.equal(saved.modelVersion,MODEL_VERSION);
 assert.equal(JSON.stringify({state,a,b,src,draft}),before);
 assert.deepEqual(decodeStrategies(JSON.stringify(next)),next);
 assert.equal(next.snapshots[0],state.snapshots[0]);
});
test('direct-save uses actual A/B/C capacity, rejects stale provenance/input and never mutates full state',()=>{
 const a=initialManual(),b=manualBundle(a),p=createSensitivityPreview(b,a,.05,.4,source),empty=emptyStrategies();
 assert.equal(nextStrategySlot(empty),'A');
 let state=saveSensitivityPreview(empty,p,b,a,source,{id:'A'});assert.equal(state.snapshots[0].name,'方案 A');
 assert.equal(sensitivityPreviewIsCurrent(p,b,a,{...source,label:'Changed source'}),false);
 assert.throws(()=>saveSensitivityPreview(state,p,b,a,{...source,label:'Changed source'}));
 assert.throws(()=>saveSensitivityPreview(state,p,b,{...a,costRatio:.8},source));
 for(const [id,d] of [['B',.1],['C',.2]])state=saveSensitivityPreview(state,createSensitivityPreview(b,a,d,.4,source),b,a,source,{id});
 const raw=JSON.stringify(state);assert.equal(nextStrategySlot(state),null);
 assert.throws(()=>saveSensitivityPreview(state,p,b,a,source),/最多保留/);assert.equal(JSON.stringify(state),raw);
});
function frozenFixture(){
 // 50% full, list 30, incomplete spending 10, 10% discount, no cost:
 // incremental contribution = 17, existing loss = 1.5 => threshold 3/17.
 const a={...initialManual(),items:[{name:'A',price:'20'},{name:'B',price:'10'}],fullShare:'50',incompleteSpend:'10',discount:.1,costRatio:0,existingRedemption:1};
 return {a,plan:createValidationPlan(manualBundle(a),a,source,fields,{id:'frozen'})};
}
test('frozen break-even check separates below/equal/above and states conditional next action',()=>{
 const {plan}=frozenFixture();
 for(const [completed,state] of [[2,'below'],[3,'crossed'],[4,'crossed']]){
  const g=summarizeObservationGroup({covered:34,incomplete:17,completed,fullRedeemed:17}),c=observationBreakEvenCheck(g,plan);
  assert.equal(c.state,state);near(c.threshold,3/17);near(c.gapPp,(completed/17-3/17)*100);
  assert.match(c.conditions,/成本.*领折扣.*基线/);assert.match(c.conditions,/不代表.*上线许可/);
  if(state==='below'){assert.match(observationBreakEvenText(g,plan),/尚差5.9个百分点/);assert.match(c.nextAction,/另存计划/);}
 }
});
test('unknown/zero denominators and unavailable or flat break-even never pass as zero',()=>{
 const {plan,a}=frozenFixture();
 for(const group of [{covered:10,completed:2},{covered:10,incomplete:0,completed:0},{covered:10,incomplete:5}]){
  const c=observationBreakEvenCheck(summarizeObservationGroup(group),plan);assert.equal(c.state,'unknown');assert.equal(c.observed,null);assert.equal(c.gapPp,null);
 }
 for(const changes of [{fullShare:'100'},{discount:1},{fullShare:'100',discount:0},{costRatio:1,discount:0}]){
  const draft={...a,...changes},p=createValidationPlan(manualBundle(draft),draft,source,fields),c=observationBreakEvenCheck(summarizeObservationGroup({covered:10,incomplete:5,completed:5}),p);
  assert.equal(c.state,'unavailable');assert.equal(c.threshold,null);assert.equal(c.gapPp,null);
 }
});
test('live input changes do not alter frozen check; report and Markdown persist the exact threshold on reload',()=>{
 const {plan,a}=frozenFixture(),group={covered:34,incomplete:17,completed:3,fullRedeemed:17},before=JSON.stringify(plan);
 const frozen=observationBreakEvenCheck(summarizeObservationGroup(group),plan);
 a.discount=.9;a.existingRedemption=.15;a.items[0].price='99';
 assert.deepEqual(observationBreakEvenCheck(summarizeObservationGroup(group),plan),frozen);assert.equal(JSON.stringify(plan),before);
 const p=addObservation(plan,createObservation({treatment:group,control:{covered:0,incomplete:0,completed:0,fullRedeemed:0}})),report=validationPlanReport(p);
 near(report.frozenBreakEven.rate,3/17);assert.equal(report.observations[0].boundaryChecks.treatment.state,'crossed');assert.equal(report.observations[0].boundaryChecks.control.state,'unknown');
 const reloaded=decodePlans(JSON.stringify({version:1,plans:[report],selectedId:report.id})).plans[0];
 assert.deepEqual(validationPlanReport(reloaded),report);assert.match(validationPlanMarkdown(reloaded),/冻结保本采纳17.6%/);assert.match(validationPlanMarkdown(reloaded),/不代表因果提升/);
});
