import React from 'react';
import { Calendar, TrendingUp, Wallet } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { analyticsApi, skyAssetsApi } from '../api';
import { useLocale } from '../contexts/LocaleContext';
import { useAuth } from '../contexts/AuthContext';
import { loadPlansForUser } from '../lib/savedPlans';
import { sumSavedPlansMonthlyNeeded } from '../lib/planMath';
import { computeFinancialSkyScore } from '../lib/financialSkyScore';

const DAYS_PER_MONTH = 30;

const LS_SAVINGS = { mode: 'sg_savings_mode', fixed: 'sg_savings_fixed', pct: 'sg_savings_pct' } as const;

type SavingsMode = 'fixed' | 'percent';

function readSavingsPrefs(): { mode: SavingsMode; fixed: number; pct: number } {
  try {
    const m = localStorage.getItem(LS_SAVINGS.mode);
    const fixed = parseInt(localStorage.getItem(LS_SAVINGS.fixed) || '0', 10);
    const pct = parseInt(localStorage.getItem(LS_SAVINGS.pct) || '20', 10);
    return {
      mode: m === 'fixed' ? 'fixed' : 'percent',
      fixed: Number.isFinite(fixed) && fixed >= 0 ? fixed : 0,
      pct: Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 20,
    };
  } catch {
    return { mode: 'percent', fixed: 0, pct: 20 };
  }
}

type DashboardProps = {
  refreshTrigger?: number;
};

const SKY_IMAGE =
  'https://images.unsplash.com/photo-1527482797697-8795b05a13fe?auto=format&fit=crop&w=1600&q=80';

export default function Dashboard({ refreshTrigger = 0 }: DashboardProps) {
  const { t } = useLocale();
  const { user } = useAuth();
  const [plansTick, setPlansTick] = React.useState(0);

  React.useEffect(() => {
    const h = () => setPlansTick((x) => x + 1);
    window.addEventListener('sg-plans-changed', h);
    return () => window.removeEventListener('sg-plans-changed', h);
  }, []);
  const [summary, setSummary] = React.useState<{
    monthlySubscriptionTotal: number;
    yearlyProjected: number;
    monthlyIncome: number;
    incomeCoversTimes: number | null;
    flow: { month: string; income: number; subs: number }[];
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [skyByScore, setSkyByScore] = React.useState<Record<string, string | null>>({});

  React.useEffect(() => {
    let cancelled = false;
    async function loadSkies() {
      try {
        const { assets } = await skyAssetsApi.list();
        if (!cancelled) setSkyByScore(assets);
      } catch {
        /* optional public API */
      }
    }
    void loadSkies();
    const onSky = () => void loadSkies();
    window.addEventListener('sg-sky-assets-changed', onSky);
    return () => {
      cancelled = true;
      window.removeEventListener('sg-sky-assets-changed', onSky);
    };
  }, []);

  const prefsInit = React.useMemo(() => readSavingsPrefs(), []);
  const [savingsMode, setSavingsMode] = React.useState<SavingsMode>(prefsInit.mode);
  const [fixedBahtStr, setFixedBahtStr] = React.useState(() => String(prefsInit.fixed));
  const [percentStr, setPercentStr] = React.useState(() => String(prefsInit.pct));

  React.useEffect(() => {
    localStorage.setItem(LS_SAVINGS.mode, savingsMode);
  }, [savingsMode]);

  React.useEffect(() => {
    const digits = fixedBahtStr.replace(/\D/g, '');
    localStorage.setItem(LS_SAVINGS.fixed, digits || '0');
  }, [fixedBahtStr]);

  React.useEffect(() => {
    const n = parseInt(percentStr, 10);
    if (!Number.isFinite(n)) return;
    localStorage.setItem(LS_SAVINGS.pct, String(Math.min(100, Math.max(0, n))));
  }, [percentStr]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await analyticsApi.summary();
        if (cancelled) return;
        setSummary(s);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load dashboard');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshTrigger]);

  const allPlans = React.useMemo(() => (user?.id ? loadPlansForUser(user.id) : []), [user?.id, plansTick, refreshTrigger]);

  const plansMonthlySum =
    summary && user
      ? sumSavedPlansMonthlyNeeded(allPlans, summary.monthlyIncome, summary.monthlySubscriptionTotal)
      : 0;

  const skyScore = React.useMemo(() => {
    if (!summary) return 5;
    return computeFinancialSkyScore({
      monthlyIncome: summary.monthlyIncome,
      monthlySubscriptionTotal: summary.monthlySubscriptionTotal,
      incomeCoversTimes: summary.incomeCoversTimes,
      plansMonthlyNeededSum: plansMonthlySum,
    });
  }, [summary, plansMonthlySum]);

  const skyImgFilter = React.useMemo(() => {
    const b = 0.44 + skyScore * 0.056;
    const c = 0.9 + skyScore * 0.02;
    const s = 0.72 + skyScore * 0.03;
    return `brightness(${b}) contrast(${c}) saturate(${s})`;
  }, [skyScore]);

  const heroSkySrc = skyByScore[String(skyScore)] || SKY_IMAGE;

  const coverText =
    summary?.incomeCoversTimes != null && summary.incomeCoversTimes > 0
      ? t('dashboard.cover.covers', { n: summary.incomeCoversTimes.toFixed(1) })
      : t('dashboard.cover.addSubs');

  const cards = summary
    ? [
        {
          labelKey: 'dashboard.card.monthly',
          subKey: 'dashboard.card.monthlySub',
          value: `฿${summary.monthlySubscriptionTotal.toFixed(2)}`,
          icon: Calendar,
          color: 'text-primary',
        },
        {
          labelKey: 'dashboard.card.annual',
          subKey: 'dashboard.card.annualSub',
          value: `฿${summary.yearlyProjected.toFixed(2)}`,
          icon: TrendingUp,
          color: 'text-primary',
        },
        {
          labelKey: 'dashboard.card.income',
          subKey: 'dashboard.card.incomeSub',
          value: `฿${summary.monthlyIncome.toFixed(2)}`,
          icon: Wallet,
          color: 'text-secondary',
        },
      ]
    : [];

  const netAfterSubs = summary ? summary.monthlyIncome - summary.monthlySubscriptionTotal : 0;
  const netFloor = Math.max(0, Math.floor(netAfterSubs));
  const fixedParsed = Math.min(netFloor, parseInt(fixedBahtStr.replace(/\D/g, '') || '0', 10) || 0);
  const pctParsed = Math.min(100, Math.max(0, parseInt(percentStr, 10) || 0));

  let savingsAmount = 0;
  if (summary && netAfterSubs > 0) {
    if (savingsMode === 'percent') {
      savingsAmount = Math.round((netAfterSubs * pctParsed) / 100);
    } else {
      savingsAmount = fixedParsed;
    }
    savingsAmount = Math.min(savingsAmount, netFloor);
  }

  const spendableMonthly = summary ? Math.max(0, netAfterSubs - savingsAmount) : 0;
  const spendableDaily = spendableMonthly / DAYS_PER_MONTH;

  if (error) {
    return (
      <div className="rounded-xl border border-accent-rose/30 bg-accent-rose/5 px-6 py-4 text-accent-rose text-sm">
        {error}
      </div>
    );
  }

  const shortCount = allPlans.filter((p) => p.variant === 'short').length;
  const longCount = allPlans.filter((p) => p.variant === 'long').length;

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <section className="relative w-full min-h-[min(22rem,48vw)] md:min-h-[min(26rem,42vw)] rounded-2xl overflow-hidden ambient-shadow border border-on-surface-variant/10">
        <img
          src={heroSkySrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover scale-105"
          style={{ filter: skyImgFilter }}
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-surface/95 via-surface/65 to-primary-light/25" />
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-12 gap-6 p-8 md:p-12 lg:p-14 min-h-[inherit] items-end">
          <div className="md:col-span-3 flex md:flex-col items-baseline md:items-start gap-3">
            <span className="font-stat text-6xl md:text-7xl font-extralight tabular-nums leading-none text-on-surface tracking-tight">
              {skyScore}
            </span>
            <span className="text-xs font-headline uppercase tracking-[0.2em] text-on-surface-variant">/ 10</span>
          </div>
          <div className="md:col-span-9 space-y-3">
            <h2 className="text-2xl md:text-3xl font-headline font-semibold tracking-tight text-on-surface">
              {t('dashboard.skyHero.title')}
            </h2>
            <p className="text-sm text-on-surface-variant leading-relaxed max-w-2xl">{t('dashboard.skyHero.lead')}</p>
            <p className="text-sm md:text-base leading-relaxed text-on-surface max-w-3xl border-l-2 border-primary/40 pl-4">
              {t(`dashboard.sky.${skyScore}`)}
            </p>
            <p className="text-[11px] text-on-surface-variant/85 max-w-2xl pt-1">{t('dashboard.skyHero.computedFrom')}</p>
            <p className="text-xs font-medium text-primary/90 pt-1">{coverText}</p>
          </div>
        </div>
      </section>

      {user && (
        <section className="rounded-xl border border-on-surface-variant/10 bg-white/90 ambient-shadow px-6 py-6 md:px-8 md:py-7">
          <h3 className="text-sm font-headline font-semibold uppercase tracking-widest text-on-surface-variant mb-4">
            {t('dashboard.plans.title')}
          </h3>
          {allPlans.length === 0 ? (
            <p className="text-sm text-on-surface-variant">{t('dashboard.plans.none')}</p>
          ) : (
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-6 sm:gap-10">
              <div>
                <p className="text-xs text-on-surface-variant mb-1">{t('dashboard.plans.shortCount', { n: shortCount })}</p>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant mb-1">{t('dashboard.plans.longCount', { n: longCount })}</p>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant mb-1">{t('dashboard.plans.monthlyLoad')}</p>
                <p className="font-stat text-xl font-medium text-on-surface tabular-nums">฿{plansMonthlySum.toFixed(2)}</p>
              </div>
            </div>
          )}
        </section>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {summary
          ? cards.map((card, i) => (
              <motion.div
                key={card.labelKey}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={cn(
                  'p-8 rounded-xl ambient-shadow transition-colors duration-300',
                  i === 1 && 'bg-rose-50/95 hover:bg-rose-100/80',
                  i === 2 && 'bg-emerald-50/95 hover:bg-emerald-100/80',
                  i === 0 && 'bg-white hover:bg-surface-container',
                )}
              >
                <div className="flex justify-between items-start mb-6">
                  <span className={cn('p-2 bg-white/80 rounded-lg shadow-sm', card.color)}>
                    <card.icon size={20} />
                  </span>
                  <span className="text-xs text-on-surface-variant font-medium opacity-50">{t(card.labelKey)}</span>
                </div>
                <p className="font-stat text-[1.85rem] sm:text-[2rem] font-light tabular-nums tracking-[-0.02em] text-on-surface leading-tight">
                  {card.value}
                </p>
                <p className="text-sm text-on-surface-variant mt-1">{t(card.subKey)}</p>
              </motion.div>
            ))
          : [0, 1, 2].map((i) => <div key={i} className="p-8 rounded-xl bg-white ambient-shadow animate-pulse h-40" />)}
      </section>

      {summary && (
        <section className="rounded-xl border border-on-surface-variant/10 bg-white/90 ambient-shadow p-8 md:p-10 space-y-8">
          <h3 className="text-lg font-headline font-medium">{t('dashboard.balance.title')}</h3>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div>
              <p className="text-xs uppercase tracking-widest text-on-surface-variant mb-2">{t('dashboard.balance.net')}</p>
              <p className={cn('text-2xl font-headline font-bold', netAfterSubs < 0 ? 'text-accent-rose' : 'text-on-surface')}>
                ฿{netAfterSubs.toFixed(2)}
              </p>
              {netAfterSubs < 0 && <p className="text-xs text-accent-rose mt-2">{t('dashboard.balance.negative')}</p>}
            </div>

            <div className="lg:col-span-2 space-y-4">
              <p className="text-xs uppercase tracking-widest text-on-surface-variant">{t('dashboard.balance.adjust')}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSavingsMode('fixed')}
                  className={cn(
                    'px-4 py-2 rounded-full text-xs font-headline font-medium transition-colors',
                    savingsMode === 'fixed' ? 'bg-secondary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-on-surface-variant/15',
                  )}
                >
                  {t('dashboard.balance.modeFixed')}
                </button>
                <button
                  type="button"
                  onClick={() => setSavingsMode('percent')}
                  className={cn(
                    'px-4 py-2 rounded-full text-xs font-headline font-medium transition-colors',
                    savingsMode === 'percent' ? 'bg-secondary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-on-surface-variant/15',
                  )}
                >
                  {t('dashboard.balance.modePercent')}
                </button>
              </div>

              {savingsMode === 'fixed' ? (
                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                  <label className="flex flex-col gap-1 flex-1 min-w-0">
                    <span className="text-[10px] text-on-surface-variant">{t('dashboard.balance.fixedHelp', { max: netFloor })}</span>
                    <div className="flex items-center gap-2 border-b border-on-surface-variant/25 pb-2 focus-within:border-primary">
                      <span className="text-on-surface-variant">฿</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={fixedBahtStr}
                        onChange={(e) => setFixedBahtStr(e.target.value.replace(/\D/g, ''))}
                        onBlur={() => {
                          if (fixedBahtStr === '') setFixedBahtStr('0');
                        }}
                        className="flex-1 min-w-0 bg-transparent border-none focus:ring-0 text-lg font-headline text-on-surface"
                        aria-label={t('dashboard.balance.modeFixed')}
                      />
                    </div>
                  </label>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                  <label className="flex flex-col gap-1 flex-1 min-w-0">
                    <span className="text-[10px] text-on-surface-variant">{t('dashboard.balance.percentHelp')}</span>
                    <div className="flex items-center gap-2 border-b border-on-surface-variant/25 pb-2 focus-within:border-primary">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={percentStr}
                        onChange={(e) => {
                          const d = e.target.value.replace(/\D/g, '');
                          if (d === '') {
                            setPercentStr('');
                            return;
                          }
                          const n = Math.min(100, parseInt(d, 10));
                          setPercentStr(String(Number.isFinite(n) ? n : 0));
                        }}
                        onBlur={() => {
                          if (percentStr === '') setPercentStr('0');
                        }}
                        className="w-24 bg-transparent border-none focus:ring-0 text-lg font-headline text-on-surface"
                        aria-label={t('dashboard.balance.modePercent')}
                      />
                      <span className="text-on-surface-variant">%</span>
                    </div>
                  </label>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2 border-t border-on-surface-variant/10">
            <div>
              <p className="text-xs uppercase tracking-widest text-on-surface-variant mb-2">{t('dashboard.balance.savings')}</p>
              <p className="text-2xl font-headline font-bold text-on-surface">฿{savingsAmount.toFixed(0)}</p>
              <p className="text-[11px] text-on-surface-variant mt-2">{t('dashboard.balance.savingsHint')}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest text-on-surface-variant mb-2">{t('dashboard.balance.spendable')}</p>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-on-surface-variant/80 mb-1">{t('dashboard.balance.perMonth')}</p>
                  <p className="text-2xl font-headline font-bold text-primary">฿{spendableMonthly.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-on-surface-variant/80 mb-1">{t('dashboard.balance.perDay')}</p>
                  <p className="text-xl font-headline font-semibold text-primary/90">฿{spendableDaily.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="w-full min-w-0 bg-white p-8 md:p-10 rounded-xl ambient-shadow">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-4 mb-8">
          <h3 className="text-lg font-headline font-medium">{t('dashboard.flow.title')}</h3>
          <p className="text-xs text-on-surface-variant uppercase tracking-widest">{t('dashboard.flow.period')}</p>
        </div>
        <div className="h-[min(28rem,50vw)] w-full min-h-[16rem] min-w-0">
          {summary && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.flow} margin={{ top: 8, right: 12, left: 4, bottom: 8 }}>
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: '#5c605d', opacity: 0.6 }}
                  dy={10}
                />
                <Tooltip
                  cursor={{ fill: '#eceeea', opacity: 0.4 }}
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Bar dataKey="income" fill="#456279" opacity={0.2} radius={[2, 2, 0, 0]} barSize={48} />
                <Bar dataKey="subs" fill="#b7d5f0" radius={[2, 2, 0, 0]} barSize={48} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="mt-8 flex flex-wrap gap-8 items-center text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary/20"></div>
            <span className="text-on-surface-variant opacity-70">{t('dashboard.flow.legendIncome')}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary-light"></div>
            <span className="text-on-surface-variant opacity-70">{t('dashboard.flow.legendSubs')}</span>
          </div>
        </div>
      </section>

      <section className="mt-20 pt-12">
        <div className="relative h-[400px] w-full rounded-2xl overflow-hidden group">
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBZdNtR41BinmdDhoNHOjNPe6JZ-cDC4uQ6vZghhji7zbFXeyLlaY_XwezEaaCw7qJlMfope-mH6WKbsAlIusXhtimG4MTCd7HKq7l8NwB6F3Fl2ZAZglwBeL3Luh7Hp4hQSZGTPdylqy0wXVqJtrrTjmBEhARiQ2QYrgflDuyn-q39BrRtjfoLrGBAjJjHh9-_TYTHlpXcNoz1tySAnKDSIkP_CCFyEuqmU9Oe7s-XMrl8l9WlIOCwJb2hpR6YcJOu_fGqCuMPjHY"
            alt=""
            className="w-full h-full object-cover grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-1000"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface/80 via-transparent to-transparent"></div>
          <div className="absolute bottom-12 left-12 max-w-md space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-on-surface font-bold">{t('dashboard.curator.label')}</p>
            <h4 className="text-2xl font-headline font-light text-on-surface leading-snug">{t('dashboard.curator.quote')}</h4>
          </div>
        </div>
      </section>
    </div>
  );
}
