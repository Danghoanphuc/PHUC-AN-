-- Customer removal is reversible; linked documents and prices are never deleted.
-- Client status changes must use the audited RPC instead of a direct table update.
create function private.guard_customer_active_update() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if new.is_active is distinct from old.is_active and current_user in ('authenticated','anon') then
  raise exception 'Dùng chức năng Xóa / Khôi phục khách để kiểm tra dữ liệu liên quan' using errcode='42501';
 end if;
 return new;
end $$;
revoke all on function private.guard_customer_active_update() from public,anon,authenticated;
create trigger customer_active_guard before update of is_active on public.customers
for each row execute function private.guard_customer_active_update();

create function private.set_customer_active(payload jsonb,request_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_member(true); result uuid; c public.customers%rowtype;
 target boolean; reason text:=trim(payload->>'reason');
begin
 result:=private.request_start(request_key,'set_customer_active',payload);
 if result is not null then return result;end if;
 if payload - array['customer_id','is_active','expected_is_active','reason'] <> '{}'::jsonb
  or jsonb_typeof(payload->'is_active') is distinct from 'boolean'
  or jsonb_typeof(payload->'expected_is_active') is distinct from 'boolean' then
  raise exception 'Trạng thái khách không hợp lệ';
 end if;
 target:=(payload->>'is_active')::boolean;
 if reason is null or length(reason)<2 or length(reason)>500 then
  raise exception 'Lý do cần từ 2 đến 500 ký tự';
 end if;
 select * into c from public.customers where id=(payload->>'customer_id')::uuid for update;
 if not found or not private.can_customer(c.id) then
  raise exception 'Khách ngoài phạm vi truy cập' using errcode='42501';
 end if;
 if c.is_active is distinct from (payload->>'expected_is_active')::boolean then
  raise exception 'Trạng thái khách đã thay đổi. Tải lại trước khi tiếp tục';
 end if;
 if c.is_active is not distinct from target then raise exception 'Khách đã ở trạng thái này';end if;
 if not target then
  if exists(select 1 from public.receivables where customer_id=c.id and amount>paid_amount) then
   raise exception 'Chưa thể xóa: khách còn công nợ';end if;
  if exists(select 1 from public.customer_orders where customer_id=c.id and status in ('draft','confirmed','partial')) then
   raise exception 'Chưa thể xóa: khách còn đơn chưa xử lý xong';end if;
  if exists(select 1 from public.pos_package_sales where customer_id=c.id and status<>'complete') then
   raise exception 'Chưa thể xóa: khách còn đơn POS chưa điền đủ bánh';end if;
 end if;
 update public.customers set is_active=target where id=c.id;
 perform private.audit(case when target then 'customer.restored' else 'customer.archived' end,c.id,
  jsonb_build_object('name',c.name,'before_is_active',c.is_active,'is_active',target,'reason',reason));
 return private.request_finish(request_key,'set_customer_active',payload,c.id);
end $$;
create function public.set_customer_active(payload jsonb,request_key text) returns uuid
language sql security invoker set search_path='' as $$select private.set_customer_active(payload,request_key)$$;
revoke all on function private.set_customer_active(jsonb,text),public.set_customer_active(jsonb,text) from public,anon;
grant execute on function private.set_customer_active(jsonb,text),public.set_customer_active(jsonb,text) to authenticated;
