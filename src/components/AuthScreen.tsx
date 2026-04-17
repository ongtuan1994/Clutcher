import React from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../contexts/LocaleContext';

export default function AuthScreen() {
  const { login, register } = useAuth();
  const { t, locale, setLocale } = useLocale();
  const [mode, setMode] = React.useState<'login' | 'register'>('login');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLocalError(null);
  }, [mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        if (password.length < 8) {
          setLocalError(t('auth.passwordShort'));
          setSubmitting(false);
          return;
        }
        await register(email, password, displayName.trim() || undefined);
      }
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  const err = localError;

  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center p-6 font-body">
      <div
        className="fixed top-4 right-4 z-20 flex items-center rounded-full border border-white/35 bg-slate-950/50 p-0.5 text-[11px] font-bold font-headline shadow-[0_8px_24px_rgba(15,23,42,0.35)] backdrop-blur-md"
        role="group"
        aria-label="Language"
      >
        <button
          type="button"
          onClick={() => setLocale('en')}
          className={`px-3 py-1.5 rounded-full transition-colors ${
            locale === 'en' ? 'bg-white text-primary shadow-sm' : 'text-white/85 hover:bg-white/10'
          }`}
        >
          {t('lang.en')}
        </button>
        <button
          type="button"
          onClick={() => setLocale('th')}
          className={`px-3 py-1.5 rounded-full transition-colors ${
            locale === 'th' ? 'bg-white text-primary shadow-sm' : 'text-white/85 hover:bg-white/10'
          }`}
        >
          {t('lang.th')}
        </button>
      </div>

      {/* Sky gradient + horizon */}
      <div
        className="absolute inset-0 bg-[linear-gradient(168deg,#0a1628_0%,#0c4a6e_24%,#0369a1_46%,#38bdf8_68%,#bae6fd_88%,#f0f9ff_100%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-amber-100/35"
        aria-hidden
      />
      {/* Soft clouds */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -top-16 -left-24 h-56 w-[22rem] rounded-full bg-white/30 blur-[48px]" />
        <div className="absolute top-[18%] -right-16 h-48 w-[20rem] rounded-full bg-white/22 blur-[40px]" />
        <div className="absolute bottom-[8%] left-[5%] h-40 w-[18rem] rounded-full bg-white/35 blur-[36px]" />
        <div className="absolute bottom-[20%] right-[8%] h-36 w-80 rounded-full bg-sky-100/50 blur-[32px]" />
      </div>
      {/* Sun */}
      <div
        className="pointer-events-none absolute top-10 right-[8%] h-28 w-28 rounded-full bg-amber-100/90 blur-sm shadow-[0_0_60px_24px_rgba(253,230,138,0.45)]"
        aria-hidden
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="text-center mb-10 text-white [text-shadow:0_1px_18px_rgba(15,23,42,0.35)]">
          <p className="text-xs uppercase tracking-[0.25em] text-white/85 mb-1">{t('brand.clutcher')}</p>
          <p className="text-sm font-medium text-sky-100/95 mb-5">{t('brand.wealthCurator')}</p>
          <h1 className="text-3xl font-headline font-extrabold tracking-tight">
            {mode === 'login' ? t('auth.welcomeBack') : t('auth.createAccount')}
          </h1>
          <p className="text-white/80 text-sm mt-2 max-w-sm mx-auto leading-relaxed">
            {mode === 'login' ? t('auth.subLogin') : t('auth.subRegister')}
          </p>
        </div>

        <div className="rounded-2xl border border-white/40 bg-white/88 backdrop-blur-xl p-8 md:p-10 shadow-[0_24px_48px_-12px_rgba(15,40,70,0.25)]">
          <div className="flex rounded-full bg-surface-container p-1 mb-8">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 py-2.5 rounded-full text-xs font-headline font-semibold uppercase tracking-widest transition-colors ${
                mode === 'login' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant'
              }`}
            >
              {t('auth.signInTab')}
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 py-2.5 rounded-full text-xs font-headline font-semibold uppercase tracking-widest transition-colors ${
                mode === 'register' ? 'bg-white text-primary shadow-sm' : 'text-on-surface-variant'
              }`}
            >
              {t('auth.registerTab')}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {mode === 'register' && (
              <div>
                <label className="block text-xs uppercase tracking-widest text-on-surface-variant font-bold mb-2">
                  {t('auth.displayName')}
                </label>
                <input
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-xl border border-on-surface-variant/15 bg-surface px-4 py-3 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={t('auth.optional')}
                />
              </div>
            )}
            <div>
              <label className="block text-xs uppercase tracking-widest text-on-surface-variant font-bold mb-2">
                {mode === 'login' ? t('auth.identifier') : t('auth.email')}
              </label>
              <input
                type={mode === 'login' ? 'text' : 'email'}
                required
                autoComplete={mode === 'login' ? 'username' : 'email'}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-on-surface-variant/15 bg-surface px-4 py-3 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder={mode === 'login' ? t('auth.identifierPh') : 'you@example.com'}
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-on-surface-variant font-bold mb-2">
                {t('auth.password')}
              </label>
              <input
                type="password"
                required
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-on-surface-variant/15 bg-surface px-4 py-3 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="••••••••"
                minLength={mode === 'register' ? 8 : undefined}
              />
            </div>

            {err && (
              <p className="text-sm text-accent-rose bg-accent-rose/5 border border-accent-rose/20 rounded-xl px-4 py-3">
                {err}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full signature-gradient text-white font-headline font-bold uppercase tracking-widest text-sm py-4 rounded-full shadow-lg hover:opacity-95 transition-opacity disabled:opacity-50"
            >
              {submitting ? t('common.wait') : mode === 'login' ? t('auth.submitLogin') : t('auth.submitRegister')}
            </button>
          </form>
        </div>

        <div className="mt-8 rounded-xl border border-white/20 bg-slate-950/70 px-4 py-3.5 shadow-[0_8px_32px_rgba(15,23,42,0.35)] backdrop-blur-md">
          <p className="text-center text-xs leading-relaxed text-slate-100 sm:text-sm">
            {t('auth.footerNote')}
          </p>
          {mode === 'login' && (
            <p className="text-center text-xs leading-relaxed text-slate-200 sm:text-sm mt-2.5 pt-2.5 border-t border-white/10">
              {t('auth.demoAdmin')}
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}
