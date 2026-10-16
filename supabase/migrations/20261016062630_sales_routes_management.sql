-- Initial suggestions follow the 12 communes/township of former Mang Yang.
-- Seed once; never reactivate or rename a user's existing route automatically.
alter table public.routes add column version integer not null default 1 check(version>0);
insert into public.routes(code,name,note)
select seed.code,seed.name,'Địa bàn huyện Mang Yang trước sắp xếp năm 2025; có thể tùy chỉnh.'
from (values
 ('R-CHO_HUYEN','Kon Dơng'),('R-AYUN','Ayun'),('R-DAK_TA_LEY','Đak Ta Ley'),
 ('R-DAK_YA','Đăk Yă'),('R-DAK_DJRANG','Đak Djrăng'),('R-HRA','Hra'),
 ('R-KON_THUP','Kon Thụp'),('R-DAK_JO_TA','Đak Jơ Ta'),('R-LO_PANG','Lơ Pang'),
 ('R-DE_AR','Đê Ar'),('R-KON_CHIENG','Kon Chiêng'),('R-DAK_TROI','Đăk Trôi')
) seed(code,name)
where not exists(select 1 from public.routes r where r.code=seed.code or lower(trim(r.name))=lower(seed.name));

-- Managers need staff names/status to assign routes, without access to owner/other manager memberships.
create policy route_staff_read on public.app_members for select to authenticated
using((select private.app_role())='manager' and role='staff');
revoke insert,update on public.routes,public.route_assignments from authenticated;

create function private.save_sales_route(payload jsonb,request_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_member(true); result uuid; r public.routes%rowtype;
 route_id uuid:=nullif(payload->>'route_id','')::uuid; route_name text:=trim(payload->>'name');
 enabled boolean;
begin
 result:=private.request_start(request_key,'save_sales_route',payload);if result is not null then return result;end if;
 if payload-array['route_id','name','note','is_active','expected_version']<>'{}'::jsonb
  or route_name is null or length(route_name)<1 or length(route_name)>100
  or length(coalesce(payload->>'note',''))>1000 then raise exception 'Tên tuyến cần từ 1 đến 100 ký tự; ghi chú tối đa 1000 ký tự';end if;
 if payload ? 'is_active' and jsonb_typeof(payload->'is_active') is distinct from 'boolean' then raise exception 'Trạng thái tuyến không hợp lệ';end if;
 perform pg_advisory_xact_lock(hashtextextended('sales-route-catalogue',0));
 if route_id is not null then
  select * into r from public.routes where id=route_id for update;
  if not found then raise exception 'Không tìm thấy tuyến';end if;
  if (payload->>'expected_version')::integer is distinct from r.version then raise exception 'Tuyến đã thay đổi. Tải lại trước khi lưu';end if;
 end if;
 if exists(select 1 from public.routes where lower(trim(name))=lower(route_name) and id is distinct from route_id) then
  raise exception 'Tên tuyến đã có. Hãy sửa hoặc khôi phục tuyến đó';end if;
 enabled:=coalesce((payload->>'is_active')::boolean,case when route_id is null then true else r.is_active end);
 if route_id is null then
  insert into public.routes(code,name,note,is_active) values('R-'||gen_random_uuid()::text,route_name,nullif(trim(payload->>'note'),''),enabled) returning id into route_id;
 else
  update public.routes set name=route_name,note=nullif(trim(payload->>'note'),''),is_active=enabled,version=version+1 where id=route_id;
 end if;
 perform private.audit('route.saved',route_id,jsonb_build_object('before',case when r.id is null then null else to_jsonb(r) end,'name',route_name,'is_active',enabled));
 return private.request_finish(request_key,'save_sales_route',payload,route_id);
end $$;
create function public.save_sales_route(payload jsonb,request_key text) returns uuid
language sql security invoker set search_path='' as $$select private.save_sales_route(payload,request_key)$$;

create function private.set_sales_route_staff(payload jsonb,request_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_member(true); result uuid; r public.routes%rowtype; staff_ids uuid[];
begin
 result:=private.request_start(request_key,'set_sales_route_staff',payload);if result is not null then return result;end if;
 if payload-array['route_id','user_ids','expected_version']<>'{}'::jsonb or jsonb_typeof(payload->'user_ids') is distinct from 'array' then raise exception 'Danh sách phân công không hợp lệ';end if;
 select * into r from public.routes where id=(payload->>'route_id')::uuid for update;
 if not found or not r.is_active then raise exception 'Chọn tuyến đang dùng';end if;
 if (payload->>'expected_version')::integer is distinct from r.version then raise exception 'Tuyến đã thay đổi. Tải lại trước khi phân công';end if;
 select coalesce(array_agg(distinct value::uuid),'{}'::uuid[]) into staff_ids from jsonb_array_elements_text(payload->'user_ids');
 if exists(select 1 from unnest(staff_ids) u where not exists(select 1 from public.app_members m where m.user_id=u and m.role='staff' and m.active)) then raise exception 'Chỉ phân công nhân viên đang hoạt động';end if;
 delete from public.route_assignments where route_id=r.id and not(user_id=any(staff_ids));
 insert into public.route_assignments(user_id,route_id) select u,r.id from unnest(staff_ids) u on conflict do nothing;
 update public.routes set version=version+1 where id=r.id;
 perform private.audit('route.staff_changed',r.id,jsonb_build_object('user_ids',to_jsonb(staff_ids)));
 return private.request_finish(request_key,'set_sales_route_staff',payload,r.id);
end $$;
create function public.set_sales_route_staff(payload jsonb,request_key text) returns uuid
language sql security invoker set search_path='' as $$select private.set_sales_route_staff(payload,request_key)$$;
revoke all on function private.save_sales_route(jsonb,text),public.save_sales_route(jsonb,text),private.set_sales_route_staff(jsonb,text),public.set_sales_route_staff(jsonb,text) from public,anon;
grant execute on function private.save_sales_route(jsonb,text),public.save_sales_route(jsonb,text),private.set_sales_route_staff(jsonb,text),public.set_sales_route_staff(jsonb,text) to authenticated;

create or replace function private.create_pos_customer(p jsonb,p_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_member();id uuid;r uuid:=nullif(p->>'route_id','')::uuid; choices uuid[];
begin
 id:=private.request_start(p_key,'create_pos_customer',p);if id is not null then return id;end if;
 if nullif(trim(p->>'name'),'') is null or length(p->>'name')>150 then raise exception 'Customer name required';end if;
 if r is null then
  select array_agg(routes.id) into choices from public.routes where is_active and
   (private.app_role() in ('owner','manager') or exists(select 1 from public.route_assignments a where a.user_id=actor and a.route_id=routes.id));
  if coalesce(cardinality(choices),0)<>1 then raise exception 'Chọn tuyến bán hàng trước khi tạo khách';end if;
  r:=choices[1];
 end if;
 perform 1 from public.routes where routes.id=r and is_active for share;
 if not found then raise exception 'Active assigned route required';end if;
 if private.app_role()='staff' and not exists(select 1 from public.route_assignments where user_id=actor and route_id=r)
 then raise exception 'Customer outside assigned scope' using errcode='42501';end if;
 if p ? 'credit_limit' or p ? 'discount_pct' or p ? 'assigned_to' then raise exception 'Restricted customer fields' using errcode='42501';end if;
 insert into public.customers(code,name,phone,route_id,customer_type,assigned_to,credit_policy,credit_limit)
 values('POS-'||substr(gen_random_uuid()::text,1,13),trim(p->>'name'),nullif(trim(p->>'phone'),''),r,'Bạn hàng',actor,'limited',0) returning customers.id into id;
 perform private.audit('pos.customer_created',id,jsonb_build_object('route_id',r));
 return private.request_finish(p_key,'create_pos_customer',p,id);
end $$;
