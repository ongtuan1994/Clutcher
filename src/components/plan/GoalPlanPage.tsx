import React from 'react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { analyticsApi } from '../../api';
import { useLocale } from '../../contexts/LocaleContext';
import { useAuth } from '../../contexts/AuthContext';
import { longPlanMetrics, monthsUntilTarget, planMetrics } from '../../lib/planMath';
import { addPlan, loadPlansForUser, removePlan, type SavedPlan } from '../../lib/savedPlans';

type Variant = 'short' | 'long';

type ShortGoal = 'travel' | 'course';
type LongGoal = 'car' | 'house' | 'invest';

function goalLabelKey(variant: Variant, goalId: string): string {
  return variant === 'short' ? `plan.short.${goalId}` : `plan.long.${goalId}`;
}

export default function GoalPlanPage({ variant }: { variant: Variant }) {
  const { locale, t } = useLocale();
  const { user } = useAuth();
  const dateLocale = locale === 'th' ? th : undefined;

  const now = React.useMemo(() => new Date(), []);
  const [goalShort, setGoalShort] = React.useState<ShortGoal>('travel');
  const [goalLong, setGoalLong] = React.useState<LongGoal>('car');
  const [budgetStr, setBudgetStr] = React.useState('');
  const [detailsStr, setDetailsStr] = React.useState('');
  const [initialStr, setInitialStr] = React.useState('');
  const [monthlyPayStr, setMonthlyPayStr] = React.useState('');
  const [month, setMonth] = React.useState(now.getMonth() + 1);
  const [year, setYear] = React.useState(now.getFullYear() + 1);

  const [income, setIncome] = React.useState<number | null>(null);
  const [subs, setSubs] = React.useState<number | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState<SavedPlan[]>([]);

  const refreshSaved = React.useCallback(() => {
    if (!user?.id) {
      setSaved([]);
      return;
    }
    setSaved(loadPlansForUser(user.id).filter((p) => p.variant === variant));
  }, [user?.id, variant]);

  React.useEffect(() => {
    refreshSaved();
    const onChange = () => refreshSaved();
    window.addEventListener('sg-plans-changed', onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener('sg-plans-changed', onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [refreshSaved]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await analyticsApi.summary();
        if (!cancelled) {
          setIncome(s.monthlyIncome);
          setSubs(s.monthlySubscriptionTotal);
          setLoadError(null);
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const budget = Number(budgetStr.replace(/,/g, ''));
  const validBudget = Number.isFinite(budget) && budget > 0;
  const initialCapital = Number(initialStr.replace(/,/g, ''));
  const validInitial = Number.isFinite(initialCapital) && initialCapital >= 0;
  const monthlyPayment = Number(monthlyPayStr.replace(/,/g, ''));
  const validLongPayment = variant === 'long' ? Number.isFinite(monthlyPayment) && monthlyPayment > 0 : true;

  const months = monthsUntilTarget(year, month);
  const canBase = validBudget && months !== null && income !== null && subs !== null;
  const canComputeShort = variant === 'short' && canBase;
  const canComputeLong = variant === 'long' && canBase && validInitial && validLongPayment;
  const canCompute = canComputeShort || canComputeLong;

  const resultShort = canComputeShort ? planMetrics(budget, months!, income!, subs!) : null;
  const resultLong = canComputeLong ? longPlanMetrics(budget, initialCapital, months!, income!, subs!, monthlyPayment) : null;
  const result = variant === 'short' ? resultShort : resultLong;

  const titleKey = variant === 'short' ? 'plan.short.title' : 'plan.long.title';
  const subKey = variant === 'short' ? 'plan.short.subtitle' : 'plan.long.subtitle';

  const goalOptions =
    variant === 'short'
      ? (['travel', 'course'] as const).map((id) => ({ id, labelKey: `plan.short.${id}` as const }))
      : (['car', 'house', 'invest'] as const).map((id) => ({ id, labelKey: `plan.long.${id}` as const }));

  const currentGoalId = variant === 'short' ? goalShort : goalLong;

  function handleSave() {
    if (!user?.id || !canCompute || months === null) return;
    if (variant === 'short') {
      addPlan(user.id, {
        variant: 'short',
        goalId: currentGoalId,
        budget,
        year,
        month,
        details: detailsStr.trim() || undefined,
      });
    } else {
      addPlan(user.id, {
        variant: 'long',
        goalId: currentGoalId,
        budget,
        year,
        month,
        initialCapital,
        monthlyPayment,
      });
    }
    refreshSaved();
  }

  function handleDelete(id: string) {
    if (!user?.id) return;
    removePlan(user.id, id);
    refreshSaved();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-10 animate-in fade-in duration-700 w-full min-w-0">
      <header>
        <h2 className="text-3xl md:text-4xl font-headline font-semibold text-on-surface tracking-tight">{t(titleKey)}</h2>
        <p className="text-on-surface-variant mt-3 leading-relaxed">{t(subKey)}</p>
      </header>

      {loadError && (
        <div className="rounded-xl border border-accent-rose/30 bg-accent-rose/5 px-4 py-3 text-sm text-accent-rose">{loadError}</div>
      )}

      <div className="bg-white rounded-2xl ambient-shadow border border-on-surface-variant/5 p-8 space-y-8">
        <div>
          <p className="text-xs uppercase tracking-widest text-on-surface-variant font-semibold mb-3">{t('plan.goalKind')}</p>
          <div className="flex flex-wrap gap-2">
            {goalOptions.map((opt) => {
              const active = variant === 'short' ? goalShort === opt.id : goalLong === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    if (variant === 'short') setGoalShort(opt.id as ShortGoal);
                    else setGoalLong(opt.id as LongGoal);
                  }}
                  className={cn(
                    'px-4 py-2 rounded-full text-sm font-headline transition-colors',
                    active ? 'bg-secondary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-on-surface-variant/10',
                  )}
                >
                  {t(opt.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        {variant === 'short' && (
          <div>
            <label className="text-xs uppercase tracking-widest text-on-surface-variant font-semibold mb-2 block">
              {t(`plan.short.detailsLabel.${goalShort}`)}
            </label>
            <textarea
              value={detailsStr}
              onChange={(e) => setDetailsStr(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-on-surface-variant/15 px-4 py-3 bg-surface text-on-surface text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y min-h-[5rem]"
              placeholder={t(`plan.short.detailsPh.${goalShort}`)}
            />
          </div>
        )}

        {variant === 'long' && (
          <>
            <div>
              <label className="text-xs uppercase tracking-widest text-on-surface-variant font-semibold mb-2 block">
                {t('plan.long.initialCapital')}
              </label>
              <div className="flex items-center gap-2 border-b border-on-surface-variant/20 pb-2 focus-within:border-primary">
                <span className="text-on-surface-variant">฿</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={initialStr}
                  onChange={(e) => setInitialStr(e.target.value.replace(/[^0-9.]/g, ''))}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-xl font-stat font-light text-on-surface"
                  placeholder="0"
                />
              </div>
              <p className="text-[11px] text-on-surface-variant/80 mt-2">{t('plan.long.initialHint')}</p>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-on-surface-variant font-semibold mb-2 block">
                {t('plan.long.monthlyPayment')}
              </label>
              <div className="flex items-center gap-2 border-b border-on-surface-variant/20 pb-2 focus-within:border-primary">
                <span className="text-on-surface-variant">฿</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={monthlyPayStr}
                  onChange={(e) => setMonthlyPayStr(e.target.value.replace(/[^0-9.]/g, ''))}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-xl font-stat font-light text-on-surface"
                  placeholder="0"
                />
              </div>
              <p className="text-[11px] text-on-surface-variant/80 mt-2">{t('plan.long.monthlyHint')}</p>
            </div>
          </>
        )}

        <div>
          <label className="text-xs uppercase tracking-widest text-on-surface-variant font-semibold mb-2 block">
            {variant === 'long' ? t('plan.long.targetTotal') : t('plan.budget')}
          </label>
          <div className="flex items-center gap-2 border-b border-on-surface-variant/20 pb-2 focus-within:border-primary">
            <span className="text-on-surface-variant">฿</span>
            <input
              type="text"
              inputMode="decimal"
              value={budgetStr}
              onChange={(e) => setBudgetStr(e.target.value.replace(/[^0-9.]/g, ''))}
              className="flex-1 bg-transparent border-none focus:ring-0 text-xl font-stat font-light text-on-surface"
              placeholder="0"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="text-xs uppercase tracking-widest text-on-surface-variant font-semibold mb-2 block">
              {t('plan.targetMonth')}
            </label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full rounded-xl border border-on-surface-variant/15 px-4 py-3 bg-surface text-on-surface"
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {format(new Date(2000, i, 1), 'MMMM', { locale: dateLocale })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-on-surface-variant font-semibold mb-2 block">
              {t('plan.targetYear')}
            </label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded-xl border border-on-surface-variant/15 px-4 py-3 bg-surface text-on-surface"
            >
              {Array.from({ length: 16 }, (_, i) => now.getFullYear() + i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {result && user?.id && (
          <button
            type="button"
            onClick={handleSave}
            className="signature-gradient text-white font-headline font-semibold text-sm px-8 py-3 rounded-full tracking-wide"
          >
            {t('plan.save')}
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-on-surface-variant/10 bg-surface-container/40 p-8 space-y-4">
        {income === null && subs === null && !loadError && (
          <p className="text-sm text-on-surface-variant">{t('common.loading')}</p>
        )}
        {!validBudget && income !== null && <p className="text-sm text-on-surface-variant">{t('plan.invalidAmount')}</p>}
        {variant === 'long' && validBudget && income !== null && !validInitial && (
          <p className="text-sm text-on-surface-variant">{t('plan.long.invalidInitial')}</p>
        )}
        {variant === 'long' && validBudget && validInitial && income !== null && !validLongPayment && (
          <p className="text-sm text-on-surface-variant">{t('plan.long.invalidMonthly')}</p>
        )}
        {validBudget && months === null && income !== null && <p className="text-sm text-accent-rose">{t('plan.pastError')}</p>}
        {variant === 'short' && resultShort && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">{t('plan.monthsLabel')}</p>
                <p className="font-stat text-2xl font-medium text-on-surface tabular-nums">{months}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">{t('plan.monthlyMin')}</p>
                <p className="font-stat text-2xl font-medium text-primary tabular-nums">฿{resultShort.monthlyNeeded.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">{t('plan.surplusLabel')}</p>
                <p className="font-stat text-xl font-light text-on-surface tabular-nums">฿{resultShort.surplusAfterSubs.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">{t('plan.extraSave')}</p>
                {resultShort.gap > 0 ? (
                  <p className="font-stat text-xl font-medium text-accent-rose tabular-nums">฿{resultShort.gap.toFixed(2)}</p>
                ) : (
                  <p className="text-sm text-emerald-700">{t('plan.covered')}</p>
                )}
              </div>
            </div>
            <p className="text-xs text-on-surface-variant/80 leading-relaxed pt-2 border-t border-on-surface-variant/10">
              {t('plan.footnote')}
            </p>
          </>
        )}
        {variant === 'long' && resultLong && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">{t('plan.monthsLabel')}</p>
                <p className="font-stat text-2xl font-medium text-on-surface tabular-nums">{months}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">{t('plan.long.remaining')}</p>
                <p className="font-stat text-2xl font-medium text-on-surface tabular-nums">฿{resultLong.remaining.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">{t('plan.long.requiredMonthly')}</p>
                <p className="font-stat text-2xl font-medium text-primary tabular-nums">฿{resultLong.requiredMonthly.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">{t('plan.long.yourMonthly')}</p>
                <p className="font-stat text-2xl font-medium text-on-surface tabular-nums">฿{resultLong.monthlyPayment.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">{t('plan.surplusLabel')}</p>
                <p className="font-stat text-xl font-light text-on-surface tabular-nums">฿{resultLong.surplusAfterSubs.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">{t('plan.long.vsSurplus')}</p>
                {resultLong.gap > 0 ? (
                  <p className="font-stat text-xl font-medium text-accent-rose tabular-nums">฿{resultLong.gap.toFixed(2)}</p>
                ) : (
                  <p className="text-sm text-emerald-700">{t('plan.long.surplusOk')}</p>
                )}
              </div>
              {resultLong.paymentShortfall > 0 && (
                <div className="sm:col-span-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
                  {t('plan.long.paymentShortfall', { n: resultLong.paymentShortfall.toFixed(2) })}
                </div>
              )}
            </div>
            <p className="text-xs text-on-surface-variant/80 leading-relaxed pt-2 border-t border-on-surface-variant/10">
              {t('plan.long.footnote')}
            </p>
          </>
        )}
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-headline font-semibold uppercase tracking-widest text-on-surface-variant">{t('plan.savedTitle')}</h3>
        {saved.length === 0 ? (
          <p className="text-sm text-on-surface-variant italic">{t('plan.savedEmpty')}</p>
        ) : (
          <ul className="space-y-3">
            {saved.map((p) => {
              const m = monthsUntilTarget(p.year, p.month);
              let extraLine = '';
              if (p.variant === 'short' && p.details) {
                extraLine = p.details;
              }
              if (p.variant === 'long' && m !== null && income !== null && subs !== null) {
                if (p.monthlyPayment != null && p.monthlyPayment > 0) {
                  const lm = longPlanMetrics(
                    p.budget,
                    p.initialCapital ?? 0,
                    m,
                    income,
                    subs,
                    p.monthlyPayment,
                  );
                  extraLine = `${t('plan.long.initialCapital')} ฿${(p.initialCapital ?? 0).toLocaleString()} · ${t('plan.long.yourMonthly')} ฿${p.monthlyPayment.toFixed(0)} · ${t('plan.long.requiredMonthly')} ฿${lm.requiredMonthly.toFixed(0)}`;
                } else {
                  const pm = planMetrics(p.budget, m, income, subs);
                  extraLine = `${t('plan.monthlyMin')} ฿${pm.monthlyNeeded.toFixed(0)}`;
                }
              }
              return (
                <li
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-on-surface-variant/10 bg-white px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-on-surface truncate">
                      {t(goalLabelKey(p.variant, p.goalId))} · ฿{p.budget.toLocaleString()}
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      {format(new Date(p.year, p.month - 1, 1), 'MMM yyyy', { locale: dateLocale })}
                    </p>
                    {extraLine ? <p className="text-xs text-on-surface-variant/90 mt-1 line-clamp-2">{extraLine}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(p.id)}
                    className="shrink-0 inline-flex items-center gap-1.5 text-xs text-accent-rose hover:bg-accent-rose/10 px-3 py-1.5 rounded-full border border-accent-rose/30"
                  >
                    <Trash2 size={14} />
                    {t('plan.delete')}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
