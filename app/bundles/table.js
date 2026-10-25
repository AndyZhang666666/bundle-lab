"use client";

import { useEffect, useMemo, useState, Fragment } from "react";
import Link from "next/link";

const yuan = (v) => `¥${Number(v).toFixed(1)}`;
const pct = (v, d = 2) => `${(Number(v) * 100).toFixed(d)}%`;

const DAYPART_LABEL = {
  lunch: "午餐",
  dinner: "晚餐",
  tea: "下午茶",
  breakfast: "早餐",
};

const SORTS = {
  score: {
    label: "默认（lift × 样本量）",
    fn: (a, b) =>
      b.lift * Math.log(1 + b.hitOrders) - a.lift * Math.log(1 + a.hitOrders),
  },
  lift: { label: "lift 高优先", fn: (a, b) => b.lift - a.lift },
  support: { label: "支持度（覆盖广）", fn: (a, b) => b.support - a.support },
  hitOrders: { label: "命中订单多", fn: (a, b) => b.hitOrders - a.hitOrders },
  aovDelta: {
    label: "命中订单客单更高",
    fn: (a, b) => b.aovDelta - a.aovDelta,
  },
};

export default function BundleTable({ segments }) {
  const [segKey, setSegKey] = useState("all");
  const [sortKey, setSortKey] = useState("score");
  const [minLift, setMinLift] = useState(1.2);
  const [onlyMulti, setOnlyMulti] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [visibleCount, setVisibleCount] = useState(10);
  useEffect(() => {
    setVisibleCount(10);
    setExpanded(null);
  }, [segKey, sortKey, minLift, onlyMulti]);

  const seg = segments.find((s) => s.key === segKey) || segments[0];

  const rows = useMemo(() => {
    let r = seg.bundles.filter((b) => b.lift >= minLift);
    // 「只看多人订单里更常见的组合」—— 这条对应画像页那个错位信号
    if (onlyMulti) r = r.filter((b) => b.groupShare >= 0.5);
    return [...r].sort(SORTS[sortKey].fn);
  }, [seg, minLift, sortKey, onlyMulti]);

  return (
    <>
      <div className="card card-tight" style={{ marginBottom: 14 }}>
        <div
          style={{
            display: "flex",
            gap: 18,
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          <div style={{ minWidth: 210 }}>
            <label className="fld">分群</label>
            <select
              aria-label="订单分群"
              value={segKey}
              onChange={(e) => setSegKey(e.target.value)}
            >
              {segments.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}（{s.orderCount} 单）
                </option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: 180 }}>
            <label className="fld">排序</label>
            <select
              aria-label="组合排序"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
            >
              {Object.entries(SORTS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: 200 }}>
            <label className="fld">
              lift 下限：<span className="tnum">{minLift.toFixed(1)}</span>
            </label>
            <input
              type="range"
              aria-label="lift 下限"
              min="1.2"
              max="10"
              step="0.1"
              value={minLift}
              onChange={(e) => setMinLift(Number(e.target.value))}
            />
          </div>
          <div style={{ paddingBottom: 2 }}>
            <button
              className="btn"
              data-on={onlyMulti}
              aria-pressed={onlyMulti}
              onClick={() => setOnlyMulti((v) => !v)}
            >
              整套订单多人占比 ≥50%
            </button>
          </div>
          <div
            style={{
              marginLeft: "auto",
              paddingBottom: 3,
              fontSize: 13,
              color: "var(--ink-3)",
            }}
          >
            命中{" "}
            <b className="tnum" style={{ color: "var(--ink)" }}>
              {rows.length}
            </b>{" "}
            个组合
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>组合</th>
                <th className="num">lift</th>
                <th className="num">支持度</th>
                <th className="num">置信度</th>
                <th className="num">命中订单</th>
                <th className="num">命中客单</th>
                <th className="num">vs 全体</th>
                <th>主要时段</th>
                <th>多人占比</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, visibleCount).map((b) => {
                const isOpen = expanded === b.key;
                return (
                  <Fragment key={b.key}>
                    <tr>
                      <td>
                        <button
                          className="combo-disclosure"
                          aria-expanded={isOpen}
                          onClick={() => setExpanded(isOpen ? null : b.key)}
                        >
                          {b.items.join(" + ")}
                        </button>
                        <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                          {b.cats.join(" · ")}
                        </div>
                      </td>
                      <td className="num">
                        <b>{b.lift.toFixed(2)}</b>
                      </td>
                      <td className="num">{pct(b.support)}</td>
                      <td className="num">{pct(b.confidence, 1)}</td>
                      <td className="num">{b.hitOrders}</td>
                      <td className="num">{yuan(b.hitAOV)}</td>
                      <td className="num">
                        <span
                          className={`tag ${b.aovDelta >= 0 ? "tag-good" : "tag-bad"}`}
                        >
                          {b.aovDelta >= 0 ? "+" : ""}
                          {yuan(b.aovDelta)}
                        </span>
                      </td>
                      <td>
                        {b.dominantDaypart ? (
                          <span className="pill">
                            {DAYPART_LABEL[b.dominantDaypart] ||
                              b.dominantDaypart}{" "}
                            {pct(b.dominantDaypartShare, 0)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="num">{pct(b.groupShare, 0)}</td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={9} style={{ background: "#fcfbf9" }}>
                          <div
                            style={{
                              padding: "4px 2px",
                              fontSize: 13.5,
                              color: "var(--ink-2)",
                            }}
                          >
                            <div style={{ marginBottom: 6 }}>
                              <b>最强方向</b>：买了「{b.antecedent.join("、")}
                              」的人里， 有{" "}
                              <span className="tnum">
                                {pct(b.confidence, 1)}
                              </span>{" "}
                              会买「{b.consequent.join("、")}」；
                              全体顾客买后者的比例是{" "}
                              <span className="tnum">
                                {pct(b.confidence / b.lift, 1)}
                              </span>
                              。 提升倍数 lift ={" "}
                              <span className="tnum">{b.lift.toFixed(2)}</span>
                              。
                            </div>
                            <div style={{ marginBottom: 6 }}>
                              <b>覆盖口径</b>：命中（含全部 {b.items.length}{" "}
                              件）<span className="tnum">{b.hitOrders}</span>{" "}
                              单； 作为套餐可以推给（含至少一件）
                              <span className="tnum">{b.matchedOrders}</span> 单
                              ——
                              后者是可考虑覆盖的人群，不代表新增需求；还需扣除原本就买齐者领取折扣的损失。
                            </div>
                            <div>
                              <b>组合原价</b>：
                              <span className="tnum">{yuan(b.listPrice)}</span>
                              （单件相加，按每单一件计）｜ <b>
                                命中订单客单
                              </b>{" "}
                              <span className="tnum">{yuan(b.hitAOV)}</span> vs
                              全体{" "}
                              <span className="tnum">{yuan(b.overallAOV)}</span>
                            </div>
                            {segKey === "all" ? (
                              <Link
                                href={
                                  "/simulate/?bundle=" +
                                  encodeURIComponent(b.key)
                                }
                                className="btn"
                              >
                                带入收益推演 →
                              </Link>
                            ) : (
                              <p>
                                当前为分群统计；收益推演基于全部订单口径，请切回全部订单后带入。
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      padding: 22,
                      color: "var(--ink-3)",
                      textAlign: "center",
                    }}
                  >
                    这个筛选下没有组合。lift
                    下限调低一点，或取消「只看多人订单倾向」。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {visibleCount < rows.length && (
        <button className="btn" onClick={() => setVisibleCount((n) => n + 10)}>
          再看10个（已显示{Math.min(visibleCount, rows.length)}/{rows.length}）
        </button>
      )}

      <div className="note note-accent" style={{ marginTop: 14 }}>
        <b>为什么默认 lift 下限是 1.2</b>：这是演示阈值。lift=1
        表示样本中的共现与独立基线相同；更大也不等于统计显著或能赚到钱。
        展示该分群预计算的全部候选，长表分批展开；阈值筛选不能代替验证。取舍理由见
        <Link href="/method/"> 方法与假设</Link>，边界影响见{" "}
        <Link href="/validation/">校验</Link>。
      </div>
    </>
  );
}
