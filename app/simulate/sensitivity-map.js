"use client";
import { useMemo, useState } from 'react';
import { sensitivityGrid, sensitivityPoint } from '@/lib/strategies';
const pct = value => `${+(value * 100).toFixed(1)}%`;
const money = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}¥${Math.abs(value).toFixed(2)}`;

export default function SensitivityMap({ bundle, assumptions, onApply }) {
  const [candidate, setCandidate] = useState(null);
  const grid = useMemo(() => sensitivityGrid(bundle, assumptions), [bundle, assumptions]);
  const preview = candidate ? sensitivityPoint(bundle, assumptions, candidate.discount, candidate.adoption) : null;
  const current = sensitivityPoint(bundle, assumptions, assumptions.discount, assumptions.adoption.neutral);
  return <section className="sensitivity-desk" aria-labelledby="sensitivity-title">
    <div className="section-title"><div><p className="desk-eyebrow">条件边界</p><h2 id="sensitivity-title">折扣更大，不一定赚得更多。</h2></div><span className="unit-stamp">Δ 毛利 / 100覆盖单</span></div>
    <p className="small">横向改折扣，纵向改未买齐者采纳。其余人群与成本假设固定；每格来自同一个收益模型。</p>
    <div className="sensitivity-legend"><span><i data-tone="profit"/> 正向</span><span><i data-tone="loss"/> 亏损</span><span><i data-tone="balanced"/> 持平</span><span className="map-current-key">描边：当前输入</span></div>
    <div className="sensitivity-scroll" role="region" aria-label="折扣与采纳率敏感性表，可横向滚动" tabIndex={0}>
      <table className="sensitivity-table"><caption>折扣率 → · 未买齐者采纳率 ↓。点击任一格先预演，按确认后才应用。</caption><thead><tr><th scope="col">采纳 / 折扣</th>{grid.discounts.map(d => <th scope="col" key={d}>{pct(d)}</th>)}</tr></thead><tbody>{grid.rows.map((row, i) => <tr key={grid.adoptions[i]}><th scope="row">{pct(grid.adoptions[i])}</th>{row.map(point => {
        const isCurrent = point.discount === assumptions.discount && point.adoption === assumptions.adoption.neutral;
        const isPreview = candidate?.discount === point.discount && candidate?.adoption === point.adoption;
        const tone = Math.abs(point.marginLift) < 1e-7 ? 'balanced' : point.marginLift > 0 ? 'profit' : 'loss';
        return <td key={point.discount}><button type="button" data-tone={tone} data-current={isCurrent} aria-current={isCurrent ? 'true' : undefined} aria-pressed={isPreview} aria-label={`折扣 ${pct(point.discount)}，采纳 ${pct(point.adoption)}，增量毛利 ${money(point.marginLift)}${isCurrent ? '，当前输入' : ''}${point.breakEven.rate === null ? '，当前折扣无法达到盈亏平衡' : ''}`} onClick={() => setCandidate({ discount: point.discount, adoption: point.adoption })}>{Math.round(point.marginLift) === 0 ? '0' : `${point.marginLift > 0 ? '+' : '−'}${Math.abs(point.marginLift).toFixed(0)}`}</button></td>;
      })}</tr>)}</tbody></table>
    </div>
    <div className="sensitivity-preview" aria-live="polite">{preview ? <><div><span className="desk-eyebrow">仅预演 · 尚未改动输入</span><h3>折扣 {pct(preview.discount)} · 中档采纳 {pct(preview.adoption)}</h3><p>增量毛利 <strong data-negative={preview.marginLift < 0}>{money(preview.marginLift)}</strong><span>，较当前 {money(preview.marginLift - current.marginLift)}</span></p><p className="small">{preview.breakEven.rate === null ? preview.breakEven.reason : `此折扣下的平衡采纳率：${pct(preview.breakEven.rate)}。`}</p></div><div className="preview-actions"><button className="btn" onClick={() => setCandidate(null)}>取消预演</button><button className="btn" data-on="true" onClick={() => { onApply(preview); setCandidate(null); }}>应用这组条件</button></div><p className="small preview-explainer">确认只改折扣与中档采纳；若超过原低／高档，会同步保持三档递增。已保留的方案不变。</p></> : <p>选一格看看：需要多少新增采纳，才能抵消既有顾客的让利？表中四舍五入显示金额，点击可看精确值。</p>}</div>
    <p className="model-boundary">这是一张条件地图。改变折扣不会自动推断采纳率，不代表价格弹性、概率或未来收益；绿色也不代表已经验证。</p>
  </section>;
}
