import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dataset, rankedBundles } from '../lib/dataset.js';
const bundles = rankedBundles();
assert.ok(bundles.length > 0);
for (const b of bundles) {
  assert.ok(Number.isFinite(b.groupShare) && b.groupShare >= 0 && b.groupShare <= 1, b.key);
}
assert.doesNotMatch(dataset().prof.mismatch.text, /大概率在流失|直接证据/);
for (const p of ['app/page.js', 'app/bundles/table.js', 'app/validation/page.js', 'app/layout.js']) {
  assert.doesNotMatch(readFileSync(p, 'utf8'), /<a\b[^>]*href=["']\//, p);
}
console.log(`PASS: ${bundles.length} bundle shares, bounded diagnosis and basePath-safe links`);
