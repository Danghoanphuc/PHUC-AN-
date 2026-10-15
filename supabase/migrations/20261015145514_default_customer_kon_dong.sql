-- Rename the existing route in place, preserving assignments, customers and historical documents.
update public.routes set name='Kon Dơng' where code='R-CHO_HUYEN';

create or replace function private.create_pos_customer(p jsonb,p_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_member();id uuid;r uuid:=nullif(p->>'route_id','')::uuid;
begin
 id:=private.request_start(p_key,'create_pos_customer',p);if id is not null then return id;end if;
 if nullif(trim(p->>'name'),'') is null or length(p->>'name')>150 then raise exception 'Customer name required';end if;
 if r is null then select routes.id into r from public.routes where code='R-CHO_HUYEN' and is_active;end if;
 if not exists(select 1 from public.routes where routes.id=r and is_active) then raise exception 'Active assigned route required';end if;
 if private.app_role()='staff' and not exists(select 1 from public.route_assignments where user_id=actor and route_id=r)
 then raise exception 'Customer outside assigned scope' using errcode='42501';end if;
 if p ? 'credit_limit' or p ? 'discount_pct' or p ? 'assigned_to' then raise exception 'Restricted customer fields' using errcode='42501';end if;
 insert into public.customers(code,name,phone,route_id,customer_type,assigned_to,credit_policy,credit_limit)
 values('POS-'||substr(gen_random_uuid()::text,1,13),trim(p->>'name'),nullif(trim(p->>'phone'),''),r,'Bạn hàng',actor,'limited',0) returning customers.id into id;
 perform private.audit('pos.customer_created',id,jsonb_build_object('route_id',r));
 return private.request_finish(p_key,'create_pos_customer',p,id);
end $$;
notify pgrst,'reload schema';
