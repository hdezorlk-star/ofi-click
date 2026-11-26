import React, { useState } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Eye,
  MapPin,
  MessageSquare,
  Star,
  XCircle,
} from 'lucide-react';
import type { Booking, BookingStatus, Profile } from '../../types/oficlick';
import { useOfiClick } from '../../context/OfiClickContext';
import { bookingsService } from '../../services/bookings.service';
import { messagesService } from '../../services/messages.service';
import { reviewsService } from '../../services/reviews.service';
import { adminService } from '../../services/admin.service';
import { canUserLeaveReview, formatDateMX, formatMXN } from '../../utils/marketplace';
import { getPublicProAvatar } from '../../utils/media';
import { UserAvatar } from '../UserAvatar';

interface BookingCardProps {
  booking: Booking;
  currentUser: Profile;
  viewerRole: 'client' | 'pro';
  onOpenChat?: (conversationId: string) => void;
  onViewDetail?: (booking: Booking) => void;
}

const BOOKING_STEPS: { key: BookingStatus; label: string }[] = [
  { key: 'quote_accepted', label: 'Cotización aceptada' },
  { key: 'scheduled', label: 'Programada' },
  { key: 'on_the_way', label: 'En camino' },
  { key: 'in_progress', label: 'En progreso' },
  { key: 'pro_marked_done', label: 'Trabajo terminado' },
  { key: 'completed', label: 'Completado' },
];

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

export const BookingCard: React.FC<BookingCardProps> = ({
  booking,
  currentUser,
  viewerRole,
  onOpenChat,
  onViewDetail,
}) => {
  const { db, refreshDb, notify } = useOfiClick();

  const [showReschedule, setShowReschedule] = useState(false);
  const [resDate, setResDate] = useState(booking.scheduledDate);
  const [resTime, setResTime] = useState(booking.scheduledTime);
  const [resReason, setResReason] = useState('');

  const [showCancel, setShowCancel] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const [showCompleteForm, setShowCompleteForm] = useState(false);
  const [completionNotes, setCompletionNotes] = useState('');
  const [completionPhotoName, setCompletionPhotoName] = useState('');

  const [showReviewForm, setShowReviewForm] = useState(false);
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5>(5);
  const [reviewComment, setReviewComment] = useState('');

  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

  const pro = db.professionals.find((p) => p.id === booking.professionalId);
  const client = db.profiles.find((p) => p.id === booking.clientId);

  const isActive = ![
    'completed',
    'cancelled',
    'rejected',
    'expired',
    'not_performed',
  ].includes(booking.status);

  const reviewEligibility = canUserLeaveReview(booking, db.reviews, currentUser.id);

  const currentStepIndex = BOOKING_STEPS.findIndex((s) => s.key === booking.status);

  const handleAdvanceStatus = (nextStatus: BookingStatus, note: string, photos?: string[]) => {
    bookingsService.updateStatus({
      bookingId: booking.id,
      status: nextStatus,
      actorId: currentUser.id,
      actorName: currentUser.fullName,
      note,
      photos,
    });
    refreshDb();
    notify(`Estado actualizado: ${STATUS_LABELS[nextStatus]}`, 'success');
  };

  const handleOpenChat = () => {
    if (!pro) return;
    const conv = messagesService.getOrCreateConversation({
      participantIds: [booking.clientId, pro.profileId],
      bookingId: booking.id,
      requestId: booking.requestId,
    });
    refreshDb();
    onOpenChat?.(conv.id);
  };

  const handleProposeReschedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resReason.trim()) return;
    bookingsService.proposeReschedule({
      bookingId: booking.id,
      proposedDate: resDate,
      proposedTime: resTime,
      reason: resReason.trim(),
      proposedById: currentUser.id,
      proposedByRole: viewerRole,
    });
    setShowReschedule(false);
    setResReason('');
    refreshDb();
    notify('Propuesta de reprogramación enviada para acuerdo mutuo.', 'success');
  };

  const handleRespondReschedule = (accept: boolean) => {
    bookingsService.respondReschedule(booking.id, viewerRole, accept);
    refreshDb();
    notify(
      accept
        ? 'Reprogramación confirmada por ambas partes.'
        : 'Propuesta de reprogramación rechazada; se mantiene la fecha original.',
      'info'
    );
  };

  const handleCancel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReason.trim()) return;
    bookingsService.cancelBooking({
      bookingId: booking.id,
      actorId: currentUser.id,
      actorRole: viewerRole === 'client' ? 'Cliente' : 'Profesional',
      reason: cancelReason.trim(),
    });
    setShowCancel(false);
    setCancelReason('');
    refreshDb();
    notify('Contratación cancelada y registrada en el historial.', 'info');
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewComment.trim()) return;
    try {
      reviewsService.publishReview({
        bookingId: booking.id,
        clientId: currentUser.id,
        clientName: currentUser.fullName,
        professionalId: booking.professionalId,
        serviceName: booking.serviceTitle,
        rating,
        comment: reviewComment.trim(),
      });
      setShowReviewForm(false);
      setReviewComment('');
      refreshDb();
      notify('¡Gracias! Tu reseña verificada fue publicada.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'No se pudo publicar la reseña.', 'error');
    }
  };

  const handleReportDispute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeReason.trim()) return;
    adminService.createReport({
      reporterId: currentUser.id,
      targetType: 'booking',
      targetId: booking.id,
      regionId: booking.regionId,
      reason: disputeReason.trim(),
    });
    bookingsService.updateStatus({
      bookingId: booking.id,
      status: 'disputed',
      actorId: currentUser.id,
      actorName: currentUser.fullName,
      note: `Problema reportado: ${disputeReason.trim()}`,
    });
    setShowDispute(false);
    setDisputeReason('');
    refreshDb();
    notify('Incidencia reportada y enviada a moderación de OFI CLICK.', 'info');
  };

  return (
    <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#214438] dark:text-[#C7582B]">
            <span>{STATUS_LABELS[booking.status]}</span>
            <span>·</span>
            <span>Cotización v{booking.quoteVersion}</span>
          </div>
          <h4 className="text-lg font-semibold text-[#1D252C] dark:text-[#F7F3EA] mt-1">
            {booking.serviceTitle}
          </h4>
          <div className="flex items-center gap-2.5 mt-1.5">
            <UserAvatar
              src={viewerRole === 'client' ? getPublicProAvatar(pro) : client?.avatarUrl}
              name={
                viewerRole === 'client'
                  ? pro?.commercialName || pro?.displayName || 'Especialista'
                  : client?.fullName || 'Cliente'
              }
              sizeClass="w-7 h-7"
            />
            <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">
              {viewerRole === 'client'
                ? `Freelancer: ${pro?.commercialName || pro?.displayName || 'Especialista'}`
                : `Cliente: ${client?.fullName || 'Cliente'}`}
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="font-mono-num text-lg font-bold text-[#1D252C] dark:text-[#F7F3EA]">
            {formatMXN(booking.agreedAmountMxn)}
          </div>
          <div className="text-[11px] text-[#73766F] dark:text-[#A3A89F]">
            Acuerdo directo fuera de OFI CLICK
          </div>
        </div>
      </div>

      {/* Location & Schedule */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-lg bg-[#ECE7DC]/55 dark:bg-[#161C22] text-xs">
        <div className="flex items-start gap-2">
          <CalendarClock className="w-4 h-4 text-[#C7582B] shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-[#1D252C] dark:text-[#F7F3EA]">
              {booking.scheduledDate} · {booking.scheduledTime}
            </span>
            <p className="text-[#73766F] dark:text-[#A3A89F] mt-0.5">{booking.conditions}</p>
          </div>
        </div>
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-[#214438] dark:text-[#75836A] shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-[#1D252C] dark:text-[#F7F3EA]">
              Col. {booking.colonia}
            </span>
            <p className="text-[#73766F] dark:text-[#A3A89F] mt-0.5">
              Dirección privada: {booking.privateAddress}
            </p>
          </div>
        </div>
      </div>

      {/* Progress Tracker */}
      {booking.status !== 'cancelled' && booking.status !== 'rejected' && (
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-1">
          {BOOKING_STEPS.map((step, idx) => {
            const done = currentStepIndex >= idx || booking.status === 'completed';
            return (
              <div
                key={step.key}
                className={`px-2.5 py-2 rounded-lg border text-[11px] font-medium transition-colors ${
                  done
                    ? 'border-[#214438] bg-[#214438] text-white dark:border-[#C7582B] dark:bg-[#C7582B] dark:text-white'
                    : 'border-[#DBD4C6] dark:border-white/12 text-[#73766F] dark:text-[#A3A89F]'
                }`}
              >
                {idx + 1}. {step.label}
              </div>
            );
          })}
        </div>
      )}

      {/* Reschedule Pending Banner */}
      {booking.rescheduleProposal && (
        <div className="p-3.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-300/60 text-xs space-y-2">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            Solicitud de reprogramación pendiente: {booking.rescheduleProposal.proposedDate} a las{' '}
            {booking.rescheduleProposal.proposedTime}
          </p>
          <p className="text-amber-800 dark:text-amber-300">
            Motivo: {booking.rescheduleProposal.reason}
          </p>
          {((viewerRole === 'client' && !booking.rescheduleProposal.clientAccepted) ||
            (viewerRole === 'pro' && !booking.rescheduleProposal.proAccepted)) && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleRespondReschedule(true)}
                className="px-3 py-1.5 rounded-lg bg-[#214438] hover:bg-[#183329] text-white text-xs font-semibold transition-colors"
              >
                Aceptar nueva fecha
              </button>
              <button
                type="button"
                onClick={() => handleRespondReschedule(false)}
                className="px-3 py-1.5 rounded-lg border border-amber-700/30 text-xs font-medium"
              >
                Rechazar cambio
              </button>
            </div>
          )}
        </div>
      )}

      {/* Cancellation Banner */}
      {booking.cancellationInfo && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-xs text-red-900 dark:text-red-200">
          <strong>Cancelado por {booking.cancellationInfo.cancelledByRole}:</strong>{' '}
          {booking.cancellationInfo.reason} ({formatDateMX(booking.cancellationInfo.cancelledAt, true)})
        </div>
      )}

      {/* Completion Evidence */}
      {booking.completionNotes && (
        <div className="p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-300/50 text-xs text-emerald-950 dark:text-emerald-200">
          <strong>Cierre del profesional:</strong> {booking.completionNotes}
          {booking.completionPhotos && booking.completionPhotos.length > 0 && (
            <span className="block mt-1">
              Evidencia adjunta: {booking.completionPhotos.join(', ')}
            </span>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {onViewDetail && (
          <button
            type="button"
            onClick={() => onViewDetail(booking)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#ECE7DC] dark:bg-[#161C22] border border-[#DBD4C6] dark:border-white/15 text-xs font-semibold text-[#1D252C] dark:text-[#F7F3EA] hover:border-[#214438] whitespace-nowrap"
          >
            <Eye className="w-3.5 h-3.5" />
            Ver detalle completo
          </button>
        )}
        {onOpenChat && (
          <button
            type="button"
            onClick={handleOpenChat}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 text-xs font-semibold text-[#1D252C] dark:text-[#F7F3EA] hover:bg-[#ECE7DC]/60 dark:hover:bg-white/10 whitespace-nowrap"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            Abrir chat
          </button>
        )}

        {/* Pro workflow progression */}
        {viewerRole === 'pro' && booking.status === 'quote_accepted' && (
          <button
            type="button"
            onClick={() => handleAdvanceStatus('scheduled', 'Cita confirmada en agenda.')}
            className="px-3 py-2 rounded-lg bg-[#214438] hover:bg-[#183329] text-white dark:bg-[#C7582B] dark:hover:bg-[#AC4921] text-xs font-semibold whitespace-nowrap transition-colors"
          >
            Confirmar cita programada
          </button>
        )}
        {viewerRole === 'pro' && booking.status === 'scheduled' && (
          <button
            type="button"
            onClick={() => handleAdvanceStatus('on_the_way', 'Profesional en camino al domicilio.')}
            className="px-3 py-2 rounded-lg bg-[#214438] hover:bg-[#183329] text-white dark:bg-[#C7582B] dark:hover:bg-[#AC4921] text-xs font-semibold whitespace-nowrap transition-colors"
          >
            Marcar en camino
          </button>
        )}
        {viewerRole === 'pro' && booking.status === 'on_the_way' && (
          <button
            type="button"
            onClick={() => handleAdvanceStatus('in_progress', 'Servicio iniciado en sitio.')}
            className="px-3 py-2 rounded-lg bg-[#214438] hover:bg-[#183329] text-white dark:bg-[#C7582B] dark:hover:bg-[#AC4921] text-xs font-semibold whitespace-nowrap transition-colors"
          >
            Iniciar trabajo
          </button>
        )}
        {viewerRole === 'pro' &&
          (booking.status === 'in_progress' || booking.status === 'scheduled') && (
            <button
              type="button"
              onClick={() => setShowCompleteForm((v) => !v)}
              className="px-3 py-2 rounded-lg bg-[#214438] hover:bg-[#183329] text-white text-xs font-semibold whitespace-nowrap transition-colors"
            >
              Marcar como terminado
            </button>
          )}

        {/* Client confirmation */}
        {viewerRole === 'client' && booking.status === 'pro_marked_done' && (
          <button
            type="button"
            onClick={() =>
              handleAdvanceStatus(
                'completed',
                'Cliente confirmó recepción y conclusión satisfactoria del servicio.'
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#214438] hover:bg-[#183329] text-white text-xs font-semibold whitespace-nowrap transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Confirmar finalización del servicio
          </button>
        )}

        {/* Review CTA */}
        {viewerRole === 'client' && reviewEligibility.allowed && (
          <button
            type="button"
            onClick={() => setShowReviewForm((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#C7582B] hover:bg-[#AC4921] text-white text-xs font-semibold whitespace-nowrap transition-colors"
          >
            <Star className="w-3.5 h-3.5" />
            Dejar reseña verificada
          </button>
        )}

        {isActive && (
          <>
            <button
              type="button"
              onClick={() => setShowReschedule((v) => !v)}
              className="px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 text-xs font-medium text-[#1D252C] dark:text-[#F7F3EA] whitespace-nowrap"
            >
              Reprogramar
            </button>
            <button
              type="button"
              onClick={() => setShowCancel((v) => !v)}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-red-300 dark:border-red-900/50 text-xs font-medium text-red-700 dark:text-red-300 whitespace-nowrap"
            >
              <XCircle className="w-3.5 h-3.5" />
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => setShowDispute((v) => !v)}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-900/50 text-xs font-medium text-amber-800 dark:text-amber-300 whitespace-nowrap"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Reportar problema
            </button>
          </>
        )}
      </div>

      {/* Pro completion form */}
      {showCompleteForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAdvanceStatus(
              'pro_marked_done',
              completionNotes.trim() || 'Trabajo finalizado por el profesional.',
              completionPhotoName ? [completionPhotoName] : undefined
            );
            setShowCompleteForm(false);
          }}
          className="p-4 rounded-lg bg-[#ECE7DC]/55 dark:bg-[#161C22] space-y-3 text-xs"
        >
          <p className="font-semibold text-[#1D252C] dark:text-[#F7F3EA]">
            Cierre del trabajo y nota para el cliente
          </p>
          <textarea
            value={completionNotes}
            onChange={(e) => setCompletionNotes(e.target.value)}
            rows={2}
            placeholder="Describe brevemente lo realizado y recomendaciones..."
            className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#1A2128]"
            required
          />
          <input
            type="text"
            value={completionPhotoName}
            onChange={(e) => setCompletionPhotoName(e.target.value)}
            placeholder="Nombre/referencia de foto de evidencia (opcional)"
            className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#1A2128]"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-[#214438] hover:bg-[#183329] text-white font-semibold transition-colors"
          >
            Enviar confirmación de cierre
          </button>
        </form>
      )}

      {/* Reschedule Form */}
      {showReschedule && (
        <form
          onSubmit={handleProposeReschedule}
          className="p-4 rounded-lg bg-[#ECE7DC]/55 dark:bg-[#161C22] space-y-3 text-xs"
        >
          <p className="font-semibold text-[#1D252C] dark:text-[#F7F3EA]">
            Proponer nueva fecha y horario (requiere aceptación mutua)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="date"
              value={resDate}
              onChange={(e) => setResDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#1A2128]"
              required
            />
            <input
              type="time"
              value={resTime}
              onChange={(e) => setResTime(e.target.value)}
              className="px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#1A2128]"
              required
            />
          </div>
          <input
            type="text"
            value={resReason}
            onChange={(e) => setResReason(e.target.value)}
            placeholder="Motivo de la reprogramación"
            className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#1A2128]"
            required
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-[#214438] hover:bg-[#183329] text-white dark:bg-[#C7582B] dark:hover:bg-[#AC4921] font-semibold transition-colors"
          >
            Enviar propuesta
          </button>
        </form>
      )}

      {/* Cancel Form */}
      {showCancel && (
        <form
          onSubmit={handleCancel}
          className="p-4 rounded-lg bg-red-50/70 dark:bg-red-950/25 space-y-3 text-xs"
        >
          <p className="font-semibold text-red-900 dark:text-red-200">
            Cancelar contratación (motivo obligatorio)
          </p>
          <input
            type="text"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Explica el motivo de la cancelación..."
            className="w-full px-3 py-2 rounded-lg border border-red-300 dark:border-red-800 bg-[#FFFDFA] dark:bg-[#1A2128]"
            required
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-red-700 text-white font-semibold"
          >
            Confirmar cancelación
          </button>
        </form>
      )}

      {/* Dispute Form */}
      {showDispute && (
        <form
          onSubmit={handleReportDispute}
          className="p-4 rounded-lg bg-amber-50/70 dark:bg-amber-950/25 space-y-3 text-xs"
        >
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            Reportar incidencia o desacuerdo a moderación
          </p>
          <textarea
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            rows={2}
            placeholder="Describe lo ocurrido con claridad..."
            className="w-full px-3 py-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-[#FFFDFA] dark:bg-[#1A2128]"
            required
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-amber-700 text-white font-semibold"
          >
            Registrar disputa
          </button>
        </form>
      )}

      {/* Review Form */}
      {showReviewForm && (
        <form
          onSubmit={handleSubmitReview}
          className="p-4 rounded-lg bg-[#ECE7DC]/70 dark:bg-[#161C22] space-y-3 text-xs"
        >
          <p className="font-semibold text-[#1D252C] dark:text-[#F7F3EA]">
            Califica tu experiencia con este servicio completado
          </p>
          <div className="flex items-center gap-1.5">
            {([1, 2, 3, 4, 5] as const).map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="p-1"
                aria-label={`${star} estrellas`}
              >
                <Star
                  className={`w-5 h-5 ${
                    star <= rating ? 'fill-[#C7582B] text-[#C7582B]' : 'text-[#73766F]'
                  }`}
                />
              </button>
            ))}
            <span className="ml-2 font-semibold">{rating} / 5</span>
          </div>
          <textarea
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            rows={3}
            placeholder="Cuéntale a otros vecinos de Cuautitlán Izcalli cómo fue la atención y calidad..."
            className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#1A2128]"
            required
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-[#214438] hover:bg-[#183329] text-white dark:bg-[#C7582B] dark:hover:bg-[#AC4921] font-semibold transition-colors"
          >
            Publicar reseña verificada
          </button>
        </form>
      )}

      {/* Event History */}
      <details className="text-xs text-[#73766F] dark:text-[#A3A89F]">
        <summary className="cursor-pointer font-medium hover:text-[#1D252C] dark:hover:text-[#F7F3EA]">
          Ver historial de eventos ({booking.events.length})
        </summary>
        <ul className="mt-2 space-y-1.5 pl-3 border-l border-[#DBD4C6] dark:border-white/15">
          {booking.events.map((ev) => (
            <li key={ev.id}>
              <span className="font-semibold text-[#1D252C] dark:text-[#F7F3EA]">
                {STATUS_LABELS[ev.status]}
              </span>{' '}
              · {ev.note} ({ev.actorName}, {formatDateMX(ev.createdAt, true)})
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
};
