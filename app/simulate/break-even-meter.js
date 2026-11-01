// Display only: the threshold comes from the existing two-population model.
const percent = value => (value * 100).toFixed(1) + '%';
export default function BreakEvenMeter({current, threshold, reason}) {
  const reachable = threshold != null;
  const delta = reachable ? (threshold - current) * 100 : null;
  return <section className="break-even-meter" aria-label="当前采纳率与平衡点">
    <div className="threshold-title"><h3>采纳率到哪里才回本？</h3><strong>{reachable ? percent(threshold) : '当前不可达'}</strong></div>
    <div className="threshold-legend"><span><i className="current-key"/>当前中档 {percent(current)}</span><span><i className="balance-key"/>平衡点 {reachable ? percent(threshold) : '无可行值'}</span></div>
    <div className="threshold-track" role="img" aria-label={`当前中档采纳率 ${percent(current)}，${reachable ? '平衡采纳率 '+percent(threshold) : '当前假设下不存在可达平衡采纳率'}`}>
      {reachable && <span className="threshold-feasible" style={{left:percent(threshold),width:percent(1-threshold)}}/>}
      {reachable && <i className="threshold-balance" style={{left:percent(threshold)}}/>}
      <i className="threshold-current" style={{left:percent(current)}}/>
    </div>
    <div className="threshold-axis"><span>0%</span><span>100%</span></div>
    <p>{reason || (delta > 0 ? `当前中档假设距离平衡还差 ${delta.toFixed(1)} 个百分点；需验证真实采纳能否达到。` : '当前中档已达到模型内平衡点；这仍是条件推演，需要验证真实采纳与成本。')}</p>
  </section>;
}
