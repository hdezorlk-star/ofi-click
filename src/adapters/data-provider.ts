import type {
  AdminAccessRequest,
  AppDatabaseState,
  AuditLog,
  AvailabilityBlock,
  AvailabilityStatus,
  Booking,
  BookingStatus,
  Category,
  ChatAttachmentMetadata,
  ChatMessage,
  Conversation,
  DaySchedule,
  ModerationReport,
  PortfolioItem,
  PreparedEmailRecord,
  ProfessionalProfile,
  Profile,
  Quote,
  QuoteVersion,
  Region,
  Review,
  ServiceItem,
  ServiceRequest,
  SupportTicket,
  UserRoleType,
  VerificationDocKind,
  VerificationRequest,
  VerificationRequestStatus,
} from '../types/oficlick';

export interface DataProvider {
  readonly mode: 'local' | 'supabase';

  // State snapshot & lifecycle
  getSnapshot(): AppDatabaseState;
  resetWorkspaceData(): AppDatabaseState;

  // Auth
  getCurrentProfile(): Profile | null;
  switchWorkspaceRole(role: UserRoleType): Profile;
  signInWithEmail(email: string, passwordAttempt: string): Profile | Promise<Profile>;
  registerAccount(input: {
    fullName: string;
    email: string;
    colonia: string;
    accountType: 'client' | 'independent_pro';
    password?: string;
    avatarUrl?: string;
    avatarConsent?: boolean;
    commercialName?: string;
    categoryId?: string;
  }):
    | { profile: Profile; welcomeEmail: PreparedEmailRecord; requiresEmailConfirmation?: boolean }
    | Promise<{
        profile: Profile;
        welcomeEmail: PreparedEmailRecord;
        requiresEmailConfirmation?: boolean;
      }>;
  resendSignupConfirmation?: (email: string) => Promise<{ sent: boolean; message: string }>;
  getConfigWarning?: () => string | null;
  submitAdminAccessRequest(input: {
    fullName: string;
    email: string;
    regionId: string;
    colonia: string;
    requestedScope: 'central_admin';
    justification: string;
    password: string;
  }): { request: AdminAccessRequest; verificationEmail: PreparedEmailRecord };
  authenticateWithGoogleProfile(input: {
    email: string;
    emailVerified: boolean;
    fullName: string;
    avatarUrl?: string;
    targetRole?: 'client' | 'independent_pro';
    colonia?: string;
    commercialName?: string;
    categoryId?: string;
  }): { profile: Profile; isNewUser: boolean; redirectTab: string };
  resendAdminVerificationCode(requestId: string): {
    request: AdminAccessRequest;
    verificationEmail: PreparedEmailRecord;
  };
  verifyAdminRequestOtp(
    requestId: string,
    codeAttempt: string
  ): {
    verified: boolean;
    request?: AdminAccessRequest;
    remainingAttempts?: number;
    error?: string;
  };
  initializeLocalDemoAdmin(requestId: string): {
    request: AdminAccessRequest;
    profile: Profile;
  };
  confirmEmail(profileId: string): Profile;
  requestPasswordRecovery(email: string):
    | {
        sent: boolean;
        message: string;
        preparedEmail?: PreparedEmailRecord;
      }
    | Promise<{
        sent: boolean;
        message: string;
        preparedEmail?: PreparedEmailRecord;
      }>;
  validatePasswordRecoveryCode(
    email: string,
    codeAttempt: string
  ): {
    valid: boolean;
    remainingAttempts?: number;
    error?: string;
  };
  completePasswordReset(
    email: string,
    codeAttempt: string,
    newPassword: string
  ): { success: boolean; message: string } | Promise<{ success: boolean; message: string }>;
  signOut(): void;
  updateProfile(profileId: string, patch: Partial<Profile>): Profile;
  deleteAccount(profileId: string): void;

  // Professionals & Services & Portfolio & Availability
  updateProfessionalProfile(
    proId: string,
    patch: Partial<ProfessionalProfile>
  ): ProfessionalProfile;
  saveService(service: ServiceItem): ServiceItem;
  deleteService(serviceId: string): void;
  addPortfolioItem(item: PortfolioItem): PortfolioItem;
  updatePortfolioItem(item: PortfolioItem): PortfolioItem;
  deletePortfolioItem(itemId: string): void;
  updateSchedule(proId: string, schedule: DaySchedule[], status: AvailabilityStatus): void;
  addAvailabilityBlock(block: Omit<AvailabilityBlock, 'id'>): AvailabilityBlock;
  removeAvailabilityBlock(blockId: string): void;
  submitVerificationDocuments(
    proId: string,
    documents: {
      docKind?: VerificationDocKind;
      label: string;
      fileName: string;
      mimeType?: string;
      sizeBytes?: number;
      previewRefKey?: string;
      isDemo?: boolean;
    }[]
  ): VerificationRequest;

  // Requests, Quotes, Bookings
  createServiceRequest(
    input: Omit<ServiceRequest, 'id' | 'createdAt' | 'status' | 'recipientStatuses' | 'isDemo'>
  ): ServiceRequest;
  updateRequestRecipientStatus(
    requestId: string,
    proId: string,
    status: ServiceRequest['recipientStatuses'][string]
  ): void;
  closeOrCancelRequest(requestId: string, status: 'closed' | 'cancelled'): void;
  sendOrReviseQuote(input: {
    quoteId?: string;
    requestId: string;
    professionalId: string;
    clientId: string;
    serviceName: string;
    description: string;
    versionData: Omit<QuoteVersion, 'versionNumber' | 'createdAt'>;
  }): Quote;
  respondToQuote(quoteId: string, decision: 'accepted' | 'rejected'): {
    quote: Quote;
    booking?: Booking;
  };
  updateBookingStatus(input: {
    bookingId: string;
    status: BookingStatus;
    actorId: string;
    actorName: string;
    note: string;
    photos?: string[];
  }): Booking;
  proposeReschedule(input: {
    bookingId: string;
    proposedDate: string;
    proposedTime: string;
    reason: string;
    proposedById: string;
    proposedByRole: 'client' | 'pro';
  }): Booking;
  respondReschedule(
    bookingId: string,
    responderRole: 'client' | 'pro',
    accept: boolean
  ): Booking;
  cancelBooking(input: {
    bookingId: string;
    actorId: string;
    actorRole: string;
    reason: string;
  }): Booking;

  // Chat
  getOrCreateConversation(input: {
    participantIds: string[];
    requestId?: string;
    bookingId?: string;
  }): Conversation;
  sendMessage(input: {
    conversationId: string;
    senderId: string;
    text: string;
    attachmentName?: string;
    attachmentType?: ChatMessage['attachmentType'];
    attachment?: ChatAttachmentMetadata;
    quoteId?: string;
    sharedLocationNote?: string;
  }): ChatMessage;
  markConversationRead(conversationId: string, profileId: string): void;
  toggleBlockConversation(conversationId: string, profileId: string): void;

  // Favorites & Reviews & Notifications
  toggleFavorite(clientId: string, professionalId: string): boolean;
  publishReview(input: Omit<Review, 'id' | 'createdAt' | 'reported' | 'hiddenByAdmin'>): Review;
  replyToReview(reviewId: string, responseText: string): Review;
  reportReview(reviewId: string, reporterId: string, reason: string): void;
  markNotificationRead(notificationId: string): void;
  markAllNotificationsRead(profileId: string): void;
  createSupportTicket(input: Omit<SupportTicket, 'id' | 'createdAt' | 'status'>): SupportTicket;
  createReport(input: Omit<ModerationReport, 'id' | 'createdAt' | 'status'>): ModerationReport;

  // Admin & Regional Admin
  upsertCategory(category: Category, admin: Profile): Category;
  toggleCategoryActive(categoryId: string, admin: Profile): void;
  upsertRegion(region: Region, admin: Profile): Region;
  toggleRegionActive(regionId: string, admin: Profile): void;
  reviewVerification(input: {
    verificationId: string;
    status: VerificationRequestStatus;
    reason: string;
    adminId: string;
    adminName: string;
    adminRole: UserRoleType;
  }): VerificationRequest;
  toggleProPaused(proId: string, admin: Profile, reason: string): ProfessionalProfile;
  toggleUserSuspended(profileId: string, admin: Profile, reason: string): Profile;
  moderateReport(
    reportId: string,
    status: ModerationReport['status'],
    admin: Profile,
    notes: string
  ): void;
  toggleReviewHidden(reviewId: string, admin: Profile, reason: string): void;
  updateTicketStatus(
    ticketId: string,
    status: SupportTicket['status'],
    admin: Profile
  ): void;
  replyToTicket(
    ticketId: string,
    evidenceNote: string,
    status: SupportTicket['status'],
    admin: Profile
  ): void;
  reviewAdminAccessRequest(input: {
    requestId: string;
    decision: 'authorized' | 'rejected';
    assignedRole?: 'central_admin';
    assignedRegionId?: string;
    notes: string;
    admin: Profile;
  }): { request: AdminAccessRequest; createdProfile?: Profile };
  logAdminAudit(log: Omit<AuditLog, 'id' | 'createdAt'>): void;
}
