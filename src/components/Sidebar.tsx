import React from 'react';
import {
  LayoutDashboard,
  ReceiptText,
  BarChart3,
  Scale,
  Settings,
  HelpCircle,
  Plus,
  MapPinned,
  Landmark,
  Cloud,
} from 'lucide-react';
import { cn } from '../lib/utils';
import type { View } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useLocale } from '../contexts/LocaleContext';
import { userInitials } from '../lib/avatar';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  onAddClick: () => void;
}

export default function Sidebar({ currentView, onViewChange, onAddClick }: SidebarProps) {
  const { user } = useAuth();
  const { t } = useLocale();

  const navItems = [
    { id: 'Dashboard' as const, icon: LayoutDashboard, labelKey: 'nav.dashboard' },
    { id: 'Subscriptions' as const, icon: ReceiptText, labelKey: 'nav.subscriptions' },
    { id: 'Analytics' as const, icon: BarChart3, labelKey: 'nav.analytics' },
    { id: 'Reconciliation' as const, icon: Scale, labelKey: 'nav.reconciliation' },
    { id: 'ShortTermPlan' as const, icon: MapPinned, labelKey: 'nav.shortPlan' },
    { id: 'LongTermPlan' as const, icon: Landmark, labelKey: 'nav.longPlan' },
    ...(user?.isAdmin ? [{ id: 'AdminSkies' as const, icon: Cloud, labelKey: 'nav.adminSky' as const }] : []),
  ];

  const footerItems = [
    { id: 'Settings' as const, icon: Settings, labelKey: 'nav.settings' },
    { id: 'Support' as const, icon: HelpCircle, labelKey: 'nav.support' },
  ];

  const display = user?.displayName?.trim() || user?.email?.split('@')[0] || 'Curator';

  return (
    <aside className="hidden md:flex flex-col h-screen w-64 bg-[#f3f4f0] py-8 px-6 sticky top-0">
      <div className="mb-12 px-4">
        <h1 className="text-xl font-bold text-primary tracking-widest uppercase font-headline">{t('brand.clutcher')}</h1>
        <p className="text-[10px] uppercase tracking-[0.2em] text-on-surface-variant mt-1">{t('brand.wealthCurator')}</p>
      </div>

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onViewChange(item.id)}
            className={cn(
              'w-full flex items-center gap-3 py-3 px-4 rounded-xl transition-all duration-300 font-headline tracking-[0.02em] font-medium text-sm',
              currentView === item.id
                ? 'text-primary font-bold border-r-2 border-primary bg-[#eceeea]'
                : 'text-on-surface-variant hover:text-primary hover:bg-[#eceeea]',
            )}
          >
            <item.icon size={20} />
            <span>{t(item.labelKey)}</span>
          </button>
        ))}
      </nav>

      <div className="mt-auto space-y-6">
        <button
          type="button"
          onClick={onAddClick}
          className="w-full py-3 px-4 signature-gradient text-white rounded-full font-headline font-bold text-sm shadow-lg hover:scale-[1.02] transition-transform duration-200 flex items-center justify-center gap-2"
        >
          <Plus size={18} />
          {t('nav.addSubscription')}
        </button>

        <div className="space-y-1 pt-4 border-t border-on-surface-variant/10">
          {footerItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onViewChange(item.id)}
              className={cn(
                'w-full flex items-center gap-3 py-2 px-4 rounded-xl transition-all duration-300 font-headline tracking-[0.02em] font-medium text-sm',
                currentView === item.id
                  ? 'text-primary font-bold'
                  : 'text-on-surface-variant hover:text-primary',
              )}
            >
              <item.icon size={18} />
              <span>{t(item.labelKey)}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onViewChange('Settings')}
          className="pt-4 flex items-center gap-3 w-full text-left rounded-xl hover:bg-[#eceeea]/80 px-2 py-2 transition-colors"
        >
          <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-container flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              userInitials(user)
            )}
          </div>
          <div className="text-xs min-w-0">
            <p className="font-bold truncate">{display}</p>
            <p className="text-on-surface-variant opacity-70 truncate">
              {user?.isAdmin ? t('role.admin') : t('role.curator')}
            </p>
          </div>
        </button>
      </div>
    </aside>
  );
}
