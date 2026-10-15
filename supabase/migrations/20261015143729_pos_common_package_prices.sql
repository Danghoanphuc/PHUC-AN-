-- Common standard packages confirmed by the business: 1 bi = 10 pieces / 16k;
-- 1 hop = 10 pieces / 40k. Half packages use quantity 0.5, not a second price record.
alter table public.pos_package_prices alter column customer_id drop not null;
create unique index pos_package_prices_common_unit on public.pos_package_prices(package_unit) where customer_id is null;
drop policy package_prices_read on public.pos_package_prices;
create policy package_prices_read on public.pos_package_prices for select to authenticated
 using(private.app_role() is not null and (customer_id is null or private.can_customer(customer_id)));

create or replace function private.set_pos_package_price(p jsonb,k text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_member(true); result uuid; c uuid:=nullif(p->>'customer_id','')::uuid;
 unit text:=p->>'package_unit'; amount numeric:=(p->>'amount')::numeric; pack numeric:=(p->>'pieces_per_package')::numeric;
begin
 result:=private.request_start(k,'set_pos_package_price',p);if result is not null then return result;end if;
 if c is not null and (not exists(select 1 from public.customers where id=c and is_active) or not private.can_customer(c)) then raise exception 'Active customer required';end if;
 if unit is null or unit not in ('bi','hop') or amount is null or amount<=0 or amount>=1e9 or amount<>trunc(amount)
 or pack is null or pack<1 or pack>1000 or pack<>trunc(pack) then raise exception 'Giá và số cái mỗi bì/hộp không hợp lệ';end if;
 if c is null then
  insert into public.pos_package_prices(customer_id,package_unit,amount,pieces_per_package) values(null,unit,amount,pack)
  on conflict(package_unit) where customer_id is null do update set amount=excluded.amount,pieces_per_package=excluded.pieces_per_package,
  version=public.pos_package_prices.version+1,updated_at=now() returning id into result;
 else
  insert into public.pos_package_prices(customer_id,package_unit,amount,pieces_per_package) values(c,unit,amount,pack)
  on conflict(customer_id,package_unit) do update set amount=excluded.amount,pieces_per_package=excluded.pieces_per_package,
  version=public.pos_package_prices.version+1,updated_at=now() returning id into result;
 end if;
 perform private.audit('pos.package_price_set',result,p);
 return private.request_finish(k,'set_pos_package_price',p,result);
end $$;

insert into public.pos_package_prices(customer_id,package_unit,amount,pieces_per_package)
 values(null,'bi',16000,10),(null,'hop',40000,10)
 on conflict(package_unit) where customer_id is null do nothing;

create or replace function private.post_pos_package_sale(p jsonb,k text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_member(); result uuid; c public.customers%rowtype; rate public.pos_package_prices%rowtype;
 l jsonb; resolved jsonb:='[]'::jsonb; qty numeric; total numeric:=0; cash_id uuid; receivable_id uuid;
 day date:=(now() at time zone 'Asia/Ho_Chi_Minh')::date;
begin
 result:=private.request_start(k,'post_pos_package_sale',p);if result is not null then return result;end if;
 perform private.require_lines(p);
 if p ?| array['discount_pct','collected_amount','account_id','unit_price','sale_date'] then raise exception 'POS fields are server controlled' using errcode='42501';end if;
 select * into c from public.customers where id=(p->>'customer_id')::uuid and is_active for update;
 if not found or not private.can_customer(c.id) then raise exception 'Customer outside assigned scope' using errcode='42501';end if;
 if jsonb_array_length(p->'lines')>2 or exists(select 1 from jsonb_array_elements(p->'lines') x group by x->>'package_unit' having count(*)>1) then raise exception 'Duplicate package unit';end if;
 for l in select value from jsonb_array_elements(p->'lines') order by value->>'package_unit' loop
  select * into rate from public.pos_package_prices where (customer_id=c.id or customer_id is null) and package_unit=l->>'package_unit' order by (customer_id is not null) desc limit 1 for share;
  if not found then raise exception 'Khách chưa có giá bì/hộp';end if;
  if (l->>'price_version')::integer is distinct from rate.version or (l ? 'price_id' and (l->>'price_id')::uuid is distinct from rate.id) then raise exception 'Giá đã thay đổi. Tải lại báo giá trước khi chốt';end if;
  qty:=(l->>'quantity')::numeric;
  if qty is null or qty<=0 or qty>100000 or qty<>round(qty,2) or qty*rate.pieces_per_package<>trunc(qty*rate.pieces_per_package) then raise exception 'Số lượng bì/hộp không hợp lệ';end if;
  total:=total+qty*rate.amount;
  resolved:=resolved||jsonb_build_array(jsonb_build_object('unit',rate.package_unit,'quantity',qty,'amount',rate.amount,'pack',rate.pieces_per_package));
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
 for l in select value from jsonb_array_elements(resolved) loop
  insert into public.pos_package_lines(sale_id,package_unit,quantity,unit_price,pieces_per_package)
  values(result,l->>'unit',(l->>'quantity')::numeric,(l->>'amount')::numeric,(l->>'pack')::integer);
 end loop;
 insert into public.receivables(sale_id,customer_id,amount,paid_amount,due_date,status)
 values(result,c.id,total,total,day,'paid') returning id into receivable_id;
 insert into public.cash_movements(txn_date,account_id,direction,amount,flow_class,kind,customer_id,route_id,sale_id,receivable_id,idempotency_key,created_by)
 values(day,cash_id,'in',total,'operating','sale_collection',c.id,c.route_id,result,receivable_id,actor::text||':'||k||':package',actor);
 perform private.audit('pos.package_sale_posted',result,p);
 return private.request_finish(k,'post_pos_package_sale',p,result);
end $$;

notify pgrst,'reload schema';
