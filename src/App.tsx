import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { isPublicMarketplaceRoute, OfiClickProvider, useOfiClick } from './context/OfiClickContext';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { AuthModal } from './components/AuthModal';
import { DevRoleBar } from './components/DevRoleBar';
import { OfflineIndicator } from './components/PWAControls';
import { LandingPage } from './pages/LandingPage';
import { ExplorePage } from './pages/ExplorePage';
import {
  CategoriesPage,
  HowItWorksPage,
  ProfessionalsDirectoryPage,
} from './pages/PublicDirectoryPages';
import { ProProfilePage } from './pages/ProProfilePage';
import { ComparePage } from './pages/ComparePage';
import { RequestWizardPage } from './pages/RequestWizardPage';
import { ClientPanelPage } from './pages/ClientPanelPage';
import { ProPanelPage } from './pages/ProPanelPage';
import { AdminPanelPage } from './pages/AdminPanelPage';
import { LegalPage } from './pages/LegalPage';

const GoogleMapsQuotaBanner: React.FC = () => {
  const [visible, setVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return Boolean((window as unknown as { __oficlickGmpQuotaFlag?: boolean }).__oficlickGmpQuotaFlag);
  });

  useEffect(() => {
    const handler = () => setVisible(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 bg-amber-100 dark:bg-amber-950 border-b border-amber-300 dark:border-amber-800 px-4 py-2.5 text-xs text-amber-950 dark:text-amber-100"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-700 dark:text-amber-300" />
          <span>
            Cuota de Google Maps excedida o clave con restricción temporal. El mapa interactivo
            continúa operando con vista local de Cuautitlán Izcalli.{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold"
            >
              Más información sobre cuotas
            </a>
          </span>
        </div>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label="Cerrar aviso de mapa"
          className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

const ToastContainer: React.FC = () => {
  const { toasts, dismissToast } = useOfiClick();
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-20 md:bottom-4 left-4 right-4 sm:right-auto z-50 flex flex-col gap-2 max-w-sm w-auto sm:w-full pointer-events-none"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2.5 rounded-xl px-4 py-3 text-xs font-medium shadow-lg border ${
            t.type === 'success'
              ? 'bg-[#1D3B30] text-[#F7F3EA] border-[#2D5A49]'
              : t.type === 'error'
              ? 'bg-red-950 text-red-50 border-red-700'
              : 'bg-[#1D252C] text-[#F7F3EA] border-white/15'
          }`}
        >
          {t.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          ) : t.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-4 h-4 text-[#E58359] shrink-0 mt-0.5" />
          )}
          <span className="flex-1 leading-relaxed">{t.message}</span>
          <button
            type="button"
            onClick={() => dismissToast(t.id)}
            aria-label="Cerrar notificación"
            className="opacity-70 hover:opacity-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};

const AppShell: React.FC = () => {
  const { route, currentUser } = useOfiClick();

  const showPublicChrome =
    (!currentUser || currentUser.primaryRole === 'client') &&
    isPublicMarketplaceRoute(route);

  const renderPage = () => {
    // Non-client roles are strictly isolated to their dedicated workspace panel
    if (currentUser?.primaryRole === 'independent_pro') {
      const tab = route.page === 'pro-panel' ? route.tab : 'inicio';
      return <ProPanelPage key={tab || 'inicio'} initialTab={tab} />;
    }
    if (currentUser?.primaryRole === 'central_admin') {
      const tab = route.page === 'central-admin-panel' ? route.tab : 'resumen';
      return (
        <AdminPanelPage
          key={`central-${tab || 'resumen'}`}
          initialTab={tab}
        />
      );
    }

    switch (route.page) {
      case 'landing':
        return <LandingPage />;
      case 'explore':
        return (
          <ExplorePage
            key={`${route.query || ''}-${route.categoryId || ''}-${route.colonia || ''}`}
            initialQuery={route.query}
            initialCategoryId={route.categoryId}
            initialColonia={route.colonia}
          />
        );
      case 'categories':
        return <CategoriesPage />;
      case 'how-it-works':
        return <HowItWorksPage />;
      case 'professionals':
        return (
          <ProfessionalsDirectoryPage
            key={`${route.query || ''}-${route.categoryId || ''}`}
            initialQuery={route.query}
            initialCategoryId={route.categoryId}
          />
        );
      case 'pro-profile':
        return <ProProfilePage proId={route.proId} />;
      case 'compare':
        return <ComparePage />;
      case 'request-new':
        return (
          <RequestWizardPage
            preselectedProId={route.preselectedProId}
            preselectedCategoryId={route.preselectedCategoryId}
          />
        );
      case 'client-panel':
        return <ClientPanelPage key={route.tab || 'inicio'} initialTab={route.tab} />;
      case 'legal':
        return <LegalPage section={route.section} />;
      default:
        return currentUser ? (
          <ClientPanelPage key="inicio" initialTab="inicio" />
        ) : (
          <LandingPage />
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F3EA] dark:bg-[#12171C] text-[#1D252C] dark:text-[#F7F3EA] transition-colors">
      <GoogleMapsQuotaBanner />
      {showPublicChrome && <Header />}
      <div className="flex-1">{renderPage()}</div>
      {showPublicChrome && <Footer />}
      <AuthModal />
      <ToastContainer />
      <OfflineIndicator />
      <DevRoleBar />
    </div>
  );
};

export default function App() {
  return (
    <OfiClickProvider>
      <AppShell />
    </OfiClickProvider>
  );
}
