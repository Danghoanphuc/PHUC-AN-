import type { Row } from './supabase';

/** Auto-select only when there is exactly one allowed active route. No location is hardcoded. */
export function defaultCustomerRoute(routes: Row<'routes'>[]) {
  const active = routes.filter((r) => r.is_active);
  return active.length === 1 ? active[0]!.id : '';
}
