import test from 'node:test';
import assert from 'node:assert/strict';
import { readProtectedDraft, writeProtectedDraft } from '../lib/draft-guard.js';
import { SCENARIO_KEY, decodeScenario, defaultScenario } from '../lib/scenario.js';
import { MANUAL_KEY, decodeManual, initialManual } from '../lib/manual-scenario.js';
const bundle = [{ key: '可乐 + 鸡腿饭' }];
const fixtures = [
  { key: SCENARIO_KEY, decode: raw => decodeScenario(raw, bundle), fallback: () => defaultScenario(bundle), incompatible: '{"version":1}' },
  { key: MANUAL_KEY, decode: decodeManual, fallback: initialManual, incompatible: '{"version":99}' },
];
function store(initial = []) { const values = new Map(initial), writes = [];return { values, writes, getItem: key => values.get(key) ?? null, setItem: (key, raw) => { writes.push(key);values.set(key, raw); } }; }
test('corrupt and incompatible drafts remain untouched through load and edits until explicit replacement permission', () => {
  for (const f of fixtures) for (const raw of ['{corrupt', f.incompatible]) {
    const storage = store([[f.key, raw]]), loaded = readProtectedDraft(storage, f.key, f.decode, f.fallback);
    assert.equal(loaded.writeLocked, true);
    assert.equal(writeProtectedDraft(storage, f.key, { ...loaded.value, discount: .2 }, f.decode, loaded.writeLocked).reason, 'locked');
    assert.equal(storage.values.get(f.key), raw);assert.equal(storage.writes.length, 0);
    const unlockedByUser = false;
    assert.equal(writeProtectedDraft(storage, f.key, loaded.value, f.decode, unlockedByUser).saved, true);
    assert.doesNotThrow(() => f.decode(storage.values.get(f.key)));assert.equal(storage.writes.length, 1);
  }
});
test('normal first visits autosave, valid drafts restore, and invalid replacements never overwrite a prior draft', () => {
  for (const f of fixtures) {
    const storage = store(), first = readProtectedDraft(storage, f.key, f.decode, f.fallback);
    assert.equal(first.writeLocked, false);assert.equal(writeProtectedDraft(storage, f.key, first.value, f.decode, first.writeLocked).saved, true);
    const prior = storage.values.get(f.key), restored = readProtectedDraft(storage, f.key, f.decode, f.fallback);assert.deepEqual(restored.value, first.value);
    assert.equal(writeProtectedDraft(storage, f.key, { ...first.value, discount: 9 }, f.decode, false).reason, 'invalid');assert.equal(storage.values.get(f.key), prior);
  }
});
test('blocked storage object and throwing storage property preserve usable inputs without throwing', () => {
  const unavailable = () => { throw Error('SecurityError'); };
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  for (const f of fixtures) for (const storage of [unavailable, blocked]) {
    const loaded = readProtectedDraft(storage, f.key, f.decode, f.fallback);assert.equal(loaded.writeLocked, true);
    assert.deepEqual(loaded.value, f.fallback());assert.equal(writeProtectedDraft(storage, f.key, loaded.value, f.decode, false).reason, 'storage');
  }
});
