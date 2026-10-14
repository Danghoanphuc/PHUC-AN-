create table public.pos_cash_closes (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.app_members(user_id),
 business_date date not null default (now() at time zone 'Asia/Ho_Chi_Minh')::date,
 expected_amount numeric not null,
 counted_amount numeric not null check(counted_amount>=0 and counted_amount<1e12 and counted_amount=trunc(counted_amount)),
 note text not null default '',
 status text not null default 'pending' check(status in ('pending','received','rejected')),
 reviewed_by uuid references public.app_members(user_id),
 reviewed_at timestamptz,
 review_note text,
 destination_id uuid references public.cash_accounts(id),
 created_at timestamptz not null default now()
);
create unique index pos_close_pending_actor on public.pos_cash_closes(user_id) where status='pending';
create index pos_close_actor_date on public.pos_cash_closes(user_id,created_at desc);
create index pos_close_reviewer on public.pos_cash_closes(reviewed_by);
create index pos_close_destination on public.pos_cash_closes(destination_id);
alter table public.pos_cash_closes enable row level security;
revoke all on public.pos_cash_closes from anon,authenticated;
grant select on public.pos_cash_closes to authenticated;
create policy pos_close_read on public.pos_cash_closes for select to authenticated
 using(private.app_role() in ('owner','manager') or (private.app_role()='staff' and user_id=(select auth.uid())));

create function private.pos_summary() returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_member(); result jsonb;
begin
 select jsonb_build_object('balance',coalesce((select sum(case when m.direction='in' then m.amount else -m.amount end)
 from public.cash_movements m join private.pos_wallets w on w.account_id=m.account_id where w.user_id=actor),0),
 'sales',coalesce((select jsonb_agg(x order by x.created_at desc) from (
 select s.id,s.sale_date,s.created_at,s.net_amount,s.collected_amount,s.note,s.customer_id,c.name customer_name,
 (select jsonb_agg(jsonb_build_object('name',p.name,'pieces',i.qty_delivered-i.qty_returned,'amount',i.line_amount))
 from public.sale_items i join public.products p on p.id=i.product_id where i.sale_id=s.id) items
 from public.sales s left join public.customers c on c.id=s.customer_id where s.created_by=actor
 order by s.created_at desc limit 200) x),'[]'::jsonb)) into result;
 return result;
end $$;
create function public.pos_summary() returns jsonb language sql security invoker set search_path='' as $$select private.pos_summary()$$;

create function private.submit_pos_close(payload jsonb,request_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_member(); result uuid; balance numeric; counted numeric;
begin
 result:=private.request_start(request_key,'submit_pos_close',payload); if result is not null then return result;end if;
 perform pg_advisory_xact_lock(hashtextextended('pos-wallet:'||actor::text,0));
 select coalesce(sum(case when m.direction='in' then m.amount else -m.amount end),0) into balance
 from public.cash_movements m join private.pos_wallets w on w.account_id=m.account_id where w.user_id=actor;
 if not exists(select 1 from private.pos_wallets where user_id=actor) then raise exception 'Chưa có quỹ POS để đối soát';end if;
 if (payload->>'expected_amount')::numeric is distinct from balance then raise exception 'Số dư đã thay đổi. Tải lại trước khi chốt';end if;
 counted:=(payload->>'counted_amount')::numeric;
 if counted is null or counted<0 or counted>=1e12 or counted<>trunc(counted) then raise exception 'Số tiền thực đếm không hợp lệ';end if;
 if counted<>balance and length(trim(coalesce(payload->>'note','')))=0 then raise exception 'Cần ghi chú giải thích chênh lệch';end if;
 insert into public.pos_cash_closes(user_id,expected_amount,counted_amount,note)
 values(actor,balance,counted,left(coalesce(payload->>'note',''),2000)) returning id into result;
 perform private.audit('submit_pos_close',result,payload);
 return private.request_finish(request_key,'submit_pos_close',payload,result);
end $$;
create function public.submit_pos_close(payload jsonb,request_key text) returns uuid language sql security invoker set search_path='' as $$select private.submit_pos_close(payload,request_key)$$;

create function private.review_pos_close(payload jsonb,request_key text) returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid:=private.require_member(true); result uuid; report public.pos_cash_closes%rowtype; dest uuid; source uuid; action text:=payload->>'action';
begin
 result:=private.request_start(request_key,'review_pos_close',payload);if result is not null then return result;end if;
 select * into report from public.pos_cash_closes where id=(payload->>'close_id')::uuid for update;
 if not found or report.status<>'pending' then raise exception 'Phiếu đã xử lý hoặc không tồn tại';end if;
 if action is null or action not in ('received','rejected') then raise exception 'Trạng thái không hợp lệ';end if;
 perform pg_advisory_xact_lock(hashtextextended('pos-wallet:'||report.user_id::text,0));
 if action='received' then
  dest:=(payload->>'destination_id')::uuid;
  select account_id into source from private.pos_wallets where user_id=report.user_id;
  if dest is null or not exists(select 1 from public.cash_accounts where id=dest and is_active and account_type='cash')
   or exists(select 1 from private.pos_wallets where account_id=dest) then raise exception 'Chọn quỹ tiền mặt công ty đang hoạt động';end if;
  if report.counted_amount>0 then
   insert into public.cash_movements(txn_date,account_id,direction,amount,flow_class,kind,transfer_group,source_ref,created_by,note)
   values((now() at time zone 'Asia/Ho_Chi_Minh')::date,source,'out',report.counted_amount,'transfer','pos_handover',report.id,report.id::text,actor,'Nộp tiền POS'),
   ((now() at time zone 'Asia/Ho_Chi_Minh')::date,dest,'in',report.counted_amount,'transfer','pos_handover',report.id,report.id::text,actor,'Nhận tiền POS');
  end if;
 elsif length(trim(coalesce(payload->>'note','')))=0 then raise exception 'Cần ghi lý do yêu cầu đếm lại';
 end if;
 update public.pos_cash_closes set status=action,reviewed_by=actor,reviewed_at=now(),review_note=left(coalesce(payload->>'note',''),2000),destination_id=dest where id=report.id;
 perform private.audit('review_pos_close',report.id,payload);
 return private.request_finish(request_key,'review_pos_close',payload,report.id);
end $$;
create function public.review_pos_close(payload jsonb,request_key text) returns uuid language sql security invoker set search_path='' as $$select private.review_pos_close(payload,request_key)$$;
revoke all on function private.pos_summary(),public.pos_summary(),private.submit_pos_close(jsonb,text),public.submit_pos_close(jsonb,text),private.review_pos_close(jsonb,text),public.review_pos_close(jsonb,text) from public,anon;
grant execute on function private.pos_summary(),public.pos_summary(),private.submit_pos_close(jsonb,text),public.submit_pos_close(jsonb,text),private.review_pos_close(jsonb,text),public.review_pos_close(jsonb,text) to authenticated;
