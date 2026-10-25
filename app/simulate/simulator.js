"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { simulateStats } from "@/lib/simulate";
import { scenarioSnapshot, setAdoption, downloadText } from "@/lib/scenario";
import useScenario from "@/components/use-scenario";
import { ScenarioBars } from "@/components/charts";
const yuan = (v) => "¥" + v.toFixed(2);
const pct = (v) => (v == null ? "不适用" : (v * 100).toFixed(1) + "%");
function Slider({ label, value, onChange, step = 0.01 }) {
  return (
    <label className="field-stack">
      {label}
      <b className="tnum">{pct(value)}</b>
      <input
        aria-label={label}
        type="range"
        min="0"
        max="1"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
export default function Simulator({ bundles }) {
  const { scenario: s, setScenario: set, notice, reset } = useScenario(bundles),
    [feedback, feedbackSet] = useState("");
  const picked = bundles.find((b) => b.key === s.pickKey) || bundles[0];
  const sim = useMemo(
    () => (picked ? simulateStats(picked, s) : null),
    [picked, s],
  );
  const compare = useMemo(
    () =>
      bundles
        .filter((b) => s.compareKeys.includes(b.key))
        .map((b) => simulateStats(b, s))
        .sort((a, b) => b.expectedValue - a.expectedValue),
    [bundles, s],
  );
  function toggle(key) {
    set((p) => ({
      ...p,
      compareKeys: p.compareKeys.includes(key)
        ? p.compareKeys.filter((k) => k !== key)
        : p.compareKeys.length < 3
          ? [...p.compareKeys, key]
          : p.compareKeys,
    }));
  }
  if (!sim) return <p>没有可推演组合，请回到组合发现。</p>;
  const n = sim.scenarios.neutral,
    be = sim.breakEven;
  const relation =
    be.rate == null
      ? "当前假设下不能达到盈亏平衡"
      : s.adoption.neutral < be.rate
        ? "中档采纳率低于平衡门槛"
        : n.marginLift > 0
          ? "中档毛利增量为正，仍需验证"
          : "当前中档没有正向毛利增量";
  const rows = ["conservative", "neutral", "optimistic"].map((k, i) => ({
    name: ["低档", "中档", "高档"][i] + " " + pct(s.adoption[k]),
    value: sim.scenarios[k].marginLift,
  }));
  return (
    <>
      <div className="scenario-summary">
        <span>
          中档毛利变化 <b>{yuan(n.marginLift)}</b> / 覆盖单
        </span>
        <a href="#scenario-result">查看账本</a>
      </div>
      <div className="scenario-actions">
        <p role="status">{feedback || notice}</p>
        <button className="btn" onClick={reset}>
          恢复默认假设
        </button>
        <button
          className="btn"
          data-on
          onClick={() => {
            downloadText(
              JSON.stringify(scenarioSnapshot(bundles, s), null, 2),
              "bundle-scenario.json",
              "application/json",
            );
            feedbackSet("已导出当前假设、分人群结果与模型边界。");
          }}
        >
          导出本组推演
        </button>
        <Link className="btn" href="/playbook/">
          用当前假设生成建议 →
        </Link>
      </div>
      <div className="grid g2 sim-work">
        <section className="card">
          <h2 className="sub">推演假设</h2>
          <label className="fld" htmlFor="picked">
            选择组合
          </label>
          <select
            id="picked"
            value={s.pickKey}
            onChange={(e) => set((p) => ({ ...p, pickKey: e.target.value }))}
          >
            {bundles.map((b) => (
              <option key={b.key} value={b.key}>
                {b.items.join(" + ")}
              </option>
            ))}
          </select>
          <p className="small">
            以下都是假设，不是已观察转化。采纳率仅指原本没买齐的人；整套顾客的领折扣行为单独计算。
          </p>
          <div className="grid g2">
            <Slider
              label="套餐折扣率"
              value={s.discount}
              onChange={(v) => set((p) => ({ ...p, discount: v }))}
            />
            <Slider
              label="食材成本率"
              value={s.costRatio}
              onChange={(v) => set((p) => ({ ...p, costRatio: v }))}
            />
          </div>
          <Slider
            label="既有整套顾客领折扣率"
            value={s.existingRedemption}
            onChange={(v) => set((p) => ({ ...p, existingRedemption: v }))}
          />
          <div className="grid g3">
            {[
              ["conservative", "低档采纳率"],
              ["neutral", "中档采纳率"],
              ["optimistic", "高档采纳率"],
            ].map(([k, label]) => (
              <Slider
                key={k}
                label={label}
                value={s.adoption[k]}
                onChange={(v) =>
                  set((p) => ({
                    ...p,
                    adoption: setAdoption(p.adoption, k, v),
                  }))
                }
              />
            ))}
          </div>
        </section>
        <section className="card" id="scenario-result">
          <h2 className="sub">当前结果：{relation}</h2>
          <p className="tnum sim-value">
            {yuan(n.marginLift)}
            <small> / 被覆盖订单 · 中档毛利变化</small>
          </p>
          <ScenarioBars data={rows} fmt="yuan2" height={170} />
          <div className="ledger">
            <p>
              <span>原价 → 套餐价</span>
              <b>
                {yuan(sim.listPrice)} → {yuan(sim.bundleP)}
              </b>
            </p>
            <p>
              <span>已买齐 / 覆盖订单</span>
              <b>
                {picked.hitCount} / {picked.matchedCount} ·{" "}
                {pct(picked.hitRate)}
              </b>
            </p>
            <p>
              <span>未买齐者毛利贡献变化</span>
              <b>{yuan(n.addedMargin)}</b>
            </p>
            <p>
              <span>既有整套者让利损失</span>
              <b>−{yuan(n.existingLoss)}</b>
            </p>
            <p>
              <span>平衡采纳率（未买齐者）</span>
              <b>{be.rate == null ? "不可达" : pct(be.rate)}</b>
            </p>
          </div>
          <p className="small">
            {be.reason ||
              "仅按当前毛利假设计算平衡点，未计履约、库存与运营成本。"}{" "}
            组合收入变化 {yuan(n.aovLift)}，不等于净利润。
          </p>
        </section>
      </div>
      <details className="card" style={{ marginTop: 14 }}>
        <summary>核对两类人群与平衡公式</summary>
        <p>
          覆盖订单包含至少一件商品。h 是其中原本已买齐的比例，r
          是这些人领取折扣的假设比例，a 是未买齐者采纳率。
        </p>
        <pre className="mono">
          {
            "S部分 = (覆盖平均花费 − h × 原价) / (1 − h)\n新增毛利 = (1 − h) × a × [套餐价 − 原价 × 成本率 − S部分 × (1 − 成本率)]\n让利损失 = h × r × (原价 − 套餐价)\n每覆盖单 Δ毛利 = 新增毛利 − 让利损失"
          }
        </pre>
        <p>
          未买齐者原花费 {yuan(n.incompleteSpend)}；覆盖平均原花费{" "}
          {yuan(picked.partialSpend)}
          。套餐外商品假设不变；已买齐者不产生增量商品。人数/商品份量及曝光选择可能改变这一结论。
        </p>
      </details>
      <h2 className="sec">对比组合</h2>
      <p className="small">
        最多选三个，按中档 Δ毛利 ×
        覆盖单数排序。各组合有重叠订单，结果不可相加。
      </p>
      <details className="card" style={{ marginBottom: 14 }}>
        <summary>调整对比清单（{s.compareKeys.length}/3）</summary>
        <div className="compare-picks">
          {bundles.map((b) => (
            <label key={b.key}>
              <input
                type="checkbox"
                checked={s.compareKeys.includes(b.key)}
                disabled={
                  !s.compareKeys.includes(b.key) && s.compareKeys.length >= 3
                }
                onChange={() => toggle(b.key)}
              />
              {b.items.join(" + ")}
            </label>
          ))}
        </div>
      </details>
      {compare.length === 0 ? (
        <p role="status" className="card">
          尚未选择对比组合。上方可勾选，推演假设不丢失。
        </p>
      ) : (
        <div
          className="card tbl-scroll"
          role="region"
          aria-label="组合毛利比较"
          tabIndex={0}
        >
          <table className="tbl">
            <thead>
              <tr>
                <th>组合</th>
                <th className="num">覆盖订单</th>
                <th className="num">Δ组合收入/单</th>
                <th className="num">Δ毛利/单</th>
                <th className="num">覆盖 × Δ毛利</th>
                <th className="num">平衡采纳率</th>
              </tr>
            </thead>
            <tbody>
              {compare.map((b) => (
                <tr key={b.key}>
                  <th scope="row">{b.items.join(" + ")}</th>
                  <td className="num">{b.matchedCount}</td>
                  <td className="num">{yuan(b.scenarios.neutral.aovLift)}</td>
                  <td className="num">
                    {yuan(b.scenarios.neutral.marginLift)}
                  </td>
                  <td className="num">{yuan(b.expectedValue)}</td>
                  <td className="num">
                    {b.breakEven.rate == null
                      ? "不可达"
                      : pct(b.breakEven.rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
