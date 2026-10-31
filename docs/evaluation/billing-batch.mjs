import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
process.env.SQLITE_PATH=':memory:';process.env.DATABASE_URL='';process.env.QUIET='1';
const {db,migrate,id,now,today,addPeriod}=await import('../Subscription-Management-System/backend/db.mjs');
const {runBilling}=await import('../Subscription-Management-System/backend/services.mjs');
await migrate();
const uid=id(),pid=id(),plan=id();
try {
await db('users').insert({id:uid,name:'Batch Customer',email:'batch@test.local',password_hash:'unused',role:'CUSTOMER',created_at:now()});
await db('products').insert({id:pid,name:'Batch Product',sales_price:100,created_at:now(),active:true});
await db('plans').insert({id:plan,name:'Batch Monthly',product_id:pid,price:100,billing_frequency:'monthly',flags:JSON.stringify({auto_close_on_end:true}),created_at:now(),active:true});
for(let n=0;n<500;n+=100)await db('subscriptions').insert(Array.from({length:100},(_,i)=>({id:id(),number:'BATCH-'+(n+i),customer_id:uid,plan_id:plan,status:'Active',start_date:today(),expiry_date:addPeriod(today(),'yearly'),next_billing_date:today(),payment_terms:14,lines:JSON.stringify([{product_id:pid,name:'Batch Product',quantity:1,unit_price:100}]),created_at:now()})));
const start=performance.now();const runs=await Promise.all([runBilling('jury-A'),runBilling('jury-B')]);const elapsed=performance.now()-start;
const count=Number((await db('invoices').count('* as n').first()).n);assert.equal(count,500);assert.equal(runs.reduce((a,b)=>a+b.failed,0),0);
const r={database:'isolated in-memory SQLite, single connection',due_subscriptions:500,concurrent_billing_runs:2,invoice_count:count,failed_subscriptions:0,combined_wall_ms:Math.round(elapsed),runs};
await writeFile('/home/user/evaluation/evidence/billing-batch.json',JSON.stringify(r,null,2));console.log(JSON.stringify(r,null,2));
}finally{await db.destroy();}
