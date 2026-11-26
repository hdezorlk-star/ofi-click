import React from 'react';
import { ArrowLeft, Bell, LogOut, Moon, Sun } from 'lucide-react';
import { BrandLogo } from '../BrandLogo';
import { UserAvatar } from '../UserAvatar';
import { useOfiClick } from '../../context/OfiClickContext';
import { getPublicProAvatar } from '../../utils/media';

export interface DashboardNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
}

interface DashboardShellProps {
  title: string;
  subtitle: string;
  roleLabel: string;
  navItems: DashboardNavItem[];
  activeTab: string;
  onSelectTab: (id: string) => void;
  headerActions?: React.ReactNode;
  notificationsTabId?: string;
  children: React.ReactNode;
}

export const DashboardShell: React.FC<DashboardShellProps> = ({
  title,
  subtitle,
  roleLabel,
  navItems,
  activeTab,
  onSelectTab,
  headerActions,
  notificationsTabId = 'notificaciones',
  children,
}) => {
  const { navigate, signOut, theme, setTheme, resolvedTheme, currentUser, db } = useOfiClick();

  const unreadCount = currentUser
    ? db.notifications.filter((n) => n.profileId === currentUser.id && !n.read).length
    : 0;
  const hasNotificationsTab = navItems.some((item) => item.id === notificationsTabId);

  const cycleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  };

  const currentPro = currentUser
    ? db.professionals.find((p) => p.profileId === currentUser.id)
    : undefined;
  const displayAvatarSrc = currentPro
    ? getPublicProAvatar(currentPro)
    : currentUser?.avatarUrl;

  const canExploreMarketplace = currentUser?.primaryRole === 'client';

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F3EA] dark:bg-[#12171C]">
      {/* Dedicated Internal Workspace Topbar (no duplicated public marketplace nav) */}
      <header className="sticky top-0 z-40 h-14 border-b border-[#DBD4C6] dark:border-white/10 bg-[#F7F3EA]/95 dark:bg-[#12171C]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {canExploreMarketplace ? (
              <button
                type="button"
                onClick={() => navigate({ page: 'landing' })}
                aria-label="OFI CLICK"
                className="shrink-0"
              >
                <BrandLogo variant="horizontal" size="sm" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSelectTab(navItems[0]?.id || 'inicio')}
                aria-label="OFI CLICK"
                className="shrink-0"
              >
                <BrandLogo variant="horizontal" size="sm" />
              </button>
            )}
            <span className="hidden sm:inline-block h-4 w-px bg-[#DBD4C6] dark:bg-white/15" />
            <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#214438]/10 dark:bg-[#75836A]/20 text-[11px] font-semibold text-[#214438] dark:text-[#D5DEC8] truncate">
              {roleLabel}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canExploreMarketplace && (
              <button
                type="button"
                onClick={() => navigate({ page: 'landing' })}
                aria-label="Volver al marketplace"
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#1A2128] text-xs font-semibold text-[#1D252C] dark:text-[#F7F3EA] hover:border-[#214438] transition-colors whitespace-nowrap"
              >
                <ArrowLeft className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="sm:hidden">Marketplace</span>
                <span className="hidden sm:inline">Volver al marketplace</span>
              </button>
            )}

            {hasNotificationsTab && (
              <button
                type="button"
                onClick={() => onSelectTab(notificationsTabId)}
                aria-label="Notificaciones del panel"
                className="relative p-2 rounded-lg border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] text-[#1D252C] dark:text-[#F7F3EA] hover:border-[#214438]"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#C7582B] text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={cycleTheme}
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className="p-2 rounded-lg border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] text-[#1D252C] dark:text-[#F7F3EA] hover:border-[#214438]"
            >
              {resolvedTheme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {currentUser && (
              <button
                type="button"
                onClick={signOut}
                title="Cerrar sesión"
                aria-label="Cerrar sesión"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Cerrar sesión</span>
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-12">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Desktop Sidebar */}
          <aside className="hidden md:block w-64 shrink-0">
            <div className="sticky top-20 rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-4 space-y-4 shadow-xs">
              <div className="pb-3 border-b border-[#DBD4C6] dark:border-white/10 flex items-center gap-3">
                <UserAvatar src={displayAvatarSrc} name={title} sizeClass="w-11 h-11" />
                <div className="min-w-0 flex-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#214438] dark:text-[#C7582B] block truncate">
                    {roleLabel}
                  </span>
                  <h2 className="text-base font-bold text-[#1D252C] dark:text-[#F7F3EA] mt-0.5 truncate">
                    {title}
                  </h2>
                  <p className="text-xs text-[#73766F] dark:text-[#A3A89F] truncate">{subtitle}</p>
                </div>
              </div>

              <nav className="space-y-1 max-h-[calc(100vh-14rem)] overflow-y-auto pr-1" aria-label="Navegación del panel">
                {navItems.map((item) => {
                  const active = item.id === activeTab;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectTab(item.id)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                        active
                          ? 'bg-[#214438] text-white dark:bg-[#75836A] dark:text-white'
                          : 'text-[#1D252C]/85 dark:text-[#F7F3EA]/85 hover:bg-[#ECE7DC]/75 dark:hover:bg-white/8'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0 truncate">
                        <span className="shrink-0">{item.icon}</span>
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.badge !== undefined && Number(item.badge) > 0 && (
                        <span
                          className={`px-1.5 py-0.5 text-[11px] font-bold rounded ${
                            active
                              ? 'bg-white/20 text-white'
                              : 'bg-[#C7582B] text-white'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </aside>

          {/* Mobile Top Horizontal Tab Strip */}
          <div className="md:hidden space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <UserAvatar src={displayAvatarSrc} name={title} sizeClass="w-9 h-9" />
                <div className="min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#214438] dark:text-[#C7582B] block truncate">
                    {roleLabel}
                  </span>
                  <h2 className="text-lg font-bold text-[#1D252C] dark:text-[#F7F3EA] truncate">
                    {title}
                  </h2>
                </div>
              </div>
              {headerActions}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
              {navItems.map((item) => {
                const active = item.id === activeTab;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectTab(item.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 border ${
                      active
                        ? 'bg-[#214438] text-white border-[#214438] dark:bg-[#75836A] dark:border-[#75836A]'
                        : 'bg-[#FFFDFA] dark:bg-[#1A2128] text-[#1D252C] dark:text-[#F7F3EA] border-[#DBD4C6] dark:border-white/12'
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                    {item.badge !== undefined && Number(item.badge) > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] rounded bg-[#C7582B] text-white font-bold">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Workspace */}
          <main className="flex-1 min-w-0 space-y-6">
            {headerActions ? (
              <div className="hidden md:flex items-center justify-between gap-4 pb-2 border-b border-[#DBD4C6] dark:border-white/10">
                <h1 className="text-xl font-bold text-[#1D252C] dark:text-[#F7F3EA]">
                  {navItems.find((i) => i.id === activeTab)?.label || title}
                </h1>
                <div className="flex items-center gap-2">{headerActions}</div>
              </div>
            ) : (
              <div className="hidden md:flex items-center justify-between gap-4 pb-2 border-b border-[#DBD4C6] dark:border-white/10">
                <h1 className="text-xl font-bold text-[#1D252C] dark:text-[#F7F3EA]">
                  {navItems.find((i) => i.id === activeTab)?.label || title}
                </h1>
              </div>
            )}
            {children}
          </main>
        </div>

        {/* Mobile Compact Bottom Navigation */}
        <nav
          aria-label="Navegación rápida móvil"
          className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#FFFDFA]/95 dark:bg-[#1E2421]/95 backdrop-blur border-t border-[#DBD4C6] dark:border-white/12 px-2 py-1.5 flex items-center justify-around"
        >
          {navItems.slice(0, 5).map((item) => {
            const active = item.id === activeTab;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`flex flex-col items-center justify-center px-1.5 py-1 rounded-lg text-[10px] font-medium min-w-[60px] ${
                  active
                    ? 'text-[#214438] dark:text-[#C7582B] font-bold'
                    : 'text-[#73766F] dark:text-[#A3A89F]'
                }`}
              >
                {item.icon}
                <span className="mt-0.5 truncate max-w-[74px]">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
