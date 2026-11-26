import React from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  MessageSquare,
  ShieldCheck,
  Star,
  X,
} from 'lucide-react';
import type { Booking, BookingStatus, Profile } from '../../types/oficlick';
import { useOfiClick } from '../../context/OfiClickContext';
import { messagesService } from '../../services/messages.service';
import { bookingsService } from '../../services/bookings.service';
import { formatDateMX, formatMXN } from '../../utils/marketplace';
import { getPublicProAvatar } from '../../utils/media';
import { UserAvatar } from '../UserAvatar';

interface BookingDetailModalProps {
  booking: Booking;
  currentUser: Profile;
  viewerRole: 'client' | 'pro';
  onClose: () => void;
  onOpenChat: (conversationId: string) => void;
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  quote_accepted: 'Cotización aceptada',
  scheduled: 'Cita programada',
  on_the_way: 'Profesional en camino',
  in_progress: 'En progreso',
  pro_marked_done: 'Pendiente confirmación del cliente',
  client_confirmed: 'Confirmado por cliente',
  completed: 'Completado',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
  expired: 'Expirado',
  disputed: 'En disputa',
  not_performed: 'No realizado',
};

export const BookingDetailModal: React.FC<BookingDetailModalProps> = ({
  booking,
  currentUser,
  viewerRole,
  onClose,
  onOpenChat,
}) => {
  const { db, refreshDb, notify } = useOfiClick();

  // Always resolve the latest booking snapshot from db so status updates reflect immediately
  const liveBooking = db.bookings.find((b) => b.id === booking.id) || booking;
  const pro = db.professionals.find((p) => p.id === liveBooking.professionalId);
  const client = db.profiles.find((p) => p.id === liveBooking.clientId);
  const request = db.requests.find((r) => r.id === liveBooking.requestId);
  const quote = db.quotes.find((q) => q.id === liveBooking.quoteId);
  const quoteVersion =
    quote?.versions.find((v) => v.versionNumber === liveBooking.quoteVersion) ||
    quote?.versions[quote.versions.length - 1];
  const category = request ? db.categories.find((c) => c.id === request.categoryId) : undefined;
  const review = db.reviews.find((r) => r.bookingId === liveBooking.id);

  const handleOpenChat = () => {
    if (!pro) return;
    const conv = messagesService.getOrCreateConversation({
      participantIds: [liveBooking.clientId, pro.profileId],
      bookingId: liveBooking.id,
      requestId: liveBooking.requestId,
    });
    refreshDb();
    onClose();
    onOpenChat(conv.id);
  };

  const handleQuickStatus = (status: BookingStatus, note: string) => {
    bookingsService.updateStatus({
      bookingId: liveBooking.id,
      status,
      actorId: currentUser.id,
      actorName: currentUser.fullName,
      note,
    });
    refreshDb();
    notify(`Estado actualizado: ${STATUS_LABELS[status]}`, 'success');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        data-testid="booking-detail-modal"
        className="w-full max-w-3xl rounded-2xl bg-[#FFFCF7] dark:bg-[#222825] border border-[#DDD5C8] dark:border-white/12 shadow-2xl p-6 my-8 max-h-[90vh] overflow-y-auto space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#DDD5C8] dark:border-white/10">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#304B3E] dark:text-[#B96F50]">
              <span>{STATUS_LABELS[liveBooking.status]}</span>
              <span>·</span>
              <span>Folio {liveBooking.id}</span>
              <span>·</span>
              <span>Cotización v{liveBooking.quoteVersion}</span>
            </div>
            <h2
              id="booking-detail-title"
              className="font-display text-xl font-bold text-[#252A27] dark:text-[#F5F1E8] mt-1"
            >
              {liveBooking.serviceTitle}
            </h2>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="font-mono-num text-xl font-bold text-[#252A27] dark:text-[#B96F50]">
                {formatMXN(liveBooking.agreedAmountMxn)}
              </div>
              <div className="text-[11px] text-[#73766F] dark:text-[#A3A89F]">
                Pago directo fuera de OFI CLICK
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar detalle de contratación"
              className="p-2 rounded-lg text-[#73766F] hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Counterparty & Quick Chat */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[#EAE3D6]/60 dark:bg-[#1C211E] border border-[#DDD5C8] dark:border-white/10">
          <div className="flex items-center gap-3">
            <UserAvatar
              src={viewerRole === 'client' ? getPublicProAvatar(pro) : client?.avatarUrl}
              name={
                viewerRole === 'client'
                  ? pro?.commercialName || pro?.displayName || 'Freelancer'
                  : client?.fullName || 'Cliente'
              }
              sizeClass="w-11 h-11"
            />
            <div>
              <p className="text-[11px] uppercase font-semibold text-[#73766F] dark:text-[#A3A89F]">
                {viewerRole === 'client' ? 'Freelancer asignado' : 'Cliente contratante'}
              </p>
              <p className="text-sm font-bold text-[#252A27] dark:text-[#F5F1E8]">
                {viewerRole === 'client'
                  ? pro?.commercialName || pro?.displayName || 'Especialista OFI CLICK'
                  : client?.fullName || 'Cliente'}
              </p>
              <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">
                {viewerRole === 'client' && pro
                  ? `Col. ${pro.primaryColonia} · ★ ${pro.ratingAvg.toFixed(1)} (${pro.reviewsCount} reseñas)`
                  : `Col. ${client?.colonia || liveBooking.colonia}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleOpenChat}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#304B3E] hover:bg-[#243A30] text-white text-xs font-semibold transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Abrir conversación vinculada
          </button>
        </div>

        {/* Schedule & Private Address */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-4 rounded-xl border border-[#DDD5C8] dark:border-white/10 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-[#252A27] dark:text-[#F5F1E8]">
              <CalendarClock className="w-4 h-4 text-[#B96F50]" />
              <span>Fecha, horario y condiciones</span>
            </div>
            <p className="font-semibold text-sm text-[#304B3E] dark:text-[#B96F50]">
              {liveBooking.scheduledDate} · {liveBooking.scheduledTime}
            </p>
            <p className="text-[#73766F] dark:text-[#A3A89F]">{liveBooking.conditions}</p>
          </div>
          <div className="p-4 rounded-xl border border-[#DDD5C8] dark:border-white/10 space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-[#252A27] dark:text-[#F5F1E8]">
              <MapPin className="w-4 h-4 text-[#304B3E] dark:text-[#75836A]" />
              <span>Ubicación del servicio (privada)</span>
            </div>
            <p className="font-semibold text-sm">Col. {liveBooking.colonia}, Cuautitlán Izcalli</p>
            <p className="text-[#73766F] dark:text-[#A3A89F]">
              Dirección compartida: {liveBooking.privateAddress}
            </p>
          </div>
        </div>

        {/* Original Request + Itemized Quote Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-[#DDD5C8] dark:border-white/10 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-[#252A27] dark:text-[#F5F1E8]">
              <FileText className="w-4 h-4 text-[#304B3E] dark:text-[#75836A]" />
              <span>Resumen de la solicitud original</span>
            </div>
            {category && (
              <p className="text-[11px] font-semibold text-[#304B3E] dark:text-[#B96F50]">
                Categoría: {category.name}
              </p>
            )}
            <p className="font-semibold text-[#252A27] dark:text-[#F5F1E8]">
              {request?.title || liveBooking.serviceTitle}
            </p>
            <p className="text-[#73766F] dark:text-[#A3A89F] leading-relaxed">
              {request?.description || liveBooking.description}
            </p>
            {request?.preferences && (
              <p className="text-[11px] text-[#73766F]">
                Preferencias: {request.preferences}
              </p>
            )}
          </div>

          <div className="p-4 rounded-xl border border-[#DDD5C8] dark:border-white/10 space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-[#252A27] dark:text-[#F5F1E8]">
              <ShieldCheck className="w-4 h-4 text-[#B96F50]" />
              <span>Desglose de la cotización aceptada</span>
            </div>
            {quoteVersion ? (
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#73766F]">Mano de obra:</span>
                  <span className="font-mono-num">{formatMXN(quoteVersion.laborAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#73766F]">Materiales:</span>
                  <span className="font-mono-num">{formatMXN(quoteVersion.materialsAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#73766F]">Cargos adicionales:</span>
                  <span className="font-mono-num">{formatMXN(quoteVersion.additionalCharges)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#73766F]">Descuento aplicado:</span>
                  <span className="font-mono-num">-{formatMXN(quoteVersion.discountAmount)}</span>
                </div>
                <div className="pt-1.5 border-t border-[#DDD5C8] dark:border-white/10 flex justify-between font-bold text-sm">
                  <span>Total acordado:</span>
                  <span className="font-mono-num">{formatMXN(quoteVersion.totalAmount)}</span>
                </div>
                <p className="text-[11px] text-[#73766F] pt-1">
                  Duración estimada: {quoteVersion.estimatedDuration}
                </p>
                {quoteVersion.comments && (
                  <p className="text-[11px] text-[#73766F]">
                    Notas: {quoteVersion.comments}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-[#73766F]">
                Importe acordado: <strong>{formatMXN(liveBooking.agreedAmountMxn)}</strong>.
              </p>
            )}
          </div>
        </div>

        {/* Review summary if already published */}
        {review && (
          <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200">
              <Star className="w-4 h-4 fill-[#B96F50] text-[#B96F50]" />
              <span>Reseña registrada ({review.rating}/5 estrellas)</span>
            </div>
            <p className="text-[#252A27] dark:text-[#F5F1E8]">{review.comment}</p>
          </div>
        )}

        {/* Chronological Event Timeline */}
        <div className="p-4 rounded-xl border border-[#DDD5C8] dark:border-white/10 space-y-3 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-[#252A27] dark:text-[#F5F1E8]">
            <Clock className="w-4 h-4 text-[#304B3E] dark:text-[#B96F50]" />
            <span>Historial cronológico de la contratación ({liveBooking.events.length})</span>
          </div>
          <ol className="space-y-2.5 pl-3 border-l-2 border-[#304B3E]/25 dark:border-[#B96F50]/35">
            {liveBooking.events.map((ev) => (
              <li key={ev.id} className="space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-[#252A27] dark:text-[#F5F1E8]">
                    {STATUS_LABELS[ev.status]}
                  </span>
                  <span className="text-[11px] text-[#73766F]">
                    · {ev.actorName} · {formatDateMX(ev.createdAt, true)}
                  </span>
                </div>
                <p className="text-[#73766F] dark:text-[#A3A89F]">{ev.note}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* Modal Footer Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#DDD5C8] dark:border-white/10">
          <div className="flex flex-wrap items-center gap-2">
            {viewerRole === 'client' && liveBooking.status === 'pro_marked_done' && (
              <button
                type="button"
                onClick={() =>
                  handleQuickStatus(
                    'completed',
                    'Cliente confirmó recepción y conclusión satisfactoria del servicio.'
                  )
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#304B3E] hover:bg-[#243A30] text-white text-xs font-semibold transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Confirmar finalización del servicio
              </button>
            )}
            {viewerRole === 'pro' && liveBooking.status === 'scheduled' && (
              <button
                type="button"
                onClick={() =>
                  handleQuickStatus('on_the_way', 'Profesional en camino al domicilio.')
                }
                className="px-4 py-2 rounded-lg bg-[#304B3E] hover:bg-[#243A30] text-white dark:bg-[#B96F50] dark:hover:bg-[#a65e41] text-xs font-semibold transition-colors"
              >
                Marcar en camino
              </button>
            )}
            {viewerRole === 'pro' && liveBooking.status === 'on_the_way' && (
              <button
                type="button"
                onClick={() => handleQuickStatus('in_progress', 'Servicio iniciado en sitio.')}
                className="px-4 py-2 rounded-lg bg-[#304B3E] hover:bg-[#243A30] text-white dark:bg-[#B96F50] dark:hover:bg-[#a65e41] text-xs font-semibold transition-colors"
              >
                Iniciar trabajo
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#DDD5C8] dark:border-white/15 text-xs font-semibold"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
