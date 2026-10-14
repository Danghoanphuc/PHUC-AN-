create or replace function private.post_delivery_as(p_payload jsonb,p_key text,p_pos boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.require_member(not p_pos);v_id uuid;v_order public.customer_orders%rowtype;
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
 if p_pos and not private.can_customer(v_customer.id) then raise exception 'Customer outside assigned scope' using errcode='42501';end if;
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
   insert into public.returns(return_date,sale_id,sale_item_id,customer_id,route_id,product_id,qty,refund_amount,reason,created_by,idempotency_key)
   values(v_date,v_id,v_sale_item,v_customer.id,v_order.route_id,v_item.product_id,v_returned/v_item.pieces_per_price_unit,
   round(v_returned/v_item.pieces_per_price_unit*v_item.unit_price_snapshot*(1-v_order.discount_pct/100),2),
   'Trả cùng lần giao',v_actor,p_key);
  end if;
 end loop;
 if p_pos and (v_collected<>v_gross or not exists(select 1 from private.pos_wallets where user_id=v_actor and account_id=v_account)) then raise exception 'POS requires full collection in own wallet';end if;
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

-- Internal cash custody per operator. It is not a grant to the company cash ledger.
create table private.pos_wallets(
 user_id uuid primary key references public.app_members(user_id),
 account_id uuid not null unique references public.cash_accounts(id)
);
alter table private.pos_wallets enable row level security;
create policy service_only on private.pos_wallets to service_role using(true) with check(true);
revoke all on private.pos_wallets from public,anon,authenticated;
revoke all on function private.post_delivery_as(jsonb,text,boolean) from public,anon,authenticated;
create or replace function private.post_delivery(p_payload jsonb,p_key text) returns uuid
language sql security definer set search_path='' as $$select private.post_delivery_as(p_payload,p_key,false)$$;

create function private.create_pos_customer(p jsonb,p_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_member();id uuid;r uuid:=(p->>'route_id')::uuid;
begin
 id:=private.request_start(p_key,'create_pos_customer',p);if id is not null then return id;end if;
 if nullif(trim(p->>'name'),'') is null or length(p->>'name')>150 then raise exception 'Customer name required';end if;
 if not exists(select 1 from public.routes where routes.id=r and is_active) then raise exception 'Active assigned route required';end if;
 if private.app_role()='staff' and not exists(select 1 from public.route_assignments where user_id=actor and route_id=r)
 then raise exception 'Customer outside assigned scope' using errcode='42501';end if;
 if p ? 'credit_limit' or p ? 'discount_pct' or p ? 'assigned_to' then raise exception 'Restricted customer fields' using errcode='42501';end if;
 insert into public.customers(code,name,phone,route_id,customer_type,assigned_to,credit_policy,credit_limit)
 values('POS-'||substr(gen_random_uuid()::text,1,13),trim(p->>'name'),nullif(trim(p->>'phone'),''),r,'Bạn hàng',actor,'limited',0) returning customers.id into id;
 perform private.audit('pos.customer_created',id,jsonb_build_object('route_id',r));
 return private.request_finish(p_key,'create_pos_customer',p,id);
end $$;
create function public.create_pos_customer(payload jsonb,request_key text) returns uuid
language sql security invoker set search_path='' as $$select private.create_pos_customer(payload,request_key)$$;

create function private.post_pos_sale(p jsonb,p_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_member();id uuid;v_order_id uuid;o public.customer_orders%rowtype;
 item public.customer_order_items%rowtype;l jsonb;qty numeric;take numeric;remaining numeric;
 delivery jsonb:='[]';cash_id uuid;amount numeric:=0;day date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 id:=private.request_start(p_key,'post_pos_sale',p);if id is not null then return id;end if;
 if p ? 'discount_pct' or p ? 'collected_amount' or p ? 'account_id' or p ? 'credit_approval_reason' then raise exception 'POS fields are server controlled' using errcode='42501';end if;
 perform private.require_lines(p);
 if not private.can_customer((p->>'customer_id')::uuid) then raise exception 'Customer outside assigned scope' using errcode='42501';end if;
 if exists(select 1 from jsonb_array_elements(p->'lines') x group by x->>'product_id' having count(*)>1) then raise exception 'Duplicate POS product';end if;
 if nullif(p->>'order_id','') is null then
  v_order_id:=private.save_customer_order(jsonb_build_object('customer_id',p->>'customer_id','delivery_date',day,'note',p->>'note','lines',p->'lines'),p_key||':order');
  if exists(select 1 from public.customer_order_items where customer_order_items.order_id=v_order_id and product_id is null) then raise exception 'Resolve every POS line';end if;
  update public.customer_orders set status='confirmed',version=version+1,updated_at=now() where customer_orders.id=v_order_id;
 else
  v_order_id:=(p->>'order_id')::uuid;
 end if;
 select * into o from public.customer_orders where customer_orders.id=v_order_id for update;
 if not found or o.customer_id<>(p->>'customer_id')::uuid or o.status not in ('confirmed','partial') then raise exception 'Confirmed order required';end if;
 if p ? 'order_id' and (p->>'version')::integer is distinct from o.version then raise exception 'Version conflict' using errcode='40001';end if;
 for l in select value from jsonb_array_elements(p->'lines') order by value->>'product_id' loop
  qty:=(l->>'order_qty')::numeric*10;
  if qty is null or qty<=0 or qty<>trunc(qty) or qty::text in ('NaN','Infinity','-Infinity') then raise exception 'Invalid POS quantity';end if;
  remaining:=qty;
  for item in select * from public.customer_order_items where customer_order_items.order_id=v_order_id and product_id=(l->>'product_id')::uuid order by customer_order_items.id for update loop
   take:=least(remaining,item.pieces_qty-item.delivered_pieces);
   if take>0 then
    delivery:=delivery||jsonb_build_array(jsonb_build_object('order_item_id',item.id,'delivered_pieces',take));
    amount:=amount+round(take/item.pieces_per_price_unit*item.unit_price_snapshot*(1-o.discount_pct/100),2);
    remaining:=remaining-take;
   end if;
  end loop;
  if remaining>0 then raise exception 'POS quantity exceeds remaining order';end if;
 end loop;
 if amount<=0 or (p->>'expected_total')::numeric is distinct from amount then raise exception 'POS total changed; refresh prices and order';end if;
 -- Serialize wallet creation and collections for one operator.
 perform pg_advisory_xact_lock(hashtextextended('pos-wallet:'||actor::text,0));
 select account_id into cash_id from private.pos_wallets where user_id=actor;
 if cash_id is null then
  insert into public.cash_accounts(code,name,account_type) values('POS-'||actor::text,'POS · '||coalesce((select nullif(full_name,'') from public.member_profiles where user_id=actor),actor::text),'cash') returning cash_accounts.id into cash_id;
  insert into private.pos_wallets(user_id,account_id) values(actor,cash_id);
 end if;
 id:=private.post_delivery_as(jsonb_build_object('order_id',o.id,'version',o.version,'sale_date',day,'note',p->>'note','collected_amount',amount,'account_id',cash_id,'lines',delivery),p_key||':delivery',true);
 perform private.audit('pos.sale_posted',id,jsonb_build_object('order_id',o.id,'cash_account_id',cash_id));
 return private.request_finish(p_key,'post_pos_sale',p,id);
end $$;
create function public.post_pos_sale(payload jsonb,request_key text) returns uuid
language sql security invoker set search_path='' as $$select private.post_pos_sale(payload,request_key)$$;
revoke all on function private.create_pos_customer(jsonb,text),public.create_pos_customer(jsonb,text),private.post_pos_sale(jsonb,text),public.post_pos_sale(jsonb,text) from public,anon;
grant execute on function private.create_pos_customer(jsonb,text),public.create_pos_customer(jsonb,text),private.post_pos_sale(jsonb,text),public.post_pos_sale(jsonb,text) to authenticated;
notify pgrst,'reload schema';
