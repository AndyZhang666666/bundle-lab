"use client";
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { simulateStats, validateAssumptions } from '@/lib/simulate';
import { setAdoption, downloadText } from '@/lib/scenario';
import { MANUAL_KEY, SOURCE_KEY, initialManual, manualBundle, decodeManual, copyToManual, assumptionReport, assumptionMarkdown } from '@/lib/manual-scenario';
import { strategyToManual } from '@/lib/strategies';
import { readProtectedDraft, writeProtectedDraft } from '@/lib/draft-guard';
import useScenario from '@/components/use-scenario';
import { ScenarioBars } from '@/components/charts';
import BreakEvenMeter from './break-even-meter';
import SensitivityMap from './sensitivity-map';
import InputBasis from "@/components/input-basis";
import StrategyBench from './strategy-bench';
const yuan = v => '¥' + v.toFixed(2), pct = v => v == null ? '不适用' : (v * 100).toFixed(1) + '%';

function Slider({ label, value, onChange, onInvalid, basis }) {
  const [draft, setDraft] = useState(String(Math.round(value * 10000) / 100));
  useEffect(() => setDraft(String(Math.round(value * 10000) / 100)), [value]);
  const edit = raw => { setDraft(raw); const valid = raw.trim() !== '' && Number.isFinite(Number(raw)) && Number(raw) >= 0 && Number(raw) <= 100; onInvalid(label, !valid); if (valid) onChange(Number(raw) / 100); };
  return <label className="field-stack rate-field"><span>{label}{basis&&<small className="assumption-tag">{basis}</small>}</span><div className="rate-value"><input aria-label={label + '数值'} type="number" min="0" max="100" step="0.1" value={draft} onChange={e => edit(e.target.value)} /><span>%</span></div><input aria-label={label} type="range" min="0" max="1" step="0.01" value={value} onChange={e => { onInvalid(label, false); onChange(Number(e.target.value)); }} /></label>;
}

export default function Simulator({ bundles }) {
  const builtin = useScenario(bundles), [source, setSource] = useState('builtin'), [manual, setManual] = useState(initialManual), [ready, setReady] = useState(false), [manualWriteLocked, setManualWriteLocked] = useState(false), [storage, setStorage] = useState(''), [feedback, setFeedback] = useState(''), [invalid, setInvalid] = useState({}), [inputEpoch, setInputEpoch] = useState(0);
  useEffect(() => { const loaded = readProtectedDraft(()=>globalThis.localStorage, MANUAL_KEY, decodeManual, initialManual);setManual(loaded.value);setManualWriteLocked(loaded.writeLocked);if(loaded.writeLocked)setStorage('自建草稿无法恢复，已暂停自动保存；旧值未被覆盖，当前仍可计算与导出。');try { if(localStorage.getItem(SOURCE_KEY)==='manual')setSource('manual'); }catch { setManualWriteLocked(true);setStorage('自建草稿或来源选择无法读取，已暂停自动保存；当前仍可计算与导出。'); }setReady(true); }, []);
  useEffect(() => { if (!ready) return;const outcome = writeProtectedDraft(()=>globalThis.localStorage, MANUAL_KEY, manual, decodeManual, manualWriteLocked);if(outcome.reason==='locked'){setStorage('自建草稿自动保存已暂停；旧值未被覆盖，当前仍可计算与导出。');return;}if(!outcome.saved){setStorage(outcome.reason==='invalid'?'自建输入待补全，上一份有效草稿保留；请核实人群与参数。':'本机保存不可用，当前仍可计算与导出。');return;}try{localStorage.setItem(SOURCE_KEY,source);setStorage('');}catch{setStorage('来源选择无法保存，当前仍可计算与导出。');} }, [manual, source, ready, manualWriteLocked]);
  const isManual = source === 'manual', s = isManual ? manual : builtin.scenario, set = isManual ? setManual : builtin.setScenario;
  const pickedBuiltin = bundles.find(b => b.key === builtin.scenario.pickKey) || bundles[0];
  const state = useMemo(() => { try { if (Object.values(invalid).some(Boolean)) throw Error('请补全 0–100% 范围内的参数数值'); const picked = isManual ? manualBundle(manual) : pickedBuiltin; return { picked, sim: simulateStats(picked, s), error: null }; } catch (e) { return { picked: null, sim: null, error: e.message }; } }, [isManual, manual, pickedBuiltin, s, invalid]);
  const { picked, sim, error } = state, n = sim?.scenarios.neutral, be = sim?.breakEven;
  const sourceLabel = isManual ? (typeof manual.provenance === 'string' ? manual.provenance.slice(0, 240) : manual.copied ? '从演示组合复制的待核实个人假设' : '用户自建假设；未经观测验证') : '内置合成订单 + 行为假设';
  const report = sim ? assumptionReport(picked, s, sourceLabel, isManual ? 'manual' : 'builtin') : null;
  const markdown = report ? assumptionMarkdown(report) : '';
  const changeSource = v => { setSource(v); setInvalid({}); setFeedback(''); setInputEpoch(n => n + 1); };
  const onInvalid = (label, bad) => setInvalid(old => ({ ...old, [label]: bad }));
  const editItem = (i, k, v) => setManual(old => ({ ...old, items: old.items.map((item, j) => i === j ? { ...item, [k]: v } : item) }));
  const compare = useMemo(() => bundles.filter(b => builtin.scenario.compareKeys.includes(b.key)).map(b => simulateStats(b, builtin.scenario)).sort((a, b) => b.expectedValue - a.expectedValue), [bundles, builtin.scenario]);
  const loadSnapshot = snapshot => { setManual(strategyToManual(snapshot)); changeSource('manual'); setFeedback(`已把「${snapshot.name}」复制到输入。修改后另存一份，原快照保持不变。`); document.getElementById('scenario-input')?.scrollIntoView({ block: 'start' }); };

  return <>
    <p className="scenario-feedback" role="status">{feedback || storage || builtin.notice}</p>
    {(builtin.writeLocked||manualWriteLocked)&&<div className="draft-recovery" role="group" aria-label="恢复草稿自动保存"><p>检测到无法恢复的旧草稿，当前计算和导出可用。只有点击对应按钮，才会用本页输入替换该来源的旧值。</p>{builtin.writeLocked&&<button className="btn" onClick={()=>builtin.resumeSaving()}>用当前内置输入替换旧草稿并恢复保存</button>}{manualWriteLocked&&<button className="btn" onClick={()=>{setManualWriteLocked(false);setStorage('已选择用当前有效自建输入替换旧草稿。');}}>用当前自建输入替换旧草稿并恢复保存</button>}</div>}
    <a className="scenario-result-jump" href="#scenario-result">{n ? <>当前中档增量毛利 <strong>{yuan(n.marginLift * 100)}</strong> / 100覆盖单</> : '输入补全后可查看增量账本'}<span>查看账本 ↓</span></a>
    <div className="grid g2 sim-work">
      <section className="card scenario-input" id="scenario-input" aria-labelledby="scenario-input-title">
        <div className="section-title"><div><p className="desk-eyebrow">搭一组条件</p><h2 id="scenario-input-title" className="sub">卖什么，优惠多少？</h2></div><button className="btn" onClick={() => { setFeedback(''); setInvalid({}); setInputEpoch(v => v + 1); if (isManual) setManual(initialManual()); else builtin.reset(); }}>恢复本来源默认</button></div>
        <fieldset className="scenario-source"><legend>从哪里开始</legend><label><input type="radio" name="scenario-source" value="builtin" checked={!isManual} onChange={() => changeSource('builtin')} />内置订单</label><label><input type="radio" name="scenario-source" value="manual" checked={isManual} onChange={() => changeSource('manual')} />我的算例</label></fieldset>
        <p className="small source-origin">{isManual ? sourceLabel : '合成订单 · 非真实经营记录'}。本页结果均为条件推演。</p>
        <InputBasis kind={isManual?'manual':'builtin'}/>
        {isManual ? <>
          <div className="manual-items">{manual.items.map((item, i) => <div className="manual-item" key={i}><label>商品 {i + 1}<input aria-label={`商品 ${i + 1} 名称`} maxLength={40} value={item.name} onChange={e => editItem(i, 'name', e.target.value)} /></label><label>单价 / 元<input aria-label={`商品 ${i + 1} 价格`} type="number" min="0" max="100000" step="0.01" value={item.price} onChange={e => editItem(i, 'price', e.target.value)} /></label>{manual.items.length === 3 && <button className="btn" aria-label={`移除商品 ${i + 1}`} onClick={() => setManual(old => ({ ...old, items: old.items.filter((_, j) => i !== j) }))}>移除</button>}</div>)}</div>
          {manual.items.length < 3 && <button className="text-action add-product" onClick={() => setManual(old => ({ ...old, items: [...old.items, { name: '商品 C', price: '0' }] }))}>＋ 添加第三件商品</button>}
        </> : <><label className="fld" htmlFor="picked">演示组合</label><select id="picked" value={s.pickKey} onChange={e => set(p => ({ ...p, pickKey: e.target.value }))}>{bundles.map(b => <option key={b.key} value={b.key}>{b.items.join(' + ')}</option>)}</select><button className="text-action add-product" onClick={() => { setManual(copyToManual(pickedBuiltin, s)); changeSource('manual'); setFeedback('已复制商品和当前假设；请换成自己的商品并逐项核实。'); }}>复制为我的算例 →</button></>}
        <div className="primary-assumptions"><Slider key={`${source}-${inputEpoch}-discount`} label="套餐折扣率" value={s.discount} onInvalid={onInvalid} onChange={v => set(p => ({ ...p, discount: v }))} /><p className="assumption-context">{sim ? <>原价 {yuan(sim.listPrice)} → 套餐价 <strong>{yuan(sim.bundleP)}</strong></> : '商品有效后显示折后价'}</p>
          <Slider key={`${source}-${inputEpoch}-neutral`} label="中档采纳率" basis="假设 · 待验证" value={s.adoption.neutral} onInvalid={onInvalid} onChange={v => set(p => ({ ...p, adoption: setAdoption(p.adoption, 'neutral', v) }))} /><p className="assumption-context">只指原本未买齐的人中，预计有多少人补齐套餐。不是所有顾客的转化率。</p></div>
        <details className="population-settings"><summary><span>核实人群、成本与让利</span><span className="settings-peek">成本 {pct(s.costRatio)} · 领折扣 {pct(s.existingRedemption)}</span></summary>
          {isManual ? <><div className="grid g2 manual-population"><label>原本已买齐者占比 / %<small className="assumption-tag">待验证</small><input type="number" min="0" max="100" value={manual.fullShare} onChange={e => setManual(old => ({ ...old, fullShare: e.target.value }))} /></label><label>未买齐者原有平均消费 / 元<small className="assumption-tag">待验证</small><input type="number" min="0" value={manual.incompleteSpend} onChange={e => setManual(old => ({ ...old, incompleteSpend: e.target.value }))} /></label></div><p className="small">只含这组商品。已买齐者100%时，没有未买齐人群；手动假设不产生订单样本或关联排名。</p></> : <p className="small"><span className="assumption-tag">合成统计 · 非观测</span>内置组合已买齐 {pct(pickedBuiltin.hitRate)}。人群基线来自合成订单；需要修改时，先复制为我的算例。</p>}
          <Slider key={`${source}-${inputEpoch}-cost`} label="食材成本率" basis="假设 · 待验证" value={s.costRatio} onInvalid={onInvalid} onChange={v => set(p => ({ ...p, costRatio: v }))} />
          <Slider key={`${source}-${inputEpoch}-redemption`} label="既有整套顾客领折扣率" basis="假设 · 待验证" value={s.existingRedemption} onInvalid={onInvalid} onChange={v => set(p => ({ ...p, existingRedemption: v }))} />
        </details>
        <details className="population-settings"><summary><span>采纳率的不确定范围</span><span className="settings-peek">{pct(s.adoption.conservative)} / {pct(s.adoption.neutral)} / {pct(s.adoption.optimistic)}</span></summary><p className="small">三档是你给出的条件，不是置信区间。调整一档时自动保持低档 ≤ 中档 ≤ 高档。</p>{[['conservative', '低档采纳率'], ['optimistic', '高档采纳率']].map(([k, label]) => <Slider key={`${source}-${inputEpoch}-${k}`} label={label} value={s.adoption[k]} onInvalid={onInvalid} onChange={v => set(p => ({ ...p, adoption: setAdoption(p.adoption, k, v) }))} />)}</details>
      </section>
      <section className="card scenario-output" id="scenario-result" aria-live="polite">
        <div className="section-title"><div><p className="desk-eyebrow">同口径核账</p><h2 className="sub">新增贡献，抵得过让利吗？</h2></div><span className="small">中档假设</span></div>
        <p className="unit-note">每 100 个覆盖订单 · 归一比较单位，不是观测订单数</p>
        {error ? <div className="input-error" role="alert"><h3>这组算例还不能计算</h3><p>{error}</p><p>请补全输入，旧结果不作为当前结果展示或导出。人群基线在左侧「核实人群、成本与让利」内。</p></div> : <>
          <div className="margin-total"><span>增量毛利</span><strong className="tnum" data-negative={n.marginLift < 0}>{yuan(n.marginLift * 100)}</strong><small>{n.marginLift > 0 ? '条件下为正，尚需验证' : n.marginLift < 0 ? '新增贡献未抵消让利或采纳本身损失' : '当前收支相抵'}</small></div>
          <div className="ledger"><p><span>新增毛利贡献</span><b>{yuan(n.addedMargin * 100)}</b></p><p><span>既有顾客让利损失</span><b>{yuan(n.existingLoss * 100)}</b></p><p className="ledger-balance"><span>平衡采纳率</span><b>{be.rate == null ? '不可达' : pct(be.rate)}</b></p></div>
          <p className="small">毛利未扣除履约、库存与运营成本。</p><BreakEvenMeter current={s.adoption.neutral} threshold={be.rate} reason={be.reason} />
          <ScenarioBars data={['conservative', 'neutral', 'optimistic'].map((k, i) => ({ name: ['低档', '中档', '高档'][i] + ' ' + pct(s.adoption[k]), value: sim.scenarios[k].marginLift * 100 }))} fmt="yuan2" height={170} />
          <p className="small">墨绿为正、红褐为负；微小正值以 4px 标记，金额以标签为准。</p>
          <div className="scenario-reading" aria-label="三档条件的增量毛利">{['conservative','neutral','optimistic'].map((k,i)=><div key={k}><span>{['低档','中档','高档'][i]}采纳 {pct(s.adoption[k])}</span><b>{yuan(sim.scenarios[k].marginLift*100)}</b><span>增量毛利 / 100覆盖单</span></div>)}</div>
          <a className="save-scenario-link" href="#strategy-bench">保留当前输入，和下一份方案比较 ↘</a>
          <details className="math-detail"><summary>核对人群与计算依据</summary><p>原价 {yuan(sim.listPrice)} → 套餐价 {yuan(sim.bundleP)}；原本已买齐 {pct(picked.hitRate)}。{picked.hitRate === 1 ? '没有未买齐者，原有平均消费不适用。' : <>未买齐者原有平均消费 {yuan(n.incompleteSpend)}。</>}</p><pre>新增毛利 − 既有顾客让利 = 增量毛利{'\n'}{yuan(n.addedMargin * 100)} − {yuan(n.existingLoss * 100)} = {yuan(n.marginLift * 100)}</pre><p className="small">采用既有 two-population 模型；不含价格弹性或因果效果。{!isManual && <>合成订单原始统计：已买齐 {picked.hitCount} / 覆盖 {picked.matchedCount}。账本始终按100单归一。</>}</p></details>
        </>}
        <details className="assumption-export"><summary>只带走当前输入</summary><p className="small">包含商品、参数、结果及待验证条件；多方案比较卡在下方单独导出。</p><div className="scenario-actions"><button className="btn" disabled={!report || !ready} onClick={async () => { try { await navigator.clipboard.writeText(markdown); setFeedback('假设卡已复制。'); } catch { setFeedback('浏览器不允许复制，请下载 Markdown。'); } }}>复制假设卡</button><button className="btn" disabled={!report || !ready} onClick={() => downloadText(markdown, '套餐假设卡.md', 'text/markdown;charset=utf-8')}>下载 Markdown</button><button className="btn" disabled={!report || !ready} onClick={() => downloadText(JSON.stringify(report, null, 2), 'bundle-assumptions.json', 'application/json')}>导出 JSON</button></div></details>
      </section>
    </div>
    <StrategyBench bundle={picked} assumptions={s} source={{ kind: isManual ? 'manual' : 'builtin', label: sourceLabel }} valid={!!sim && ready} onLoad={loadSnapshot} />
    {sim && <SensitivityMap key={`${source}-${picked.key}-${picked.items.join('|')}`} bundle={picked} assumptions={s} onApply={point => { set(p => ({ ...p, discount: point.discount, adoption: setAdoption(p.adoption, 'neutral', point.adoption) })); setFeedback(`已应用折扣 ${pct(point.discount)}、中档采纳 ${pct(point.adoption)}；低／高档随之保持递增。已保留方案不变。`); }} />}
    {!isManual && !error && <details className="builtin-comparison"><summary>从合成订单里比较其他组合</summary><p className="small">最多三个组合，排序按合成覆盖量 × 每单增量。各组合有重叠，不能相加。上方方案表按100单统一比较，与此表覆盖量排序不同。</p><div className="compare-picks">{bundles.map(b => <label key={b.key}><input type="checkbox" checked={s.compareKeys.includes(b.key)} disabled={!s.compareKeys.includes(b.key) && s.compareKeys.length >= 3} onChange={() => set(p => ({ ...p, compareKeys: p.compareKeys.includes(b.key) ? p.compareKeys.filter(k => k !== b.key) : [...p.compareKeys, b.key] }))} />{b.items.join(' + ')}</label>)}</div><div className="card tbl-scroll" role="region" aria-label="组合毛利比较" tabIndex={0}><table className="tbl"><thead><tr><th>组合</th><th>合成覆盖量</th><th>Δ毛利 / 100覆盖单</th><th>覆盖量 × Δ毛利 / 单</th><th>平衡采纳率</th></tr></thead><tbody>{compare.map(b => <tr key={b.key}><th>{b.items.join(' + ')}</th><td>{b.matchedCount}</td><td>{yuan(b.scenarios.neutral.marginLift * 100)}</td><td>{yuan(b.expectedValue)}</td><td>{b.breakEven.rate == null ? '不可达' : pct(b.breakEven.rate)}</td></tr>)}</tbody></table></div><p><Link href="/playbook/">用内置假设查看建议 →</Link> · <Link href="/">订单分析与组合发现 →</Link></p></details>}
  </>;
}
