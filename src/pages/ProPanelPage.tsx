import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Bell,
  Briefcase,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  HelpCircle,
  Home,
  Image as ImageIcon,
  Images,
  Inbox,
  Lock,
  MapPin,
  MessageSquare,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  Star,
  Trash2,
  Upload,
  UserCheck,
  Wrench,
  X,
} from 'lucide-react';
import { useOfiClick } from '../context/OfiClickContext';
import { ALL_IZCALLI_COLONIAS } from '../data/izcalliLocations';
import { DashboardShell, type DashboardNavItem } from '../components/workspace/DashboardShell';
import { BookingCard } from '../components/workspace/BookingCard';
import { BookingDetailModal } from '../components/workspace/BookingDetailModal';
import { ChatWorkspace } from '../components/workspace/ChatWorkspace';
import { CalendarWorkspace } from '../components/workspace/CalendarWorkspace';
import { UserAvatar } from '../components/UserAvatar';
import { SafeImage } from '../components/SafeImage';
import { PhotoUploadBox } from '../components/media/PhotoUploadBox';
import { PortfolioGalleryModal } from '../components/media/PortfolioGalleryModal';
import { requestsService } from '../services/requests.service';
import { quotesService } from '../services/quotes.service';
import { messagesService } from '../services/messages.service';
import { servicesService } from '../services/services.service';
import { profilesService } from '../services/profiles.service';
import { reviewsService } from '../services/reviews.service';
import { notificationsService } from '../services/notifications.service';
import { adminService } from '../services/admin.service';
import { authService } from '../services/auth.service';
import { privateMediaStore } from '../services/private-media.store';
import {
  calculateQuoteTotals,
  canAccessWorkspaceRoute,
  formatDateMX,
  formatMXN,
  formatPricingLabel,
} from '../utils/marketplace';
import {
  STORAGE_BUCKETS,
  formatFileSize,
  getPublicProAvatar,
  getVerificationStageSummary,
  readAndResizePublicImage,
  readFileAsMemoryPreviewUrl,
  validateImageFile,
} from '../utils/media';
import type {
  Booking,
  PortfolioItem,
  PricingMode,
  ServiceItem,
  ServiceStatus,
  ThemePreference,
  VerificationDocKind,
} from '../types/oficlick';

interface DraftVerificationFile {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  previewRefKey: string;
  previewUrl: string;
}

interface ProPanelPageProps {
  initialTab?: string;
}

function normalizeProTab(tab?: string): string {
  switch (tab) {
    case 'dashboard':
    case undefined:
      return 'inicio';
    case 'trabajos':
      return 'contrataciones';
    case 'calendario':
      return 'agenda';
    case 'soporte':
      return 'ayuda';
    default:
      return tab;
  }
}

export const ProPanelPage: React.FC<ProPanelPageProps> = ({ initialTab = 'inicio' }) => {
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

  const [activeTab, setActiveTab] = useState(() => normalizeProTab(initialTab));
  const [activeConvId, setActiveConvId] = useState<string | undefined>(undefined);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const pro = useMemo(
    () =>
      currentUser
        ? db.professionals.find((p) => p.profileId === currentUser.id)
        : undefined,
    [db.professionals, currentUser]
  );

  // Quote builder state
  const [quotingRequestId, setQuotingRequestId] = useState<string | null>(null);
  const [editingQuoteId, setEditingQuoteId] = useState<string | undefined>(undefined);
  const [quoteServiceName, setQuoteServiceName] = useState('');
  const [quoteDesc, setQuoteDesc] = useState('');
  const [laborAmount, setLaborAmount] = useState(800);
  const [materialsAmount, setMaterialsAmount] = useState(250);
  const [additionalCharges, setAdditionalCharges] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [estimatedDuration, setEstimatedDuration] = useState('2 horas');
  const [proposedDate, setProposedDate] = useState(new Date().toISOString().slice(0, 10));
  const [proposedTime, setProposedTime] = useState('11:00');
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().slice(0, 10);
  });
  const [quoteConditions, setQuoteConditions] = useState(
    'Pago directo al finalizar el trabajo. Garantía de 30 días en mano de obra.'
  );
  const [quoteComments, setQuoteComments] = useState('');

  // Service CRUD state (create & edit)
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [srvName, setSrvName] = useState('');
  const [srvCategoryId, setSrvCategoryId] = useState(pro?.categoryIds[0] || 'cat-plomeria');
  const [srvMode, setSrvMode] = useState<PricingMode>('fixed');
  const [srvPrice, setSrvPrice] = useState('650');
  const [srvDuration, setSrvDuration] = useState('90');
  const [srvDesc, setSrvDesc] = useState('');
  const [srvConditions, setSrvConditions] = useState('Incluye diagnóstico básico.');
  const [srvMaterials, setSrvMaterials] = useState(false);
  const [srvStatus, setSrvStatus] = useState<ServiceStatus>('published');

  // Portfolio add/edit state
  const [editingPortfolioId, setEditingPortfolioId] = useState<string | null>(null);
  const [portTitle, setPortTitle] = useState('');
  const [portService, setPortService] = useState('');
  const [portCategoryId, setPortCategoryId] = useState(pro?.categoryIds[0] || 'cat-plomeria');
  const [portDesc, setPortDesc] = useState('');
  const [portColoniaDate, setPortColoniaDate] = useState('Noviembre 2026');
  const [portPrice, setPortPrice] = useState('');
  const [portDuration, setPortDuration] = useState('');
  const [portMaterials, setPortMaterials] = useState('');
  const [portPhotos, setPortPhotos] = useState<string[]>([]);
  const [portUploadError, setPortUploadError] = useState('');
  const [portUploading, setPortUploading] = useState(false);
  const [previewGalleryItem, setPreviewGalleryItem] = useState<PortfolioItem | null>(null);

  // Expanded Freelancer Profile state
  const [displayName, setDisplayName] = useState(pro?.displayName || '');
  const [commercialName, setCommercialName] = useState(pro?.commercialName || '');
  const [proAvatarUrl, setProAvatarUrl] = useState<string | undefined>(pro?.avatarUrl);
  const [avatarPublicConsent, setAvatarPublicConsent] = useState<boolean>(
    pro?.avatarPublicConsent ?? false
  );
  const [bio, setBio] = useState(pro?.bio || '');
  const [specialtiesText, setSpecialtiesText] = useState(pro?.specialties.join(', ') || '');
  const [categoryIds, setCategoryIds] = useState<string[]>(pro?.categoryIds || []);
  const [yearsExperience, setYearsExperience] = useState<number>(pro?.yearsExperience || 1);
  const [primaryColonia, setPrimaryColonia] = useState(pro?.primaryColonia || 'Centro Urbano');
  const [additionalColonias, setAdditionalColonias] = useState<string[]>(
    pro?.additionalColonias || []
  );
  const [maxTravelKm, setMaxTravelKm] = useState<number>(pro?.maxTravelKm || 10);
  const [homeService, setHomeService] = useState<boolean>(pro?.homeService ?? true);
  const [workshopService, setWorkshopService] = useState<boolean>(pro?.workshopService ?? false);
  const [urgentAttention, setUrgentAttention] = useState<boolean>(pro?.urgentAttention ?? false);
  const [published, setPublished] = useState<boolean>(pro?.published ?? true);

  // Private Verification state (INE + Frontal Face Photo stored ONLY in memory store)
  const [docLabel, setDocLabel] = useState('Identificación oficial vigente (INE)');
  const [ineDraft, setIneDraft] = useState<DraftVerificationFile | null>(null);
  const [faceDraft, setFaceDraft] = useState<DraftVerificationFile | null>(null);
  const [verConfirmed, setVerConfirmed] = useState(false);
  const [verError, setVerError] = useState('');

  // Review reply & Support ticket & Account state
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDesc, setTicketDesc] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showProfilePreviewModal, setShowProfilePreviewModal] = useState(false);

  useEffect(() => {
    setActiveTab(normalizeProTab(initialTab));
  }, [initialTab]);

  useEffect(() => {
    if (pro) {
      setDisplayName(pro.displayName);
      setCommercialName(pro.commercialName || '');
      setProAvatarUrl(pro.avatarUrl);
      setAvatarPublicConsent(pro.avatarPublicConsent ?? false);
      setBio(pro.bio);
      setSpecialtiesText(pro.specialties.join(', '));
      setCategoryIds(pro.categoryIds);
      setYearsExperience(pro.yearsExperience);
      setPrimaryColonia(pro.primaryColonia);
      setAdditionalColonias(pro.additionalColonias);
      setMaxTravelKm(pro.maxTravelKm);
      setHomeService(pro.homeService);
      setWorkshopService(pro.workshopService);
      setUrgentAttention(pro.urgentAttention);
      setPublished(pro.published);
      setSrvCategoryId(pro.categoryIds[0] || 'cat-plomeria');
      setPortCategoryId(pro.categoryIds[0] || 'cat-plomeria');
    }
  }, [pro?.id]);

  const regionColonias = useMemo(() => {
    const reg = db.regions.find((r) => r.id === (pro?.regionId || 'reg-izcalli'));
    return reg && reg.colonias.length > 0 ? reg.colonias : ALL_IZCALLI_COLONIAS;
  }, [db.regions, pro?.regionId]);

  if (!currentUser || !pro || !canAccessWorkspaceRoute(currentUser, 'pro-panel')) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold text-[#1D252C] dark:text-[#F7F3EA]">
          Panel exclusivo para freelancers registrados
        </h1>
        <p className="text-sm text-[#73766F] dark:text-[#A3A89F]">
          Inicia sesión con una cuenta de Freelancer / Profesional Independiente para gestionar tus
          solicitudes, cotizaciones, agenda y servicios.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => openAuthModal('login')}
            className="px-5 py-2.5 rounded-xl bg-[#214438] hover:bg-[#183329] text-white dark:bg-[#C7582B] dark:hover:bg-[#AC4921] dark:text-[#FFFDFA] text-sm font-semibold transition-colors"
          >
            Iniciar sesión
          </button>
        </div>
      </div>
    );
  }

  const incomingRequests = db.requests
    .filter((r) => r.recipientProfessionalIds.includes(pro.id))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const myQuotes = db.quotes
    .filter((q) => q.professionalId === pro.id)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  const myBookings = db.bookings
    .filter((b) => b.professionalId === pro.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const myServices = db.services.filter((s) => s.professionalId === pro.id);
  const myPortfolio = db.portfolios.filter((p) => p.professionalId === pro.id);
  const myReviews = db.reviews.filter((r) => r.professionalId === pro.id && !r.hiddenByAdmin);
  const myVerifications = db.verificationRequests.filter((v) => v.professionalId === pro.id);
  const myNotifications = db.notifications.filter((n) => n.profileId === currentUser.id);
  const myTickets = db.supportTickets.filter((t) => t.creatorId === currentUser.id);
  const unreadNotifs = myNotifications.filter((n) => !n.read).length;
  const unreadMsgs = db.messages.filter(
    (m) =>
      m.senderId !== currentUser.id &&
      !m.readByIds.includes(currentUser.id) &&
      db.conversations.some(
        (c) => c.id === m.conversationId && c.participantIds.includes(currentUser.id)
      )
  ).length;

  const totalQuotedPending = myQuotes
    .filter((q) => q.status === 'sent' || q.status === 'revised')
    .reduce((sum, q) => sum + (q.versions[q.versions.length - 1]?.totalAmount || 0), 0);
  const totalAgreedBookings = myBookings
    .filter((b) => b.status !== 'cancelled' && b.status !== 'rejected')
    .reduce((sum, b) => sum + b.agreedAmountMxn, 0);
  const totalCompletedOutside = myBookings
    .filter((b) => b.status === 'completed')
    .reduce((sum, b) => sum + b.agreedAmountMxn, 0);

  const navItems: DashboardNavItem[] = [
    { id: 'inicio', label: 'Inicio', icon: <Home className="w-4 h-4" /> },
    {
      id: 'solicitudes',
      label: 'Solicitudes',
      icon: <Inbox className="w-4 h-4" />,
      badge: incomingRequests.filter(
        (r) =>
          r.recipientStatuses[pro.id] === 'pending' || r.recipientStatuses[pro.id] === 'viewed'
      ).length,
    },
    { id: 'cotizaciones', label: 'Cotizaciones', icon: <FileSpreadsheet className="w-4 h-4" /> },
    { id: 'agenda', label: 'Agenda', icon: <Calendar className="w-4 h-4" /> },
    { id: 'servicios', label: 'Servicios', icon: <Wrench className="w-4 h-4" /> },
    { id: 'portafolio', label: 'Portafolio', icon: <ImageIcon className="w-4 h-4" /> },
    {
      id: 'mensajes',
      label: 'Mensajes',
      icon: <MessageSquare className="w-4 h-4" />,
      badge: unreadMsgs,
    },
    { id: 'contrataciones', label: 'Contrataciones', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'resenas', label: 'Reseñas', icon: <Star className="w-4 h-4" /> },
    { id: 'estadisticas', label: 'Estadísticas', icon: <BarChart3 className="w-4 h-4" /> },
    {
      id: 'notificaciones',
      label: 'Notificaciones',
      icon: <Bell className="w-4 h-4" />,
      badge: unreadNotifs,
    },
    { id: 'perfil', label: 'Perfil profesional', icon: <UserCheck className="w-4 h-4" /> },
    { id: 'configuracion', label: 'Configuración', icon: <Settings className="w-4 h-4" /> },
    { id: 'ayuda', label: 'Ayuda', icon: <HelpCircle className="w-4 h-4" /> },
  ];

  const handleSelectTab = (id: string) => {
    setActiveTab(id);
    navigate({ page: 'pro-panel', tab: id });
  };

  const quoteValidation = calculateQuoteTotals({
    laborAmount,
    materialsAmount,
    additionalCharges,
    discountAmount,
  });

  const handleOpenQuoteBuilder = (requestId: string, existingQuoteId?: string) => {
    const req = db.requests.find((r) => r.id === requestId);
    if (!req) return;
    setQuotingRequestId(requestId);
    setEditingQuoteId(existingQuoteId);
    if (existingQuoteId) {
      const q = db.quotes.find((item) => item.id === existingQuoteId);
      const latest = q?.versions[q.versions.length - 1];
      if (q && latest) {
        setQuoteServiceName(q.serviceName);
        setQuoteDesc(q.description);
        setLaborAmount(latest.laborAmount);
        setMaterialsAmount(latest.materialsAmount);
        setAdditionalCharges(latest.additionalCharges);
        setDiscountAmount(latest.discountAmount);
        setEstimatedDuration(latest.estimatedDuration);
        setProposedDate(latest.proposedDate);
        setProposedTime(latest.proposedTime);
        setValidUntil(latest.validUntil);
        setQuoteConditions(latest.conditions);
        setQuoteComments(latest.comments);
      }
    } else {
      setQuoteServiceName(req.title);
      setQuoteDesc(req.description);
      setProposedDate(req.desiredDate);
    }
    handleSelectTab('cotizaciones');
  };

  const handleSendQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quotingRequestId) return;
    const req = db.requests.find((r) => r.id === quotingRequestId);
    if (!req) return;
    if (!quoteValidation.valid) {
      notify(quoteValidation.error || 'Revisa los montos de la cotización.', 'error');
      return;
    }
    quotesService.sendOrReviseQuote({
      quoteId: editingQuoteId,
      requestId: req.id,
      professionalId: pro.id,
      clientId: req.clientId,
      serviceName: quoteServiceName.trim() || req.title,
      description: quoteDesc.trim() || req.description,
      versionData: {
        laborAmount,
        materialsAmount,
        additionalCharges,
        discountAmount,
        totalAmount: quoteValidation.totalAmount,
        estimatedDuration,
        proposedDate,
        proposedTime,
        validUntil,
        conditions: quoteConditions,
        comments: quoteComments || 'Cotización enviada desde panel de freelancer.',
      },
    });
    setQuotingRequestId(null);
    setEditingQuoteId(undefined);
    refreshDb();
    notify('Cotización enviada y notificada al cliente.', 'success');
  };

  const resetServiceForm = () => {
    setEditingServiceId(null);
    setSrvName('');
    setSrvCategoryId(pro.categoryIds[0] || 'cat-plomeria');
    setSrvMode('fixed');
    setSrvPrice('650');
    setSrvDuration('90');
    setSrvDesc('');
    setSrvConditions('Incluye diagnóstico básico.');
    setSrvMaterials(false);
    setSrvStatus('published');
  };

  const handleEditService = (srv: ServiceItem) => {
    setEditingServiceId(srv.id);
    setSrvName(srv.name);
    setSrvCategoryId(srv.categoryId);
    setSrvMode(srv.pricingMode);
    setSrvPrice(srv.priceAmount !== undefined ? String(srv.priceAmount) : '');
    setSrvDuration(String(srv.estimatedDurationMin));
    setSrvDesc(srv.description);
    setSrvConditions(srv.conditions);
    setSrvMaterials(srv.materialsIncluded);
    setSrvStatus(srv.status);
  };

  const handleSaveService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvName.trim() || !srvDesc.trim()) return;
    const existing = editingServiceId
      ? myServices.find((s) => s.id === editingServiceId)
      : undefined;
    const nextSrv: ServiceItem = {
      id: existing?.id || `srv-${Date.now().toString(36)}`,
      professionalId: pro.id,
      categoryId: srvCategoryId,
      name: srvName.trim(),
      description: srvDesc.trim(),
      photos: existing?.photos || ['/src/assets/images/service_plumbing_work_1795488295847.jpg'],
      pricingMode: srvMode,
      priceAmount: srvMode === 'custom_quote' ? undefined : Number(srvPrice) || undefined,
      estimatedDurationMin: Number(srvDuration) || 60,
      materialsIncluded: srvMaterials,
      conditions: srvConditions.trim(),
      coverageColonias: [pro.primaryColonia, ...pro.additionalColonias],
      status: srvStatus,
      urgentAvailable: pro.urgentAttention,
      isDemo: false,
    };
    servicesService.saveService(nextSrv);
    resetServiceForm();
    refreshDb();
    notify(
      existing ? 'Servicio actualizado correctamente.' : 'Servicio guardado en tu catálogo.',
      'success'
    );
  };

  const resetPortfolioForm = () => {
    setEditingPortfolioId(null);
    setPortTitle('');
    setPortService('');
    setPortCategoryId(pro.categoryIds[0] || 'cat-plomeria');
    setPortDesc('');
    setPortColoniaDate('Noviembre 2026');
    setPortPrice('');
    setPortDuration('');
    setPortMaterials('');
    setPortPhotos([]);
    setPortUploadError('');
  };

  const handleEditPortfolio = (item: PortfolioItem) => {
    setEditingPortfolioId(item.id);
    setPortTitle(item.title);
    setPortService(item.servicePerformed);
    setPortCategoryId(item.categoryId || pro.categoryIds[0] || 'cat-plomeria');
    setPortDesc(item.description);
    setPortColoniaDate(item.approximateDate);
    setPortPrice(item.optionalPrice !== undefined ? String(item.optionalPrice) : '');
    setPortDuration(item.approximateDuration || '');
    setPortMaterials(item.optionalMaterials || '');
    setPortPhotos(item.photos || []);
    setPortUploadError('');
  };

  const handleAddPortfolioPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setPortUploadError('');
    setPortUploading(true);
    try {
      const processed: string[] = [];
      for (const file of files) {
        const validation = validateImageFile(file);
        if (!validation.valid) {
          throw new Error(`${file.name}: ${validation.error}`);
        }
        const resized = await readAndResizePublicImage(file, 1280, 0.84);
        processed.push(resized);
      }
      setPortPhotos((prev) => [...prev, ...processed]);
    } catch (err) {
      setPortUploadError(
        err instanceof Error ? err.message : 'No se pudieron procesar algunas fotografías.'
      );
    } finally {
      setPortUploading(false);
    }
  };

  const movePortfolioPhoto = (idx: number, direction: -1 | 1) => {
    setPortPhotos((prev) => {
      const target = idx + direction;
      if (target < 0 || target >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(idx, 1);
      copy.splice(target, 0, moved);
      return copy;
    });
  };

  const removePortfolioPhoto = (idx: number) => {
    setPortPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSavePortfolio = (e: React.FormEvent) => {
    e.preventDefault();
    setPortUploadError('');
    if (!portTitle.trim() || !portDesc.trim()) return;
    if (portPhotos.length === 0) {
      setPortUploadError('Sube al menos una fotografía del proyecto antes de guardar.');
      return;
    }
    const existing = editingPortfolioId
      ? myPortfolio.find((p) => p.id === editingPortfolioId)
      : undefined;
    const parsedPrice = Number(portPrice);
    if (existing) {
      servicesService.updatePortfolioItem({
        ...existing,
        title: portTitle.trim(),
        categoryId: portCategoryId,
        servicePerformed: portService.trim() || portTitle.trim(),
        description: portDesc.trim(),
        approximateDate: portColoniaDate.trim() || existing.approximateDate,
        optionalPrice: Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : undefined,
        approximateDuration: portDuration.trim() || undefined,
        optionalMaterials: portMaterials.trim() || undefined,
        photos: portPhotos,
        storageBucket: STORAGE_BUCKETS.PORTFOLIO_PHOTOS,
      });
      notify('Proyecto y fotografías actualizados en tu portafolio.', 'success');
    } else {
      servicesService.addPortfolioItem({
        id: `port-${Date.now().toString(36)}`,
        professionalId: pro.id,
        title: portTitle.trim(),
        categoryId: portCategoryId,
        description: portDesc.trim(),
        photos: portPhotos,
        approximateDate: portColoniaDate.trim() || 'Noviembre 2026',
        servicePerformed: portService.trim() || portTitle.trim(),
        approximateDuration: portDuration.trim() || undefined,
        optionalPrice: Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : undefined,
        optionalMaterials: portMaterials.trim() || undefined,
        tags: [pro.primaryColonia],
        origin: 'uploaded_portfolio',
        storageBucket: STORAGE_BUCKETS.PORTFOLIO_PHOTOS,
        isDemo: false,
      });
      notify('Proyecto con fotografías agregado a tu portafolio.', 'success');
    }
    resetPortfolioForm();
    refreshDb();
  };

  const handleVerificationFileSelect = async (
    kind: VerificationDocKind,
    file?: File
  ) => {
    if (!file) return;
    setVerError('');
    const allowPdf = kind === 'ine';
    const check = validateImageFile(file, { allowPdf });
    if (!check.valid) {
      setVerError(check.error || 'Archivo inválido.');
      return;
    }
    try {
      const previewUrl = await readFileAsMemoryPreviewUrl(file);
      const refKey = `ver-${pro.id}-${kind}-${Date.now().toString(36)}`;
      const labelText =
        kind === 'ine'
          ? docLabel.trim() || 'Identificación oficial vigente (INE)'
          : 'Fotografía frontal de rostro (verificación privada)';
      privateMediaStore.setPreview(refKey, {
        previewUrl,
        mimeType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        fileName: file.name,
        docKind: kind,
        isDemo: false,
        createdAt: new Date().toISOString(),
      });
      const draft: DraftVerificationFile = {
        fileName: file.name,
        mimeType: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'),
        sizeBytes: file.size,
        previewRefKey: refKey,
        previewUrl,
      };
      if (kind === 'ine') {
        if (ineDraft?.previewRefKey) privateMediaStore.removePreview(ineDraft.previewRefKey);
        setIneDraft(draft);
      } else {
        if (faceDraft?.previewRefKey) privateMediaStore.removePreview(faceDraft.previewRefKey);
        setFaceDraft(draft);
      }
    } catch (err) {
      setVerError(err instanceof Error ? err.message : 'No se pudo cargar el archivo.');
    }
  };

  const verificationStage = getVerificationStageSummary(myVerifications, pro.verificationLevel);

  return (
    <DashboardShell
      title={pro.displayName}
      subtitle={`Col. ${pro.primaryColonia} · Nivel verificación ${pro.verificationLevel}/4`}
      roleLabel="Panel de freelancer"
      navItems={navItems}
      activeTab={activeTab}
      onSelectTab={handleSelectTab}
      headerActions={
        <button
          type="button"
          onClick={() => setShowProfilePreviewModal(true)}
          className="px-3.5 py-2 rounded-xl border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#1A2128] text-[#1D252C] dark:text-[#F7F3EA] text-xs font-semibold whitespace-nowrap inline-flex items-center gap-1.5 hover:border-[#214438] dark:hover:border-[#C7582B] transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          Vista previa de mi perfil
        </button>
      }
    >
      {/* 1. Inicio */}
      {activeTab === 'inicio' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-4">
              <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">Importes cotizados vigentes</p>
              <p className="font-mono-num text-2xl font-bold text-[#1D252C] dark:text-[#F7F3EA] mt-1">
                {formatMXN(totalQuotedPending)}
              </p>
              <p className="text-[11px] text-[#73766F] dark:text-[#A3A89F] mt-1">Propuestas pendientes de aceptación</p>
            </div>
            <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-4">
              <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">Importes acordados</p>
              <p className="font-mono-num text-2xl font-bold text-[#214438] dark:text-[#C7582B] mt-1">
                {formatMXN(totalAgreedBookings)}
              </p>
              <p className="text-[11px] text-[#73766F] dark:text-[#A3A89F] mt-1">Citas aceptadas en curso o cerradas</p>
            </div>
            <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-4">
              <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">Cobro acordado fuera de OFI CLICK</p>
              <p className="font-mono-num text-2xl font-bold text-[#1D252C] dark:text-[#F7F3EA] mt-1">
                {formatMXN(totalCompletedOutside)}
              </p>
              <p className="text-[11px] text-[#73766F] dark:text-[#A3A89F] mt-1">
                Servicios completados (pago directo sin comisión)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="rounded-xl border border-[#DBD4C6] dark:border-white/10 bg-[#ECE7DC]/55 dark:bg-[#1A2128] p-4 text-xs">
              <span className="text-[#73766F] dark:text-[#A3A89F]">Solicitudes recibidas</span>
              <div className="font-mono-num text-xl font-bold text-[#1D252C] dark:text-[#F7F3EA] mt-1">{incomingRequests.length}</div>
            </div>
            <div className="rounded-xl border border-[#DBD4C6] dark:border-white/10 bg-[#ECE7DC]/55 dark:bg-[#1A2128] p-4 text-xs">
              <span className="text-[#73766F] dark:text-[#A3A89F]">Trabajos completados</span>
              <div className="font-mono-num text-xl font-bold text-[#1D252C] dark:text-[#F7F3EA] mt-1">{pro.completedJobsCount}</div>
            </div>
            <div className="rounded-xl border border-[#DBD4C6] dark:border-white/10 bg-[#ECE7DC]/55 dark:bg-[#1A2128] p-4 text-xs">
              <span className="text-[#73766F] dark:text-[#A3A89F]">Calificación promedio</span>
              <div className="font-mono-num text-xl font-bold text-[#1D252C] dark:text-[#F7F3EA] mt-1">{pro.ratingAvg.toFixed(1)} / 5</div>
            </div>
            <div className="rounded-xl border border-[#DBD4C6] dark:border-white/10 bg-[#ECE7DC]/55 dark:bg-[#1A2128] p-4 text-xs">
              <span className="text-[#73766F] dark:text-[#A3A89F]">Tasa de respuesta</span>
              <div className="font-mono-num text-xl font-bold text-[#1D252C] dark:text-[#F7F3EA] mt-1">{pro.responseRatePercent}%</div>
            </div>
          </div>

          {myBookings.slice(0, 2).map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              currentUser={currentUser}
              viewerRole="pro"
              onViewDetail={(bk) => setSelectedBooking(bk)}
              onOpenChat={(convId) => {
                setActiveConvId(convId);
                handleSelectTab('mensajes');
              }}
            />
          ))}
        </div>
      )}

      {/* 2. Solicitudes */}
      {activeTab === 'solicitudes' && (
        <div className="space-y-4">
          {incomingRequests.length === 0 ? (
            <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-8 text-center text-sm text-[#73766F] dark:text-[#A3A89F]">
              No tienes solicitudes nuevas asignadas en este momento.
            </div>
          ) : (
            incomingRequests.map((req) => {
              const client = db.profiles.find((p) => p.id === req.clientId);
              const myStatus = req.recipientStatuses[pro.id] || 'pending';
              const existingQuote = myQuotes.find((q) => q.requestId === req.id);

              return (
                <div
                  key={req.id}
                  className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <UserAvatar
                        src={client?.avatarUrl}
                        name={client?.fullName || 'Cliente'}
                        sizeClass="w-10 h-10 mt-0.5"
                      />
                      <div>
                        <div className="text-xs font-semibold uppercase text-[#214438] dark:text-[#C7582B]">
                          Urgencia: {req.urgency} · Col. {req.colonia} · Mi estado: {myStatus}
                        </div>
                        <h3 className="text-lg font-bold text-[#1D252C] dark:text-[#F7F3EA] mt-0.5">
                          {req.title}
                        </h3>
                        <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">
                          Cliente: {client?.fullName || 'Vecino'} · Fecha deseada: {req.desiredDate} (
                          {req.desiredTimeSlot})
                        </p>
                      </div>
                    </div>
                    {req.optionalBudgetMxn && (
                      <div className="text-right text-xs">
                        <span className="text-[#73766F] dark:text-[#A3A89F]">Presupuesto orientativo</span>
                        <div className="font-mono-num font-bold text-sm text-[#1D252C] dark:text-[#F7F3EA]">{formatMXN(req.optionalBudgetMxn)}</div>
                      </div>
                    )}
                  </div>

                  <p className="text-sm text-[#1D252C]/85 dark:text-[#F7F3EA]/85">
                    {req.description}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleOpenQuoteBuilder(req.id, existingQuote?.id)}
                      className="px-4 py-2 rounded-xl bg-[#214438] hover:bg-[#183329] text-white dark:bg-[#C7582B] dark:hover:bg-[#AC4921] dark:text-[#FFFDFA] text-xs font-semibold whitespace-nowrap transition-colors"
                    >
                      {existingQuote ? 'Editar cotización' : 'Enviar cotización'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        requestsService.updateRecipientStatus(req.id, pro.id, 'info_requested');
                        const conv = messagesService.getOrCreateConversation({
                          participantIds: [req.clientId, currentUser.id],
                          requestId: req.id,
                        });
                        refreshDb();
                        setActiveConvId(conv.id);
                        handleSelectTab('mensajes');
                      }}
                      className="px-3.5 py-2 rounded-xl border border-[#DBD4C6] dark:border-white/15 text-[#1D252C] dark:text-[#F7F3EA] text-xs font-medium whitespace-nowrap"
                    >
                      Pedir más información
                    </button>
                    {myStatus !== 'rejected' && !existingQuote && (
                      <button
                        type="button"
                        onClick={() => {
                          requestsService.updateRecipientStatus(req.id, pro.id, 'rejected');
                          refreshDb();
                          notify('Solicitud rechazada.', 'info');
                        }}
                        className="px-3.5 py-2 rounded-xl border border-red-300 text-red-700 dark:text-red-300 text-xs font-medium whitespace-nowrap"
                      >
                        Rechazar
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 3. Cotizaciones */}
      {activeTab === 'cotizaciones' && (
        <div className="space-y-6">
          {quotingRequestId && (
            <form
              onSubmit={handleSendQuote}
              className="rounded-xl border border-[#C7582B]/60 bg-[#FFFDFA] dark:bg-[#1A2128] p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-[#1D252C] dark:text-[#F7F3EA]">
                  {editingQuoteId ? 'Nueva versión de cotización' : 'Crear cotización transparente'}
                </h3>
                <button
                  type="button"
                  onClick={() => setQuotingRequestId(null)}
                  className="text-xs text-[#73766F] dark:text-[#A3A89F] hover:underline"
                >
                  Cerrar editor
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Nombre del servicio</label>
                  <input
                    type="text"
                    value={quoteServiceName}
                    onChange={(e) => setQuoteServiceName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Duración estimada</label>
                  <input
                    type="text"
                    value={estimatedDuration}
                    onChange={(e) => setEstimatedDuration(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Mano de obra (MXN)</label>
                  <input
                    type="number"
                    min={0}
                    value={laborAmount}
                    onChange={(e) => setLaborAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Materiales (MXN)</label>
                  <input
                    type="number"
                    min={0}
                    value={materialsAmount}
                    onChange={(e) => setMaterialsAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Cargos extra</label>
                  <input
                    type="number"
                    min={0}
                    value={additionalCharges}
                    onChange={(e) => setAdditionalCharges(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Descuento</label>
                  <input
                    type="number"
                    min={0}
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Fecha propuesta</label>
                  <input
                    type="date"
                    value={proposedDate}
                    onChange={(e) => setProposedDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Hora propuesta</label>
                  <input
                    type="time"
                    value={proposedTime}
                    onChange={(e) => setProposedTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Vigencia hasta</label>
                  <input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Condiciones y garantía</label>
                <input
                  type="text"
                  value={quoteConditions}
                  onChange={(e) => setQuoteConditions(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                  required
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#DBD4C6] dark:border-white/10">
                <div className="text-sm">
                  {quoteValidation.valid ? (
                    <span>
                      Total cotizado:{' '}
                      <strong className="font-mono-num text-lg text-[#214438] dark:text-[#C7582B]">{formatMXN(quoteValidation.totalAmount)}</strong>
                    </span>
                  ) : (
                    <span className="text-red-600 text-xs font-semibold">
                      {quoteValidation.error}
                    </span>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={!quoteValidation.valid}
                  className="px-5 py-2.5 rounded-xl bg-[#214438] hover:bg-[#183329] text-white dark:bg-[#C7582B] dark:hover:bg-[#AC4921] dark:text-[#FFFDFA] text-sm font-semibold disabled:opacity-50 transition-colors"
                >
                  Enviar cotización al cliente
                </button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {myQuotes.length === 0 ? (
              <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-8 text-center text-sm text-[#73766F] dark:text-[#A3A89F]">
                Aún no has enviado cotizaciones. Selecciona una solicitud entrante para responder.
              </div>
            ) : (
              myQuotes.map((q) => {
                const latest = q.versions[q.versions.length - 1];
                const client = db.profiles.find((p) => p.id === q.clientId);
                return (
                  <div
                    key={q.id}
                    className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-5 flex flex-wrap items-center justify-between gap-4 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <UserAvatar
                        src={client?.avatarUrl}
                        name={client?.fullName || 'Cliente'}
                        sizeClass="w-9 h-9"
                      />
                      <div>
                        <div className="text-xs font-semibold uppercase text-[#214438] dark:text-[#C7582B]">
                          v{latest.versionNumber} · Estado: {q.status}
                        </div>
                        <h4 className="font-bold text-[#1D252C] dark:text-[#F7F3EA]">
                          {q.serviceName}
                        </h4>
                        <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">
                          Cliente: {client?.fullName || 'Cliente'} · Propuesta: {latest.proposedDate}{' '}
                          {latest.proposedTime} · Válida hasta {latest.validUntil}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono-num text-lg font-bold text-[#214438] dark:text-[#C7582B]">{formatMXN(latest.totalAmount)}</span>
                      {(q.status === 'sent' || q.status === 'revised') && (
                        <button
                          type="button"
                          onClick={() => handleOpenQuoteBuilder(q.requestId, q.id)}
                          className="px-3 py-1.5 rounded-lg border border-[#DBD4C6] dark:border-white/15 text-xs font-semibold"
                        >
                          Revisar / Nueva versión
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 4. Agenda */}
      {activeTab === 'agenda' && <CalendarWorkspace pro={pro} />}

      {/* 5. Servicios (Crear + Editar + Pausar + Eliminar) */}
      {activeTab === 'servicios' && (
        <div className="space-y-6">
          <form
            onSubmit={handleSaveService}
            className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold flex items-center gap-2 text-[#1D252C] dark:text-[#F7F3EA]">
                {editingServiceId ? (
                  <Edit3 className="w-4 h-4 text-[#C7582B]" />
                ) : (
                  <Plus className="w-4 h-4 text-[#C7582B]" />
                )}
                {editingServiceId
                  ? 'Editar servicio seleccionado'
                  : 'Publicar nuevo servicio en tu catálogo'}
              </h3>
              {editingServiceId && (
                <button
                  type="button"
                  onClick={resetServiceForm}
                  className="text-xs text-[#73766F] dark:text-[#A3A89F] hover:underline"
                >
                  Cancelar edición
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                value={srvName}
                onChange={(e) => setSrvName(e.target.value)}
                placeholder="Nombre del servicio"
                className="px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                required
              />
              <select
                value={srvCategoryId}
                onChange={(e) => setSrvCategoryId(e.target.value)}
                className="px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
              >
                {db.categories
                  .filter((c) => c.active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
              <select
                value={srvMode}
                onChange={(e) => setSrvMode(e.target.value as PricingMode)}
                className="px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
              >
                <option value="fixed">Precio fijo</option>
                <option value="hourly">Por hora</option>
                <option value="visit">Por visita diagnóstica</option>
                <option value="unit">Por unidad / equipo</option>
                <option value="from">Desde</option>
                <option value="custom_quote">Cotización personalizada</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {srvMode !== 'custom_quote' && (
                <input
                  type="number"
                  min={0}
                  value={srvPrice}
                  onChange={(e) => setSrvPrice(e.target.value)}
                  placeholder="Tarifa MXN"
                  className="px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                />
              )}
              <input
                type="number"
                min={15}
                value={srvDuration}
                onChange={(e) => setSrvDuration(e.target.value)}
                placeholder="Duración (min)"
                className="px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
              />
              <select
                value={srvStatus}
                onChange={(e) => setSrvStatus(e.target.value as ServiceStatus)}
                className="px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
              >
                <option value="published">Publicado</option>
                <option value="draft">Borrador</option>
                <option value="paused">Pausado</option>
              </select>
            </div>
            <input
              type="text"
              value={srvConditions}
              onChange={(e) => setSrvConditions(e.target.value)}
              placeholder="Condiciones (ej. Incluye diagnóstico básico)"
              className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
            />
            <textarea
              value={srvDesc}
              onChange={(e) => setSrvDesc(e.target.value)}
              rows={2}
              placeholder="Qué incluye el servicio, alcance y detalles..."
              className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
              required
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={srvMaterials}
                  onChange={(e) => setSrvMaterials(e.target.checked)}
                />
                Incluye materiales básicos
              </label>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#214438] hover:bg-[#183329] text-white dark:bg-[#C7582B] dark:hover:bg-[#AC4921] dark:text-[#FFFDFA] text-xs font-semibold transition-colors"
              >
                {editingServiceId ? 'Actualizar servicio' : 'Guardar servicio'}
              </button>
            </div>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myServices.map((srv) => (
              <div
                key={srv.id}
                className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-4 space-y-2 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-semibold uppercase text-[#214438] dark:text-[#C7582B]">
                      {srv.status} · {formatPricingLabel(srv.pricingMode, srv.priceAmount)}
                    </span>
                    <h4 className="font-bold text-[#1D252C] dark:text-[#F7F3EA]">{srv.name}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleEditService(srv)}
                      className="text-xs font-medium text-[#1D252C] dark:text-[#F7F3EA] hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        servicesService.saveService({
                          ...srv,
                          status: srv.status === 'published' ? 'paused' : 'published',
                        });
                        refreshDb();
                      }}
                      className="text-xs font-medium text-[#214438] dark:text-[#C7582B] hover:underline"
                    >
                      {srv.status === 'published' ? 'Pausar' : 'Publicar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (editingServiceId === srv.id) resetServiceForm();
                        servicesService.deleteService(srv.id);
                        refreshDb();
                        notify('Servicio eliminado del catálogo.', 'info');
                      }}
                      className="text-red-600 dark:text-red-400"
                      aria-label="Eliminar servicio"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">{srv.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Portafolio (Agregar múltiples fotos, Reordenar, Editar y Eliminar) */}
      {activeTab === 'portafolio' && (
        <div className="space-y-6">
          <form
            onSubmit={handleSavePortfolio}
            className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold">
                {editingPortfolioId
                  ? 'Editar proyecto del portafolio'
                  : 'Agregar proyecto con fotografías al portafolio'}
              </h3>
              {editingPortfolioId && (
                <button
                  type="button"
                  onClick={resetPortfolioForm}
                  className="text-xs text-[#73766F] dark:text-[#A3A89F] hover:underline"
                >
                  Cancelar edición
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Título del trabajo *</label>
                <input
                  type="text"
                  value={portTitle}
                  onChange={(e) => setPortTitle(e.target.value)}
                  placeholder="Ej. Remodelación hidráulica"
                  className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Categoría</label>
                <select
                  value={portCategoryId}
                  onChange={(e) => setPortCategoryId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                >
                  {db.categories
                    .filter((c) => c.active)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Servicio realizado</label>
                <input
                  type="text"
                  value={portService}
                  onChange={(e) => setPortService(e.target.value)}
                  placeholder="Ej. Instalación de tubería"
                  className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Fecha aproximada</label>
                <input
                  type="text"
                  value={portColoniaDate}
                  onChange={(e) => setPortColoniaDate(e.target.value)}
                  placeholder="Ej. Noviembre 2026"
                  className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">Precio referencial (MXN, opcional)</label>
                <input
                  type="number"
                  min={0}
                  value={portPrice}
                  onChange={(e) => setPortPrice(e.target.value)}
                  placeholder="Ej. 2400"
                  className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Duración aproximada (opcional)</label>
                <input
                  type="text"
                  value={portDuration}
                  onChange={(e) => setPortDuration(e.target.value)}
                  placeholder="Ej. 4 horas"
                  className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Materiales (opcional)</label>
                <input
                  type="text"
                  value={portMaterials}
                  onChange={(e) => setPortMaterials(e.target.value)}
                  placeholder="Ej. Cobre 1/2, válvulas esfera"
                  className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Descripción del proyecto *</label>
              <textarea
                value={portDesc}
                onChange={(e) => setPortDesc(e.target.value)}
                rows={2}
                placeholder="Describe el reto, solución y acabado logrado..."
                className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                required
              />
            </div>

            {/* Multi-photo manager */}
            <div className="rounded-xl border border-dashed border-[#DBD4C6] dark:border-white/25 bg-[#ECE7DC]/55 dark:bg-[#161C22] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-[#1D252C] dark:text-[#F7F3EA]">
                    Fotografías del proyecto (<span className="font-mono-num">{portPhotos.length}</span>) *
                  </p>
                  <p className="text-[11px] text-[#73766F] dark:text-[#A3A89F]">
                    Puedes subir 1 o varias fotografías (JPG, PNG o WEBP · Máx. 5 MB c/u), reordenarlas o eliminarlas antes de guardar.
                  </p>
                </div>
                <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#214438] hover:bg-[#183329] text-white text-xs font-semibold cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{portUploading ? 'Procesando...' : 'Subir una o varias fotos'}</span>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleAddPortfolioPhotos}
                    className="sr-only"
                  />
                </label>
              </div>

              {portUploadError && (
                <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
                  {portUploadError}
                </p>
              )}

              {portPhotos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {portPhotos.map((photo, idx) => (
                    <div
                      key={`draft-photo-${idx}`}
                      className="rounded-lg border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] overflow-hidden"
                    >
                      <div className="relative h-24">
                        <SafeImage
                          src={photo}
                          alt={`Vista previa foto ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-mono-num">
                          #{idx + 1}
                        </span>
                      </div>
                      <div className="p-1.5 flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => movePortfolioPhoto(idx, -1)}
                            disabled={idx === 0}
                            aria-label={`Mover foto ${idx + 1} a la izquierda`}
                            className="p-1 rounded border border-[#DBD4C6] dark:border-white/15 disabled:opacity-35"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => movePortfolioPhoto(idx, 1)}
                            disabled={idx === portPhotos.length - 1}
                            aria-label={`Mover foto ${idx + 1} a la derecha`}
                            className="p-1 rounded border border-[#DBD4C6] dark:border-white/15 disabled:opacity-35"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removePortfolioPhoto(idx)}
                          aria-label={`Eliminar foto ${idx + 1}`}
                          className="p-1 rounded text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#214438] hover:bg-[#183329] text-white dark:bg-[#C7582B] dark:hover:bg-[#AC4921] text-xs font-semibold transition-colors"
            >
              {editingPortfolioId ? 'Guardar cambios del proyecto' : 'Publicar proyecto en portafolio'}
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {myPortfolio.map((item) => {
              const cat = db.categories.find((c) => c.id === item.categoryId);
              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] overflow-hidden flex flex-col text-sm"
                >
                  {item.photos.length > 0 && (
                    <div className="relative h-40">
                      <SafeImage
                        src={item.photos[0]}
                        alt={item.title}
                        fallbackLabel={item.title}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/70 text-white text-[11px] font-mono-num">
                        <Images className="w-3 h-3" />
                        {item.photos.length} {item.photos.length === 1 ? 'foto' : 'fotos'}
                      </span>
                    </div>
                  )}
                  <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase text-[#214438] dark:text-[#C7582B]">
                          {item.origin === 'oficlick_completed'
                            ? 'Trabajo completado en OFI CLICK'
                            : 'Fotografía aportada al portafolio'}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleEditPortfolio(item)}
                            className="text-xs font-medium text-[#214438] dark:text-[#C7582B] hover:underline"
                          >
                            Editar / Agregar fotos
                          </button>
                          {item.origin === 'uploaded_portfolio' && (
                            <button
                              type="button"
                              onClick={() => {
                                if (editingPortfolioId === item.id) resetPortfolioForm();
                                servicesService.deletePortfolioItem(item.id);
                                refreshDb();
                                notify('Elemento eliminado del portafolio.', 'info');
                              }}
                              className="text-red-600 dark:text-red-400"
                              aria-label="Eliminar del portafolio"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                      <h4 className="font-bold">{item.title}</h4>
                      {cat && (
                        <p className="text-[11px] text-[#73766F] dark:text-[#A3A89F] font-medium">
                          {cat.name} · {item.servicePerformed}
                        </p>
                      )}
                      <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">{item.description}</p>
                      {item.photos.length > 1 && (
                        <div className="flex items-center gap-1.5 pt-1 overflow-x-auto">
                          {item.photos.slice(0, 4).map((thumb, idx) => (
                            <button
                              key={`${item.id}-thumb-${idx}`}
                              type="button"
                              onClick={() => setPreviewGalleryItem(item)}
                              className="w-12 h-9 rounded overflow-hidden border border-[#DBD4C6] dark:border-white/15 shrink-0"
                            >
                              <SafeImage src={thumb} alt={`Miniatura ${idx + 1}`} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="pt-2 border-t border-[#DBD4C6] dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#73766F] dark:text-[#A3A89F]">
                      <span>
                        {item.approximateDate}
                        {item.approximateDuration ? ` · ${item.approximateDuration}` : ''}
                        {item.optionalPrice ? (
                          <span className="font-mono-num"> · Ref. {formatMXN(item.optionalPrice)}</span>
                        ) : (
                          ''
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPreviewGalleryItem(item)}
                        className="font-semibold text-[#214438] dark:text-[#C7582B] hover:underline"
                      >
                        Ver galería
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <PortfolioGalleryModal
            item={previewGalleryItem}
            categoryName={
              previewGalleryItem
                ? db.categories.find((c) => c.id === previewGalleryItem.categoryId)?.name
                : undefined
            }
            onClose={() => setPreviewGalleryItem(null)}
          />
        </div>
      )}

      {/* 7. Mensajes */}
      {activeTab === 'mensajes' && (
        <ChatWorkspace currentUser={currentUser} initialConversationId={activeConvId} />
      )}

      {/* 8. Contrataciones */}
      {activeTab === 'contrataciones' && (
        <div className="space-y-4">
          {myBookings.length === 0 ? (
            <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-8 text-center text-sm text-[#73766F] dark:text-[#A3A89F]">
              Aún no tienes contrataciones confirmadas.
            </div>
          ) : (
            myBookings.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                currentUser={currentUser}
                viewerRole="pro"
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

      {/* 9. Reseñas */}
      {activeTab === 'resenas' && (
        <div className="space-y-4">
          {myReviews.length === 0 ? (
            <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-8 text-center text-sm text-[#73766F] dark:text-[#A3A89F]">
              Aún no recibes reseñas verificadas de clientes.
            </div>
          ) : (
            myReviews.map((rev) => (
              <div
                key={rev.id}
                className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-5 space-y-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold">
                    {rev.clientName} · {rev.serviceName}
                  </span>
                  <span className="font-semibold text-[#C7582B] font-mono-num">{rev.rating} / 5</span>
                </div>
                <p>{rev.comment}</p>
                {rev.proResponse ? (
                  <div className="p-3 rounded-lg bg-[#ECE7DC]/70 dark:bg-[#161C22] text-xs">
                    <strong>Tu respuesta:</strong> {rev.proResponse.text}
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const text = replyTextMap[rev.id]?.trim();
                      if (!text) return;
                      reviewsService.replyToReview(rev.id, text);
                      refreshDb();
                      notify('Respuesta pública guardada.', 'success');
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={replyTextMap[rev.id] || ''}
                      onChange={(e) =>
                        setReplyTextMap((prev) => ({ ...prev, [rev.id]: e.target.value }))
                      }
                      placeholder="Responder públicamente a esta reseña..."
                      className="flex-1 px-3 py-1.5 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-xs"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg bg-[#214438] hover:bg-[#183329] text-white dark:bg-[#C7582B] dark:hover:bg-[#AC4921] text-xs font-semibold transition-colors"
                    >
                      Responder
                    </button>
                  </form>
                )}
                {!rev.reported && (
                  <button
                    type="button"
                    onClick={() => {
                      reviewsService.reportReview(
                        rev.id,
                        currentUser.id,
                        'Revisión solicitada por el freelancer.'
                      );
                      refreshDb();
                      notify('Reseña reportada al equipo de moderación.', 'info');
                    }}
                    className="text-xs text-red-600 dark:text-red-400 hover:underline"
                  >
                    Reportar reseña
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* 10. Estadísticas */}
      {activeTab === 'estadisticas' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-5">
              <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">Visitas al perfil</p>
              <p className="text-2xl font-bold mt-1 font-mono-num">{pro.profileViews}</p>
            </div>
            <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-5">
              <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">Cotizaciones enviadas</p>
              <p className="text-2xl font-bold mt-1 font-mono-num">{myQuotes.length}</p>
            </div>
            <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-5">
              <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">Tasa de conversión</p>
              <p className="text-2xl font-bold mt-1 font-mono-num">
                {myQuotes.length > 0
                  ? `${Math.round(
                      (myQuotes.filter((q) => q.status === 'accepted').length / myQuotes.length) *
                        100
                    )}%`
                  : '0%'}
              </p>
            </div>
            <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-5">
              <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">Reseñas verificadas</p>
              <p className="text-2xl font-bold mt-1 font-mono-num">{myReviews.length}</p>
            </div>
          </div>
          <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-[#73766F] dark:text-[#A3A89F]">Servicios publicados activos</span>
              <p className="text-lg font-bold mt-0.5 font-mono-num">
                {myServices.filter((s) => s.status === 'published').length}
              </p>
            </div>
            <div>
              <span className="text-[#73766F] dark:text-[#A3A89F]">Trabajos en portafolio</span>
              <p className="text-lg font-bold mt-0.5 font-mono-num">{myPortfolio.length}</p>
            </div>
            <div>
              <span className="text-[#73766F] dark:text-[#A3A89F]">Nivel de verificación</span>
              <p className="text-lg font-bold mt-0.5 font-mono-num">{pro.verificationLevel} / 4</p>
            </div>
          </div>
        </div>
      )}

      {/* 11. Notificaciones */}
      {activeTab === 'notificaciones' && (
        <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">Notificaciones operativas</h3>
            {unreadNotifs > 0 && (
              <button
                type="button"
                onClick={() => {
                  notificationsService.markAllRead(currentUser.id);
                  refreshDb();
                }}
                className="text-xs font-semibold text-[#214438] dark:text-[#C7582B]"
              >
                Marcar leídas
              </button>
            )}
          </div>
          {myNotifications.length === 0 ? (
            <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">No tienes notificaciones pendientes.</p>
          ) : (
            myNotifications.map((n) => (
              <div
                key={n.id}
                className="py-2.5 border-b border-[#DBD4C6] dark:border-white/8 text-xs flex justify-between gap-2"
              >
                <div>
                  <p className="font-semibold text-sm">{n.title}</p>
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

      {/* 12. Perfil profesional completo + Verificación */}
      {activeTab === 'perfil' && (
        <div className="space-y-6 max-w-3xl">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              profilesService.updateProfile(currentUser.id, {
                fullName: displayName.trim() || currentUser.fullName,
                colonia: primaryColonia,
              });
              profilesService.updateProfessionalProfile(pro.id, {
                displayName: displayName.trim() || pro.displayName,
                commercialName: commercialName.trim() || undefined,
                avatarUrl: proAvatarUrl,
                avatarPublicConsent: Boolean(proAvatarUrl && avatarPublicConsent),
                avatarStorageBucket: proAvatarUrl ? STORAGE_BUCKETS.PUBLIC_AVATARS : undefined,
                bio: bio.trim(),
                specialties: specialtiesText
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
                categoryIds: categoryIds.length > 0 ? categoryIds : pro.categoryIds,
                yearsExperience: Number(yearsExperience) || 1,
                primaryColonia,
                additionalColonias: additionalColonias.filter((c) => c !== primaryColonia),
                maxTravelKm: Number(maxTravelKm) || 5,
                homeService,
                workshopService,
                urgentAttention,
                published,
              });
              refreshDb();
              notify('Perfil de freelancer actualizado correctamente.', 'success');
            }}
            className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-6 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold">Información pública del freelancer</h3>
              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={published}
                  onChange={(e) => setPublished(e.target.checked)}
                />
                Perfil visible en búsquedas públicas
              </label>
            </div>

            {/* Public Avatar with Explicit Consent */}
            <div className="space-y-2.5">
              <PhotoUploadBox
                label="Fotografía pública de perfil (opcional)"
                value={proAvatarUrl}
                onChange={(nextUrl) => {
                  setProAvatarUrl(nextUrl);
                  if (!nextUrl) setAvatarPublicConsent(false);
                }}
                helperText="Esta imagen se guarda en el espacio público de avatares y es totalmente independiente de tus documentos privados de verificación."
                uploadButtonLabel="Subir foto de perfil pública"
              />
              <label className="inline-flex items-start gap-2.5 text-xs text-[#1D252C]/90 dark:text-[#F7F3EA]/90 cursor-pointer">
                <input
                  type="checkbox"
                  checked={avatarPublicConsent}
                  disabled={!proAvatarUrl}
                  onChange={(e) => setAvatarPublicConsent(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Autorizo mostrar esta fotografía en mi perfil público, búsquedas y cotizaciones.
                  {!proAvatarUrl && ' (Sube primero una fotografía para activar esta opción.)'}
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Nombre público</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Nombre comercial / marca personal (opcional)
                </label>
                <input
                  type="text"
                  value={commercialName}
                  onChange={(e) => setCommercialName(e.target.value)}
                  placeholder="Ej. Plomería Residencial Vargas"
                  className="w-full px-3.5 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Biografía profesional</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Años de experiencia</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Colonia base</label>
                <select
                  value={primaryColonia}
                  onChange={(e) => setPrimaryColonia(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                >
                  {regionColonias.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Radio máximo (km)</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={maxTravelKm}
                  onChange={(e) => setMaxTravelKm(Number(e.target.value))}
                  className="w-full px-3.5 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5">Categorías de servicio</label>
              <div className="flex flex-wrap gap-2">
                {db.categories
                  .filter((c) => c.active)
                  .map((cat) => {
                    const checked = categoryIds.includes(cat.id);
                    return (
                      <label
                        key={cat.id}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                          checked
                            ? 'bg-[#214438] text-white border-[#214438] dark:bg-[#C7582B] dark:text-white dark:border-[#C7582B]'
                            : 'border-[#DBD4C6] dark:border-white/15'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => {
                            setCategoryIds((prev) =>
                              prev.includes(cat.id)
                                ? prev.filter((id) => id !== cat.id)
                                : [...prev, cat.id]
                            );
                          }}
                        />
                        {cat.name}
                      </label>
                    );
                  })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5">
                Colonias adicionales de cobertura
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 rounded-lg border border-[#DBD4C6] dark:border-white/10">
                {regionColonias
                  .filter((c) => c !== primaryColonia)
                  .map((col) => {
                    const checked = additionalColonias.includes(col);
                    return (
                      <label
                        key={col}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] cursor-pointer border transition-colors ${
                          checked
                            ? 'bg-[#214438] text-white border-[#214438] dark:bg-[#C7582B] dark:border-[#C7582B]'
                            : 'border-[#DBD4C6] dark:border-white/15'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={() => {
                            setAdditionalColonias((prev) =>
                              prev.includes(col)
                                ? prev.filter((c) => c !== col)
                                : [...prev, col]
                            );
                          }}
                        />
                        {col}
                      </label>
                    );
                  })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">
                Especialidades (separadas por coma)
              </label>
              <input
                type="text"
                value={specialtiesText}
                onChange={(e) => setSpecialtiesText(e.target.value)}
                className="w-full px-3.5 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-5 text-xs font-medium">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={homeService}
                  onChange={(e) => setHomeService(e.target.checked)}
                />
                Servicio a domicilio
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={workshopService}
                  onChange={(e) => setWorkshopService(e.target.checked)}
                />
                Atención en taller / estudio
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={urgentAttention}
                  onChange={(e) => setUrgentAttention(e.target.checked)}
                />
                Atiendo urgencias mismo día
              </label>
            </div>

            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#214438] hover:bg-[#183329] text-white dark:bg-[#C7582B] dark:hover:bg-[#AC4921] text-xs font-semibold transition-colors"
            >
              Guardar perfil profesional
            </button>
          </form>

          {/* Private Credential Verification (INE + Frontal Face Photo) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setVerError('');
              if (!ineDraft || !faceDraft) {
                setVerError(
                  'Debes adjuntar tanto tu identificación oficial (INE) como tu fotografía frontal de rostro.'
                );
                return;
              }
              if (!verConfirmed) {
                setVerError(
                  'Confirma que ambos archivos son legibles y autorizas su revisión privada.'
                );
                return;
              }
              profilesService.submitVerificationDocuments(pro.id, [
                {
                  docKind: 'ine',
                  label: docLabel.trim() || 'Identificación oficial vigente (INE)',
                  fileName: ineDraft.fileName,
                  mimeType: ineDraft.mimeType,
                  sizeBytes: ineDraft.sizeBytes,
                  previewRefKey: ineDraft.previewRefKey,
                  isDemo: false,
                },
                {
                  docKind: 'frontal_face',
                  label: 'Fotografía frontal de rostro (verificación privada)',
                  fileName: faceDraft.fileName,
                  mimeType: faceDraft.mimeType,
                  sizeBytes: faceDraft.sizeBytes,
                  previewRefKey: faceDraft.previewRefKey,
                  isDemo: false,
                },
              ]);
              setIneDraft(null);
              setFaceDraft(null);
              setVerConfirmed(false);
              refreshDb();
              notify(
                'Documentación enviada en estado Pendiente de revisión. Administración la validará en privado.',
                'success'
              );
            }}
            className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-6 space-y-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-[#214438] dark:text-[#C7582B]" />
                  <h3 className="text-base font-bold">
                    Verificación de identidad y credenciales (uso interno privado)
                  </h3>
                </div>
                <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">
                  Archivos estrictamente privados ({STORAGE_BUCKETS.PRIVATE_VERIFICATIONS}): nunca se muestran en perfiles públicos ni se guardan copias binarias en el navegador.
                </p>
              </div>
              <span
                className={`px-3 py-1 rounded-lg text-xs font-bold ${verificationStage.badgeClass}`}
              >
                {verificationStage.label}
              </span>
            </div>

            <div className="rounded-lg bg-[#ECE7DC]/70 dark:bg-[#161C22] p-3 text-xs flex items-start gap-2 text-[#1D252C]/85 dark:text-[#F7F3EA]/85">
              <Lock className="w-4 h-4 shrink-0 text-[#214438] dark:text-[#C7582B] mt-0.5" />
              <div>
                <p className="font-semibold">Estado actual: {verificationStage.label}</p>
                <p className="text-[#73766F] dark:text-[#A3A89F]">{verificationStage.description}</p>
              </div>
            </div>

            {/* Step 1: INE / Official ID */}
            <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wide text-[#214438] dark:text-[#C7582B]">
                    1. Identificación oficial vigente (INE)
                  </h4>
                  <p className="text-[11px] text-[#73766F] dark:text-[#A3A89F]">
                    Acepta JPG, PNG, WEBP o PDF · Máx. 5 MB
                  </p>
                </div>
              </div>

              <input
                type="text"
                value={docLabel}
                onChange={(e) => setDocLabel(e.target.value)}
                placeholder="Descripción del documento (ej. INE frente y vuelta)"
                className="w-full px-3 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-xs"
              />

              {ineDraft ? (
                <div className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-lg bg-[#ECE7DC]/55 dark:bg-[#161C22] border border-[#DBD4C6] dark:border-white/10">
                  {ineDraft.mimeType.startsWith('image/') ? (
                    <img
                      src={ineDraft.previewUrl}
                      alt="Vista previa INE"
                      className="w-28 h-20 object-cover rounded-lg border border-[#DBD4C6]"
                    />
                  ) : (
                    <div className="w-28 h-20 rounded-lg bg-[#214438]/10 dark:bg-white/10 flex flex-col items-center justify-center text-xs font-semibold text-[#214438] dark:text-[#C7582B]">
                      <FileCheck2 className="w-6 h-6 mb-1" />
                      PDF
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-xs">
                    <p className="font-semibold truncate">{ineDraft.fileName}</p>
                    <p className="text-[#73766F] dark:text-[#A3A89F]">
                      {ineDraft.mimeType} · {formatFileSize(ineDraft.sizeBytes)}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#214438] text-white dark:bg-[#C7582B] dark:text-white font-semibold cursor-pointer">
                        <RefreshCw className="w-3 h-3" />
                        <span>Cambiar INE</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          className="sr-only"
                          onChange={(e) => {
                            void handleVerificationFileSelect('ine', e.target.files?.[0]);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          privateMediaStore.removePreview(ineDraft.previewRefKey);
                          setIneDraft(null);
                        }}
                        className="px-2.5 py-1 rounded border border-red-300 text-red-700 dark:text-red-300 font-medium"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 px-4 py-4 rounded-lg border border-dashed border-[#DBD4C6] dark:border-white/25 cursor-pointer text-xs font-semibold hover:bg-[#ECE7DC]/50 dark:hover:bg-[#161C22]">
                  <Upload className="w-4 h-4 text-[#C7582B]" />
                  <span>Seleccionar INE o identificación oficial (PDF o imagen)</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="sr-only"
                    onChange={(e) => {
                      void handleVerificationFileSelect('ine', e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>

            {/* Step 2: Frontal Face Photo (Private Verification) */}
            <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 p-4 space-y-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-[#214438] dark:text-[#C7582B]">
                  2. Fotografía frontal de rostro (verificación privada)
                </h4>
                <p className="text-[11px] text-[#73766F] dark:text-[#A3A89F]">
                  Rostro completo y bien iluminado para cotejo con tu INE. Solo visible por administradores · JPG, PNG o WEBP · Máx. 5 MB.
                </p>
              </div>

              {faceDraft ? (
                <div className="flex flex-col sm:flex-row items-center gap-3 p-3 rounded-lg bg-[#ECE7DC]/55 dark:bg-[#161C22] border border-[#DBD4C6] dark:border-white/10">
                  <img
                    src={faceDraft.previewUrl}
                    alt="Vista previa de rostro frontal privado"
                    className="w-20 h-20 rounded-full object-cover border-2 border-[#214438] dark:border-[#C7582B]"
                  />
                  <div className="flex-1 min-w-0 text-xs">
                    <p className="font-semibold truncate">{faceDraft.fileName}</p>
                    <p className="text-[#73766F] dark:text-[#A3A89F]">
                      {faceDraft.mimeType} · {formatFileSize(faceDraft.sizeBytes)}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#214438] text-white dark:bg-[#C7582B] dark:text-white font-semibold cursor-pointer">
                        <RefreshCw className="w-3 h-3" />
                        <span>Cambiar foto frontal</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          onChange={(e) => {
                            void handleVerificationFileSelect('frontal_face', e.target.files?.[0]);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          privateMediaStore.removePreview(faceDraft.previewRefKey);
                          setFaceDraft(null);
                        }}
                        className="px-2.5 py-1 rounded border border-red-300 text-red-700 dark:text-red-300 font-medium"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 px-4 py-4 rounded-lg border border-dashed border-[#DBD4C6] dark:border-white/25 cursor-pointer text-xs font-semibold hover:bg-[#ECE7DC]/50 dark:hover:bg-[#161C22]">
                  <Camera className="w-4 h-4 text-[#C7582B]" />
                  <span>Subir fotografía frontal de rostro (uso privado)</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      void handleVerificationFileSelect('frontal_face', e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
            </div>

            {verError && (
              <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {verError}
              </p>
            )}

            <label className="inline-flex items-start gap-2 text-xs text-[#1D252C]/90 dark:text-[#F7F3EA]/90 cursor-pointer">
              <input
                type="checkbox"
                checked={verConfirmed}
                onChange={(e) => setVerConfirmed(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Confirmo que tanto la INE como mi fotografía frontal son auténticas, legibles y autorizo su revisión privada. Entiendo que el envío queda en revisión y no otorga verificación automática.
              </span>
            </label>

            <div>
              <button
                type="submit"
                disabled={!ineDraft || !faceDraft || !verConfirmed}
                className="px-5 py-2.5 rounded-lg bg-[#214438] hover:bg-[#183329] text-white dark:bg-[#C7582B] dark:hover:bg-[#AC4921] text-xs font-semibold disabled:opacity-50 transition-colors"
              >
                Enviar documentación privada para revisión
              </button>
            </div>

            {myVerifications.length > 0 && (
              <div className="pt-4 border-t border-[#DBD4C6] dark:border-white/10 space-y-3 text-xs">
                <p className="font-bold">Historial de solicitudes de verificación</p>
                {myVerifications.map((v) => {
                  const stage = getVerificationStageSummary([v], 0);
                  return (
                    <div
                      key={v.id}
                      className="p-3.5 rounded-xl bg-[#ECE7DC]/60 dark:bg-[#161C22] border border-[#DBD4C6] dark:border-white/10 space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">
                          Solicitud Nivel {v.requestedLevel} · {formatDateMX(v.createdAt, true)}
                        </span>
                        <span className={`px-2 py-0.5 rounded font-bold ${stage.badgeClass}`}>
                          {stage.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {v.documents.map((d) => {
                          const resolved = privateMediaStore.resolveDocumentPreview(d);
                          return (
                            <div
                              key={d.id}
                              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#FFFDFA] dark:bg-[#1A2128] border border-[#DBD4C6] dark:border-white/10"
                            >
                              <img
                                src={resolved.url}
                                alt={d.label}
                                className="w-8 h-6 rounded object-cover"
                              />
                              <span className="text-[11px]">
                                {d.docKind === 'frontal_face' ? 'Rostro frontal' : 'INE'} ({d.fileName})
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      {v.reviewReason && (
                        <p className="text-[#214438] dark:text-[#C7582B]">
                          <strong>Observación administrativa:</strong> {v.reviewReason}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </form>
        </div>
      )}

      {/* 13. Configuración */}
      {activeTab === 'configuracion' && (
        <div className="space-y-5 max-w-2xl">
          <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-6 space-y-3">
            <h3 className="text-base font-bold">Tema de la interfaz</h3>
            <div className="grid grid-cols-3 gap-3">
              {(['light', 'dark', 'system'] as ThemePreference[]).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setTheme(opt)}
                  className={`py-2 rounded-lg border text-xs font-semibold transition-colors ${
                    theme === opt
                      ? 'bg-[#214438] text-white border-[#214438] dark:bg-[#C7582B] dark:text-white dark:border-[#C7582B]'
                      : 'border-[#DBD4C6] dark:border-white/15'
                  }`}
                >
                  {opt === 'light' ? 'Claro' : opt === 'dark' ? 'Oscuro' : 'Sistema'}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-6 space-y-3">
            <h3 className="text-base font-bold">Sesión</h3>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={signOut}
                className="px-4 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 text-xs font-semibold"
              >
                Cerrar sesión
              </button>
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="px-4 py-2 rounded-lg bg-red-700 text-white text-xs font-semibold"
                >
                  Eliminar cuenta local
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    authService.deleteAccount(currentUser.id);
                    signOut();
                    notify('Cuenta local eliminada.', 'info');
                  }}
                  className="px-4 py-2 rounded-lg bg-red-700 text-white text-xs font-bold"
                >
                  Confirmar eliminación
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 14. Ayuda */}
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
              notify('Ticket enviado a soporte.', 'success');
            }}
            className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-6 space-y-4"
          >
            <h3 className="text-base font-bold">Ayuda para freelancers</h3>
            <input
              type="text"
              value={ticketSubject}
              onChange={(e) => setTicketSubject(e.target.value)}
              placeholder="Asunto"
              className="w-full px-3.5 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
              required
            />
            <textarea
              value={ticketDesc}
              onChange={(e) => setTicketDesc(e.target.value)}
              rows={3}
              placeholder="Describe tu consulta..."
              className="w-full px-3.5 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-sm"
              required
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#214438] hover:bg-[#183329] text-white dark:bg-[#C7582B] dark:hover:bg-[#AC4921] text-xs font-semibold transition-colors"
            >
              Enviar ticket
            </button>
          </form>

          {myTickets.length > 0 && (
            <div className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-5 space-y-3">
              <h4 className="text-sm font-bold">Mis tickets enviados</h4>
              {myTickets.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-lg bg-[#ECE7DC]/55 dark:bg-[#161C22] text-xs space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{t.subject}</span>
                    <span className="uppercase font-semibold text-[#214438] dark:text-[#C7582B]">
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

      {/* Modal in-panel de vista previa de perfil profesional (sin salir del panel freelancer) */}
      {showProfilePreviewModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa de mi perfil profesional"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto"
          onClick={() => setShowProfilePreviewModal(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl bg-[#FFFDFA] dark:bg-[#171B19] border border-[#DBD4C6] dark:border-white/15 shadow-2xl overflow-hidden my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[#DBD4C6] dark:border-white/10 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#214438] dark:text-[#C7582B]">
                  Vista previa interna · Como te ven tus clientes
                </p>
                <h3 className="font-bold text-base text-[#1D252C] dark:text-[#F7F3EA]">
                  {pro.commercialName || pro.displayName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowProfilePreviewModal(false)}
                aria-label="Cerrar vista previa"
                className="p-1.5 rounded-lg border border-[#DBD4C6] dark:border-white/15"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto text-sm">
              <div className="flex flex-wrap items-start gap-4">
                <UserAvatar
                  src={getPublicProAvatar(pro)}
                  name={pro.displayName}
                  sizeClass="w-16 h-16"
                />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-lg text-[#1D252C] dark:text-[#F7F3EA]">
                      {pro.displayName}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-[#214438]/12 dark:bg-[#C7582B]/15 text-[#214438] dark:text-[#C7582B] text-[11px] font-semibold font-mono-num">
                      Verificación nivel {pro.verificationLevel}/4
                    </span>
                  </div>
                  <p className="text-xs text-[#73766F] dark:text-[#A3A89F] flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#C7582B]" />
                    Col. {pro.primaryColonia} · <span className="font-mono-num">{pro.yearsExperience}</span> años de experiencia ·{' '}
                    <span className="font-mono-num">{pro.ratingAvg.toFixed(1)}</span> ★ (<span className="font-mono-num">{pro.reviewsCount}</span> reseñas)
                  </p>
                  <p className="text-xs text-[#1D252C]/85 dark:text-[#F7F3EA]/85 pt-1 leading-relaxed">
                    {pro.bio}
                  </p>
                </div>
              </div>

              {pro.specialties.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#73766F] dark:text-[#A3A89F] mb-2">Especialidades</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pro.specialties.map((sp) => (
                      <span
                        key={sp}
                        className="px-2.5 py-1 rounded bg-[#ECE7DC] dark:bg-white/10 text-xs font-medium"
                      >
                        {sp}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-[#73766F] dark:text-[#A3A89F] mb-2">
                  Servicios publicados (<span className="font-mono-num">{myServices.filter((s) => s.status === 'published').length}</span>)
                </p>
                {myServices.filter((s) => s.status === 'published').length === 0 ? (
                  <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">Aún no tienes servicios publicados.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {myServices
                      .filter((s) => s.status === 'published')
                      .slice(0, 4)
                      .map((srv) => (
                        <div
                          key={srv.id}
                          className="p-3 rounded-lg border border-[#DBD4C6] dark:border-white/10 bg-[#ECE7DC]/55 dark:bg-[#161C22] text-xs"
                        >
                          <p className="font-bold">{srv.name}</p>
                          <p className="text-[#214438] dark:text-[#C7582B] font-semibold mt-0.5 font-mono-num">
                            {formatPricingLabel(srv.pricingMode, srv.priceAmount)}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {myPortfolio.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#73766F] dark:text-[#A3A89F] mb-2">
                    Portafolio (<span className="font-mono-num">{myPortfolio.length}</span> proyectos)
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {myPortfolio.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-[#DBD4C6] dark:border-white/10 overflow-hidden bg-[#ECE7DC]/40 dark:bg-[#161C22]"
                      >
                        <SafeImage
                          src={item.photos[0]}
                          alt={item.title}
                          className="w-full h-24 object-cover"
                        />
                        <p className="p-2 text-[11px] font-semibold truncate">{item.title}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          currentUser={currentUser}
          viewerRole="pro"
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
