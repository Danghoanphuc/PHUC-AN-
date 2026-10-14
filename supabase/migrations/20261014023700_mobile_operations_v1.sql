-- Phuc An mobile operations v1. Existing catalogue and prices are preserved.
-- Apply only after local integration tests. Business writes go through authenticated RPCs.
do $$ begin
 if exists(select 1 from public.sales) or exists(select 1 from public.sale_items) or exists(select 1 from public.receivables) then
 raise exception 'Migration requires empty sale/receivable tables; reconcile existing financial data first';end if;
end $$;
create schema if not exists private;
create table public.product_units (
 product_id uuid primary key references public.products(id), price_unit text not null,
 pieces_per_price_unit numeric(14,4) not null check(pieces_per_price_unit>0),
 pieces_per_order_unit numeric(14,4) not null default 10 check(pieces_per_order_unit>0),
 verified boolean not null default false, updated_at timestamptz not null default now()
);
insert into public.product_units(product_id,price_unit,pieces_per_price_unit,verified)
select id,sale_unit,case lower(trim(sale_unit)) when 'cái' then 1 when 'cai' then 1
 when 'bì 10' then 10 when 'bì 5' then 5 when 'hộp 5' then 5
 when 'hộp 1' then 1 when 'hộp 3' then 3 when 'hộp 6' then 6 else 1 end,
lower(trim(sale_unit)) in ('cái','cai','bì 10','bì 5','hộp 5','hộp 1','hộp 3','hộp 6')
from public.products;
alter table public.order_product_name_rules add column customer_id uuid references public.customers(id);
-- Text scopes are deliberately not guessed; managers bind them to stable customer IDs.
create index order_rules_customer_idx on public.order_product_name_rules(customer_id);
create index order_rules_product_idx on public.order_product_name_rules(product_id);
create table public.route_assignments(
 user_id uuid references public.app_members(user_id) on delete cascade,
 route_id uuid references public.routes(id) on delete cascade, primary key(user_id,route_id)
);
create index route_assignments_route_idx on public.route_assignments(route_id);
alter table public.customers add column address text, add column assigned_to uuid references public.app_members(user_id),
 add column payment_terms_days integer not null default 0 check(payment_terms_days>=0),
 add column credit_policy text not null default 'review' check(credit_policy in ('review','limited','unlimited'));
create index customers_assigned_idx on public.customers(assigned_to);
create table public.customer_activities(
 id uuid primary key default gen_random_uuid(),customer_id uuid not null references public.customers(id),
 kind text not null check(kind in ('call','visit','note')),body text not null check(length(trim(body))>0),
 occurred_at timestamptz not null default now(),created_by uuid not null default auth.uid() references public.app_members(user_id)
);
create index activities_customer_idx on public.customer_activities(customer_id,occurred_at);
create index activities_actor_idx on public.customer_activities(created_by);
create table public.customer_tasks(
 id uuid primary key default gen_random_uuid(),customer_id uuid not null references public.customers(id),
 assigned_to uuid not null references public.app_members(user_id),title text not null check(length(trim(title))>0),
 due_at timestamptz not null,status text not null default 'open' check(status in ('open','done','cancelled')),
 created_by uuid not null default auth.uid() references public.app_members(user_id)
);
create index tasks_customer_idx on public.customer_tasks(customer_id);
create index tasks_assignee_idx on public.customer_tasks(assigned_to,due_at);
create index tasks_actor_idx on public.customer_tasks(created_by);
create table public.selling_prices(
 id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products(id),
 customer_id uuid references public.customers(id),price_tier text not null check(price_tier in ('retail','wholesale')),
 amount numeric(14,2) not null check(amount>=0), price_unit text not null,
 pieces_per_price_unit numeric(14,4) not null check(pieces_per_price_unit>0),
 effective_from date not null,effective_to date,check(effective_to is null or effective_to>=effective_from),
 created_by uuid references public.app_members(user_id),created_at timestamptz not null default now()
);
create index prices_lookup_idx on public.selling_prices(product_id,price_tier,effective_from desc);
create index prices_customer_idx on public.selling_prices(customer_id);
create index prices_actor_idx on public.selling_prices(created_by);
insert into public.selling_prices(product_id,price_tier,amount,price_unit,pieces_per_price_unit,effective_from)
select p.id,t.tier,t.amount,u.price_unit,u.pieces_per_price_unit,'2026-10-14'::date
from public.products p join public.product_units u on u.product_id=p.id
cross join lateral(values('retail',p.list_price),('wholesale',p.wholesale_price)) t(tier,amount)
where t.amount is not null;
create table public.customer_orders(
 id uuid primary key default gen_random_uuid(),customer_id uuid not null references public.customers(id),
 route_id uuid references public.routes(id),delivery_address_snapshot text,delivery_date date not null,
 status text not null default 'draft' check(status in ('draft','confirmed','partial','completed','cancelled')),
 version integer not null default 1,created_by uuid not null references public.app_members(user_id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 note text,cancel_reason text,discount_pct numeric(7,4) not null check(discount_pct between 0 and 100)
);
create index orders_customer_idx on public.customer_orders(customer_id,delivery_date);
create index orders_route_idx on public.customer_orders(route_id,delivery_date);
create index orders_actor_idx on public.customer_orders(created_by);
create table public.customer_order_requests(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.customer_orders(id),
 requested_name text not null,order_qty numeric(14,4) not null check(order_qty>0),
 original_request jsonb not null
);
create index order_requests_order_idx on public.customer_order_requests(order_id);
create table public.customer_order_items(
 id uuid primary key default gen_random_uuid(),order_id uuid not null references public.customer_orders(id),
 product_id uuid references public.products(id),requested_name text not null,
 request_id uuid not null references public.customer_order_requests(id),
 order_qty numeric(14,4) not null check(order_qty>0),order_unit text not null default 'bi10' check(order_unit='bi10'),
 pieces_per_order_unit numeric(14,4) not null default 10 check(pieces_per_order_unit=10),
 pieces_qty numeric(14,4) generated always as (order_qty*pieces_per_order_unit) stored,
 price_unit text,pieces_per_price_unit numeric(14,4),unit_price_snapshot numeric(14,2),
 delivered_pieces numeric(14,4) not null default 0 check(delivered_pieces>=0),
 check(delivered_pieces<=order_qty*pieces_per_order_unit),
 check((product_id is null and unit_price_snapshot is null) or
 (product_id is not null and pieces_per_price_unit>0 and unit_price_snapshot>=0 and price_unit is not null))
);
create index order_items_order_idx on public.customer_order_items(order_id);
create index order_items_product_idx on public.customer_order_items(product_id);
create index order_items_request_idx on public.customer_order_items(request_id);
alter table public.sales add column customer_order_id uuid references public.customer_orders(id),
 add column created_by uuid references public.app_members(user_id),add column idempotency_key text,
 add column version integer not null default 1;
create unique index sales_idempotency_idx on public.sales(created_by,idempotency_key);
create index sales_order_idx on public.sales(customer_order_id);
create index sales_actor_idx on public.sales(created_by);
alter table public.sale_items drop constraint sale_items_qty_check;
alter table public.sale_items add constraint sale_items_qty_check check(qty>=0),
 add constraint sale_delivery_qty_check check(qty_delivered>=0 and qty_returned>=0 and qty_returned<=qty_delivered),
 add column order_item_id uuid references public.customer_order_items(id),
 add column price_unit_snapshot text,add column pieces_per_price_unit_snapshot numeric(14,4),
 add column unit_price_locked boolean not null default true;
create table public.sale_item_costs(
 sale_item_id uuid primary key references public.sale_items(id),
 unit_material_cost_snapshot numeric(18,6),cost_complete boolean not null
);
create index sale_items_order_item_idx on public.sale_items(order_item_id);
alter table public.returns add column sale_item_id uuid references public.sale_items(id),
 add column created_by uuid references public.app_members(user_id),add column idempotency_key text;
create index returns_sale_item_idx on public.returns(sale_item_id);
create index returns_actor_idx on public.returns(created_by);
alter table public.receivables add constraint receivable_paid_bounds check(paid_amount<=amount);
-- Existing receivables were verified empty: new model stores full current net debt, not remaining balance.
create unique index receivables_one_sale_idx on public.receivables(sale_id) where sale_id is not null;
create table public.purchase_orders(
 id uuid primary key default gen_random_uuid(),supplier_id uuid not null references public.suppliers(id),
 status text not null default 'draft' check(status in ('draft','submitted','confirmed','partial','completed','cancelled')),
 expected_date date not null,version integer not null default 1,created_by uuid not null references public.app_members(user_id),
 approved_by uuid references public.app_members(user_id),note text,cancel_reason text,created_at timestamptz not null default now()
);
create index purchases_supplier_idx on public.purchase_orders(supplier_id);
create index purchases_actor_idx on public.purchase_orders(created_by);
create index purchases_approver_idx on public.purchase_orders(approved_by);
create table public.purchase_order_items(
 id uuid primary key default gen_random_uuid(),purchase_order_id uuid not null references public.purchase_orders(id),
 material_id uuid not null references public.materials(id),purchase_unit text not null,
 quantity numeric(14,4) not null check(quantity>0),base_qty_per_unit numeric(14,4) not null check(base_qty_per_unit>0),
 unit_price numeric(14,2) not null check(unit_price>=0),received_qty numeric(14,4) not null default 0,
 check(received_qty>=0 and received_qty<=quantity)
);
create index purchase_items_po_idx on public.purchase_order_items(purchase_order_id);
create index purchase_items_material_idx on public.purchase_order_items(material_id);
create table public.goods_receipts(
 id uuid primary key default gen_random_uuid(),purchase_order_id uuid not null references public.purchase_orders(id),
 received_date date not null,invoice_no text,created_by uuid not null references public.app_members(user_id),
 created_at timestamptz not null default now()
);
create index receipts_po_idx on public.goods_receipts(purchase_order_id);
create index receipts_actor_idx on public.goods_receipts(created_by);
create table public.goods_receipt_items(
 id uuid primary key default gen_random_uuid(),receipt_id uuid not null references public.goods_receipts(id),
 purchase_order_item_id uuid not null references public.purchase_order_items(id),
 quantity numeric(14,4) not null check(quantity>0),base_qty numeric(14,4) not null check(base_qty>0),
 amount numeric(14,2) not null check(amount>=0)
);
create index receipt_items_receipt_idx on public.goods_receipt_items(receipt_id);
create index receipt_items_po_item_idx on public.goods_receipt_items(purchase_order_item_id);
create table public.supplier_payables(
 id uuid primary key default gen_random_uuid(),supplier_id uuid not null references public.suppliers(id),
 receipt_id uuid not null unique references public.goods_receipts(id),
 amount numeric(14,2) not null check(amount>=0),paid_amount numeric(14,2) not null default 0,
 due_date date not null,check(paid_amount>=0 and paid_amount<=amount)
);
create index payables_supplier_idx on public.supplier_payables(supplier_id,due_date);
alter table public.cash_movements add column supplier_payable_id uuid references public.supplier_payables(id);
create index cash_payable_idx on public.cash_movements(supplier_payable_id);
create index cash_expense_idx on public.cash_movements(expense_id);
create index cash_receivable_idx on public.cash_movements(receivable_id);
create index cash_route_idx on public.cash_movements(route_id);
create index cash_sale_idx on public.cash_movements(sale_id);
create index cash_actor_idx on public.cash_movements(created_by);
alter table public.inventory_transactions add column receipt_item_id uuid unique references public.goods_receipt_items(id),
 add column included_in_snapshot_id uuid references public.inventory_snapshots(id);
create index inventory_baseline_idx on public.inventory_transactions(included_in_snapshot_id);
create table public.audit_events(
 id uuid primary key default gen_random_uuid(),actor_id uuid not null references public.app_members(user_id),
 action text not null,entity_id uuid not null,details jsonb not null default '{}',created_at timestamptz not null default now()
);
create index audit_actor_idx on public.audit_events(actor_id,created_at);
create table private.operation_requests(
 actor_id uuid not null references public.app_members(user_id),request_key text not null,
 operation text not null,payload jsonb not null,result_id uuid not null,created_at timestamptz not null default now(),
 primary key(actor_id,request_key)
);
create table public.data_review_issues(
 id uuid primary key default gen_random_uuid(),kind text not null,entity_ref text not null,
 details jsonb not null,status text not null default 'open' check(status in ('open','resolved')),
 created_at timestamptz not null default now(),unique(kind,entity_ref)
);
insert into public.data_review_issues(kind,entity_ref,details)
select 'unbound_alias_scope',alias||'/'||scope,jsonb_build_object('scope',scope,'canonical_name',canonical_name)
from public.order_product_name_rules where scope<>'general';
insert into public.data_review_issues(kind,entity_ref,details)
select 'unallocated_alias',alias||'/'||scope,jsonb_build_object('canonical_name',canonical_name,'member_skus',member_skus)
from public.order_product_name_rules where product_id is null and alias<>'quy ước số lượng đơn';
insert into public.data_review_issues(kind,entity_ref,details)
select 'material_unit_review',mp.id::text,jsonb_build_object('material_code',m.code,'base_unit',m.base_unit,'package_unit',mp.package_unit)
from public.material_prices mp join public.materials m on m.id=mp.material_id
where mp.package_unit<>m.base_unit and mp.package_unit<>'thùng';
-- Preserve all legacy values; uncertain conversions stay in review, never rewritten automatically.

create or replace function private.app_role() returns text language sql stable security definer set search_path=''
as $$ select role from public.app_members where user_id=(select auth.uid()) and active and (select auth.uid()) is not null $$;
create or replace function private.can_customer(p_customer uuid) returns boolean language sql stable security definer set search_path=''
as $$ select (select auth.uid()) is not null and (
 (select private.app_role()) in ('owner','manager') or
 ((select private.app_role())='staff' and exists(select 1 from public.customers c where c.id=p_customer and
 (c.assigned_to=(select auth.uid()) or exists(select 1 from public.route_assignments a where a.user_id=(select auth.uid()) and a.route_id=c.route_id))))) $$;
create or replace function private.require_member(p_manager boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_id uuid:=auth.uid(); v_role text:=private.app_role();
begin
 if v_id is null or v_role is null or (p_manager and v_role not in ('owner','manager')) then
 raise exception 'Not authorized' using errcode='42501'; end if;
 return v_id;
end $$;
create or replace function private.request_start(p_key text,p_operation text,p_payload jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.require_member();v_old private.operation_requests%rowtype;
begin
 if p_key is null or length(trim(p_key))<8 or length(p_key)>200 or p_payload is null or jsonb_typeof(p_payload)<>'object' then
 raise exception 'Valid request key and object payload required' using errcode='22023'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_actor::text||':'||p_key,0));
 select * into v_old from private.operation_requests where actor_id=v_actor and request_key=p_key;
 if found then
  if v_old.operation<>p_operation or v_old.payload<>p_payload then raise exception 'Idempotency key payload conflict' using errcode='22023'; end if;
  return v_old.result_id;
 end if;
 return null;
end $$;
create or replace function private.request_finish(p_key text,p_operation text,p_payload jsonb,p_result uuid) returns uuid
language plpgsql set search_path='' as $$
begin
 insert into private.operation_requests(actor_id,request_key,operation,payload,result_id)
 values(auth.uid(),p_key,p_operation,p_payload,p_result);
 return p_result;
end $$;
create or replace function private.audit(p_action text,p_id uuid,p_details jsonb default '{}') returns void
language sql set search_path='' as $$
 insert into public.audit_events(actor_id,action,entity_id,details) values(auth.uid(),p_action,p_id,p_details)
$$;
create or replace function private.require_lines(p_payload jsonb) returns void
language plpgsql set search_path='' as $$
begin
 if jsonb_typeof(p_payload->'lines') is distinct from 'array' then raise exception 'lines must be an array' using errcode='22023'; end if;
 if jsonb_array_length(p_payload->'lines')=0 then raise exception 'At least one line required' using errcode='22023'; end if;
end $$;
create or replace function private.unit_pieces(p_label text) returns numeric language sql immutable set search_path=''
as $$ select case lower(trim(p_label)) when 'cái' then 1 when 'cai' then 1 when 'bì 10' then 10
 when 'bì 5' then 5 when 'hộp 5' then 5 when 'hộp 1' then 1 when 'hộp 3' then 3 when 'hộp 6' then 6 end::numeric $$;
create or replace function private.product_cost(p_product uuid,p_date date,p_price_pieces numeric)
returns numeric language plpgsql set search_path='' as $$
declare v_recipe public.recipes%rowtype;v_batch numeric;v_complete boolean;v_yield_pieces numeric;
begin
 select * into v_recipe from public.recipes where product_id=p_product and effective_date<=p_date
 order by effective_date desc,version_no desc limit 1;
 if not found then return null; end if;
 v_yield_pieces:=private.unit_pieces(v_recipe.yield_unit);
 if v_yield_pieces is null then return null; end if;
 select sum(ri.qty*(1+ri.wastage_pct/100)*mp.unit_cost),
 bool_and(mp.unit_cost is not null and ri.unit=m.base_unit and (mp.package_unit=m.base_unit or mp.package_unit='thùng'))
 into v_batch,v_complete
 from public.recipe_items ri join public.materials m on m.id=ri.material_id
 left join lateral(select unit_cost,package_unit from public.material_prices
 where material_id=ri.material_id and effective_date<=p_date order by effective_date desc,created_at desc,id desc limit 1) mp on true
 where ri.recipe_id=v_recipe.id;
 if v_complete is distinct from true then return null; end if;
 return round(v_batch/v_recipe.yield_qty/v_yield_pieces*p_price_pieces,6);
end $$;
create or replace function private.resolve_order_alias(p_customer uuid,p_alias text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_row public.order_product_name_rules%rowtype;
begin
 perform private.require_member();
 if not private.can_customer(p_customer) then raise exception 'Customer outside assigned scope' using errcode='42501'; end if;
 select * into v_row from public.order_product_name_rules
 where lower(trim(alias))=lower(trim(p_alias)) and (customer_id=p_customer or scope='general')
 order by (customer_id=p_customer) desc nulls last limit 1;
 if not found then return jsonb_build_object('status','unresolved'); end if;
 return jsonb_build_object('status',case when v_row.product_id is not null then 'resolved'
 when cardinality(v_row.member_skus)>0 then 'allocation_required' else 'unresolved' end,
 'product_id',v_row.product_id,'member_skus',v_row.member_skus,'canonical_name',v_row.canonical_name,
 'order_unit','bi10','pieces_per_order_unit',v_row.pieces_per_order_unit);
end $$;
create or replace function public.resolve_order_alias(customer_id uuid,alias text) returns jsonb
language sql security invoker set search_path='' as $$ select private.resolve_order_alias(customer_id,alias) $$;

create or replace function private.save_customer_order(p_payload jsonb,p_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.require_member();v_id uuid;v_customer public.customers%rowtype;
 v_order public.customer_orders%rowtype;v_line jsonb;v_product public.products%rowtype;
 v_price public.selling_prices%rowtype;v_qty numeric;v_discount numeric;v_tier text;v_date date;
 v_request uuid;v_choice jsonb;v_choices jsonb;v_original_qty numeric;v_alias jsonb;v_name text;
begin
 v_id:=private.request_start(p_key,'save_customer_order',p_payload); if v_id is not null then return v_id; end if;
 perform private.require_lines(p_payload);
 select * into v_customer from public.customers where id=(p_payload->>'customer_id')::uuid and is_active for update;
 if not found then raise exception 'Active customer required'; end if;
 if not private.can_customer(v_customer.id) then raise exception 'Customer outside assigned scope' using errcode='42501'; end if;
 v_date:=(p_payload->>'delivery_date')::date;
 if v_date is null then raise exception 'delivery_date required'; end if;
 v_discount:=v_customer.default_discount_pct;
 if p_payload ? 'discount_pct' and (p_payload->>'discount_pct')::numeric is distinct from v_discount then
  perform private.require_member(true);v_discount:=(p_payload->>'discount_pct')::numeric;
 end if;
 if v_discount is null or v_discount not between 0 and 100 or round(v_discount,2)<>v_discount then raise exception 'Invalid discount'; end if;
 v_tier:=case when v_customer.customer_type='Khách lẻ' then 'retail' else 'wholesale' end;
 if nullif(p_payload->>'order_id','') is not null then
  select * into v_order from public.customer_orders where id=(p_payload->>'order_id')::uuid for update;
  if not found or v_order.customer_id<>v_customer.id or v_order.status<>'draft' then raise exception 'Editable draft required'; end if;
  if private.app_role()='staff' and v_order.created_by<>v_actor then raise exception 'Only own draft can be edited' using errcode='42501'; end if;
  if (p_payload->>'version')::integer is distinct from v_order.version then raise exception 'Version conflict' using errcode='40001'; end if;
  v_id:=v_order.id;
  delete from public.customer_order_items where order_id=v_id;
  delete from public.customer_order_requests where order_id=v_id;
  update public.customer_orders set delivery_date=v_date,note=p_payload->>'note',version=version+1,
   route_id=v_customer.route_id,delivery_address_snapshot=v_customer.address,discount_pct=v_discount,updated_at=now() where id=v_id;
 else
  insert into public.customer_orders(customer_id,route_id,delivery_address_snapshot,delivery_date,created_by,note,discount_pct)
  values(v_customer.id,v_customer.route_id,v_customer.address,v_date,v_actor,p_payload->>'note',v_discount) returning id into v_id;
 end if;
 for v_line in select value from jsonb_array_elements(p_payload->'lines') loop
  v_original_qty:=(v_line->>'order_qty')::numeric;
  if v_original_qty is null or v_original_qty<=0 or v_original_qty*10<>trunc(v_original_qty*10) then raise exception 'Positive quantity in whole pieces required';end if;
  v_name:=coalesce(nullif(trim(v_line->>'requested_name'),''),v_line->>'product_id');
  if v_name is null then raise exception 'Product or requested_name required';end if;
  insert into public.customer_order_requests(order_id,requested_name,order_qty,original_request)
  values(v_id,v_name,v_original_qty,v_line) returning id into v_request;
  if v_line ? 'allocations' then
   if jsonb_typeof(v_line->'allocations') is distinct from 'array' or jsonb_array_length(v_line->'allocations')=0 then raise exception 'Nonempty allocation array required';end if;
   v_choices:=v_line->'allocations';
   if (select sum((value->>'order_qty')::numeric) from jsonb_array_elements(v_choices)) is distinct from v_original_qty then raise exception 'Allocation total must match original request';end if;
  else v_choices:=jsonb_build_array(v_line);end if;
  v_alias:=private.resolve_order_alias(v_customer.id,v_name);
  for v_choice in select value from jsonb_array_elements(v_choices) loop
  v_qty:=(v_choice->>'order_qty')::numeric;
  if v_qty is null or v_qty<=0 or v_qty*10<>trunc(v_qty*10) then raise exception 'Positive quantity in whole pieces required'; end if;
  if nullif(v_choice->>'product_id','') is null then
   if nullif(trim(v_line->>'requested_name'),'') is null then raise exception 'Unresolved line needs requested_name'; end if;
   insert into public.customer_order_items(order_id,request_id,requested_name,order_qty)
   values(v_id,v_request,v_line->>'requested_name',v_qty);
  else
   select * into v_product from public.products where id=(v_choice->>'product_id')::uuid and is_active;
   if not found then raise exception 'Active product required'; end if;
   if v_alias->>'status'='resolved' and (v_alias->>'product_id')::uuid<>v_product.id then raise exception 'Product conflicts with scoped alias';end if;
   if v_alias->>'status'='allocation_required' and not ((v_alias->'member_skus') ? v_product.sku) then raise exception 'Product outside alias group';end if;
   if not exists(select 1 from public.product_units where product_id=v_product.id and verified) then raise exception 'Unverified product unit'; end if;
   select * into v_price from public.selling_prices where product_id=v_product.id and price_tier=v_tier
    and (customer_id=v_customer.id or customer_id is null) and effective_from<=v_date and (effective_to is null or effective_to>=v_date)
    order by (customer_id=v_customer.id) desc nulls last,effective_from desc limit 1;
   if not found then raise exception 'No effective selling price for customer tier'; end if;
   insert into public.customer_order_items(order_id,request_id,product_id,requested_name,order_qty,price_unit,pieces_per_price_unit,unit_price_snapshot)
   values(v_id,v_request,v_product.id,coalesce(nullif(v_line->>'requested_name',''),v_product.name),v_qty,v_price.price_unit,v_price.pieces_per_price_unit,v_price.amount);
  end if;
 end loop;
 end loop;
 perform private.audit('order.saved',v_id);
 return private.request_finish(p_key,'save_customer_order',p_payload,v_id);
end $$;
create or replace function public.save_customer_order(payload jsonb,request_key text) returns uuid
language sql security invoker set search_path='' as $$ select private.save_customer_order(payload,request_key) $$;
create or replace function private.transition_customer_order(p_payload jsonb,p_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.require_member(true);v_id uuid;v_order public.customer_orders%rowtype;v_status text:=p_payload->>'status';
begin
 v_id:=private.request_start(p_key,'transition_customer_order',p_payload);if v_id is not null then return v_id;end if;
 select * into v_order from public.customer_orders where id=(p_payload->>'order_id')::uuid for update;
 if not found then raise exception 'Order not found'; end if;
 if (p_payload->>'version')::integer is distinct from v_order.version then raise exception 'Version conflict' using errcode='40001'; end if;
 if v_status='confirmed' and v_order.status='draft' then
  if not exists(select 1 from public.customer_order_items where order_id=v_order.id) or
   exists(select 1 from public.customer_order_items where order_id=v_order.id and product_id is null) then raise exception 'Resolve and allocate every line before confirmation'; end if;
 elsif v_status='cancelled' and v_order.status in ('draft','confirmed','partial') then
  if nullif(trim(p_payload->>'reason'),'') is null then raise exception 'Cancellation reason required'; end if;
 else raise exception 'Invalid order transition'; end if;
 update public.customer_orders set status=v_status,cancel_reason=case when v_status='cancelled' then p_payload->>'reason' end,
 version=version+1,updated_at=now() where id=v_order.id;
 perform private.audit('order.'||v_status,v_order.id);
 return private.request_finish(p_key,'transition_customer_order',p_payload,v_order.id);
end $$;
create or replace function public.transition_customer_order(payload jsonb,request_key text) returns uuid
language sql security invoker set search_path='' as $$ select private.transition_customer_order(payload,request_key) $$;

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
   insert into public.returns(return_date,sale_id,sale_item_id,customer_id,route_id,product_id,qty,refund_amount,reason,created_by,idempotency_key)
   values(v_date,v_id,v_sale_item,v_customer.id,v_order.route_id,v_item.product_id,v_returned/v_item.pieces_per_price_unit,
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
create or replace function public.post_delivery(payload jsonb,request_key text) returns uuid
language sql security invoker set search_path='' as $$ select private.post_delivery(payload,request_key) $$;
-- Fail closed for the old payload shape; all sale posting must identify a confirmed order.
create or replace function public.create_sale_order(payload jsonb) returns uuid language sql security invoker set search_path=''
as $$ select private.post_delivery(payload,payload->>'request_key') $$;

create or replace function private.collect_receivable(p_payload jsonb,p_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.require_member(true);v_id uuid;v_r public.receivables%rowtype;v_s public.sales%rowtype;
 v_amount numeric:=(p_payload->>'amount')::numeric;v_date date;v_account uuid:=(p_payload->>'account_id')::uuid;
begin
 v_id:=private.request_start(p_key,'collect_receivable',p_payload);if v_id is not null then return v_id;end if;
 select * into v_r from public.receivables where id=(p_payload->>'receivable_id')::uuid;
 if not found then raise exception 'Receivable not found';end if;
 select * into v_s from public.sales where id=v_r.sale_id for update;
 select * into v_r from public.receivables where id=v_r.id for update;
 if v_amount is null or v_amount<=0 or round(v_amount,2)<>v_amount or v_amount>v_r.amount-v_r.paid_amount then raise exception 'Invalid collection amount';end if;
 if not exists(select 1 from public.cash_accounts where id=v_account and is_active) then raise exception 'Active cash account required';end if;
 v_date:=coalesce((p_payload->>'txn_date')::date,(now() at time zone 'Asia/Ho_Chi_Minh')::date);
 if v_date<v_s.sale_date then raise exception 'Collection cannot precede sale';end if;
 insert into public.cash_movements(txn_date,account_id,direction,amount,flow_class,kind,customer_id,route_id,sale_id,receivable_id,idempotency_key,created_by)
 values(v_date,v_account,'in',v_amount,'operating','debt_collection',v_s.customer_id,v_s.route_id,v_s.id,v_r.id,v_actor::text||':'||p_key,v_actor)
 returning id into v_id;
 update public.receivables set paid_amount=paid_amount+v_amount,status=case when paid_amount+v_amount=amount then 'paid' else 'partial' end where id=v_r.id;
 update public.sales set collected_amount=collected_amount+v_amount,payment_status=case when collected_amount+v_amount=net_amount then 'paid' else 'partial' end,
 version=version+1 where id=v_s.id;
 perform private.audit('receivable.collected',v_id);
 return private.request_finish(p_key,'collect_receivable',p_payload,v_id);
end $$;
create or replace function public.collect_receivable(payload jsonb,request_key text) returns uuid
language sql security invoker set search_path='' as $$ select private.collect_receivable(payload,request_key) $$;

create or replace function private.return_sale_item(p_payload jsonb,p_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.require_member(true);v_id uuid;v_item public.sale_items%rowtype;v_sale public.sales%rowtype;
 v_r public.receivables%rowtype;v_qty numeric;v_refund numeric;v_cash_refund numeric;v_net numeric;v_account uuid;v_date date;
begin
 v_id:=private.request_start(p_key,'return_sale_item',p_payload);if v_id is not null then return v_id;end if;
 select * into v_item from public.sale_items where id=(p_payload->>'sale_item_id')::uuid;
 if not found then raise exception 'Sale item not found';end if;
 select * into v_sale from public.sales where id=v_item.sale_id for update;
 select * into v_r from public.receivables where sale_id=v_sale.id for update;
 if not found then raise exception 'Managed receivable required';end if;
 select * into v_item from public.sale_items where id=v_item.id for update;
 v_qty:=(p_payload->>'returned_pieces')::numeric/v_item.pieces_per_price_unit_snapshot;
 if v_qty is null or v_qty<=0 or v_qty>v_item.qty or round(v_qty,4)<>v_qty
 or (p_payload->>'returned_pieces')::numeric<>trunc((p_payload->>'returned_pieces')::numeric) then raise exception 'Return exceeds net sold or invalid unit';end if;
 if nullif(trim(p_payload->>'reason'),'') is null then raise exception 'Return reason required';end if;
 -- Difference of rounded line totals makes partial returns sum to exactly the original value.
 v_refund:=round(v_item.qty*v_item.unit_price*(1-v_item.discount_pct/100),2)-
 round((v_item.qty-v_qty)*v_item.unit_price*(1-v_item.discount_pct/100),2);
 v_net:=v_sale.net_amount-v_refund;
 v_cash_refund:=greatest(v_sale.collected_amount-v_net,0);
 v_account:=nullif(p_payload->>'account_id','')::uuid;
 if v_cash_refund>0 and not exists(select 1 from public.cash_accounts where id=v_account and is_active) then raise exception 'Refund account required';end if;
 v_date:=coalesce((p_payload->>'return_date')::date,(now() at time zone 'Asia/Ho_Chi_Minh')::date);
 if v_date<v_sale.sale_date then raise exception 'Return cannot precede sale';end if;
 insert into public.returns(return_date,sale_id,sale_item_id,customer_id,route_id,product_id,qty,refund_amount,reason,created_by,idempotency_key)
 values(v_date,v_sale.id,v_item.id,v_sale.customer_id,v_sale.route_id,v_item.product_id,v_qty,v_refund,p_payload->>'reason',v_actor,p_key) returning id into v_id;
 update public.sale_items set qty=qty-v_qty,qty_returned=qty_returned+v_qty where id=v_item.id;
 update public.sales set discount_amount=discount_amount+v_refund,collected_amount=collected_amount-v_cash_refund,
 payment_status=case when collected_amount-v_cash_refund=v_net then 'paid' when collected_amount-v_cash_refund>0 then 'partial' else 'unpaid' end,
 version=version+1 where id=v_sale.id;
 update public.receivables set amount=v_net,paid_amount=paid_amount-v_cash_refund,
 status=case when paid_amount-v_cash_refund=v_net then 'paid' when paid_amount-v_cash_refund>0 then 'partial' else 'open' end where id=v_r.id;
 if v_cash_refund>0 then
  insert into public.cash_movements(txn_date,account_id,direction,amount,flow_class,kind,customer_id,route_id,sale_id,receivable_id,idempotency_key,created_by,source_ref)
  values(v_date,v_account,'out',v_cash_refund,'operating','sale_refund',v_sale.customer_id,v_sale.route_id,v_sale.id,v_r.id,
  v_actor::text||':'||p_key,v_actor,v_id::text);
 end if;
 perform private.audit('sale.returned',v_id,jsonb_build_object('refund',v_refund,'cash_refund',v_cash_refund));
 return private.request_finish(p_key,'return_sale_item',p_payload,v_id);
end $$;
create or replace function public.return_sale_item(payload jsonb,request_key text) returns uuid
language sql security invoker set search_path='' as $$ select private.return_sale_item(payload,request_key) $$;

create or replace function private.save_purchase_order(p_payload jsonb,p_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.require_member(true);v_id uuid;v_po public.purchase_orders%rowtype;v_line jsonb;
 v_supplier uuid:=(p_payload->>'supplier_id')::uuid;v_date date:=(p_payload->>'expected_date')::date;
begin
 v_id:=private.request_start(p_key,'save_purchase_order',p_payload);if v_id is not null then return v_id;end if;
 perform private.require_lines(p_payload);
 if v_date is null or not exists(select 1 from public.suppliers where id=v_supplier) then raise exception 'Supplier and expected_date required';end if;
 if nullif(p_payload->>'purchase_order_id','') is not null then
  select * into v_po from public.purchase_orders where id=(p_payload->>'purchase_order_id')::uuid for update;
  if not found or v_po.status<>'draft' then raise exception 'Editable purchase draft required';end if;
  if (p_payload->>'version')::integer is distinct from v_po.version then raise exception 'Version conflict' using errcode='40001';end if;
  v_id:=v_po.id;delete from public.purchase_order_items where purchase_order_id=v_id;
  update public.purchase_orders set supplier_id=v_supplier,expected_date=v_date,note=p_payload->>'note',version=version+1 where id=v_id;
 else
  insert into public.purchase_orders(supplier_id,expected_date,created_by,note)
  values(v_supplier,v_date,v_actor,p_payload->>'note') returning id into v_id;
 end if;
 for v_line in select value from jsonb_array_elements(p_payload->'lines') loop
  if not exists(select 1 from public.materials where id=(v_line->>'material_id')::uuid and is_active) then raise exception 'Active material required';end if;
  if nullif(trim(v_line->>'purchase_unit'),'') is null then raise exception 'Purchase unit required';end if;
  if (v_line->>'quantity')::numeric is null or (v_line->>'quantity')::numeric<=0 or
   (v_line->>'base_qty_per_unit')::numeric is null or (v_line->>'base_qty_per_unit')::numeric<=0 or
   (v_line->>'unit_price')::numeric is null or (v_line->>'unit_price')::numeric<0 or
   round((v_line->>'quantity')::numeric,4)<>(v_line->>'quantity')::numeric or
   round((v_line->>'base_qty_per_unit')::numeric,4)<>(v_line->>'base_qty_per_unit')::numeric or
   round((v_line->>'unit_price')::numeric,2)<>(v_line->>'unit_price')::numeric then raise exception 'Invalid purchase quantities/price';end if;
  insert into public.purchase_order_items(purchase_order_id,material_id,purchase_unit,quantity,base_qty_per_unit,unit_price)
  values(v_id,(v_line->>'material_id')::uuid,v_line->>'purchase_unit',(v_line->>'quantity')::numeric,
  (v_line->>'base_qty_per_unit')::numeric,(v_line->>'unit_price')::numeric);
 end loop;
 perform private.audit('purchase.saved',v_id);
 return private.request_finish(p_key,'save_purchase_order',p_payload,v_id);
end $$;
create or replace function public.save_purchase_order(payload jsonb,request_key text) returns uuid
language sql security invoker set search_path='' as $$ select private.save_purchase_order(payload,request_key) $$;
create or replace function private.transition_purchase_order(p_payload jsonb,p_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.require_member(true);v_id uuid;v_po public.purchase_orders%rowtype;v_status text:=p_payload->>'status';
begin
 v_id:=private.request_start(p_key,'transition_purchase_order',p_payload);if v_id is not null then return v_id;end if;
 select * into v_po from public.purchase_orders where id=(p_payload->>'purchase_order_id')::uuid for update;
 if not found then raise exception 'Purchase order not found';end if;
 if (p_payload->>'version')::integer is distinct from v_po.version then raise exception 'Version conflict' using errcode='40001';end if;
 if v_status='submitted' and v_po.status='draft' then null;
 elsif v_status='confirmed' and v_po.status='submitted' then null;
 elsif v_status='cancelled' and v_po.status in ('draft','submitted','confirmed','partial') then
  if nullif(trim(p_payload->>'reason'),'') is null then raise exception 'Cancellation reason required';end if;
 else raise exception 'Invalid purchase transition';end if;
 update public.purchase_orders set status=v_status,version=version+1,
 approved_by=case when v_status='confirmed' then v_actor else approved_by end,
 cancel_reason=case when v_status='cancelled' then p_payload->>'reason' end where id=v_po.id;
 perform private.audit('purchase.'||v_status,v_po.id);
 return private.request_finish(p_key,'transition_purchase_order',p_payload,v_po.id);
end $$;
create or replace function public.transition_purchase_order(payload jsonb,request_key text) returns uuid
language sql security invoker set search_path='' as $$ select private.transition_purchase_order(payload,request_key) $$;

create or replace function private.receive_purchase_order(p_payload jsonb,p_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.require_member(true);v_id uuid;v_po public.purchase_orders%rowtype;v_line jsonb;
 v_item public.purchase_order_items%rowtype;v_quantity numeric;v_base numeric;v_amount numeric;v_total numeric:=0;
 v_receipt_item uuid;v_date date;v_due date;v_unit text;
begin
 v_id:=private.request_start(p_key,'receive_purchase_order',p_payload);if v_id is not null then return v_id;end if;
 perform private.require_lines(p_payload);
 select * into v_po from public.purchase_orders where id=(p_payload->>'purchase_order_id')::uuid for update;
 if not found or v_po.status not in ('confirmed','partial') then raise exception 'Confirmed purchase required';end if;
 if (p_payload->>'version')::integer is distinct from v_po.version then raise exception 'Version conflict' using errcode='40001';end if;
 if (select count(*) from jsonb_array_elements(p_payload->'lines')) <>
 (select count(distinct value->>'purchase_order_item_id') from jsonb_array_elements(p_payload->'lines')) then raise exception 'Duplicate or missing purchase line';end if;
 v_date:=coalesce((p_payload->>'received_date')::date,(now() at time zone 'Asia/Ho_Chi_Minh')::date);
 v_due:=coalesce((p_payload->>'due_date')::date,v_date);
 if v_due<v_date then raise exception 'Due date cannot precede receipt';end if;
 insert into public.goods_receipts(purchase_order_id,received_date,invoice_no,created_by)
 values(v_po.id,v_date,p_payload->>'invoice_no',v_actor) returning id into v_id;
 -- Same material lock is used by physical reconciliation; stable order prevents receipt deadlocks.
 perform 1 from public.materials where id in (select material_id from public.purchase_order_items where purchase_order_id=v_po.id)
 order by id for update;
 for v_line in select value from jsonb_array_elements(p_payload->'lines') order by value->>'purchase_order_item_id' loop
  select * into v_item from public.purchase_order_items where id=(v_line->>'purchase_order_item_id')::uuid and purchase_order_id=v_po.id for update;
  if not found then raise exception 'Purchase line not found';end if;
  v_quantity:=(v_line->>'quantity')::numeric;
  if v_quantity is null or v_quantity<=0 or round(v_quantity,4)<>v_quantity or v_item.received_qty+v_quantity>v_item.quantity then raise exception 'Invalid receipt quantity';end if;
  select base_unit into v_unit from public.materials where id=v_item.material_id and is_active;
  if not found then raise exception 'Inactive material';end if;
  v_base:=v_quantity*v_item.base_qty_per_unit;v_amount:=round(v_quantity*v_item.unit_price,2);
  if round(v_base,4)<>v_base then raise exception 'Base quantity exceeds four decimal precision';end if;
  insert into public.goods_receipt_items(receipt_id,purchase_order_item_id,quantity,base_qty,amount)
  values(v_id,v_item.id,v_quantity,v_base,v_amount) returning id into v_receipt_item;
  insert into public.inventory_transactions(txn_date,txn_no,material_id,txn_type,qty,unit_cost,counterparty,source_system,source_ref,receipt_item_id,created_at)
  values(v_date,v_id::text,v_item.material_id,'nhap',v_base,v_item.unit_price/v_item.base_qty_per_unit,v_po.supplier_id::text,'mobile',v_id::text,v_receipt_item,clock_timestamp());
  update public.purchase_order_items set received_qty=received_qty+v_quantity where id=v_item.id;
  v_total:=v_total+v_amount;
 end loop;
 insert into public.supplier_payables(supplier_id,receipt_id,amount,due_date)
 values(v_po.supplier_id,v_id,v_total,v_due);
 update public.purchase_orders set status=case when not exists(select 1 from public.purchase_order_items
 where purchase_order_id=v_po.id and received_qty<quantity) then 'completed' else 'partial' end,version=version+1 where id=v_po.id;
 perform private.audit('purchase.received',v_id,jsonb_build_object('purchase_order_id',v_po.id,'amount',v_total));
 return private.request_finish(p_key,'receive_purchase_order',p_payload,v_id);
end $$;
create or replace function public.receive_purchase_order(payload jsonb,request_key text) returns uuid
language sql security invoker set search_path='' as $$ select private.receive_purchase_order(payload,request_key) $$;
create or replace function private.pay_supplier(p_payload jsonb,p_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.require_member(true);v_id uuid;v_p public.supplier_payables%rowtype;
 v_amount numeric:=(p_payload->>'amount')::numeric;v_account uuid:=(p_payload->>'account_id')::uuid;
begin
 v_id:=private.request_start(p_key,'pay_supplier',p_payload);if v_id is not null then return v_id;end if;
 select * into v_p from public.supplier_payables where id=(p_payload->>'payable_id')::uuid for update;
 if not found then raise exception 'Payable not found';end if;
 if v_amount is null or v_amount<=0 or round(v_amount,2)<>v_amount or v_amount>v_p.amount-v_p.paid_amount then raise exception 'Invalid supplier payment';end if;
 if not exists(select 1 from public.cash_accounts where id=v_account and is_active) then raise exception 'Active cash account required';end if;
 insert into public.cash_movements(txn_date,account_id,direction,amount,flow_class,kind,supplier_payable_id,idempotency_key,created_by)
 values(coalesce((p_payload->>'txn_date')::date,(now() at time zone 'Asia/Ho_Chi_Minh')::date),
 v_account,'out',v_amount,'operating','supplier_payment',v_p.id,v_actor::text||':'||p_key,v_actor) returning id into v_id;
 update public.supplier_payables set paid_amount=paid_amount+v_amount where id=v_p.id;
 perform private.audit('supplier.paid',v_id);
 return private.request_finish(p_key,'pay_supplier',p_payload,v_id);
end $$;
create or replace function public.pay_supplier(payload jsonb,request_key text) returns uuid
language sql security invoker set search_path='' as $$ select private.pay_supplier(payload,request_key) $$;

create or replace function private.reverse_cash_movement(p_payload jsonb,p_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.require_member(true);v_id uuid;v_m public.cash_movements%rowtype;v_s public.sales%rowtype;v_r public.receivables%rowtype;
begin
 v_id:=private.request_start(p_key,'reverse_cash_movement',p_payload);if v_id is not null then return v_id;end if;
 select * into v_m from public.cash_movements where id=(p_payload->>'movement_id')::uuid;
 if not found or v_m.reverses_id is not null or v_m.kind not in ('sale_collection','debt_collection','supplier_payment') then raise exception 'Reversible collection/payment required';end if;
 if nullif(trim(p_payload->>'reason'),'') is null then raise exception 'Reversal reason required';end if;
 if v_m.sale_id is not null then
  select * into v_s from public.sales where id=v_m.sale_id for update;
  select * into v_r from public.receivables where id=v_m.receivable_id for update;
  if v_s.collected_amount<v_m.amount or v_r.paid_amount<v_m.amount then raise exception 'Refunded collection cannot be fully reversed';end if;
 else
  perform 1 from public.supplier_payables where id=v_m.supplier_payable_id and paid_amount>=v_m.amount for update;
  if not found then raise exception 'Payment balance cannot support reversal';end if;
 end if;
 if exists(select 1 from public.cash_movements where reverses_id=v_m.id) then raise exception 'Movement already reversed';end if;
 insert into public.cash_movements(txn_date,account_id,direction,amount,flow_class,kind,customer_id,route_id,sale_id,receivable_id,supplier_payable_id,reverses_id,idempotency_key,note,created_by)
 values((now() at time zone 'Asia/Ho_Chi_Minh')::date,v_m.account_id,
 case when v_m.direction='in' then 'out' else 'in' end,v_m.amount,v_m.flow_class,'reversal',
 v_m.customer_id,v_m.route_id,v_m.sale_id,v_m.receivable_id,v_m.supplier_payable_id,v_m.id,v_actor::text||':'||p_key,p_payload->>'reason',v_actor)
 returning id into v_id;
 if v_m.sale_id is not null then
  update public.sales set collected_amount=collected_amount-v_m.amount,payment_status=case when collected_amount-v_m.amount=0 then 'unpaid' else 'partial' end,
  version=version+1 where id=v_m.sale_id;
  update public.receivables set paid_amount=paid_amount-v_m.amount,status=case when paid_amount-v_m.amount=0 then 'open' else 'partial' end where id=v_m.receivable_id;
 else update public.supplier_payables set paid_amount=paid_amount-v_m.amount where id=v_m.supplier_payable_id;end if;
 perform private.audit('cash.reversed',v_id,jsonb_build_object('original_id',v_m.id));
 return private.request_finish(p_key,'reverse_cash_movement',p_payload,v_id);
end $$;
create or replace function public.reverse_cash_movement(payload jsonb,request_key text) returns uuid
language sql security invoker set search_path='' as $$ select private.reverse_cash_movement(payload,request_key) $$;
create or replace function private.deny_ledger_mutation() returns trigger language plpgsql set search_path=''
as $$ begin raise exception 'Ledger is append-only; use reversal RPC' using errcode='55000';end $$;
create trigger cash_immutable before update or delete on public.cash_movements for each row execute function private.deny_ledger_mutation();
create trigger cash_no_truncate before truncate on public.cash_movements for each statement execute function private.deny_ledger_mutation();
create trigger inventory_immutable before update or delete on public.inventory_transactions for each row execute function private.deny_ledger_mutation();
create trigger inventory_no_truncate before truncate on public.inventory_transactions for each statement execute function private.deny_ledger_mutation();
create trigger audit_immutable before update or delete on public.audit_events for each row execute function private.deny_ledger_mutation();
create trigger audit_no_truncate before truncate on public.audit_events for each statement execute function private.deny_ledger_mutation();
-- One opening baseline per material; legacy transactions are shown separately, not silently counted twice.
create view public.v_material_stock with(security_invoker=true) as
select m.id material_id,m.code,m.name,m.base_unit,s.snapshot_date baseline_date,s.closing_qty baseline_qty,
 coalesce(t.mobile_delta,0) mobile_delta,
 case when s.id is not null then s.closing_qty+coalesce(t.mobile_delta,0) end qty_on_hand,
 coalesce(t.legacy_unreconciled,0) legacy_unreconciled_count,
 s.id is not null and coalesce(t.legacy_unreconciled,0)=0 is_reconciled
from public.materials m
left join lateral(select * from public.inventory_snapshots where material_id=m.id order by snapshot_date desc,created_at desc,id desc limit 1) s on true
left join lateral(select
 sum(case when txn_type='nhap' then qty when txn_type in ('xuat','hao_hut') then -qty end)
 filter(where receipt_item_id is not null and included_in_snapshot_id is null and txn_date>s.snapshot_date) mobile_delta,
 count(*) filter(where included_in_snapshot_id is null and receipt_item_id is null) legacy_unreconciled
 from public.inventory_transactions where material_id=m.id) t on true;

create or replace function private.set_selling_price(p_payload jsonb,p_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.require_member(true);v_id uuid;v_product uuid:=(p_payload->>'product_id')::uuid;
 v_customer uuid:=nullif(p_payload->>'customer_id','')::uuid;v_tier text:=p_payload->>'price_tier';
 v_date date:=(p_payload->>'effective_from')::date;v_unit public.product_units%rowtype;
begin
 v_id:=private.request_start(p_key,'set_selling_price',p_payload);if v_id is not null then return v_id;end if;
 if v_date is null or v_tier not in ('retail','wholesale') then raise exception 'Valid tier/date required';end if;
 select * into v_unit from public.product_units where product_id=v_product and verified for update;
 if not found then raise exception 'Verified unit required';end if;
 if exists(select 1 from public.selling_prices where product_id=v_product and customer_id is not distinct from v_customer
 and price_tier=v_tier and effective_from>=v_date) then raise exception 'Price history must advance; date overlap';end if;
 update public.selling_prices set effective_to=v_date-1 where product_id=v_product
 and customer_id is not distinct from v_customer and price_tier=v_tier and (effective_to is null or effective_to>=v_date);
 insert into public.selling_prices(product_id,customer_id,price_tier,amount,price_unit,pieces_per_price_unit,effective_from,created_by)
 values(v_product,v_customer,v_tier,(p_payload->>'amount')::numeric,v_unit.price_unit,v_unit.pieces_per_price_unit,v_date,v_actor) returning id into v_id;
 perform private.audit('price.changed',v_id);
 return private.request_finish(p_key,'set_selling_price',p_payload,v_id);
end $$;
create or replace function public.set_selling_price(payload jsonb,request_key text) returns uuid
language sql security invoker set search_path='' as $$ select private.set_selling_price(payload,request_key) $$;
create or replace function private.bind_order_alias(p_payload jsonb,p_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.require_member(true);v_customer uuid:=(p_payload->>'customer_id')::uuid;v_id uuid;
begin
 v_id:=private.request_start(p_key,'bind_order_alias',p_payload);if v_id is not null then return v_id;end if;
 if not exists(select 1 from public.customers where id=v_customer and is_active) then raise exception 'Active customer required';end if;
 update public.order_product_name_rules set customer_id=v_customer
 where alias=p_payload->>'alias' and scope=p_payload->>'scope' and scope<>'general';
 if not found then raise exception 'Scoped alias not found';end if;
 update public.data_review_issues set status='resolved' where kind='unbound_alias_scope' and entity_ref=(p_payload->>'alias')||'/'||(p_payload->>'scope');
 perform private.audit('alias.bound',v_customer,jsonb_build_object('alias',p_payload->>'alias','scope',p_payload->>'scope'));
 return private.request_finish(p_key,'bind_order_alias',p_payload,v_customer);
end $$;
create or replace function public.bind_order_alias(payload jsonb,request_key text) returns uuid
language sql security invoker set search_path='' as $$ select private.bind_order_alias(payload,request_key) $$;
create or replace function private.manage_member(p_payload jsonb,p_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.require_member(true);v_id uuid;v_target uuid:=(p_payload->>'user_id')::uuid;
 v_role text:=p_payload->>'role';v_active boolean:=(p_payload->>'active')::boolean;
begin
 if private.app_role()<>'owner' then raise exception 'Owner required' using errcode='42501';end if;
 v_id:=private.request_start(p_key,'manage_member',p_payload);if v_id is not null then return v_id;end if;
 if v_role is null or v_role not in ('owner','manager','staff') or v_active is null then raise exception 'Valid role and active required';end if;
 -- Serialize membership edits and keep at least one owner; initial owner is bootstrapped by trusted admin.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('phuc-an-membership',0));
 if v_target=v_actor and (v_role<>'owner' or not v_active) then raise exception 'Cannot demote or deactivate self';end if;
 insert into public.app_members(user_id,role,active) values(v_target,v_role,v_active)
 on conflict(user_id) do update set role=excluded.role,active=excluded.active;
 perform private.audit('member.changed',v_target,jsonb_build_object('role',v_role,'active',v_active));
 return private.request_finish(p_key,'manage_member',p_payload,v_target);
end $$;
create or replace function public.manage_member(payload jsonb,request_key text) returns uuid
language sql security invoker set search_path='' as $$ select private.manage_member(payload,request_key) $$;

-- Rebuild public RLS instead of leaving old permissive policies active alongside new restrictions.
do $$
declare p record;t record;v_policy text;
begin
 for p in select schemaname,tablename,policyname from pg_policies where schemaname='public' loop
 execute format('drop policy %I on %I.%I',p.policyname,p.schemaname,p.tablename);end loop;
 for t in select tablename from pg_tables where schemaname='public' loop
 execute format('alter table public.%I enable row level security',t.tablename);
 execute format('revoke all on table public.%I from anon, authenticated',t.tablename);
 execute format('grant select on table public.%I to authenticated',t.tablename);
 if t.tablename='app_members' then v_policy:='user_id=(select auth.uid()) or (select private.app_role())=''owner''';
 elsif t.tablename='customers' then v_policy:='private.can_customer(id)';
 elsif t.tablename in ('customer_orders','customer_activities','customer_tasks','sales','returns','receivables') then v_policy:='private.can_customer(customer_id)';
 elsif t.tablename in ('customer_order_items','customer_order_requests') then v_policy:='exists(select 1 from public.customer_orders o where o.id=order_id and private.can_customer(o.customer_id))';
 elsif t.tablename='sale_items' then v_policy:='exists(select 1 from public.sales s where s.id=sale_id and private.can_customer(s.customer_id))';
 elsif t.tablename='route_assignments' then v_policy:='user_id=(select auth.uid()) or (select private.app_role()) in (''owner'',''manager'')';
 elsif t.tablename='routes' then v_policy:='(select private.app_role()) in (''owner'',''manager'') or exists(select 1 from public.route_assignments a where a.route_id=id and a.user_id=(select auth.uid()) and (select private.app_role())=''staff'')';
 elsif t.tablename='order_product_name_rules' then v_policy:='(select private.app_role()) in (''owner'',''manager'') or ((select private.app_role())=''staff'' and (scope=''general'' or private.can_customer(customer_id)))';
 elsif t.tablename='selling_prices' then v_policy:='(select private.app_role()) is not null and (customer_id is null or private.can_customer(customer_id))';
 elsif t.tablename in ('products','product_units','product_aliases') then v_policy:='(select private.app_role()) is not null';
 else v_policy:='(select private.app_role()) in (''owner'',''manager'')';end if;
 execute format('create policy mobile_read on public.%I for select to authenticated using (%s)',t.tablename,v_policy);
 -- No direct writes to monetary / order / price tables; their invariants are maintained only by RPC.
 if t.tablename in ('customers','suppliers','materials','products','product_units','routes','employees','employee_compensation_terms',
 'fixed_costs','assets','production_daily','production_daily_items','employee_attendance','compensation_policy_drafts','material_prices',
 'product_aliases','route_assignments') then
 execute format('grant insert,update on public.%I to authenticated',t.tablename);
 execute format('create policy manager_insert on public.%I for insert to authenticated with check ((select private.app_role()) in (''owner'',''manager''))',t.tablename);
 execute format('create policy manager_update on public.%I for update to authenticated using ((select private.app_role()) in (''owner'',''manager'')) with check ((select private.app_role()) in (''owner'',''manager''))',t.tablename);
 end if;
 end loop;
end $$;
grant insert on public.customer_activities to authenticated;
create policy activity_insert on public.customer_activities for insert to authenticated
with check(private.can_customer(customer_id) and created_by=(select auth.uid()));
grant insert,update on public.customer_tasks to authenticated;
create policy task_insert on public.customer_tasks for insert to authenticated with check(
 private.can_customer(customer_id) and created_by=(select auth.uid()) and
 ((select private.app_role()) in ('owner','manager') or assigned_to=(select auth.uid())));
create policy task_update on public.customer_tasks for update to authenticated using(
 private.can_customer(customer_id) and ((select private.app_role()) in ('owner','manager') or assigned_to=(select auth.uid())))
with check(private.can_customer(customer_id) and ((select private.app_role()) in ('owner','manager') or
 assigned_to=(select auth.uid())));

revoke all on all tables in schema private from public,anon,authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.app_role(),private.can_customer(uuid) to authenticated;
-- Only the explicitly authenticated business entrypoints are callable by client roles.
grant execute on function private.resolve_order_alias(uuid,text),
 private.save_customer_order(jsonb,text),private.transition_customer_order(jsonb,text),
 private.post_delivery(jsonb,text),private.collect_receivable(jsonb,text),private.return_sale_item(jsonb,text),
 private.save_purchase_order(jsonb,text),private.transition_purchase_order(jsonb,text),
 private.receive_purchase_order(jsonb,text),private.pay_supplier(jsonb,text),private.reverse_cash_movement(jsonb,text),
 private.set_selling_price(jsonb,text),private.bind_order_alias(jsonb,text),private.manage_member(jsonb,text) to authenticated;
revoke all on all functions in schema public from public,anon,authenticated;
grant execute on function public.resolve_order_alias(uuid,text),
 public.save_customer_order(jsonb,text),public.transition_customer_order(jsonb,text),public.post_delivery(jsonb,text),
 public.create_sale_order(jsonb),public.collect_receivable(jsonb,text),public.return_sale_item(jsonb,text),
 public.save_purchase_order(jsonb,text),public.transition_purchase_order(jsonb,text),public.receive_purchase_order(jsonb,text),
 public.pay_supplier(jsonb,text),public.reverse_cash_movement(jsonb,text),public.set_selling_price(jsonb,text),
 public.bind_order_alias(jsonb,text),public.manage_member(jsonb,text) to authenticated;
do $$ declare v record;begin
 for v in select c.relname from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='v' loop
 execute format('revoke all on public.%I from anon,authenticated',v.relname);
 execute format('grant select on public.%I to authenticated',v.relname);end loop;
end $$;
alter default privileges in schema public revoke all on tables from anon,authenticated;
alter default privileges in schema public revoke execute on functions from public,anon,authenticated;
alter default privileges in schema private revoke execute on functions from public,anon,authenticated;
-- No actor or auth identifiers in migrations. No mobile user can bootstrap their own membership.

-- Cost snapshots live in a manager-only table; staff sale line reads cannot expose cost columns.
create or replace view public.v_sale_item_margin with(security_invoker=true) as
select si.id sale_item_id,s.id sale_id,s.sale_date,s.route_id,s.customer_id,si.product_id,p.sku,p.name product_name,
si.qty,si.unit_price,si.discount_pct,si.line_amount,
(c.unit_material_cost_snapshot+0::numeric) estimated_unit_material_cost,
si.qty*c.unit_material_cost_snapshot estimated_material_cost,
si.line_amount-si.qty*c.unit_material_cost_snapshot estimated_contribution_before_returns_and_route_cost
from public.sale_items si join public.sales s on s.id=si.sale_id join public.products p on p.id=si.product_id
left join public.sale_item_costs c on c.sale_item_id=si.id;

create table public.material_stock_baselines(
 material_id uuid primary key references public.materials(id),opening_qty numeric(14,4) not null check(opening_qty>=0),
 snapshot_id uuid references public.inventory_snapshots(id),ledger_cutoff timestamptz not null,
 verified boolean not null default false,recorded_by uuid references public.app_members(user_id)
);
create index stock_baseline_snapshot_idx on public.material_stock_baselines(snapshot_id);
create index stock_baseline_actor_idx on public.material_stock_baselines(recorded_by);
insert into public.material_stock_baselines(material_id,opening_qty,snapshot_id,ledger_cutoff,verified)
select distinct on(material_id) material_id,closing_qty,id,now(),false
from public.inventory_snapshots order by material_id,snapshot_date desc,created_at desc,id desc;
drop view public.v_material_stock;
create view public.v_material_stock with(security_invoker=true) as
select m.id material_id,m.code,m.name,m.base_unit,s.snapshot_date baseline_date,b.opening_qty baseline_qty,
coalesce(t.mobile_delta,0) mobile_delta,
case when b.material_id is not null then b.opening_qty+coalesce(t.mobile_delta,0) end qty_on_hand,
coalesce(t.legacy_unreconciled,0) legacy_unreconciled_count,
coalesce(b.verified,false) and coalesce(t.legacy_unreconciled,0)=0 is_reconciled
from public.materials m left join public.material_stock_baselines b on b.material_id=m.id
left join public.inventory_snapshots s on s.id=b.snapshot_id
left join lateral(select
sum(case when txn_type='nhap' then qty when txn_type in ('xuat','hao_hut') then -qty end)
filter(where receipt_item_id is not null and created_at>b.ledger_cutoff) mobile_delta,
count(*) filter(where receipt_item_id is null and created_at>b.ledger_cutoff) legacy_unreconciled
from public.inventory_transactions where material_id=m.id) t on true;
alter table public.material_stock_baselines enable row level security;
create policy mobile_read on public.material_stock_baselines for select to authenticated
using((select private.app_role()) in ('owner','manager'));
grant select on public.material_stock_baselines to authenticated;
grant select on public.v_material_stock to authenticated;

create or replace function private.reconcile_material_stock(p_payload jsonb,p_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.require_member(true);v_id uuid;v_material uuid:=(p_payload->>'material_id')::uuid;
 v_qty numeric:=(p_payload->>'counted_qty')::numeric;
begin
 v_id:=private.request_start(p_key,'reconcile_material_stock',p_payload);if v_id is not null then return v_id;end if;
 if v_qty is null or v_qty<0 or nullif(trim(p_payload->>'reason'),'') is null then raise exception 'Physical count and reason required';end if;
 perform 1 from public.materials where id=v_material and is_active for update;
 if not found then raise exception 'Active material required';end if;
 insert into public.material_stock_baselines(material_id,opening_qty,ledger_cutoff,verified,recorded_by)
 values(v_material,v_qty,clock_timestamp(),true,v_actor)
 on conflict(material_id) do update set opening_qty=excluded.opening_qty,ledger_cutoff=excluded.ledger_cutoff,
 verified=true,snapshot_id=null,recorded_by=v_actor;
 perform private.audit('stock.reconciled',v_material,jsonb_build_object('counted_qty',v_qty,'reason',p_payload->>'reason'));
 return private.request_finish(p_key,'reconcile_material_stock',p_payload,v_material);
end $$;
create or replace function public.reconcile_material_stock(payload jsonb,request_key text) returns uuid
language sql security invoker set search_path='' as $$ select private.reconcile_material_stock(payload,request_key) $$;
revoke all on function private.reconcile_material_stock(jsonb,text) from public,anon;
revoke all on function public.reconcile_material_stock(jsonb,text) from public,anon;
grant execute on function private.reconcile_material_stock(jsonb,text),public.reconcile_material_stock(jsonb,text) to authenticated;

create or replace function private.guard_task_edit() returns trigger language plpgsql set search_path='' as $$
begin
 if new.created_by is distinct from old.created_by then raise exception 'Task author is immutable';end if;
 if private.app_role()='staff' and (new.customer_id is distinct from old.customer_id or
 new.assigned_to is distinct from old.assigned_to or new.title is distinct from old.title or new.due_at is distinct from old.due_at) then
 raise exception 'Staff can only update task status' using errcode='42501';end if;
 return new;
end $$;
create trigger task_edit_guard before update on public.customer_tasks for each row execute function private.guard_task_edit();
alter table public.customers add constraint customer_credit_config check(credit_policy<>'limited' or (credit_limit is not null and credit_limit>=0));

-- Avoid future-dated material prices in current estimates; past posted costs use immutable snapshots.
create or replace view public.v_latest_material_cost with(security_invoker=true) as
select distinct on(mp.material_id) mp.material_id,m.code material_code,m.name material_name,mp.effective_date,mp.unit_cost,mp.package_unit
from public.material_prices mp join public.materials m on m.id=mp.material_id
where mp.effective_date<=(now() at time zone 'Asia/Ho_Chi_Minh')::date
order by mp.material_id,mp.effective_date desc,mp.created_at desc,mp.id desc;
notify pgrst,'reload schema';
-- PostgreSQL numeric accepts NaN; explicitly exclude non-finite values from all persisted business numbers.
do $$ declare c record;begin
 for c in select cl.relname,a.attname from pg_attribute a join pg_class cl on cl.oid=a.attrelid
 where cl.relnamespace='public'::regnamespace and cl.relkind='r' and a.attnum>0 and not a.attisdropped and a.atttypid='numeric'::regtype loop
 execute format('alter table public.%I add constraint %I check (%I::text not in (''NaN'',''Infinity'',''-Infinity''))',
 c.relname,'finite_'||c.attname,c.attname);end loop;
end $$;
