import test from "node:test";
import assert from "node:assert/strict";
import {
  simulateOne,
  breakEvenAdoption,
  simulateBundle,
  simulateStats,
  validateAssumptions,
  DEFAULT_ADOPTION,
} from "../lib/simulate.js";
import {
  defaultScenario,
  decodeScenario,
  setAdoption,
  scenarioSnapshot,
} from "../lib/scenario.js";
import { buildScenarioReport, buildTemplate } from "../lib/playbook.js";
import { dataset, minedBundles, segments } from "../lib/dataset.js";
import { mineBundles } from "../lib/rules.js";
test("发现与建议使用全部候选，不被旧50/8条展示上限截断", () => {
  const all = mineBundles(dataset().transactions, { limit: Infinity });
  assert.equal(minedBundles().length, all.length);
  assert.equal(
    segments().find((s) => s.key === "all").bundles.length,
    all.length,
  );
});
const args = {
  listPrice: 20,
  bundleP: 18,
  partialSpend: 12,
  hitRate: 0.2,
  costRatio: 0.4,
  existingRedemption: 1,
};
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, a + " != " + b);
test("两类人群手算：增量毛利1.6减让利0.4 = 1.2", () => {
  const x = simulateOne({ ...args, adoption: 0.5 });
  near(x.incompleteSpend, 10);
  near(x.addedMargin, 1.6);
  near(x.existingLoss, 0.4);
  near(x.marginLift, 1.2);
  near(x.aovLift, 2.8);
});
test("平衡点与模拟使用完全相同的分母和损失", () => {
  const be = breakEvenAdoption(args);
  near(be.rate, 0.125);
  near(simulateOne({ ...args, adoption: be.rate }).marginLift, 0);
  assert.ok(simulateOne({ ...args, adoption: be.rate - 0.01 }).marginLift < 0);
});
test("采纳为0仍有老顾客让利，领折扣为0则无固定损失", () => {
  near(simulateOne({ ...args, adoption: 0 }).marginLift, -0.4);
  near(
    simulateOne({ ...args, adoption: 0, existingRedemption: 0 }).marginLift,
    0,
  );
  near(breakEvenAdoption({ ...args, existingRedemption: 0 }).rate, 0);
});
test("全部已买齐没有增量；免费与100%成本保持有限和负收益", () => {
  near(
    simulateOne({ ...args, partialSpend: 20, hitRate: 1, adoption: 1 })
      .marginLift,
    -2,
  );
  assert.equal(
    breakEvenAdoption({ ...args, partialSpend: 20, hitRate: 1 }).rate,
    null,
  );
  const x = simulateOne({ ...args, bundleP: 0, costRatio: 1, adoption: 1 });
  assert.ok(Number.isFinite(x.marginLift) && x.marginLift < 0);
});
const bundle = {
  key: "A+B",
  items: ["A", "B"],
  listPrice: 20,
  partialSpend: 12,
  hitRate: 0.2,
  matchedCount: 1000,
  lift: 2,
  support: 0.1,
  groupShare: 0.4,
  hitCount: 200,
};
test("无覆盖订单不生成假想收益", () =>
  assert.throws(
    () =>
      simulateBundle({ bundle, transactions: [], priceOf: { A: 10, B: 10 } }),
    /覆盖订单数/,
  ));
test("逐订单聚合和浏览器统计入口结果一致", () => {
  const tx = Array.from({ length: 10 }, (_, i) => ({
    items: i < 2 ? ["A", "B"] : ["A"],
    total: i < 2 ? 20 : 10,
  }));
  const a = simulateBundle({
    bundle,
    transactions: tx,
    priceOf: { A: 10, B: 10 },
    discount: 0.1,
    adoption: { conservative: 0.1, neutral: 0.5, optimistic: 0.8 },
  });
  near(a.scenarios.neutral.marginLift, 1.2);
  assert.equal(a.hitCount, 2);
  assert.equal(a.matchedCount, 10);
});
test("非法数值、比例、缺价格与人群统计明确拒绝", () => {
  for (const bad of [NaN, Infinity, -1])
    assert.throws(() => simulateOne({ ...args, adoption: bad }));
  assert.throws(() => simulateOne({ ...args, partialSpend: 1, adoption: 0.2 }));
  assert.throws(() =>
    simulateBundle({ bundle, transactions: [], priceOf: { A: 10 } }),
  );
  assert.throws(() =>
    validateAssumptions({
      adoption: { conservative: 0.8, neutral: 0.2, optimistic: 0.9 },
    }),
  );
});
test("采纳率三档调整维持单调，允许零和全量", () => {
  assert.deepEqual(setAdoption(DEFAULT_ADOPTION, "neutral", 0), {
    conservative: 0,
    neutral: 0,
    optimistic: 0.25,
  });
  assert.deepEqual(setAdoption(DEFAULT_ADOPTION, "neutral", 1), {
    conservative: 0.05,
    neutral: 1,
    optimistic: 1,
  });
});
test("草稿恢复白名单、版本、组合上限和损坏数据", () => {
  const d = defaultScenario([bundle]);
  assert.deepEqual(
    decodeScenario(JSON.stringify({ ...d, apiKey: "not-persisted" }), [bundle]),
    d,
  );
  assert.throws(() => decodeScenario("{bad", [bundle]));
  assert.throws(() =>
    decodeScenario(JSON.stringify({ ...d, version: 1 }), [bundle]),
  );
  assert.throws(() =>
    decodeScenario(JSON.stringify({ ...d, compareKeys: ["unknown"] }), [
      bundle,
    ]),
  );
});
test("报告沿用当前假设，导出与页面相同计算，亏损无推荐", () => {
  const d = {
    ...defaultScenario([bundle]),
    discount: 0.1,
    adoption: { conservative: 0.1, neutral: 0.5, optimistic: 0.8 },
  };
  const report = buildScenarioReport([bundle], { orderCount: 1000 }, d);
  near(report.actions[0].marginLift, 1.2);
  assert.match(buildTemplate(report), /下一步验证/);
  assert.match(buildTemplate(report), /减价 10%/);
  const snap = scenarioSnapshot([bundle], d);
  near(snap.results[0].scenarios.neutral.marginLift, 1.2);
  const loss = buildScenarioReport(
    [bundle],
    { orderCount: 1000 },
    { ...d, discount: 1 },
  );
  assert.equal(loss.actions.length, 0);
  assert.equal(loss.rejected.length, 1);
  assert.ok(JSON.stringify(snap).includes("two-population-v2"));
});
test("收益排序按毛利而非收入，报告不承诺共购因果", () => {
  const report = buildScenarioReport(
    [bundle],
    { orderCount: 1000 },
    defaultScenario([bundle]),
  );
  assert.doesNotMatch(buildTemplate(report), /数字未改动|共现显著|买其中一件/);
  const b = simulateStats(bundle, {
    discount: 0.1,
    adoption: { conservative: 0.1, neutral: 0.5, optimistic: 0.8 },
  });
  near(b.expectedValue, 1200);
});
