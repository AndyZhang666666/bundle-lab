"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { simulateStats, validateAssumptions } from "@/lib/simulate";
import { setAdoption, downloadText } from "@/lib/scenario";
import { MANUAL_KEY, SOURCE_KEY, initialManual, manualBundle, decodeManual, copyToManual, assumptionReport, assumptionMarkdown } from "@/lib/manual-scenario";
import useScenario from "@/components/use-scenario";
import { ScenarioBars } from "@/components/charts";
const yuan=v=>"¥"+v.toFixed(2),pct=v=>v==null?"不适用":(v*100).toFixed(1)+"%";
function Slider({label,value,onChange,onInvalid}){
 const [draft,setDraft]=useState(String(Math.round(value*10000)/100));
 useEffect(()=>setDraft(String(Math.round(value*10000)/100)),[value]);
 const edit=raw=>{setDraft(raw);const valid=raw.trim()!==''&&Number.isFinite(Number(raw))&&Number(raw)>=0&&Number(raw)<=100;onInvalid(label,!valid);if(valid)onChange(Number(raw)/100);};
 return <label className="field-stack rate-field"><span>{label}</span><div className="rate-value"><input aria-label={label+"数值"} type="number" min="0" max="100" step="0.1" value={draft} onChange={e=>edit(e.target.value)} /><span>%</span></div><input aria-label={label} type="range" min="0" max="1" step="0.01" value={value} onChange={e=>{onInvalid(label,false);onChange(Number(e.target.value));}} /></label>;
}
export default function Simulator({bundles}){
 const builtin=useScenario(bundles),[source,setSource]=useState('builtin'),[manual,setManual]=useState(initialManual),[ready,setReady]=useState(false),[storage,setStorage]=useState(''),[feedback,setFeedback]=useState(''),[invalid,setInvalid]=useState({});
 useEffect(()=>{try{const saved=decodeManual(localStorage.getItem(MANUAL_KEY));if(saved)setManual(saved);if(localStorage.getItem(SOURCE_KEY)==='manual')setSource('manual');}catch{setStorage('自建草稿无法恢复；当前仍可计算和导出。');}setReady(true);},[]);
 useEffect(()=>{if(!ready)return;try{localStorage.setItem(SOURCE_KEY,source);manualBundle(manual);validateAssumptions(manual);localStorage.setItem(MANUAL_KEY,JSON.stringify(manual));setStorage('');}catch{setStorage('输入待补全或本机保存不可用，上一份有效草稿保留；有效输入仍可计算与导出。');}},[manual,source,ready]);
 const isManual=source==='manual',s=isManual?manual:builtin.scenario,set=isManual?setManual:builtin.setScenario;
 const pickedBuiltin=bundles.find(b=>b.key===builtin.scenario.pickKey)||bundles[0];
 const state=useMemo(()=>{try{if(Object.values(invalid).some(Boolean))throw Error('请补全 0–100% 范围内的参数数值');const picked=isManual?manualBundle(manual):pickedBuiltin;return{picked,sim:simulateStats(picked,s),error:null};}catch(e){return{picked:null,sim:null,error:e.message};}},[isManual,manual,pickedBuiltin,s,invalid]);
 const {picked,sim,error}=state,n=sim?.scenarios.neutral,be=sim?.breakEven;
 const report=sim?assumptionReport(picked,s,isManual?(manual.copied?'从演示组合复制的待核实个人假设':'用户自建假设；未经观测验证'):'内置合成订单 + 行为假设'):null;
 const markdown=report?assumptionMarkdown(report):'';
 const changeSource=v=>{setSource(v);setInvalid({});setFeedback('');};
 const onInvalid=(label,bad)=>setInvalid(old=>({...old,[label]:bad}));
 const editItem=(i,k,v)=>setManual(old=>({...old,items:old.items.map((item,j)=>i===j?{...item,[k]:v}:item)}));
 const compare=useMemo(()=>bundles.filter(b=>builtin.scenario.compareKeys.includes(b.key)).map(b=>simulateStats(b,builtin.scenario)).sort((a,b)=>b.expectedValue-a.expectedValue),[bundles,builtin.scenario]);
 return <>
 <div className="source-tabs" role="group" aria-label="算例来源"><button className="btn" aria-pressed={!isManual} onClick={()=>changeSource('builtin')}>内置订单</button><button className="btn" aria-pressed={isManual} onClick={()=>changeSource('manual')}>我的算例</button><span>{isManual?'待核实假设 · 无订单挖掘数据':'合成订单 · 非真实经营记录'}</span></div>
 <p className="small" role="status">{feedback||storage||builtin.notice}</p>
 <div className="grid g2 sim-work">
 <section className="card scenario-input"><div className="section-title"><h2 className="sub">{isManual?'搭一组自己的套餐':'选择演示组合'}</h2><button className="btn" onClick={()=>{setInvalid({});if(isManual)setManual(initialManual());else builtin.reset();}}>恢复本来源默认</button></div>
 {isManual?<>
 <p className="small">{manual.copied?'已复制演示组合，以下每项均为待核实假设。':'初始数值仅供填表参考，请换成你的商品和经营假设。'}这里不计算关联度、挖掘排名或观测样本量。</p>
 <div className="manual-items">{manual.items.map((item,i)=><div className="manual-item" key={i}><label>商品 {i+1}<input aria-label={`商品 ${i+1} 名称`} maxLength={40} value={item.name} onChange={e=>editItem(i,'name',e.target.value)} /></label><label>单价 / 元<input aria-label={`商品 ${i+1} 价格`} type="number" min="0" max="100000" step="0.01" value={item.price} onChange={e=>editItem(i,'price',e.target.value)} /></label>{manual.items.length===3&&<button className="btn" aria-label={`移除商品 ${i+1}`} onClick={()=>setManual(old=>({...old,items:old.items.filter((_,j)=>i!==j)}))}>移除</button>}</div>)}</div>
 {manual.items.length<3&&<button className="btn" onClick={()=>setManual(old=>({...old,items:[...old.items,{name:'商品 C',price:'0'}]}))}>＋ 添加第三件商品</button>}
 <div className="grid g2 manual-population"><label>原本已买齐者占比 / %<input type="number" min="0" max="100" value={manual.fullShare} onChange={e=>setManual(old=>({...old,fullShare:e.target.value}))} /></label><label>未买齐者原有平均消费 / 元<input type="number" min="0" value={manual.incompleteSpend} onChange={e=>setManual(old=>({...old,incompleteSpend:e.target.value}))} /></label></div>
 <p className="small">仅算这组商品的原有消费，排除套餐外商品。已买齐者为100%时，没有未买齐人群。</p>
 </>:<><label className="fld" htmlFor="picked">组合</label><select id="picked" value={s.pickKey} onChange={e=>set(p=>({...p,pickKey:e.target.value}))}>{bundles.map(b=><option key={b.key} value={b.key}>{b.items.join(' + ')}</option>)}</select><p className="small">采纳率只用于原本未买齐的人，既有整套顾客领取折扣单独计算。</p><button className="btn" onClick={()=>{setManual(copyToManual(pickedBuiltin,s));changeSource('manual');setFeedback('已复制商品和当前假设；这不是你的真实经营数据，请逐项核实。');}}>复制为我的算例 →</button></>}
 <div className="assumption-divider" />
 <div className="grid g2"><Slider label="套餐折扣率" value={s.discount} onInvalid={onInvalid} onChange={v=>set(p=>({...p,discount:v}))}/><Slider label="食材成本率" value={s.costRatio} onInvalid={onInvalid} onChange={v=>set(p=>({...p,costRatio:v}))}/></div>
 <Slider label="既有整套顾客领折扣率" value={s.existingRedemption} onInvalid={onInvalid} onChange={v=>set(p=>({...p,existingRedemption:v}))}/>
 <div className="grid g3">{[['conservative','低档采纳率'],['neutral','中档采纳率'],['optimistic','高档采纳率']].map(([k,label])=><Slider key={source+k} label={label} value={s.adoption[k]} onInvalid={onInvalid} onChange={v=>set(p=>({...p,adoption:setAdoption(p.adoption,k,v)}))}/>)}</div>
 </section>
 <section className="card scenario-output" id="scenario-result" aria-live="polite">
 <div className="section-title"><h2 className="sub">增量账本</h2><span className="small">中档假设</span></div>
 <p className="unit-note">每 100 个覆盖订单 · 归一比较单位，不是观测订单数</p>
 {error?<div className="input-error" role="alert"><h3>这组算例还不能计算</h3><p>{error}</p><p>请补全输入，旧结果不作为当前结果展示或导出。</p></div>:<>
 <div className="margin-total"><span>增量毛利</span><strong className="tnum" data-negative={n.marginLift<0}>{yuan(n.marginLift*100)}</strong><small>{n.marginLift>0?'条件下为正，尚需验证':n.marginLift<0?'新增贡献未抵消让利或采纳本身损失':'当前收支相抵'}</small></div>
 <div className="ledger"><p><span>新增毛利贡献</span><b>{yuan(n.addedMargin*100)}</b></p><p><span>既有顾客让利损失</span><b>{yuan(n.existingLoss*100)}</b></p><p className="ledger-balance"><span>平衡采纳率</span><b>{be.rate==null?'不可达':pct(be.rate)}</b></p></div>
 <p className="small">{be.reason||'平衡点仅在当前成本、人群与领券假设下成立。'}毛利未扣除履约、库存与运营成本。</p>
 <ScenarioBars data={['conservative','neutral','optimistic'].map((k,i)=>({name:['低档','中档','高档'][i]+' '+pct(s.adoption[k]),value:sim.scenarios[k].marginLift*100}))} fmt="yuan2" height={190}/>
 <details className="math-detail"><summary>核对人群与计算依据</summary><p>原价 {yuan(sim.listPrice)} → 套餐价 {yuan(sim.bundleP)}；原本已买齐 {pct(picked.hitRate)}。{picked.hitRate===1?"没有未买齐者，原有平均消费不适用。":<>未买齐者原有平均消费 {yuan(n.incompleteSpend)}。</>}</p><pre>新增毛利 − 既有顾客让利 = 增量毛利{'\n'}{yuan(n.addedMargin*100)} − {yuan(n.existingLoss*100)} = {yuan(n.marginLift*100)}</pre><p className="small">采用既有 two-population 模型；未买齐者基线平均消费先换算为覆盖人群均值后进入同一计算函数。模型不含价格弹性或因果效果。</p>{!isManual&&<p className="small">合成订单原始统计：已买齐 {picked.hitCount} / 覆盖 {picked.matchedCount}。以上账本始终按100单归一。</p>}</details>
 </>}
 <div className="assumption-export"><h3>带走这组假设</h3><p className="small">包括方案、参数、计算结果和待验证条件，可用于讨论与设计实验。</p><div className="scenario-actions"><button className="btn" disabled={!report} onClick={async()=>{try{await navigator.clipboard.writeText(markdown);setFeedback('假设卡已复制。');}catch{setFeedback('浏览器不允许复制，请下载 Markdown。');}}}>复制假设卡</button><button className="btn" disabled={!report} onClick={()=>downloadText(markdown,'套餐假设卡.md','text/markdown;charset=utf-8')}>下载 Markdown</button><button className="btn" disabled={!report} onClick={()=>downloadText(JSON.stringify(report,null,2),'bundle-assumptions.json','application/json')}>导出 JSON</button></div></div>
 </section></div>
 {!isManual&&!error&&<><div className="section-title compare-heading"><h2 className="sec">内置组合比较</h2><Link href="/playbook/">用内置假设查看建议 →</Link></div><p className="small">最多三个组合，排序仍按实际合成覆盖量 × 每单增量。各组合有重叠，不能相加。</p><details className="card"><summary>调整对比清单（{s.compareKeys.length}/3）</summary><div className="compare-picks">{bundles.map(b=><label key={b.key}><input type="checkbox" checked={s.compareKeys.includes(b.key)} disabled={!s.compareKeys.includes(b.key)&&s.compareKeys.length>=3} onChange={()=>set(p=>({...p,compareKeys:p.compareKeys.includes(b.key)?p.compareKeys.filter(k=>k!==b.key):[...p.compareKeys,b.key]}))}/>{b.items.join(' + ')}</label>)}</div></details><div className="card tbl-scroll" role="region" aria-label="组合毛利比较" tabIndex={0}><table className="tbl"><thead><tr><th>组合</th><th>合成覆盖量</th><th>Δ毛利 / 100覆盖单</th><th>覆盖量 × Δ毛利 / 单</th><th>平衡采纳率</th></tr></thead><tbody>{compare.map(b=><tr key={b.key}><th>{b.items.join(' + ')}</th><td>{b.matchedCount}</td><td>{yuan(b.scenarios.neutral.marginLift*100)}</td><td>{yuan(b.expectedValue)}</td><td>{b.breakEven.rate==null?'不可达':pct(b.breakEven.rate)}</td></tr>)}</tbody></table></div><p><Link href="/">查看订单分析与组合发现 →</Link></p></>}
 </>;
}
