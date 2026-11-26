import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Bell,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  Flag,
  FolderKanban,
  Globe2,
  HelpCircle,
  LayoutDashboard,
  Lock,
  MapPin,
  Plus,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useOfiClick } from '../context/OfiClickContext';
import { DashboardShell, type DashboardNavItem } from '../components/workspace/DashboardShell';
import { UserAvatar } from '../components/UserAvatar';
import { adminService } from '../services/admin.service';
import { notificationsService } from '../services/notifications.service';
import { privateMediaStore } from '../services/private-media.store';
import {
  canCentralAdminManageGlobal,
  formatDateMX,
  formatMXN,
} from '../utils/marketplace';
import { formatFileSize, getPublicProAvatar, getVerificationStageSummary } from '../utils/media';
import type {
  Category,
  ModerationReport,
  ProfessionalProfile,
  Region,
  SupportTicket,
  ThemePreference,
} from '../types/oficlick';

interface InspectingPrivateDoc {
  proName: string;
  label: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
  previewUrl: string;
  isDemo: boolean;
}

interface AdminPanelPageProps {
  initialTab?: string;
}

export const AdminPanelPage: React.FC<AdminPanelPageProps> = ({
  initialTab = 'resumen',
}) => {
  const {
    db,
    currentUser,
    theme,
    setTheme,
    navigate,
    openAuthModal,
    refreshDb,
    notify,
    signOut,
  } = useOfiClick();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [userSearch, setUserSearch] = useState('');
  const [proSearch, setProSearch] = useState('');
  const [reportFilter, setReportFilter] = useState<string>('all');
  const [reasonNote, setReasonNote] = useState('');
  const [ticketReplyMap, setTicketReplyMap] = useState<Record<string, string>>({});
  const [inspectingDoc, setInspectingDoc] = useState<InspectingPrivateDoc | null>(null);
  const [previewPro, setPreviewPro] = useState<ProfessionalProfile | null>(null);

  // Category CRUD & Subcategory state (Central Admin)
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catIcon, setCatIcon] = useState('Wrench');
  const [subcatInputMap, setSubcatInputMap] = useState<Record<string, string>>({});

  // Region CRUD state (Central Admin)
  const [regName, setRegName] = useState('');
  const [regState, setRegState] = useState('Estado de México');
  const [regColoniasText, setRegColoniasText] = useState('');
  const [newColoniaMap, setNewColoniaMap] = useState<Record<string, string>>({});

  useEffect(() => {
    setActiveTab(initialTab || 'resumen');
  }, [initialTab]);

  const hasAuthorizedRole = useMemo(() => {
    if (!currentUser) return false;
    return (
      currentUser.primaryRole === 'central_admin' ||
      currentUser.roles.includes('central_admin')
    );
  }, [currentUser]);

  const canViewRegion = (_regionId: string) => {
    if (!currentUser || !hasAuthorizedRole) return false;
    return canCentralAdminManageGlobal(currentUser);
  };

  const scopedProfiles = useMemo(() => {
    if (!currentUser || !hasAuthorizedRole) return [];
    return db.profiles.filter((p) => {
      if (!canViewRegion(p.regionId)) return false;
      const q = userSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        p.fullName.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.colonia.toLowerCase().includes(q)
      );
    });
  }, [db.profiles, currentUser, hasAuthorizedRole, userSearch]);

  const scopedClients = useMemo(
    () => scopedProfiles.filter((p) => p.roles.includes('client') || p.primaryRole === 'client'),
    [scopedProfiles]
  );

  const scopedPros = useMemo(() => {
    if (!currentUser || !hasAuthorizedRole) return [];
    const q = proSearch.trim().toLowerCase();
    return db.professionals.filter((p) => {
      if (!canViewRegion(p.regionId)) return false;
      if (!q) return true;
      return (
        p.displayName.toLowerCase().includes(q) ||
        (p.commercialName || '').toLowerCase().includes(q) ||
        p.primaryColonia.toLowerCase().includes(q)
      );
    });
  }, [db.professionals, currentUser, hasAuthorizedRole, proSearch]);

  const allScopedPros = useMemo(() => {
    if (!currentUser || !hasAuthorizedRole) return [];
    return db.professionals.filter((p) => canViewRegion(p.regionId));
  }, [db.professionals, currentUser, hasAuthorizedRole]);

  const scopedVerifications = useMemo(() => {
    if (!currentUser || !hasAuthorizedRole) return [];
    return db.verificationRequests.filter((v) => {
      const pro = db.professionals.find((p) => p.id === v.professionalId);
      return pro ? canViewRegion(pro.regionId) : false;
    });
  }, [db.verificationRequests, db.professionals, currentUser, hasAuthorizedRole]);

  const scopedReports = useMemo(() => {
    if (!currentUser || !hasAuthorizedRole) return [];
    return db.reports.filter((r) => canViewRegion(r.regionId));
  }, [db.reports, currentUser, hasAuthorizedRole]);

  const scopedReviews = useMemo(() => {
    if (!currentUser || !hasAuthorizedRole) return [];
    const proIds = new Set(allScopedPros.map((p) => p.id));
    return db.reviews.filter((rev) => proIds.has(rev.professionalId));
  }, [db.reviews, allScopedPros, currentUser, hasAuthorizedRole]);

  const scopedRequests = useMemo(() => {
    if (!currentUser || !hasAuthorizedRole) return [];
    return db.requests.filter((r) => canViewRegion(r.regionId));
  }, [db.requests, currentUser, hasAuthorizedRole]);

  const scopedBookings = useMemo(() => {
    if (!currentUser || !hasAuthorizedRole) return [];
    return db.bookings.filter((b) => canViewRegion(b.regionId));
  }, [db.bookings, currentUser, hasAuthorizedRole]);

  const scopedTickets = useMemo(() => {
    if (!currentUser || !hasAuthorizedRole) return [];
    return db.supportTickets.filter((t) => canViewRegion(t.regionId));
  }, [db.supportTickets, currentUser, hasAuthorizedRole]);

  const scopedAuditLogs = useMemo(() => {
    if (!currentUser || !hasAuthorizedRole) return [];
    return db.auditLogs.filter((l) => canViewRegion(l.regionId));
  }, [db.auditLogs, currentUser, hasAuthorizedRole]);

  if (!currentUser || !hasAuthorizedRole) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <ShieldCheck className="w-10 h-10 mx-auto text-[#304B3E] dark:text-[#B96F50]" />
        <h1 className="text-2xl font-bold text-[#252A27] dark:text-[#F5F1E8]">
          Acceso exclusivo de Administrador Central
        </h1>
        <p className="text-sm text-[#73766F] dark:text-[#A3A89F]">
          Esta consola global es exclusiva para Administración Central autorizada. Nunca se permite
          acceso desde registro público.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => openAuthModal('admin')}
            className="px-5 py-2.5 rounded-xl bg-[#304B3E] hover:bg-[#243A30] text-white dark:bg-[#B96F50] dark:hover:bg-[#a65e41] dark:text-[#FFFCF7] text-sm font-semibold transition-colors"
          >
            Acceso interno
          </button>
        </div>
      </div>
    );
  }

  const myNotifications = db.notifications.filter((n) => n.profileId === currentUser.id);
  const unreadNotifs = myNotifications.filter((n) => !n.read).length;

  const navItems: DashboardNavItem[] = [
    { id: 'resumen', label: 'Resumen', icon: <LayoutDashboard className="w-4 h-4" /> },
    {
      id: 'usuarios',
      label: 'Usuarios',
      icon: <Users className="w-4 h-4" />,
      badge: db.adminAccessRequests.filter((r) => r.status === 'pending_authorization').length,
    },
    { id: 'clientes', label: 'Clientes', icon: <Users className="w-4 h-4" /> },
    { id: 'freelancers', label: 'Freelancers', icon: <UserCheck className="w-4 h-4" /> },
    {
      id: 'verificaciones',
      label: 'Verificaciones',
      icon: <BadgeCheck className="w-4 h-4" />,
      badge: scopedVerifications.filter((v) => v.status === 'pending' || v.status === 'in_review').length,
    },
    { id: 'categorias', label: 'Categorías', icon: <FolderKanban className="w-4 h-4" /> },
    { id: 'solicitudes', label: 'Solicitudes', icon: <ClipboardList className="w-4 h-4" /> },
    { id: 'contrataciones', label: 'Contrataciones', icon: <Briefcase className="w-4 h-4" /> },
    {
      id: 'moderacion',
      label: 'Moderación',
      icon: <ShieldAlert className="w-4 h-4" />,
      badge: scopedReports.filter((r) => r.status === 'open').length,
    },
    { id: 'reportes', label: 'Reportes', icon: <Flag className="w-4 h-4" /> },
    {
      id: 'soporte',
      label: 'Soporte',
      icon: <HelpCircle className="w-4 h-4" />,
      badge: scopedTickets.filter((t) => t.status !== 'closed').length,
    },
    { id: 'regiones', label: 'Regiones', icon: <Globe2 className="w-4 h-4" /> },
    { id: 'configuracion', label: 'Configuración', icon: <Settings className="w-4 h-4" /> },
    { id: 'seguridad', label: 'Seguridad', icon: <Lock className="w-4 h-4" /> },
    { id: 'auditoria', label: 'Auditoría', icon: <Activity className="w-4 h-4" /> },
    {
      id: 'notificaciones',
      label: 'Notificaciones',
      icon: <Bell className="w-4 h-4" />,
      badge: unreadNotifs,
    },
    { id: 'estadisticas', label: 'Estadísticas', icon: <BarChart3 className="w-4 h-4" /> },
  ];

  const handleSelectTab = (id: string) => {
    setActiveTab(id);
    navigate({
      page: 'central-admin-panel',
      tab: id,
    });
  };

  const resetCategoryForm = () => {
    setEditingCatId(null);
    setCatName('');
    setCatDesc('');
    setCatIcon('Wrench');
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    const existing = editingCatId
      ? db.categories.find((c) => c.id === editingCatId)
      : undefined;
    const slug = catName
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-');

    const payload: Category = existing
      ? {
          ...existing,
          name: catName.trim(),
          description: catDesc.trim() || existing.description,
          iconName: catIcon,
        }
      : {
          id: `cat-${slug}-${Date.now().toString(36)}`,
          name: catName.trim(),
          slug,
          description: catDesc.trim() || `Servicios de ${catName.trim()} en OFI CLICK.`,
          iconName: catIcon,
          subcategories: [],
          specificFilters: [],
          active: true,
          sortOrder: db.categories.length + 1,
        };

    adminService.upsertCategory(payload, currentUser);
    resetCategoryForm();
    refreshDb();
    notify(
      existing ? 'Categoría actualizada.' : 'Categoría agregada al catálogo.',
      'success'
    );
  };

  const handleCreateRegion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim()) return;
    const slug = regName
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-');
    const colonias = regColoniasText
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
    const newRegion: Region = {
      id: `reg-${slug}-${Date.now().toString(36)}`,
      name: regName.trim(),
      state: regState.trim() || 'Estado de México',
      country: 'México',
      active: false,
      center: { lat: 19.65, lng: -99.21 },
      colonias: colonias.length > 0 ? colonias : ['Centro'],
    };
    adminService.upsertRegion(newRegion, currentUser);
    setRegName('');
    setRegColoniasText('');
    refreshDb();
    notify('Nueva región registrada en el sistema.', 'success');
  };

  return (
    <DashboardShell
      title={currentUser.fullName}
      subtitle="Alcance global · Todas las regiones"
      roleLabel="Administrador Central"
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={handleSelectTab}
    >
      {/* 1. Resumen */}
      {activeTab === 'resumen' && (
        <div className="space-y-6">
          <div className="p-4 rounded-xl border border-[#304B3E]/25 bg-[#304B3E]/8 dark:bg-[#304B3E]/25 text-xs flex flex-wrap items-center justify-between gap-2">
            <span>
              <strong>Control de alcance:</strong>{' '}
              Sesión de Administrador Central con visibilidad y control global multirregión.
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-4">
              <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">Usuarios en ámbito</p>
              <p className="font-mono-num text-2xl font-bold text-[#252A27] dark:text-[#F5F1E8] mt-1">{scopedProfiles.length}</p>
            </div>
            <div className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-4">
              <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">Freelancers registrados</p>
              <p className="font-mono-num text-2xl font-bold text-[#252A27] dark:text-[#F5F1E8] mt-1">{allScopedPros.length}</p>
            </div>
            <div className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-4">
              <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">Solicitudes registradas</p>
              <p className="font-mono-num text-2xl font-bold text-[#252A27] dark:text-[#F5F1E8] mt-1">{scopedRequests.length}</p>
            </div>
            <div className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-4">
              <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">Contrataciones activas/históricas</p>
              <p className="font-mono-num text-2xl font-bold text-[#252A27] dark:text-[#F5F1E8] mt-1">{scopedBookings.length}</p>
            </div>
          </div>

          <div className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-5 space-y-3">
            <h3 className="text-sm font-bold text-[#252A27] dark:text-[#F5F1E8]">Bitácora reciente de actividad administrativa</h3>
            {scopedAuditLogs.length === 0 ? (
              <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">Sin eventos registrados aún.</p>
            ) : (
              <div className="divide-y divide-[#DDD5C8] dark:divide-white/10 text-xs">
                {scopedAuditLogs.slice(0, 6).map((log) => (
                  <div key={log.id} className="py-2.5 flex flex-wrap justify-between gap-2">
                    <div>
                      <span className="font-semibold">{log.action}</span> · {log.targetEntity} (
                      {log.targetId}) — {log.reason}
                    </div>
                    <span className="text-[#73766F] dark:text-[#A3A89F]">
                      {log.actorName} · {formatDateMX(log.createdAt, true)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Usuarios */}
      {activeTab === 'usuarios' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[#304B3E]/25 bg-[#FFFCF7] dark:bg-[#222825] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2 text-[#252A27] dark:text-[#F5F1E8]">
                    <ShieldCheck className="w-4 h-4 text-[#B96F50]" />
                    Solicitudes de acceso administrativo
                  </h3>
                  <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">
                    Solo las solicitudes con correo verificado pueden ser autorizadas o rechazadas por Administración Central.
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded bg-[#304B3E]/10 dark:bg-[#75836A]/20 text-xs font-semibold text-[#304B3E] dark:text-[#EAE3D6]">
                  {db.adminAccessRequests.filter((r) => r.status === 'pending_authorization').length}{' '}
                  pendientes de autorización
                </span>
              </div>

              {db.adminAccessRequests.length === 0 ? (
                <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">
                  No hay solicitudes administrativas registradas en este momento.
                </p>
              ) : (
                <div className="space-y-3">
                  {db.adminAccessRequests.map((req) => {
                    const reqRegionName =
                      db.regions.find((r) => r.id === req.regionId)?.name || req.regionId;
                    return (
                      <div
                        key={req.id}
                        className="p-4 rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#EAE3D6]/45 dark:bg-[#1C211E] space-y-3 text-xs"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-sm text-[#252A27] dark:text-[#F5F1E8] flex flex-wrap items-center gap-2">
                              <span>{req.fullName}</span>
                              {req.emailVerified ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200 text-[11px] font-semibold">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Correo verificado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 text-[11px] font-semibold">
                                  <Clock className="w-3 h-3" />
                                  Falta confirmar código OTP
                                </span>
                              )}
                            </div>
                            <p className="text-[#73766F] mt-0.5">
                              {req.email} · Región solicitada: {reqRegionName} · Col. {req.colonia} ·{' '}
                              Rol solicitado: <strong>Administrador Central</strong>
                            </p>
                          </div>

                          <span
                            className={`px-2.5 py-1 rounded text-[11px] font-bold uppercase ${
                              req.status === 'authorized'
                                ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
                                : req.status === 'rejected'
                                ? 'bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200'
                                : req.status === 'pending_authorization'
                                ? 'bg-[#304B3E]/12 text-[#304B3E] dark:bg-[#75836A]/25 dark:text-[#EAE3D6]'
                                : 'bg-gray-200 text-gray-800 dark:bg-white/10 dark:text-gray-200'
                            }`}
                          >
                            {req.status === 'authorized'
                              ? 'Autorizada'
                              : req.status === 'rejected'
                              ? 'Rechazada'
                              : req.status === 'pending_authorization'
                              ? 'Pendiente de autorización'
                              : 'Correo pendiente'}
                          </span>
                        </div>

                        <p className="text-[#252A27]/85 dark:text-[#F5F1E8]/85">
                          <strong>Justificación:</strong> {req.justification}
                        </p>

                        {req.status === 'pending_authorization' && req.emailVerified && (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                adminService.reviewAdminAccessRequest({
                                  requestId: req.id,
                                  decision: 'authorized',
                                  assignedRole: 'central_admin',
                                  assignedRegionId: req.regionId,
                                  admin: currentUser,
                                  notes:
                                    reasonNote.trim() ||
                                    'Autorización central otorgada desde consola principal.',
                                });
                                refreshDb();
                                notify(
                                  `${req.fullName} autorizado como Administrador Central.`,
                                  'success'
                                );
                              }}
                              className="px-3 py-1.5 rounded-lg bg-[#304B3E] hover:bg-[#243A30] text-white font-semibold"
                            >
                              Autorizar Admin Central
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                adminService.reviewAdminAccessRequest({
                                  requestId: req.id,
                                  decision: 'rejected',
                                  admin: currentUser,
                                  notes:
                                    reasonNote.trim() ||
                                    'Solicitud rechazada por Administración Central.',
                                });
                                refreshDb();
                                notify(`Solicitud de ${req.fullName} rechazada.`, 'info');
                              }}
                              className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 dark:text-red-300 font-semibold"
                            >
                              Rechazar
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Buscar usuario por nombre, correo o colonia..."
            className="w-full px-4 py-2.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#222825] text-sm text-[#252A27] dark:text-[#F5F1E8]"
          />

          <div className="space-y-3">
            {scopedProfiles.map((u) => (
              <div
                key={u.id}
                className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-4 flex flex-wrap items-center justify-between gap-3 text-sm"
              >
                <div className="flex items-center gap-3">
                  <UserAvatar src={u.avatarUrl} name={u.fullName} sizeClass="w-10 h-10" />
                  <div>
                    <div className="font-bold flex items-center gap-2 text-[#252A27] dark:text-[#F5F1E8]">
                      <span>{u.fullName}</span>
                      {u.suspended && (
                        <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                          (Suspendida)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">
                      {u.email} · Col. {u.colonia} · Región: {u.regionId} · Roles:{' '}
                      {u.roles.join(', ')}
                    </p>
                  </div>
                </div>

                {u.id !== currentUser.id && !u.roles.includes('central_admin') && (
                  <button
                    type="button"
                    onClick={() => {
                      adminService.toggleUserSuspended(
                        u.id,
                        currentUser,
                        reasonNote.trim() || 'Revisión administrativa de cuenta.'
                      );
                      refreshDb();
                      notify(
                        u.suspended ? 'Cuenta reactivada.' : 'Cuenta suspendida.',
                        'info'
                      );
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${
                      u.suspended
                        ? 'bg-[#304B3E] text-white dark:bg-[#B96F50]'
                        : 'border border-red-300 text-red-700 dark:text-red-300'
                    }`}
                  >
                    {u.suspended ? 'Reactivar cuenta' : 'Suspender'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Clientes (Central Admin) */}
      {activeTab === 'clientes' && (
        <div className="space-y-4">
          <input
            type="text"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Buscar cliente por nombre, correo o colonia..."
            className="w-full px-4 py-2.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#222825] text-sm text-[#252A27] dark:text-[#F5F1E8]"
          />
          <div className="space-y-3">
            {scopedClients.map((client) => {
              const reqCount = db.requests.filter((r) => r.clientId === client.id).length;
              const bkCount = db.bookings.filter((b) => b.clientId === client.id).length;
              return (
                <div
                  key={client.id}
                  className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-4 flex flex-wrap items-center justify-between gap-3 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar src={client.avatarUrl} name={client.fullName} sizeClass="w-10 h-10" />
                    <div>
                      <div className="font-bold flex items-center gap-2 text-[#252A27] dark:text-[#F5F1E8]">
                        <span>{client.fullName}</span>
                        {client.suspended && (
                          <span className="text-xs text-red-600">(Suspendido)</span>
                        )}
                      </div>
                      <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">
                        {client.email} · Col. {client.colonia} · Solicitudes: {reqCount} ·
                        Contrataciones: {bkCount}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      adminService.toggleUserSuspended(
                        client.id,
                        currentUser,
                        'Gestión de cuenta cliente desde Administración Central.'
                      );
                      refreshDb();
                      notify(
                        client.suspended ? 'Cliente reactivado.' : 'Cliente suspendido.',
                        'info'
                      );
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${
                      client.suspended
                        ? 'bg-[#304B3E] text-white dark:bg-[#B96F50]'
                        : 'border border-red-300 text-red-700 dark:text-red-300'
                    }`}
                  >
                    {client.suspended ? 'Reactivar' : 'Suspender'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Freelancers (Central Admin) */}
      {activeTab === 'freelancers' && (
        <div className="space-y-4">
          <input
            type="text"
            value={proSearch}
            onChange={(e) => setProSearch(e.target.value)}
            placeholder="Buscar freelancer por nombre, marca personal o colonia..."
            className="w-full px-4 py-2.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#222825] text-sm text-[#252A27] dark:text-[#F5F1E8]"
          />
          <div className="space-y-3">
            {scopedPros.map((pro) => (
              <div
                key={pro.id}
                className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-4 flex flex-wrap items-center justify-between gap-3 text-sm"
              >
                <div>
                  <div className="font-bold flex items-center gap-2 text-[#252A27] dark:text-[#F5F1E8]">
                    <span>{pro.commercialName || pro.displayName}</span>
                    {pro.pausedByAdmin && (
                      <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                        (Pausado por admin)
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">
                    {pro.displayName} · Col. {pro.primaryColonia} · Nivel {pro.verificationLevel}/4
                    · {pro.ratingAvg.toFixed(1)} ★ ({pro.reviewsCount} reseñas) ·{' '}
                    {pro.completedJobsCount} trabajos
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewPro(pro)}
                    className="px-3 py-1.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 text-xs font-medium inline-flex items-center gap-1.5 text-[#252A27] dark:text-[#F5F1E8]"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Ver ficha
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      adminService.toggleProPaused(
                        pro.id,
                        currentUser,
                        reasonNote.trim() || 'Acción administrativa sobre freelancer.'
                      );
                      refreshDb();
                      notify('Estado de visibilidad del freelancer actualizado.', 'info');
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${
                      pro.pausedByAdmin
                        ? 'bg-[#304B3E] text-white dark:bg-[#B96F50]'
                        : 'border border-amber-400 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    {pro.pausedByAdmin ? 'Reactivar perfil' : 'Pausar perfil'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Verificaciones */}
      {activeTab === 'verificaciones' && (
        <div className="space-y-6">
          <div className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-[#252A27] dark:text-[#F5F1E8]">
                  Bandeja privada de revisión de identidad y credenciales (Nivel 4)
                </h3>
                <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">
                  Acceso estrictamente restringido a administradores autorizados. Compara la INE y la fotografía frontal de rostro antes de aprobar.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#304B3E]/10 dark:bg-white/10 text-[#304B3E] dark:text-[#B96F50] text-xs font-semibold">
                <Lock className="w-3.5 h-3.5" />
                Solo uso administrativo
              </span>
            </div>

            <input
              type="text"
              value={reasonNote}
              onChange={(e) => setReasonNote(e.target.value)}
              placeholder="Nota u observación de revisión / corrección / rechazo (se guarda en bitácora)..."
              className="w-full px-3.5 py-2 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#1C211E] text-xs text-[#252A27] dark:text-[#F5F1E8]"
            />

            {scopedVerifications.length === 0 ? (
              <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">No hay solicitudes de verificación en ámbito.</p>
            ) : (
              scopedVerifications.map((ver) => {
                const pro = db.professionals.find((p) => p.id === ver.professionalId);
                const ownerProfile = pro
                  ? db.profiles.find((p) => p.id === pro.profileId)
                  : undefined;
                const proDisplay = pro?.commercialName || pro?.displayName || ver.professionalId;
                const stage = getVerificationStageSummary([ver], pro?.verificationLevel || 0);

                return (
                  <div
                    key={ver.id}
                    className="p-4 sm:p-5 rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#EAE3D6]/45 dark:bg-[#1C211E] space-y-4 text-xs"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-sm text-[#252A27] dark:text-[#F5F1E8]">
                          {proDisplay}
                        </div>
                        <p className="text-[#73766F] dark:text-[#A3A89F]">
                          Titular: {ownerProfile?.fullName || pro?.displayName || 'Freelancer'} ·
                          Col. {pro?.primaryColonia || ownerProfile?.colonia || 'N/A'} · Nivel actual:{' '}
                          {pro?.verificationLevel ?? 0}/4 · Solicitud: {formatDateMX(ver.createdAt, true)}
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg font-bold ${stage.badgeClass}`}>
                        {stage.label}
                      </span>
                    </div>

                    {/* Visual Inspection Grid for INE + Frontal Face Photo */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {ver.documents.map((doc) => {
                        const resolved = privateMediaStore.resolveDocumentPreview(doc);
                        const isFace = doc.docKind === 'frontal_face';
                        const isRealPdf =
                          doc.mimeType === 'application/pdf' && resolved.inSessionMemory;

                        return (
                          <div
                            key={doc.id}
                            className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-3 flex flex-col gap-2.5"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-[#304B3E] dark:text-[#B96F50]">
                                {isFace
                                  ? 'Fotografía frontal de rostro'
                                  : doc.docKind === 'ine'
                                  ? 'Identificación oficial (INE)'
                                  : doc.label}
                              </span>
                              {resolved.isDemo && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 text-[10px] font-bold">
                                  DEMO
                                </span>
                              )}
                            </div>

                            <div className="relative h-40 rounded-lg overflow-hidden bg-[#EAE3D6]/50 dark:bg-[#171B19] border border-[#DDD5C8] dark:border-white/10 flex items-center justify-center">
                              {isRealPdf ? (
                                <div className="text-center p-3">
                                  <p className="font-bold text-sm">Documento PDF adjunto</p>
                                  <p className="text-[11px] text-[#73766F] dark:text-[#A3A89F] mt-1">{doc.fileName}</p>
                                </div>
                              ) : (
                                <img
                                  src={resolved.url}
                                  alt={`${doc.label} - ${proDisplay}`}
                                  className="w-full h-full object-contain"
                                />
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium truncate">{doc.fileName}</p>
                                <p className="text-[11px] text-[#73766F] dark:text-[#A3A89F]">
                                  {doc.mimeType || 'image/jpeg'}
                                  {doc.sizeBytes ? ` · ${formatFileSize(doc.sizeBytes)}` : ''}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setInspectingDoc({
                                    proName: proDisplay,
                                    label: doc.label,
                                    fileName: doc.fileName,
                                    mimeType: doc.mimeType || 'image/jpeg',
                                    sizeBytes: doc.sizeBytes,
                                    previewUrl: resolved.url,
                                    isDemo: resolved.isDemo,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 font-semibold shrink-0 hover:bg-[#EAE3D6]/60 dark:hover:bg-[#1C211E]"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Ampliar
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {ver.reviewReason && (
                      <div className="p-2.5 rounded-lg bg-[#FFFCF7] dark:bg-[#222825] text-xs">
                        <strong>Última observación:</strong> {ver.reviewReason}
                      </div>
                    )}

                    {ver.history && ver.history.length > 0 && (
                      <div className="space-y-1 text-[11px] text-[#73766F] dark:text-[#A3A89F]">
                        <p className="font-semibold text-[#252A27] dark:text-[#F5F1E8]">
                          Historial de revisión:
                        </p>
                        {ver.history.map((h, idx) => (
                          <div key={`${ver.id}-h-${idx}`}>
                            • {formatDateMX(h.date, true)} — <strong>{h.status}</strong>: {h.note}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          adminService.reviewVerification({
                            verificationId: ver.id,
                            status: 'in_review',
                            reason:
                              reasonNote.trim() ||
                              'Documentación tomada para verificación manual.',
                            adminId: currentUser.id,
                            adminName: currentUser.fullName,
                            adminRole: currentUser.primaryRole,
                          });
                          setReasonNote('');
                          refreshDb();
                          notify('Solicitud marcada En revisión.', 'info');
                        }}
                        className="px-3 py-1.5 rounded-lg border border-[#304B3E]/40 text-[#304B3E] dark:text-[#B96F50] font-semibold"
                      >
                        Marcar en revisión
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          adminService.reviewVerification({
                            verificationId: ver.id,
                            status: 'approved',
                            reason:
                              reasonNote.trim() ||
                              'INE y fotografía frontal validados correctamente.',
                            adminId: currentUser.id,
                            adminName: currentUser.fullName,
                            adminRole: currentUser.primaryRole,
                          });
                          setReasonNote('');
                          refreshDb();
                          notify('Verificación aprobada y nivel actualizado.', 'success');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#304B3E] hover:bg-[#243A30] text-white font-semibold transition-colors"
                      >
                        Aprobar credenciales
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          adminService.reviewVerification({
                            verificationId: ver.id,
                            status: 'corrections_needed',
                            reason:
                              reasonNote.trim() ||
                              'Solicitar fotografía frontal o INE más legible.',
                            adminId: currentUser.id,
                            adminName: currentUser.fullName,
                            adminRole: currentUser.primaryRole,
                          });
                          setReasonNote('');
                          refreshDb();
                          notify('Corrección solicitada al freelancer.', 'info');
                        }}
                        className="px-3 py-1.5 rounded-lg border border-amber-400 text-amber-800 dark:text-amber-300 font-semibold"
                      >
                        Pedir correcciones
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          adminService.reviewVerification({
                            verificationId: ver.id,
                            status: 'rejected',
                            reason:
                              reasonNote.trim() ||
                              'Documentación o fotografía frontal no coincide con el titular.',
                            adminId: currentUser.id,
                            adminName: currentUser.fullName,
                            adminRole: currentUser.primaryRole,
                          });
                          setReasonNote('');
                          refreshDb();
                          notify('Verificación rechazada.', 'info');
                        }}
                        className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 dark:text-red-300 font-semibold"
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 6. Categorías (Central Admin only) */}
      {activeTab === 'categorias' && (
        <div className="space-y-6">
          <form
            onSubmit={handleSaveCategory}
            className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-[#252A27] dark:text-[#F5F1E8]">
                {editingCatId
                  ? 'Editar categoría de servicio'
                  : 'Crear nueva categoría de servicio'}
              </h3>
              {editingCatId && (
                <button
                  type="button"
                  onClick={resetCategoryForm}
                  className="text-xs text-[#73766F] dark:text-[#A3A89F] hover:underline"
                >
                  Cancelar edición
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="Nombre (ej. Energía Solar)"
                className="px-3 py-2 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#1C211E] text-sm text-[#252A27] dark:text-[#F5F1E8]"
                required
              />
              <input
                type="text"
                value={catDesc}
                onChange={(e) => setCatDesc(e.target.value)}
                placeholder="Descripción breve"
                className="px-3 py-2 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#1C211E] text-sm text-[#252A27] dark:text-[#F5F1E8]"
              />
              <select
                value={catIcon}
                onChange={(e) => setCatIcon(e.target.value)}
                className="px-3 py-2 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#1C211E] text-sm text-[#252A27] dark:text-[#F5F1E8]"
              >
                <option value="Wrench">Herramienta</option>
                <option value="Zap">Electricidad</option>
                <option value="Droplets">Plomería</option>
                <option value="Hammer">Construcción</option>
                <option value="Laptop">Tecnología</option>
                <option value="Paintbrush">Pintura</option>
              </select>
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#304B3E] hover:bg-[#243A30] text-white dark:bg-[#B96F50] dark:hover:bg-[#a65e41] dark:text-[#FFFCF7] text-xs font-semibold transition-colors"
            >
              {editingCatId ? 'Guardar cambios' : 'Agregar categoría'}
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {db.categories.map((cat) => (
              <div
                key={cat.id}
                className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-4 space-y-3 text-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-bold text-[#252A27] dark:text-[#F5F1E8]">{cat.name}</span>
                    <p className="text-xs text-[#73766F] dark:text-[#A3A89F] mt-0.5">{cat.description}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCatId(cat.id);
                        setCatName(cat.name);
                        setCatDesc(cat.description);
                        setCatIcon(cat.iconName);
                      }}
                      className="text-xs font-medium text-[#304B3E] dark:text-[#B96F50] hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        adminService.toggleCategoryActive(cat.id, currentUser);
                        refreshDb();
                      }}
                      className={`px-3 py-1 rounded text-xs font-semibold ${
                        cat.active
                          ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {cat.active ? 'Activa' : 'Inactiva'}
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#DDD5C8] dark:border-white/10 space-y-2 text-xs">
                  <div className="flex flex-wrap gap-1.5">
                    {cat.subcategories.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => {
                          adminService.upsertCategory(
                            {
                              ...cat,
                              subcategories: cat.subcategories.map((s) =>
                                s.id === sub.id ? { ...s, active: !s.active } : s
                              ),
                            },
                            currentUser
                          );
                          refreshDb();
                        }}
                        className={`px-2 py-0.5 rounded border text-[11px] ${
                          sub.active
                            ? 'bg-[#EAE3D6]/70 dark:bg-[#1C211E] border-[#DDD5C8] dark:border-white/12'
                            : 'opacity-50 line-through border-dashed'
                        }`}
                      >
                        {sub.name}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={subcatInputMap[cat.id] || ''}
                      onChange={(e) =>
                        setSubcatInputMap((prev) => ({ ...prev, [cat.id]: e.target.value }))
                      }
                      placeholder="Nueva subcategoría..."
                      className="flex-1 px-2.5 py-1 rounded border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#1C211E] text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const name = subcatInputMap[cat.id]?.trim();
                        if (!name) return;
                        adminService.upsertCategory(
                          {
                            ...cat,
                            subcategories: [
                              ...cat.subcategories,
                              {
                                id: `sub-${Date.now().toString(36)}`,
                                categoryId: cat.id,
                                name,
                                active: true,
                              },
                            ],
                          },
                          currentUser
                        );
                        setSubcatInputMap((prev) => ({ ...prev, [cat.id]: '' }));
                        refreshDb();
                        notify('Subcategoría agregada.', 'success');
                      }}
                      className="px-2.5 py-1 rounded bg-[#304B3E] text-white dark:bg-[#B96F50] dark:text-[#FFFCF7] text-xs font-semibold"
                    >
                      + Subcategoría
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. Solicitudes */}
      {activeTab === 'solicitudes' && (
        <div className="space-y-4">
          <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">
            Solicitudes de servicio registradas ({scopedRequests.length}).
          </p>
          {scopedRequests.length === 0 ? (
            <div className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-8 text-center text-sm text-[#73766F] dark:text-[#A3A89F]">
              No hay solicitudes registradas en este ámbito.
            </div>
          ) : (
            scopedRequests.map((req) => {
              const client = db.profiles.find((p) => p.id === req.clientId);
              const cat = db.categories.find((c) => c.id === req.categoryId);
              return (
                <div
                  key={req.id}
                  className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-4 flex flex-wrap items-center justify-between gap-3 text-sm"
                >
                  <div>
                    <div className="text-xs font-semibold uppercase text-[#304B3E] dark:text-[#B96F50]">
                      {cat?.name || 'Servicio'} · Col. {req.colonia} · Estado: {req.status}
                    </div>
                    <h4 className="font-bold text-[#252A27] dark:text-[#F5F1E8]">{req.title}</h4>
                    <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">
                      Cliente: {client?.fullName || 'Cliente'} · Fecha deseada: {req.desiredDate} ·
                      Freelancers invitados: {req.recipientProfessionalIds.length}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#73766F] dark:text-[#A3A89F]">
                    {formatDateMX(req.createdAt)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 8. Contrataciones */}
      {activeTab === 'contrataciones' && (
        <div className="space-y-4">
          <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">
            Inspección administrativa de contrataciones dentro de tu ámbito ({scopedBookings.length}).
          </p>
          {scopedBookings.length === 0 ? (
            <div className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-8 text-center text-sm text-[#73766F] dark:text-[#A3A89F]">
              No hay contrataciones registradas en este ámbito.
            </div>
          ) : (
            scopedBookings.map((b) => (
              <div
                key={b.id}
                className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-4 flex flex-wrap items-center justify-between gap-3 text-sm"
              >
                <div>
                  <div className="text-xs font-semibold uppercase text-[#304B3E] dark:text-[#B96F50]">
                    {b.status} · Col. {b.colonia} · Región: {b.regionId}
                  </div>
                  <h4 className="font-bold text-[#252A27] dark:text-[#F5F1E8]">{b.serviceTitle}</h4>
                  <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">
                    Cita: {b.scheduledDate} {b.scheduledTime} · Monto acordado:{' '}
                    <span className="font-mono-num">{formatMXN(b.agreedAmountMxn)}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    adminService.logAdminAudit({
                      actorId: currentUser.id,
                      actorName: currentUser.fullName,
                      actorRole: currentUser.primaryRole,
                      regionId: b.regionId,
                      action: 'INSPECT_BOOKING',
                      targetEntity: 'booking',
                      targetId: b.id,
                      reason: 'Inspección operativa administrativa.',
                    });
                    refreshDb();
                    notify('Inspección registrada en bitácora de auditoría.', 'info');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 text-xs font-medium text-[#252A27] dark:text-[#F5F1E8]"
                >
                  Registrar inspección
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* 9. Moderación */}
      {activeTab === 'moderacion' && (
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-base font-bold text-[#252A27] dark:text-[#F5F1E8]">Reportes de moderación ({scopedReports.length})</h3>
            {scopedReports.map((rep) => (
              <div
                key={rep.id}
                className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-4 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase text-[#304B3E] dark:text-[#B96F50]">
                    {rep.targetType} · Estado: {rep.status}
                  </span>
                  <span className="text-[#73766F] dark:text-[#A3A89F]">{formatDateMX(rep.createdAt, true)}</span>
                </div>
                <p className="text-sm text-[#252A27] dark:text-[#F5F1E8]">{rep.reason}</p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { s: 'investigating', label: 'En revisión' },
                      { s: 'resolved', label: 'Marcar resuelto' },
                      { s: 'dismissed', label: 'Desestimar' },
                    ] as { s: ModerationReport['status']; label: string }[]
                  ).map((btn) => (
                    <button
                      key={btn.s}
                      type="button"
                      onClick={() => {
                        adminService.moderateReport(
                          rep.id,
                          btn.s,
                          currentUser,
                          `Actualizado a ${btn.s}`
                        );
                        refreshDb();
                        notify('Reporte actualizado.', 'success');
                      }}
                      className="px-3 py-1.5 rounded border border-[#DDD5C8] dark:border-white/15 font-medium"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <h3 className="text-base font-bold text-[#252A27] dark:text-[#F5F1E8]">
              Moderación de reseñas en ámbito ({scopedReviews.length})
            </h3>
            {scopedReviews.map((rev) => (
              <div
                key={rev.id}
                className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-4 flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div>
                  <span className="font-bold text-sm text-[#252A27] dark:text-[#F5F1E8]">
                    {rev.clientName} ({rev.rating}/5)
                  </span>{' '}
                  · {rev.serviceName}
                  <p className="text-[#73766F] dark:text-[#A3A89F] mt-0.5">{rev.comment}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    adminService.toggleReviewHidden(
                      rev.id,
                      currentUser,
                      'Moderación de contenido en reseña.'
                    );
                    refreshDb();
                    notify(
                      rev.hiddenByAdmin ? 'Reseña restaurada.' : 'Reseña ocultada.',
                      'info'
                    );
                  }}
                  className="px-3 py-1.5 rounded border border-[#DDD5C8] dark:border-white/20 font-semibold"
                >
                  {rev.hiddenByAdmin ? 'Restaurar reseña' : 'Ocultar reseña'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 10. Reportes (Central Admin dedicated queue) */}
      {activeTab === 'reportes' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-bold text-[#252A27] dark:text-[#F5F1E8]">Centro global de reportes</h3>
            <select
              value={reportFilter}
              onChange={(e) => setReportFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#222825] text-xs"
            >
              <option value="all">Todos</option>
              <option value="open">Abiertos</option>
              <option value="investigating">En revisión</option>
              <option value="resolved">Resueltos</option>
              <option value="dismissed">Desestimados</option>
            </select>
          </div>
          {scopedReports
            .filter((r) => reportFilter === 'all' || r.status === reportFilter)
            .map((rep) => (
              <div
                key={rep.id}
                className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-4 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase text-[#304B3E] dark:text-[#B96F50]">
                    {rep.targetType} · Región {rep.regionId} · Estado: {rep.status}
                  </span>
                  <span className="text-[#73766F] dark:text-[#A3A89F]">{formatDateMX(rep.createdAt, true)}</span>
                </div>
                <p className="text-sm text-[#252A27] dark:text-[#F5F1E8]">{rep.reason}</p>
                {rep.adminNotes && <p className="text-[#73766F] dark:text-[#A3A89F]">Nota: {rep.adminNotes}</p>}
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { s: 'investigating', label: 'Investigar' },
                      { s: 'resolved', label: 'Resolver' },
                      { s: 'dismissed', label: 'Desestimar' },
                    ] as { s: ModerationReport['status']; label: string }[]
                  ).map((btn) => (
                    <button
                      key={btn.s}
                      type="button"
                      onClick={() => {
                        adminService.moderateReport(
                          rep.id,
                          btn.s,
                          currentUser,
                          reasonNote.trim() || `Estado actualizado a ${btn.s}`
                        );
                        refreshDb();
                        notify('Reporte actualizado.', 'success');
                      }}
                      className="px-3 py-1.5 rounded border border-[#DDD5C8] dark:border-white/15 font-medium"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* 11. Soporte */}
      {activeTab === 'soporte' && (
        <div className="space-y-4">
          {scopedTickets.length === 0 ? (
            <div className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-8 text-center text-sm text-[#73766F] dark:text-[#A3A89F]">
              No hay tickets de soporte en este ámbito.
            </div>
          ) : (
            scopedTickets.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-4 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm text-[#252A27] dark:text-[#F5F1E8]">{t.subject}</span>
                  <span className="uppercase font-semibold text-[#304B3E] dark:text-[#B96F50]">
                    {t.status} · Prioridad {t.priority}
                  </span>
                </div>
                <p className="text-[#73766F] dark:text-[#A3A89F]">
                  Creado por {t.creatorName} (Región {t.regionId}): {t.description}
                </p>
                {t.evidenceNote && (
                  <p className="p-2.5 rounded-lg bg-[#EAE3D6]/60 dark:bg-[#1C211E]">
                    <strong>Última respuesta:</strong> {t.evidenceNote}
                  </p>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={ticketReplyMap[t.id] || ''}
                    onChange={(e) =>
                      setTicketReplyMap((prev) => ({ ...prev, [t.id]: e.target.value }))
                    }
                    placeholder="Escribir respuesta o nota de seguimiento..."
                    className="flex-1 px-3 py-1.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#1C211E] text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const reply = ticketReplyMap[t.id]?.trim();
                      if (!reply) return;
                      adminService.replyToTicket(t.id, reply, 'in_progress', currentUser);
                      setTicketReplyMap((prev) => ({ ...prev, [t.id]: '' }));
                      refreshDb();
                      notify('Respuesta enviada y registrada.', 'success');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#304B3E] hover:bg-[#243A30] text-white dark:bg-[#B96F50] dark:hover:bg-[#a65e41] dark:text-[#FFFCF7] font-semibold transition-colors"
                  >
                    Responder
                  </button>
                </div>
                <div className="flex gap-2">
                  {(['open', 'in_progress', 'closed'] as SupportTicket['status'][]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        adminService.updateTicketStatus(t.id, st, currentUser);
                        refreshDb();
                        notify(`Ticket actualizado a ${st}.`, 'success');
                      }}
                      className="px-3 py-1 rounded border border-[#DDD5C8] dark:border-white/15"
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 12. Regiones (Central Admin only) */}
      {activeTab === 'regiones' && (
        <div className="space-y-6">
          <form
            onSubmit={handleCreateRegion}
            className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-5 space-y-3"
          >
            <h3 className="text-base font-bold flex items-center gap-2 text-[#252A27] dark:text-[#F5F1E8]">
              <Plus className="w-4 h-4 text-[#B96F50]" />
              Registrar nueva región operativa
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Municipio o zona (ej. Naucalpan)"
                className="px-3 py-2 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#1C211E] text-sm"
                required
              />
              <input
                type="text"
                value={regState}
                onChange={(e) => setRegState(e.target.value)}
                placeholder="Estado (ej. Estado de México)"
                className="px-3 py-2 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#1C211E] text-sm"
                required
              />
              <input
                type="text"
                value={regColoniasText}
                onChange={(e) => setRegColoniasText(e.target.value)}
                placeholder="Colonias iniciales separadas por coma"
                className="px-3 py-2 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#1C211E] text-sm"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#304B3E] hover:bg-[#243A30] text-white dark:bg-[#B96F50] dark:hover:bg-[#a65e41] dark:text-[#FFFCF7] text-xs font-semibold transition-colors"
            >
              Crear región
            </button>
          </form>

          <div className="space-y-4">
            {db.regions.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-5 space-y-3 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-base text-[#252A27] dark:text-[#F5F1E8]">
                      {r.name}, {r.state}
                    </span>
                    <p className="text-[#73766F] dark:text-[#A3A89F]">
                      {r.colonias.length} colonias configuradas · ID: {r.id}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      adminService.toggleRegionActive(r.id, currentUser);
                      refreshDb();
                      notify(
                        r.active ? 'Región marcada como inactiva.' : 'Región activada.',
                        'success'
                      );
                    }}
                    className={`px-3 py-1.5 rounded-lg font-semibold ${
                      r.active
                        ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    {r.active ? 'Operación activa' : 'Próximamente (Inactiva)'}
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {r.colonias.map((col) => (
                    <span
                      key={col}
                      className="px-2 py-0.5 rounded bg-[#EAE3D6]/70 dark:bg-[#1C211E] border border-[#DDD5C8] dark:border-white/12"
                    >
                      {col}
                    </span>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newColoniaMap[r.id] || ''}
                    onChange={(e) =>
                      setNewColoniaMap((prev) => ({ ...prev, [r.id]: e.target.value }))
                    }
                    placeholder="Agregar colonia a esta región..."
                    className="flex-1 px-3 py-1.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#1C211E] text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const col = newColoniaMap[r.id]?.trim();
                      if (!col) return;
                      if (r.colonias.includes(col)) return;
                      adminService.upsertRegion(
                        { ...r, colonias: [...r.colonias, col] },
                        currentUser
                      );
                      setNewColoniaMap((prev) => ({ ...prev, [r.id]: '' }));
                      refreshDb();
                      notify('Colonia agregada a la región.', 'success');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#304B3E] hover:bg-[#243A30] text-white font-semibold transition-colors"
                  >
                    + Colonia
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 13. Seguridad (Central Admin only) */}
      {activeTab === 'seguridad' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-4">
              <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">Cuentas suspendidas</p>
              <p className="font-mono-num text-2xl font-bold text-[#252A27] dark:text-[#F5F1E8] mt-1">
                {db.profiles.filter((p) => p.suspended).length}
              </p>
            </div>
            <div className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-4">
              <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">Freelancers pausados</p>
              <p className="font-mono-num text-2xl font-bold text-[#252A27] dark:text-[#F5F1E8] mt-1">
                {db.professionals.filter((p) => p.pausedByAdmin).length}
              </p>
            </div>
            <div className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-4">
              <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">Correos sin confirmar</p>
              <p className="font-mono-num text-2xl font-bold text-[#252A27] dark:text-[#F5F1E8] mt-1">
                {db.profiles.filter((p) => !p.emailConfirmed).length}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-5 space-y-3 text-xs">
            <h3 className="text-base font-bold text-[#252A27] dark:text-[#F5F1E8]">Cuentas con privilegios administrativos</h3>
            {db.profiles
              .filter((p) => p.roles.includes('central_admin'))
              .map((adm) => (
                <div
                  key={adm.id}
                  className="p-3 rounded-lg bg-[#EAE3D6]/50 dark:bg-[#1C211E] flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-sm">{adm.fullName}</span>
                    <p className="text-[#73766F] dark:text-[#A3A89F]">
                      {adm.email} · Región: {adm.regionId}
                    </p>
                  </div>
                  <span className="font-semibold uppercase text-[#304B3E] dark:text-[#75836A]">
                    {adm.primaryRole}
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 14. Auditoría (Central Admin only) */}
      {activeTab === 'auditoria' && (
        <div className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-5 space-y-2">
          <h3 className="text-base font-bold text-[#252A27] dark:text-[#F5F1E8]">Historial completo de auditoría global</h3>
          {scopedAuditLogs.length === 0 ? (
            <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">No hay eventos de auditoría todavía.</p>
          ) : (
            scopedAuditLogs.map((log) => (
              <div
                key={log.id}
                className="py-2 border-b border-[#DDD5C8] dark:border-white/10 text-xs flex flex-wrap justify-between gap-2"
              >
                <div>
                  <strong>{log.action}</strong> ({log.targetEntity} #{log.targetId}) ·{' '}
                  {log.reason}
                </div>
                <span className="text-[#73766F] dark:text-[#A3A89F]">
                  {log.actorName} ({log.actorRole}) · {log.regionId} ·{' '}
                  {formatDateMX(log.createdAt, true)}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* 15. Notificaciones */}
      {activeTab === 'notificaciones' && (
        <div className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#252A27] dark:text-[#F5F1E8]">Notificaciones administrativas</h3>
            {unreadNotifs > 0 && (
              <button
                type="button"
                onClick={() => {
                  notificationsService.markAllRead(currentUser.id);
                  refreshDb();
                }}
                className="text-xs font-semibold text-[#304B3E] dark:text-[#B96F50] hover:underline"
              >
                Marcar leídas
              </button>
            )}
          </div>
          {myNotifications.length === 0 ? (
            <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">Sin notificaciones administrativas pendientes.</p>
          ) : (
            myNotifications.map((n) => (
              <div
                key={n.id}
                className="py-2.5 border-b border-[#DDD5C8] dark:border-white/10 text-xs flex justify-between gap-2"
              >
                <div>
                  <p className="font-semibold text-sm text-[#252A27] dark:text-[#F5F1E8]">{n.title}</p>
                  <p className="text-[#73766F] dark:text-[#A3A89F]">{n.body}</p>
                </div>
                <span className="text-[#73766F] dark:text-[#A3A89F] whitespace-nowrap">
                  {formatDateMX(n.createdAt, true)}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* 16. Configuración */}
      {activeTab === 'configuracion' && (
        <div className="space-y-5 max-w-2xl">
          <div className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-6 space-y-3">
            <h3 className="text-base font-bold text-[#252A27] dark:text-[#F5F1E8]">Apariencia del panel</h3>
            <div className="grid grid-cols-3 gap-3">
              {(['light', 'dark', 'system'] as ThemePreference[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setTheme(opt)}
                  className={`py-2 rounded-lg border text-xs font-semibold transition-colors ${
                    theme === opt
                      ? 'bg-[#304B3E] text-white border-[#304B3E] dark:bg-[#B96F50] dark:border-[#B96F50] dark:text-[#FFFCF7]'
                      : 'border-[#DDD5C8] dark:border-white/15 text-[#252A27] dark:text-[#F5F1E8]'
                  }`}
                >
                  {opt === 'light' ? 'Claro' : opt === 'dark' ? 'Oscuro' : 'Sistema'}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-6 space-y-3 text-xs">
            <h3 className="text-base font-bold text-[#252A27] dark:text-[#F5F1E8]">Sesión administrativa</h3>
            <p className="text-[#73766F] dark:text-[#A3A89F]">
              Cuenta activa: <strong>{currentUser.email}</strong> · Rol:{' '}
              <strong>Administrador Central</strong>
            </p>
            <button
              type="button"
              onClick={signOut}
              className="px-4 py-2 rounded-lg border border-red-300 text-red-700 dark:text-red-300 text-xs font-semibold"
            >
              Cerrar sesión administrativa
            </button>
          </div>
        </div>
      )}

      {/* 17. Estadísticas globales (Central Admin only) */}
      {activeTab === 'estadisticas' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-4">
              <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">Regiones activas</p>
              <p className="font-mono-num text-2xl font-bold text-[#252A27] dark:text-[#F5F1E8] mt-1">
                {db.regions.filter((r) => r.active).length} / {db.regions.length}
              </p>
            </div>
            <div className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-4">
              <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">Categorías activas</p>
              <p className="font-mono-num text-2xl font-bold text-[#252A27] dark:text-[#F5F1E8] mt-1">
                {db.categories.filter((c) => c.active).length} / {db.categories.length}
              </p>
            </div>
            <div className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-4">
              <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">Cotizaciones aceptadas</p>
              <p className="font-mono-num text-2xl font-bold text-[#252A27] dark:text-[#F5F1E8] mt-1">
                {db.quotes.filter((q) => q.status === 'accepted').length} / {db.quotes.length}
              </p>
            </div>
            <div className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-4">
              <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">Servicios completados</p>
              <p className="font-mono-num text-2xl font-bold text-[#252A27] dark:text-[#F5F1E8] mt-1">
                {db.bookings.filter((b) => b.status === 'completed').length} / {db.bookings.length}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-5 space-y-3 text-xs">
            <h3 className="text-base font-bold text-[#252A27] dark:text-[#F5F1E8]">Distribución por categoría</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {db.categories.map((cat) => {
                const prosInCat = db.professionals.filter((p) =>
                  p.categoryIds.includes(cat.id)
                ).length;
                const reqsInCat = db.requests.filter((r) => r.categoryId === cat.id).length;
                return (
                  <div
                    key={cat.id}
                    className="p-3 rounded-lg bg-[#EAE3D6]/55 dark:bg-[#1C211E] flex items-center justify-between"
                  >
                    <span className="font-semibold text-[#252A27] dark:text-[#F5F1E8]">{cat.name}</span>
                    <span className="text-[#73766F] dark:text-[#A3A89F]">
                      {prosInCat} freelancers · {reqsInCat} solicitudes
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal privado para inspeccionar documento ampliado */}
      {inspectingDoc && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Inspección privada: ${inspectingDoc.label}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
          onClick={() => setInspectingDoc(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-[#FFFCF7] dark:bg-[#222825] border border-[#DDD5C8] dark:border-white/15 overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-[#DDD5C8] dark:border-white/10 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase text-[#304B3E] dark:text-[#B96F50]">
                  Revisión privada · {inspectingDoc.proName}
                  {inspectingDoc.isDemo ? ' · DEMO' : ''}
                </p>
                <h4 className="font-bold text-sm truncate text-[#252A27] dark:text-[#F5F1E8]">{inspectingDoc.label}</h4>
              </div>
              <button
                type="button"
                onClick={() => setInspectingDoc(null)}
                aria-label="Cerrar vista ampliada"
                className="p-1.5 rounded-lg border border-[#DDD5C8] dark:border-white/15"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-[#171B19] flex items-center justify-center p-4 max-h-[65vh]">
              {inspectingDoc.mimeType === 'application/pdf' && !inspectingDoc.isDemo ? (
                <iframe
                  src={inspectingDoc.previewUrl}
                  title={inspectingDoc.fileName}
                  className="w-full h-[55vh] rounded bg-white"
                />
              ) : (
                <img
                  src={inspectingDoc.previewUrl}
                  alt={inspectingDoc.label}
                  className="max-w-full max-h-[58vh] object-contain rounded"
                />
              )}
            </div>
            <div className="px-5 py-3 text-xs text-[#73766F] dark:text-[#A3A89F] flex flex-wrap items-center justify-between gap-2">
              <span>
                Archivo: <strong>{inspectingDoc.fileName}</strong>
              </span>
              <span>
                {inspectingDoc.mimeType}
                {inspectingDoc.sizeBytes ? ` · ${formatFileSize(inspectingDoc.sizeBytes)}` : ''}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Modal in-panel de ficha resumida de freelancer */}
      {previewPro && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Ficha de ${previewPro.commercialName || previewPro.displayName}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
          onClick={() => setPreviewPro(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-[#FFFCF7] dark:bg-[#222825] border border-[#DDD5C8] dark:border-white/15 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-[#DDD5C8] dark:border-white/10 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase text-[#304B3E] dark:text-[#B96F50]">
                  Ficha interna de freelancer
                </p>
                <h4 className="font-bold text-sm text-[#252A27] dark:text-[#F5F1E8]">
                  {previewPro.commercialName || previewPro.displayName}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setPreviewPro(null)}
                aria-label="Cerrar ficha"
                className="p-1.5 rounded-lg border border-[#DDD5C8] dark:border-white/15"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="flex items-center gap-3">
                <UserAvatar
                  src={getPublicProAvatar(previewPro)}
                  name={previewPro.displayName}
                  sizeClass="w-12 h-12"
                />
                <div>
                  <p className="font-bold text-sm text-[#252A27] dark:text-[#F5F1E8]">{previewPro.displayName}</p>
                  <p className="text-[#73766F] dark:text-[#A3A89F] flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#B96F50]" />
                    Col. {previewPro.primaryColonia} · Nivel {previewPro.verificationLevel}/4 ·{' '}
                    {previewPro.ratingAvg.toFixed(1)} ★ ({previewPro.reviewsCount} reseñas)
                  </p>
                </div>
              </div>
              <p className="text-[#252A27]/85 dark:text-[#F5F1E8]/85 leading-relaxed">
                {previewPro.bio}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {previewPro.specialties.map((s) => (
                  <span
                    key={s}
                    className="px-2 py-0.5 rounded bg-[#EAE3D6] dark:bg-white/10 font-medium"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
};
