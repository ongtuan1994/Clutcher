export type BillingCycle = 'Weekly' | 'Monthly' | 'Yearly';

export interface Subscription {
  id: string;
  name: string;
  category: string;
  amount: number;
  billingCycle: BillingCycle;
  billingStart: string;
  icon?: string;
  archived?: boolean;
}

export interface ReconciliationRecord {
  id: string;
  month: string;
  projected: number;
  realBalance: number;
  date: string;
  status: 'Balanced' | 'Adjusted' | 'Perfect Match';
}

export type View =
  | 'Dashboard'
  | 'Subscriptions'
  | 'Analytics'
  | 'Reconciliation'
  | 'ShortTermPlan'
  | 'LongTermPlan'
  | 'AdminSkies'
  | 'Settings'
  | 'Support';
