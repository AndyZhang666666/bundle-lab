"use client";

import {useEffect,useRef,useState} from 'react';

const projects=[
  {id:'eval',name:'Eval Lab',description:'核对评分、评语和证据',href:'/llm-output-eval/'},
  {id:'taste',name:'偏爱实验室',description:'比较构图，决定记住什么',href:'/tasteroom/?direction=swiss'},
  {id:'bundle',name:'Bundle Lab',description:'算清新增贡献与既有顾客让利',href:'/bundle-lab/simulate/'},
  {id:'commute',name:'通勤比较器',description:'对照时间、费用与个人条件',href:'/commute-compare/'},
];

export default function DemoUtilities({project,name,steps,about}){
 const dialog=useRef(null),opener=useRef(null),closing=useRef(false);
 const [panel,setPanel]=useState(null),[jumpError,setJumpError]=useState('');
 const owner=`demo-help:${project}`;

 useEffect(()=>{
   function sync(){
     closing.current=false;
     const state=history.state?.demoHelp;
     if(state?.owner===owner&&['nav','guide','about'].includes(state.panel)){
       setPanel(state.panel);if(dialog.current&&!dialog.current.open)dialog.current.showModal();
     }else{if(dialog.current?.open)dialog.current.close();setPanel(null);}
   }
   window.addEventListener('popstate',sync);sync();
   return()=>window.removeEventListener('popstate',sync);
 },[owner]);

 function open(next){
   if(dialog.current?.open||closing.current)return;
   opener.current=document.activeElement;setJumpError('');setPanel(next);
   history.pushState({...history.state,demoHelp:{owner,panel:next}},'',location.href);
   dialog.current?.showModal();
 }
 function close(){
   if(closing.current)return;
   if(dialog.current?.open)dialog.current.close();setPanel(null);
   if(history.state?.demoHelp?.owner===owner){closing.current=true;history.back();}
   opener.current?.focus({preventScroll:true});
 }
 function jump(selector){
   const target=document.querySelector(selector);
   if(!target){setJumpError('这个操作还没有出现在当前页面。先关闭说明，完成前一步后可再次打开引导。');return;}
   let parent=target;
   while(parent){if(parent instanceof HTMLDetailsElement)parent.open=true;parent=parent.parentElement;}
   close();
   requestAnimationFrame(()=>{
     target.classList.add('demo-jump-target');
     if(!target.matches('a,button,input,select,textarea,summary,[tabindex]'))target.tabIndex=-1;
     target.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
     target.focus({preventScroll:true});
     target.addEventListener('blur',()=>target.classList.remove('demo-jump-target'),{once:true});
   });
 }

 return <>
   <nav className="demo-tools" aria-label="作品与使用帮助">
     <a href="/#selected">← 返回作品集</a><span className="demo-tools-spacer"/>
     <button type="button" onClick={()=>open('nav')}>其他 Demo</button>
     <button type="button" onClick={()=>open('guide')}>三步体验</button>
     <button type="button" onClick={()=>open('about')}>为什么这样做</button>
   </nav>
   <dialog ref={dialog} className="demo-help" aria-labelledby="demo-help-title" onCancel={e=>{e.preventDefault();close();}} onClick={e=>{if(e.target!==e.currentTarget)return;const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}}>
     <div className="demo-help-heading"><div><p>{name}</p><h2 id="demo-help-title">{panel==='nav'?'继续看一件作品':panel==='guide'?'完成一次自己的判断':'为什么这样做'}</h2></div><button type="button" className="demo-help-close" autoFocus onClick={close} aria-label="关闭使用帮助">关闭 ×</button></div>
     {panel==='nav'&&<nav className="demo-project-links" aria-label="四个主推 Demo">{projects.map(p=>p.id===project?<div key={p.id} aria-current="page"><strong>{p.name}</strong><span>当前作品 · {p.description}</span></div>:<a key={p.id} href={p.href}><strong>{p.name} ↗</strong><span>{p.description}</span></a>)}</nav>}
     {panel==='guide'&&<><p className="demo-help-intro">不必按顺序完成。定位只移动视线，不会替换内容、提交选择或写入记忆。</p><ol className="demo-guide">{steps.map((step,i)=><li key={step.title}><span>{String(i+1).padStart(2,'0')}</span><div><h3>{step.title}</h3><p>{step.description}</p>{step.target&&<button type="button" onClick={()=>jump(step.target)}>定位这个操作 →</button>}{step.href&&<a href={step.href} target="_blank" rel="noopener noreferrer">{step.target?'在新标签打开这个工作区 ↗':'打开这一步 ↗（新标签）'}</a>}</div></li>)}</ol><p role="status" className="demo-help-error">{jumpError}</p></>}
     {panel==='about'&&<div className="demo-about">{[['解决什么问题',about.problem],['产品取舍',about.choices],['当前边界',about.boundary],['投入真实使用前还需验证',about.validation]].map(([heading,body])=><section key={heading}><h3>{heading}</h3><p>{body}</p></section>)}</div>}
     <p className="demo-help-foot">Esc 或浏览器返回均可关闭；原工作留在当前页面。</p>
   </dialog>
 </>;
}
