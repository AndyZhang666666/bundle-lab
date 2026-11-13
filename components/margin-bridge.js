"use client";

// Read the original engine's outputs. Only screen coordinates are derived here.
// These bars never calculate a new profit, adoption rate or recommendation.
export default function MarginBridge({ result }) {
  const contribution = result.addedMargin * 100;
  const loss = result.existingLoss * 100;
  const net = result.marginLift * 100;
  const values = [0, contribution, net];
  const lower = Math.min(...values), upper = Math.max(...values);
  const span = Math.max(upper - lower, 1);
  const y = value => 160 - ((value - lower) / span) * 116;
  const zero = y(0);
  const bars = [
    { x: 72, from: 0, to: contribution, label: '新增贡献', value: contribution, tone: contribution < 0 ? 'loss' : 'profit' },
    { x: 240, from: contribution, to: net, label: '既有让利', value: -loss, tone: 'loss' },
    { x: 408, from: 0, to: net, label: '增量毛利', value: net, tone: net < 0 ? 'loss' : 'profit' },
  ];
  const money = value => `${value < 0 ? '−' : value > 0 ? '+' : ''}¥${Math.abs(value).toFixed(2)}`;
  return <figure className="margin-bridge">
    <figcaption><span>从贡献到净增量</span><small>同一模型 · 每100覆盖单</small></figcaption>
    <svg viewBox="0 0 552 212" role="img" aria-label={`新增贡献${money(contribution)}，减去既有让利¥${loss.toFixed(2)}，增量毛利${money(net)}。每100覆盖单，条件推演。各项独立四舍五入，净额按模型原值计算，显示合计可能相差一分钱。`}>
      <line className="bridge-zero" x1="20" x2="532" y1={zero} y2={zero}/>
      <text className="bridge-zero-label" x="17" y={zero - 6}>0</text>
      <path className="bridge-connector" d={`M 148 ${y(contribution)} H 240 M 316 ${y(net)} H 408`}/>
      {bars.map(bar => {
        const top = Math.min(y(bar.from), y(bar.to)), height = Math.abs(y(bar.from) - y(bar.to));
        return <g key={bar.label}>
          <rect className={`bridge-bar bridge-${bar.tone}`} x={bar.x} y={height > 0 && height < 3 ? top - (bar.to >= bar.from ? 3 - height : 0) : top} width="76" height={bar.value === 0 ? 0 : Math.max(3, height)} rx="2"/>
          <text className="bridge-amount" x={bar.x + 38} y="24" textAnchor="middle">{money(bar.value)}</text>
          <text className="bridge-label" x={bar.x + 38} y="195" textAnchor="middle">{bar.label}</text>
        </g>;
      })}
    </svg>
    <p>各项独立四舍五入；净额按模型原值计算，显示合计可能相差¥0.01。</p>
  </figure>;
}
