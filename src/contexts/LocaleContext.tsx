import React from 'react';
import { interpolate, translations, type Locale } from '../i18n/translations';

const STORAGE_KEY = 'sg_locale';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

const LocaleContext = React.createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: TFn;
} | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = React.useState<Locale>(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY);
      return s === 'th' || s === 'en' ? s : 'en';
    } catch {
      return 'en';
    }
  });

  const setLocale = React.useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
  }, []);

  const t = React.useCallback<TFn>(
    (key, vars) => {
      const raw = translations[locale][key] ?? translations.en[key] ?? key;
      return vars ? interpolate(raw, vars) : raw;
    },
    [locale],
  );

  const value = React.useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const ctx = React.useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}
