import test from 'node:test';
import assert from 'node:assert/strict';
import { initialManual, manualBundle } from '../lib/manual-scenario.js';
import { simulateStats } from '../lib/simulate.js';
import { emptyStrategies, createStrategy, addStrategy, removeStrategy, chooseStrategy, decodeStrategies, strategyToManual, strategyResult, differences, strategiesMarkdown, sensitivityGrid, sensitivityPoint } from '../lib/strategies.js';
const source = { kind: 'manual', label: '用户自建假设；未经观测验证' };
const make = (discount = .12, id = 'a') => { const d = initialManual(); return createStrategy(manualBundle(d), { ...d, discount }, source, { id, name: `方案 ${id.toUpperCase()}`, createdAt: '2026-11-01T10:00:00.000Z' }); };
test('snapshots are independent, max three, and duplicate input is not saved twice', () => {
  const d = initialManual(), b = manualBundle(d), s = createStrategy(b, d, source);
  d.adoption.neutral = .8; b.items[0] = 'modified'; assert.equal(s.assumptions.adoption.neutral, .12); assert.equal(s.bundle.items[0], '商品 A');
  let state = addStrategy(emptyStrategies(), make()); assert.throws(() => addStrategy(state, make(.12, 'duplicate')), /已经保留/);
  state = addStrategy(addStrategy(state, make(.1, 'b')), make(.2, 'c')); assert.throws(() => addStrategy(state, make(.3, 'd')), /最多/);
});
test('selection, removal, reload and reports preserve provenance and exact source model results', () => {
  const a = make(), b = make(.08, 'b'), state = chooseStrategy(addStrategy(addStrategy(emptyStrategies(), a), b), 'b', '减少对原有顾客让利');
  const decoded = decodeStrategies(JSON.stringify(state)); assert.equal(decoded.selectedId, 'b'); assert.equal(decoded.reason, state.reason);
  const manual = strategyToManual(b), result = simulateStats(manualBundle(manual), manual).scenarios.neutral;
  assert.ok(Math.abs(result.marginLift * 100 - strategyResult(b).marginLift) < 1e-8);
  assert.match(manual.provenance, /原来源/); assert.ok(differences(a, b).some(x => x.includes('折扣率')));
  const md = strategiesMarkdown(state); assert.match(md, /相对 A 的变化/); assert.match(md, /减少对原有顾客让利/); assert.match(md, /不是价格弹性预测/);
  assert.equal(removeStrategy(state, 'b').selectedId, null); assert.equal(state.snapshots.length, 2);
});
test('corrupt, oversized, version-drifted and untrusted snapshots reject without altering valid state', () => {
  const state = addStrategy(emptyStrategies(), make()), raw = JSON.stringify(state);
  for (const bad of ['{', 'x'.repeat(60001), JSON.stringify({ ...state, selectedId: 'missing' }), raw.replace('two-population-v2-2026-10-25', 'old-model'), raw.replace('"prices":[20,8]', '"prices":[2,8]')]) assert.throws(() => decodeStrategies(bad));
  assert.equal(JSON.stringify(state), raw);
});
test('every sensitivity cell uses canonical model, exact current input is included, preview does not mutate assumptions', () => {
  const d = initialManual(), b = manualBundle(d), before = JSON.stringify(d), grid = sensitivityGrid(b, d);
  assert.ok(grid.discounts.includes(d.discount)); assert.ok(grid.adoptions.includes(d.adoption.neutral));
  for (const row of grid.rows) for (const point of row) {
    const expected = simulateStats(b, point.assumptions); assert.equal(point.marginLift, expected.scenarios.neutral.marginLift * 100); assert.deepEqual(point.breakEven, expected.breakEven);
    assert.ok(point.assumptions.adoption.conservative <= point.adoption); assert.ok(point.assumptions.adoption.optimistic >= point.adoption);
  }
  assert.equal(JSON.stringify(d), before);
  assert.ok(sensitivityPoint(b, d, .1, 0).marginLift < 0);
  const allFull = manualBundle({ ...d, fullShare: '100' }); assert.equal(sensitivityPoint(allFull, d, .1, 1).breakEven.rate, null);
});
