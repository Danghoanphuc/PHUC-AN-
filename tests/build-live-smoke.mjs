import {writeFileSync} from 'node:fs';
import {ids,catalogueSeed,memberSeed} from './fixtures.mjs';
const script=`-- Run only through the authorized administrative connection. All fixtures are rolled back.
begin;
${catalogueSeed}
${memberSeed}
insert into public.product_units(product_id,price_unit,pieces_per_price_unit,verified)
select id,sale_unit,case sale_unit when 'cái' then 1 when 'bì 5' then 5 else 10 end,true
from public.products where sku like 'TEST_%';
insert into public.selling_prices(product_id,price_tier,amount,price_unit,pieces_per_price_unit,effective_from)
select p.id,'wholesale',p.wholesale_price,u.price_unit,u.pieces_per_price_unit,'2026-10-14'
from public.products p join public.product_units u on u.product_id=p.id where p.sku like 'TEST_%' and p.wholesale_price is not null;
insert into public.material_stock_baselines(material_id,opening_qty,ledger_cutoff,verified)
values('${ids.material}',100,clock_timestamp(),true);
do $test$
declare o uuid;oi uuid;s uuid;si uuid;r uuid;mid uuid;rev uuid;po uuid;pi uuid;receipt uuid;payable uuid;
p jsonb;failed boolean;checks integer:=0;sid uuid;
begin
 perform set_config('request.jwt.claim.sub','${ids.staff}',true);
 execute 'set local role authenticated';
 if (select count(*) from public.customers)<>1 then raise exception 'Staff customer scope failed';end if;checks:=checks+1;
 if exists(select 1 from public.employee_compensation_terms) or exists(select 1 from public.material_prices) then raise exception 'Staff sensitive-data access';end if;checks:=checks+1;
 failed:=false;begin
 perform public.transition_customer_order('{}','live-denied-transition');
 exception when insufficient_privilege then failed:=true;end;
 if not failed then raise exception 'Staff confirmation was allowed';end if;checks:=checks+1;
 failed:=false;begin
 perform public.save_customer_order(jsonb_build_object('customer_id','${ids.otherCustomer}','delivery_date','2026-10-14','lines',jsonb_build_array(jsonb_build_object('product_id','${ids.donut}','order_qty',1))),'live-outside-scope');
 exception when insufficient_privilege then failed:=true;end;
 if not failed then raise exception 'Staff outside-scope order was allowed';end if;checks:=checks+1;

 execute 'reset role';perform set_config('request.jwt.claim.sub','${ids.manager}',true);execute 'set local role authenticated';
 p:=jsonb_build_object('customer_id','${ids.customer}','delivery_date','2026-10-14','lines',jsonb_build_array(jsonb_build_object('product_id','${ids.donut}','order_qty',1)));
 o:=public.save_customer_order(p,'live-create-order');
 if public.save_customer_order(p,'live-create-order')<>o then raise exception 'Order idempotency failed';end if;checks:=checks+1;
 failed:=false;begin perform public.save_customer_order(p||jsonb_build_object('note','changed'),'live-create-order');exception when invalid_parameter_value then failed:=true;end;
 if not failed then raise exception 'Changed request key payload was accepted';end if;checks:=checks+1;
 failed:=false;begin perform public.save_customer_order(p-'lines','live-missing-lines');exception when invalid_parameter_value then failed:=true;end;
 if not failed then raise exception 'Missing lines accepted';end if;checks:=checks+1;
 perform public.transition_customer_order(jsonb_build_object('order_id',o,'version',1,'status','confirmed'),'live-confirm-order');
 select id into oi from public.customer_order_items where order_id=o;
 p:=jsonb_build_object('order_id',o,'version',2,'sale_date','2026-10-14','account_id','${ids.account}','collected_amount',10000,
 'lines',jsonb_build_array(jsonb_build_object('order_item_id',oi,'delivered_pieces',10)));
 s:=public.post_delivery(p,'live-post-delivery');
 if public.post_delivery(p,'live-post-delivery')<>s then raise exception 'Sale idempotency failed';end if;checks:=checks+1;
 if (select net_amount from public.sales where id=s)<>40000 then raise exception 'bi10 price conversion failed';end if;checks:=checks+1;
 select id into r from public.receivables where sale_id=s;
 if (select amount-paid_amount from public.receivables where id=r)<>30000 then raise exception 'Receivable balance failed';end if;checks:=checks+1;
 if (select sum(amount) from public.cash_movements where sale_id=s)<>10000 then raise exception 'Initial ledger missing';end if;checks:=checks+1;
 select id into si from public.sale_items where sale_id=s;
 if (select unit_material_cost_snapshot from public.sale_item_costs where sale_item_id=si)<>1000 then raise exception 'Cost snapshot failed';end if;checks:=checks+1;
 mid:=public.collect_receivable(jsonb_build_object('receivable_id',r,'account_id','${ids.account}','amount',30000),'live-collect-debt');
 if (select payment_status from public.sales where id=s)<>'paid' then raise exception 'Paid state failed';end if;checks:=checks+1;
 rev:=public.reverse_cash_movement(jsonb_build_object('movement_id',mid,'reason','Rollback test'),'live-reverse-debt');
 if (select amount-paid_amount from public.receivables where id=r)<>30000 then raise exception 'Reversal failed';end if;checks:=checks+1;
 perform public.return_sale_item(jsonb_build_object('sale_item_id',si,'returned_pieces',10,'account_id','${ids.account}','reason','Full return','return_date','2026-10-15'),'live-full-return');
 if (select net_amount from public.sales where id=s)<>0 or (select paid_amount from public.receivables where id=r)<>0 then raise exception 'Full return accounting failed';end if;checks:=checks+1;
 if (select balance from public.v_cash_balances where account_id='${ids.account}')<>0 then raise exception 'Ledger did not reconcile';end if;checks:=checks+1;
 -- A separate same-delivery full return proves qty=0 is valid.
 o:=public.save_customer_order(jsonb_build_object('customer_id','${ids.customer}','delivery_date','2026-10-14','lines',jsonb_build_array(jsonb_build_object('product_id','${ids.kem}','order_qty',1))),'live-zero-order');
 perform public.transition_customer_order(jsonb_build_object('order_id',o,'version',1,'status','confirmed'),'live-zero-confirm');
 select id into oi from public.customer_order_items where order_id=o;
 sid:=public.post_delivery(jsonb_build_object('order_id',o,'version',2,'sale_date','2026-10-14','lines',jsonb_build_array(jsonb_build_object('order_item_id',oi,'delivered_pieces',10,'returned_pieces',10))),'live-zero-sale');
 if (select qty from public.sale_items where sale_id=sid)<>0 then raise exception 'Same-delivery full return failed';end if;checks:=checks+1;
 if (select net_sales from public.v_daily_route_profit where day='2026-10-14' and route_id='${ids.route}')<>40000 then raise exception 'Route original-day revenue failed';end if;checks:=checks+1;
 if (select returns_affecting_revenue from public.v_daily_route_profit where day='2026-10-15' and route_id='${ids.route}')<>40000 then raise exception 'Route late return day failed';end if;checks:=checks+1;

 po:=public.save_purchase_order(jsonb_build_object('supplier_id','${ids.supplier}','expected_date','2026-10-14','lines',
 jsonb_build_array(jsonb_build_object('material_id','${ids.material}','purchase_unit','thùng','quantity',2,'base_qty_per_unit',20,'unit_price',200000))),'live-purchase-draft');
 if exists(select 1 from public.inventory_transactions where material_id='${ids.material}') then raise exception 'PO changed stock';end if;checks:=checks+1;
 perform public.transition_purchase_order(jsonb_build_object('purchase_order_id',po,'version',1,'status','submitted'),'live-submit-purchase');
 perform public.transition_purchase_order(jsonb_build_object('purchase_order_id',po,'version',2,'status','confirmed'),'live-confirm-purchase');
 select id into pi from public.purchase_order_items where purchase_order_id=po;
 p:=jsonb_build_object('purchase_order_id',po,'version',3,'received_date','2026-10-14','lines',jsonb_build_array(jsonb_build_object('purchase_order_item_id',pi,'quantity',1)));
 receipt:=public.receive_purchase_order(p,'live-receive-purchase');
 if public.receive_purchase_order(p,'live-receive-purchase')<>receipt then raise exception 'Receipt retry failed';end if;checks:=checks+1;
 if (select qty_on_hand from public.v_material_stock where material_id='${ids.material}')<>120 then raise exception 'Stock conversion failed';end if;checks:=checks+1;
 select id into payable from public.supplier_payables where receipt_id=receipt;
 if (select amount from public.supplier_payables where id=payable)<>200000 then raise exception 'Supplier payable missing';end if;checks:=checks+1;
 mid:=public.pay_supplier(jsonb_build_object('payable_id',payable,'account_id','${ids.account}','amount',200000),'live-pay-supplier');
 perform public.reverse_cash_movement(jsonb_build_object('movement_id',mid,'reason','Rollback test'),'live-reverse-supplier');
 if (select paid_amount from public.supplier_payables where id=payable)<>0 then raise exception 'Supplier reversal failed';end if;checks:=checks+1;
 perform public.reconcile_material_stock(jsonb_build_object('material_id','${ids.material}','counted_qty',119,'reason','Physical test'),'live-stock-reconcile');
 if (select qty_on_hand from public.v_material_stock where material_id='${ids.material}')<>119 then raise exception 'Physical reconciliation failed';end if;checks:=checks+1;

 execute 'reset role';perform set_config('request.jwt.claim.sub','${ids.staff}',true);execute 'set local role authenticated';
 if exists(select 1 from public.sale_item_costs) then raise exception 'Staff can read posted cost';end if;checks:=checks+1;
 if (select estimated_unit_material_cost from public.v_sale_item_margin where sale_item_id=si) is not null then raise exception 'Cost view leaked';end if;checks:=checks+1;
 execute 'reset role';
 failed:=false;begin update public.cash_movements set amount=1 where id=mid;exception when object_not_in_prerequisite_state then failed:=true;end;
 if not failed then raise exception 'Ledger update allowed';end if;checks:=checks+1;
 if checks<>28 then raise exception 'Unexpected check count %',checks;end if;
end $test$;
rollback;
select '28 live PostgreSQL assertions passed; all synthetic fixtures rolled back' as verification;
`;
writeFileSync(new URL('./live-smoke.sql',import.meta.url),script);
