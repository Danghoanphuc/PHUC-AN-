-- Truy vấn chỉ đọc phục vụ khảo sát; chạy bằng tài khoản quản trị được phép.
-- Không có DDL/DML; không đọc số điện thoại, tên khách hay dữ liệu lương.

select n.nspname, c.relname, c.relkind, c.relrowsecurity, c.reloptions
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p','v','m')
order by c.relkind,c.relname;

select table_name,column_name,data_type,is_nullable,column_default
from information_schema.columns where table_schema='public'
order by table_name,ordinal_position;

select conrelid::regclass as table_name,conname,pg_get_constraintdef(oid)
from pg_constraint where connamespace='public'::regnamespace;

select * from pg_policies where schemaname='public';
select * from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','authenticated');

select n.nspname,p.proname,p.prosecdef,p.proacl,pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private') and p.prokind='f';

select c.relname,pg_get_viewdef(c.oid,true)
from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='v';

select tgrelid::regclass,pg_get_triggerdef(t.oid)
from pg_trigger t join pg_class c on c.oid=t.tgrelid
where c.relnamespace='public'::regnamespace and not t.tgisinternal;

select count(*) as products,
count(*) filter (where is_active) as active_products,
count(*) filter (where list_price is null) as missing_list_price,
count(*) filter (where is_active and wholesale_price is null) as active_missing_wholesale
from public.products;

select count(*) as customers,
count(*) filter(where nullif(trim(phone),'') is null) as missing_phone,
count(*) filter(where credit_limit is null) as missing_credit_limit
from public.customers;

select count(*) as prices,count(*) filter(where supplier_id is null) as missing_supplier
from public.material_prices;

select m.code,m.base_unit,mp.package_unit,mp.package_qty,mp.unit_cost
from public.material_prices mp join public.materials m on m.id=mp.material_id
where mp.package_unit<>m.base_unit;

select count(*) as recipe_unit_mismatches
from public.recipe_items ri join public.materials m on m.id=ri.material_id
where ri.unit<>m.base_unit;

select min(snapshot_date),max(snapshot_date),count(*) filter(where closing_qty<0) as negative_stock
from public.inventory_snapshots;

select count(*) as unmapped_production_items
from public.production_daily_items where product_id is null;

select count(*) as rules_without_single_product
from public.order_product_name_rules where product_id is null;

select count(*) as app_members from public.app_members;
select count(*) as auth_users from auth.users;
