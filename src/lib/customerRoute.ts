import type { Row } from './supabase';

/** Call with the actor's allowed routes. Keep the stable route code when its display name changes. */
export function defaultCustomerRoute(routes: Row<'routes'>[]) {
  const active = routes.filter((r) => r.is_active);
  return (
    active.find((r) => r.code === 'R-CHO_HUYEN')?.id || (active.length === 1 ? active[0]!.id : '')
  );
}
