import React from 'react';
import { Palette, Cloud, Music, Headphones, Zap } from 'lucide-react';
import { cn } from '../lib/utils';
import { subscriptionsApi } from '../api';
import type { ApiSubscription } from '../api';
import { format, addMonths, addWeeks, addYears } from 'date-fns';
import { th } from 'date-fns/locale';
import { useLocale } from '../contexts/LocaleContext';

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  palette: Palette,
  cloud: Cloud,
  music: Music,
  headphones: Headphones,
  zap: Zap,
};

const FILTERS: { key: string; labelKey: string }[] = [
  { key: 'All Curations', labelKey: 'subs.filter.all' },
  { key: 'Monthly', labelKey: 'subs.filter.monthly' },
  { key: 'Yearly', labelKey: 'subs.filter.yearly' },
  { key: 'Weekly', labelKey: 'subs.filter.weekly' },
  { key: 'Entertainment', labelKey: 'subs.filter.entertainment' },
  { key: 'Work', labelKey: 'subs.filter.work' },
  { key: 'Utilities', labelKey: 'subs.filter.utilities' },
];

function nextPaymentLabel(sub: ApiSubscription, locale: 'en' | 'th'): string {
  const start = new Date(sub.billingStart + 'T12:00:00');
  const now = new Date();
  let next = start;
  while (next <= now) {
    if (sub.billingCycle === 'Weekly') next = addWeeks(next, 1);
    else if (sub.billingCycle === 'Monthly') next = addMonths(next, 1);
    else next = addYears(next, 1);
  }
  return format(next, 'MMM d, yyyy', { locale: locale === 'th' ? th : undefined });
}

interface SubscriptionListProps {
  searchQuery: string;
  refreshTrigger: number;
  onEditSubscription: (sub: ApiSubscription) => void;
  onDataChange?: () => void;
}

export default function SubscriptionList({
  searchQuery,
  refreshTrigger,
  onEditSubscription,
  onDataChange,
}: SubscriptionListProps) {
  const { locale, t } = useLocale();
  const [list, setList] = React.useState<ApiSubscription[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState('All Curations');
  const [tab, setTab] = React.useState<'active' | 'archived'>('active');
  const [busyId, setBusyId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { subscriptions } = await subscriptionsApi.list(searchQuery || undefined);
        if (!cancelled) {
          setList(subscriptions);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchQuery, refreshTrigger]);

  const scoped = list.filter((s) => (tab === 'active' ? !s.archived : s.archived));

  const filtered = scoped.filter((sub) => {
    if (filter === 'All Curations') return true;
    if (filter === 'Monthly' || filter === 'Yearly' || filter === 'Weekly') return sub.billingCycle === filter;
    if (filter === 'Entertainment' || filter === 'Work' || filter === 'Utilities')
      return sub.category.toLowerCase().includes(filter.toLowerCase());
    return true;
  });

  const featured = filtered[0];
  const FeaturedIcon = featured ? iconMap[featured.icon || 'palette'] || Palette : Palette;
  const smallCards = filtered.slice(1, 3);
  const rest = filtered.slice(3);

  async function handleEnd(sub: ApiSubscription) {
    if (!window.confirm(t('subs.endConfirm'))) return;
    setBusyId(sub.id);
    try {
      await subscriptionsApi.patch(sub.id, { archived: true });
      onDataChange?.();
      const { subscriptions } = await subscriptionsApi.list(searchQuery || undefined);
      setList(subscriptions);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setBusyId(null);
    }
  }

  function periodSuffix(sub: ApiSubscription) {
    if (sub.billingCycle === 'Yearly') return t('subs.perYear');
    if (sub.billingCycle === 'Weekly') return t('subs.perWeek');
    return t('subs.perMonth');
  }

  if (error) {
    return (
      <div className="rounded-xl border border-accent-rose/30 bg-accent-rose/5 px-6 py-4 text-accent-rose text-sm">{error}</div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in duration-700">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="max-w-2xl">
          <h2 className="text-5xl font-extralight text-primary mb-4 leading-tight font-headline">{t('subs.title')}</h2>
          <p className="text-on-surface-variant leading-relaxed max-w-lg">{t('subs.subtitle')}</p>
        </div>
        <div className="flex gap-2 bg-surface-container p-1 rounded-full">
          <button
            type="button"
            onClick={() => setTab('active')}
            className={cn(
              'px-6 py-2 rounded-full font-medium text-sm transition-colors',
              tab === 'active' ? 'bg-white text-primary ambient-shadow' : 'text-on-surface-variant hover:bg-surface-container',
            )}
          >
            {t('subs.tab.active')}
          </button>
          <button
            type="button"
            onClick={() => setTab('archived')}
            className={cn(
              'px-6 py-2 rounded-full font-medium text-sm transition-colors',
              tab === 'archived' ? 'bg-white text-primary ambient-shadow' : 'text-on-surface-variant hover:bg-surface-container',
            )}
          >
            {t('subs.tab.archived')}
          </button>
        </div>
      </section>

      <section className="flex flex-wrap gap-3">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              'px-5 py-1.5 rounded-md text-xs font-medium tracking-wide transition-colors',
              filter === f.key
                ? 'bg-secondary text-white'
                : 'bg-surface-container text-on-surface-variant hover:bg-on-surface-variant/10',
            )}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </section>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-8 h-64 bg-white rounded-xl animate-pulse" />
          <div className="md:col-span-4 h-64 bg-surface-container rounded-xl animate-pulse" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-on-surface-variant italic text-center py-24">
          {t('subs.empty')} {tab === 'active' ? t('subs.empty.activeHint') : ''}
        </p>
      ) : (
        <section className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {featured && (
            <div className="md:col-span-8 bg-white rounded-xl p-8 ambient-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary-light/20 rounded-full -mr-20 -mt-20 blur-3xl transition-transform duration-500 group-hover:scale-110"></div>
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-14 h-14 bg-surface-container rounded-xl flex items-center justify-center">
                      <FeaturedIcon size={30} className="text-primary" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-semibold text-on-surface font-headline">{featured.name}</h3>
                      <p className="text-on-surface-variant text-sm font-medium">{featured.category}</p>
                    </div>
                  </div>
                  <div className="flex gap-12 mt-8">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">{t('subs.billingCycle')}</p>
                      <p className="font-medium text-primary">{featured.billingCycle}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">{t('subs.nextPayment')}</p>
                      <p className="font-medium text-primary">{nextPaymentLabel(featured, locale)}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-12 flex flex-wrap items-baseline justify-between gap-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-light text-on-surface">฿{featured.amount.toFixed(2)}</span>
                    <span className="text-on-surface-variant text-sm">/ {periodSuffix(featured)}</span>
                  </div>
                  {tab === 'active' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onEditSubscription(featured)}
                        className="text-xs uppercase tracking-wide px-4 py-2 rounded-full border border-primary/30 text-primary hover:bg-primary/5 transition-colors"
                      >
                        {t('subs.edit')}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === featured.id}
                        onClick={() => handleEnd(featured)}
                        className="text-xs uppercase tracking-wide px-4 py-2 rounded-full border border-accent-rose/40 text-accent-rose hover:bg-accent-rose/10 transition-colors disabled:opacity-50"
                      >
                        {t('subs.end')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {smallCards.map((sub) => {
            const Icon = iconMap[sub.icon || 'palette'] || Palette;
            return (
              <div
                key={sub.id}
                className="md:col-span-4 bg-surface-container rounded-xl p-8 flex flex-col justify-between hover:bg-on-surface-variant/5 transition-colors"
              >
                <div>
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center mb-6">
                    <Icon size={20} className="text-secondary" />
                  </div>
                  <h3 className="text-xl font-medium text-on-surface font-headline">{sub.name}</h3>
                  <p className="text-on-surface-variant text-sm mt-1">{sub.category}</p>
                </div>
                <div className="mt-8 space-y-3">
                  <p className="text-2xl font-light text-on-surface">฿{sub.amount.toFixed(2)}</p>
                  <p className="text-xs text-on-surface-variant font-medium">{nextPaymentLabel(sub, locale)}</p>
                  {tab === 'active' && (
                    <div className="flex gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => onEditSubscription(sub)}
                        className="text-[10px] uppercase tracking-wide px-3 py-1.5 rounded-full border border-primary/30 text-primary hover:bg-primary/5"
                      >
                        {t('subs.edit')}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === sub.id}
                        onClick={() => handleEnd(sub)}
                        className="text-[10px] uppercase tracking-wide px-3 py-1.5 rounded-full border border-accent-rose/40 text-accent-rose hover:bg-accent-rose/10 disabled:opacity-50"
                      >
                        {t('subs.end')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          <div className="md:col-span-8 flex flex-col gap-6">
            {rest.map((sub) => {
              const Icon = iconMap[sub.icon || 'palette'] || Palette;
              return (
                <div
                  key={sub.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-white rounded-xl hover:translate-x-2 transition-transform ambient-shadow"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 bg-surface-container rounded-full flex items-center justify-center shrink-0">
                      <Icon size={20} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-medium text-on-surface font-headline truncate">{sub.name}</h4>
                      <p className="text-xs text-on-surface-variant">
                        {sub.category} • {sub.billingCycle}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="font-semibold text-primary">฿{sub.amount.toFixed(2)}</p>
                      <p className="text-[10px] text-on-surface-variant uppercase tracking-tighter">
                        {nextPaymentLabel(sub, locale)}
                      </p>
                    </div>
                    {tab === 'active' && (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => onEditSubscription(sub)}
                          className="text-[10px] uppercase tracking-wide px-3 py-1.5 rounded-full border border-primary/30 text-primary hover:bg-primary/5"
                        >
                          {t('subs.edit')}
                        </button>
                        <button
                          type="button"
                          disabled={busyId === sub.id}
                          onClick={() => handleEnd(sub)}
                          className="text-[10px] uppercase tracking-wide px-3 py-1.5 rounded-full border border-accent-rose/40 text-accent-rose hover:bg-accent-rose/10 disabled:opacity-50"
                        >
                          {t('subs.end')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
