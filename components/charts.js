'use client';

// Recharts 必须跑在客户端。这里集中放页面用到的几种图，
// 服务端页面把算好的数据传进来即可，不在这里做任何计算。

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from 'recharts';

const INK = '#1c1a17';
const INK3 = '#8a837a';
const LINE = '#e6e2db';
const ACCENT = '#b4441f';
const ACCENT2 = '#d9a48f';

const tickStyle = { fontSize: 11.5, fill: INK3 };

// 服务端组件不能把函数当 prop 传过来（RSC 序列化边界），
// 所以格式化用名字查表，页面只传字符串。
const FMT = {
  yuan: (v) => `¥${Number(v).toFixed(1)}`,
  yuan2: (v) => `¥${Number(v).toFixed(2)}`,
  num2: (v) => Number(v).toFixed(2),
  pct: (v) => `${(Number(v) * 100).toFixed(1)}%`,
  int: (v) => String(Math.round(Number(v))),
};
const pickFmt = (name) => FMT[name] || ((v) => String(v));

function TipBox({ active, payload, label, fmt }) {
  if (!active || !payload?.length) return null;
  const f = pickFmt(fmt);
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${LINE}`,
        borderRadius: 7,
        padding: '7px 10px',
        fontSize: 12.5,
        color: INK,
        boxShadow: '0 2px 8px rgba(0,0,0,.06)',
      }}
    >
      <div style={{ color: INK3, marginBottom: 2 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="tnum">
          {p.name}：{f(p.value)}
        </div>
      ))}
    </div>
  );
}

/** 客单价 / 商品数分布直方图。 */
export function Histogram({ data, xKey = 'label', yKey = 'count', name = '订单数', height = 200 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={LINE} strokeDasharray="2 4" />
        <XAxis dataKey={xKey} tick={tickStyle} axisLine={{ stroke: LINE }} tickLine={false} interval={0} />
        <YAxis tick={tickStyle} axisLine={false} tickLine={false} />
        <Tooltip content={<TipBox />} cursor={{ fill: 'rgba(0,0,0,.03)' }} />
        <Bar dataKey={yKey} name={name} fill={ACCENT} radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** 两组对比的横向条 —— 多人 vs 单人。fmt 传名字，见 FMT 表。 */
export function CompareBars({ data, height = 150, fmt = 'num2' }) {
  const f = pickFmt(fmt);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 30, left: 10, bottom: 0 }}>
        <CartesianGrid horizontal={false} stroke={LINE} strokeDasharray="2 4" />
        <XAxis type="number" tick={tickStyle} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={{ ...tickStyle, fill: INK }} axisLine={false} tickLine={false} width={88} />
        <Tooltip content={<TipBox fmt={fmt} />} cursor={{ fill: 'rgba(0,0,0,.03)' }} />
        <Bar dataKey="value" name="数值" radius={[0, 3, 3, 0]} label={{ position: 'right', fontSize: 12, fill: INK, formatter: f }}>
          {data.map((d, i) => (
            <Cell key={d.name} fill={i === 0 ? ACCENT : ACCENT2} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** 三档收益条，带零轴 —— 负值要能一眼看出来。 */
export function ScenarioBars({ data, height = 170, fmt = 'yuan2' }) {
  const f = pickFmt(fmt);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 14, right: 8, left: -14, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={LINE} strokeDasharray="2 4" />
        <XAxis dataKey="name" tick={{ ...tickStyle, fill: INK }} axisLine={{ stroke: LINE }} tickLine={false} />
        <YAxis tick={tickStyle} axisLine={false} tickLine={false} />
        <ReferenceLine y={0} stroke={INK3} />
        <Tooltip content={<TipBox fmt={fmt} />} cursor={{ fill: 'rgba(0,0,0,.03)' }} />
        <Bar dataKey="value" name="Δ" radius={[3, 3, 0, 0]} label={{ position: 'top', fontSize: 12, fill: INK, formatter: f }}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.value < 0 ? '#a3341f' : ACCENT} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
