// 单元测试：用 10 条手工订单对照手算的 supp / conf / lift。
//
// 为什么要手算：关联规则的三个指标很容易写错（尤其 lift 的分母是 supp(B) 还是 supp(A∪B)），
// 而错了之后结果依然「看起来合理」—— 排名照样有高有低，没人能一眼看出问题。
// 唯一可靠的办法是用一个小到能笔算的例子逐个对数。
//
// 用法：node scripts/test-rules.mjs   （退出码非 0 表示有测试失败）

import { writeFileSync, mkdirSync } from 'node:fs';
import { frequentItemsets, mineBundles, comboKey, matchedOrders, containingOrders } from '../lib/rules.js';

// —— 10 条手工订单 ——
// 商品用 A/B/C/D 表示，方便手算核对。逐单点数：
//   A: T01,T02,T03,T04,T05,T06,T07           = 7 次
//   B: T01,T02,T03,T04,T08                   = 5 次
//   C: T03,T05,T06,T08,T09                   = 5 次
//   D: T07,T10                               = 2 次
//   A&B:   T01,T02,T03,T04                   = 4 次
//   A&C:   T03,T05,T06                       = 3 次
//   B&C:   T03,T08                           = 2 次
//   A&B&C: T03                               = 1 次
const FIXTURE = [
  { orderId: 'T01', items: ['A', 'B'], total: 100, partySize: 1, daypart: 'lunch' },
  { orderId: 'T02', items: ['A', 'B'], total: 120, partySize: 1, daypart: 'lunch' },
  { orderId: 'T03', items: ['A', 'B', 'C'], total: 200, partySize: 4, daypart: 'dinner' },
  { orderId: 'T04', items: ['A', 'B'], total: 110, partySize: 1, daypart: 'dinner' },
  { orderId: 'T05', items: ['A', 'C'], total: 90, partySize: 1, daypart: 'lunch' },
  { orderId: 'T06', items: ['A', 'C'], total: 95, partySize: 1, daypart: 'lunch' },
  { orderId: 'T07', items: ['A', 'D'], total: 80, partySize: 1, daypart: 'dinner' },
  { orderId: 'T08', items: ['B', 'C'], total: 150, partySize: 3, daypart: 'dinner' },
  { orderId: 'T09', items: ['C'], total: 60, partySize: 1, daypart: 'lunch' },
  { orderId: 'T10', items: ['D'], total: 50, partySize: 1, daypart: 'dinner' },
];

// lib 期望的是 orders 结构（含 lines），这里直接构造 transactions 形态喂进去
const transactions = FIXTURE.map((f) => ({
  orderId: f.orderId,
  items: f.items,
  total: f.total,
  partySize: f.partySize,
  daypart: f.daypart,
  isGroup: f.partySize >= 3,
}));

const N = 10;
const results = [];
let failed = 0;

function check(label, actual, expected, tol = 1e-9) {
  const ok = Math.abs(actual - expected) <= tol;
  if (!ok) failed++;
  results.push({ label, actual, expected, pass: ok });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`  [${mark}] ${label}: 实际 ${actual.toFixed(6)} / 手算 ${expected.toFixed(6)}`);
  return ok;
}

console.log('\n== 单项支持度 ==');
// 手算：A=7/10, B=5/10, C=4/10, D=2/10
const { supportOf } = frequentItemsets(transactions, { minSupport: 0, maxLen: 3 });
check('supp(A)', supportOf.get('A'), 7 / 10);
check('supp(B)', supportOf.get('B'), 5 / 10);
check('supp(C)', supportOf.get('C'), 5 / 10);
check('supp(D)', supportOf.get('D'), 2 / 10);

console.log('\n== 组合支持度 ==');
// 手算：A&B 出现在 T01,T02,T03,T04 = 4/10
//       A&C 出现在 T03,T05,T06 = 3/10
//       B&C 出现在 T03,T08 = 2/10
//       A&B&C 只有 T03 = 1/10
check('supp(A∪B)', supportOf.get(comboKey(['A', 'B'])), 4 / 10);
check('supp(A∪C)', supportOf.get(comboKey(['A', 'C'])), 3 / 10);
check('supp(B∪C)', supportOf.get(comboKey(['B', 'C'])), 2 / 10);
check('supp(A∪B∪C)', supportOf.get(comboKey(['A', 'B', 'C'])), 1 / 10);

console.log('\n== 置信度与提升度（A,B 组合）==');
// conf(A→B) = supp(A∪B)/supp(A) = 0.4/0.7 = 0.571428...
// conf(B→A) = supp(A∪B)/supp(B) = 0.4/0.5 = 0.8       ← 这个方向 conf 更高
// lift      = 0.4/(0.7×0.5) = 0.4/0.35 = 1.142857...   （两个方向相同）
const bundles = mineBundles(transactions, { minSupport: 0, minLift: 0, minConfidence: 0, maxLen: 3, limit: 100 });
const byKey = new Map(bundles.map((b) => [b.key, b]));
const AB = byKey.get(comboKey(['A', 'B']));
check('conf(A,B) 取最强方向 B→A', AB.confidence, 0.8);
check('lift(A,B)', AB.lift, 0.4 / (0.7 * 0.5));
// 最强方向应该是 B→A，即 antecedent = [B]
const dirOK = AB.antecedent.join(',') === 'B' && AB.consequent.join(',') === 'A';
if (!dirOK) failed++;
results.push({ label: 'A,B 最强方向是 B→A', actual: `${AB.antecedent}→${AB.consequent}`, expected: 'B→A', pass: dirOK });
console.log(`  [${dirOK ? 'PASS' : 'FAIL'}] A,B 最强方向: 实际 ${AB.antecedent}→${AB.consequent} / 手算 B→A`);

console.log('\n== 置信度与提升度（B,C 组合）==');
// supp(B)=0.5, supp(C)=0.5, supp(B∪C)=0.2
// conf(B→C) = 0.2/0.5 = 0.4
// conf(C→B) = 0.2/0.5 = 0.4   两个方向相同，取哪个都行
// lift      = 0.2/(0.5×0.5) = 0.8  ← 小于 1：B 和 C 实际是「互斥倾向」，
//                                     谁点了 B 反而不太点 C。这种组合不该推套餐。
const BC = byKey.get(comboKey(['B', 'C']));
check('conf(B,C)', BC.confidence, 0.4);
check('lift(B,C) 小于 1 表示负相关', BC.lift, 0.8);

console.log('\n== 三项组合 A,B,C ==');
// supp = 0.1
// 切分方式里 conf 最高的：{B,C}→A = 0.1/0.2 = 0.5
//   对比 A→{B,C}=0.1/0.7=0.143, B→{A,C}=0.1/0.5=0.2, C→{A,B}=0.1/0.4=0.25
//        {A,B}→C=0.1/0.4=0.25, {A,C}→B=0.1/0.3=0.333
// lift({B,C}→A) = 0.5/supp(A) = 0.5/0.7 = 0.714285...
const ABC = byKey.get(comboKey(['A', 'B', 'C']));
check('conf(A,B,C) 取最强方向 {B,C}→A', ABC.confidence, 0.5);
check('lift(A,B,C)', ABC.lift, 0.5 / 0.7);

console.log('\n== 订单口径 ==');
// matched（含至少一件）：A 或 B → T01-T08 共 8 单
// containing（含全部）：A 且 B → T01,T02,T03,T04 共 4 单
// 这两个口径的区别很关键：套餐能推给谁用 matched，组合真实共现用 containing
check('matchedOrders(A,B) 含至少一件', matchedOrders(transactions, ['A', 'B']).length, 8);
check('containingOrders(A,B) 含全部', containingOrders(transactions, ['A', 'B']).length, 4);

console.log('\n== 客单价口径 ==');
// 全体客单 = (100+120+200+110+90+95+80+150+60+50)/10 = 1055/10 = 105.5
// A&B 命中单客单 = (100+120+200+110)/4 = 530/4 = 132.5
check('全体客单价', AB.overallAOV, 105.5);
check('A,B 命中订单客单价', AB.hitAOV, 132.5);
check('客单差额', AB.aovDelta, 132.5 - 105.5, 1e-9);

console.log('\n== 阈值过滤 ==');
// lift < 1.2 应被滤掉。A,B 的 lift=1.143，B,C 的 lift=1.0，都低于 1.2
// A,C 的 lift = 0.3/(0.7×0.4) = 1.0714 也低于 1.2
// 所以默认阈值下这个 fixture 一个组合都不该剩 —— 这正好验证过滤是真的生效
const filtered = mineBundles(transactions, { minLift: 1.2, minSupport: 0, minConfidence: 0, maxLen: 3 });
const filterOK = filtered.length === 0;
if (!filterOK) failed++;
results.push({ label: 'lift≥1.2 过滤后应为空', actual: filtered.length, expected: 0, pass: filterOK });
console.log(`  [${filterOK ? 'PASS' : 'FAIL'}] lift≥1.2 过滤后候选数: 实际 ${filtered.length} / 手算 0`);

mkdirSync('results', { recursive: true });
const report = {
  generatedAt: new Date().toISOString(),
  fixture: FIXTURE,
  fixtureNote: '10 条手工订单，所有期望值均为笔算得出，见脚本内注释',
  totalChecks: results.length,
  passed: results.filter((r) => r.pass).length,
  failed,
  checks: results,
};
writeFileSync('results/rules-check.json', JSON.stringify(report, null, 2));

console.log(`\n${results.length} 项检查，通过 ${report.passed}，失败 ${failed}`);
console.log('报告已写入 results/rules-check.json');
process.exit(failed === 0 ? 0 : 1);
