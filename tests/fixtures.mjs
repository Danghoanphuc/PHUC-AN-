export const ids = Object.fromEntries(['owner','manager','staff','outsider','route','otherRoute','customer','otherCustomer','donut','kem','tieu','missing','material','supplier','account'].map((k,i)=>[k,`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`]));
export const catalogueSeed = `
insert into public.routes(id,code,name) values('${ids.route}','R1','Test route'),('${ids.otherRoute}','R2','Other route');
insert into public.customers(id,code,name,route_id,customer_type) values
('${ids.customer}','C1','Test wholesale','${ids.route}','Đại lý'),('${ids.otherCustomer}','C2','Other','${ids.otherRoute}','Đại lý');
insert into public.products(id,sku,name,sale_unit,wholesale_price) values
('${ids.donut}','TEST_DONUT','Donut','cái',4000),('${ids.kem}','TEST_KEM','Kem','bì 5',17500),
('${ids.tieu}','TEST_TIEU','Tiêu','bì 10',15000),('${ids.missing}','TEST_MISSING','Missing','cái',null);
insert into public.materials(id,code,name,base_unit) values('${ids.material}','TEST_FLOUR','Flour','kg');
insert into public.material_prices(material_id,effective_date,package_price,package_qty,package_unit)
values('${ids.material}','2026-09-01',10000,1,'kg');
insert into public.recipes(id,product_id,effective_date,yield_qty,yield_unit)
values('10000000-0000-4000-8000-000000000001','${ids.donut}','2026-09-01',1,'cái');
insert into public.recipe_items(recipe_id,material_id,qty,unit)
values('10000000-0000-4000-8000-000000000001','${ids.material}',0.1,'kg');
insert into public.inventory_snapshots(material_id,snapshot_date,closing_qty) values('${ids.material}','2026-09-24',100);
insert into public.suppliers(id,code,name) values('${ids.supplier}','S1','Test supplier');
insert into public.cash_accounts(id,code,name,account_type) values('${ids.account}','A1','Test cash','cash');
insert into public.order_product_name_rules(alias,scope,canonical_name,product_id,member_skus,confirmed_on) values
('donut','general','Donut','${ids.donut}','{}','2026-10-07'),('mixed','general','Group',null,array['TEST_DONUT','TEST_KEM'],'2026-10-07'),
('scoped','Test scope','Kem','${ids.kem}','{}','2026-10-07');
`;
export const memberSeed = `
insert into auth.users(id) values('${ids.owner}'),('${ids.manager}'),('${ids.staff}'),('${ids.outsider}');
insert into public.app_members(user_id,role) values('${ids.owner}','owner'),('${ids.manager}','manager'),('${ids.staff}','staff');
insert into public.route_assignments(user_id,route_id) values('${ids.staff}','${ids.route}');
update public.customers set credit_policy='unlimited' where id='${ids.customer}';
`;
