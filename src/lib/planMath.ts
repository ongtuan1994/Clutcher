import type { SavedPlan } from './savedPlans';

export function longPlanRemaining(budget: number, initialCapital: number): number {
  return Math.max(0, budget - Math.max(0, initialCapital));
}

export function longPlanMetrics(
  budget: number,
  initialCapital: number,
  months: number,
  monthlyIncome: number,
  monthlySubscriptionTotal: number,
  monthlyPayment: number,
) {
  const remaining = longPlanRemaining(budget, initialCapital);
  const requiredMonthly = remaining / months;
  const surplusAfterSubs = monthlyIncome - monthlySubscriptionTotal;
  const paymentShortfall = Math.max(0, requiredMonthly - monthlyPayment);
  const gap = Math.max(0, monthlyPayment - surplusAfterSubs);
  const eps = 1e-6;
  return {
    remaining,
    requiredMonthly,
    monthlyPayment,
    surplusAfterSubs,
    paymentShortfall,
    gap,
    canCoverPayment: monthlyPayment <= surplusAfterSubs + eps,
    canReachGoal: monthlyPayment + eps >= requiredMonthly,
  };
}

/** Months from start of current calendar month to start of target month. Past dates → null. */
export function monthsUntilTarget(targetYear: number, targetMonth: number): number | null {
  const now = new Date();
  const cur = new Date(now.getFullYear(), now.getMonth(), 1);
  const target = new Date(targetYear, targetMonth - 1, 1);
  if (target < cur) return null;
  const diff = (target.getFullYear() - cur.getFullYear()) * 12 + (target.getMonth() - cur.getMonth());
  return Math.max(1, diff);
}

export function planMetrics(
  goalAmount: number,
  months: number,
  monthlyIncome: number,
  monthlySubscriptionTotal: number,
) {
  const monthlyNeeded = goalAmount / months;
  const surplusAfterSubs = monthlyIncome - monthlySubscriptionTotal;
  const gap = Math.max(0, monthlyNeeded - surplusAfterSubs);
  return {
    monthlyNeeded,
    surplusAfterSubs,
    gap,
    canCover: monthlyNeeded <= surplusAfterSubs,
  };
}

/** Monthly cash toward goals: short = goal/months; long = declared monthly payment or required remainder/months. */
export function planMonthlyBurden(
  p: SavedPlan,
  monthlyIncome: number,
  monthlySubscriptionTotal: number,
): number {
  const m = monthsUntilTarget(p.year, p.month);
  if (m === null) return 0;

  if (p.variant === 'long') {
    const initial = p.initialCapital ?? 0;
    const remaining = longPlanRemaining(p.budget, initial);
    const required = remaining / m;
    if (p.monthlyPayment != null && p.monthlyPayment > 0) {
      return p.monthlyPayment;
    }
    return required;
  }

  return planMetrics(p.budget, m, monthlyIncome, monthlySubscriptionTotal).monthlyNeeded;
}

/** Sum of monthly savings / contributions implied by saved plans. */
export function sumSavedPlansMonthlyNeeded(
  plans: SavedPlan[],
  monthlyIncome: number,
  monthlySubscriptionTotal: number,
): number {
  let sum = 0;
  for (const p of plans) {
    sum += planMonthlyBurden(p, monthlyIncome, monthlySubscriptionTotal);
  }
  return sum;
}
