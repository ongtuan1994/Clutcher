import React from 'react';
import { Info, CreditCard, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { subscriptionsApi } from '../api';
import type { ApiSubscription } from '../api';
import { useLocale } from '../contexts/LocaleContext';

interface AddSubscriptionFormProps {
  initialSubscription?: ApiSubscription | null;
  onCancel: () => void;
  onSave: () => void;
}

const CATEGORIES = [
  'Entertainment',
  'Utilities',
  'Software',
  'Productivity',
  'Lifestyle',
  'Insurance',
  'Hosting',
  'Design Tools',
  'Audio',
  'Work',
];

export default function AddSubscriptionForm({ initialSubscription, onCancel, onSave }: AddSubscriptionFormProps) {
  const { t } = useLocale();
  const isEdit = Boolean(initialSubscription);

  const [billingCycle, setBillingCycle] = React.useState<'Weekly' | 'Monthly' | 'Yearly'>('Monthly');
  const [name, setName] = React.useState('');
  const [category, setCategory] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [billingStart, setBillingStart] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!initialSubscription) return;
    setName(initialSubscription.name);
    setCategory(initialSubscription.category);
    setAmount(String(initialSubscription.amount));
    setBillingCycle(initialSubscription.billingCycle);
    setBillingStart(initialSubscription.billingStart);
  }, [initialSubscription]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amt = Number(amount);
    if (!name.trim() || !category || Number.isNaN(amt) || amt < 0) {
      setError(t('form.validation'));
      return;
    }
    setSubmitting(true);
    try {
      if (initialSubscription) {
        await subscriptionsApi.patch(initialSubscription.id, {
          name: name.trim(),
          category,
          amount: amt,
          billingCycle,
          billingStart,
        });
      } else {
        await subscriptionsApi.create({
          name: name.trim(),
          category,
          amount: amt,
          billingCycle,
          billingStart,
          icon: 'palette',
        });
      }
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSubmitting(false);
    }
  }

  const cycleLabel = (c: 'Weekly' | 'Monthly' | 'Yearly') =>
    c === 'Weekly' ? t('subs.filter.weekly') : c === 'Monthly' ? t('subs.filter.monthly') : t('subs.filter.yearly');

  return (
    <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-8 duration-700">
      <div className="flex flex-col md:flex-row justify-between items-end mb-20 gap-8">
        <div className="w-full md:w-2/3">
          <h1 className="text-4xl md:text-5xl font-headline font-extrabold tracking-[0.02em] text-on-surface mb-4">
            {isEdit ? t('form.editTitle') : t('form.addTitle')}
          </h1>
          <p className="text-on-surface-variant text-lg max-w-md leading-relaxed">
            {isEdit ? t('form.editSubtitle') : t('form.addSubtitle')}
          </p>
        </div>
        <div className="text-right hidden md:block">
          <span className="text-xs uppercase tracking-[0.2em] text-on-surface-variant/50 font-bold">
            {isEdit ? t('form.badgeEdit') : t('form.badgeNew')}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
        <div className="lg:col-span-4 hidden lg:block">
          <div className="aspect-[3/4] bg-surface-container rounded-xl relative overflow-hidden flex items-center justify-center p-8">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuD1Thx-61J63pRUkGSKQf1lSJF-wr8lwyWZ0Wxx4qohhO31cZbTT_vJDlEuJQf0FaU3_ovyLD4tt9yJ8EFohFug6fiJ-BAqV64Nzut_jXkxCHFz6KlDUef3TZ2XccVWT5YeRFEaenRVfL9_hg2kAFqT4XARKicIsZCtScEKOTUcZy7H-1XnoCQ3LzYNe6PJMBE9A_iXoqa_zVj2hGOUrM49kc2x5cn0RAl4oEHmb5k_EcEQAk6TPUnlvDIyTIQXlaLz70cCZvHMK4"
              alt=""
              className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-multiply"
              referrerPolicy="no-referrer"
            />
            <div className="relative z-10 text-center">
              <CreditCard size={40} className="text-primary mx-auto mb-4" />
              <p className="text-xs tracking-widest uppercase text-primary font-bold">Flow Awareness</p>
            </div>
          </div>
        </div>

        <form className="lg:col-span-8 flex flex-col gap-12" onSubmit={handleSubmit}>
          {error && (
            <p className="text-sm text-accent-rose bg-accent-rose/5 border border-accent-rose/20 rounded-xl px-4 py-3">{error}</p>
          )}
          <div className="group">
            <label className="block text-xs uppercase tracking-[0.15em] text-on-surface-variant font-bold mb-2 group-focus-within:text-primary transition-colors">
              {t('form.name')}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('form.namePh')}
              className="w-full bg-transparent border-none border-b border-on-surface-variant/30 py-4 text-xl md:text-2xl font-headline tracking-wide transition-all focus:border-primary focus:ring-0 placeholder:text-surface-container"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="group relative">
              <label className="block text-xs uppercase tracking-[0.15em] text-on-surface-variant font-bold mb-2 group-focus-within:text-primary transition-colors">
                {t('form.category')}
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-transparent border-none border-b border-on-surface-variant/30 py-4 text-lg appearance-none cursor-pointer focus:border-primary focus:ring-0"
                  required
                >
                  <option value="">{t('form.categoryPh')}</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none" size={18} />
              </div>
            </div>
            <div className="group">
              <label className="block text-xs uppercase tracking-[0.15em] text-on-surface-variant font-bold mb-2 group-focus-within:text-primary transition-colors">
                {t('form.amount')}
              </label>
              <div className="flex items-center border-b border-on-surface-variant/30 group-focus-within:border-primary transition-colors">
                <span className="text-xl md:text-2xl font-headline mr-2 text-on-surface-variant">฿</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-transparent border-none py-4 text-xl md:text-2xl font-headline tracking-wide focus:ring-0 placeholder:text-surface-container"
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="group">
              <label className="block text-xs uppercase tracking-[0.15em] text-on-surface-variant font-bold mb-2 group-focus-within:text-primary transition-colors">
                {t('form.billingCycle')}
              </label>
              <div className="flex gap-2 mt-4 flex-wrap">
                {(['Weekly', 'Monthly', 'Yearly'] as const).map((cycle) => (
                  <button
                    key={cycle}
                    type="button"
                    onClick={() => setBillingCycle(cycle)}
                    className={cn(
                      'px-4 py-2 rounded-full text-xs uppercase tracking-widest transition-all',
                      billingCycle === cycle
                        ? 'bg-secondary text-white font-bold'
                        : 'border border-on-surface-variant/30 text-on-surface-variant hover:border-primary hover:text-primary',
                    )}
                  >
                    {cycleLabel(cycle)}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-[10px] uppercase tracking-[0.1em] text-on-surface-variant italic">{t('form.billingHint')}</p>
            </div>
            <div className="group">
              <label className="block text-xs uppercase tracking-[0.15em] text-on-surface-variant font-bold mb-2 group-focus-within:text-primary transition-colors">
                {t('form.billingStart')}
              </label>
              <input
                type="date"
                value={billingStart}
                onChange={(e) => setBillingStart(e.target.value)}
                className="w-full bg-transparent border-none border-b border-on-surface-variant/30 py-4 text-lg cursor-pointer focus:border-primary focus:ring-0"
                required
              />
            </div>
          </div>

          <div className="pt-8 flex flex-col md:flex-row items-center gap-8">
            <button
              type="submit"
              disabled={submitting}
              className="signature-gradient w-full md:w-auto px-12 py-4 rounded-full text-white font-headline font-bold uppercase tracking-widest text-sm shadow-lg hover:scale-[1.02] transition-transform duration-200 disabled:opacity-50"
            >
              {submitting ? '…' : isEdit ? t('form.saveChanges') : t('form.save')}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="text-on-surface-variant hover:text-primary text-xs uppercase tracking-[0.2em] font-bold transition-colors"
            >
              {t('form.cancel')}
            </button>
          </div>
        </form>
      </div>

      <div className="mt-32 p-12 bg-surface-container rounded-xl flex flex-col md:flex-row items-center justify-between gap-8 opacity-60">
        <div className="flex items-center gap-4">
          <Info size={20} className="text-on-surface-variant" />
          <p className="text-sm italic">{isEdit ? t('form.editFooterNote') : t('form.footerNote')}</p>
        </div>
        <div className="flex gap-4">
          <div className="w-2 h-2 rounded-full bg-primary/30"></div>
          <div className="w-2 h-2 rounded-full bg-primary/10"></div>
          <div className="w-2 h-2 rounded-full bg-primary/5"></div>
        </div>
      </div>
    </div>
  );
}
