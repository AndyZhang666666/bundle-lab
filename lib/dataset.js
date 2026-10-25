// 服务端数据入口。
//
// orders.csv 有 73 万字符、4000 单。挖掘是纯确定性计算，每个访客算出来
// 完全一样，没有理由让浏览器重算 —— 所以解析和挖掘都在服务端跑一次，
// 页面只把算完的结果传给客户端组件做交互。
// 用模块级缓存兜住，多个页面预渲染时不会重复解析同一个 CSV。

import { readFileSync } from "node:fs";
import path from "node:path";

import {
  parseCSV,
  groupOrders,
  priceTable,
  categoryTable,
  profile,
  histogram,
} from "./orders.js";
import { toTransactions, mineBundles, mineBySegment } from "./rules.js";
import { compareBundles } from "./simulate.js";

let _data = null;

/** 读盘 → 解析 → 按订单分组 → 转成交易集。 */
export function dataset() {
  if (_data) return _data;

  const csv = readFileSync(path.join(process.cwd(), "data/orders.csv"), "utf8");
  const { rows, error } = parseCSV(csv);
  // 数据坏了要立刻炸，不要静默算出一堆空结果让页面看起来「正常」
  if (error) throw new Error(`data/orders.csv 解析失败：${error}`);
  const orders = groupOrders(rows);

  _data = {
    rows,
    orders,
    priceOf: priceTable(rows),
    categoryOf: categoryTable(rows),
    transactions: toTransactions(orders),
    prof: profile(orders),
    totalsHist: histogram(
      orders.map((o) => o.total),
      12,
    ),
  };
  return _data;
}

let _mined = null;
/** 默认阈值下的候选组合（已按 score 排序）。 */
export function minedBundles() {
  if (_mined) return _mined;
  _mined = mineBundles(dataset().transactions, { limit: Infinity });
  return _mined;
}

let _ranked = null;
/** 候选组合 + 三档收益估算，按「预期提升 × 覆盖订单数」排序。 */
export function rankedBundles() {
  if (_ranked) return _ranked;
  const { transactions, priceOf } = dataset();
  _ranked = compareBundles(minedBundles(), { transactions, priceOf });
  return _ranked;
}

let _segments = null;
/** 五个分群各自独立挖掘 —— 同一组合在午餐/晚餐的 lift 可能完全不同。 */
export function segments() {
  if (_segments) return _segments;
  const { transactions } = dataset();
  const names = [
    ["all", "全部订单"],
    ["lunch", "午餐"],
    ["dinner", "晚餐"],
    ["single", "单人/双人"],
    ["group", "多人（3 人及以上）"],
  ];
  _segments = names.map(([key, label]) => {
    const r = mineBySegment(transactions, key, { limit: Infinity });
    return {
      key,
      label,
      orderCount: r.transactions.length,
      bundles: r.bundles,
    };
  });
  return _segments;
}

/** 读校验产物；缺文件时返回 null，页面自己降级提示。 */
export function loadResult(name) {
  try {
    return JSON.parse(
      readFileSync(path.join(process.cwd(), "results", `${name}.json`), "utf8"),
    );
  } catch {
    return null;
  }
}

/** 传给客户端组件的精简结构 —— 只带交互真正要用的字段。 */
export function slimBundles(ranked, categoryOf, priceOf) {
  return ranked.map((b) => ({
    key: b.key,
    items: b.items,
    cats: b.items.map((s) => categoryOf[s] || "未分类"),
    prices: b.items.map((s) => priceOf[s] || 0),
    lift: b.lift,
    support: b.support,
    matchedCount: b.matchedCount,
    matchedShare: b.matchedShare,
    matchedAOV: b.matchedAOV,
    listPrice: b.listPrice,
  }));
}
