-- Quantity-first POS. Cash is posted once; product allocation is separate and cannot reprice a sale.
create table public.pos_package_prices (
 id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id),
 package_unit text not null check(package_unit in ('bi','hop')),
 amount numeric not null check(amount>0 and amount<1e9 and amount=trunc(amount)),
 pieces_per_package integer not null check(pieces_per_package between 1 and 1000),
 version integer not null default 1, updated_at timestamptz not null default now(),
 unique(customer_id,package_unit)
);
create table public.pos_package_sales (
 id uuid primary key references public.sales(id), customer_id uuid not null references public.customers(id),
 created_by uuid not null references public.app_members(user_id),
 status text not null default 'pending' check(status in ('pending','complete')),
 version integer not null default 1, created_at timestamptz not null default now()
);
create index pos_package_sales_customer on public.pos_package_sales(customer_id);
create index pos_package_sales_actor on public.pos_package_sales(created_by,created_at desc);
create table public.pos_package_lines (
 id uuid primary key default gen_random_uuid(), sale_id uuid not null references public.pos_package_sales(id),
 package_unit text not null check(package_unit in ('bi','hop')),
 quantity numeric not null check(quantity>0 and quantity<=100000 and quantity=round(quantity,2)),
 unit_price numeric not null check(unit_price>0 and unit_price<1e9 and unit_price=trunc(unit_price)),
 pieces_per_package integer not null check(pieces_per_package between 1 and 1000),
 unique(sale_id,package_unit), check(quantity*pieces_per_package=trunc(quantity*pieces_per_package))
);
create table public.pos_package_allocations (
 id uuid primary key default gen_random_uuid(), line_id uuid not null references public.pos_package_lines(id),
 product_id uuid not null references public.products(id),
 quantity numeric not null check(quantity>0 and quantity<=100000 and quantity=round(quantity,2)),
 unique(line_id,product_id)
);
create index pos_package_allocations_product on public.pos_package_allocations(product_id);
create function private.can_package_sale(s uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.pos_package_sales x where x.id=s and private.can_customer(x.customer_id)
 and (private.app_role() in ('owner','manager') or x.created_by=auth.uid()))
$$;
revoke all on function private.can_package_sale(uuid) from public,anon;
grant execute on function private.can_package_sale(uuid) to authenticated;
alter table public.pos_package_prices enable row level security;
alter table public.pos_package_sales enable row level security;
alter table public.pos_package_lines enable row level security;
alter table public.pos_package_allocations enable row level security;
revoke all on public.pos_package_prices,public.pos_package_sales,public.pos_package_lines,public.pos_package_allocations from public,anon,authenticated;
grant select on public.pos_package_prices,public.pos_package_sales,public.pos_package_lines,public.pos_package_allocations to authenticated;
create policy package_prices_read on public.pos_package_prices for select to authenticated using(private.can_customer(customer_id));
create policy package_sales_read on public.pos_package_sales for select to authenticated using(private.can_package_sale(id));
create policy package_lines_read on public.pos_package_lines for select to authenticated using(private.can_package_sale(sale_id));
create policy package_allocations_read on public.pos_package_allocations for select to authenticated
 using(exists(select 1 from public.pos_package_lines l where l.id=line_id and private.can_package_sale(l.sale_id)));

create function private.set_pos_package_price(p jsonb,k text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_member(true); result uuid; c uuid:=(p->>'customer_id')::uuid;
 unit text:=p->>'package_unit'; amount numeric:=(p->>'amount')::numeric; pack numeric:=(p->>'pieces_per_package')::numeric;
begin
 result:=private.request_start(k,'set_pos_package_price',p);if result is not null then return result;end if;
 if not exists(select 1 from public.customers where id=c and is_active) or not private.can_customer(c) then raise exception 'Active customer required';end if;
 if unit is null or unit not in ('bi','hop') or amount is null or amount<=0 or amount>=1e9 or amount<>trunc(amount)
 or pack is null or pack<1 or pack>1000 or pack<>trunc(pack) then raise exception 'Giá và số cái mỗi bì/hộp không hợp lệ';end if;
 insert into public.pos_package_prices(customer_id,package_unit,amount,pieces_per_package) values(c,unit,amount,pack)
 on conflict(customer_id,package_unit) do update set amount=excluded.amount,pieces_per_package=excluded.pieces_per_package,
 version=public.pos_package_prices.version+1,updated_at=now() returning id into result;
 perform private.audit('pos.package_price_set',result,p);
 return private.request_finish(k,'set_pos_package_price',p,result);
end $$;
create function public.set_pos_package_price(payload jsonb,request_key text) returns uuid language sql security invoker set search_path='' as $$select private.set_pos_package_price(payload,request_key)$$;

create function private.post_pos_package_sale(p jsonb,k text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_member(); result uuid; c public.customers%rowtype; rate public.pos_package_prices%rowtype;
 l jsonb; qty numeric; total numeric:=0; cash_id uuid; receivable_id uuid;
 day date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 result:=private.request_start(k,'post_pos_package_sale',p);if result is not null then return result;end if;
 perform private.require_lines(p);
 if p ?| array['discount_pct','collected_amount','account_id','unit_price','sale_date'] then raise exception 'POS fields are server controlled' using errcode='42501';end if;
 select * into c from public.customers where id=(p->>'customer_id')::uuid and is_active for update;
 if not found or not private.can_customer(c.id) then raise exception 'Customer outside assigned scope' using errcode='42501';end if;
 if jsonb_array_length(p->'lines')>2 or exists(select 1 from jsonb_array_elements(p->'lines') x group by x->>'package_unit' having count(*)>1) then raise exception 'Duplicate package unit';end if;
 for l in select value from jsonb_array_elements(p->'lines') order by value->>'package_unit' loop
  select * into rate from public.pos_package_prices where customer_id=c.id and package_unit=l->>'package_unit' for share;
  if not found then raise exception 'Khách chưa có giá bì/hộp';end if;
  if (l->>'price_version')::integer is distinct from rate.version then raise exception 'Giá đã thay đổi. Tải lại báo giá trước khi chốt';end if;
  qty:=(l->>'quantity')::numeric;
  if qty is null or qty<=0 or qty>100000 or qty<>round(qty,2) or qty*rate.pieces_per_package<>trunc(qty*rate.pieces_per_package) then raise exception 'Số lượng bì/hộp không hợp lệ';end if;
  total:=total+qty*rate.amount;
 end loop;
 if (p->>'expected_total')::numeric is distinct from total or total<=0 then raise exception 'POS total changed; refresh prices and order';end if;
 perform pg_advisory_xact_lock(hashtextextended('pos-wallet:'||actor::text,0));
 select account_id into cash_id from private.pos_wallets where user_id=actor;
 if cash_id is null then
  insert into public.cash_accounts(code,name,account_type) values('POS-'||actor::text,'POS · '||coalesce((select nullif(full_name,'') from public.member_profiles where user_id=actor),actor::text),'cash') returning id into cash_id;
  insert into private.pos_wallets(user_id,account_id) values(actor,cash_id);
 end if;
 insert into public.sales(sale_date,customer_id,route_id,created_by,idempotency_key,note,gross_amount,collected_amount,payment_status)
 values(day,c.id,c.route_id,actor,k,left(coalesce(p->>'note',''),2000),total,total,'paid') returning id into result;
 insert into public.pos_package_sales(id,customer_id,created_by) values(result,c.id,actor);
 for l in select value from jsonb_array_elements(p->'lines') loop
  select * into rate from public.pos_package_prices where customer_id=c.id and package_unit=l->>'package_unit';
  insert into public.pos_package_lines(sale_id,package_unit,quantity,unit_price,pieces_per_package)
  values(result,rate.package_unit,(l->>'quantity')::numeric,rate.amount,rate.pieces_per_package);
 end loop;
 insert into public.receivables(sale_id,customer_id,amount,paid_amount,due_date,status)
 values(result,c.id,total,total,day,'paid') returning id into receivable_id;
 insert into public.cash_movements(txn_date,account_id,direction,amount,flow_class,kind,customer_id,route_id,sale_id,receivable_id,idempotency_key,created_by)
 values(day,cash_id,'in',total,'operating','sale_collection',c.id,c.route_id,result,receivable_id,actor::text||':'||k||':package',actor);
 perform private.audit('pos.package_sale_posted',result,p);
 return private.request_finish(k,'post_pos_package_sale',p,result);
end $$;
create function public.post_pos_package_sale(payload jsonb,request_key text) returns uuid language sql security invoker set search_path='' as $$select private.post_pos_package_sale(payload,request_key)$$;

-- Replaces the saved allocation draft atomically. Product sale items are materialized exactly once, when all packages are assigned.
create function private.allocate_pos_packages(p jsonb,k text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_member(); result uuid; sale public.pos_package_sales%rowtype;
 line public.pos_package_lines%rowtype; allocation jsonb; qty numeric; allocated numeric; complete boolean:=true;
 item_id uuid; item_cost numeric; day date;
begin
 result:=private.request_start(k,'allocate_pos_packages',p);if result is not null then return result;end if;
 select * into sale from public.pos_package_sales where id=(p->>'sale_id')::uuid for update;
 if not found or not private.can_package_sale(sale.id) then raise exception 'Sale outside assigned scope' using errcode='42501';end if;
 if sale.status='complete' then raise exception 'Chi tiết bánh đã hoàn tất';end if;
 if (p->>'version')::integer is distinct from sale.version then raise exception 'Version conflict' using errcode='40001';end if;
 if jsonb_typeof(p->'lines') is distinct from 'array' then raise exception 'lines must be an array';end if;
 if exists(select 1 from jsonb_array_elements(p->'lines') x group by x->>'line_id',x->>'product_id' having count(*)>1) then raise exception 'Duplicate allocation';end if;
 delete from public.pos_package_allocations where line_id in (select id from public.pos_package_lines where sale_id=sale.id);
 for allocation in select value from jsonb_array_elements(p->'lines') loop
  select * into line from public.pos_package_lines where id=(allocation->>'line_id')::uuid and sale_id=sale.id;
  if not found then raise exception 'Package line not found';end if;
  if not exists(select 1 from public.products where id=(allocation->>'product_id')::uuid and is_active) then raise exception 'Inactive product';end if;
  qty:=(allocation->>'quantity')::numeric;
  if qty is null or qty<=0 or qty>line.quantity or qty<>round(qty,2) or qty*line.pieces_per_package<>trunc(qty*line.pieces_per_package) then raise exception 'Số lượng phân bổ không hợp lệ';end if;
  insert into public.pos_package_allocations(line_id,product_id,quantity) values(line.id,(allocation->>'product_id')::uuid,qty);
 end loop;
 for line in select * from public.pos_package_lines where sale_id=sale.id loop
  select coalesce(sum(quantity),0) into allocated from public.pos_package_allocations where line_id=line.id;
  if allocated>line.quantity then raise exception 'Không được điền vượt số bì/hộp đã bán';end if;
  complete:=complete and allocated=line.quantity;
 end loop;
 if complete then
  select sale_date into day from public.sales where id=sale.id for update;
  for line in select * from public.pos_package_lines where sale_id=sale.id loop
   for allocation in select jsonb_build_object('product_id',product_id,'quantity',quantity) from public.pos_package_allocations where line_id=line.id loop
    insert into public.sale_items(sale_id,product_id,qty,unit_price,discount_pct,qty_delivered,price_unit_snapshot,pieces_per_price_unit_snapshot)
    values(sale.id,(allocation->>'product_id')::uuid,(allocation->>'quantity')::numeric,line.unit_price,0,(allocation->>'quantity')::numeric,
    case line.package_unit when 'bi' then 'bì' else 'hộp' end,line.pieces_per_package) returning id into item_id;
    item_cost:=private.product_cost((allocation->>'product_id')::uuid,day,line.pieces_per_package);
    insert into public.sale_item_costs(sale_item_id,unit_material_cost_snapshot,cost_complete) values(item_id,item_cost,item_cost is not null);
   end loop;
  end loop;
 end if;
 update public.pos_package_sales set status=case when complete then 'complete' else 'pending' end,version=version+1 where id=sale.id;
 perform private.audit('pos.packages_allocated',sale.id,p);
 return private.request_finish(k,'allocate_pos_packages',p,sale.id);
end $$;
create function public.allocate_pos_packages(payload jsonb,request_key text) returns uuid language sql security invoker set search_path='' as $$select private.allocate_pos_packages(payload,request_key)$$;
revoke all on function private.set_pos_package_price(jsonb,text),public.set_pos_package_price(jsonb,text),private.post_pos_package_sale(jsonb,text),public.post_pos_package_sale(jsonb,text),private.allocate_pos_packages(jsonb,text),public.allocate_pos_packages(jsonb,text) from public,anon;
grant execute on function private.set_pos_package_price(jsonb,text),public.set_pos_package_price(jsonb,text),private.post_pos_package_sale(jsonb,text),public.post_pos_package_sale(jsonb,text),private.allocate_pos_packages(jsonb,text),public.allocate_pos_packages(jsonb,text) to authenticated;
notify pgrst,'reload schema';

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
 case when bool_and(coalesce(sc.complete,false)) then sum(sc.cost) end original_cost
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


create or replace function private.pos_summary() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_member(); result jsonb;
begin
 select jsonb_build_object('balance',coalesce((select sum(case when m.direction='in' then m.amount else -m.amount end)
 from public.cash_movements m join private.pos_wallets w on w.account_id=m.account_id where w.user_id=actor),0),
 'sales',coalesce((select jsonb_agg(x order by x.created_at desc) from (
 select s.id,s.sale_date,s.created_at,s.net_amount,s.collected_amount,s.note,s.customer_id,c.name customer_name,
 (select jsonb_agg(jsonb_build_object('name',p.name,'pieces',(i.qty_delivered-i.qty_returned)*coalesce(i.pieces_per_price_unit_snapshot,1),'amount',i.line_amount))
 from public.sale_items i join public.products p on p.id=i.product_id where i.sale_id=s.id) items
 from public.sales s left join public.customers c on c.id=s.customer_id where s.created_by=actor
 order by s.created_at desc limit 200) x),'[]'::jsonb)) into result;
 return result;
end $$;
