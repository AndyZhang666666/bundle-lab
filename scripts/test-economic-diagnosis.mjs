import test from 'node:test';import assert from 'node:assert/strict';
import { breakEvenDiscount,economicDiagnosis } from '../lib/economic-diagnosis.js';
import { simulateOne } from '../lib/simulate.js';
import { initialManual,manualBundle,assumptionMarkdown,assumptionReport } from '../lib/manual-scenario.js';
test('discount boundary is a root of the original engine, with no change to its ledger',()=>{
 const d=initialManual(),b=manualBundle(d),x={listPrice:b.listPrice,partialSpend:b.partialSpend,hitRate:b.hitRate,costRatio:d.costRatio,existingRedemption:d.existingRedemption,adoption:d.adoption.neutral};
 const r=breakEvenDiscount(x); assert.ok(r.rate>0&&r.rate<1);
 const at=discount=>simulateOne({...x,bundleP:x.listPrice*(1-discount)}).marginLift;
 assert.ok(Math.abs(at(r.rate))<1e-10);assert.ok(at(r.rate+1e-6)<0);assert.ok(at(r.rate-1e-6)>0);
 const report=assumptionReport(b,d,'user');assert.match(assumptionMarkdown(report),/经营取舍诊断/);assert.equal(report.diagnosis.currentPerOrder.marginLift,simulateOne({...x,bundleP:x.listPrice*(1-d.discount)}).marginLift);
});
test('zero adoption/all full/zero redemption/zero cost do not invent unreachable or infinite values',()=>{
 const d=initialManual(),b=manualBundle(d),base={listPrice:b.listPrice,partialSpend:b.partialSpend,hitRate:b.hitRate,costRatio:d.costRatio,existingRedemption:1,adoption:0};
 assert.equal(breakEvenDiscount(base).rate,0);
 assert.equal(breakEvenDiscount({...base,hitRate:1,partialSpend:b.listPrice}).rate,0);
 assert.equal(breakEvenDiscount({...base,hitRate:1,partialSpend:b.listPrice,existingRedemption:0}).state,'flat');
 assert.equal(breakEvenDiscount({...base,hitRate:0,partialSpend:18,existingRedemption:0,adoption:0}).state,'flat');
 assert.ok(Number.isFinite(breakEvenDiscount({...base,costRatio:0,adoption:.9}).rate));
 assert.match(economicDiagnosis(b,{...d,discount:.9}).cause,/负增量毛利/);
});
