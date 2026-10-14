-- Passwords stay exclusively in Supabase Auth, never in business tables/audits.
create table private.phone_owner_setup (
 user_id uuid primary key references auth.users(id) on delete cascade,
 token_hash text not null unique check(length(token_hash)=64), phone text not null,
 expires_at timestamptz not null, used_at timestamptz
);
alter table private.phone_owner_setup enable row level security;
revoke all on private.phone_owner_setup from public,anon,authenticated;
create unique index member_login_phone_unique on public.member_profiles(contact_phone)
 where contact_phone ~ '^\+84[35789][0-9]{8}$';
-- Login number is administered, not editable through the profile API.
revoke update(contact_phone) on public.member_profiles from authenticated;
create function private.phone_setup_target(p_hash text,p_phone text) returns uuid
language sql security definer set search_path='' as $$
 select user_id from private.phone_owner_setup where token_hash=p_hash and phone=p_phone and used_at is null and expires_at>now()
 and not exists(select 1 from public.app_members where role='owner' and active)
$$;
create function public.phone_setup_target(token_hash text,phone text) returns uuid
language sql security invoker set search_path='' as $$select private.phone_setup_target(token_hash,phone)$$;
create function private.provision_phone_member(p jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare v_id uuid:=(p->>'user_id')::uuid; v_actor uuid:=(p->>'actor')::uuid;v_role text:=p->>'role';v_setup private.phone_owner_setup%rowtype;
begin
 if v_actor is null then
  select * into v_setup from private.phone_owner_setup where token_hash=p->>'token_hash' for update;
  if not found or v_setup.user_id<>v_id or v_setup.phone<>p->>'phone' or v_setup.used_at is not null or v_setup.expires_at<=now()
   or v_role<>'owner' or exists(select 1 from public.app_members where role='owner' and active)
  then raise exception 'Invalid setup';end if;
 else
  if not exists(select 1 from public.app_members where user_id=v_actor and role='owner' and active)
   or v_role not in ('manager','staff') then raise exception 'Owner required' using errcode='42501';end if;
 end if;
 if p->>'phone' is null or p->>'phone' !~ '^\+84[35789][0-9]{8}$' then raise exception 'Invalid phone';end if;
 if not exists(select 1 from auth.users where id=v_id and email=substring(p->>'phone' from 2)||'@phone.phucan.invalid' and email_confirmed_at is not null)
 then raise exception 'Auth account required';end if;
 insert into public.app_members(user_id,role,active) values(v_id,v_role,true) on conflict(user_id) do nothing;
 insert into public.member_profiles(user_id,full_name,contact_phone) values(v_id,coalesce(p->>'full_name',''),p->>'phone')
 on conflict(user_id) do nothing;
 if v_actor is null then update private.phone_owner_setup set used_at=now() where user_id=v_id;end if;
end $$;
create function public.provision_phone_member(payload jsonb) returns void
language sql security invoker set search_path='' as $$select private.provision_phone_member(payload)$$;
revoke all on function private.phone_setup_target(text,text),public.phone_setup_target(text,text),private.provision_phone_member(jsonb),public.provision_phone_member(jsonb) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.phone_setup_target(text,text),public.phone_setup_target(text,text),private.provision_phone_member(jsonb),public.provision_phone_member(jsonb) to service_role;
-- Retire email onboarding; old migrations remain an accurate history.
drop trigger phucan_verified_membership on auth.users;
revoke execute on function public.invite_member(jsonb,text),private.invite_member(jsonb,text),public.list_member_invites(),private.list_member_invites() from authenticated;
notify pgrst,'reload schema';
