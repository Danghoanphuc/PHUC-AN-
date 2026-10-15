-- One-time cleanup explicitly approved by the user. No effect on databases without its audit backup.
-- The immutable backup remains in audit_events; request idempotency records remain as replay tombstones.
-- Only the cash DELETE guard is suspended, under an exclusive lock in this transaction.
do $cleanup$
declare
  backup public.audit_events%rowtype;
  snapshot jsonb;
  current_rows jsonb;
  fingerprint text;
  removed integer;
begin
  select * into backup from public.audit_events
    where action='maintenance.trial_sales_backup' and details->>'run_key'='trial_sales_20261015_nine_approved';
  if not found then return; end if;
  if exists(select 1 from public.audit_events where action='maintenance.trial_sales_cleaned'
    and details->>'run_key'=backup.details->>'run_key') then return; end if;
  snapshot := backup.details->'snapshot';
  if jsonb_array_length(snapshot->'sales') <> 9 or jsonb_array_length(snapshot->'customer_orders') <> 7
    or jsonb_array_length(snapshot->'cash_movements') <> 9 then raise exception 'Unexpected trial cleanup scope'; end if;
  lock table public.cash_movements,public.sales,public.receivables,public.sale_items,
    public.sale_item_costs,public.customer_orders,public.customer_order_items,public.customer_order_requests,
    public.pos_package_sales,public.pos_package_lines,public.pos_package_allocations,public.returns in access exclusive mode;
  if not exists(select 1 from pg_trigger where tgrelid='public.cash_movements'::regclass and tgname='cash_immutable' and tgenabled='O')
    then raise exception 'Cash guard must already be enabled'; end if;
  if exists(select 1 from public.pos_cash_closes c join jsonb_array_elements(snapshot->'sales') v
    on c.user_id=(v->>'created_by')::uuid and c.business_date=(v->>'sale_date')::date)
    then raise exception 'Trial sales have a cash close; reconcile first'; end if;

  execute $check$
    with target as (select * from public.sales where id in (select (v->>'id')::uuid from jsonb_array_elements($1->'sales') v))
    select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)
    from public.sales t where id in (select id from target)
  $check$ into current_rows using snapshot;
  if current_rows is distinct from snapshot->'sales' then raise exception 'Trial cleanup aborted: sales changed since backup'; end if;

  execute $check$
    with target as (select * from public.sales where id in (select (v->>'id')::uuid from jsonb_array_elements($1->'sales') v))
    select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)
    from public.customer_orders t where id in (select customer_order_id from target)
  $check$ into current_rows using snapshot;
  if current_rows is distinct from snapshot->'customer_orders' then raise exception 'Trial cleanup aborted: customer_orders changed since backup'; end if;

  execute $check$
    with target as (select * from public.sales where id in (select (v->>'id')::uuid from jsonb_array_elements($1->'sales') v))
    select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)
    from public.customer_order_items t where order_id in (select customer_order_id from target)
  $check$ into current_rows using snapshot;
  if current_rows is distinct from snapshot->'customer_order_items' then raise exception 'Trial cleanup aborted: customer_order_items changed since backup'; end if;

  execute $check$
    with target as (select * from public.sales where id in (select (v->>'id')::uuid from jsonb_array_elements($1->'sales') v))
    select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)
    from public.customer_order_requests t where order_id in (select customer_order_id from target)
  $check$ into current_rows using snapshot;
  if current_rows is distinct from snapshot->'customer_order_requests' then raise exception 'Trial cleanup aborted: customer_order_requests changed since backup'; end if;

  execute $check$
    with target as (select * from public.sales where id in (select (v->>'id')::uuid from jsonb_array_elements($1->'sales') v))
    select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)
    from public.sale_items t where sale_id in (select id from target)
  $check$ into current_rows using snapshot;
  if current_rows is distinct from snapshot->'sale_items' then raise exception 'Trial cleanup aborted: sale_items changed since backup'; end if;

  execute $check$
    with target as (select * from public.sales where id in (select (v->>'id')::uuid from jsonb_array_elements($1->'sales') v))
    select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)
    from public.sale_item_costs t where sale_item_id in (select id from public.sale_items where sale_id in (select id from target))
  $check$ into current_rows using snapshot;
  if current_rows is distinct from snapshot->'sale_item_costs' then raise exception 'Trial cleanup aborted: sale_item_costs changed since backup'; end if;

  execute $check$
    with target as (select * from public.sales where id in (select (v->>'id')::uuid from jsonb_array_elements($1->'sales') v))
    select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)
    from public.receivables t where sale_id in (select id from target)
  $check$ into current_rows using snapshot;
  if current_rows is distinct from snapshot->'receivables' then raise exception 'Trial cleanup aborted: receivables changed since backup'; end if;

  execute $check$
    with target as (select * from public.sales where id in (select (v->>'id')::uuid from jsonb_array_elements($1->'sales') v))
    select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)
    from public.cash_movements t where sale_id in (select id from target) or receivable_id in (select id from public.receivables where sale_id in (select id from target))
  $check$ into current_rows using snapshot;
  if current_rows is distinct from snapshot->'cash_movements' then raise exception 'Trial cleanup aborted: cash_movements changed since backup'; end if;

  execute $check$
    with target as (select * from public.sales where id in (select (v->>'id')::uuid from jsonb_array_elements($1->'sales') v))
    select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)
    from public.pos_package_sales t where id in (select id from target)
  $check$ into current_rows using snapshot;
  if current_rows is distinct from snapshot->'pos_package_sales' then raise exception 'Trial cleanup aborted: pos_package_sales changed since backup'; end if;

  execute $check$
    with target as (select * from public.sales where id in (select (v->>'id')::uuid from jsonb_array_elements($1->'sales') v))
    select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)
    from public.pos_package_lines t where sale_id in (select id from target)
  $check$ into current_rows using snapshot;
  if current_rows is distinct from snapshot->'pos_package_lines' then raise exception 'Trial cleanup aborted: pos_package_lines changed since backup'; end if;

  execute $check$
    with target as (select * from public.sales where id in (select (v->>'id')::uuid from jsonb_array_elements($1->'sales') v))
    select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)
    from public.pos_package_allocations t where line_id in (select id from public.pos_package_lines where sale_id in (select id from target))
  $check$ into current_rows using snapshot;
  if current_rows is distinct from snapshot->'pos_package_allocations' then raise exception 'Trial cleanup aborted: pos_package_allocations changed since backup'; end if;

  execute $check$
    with target as (select * from public.sales where id in (select (v->>'id')::uuid from jsonb_array_elements($1->'sales') v))
    select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)
    from public.returns t where sale_id in (select id from target)
  $check$ into current_rows using snapshot;
  if current_rows is distinct from snapshot->'returns' then raise exception 'Trial cleanup aborted: returns changed since backup'; end if;
  alter table public.cash_movements disable trigger cash_immutable;
  delete from public.pos_package_allocations where id in (select (v->>'id')::uuid from jsonb_array_elements(snapshot->'pos_package_allocations') v);
  get diagnostics removed = row_count;
  if removed <> jsonb_array_length(snapshot->'pos_package_allocations') then raise exception 'Trial cleanup row count mismatch: pos_package_allocations'; end if;
  delete from public.pos_package_lines where id in (select (v->>'id')::uuid from jsonb_array_elements(snapshot->'pos_package_lines') v);
  get diagnostics removed = row_count;
  if removed <> jsonb_array_length(snapshot->'pos_package_lines') then raise exception 'Trial cleanup row count mismatch: pos_package_lines'; end if;
  delete from public.pos_package_sales where id in (select (v->>'id')::uuid from jsonb_array_elements(snapshot->'pos_package_sales') v);
  get diagnostics removed = row_count;
  if removed <> jsonb_array_length(snapshot->'pos_package_sales') then raise exception 'Trial cleanup row count mismatch: pos_package_sales'; end if;
  delete from public.returns where id in (select (v->>'id')::uuid from jsonb_array_elements(snapshot->'returns') v);
  get diagnostics removed = row_count;
  if removed <> jsonb_array_length(snapshot->'returns') then raise exception 'Trial cleanup row count mismatch: returns'; end if;
  delete from public.cash_movements where id in (select (v->>'id')::uuid from jsonb_array_elements(snapshot->'cash_movements') v);
  get diagnostics removed = row_count;
  if removed <> jsonb_array_length(snapshot->'cash_movements') then raise exception 'Trial cleanup row count mismatch: cash_movements'; end if;
  delete from public.sale_item_costs where sale_item_id in (select (v->>'sale_item_id')::uuid from jsonb_array_elements(snapshot->'sale_item_costs') v);
  get diagnostics removed = row_count;
  if removed <> jsonb_array_length(snapshot->'sale_item_costs') then raise exception 'Trial cleanup row count mismatch: sale_item_costs'; end if;
  delete from public.sale_items where id in (select (v->>'id')::uuid from jsonb_array_elements(snapshot->'sale_items') v);
  get diagnostics removed = row_count;
  if removed <> jsonb_array_length(snapshot->'sale_items') then raise exception 'Trial cleanup row count mismatch: sale_items'; end if;
  delete from public.receivables where id in (select (v->>'id')::uuid from jsonb_array_elements(snapshot->'receivables') v);
  get diagnostics removed = row_count;
  if removed <> jsonb_array_length(snapshot->'receivables') then raise exception 'Trial cleanup row count mismatch: receivables'; end if;
  delete from public.sales where id in (select (v->>'id')::uuid from jsonb_array_elements(snapshot->'sales') v);
  get diagnostics removed = row_count;
  if removed <> jsonb_array_length(snapshot->'sales') then raise exception 'Trial cleanup row count mismatch: sales'; end if;
  delete from public.customer_order_items where id in (select (v->>'id')::uuid from jsonb_array_elements(snapshot->'customer_order_items') v);
  get diagnostics removed = row_count;
  if removed <> jsonb_array_length(snapshot->'customer_order_items') then raise exception 'Trial cleanup row count mismatch: customer_order_items'; end if;
  delete from public.customer_order_requests where id in (select (v->>'id')::uuid from jsonb_array_elements(snapshot->'customer_order_requests') v);
  get diagnostics removed = row_count;
  if removed <> jsonb_array_length(snapshot->'customer_order_requests') then raise exception 'Trial cleanup row count mismatch: customer_order_requests'; end if;
  delete from public.customer_orders where id in (select (v->>'id')::uuid from jsonb_array_elements(snapshot->'customer_orders') v);
  get diagnostics removed = row_count;
  if removed <> jsonb_array_length(snapshot->'customer_orders') then raise exception 'Trial cleanup row count mismatch: customer_orders'; end if;
  alter table public.cash_movements enable trigger cash_immutable;
  select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text) into fingerprint from public.products t;
  if fingerprint is distinct from backup.details->'protected_fingerprints'->>'products' then raise exception 'Trial cleanup affected protected data: products'; end if;
  select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text) into fingerprint from public.customers t;
  if fingerprint is distinct from backup.details->'protected_fingerprints'->>'customers' then raise exception 'Trial cleanup affected protected data: customers'; end if;
  select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text) into fingerprint from public.routes t;
  if fingerprint is distinct from backup.details->'protected_fingerprints'->>'routes' then raise exception 'Trial cleanup affected protected data: routes'; end if;
  select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text) into fingerprint from public.selling_prices t;
  if fingerprint is distinct from backup.details->'protected_fingerprints'->>'selling_prices' then raise exception 'Trial cleanup affected protected data: selling_prices'; end if;
  select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text) into fingerprint from public.pos_package_prices t;
  if fingerprint is distinct from backup.details->'protected_fingerprints'->>'pos_package_prices' then raise exception 'Trial cleanup affected protected data: pos_package_prices'; end if;
  select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text) into fingerprint from public.inventory_transactions t;
  if fingerprint is distinct from backup.details->'protected_fingerprints'->>'inventory_transactions' then raise exception 'Trial cleanup affected protected data: inventory_transactions'; end if;
  select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text) into fingerprint from public.pos_cash_closes t;
  if fingerprint is distinct from backup.details->'protected_fingerprints'->>'pos_cash_closes' then raise exception 'Trial cleanup affected protected data: pos_cash_closes'; end if;
  insert into public.audit_events(actor_id,action,entity_id,details)
  values(backup.actor_id,'maintenance.trial_sales_cleaned',backup.entity_id,
    jsonb_build_object('run_key',backup.details->>'run_key','backup_event_id',backup.id,
      'reason',backup.details->>'reason','sales_removed',9,'orders_removed',7,'collections_removed',9,
      'amount_removed',(select sum((v->>'amount')::numeric) from jsonb_array_elements(snapshot->'cash_movements') v),
      'request_tombstones_preserved',true));
end
$cleanup$;
