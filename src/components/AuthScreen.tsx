import React from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../contexts/LocaleContext';

export default function AuthScreen() {
  const { login, register } = useAuth();
  const { t } = useLocale();
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
    <div className="min-h-screen bg-surface flex items-center justify-center p-6 font-body">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.25em] text-on-surface-variant mb-2">{t('brand.clutcher')}</p>
          <h1 className="text-3xl font-headline font-extrabold text-on-surface tracking-tight">
            {mode === 'login' ? t('auth.welcomeBack') : t('auth.createAccount')}
          </h1>
          <p className="text-on-surface-variant text-sm mt-2">
            {mode === 'login' ? t('auth.subLogin') : t('auth.subRegister')}
          </p>
        </div>

        <div className="bg-white ambient-shadow rounded-2xl p-8 md:p-10 border border-on-surface-variant/5">
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

        <p className="text-center text-xs text-on-surface-variant/60 mt-8">{t('auth.footerNote')}</p>
        {mode === 'login' && (
          <p className="text-center text-xs text-on-surface-variant/75 mt-3 max-w-md mx-auto">{t('auth.demoAdmin')}</p>
        )}
      </motion.div>
    </div>
  );
}
