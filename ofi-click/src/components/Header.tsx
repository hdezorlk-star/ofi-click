import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Briefcase,
  ChevronDown,
  ClipboardList,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Settings,
  User,
  X,
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { UserAvatar } from './UserAvatar';
import { useOfiClick } from '../context/OfiClickContext';
import { getDefaultRouteForRole } from '../utils/marketplace';

export const Header: React.FC = () => {
  const { currentUser, route, navigate, openAuthModal, signOut, db } = useOfiClick();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const unreadNotifs = currentUser
    ? db.notifications.filter((n) => n.profileId === currentUser.id && !n.read).length
    : 0;
  const unreadMsgs = currentUser
    ? db.messages.filter(
        (m) =>
          m.senderId !== currentUser.id &&
          !m.readByIds.includes(currentUser.id) &&
          db.conversations.some(
            (c) => c.id === m.conversationId && c.participantIds.includes(currentUser.id)
          )
      ).length
    : 0;

  useEffect(() => {
    if (!accountMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false);
      }
    };
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAccountMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [accountMenuOpen]);

  const navigatePanelTab = (tab: string) => {
    if (!currentUser) {
      openAuthModal('login');
      return;
    }
    if (currentUser.primaryRole === 'client') {
      navigate({ page: 'client-panel', tab });
    } else {
      navigate(getDefaultRouteForRole(currentUser.primaryRole));
    }
    setAccountMenuOpen(false);
    setMobileOpen(false);
  };

  const navLinks = [
    { id: 'landing' as const, label: 'Inicio', route: { page: 'landing' } as const },
    { id: 'explore' as const, label: 'Explorar', route: { page: 'explore' } as const },
    { id: 'categories' as const, label: 'Categorías', route: { page: 'categories' } as const },
    { id: 'how-it-works' as const, label: 'Cómo funciona', route: { page: 'how-it-works' } as const },
    { id: 'professionals' as const, label: 'Profesionales', route: { page: 'professionals' } as const },
  ];

  const accountMenuItems: {
    id: string;
    label: string;
    tab: string;
    icon: React.ReactNode;
    badge?: number;
  }[] = [
    {
      id: 'perfil',
      label: 'Mi perfil',
      tab: 'perfil',
      icon: <User className="w-4 h-4" aria-hidden="true" />,
    },
    {
      id: 'inicio',
      label: 'Mi panel',
      tab: 'inicio',
      icon: <LayoutDashboard className="w-4 h-4" aria-hidden="true" />,
    },
    {
      id: 'solicitudes',
      label: 'Mis solicitudes',
      tab: 'solicitudes',
      icon: <ClipboardList className="w-4 h-4" aria-hidden="true" />,
    },
    {
      id: 'contratados',
      label: 'Servicios contratados',
      tab: 'contratados',
      icon: <Briefcase className="w-4 h-4" aria-hidden="true" />,
    },
    {
      id: 'mensajes',
      label: 'Mensajes',
      tab: 'mensajes',
      icon: <MessageSquare className="w-4 h-4" aria-hidden="true" />,
      badge: unreadMsgs,
    },
    {
      id: 'favoritos',
      label: 'Favoritos',
      tab: 'favoritos',
      icon: <Heart className="w-4 h-4" aria-hidden="true" />,
    },
    {
      id: 'notificaciones',
      label: 'Notificaciones',
      tab: 'notificaciones',
      icon: <Bell className="w-4 h-4" aria-hidden="true" />,
      badge: unreadNotifs,
    },
    {
      id: 'configuracion',
      label: 'Configuración',
      tab: 'configuracion',
      icon: <Settings className="w-4 h-4" aria-hidden="true" />,
    },
  ];

  const firstName = currentUser ? currentUser.fullName.split(' ')[0] : '';

  return (
    <header className="sticky top-0 z-40 border-b border-[#DDD5C8] dark:border-white/10 bg-[#F5F1E8]/95 dark:bg-[#171B19]/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6">
        <button
          type="button"
          onClick={() => navigate({ page: 'landing' })}
          aria-label="OFI CLICK Inicio"
          className="whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#304B3E] rounded-lg"
        >
          <BrandLogo variant="horizontal" size="md" />
        </button>

        <nav
          aria-label="Navegación pública principal"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-[#252A27]/80 dark:text-[#F5F1E8]/80"
        >
          {navLinks.map((item) => {
            const active = route.page === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.route)}
                className={`whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'text-[#304B3E] dark:text-[#75836A] font-semibold underline decoration-[#B96F50] decoration-2 underline-offset-8'
                    : 'hover:text-[#304B3E] dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          {currentUser ? (
            <div ref={menuRef} className="relative hidden md:block">
              <button
                type="button"
                onClick={() => setAccountMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={accountMenuOpen}
                aria-label={`Menú de cuenta de ${currentUser.fullName}`}
                data-testid="header-account-menu-trigger"
                className="inline-flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-full bg-[#FFFCF7] dark:bg-[#222825] border border-[#DDD5C8] dark:border-white/15 hover:border-[#304B3E] dark:hover:border-[#75836A] transition-colors whitespace-nowrap shrink-0 shadow-2xs"
              >
                <div className="relative">
                  <UserAvatar
                    src={currentUser.avatarUrl}
                    name={currentUser.fullName}
                    sizeClass="w-8 h-8"
                  />
                  {unreadNotifs + unreadMsgs > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#B96F50] ring-2 ring-[#FFFCF7] dark:ring-[#222825]"
                    />
                  )}
                </div>
                <span className="text-xs font-semibold text-[#252A27] dark:text-[#F5F1E8] max-w-[110px] truncate">
                  {firstName}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-[#73766F] transition-transform ${
                    accountMenuOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              {accountMenuOpen && (
                <div
                  role="menu"
                  aria-label="Opciones de cuenta"
                  data-testid="header-account-dropdown"
                  className="absolute right-0 mt-2 w-64 rounded-2xl bg-[#FFFCF7] dark:bg-[#222825] border border-[#DDD5C8] dark:border-white/15 shadow-xl py-2 z-50"
                >
                  <div className="px-4 py-2.5 border-b border-[#DDD5C8] dark:border-white/10 flex items-center gap-3">
                    <UserAvatar
                      src={currentUser.avatarUrl}
                      name={currentUser.fullName}
                      sizeClass="w-9 h-9"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#252A27] dark:text-[#F5F1E8] truncate">
                        {currentUser.fullName}
                      </p>
                      <p className="text-[11px] text-[#73766F] dark:text-[#A3A89F] truncate">
                        {currentUser.email}
                      </p>
                    </div>
                  </div>

                  <div className="py-1">
                    {accountMenuItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        role="menuitem"
                        onClick={() => navigatePanelTab(item.tab)}
                        className="w-full px-4 py-2 text-left text-xs font-medium text-[#252A27] dark:text-[#F5F1E8] hover:bg-[#EAE3D6]/70 dark:hover:bg-white/10 flex items-center justify-between gap-2 transition-colors"
                      >
                        <span className="flex items-center gap-2.5">
                          <span className="text-[#304B3E] dark:text-[#75836A]">
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </span>
                        {item.badge !== undefined && item.badge > 0 && (
                          <span className="font-mono-num px-1.5 py-0.5 rounded bg-[#B96F50] text-white text-[10px] font-bold">
                            {item.badge}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="pt-1 mt-1 border-t border-[#DDD5C8] dark:border-white/10">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        signOut();
                      }}
                      className="w-full px-4 py-2 text-left text-xs font-semibold text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2.5 transition-colors"
                    >
                      <LogOut className="w-4 h-4" aria-hidden="true" />
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="hidden md:inline-flex items-center px-4 py-2 text-xs font-semibold rounded-xl bg-[#304B3E] hover:bg-[#243A30] text-white transition-colors whitespace-nowrap shrink-0"
            >
              Iniciar sesión
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
            aria-expanded={mobileOpen}
            className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-[#252A27] dark:text-[#F5F1E8] hover:bg-black/5 dark:hover:bg-white/10"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-[#DDD5C8] dark:border-white/10 bg-[#F5F1E8] dark:bg-[#171B19] px-4 py-4 space-y-1.5 max-h-[82vh] overflow-y-auto">
          {navLinks.map((item) => {
            const active = route.page === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  navigate(item.route);
                  setMobileOpen(false);
                }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${
                  active
                    ? 'bg-[#304B3E]/12 text-[#304B3E] dark:bg-[#75836A]/20 dark:text-[#EAE3D6] font-semibold'
                    : 'hover:bg-[#EAE3D6]/70 dark:hover:bg-white/10'
                }`}
              >
                {item.label}
              </button>
            );
          })}
          <div className="pt-3 border-t border-[#DDD5C8] dark:border-white/10 space-y-2">
            {currentUser ? (
              <>
                <div className="flex items-center gap-3 px-2 py-1.5">
                  <UserAvatar
                    src={currentUser.avatarUrl}
                    name={currentUser.fullName}
                    sizeClass="w-9 h-9"
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#252A27] dark:text-[#F5F1E8] truncate">
                      {currentUser.fullName}
                    </p>
                    <p className="text-[11px] text-[#73766F] truncate">{currentUser.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {accountMenuItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => navigatePanelTab(item.tab)}
                      className="flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg bg-[#FFFCF7] dark:bg-[#222825] border border-[#DDD5C8] dark:border-white/12 text-xs font-medium text-[#252A27] dark:text-[#F5F1E8]"
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span className="text-[#304B3E] dark:text-[#75836A] shrink-0">
                          {item.icon}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="font-mono-num px-1.5 py-0.5 rounded bg-[#B96F50] text-white text-[10px] font-bold">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    signOut();
                    setMobileOpen(false);
                  }}
                  className="w-full py-2 px-4 rounded-lg border border-red-300 text-red-700 dark:text-red-400 text-xs font-semibold flex items-center justify-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Cerrar sesión
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  openAuthModal('login');
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-[#304B3E] text-white text-sm font-semibold"
              >
                Iniciar sesión o registrarse
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
