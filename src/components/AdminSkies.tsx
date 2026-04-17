import React from 'react';
import { adminApi, skyAssetsApi } from '../api';
import { useLocale } from '../contexts/LocaleContext';

export default function AdminSkies() {
  const { t } = useLocale();
  const [assets, setAssets] = React.useState<Record<string, string | null>>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyScore, setBusyScore] = React.useState<number | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { assets: a } = await skyAssetsApi.list();
      setAssets(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function onFile(score: number, file: File | null) {
    if (!file) return;
    setBusyScore(score);
    setError(null);
    try {
      await adminApi.uploadSkyAsset(score, file);
      window.dispatchEvent(new CustomEvent('sg-sky-assets-changed'));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusyScore(null);
    }
  }

  const scores = React.useMemo(() => Array.from({ length: 11 }, (_, i) => i), []);

  return (
    <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-700 w-full min-w-0">
      <header>
        <h2 className="text-3xl md:text-4xl font-headline font-semibold text-on-surface tracking-tight">{t('admin.sky.title')}</h2>
        <p className="text-on-surface-variant mt-3 leading-relaxed max-w-2xl">{t('admin.sky.subtitle')}</p>
      </header>

      {error && (
        <div className="rounded-xl border border-accent-rose/30 bg-accent-rose/5 px-4 py-3 text-sm text-accent-rose">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-on-surface-variant">{t('common.loading')}</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {scores.map((score) => {
            const url = assets[String(score)];
            return (
              <li
                key={score}
                className="rounded-2xl border border-on-surface-variant/10 bg-white ambient-shadow overflow-hidden flex flex-col"
              >
                <div className="aspect-[16/10] bg-surface-container relative">
                  {url ? (
                    <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-xs text-on-surface-variant px-4 text-center">
                      {t('admin.sky.placeholder')}
                    </div>
                  )}
                  <div className="absolute top-3 left-3 rounded-full bg-surface/90 px-3 py-1 text-xs font-headline font-semibold text-on-surface">
                    {t('admin.sky.scoreLabel', { n: String(score) })}
                  </div>
                </div>
                <div className="p-4 flex flex-col gap-2">
                  <label className="text-xs uppercase tracking-widest text-on-surface-variant font-semibold">
                    {t('admin.sky.upload')}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="mt-2 block w-full text-sm text-on-surface file:mr-3 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-xs file:font-headline file:text-white"
                      disabled={busyScore !== null}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = '';
                        void onFile(score, f ?? null);
                      }}
                    />
                  </label>
                  {busyScore === score && <p className="text-xs text-on-surface-variant">{t('common.saving')}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
