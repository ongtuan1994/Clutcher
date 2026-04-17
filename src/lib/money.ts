import type { BillingCycle } from '../types';

/** Match server `server/lib/money.ts` — amounts shown as monthly equivalents. */
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
