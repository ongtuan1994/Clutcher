import React from 'react';
import { LogOut, Upload } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../contexts/LocaleContext';
import { profileApi } from '../api';
import { userInitials } from '../lib/avatar';

export default function Settings() {
  const { user, refreshUser, logout } = useAuth();
  const { t } = useLocale();
  const [displayName, setDisplayName] = React.useState(user?.displayName || '');
  const [monthlyIncome, setMonthlyIncome] = React.useState(String(user?.monthlyIncome ?? ''));
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setMonthlyIncome(String(user.monthlyIncome));
    }
  }, [user]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const inc = Number(monthlyIncome);
      if (Number.isNaN(inc) || inc < 0) {
        setError(t('settings.incomeError'));
        return;
      }
      await profileApi.patch({
        displayName: displayName.trim() || null,
        monthlyIncome: inc,
      });
      await refreshUser();
      setMessage(t('settings.profileSaved'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setMessage(null);
    try {
      await profileApi.uploadAvatar(file);
      await refreshUser();
      setMessage(t('settings.photoUpdated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    }
    e.target.value = '';
  }

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-10 animate-in fade-in duration-700">
      <div>
        <h2 className="text-3xl font-headline font-bold text-on-surface">{t('settings.title')}</h2>
        <p className="text-on-surface-variant mt-2">{t('settings.subtitle')}</p>
      </div>

      {error && (
        <div className="rounded-xl border border-accent-rose/30 bg-accent-rose/5 px-4 py-3 text-sm text-accent-rose">{error}</div>
      )}
      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div>
      )}

      <div className="bg-white rounded-2xl ambient-shadow p-8 border border-on-surface-variant/5">
        <h3 className="text-sm font-headline font-semibold uppercase tracking-widest text-on-surface-variant mb-6">
          {t('settings.photoTitle')}
        </h3>
        <div className="flex flex-col sm:flex-row items-center gap-8">
          <div className="relative w-28 h-28 rounded-full overflow-hidden bg-surface-container flex items-center justify-center text-2xl font-headline text-primary border-2 border-on-surface-variant/10">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span>{userInitials(user)}</span>
            )}
          </div>
          <div>
            <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-on-surface-variant/20 text-sm font-medium cursor-pointer hover:bg-surface-container transition-colors">
              <Upload size={16} />
              {t('settings.upload')}
              <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={onAvatar} />
            </label>
            <p className="text-xs text-on-surface-variant mt-3 max-w-xs">{t('settings.photoHint')}</p>
          </div>
        </div>
      </div>

      <form onSubmit={saveProfile} className="bg-white rounded-2xl ambient-shadow p-8 border border-on-surface-variant/5 space-y-6">
        <h3 className="text-sm font-headline font-semibold uppercase tracking-widest text-on-surface-variant">{t('settings.details')}</h3>
        <div>
          <label className="block text-xs uppercase tracking-widest text-on-surface-variant font-bold mb-2">{t('settings.email')}</label>
          <input
            type="email"
            value={user.email}
            disabled
            className="w-full rounded-xl border border-on-surface-variant/10 bg-surface px-4 py-3 text-on-surface-variant cursor-not-allowed"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-on-surface-variant font-bold mb-2">{t('settings.displayName')}</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-xl border border-on-surface-variant/15 px-4 py-3 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/25"
            placeholder="Your name"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-on-surface-variant font-bold mb-2">{t('settings.income')}</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={monthlyIncome}
            onChange={(e) => setMonthlyIncome(e.target.value)}
            className="w-full rounded-xl border border-on-surface-variant/15 px-4 py-3 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/25"
            required
          />
          <p className="text-xs text-on-surface-variant mt-2">{t('settings.incomeHint')}</p>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="signature-gradient text-white font-headline font-bold uppercase tracking-widest text-sm px-10 py-3 rounded-full disabled:opacity-50"
        >
          {saving ? t('common.saving') : t('settings.save')}
        </button>
      </form>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => logout()}
          className="inline-flex items-center gap-2 text-sm text-on-surface-variant hover:text-accent-rose transition-colors"
        >
          <LogOut size={18} />
          {t('settings.signOut')}
        </button>
      </div>
    </div>
  );
}
