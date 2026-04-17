/** 0 = most stressed, 10 = healthiest — from income, subs, coverage, and saved-plan load. */
export function computeFinancialSkyScore(input: {
  monthlyIncome: number;
  monthlySubscriptionTotal: number;
  incomeCoversTimes: number | null;
  plansMonthlyNeededSum: number;
}): number {
  const { monthlyIncome, monthlySubscriptionTotal, incomeCoversTimes, plansMonthlyNeededSum } = input;

  if (monthlyIncome <= 0) return 0;

  const subsRatio = monthlySubscriptionTotal / monthlyIncome;
  const net = monthlyIncome - monthlySubscriptionTotal;
  const netRatio = net / monthlyIncome;

  let s = 5;

  if (subsRatio >= 1) s -= 4;
  else if (subsRatio >= 0.92) s -= 3;
  else if (subsRatio >= 0.78) s -= 2;
  else if (subsRatio >= 0.65) s -= 1;
  else if (subsRatio <= 0.22) s += 2;
  else if (subsRatio <= 0.32) s += 1;

  if (incomeCoversTimes != null && incomeCoversTimes > 0) {
    if (incomeCoversTimes >= 2.8) s += 2;
    else if (incomeCoversTimes >= 2) s += 1;
    else if (incomeCoversTimes < 0.85) s -= 3;
    else if (incomeCoversTimes < 1) s -= 2;
    else if (incomeCoversTimes < 1.15) s -= 1;
  }

  if (net < 0) s -= 2;
  else if (netRatio >= 0.55) s += 1;
  else if (netRatio <= 0.08) s -= 2;
  else if (netRatio <= 0.15) s -= 1;

  const burden = plansMonthlyNeededSum / monthlyIncome;
  if (burden > 0.45) s -= 2;
  else if (burden > 0.3) s -= 1;
  else if (burden > 0.18) s -= 1;

  return Math.max(0, Math.min(10, Math.round(s)));
}
