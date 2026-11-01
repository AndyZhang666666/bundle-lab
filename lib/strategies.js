import { MODEL_VERSION, simulateStats, validateAssumptions } from './simulate.js';
import { copyToManual } from './manual-scenario.js';
import { setAdoption } from './scenario.js';

export const STRATEGY_KEY = 'bundle-lab:strategies:v1';
export const MAX_STRATEGIES = 3;
export const emptyStrategies = () => ({ version: 1, snapshots: [], selectedId: null, reason: '' });
const copy = value => JSON.parse(JSON.stringify(value));
const text = (value, max, label) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw Error(`${label}格式无效`);
  return value.trim();
};

function normalizedBundle(bundle) {
  if (!Array.isArray(bundle?.items) || bundle.items.length < 2 || bundle.items.length > 3 || !Array.isArray(bundle.prices) || bundle.prices.length !== bundle.items.length) throw Error('方案需要 2–3 件商品与对应价格');
  const items = bundle.items.map(name => text(name, 40, '商品名称'));
  if (new Set(items).size !== items.length || bundle.prices.some(v => !Number.isFinite(v) || v < 0 || v > 100000)) throw Error('商品名称或价格无效');
  const listPrice = bundle.prices.reduce((a, b) => a + b, 0);
  if (listPrice <= 0 || !Number.isFinite(bundle.listPrice) || Math.abs(bundle.listPrice - listPrice) > 1e-6) throw Error('商品原价合计不一致');
  return { key: String(bundle.key || 'snapshot'), items, prices: [...bundle.prices], listPrice, hitRate: bundle.hitRate, partialSpend: bundle.partialSpend, matchedCount: 100, unit: 'normalized-covered-orders' };
}

export function createStrategy(bundle, assumptions, source, { id, name = '方案 A', createdAt = new Date().toISOString() } = {}) {
  if (!['builtin', 'manual'].includes(source?.kind)) throw Error('方案来源无效');
  const b = normalizedBundle(bundle), a = validateAssumptions(assumptions);
  simulateStats(b, a); // The original model validates both populations; no second formula.
  if (!Number.isFinite(Date.parse(createdAt))) throw Error('保存时间无效');
  return { id: id || globalThis.crypto?.randomUUID?.() || `strategy-${Date.now()}-${Math.random().toString(36).slice(2)}`, name: text(name, 40, '方案名称'), createdAt, modelVersion: MODEL_VERSION,
    source: { kind: source.kind, label: text(source.label, 240, '来源说明') }, bundle: b, assumptions: copy(a) };
}

export const strategySignature = snapshot => {
  const { key: _key, ...bundle } = snapshot.bundle;
  // Provenance/key changes are not a new strategy; ignore floating conversion noise only here.
  return JSON.stringify({ bundle, assumptions: snapshot.assumptions }, (_key, value) => typeof value === 'number' ? +value.toFixed(10) : value);
};

export function addStrategy(state, snapshot) {
  if (state.snapshots.length >= MAX_STRATEGIES) throw Error('最多保留三个方案；请先移除一份，再保存新的方案');
  if (state.snapshots.some(s => strategySignature(s) === strategySignature(snapshot))) throw Error('这组输入已经保留；请先调整折扣或其他假设，再保存另一方案');
  if (state.snapshots.some(s => s.id === snapshot.id)) throw Error('方案标识重复');
  return { ...state, snapshots: [...state.snapshots, snapshot] };
}

export function removeStrategy(state, id) {
  return { ...state, snapshots: state.snapshots.filter(s => s.id !== id), selectedId: state.selectedId === id ? null : state.selectedId, reason: state.selectedId === id ? '' : state.reason };
}

export function chooseStrategy(state, id, reason = '') {
  if (!state.snapshots.some(s => s.id === id)) throw Error('请选择已保留的方案');
  if (typeof reason !== 'string' || reason.length > 600) throw Error('选择理由最多600字');
  return { ...state, selectedId: id, reason: reason.trim() };
}

export function decodeStrategies(raw) {
  if (!raw) return emptyStrategies();
  if (raw.length > 60000) throw Error('方案记录过大');
  const d = JSON.parse(raw);
  if (d.version !== 1 || !Array.isArray(d.snapshots) || d.snapshots.length > MAX_STRATEGIES || typeof d.reason !== 'string' || d.reason.length > 600) throw Error('方案记录格式无效');
  const snapshots = d.snapshots.map(s => {
    if (s.modelVersion !== MODEL_VERSION) throw Error('保存方案的模型版本已变；旧记录不会被自动覆盖');
    text(s.id, 160, '方案标识');
    if (typeof s.createdAt !== 'string' || !Number.isFinite(Date.parse(s.createdAt)) || !s.assumptions || !['discount', 'costRatio', 'existingRedemption'].every(k => Number.isFinite(s.assumptions[k])) || !s.assumptions.adoption || !['conservative', 'neutral', 'optimistic'].every(k => Number.isFinite(s.assumptions.adoption[k]))) throw Error('方案输入或保存时间不完整');
    return createStrategy(s.bundle, s.assumptions, s.source, { id: s.id, name: s.name, createdAt: s.createdAt });
  });
  if (new Set(snapshots.map(s => s.id)).size !== snapshots.length || (d.selectedId !== null && !snapshots.some(s => s.id === d.selectedId))) throw Error('方案选择无效');
  return { version: 1, snapshots, selectedId: d.selectedId, reason: d.reason };
}

export function strategyToManual(snapshot) {
  return { ...copyToManual(snapshot.bundle, snapshot.assumptions), fullShare: String(snapshot.bundle.hitRate * 100), copied: snapshot.source.kind === 'builtin', provenance: `${snapshot.name} 的输入副本；原来源：${snapshot.source.label}` };
}

export function strategyResult(snapshot) {
  const sim = simulateStats(snapshot.bundle, snapshot.assumptions), n = sim.scenarios.neutral;
  return { addedMargin: n.addedMargin * 100, existingLoss: n.existingLoss * 100, marginLift: n.marginLift * 100, breakEven: sim.breakEven };
}

export function differences(base, next) {
  const diff = [], pct = n => `${+(n * 100).toFixed(2)}%`, money = n => `¥${n.toFixed(2)}`;
  const compare = (label, a, b, format = String) => { if (a !== b) diff.push(`${label}：${format(a)} → ${format(b)}`); };
  compare('商品', base.bundle.items.join('＋'), next.bundle.items.join('＋'));
  compare('各商品单价', base.bundle.prices.map(money).join('／'), next.bundle.prices.map(money).join('／'));
  compare('已买齐者占比', base.bundle.hitRate, next.bundle.hitRate, pct);
  const spend = s => s.bundle.hitRate === 1 ? null : (s.bundle.partialSpend - s.bundle.hitRate * s.bundle.listPrice) / (1 - s.bundle.hitRate);
  compare('未买齐者原消费', spend(base), spend(next), n => n === null ? '不适用' : money(n));
  compare('折扣率', base.assumptions.discount, next.assumptions.discount, pct);
  compare('成本率', base.assumptions.costRatio, next.assumptions.costRatio, pct);
  compare('既有顾客领折扣率', base.assumptions.existingRedemption, next.assumptions.existingRedemption, pct);
  for (const [key, label] of [['conservative', '低档'], ['neutral', '中档'], ['optimistic', '高档']]) compare(`${label}采纳率`, base.assumptions.adoption[key], next.assumptions.adoption[key], pct);
  if (base.source.label !== next.source.label) diff.push(`来源：${base.source.label} → ${next.source.label}`);
  return diff;
}

export function strategiesReport(state) {
  const safe = decodeStrategies(JSON.stringify(state));
  return { ...safe, unit: '每100个覆盖订单（归一比较单位，不是观测样本量）', modelVersion: MODEL_VERSION,
    snapshots: safe.snapshots.map((s, i) => ({ ...s, resultPer100: strategyResult(s), changesFromA: i ? differences(safe.snapshots[0], s) : [] })),
    limits: ['不同方案为独立条件推演，不能把收益相加', '改变折扣不会自动推断采纳变化，不是价格弹性预测', '毛利不含履约、库存、运营成本，不是实际利润'] };
}

export function strategiesMarkdown(state) {
  const r = strategiesReport(state), money = n => `¥${n.toFixed(2)}`, pct = n => n === null ? '不可达' : `${(n * 100).toFixed(1)}%`;
  return ['# 套餐方案比较卡', '', `模型：${r.modelVersion}`, `单位：${r.unit}`, `选择：${r.snapshots.find(s => s.id === r.selectedId)?.name || '尚未选择'}`, `理由：${r.reason || '未填写'}`, '',
    ...r.snapshots.flatMap((s, i) => [`## ${s.name}${i === 0 ? '（比较基准 A）' : ''}`, `来源：${s.source.label}`, `保存：${s.createdAt}`, ...s.bundle.items.map((name, j) => `- ${name}：${money(s.bundle.prices[j])}`),
      `- 已买齐者：${pct(s.bundle.hitRate)}；覆盖人群原平均消费：${money(s.bundle.partialSpend)}`,
      `- 折扣：${pct(s.assumptions.discount)}；成本：${pct(s.assumptions.costRatio)}；既有顾客领折扣：${pct(s.assumptions.existingRedemption)}`,
      `- 低／中／高采纳：${Object.values(s.assumptions.adoption).map(pct).join('／')}`,
      `- 新增贡献：${money(s.resultPer100.addedMargin)}；既有让利：${money(s.resultPer100.existingLoss)}；增量毛利：${money(s.resultPer100.marginLift)}`,
      `- 平衡采纳：${pct(s.resultPer100.breakEven.rate)}${s.resultPer100.breakEven.reason ? `；${s.resultPer100.breakEven.reason}` : ''}`,
      ...(i ? ['相对 A 的变化：', ...s.changesFromA.map(t => `- ${t}`)] : []), '']), '## 下一步', '- 核实成本与人群基线；用对照实验分别验证新增采纳和既有顾客领券行为。', '', '## 边界', ...r.limits.map(t => `- ${t}`)].join('\n');
}

export function sensitivityPoint(bundle, assumptions, discount, adoption) {
  const next = { ...validateAssumptions(assumptions), discount, adoption: setAdoption(assumptions.adoption, 'neutral', adoption) };
  const sim = simulateStats(bundle, next), n = sim.scenarios.neutral;
  return { discount, adoption, marginLift: n.marginLift * 100, addedMargin: n.addedMargin * 100, existingLoss: n.existingLoss * 100, breakEven: sim.breakEven, assumptions: next };
}

export function sensitivityGrid(bundle, assumptions) {
  // Coarse, explicit scenario axes; include the exact current input rather than snapping it.
  const axis = (values, current) => [...new Set([...values, current])].sort((a, b) => a - b);
  const discounts = axis([0, .05, .1, .15, .2, .3, .5, 1], assumptions.discount);
  const adoptions = axis([0, .05, .1, .2, .4, .6, 1], assumptions.adoption.neutral);
  return { discounts, adoptions, rows: adoptions.map(a => discounts.map(d => sensitivityPoint(bundle, assumptions, d, a))) };
}
