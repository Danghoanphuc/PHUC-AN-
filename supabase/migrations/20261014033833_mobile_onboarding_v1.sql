create table private.approved_invites(
 email text primary key check(email=lower(trim(email))),
 role text not null check(role in ('owner','manager','staff')),
 contact_phone text,full_name text,expires_at timestamptz not null default now()+interval '14 days',
 accepted_user uuid references auth.users(id),created_by uuid references auth.users(id),created_at timestamptz not null default now()
);
create table public.member_profiles(
 user_id uuid primary key references auth.users(id) on delete cascade,
 full_name text not null default '',email text,contact_phone text,
 updated_at timestamptz not null default now()
);
alter table public.member_profiles enable row level security;
create policy profile_read on public.member_profiles for select to authenticated
using(user_id=(select auth.uid()) or (select private.app_role()) in ('owner','manager'));
create policy profile_update on public.member_profiles for update to authenticated
using(user_id=(select auth.uid()) and (select private.app_role()) is not null)
with check(user_id=(select auth.uid()) and (select private.app_role()) is not null);
grant select,update(full_name,contact_phone,updated_at) on public.member_profiles to authenticated;
revoke all on private.approved_invites from public,anon,authenticated;
create or replace function private.accept_approved_invite(p_id uuid,p_email text,p_confirmed timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare v_inv private.approved_invites%rowtype;
begin
 if p_confirmed is null or p_email is null then return;end if;
 select * into v_inv from private.approved_invites where email=lower(trim(p_email)) and expires_at>now() for update;
 if not found or (v_inv.accepted_user is not null and v_inv.accepted_user<>p_id) then return;end if;
 -- Confirmation is supplied only by the auth.users trigger or the owner-only lookup below.
 -- Re-verification never reactivates a deactivated member or resets their existing role.
 insert into public.app_members(user_id,role,active) values(p_id,v_inv.role,true) on conflict(user_id) do nothing;
 insert into public.member_profiles(user_id,full_name,email,contact_phone)
 values(p_id,coalesce(v_inv.full_name,''),v_inv.email,v_inv.contact_phone) on conflict(user_id) do update set email=excluded.email;
 update private.approved_invites set accepted_user=p_id where email=v_inv.email;
end $$;
create or replace function private.on_verified_auth_user() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform private.accept_approved_invite(new.id,new.email,new.email_confirmed_at);
 return new;
end $$;
create trigger phucan_verified_membership after insert or update of email,email_confirmed_at on auth.users
for each row execute function private.on_verified_auth_user();
create or replace function private.invite_member(p_payload jsonb,p_key text) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=private.require_member(true);v_id uuid;v_email text:=lower(trim(p_payload->>'email'));
 v_role text:=p_payload->>'role';v_user record;
begin
 if private.app_role()<>'owner' then raise exception 'Owner required' using errcode='42501';end if;
 v_id:=private.request_start(p_key,'invite_member',p_payload);if v_id is not null then return v_id;end if;
 if v_email is null or v_email!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
 or v_role is null or v_role not in ('manager','staff') then raise exception 'Valid email and manager/staff role required';end if;
 if exists(select 1 from private.approved_invites where email=v_email and accepted_user is not null) then
 raise exception 'Already accepted; use manage_member for existing membership';end if;
 insert into private.approved_invites(email,role,contact_phone,full_name,created_by)
 values(v_email,v_role,p_payload->>'contact_phone',p_payload->>'full_name',v_actor)
 on conflict(email) do update set role=excluded.role,contact_phone=excluded.contact_phone,full_name=excluded.full_name,
 expires_at=now()+interval '14 days',created_by=excluded.created_by;
 select id,email,email_confirmed_at into v_user from auth.users where lower(email)=v_email and email_confirmed_at is not null;
 if found then perform private.accept_approved_invite(v_user.id,v_user.email,v_user.email_confirmed_at);end if;
 v_id:=gen_random_uuid();
 perform private.audit('member.invited',v_id,jsonb_build_object('email',v_email,'role',v_role));
 return private.request_finish(p_key,'invite_member',p_payload,v_id);
end $$;
create or replace function public.invite_member(payload jsonb,request_key text) returns uuid
language sql security invoker set search_path='' as $$select private.invite_member(payload,request_key)$$;
revoke all on function private.accept_approved_invite(uuid,text,timestamptz),private.on_verified_auth_user(),private.invite_member(jsonb,text) from public,anon,authenticated;
grant execute on function private.invite_member(jsonb,text),public.invite_member(jsonb,text) to authenticated;
revoke all on function public.invite_member(jsonb,text) from public,anon;
create or replace function private.list_member_invites() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_member(true);
 if private.app_role()<>'owner' then raise exception 'Owner required' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('email',email,'role',role,'full_name',full_name,'expires_at',expires_at,'accepted',accepted_user is not null)),'[]') from private.approved_invites);
end $$;
create or replace function public.list_member_invites() returns jsonb
language sql security invoker set search_path='' as $$select private.list_member_invites()$$;
revoke all on function private.list_member_invites(),public.list_member_invites() from public,anon;
grant execute on function private.list_member_invites(),public.list_member_invites() to authenticated;
-- Staff assigned directly to a customer can also see that customer's route label.
drop policy mobile_read on public.routes;
create policy mobile_read on public.routes for select to authenticated using(
 (select private.app_role()) in ('owner','manager') or ((select private.app_role())='staff' and
 (exists(select 1 from public.route_assignments a where a.route_id=routes.id and a.user_id=(select auth.uid())) or
 exists(select 1 from public.customers c where c.route_id=routes.id and c.assigned_to=(select auth.uid())))));
notify pgrst,'reload schema';
