import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {simulateStats,MODEL_VERSION} from '../lib/simulate.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const url=process.env.TEST_URL||'http://127.0.0.1:8928/bundle-lab/';
const evidence=process.env.EVIDENCE_DIR||'docs/assets/task-loop-20261111';
await fs.mkdir(evidence,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const checks=[],errors=[];
const widths=process.env.REVIEW_WIDTHS?process.env.REVIEW_WIDTHS.split(',').map(Number):[1280,768,390];
const keys={scenario:'bundle-lab:scenario:v2',manual:'bundle-lab:manual:v1',csv:'bundle-lab:csv-baseline:v1',strategies:'bundle-lab:strategies:v1',plans:'bundle-lab:validation-plans:v1'};
async function open(p,selector){const item=p.locator(selector).first(); const ancestors=await item.evaluate(e=>{const result=[];for(let p=e.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS'&&!p.open)result.unshift(p.className);return result;});for(const name of ancestors){const parent=p.locator('details.'+name.trim().split(/\s+/).join('.')).first();if(!await parent.evaluate(e=>e.open))await parent.locator(':scope > summary').click();}if(!await item.evaluate(e=>e.open))await item.locator(':scope > summary').click();}
async function stores(p){return p.evaluate(()=>({local:{...localStorage},session:{...sessionStorage}}));}
async function shot(p,selector,file){await p.evaluate(()=>scrollTo(0,0));const box=await p.locator(selector).boundingBox();await p.screenshot({path:path.join(evidence,file),fullPage:true,clip:box});}
async function stored(p,key){return p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);}
async function choose(p,discount,adoption){await p.getByRole('button',{name:new RegExp(`^折扣 ${discount}%，采纳 ${adoption}%，`)}).click();}
async function download(p,name,file){const pending=p.waitForEvent('download');await p.getByRole('button',{name,exact:true}).click();const d=await pending;await d.saveAs(path.join(evidence,file));return fs.readFile(path.join(evidence,file),'utf8');}
async function ready(p){const input=p.getByLabel('给当前输入命名',{exact:true});await input.waitFor({state:'visible'});for(let i=0;i<120 && await input.isDisabled();i++)await p.waitForTimeout(250);if(await input.isDisabled()){console.log('Readiness failure',await p.locator('.strategy-notice').innerText(),await p.locator('.scenario-feedback').innerText(),await stores(p));await p.screenshot({path:path.join(evidence,'readiness-failure.png'),fullPage:true});}assert.equal(await input.isEnabled(),true);await open(p,'.targeting-disclosure');}
try{
 for(const width of widths){console.log('Checking width',width);
  const context=await browser.newContext({viewport:{width,height:960},acceptDownloads:true,reducedMotion:'reduce'}),p=await context.newPage();p.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  await p.goto(url+'simulate/');await p.waitForLoadState('networkidle');await ready(p);
  assert.match(await p.locator('.margin-total').innerText(),/-49.51/);
  for(const [name,value,margin] of [['人工发券',50,'-1.70'],['结账加购',15,'31.76'],['公开菜单',100,'-49.51']]){
   const button=p.getByRole('button',{name:new RegExp(`^${name} `)});await button.focus();await p.keyboard.press('Space');
   assert.equal(await button.getAttribute('aria-pressed'),'true');assert.equal(await p.getByRole('spinbutton',{name:'既有整套顾客领折扣率数值',exact:true}).inputValue(),String(value));assert.match(await p.locator('.margin-total').innerText(),new RegExp(margin.replace('.','\\.')));
   assert.equal((await stored(p,keys.scenario)).adoption.neutral,.12);
  }
  const custom=p.getByRole('spinbutton',{name:'既有整套顾客领折扣率数值',exact:true});await custom.fill('37');assert.match(await p.locator('.targeting-current').innerText(),/自定义 37.0%/);
  await p.getByRole('radio',{name:'我的算例',exact:true}).check();assert.equal(await custom.inputValue(),'100');await p.getByRole('button',{name:/^人工发券 /}).click();await p.getByRole('radio',{name:'内置订单',exact:true}).check();assert.equal(await custom.inputValue(),'37');
  await p.getByRole('button',{name:/^结账加购 /}).click();
  await p.getByLabel('给当前输入命名',{exact:true}).fill('未提交名称，直接存时保留');
  const before=await stores(p);await choose(p,5,40);assert.equal(await p.getByRole('button',{name:'直接存为对比方案（A）',exact:true}).isEnabled(),true);
  await p.getByRole('button',{name:'取消预演',exact:true}).click();assert.deepEqual(await stores(p),before);
  const saved=[];
  for(const [slot,d,a] of [['A',5,40],['B',10,60],['C',15,100]]){
   await choose(p,d,a);await p.getByRole('button',{name:`直接存为对比方案（${slot}）`,exact:true}).click();
   const state=await stored(p,keys.strategies),s=state.snapshots.at(-1);assert.equal(s.assumptions.discount,d/100);assert.equal(s.assumptions.adoption.neutral,a/100);assert.equal(s.assumptions.existingRedemption,.15);assert.equal(s.modelVersion,MODEL_VERSION);
   for(let i=0;i<saved.length;i++)assert.deepEqual(state.snapshots[i],saved[i]);saved.push(s);
   const after=await stores(p);delete after.local[keys.strategies];assert.deepEqual(after,before);
   assert.equal(await p.getByLabel('给当前输入命名',{exact:true}).inputValue(),'未提交名称，直接存时保留');
  }
  assert.equal(await p.getByRole('button',{name:'对比方案已满（3/3）',exact:true}).isDisabled(),true);assert.match(await p.locator('.preview-save-help').innerText(),/移除一份方案/);
  const compare=JSON.parse(await download(p,'导出比较 JSON',`comparison-${width}.json`));assert.deepEqual(compare.snapshots.map(s=>s.assumptions),saved.map(s=>s.assumptions));
  const md=await download(p,'下载比较 Markdown',`comparison-${width}.md`);assert.match(md,/方案 A/);assert.match(md,/既有顾客领折扣：15.0%/);
  await shot(p,'#sensitivity-map',`matrix-full-${width}.png`);
  await open(p,'.plan-editor');for(const label of ['基线期间','试验对象与覆盖口径','分流与对照方式','观察时长'])await p.getByLabel(label,{exact:true}).fill('合成验收记录，非真实经营观察');
  await p.getByRole('button',{name:'冻结当前输入与计划',exact:true}).click();await p.locator('.frozen-plan').waitFor();
  const frozen=(await stored(p,keys.plans)).plans[0],threshold=simulateStats(frozen.bundle,frozen.assumptions).breakEven.rate;
  await open(p,'.population-settings');await p.getByRole('spinbutton',{name:'食材成本率数值',exact:true}).fill('80');
  assert.equal((await stored(p,keys.plans)).plans[0].assumptions.costRatio,.4);assert.equal((await stored(p,keys.scenario)).costRatio,.8);
  await open(p,'.observation-editor');
  for(const [label,value] of [['试验组覆盖人数','100'],['试验组原本未买齐人数','80'],['试验组补齐人数','0'],['试验组原本已买齐且领折扣人数','3'],['对照组覆盖人数','0'],['对照组原本未买齐人数','0'],['对照组补齐人数','0'],['对照组原本已买齐且领折扣人数','0']])await p.getByRole('spinbutton',{name:label,exact:true}).fill(value);
  await p.getByRole('button',{name:'追加保存这次观察',exact:true}).click();await p.getByRole('heading',{name:'已记录 1 次观察',exact:true}).waitFor();
  assert.match(await p.locator('.observation-boundary[data-state=below]').innerText(),new RegExp(`尚差${(threshold*100).toFixed(1)}个百分点`));assert.equal(await p.locator('.observation-boundary[data-state=unknown]').count(),1);
  await p.getByRole('spinbutton',{name:'试验组补齐人数',exact:true}).fill('8');await p.getByRole('button',{name:'追加保存这次观察',exact:true}).click();await p.getByRole('heading',{name:'已记录 2 次观察',exact:true}).waitFor();assert.equal(await p.locator('.observation-boundary[data-state=crossed]').count(),1);
  const planReport=JSON.parse(await download(p,'导出计划JSON',`plan-${width}.json`));assert.equal(planReport.frozenBreakEven.rate,threshold);assert.equal(planReport.observations[0].boundaryChecks.treatment.state,'below');assert.equal(planReport.observations[1].boundaryChecks.treatment.state,'crossed');assert.equal(planReport.observations[1].boundaryChecks.control.state,'unknown');
  const planMd=await download(p,'下载计划与观察',`plan-${width}.md`);assert.match(planMd,/尚差/);assert.match(planMd,/不代表因果提升、统计显著或上线许可/);
  await shot(p,'.frozen-plan',`frozen-observations-${width}.png`);
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`no page overflow at ${width}`);
  if(width===1280){await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:path.join(evidence,'workspace-1280.png')});}
  await p.reload();await ready(p);assert.equal((await stored(p,keys.strategies)).snapshots.length,3);assert.equal(await p.getByLabel('给当前输入命名',{exact:true}).inputValue(),'未提交名称，直接存时保留');assert.equal(await p.locator('.observation-boundary[data-state=crossed]').count(),1);assert.match(await p.locator('.plan-binding').innerText(),/独立冻结计划/);
  assert.equal(await p.locator('.sensitivity-table button').first().evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
  checks.push(`${width}: keyboard presets/custom/source switching; cancel and exact direct A/B/C saves preserve drafts; capacity; real Markdown/JSON downloads; frozen below/above/zero denominator with live edits; reload; reduced motion; no overflow`);
  await context.close();
 }
 // Separate source path: upload real CSV through the UI; preset and direct-save retain its metadata.
 const context=await browser.newContext({viewport:{width:1280,height:960},acceptDownloads:true}),p=await context.newPage();p.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});await p.goto(url+'simulate/');await ready(p);await open(p,'.csv-import');
 await p.locator('input[type=file]').setInputFiles({name:'synthetic-baseline.csv',mimeType:'text/csv',buffer:Buffer.from('order_id,sku,unit_price\n1,A,20\n1,B,8\n2,A,20\n3,B,8')});
 await p.locator('.csv-product-list').getByRole('checkbox',{name:'A',exact:true}).check();await p.locator('.csv-product-list').getByRole('checkbox',{name:'B',exact:true}).check();
 await p.getByRole('checkbox',{name:/我确认商品、参考价/}).check();await p.getByRole('button',{name:'应用为独立CSV基线',exact:true}).click();await p.waitForFunction(()=>!!localStorage.getItem('bundle-lab:csv-baseline:v1'));
 const original=await stored(p,keys.csv);await p.getByRole('button',{name:/^结账加购 /}).click();assert.deepEqual((await stored(p,keys.csv)).baseline,original.baseline);assert.equal((await stored(p,keys.csv)).provenance,original.provenance);
 await choose(p,5,40);await p.getByRole('button',{name:'直接存为对比方案（A）',exact:true}).click();const snapshot=(await stored(p,keys.strategies)).snapshots[0];assert.equal(snapshot.source.kind,'csv');assert.deepEqual(snapshot.source.baseline,original.baseline);assert.equal(snapshot.assumptions.existingRedemption,.15);assert.equal((await stored(p,keys.csv)).discount,.12);
 await download(p,'导出比较 JSON','comparison-csv.json');checks.push('CSV upload/reference confirmation → preset → exact direct snapshot keeps source counts, prices and provenance; current CSV discount unchanged');await context.close();
 assert.deepEqual(errors,[]);await fs.writeFile(path.join(evidence,'browser-checks.json'),JSON.stringify({url,checks,pageErrors:errors,scope:'Synthetic local Chrome workflows; no model calls or business evidence'},null,2));console.log(`PASS: ${checks.length} workflow groups, ${widths.join('/')}, no page errors`);
}finally{await browser.close();}
