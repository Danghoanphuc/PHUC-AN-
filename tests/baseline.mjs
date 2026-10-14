import { readFileSync } from 'node:fs';

// Reconstructs the surveyed public schema, not customer/employee records.
export function baselineSql() {
  const s = JSON.parse(readFileSync(new URL('../docs/database/schema-snapshot.json', import.meta.url), 'utf8'));
  const types = JSON.parse(readFileSync(new URL('./schema-types.json', import.meta.url),'utf8'));
  const parts = [`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema private;
    create table auth.users(id uuid primary key,email text,phone text,email_confirmed_at timestamptz,phone_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
  `];
  for (const t of s.tables) {
    parts.push(`create table ${t.name} (${t.columns.map(c => {
      const type = types.find(x=>x.table===t.name.replace('public.','')&&x.column===c.name)?.type ?? (c.format === '_text' ? 'text[]' : c.format);
      const generated = c.options.includes('generated');
      return `${c.name} ${type}${generated ? ` generated always as (${c.default_value}) stored` :
        `${c.default_value ? ` default ${c.default_value}` : ''}${c.options.includes('nullable') ? '' : ' not null'}`}`;
    }).join(',')});`);
  }
  for (const c of [...s.catalog.constraints].sort((a,b) => Number(a.definition.startsWith('FOREIGN')) - Number(b.definition.startsWith('FOREIGN')))) parts.push(`alter table public.${c.table} add constraint ${c.name} ${c.definition};`);
  parts.push(...s.private_functions.map(f => f.definition + ';'));
  parts.push(...s.catalog.functions.map(f => f.definition + ';'));
  // Views must be created after their dependencies.
  const order = ['v_latest_material_cost','v_recipe_cost','v_sale_item_margin','v_daily_route_profit',
    'v_inventory_latest','v_cash_balances','v_cash_daily','v_current_labor_costs','v_monthly_overhead_summary'];
  for (const name of order) {
    const v = s.catalog.views.find(v => v.name === name);
    parts.push(`create view public.${name} with(security_invoker=true) as ${v.definition}`);
  }
  for (const i of s.indexes) if (!i.indexname.endsWith('_pkey') && !s.catalog.constraints.some(c => c.name === i.indexname)) parts.push(i.indexdef + ';');
  return parts.join('\n');
}
