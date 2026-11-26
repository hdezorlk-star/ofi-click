import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCheck,
  Download,
  Eye,
  FileText,
  Image as ImageIcon,
  MapPin,
  MessageSquare,
  Paperclip,
  Send,
  ShieldAlert,
  X,
} from 'lucide-react';
import type { ChatAttachmentMetadata, Conversation, Profile } from '../../types/oficlick';
import { useOfiClick } from '../../context/OfiClickContext';
import { messagesService } from '../../services/messages.service';
import { quotesService } from '../../services/quotes.service';
import { adminService } from '../../services/admin.service';
import { privateMediaStore } from '../../services/private-media.store';
import { formatDateMX, formatMXN } from '../../utils/marketplace';
import {
  STORAGE_BUCKETS,
  formatFileSize,
  getPublicProAvatar,
  readChatAttachmentFile,
} from '../../utils/media';
import { UserAvatar } from '../UserAvatar';

interface ChatWorkspaceProps {
  currentUser: Profile;
  initialConversationId?: string;
}

interface PendingChatAttachment {
  metadata: ChatAttachmentMetadata;
  previewUrl: string;
}

interface PreviewModalItem {
  url: string;
  name: string;
  mimeType: string;
  kind: 'image' | 'pdf' | 'document' | 'other';
  sizeBytes?: number;
}

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({
  currentUser,
  initialConversationId,
}) => {
  const { db, refreshDb, notify } = useOfiClick();

  const myConversations = useMemo(() => {
    return db.conversations
      .filter((c) => c.participantIds.includes(currentUser.id))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [db.conversations, currentUser.id]);

  const [selectedConvId, setSelectedConvId] = useState<string | null>(
    initialConversationId || myConversations[0]?.id || null
  );
  const [messageText, setMessageText] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<PendingChatAttachment | null>(null);
  const [readingAttachment, setReadingAttachment] = useState(false);
  const [previewModal, setPreviewModal] = useState<PreviewModalItem | null>(null);
  const [showLocationConfirm, setShowLocationConfirm] = useState(false);
  const [locationReference, setLocationReference] = useState(
    `${currentUser.colonia}, Cuautitlán Izcalli`
  );
  const [showReportBox, setShowReportBox] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (initialConversationId && myConversations.some((c) => c.id === initialConversationId)) {
      setSelectedConvId(initialConversationId);
    } else if (!selectedConvId && myConversations[0]) {
      setSelectedConvId(myConversations[0].id);
    }
  }, [initialConversationId, myConversations, selectedConvId]);

  const selectedConv: Conversation | undefined = myConversations.find(
    (c) => c.id === selectedConvId
  );

  useEffect(() => {
    if (!selectedConv) return;
    const hasUnread = db.messages.some(
      (m) =>
        m.conversationId === selectedConv.id &&
        m.senderId !== currentUser.id &&
        !m.readByIds.includes(currentUser.id)
    );
    if (hasUnread) {
      messagesService.markRead(selectedConv.id, currentUser.id);
      refreshDb();
    }
  }, [selectedConv, db.messages, currentUser.id, refreshDb]);

  const resolveOtherParticipant = (conv: Conversation) => {
    const otherId = conv.participantIds.find((id) => id !== currentUser.id) || currentUser.id;
    const prof = db.profiles.find((p) => p.id === otherId);
    const pro = db.professionals.find((pr) => pr.profileId === otherId);
    const avatarUrl = pro ? getPublicProAvatar(pro) : prof?.avatarUrl;
    return {
      profileId: otherId,
      name: pro?.commercialName || pro?.displayName || prof?.fullName || 'Usuario OFI CLICK',
      subtitle: pro ? `${pro.primaryColonia} · Especialista` : prof?.colonia || 'Cuautitlán Izcalli',
      initials: (pro?.displayName || prof?.fullName || 'OC').slice(0, 2).toUpperCase(),
      avatarUrl,
    };
  };

  const convMessages = useMemo(() => {
    if (!selectedConv) return [];
    return db.messages
      .filter((m) => m.conversationId === selectedConv.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [db.messages, selectedConv]);

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setReadingAttachment(true);
    try {
      const processed = await readChatAttachmentFile(file);
      const id = `att-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const previewRefKey = `chat-${selectedConv?.id || 'conv'}-${id}`;
      privateMediaStore.setChatAttachment(previewRefKey, {
        previewUrl: processed.previewUrl,
        mimeType: processed.mimeType,
        fileName: file.name,
        kind: processed.kind,
        sizeBytes: processed.sizeBytes,
      });
      setPendingAttachment({
        previewUrl: processed.previewUrl,
        metadata: {
          id,
          name: file.name,
          mimeType: processed.mimeType,
          sizeBytes: processed.sizeBytes,
          kind: processed.kind,
          previewRefKey,
          storageBucket: STORAGE_BUCKETS.PRIVATE_CHAT_ATTACHMENTS,
        },
      });
    } catch (err) {
      notify(err instanceof Error ? err.message : 'No se pudo cargar el archivo adjunto.', 'error');
    } finally {
      setReadingAttachment(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConv) return;
    if (selectedConv.blockedByIds.length > 0) {
      notify('Esta conversación tiene un bloqueo activo.', 'error');
      return;
    }
    const cleanText = messageText.trim();
    if (!cleanText && !pendingAttachment) return;

    messagesService.sendMessage({
      conversationId: selectedConv.id,
      senderId: currentUser.id,
      text: cleanText || (pendingAttachment ? `Archivo adjunto: ${pendingAttachment.metadata.name}` : ''),
      attachmentName: pendingAttachment?.metadata.name,
      attachmentType: pendingAttachment
        ? pendingAttachment.metadata.kind === 'image'
          ? 'image'
          : 'file'
        : undefined,
      attachment: pendingAttachment?.metadata,
    });
    setMessageText('');
    setPendingAttachment(null);
    refreshDb();
  };

  const handleShareLocation = () => {
    if (!selectedConv || !locationReference.trim()) return;
    messagesService.sendMessage({
      conversationId: selectedConv.id,
      senderId: currentUser.id,
      text: 'Compartió referencia de ubicación aproximada con consentimiento.',
      attachmentType: 'location',
      sharedLocationNote: locationReference.trim(),
    });
    setShowLocationConfirm(false);
    refreshDb();
    notify('Referencia de ubicación compartida en la conversación.', 'success');
  };

  const handleAcceptQuote = (quoteId: string) => {
    try {
      const res = quotesService.respondToQuote(quoteId, 'accepted');
      refreshDb();
      notify(
        res.booking
          ? 'Cotización aceptada. Se generó tu contratación y cita en el panel.'
          : 'Cotización aceptada.',
        'success'
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'No se pudo aceptar la cotización.', 'error');
    }
  };

  const handleRejectQuote = (quoteId: string) => {
    try {
      quotesService.respondToQuote(quoteId, 'rejected');
      refreshDb();
      notify('Cotización rechazada.', 'info');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Error al rechazar cotización.', 'error');
    }
  };

  const handleToggleBlock = () => {
    if (!selectedConv) return;
    messagesService.toggleBlock(selectedConv.id, currentUser.id);
    refreshDb();
    const isNowBlocked = !selectedConv.blockedByIds.includes(currentUser.id);
    notify(
      isNowBlocked ? 'Conversación bloqueada.' : 'Bloqueo de conversación retirado.',
      'info'
    );
  };

  const handleReportConv = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConv || !reportReason.trim()) return;
    adminService.createReport({
      reporterId: currentUser.id,
      targetType: 'conversation',
      targetId: selectedConv.id,
      regionId: currentUser.regionId || 'reg-izcalli',
      reason: reportReason.trim(),
    });
    setReportReason('');
    setShowReportBox(false);
    refreshDb();
    notify('Reporte enviado al equipo de moderación de OFI CLICK.', 'success');
  };

  if (myConversations.length === 0) {
    return (
      <div className="rounded-xl border border-[#DBD4C6] dark:border-white/10 bg-[#FFFDFA] dark:bg-[#1A2128] p-8 text-center">
        <MessageSquare className="w-10 h-10 mx-auto text-[#73766F] mb-3" />
        <h3 className="text-lg font-semibold text-[#1D252C] dark:text-[#F7F3EA]">
          Sin conversaciones activas
        </h3>
        <p className="text-sm text-[#73766F] dark:text-[#A3A89F] mt-1 max-w-md mx-auto">
          Cuando envíes o recibas una solicitud de servicio, podrás coordinar detalles,
          cotizaciones y horarios por aquí de manera privada.
        </p>
      </div>
    );
  }

  const otherInfo = selectedConv ? resolveOtherParticipant(selectedConv) : null;
  const isBlocked = (selectedConv?.blockedByIds.length || 0) > 0;
  const blockedByMe = selectedConv?.blockedByIds.includes(currentUser.id) || false;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] overflow-hidden min-h-[540px]">
        {/* Conversation list */}
        <div className="lg:col-span-4 border-b lg:border-b-0 lg:border-r border-[#DBD4C6] dark:border-white/10 flex flex-col max-h-[300px] lg:max-h-[640px]">
          <div className="px-4 py-3.5 border-b border-[#DBD4C6] dark:border-white/10 bg-[#ECE7DC]/50 dark:bg-[#161C22]">
            <h3 className="text-sm font-semibold text-[#1D252C] dark:text-[#F7F3EA]">
              Conversaciones ({myConversations.length})
            </h3>
          </div>
          <div className="overflow-y-auto divide-y divide-[#DBD4C6]/70 dark:divide-white/8">
            {myConversations.map((conv) => {
              const other = resolveOtherParticipant(conv);
              const msgs = db.messages.filter((m) => m.conversationId === conv.id);
              const lastMsg = msgs[msgs.length - 1];
              const unread = msgs.filter(
                (m) => m.senderId !== currentUser.id && !m.readByIds.includes(currentUser.id)
              ).length;
              const active = conv.id === selectedConv?.id;

              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => setSelectedConvId(conv.id)}
                  className={`w-full text-left px-4 py-3.5 transition-colors flex items-start gap-3 ${
                    active
                      ? 'bg-[#ECE7DC] dark:bg-[#2A312D]'
                      : 'hover:bg-[#ECE7DC]/45 dark:hover:bg-white/5'
                  }`}
                >
                  <UserAvatar src={other.avatarUrl} name={other.name} sizeClass="w-10 h-10" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-sm text-[#1D252C] dark:text-[#F7F3EA] truncate">
                        {other.name}
                      </span>
                      {unread > 0 && (
                        <span className="px-1.5 py-0.5 text-[11px] font-bold rounded bg-[#C7582B] text-white">
                          {unread}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#73766F] dark:text-[#A3A89F] truncate mt-0.5">
                      {lastMsg ? lastMsg.text : 'Conversación iniciada'}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active thread */}
        {selectedConv && otherInfo ? (
          <div className="lg:col-span-8 flex flex-col max-h-[640px]">
            {/* Header */}
            <div className="px-4 py-3 border-b border-[#DBD4C6] dark:border-white/10 flex flex-wrap items-center justify-between gap-3 bg-[#FFFDFA] dark:bg-[#1A2128]">
              <div className="flex items-center gap-3 min-w-0">
                <UserAvatar src={otherInfo.avatarUrl} name={otherInfo.name} sizeClass="w-9 h-9" />
                <div className="min-w-0">
                  <h4 className="font-semibold text-sm text-[#1D252C] dark:text-[#F7F3EA] truncate">
                    {otherInfo.name}
                  </h4>
                  <p className="text-xs text-[#73766F] dark:text-[#A3A89F] truncate">
                    {otherInfo.subtitle}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowReportBox((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[#DBD4C6] dark:border-white/15 text-xs font-medium text-[#1D252C] dark:text-[#F7F3EA] hover:bg-[#ECE7DC]/60 dark:hover:bg-white/10 whitespace-nowrap"
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Reportar
                </button>
                <button
                  type="button"
                  onClick={handleToggleBlock}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap ${
                    blockedByMe
                      ? 'border-[#C7582B] bg-[#C7582B]/15 text-[#1D252C] dark:text-[#F7F3EA]'
                      : 'border-[#DBD4C6] dark:border-white/15 text-[#1D252C] dark:text-[#F7F3EA] hover:bg-red-50 dark:hover:bg-red-950/30'
                  }`}
                >
                  <Ban className="w-3.5 h-3.5" />
                  {blockedByMe ? 'Desbloquear' : 'Bloquear'}
                </button>
              </div>
            </div>

            {showReportBox && (
              <form
                onSubmit={handleReportConv}
                className="px-4 py-3 bg-amber-50/70 dark:bg-amber-950/20 border-b border-amber-300/40 flex flex-wrap items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0" />
                <input
                  type="text"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Describe el motivo del reporte para moderación..."
                  className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-xs text-[#1D252C] dark:text-[#F7F3EA]"
                  required
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-[#214438] hover:bg-[#183329] text-white text-xs font-medium whitespace-nowrap transition-colors"
                >
                  Enviar reporte
                </button>
              </form>
            )}

            {/* Message stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F7F3EA]/55 dark:bg-[#12171C]">
              {convMessages.map((msg) => {
                const isMine = msg.senderId === currentUser.id;
                const linkedQuote = msg.quoteId
                  ? db.quotes.find((q) => q.id === msg.quoteId)
                  : undefined;
                const quoteVersion = linkedQuote?.versions[linkedQuote.versions.length - 1];
                const readByOther = msg.readByIds.some((id) => id !== msg.senderId);
                const resolvedAtt = privateMediaStore.resolveChatAttachment(msg.attachment);
                const attName = msg.attachment?.name || msg.attachmentName;
                const attKind =
                  msg.attachment?.kind ||
                  (msg.attachmentType === 'image' ? 'image' : 'document');

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[75%] rounded-xl px-4 py-2.5 text-sm shadow-xs ${
                        isMine
                          ? 'bg-[#214438] text-[#FFFFFF] dark:bg-[#C7582B] dark:text-white'
                          : 'bg-[#FFFDFA] dark:bg-[#1A2128] text-[#1D252C] dark:text-[#F7F3EA] border border-[#DBD4C6] dark:border-white/10'
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>

                      {/* Real Chat Attachment Rendering */}
                      {attName && (
                        <div className="mt-2 rounded-lg overflow-hidden border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] text-[#1D252C] dark:bg-[#161C22] dark:text-[#F7F3EA]">
                          {attKind === 'image' && resolvedAtt.url ? (
                            <div className="space-y-1.5 p-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewModal({
                                    url: resolvedAtt.url!,
                                    name: attName,
                                    mimeType: msg.attachment?.mimeType || 'image/jpeg',
                                    kind: 'image',
                                    sizeBytes: msg.attachment?.sizeBytes,
                                  })
                                }
                                className="block w-full text-left group relative"
                                aria-label={`Ampliar imagen ${attName}`}
                              >
                                <img
                                  src={resolvedAtt.url}
                                  alt={attName}
                                  className="w-full max-h-56 object-cover rounded-md"
                                />
                              </button>
                              <div className="flex items-center justify-between gap-2 text-[11px] px-1">
                                <span className="truncate font-medium">
                                  {attName}
                                  {msg.attachment?.sizeBytes
                                    ? ` · ${formatFileSize(msg.attachment.sizeBytes)}`
                                    : ''}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPreviewModal({
                                        url: resolvedAtt.url!,
                                        name: attName,
                                        mimeType: msg.attachment?.mimeType || 'image/jpeg',
                                        kind: 'image',
                                        sizeBytes: msg.attachment?.sizeBytes,
                                      })
                                    }
                                    className="font-semibold text-[#214438] dark:text-[#C7582B] hover:underline inline-flex items-center gap-1"
                                  >
                                    <Eye className="w-3 h-3" />
                                    Ampliar
                                  </button>
                                  <a
                                    href={resolvedAtt.url}
                                    download={attName}
                                    className="font-semibold text-[#214438] dark:text-[#C7582B] hover:underline inline-flex items-center gap-1"
                                  >
                                    <Download className="w-3 h-3" />
                                    Descargar
                                  </a>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="p-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                {attKind === 'image' ? (
                                  <ImageIcon className="w-4 h-4 shrink-0 text-[#214438] dark:text-[#C7582B]" />
                                ) : (
                                  <FileText className="w-4 h-4 shrink-0 text-[#214438] dark:text-[#C7582B]" />
                                )}
                                <div className="min-w-0">
                                  <p className="font-semibold truncate">{attName}</p>
                                  <p className="text-[11px] text-[#73766F] dark:text-[#A3A89F]">
                                    {msg.attachment?.sizeBytes
                                      ? `${formatFileSize(msg.attachment.sizeBytes)} · `
                                      : ''}
                                    {resolvedAtt.url
                                      ? msg.attachment?.mimeType || 'Archivo listo'
                                      : 'Referencia de sesión anterior (vuelve a adjuntar si cerraste la pestaña)'}
                                  </p>
                                </div>
                              </div>
                              {resolvedAtt.url && (
                                <div className="flex items-center gap-2 shrink-0">
                                  {(attKind === 'pdf' ||
                                    msg.attachment?.mimeType === 'text/plain') && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setPreviewModal({
                                          url: resolvedAtt.url!,
                                          name: attName,
                                          mimeType: msg.attachment?.mimeType || 'application/pdf',
                                          kind: attKind,
                                          sizeBytes: msg.attachment?.sizeBytes,
                                        })
                                      }
                                      className="px-2.5 py-1 rounded bg-[#ECE7DC] dark:bg-white/10 font-semibold text-[11px] inline-flex items-center gap-1"
                                    >
                                      <Eye className="w-3 h-3" />
                                      Ver
                                    </button>
                                  )}
                                  <a
                                    href={resolvedAtt.url}
                                    download={attName}
                                    className="px-2.5 py-1 rounded bg-[#214438] text-white font-semibold text-[11px] inline-flex items-center gap-1"
                                  >
                                    <Download className="w-3 h-3" />
                                    Descargar
                                  </a>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {msg.attachmentType === 'location' && msg.sharedLocationNote && (
                        <div className="mt-2 px-3 py-2 rounded-lg bg-[#214438]/15 dark:bg-[#214438]/40 text-xs flex items-center gap-2">
                          <MapPin className="w-4 h-4 shrink-0 text-[#214438] dark:text-[#C7582B]" />
                          <span>Zona compartida: {msg.sharedLocationNote}</span>
                        </div>
                      )}

                      {linkedQuote && quoteVersion && (
                        <div className="mt-2.5 p-3 rounded-lg bg-[#FFFDFA] text-[#1D252C] dark:bg-[#161C22] dark:text-[#F7F3EA] border border-[#DBD4C6] dark:border-white/15 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold uppercase tracking-wide text-[#73766F] dark:text-[#A3A89F]">
                              Cotización v{quoteVersion.versionNumber}
                            </span>
                            <span className="text-xs font-semibold text-[#214438] dark:text-[#C7582B]">
                              {linkedQuote.status === 'accepted'
                                ? 'Aceptada'
                                : linkedQuote.status === 'rejected'
                                ? 'Rechazada'
                                : 'Vigente'}
                            </span>
                          </div>
                          <p className="font-semibold text-sm">{linkedQuote.serviceName}</p>
                          <div className="text-xs text-[#73766F] dark:text-[#A3A89F] space-y-0.5">
                            <div>
                              Total:{' '}
                              <strong className="font-mono-num text-[#1D252C] dark:text-[#F7F3EA]">
                                {formatMXN(quoteVersion.totalAmount)}
                              </strong>{' '}
                              · Duración: {quoteVersion.estimatedDuration}
                            </div>
                            <div>
                              Fecha propuesta: {quoteVersion.proposedDate} {quoteVersion.proposedTime}
                            </div>
                            <div>Condiciones: {quoteVersion.conditions}</div>
                          </div>
                          {currentUser.id === linkedQuote.clientId &&
                            (linkedQuote.status === 'sent' || linkedQuote.status === 'revised') && (
                              <div className="flex flex-wrap gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleAcceptQuote(linkedQuote.id)}
                                  className="px-3 py-1.5 rounded-lg bg-[#214438] hover:bg-[#183329] text-white dark:bg-[#C7582B] dark:hover:bg-[#A8431B] text-xs font-semibold whitespace-nowrap transition-colors"
                                >
                                  Aceptar cotización
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRejectQuote(linkedQuote.id)}
                                  className="px-3 py-1.5 rounded-lg border border-[#DBD4C6] dark:border-white/20 text-xs font-medium whitespace-nowrap"
                                >
                                  Rechazar
                                </button>
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-[11px] text-[#73766F] dark:text-[#A3A89F]">
                      <span>{formatDateMX(msg.createdAt, true)}</span>
                      {isMine &&
                        (readByOther ? (
                          <CheckCheck className="w-3.5 h-3.5 text-[#214438] dark:text-[#C7582B]" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Consent-based location prompt */}
            {showLocationConfirm && (
              <div className="px-4 py-3 bg-[#ECE7DC] dark:bg-[#161C22] border-t border-[#DBD4C6] dark:border-white/10 space-y-2">
                <p className="text-xs font-medium text-[#1D252C] dark:text-[#F7F3EA]">
                  Compartir ubicación aproximada (solo visible en esta conversación):
                </p>
                <div className="flex flex-wrap gap-2">
                  <input
                    type="text"
                    value={locationReference}
                    onChange={(e) => setLocationReference(e.target.value)}
                    placeholder="Colonia o referencia cercana"
                    className="flex-1 min-w-[200px] px-3 py-1.5 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#1A2128] text-xs text-[#1D252C] dark:text-[#F7F3EA]"
                  />
                  <button
                    type="button"
                    onClick={handleShareLocation}
                    className="px-3 py-1.5 rounded-lg bg-[#214438] hover:bg-[#183329] text-white text-xs font-medium whitespace-nowrap transition-colors"
                  >
                    Confirmar envío
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLocationConfirm(false)}
                    className="px-3 py-1.5 rounded-lg border border-[#DBD4C6] dark:border-white/15 text-xs whitespace-nowrap"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Composer */}
            {isBlocked ? (
              <div className="p-4 border-t border-[#DBD4C6] dark:border-white/10 bg-red-50/70 dark:bg-red-950/20 text-xs text-red-800 dark:text-red-300 flex items-center justify-between gap-3">
                <span>
                  Esta conversación está bloqueada. No se pueden enviar nuevos mensajes.
                </span>
                {blockedByMe && (
                  <button
                    type="button"
                    onClick={handleToggleBlock}
                    className="px-3 py-1 rounded bg-[#214438] text-white font-medium whitespace-nowrap"
                  >
                    Desbloquear
                  </button>
                )}
              </div>
            ) : (
              <form
                onSubmit={handleSend}
                className="p-3 border-t border-[#DBD4C6] dark:border-white/10 bg-[#FFFDFA] dark:bg-[#1A2128] space-y-2"
              >
                {pendingAttachment && (
                  <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-[#ECE7DC] dark:bg-[#161C22] text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {pendingAttachment.metadata.kind === 'image' ? (
                        <img
                          src={pendingAttachment.previewUrl}
                          alt={pendingAttachment.metadata.name}
                          className="w-10 h-10 rounded object-cover shrink-0 border border-black/10"
                        />
                      ) : (
                        <FileText className="w-5 h-5 text-[#214438] dark:text-[#C7582B] shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{pendingAttachment.metadata.name}</p>
                        <p className="text-[11px] text-[#73766F]">
                          {formatFileSize(pendingAttachment.metadata.sizeBytes)} · Listo para enviar
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPendingAttachment(null)}
                      className="text-red-600 dark:text-red-400 font-semibold shrink-0"
                    >
                      Quitar
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,.pdf,.doc,.docx,.txt"
                    onChange={handleFilePick}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={readingAttachment}
                    onClick={() => fileInputRef.current?.click()}
                    title="Adjuntar foto o documento (JPG, PNG, WEBP, PDF, DOC, DOCX, TXT · máx. 8 MB)"
                    aria-label="Adjuntar archivo en mensaje"
                    className="p-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 text-[#73766F] hover:text-[#1D252C] dark:hover:text-[#F7F3EA]"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLocationConfirm((v) => !v)}
                    title="Compartir referencia de ubicación"
                    aria-label="Compartir referencia de ubicación"
                    className="p-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 text-[#73766F] hover:text-[#1D252C] dark:hover:text-[#F7F3EA]"
                  >
                    <MapPin className="w-4 h-4" />
                  </button>
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder="Escribe un mensaje privado..."
                    className="flex-1 px-3.5 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#ECE7DC]/40 dark:bg-[#161C22] text-sm text-[#1D252C] dark:text-[#F7F3EA] focus:outline-none focus:ring-2 focus:ring-[#214438]"
                  />
                  <button
                    type="submit"
                    disabled={readingAttachment}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#214438] hover:bg-[#183329] text-white dark:bg-[#C7582B] dark:hover:bg-[#A8431B] text-sm font-semibold whitespace-nowrap transition-colors disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Enviar</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : null}
      </div>

      {/* Attachment Lightbox / In-App Document Preview Modal */}
      {previewModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Vista previa de ${previewModal.name}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
          onClick={() => setPreviewModal(null)}
        >
          <div
            data-testid="chat-attachment-preview-modal"
            className="w-full max-w-3xl rounded-2xl bg-[#FFFDFA] dark:bg-[#1A2128] border border-white/15 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[#DBD4C6] dark:border-white/10 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">{previewModal.name}</p>
                {previewModal.sizeBytes && (
                  <p className="text-[11px] text-[#73766F]">
                    {formatFileSize(previewModal.sizeBytes)} · {previewModal.mimeType}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewModal.url}
                  download={previewModal.name}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#214438] hover:bg-[#183329] text-white text-xs font-semibold transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewModal(null)}
                  aria-label="Cerrar vista previa"
                  className="p-1.5 rounded-lg text-[#73766F] hover:bg-black/5 dark:hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto flex-1 flex items-center justify-center bg-[#ECE7DC]/40 dark:bg-[#12171C]">
              {previewModal.kind === 'image' ? (
                <img
                  src={previewModal.url}
                  alt={previewModal.name}
                  className="max-h-[72vh] max-w-full rounded-lg object-contain"
                />
              ) : previewModal.kind === 'pdf' ? (
                <iframe
                  src={previewModal.url}
                  title={previewModal.name}
                  className="w-full h-[70vh] rounded-lg border border-[#DBD4C6]"
                />
              ) : (
                <div className="text-center space-y-3 p-6">
                  <FileText className="w-12 h-12 mx-auto text-[#214438] dark:text-[#C7582B]" />
                  <p className="text-sm font-semibold">{previewModal.name}</p>
                  <p className="text-xs text-[#73766F]">
                    Usa el botón Descargar para abrir este archivo en tu dispositivo.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
