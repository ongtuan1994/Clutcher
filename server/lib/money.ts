import type { BillingCycle } from '@prisma/client';

/** Convert subscription amount to approximate monthly spend. */
export function monthlyEquivalent(amount: number, cycle: BillingCycle): number {
  switch (cycle) {
    case 'Weekly':
      return amount * (52 / 12);
    case 'Monthly':
      return amount;
    case 'Yearly':
      return amount / 12;
    default:
      return amount;
  }
}

export function totalMonthlySubscriptionSpend(
  subs: { amount: number; billingCycle: BillingCycle; archived: boolean }[],
): number {
  return subs
    .filter((s) => !s.archived)
    .reduce((sum, s) => sum + monthlyEquivalent(s.amount, s.billingCycle), 0);
}
