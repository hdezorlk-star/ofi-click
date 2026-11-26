import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type {
  AppDatabaseState,
  Profile,
  ThemePreference,
  UserRoleType,
} from '../types/oficlick';
import { getDataProvider } from '../services/provider';
import { authService } from '../services/auth.service';
import { profilesService } from '../services/profiles.service';
import { getDefaultRouteForRole, isRoutePageAllowedForUser } from '../utils/marketplace';
import { getSupabaseClient } from '../lib/supabase/client';
import { emailService } from '../services/email/email.service';

export type AppRoute =
  | { page: 'landing' }
  | { page: 'explore'; query?: string; categoryId?: string; colonia?: string }
  | { page: 'categories' }
  | { page: 'how-it-works' }
  | { page: 'professionals'; query?: string; categoryId?: string }
  | { page: 'pro-profile'; proId: string }
  | { page: 'compare' }
  | { page: 'request-new'; preselectedProId?: string; preselectedCategoryId?: string }
  | { page: 'client-panel'; tab?: string }
  | { page: 'pro-panel'; tab?: string }
  | { page: 'central-admin-panel'; tab?: string }
  | { page: 'legal'; section: 'privacy' | 'terms' | 'contact' | 'support' };

export function isPublicMarketplaceRoute(route: AppRoute): boolean {
  return (
    route.page !== 'client-panel' &&
    route.page !== 'pro-panel' &&
    route.page !== 'central-admin-panel'
  );
}

export function routeToUrl(route: AppRoute): string {
  switch (route.page) {
    case 'landing':
      return '/';
    case 'explore': {
      const params = new URLSearchParams();
      if (route.query) params.set('q', route.query);
      if (route.categoryId) params.set('cat', route.categoryId);
      if (route.colonia) params.set('col', route.colonia);
      const qs = params.toString();
      return qs ? `/explorar?${qs}` : '/explorar';
    }
    case 'categories':
      return '/categorias';
    case 'how-it-works':
      return '/como-funciona';
    case 'professionals': {
      const params = new URLSearchParams();
      if (route.query) params.set('q', route.query);
      if (route.categoryId) params.set('cat', route.categoryId);
      const qs = params.toString();
      return qs ? `/profesionales?${qs}` : '/profesionales';
    }
    case 'pro-profile':
      return `/profesional/${encodeURIComponent(route.proId)}`;
    case 'compare':
      return '/comparar';
    case 'request-new': {
      const params = new URLSearchParams();
      if (route.preselectedProId) params.set('pro', route.preselectedProId);
      if (route.preselectedCategoryId) params.set('cat', route.preselectedCategoryId);
      const qs = params.toString();
      return qs ? `/solicitar?${qs}` : '/solicitar';
    }
    case 'client-panel':
      return `/cliente/${encodeURIComponent(route.tab || 'inicio')}`;
    case 'pro-panel':
      return `/freelancer/${encodeURIComponent(route.tab || 'inicio')}`;
    case 'central-admin-panel':
      return `/admin-central/${encodeURIComponent(route.tab || 'resumen')}`;
    case 'legal':
      return `/legal/${encodeURIComponent(route.section)}`;
  }
}

export function parseRouteFromLocation(): AppRoute {
  if (typeof window === 'undefined') return { page: 'landing' };
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const params = new URLSearchParams(window.location.search);
  const parts = pathname.split('/').filter(Boolean);

  if (pathname === '/') return { page: 'landing' };
  if (parts[0] === 'explorar') {
    return {
      page: 'explore',
      query: params.get('q') || undefined,
      categoryId: params.get('cat') || undefined,
      colonia: params.get('col') || undefined,
    };
  }
  if (parts[0] === 'categorias') return { page: 'categories' };
  if (parts[0] === 'como-funciona') return { page: 'how-it-works' };
  if (parts[0] === 'profesionales') {
    return {
      page: 'professionals',
      query: params.get('q') || undefined,
      categoryId: params.get('cat') || undefined,
    };
  }
  if (parts[0] === 'profesional' && parts[1]) {
    return { page: 'pro-profile', proId: decodeURIComponent(parts[1]) };
  }
  if (parts[0] === 'comparar') return { page: 'compare' };
  if (parts[0] === 'solicitar') {
    return {
      page: 'request-new',
      preselectedProId: params.get('pro') || undefined,
      preselectedCategoryId: params.get('cat') || undefined,
    };
  }
  if (parts[0] === 'cliente') {
    return { page: 'client-panel', tab: parts[1] ? decodeURIComponent(parts[1]) : 'inicio' };
  }
  if (parts[0] === 'freelancer') {
    return { page: 'pro-panel', tab: parts[1] ? decodeURIComponent(parts[1]) : 'inicio' };
  }
  if (parts[0] === 'admin-central') {
    return {
      page: 'central-admin-panel',
      tab: parts[1] ? decodeURIComponent(parts[1]) : 'resumen',
    };
  }
  if (parts[0] === 'legal') {
    const sec = parts[1];
    if (sec === 'privacy' || sec === 'terms' || sec === 'contact' || sec === 'support') {
      return { page: 'legal', section: sec };
    }
    return { page: 'legal', section: 'support' };
  }
  return { page: 'landing' };
}

interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface PendingAuthAction {
  label: string;
  callback: (profile: Profile) => void;
}

interface OfiClickContextValue {
  db: AppDatabaseState;
  dataMode: 'local' | 'supabase';
  configWarning: string | null;
  currentUser: Profile | null;
  route: AppRoute;
  theme: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  compareIds: string[];
  toasts: ToastItem[];
  authModalOpen: boolean;
  authModalMode: 'login' | 'register' | 'recovery' | 'admin';
  passwordRecoveryReady: boolean;
  pendingActionLabel: string | null;
  navigate: (next: AppRoute) => void;
  setTheme: (pref: ThemePreference) => void;
  refreshDb: () => void;
  resetLocalWorkspace: () => void;
  notify: (message: string, type?: ToastItem['type']) => void;
  dismissToast: (id: string) => void;
  requireAuth: (label: string, onAuthenticated: (profile: Profile) => void) => void;
  openAuthModal: (mode?: 'login' | 'register' | 'recovery' | 'admin') => void;
  closeAuthModal: () => void;
  clearPasswordRecoveryReady: () => void;
  completeAuthSuccess: (profile: Profile) => void;
  switchWorkspaceRole: (role: UserRoleType) => void;
  signOut: () => void;
  toggleCompare: (proId: string) => void;
  clearCompare: () => void;
  toggleFavorite: (proId: string) => void;
}

const OfiClickContext = createContext<OfiClickContextValue | null>(null);

const THEME_KEY = 'oficlick_theme_pref_v1';

export const OfiClickProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const provider = getDataProvider();
  const [db, setDb] = useState<AppDatabaseState>(() => provider.getSnapshot());
  const [dataMode] = useState<'local' | 'supabase'>(() => provider.mode);
  const [configWarning] = useState<string | null>(() => provider.getConfigWarning?.() || null);
  const [currentUser, setCurrentUser] = useState<Profile | null>(() =>
    authService.getCurrentProfile()
  );
  const [route, setRoute] = useState<AppRoute>(() => parseRouteFromLocation());
  const [theme, setThemeState] = useState<ThemePreference>(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = window.localStorage.getItem(THEME_KEY) as ThemePreference | null;
    return saved || 'light';
  });
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'recovery' | 'admin'>('login');
  const [passwordRecoveryReady, setPasswordRecoveryReady] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAuthAction | null>(null);

  const notify = useCallback((message: string, type: ToastItem['type'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setRoute(parseRouteFromLocation());
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Surface any OAuth error returned in URL query/hash and strip transient auth params once read
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const oauthErr =
      searchParams.get('error_description') ||
      hashParams.get('error_description') ||
      searchParams.get('error') ||
      hashParams.get('error');

    if (oauthErr) {
      notify(`No se pudo completar el acceso con Google: ${oauthErr}`, 'error');
      window.history.replaceState({}, '', window.location.pathname || '/');
    }

    emailService.checkServerEmailStatus().catch(() => {});
  }, [notify]);

  useEffect(() => {
    const applyTheme = () => {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const effective: 'light' | 'dark' =
        theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
      setResolvedTheme(effective);
      document.documentElement.classList.toggle('dark', effective === 'dark');
    };
    applyTheme();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', applyTheme);
    return () => mq.removeEventListener('change', applyTheme);
  }, [theme]);

  const setTheme = useCallback((pref: ThemePreference) => {
    setThemeState(pref);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(THEME_KEY, pref);
    }
  }, []);

  const refreshDb = useCallback(() => {
    setDb({ ...getDataProvider().getSnapshot() });
    setCurrentUser(authService.getCurrentProfile());
  }, []);

  useEffect(() => {
    const activeProvider = getDataProvider();
    if (typeof (activeProvider as any).onStateChange === 'function') {
      const unsub = (activeProvider as any).onStateChange(() => {
        setDb({ ...activeProvider.getSnapshot() });
        setCurrentUser(authService.getCurrentProfile());
      });
      return unsub;
    }
  }, []);

  const navigate = useCallback((next: AppRoute) => {
    const activeUser = authService.getCurrentProfile();
    const resolvedNext =
      activeUser && !isRoutePageAllowedForUser(activeUser, next.page)
        ? getDefaultRouteForRole(activeUser.primaryRole)
        : next;
    setRoute(resolvedNext);
    if (typeof window !== 'undefined') {
      const targetUrl = routeToUrl(resolvedNext);
      if (window.location.pathname + window.location.search !== targetUrl) {
        window.history.pushState({}, '', targetUrl);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(async (event, session) => {
      const activeProvider = getDataProvider();
      if (typeof (activeProvider as any).syncWithSession === 'function') {
        await (activeProvider as any).syncWithSession(session);
      }
      refreshDb();

      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecoveryReady(true);
        setAuthModalMode('recovery');
        setAuthModalOpen(true);
        notify('Enlace verificado. Define tu nueva contraseña para completar la recuperación.', 'info');
        if (typeof window !== 'undefined' && window.location.hash) {
          window.history.replaceState({}, '', window.location.pathname || '/');
        }
        return;
      }

      if (event === 'SIGNED_IN' && session?.user) {
        setAuthModalOpen(false);
        const profile = authService.getCurrentProfile();
        if (typeof window !== 'undefined') {
          const qs = new URLSearchParams(window.location.search);
          if (qs.has('code') || window.location.hash.includes('access_token')) {
            window.history.replaceState({}, '', window.location.pathname || '/');
          }
        }
        if (profile) {
          if (profile.primaryRole !== 'client') {
            navigate(getDefaultRouteForRole(profile.primaryRole));
          }
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, notify, refreshDb]);

  useEffect(() => {
    if (!currentUser) return;
    if (!isRoutePageAllowedForUser(currentUser, route.page)) {
      const safeRoute = getDefaultRouteForRole(currentUser.primaryRole);
      setRoute(safeRoute);
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', routeToUrl(safeRoute));
      }
    }
  }, [currentUser, route.page]);

  const resetLocalWorkspace = useCallback(() => {
    const fresh = getDataProvider().resetWorkspaceData();
    setDb(fresh);
    setCurrentUser(authService.getCurrentProfile());
    setCompareIds([]);
    if (getDataProvider().mode === 'local') {
      setRoute({ page: 'landing' });
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/');
      }
      notify('Datos locales iniciales restablecidos.', 'success');
    } else {
      notify('Datos sincronizados con Supabase.', 'success');
    }
  }, [notify]);

  const openAuthModal = useCallback(
    (mode: 'login' | 'register' | 'recovery' | 'admin' = 'login') => {
      setAuthModalMode(mode);
      setAuthModalOpen(true);
    },
    []
  );

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
    setPendingAction(null);
  }, []);

  const clearPasswordRecoveryReady = useCallback(() => {
    setPasswordRecoveryReady(false);
  }, []);

  const completeAuthSuccess = useCallback(
    (profile: Profile) => {
      refreshDb();
      setAuthModalOpen(false);
      notify(`Sesión iniciada como ${profile.fullName}`, 'success');
      if (pendingAction) {
        const cb = pendingAction.callback;
        setPendingAction(null);
        if (profile.primaryRole !== 'client') {
          navigate(getDefaultRouteForRole(profile.primaryRole));
          return;
        }
        cb(profile);
      } else {
        navigate(getDefaultRouteForRole(profile.primaryRole));
      }
    },
    [navigate, notify, pendingAction, refreshDb]
  );

  const requireAuth = useCallback(
    (label: string, onAuthenticated: (profile: Profile) => void) => {
      const active = authService.getCurrentProfile();
      if (active) {
        onAuthenticated(active);
        return;
      }
      setPendingAction({ label, callback: onAuthenticated });
      setAuthModalMode('login');
      setAuthModalOpen(true);
    },
    []
  );

  const switchWorkspaceRole = useCallback(
    (role: UserRoleType) => {
      try {
        const profile = authService.switchWorkspaceRole(role);
        refreshDb();
        notify(`Espacio activo: ${profile.fullName}`, 'info');
        navigate(getDefaultRouteForRole(role));
      } catch (err) {
        notify(err instanceof Error ? err.message : 'No se pudo cambiar de espacio.', 'error');
      }
    },
    [navigate, notify, refreshDb]
  );

  const signOut = useCallback(() => {
    authService.signOut();
    refreshDb();
    setRoute({ page: 'landing' });
    if (typeof window !== 'undefined') {
      window.history.replaceState({}, '', '/');
    }
    notify('Sesión cerrada.', 'info');
  }, [notify, refreshDb]);

  const toggleCompare = useCallback(
    (proId: string) => {
      setCompareIds((prev) => {
        if (prev.includes(proId)) {
          return prev.filter((id) => id !== proId);
        }
        if (prev.length >= 3) {
          notify('Puedes comparar hasta 3 profesionales simultáneamente.', 'error');
          return prev;
        }
        return [...prev, proId];
      });
    },
    [notify]
  );

  const clearCompare = useCallback(() => setCompareIds([]), []);

  const toggleFavorite = useCallback(
    (proId: string) => {
      requireAuth('guardar profesionales en favoritos', (user) => {
        const added = profilesService.toggleFavorite(user.id, proId);
        refreshDb();
        notify(
          added ? 'Profesional guardado en tus favoritos.' : 'Eliminado de favoritos.',
          'success'
        );
      });
    },
    [notify, refreshDb, requireAuth]
  );

  return (
    <OfiClickContext.Provider
      value={{
        db,
        dataMode,
        configWarning,
        currentUser,
        route,
        theme,
        resolvedTheme,
        compareIds,
        toasts,
        authModalOpen,
        authModalMode,
        passwordRecoveryReady,
        pendingActionLabel: pendingAction?.label || null,
        navigate,
        setTheme,
        refreshDb,
        resetLocalWorkspace,
        notify,
        dismissToast,
        requireAuth,
        openAuthModal,
        closeAuthModal,
        clearPasswordRecoveryReady,
        completeAuthSuccess,
        switchWorkspaceRole,
        signOut,
        toggleCompare,
        clearCompare,
        toggleFavorite,
      }}
    >
      {children}
    </OfiClickContext.Provider>
  );
};

export function useOfiClick() {
  const ctx = useContext(OfiClickContext);
  if (!ctx) throw new Error('useOfiClick must be used within OfiClickProvider');
  return ctx;
}
