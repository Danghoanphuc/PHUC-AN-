import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { baselineSql } from './baseline.mjs';
import { applyTestMigrations } from './migrations.mjs';

import {ids,catalogueSeed,memberSeed} from './fixtures.mjs';
let db;
before(async()=>{
 db=await PGlite.create(); await db.exec(baselineSql()); await db.exec(catalogueSeed);
 await applyTestMigrations(db);
 await db.exec(memberSeed);
});
after(async()=>{await db?.close();});
scenario('staff POS posts full paid sale, own wallet and note atomically and idempotently',async()=>{
 await as('staff');const p={customer_id:ids.customer,expected_total:75000,note:'POS test note',lines:[{product_id:ids.donut,order_qty:1},{product_id:ids.kem,order_qty:1}]};
 const id=await rpc('post_pos_sale',p,'pos-fixed-key');assert.equal(await rpc('post_pos_sale',p,'pos-fixed-key'),id);
 await admin();const s=(await q('select * from public.sales where id=$1',[id]))[0];assert.equal(Number(s.net_amount),75000);assert.equal(Number(s.collected_amount),75000);assert.equal(s.note,'POS test note');
 assert.equal((await q('select count(*) n from public.sales'))[0].n,1);const cash=(await q('select * from public.cash_movements where sale_id=$1',[id]))[0];assert.equal(Number(cash.amount),75000);assert.equal(cash.created_by,ids.staff);
 assert.equal((await q('select status from public.customer_orders where id=$1',[s.customer_order_id]))[0].status,'completed');
});
scenario('POS cannot override price/credit, escape scope or call the internal posting bridge',async()=>{
 await as('staff');const p={customer_id:ids.customer,expected_total:40000,lines:[{product_id:ids.donut,order_qty:1}]};
 await fails(()=>rpc('post_pos_sale',{...p,customer_id:ids.otherCustomer}),/outside assigned scope/);
 for(const extra of [{discount_pct:50},{collected_amount:0},{account_id:ids.account}])await fails(()=>rpc('post_pos_sale',{...p,...extra}),/server controlled/);
 await fails(()=>q("select private.post_delivery_as('{}','evil-pos-key',true)"),/permission denied/);
 await fails(()=>rpc('post_pos_sale',{...p,expected_total:1}),/total changed/);
 await admin();assert.equal((await q('select count(*) n from public.customer_orders'))[0].n,0);assert.equal((await q('select count(*) n from private.pos_wallets'))[0].n,0);
});
scenario('POS is denied to anonymous, nonmember and inactive operators',async()=>{
 const p={customer_id:ids.customer,expected_total:40000,lines:[{product_id:ids.donut,order_qty:1}]};
 await as('outsider');await fails(()=>rpc('post_pos_sale',p),/Not authorized/);
 await admin();await q('update public.app_members set active=false where user_id=$1',[ids.staff]);await as('staff');await fails(()=>rpc('post_pos_sale',p),/Not authorized/);
 await admin();await db.exec('set role anon');await fails(()=>rpc('post_pos_sale',p),/permission denied/);
});
scenario('POS customer creation is route scoped, defaults to no credit, and is retry safe',async()=>{
 await as('staff');const p={name:'New POS partner',route_id:ids.route};const id=await rpc('create_pos_customer',p,'new-pos-customer-key');assert.equal(await rpc('create_pos_customer',p,'new-pos-customer-key'),id);
 const c=(await q('select * from public.customers where id=$1',[id]))[0];assert.equal(c.assigned_to,ids.staff);assert.equal(c.customer_type,'Bạn hàng');assert.equal(Number(c.credit_limit),0);
 await fails(()=>rpc('create_pos_customer',{...p,route_id:ids.otherRoute}),/outside assigned scope/);await fails(()=>rpc('create_pos_customer',{...p,credit_limit:1000}),/Restricted customer fields/);
});
scenario('staff POS delivers an existing confirmed order with version checks and no overdelivery',async()=>{
 const o=await order();await as('staff');const p={customer_id:ids.customer,order_id:o.id,version:2,expected_total:20000,lines:[{product_id:ids.donut,order_qty:.5}]};await rpc('post_pos_sale',p);
 await fails(()=>rpc('post_pos_sale',p),/Version conflict/);await fails(()=>rpc('post_pos_sale',{...p,version:3,lines:[{product_id:ids.donut,order_qty:2}]}),/exceeds remaining/);
 await rpc('post_pos_sale',{...p,version:3});
});
const q=async(sql,params=[]) => (await db.query(sql,params)).rows;
async function as(who) {await db.exec('reset role');await q(`select set_config('request.jwt.claim.sub',$1,false)`,[ids[who]??'']);await db.exec('set role authenticated');}
async function admin() {await db.exec('reset role');}
let key=0;
async function rpc(name,payload,requestKey=`test-key-${++key}`) {return (await q(`select public.${name}($1::jsonb,$2::text) id`,[JSON.stringify(payload),requestKey]))[0].id;}
function scenario(name,fn) {test(name,async()=>{await db.exec('begin');try{await as('manager');await fn();}finally{await db.exec('rollback');await admin();}});}
async function fails(fn,pattern) {await db.exec('savepoint expected_failure');try{await assert.rejects(fn,pattern);}finally{await db.exec('rollback to expected_failure');await db.exec('release expected_failure');}}
async function order(product=ids.donut,qty=1) {
 const id=await rpc('save_customer_order',{customer_id:ids.customer,delivery_date:'2026-10-14',lines:[{product_id:product,order_qty:qty}]});
 await rpc('transition_customer_order',{order_id:id,version:1,status:'confirmed'});
 const item=(await q('select * from public.customer_order_items where order_id=$1',[id]))[0];
 return {id,item,version:2};
}
async function sale({product=ids.donut,qty=1,returned=0,collected=0}={}) {
 const o=await order(product,qty);
 const payload={order_id:o.id,version:2,sale_date:'2026-10-14',collected_amount:collected,account_id:ids.account,
 lines:[{order_item_id:o.item.id,delivered_pieces:qty*10,returned_pieces:returned}]};
 const id=await rpc('post_delivery',payload);
 const r=(await q('select * from public.receivables where sale_id=$1',[id]))[0];
 const item=(await q('select * from public.sale_items where sale_id=$1',[id]))[0];
 return {id,r,item,o,payload};
}
async function purchase() {
 const id=await rpc('save_purchase_order',{supplier_id:ids.supplier,expected_date:'2026-10-14',lines:[{
 material_id:ids.material,purchase_unit:'thùng',quantity:2,base_qty_per_unit:20,unit_price:200000}]});
 await rpc('transition_purchase_order',{purchase_order_id:id,version:1,status:'submitted'});
 await rpc('transition_purchase_order',{purchase_order_id:id,version:2,status:'confirmed'});
 const item=(await q('select * from public.purchase_order_items where purchase_order_id=$1',[id]))[0];
 return {id,item,version:3};
}

scenario('staff sees assigned customer only and cannot read salary/cost data',async()=>{
 await as('staff');assert.equal((await q('select * from public.customers')).length,1);
 assert.equal((await q('select * from public.material_prices')).length,0);
 assert.equal((await q('select * from public.employee_compensation_terms')).length,0);
 assert.equal((await q('select * from public.sale_item_costs')).length,0);
 await fails(()=>rpc('save_customer_order',{customer_id:ids.otherCustomer,delivery_date:'2026-10-14',lines:[{product_id:ids.donut,order_qty:1}]}),/outside assigned scope/);
});
scenario('anon has no catalogue or RPC access',async()=>{
 await admin();await db.exec('set role anon');await fails(()=>q('select * from public.products'),/permission denied/);
 await fails(()=>rpc('save_customer_order',{}),/permission denied/);
});
scenario('nonmember and inactive staff are denied, including cached RPC retry',async()=>{
 await as('outsider');await fails(()=>rpc('save_customer_order',{}),/Not authorized/);
 await as('staff');const p={customer_id:ids.customer,delivery_date:'2026-10-14',lines:[{product_id:ids.donut,order_qty:1}]};
 await rpc('save_customer_order',p,'inactive-retry');await admin();await q('update public.app_members set active=false where user_id=$1',[ids.staff]);
 await as('staff');await fails(()=>rpc('save_customer_order',p,'inactive-retry'),/Not authorized/);
});
scenario('staff creates drafts but cannot confirm, override discount, buy, collect, or self-promote',async()=>{
 await as('staff');const id=await rpc('save_customer_order',{customer_id:ids.customer,delivery_date:'2026-10-14',lines:[{product_id:ids.donut,order_qty:1}]});
 await fails(()=>rpc('transition_customer_order',{order_id:id,version:1,status:'confirmed'}),/Not authorized/);
 await fails(()=>rpc('save_customer_order',{customer_id:ids.customer,delivery_date:'2026-10-14',discount_pct:50,lines:[{product_id:ids.donut,order_qty:1}]}),/Not authorized/);
 for(const name of ['save_purchase_order','collect_receivable','manage_member','post_delivery']) await fails(()=>rpc(name,{}),/Not authorized/);
 await fails(()=>q('update public.app_members set role=\'owner\' where user_id=$1',[ids.staff]),/permission denied/);
});
scenario('unit conversion preserves old prices: donut 40k, kem 35k, tieu 15k per bi10',async()=>{
 for(const [product,total] of [[ids.donut,40000],[ids.kem,35000],[ids.tieu,15000]]) {
 const s=await sale({product});assert.equal(Number((await q('select net_amount from public.sales where id=$1',[s.id]))[0].net_amount),total);
 }
});
scenario('missing, nonarray, empty lines, negative quantities and fractional pieces reject',async()=>{
 for(const lines of [undefined,{},[],[{product_id:ids.donut,order_qty:-1}],[{product_id:ids.donut,order_qty:0.01}]])
 await fails(()=>rpc('save_customer_order',{customer_id:ids.customer,delivery_date:'2026-10-14',lines}),/lines|line|quantity/i);
 assert.equal((await q('select * from public.customer_orders')).length,0);
});
scenario('missing retail price, missing wholesale price and inactive product reject',async()=>{
 await fails(()=>order(ids.missing),/No effective selling price/);
 await admin();await q('update public.customers set customer_type=\'Khách lẻ\' where id=$1',[ids.customer]);await as('manager');
 await fails(()=>order(),/No effective selling price/);
 await admin();await q('update public.products set is_active=false where id=$1',[ids.donut]);await as('manager');
 await fails(()=>order(),/Active product required/);
});
scenario('alias groups stay unresolved and confirmation is blocked',async()=>{
 const a=(await q('select public.resolve_order_alias($1,$2) result',[ids.customer,'mixed']))[0].result;
 assert.equal(a.status,'allocation_required');
 const id=await rpc('save_customer_order',{customer_id:ids.customer,delivery_date:'2026-10-14',lines:[{requested_name:'mixed',order_qty:1}]});
 await fails(()=>rpc('transition_customer_order',{order_id:id,version:1,status:'confirmed'}),/Resolve and allocate/);
});
scenario('scoped alias requires explicit binding then takes effect for intended customer',async()=>{
 assert.equal((await q('select public.resolve_order_alias($1,$2) r',[ids.customer,'scoped']))[0].r.status,'unresolved');
 await rpc('bind_order_alias',{customer_id:ids.customer,alias:'scoped',scope:'Test scope'});
 assert.equal((await q('select public.resolve_order_alias($1,$2) r',[ids.customer,'scoped']))[0].r.product_id,ids.kem);
 assert.equal((await q('select public.resolve_order_alias($1,$2) r',[ids.otherCustomer,'scoped']))[0].r.status,'unresolved');
});
scenario('draft idempotency returns same ID; altered payload with same key rejects',async()=>{
 const p={customer_id:ids.customer,delivery_date:'2026-10-14',lines:[{product_id:ids.donut,order_qty:1}]};
 const id=await rpc('save_customer_order',p,'same-order-key');assert.equal(await rpc('save_customer_order',p,'same-order-key'),id);
 await fails(()=>rpc('save_customer_order',{...p,note:'different'},'same-order-key'),/payload conflict/);
 assert.equal((await q('select * from public.customer_orders')).length,1);
});
scenario('optimistic version mismatch rejects stale edits and transitions',async()=>{
 const id=await rpc('save_customer_order',{customer_id:ids.customer,delivery_date:'2026-10-14',lines:[{product_id:ids.donut,order_qty:1}]});
 await fails(()=>rpc('transition_customer_order',{order_id:id,version:9,status:'confirmed'}),/Version conflict/);
});
scenario('initial sale collection posts cash and full receivable atomically',async()=>{
 const s=await sale({collected:10000});assert.equal(Number(s.r.amount),40000);assert.equal(Number(s.r.paid_amount),10000);
 const m=await q('select * from public.cash_movements where sale_id=$1',[s.id]);assert.equal(m.length,1);assert.equal(Number(m[0].amount),10000);
 await fails(()=>rpc('collect_receivable',{receivable_id:s.r.id,account_id:ids.account,amount:30001}),/Invalid collection/);
});
scenario('collection retry, reversal, and duplicate reversal preserve balances',async()=>{
 const s=await sale();const p={receivable_id:s.r.id,account_id:ids.account,amount:40000};
 const mid=await rpc('collect_receivable',p,'same-collection');assert.equal(await rpc('collect_receivable',p,'same-collection'),mid);
 const rev=await rpc('reverse_cash_movement',{movement_id:mid,reason:'Test correction'});
 assert.ok(rev);assert.equal(Number((await q('select collected_amount from public.sales where id=$1',[s.id]))[0].collected_amount),0);
 assert.equal(Number((await q('select balance from public.v_cash_balances where account_id=$1',[ids.account]))[0].balance),0);
 await fails(()=>rpc('reverse_cash_movement',{movement_id:mid,reason:'again'}),/already reversed|cannot support|cannot be fully reversed/i);
});
scenario('return-all at delivery posts zero net without violating sale item constraint',async()=>{
 const s=await sale({returned:10});assert.equal(Number(s.item.qty),0);assert.equal(Number(s.r.amount),0);
 assert.equal((await q('select * from public.returns')).length,1);
});
scenario('late full return refunds paid money and reduces debt to zero',async()=>{
 const s=await sale({collected:40000});const p={sale_item_id:s.item.id,returned_pieces:10,reason:'Damaged',account_id:ids.account,return_date:'2026-10-15'};
 const id=await rpc('return_sale_item',p,'same-return-key');assert.equal(await rpc('return_sale_item',p,'same-return-key'),id);
 const r=(await q('select * from public.receivables where id=$1',[s.r.id]))[0];assert.equal(Number(r.amount),0);assert.equal(Number(r.paid_amount),0);
 assert.equal(Number((await q('select balance from public.v_cash_balances where account_id=$1',[ids.account]))[0].balance),0);
});
scenario('late partial unpaid return reduces balance without cash refund',async()=>{
 const s=await sale({collected:10000});await rpc('return_sale_item',{sale_item_id:s.item.id,returned_pieces:5,reason:'Test',return_date:'2026-10-15'});
 const r=(await q('select * from public.receivables where id=$1',[s.r.id]))[0];assert.equal(Number(r.amount),20000);assert.equal(Number(r.paid_amount),10000);
 assert.equal((await q('select * from public.cash_movements')).length,1);
});
scenario('overreturn, duplicate line, overdelivery and overcollection roll back all writes',async()=>{
 const o=await order();const base={order_id:o.id,version:2,collected_amount:0,lines:[{order_item_id:o.item.id,delivered_pieces:10}]};
 for(const p of [{...base,lines:[{order_item_id:o.item.id,delivered_pieces:10,returned_pieces:11}]},
 {...base,lines:[...base.lines,...base.lines]},{...base,lines:[{order_item_id:o.item.id,delivered_pieces:11}]},
 {...base,collected_amount:40001,account_id:ids.account}]) await fails(()=>rpc('post_delivery',p),/quantity|Duplicate|exceeds/i);
 assert.equal((await q('select * from public.sales')).length,0);assert.equal((await q('select * from public.cash_movements')).length,0);
 assert.equal(Number((await q('select delivered_pieces from public.customer_order_items where id=$1',[o.item.id]))[0].delivered_pieces),0);
});
scenario('partial deliveries advance version and cannot exceed ordered pieces',async()=>{
 const o=await order();const p={order_id:o.id,version:2,lines:[{order_item_id:o.item.id,delivered_pieces:4}]};
 const id=await rpc('post_delivery',p,'partial-delivery');assert.equal(await rpc('post_delivery',p,'partial-delivery'),id);
 assert.equal((await q('select status from public.customer_orders where id=$1',[o.id]))[0].status,'partial');
 await fails(()=>rpc('post_delivery',p),/Version conflict/);
 await rpc('post_delivery',{order_id:o.id,version:3,lines:[{order_item_id:o.item.id,delivered_pieces:6}]});
 assert.equal((await q('select status from public.customer_orders where id=$1',[o.id]))[0].status,'completed');
});
scenario('credit review needs reason and credit limit is enforced',async()=>{
 await admin();await q('update public.customers set credit_policy=\'review\' where id=$1',[ids.customer]);await as('manager');
 const o=await order();const p={order_id:o.id,version:2,lines:[{order_item_id:o.item.id,delivered_pieces:10}]};
 await fails(()=>rpc('post_delivery',p),/approval reason/);
 await rpc('post_delivery',{...p,credit_approval_reason:'Approved test'});
 await admin();await q('update public.customers set credit_policy=\'limited\',credit_limit=50000 where id=$1',[ids.customer]);await as('manager');
 await fails(()=>sale(),/Credit limit exceeded/);
});
scenario('selling price history changes do not change order or posted cost snapshots',async()=>{
 const o=await order();await rpc('set_selling_price',{product_id:ids.donut,price_tier:'wholesale',amount:5000,effective_from:'2026-10-15'});
 const sid=await rpc('post_delivery',{order_id:o.id,version:2,sale_date:'2026-10-14',lines:[{order_item_id:o.item.id,delivered_pieces:10}]});
 assert.equal(Number((await q('select net_amount from public.sales where id=$1',[sid]))[0].net_amount),40000);
 const item=(await q('select id from public.sale_items where sale_id=$1',[sid]))[0];
 const cost=Number((await q('select unit_material_cost_snapshot from public.sale_item_costs where sale_item_id=$1',[item.id]))[0].unit_material_cost_snapshot);
 assert.equal(cost,1000);
 await admin();await q("insert into public.material_prices(material_id,effective_date,package_price,package_qty,package_unit) values($1,'2026-10-16',50000,1,'kg')",[ids.material]);await as('manager');
 assert.equal(Number((await q('select estimated_unit_material_cost from public.v_sale_item_margin where sale_item_id=$1',[item.id]))[0].estimated_unit_material_cost),1000);
 await fails(()=>rpc('set_selling_price',{product_id:ids.donut,price_tier:'wholesale',amount:1,effective_from:'2026-10-15'}),/overlap/);
});
scenario('staff cannot access posted cost through sale lines or margin view',async()=>{
 const s=await sale();await as('staff');assert.equal((await q('select * from public.sale_item_costs')).length,0);
 assert.equal((await q('select estimated_unit_material_cost from public.v_sale_item_margin where sale_item_id=$1',[s.item.id]))[0].estimated_unit_material_cost,null);
 assert.equal('unit_material_cost_snapshot' in (await q('select * from public.sale_items'))[0],false);
});
scenario('purchase draft changes neither stock nor payable; partial receipt posts both once',async()=>{
 const po=await purchase();assert.equal((await q('select * from public.inventory_transactions')).length,0);
 assert.equal((await q('select * from public.supplier_payables')).length,0);
 const p={purchase_order_id:po.id,version:3,received_date:'2026-10-14',due_date:'2026-10-20',lines:[{purchase_order_item_id:po.item.id,quantity:1}]};
 const rid=await rpc('receive_purchase_order',p,'same-receipt');assert.equal(await rpc('receive_purchase_order',p,'same-receipt'),rid);
 assert.equal(Number((await q('select qty from public.inventory_transactions'))[0].qty),20);
 assert.equal(Number((await q('select qty_on_hand from public.v_material_stock where material_id=$1',[ids.material]))[0].qty_on_hand),120);
 assert.equal(Number((await q('select amount from public.supplier_payables'))[0].amount),200000);
 assert.equal((await q('select status from public.purchase_orders where id=$1',[po.id]))[0].status,'partial');
 await fails(()=>rpc('receive_purchase_order',{...p,version:4,lines:[{purchase_order_item_id:po.item.id,quantity:2}]}),/Invalid receipt quantity/);
 await rpc('receive_purchase_order',{...p,version:4});assert.equal((await q('select status from public.purchase_orders where id=$1',[po.id]))[0].status,'completed');
});
scenario('supplier payments and reversal update ledger and payable together',async()=>{
 const po=await purchase();await rpc('receive_purchase_order',{purchase_order_id:po.id,version:3,lines:[{purchase_order_item_id:po.item.id,quantity:1}]});
 const payable=(await q('select * from public.supplier_payables'))[0];
 const mid=await rpc('pay_supplier',{payable_id:payable.id,account_id:ids.account,amount:200000});
 assert.equal(Number((await q('select paid_amount from public.supplier_payables'))[0].paid_amount),200000);
 await fails(()=>rpc('pay_supplier',{payable_id:payable.id,account_id:ids.account,amount:1}),/Invalid supplier payment/);
 await rpc('reverse_cash_movement',{movement_id:mid,reason:'Correction'});assert.equal(Number((await q('select paid_amount from public.supplier_payables'))[0].paid_amount),0);
});
scenario('physical reconciliation resets baseline without deleting ledger',async()=>{
 const po=await purchase();await rpc('receive_purchase_order',{purchase_order_id:po.id,version:3,lines:[{purchase_order_item_id:po.item.id,quantity:1}]});
 await rpc('reconcile_material_stock',{material_id:ids.material,counted_qty:119,reason:'Physical test count'});
 assert.equal(Number((await q('select qty_on_hand from public.v_material_stock where material_id=$1',[ids.material]))[0].qty_on_hand),119);
 assert.equal((await q('select * from public.inventory_transactions')).length,1);
 await rpc('receive_purchase_order',{purchase_order_id:po.id,version:4,lines:[{purchase_order_item_id:po.item.id,quantity:1}]});
 assert.equal(Number((await q('select qty_on_hand from public.v_material_stock where material_id=$1',[ids.material]))[0].qty_on_hand),139);
});
scenario('cash, stock and audit ledger mutations rejected even by administrative SQL',async()=>{
 const s=await sale({collected:10000});await admin();
 await fails(()=>q('update public.cash_movements set amount=1 where sale_id=$1',[s.id]),/append-only/);
 await fails(()=>q('delete from public.cash_movements'),/append-only/);
 await fails(()=>q('truncate public.cash_movements'),/append-only/);
 await fails(()=>q('delete from public.audit_events'),/append-only/);
});
scenario('CRM scope and task reassignment protections',async()=>{
 await as('staff');await q('insert into public.customer_activities(customer_id,kind,body) values($1,\'call\',\'Test followup\')',[ids.customer]);
 await fails(()=>q('insert into public.customer_activities(customer_id,kind,body) values($1,\'call\',\'No access\')',[ids.otherCustomer]),/row-level security/);
 const task=(await q('insert into public.customer_tasks(customer_id,assigned_to,title,due_at) values($1,$2,\'Call\',now()) returning id',[ids.customer,ids.staff]))[0];
 await q('update public.customer_tasks set status=\'done\' where id=$1',[task.id]);
 await fails(()=>q('update public.customer_tasks set title=\'Changed\' where id=$1',[task.id]),/only update task status/);
});
scenario('manager cannot promote members; owner can add membership',async()=>{
 await fails(()=>rpc('manage_member',{user_id:ids.outsider,role:'owner',active:true}),/Owner required/);
 await as('owner');await rpc('manage_member',{user_id:ids.outsider,role:'staff',active:true});
 assert.equal((await q('select role from public.app_members where user_id=$1',[ids.outsider]))[0].role,'staff');
 await fails(()=>rpc('manage_member',{user_id:ids.owner,role:'staff',active:true}),/Cannot demote/);
});
scenario('all public tables use RLS; no anon writes, no public SECURITY DEFINER',async()=>{
 await admin();assert.equal((await q("select relname from pg_class where relnamespace='public'::regnamespace and relkind='r' and not relrowsecurity")).length,0);
 assert.equal((await q("select proname from pg_proc where pronamespace='public'::regnamespace and prosecdef")).length,0);
 assert.equal((await q("select * from information_schema.role_table_grants where table_schema='public' and grantee='anon'")).length,0);
});
scenario('group allocations preserve requested total and reject unauthorized SKUs',async()=>{
 const p={customer_id:ids.customer,delivery_date:'2026-10-14',lines:[{requested_name:'mixed',order_qty:2,
 allocations:[{product_id:ids.donut,order_qty:1},{product_id:ids.kem,order_qty:1}]}]};
 const id=await rpc('save_customer_order',p);assert.equal((await q('select * from public.customer_order_requests where order_id=$1',[id])).length,1);
 assert.equal((await q('select * from public.customer_order_items where order_id=$1',[id])).length,2);
 await rpc('transition_customer_order',{order_id:id,version:1,status:'confirmed'});
 await fails(()=>rpc('save_customer_order',{...p,lines:[{...p.lines[0],order_qty:3}]}),/Allocation total/);
 await fails(()=>rpc('save_customer_order',{...p,lines:[{...p.lines[0],allocations:[{product_id:ids.tieu,order_qty:2}]}]}),/outside alias group/);
});
scenario('non-finite numeric values are rejected without persisted financial or order rows',async()=>{
 await fails(()=>rpc('save_customer_order',{customer_id:ids.customer,delivery_date:'2026-10-14',lines:[{product_id:ids.donut,order_qty:'NaN'}]}),/finite_|constraint/);
 await fails(()=>rpc('set_selling_price',{product_id:ids.donut,price_tier:'wholesale',amount:'NaN',effective_from:'2026-10-15'}),/finite_|constraint/);
 assert.equal((await q('select * from public.customer_orders')).length,0);
});
scenario('daily route report retains original sale cost and records later returns on return date',async()=>{
 const s=await sale();await rpc('return_sale_item',{sale_item_id:s.item.id,returned_pieces:5,reason:'Later return',return_date:'2026-10-15'});
 const rows=await q('select * from public.v_daily_route_profit where route_id=$1 order by day',[ids.route]);
 assert.equal(rows.length,2);assert.equal(Number(rows[0].net_sales),40000);assert.equal(Number(rows[0].estimated_material_cost),10000);
 assert.equal(Number(rows[0].estimated_route_contribution),30000);assert.equal(Number(rows[1].returns_affecting_revenue),20000);
 assert.equal(Number(rows[1].estimated_material_cost),-5000);assert.equal(Number(rows[1].estimated_route_contribution),-15000);
});
scenario('expense-only day is visible; missing recipe cost remains unknown rather than zero',async()=>{
 await admin();await q("insert into public.expenses(expense_date,route_id,category,amount) values('2026-10-16',$1,'delivery',100)",[ids.route]);await as('manager');
 const row=(await q("select * from public.v_daily_route_profit where day='2026-10-16' and route_id=$1",[ids.route]))[0];
 assert.equal(Number(row.estimated_route_contribution),-100);
 const s=await sale({product:ids.tieu});
 assert.equal((await q('select unit_material_cost_snapshot from public.sale_item_costs where sale_item_id=$1',[s.item.id]))[0].unit_material_cost_snapshot,null);
 assert.equal((await q("select estimated_route_contribution from public.v_daily_route_profit where day='2026-10-14' and route_id=$1",[ids.route]))[0].estimated_route_contribution,null);
});
scenario('retired email verification cannot grant membership',async()=>{
 await admin();await q("insert into private.approved_invites(email,role,contact_phone) values('approved@example.test','staff','+84000000000')");
 await q("update auth.users set email='approved@example.test' where id=$1",[ids.outsider]);
 assert.equal((await q('select * from public.app_members where user_id=$1',[ids.outsider])).length,0);
 await q('update auth.users set email_confirmed_at=now() where id=$1',[ids.outsider]);
 assert.equal((await q('select role from public.app_members where user_id=$1',[ids.outsider])).length,0);
});
scenario('clients cannot invoke service provisioning, bootstrap lookup or retired email invites',async()=>{
 for(const who of ['staff','manager','owner']) {
  await as(who);
  await fails(()=>q("select public.provision_phone_member('{}')"),/permission denied/);
  await fails(()=>q("select public.phone_setup_target('hash','+84912345678')"),/permission denied/);
  await fails(()=>rpc('invite_member',{email:'new@example.test',role:'staff'}),/permission denied/);
 }
});
scenario('service provisioning requires active owner and cannot promote staff or reactivate accounts on retry',async()=>{
 await admin(); await q("update auth.users set email='84912345678@phone.phucan.invalid',email_confirmed_at=now() where id=$1",[ids.outsider]);
 await db.exec('set role service_role');
 const p={user_id:ids.outsider,actor:ids.owner,phone:'+84912345678',role:'staff',full_name:'Test'};
 await fails(()=>q('select public.provision_phone_member($1)',[JSON.stringify({...p,actor:ids.manager})]),/Owner required/);
 await fails(()=>q('select public.provision_phone_member($1)',[JSON.stringify({...p,role:'owner'})]),/Owner required/);
 await q('select public.provision_phone_member($1)',[JSON.stringify(p)]);
 await admin();await q('update public.app_members set active=false where user_id=$1',[ids.outsider]);await db.exec('set role service_role');
 await q('select public.provision_phone_member($1)',[JSON.stringify({...p,role:'manager'})]);
 await admin();const m=(await q('select * from public.app_members where user_id=$1',[ids.outsider]))[0];assert.equal(m.active,false);assert.equal(m.role,'staff');
});
scenario('bootstrap is scoped to a phone, expires, consumes once and refuses a second owner',async()=>{
 await admin();await q('update public.app_members set active=false where role=\'owner\'');
 await q("update auth.users set email='84912345678@phone.phucan.invalid',email_confirmed_at=now() where id=$1",[ids.outsider]);
 const h='a'.repeat(64);await q("insert into private.phone_owner_setup(user_id,token_hash,phone,expires_at) values($1,$2,'+84912345678',now()+interval '1 hour')",[ids.outsider,h]);
 await db.exec('set role service_role');
 assert.equal((await q('select public.phone_setup_target($1,$2) id',[h,'+84987654321']))[0].id,null);
 assert.equal((await q('select public.phone_setup_target($1,$2) id',[h,'+84912345678']))[0].id,ids.outsider);
 await admin();await q("update private.phone_owner_setup set expires_at=now()-interval '1 second' where user_id=$1",[ids.outsider]);await db.exec('set role service_role');
 assert.equal((await q('select public.phone_setup_target($1,$2) id',[h,'+84912345678']))[0].id,null);
 await admin();await q("update private.phone_owner_setup set expires_at=now()+interval '1 hour' where user_id=$1",[ids.outsider]);await db.exec('set role service_role');
 const p={user_id:ids.outsider,token_hash:h,phone:'+84912345678',role:'owner'};
 await q('select public.provision_phone_member($1)',[JSON.stringify(p)]);
 await fails(()=>q('select public.provision_phone_member($1)',[JSON.stringify(p)]),/Invalid setup/);
 assert.equal((await q('select public.phone_setup_target($1,$2) id',[h,'+84912345678']))[0].id,null);
});
