import {
  DEFAULT_ADOPTION,
  DEFAULT_DISCOUNT,
  DEFAULT_COST_RATIO,
  MODEL_VERSION,
  validateAssumptions,
  simulateStats,
} from "./simulate.js";
export const SCENARIO_KEY = "bundle-lab:scenario:v2";
export function defaultScenario(bundles) {
  return {
    version: 2,
    discount: DEFAULT_DISCOUNT,
    costRatio: DEFAULT_COST_RATIO,
    adoption: { ...DEFAULT_ADOPTION },
    existingRedemption: 1,
    pickKey: bundles[0]?.key ?? "",
    compareKeys: bundles.slice(0, 3).map((b) => b.key),
  };
}
export function decodeScenario(raw, bundles) {
  if (!raw) return null;
  if (raw.length > 12000) throw Error("草稿过大");
  const d = JSON.parse(raw);
  if (d.version !== 2) throw Error("旧版草稿");
  const a = validateAssumptions(d),
    keys = new Set(bundles.map((b) => b.key));
  if (
    !keys.has(d.pickKey) ||
    !Array.isArray(d.compareKeys) ||
    d.compareKeys.length > 3 ||
    new Set(d.compareKeys).size !== d.compareKeys.length ||
    d.compareKeys.some((k) => !keys.has(k))
  )
    throw Error("组合已变化");
  return { version: 2, ...a, pickKey: d.pickKey, compareKeys: d.compareKeys };
}
export function setAdoption(prev, key, value) {
  const keys = ["conservative", "neutral", "optimistic"],
    i = keys.indexOf(key);
  if (i < 0 || !Number.isFinite(value) || value < 0 || value > 1)
    throw Error("未知采纳率");
  return Object.fromEntries(
    keys.map((k, j) => [
      k,
      j < i
        ? Math.min(prev[k], value)
        : j === i
          ? value
          : Math.max(prev[k], value),
    ]),
  );
}
export function scenarioSnapshot(bundles, scenario) {
  const results = bundles
    .filter(
      (b) => scenario.compareKeys.includes(b.key) || b.key === scenario.pickKey,
    )
    .map((b) => simulateStats(b, scenario));
  return {
    version: 2,
    modelVersion: MODEL_VERSION,
    source: "内置4000笔合成订单",
    assumptions: scenario,
    results,
    limits: [
      "采纳率仅指未买齐人群；既有整套者领折扣单独假设",
      "无价格弹性、曝光选择、库存或跨订单蚕食建模",
      "各组合覆盖重叠，汇总不可相加",
      "共购相关性不代表干预因果；毛利不是净利润",
    ],
  };
}
export function downloadText(text, name, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
