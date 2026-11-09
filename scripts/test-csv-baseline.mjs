import test from 'node:test';import assert from 'node:assert/strict';
import {parseBaselineCSV,csvToManual,countsToShare,decodeCsvDraft} from '../lib/csv-baseline.js';import {manualBundle,initialManual} from '../lib/manual-scenario.js';import {simulateStats} from '../lib/simulate.js';
test('CSV quotes, BOM, line breaks, duplicates and unused fields preserve explicit presence baseline',()=>{
 const p=parseBaselineCSV('\uFEFForder_id,sku,unit_price,qty\r\n1,"饭,套餐",20,2\r\n1,茶,5,1\r\n2,"饭,套餐",20,1\r\n2,"饭,套餐",20,1\r\n3,茶,5,1');assert.equal(p.orders.length,3);assert.equal(p.orders[1].items.length,1);assert.deepEqual(p.unusedColumns,['qty']);
 const d=csvToManual(p,['饭,套餐','茶'],{'饭,套餐':20,茶:5});assert.equal(d.baseline.fullOrders,1);assert.ok(Math.abs(Number(d.fullShare)-100/3)<1e-12);assert.equal(Number(d.incompleteSpend),12.5);const sim=simulateStats(manualBundle(d),d);assert.ok(Math.abs(sim.scenarios.neutral.incompleteSpend-12.5)<1e-10);assert.deepEqual(decodeCsvDraft(JSON.stringify(d)),d);
 assert.equal(parseBaselineCSV('order_id,sku\n1,"上\n下"').products[0].sku,'上\n下');
});
test('CSV rejects malformed data and requires explicit selected prices, never coercing missing values',()=>{
 for(const raw of ['order_id,sku\n1,"bad','order_id,sku\n1,x,3','order_id,sku\n,x','order_id,sku,unit_price\n1,x,-1','sku,sku\nx,y','order_id\n1'])assert.throws(()=>parseBaselineCSV(raw));
 const p=parseBaselineCSV('order_id,sku,unit_price\n1,A,20\n2,A,25\n2,B,8');assert.deepEqual(p.products[0].prices,[20,25]);assert.throws(()=>csvToManual(p,['A','B'],{A:'',B:8}));assert.throws(()=>csvToManual(p,['A'],{A:20}));
 assert.throws(()=>decodeCsvDraft(JSON.stringify({...initialManual(),baseline:{}})));
 assert.throws(()=>parseBaselineCSV('order_id,sku\n'+Array.from({length:101},(_,i)=>`${i},SKU${i}`).join('\n')));
 assert.throws(()=>parseBaselineCSV('x'.repeat(2*1024*1024+1)));
});
test('count-assisted manual baseline validates its denominator',()=>{assert.equal(countsToShare('200','40'),20);for(const v of [['0','0'],['100','101'],['10',''],['2.5','1'],['10','-1']])assert.throws(()=>countsToShare(...v));});
test('reference-price distribution and imported metadata survive exports without becoming a sample size',()=>{
 const p=parseBaselineCSV('order_id,sku,unit_price\n1,A,20\n1,A,20\n1,B,8\n2,A,25\n3,B,\n4,other,1');
 assert.deepEqual(p.products[0].priceCounts,[{price:20,rows:2},{price:25,rows:1}]);assert.equal(p.products.find(x=>x.sku==='B').missingPrices,1);
 const d=csvToManual(p,['A','B'],{A:22,B:8}),b=manualBundle(d);assert.equal(d.baseline.totalOrders,4);assert.equal(d.baseline.coveredOrders,3);assert.equal(b.matchedCount,100);
 for(const change of [{fullShare:'75'},{items:[{name:'A',price:'23'},{name:'B',price:'8'}]},{baseline:{...d.baseline,rowCount:1}},{baseline:{...d.baseline,unit:'paid amount'}}])assert.throws(()=>decodeCsvDraft(JSON.stringify({...d,...change})));
 assert.throws(()=>countsToShare('9007199254740993','1'));assert.throws(()=>countsToShare('1000000001','1'));
 assert.throws(()=>parseBaselineCSV('order_id,sku\n'+Array.from({length:10001},(_,i)=>`${i},A`).join('\n')));
});
