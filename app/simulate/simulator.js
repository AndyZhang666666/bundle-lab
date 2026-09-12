'use client';

import { useMemo, useState } from 'react';
import {
  simulateOne,
  breakEvenAdoption,
  DEFAULT_ADOPTION,
  DEFAULT_DISCOUNT,
  DEFAULT_COST_RATIO,
} from '@/lib/simulate';
import { ScenarioBars, CompareBars } from '@/components/charts';

const yuan = (v) => `¥${Number(v).toFixed(1)}`;
const pct = (v, d = 1) => `${(Number(v) * 100).toFixed(d)}%`;

const DAYPART_LABEL = { lunch: '午餐', dinner: '晚餐', tea: '下午茶', breakfast: '早餐' };

/**
 * 用服务端预先算好的「数据侧统计」跑参数化估算。
 * 公式全部来自 lib/simulate.js，页面不重抄一遍 —— 抄一遍就会有两份会走偏的实现。
 */
function runSim(b, discount, costRatio, adoption) {
  const listPrice = b.prices.reduce((a, c) => a + c, 0);
  const bundleP = listPrice * (1 - discount);

  const scenarios = {};
  for (const [name, rate] of Object.entries(adoption)) {
    scenarios[name] = simulateOne({ partialSpend: b.partialSpend, bundleP, listPrice, adoption: rate, costRatio });
  }
  const be = breakEvenAdoption({
    listPrice,
    bundleP,
    partialSpend: b.partialSpend,
    hitRate: b.hitRate,
    discount,
    costRatio,
  });
  return {
    listPrice,
    bundleP,
    discountAmount: listPrice * discount,
    scenarios,
    breakEven: be,
    expectedValue: scenarios.neutral.aovLift * b.matchedCount,
  };
}

export default function Simulator({ bundles }) {
  const [discount, setDiscount] = useState(DEFAULT_DISCOUNT);
  const [costRatio, setCostRatio] = useState(DEFAULT_COST_RATIO);
  const [adoption, setAdoption] = useState(DEFAULT_ADOPTION);
  const [pickKey, setPickKey] = useState(bundles[0]?.key);
  const [compareKeys, setCompareKeys] = useState(bundles.slice(0, 3).map((b) => b.key));

  const picked = bundles.find((b) => b.key === pickKey) || bundles[0];

  const sim = useMemo(
    () => (picked ? runSim(picked, discount, costRatio, adoption) : null),
    [picked, discount, costRatio, adoption],
  );

  const compare = useMemo(
    () =>
      compareKeys
        .map((k) => {
          const b = bundles.find((x) => x.key === k);
          return b ? { b, ...runSim(b, discount, costRatio, adoption) } : null;
        })
        .filter(Boolean)
        .sort((x, y) => y.expectedValue - x.expectedValue),
    [compareKeys, bundles, discount, costRatio, adoption],
  );

  if (!picked || !sim) return <div className="card">没有可模拟的组合。</div>;

  const { listPrice, bundleP, scenarios, breakEven: be } = sim;
  const neutral = scenarios.neutral;

  const scenarioRows = [
    { name: `保守 ${pct(adoption.conservative, 0)}`, value: scenarios.conservative.aovLift },
    { name: `中性 ${pct(adoption.neutral, 0)}`, value: neutral.aovLift },
    { name: `乐观 ${pct(adoption.optimistic, 0)}`, value: scenarios.optimistic.aovLift },
  ];

  const toggleCompare = (k) => {
    setCompareKeys((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : prev.length >= 3 ? prev : [...prev, k]));
  };

  return (
    <>
      {/* —— 参数区 —— */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="grid g2" style={{ gap: 22 }}>
          <div>
            <label className="fld">选择组合</label>
            <select value={pickKey} onChange={(e) => setPickKey(e.target.value)}>
              {bundles.map((b) => (
                <option key={b.key} value={b.key}>
                  {b.items.join(' + ')}（lift {b.lift.toFixed(1)}）
                </option>
              ))}
            </select>
            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--ink-3)' }}>
              {picked.cats.join(' · ')}｜原价 <span className="tnum">{yuan(listPrice)}</span>（单件相加）
              ｜命中率 <span className="tnum">{pct(picked.hitRate)}</span>（被覆盖人群里本来就买全套的比例）
            </div>
          </div>
          <div className="grid" style={{ gap: 14 }}>
            <div>
              <label className="fld">
                套餐折扣率：<b className="tnum">{pct(discount, 0)}</b>
              </label>
              <input type="range" min="0" max="0.35" step="0.01" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
            </div>
            <div>
              <label className="fld">
                成本率（食材成本占原价）：<b className="tnum">{pct(costRatio, 0)}</b>
              </label>
              <input type="range" min="0.1" max="0.7" step="0.01" value={costRatio} onChange={(e) => setCostRatio(Number(e.target.value))} />
            </div>
            <div className="grid g3" style={{ gap: 10 }}>
              {[
                ['conservative', '保守'],
                ['neutral', '中性'],
                ['optimistic', '乐观'],
              ].map(([k, label]) => (
                <div key={k}>
                  <label className="fld">
                    {label}采纳率：<b className="tnum">{pct(adoption[k], 0)}</b>
                  </label>
                  <input
                    type="range"
                    min="0.01"
                    max="0.6"
                    step="0.01"
                    value={adoption[k]}
                    onChange={(e) => setAdoption((prev) => ({ ...prev, [k]: Number(e.target.value) }))}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* —— 客单变化三档 —— */}
      <div className="grid g2">
        <div className="card">
          <h3 className="sub">客单价变化（每被覆盖订单）</h3>
          <ScenarioBars data={scenarioRows} fmt="yuan2" />
          <div className="note" style={{ marginTop: 8 }}>
            中性档每单 <b className="tnum">{yuan(neutral.aovLift)}</b>（{pct(neutral.aovLiftPct)}）。
            这批人原本在组合这几件上平均花 <span className="tnum">{yuan(picked.partialSpend)}</span>，
            套餐价 <span className="tnum">{yuan(bundleP)}</span>，差额乘以采纳率就是客单增量。
          </div>
        </div>

        <div className="card">
          <h3 className="sub">毛利变化（每被覆盖订单）</h3>
          <ScenarioBars data={scenarioRows.map((r, i) => ({ name: r.name, value: [scenarios.conservative, neutral, scenarios.optimistic][i].marginLift }))} fmt="yuan2" />
          <div className="note" style={{ marginTop: 8 }}>
            中性档每单毛利 <b className="tnum">{yuan(neutral.marginLift)}</b>
            （{pct(neutral.marginLiftPct)}）。套餐毛利 {yuan(neutral.bundleMargin)} vs
            原本这几件的毛利 {yuan(neutral.baseMargin)}。成本率越高，套餐让利越容易吃掉毛利。
          </div>
        </div>
      </div>

      {/* —— 盈亏平衡 —— */}
      <h2 className="sec">盈亏平衡：至少要多少人接</h2>
      <div className="grid g3">
        <div className="card metric">
          <div className="k">盈亏平衡采纳率</div>
          <div className="v" style={{ color: be.rate === null ? 'var(--bad)' : 'var(--ink)' }}>
            {be.rate === null ? '不可行' : pct(be.rate)}
          </div>
          <div className="n">
            {be.rate === null ? be.reason : `低于这个采纳率就亏，中性假设 ${pct(adoption.neutral, 0)} 在门槛上方`}
          </div>
        </div>
        <div className="card metric">
          <div className="k">每单让利</div>
          <div className="v">{yuan(be.giveaway)}</div>
          <div className="n">原价 × 折扣率 = {yuan(listPrice)} × {pct(discount, 0)}</div>
        </div>
        <div className="card metric">
          <div className="k">每单增量毛利</div>
          <div className="v">{yuan(be.incrementalMargin)}</div>
          <div className="n">{be.rate === null ? '≤ 0，打折也救不回来' : '未命中者被转化后，每单多赚的钱'}</div>
        </div>
      </div>
      <div className="note note-accent" style={{ marginTop: 10 }}>
        平衡点公式：<span className="mono">a = h·d / ((1−h)·g)</span>，其中 h 是命中率
        （{pct(picked.hitRate)}）、d 是让利（{yuan(be.giveaway)}）、g 是增量毛利（{yuan(be.incrementalMargin)}）。
        含义是：h 越高，本来就买全套的人越多，白让的折扣越多，门槛越高。
        {picked.hitRate > 0.3 &&
          ' 这个组合命中率偏高，说明「一起买」已经是既有习惯，做折扣套餐反而是在给本来就会买的人让利 —— 更适合做加价购而不是降价套餐。'}
      </div>

      {/* —— 横向对比 —— */}
      <h2 className="sec">横向比：选 3 个看谁最值</h2>
      <p style={{ color: 'var(--ink-2)', fontSize: 13.5, marginTop: -4 }}>
        单看提升率会挑中「只覆盖几十单」的组合。这里按 <b>预期提升 × 覆盖订单数</b> 排序 ——
        覆盖得广、每单又能多收一点的，才真的把钱挣回来。勾选组合加入对比（最多 3 个）。
      </p>
      <div className="card" style={{ padding: 0 }}>
        <div className="tbl-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>对比</th>
                <th>组合</th>
                <th className="num">lift</th>
                <th className="num">覆盖订单</th>
                <th className="num">这几件原花费</th>
                <th className="num">套餐价</th>
                <th className="num">中性 Δ客单</th>
                <th className="num">覆盖 × Δ客单</th>
                <th className="num">平衡采纳率</th>
              </tr>
            </thead>
            <tbody>
              {compare.map(({ b, bundleP: bp, breakEven: cbe, expectedValue, scenarios: sc }) => (
                <tr key={b.key}>
                  <td>
                    <input
                      type="checkbox"
                      checked={compareKeys.includes(b.key)}
                      onChange={() => toggleCompare(b.key)}
                      style={{ width: 'auto', accentColor: 'var(--accent)' }}
                    />
                  </td>
                  <td>
                    <div style={{ fontWeight: 550 }}>{b.items.join(' + ')}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                      {b.dominantDaypart ? `${DAYPART_LABEL[b.dominantDaypart] || b.dominantDaypart}为主 ` : ''}
                      多人占比 {pct(b.groupShare, 0)}
                    </div>
                  </td>
                  <td className="num">{b.lift.toFixed(2)}</td>
                  <td className="num">{b.matchedCount}</td>
                  <td className="num">{yuan(b.partialSpend)}</td>
                  <td className="num">{yuan(bp)}</td>
                  <td className="num">{yuan(sc.neutral.aovLift)}</td>
                  <td className="num">
                    <b>{yuan(expectedValue)}</b>
                  </td>
                  <td className="num">
                    {cbe.rate === null ? <span className="tag tag-bad">不可行</span> : pct(cbe.rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="note" style={{ marginTop: 10 }}>
        表里所有组合共用同一组参数（折扣 {pct(discount, 0)}、成本率 {pct(costRatio, 0)}、
        中性采纳率 {pct(adoption.neutral, 0)}），比的是「哪个组合本身更值」，不是「哪个参数最好」。
        想做参数寻优需要真实 A/B 数据，本工具不做 —— 见「方法与假设」里不做什么。
      </div>
    </>
  );
}
