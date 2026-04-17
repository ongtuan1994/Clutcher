import React from 'react';
import { Mail, MessageCircle } from 'lucide-react';
import { useLocale } from '../contexts/LocaleContext';

export default function Support() {
  const { t } = useLocale();

  return (
    <div className="max-w-2xl mx-auto space-y-10 animate-in fade-in duration-700">
      <div>
        <h2 className="text-3xl font-headline font-bold text-on-surface">{t('support.title')}</h2>
        <p className="text-on-surface-variant mt-2">{t('support.intro')}</p>
      </div>

      <div className="space-y-6">
        <article className="bg-white rounded-2xl ambient-shadow p-8 border border-on-surface-variant/5">
          <h3 className="font-headline font-semibold text-on-surface mb-2">{t('support.q1')}</h3>
          <p className="text-on-surface-variant text-sm leading-relaxed">{t('support.a1')}</p>
        </article>
        <article className="bg-white rounded-2xl ambient-shadow p-8 border border-on-surface-variant/5">
          <h3 className="font-headline font-semibold text-on-surface mb-2">{t('support.q2')}</h3>
          <p className="text-on-surface-variant text-sm leading-relaxed">{t('support.a2')}</p>
        </article>
        <article className="bg-white rounded-2xl ambient-shadow p-8 border border-on-surface-variant/5">
          <h3 className="font-headline font-semibold text-on-surface mb-2">{t('support.q3')}</h3>
          <p className="text-on-surface-variant text-sm leading-relaxed">{t('support.a3')}</p>
        </article>
      </div>

      <div className="flex flex-wrap gap-4">
        <a
          href="mailto:support@example.com"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-surface-container text-on-surface font-medium text-sm hover:bg-primary/10 transition-colors"
        >
          <Mail size={18} />
          {t('support.emailBtn')}
        </a>
        <span className="inline-flex items-center gap-2 px-6 py-3 rounded-full border border-on-surface-variant/15 text-on-surface-variant text-sm">
          <MessageCircle size={18} />
          {t('support.placeholder')}
        </span>
      </div>
    </div>
  );
}
