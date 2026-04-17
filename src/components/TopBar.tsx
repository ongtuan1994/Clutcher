import React from 'react';
import { Search, Bell, Sparkles, Globe } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../contexts/LocaleContext';
import { userInitials } from '../lib/avatar';
import type { View } from '../types';

const ALL_VIEWS: { id: View; labelKey: string }[] = [
  { id: 'Dashboard', labelKey: 'nav.dashboard' },
  { id: 'Subscriptions', labelKey: 'nav.subscriptions' },
  { id: 'Analytics', labelKey: 'nav.analytics' },
  { id: 'Reconciliation', labelKey: 'nav.reconciliation' },
  { id: 'ShortTermPlan', labelKey: 'nav.shortPlan' },
  { id: 'LongTermPlan', labelKey: 'nav.longPlan' },
  { id: 'AdminSkies', labelKey: 'nav.adminSky' },
  { id: 'Settings', labelKey: 'nav.settings' },
  { id: 'Support', labelKey: 'nav.support' },
];

interface TopBarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  showSearch: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export default function TopBar({ currentView, onViewChange, showSearch, searchQuery, onSearchChange }: TopBarProps) {
  const { user } = useAuth();
  const { locale, setLocale, t } = useLocale();
  const mobileViews = React.useMemo(
    () => ALL_VIEWS.filter((v) => v.id !== 'AdminSkies' || user?.isAdmin),
    [user?.isAdmin],
  );

  return (
    <header className="sticky top-0 z-10 flex flex-wrap justify-between items-center gap-4 w-full px-6 md:px-12 py-6 bg-surface/60 backdrop-blur-xl font-headline tracking-[0.02em]">
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex items-center gap-2 text-on-surface-variant/70" aria-hidden>
          <Sparkles size={16} strokeWidth={1.5} className="shrink-0" />
          <Globe size={16} strokeWidth={1.5} className="shrink-0" />
        </span>
        <span className="text-lg font-light tracking-[0.1em] text-on-surface uppercase hidden sm:inline">
          {t('brand.clutcher')}
        </span>
        <div className="sm:hidden">
          <label htmlFor="mobile-view" className="sr-only">
            Navigate
          </label>
          <select
            id="mobile-view"
            value={currentView}
            onChange={(e) => onViewChange(e.target.value as View)}
            className="max-w-[11rem] rounded-lg border border-on-surface-variant/15 bg-white px-2 py-1.5 text-xs font-medium text-on-surface"
          >
            {mobileViews.map((v) => (
              <option key={v.id} value={v.id}>
                {t(v.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-6 ml-auto">
        <div
          className="flex items-center rounded-full border border-on-surface-variant/15 bg-white/80 p-0.5 text-[11px] font-bold font-headline shadow-sm"
          role="group"
          aria-label="Language"
        >
          <button
            type="button"
            onClick={() => setLocale('en')}
            className={`px-2.5 py-1 rounded-full transition-colors ${locale === 'en' ? 'bg-primary text-white' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            {t('lang.en')}
          </button>
          <button
            type="button"
            onClick={() => setLocale('th')}
            className={`px-2.5 py-1 rounded-full transition-colors ${locale === 'th' ? 'bg-primary text-white' : 'text-on-surface-variant hover:text-on-surface'}`}
          >
            {t('lang.th')}
          </button>
        </div>

        {showSearch && (
          <div className="flex items-center bg-surface-container px-4 py-1.5 rounded-full border border-on-surface-variant/10 min-w-0">
            <Search size={16} className="text-on-surface-variant/50 mr-2 shrink-0" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('search.placeholder')}
              className="bg-transparent border-none focus:ring-0 text-sm w-36 md:w-48 text-on-surface placeholder:text-on-surface-variant/30 min-w-0"
            />
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            type="button"
            className="text-on-surface-variant hover:opacity-70 transition-opacity"
            aria-label={t('top.notify')}
          >
            <Bell size={20} />
          </button>
          <button
            type="button"
            onClick={() => onViewChange('Settings')}
            className="w-9 h-9 rounded-full overflow-hidden border border-on-surface-variant/20 bg-surface-container flex items-center justify-center text-xs font-bold text-primary"
            aria-label="Open profile settings"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              userInitials(user)
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
