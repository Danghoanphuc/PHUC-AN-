create function private.update_retail_customer_contact(payload jsonb,request_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_member(); result uuid; c public.customers%rowtype;
 new_name text:=trim(payload->>'name'); new_phone text:=nullif(regexp_replace(coalesce(payload->>'phone',''),'[[:space:]().-]','','g'),'');
begin
 result:=private.request_start(request_key,'update_retail_customer_contact',payload);
 if result is not null then return result;end if;
 if payload - array['customer_id','name','phone','expected_name','expected_phone'] <> '{}'::jsonb then raise exception 'Chỉ được cập nhật tên và số điện thoại';end if;
 select * into c from public.customers where id=(payload->>'customer_id')::uuid for update;
 if not found or not private.can_customer(c.id) or not c.is_active then raise exception 'Customer outside assigned scope' using errcode='42501';end if;
 if c.customer_type is distinct from 'Khách lẻ' then raise exception 'Chức năng này chỉ dành cho khách lẻ';end if;
 if not (payload ? 'expected_name' and payload ? 'expected_phone') or c.name is distinct from (payload->>'expected_name') or c.phone is distinct from (payload->>'expected_phone') then raise exception 'Version conflict';end if;
 if new_name is null or length(new_name)=0 or length(new_name)>150 then raise exception 'Tên khách cần từ 1 đến 150 ký tự';end if;
 if new_phone is not null and new_phone !~ '^\+?[0-9]{8,15}$' then raise exception 'Số điện thoại cần 8–15 chữ số, có thể bắt đầu bằng +';end if;
 update public.customers set name=new_name,phone=new_phone where id=c.id;
 perform private.audit('update_retail_customer_contact',c.id,jsonb_build_object('before',jsonb_build_object('name',c.name,'phone',c.phone),'after',jsonb_build_object('name',new_name,'phone',new_phone)));
 return private.request_finish(request_key,'update_retail_customer_contact',payload,c.id);
end $$;
create function public.update_retail_customer_contact(payload jsonb,request_key text) returns uuid
language sql security invoker set search_path='' as $$select private.update_retail_customer_contact(payload,request_key)$$;
revoke all on function private.update_retail_customer_contact(jsonb,text),public.update_retail_customer_contact(jsonb,text) from public,anon;
grant execute on function private.update_retail_customer_contact(jsonb,text),public.update_retail_customer_contact(jsonb,text) to authenticated;
