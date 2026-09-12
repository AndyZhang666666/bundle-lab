// 鲁棒性校验：样本量多少才够用？阈值调松调紧会发生什么？
//
// 目的是给出使用边界 —— 一个工具敢说自己能用，得先说清什么情况下不能用。
// 用法：node scripts/robustness.mjs

import { readFileSync, writeFileSync } from 'node:fs';
import { parseCSV, groupOrders } from '../lib/orders.js';
import { toTransactions, mineBundles, comboKey } from '../lib/rules.js';

const csv = readFileSync('data/orders.csv', 'utf8');
const planted = JSON.parse(readFileSync('data/planted.json', 'utf8'));
const { rows } = parseCSV(csv);
const allOrders = groupOrders(rows);
const plantedKeys = planted.planted.map((p) => ({ id: p.id, key: comboKey(p.items), items: p.items }));

const BASE = { minSupport: 0.01, minLift: 1.2, minConfidence: 0.1, maxLen: 3, limit: 200 };

// 两个指标，后者才是实际可用性：
//   recalled  —— 进了候选列表（哪怕排在第 69 名）
//   inTop10   —— 排进前 10。用户不会翻到第 69 名，所以这个才决定「能不能用」
const VISIBLE = 10;

function evaluate(orders, opts) {
  const bundles = mineBundles(toTransactions(orders), opts);
  const keys = new Map(bundles.map((b, i) => [b.key, i + 1]));
  const hits = plantedKeys.map((p) => ({ id: p.id, rank: keys.get(p.key) ?? null }));
  const found = hits.filter((h) => h.rank !== null);
  const visible = found.filter((h) => h.rank <= VISIBLE);
  return {
    candidates: bundles.length,
    recalled: found.length,
    rate: found.length / plantedKeys.length,
    inTop10: visible.length,
    buriedBelowTop10: found.filter((h) => h.rank > VISIBLE).map((h) => `${h.id}(#${h.rank})`),
    missing: hits.filter((h) => h.rank === null).map((h) => h.id),
    worstRank: found.length ? Math.max(...found.map((h) => h.rank)) : null,
  };
}

// —— 实验一：样本量阶梯 ——
const SIZES = [200, 500, 1000, 2000, 3000, 4000];
const bySize = SIZES.map((n) => {
  const r = evaluate(allOrders.slice(0, n), BASE);
  return { orders: n, ...r };
});

// —— 实验二：阈值敏感度（固定 4000 单）——
const THRESHOLDS = [
  { label: '宽松 lift≥1.0 supp≥0.5%', minSupport: 0.005, minLift: 1.0 },
  { label: '默认 lift≥1.2 supp≥1%', minSupport: 0.01, minLift: 1.2 },
  { label: '偏严 lift≥1.5 supp≥2%', minSupport: 0.02, minLift: 1.5 },
  { label: '严格 lift≥2.0 supp≥3%', minSupport: 0.03, minLift: 2.0 },
  { label: '极严 lift≥3.0 supp≥5%', minSupport: 0.05, minLift: 3.0 },
];
const byThreshold = THRESHOLDS.map((t) => {
  const r = evaluate(allOrders, { ...BASE, minSupport: t.minSupport, minLift: t.minLift });
  return { label: t.label, minSupport: t.minSupport, minLift: t.minLift, ...r };
});

const report = { generatedAt: new Date().toISOString(), bySize, byThreshold };
writeFileSync('data/robustness-report.json', JSON.stringify(report, null, 2));

console.log('\n实验一：样本量阶梯（阈值固定为默认）');
console.log('订单数   候选数  进候选  进前10  最差排名  沉在10名外');
for (const r of bySize) {
  const worst = r.worstRank ? `#${r.worstRank}` : '—';
  const buried = r.buriedBelowTop10.length ? r.buriedBelowTop10.join(' ') : '—';
  console.log(
    `${String(r.orders).padEnd(8)} ${String(r.candidates).padEnd(7)} ${r.recalled}/5    ${r.inTop10}/5    ${worst.padEnd(9)} ${buried}`,
  );
}

console.log('\n实验二：阈值敏感度（固定 4000 单）');
console.log('阈值                        候选数  进候选  进前10  漏掉的');
for (const r of byThreshold) {
  const miss = r.missing.length ? r.missing.join(',') : '—';
  console.log(
    `${r.label.padEnd(27)} ${String(r.candidates).padEnd(7)} ${r.recalled}/5    ${r.inTop10}/5    ${miss}`,
  );
}
console.log('\n报告已写入 data/robustness-report.json');
