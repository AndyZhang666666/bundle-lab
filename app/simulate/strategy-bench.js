"use client";
import { useEffect, useMemo, useState } from 'react';
import {useTabDraft} from '@/lib/use-tab-draft';
import { downloadText } from '@/lib/scenario';
import { STRATEGY_KEY, MAX_STRATEGIES, emptyStrategies, createStrategy, addStrategy, removeStrategy, chooseStrategy, decodeStrategies, strategyResult, differences, strategiesReport, strategiesMarkdown, nextStrategyName, nextStrategySlot, saveSensitivityPreview } from '@/lib/strategies';
const money = n => `${n > 0 ? '+' : n < 0 ? '−' : ''}¥${Math.abs(n).toFixed(2)}`;
const pct = n => n === null ? '不可达' : `${(n * 100).toFixed(1)}%`;

const EMPTY_STRATEGY_DRAFT={name:'',reason:'',reasonFor:''};
export default function StrategyBench({ bundle, assumptions, source, valid, onLoad,validationPlans=[],renderPreview }) {
  const [state, setState] = useState(emptyStrategies), [ready, setReady] = useState(false), [notice, setNotice] = useState(''), [undo, setUndo] = useState(null);
  useEffect(() => { try { const loaded = decodeStrategies(localStorage.getItem(STRATEGY_KEY)); setState(loaded); } catch { setNotice('旧方案未能恢复，未覆盖原记录；新保存会替换此处旧记录。当前仍可操作与导出。'); } setReady(true); }, []);
  const [draft,setDraft,draftStatus]=useTabDraft('strategy-input',EMPTY_STRATEGY_DRAFT);
  const name=draft.name,setName=name=>setDraft(v=>({...v,name}));
  const reason=draft.reasonFor===(state.selectedId||'')?draft.reason:state.reason;
  const setReason=reason=>setDraft(v=>({...v,reason,reasonFor:state.selectedId||''}));
  const results = useMemo(() => state.snapshots.map(strategyResult), [state.snapshots]);
  const nextName = nextStrategyName(state);
  function persist(next, message, confirmReason=false) { setState(next);if(confirmReason||next.selectedId!==state.selectedId)setDraft(v=>({...v,reason:next.reason,reasonFor:next.selectedId||''})); setUndo(null); try { localStorage.setItem(STRATEGY_KEY, JSON.stringify(next)); setNotice(message); return true; } catch { setNotice(`${message} 本机保存不可用，关闭页面前请导出比较卡。`); return false; } }
  function save() { if (!valid || !ready || !draftStatus.ready) return; try { const snapshot = createStrategy(bundle, assumptions, source, { name: name.trim() || nextName }); persist(addStrategy(state, snapshot), `已保留「${snapshot.name}」；继续改输入不会改变它。`); setName(''); } catch (e) { setNotice(e.message); } }
  function savePreview(preview) {
    if(!valid||!ready)throw Error('输入与方案记录尚未就绪，请稍后再存');
    const next=saveSensitivityPreview(state,preview,bundle,assumptions,source),snapshot=next.snapshots.at(-1);
    const saved=persist(next,`已直接保留「${snapshot.name}」预演；工作输入、名称草稿和已有方案保持不变。`);
    return `已直接保留「${snapshot.name}」；当前输入和草稿未改。${saved?'':'尚未写入本机，请导出比较卡。'}`;
  }
  const canExport = valid && ready && draftStatus.ready && state.snapshots.length > 0;
  const pendingReason = state.selectedId && reason.trim() !== state.reason;
  const exportable = canExport && !pendingReason;
  return <>{renderPreview?.({onSavePreview:savePreview,snapshotCount:state.snapshots.length,saveReady:ready&&valid,nextSnapshotSlot:nextStrategySlot(state)})}<section className="strategy-bench" id="strategy-bench" aria-labelledby="strategy-title">
    <div className="section-title"><div><p className="desk-eyebrow">保留与取舍</p><h2 id="strategy-title">先留一份，再试一个改变。</h2></div><span className="unit-stamp">{state.snapshots.length} / {MAX_STRATEGIES} 份方案</span></div>
    <p className="small">第一份为基准 A。复制输入、调另一份假设，再看改变带来的代价；每份都按100覆盖单比较，收益不能相加。</p>
    <div className="strategy-save"><label>给当前输入命名<input disabled={!ready||!draftStatus.ready} type="text" maxLength={40} value={name} placeholder={nextName} onChange={e => setName(e.target.value)} /></label><button className="btn" data-on="true" disabled={!valid || !ready || !draftStatus.ready || state.snapshots.length >= MAX_STRATEGIES} onClick={save}>保留当前方案</button><a href="#scenario-input">回到输入继续调整 ↗</a></div>
    <p className="small">{draftStatus.notice} 名称与待确认理由是草稿；方案和决定仍需明确保存。</p>
    <p className="strategy-notice" role="status">{!valid ? '当前输入未完成校验；暂停新增、选择和导出，不把旧结果当成当前结果。' : notice || '方案留在本机浏览器；保留的是输入快照，不是经营效果。'}{undo && <button className="text-action" onClick={() => { persist(undo, '已撤回移除，原比较与选择已恢复。'); setUndo(null); }}>撤回移除</button>}</p>
    {state.snapshots.length ? <><div className="strategy-table-scroll" role="region" aria-label="已保留方案的同口径比较，可横向滚动" tabIndex={0}><table className="strategy-table"><caption>固定输入的独立方案；新增输入不会修改这里的快照。</caption><thead><tr><th scope="col">每100覆盖单</th>{state.snapshots.map((s, i) => <th scope="col" key={s.id}><span className="strategy-position">{i === 0 ? 'A · 比较基准' : `${String.fromCharCode(65 + i)} · 与 A 对照`}</span><strong>{s.name}</strong><span className="strategy-source">{s.source.label}</span><div className="strategy-head-actions"><button className="text-action" onClick={() => { onLoad(s); setNotice(`已复制「${s.name}」到我的算例，原方案保持不变。`); }}>复制后调整</button><button className="text-action danger-action" aria-label={`移除${s.name}`} onClick={() => { persist(removeStrategy(state, s.id), `已移除「${s.name}」；移除基准后第一份会成为新基准。`); setUndo(state); }}>移除</button></div></th>)}</tr></thead><tbody>
      <tr><th scope="row">商品与原价</th>{state.snapshots.map(s => <td key={s.id}>{s.bundle.items.map((item, i) => <span className="strategy-item" key={item}>{item} <b>¥{s.bundle.prices[i].toFixed(2)}</b></span>)}</td>)}</tr>
      <tr><th scope="row">折扣 / 中档采纳</th>{state.snapshots.map(s => <td key={s.id}>{pct(s.assumptions.discount)} / {pct(s.assumptions.adoption.neutral)}</td>)}</tr>
      <tr><th scope="row">新增毛利贡献</th>{results.map((r, i) => <td key={state.snapshots[i].id}>{money(r.addedMargin)}</td>)}</tr>
      <tr><th scope="row">既有顾客让利</th>{results.map((r, i) => <td key={state.snapshots[i].id}>−¥{r.existingLoss.toFixed(2)}</td>)}</tr>
      <tr className="strategy-net"><th scope="row">增量毛利</th>{results.map((r, i) => <td key={state.snapshots[i].id} data-negative={r.marginLift < 0}>{money(r.marginLift)}{i > 0 && <span className="strategy-delta">较 A {money(r.marginLift - results[0].marginLift)}</span>}</td>)}</tr>
      <tr><th scope="row">平衡采纳率</th>{results.map((r, i) => <td key={state.snapshots[i].id}>{pct(r.breakEven.rate)}{r.breakEven.reason && <span className="strategy-source">{r.breakEven.reason}</span>}</td>)}</tr>
      <tr><th scope="row">相对 A 改了什么</th>{state.snapshots.map((s, i) => <td key={s.id}>{i === 0 ? <span className="small">固定比较起点</span> : <ul className="strategy-changes">{differences(state.snapshots[0], s).map(t => <li key={t}>{t}</li>)}</ul>}<details className="strategy-assumptions"><summary>完整输入与来源</summary><p>已买齐 {pct(s.bundle.hitRate)} · 成本 {pct(s.assumptions.costRatio)} · 领折扣 {pct(s.assumptions.existingRedemption)}</p><p>覆盖人群平均原消费 ¥{s.bundle.partialSpend.toFixed(2)}；低／中／高采纳 {Object.values(s.assumptions.adoption).map(pct).join(' / ')}。</p><p>{s.modelVersion} · {s.createdAt.slice(0, 10)}</p></details></td>)}</tr>
      <tr><th scope="row">你的选择</th>{state.snapshots.map(s => <td key={s.id}><button className="btn" data-on={state.selectedId === s.id} aria-pressed={state.selectedId === s.id} disabled={!valid || !ready || !draftStatus.ready} onClick={() => { persist(chooseStrategy(state, s.id, reason), `已选择「${s.name}」，可记录理由并带走比较卡。`,true); }}>{state.selectedId === s.id ? '已选择' : '选择这份方案'}</button></td>)}</tr>
    </tbody></table></div>
    <div className="strategy-decision"><label>为什么保留这个选择？<textarea rows={2} maxLength={600} disabled={!draftStatus.ready} value={reason} placeholder="例如：增量略少，但对既有顾客的让利更小，所需采纳更容易验证。" onChange={e => setReason(e.target.value)} /></label><div>{state.selectedId ? <><p className="small">当前选择：{state.snapshots.find(s => s.id === state.selectedId)?.name}{pendingReason ? ' · 理由待确认' : ''}</p><button className="btn" disabled={!valid || !pendingReason} onClick={() => persist(chooseStrategy(state, state.selectedId, reason), '选择理由已保存。',true)}>确认选择理由</button></> : <p className="small">还没有选择。你也可以先导出比较，和同事讨论。</p>}</div></div>
    <div className="strategy-export"><p>比较卡保留每份输入、相对 A 的改变、同源结果和选择理由。</p><div className="scenario-actions"><button className="btn" disabled={!exportable} onClick={async () => { try { await navigator.clipboard.writeText(strategiesMarkdown(state,validationPlans)); setNotice('比较卡已复制。'); } catch { setNotice('复制不可用，请下载 Markdown。'); } }}>复制比较卡</button><button className="btn" disabled={!exportable} onClick={() => downloadText(strategiesMarkdown(state,validationPlans), '套餐方案比较.md', 'text/markdown;charset=utf-8')}>下载比较 Markdown</button><button className="btn" disabled={!exportable} onClick={() => downloadText(JSON.stringify(strategiesReport(state,validationPlans), null, 2), 'bundle-strategies.json', 'application/json')}>导出比较 JSON</button></div></div></> : <div className="strategy-empty"><span className="empty-A">A</span><div><h3>把现在的输入留作起点。</h3><p>再改一个折扣或采纳假设，保留为 B。差异会在这里对齐，负收益也照常展示。</p></div></div>}
  </section></>;
}
