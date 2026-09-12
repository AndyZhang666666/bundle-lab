// 合成订单生成器。所有规则写在 data/GENERATION.md，那份文档就是校验的答案卷。
//
// 设计目标只有一个：埋进去的结构要能被工具「发现」，且发现有标准答案。
// 所以这里刻意做了两件事：
//   1. 植入 5 个隐藏组合，共现概率显著高于独立
//   2. 让多人订单的商品数只比单人多一点点 —— 模拟「结构错位」信号
//
// 用法：node scripts/gen-orders.mjs [seed] [orderCount]

import { writeFileSync, mkdirSync } from 'node:fs';
import { CSV_HEADER } from '../lib/orders.js';

const SEED = Number(process.argv[2] || 20260913);
const ORDER_COUNT = Number(process.argv[3] || 4000);

// mulberry32：够用的确定性 PRNG，同一个 seed 永远同一份数据
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = rng(SEED);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const chance = (p) => rand() < p;

// 菜单：32 个 SKU，四个品类。价格是中式快餐常见区间，纯虚构。
export const MENU = [
  // 主食 10
  { sku: '牛肉面', category: '主食', price: 28 },
  { sku: '红烧肉盖饭', category: '主食', price: 26 },
  { sku: '鸡腿饭', category: '主食', price: 24 },
  { sku: '番茄蛋炒饭', category: '主食', price: 18 },
  { sku: '麻辣香锅（单人）', category: '主食', price: 32 },
  { sku: '酸菜鱼（双人）', category: '主食', price: 68 },
  { sku: '烤鱼（双人）', category: '主食', price: 78 },
  { sku: '牛肉炖锅（三人）', category: '主食', price: 98 },
  { sku: '鲜虾云吞', category: '主食', price: 22 },
  { sku: '照烧鸡排饭', category: '主食', price: 25 },
  // 小食 9
  { sku: '薯条', category: '小食', price: 9 },
  { sku: '鸡米花', category: '小食', price: 12 },
  { sku: '凉拌黄瓜', category: '小食', price: 8 },
  { sku: '煎饺（6个）', category: '小食', price: 12 },
  { sku: '卤蛋', category: '小食', price: 3 },
  { sku: '藕片', category: '小食', price: 8 },
  { sku: '花生米', category: '小食', price: 6 },
  { sku: '拍黄瓜大份', category: '小食', price: 14 },
  { sku: '烤馒头片', category: '小食', price: 6 },
  // 饮料 8
  { sku: '可乐', category: '饮料', price: 5 },
  { sku: '酸梅汤', category: '饮料', price: 8 },
  { sku: '冰红茶', category: '饮料', price: 5 },
  { sku: '鲜榨橙汁', category: '饮料', price: 15 },
  { sku: '豆浆', category: '饮料', price: 4 },
  { sku: '大瓶可乐（1.25L）', category: '饮料', price: 12 },
  { sku: '啤酒', category: '饮料', price: 10 },
  { sku: '冰镇酸梅汤（壶）', category: '饮料', price: 22 },
  // 甜品 5
  { sku: '红豆双皮奶', category: '甜品', price: 12 },
  { sku: '杨枝甘露', category: '甜品', price: 16 },
  { sku: '冰粉', category: '甜品', price: 8 },
  { sku: '芒果班戟', category: '甜品', price: 18 },
  { sku: '绿豆汤', category: '甜品', price: 6 },
];
const BY_CAT = (c) => MENU.filter((m) => m.category === c);
const PRICE = Object.fromEntries(MENU.map((m) => [m.sku, m.price]));

// 植入的隐藏组合。trigger 出现时以 prob 概率把 partner 加进同一单。
// 独立情况下这些搭配的共现概率大致在 supp(A)·supp(B) 附近（几个百分点），
// 植入后的目标 lift 大致在 2-5 倍。
export const PLANTED = [
  { id: 'P1', items: ['牛肉面', '卤蛋'], trigger: '牛肉面', partner: '卤蛋', prob: 0.55, note: '经典搭配，全时段' },
  { id: 'P2', items: ['麻辣香锅（单人）', '酸梅汤'], trigger: '麻辣香锅（单人）', partner: '酸梅汤', prob: 0.5, note: '辣配解辣，单人为主' },
  { id: 'P3', items: ['烤鱼（双人）', '啤酒'], trigger: '烤鱼（双人）', partner: '啤酒', prob: 0.6, note: '多人 + 晚餐倾向' },
  { id: 'P4', items: ['酸菜鱼（双人）', '大瓶可乐（1.25L）'], trigger: '酸菜鱼（双人）', partner: '大瓶可乐（1.25L）', prob: 0.5, note: '多人分享装饮料' },
  { id: 'P5', items: ['鸡腿饭', '薯条', '可乐'], trigger: '鸡腿饭', partners: ['薯条', '可乐'], prob: 0.4, note: '三元组，快餐式套餐' },
];

const DAYPARTS = [
  { name: 'lunch', weight: 0.5, hours: [11, 12, 13, 14] },
  { name: 'dinner', weight: 0.42, hours: [17, 18, 19, 20] },
  { name: 'tea', weight: 0.08, hours: [15, 16] },
];
function pickDaypart() {
  const r = rand();
  let acc = 0;
  for (const d of DAYPARTS) {
    acc += d.weight;
    if (r < acc) return d;
  }
  return DAYPARTS[0];
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function genOrder(idx) {
  const isGroup = chance(0.4);
  const partySize = isGroup ? pick([3, 3, 3, 4, 4, 5]) : pick([1, 1, 1, 2]);
  const daypart = pickDaypart();
  const dayOffset = Math.floor(rand() * 60);
  const date = new Date(Date.UTC(2026, 5, 1 + dayOffset));
  const hour = pick(daypart.hours);
  const minute = Math.floor(rand() * 60);
  const ts = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(hour)}:${pad(minute)}:00`;

  const items = new Map(); // sku -> qty
  const add = (sku, qty = 1) => items.set(sku, (items.get(sku) || 0) + qty);

  // 主食：单人 1 个；多人刻意只 1-2 个（人均不足）—— 这是要被工具发现的错位信号
  const mainCount = isGroup ? pick([1, 2, 2]) : 1;
  const mainPool = BY_CAT('主食');
  const sharePool = mainPool.filter((m) => /双人|三人/.test(m.sku));
  const soloPool = mainPool.filter((m) => !/双人|三人/.test(m.sku));
  for (let i = 0; i < mainCount; i++) {
    // 多人订单里 45% 会点一份分享型主食，其余点单人主食
    const pool = isGroup && chance(0.45) ? sharePool : soloPool;
    add(pick(pool).sku);
  }

  // 小食：单人 40% 加一个，多人 65% 加 1-2 个
  if (isGroup ? chance(0.65) : chance(0.4)) {
    const n = isGroup ? pick([1, 1, 2]) : 1;
    for (let i = 0; i < n; i++) add(pick(BY_CAT('小食')).sku);
  }
  // 饮料：单人 50%，多人 70%
  if (isGroup ? chance(0.7) : chance(0.5)) {
    const n = isGroup ? pick([1, 2]) : 1;
    for (let i = 0; i < n; i++) add(pick(BY_CAT('饮料')).sku);
  }
  // 甜品：单人 15%，多人 30%
  if (isGroup ? chance(0.3) : chance(0.15)) add(pick(BY_CAT('甜品')).sku);

  // 植入组合：trigger 在单里时按概率补 partner
  for (const p of PLANTED) {
    if (!items.has(p.trigger)) continue;
    // P3 烤鱼+啤酒在晚餐更强，午餐减半 —— 让 Playbook 有「时段风险」可说
    let prob = p.prob;
    if (p.id === 'P3' && daypart.name !== 'dinner') prob = prob * 0.5;
    if (!chance(prob)) continue;
    if (p.partners) for (const s of p.partners) add(s);
    else add(p.partner);
  }

  const orderId = `O${String(idx + 1).padStart(5, '0')}`;
  const lines = [];
  for (const [sku, qty] of items) {
    const m = MENU.find((x) => x.sku === sku);
    lines.push(`${orderId},${ts},${daypart.name},${partySize},${sku},${m.category},${qty},${m.price}`);
  }
  return lines;
}

const out = [CSV_HEADER];
for (let i = 0; i < ORDER_COUNT; i++) out.push(...genOrder(i));

mkdirSync('data', { recursive: true });
writeFileSync('data/orders.csv', out.join('\n') + '\n');
writeFileSync(
  'data/planted.json',
  JSON.stringify(
    {
      seed: SEED,
      orderCount: ORDER_COUNT,
      menuSize: MENU.length,
      planted: PLANTED.map((p) => ({ id: p.id, items: p.items, prob: p.prob, note: p.note })),
      priceTable: PRICE,
    },
    null,
    2,
  ),
);
console.log(`wrote data/orders.csv: ${ORDER_COUNT} orders, ${out.length - 1} lines, seed=${SEED}`);
