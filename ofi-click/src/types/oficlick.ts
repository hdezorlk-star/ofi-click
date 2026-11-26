export type UserRoleType =
  | 'client'
  | 'independent_pro'
  | 'central_admin';

export type AvailabilityStatus = 'available' | 'busy' | 'unavailable';

export type VerificationLevel =
  | 1 // Cuenta registrada
  | 2 // Correo confirmado
  | 3 // Perfil profesional revisado
  | 4; // Credenciales verificadas

export type VerificationRequestStatus =
  | 'pending'
  | 'in_review'
  | 'approved'
  | 'rejected'
  | 'corrections_needed';

export type VerificationDocKind = 'ine' | 'frontal_face' | 'credential';

export type PricingMode =
  | 'fixed'
  | 'hourly'
  | 'visit'
  | 'unit'
  | 'from'
  | 'custom_quote';

export type ServiceStatus = 'published' | 'draft' | 'paused';

export type UrgencyLevel = 'normal' | 'soon' | 'urgent';

export type RequestDistributionMode = 'manual' | 'recommended';

export type RequestStatus =
  | 'sent'
  | 'in_conversation'
  | 'quoted'
  | 'accepted'
  | 'closed'
  | 'cancelled'
  | 'expired';

export type RecipientStatus =
  | 'pending'
  | 'viewed'
  | 'info_requested'
  | 'quoted'
  | 'rejected';

export type QuoteStatus =
  | 'sent'
  | 'revised'
  | 'accepted'
  | 'rejected'
  | 'expired';

export type BookingStatus =
  | 'quote_accepted'
  | 'scheduled'
  | 'on_the_way'
  | 'in_progress'
  | 'pro_marked_done'
  | 'client_confirmed'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'expired'
  | 'disputed'
  | 'not_performed';

export type ThemePreference = 'light' | 'dark' | 'system';

export interface Region {
  id: string;
  name: string;
  state: string;
  country: string;
  active: boolean;
  center: { lat: number; lng: number };
  colonias: string[];
}

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  emailConfirmed: boolean;
  avatarUrl?: string;
  avatarConsent?: boolean;
  avatarStorageBucket?: 'public_avatars';
  primaryRole: UserRoleType;
  roles: UserRoleType[];
  regionId: string;
  colonia: string;
  suspended: boolean;
  createdAt: string;
  isDemo: boolean;
  notificationPrefs: {
    inApp: boolean;
    email: boolean;
    push: boolean;
    securityAlertsOnly: boolean;
  };
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  iconName: string;
  imageUrl?: string;
  subcategories: Subcategory[];
  specificFilters: string[];
  active: boolean;
  sortOrder: number;
}

export interface Subcategory {
  id: string;
  categoryId: string;
  name: string;
  active: boolean;
}

export interface DaySchedule {
  day: 'lun' | 'mar' | 'mie' | 'jue' | 'vie' | 'sab' | 'dom';
  label: string;
  enabled: boolean;
  start: string; // HH:mm
  end: string; // HH:mm
  breakStart?: string;
  breakEnd?: string;
}

export interface AvailabilityBlock {
  id: string;
  professionalId: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  reason: string;
  type: 'block' | 'booking' | 'pending';
  bookingId?: string;
}

export interface ProfessionalProfile {
  id: string;
  profileId: string;
  displayName: string;
  commercialName?: string;
  avatarUrl?: string;
  avatarPublicConsent?: boolean;
  avatarStorageBucket?: 'public_avatars';
  bio: string;
  specialties: string[];
  categoryIds: string[];
  yearsExperience: number;
  regionId: string;
  primaryColonia: string;
  additionalColonias: string[];
  coverageZones: string[];
  maxTravelKm: number;
  homeService: boolean;
  workshopService: boolean;
  willingToTravel: boolean;
  approximateCoords: { lat: number; lng: number };
  availabilityStatus: AvailabilityStatus;
  urgentAttention: boolean;
  weeklySchedule: DaySchedule[];
  verificationLevel: VerificationLevel;
  profileComplete: boolean;
  published: boolean;
  pausedByAdmin: boolean;
  ratingAvg: number;
  reviewsCount: number;
  completedJobsCount: number;
  responseRatePercent: number;
  profileViews: number;
  joinedAt: string;
  isDemo: boolean;
}

export interface ServiceItem {
  id: string;
  professionalId: string;
  categoryId: string;
  subcategoryId?: string;
  name: string;
  description: string;
  photos: string[];
  pricingMode: PricingMode;
  priceAmount?: number;
  estimatedDurationMin: number;
  materialsIncluded: boolean;
  conditions: string;
  coverageColonias: string[];
  status: ServiceStatus;
  urgentAvailable: boolean;
  isDemo: boolean;
}

export interface PortfolioItem {
  id: string;
  professionalId: string;
  title: string;
  categoryId: string;
  description: string;
  photos: string[];
  approximateDate: string;
  servicePerformed: string;
  optionalPrice?: number;
  optionalMaterials?: string;
  approximateDuration?: string;
  tags: string[];
  origin: 'oficlick_completed' | 'uploaded_portfolio';
  bookingId?: string;
  storageBucket?: 'portfolio_photos';
  isDemo?: boolean;
}

export interface ServiceRequest {
  id: string;
  clientId: string;
  regionId: string;
  categoryId: string;
  serviceId?: string;
  title: string;
  description: string;
  photos: string[];
  colonia: string;
  privateAddress?: string; // Visible ONLY to authorized participants on booking
  desiredDate: string;
  desiredTimeSlot: string;
  urgency: UrgencyLevel;
  optionalBudgetMxn?: number;
  preferences: string;
  requiresHomeService: boolean;
  distributionMode: RequestDistributionMode;
  recipientProfessionalIds: string[];
  recipientStatuses: Record<string, RecipientStatus>;
  status: RequestStatus;
  createdAt: string;
  isDemo: boolean;
}

export interface QuoteVersion {
  versionNumber: number;
  laborAmount: number;
  materialsAmount: number;
  additionalCharges: number;
  discountAmount: number;
  totalAmount: number;
  estimatedDuration: string;
  proposedDate: string;
  proposedTime: string;
  validUntil: string;
  conditions: string;
  comments: string;
  createdAt: string;
}

export interface Quote {
  id: string;
  requestId: string;
  professionalId: string;
  clientId: string;
  serviceName: string;
  description: string;
  status: QuoteStatus;
  currentVersion: number;
  versions: QuoteVersion[];
  createdAt: string;
  updatedAt: string;
}

export interface BookingEvent {
  id: string;
  bookingId: string;
  status: BookingStatus;
  actorId: string;
  actorName: string;
  note: string;
  photos?: string[];
  createdAt: string;
}

export interface RescheduleProposal {
  id: string;
  proposedDate: string;
  proposedTime: string;
  reason: string;
  proposedById: string;
  clientAccepted: boolean;
  proAccepted: boolean;
  createdAt: string;
}

export interface Booking {
  id: string;
  requestId: string;
  quoteId: string;
  quoteVersion: number;
  clientId: string;
  professionalId: string;
  regionId: string;
  serviceTitle: string;
  description: string;
  agreedAmountMxn: number;
  paymentNote: string; // Direct agreement outside OFI CLICK
  paymentConfirmedOutside: boolean;
  scheduledDate: string;
  scheduledTime: string;
  colonia: string;
  privateAddress: string;
  conditions: string;
  status: BookingStatus;
  events: BookingEvent[];
  rescheduleProposal?: RescheduleProposal;
  cancellationInfo?: {
    cancelledById: string;
    cancelledByRole: string;
    reason: string;
    cancelledAt: string;
  };
  completionPhotos?: string[];
  completionNotes?: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  requestId?: string;
  bookingId?: string;
  participantIds: string[]; // profileIds
  blockedByIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatAttachmentMetadata {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  kind: 'image' | 'pdf' | 'document' | 'other';
  previewRefKey: string;
  storageBucket: 'private_chat_attachments';
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  attachmentName?: string;
  attachmentType?: 'image' | 'file' | 'quote' | 'location';
  attachment?: ChatAttachmentMetadata;
  quoteId?: string;
  sharedLocationNote?: string;
  readByIds: string[];
  createdAt: string;
}

export interface Review {
  id: string;
  bookingId: string;
  clientId: string;
  clientName: string;
  professionalId: string;
  serviceName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  proResponse?: {
    text: string;
    respondedAt: string;
  };
  reported: boolean;
  hiddenByAdmin: boolean;
  createdAt: string;
}

export interface FavoriteEntry {
  clientId: string;
  professionalId: string;
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  profileId: string;
  title: string;
  body: string;
  category: 'operation' | 'message' | 'review' | 'security';
  read: boolean;
  linkView?: string;
  createdAt: string;
}

export interface VerificationDocument {
  id: string;
  docKind?: VerificationDocKind;
  label: string;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedAt: string;
  storageBucket?: 'private_verifications';
  previewRefKey?: string;
  isDemo?: boolean;
  privateOnly: true;
}

export interface VerificationRequest {
  id: string;
  professionalId: string;
  requestedLevel: VerificationLevel;
  documents: VerificationDocument[];
  status: VerificationRequestStatus;
  reviewReason?: string;
  reviewedByAdminId?: string;
  history: {
    status: VerificationRequestStatus;
    note: string;
    date: string;
  }[];
  createdAt: string;
  updatedAt?: string;
}

export interface ModerationReport {
  id: string;
  reporterId: string;
  targetType: 'professional' | 'review' | 'conversation' | 'booking';
  targetId: string;
  regionId: string;
  reason: string;
  status: 'open' | 'investigating' | 'resolved' | 'dismissed';
  adminNotes?: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  creatorId: string;
  creatorName: string;
  regionId: string;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'closed';
  evidenceNote?: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: UserRoleType;
  regionId: string;
  action: string;
  targetEntity: string;
  targetId: string;
  reason: string;
  createdAt: string;
}

export interface SearchFilters {
  query: string;
  categoryId: string;
  subcategoryId: string;
  serviceId: string;
  colonia: string;
  zone: string;
  maxDistanceKm: number | null;
  minRating: number;
  minReviews: number;
  maxPrice: number | null;
  availability: AvailabilityStatus | 'all';
  urgentOnly: boolean;
  homeServiceOnly: boolean;
  verifiedOnly: boolean;
  minExperienceYears: number;
  minCompletedJobs: number;
}

export type SortOption =
  | 'relevance'
  | 'rating'
  | 'reviews'
  | 'distance'
  | 'price_asc'
  | 'experience';

export type AdminRequestStatus =
  | 'email_pending'
  | 'pending_authorization'
  | 'authorized'
  | 'rejected';

export interface AdminAccessRequest {
  id: string;
  fullName: string;
  email: string;
  regionId: string;
  colonia: string;
  requestedScope: 'central_admin';
  justification: string;
  emailVerified: boolean;
  emailVerifiedAt?: string;
  status: AdminRequestStatus;
  authorizedRole?: 'central_admin';
  authorizedByAdminId?: string;
  authorizedByAdminName?: string;
  reviewNotes?: string;
  createdProfileId?: string;
  createdAt: string;
  updatedAt: string;
}

export type OneTimeCodePurpose = 'admin_email_verification' | 'password_reset';

export interface OneTimeCodeRecord {
  id: string;
  purpose: OneTimeCodePurpose;
  email: string;
  targetId?: string;
  codeHash: string;
  salt: string;
  expiresAt: string;
  attempts: number;
  maxAttempts: number;
  consumedAt?: string;
  createdAt: string;
}

export type TransactionalEmailEventType =
  | 'welcome'
  | 'admin_email_verification'
  | 'password_reset'
  | 'request_received'
  | 'quote_received'
  | 'quote_accepted'
  | 'booking_confirmed'
  | 'booking_rescheduled'
  | 'booking_cancelled'
  | 'booking_reminder';

export interface PreparedEmailRecord {
  id: string;
  eventType: TransactionalEmailEventType;
  toEmail: string;
  toName: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  deliveryStatus: 'prepared_local_only';
  providerConfigured: false;
  metadata?: Record<string, string>;
  createdAt: string;
}

export interface AppDatabaseState {
  regions: Region[];
  profiles: Profile[];
  categories: Category[];
  professionals: ProfessionalProfile[];
  services: ServiceItem[];
  portfolios: PortfolioItem[];
  availabilityBlocks: AvailabilityBlock[];
  requests: ServiceRequest[];
  quotes: Quote[];
  bookings: Booking[];
  conversations: Conversation[];
  messages: ChatMessage[];
  reviews: Review[];
  favorites: FavoriteEntry[];
  notifications: NotificationItem[];
  verificationRequests: VerificationRequest[];
  reports: ModerationReport[];
  supportTickets: SupportTicket[];
  auditLogs: AuditLog[];
  adminAccessRequests: AdminAccessRequest[];
  oneTimeCodes: OneTimeCodeRecord[];
  preparedEmails: PreparedEmailRecord[];
}
