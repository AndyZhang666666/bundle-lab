'use client';
import {useEffect,useState} from 'react';
import {useTabDraft} from '@/lib/use-tab-draft';
import {readProtectedDraft,writeProtectedDraft} from '@/lib/draft-guard';
import {PLAN_KEY,MAX_PLANS,emptyPlans,createValidationPlan,createObservation,addObservation,decodePlans,planSignature,validationPlanMarkdown,observationComparisonText} from '@/lib/validation-plans';
import {downloadText} from '@/lib/scenario';

const FIELDS={title:'',baselinePeriod:'',audience:'',allocation:'',duration:'',primaryMetric:'覆盖订单口径的增量毛利；需明确两组成本口径',guardrails:'退款、履约异常、既有顾客让利和跨订单蚕食'};
const OBS={planFor:'',treatmentCovered:'',treatmentIncomplete:'',treatmentCompleted:'',treatmentFullRedeemed:'',controlCovered:'',controlIncomplete:'',controlCompleted:'',controlFullRedeemed:'',costSource:'',note:''};
const FIELD_LABELS=[['title','计划名称（可选）'],['baselinePeriod','基线期间'],['audience','试验对象与覆盖口径'],['allocation','分流与对照方式'],['duration','观察时长'],['primaryMetric','主要指标'],['guardrails','护栏与停止条件']];
const COUNT_LABELS=[['Covered','覆盖人数'],['Incomplete','原本未买齐人数'],['Completed','补齐人数'],['FullRedeemed','原本已买齐且领折扣人数']];
const GROUPS=[['treatment','试验组'],['control','对照组']];
const pct=v=>v==null?'未知 / 分母为0':`${(v*100).toFixed(1)}%`;

export default function ValidationPlan({bundle,assumptions,source,valid,onPlansChange,onApplyObservation}){
 const [state,setState]=useState(emptyPlans),[ready,setReady]=useState(false),[locked,setLocked]=useState(false),[notice,setNotice]=useState('');
 const [copyPreview,setCopyPreview]=useState(null),[removeId,setRemoveId]=useState(null);
 const [fields,setFields,fieldStatus]=useTabDraft('validation-fields',FIELDS);
 const [observation,setObservation,observationStatus]=useTabDraft('validation-observation-v2',OBS);
 useEffect(()=>{
  const loaded=readProtectedDraft(()=>globalThis.localStorage,PLAN_KEY,decodePlans,emptyPlans);
  setState(loaded.value);setLocked(loaded.writeLocked);setReady(true);
  if(loaded.writeLocked)setNotice('计划记录无法恢复，旧值未覆盖；仍可创建内存计划和导出。');
 },[]);
 useEffect(()=>{if(ready)onPlansChange(state.plans);},[state,ready,onPlansChange]);
 function persist(next,message){
  setState(next);
  const saved=writeProtectedDraft(()=>globalThis.localStorage,PLAN_KEY,next,decodePlans,locked);
  setNotice(saved.saved?message:message+' 尚未写入本机；旧值未覆盖，关闭前请导出。');
 }
 const selected=state.plans.find(p=>p.id===state.selectedId)||null;
 const same=selected&&valid&&selected.inputSignature===planSignature(bundle,assumptions);
 const observationMismatch=selected&&observation.planFor&&observation.planFor!==selected.id;
 const last=selected?.observations.at(-1);
 const canApply=last&&(last.treatment.adoption!=null||last.treatment.redemption!=null);
 const previewCurrent=copyPreview&&selected&&copyPreview.planId===selected.id&&last?.id===copyPreview.observationId;
 function editObservation(key,value){setObservation(old=>({...old,[key]:value,planFor:old.planFor||selected.id}));}
 function save(){
  try{
   if(!valid)throw Error('先完成有效输入');
   if(state.plans.length>=MAX_PLANS)throw Error('最多保留10份计划，请先导出并移除一份本机计划');
   const plan=createValidationPlan(bundle,assumptions,source,{...fields,title:fields.title.trim()||bundle.items.join('＋')+'试行'});
   persist({...state,plans:[...state.plans,plan],selectedId:plan.id},'已冻结当前输入与验证计划；继续调参数不会改它。');setCopyPreview(null);
  }catch(error){setNotice(error.message);}
 }
 function saveObservation(){
  try{
   if(!selected)throw Error('请先选择一份冻结计划');
   if(observationMismatch)throw Error('先确认是否将这份观察草稿用于当前计划');
   const input={costSource:observation.costSource,note:observation.note};
   for(const group of ['treatment','control'])input[group]=Object.fromEntries(COUNT_LABELS.map(([key])=>[key[0].toLowerCase()+key.slice(1),observation[group+key]]));
   const entry=createObservation(input),plan=addObservation(selected,entry);
   persist({...state,plans:state.plans.map(p=>p.id===plan.id?plan:p)},'观察已追加到这份冻结计划。未改原方案、原计划或当前假设。');setCopyPreview(null);
  }catch(error){setNotice(error.message);}
 }
 function removeSelected(){
  const remaining=state.plans.filter(p=>p.id!==selected.id);
  persist({...state,plans:remaining,selectedId:remaining[0]?.id||null},'已移除这份本机计划；已保存经营方案保持不变。');setRemoveId(null);setCopyPreview(null);
 }
 return <section className="validation-workbench" aria-labelledby="validation-plan-title">
  <div className="section-title"><div><h2 id="validation-plan-title">下一步，先验证哪个假设？</h2><p>把选择变成一份可执行的小流量计划。参数冻结、观察追加，尚未采集的数据就留空。</p></div><span className="unit-stamp">{state.plans.length} / {MAX_PLANS} 份计划</span></div>
  <details className="plan-editor"><summary>为当前输入写一份验证计划</summary>
   <div className="plan-fields">{FIELD_LABELS.map(([key,label])=><label key={key}>{label}<textarea aria-label={label} rows={key==='allocation'||key==='guardrails'?2:1} value={fields[key]} maxLength={key==='title'?80:600} disabled={!fieldStatus.ready} onChange={e=>setFields(old=>({...old,[key]:e.target.value}))}/></label>)}</div>
   <p className="small">不自动给样本量或上线门槛；需要结合分流、基线与经营成本制定。{fieldStatus.notice}</p>
   <button className="btn" data-on="true" disabled={!valid||!ready||!fieldStatus.ready} onClick={save}>冻结当前输入与计划</button>
  </details>
  <p role="status" className="plan-notice">{notice||'计划和记录只留当前浏览器；用户录入不等于已审计实验。'}</p>
  {locked&&<button className="text-action" onClick={()=>{setLocked(false);const saved=writeProtectedDraft(()=>globalThis.localStorage,PLAN_KEY,state,decodePlans,false);setNotice(saved.saved?'已按你的选择用当前计划替换旧值并恢复保存。':'当前计划仍未写入本机，请导出。');}}>用当前计划替换旧值并恢复保存</button>}
  {state.plans.length>0&&<>
   <label className="plan-select">查看已保存计划<select value={state.selectedId||''} onChange={e=>{persist({...state,selectedId:e.target.value},'已切换冻结计划；观察草稿不会自动归到另一份计划。');setCopyPreview(null);setRemoveId(null);}}><option value="" disabled>选择计划</option>{state.plans.map(p=><option key={p.id} value={p.id}>{p.fields.title} · {p.createdAt.slice(0,10)}</option>)}</select></label>
   {selected&&<div className="frozen-plan">
    <h3>{selected.fields.title}</h3><p className="plan-binding">{same?'与当前工作输入一致':'独立冻结计划：当前输入已不同或尚未有效；不会用新参数改写旧计划'}</p>
    <p className="small">{selected.bundle.items.join('＋')} · 折扣{pct(selected.assumptions.discount)} · 中档采纳{pct(selected.assumptions.adoption.neutral)}。{selected.source.label}</p>
    <dl>{FIELD_LABELS.filter(([key])=>key!=='title').map(([key,label])=><div key={key}><dt>{label}</dt><dd>{selected.fields[key]}</dd></div>)}</dl>
    <p className="small">{selected.diagnosis.text}</p>
    <div className="plan-actions"><button className="btn" onClick={()=>downloadText(validationPlanMarkdown(selected),'套餐验证计划.md','text/markdown;charset=utf-8')}>下载计划与观察</button><button className="btn" onClick={()=>downloadText(JSON.stringify(selected,null,2),'bundle-validation-plan.json','application/json')}>导出计划JSON</button><button className="text-action" onClick={()=>setRemoveId(selected.id)}>移除本机计划</button></div>
    {removeId===selected.id&&<div className="plan-impact" role="group" aria-label="确认移除计划"><p>将移除「{selected.fields.title}」和它的{selected.observations.length}次观察。请先导出归档；经营方案不会一起移除。</p><button className="btn" onClick={removeSelected}>确认移除计划及观察</button><button className="text-action" onClick={()=>setRemoveId(null)}>保留计划</button></div>}
    <details className="observation-editor"><summary>追加一次试验／对照观察</summary><p>记录人数和分母，而非只填“提升了多少”。可留未知；同一人群与期间由你核实。保存会追加记录，不覆盖历史。</p>
     {observationMismatch&&<div className="plan-impact"><p>这份草稿属于另一份计划，不会直接写入「{selected.fields.title}」。核对对象与期间后再决定。</p><button className="btn" onClick={()=>setObservation(old=>({...old,planFor:selected.id}))}>将这份观察草稿用于当前计划</button></div>}
     <div className="observation-groups">{GROUPS.map(([prefix,label])=><fieldset key={prefix}><legend>{label}</legend>{COUNT_LABELS.map(([key,name])=><label key={key}>{name}<input type="number" aria-label={`${label}${name}`} min="0" max="1000000000" step="1" placeholder="未知可留空" value={observation[prefix+key]} disabled={!observationStatus.ready} onChange={e=>editObservation(prefix+key,e.target.value)}/></label>)}</fieldset>)}</div>
     <label>成本来源<textarea aria-label="观察成本来源" disabled={!observationStatus.ready} rows={2} maxLength={600} value={observation.costSource} onChange={e=>editObservation('costSource',e.target.value)}/></label>
     <label>观察期间、异常和可比性说明<textarea aria-label="观察说明" disabled={!observationStatus.ready} rows={2} maxLength={600} value={observation.note} onChange={e=>editObservation('note',e.target.value)}/></label>
     <p className="small">{observationStatus.notice}</p><button className="btn" disabled={!observationStatus.ready||!!observationMismatch} onClick={saveObservation}>追加保存这次观察</button>
    </details>
    {!selected.observations.length?<p className="empty-observation">尚无观察结果。计划中的采纳与成本仍是待验证假设。</p>:<div className="observation-history">
     <h4>已记录 {selected.observations.length} 次观察</h4>
     {selected.observations.map((entry,index)=><details key={entry.id} open={index===selected.observations.length-1}><summary>第{index+1}次 · {entry.at.slice(0,16).replace('T',' ')}</summary><p>{entry.status}</p>{GROUPS.map(([key,label])=><div key={key}><p><b>{label}</b>：覆盖{entry[key].covered??'未填'}，原未买齐{entry[key].incomplete??'未填'}，补齐{entry[key].completed??'未填'}，既有领折扣{entry[key].fullRedeemed??'未填'}；补齐率 {pct(entry[key].adoption)}，既有领折扣率 {pct(entry[key].redemption)}。</p><p className="small">{observationComparisonText(entry[key],selected)}</p></div>)}<p>成本来源：{entry.costSource||'未填写，尚不能核实毛利'}。{entry.note}</p></details>)}
     <p className="small">没有显著性、增量因果或全量上线结论。比例仅按本次录入分母描述。</p>
     <button className="btn" disabled={!canApply} onClick={()=>setCopyPreview({planId:selected.id,observationId:last.id})}>预览复制试验组比例为新假设</button>
     {previewCurrent&&<div className="plan-impact" role="group" aria-label="确认采用观察比例"><p>将从「{selected.fields.title}」冻结的{selected.bundle.items.join('＋')}创建新手工输入，补齐率{pct(last.treatment.adoption??selected.assumptions.adoption.neutral)}、既有领折扣率{pct(last.treatment.redemption??selected.assumptions.existingRedemption)}。未知项保留计划冻结值，低／高档仍保持顺序。</p><p>这会替换“我的算例”当前输入；原CSV基线、冻结计划及已保存方案保持不变。需要保留当前输入时先保存方案。</p><button className="btn" onClick={()=>{onApplyObservation(last,selected);setCopyPreview(null);setNotice('已按冻结计划和试验组已知比例创建新手工输入；请继续核对并另存方案。');}}>采用并替换我的算例输入</button><button className="text-action" onClick={()=>setCopyPreview(null)}>取消，保留当前输入</button></div>}
    </div>}
   </div>}
  </>}
 </section>;
}
