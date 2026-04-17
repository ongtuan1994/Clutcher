import React from 'react';
import { Bell, CalendarCheck, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import {
  ResponsiveContainer,
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { reconciliationApi, analyticsApi } from '../api';
import type { ApiReconciliationRecord } from '../api';
import { useLocale } from '../contexts/LocaleContext';

function formatCompactBaht(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `฿${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `฿${(n / 1_000).toFixed(1)}k`;
  return `฿${Math.round(n).toLocaleString()}`;
}

function translateStatus(status: string, t: (k: string) => string): string {
  if (status === 'Perfect Match') return t('recon.statusPerfect');
  if (status === 'Balanced') return t('recon.statusBalanced');
  if (status === 'Adjusted') return t('recon.statusAdjusted');
  return status;
}

export default function Reconciliation() {
  const { locale, t } = useLocale();
  const dateLocale = locale === 'th' ? th : undefined;

  const [records, setRecords] = React.useState<ApiReconciliationRecord[]>([]);
  const [trajectory, setTrajectory] = React.useState<{
    points: { label: string; real: number; projected: number }[];
    defaultProjected: number;
  } | null>(null);
  const [balance, setBalance] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const now = new Date();
  const [year, setYear] = React.useState(now.getFullYear());
  const [month, setMonth] = React.useState(now.getMonth() + 1);

  async function load() {
    setLoading(true);
    try {
      const [recRes, tr] = await Promise.all([reconciliationApi.list(), analyticsApi.trajectory()]);
      setRecords(recRes.records);
      setTrajectory(tr);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  const deltaByRecordId = React.useMemo(() => {
    const map = new Map<string, number>();
    if (records.length < 2) return map;
    const asc = [...records].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.monthNum - b.monthNum;
    });
    for (let i = 1; i < asc.length; i++) {
      const prev = asc[i - 1];
      const curr = asc[i];
      map.set(curr.id, curr.realBalance - prev.realBalance);
    }
    return map;
  }, [records]);

  const latestMom = React.useMemo(() => {
    if (records.length < 2) return null;
    const asc = [...records].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.monthNum - b.monthNum;
    });
    const prev = asc[asc.length - 2];
    const curr = asc[asc.length - 1];
    const d = curr.realBalance - prev.realBalance;
    return {
      fromLabel: format(new Date(prev.year, prev.monthNum - 1, 1), 'MMMM yyyy', { locale: dateLocale }),
      toLabel: format(new Date(curr.year, curr.monthNum - 1, 1), 'MMMM yyyy', { locale: dateLocale }),
      delta: d,
    };
  }, [records, dateLocale]);

  const last = records[0];
  const currentPeriodLabel = format(new Date(year, month - 1, 1), 'MMMM yyyy', { locale: dateLocale });

  async function handleRecord(e: React.FormEvent) {
    e.preventDefault();
    const val = Number(balance.replace(/,/g, ''));
    if (Number.isNaN(val)) {
      setError(t('recon.invalidBalance'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await reconciliationApi.record({ year, month, realBalance: val });
      setBalance('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const trajectorySeries = React.useMemo(() => {
    if (!trajectory?.points?.length) return [];
    return trajectory.points.map((p, i) => {
      const prev = i > 0 ? trajectory.points[i - 1].real : null;
      const momDelta = prev === null ? null : p.real - prev;
      return {
        label: p.label,
        balance: p.real,
        momDelta,
        projectedSubs: p.projected,
      };
    });
  }, [trajectory]);

  const chartStats = React.useMemo(() => {
    const s = trajectorySeries;
    if (s.length < 1) return null;
    if (s.length < 2) {
      return { net: 0, avgAbs: 0, months: s.length, hasTrend: false };
    }
    const first = s[0].balance;
    const last = s[s.length - 1].balance;
    const net = last - first;
    const deltas = s.map((x) => x.momDelta).filter((d): d is number => d !== null);
    const avgAbs = deltas.length ? deltas.reduce((a, b) => a + Math.abs(b), 0) / deltas.length : 0;
    return { net, avgAbs, months: s.length, hasTrend: true };
  }, [trajectorySeries]);

  const deltaBars = React.useMemo(
    () =>
      trajectorySeries
        .filter((row) => row.momDelta !== null)
        .map((row) => ({
          label: row.label,
          momDelta: row.momDelta as number,
        })),
    [trajectorySeries],
  );

  const balanceDomain = React.useMemo(() => {
    if (!trajectorySeries.length) return [0, 1];
    const vals = trajectorySeries.map((r) => r.balance);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    if (min === max) {
      const p = Math.max(Math.abs(max) * 0.08, 500, 1);
      return [Math.floor(min - p), Math.ceil(max + p)];
    }
    const pad = Math.max((max - min) * 0.08, max * 0.02, 1);
    return [Math.floor(min - pad), Math.ceil(max + pad)];
  }, [trajectorySeries]);

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in duration-700">
      <header className="flex justify-between items-end flex-wrap gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-light text-on-surface tracking-tight font-headline">{t('recon.title')}</h1>
          <p className="text-on-surface-variant font-light">{t('recon.subtitle')}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-widest text-on-surface-variant/50 mb-1">{t('recon.selectedPeriod')}</p>
          <p className="text-lg font-medium text-on-surface">{currentPeriodLabel}</p>
        </div>
      </header>

      {latestMom && (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-6 py-4 text-sm text-on-surface">
          <p className="font-headline font-medium text-primary mb-1">
            {latestMom.fromLabel} → {latestMom.toLabel}
          </p>
          <p className="text-on-surface-variant">
            <span className={cn('font-semibold', latestMom.delta >= 0 ? 'text-emerald-600' : 'text-accent-rose')}>
              {latestMom.delta >= 0 ? '+' : '−'}฿{Math.abs(latestMom.delta).toLocaleString()}
            </span>
            <span className="mx-2">·</span>
            {t('recon.deltaHint')}
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-accent-rose/30 bg-accent-rose/5 px-4 py-3 text-sm text-accent-rose">{error}</div>
      )}

      <div className="grid grid-cols-12 gap-6">
        <form
          onSubmit={handleRecord}
          className="col-span-12 lg:col-span-8 bg-white p-10 rounded-[2rem] ambient-shadow flex flex-col justify-between relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-accent-rose/5 rounded-full -mr-20 -mt-20 opacity-40 blur-3xl group-hover:bg-accent-rose/10 transition-colors duration-700"></div>
          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="text-xs font-light text-on-surface-variant uppercase tracking-widest mb-2 block">
                {t('recon.year')}
              </label>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full rounded-xl border border-on-surface-variant/15 px-4 py-2 bg-surface"
                min={2000}
                max={2100}
              />
            </div>
            <div>
              <label className="text-xs font-light text-on-surface-variant uppercase tracking-widest mb-2 block">
                {t('recon.month')}
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full rounded-xl border border-on-surface-variant/15 px-4 py-2 bg-surface"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {format(new Date(2000, i, 1), 'MMMM', { locale: dateLocale })}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="relative z-10">
            <label className="text-sm font-light text-on-surface-variant uppercase tracking-widest mb-4 block">
              {t('recon.balanceLabel')}
            </label>
            <div className="flex items-center gap-4">
              <span className="text-5xl font-extralight text-on-surface-variant/30">฿</span>
              <input
                type="text"
                inputMode="decimal"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="0.00"
                className="w-full text-6xl font-thin bg-transparent border-none focus:ring-0 placeholder:text-surface-container text-on-surface"
              />
            </div>
          </div>
          <div className="mt-12 flex flex-col md:flex-row gap-6 items-center relative z-10">
            <button
              type="submit"
              disabled={saving}
              className="w-full md:w-auto px-10 py-4 bg-on-surface text-white rounded-full font-light tracking-wide hover:bg-accent-rose transition-all duration-500 disabled:opacity-50"
            >
              {saving ? t('common.saving') : t('recon.record')}
            </button>
            <div className="flex items-center gap-2 px-4 py-2 bg-surface-container rounded-full border border-on-surface-variant/10">
              <CalendarCheck size={18} className="text-accent-rose" />
              <span className="text-xs text-on-surface-variant font-light">
                {t('recon.lastReconciled')}:{' '}
                {last ? format(new Date(last.date + 'T12:00:00'), 'MMM d, yyyy', { locale: dateLocale }) : '—'}
              </span>
            </div>
          </div>
        </form>

        <div className="col-span-12 lg:col-span-4 bg-accent-rose/5 p-8 rounded-[2rem] border border-accent-rose/10 flex flex-col justify-between">
          <div>
            <div className="h-12 w-12 bg-white rounded-full flex items-center justify-center text-accent-rose mb-6 shadow-sm">
              <Bell size={20} />
            </div>
            <h3 className="text-lg font-light text-on-surface mb-2 font-headline">{t('recon.reminderTitle')}</h3>
            <p className="text-sm text-on-surface-variant font-light leading-relaxed">{t('recon.reminderBody')}</p>
          </div>
          <div className="mt-8 flex items-center justify-between">
            <span className="text-xs font-medium text-accent-rose uppercase tracking-wider">{t('recon.tip')}</span>
            <span className="text-xs font-light text-on-surface-variant">{t('recon.tipBank')}</span>
          </div>
        </div>

        <div className="col-span-12 p-10 rounded-[2rem] bg-surface-container/30 border border-on-surface-variant/10 relative overflow-hidden">
          <div className="relative z-10 flex flex-col lg:flex-row justify-between items-start gap-6 mb-8">
            <div>
              <h3 className="text-xl font-light text-on-surface mb-1 font-headline">{t('recon.trajectoryTitle')}</h3>
              <p className="font-light text-sm text-on-surface-variant max-w-xl">
                {trajectorySeries.length > 0 ? t('recon.trajectoryWithData') : t('recon.trajectoryEmpty')}
              </p>
            </div>
            {chartStats && trajectorySeries.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full lg:w-auto lg:min-w-[min(100%,28rem)]">
                <div className="rounded-xl bg-white/80 border border-on-surface-variant/10 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/70 mb-1">{t('recon.chartNetChange')}</p>
                  <p
                    className={cn(
                      'text-lg font-headline font-semibold tabular-nums flex items-center gap-1.5',
                      !chartStats.hasTrend ? 'text-on-surface-variant' : chartStats.net >= 0 ? 'text-emerald-700' : 'text-accent-rose',
                    )}
                  >
                    {chartStats.hasTrend ? (
                      chartStats.net >= 0 ? (
                        <TrendingUp size={18} strokeWidth={2} className="shrink-0 opacity-80" />
                      ) : (
                        <TrendingDown size={18} strokeWidth={2} className="shrink-0 opacity-80" />
                      )
                    ) : null}
                    {chartStats.hasTrend ? (
                      <>
                        {chartStats.net >= 0 ? '+' : '−'}฿{Math.abs(Math.round(chartStats.net)).toLocaleString()}
                      </>
                    ) : (
                      <span className="text-sm font-normal">—</span>
                    )}
                  </p>
                </div>
                <div className="rounded-xl bg-white/80 border border-on-surface-variant/10 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/70 mb-1">{t('recon.chartAvgMom')}</p>
                  <p className="text-lg font-headline font-semibold text-on-surface tabular-nums">
                    {chartStats.hasTrend ? `฿${Math.round(chartStats.avgAbs).toLocaleString()}` : '—'}
                  </p>
                </div>
                <div className="rounded-xl bg-white/80 border border-on-surface-variant/10 px-4 py-3 col-span-2 sm:col-span-1">
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant/70 mb-1">{t('recon.chartMonths')}</p>
                  <p className="text-lg font-headline font-semibold text-on-surface tabular-nums">{chartStats.months}</p>
                </div>
              </div>
            )}
          </div>

          {loading ? (
            <div className="h-[340px] rounded-xl bg-on-surface-variant/5 animate-pulse" />
          ) : trajectorySeries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-on-surface-variant/25 bg-white/40 px-8 py-14 text-center">
              <p className="text-lg font-headline text-on-surface mb-2">{t('recon.chartEmptyTitle')}</p>
              <p className="text-sm text-on-surface-variant max-w-lg mx-auto leading-relaxed">{t('recon.chartEmptyBody')}</p>
            </div>
          ) : (
            <div className="space-y-10">
              <div>
                <p className="text-xs font-headline font-medium uppercase tracking-widest text-on-surface-variant/80 mb-4">
                  {t('recon.chartBalanceTitle')}
                </p>
                <div className="h-[min(22rem,55vw)] w-full min-h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trajectorySeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="reconBalanceFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#b76e79" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#b76e79" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d4d6d2" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: '#5c605d' }}
                        axisLine={false}
                        tickLine={false}
                        dy={8}
                      />
                      <YAxis
                        domain={balanceDomain as [number, number]}
                        tick={{ fontSize: 11, fill: '#5c605d' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => formatCompactBaht(Number(v))}
                        width={56}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const row = payload[0].payload as (typeof trajectorySeries)[0];
                          return (
                            <div className="rounded-xl border border-on-surface-variant/15 bg-white px-4 py-3 shadow-lg text-sm">
                              <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-2">{row.label}</p>
                              <p className="font-medium text-on-surface">
                                {t('recon.tooltipBalance')}: ฿{row.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </p>
                              {row.momDelta !== null && (
                                <p className={cn('mt-1', row.momDelta >= 0 ? 'text-emerald-700' : 'text-accent-rose')}>
                                  {t('recon.tooltipMom')}: {row.momDelta >= 0 ? '+' : '−'}฿
                                  {Math.abs(row.momDelta).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </p>
                              )}
                              <p className="text-xs text-on-surface-variant mt-2 pt-2 border-t border-on-surface-variant/10">
                                {t('recon.tooltipSubs')}: ฿{row.projectedSubs.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </p>
                            </div>
                          );
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="balance"
                        name={t('recon.legendReal')}
                        stroke="#9a4d5c"
                        strokeWidth={2.5}
                        fill="url(#reconBalanceFill)"
                        dot={{ r: 4, fill: '#9a4d5c', stroke: '#fff', strokeWidth: 2 }}
                        activeDot={{ r: 6 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-[11px] text-on-surface-variant/80 mt-3 max-w-2xl">
                  {t('recon.chartSubsRef')}
                  {trajectory?.defaultProjected != null && (
                    <span className="font-medium text-on-surface-variant"> ฿{trajectory.defaultProjected.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</span>
                  )}
                </p>
              </div>

              {deltaBars.length > 0 && (
                <div>
                  <p className="text-xs font-headline font-medium uppercase tracking-widest text-on-surface-variant/80 mb-4">
                    {t('recon.chartDeltaTitle')}
                  </p>
                  <div className="h-48 w-full min-h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={deltaBars} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#d4d6d2" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#5c605d' }} axisLine={false} tickLine={false} dy={8} />
                        <YAxis
                          tick={{ fontSize: 11, fill: '#5c605d' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => formatCompactBaht(Number(v))}
                          width={56}
                        />
                        <Tooltip
                          formatter={(value: number) => [
                            `${value >= 0 ? '+' : '−'}฿${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                            t('recon.tooltipMom'),
                          ]}
                          labelStyle={{ fontSize: 11 }}
                          contentStyle={{ borderRadius: 12, border: '1px solid #eceeea' }}
                        />
                        <Bar dataKey="momDelta" radius={[6, 6, 0, 0]} maxBarSize={48}>
                          {deltaBars.map((entry, index) => (
                            <Cell key={`mom-${entry.label}-${index}`} fill={entry.momDelta >= 0 ? '#059669' : '#c95454'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="col-span-12 space-y-6">
          <h3 className="text-xl font-light text-on-surface flex items-center gap-3 px-2 font-headline">
            {t('recon.historyTitle')}
            <span className="h-[1px] flex-1 bg-on-surface-variant/10"></span>
          </h3>
          <div className="bg-white border border-on-surface-variant/10 rounded-[2rem] ambient-shadow overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-surface-container/30 border-b border-on-surface-variant/10">
                  <th className="px-6 py-4 text-xs font-medium text-on-surface-variant/50 uppercase tracking-widest">{t('recon.colMonth')}</th>
                  <th className="px-6 py-4 text-xs font-medium text-on-surface-variant/50 uppercase tracking-widest text-right">
                    {t('recon.colProjected')}
                  </th>
                  <th className="px-6 py-4 text-xs font-medium text-on-surface-variant/50 uppercase tracking-widest text-right">
                    {t('recon.colReal')}
                  </th>
                  <th className="px-6 py-4 text-xs font-medium text-on-surface-variant/50 uppercase tracking-widest text-right">
                    {t('recon.colVariance')}
                  </th>
                  <th className="px-6 py-4 text-xs font-medium text-on-surface-variant/50 uppercase tracking-widest text-right">
                    {t('recon.colDelta')}
                  </th>
                  <th className="px-6 py-4 text-xs font-medium text-on-surface-variant/50 uppercase tracking-widest text-center">
                    {t('recon.colStatus')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-on-surface-variant/5">
                {records.map((record) => {
                  const delta = deltaByRecordId.get(record.id);
                  return (
                    <tr key={record.id} className="hover:bg-surface-container/20 transition-colors">
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="text-on-surface font-medium">{record.month}</span>
                          <span className="text-[10px] text-on-surface-variant/50">
                            {t('recon.recordedOn')} {record.date}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right text-on-surface-variant font-light">
                        ฿ {record.projected.toLocaleString()}
                      </td>
                      <td className="px-6 py-5 text-right text-on-surface font-medium">฿ {record.realBalance.toLocaleString()}</td>
                      <td className="px-6 py-5 text-right">
                        <span
                          className={cn(
                            'font-medium',
                            record.realBalance >= record.projected ? 'text-emerald-500' : 'text-accent-rose',
                          )}
                        >
                          {record.realBalance >= record.projected ? '+' : '-'} ฿{' '}
                          {Math.abs(record.realBalance - record.projected).toLocaleString()}
                        </span>
                      </td>
                      <td className="px-6 py-5 text-right">
                        {delta === undefined ? (
                          <span className="text-on-surface-variant/50">{t('recon.deltaNone')}</span>
                        ) : (
                          <span
                            className={cn('font-medium', delta >= 0 ? 'text-emerald-600' : 'text-accent-rose')}
                          >
                            {delta >= 0 ? '+' : '−'}฿{Math.abs(delta).toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-5 text-center">
                        <span
                          className={cn(
                            'px-3 py-1 rounded-full text-[10px] font-medium uppercase',
                            record.status === 'Balanced' || record.status === 'Perfect Match'
                              ? 'bg-emerald-50 text-emerald-600'
                              : 'bg-surface-container text-on-surface-variant',
                          )}
                        >
                          {translateStatus(record.status, t)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {records.length === 0 && !loading && (
              <p className="text-center text-on-surface-variant py-12 text-sm">{t('recon.emptyTable')}</p>
            )}
            <div className="p-6 bg-surface-container/20 text-center border-t border-on-surface-variant/5">
              <span className="text-on-surface-variant/50 text-sm font-light">{t('recon.historyFoot')}</span>
            </div>
          </div>
        </div>
      </div>

      <footer className="text-center py-12 border-t border-on-surface-variant/10 mt-12">
        <p className="text-on-surface-variant/50 font-light italic">{t('recon.footerQuote')}</p>
      </footer>
    </div>
  );
}
