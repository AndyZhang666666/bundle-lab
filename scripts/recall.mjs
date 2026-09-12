// 召回校验：工具能不能把 data/GENERATION.md 里植入的 5 个组合挖出来。
//
// 这是整个项目最该跑的脚本。挖掘算法写得再漂亮，挖不到已知答案就是错的。
// 用法：node scripts/recall.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { parseCSV, groupOrders } from '../lib/orders.js';
import { toTransactions, mineBundles, comboKey } from '../lib/rules.js';

const csv = readFileSync('data/orders.csv', 'utf8');
const planted = JSON.parse(readFileSync('data/planted.json', 'utf8'));

const { rows, error } = parseCSV(csv);
if (error) throw new Error(error);
const orders = groupOrders(rows);
const tx = toTransactions(orders);

const bundles = mineBundles(tx, { minSupport: 0.01, minLift: 1.2, minConfidence: 0.1, maxLen: 3, limit: 100 });
const foundKeys = new Map(bundles.map((b, i) => [b.key, { rank: i + 1, ...b }]));

const results = [];
for (const p of planted.planted) {
  const key = comboKey(p.items);
  const hit = foundKeys.get(key);
  results.push({
    id: p.id,
    items: p.items,
    key,
    plantedProb: p.prob,
    note: p.note,
    found: Boolean(hit),
    rank: hit ? hit.rank : null,
    lift: hit ? hit.lift : null,
    support: hit ? hit.support : null,
    confidence: hit ? hit.confidence : null,
    hitOrders: hit ? hit.hitOrders : null,
    dominantDaypart: hit ? hit.dominantDaypart : null,
    dominantDaypartShare: hit ? hit.dominantDaypartShare : null,
    groupShare: hit ? hit.groupShare : null,
  });
}

const plantedKeys = new Set(planted.planted.map((p) => comboKey(p.items)));
// P5 三元组的二元子集也是植入结构的直接后果，不算误报。
// key 一律用 comboKey 生成 —— 手写字符串会踩中文 Unicode 码点排序的坑
// （'鸡腿饭 + 薯条' 排序后其实是 '薯条 + 鸡腿饭'）。
const derivedKeys = new Set(
  [
    ['鸡腿饭', '薯条'],
    ['鸡腿饭', '可乐'],
    ['薯条', '可乐'],
  ].map(comboKey),
);
const top10 = bundles.slice(0, 10).map((b, i) => ({
  rank: i + 1,
  key: b.key,
  lift: b.lift,
  support: b.support,
  hitOrders: b.hitOrders,
  isPlanted: plantedKeys.has(b.key),
  isDerived: derivedKeys.has(b.key),
}));

const recalled = results.filter((r) => r.found).length;
const falsePositivesInTop10 = top10.filter((t) => !t.isPlanted && !t.isDerived).length;

const report = {
  generatedAt: new Date().toISOString(),
  dataset: { orders: orders.length, lines: rows.length, seed: planted.seed },
  thresholds: { minSupport: 0.01, minLift: 1.2, minConfidence: 0.1, maxLen: 3 },
  totalCandidates: bundles.length,
  recall: { found: recalled, total: results.length, rate: recalled / results.length },
  falsePositivesInTop10,
  planted: results,
  top10,
};

mkdirSync('data', { recursive: true });
writeFileSync('data/recall-report.json', JSON.stringify(report, null, 2));

console.log(`\n数据集：${orders.length} 单 / ${rows.length} 行 / seed=${planted.seed}`);
console.log(`挖出候选组合：${bundles.length} 个\n`);
console.log('植入组合召回情况：');
for (const r of results) {
  const mark = r.found ? '✓' : '✗';
  const detail = r.found
    ? `rank #${r.rank}  lift=${r.lift.toFixed(2)}  supp=${(r.support * 100).toFixed(2)}%  conf=${(r.confidence * 100).toFixed(1)}%  命中${r.hitOrders}单`
    : '未召回';
  console.log(`  ${mark} ${r.id} ${r.items.join(' + ')}`);
  console.log(`     ${detail}`);
  if (r.found && r.dominantDaypart) {
    console.log(`     主时段 ${r.dominantDaypart} ${(r.dominantDaypartShare * 100).toFixed(0)}%  多人占比 ${(r.groupShare * 100).toFixed(0)}%`);
  }
}
console.log(`\n召回率：${recalled}/${results.length} = ${((recalled / results.length) * 100).toFixed(0)}%`);
console.log(`前 10 名里的非植入组合数：${falsePositivesInTop10}\n`);
console.log('前 10 名候选：');
for (const t of top10) {
  const tag = t.isPlanted ? '[植入]' : t.isDerived ? '[植入衍生]' : '[其他]';
  console.log(`  #${t.rank} ${tag} ${t.key}  lift=${t.lift.toFixed(2)}  命中${t.hitOrders}单`);
}
console.log('\n报告已写入 data/recall-report.json');
