import React, { createContext, useContext } from 'react';
import type { Data } from './data';
import type { Role, Row } from './supabase';
import type { FormSpec } from '../components/ui';
export type Page = 'home' | 'pos' | 'orders' | 'customers' | 'prices' | 'more';
export type Detail = { kind: 'order' | 'purchase' | 'customer' | 'sale'; id: string };
export interface AppContextValue {
  data: Data;
  role: Role;
  userId: string;
  email: string;
  busy: boolean;
  openForm: (spec: FormSpec) => void;
  openDetail: (detail: Detail) => void;
  go: (page: Page) => void;
  editOrder: (order?: Row<'customer_orders'>, customerId?: string) => void;
  editPurchase: (order?: Row<'purchase_orders'>) => void;
  run: (work: () => Promise<unknown>, success?: string) => Promise<void>;
  refresh: () => Promise<void>;
}
export const AppContext = createContext<AppContextValue | null>(null);
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw Error('App context missing');
  return value;
}
export const managerRole = (role: Role) => role !== 'staff';
