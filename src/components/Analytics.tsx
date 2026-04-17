import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { analyticsApi, subscriptionsApi } from '../api';
import { monthlyEquivalent } from '../lib/money';
import { motion } from 'motion/react';
import { useLocale } from '../contexts/LocaleContext';

const PIE_COLORS = ['#456279', '#b7d5f0', '#675e4f', '#fb7185', '#5c605d', '#eceeea'];

export default function Analytics() {
  const { t } = useLocale();
  const [summary, setSummary] = React.useState<{
    monthlySubscriptionTotal: number;
    yearlyProjected: number;
    monthlyIncome: number;
    incomeCoversTimes: number | null;
    flow: { month: string; income: number; subs: number }[];
  } | null>(null);
  const [byCategory, setByCategory] = React.useState<{ name: string; value: number }[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, subs] = await Promise.all([analyticsApi.summary(), subscriptionsApi.list()]);
        if (cancelled) return;
        setSummary(s);
        const map = new Map<string, number>();
        for (const sub of subs.subscriptions.filter((x) => !x.archived)) {
          const perMonth = monthlyEquivalent(sub.amount, sub.billingCycle);
          map.set(sub.category, (map.get(sub.category) || 0) + perMonth);
        }
        setByCategory(
          [...map.entries()].map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })),
        );
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load analytics');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-accent-rose/30 bg-accent-rose/5 px-6 py-4 text-accent-rose text-sm">{error}</div>
    );
  }

  return (
    <div className="space-y-10 w-full min-w-0 animate-in fade-in duration-700">
      <header>
        <h2 className="text-4xl font-headline font-bold text-on-surface tracking-tight">{t('analytics.title')}</h2>
        <p className="text-on-surface-variant mt-2 max-w-2xl">{t('analytics.subtitle')}</p>
      </header>

      {!summary ? (
        <div className="h-64 bg-white rounded-xl animate-pulse ambient-shadow" />
      ) : (
        <>
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { labelKey: 'analytics.cardMonthly', value: `฿${summary.monthlySubscriptionTotal.toFixed(2)}` },
              { labelKey: 'analytics.cardYearly', value: `฿${summary.yearlyProjected.toFixed(2)}` },
              {
                labelKey: 'analytics.cardCoverage',
                value:
                  summary.incomeCoversTimes != null && summary.incomeCoversTimes > 0
                    ? `${summary.incomeCoversTimes.toFixed(2)}×`
                    : '—',
              },
            ].map((card, i) => (
              <motion.div
                key={card.labelKey}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="p-8 rounded-2xl bg-white ambient-shadow border border-on-surface-variant/5"
              >
                <p className="text-xs uppercase tracking-widest text-on-surface-variant/60 mb-2">{t(card.labelKey)}</p>
                <p className="text-3xl font-headline font-semibold text-on-surface">{card.value}</p>
              </motion.div>
            ))}
          </section>

          <section className="w-full min-w-0 bg-white p-8 md:p-10 rounded-2xl ambient-shadow border border-on-surface-variant/5">
            <h3 className="text-lg font-headline font-medium mb-6">{t('analytics.incomeVsSubs')}</h3>
            <div className="h-[min(26rem,55vw)] w-full min-h-[18rem] min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={summary.flow} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#5c605d' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#5c605d' }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Bar dataKey="income" fill="#456279" opacity={0.35} radius={[4, 4, 0, 0]} name={t('analytics.barIncome')} />
                  <Bar dataKey="subs" fill="#b7d5f0" radius={[4, 4, 0, 0]} name={t('analytics.barSubs')} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="w-full min-w-0 bg-white p-8 md:p-10 rounded-2xl ambient-shadow border border-on-surface-variant/5">
            {byCategory.length === 0 ? (
              <p className="text-on-surface-variant italic py-12 text-center">{t('analytics.emptyCategory')}</p>
            ) : (
              <>
                <div className="h-[min(28rem,60vw)] w-full min-h-[20rem] min-w-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 48 }}>
                      <Pie
                        data={byCategory}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="42%"
                        outerRadius={150}
                        label={({ name, value }) => `${name}: ฿${value}`}
                      >
                        {byCategory.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Legend verticalAlign="bottom" layout="horizontal" wrapperStyle={{ paddingTop: 16 }} />
                      <Tooltip formatter={(v: number) => `฿${v}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <h3 className="text-lg font-headline font-medium mt-10 mb-2">{t('analytics.spendByCategory')}</h3>
                <p className="text-sm text-on-surface-variant leading-relaxed max-w-3xl">{t('analytics.categoryNote')}</p>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
