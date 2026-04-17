import React from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Dashboard from './components/Dashboard';
import SubscriptionList from './components/SubscriptionList';
import AddSubscriptionForm from './components/AddSubscriptionForm';
import Reconciliation from './components/Reconciliation';
import Analytics from './components/Analytics';
import ShortTermPlan from './components/ShortTermPlan';
import LongTermPlan from './components/LongTermPlan';
import Settings from './components/Settings';
import Support from './components/Support';
import AdminSkies from './components/AdminSkies';
import AuthScreen from './components/AuthScreen';
import type { View } from './types';
import type { ApiSubscription } from './api';
import { motion, AnimatePresence } from 'motion/react';
import { Plus } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { useLocale } from './contexts/LocaleContext';

export default function App() {
  const { t } = useLocale();
  const { user, loading } = useAuth();
  const [currentView, setCurrentView] = React.useState<View>('Dashboard');

  React.useEffect(() => {
    if (user && !user.isAdmin && currentView === 'AdminSkies') {
      setCurrentView('Dashboard');
    }
  }, [user, currentView]);
  const [isAdding, setIsAdding] = React.useState(false);
  const [subscriptionToEdit, setSubscriptionToEdit] = React.useState<ApiSubscription | null>(null);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [dataTick, setDataTick] = React.useState(0);

  const bumpData = React.useCallback(() => setDataTick((t) => t + 1), []);

  const handleViewChange = (view: View) => {
    setCurrentView(view);
    setIsAdding(false);
    setSubscriptionToEdit(null);
    if (view !== 'Subscriptions') setSearchQuery('');
  };

  const renderView = () => {
    if (isAdding) {
      return (
        <AddSubscriptionForm
          initialSubscription={subscriptionToEdit}
          onCancel={() => {
            setIsAdding(false);
            setSubscriptionToEdit(null);
          }}
          onSave={() => {
            setIsAdding(false);
            setSubscriptionToEdit(null);
            setCurrentView('Subscriptions');
            bumpData();
          }}
        />
      );
    }

    switch (currentView) {
      case 'Dashboard':
        return <Dashboard refreshTrigger={dataTick} />;
      case 'Subscriptions':
        return (
          <SubscriptionList
            searchQuery={searchQuery}
            refreshTrigger={dataTick}
            onEditSubscription={(sub) => {
              setSubscriptionToEdit(sub);
              setIsAdding(true);
            }}
            onDataChange={bumpData}
          />
        );
      case 'Reconciliation':
        return <Reconciliation />;
      case 'Settings':
        return <Settings />;
      case 'Support':
        return <Support />;
      case 'Analytics':
        return <Analytics />;
      case 'ShortTermPlan':
        return <ShortTermPlan />;
      case 'LongTermPlan':
        return <LongTermPlan />;
      case 'AdminSkies':
        return <AdminSkies />;
      default:
        return <Dashboard refreshTrigger={dataTick} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-on-surface-variant text-sm font-headline tracking-widest uppercase">{t('common.loading')}</div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar
        currentView={currentView}
        onViewChange={handleViewChange}
        onAddClick={() => {
          setSubscriptionToEdit(null);
          setIsAdding(true);
        }}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          currentView={currentView}
          onViewChange={handleViewChange}
          showSearch={currentView === 'Subscriptions' && !isAdding}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />

        <main className="flex-1 p-8 md:p-16 lg:p-24 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={isAdding ? 'adding' : currentView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="h-full"
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {!isAdding && (
        <div className="fixed bottom-12 right-12 md:hidden z-20">
          <button
            type="button"
            onClick={() => {
              setSubscriptionToEdit(null);
              setIsAdding(true);
            }}
            className="w-16 h-16 rounded-full signature-gradient shadow-lg flex items-center justify-center text-white hover:scale-105 transition-transform"
            aria-label="Add subscription"
          >
            <Plus size={24} />
          </button>
        </div>
      )}
    </div>
  );
}
