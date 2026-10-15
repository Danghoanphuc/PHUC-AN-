-- Administrative smoke test; all generated fixtures and transactions are rolled back.
begin;
do $test$
declare manager uuid:=gen_random_uuid(); staff uuid:=gen_random_uuid(); route uuid:=gen_random_uuid(); customer uuid:=gen_random_uuid();
 product uuid:=gen_random_uuid(); sale uuid; line uuid; p jsonb; price uuid; allocated uuid;
begin
 insert into auth.users(id) values(manager),(staff);
 insert into public.app_members(user_id,role) values(manager,'manager'),(staff,'staff');
 insert into public.routes(id,code,name) values(route,'QA-'||route::text,'Quantity POS smoke');
 insert into public.route_assignments(user_id,route_id) values(staff,route);
 insert into public.customers(id,code,name,route_id) values(customer,'QA-'||customer::text,'Quantity POS smoke',route);
 insert into public.products(id,sku,name,sale_unit) values(product,'QA-'||product::text,'Quantity smoke cake','cái');
 perform set_config('request.jwt.claim.sub',manager::text,true);
 price:=public.set_pos_package_price(jsonb_build_object('customer_id',customer,'package_unit','bi','amount',40000,'pieces_per_package',10),'quantity-smoke-price');
 perform set_config('request.jwt.claim.sub',staff::text,true);
 p:=jsonb_build_object('customer_id',customer,'expected_total',100000,'lines',jsonb_build_array(jsonb_build_object('package_unit','bi','quantity',2.5,'price_version',1)));
 sale:=public.post_pos_package_sale(p,'quantity-smoke-sale');
 if public.post_pos_package_sale(p,'quantity-smoke-sale')<>sale then raise exception 'Sale retry duplicated';end if;
 if exists(select 1 from public.sale_items where sale_id=sale) then raise exception 'Product was required before collection';end if;
 select id into line from public.pos_package_lines where sale_id=sale;
 p:=jsonb_build_object('sale_id',sale,'version',1,'lines',jsonb_build_array(jsonb_build_object('line_id',line,'product_id',product,'quantity',2.5)));
 allocated:=public.allocate_pos_packages(p,'quantity-smoke-allocate');
 if public.allocate_pos_packages(p,'quantity-smoke-allocate')<>sale then raise exception 'Allocation retry duplicated';end if;
 if (select status from public.pos_package_sales where id=sale)<>'complete' then raise exception 'Allocation incomplete';end if;
 if (select sum(line_amount) from public.sale_items where sale_id=sale)<>100000 then raise exception 'Allocation repriced sale';end if;
 if (select count(*) from public.cash_movements where sale_id=sale)<>1 then raise exception 'Cash duplicated';end if;
 if (public.pos_summary()->>'balance')::numeric<>100000 then raise exception 'Wallet incorrect';end if;
 if not exists(select 1 from public.receivables where sale_id=sale and amount=100000 and paid_amount=100000) then raise exception 'Receivable incorrect';end if;
 perform set_config('phucan.quantity_smoke','passed',true);
end $test$;
select current_setting('phucan.quantity_smoke') as quantity_first_smoke;
rollback;
