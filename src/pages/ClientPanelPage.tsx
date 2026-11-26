import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Bell,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  Compass,
  FileText,
  Heart,
  HelpCircle,
  Home,
  MessageSquare,
  Search,
  Settings,
  ShieldCheck,
  Star,
  Trash2,
  User,
} from 'lucide-react';
import { useOfiClick } from '../context/OfiClickContext';
import { ALL_IZCALLI_COLONIAS } from '../data/izcalliLocations';
import { DashboardShell, type DashboardNavItem } from '../components/workspace/DashboardShell';
import { BookingCard } from '../components/workspace/BookingCard';
import { BookingDetailModal } from '../components/workspace/BookingDetailModal';
import { ChatWorkspace } from '../components/workspace/ChatWorkspace';
import { ProfessionalCard } from '../components/ProfessionalCard';
import { ExplorePage } from './ExplorePage';
import { quotesService } from '../services/quotes.service';
import { requestsService } from '../services/requests.service';
import { messagesService } from '../services/messages.service';
import { notificationsService } from '../services/notifications.service';
import { profilesService } from '../services/profiles.service';
import { reviewsService } from '../services/reviews.service';
import { authService } from '../services/auth.service';
import { adminService } from '../services/admin.service';
import {
  canAccessWorkspaceRoute,
  canUserLeaveReview,
  formatDateMX,
  formatMXN,
} from '../utils/marketplace';
import { STORAGE_BUCKETS, getPublicProAvatar } from '../utils/media';
import { PhotoUploadBox } from '../components/media/PhotoUploadBox';
import { UserAvatar } from '../components/UserAvatar';
import type { Booking, ThemePreference } from '../types/oficlick';

interface ClientPanelPageProps {
  initialTab?: string;
}

export const ClientPanelPage: React.FC<ClientPanelPageProps> = ({ initialTab = 'inicio' }) => {
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
  const [activeConvId, setActiveConvId] = useState<string | undefined>(undefined);

  // Filters for Solicitudes & Servicios contratados
  const [reqFilterQuery, setReqFilterQuery] = useState('');
  const [reqFilterStatus, setReqFilterStatus] = useState<string>('all');
  const [bkFilterQuery, setBkFilterQuery] = useState('');
  const [bkFilterStatus, setBkFilterStatus] = useState<string>('all');
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  // Inline review drafting state per bookingId
  const [reviewRatingMap, setReviewRatingMap] = useState<Record<string, 1 | 2 | 3 | 4 | 5>>({});
  const [reviewCommentMap, setReviewCommentMap] = useState<Record<string, string>>({});

  // Profile edit state
  const [fullName, setFullName] = useState(currentUser?.fullName || '');
  const [colonia, setColonia] = useState(currentUser?.colonia || 'Centro Urbano');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(currentUser?.avatarUrl);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Support ticket state
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDesc, setTicketDesc] = useState('');

  useEffect(() => {
    setActiveTab(initialTab || 'inicio');
  }, [initialTab]);

  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.fullName);
      setColonia(currentUser.colonia);
      setAvatarUrl(currentUser.avatarUrl);
    }
  }, [currentUser?.id, currentUser?.fullName, currentUser?.colonia, currentUser?.avatarUrl]);

  const izcalliColonias = useMemo(() => {
    const reg = db.regions.find((r) => r.id === (currentUser?.regionId || 'reg-izcalli'));
    return reg && reg.colonias.length > 0 ? reg.colonias : ALL_IZCALLI_COLONIAS;
  }, [db.regions, currentUser?.regionId]);

  if (!currentUser || !canAccessWorkspaceRoute(currentUser, 'client-panel')) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold text-[#1D252C] dark:text-[#F7F3EA]">
          {!currentUser
            ? 'Inicia sesión para ver tu panel de cliente'
            : 'Acceso reservado para cuentas de cliente'}
        </h1>
        <p className="text-sm text-[#73766F] dark:text-[#A3A89F]">
          Administra tus solicitudes, cotizaciones recibidas, mensajes y servicios contratados en
          OFI CLICK.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="px-5 py-2.5 rounded-xl bg-[#214438] hover:bg-[#183329] text-white dark:bg-[#C7582B] dark:hover:bg-[#AC4921] dark:text-[#FFFDFA] text-sm font-semibold transition-colors"
          >
            Iniciar sesión
          </button>
          <button
            type="button"
            onClick={() => navigate({ page: 'landing' })}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border border-[#DBD4C6] dark:border-white/15 text-[#1D252C] dark:text-[#F7F3EA] hover:bg-[#ECE7DC]/50 dark:hover:bg-white/5 text-sm font-semibold transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al marketplace
          </button>
        </div>
      </div>
    );
  }

  const myRequests = db.requests
    .filter((r) => r.clientId === currentUser.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const myQuotes = db.quotes.filter((q) => q.clientId === currentUser.id);
  const myBookings = db.bookings
    .filter((b) => b.clientId === currentUser.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const myFavorites = db.favorites
    .filter((f) => f.clientId === currentUser.id)
    .map((f) => db.professionals.find((p) => p.id === f.professionalId))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const myReviews = db.reviews.filter((r) => r.clientId === currentUser.id);
  const myNotifications = db.notifications.filter((n) => n.profileId === currentUser.id);
  const unreadNotifs = myNotifications.filter((n) => !n.read).length;
  const unreadMsgs = db.messages.filter(
    (m) =>
      m.senderId !== currentUser.id &&
      !m.readByIds.includes(currentUser.id) &&
      db.conversations.some(
        (c) => c.id === m.conversationId && c.participantIds.includes(currentUser.id)
      )
  ).length;
  const myTickets = db.supportTickets.filter((t) => t.creatorId === currentUser.id);

  const filteredRequests = myRequests.filter((req) => {
    const matchesStatus = reqFilterStatus === 'all' || req.status === reqFilterStatus;
    const q = reqFilterQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      req.title.toLowerCase().includes(q) ||
      req.description.toLowerCase().includes(q) ||
      req.colonia.toLowerCase().includes(q);
    return matchesStatus && matchesQuery;
  });

  const matchesBookingGroup = (status: Booking['status'], filter: string) => {
    if (filter === 'all') return true;
    if (filter === 'group_upcoming') {
      return status === 'quote_accepted' || status === 'scheduled';
    }
    if (filter === 'group_active') {
      return status === 'on_the_way' || status === 'in_progress';
    }
    if (filter === 'group_confirm') {
      return status === 'pro_marked_done';
    }
    if (filter === 'group_completed') {
      return status === 'completed' || status === 'client_confirmed';
    }
    if (filter === 'group_closed') {
      return (
        status === 'cancelled' ||
        status === 'rejected' ||
        status === 'expired' ||
        status === 'disputed' ||
        status === 'not_performed'
      );
    }
    return status === filter;
  };

  const filteredBookings = myBookings.filter((b) => {
    const matchesStatus = matchesBookingGroup(b.status, bkFilterStatus);
    const pro = db.professionals.find((p) => p.id === b.professionalId);
    const q = bkFilterQuery.trim().toLowerCase();
    const matchesQuery =
      !q ||
      b.serviceTitle.toLowerCase().includes(q) ||
      b.colonia.toLowerCase().includes(q) ||
      (pro?.displayName.toLowerCase().includes(q) ?? false) ||
      (pro?.commercialName?.toLowerCase().includes(q) ?? false);
    return matchesStatus && matchesQuery;
  });

  const pendingReviewBookings = myBookings.filter(
    (b) => canUserLeaveReview(b, db.reviews, currentUser.id).allowed
  );

  const navItems: DashboardNavItem[] = [
    { id: 'inicio', label: 'Inicio', icon: <Home className="w-4 h-4" /> },
    { id: 'explorar', label: 'Explorar', icon: <Compass className="w-4 h-4" /> },
    {
      id: 'solicitudes',
      label: 'Solicitudes',
      icon: <ClipboardList className="w-4 h-4" />,
      badge: myRequests.filter((r) => r.status !== 'closed' && r.status !== 'cancelled').length,
    },
    {
      id: 'contratados',
      label: 'Servicios contratados',
      icon: <Briefcase className="w-4 h-4" />,
      badge: myBookings.filter((b) => b.status !== 'completed' && b.status !== 'cancelled').length,
    },
    {
      id: 'mensajes',
      label: 'Mensajes',
      icon: <MessageSquare className="w-4 h-4" />,
      badge: unreadMsgs,
    },
    { id: 'favoritos', label: 'Favoritos', icon: <Heart className="w-4 h-4" /> },
    {
      id: 'resenas',
      label: 'Reseñas',
      icon: <Star className="w-4 h-4" />,
      badge: pendingReviewBookings.length,
    },
    {
      id: 'notificaciones',
      label: 'Notificaciones',
      icon: <Bell className="w-4 h-4" />,
      badge: unreadNotifs,
    },
    { id: 'perfil', label: 'Mi perfil', icon: <User className="w-4 h-4" /> },
    { id: 'configuracion', label: 'Configuración', icon: <Settings className="w-4 h-4" /> },
    { id: 'ayuda', label: 'Ayuda', icon: <HelpCircle className="w-4 h-4" /> },
  ];

  const handleSelectTab = (id: string) => {
    setActiveTab(id);
    navigate({ page: 'client-panel', tab: id });
  };

  const handleAcceptQuote = (quoteId: string) => {
    try {
      quotesService.respondToQuote(quoteId, 'accepted');
      refreshDb();
      notify('Cotización aceptada. Se creó tu contratación y cita programada.', 'success');
      handleSelectTab('contratados');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'No se pudo aceptar la cotización.', 'error');
    }
  };

  const handleRejectQuote = (quoteId: string) => {
    quotesService.respondToQuote(quoteId, 'rejected');
    refreshDb();
    notify('Cotización rechazada.', 'info');
  };

  const handleOpenChatWithPro = (proProfileId: string, requestId?: string) => {
    const conv = messagesService.getOrCreateConversation({
      participantIds: [currentUser.id, proProfileId],
      requestId,
    });
    refreshDb();
    setActiveConvId(conv.id);
    handleSelectTab('mensajes');
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    profilesService.updateProfile(currentUser.id, {
      fullName: fullName.trim() || currentUser.fullName,
      colonia,
      avatarUrl,
      avatarConsent: Boolean(avatarUrl),
      avatarStorageBucket: avatarUrl ? STORAGE_BUCKETS.PUBLIC_AVATARS : undefined,
    });
    refreshDb();
    notify('Perfil actualizado correctamente.', 'success');
  };

  return (
    <DashboardShell
      title={currentUser.fullName}
      subtitle={`Col. ${currentUser.colonia} · Cuautitlán Izcalli`}
      roleLabel="Panel del cliente"
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={handleSelectTab}
        headerActions={
          <button
            type="button"
            onClick={() => navigate({ page: 'request-new' })}
            className="px-4 py-2 rounded-xl bg-[#214438] hover:bg-[#183329] text-white text-xs font-semibold whitespace-nowrap transition-colors"
          >
            + Nueva solicitud
          </button>
        }
      >
        {/* 1. Inicio */}
        {activeTab === 'inicio' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  id: 'solicitudes-enviadas',
                  label: 'Solicitudes enviadas',
                  value: myRequests.length,
                  tab: 'solicitudes',
                  hint: 'Ver solicitudes y estados',
                  icon: <ClipboardList className="w-4 h-4" aria-hidden="true" />,
                },
                {
                  id: 'cotizaciones-recibidas',
                  label: 'Cotizaciones recibidas',
                  value: myQuotes.length,
                  tab: 'solicitudes',
                  hint: 'Revisar y comparar propuestas',
                  icon: <FileText className="w-4 h-4" aria-hidden="true" />,
                },
                {
                  id: 'servicios-contratados',
                  label: 'Servicios contratados',
                  value: myBookings.length,
                  tab: 'contratados',
                  hint: 'Consultar citas y seguimiento',
                  icon: <Briefcase className="w-4 h-4" aria-hidden="true" />,
                },
                {
                  id: 'freelancers-favoritos',
                  label: 'Freelancers favoritos',
                  value: myFavorites.length,
                  tab: 'favoritos',
                  hint: 'Abrir lista guardada',
                  icon: <Heart className="w-4 h-4" aria-hidden="true" />,
                },
                {
                  id: 'mensajes-sin-leer',
                  label: 'Mensajes sin leer',
                  value: unreadMsgs,
                  tab: 'mensajes',
                  hint: 'Ir a conversaciones',
                  icon: <MessageSquare className="w-4 h-4" aria-hidden="true" />,
                },
                {
                  id: 'notificaciones-pendientes',
                  label: 'Notificaciones',
                  value: unreadNotifs,
                  tab: 'notificaciones',
                  hint: 'Ver avisos recientes',
                  icon: <Bell className="w-4 h-4" aria-hidden="true" />,
                },
              ].map((stat) => (
                <button
                  key={stat.id}
                  type="button"
                  data-testid={`client-stat-${stat.id}`}
                  onClick={() => handleSelectTab(stat.tab)}
                  className="group text-left rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-4 hover:border-[#214438] dark:hover:border-[#75836A] hover:shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-[#214438]"
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-[#73766F] dark:text-[#A3A89F]">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      <span className="text-[#214438] dark:text-[#75836A]">{stat.icon}</span>
                      <span>{stat.label}</span>
                    </span>
                    <ArrowUpRight
                      className="w-3.5 h-3.5 text-[#73766F] group-hover:text-[#214438] dark:group-hover:text-[#75836A] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0"
                      aria-hidden="true"
                    />
                  </div>
                  <p className="font-mono-num text-2xl font-bold text-[#1D252C] dark:text-[#F7F3EA] mt-1.5">
                    {stat.value}
                  </p>
                  <p className="text-[11px] text-[#214438] dark:text-[#75836A] font-medium mt-1">
                    {stat.hint}
                  </p>
                </button>
              ))}
            </div>

            {myQuotes.some((q) => q.status === 'sent' || q.status === 'revised') && (
              <div className="rounded-xl border border-[#C7582B]/45 bg-[#ECE7DC]/75 dark:bg-[#1A2128] p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-sm text-[#1D252C] dark:text-[#F7F3EA]">
                    Tienes cotizaciones listas para revisar y comparar
                  </h3>
                  <p className="text-xs text-[#73766F] dark:text-[#A3A89F] mt-0.5">
                    Revisa el desglose de mano de obra, materiales y condiciones antes de aceptar.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectTab('solicitudes')}
                  className="px-4 py-2 rounded-xl bg-[#214438] hover:bg-[#183329] text-white text-xs font-semibold whitespace-nowrap transition-colors"
                >
                  Comparar cotizaciones
                </button>
              </div>
            )}

          {myBookings.slice(0, 2).map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              currentUser={currentUser}
              viewerRole="client"
              onViewDetail={(bk) => setSelectedBooking(bk)}
              onOpenChat={(convId) => {
                setActiveConvId(convId);
                handleSelectTab('mensajes');
              }}
            />
          ))}
        </div>
      )}

      {/* 2. Explorar (embebido dentro del panel sin salir ni duplicar navegación) */}
      {activeTab === 'explorar' && <ExplorePage embedded />}

      {/* 3. Solicitudes & Quote Comparison */}
      {activeTab === 'solicitudes' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#73766F] dark:text-[#A3A89F] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={reqFilterQuery}
                onChange={(e) => setReqFilterQuery(e.target.value)}
                placeholder="Buscar en tus solicitudes por título o colonia..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#1A2128] text-xs text-[#1D252C] dark:text-[#F7F3EA]"
              />
            </div>
            <select
              value={reqFilterStatus}
              onChange={(e) => setReqFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#1A2128] text-xs text-[#1D252C] dark:text-[#F7F3EA]"
            >
              <option value="all">Todos los estados</option>
              <option value="sent">Enviadas</option>
              <option value="quoted">Con cotización</option>
              <option value="accepted">Aceptadas</option>
              <option value="cancelled">Canceladas</option>
            </select>
          </div>

          {filteredRequests.length === 0 ? (
            <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-8 text-center space-y-3">
              <p className="text-sm font-semibold text-[#1D252C] dark:text-[#F7F3EA]">
                {myRequests.length === 0
                  ? 'Aún no has enviado solicitudes de servicio.'
                  : 'No hay solicitudes que coincidan con el filtro.'}
              </p>
              <button
                type="button"
                onClick={() => navigate({ page: 'request-new' })}
                className="px-4 py-2 rounded-xl bg-[#214438] hover:bg-[#183329] text-white dark:bg-[#C7582B] dark:hover:bg-[#AC4921] dark:text-[#FFFDFA] text-xs font-semibold transition-colors"
              >
                Crear solicitud
              </button>
            </div>
          ) : (
            filteredRequests.map((req) => {
              const reqQuotes = myQuotes.filter((q) => q.requestId === req.id);
              const cat = db.categories.find((c) => c.id === req.categoryId);
              return (
                <div
                  key={req.id}
                  className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase text-[#214438] dark:text-[#75836A]">
                        {cat?.name || 'Servicio'} · Col. {req.colonia} · Estado:{' '}
                        {(
                          {
                            sent: 'Enviada',
                            quoted: 'Cotizada',
                            accepted: 'Aceptada',
                            cancelled: 'Cancelada',
                            closed: 'Cerrada',
                          } as Record<string, string>
                        )[req.status] || req.status}
                      </div>
                      <h3 className="text-lg font-bold text-[#1D252C] dark:text-[#F7F3EA] mt-0.5">
                        {req.title}
                      </h3>
                      <p className="text-xs text-[#73766F] dark:text-[#A3A89F] mt-1">
                        {req.description}
                      </p>
                      <p className="text-xs text-[#73766F] dark:text-[#A3A89F] mt-1">
                        Fecha solicitada: {req.desiredDate} ({req.desiredTimeSlot}) · Freelancers
                        invitados: {req.recipientProfessionalIds.length}
                      </p>
                    </div>
                    {req.status !== 'accepted' &&
                      req.status !== 'cancelled' &&
                      req.status !== 'closed' && (
                        <button
                          type="button"
                          onClick={() => {
                            requestsService.closeOrCancelRequest(req.id, 'cancelled');
                            refreshDb();
                            notify('Solicitud cancelada.', 'info');
                          }}
                          className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 dark:text-red-300 text-xs font-medium whitespace-nowrap"
                        >
                          Cancelar solicitud
                        </button>
                      )}
                  </div>

                  {reqQuotes.length > 0 ? (
                    <div className="space-y-2 pt-2 border-t border-[#DBD4C6] dark:border-white/10">
                      <p className="text-xs font-semibold text-[#1D252C] dark:text-[#F7F3EA]">
                        Cotizaciones recibidas ({reqQuotes.length})
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {reqQuotes.map((quote) => {
                          const pro = db.professionals.find((p) => p.id === quote.professionalId);
                          const latest = quote.versions[quote.versions.length - 1];
                          const canDecide =
                            quote.status === 'sent' || quote.status === 'revised';
                          return (
                            <div
                              key={quote.id}
                              className="p-4 rounded-xl border border-[#DBD4C6] dark:border-white/15 bg-[#ECE7DC]/50 dark:bg-[#161C22] space-y-2.5 text-xs"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <UserAvatar
                                    src={getPublicProAvatar(pro)}
                                    name={pro?.commercialName || pro?.displayName || 'Freelancer'}
                                    sizeClass="w-8 h-8"
                                  />
                                  <div className="min-w-0">
                                    <span className="font-bold text-sm text-[#1D252C] dark:text-[#F7F3EA] block truncate">
                                      {pro?.commercialName || pro?.displayName || 'Freelancer'}
                                    </span>
                                  <p className="text-[#73766F] dark:text-[#A3A89F]">
                                    Versión {latest.versionNumber} · Estado:{' '}
                                    {quote.status === 'sent'
                                      ? 'Enviada'
                                      : quote.status === 'revised'
                                      ? 'Actualizada'
                                      : quote.status === 'accepted'
                                      ? 'Aceptada'
                                      : quote.status === 'rejected'
                                      ? 'Rechazada'
                                      : 'Expirada'}
                                    </p>
                                  </div>
                                </div>
                                <span className="font-mono-num text-base font-bold text-[#214438] dark:text-[#C7582B]">
                                  {formatMXN(latest.totalAmount)}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-1 text-[#73766F] dark:text-[#A3A89F]">
                                <span>Mano de obra: {formatMXN(latest.laborAmount)}</span>
                                <span>Materiales: {formatMXN(latest.materialsAmount)}</span>
                                <span>Cargos extra: {formatMXN(latest.additionalCharges)}</span>
                                <span>Descuento: -{formatMXN(latest.discountAmount)}</span>
                              </div>
                              <p className="text-[#1D252C] dark:text-[#F7F3EA]">
                                Propuesta: {latest.proposedDate} · {latest.proposedTime} (
                                {latest.estimatedDuration})
                              </p>
                              <p className="text-[#73766F] dark:text-[#A3A89F]">{latest.conditions}</p>
                              <div className="flex flex-wrap gap-2 pt-1">
                                {pro && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenChatWithPro(pro.profileId, req.id)}
                                    className="px-3 py-1.5 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#1A2128] text-[#1D252C] dark:text-[#F7F3EA] font-medium"
                                  >
                                    Chatear
                                  </button>
                                )}
                                {canDecide && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleAcceptQuote(quote.id)}
                                      className="px-3 py-1.5 rounded-lg bg-[#214438] hover:bg-[#183329] text-white dark:bg-[#C7582B] dark:hover:bg-[#AC4921] dark:text-[#FFFDFA] font-semibold transition-colors"
                                    >
                                      Aceptar y agendar
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRejectQuote(quote.id)}
                                      className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 dark:text-red-300"
                                    >
                                      Rechazar
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[#73766F] dark:text-[#A3A89F] pt-2 border-t border-[#DBD4C6] dark:border-white/10">
                      Esperando respuesta de los freelancers destinatarios.
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 4. Servicios contratados */}
      {activeTab === 'contratados' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'Todas', count: myBookings.length },
              {
                id: 'group_upcoming',
                label: 'Próximas',
                count: myBookings.filter((b) => matchesBookingGroup(b.status, 'group_upcoming')).length,
              },
              {
                id: 'group_active',
                label: 'En curso',
                count: myBookings.filter((b) => matchesBookingGroup(b.status, 'group_active')).length,
              },
              {
                id: 'group_confirm',
                label: 'Por confirmar',
                count: myBookings.filter((b) => matchesBookingGroup(b.status, 'group_confirm')).length,
              },
              {
                id: 'group_completed',
                label: 'Completadas',
                count: myBookings.filter((b) => matchesBookingGroup(b.status, 'group_completed')).length,
              },
              {
                id: 'group_closed',
                label: 'Canceladas / Disputa',
                count: myBookings.filter((b) => matchesBookingGroup(b.status, 'group_closed')).length,
              },
            ].map((pill) => {
              const active = bkFilterStatus === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setBkFilterStatus(pill.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-[#214438] text-white dark:bg-[#C7582B] dark:text-[#FFFDFA]'
                      : 'bg-[#FFFDFA] dark:bg-[#1A2128] border border-[#DBD4C6] dark:border-white/12 text-[#1D252C] dark:text-[#F7F3EA]'
                  }`}
                >
                  {pill.label} ({pill.count})
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#73766F] dark:text-[#A3A89F] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={bkFilterQuery}
                onChange={(e) => setBkFilterQuery(e.target.value)}
                placeholder="Buscar por servicio, freelancer o colonia..."
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#1A2128] text-xs text-[#1D252C] dark:text-[#F7F3EA]"
              />
            </div>
            <select
              value={bkFilterStatus}
              onChange={(e) => setBkFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#1A2128] text-xs text-[#1D252C] dark:text-[#F7F3EA]"
            >
              <option value="all">Todos los estados</option>
              <option value="quote_accepted">Cotización aceptada</option>
              <option value="scheduled">Agendados</option>
              <option value="on_the_way">En camino</option>
              <option value="in_progress">En curso</option>
              <option value="pro_marked_done">Por confirmar</option>
              <option value="completed">Completados</option>
              <option value="cancelled">Cancelados</option>
              <option value="disputed">En disputa</option>
            </select>
          </div>

          {filteredBookings.length === 0 ? (
            <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-8 text-center text-sm text-[#73766F] dark:text-[#A3A89F]">
              {myBookings.length === 0
                ? 'Cuando aceptes una cotización aparecerá aquí tu contratación y seguimiento paso a paso.'
                : 'No hay servicios contratados que coincidan con el filtro.'}
            </div>
          ) : (
            filteredBookings.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                currentUser={currentUser}
                viewerRole="client"
                onViewDetail={(bk) => setSelectedBooking(bk)}
                onOpenChat={(convId) => {
                  setActiveConvId(convId);
                  handleSelectTab('mensajes');
                }}
              />
            ))
          )}
        </div>
      )}

      {/* 5. Mensajes */}
      {activeTab === 'mensajes' && (
        <ChatWorkspace currentUser={currentUser} initialConversationId={activeConvId} />
      )}

      {/* 6. Favoritos */}
      {activeTab === 'favoritos' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {myFavorites.length === 0 ? (
            <div className="md:col-span-2 rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-8 text-center space-y-3 text-sm text-[#73766F] dark:text-[#A3A89F]">
              <p>
                Guarda freelancers y profesionales independientes desde el explorador para acceder
                rápido a ellos.
              </p>
              <button
                type="button"
                onClick={() => handleSelectTab('explorar')}
                className="px-4 py-2 rounded-xl bg-[#214438] hover:bg-[#183329] text-white dark:bg-[#C7582B] dark:hover:bg-[#AC4921] dark:text-[#FFFDFA] text-xs font-semibold transition-colors"
              >
                Explorar freelancers
              </button>
            </div>
          ) : (
            myFavorites.map((pro) => (
              <ProfessionalCard key={pro.id} pro={pro} services={db.services} />
            ))
          )}
        </div>
      )}

      {/* 7. Reseñas */}
      {activeTab === 'resenas' && (
        <div className="space-y-4">
          {pendingReviewBookings.map((b) => {
            const rating = reviewRatingMap[b.id] || 5;
            const comment = reviewCommentMap[b.id] || '';
            const pro = db.professionals.find((p) => p.id === b.professionalId);
            return (
              <form
                key={b.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!comment.trim()) {
                    notify('Escribe un breve comentario sobre tu experiencia.', 'error');
                    return;
                  }
                  reviewsService.publishReview({
                    bookingId: b.id,
                    clientId: currentUser.id,
                    clientName: currentUser.fullName,
                    professionalId: b.professionalId,
                    serviceName: b.serviceTitle,
                    rating,
                    comment: comment.trim(),
                  });
                  setReviewCommentMap((prev) => ({ ...prev, [b.id]: '' }));
                  refreshDb();
                  notify('¡Gracias! Tu reseña ha sido publicada.', 'success');
                }}
                className="rounded-xl border border-[#C7582B]/60 bg-[#ECE7DC]/55 dark:bg-[#1A2128] p-5 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-semibold uppercase text-[#214438] dark:text-[#C7582B]">
                      Servicio completado listo para calificar
                    </span>
                    <h4 className="font-bold text-sm text-[#1D252C] dark:text-[#F7F3EA]">
                      {b.serviceTitle} · {pro?.displayName || 'Freelancer'}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1">
                    {([1, 2, 3, 4, 5] as const).map((starVal) => (
                      <button
                        key={starVal}
                        type="button"
                        onClick={() =>
                          setReviewRatingMap((prev) => ({ ...prev, [b.id]: starVal }))
                        }
                        aria-label={`${starVal} estrellas`}
                        className="p-1"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            starVal <= rating
                              ? 'fill-[#C7582B] text-[#C7582B]'
                              : 'text-[#73766F] dark:text-[#A3A89F]'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  rows={2}
                  value={comment}
                  onChange={(e) =>
                    setReviewCommentMap((prev) => ({ ...prev, [b.id]: e.target.value }))
                  }
                  placeholder="Cuéntale a otros vecinos cómo fue la puntualidad, limpieza y resultado..."
                  className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-xs text-[#1D252C] dark:text-[#F7F3EA]"
                  required
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#214438] hover:bg-[#183329] text-white dark:bg-[#C7582B] dark:hover:bg-[#AC4921] dark:text-[#FFFDFA] text-xs font-semibold transition-colors"
                >
                  Publicar reseña
                </button>
              </form>
            );
          })}

          {myReviews.length === 0 ? (
            <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-8 text-center text-sm text-[#73766F] dark:text-[#A3A89F]">
              Aún no has publicado reseñas. Se habilitan automáticamente al completar una
              contratación.
            </div>
          ) : (
            myReviews.map((rev) => (
              <div
                key={rev.id}
                className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-5 space-y-2 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#1D252C] dark:text-[#F7F3EA]">
                    {rev.serviceName}
                  </span>
                  <span className="font-mono-num font-semibold text-[#C7582B]">{rev.rating} / 5</span>
                </div>
                <p className="text-[#1D252C]/85 dark:text-[#F7F3EA]/85">{rev.comment}</p>
                {rev.proResponse && (
                  <p className="text-xs p-3 rounded-lg bg-[#ECE7DC]/60 dark:bg-[#161C22] text-[#73766F] dark:text-[#A3A89F]">
                    <strong>Respuesta del freelancer:</strong> {rev.proResponse.text}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* 8. Notificaciones */}
      {activeTab === 'notificaciones' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1D252C] dark:text-[#F7F3EA]">Centro de notificaciones</h3>
              {unreadNotifs > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    notificationsService.markAllRead(currentUser.id);
                    refreshDb();
                  }}
                  className="text-xs font-semibold text-[#214438] dark:text-[#C7582B] hover:underline"
                >
                  Marcar todas como leídas
                </button>
              )}
            </div>
            {myNotifications.length === 0 ? (
              <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">Sin notificaciones por el momento.</p>
            ) : (
              <div className="divide-y divide-[#DBD4C6] dark:divide-white/10">
                {myNotifications.map((n) => (
                  <div
                    key={n.id}
                    className={`py-3 flex items-start justify-between gap-3 ${
                      n.read ? 'opacity-70' : ''
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold text-[#1D252C] dark:text-[#F7F3EA]">
                        {n.title}
                      </p>
                      <p className="text-xs text-[#73766F] dark:text-[#A3A89F] mt-0.5">{n.body}</p>
                      <p className="text-[11px] text-[#73766F] dark:text-[#A3A89F] mt-1">
                        {formatDateMX(n.createdAt, true)}
                      </p>
                    </div>
                    {!n.read && (
                      <button
                        type="button"
                        onClick={() => {
                          notificationsService.markRead(n.id);
                          refreshDb();
                        }}
                        className="text-xs font-medium text-[#214438] dark:text-[#C7582B] whitespace-nowrap"
                      >
                        Marcar leída
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-5 space-y-3 text-sm">
            <h3 className="font-bold text-[#1D252C] dark:text-[#F7F3EA]">Preferencias de notificación</h3>
            {(
              [
                { key: 'inApp', label: 'Alertas dentro de la app' },
                { key: 'email', label: 'Resúmenes por correo electrónico' },
                { key: 'push', label: 'Notificaciones push (PWA)' },
                { key: 'securityAlertsOnly', label: 'Priorizar solo avisos de seguridad y citas' },
              ] as const
            ).map((pref) => (
              <label key={pref.key} className="flex items-center gap-2.5 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={currentUser.notificationPrefs[pref.key]}
                  onChange={(e) => {
                    profilesService.updateProfile(currentUser.id, {
                      notificationPrefs: {
                        ...currentUser.notificationPrefs,
                        [pref.key]: e.target.checked,
                      },
                    });
                    refreshDb();
                    notify('Preferencias guardadas.', 'success');
                  }}
                />
                {pref.label}
              </label>
            ))}
          </div>
        </div>
      )}

      {/* 9. Mi perfil */}
      {activeTab === 'perfil' && (
        <form
          onSubmit={handleSaveProfile}
          className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-6 space-y-4 max-w-2xl"
        >
          <h3 className="text-base font-bold text-[#1D252C] dark:text-[#F7F3EA]">Datos de tu cuenta</h3>
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-lg bg-[#ECE7DC]/55 dark:bg-[#161C22] text-xs">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#214438] dark:text-[#C7582B]" />
              <span>
                Correo: <strong>{currentUser.email}</strong> (
                {currentUser.emailConfirmed ? 'Confirmado' : 'Pendiente de confirmar'})
              </span>
            </div>
            {!currentUser.emailConfirmed && (
              <button
                type="button"
                onClick={() => {
                  authService.confirmEmail(currentUser.id);
                  refreshDb();
                  notify('Correo confirmado exitosamente.', 'success');
                }}
                className="px-3 py-1 rounded bg-[#214438] text-white font-semibold"
              >
                Confirmar correo ahora
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Nombre completo</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm text-[#1D252C] dark:text-[#F7F3EA]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Colonia</label>
              <select
                value={colonia}
                onChange={(e) => setColonia(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm text-[#1D252C] dark:text-[#F7F3EA]"
              >
                {izcalliColonias.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <PhotoUploadBox
            label="Fotografía de perfil (opcional)"
            value={avatarUrl}
            onChange={(nextUrl) => {
              setAvatarUrl(nextUrl);
              profilesService.updateProfile(currentUser.id, {
                avatarUrl: nextUrl,
                avatarConsent: Boolean(nextUrl),
                avatarStorageBucket: nextUrl ? STORAGE_BUCKETS.PUBLIC_AVATARS : undefined,
              });
              refreshDb();
              notify(
                nextUrl
                  ? 'Fotografía de perfil actualizada.'
                  : 'Fotografía eliminada de tu perfil. Puedes subir una nueva cuando lo desees.',
                'info'
              );
            }}
            frontalFaceGuidance
            allowRemove
            uploadButtonLabel="Subir foto frontal"
            helperText="Se muestra únicamente dentro de tus espacios de perfil, solicitudes, conversaciones y contrataciones con los profesionales que contactes."
          />

          <button
            type="submit"
            className="px-5 py-2.5 rounded-xl bg-[#214438] hover:bg-[#183329] text-white dark:bg-[#C7582B] dark:hover:bg-[#AC4921] dark:text-[#FFFDFA] text-sm font-semibold transition-colors"
          >
            Guardar cambios
          </button>
        </form>
      )}

      {/* 10. Configuración */}
      {activeTab === 'configuracion' && (
        <div className="space-y-5 max-w-2xl">
          <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-6 space-y-3">
            <h3 className="text-base font-bold text-[#1D252C] dark:text-[#F7F3EA]">Apariencia de la interfaz</h3>
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  { id: 'light', label: 'Claro' },
                  { id: 'dark', label: 'Oscuro' },
                  { id: 'system', label: 'Sistema' },
                ] as { id: ThemePreference; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTheme(opt.id)}
                  className={`py-2.5 rounded-lg border text-xs font-semibold transition-colors ${
                    theme === opt.id
                      ? 'bg-[#214438] text-white border-[#214438] dark:bg-[#C7582B] dark:border-[#C7582B] dark:text-[#FFFDFA]'
                      : 'border-[#DBD4C6] dark:border-white/15 text-[#1D252C] dark:text-[#F7F3EA]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-red-300/60 dark:border-red-900/50 bg-[#FFFDFA] dark:bg-[#1A2128] p-6 space-y-3">
            <h3 className="text-base font-bold text-red-700 dark:text-red-300">
              Privacidad y eliminación de cuenta
            </h3>
            <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">
              Puedes cerrar tu sesión o eliminar tu perfil local de este navegador.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={signOut}
                className="px-4 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/20 text-xs font-semibold text-[#1D252C] dark:text-[#F7F3EA]"
              >
                Cerrar sesión
              </button>
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-700 text-white text-xs font-semibold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Eliminar cuenta
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      authService.deleteAccount(currentUser.id);
                      refreshDb();
                      navigate({ page: 'landing' });
                      notify('Cuenta eliminada de los datos locales.', 'info');
                    }}
                    className="px-4 py-2 rounded-lg bg-red-700 text-white text-xs font-bold"
                  >
                    Confirmar eliminación definitiva
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 text-xs"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 11. Ayuda */}
      {activeTab === 'ayuda' && (
        <div className="space-y-5 max-w-2xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!ticketSubject.trim() || !ticketDesc.trim()) return;
              adminService.createSupportTicket({
                creatorId: currentUser.id,
                creatorName: currentUser.fullName,
                regionId: currentUser.regionId || 'reg-izcalli',
                subject: ticketSubject.trim(),
                description: ticketDesc.trim(),
                priority: 'medium',
              });
              setTicketSubject('');
              setTicketDesc('');
              refreshDb();
              notify('Ticket de soporte enviado.', 'success');
            }}
            className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-6 space-y-4"
          >
            <h3 className="text-base font-bold text-[#1D252C] dark:text-[#F7F3EA]">Crear ticket de soporte</h3>
            <input
              type="text"
              value={ticketSubject}
              onChange={(e) => setTicketSubject(e.target.value)}
              placeholder="Asunto de tu consulta"
              className="w-full px-3.5 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm text-[#1D252C] dark:text-[#F7F3EA]"
              required
            />
            <textarea
              value={ticketDesc}
              onChange={(e) => setTicketDesc(e.target.value)}
              rows={3}
              placeholder="Describe cómo podemos ayudarte..."
              className="w-full px-3.5 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm text-[#1D252C] dark:text-[#F7F3EA]"
              required
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#214438] hover:bg-[#183329] text-white dark:bg-[#C7582B] dark:hover:bg-[#AC4921] dark:text-[#FFFDFA] text-xs font-semibold transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Enviar ticket
            </button>
          </form>

          {myTickets.length > 0 && (
            <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-5 space-y-3">
              <h4 className="text-sm font-bold text-[#1D252C] dark:text-[#F7F3EA]">Mis tickets</h4>
              {myTickets.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-lg bg-[#ECE7DC]/50 dark:bg-[#161C22] text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[#1D252C] dark:text-[#F7F3EA]">{t.subject}</p>
                    <span className="font-semibold uppercase text-[#214438] dark:text-[#C7582B]">
                      {t.status}
                    </span>
                  </div>
                  <p className="text-[#73766F] dark:text-[#A3A89F]">{t.description}</p>
                  {t.evidenceNote && (
                    <p className="text-[#214438] dark:text-[#C7582B] pt-1">
                      <strong>Respuesta de soporte:</strong> {t.evidenceNote}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          currentUser={currentUser}
          viewerRole="client"
          onClose={() => setSelectedBooking(null)}
          onOpenChat={(convId) => {
            setActiveConvId(convId);
            handleSelectTab('mensajes');
          }}
        />
      )}
    </DashboardShell>
  );
};
