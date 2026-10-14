
alter table public.returns add column return_phase text not null default 'after_sale'
check(return_phase in ('at_delivery','after_sale'));
update public.returns set return_phase='at_delivery' where reason='Trả cùng lần giao';

create or replace view public.v_recipe_cost with(security_invoker=true) as
select r.id recipe_id,r.product_id,p.sku,p.name product_name,r.version_no,r.effective_date,r.yield_qty,r.yield_unit,
case when bool_and(lmc.unit_cost is not null and (lmc.package_unit=m.base_unit or lmc.package_unit='thùng'))
 then sum(ri.qty*(1+ri.wastage_pct/100)*lmc.unit_cost) end batch_material_cost,
case when bool_and(lmc.unit_cost is not null and (lmc.package_unit=m.base_unit or lmc.package_unit='thùng')) and r.yield_qty>0
 then sum(ri.qty*(1+ri.wastage_pct/100)*lmc.unit_cost)/r.yield_qty end material_cost_per_yield_unit
from public.recipes r join public.products p on p.id=r.product_id join public.recipe_items ri on ri.recipe_id=r.id
join public.materials m on m.id=ri.material_id left join public.v_latest_material_cost lmc on lmc.material_id=ri.material_id
where r.is_active and r.effective_date<=(now() at time zone 'Asia/Ho_Chi_Minh')::date
group by r.id,r.product_id,p.sku,p.name,r.version_no,r.effective_date,r.yield_qty,r.yield_unit;

-- Route activity includes expense-only and return-only days and never revalues past sales using today's BOM.
create or replace view public.v_daily_route_profit with(security_invoker=true) as
with late_qty as (
 select sale_item_id,sum(qty) qty from public.returns where return_phase='after_sale' group by sale_item_id
), sale_cost as (
 select s.id,s.sale_date as day,s.route_id,
 case when bool_and(c.cost_complete) then sum((si.qty+coalesce(lq.qty,0))*c.unit_material_cost_snapshot) end cost,
 coalesce(bool_and(c.cost_complete),false) complete
 from public.sales s join public.sale_items si on si.sale_id=s.id
 left join public.sale_item_costs c on c.sale_item_id=si.id left join late_qty lq on lq.sale_item_id=si.id
 group by s.id,s.sale_date,s.route_id
), sales_agg as (
 select s.sale_date as day,s.route_id,sum(s.gross_amount) net_sales,
 case when bool_and(sc.complete) then sum(sc.cost) end original_cost
 from public.sales s left join sale_cost sc on sc.id=s.id group by s.sale_date,s.route_id
), return_agg as (
 select r.return_date as day,r.route_id,sum(r.refund_amount) all_returns_amount,
 sum(case when r.return_phase='after_sale' then r.refund_amount else 0 end) late_returns,
 case when bool_and(case when r.return_phase='after_sale' then coalesce(c.cost_complete,false) else true end)
 then sum(case when r.return_phase='after_sale' then r.qty*c.unit_material_cost_snapshot else 0 end) end recovered_cost,
 bool_and(case when r.return_phase='after_sale' then coalesce(c.cost_complete,false) else true end) complete
 from public.returns r left join public.sale_item_costs c on c.sale_item_id=r.sale_item_id
 group by r.return_date,r.route_id
), expense_agg as (
 select expense_date as day,route_id,sum(amount) amount from public.expenses where route_id is not null group by expense_date,route_id
), days as (
 select day,route_id from sales_agg union select day,route_id from return_agg union select day,route_id from expense_agg
)
select d.day,d.route_id,rt.name route_name,coalesce(s.net_sales,0) net_sales,
case when (s.day is null or s.original_cost is not null) and coalesce(r.complete,true)
 then coalesce(s.original_cost,0)-coalesce(r.recovered_cost,0) end estimated_material_cost,
coalesce(r.all_returns_amount,0) returns_amount,coalesce(r.late_returns,0) returns_affecting_revenue,
coalesce(e.amount,0)+coalesce(rt.logistics_cost_per_day,0) route_expenses,
case when (s.day is null or s.original_cost is not null) and coalesce(r.complete,true)
 then coalesce(s.net_sales,0)-(coalesce(s.original_cost,0)-coalesce(r.recovered_cost,0))
 -coalesce(r.late_returns,0)-coalesce(e.amount,0)-coalesce(rt.logistics_cost_per_day,0) end estimated_route_contribution
from days d left join public.routes rt on rt.id=d.route_id
left join sales_agg s on s.day=d.day and s.route_id is not distinct from d.route_id
left join return_agg r on r.day=d.day and r.route_id is not distinct from d.route_id
left join expense_agg e on e.day=d.day and e.route_id is not distinct from d.route_id;

create or replace view public.v_monthly_overhead_summary with(security_invoker=true) as
select (select coalesce(sum(monthly_amount_standard),0) from public.fixed_costs where is_active and
 effective_from<=(now() at time zone 'Asia/Ho_Chi_Minh')::date and (effective_to is null or effective_to>=(now() at time zone 'Asia/Ho_Chi_Minh')::date)) fixed_operating_costs,
(select coalesce(sum(monthly_depreciation),0) from public.assets where is_active and (in_service_date is null or in_service_date<=(now() at time zone 'Asia/Ho_Chi_Minh')::date)) depreciation_costs,
(select coalesce(sum(monthly_amount_standard),0) from public.fixed_costs where is_active and
 effective_from<=(now() at time zone 'Asia/Ho_Chi_Minh')::date and (effective_to is null or effective_to>=(now() at time zone 'Asia/Ho_Chi_Minh')::date))+
(select coalesce(sum(monthly_depreciation),0) from public.assets where is_active and (in_service_date is null or in_service_date<=(now() at time zone 'Asia/Ho_Chi_Minh')::date)) total_monthly_overhead;
notify pgrst,'reload schema';

create or replace function private.post_delivery(p_payload jsonb,p_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.require_member(true);v_id uuid;v_order public.customer_orders%rowtype;
 v_customer public.customers%rowtype;v_item public.customer_order_items%rowtype;v_line jsonb;
 v_delivered numeric;v_returned numeric;v_sold numeric;v_qty numeric;v_gross numeric:=0;v_collected numeric;
 v_receivable uuid;v_sale_item uuid;v_cost numeric;v_date date;v_account uuid;v_debt numeric;
begin
 v_id:=private.request_start(p_key,'post_delivery',p_payload);if v_id is not null then return v_id;end if;
 perform private.require_lines(p_payload);
 select * into v_order from public.customer_orders where id=(p_payload->>'order_id')::uuid;
 if not found then raise exception 'Order not found';end if;
 select * into v_customer from public.customers where id=v_order.customer_id and is_active for update;
 if not found then raise exception 'Active customer required';end if;
 select * into v_order from public.customer_orders where id=v_order.id for update;
 if v_order.status not in ('confirmed','partial') then raise exception 'Confirmed order required';end if;
 if (p_payload->>'version')::integer is distinct from v_order.version then raise exception 'Version conflict' using errcode='40001';end if;
 if (select count(*) from jsonb_array_elements(p_payload->'lines')) <>
 (select count(distinct value->>'order_item_id') from jsonb_array_elements(p_payload->'lines')) then raise exception 'Duplicate or missing order item';end if;
 v_date:=coalesce((p_payload->>'sale_date')::date,(now() at time zone 'Asia/Ho_Chi_Minh')::date);
 v_collected:=coalesce((p_payload->>'collected_amount')::numeric,0);
 if v_collected<0 or round(v_collected,2)<>v_collected then raise exception 'Invalid collected amount';end if;
 v_account:=nullif(p_payload->>'account_id','')::uuid;
 if v_collected>0 and not exists(select 1 from public.cash_accounts where id=v_account and is_active) then raise exception 'Active cash account required';end if;
 insert into public.sales(sale_date,customer_id,route_id,customer_order_id,created_by,idempotency_key,note)
 values(v_date,v_customer.id,v_order.route_id,v_order.id,v_actor,p_key,p_payload->>'note') returning id into v_id;
 for v_line in select value from jsonb_array_elements(p_payload->'lines') order by value->>'order_item_id' loop
  select * into v_item from public.customer_order_items where id=(v_line->>'order_item_id')::uuid and order_id=v_order.id for update;
  if not found or v_item.product_id is null then raise exception 'Resolved order line required';end if;
  if not exists(select 1 from public.products where id=v_item.product_id and is_active) then raise exception 'Inactive product';end if;
  v_delivered:=(v_line->>'delivered_pieces')::numeric;v_returned:=coalesce((v_line->>'returned_pieces')::numeric,0);
  if v_delivered is null or v_delivered<=0 or v_returned<0 or v_returned>v_delivered
  or v_delivered<>trunc(v_delivered) or v_returned<>trunc(v_returned)
  or v_item.delivered_pieces+v_delivered>v_item.pieces_qty then raise exception 'Invalid delivery/return quantity';end if;
  v_sold:=v_delivered-v_returned;v_qty:=v_sold/v_item.pieces_per_price_unit;
  -- Existing quantity columns have four decimals; reject conversions that cannot be represented.
  if round(v_qty,4)<>v_qty or round(v_delivered/v_item.pieces_per_price_unit,4)<>v_delivered/v_item.pieces_per_price_unit then
   raise exception 'Quantity cannot be represented in legacy sale unit';end if;
  v_cost:=private.product_cost(v_item.product_id,v_date,v_item.pieces_per_price_unit);
  insert into public.sale_items(sale_id,product_id,order_item_id,qty,unit_price,discount_pct,qty_delivered,qty_returned,
   price_unit_snapshot,pieces_per_price_unit_snapshot)
  values(v_id,v_item.product_id,v_item.id,v_qty,v_item.unit_price_snapshot,v_order.discount_pct,
   v_delivered/v_item.pieces_per_price_unit,v_returned/v_item.pieces_per_price_unit,
   v_item.price_unit,v_item.pieces_per_price_unit) returning id into v_sale_item;
  insert into public.sale_item_costs(sale_item_id,unit_material_cost_snapshot,cost_complete)
  values(v_sale_item,v_cost,v_cost is not null);
  v_gross:=v_gross+round(v_qty*v_item.unit_price_snapshot*(1-v_order.discount_pct/100),2);
  update public.customer_order_items set delivered_pieces=delivered_pieces+v_delivered where id=v_item.id;
  if v_returned>0 then
   insert into public.returns(return_phase,return_date,sale_id,sale_item_id,customer_id,route_id,product_id,qty,refund_amount,reason,created_by,idempotency_key)
   values('at_delivery',v_date,v_id,v_sale_item,v_customer.id,v_order.route_id,v_item.product_id,v_returned/v_item.pieces_per_price_unit,
   round(v_returned/v_item.pieces_per_price_unit*v_item.unit_price_snapshot*(1-v_order.discount_pct/100),2),
   'Trả cùng lần giao',v_actor,p_key);
  end if;
 end loop;
 if v_collected>v_gross then raise exception 'Collection exceeds sale net';end if;
 if v_gross>v_collected then
  if v_customer.credit_policy='review' and (p_payload->>'credit_approval_reason' is null or length(trim(p_payload->>'credit_approval_reason'))=0) then
   raise exception 'Unconfigured credit requires manager approval reason';end if;
  if v_customer.credit_policy='limited' then
   if v_customer.credit_limit is null or v_customer.credit_limit<0 then raise exception 'Valid credit limit required';end if;
   select coalesce(sum(amount-paid_amount),0) into v_debt from public.receivables where customer_id=v_customer.id;
   if v_debt+v_gross-v_collected>v_customer.credit_limit then raise exception 'Credit limit exceeded';end if;
  end if;
 end if;
 update public.sales set gross_amount=v_gross,collected_amount=v_collected,
 payment_status=case when v_collected=v_gross then 'paid' when v_collected>0 then 'partial' else 'unpaid' end where id=v_id;
 insert into public.receivables(sale_id,customer_id,amount,paid_amount,due_date,status)
 values(v_id,v_customer.id,v_gross,v_collected,v_date+v_customer.payment_terms_days,
 case when v_collected=v_gross then 'paid' when v_collected>0 then 'partial' else 'open' end) returning id into v_receivable;
 if v_collected>0 then
  insert into public.cash_movements(txn_date,account_id,direction,amount,flow_class,kind,customer_id,route_id,sale_id,receivable_id,idempotency_key,created_by)
  values(v_date,v_account,'in',v_collected,'operating','sale_collection',v_customer.id,v_order.route_id,v_id,v_receivable,
  v_actor::text||':'||p_key||':initial',v_actor);
 end if;
 update public.customer_orders set status=case when not exists(select 1 from public.customer_order_items where order_id=v_order.id and delivered_pieces<pieces_qty)
 then 'completed' else 'partial' end,version=version+1,updated_at=now() where id=v_order.id;
 perform private.audit('delivery.posted',v_id,jsonb_build_object('order_id',v_order.id,'credit_approval_reason',p_payload->>'credit_approval_reason'));
 return private.request_finish(p_key,'post_delivery',p_payload,v_id);
end $$;
