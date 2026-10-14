-- Run only through the authorized administrative connection. All fixtures are rolled back.
begin;

insert into public.routes(id,code,name) values('00000000-0000-4000-8000-000000000005','R1','Test route'),('00000000-0000-4000-8000-000000000006','R2','Other route');
insert into public.customers(id,code,name,route_id,customer_type) values
('00000000-0000-4000-8000-000000000007','C1','Test wholesale','00000000-0000-4000-8000-000000000005','Đại lý'),('00000000-0000-4000-8000-000000000008','C2','Other','00000000-0000-4000-8000-000000000006','Đại lý');
insert into public.products(id,sku,name,sale_unit,wholesale_price) values
('00000000-0000-4000-8000-000000000009','TEST_DONUT','Donut','cái',4000),('00000000-0000-4000-8000-000000000010','TEST_KEM','Kem','bì 5',17500),
('00000000-0000-4000-8000-000000000011','TEST_TIEU','Tiêu','bì 10',15000),('00000000-0000-4000-8000-000000000012','TEST_MISSING','Missing','cái',null);
insert into public.materials(id,code,name,base_unit) values('00000000-0000-4000-8000-000000000013','TEST_FLOUR','Flour','kg');
insert into public.material_prices(material_id,effective_date,package_price,package_qty,package_unit)
values('00000000-0000-4000-8000-000000000013','2026-09-01',10000,1,'kg');
insert into public.recipes(id,product_id,effective_date,yield_qty,yield_unit)
values('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000009','2026-09-01',1,'cái');
insert into public.recipe_items(recipe_id,material_id,qty,unit)
values('10000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000013',0.1,'kg');
insert into public.inventory_snapshots(material_id,snapshot_date,closing_qty) values('00000000-0000-4000-8000-000000000013','2026-09-24',100);
insert into public.suppliers(id,code,name) values('00000000-0000-4000-8000-000000000014','S1','Test supplier');
insert into public.cash_accounts(id,code,name,account_type) values('00000000-0000-4000-8000-000000000015','A1','Test cash','cash');
insert into public.order_product_name_rules(alias,scope,canonical_name,product_id,member_skus,confirmed_on) values
('donut','general','Donut','00000000-0000-4000-8000-000000000009','{}','2026-10-07'),('mixed','general','Group',null,array['TEST_DONUT','TEST_KEM'],'2026-10-07'),
('scoped','Test scope','Kem','00000000-0000-4000-8000-000000000010','{}','2026-10-07');


insert into auth.users(id) values('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002'),('00000000-0000-4000-8000-000000000003'),('00000000-0000-4000-8000-000000000004');
insert into public.app_members(user_id,role) values('00000000-0000-4000-8000-000000000001','owner'),('00000000-0000-4000-8000-000000000002','manager'),('00000000-0000-4000-8000-000000000003','staff');
insert into public.route_assignments(user_id,route_id) values('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000005');
update public.customers set credit_policy='unlimited' where id='00000000-0000-4000-8000-000000000007';

insert into public.product_units(product_id,price_unit,pieces_per_price_unit,verified)
select id,sale_unit,case sale_unit when 'cái' then 1 when 'bì 5' then 5 else 10 end,true
from public.products where sku like 'TEST_%';
insert into public.selling_prices(product_id,price_tier,amount,price_unit,pieces_per_price_unit,effective_from)
select p.id,'wholesale',p.wholesale_price,u.price_unit,u.pieces_per_price_unit,'2026-10-14'
from public.products p join public.product_units u on u.product_id=p.id where p.sku like 'TEST_%' and p.wholesale_price is not null;
insert into public.material_stock_baselines(material_id,opening_qty,ledger_cutoff,verified)
values('00000000-0000-4000-8000-000000000013',100,clock_timestamp(),true);
do $pos$
declare s uuid;again uuid;p jsonb;new_customer uuid;close_id uuid;failed boolean:=false;
begin
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
 p:=jsonb_build_object('customer_id','00000000-0000-4000-8000-000000000007','expected_total',75000,'note','Live POS verification','lines',jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-8000-000000000009','order_qty',1),jsonb_build_object('product_id','00000000-0000-4000-8000-000000000010','order_qty',1)));
 s:=public.post_pos_sale(p,'live-pos-fixed-key');again:=public.post_pos_sale(p,'live-pos-fixed-key');if s<>again then raise exception 'POS duplicate';end if;
 if not exists(select 1 from public.sales where id=s and net_amount=75000 and collected_amount=75000 and note='Live POS verification') then raise exception 'POS sale totals incorrect';end if;
 if (select count(*) from public.cash_movements where sale_id=s and amount=75000)<>1 then raise exception 'POS cash incorrect';end if;
 new_customer:=public.create_pos_customer(jsonb_build_object('name','Live POS partner','route_id','00000000-0000-4000-8000-000000000005'),'live-pos-new-customer');
 if not exists(select 1 from public.customers where id=new_customer and assigned_to='00000000-0000-4000-8000-000000000003' and credit_limit=0) then raise exception 'POS customer scope incorrect';end if;
 begin perform public.post_pos_sale(p||jsonb_build_object('customer_id','00000000-0000-4000-8000-000000000008'),'live-pos-escape');exception when insufficient_privilege then failed:=true;end;if not failed then raise exception 'POS scope escaped';end if;
 if (public.pos_summary()->>'balance')::numeric<>75000 then raise exception 'Wallet summary incorrect';end if;
 close_id:=public.submit_pos_close('{"expected_amount":75000,"counted_amount":74000,"note":"Live shortage verification"}','live-close-key');
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
 p:=jsonb_build_object('close_id',close_id,'action','received','destination_id','00000000-0000-4000-8000-000000000015');
 perform public.review_pos_close(p,'live-receive-key');perform public.review_pos_close(p,'live-receive-key');
 if (select count(*) from public.cash_movements where transfer_group=close_id)<>2 then raise exception 'Handover duplicate';end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
 if (public.pos_summary()->>'balance')::numeric<>1000 then raise exception 'Shortage erased';end if;
 update public.customers set customer_type='Khách lẻ',phone=null where id=new_customer;
 p:=jsonb_build_object('customer_id',new_customer,'name','Known retail fixture','phone','0912 345 678','expected_name','Live POS partner','expected_phone',null);
 perform public.update_retail_customer_contact(p,'live-contact-key');perform public.update_retail_customer_contact(p,'live-contact-key');
 if not exists(select 1 from public.customers where id=new_customer and name='Known retail fixture' and phone='0912345678') then raise exception 'Retail contact failed';end if;
end $pos$;
rollback;
select 'Live POS sale, collection, scope, close, handover, retail contact and idempotency passed; fixtures rolled back' as verification;
