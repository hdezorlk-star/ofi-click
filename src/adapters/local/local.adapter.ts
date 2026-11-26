import type { DataProvider } from '../data-provider';
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
} from '../../types/oficlick';
import {
  calculateQuoteTotals,
  canAdminAccessRegion,
  canCentralAdminManageGlobal,
  canUserLeaveReview,
  formatMXN,
} from '../../utils/marketplace';
import {
  STORAGE_BUCKETS,
  sanitizeVerificationDocumentsForStorage,
} from '../../utils/media';
import { resolveGoogleOnboardingPolicy } from '../../services/auth/googleOAuth.service';
import {
  NEUTRAL_RECOVERY_RESPONSE_MESSAGE,
  createOneTimeCodeChallenge,
  generateSecureSalt,
  hashSecretWithSalt,
  validatePasswordStrength,
  verifyOneTimeCodeChallenge,
  verifySecretWithSalt,
} from '../../utils/authSecurity';
import { emailService } from '../../services/email/email.service';
import { findIzcalliLocality } from '../../data/izcalliLocations';
import { createInitialSeedState } from './seed-data';

const STORAGE_DB_KEY = 'oficlick_local_db_v3';
const STORAGE_SESSION_KEY = 'oficlick_local_session_profile_id_v3';
const STORAGE_CREDENTIALS_KEY = 'oficlick_local_credentials_v2';

interface StoredCredential {
  salt: string;
  hash: string;
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

export class LocalDataAdapter implements DataProvider {
  readonly mode = 'local' as const;
  private state: AppDatabaseState;
  private currentProfileId: string | null = null;
  private credentials: Record<string, StoredCredential> = {};

  constructor() {
    this.state = this.loadFromStorage();
    this.credentials = this.loadCredentials();
    if (typeof window !== 'undefined') {
      const savedId = window.localStorage.getItem(STORAGE_SESSION_KEY);
      if (savedId && this.state.profiles.some((p) => p.id === savedId && !p.suspended)) {
        this.currentProfileId = savedId;
      }
    }
  }

  private loadFromStorage(): AppDatabaseState {
    if (typeof window === 'undefined') {
      return createInitialSeedState();
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_DB_KEY);
      if (!raw) {
        const seed = createInitialSeedState();
        window.localStorage.setItem(STORAGE_DB_KEY, JSON.stringify(seed));
        return seed;
      }
      const parsed = JSON.parse(raw) as Partial<AppDatabaseState>;
      const fallback = createInitialSeedState();
      const cleanedProfiles = (parsed.profiles ?? fallback.profiles).filter(
        (p) => (p.primaryRole as string) !== 'regional_admin'
      );
      return {
        ...fallback,
        ...parsed,
        profiles: cleanedProfiles,
        adminAccessRequests: (parsed.adminAccessRequests ?? []).map((req) => ({
          ...req,
          requestedScope: 'central_admin' as const,
          authorizedRole: req.authorizedRole ? ('central_admin' as const) : undefined,
        })),
        oneTimeCodes: parsed.oneTimeCodes ?? [],
        preparedEmails: parsed.preparedEmails ?? [],
      };
    } catch {
      return createInitialSeedState();
    }
  }

  private loadCredentials(): Record<string, StoredCredential> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(STORAGE_CREDENTIALS_KEY);
      return raw ? (JSON.parse(raw) as Record<string, StoredCredential>) : {};
    } catch {
      return {};
    }
  }

  private persistCredentials(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_CREDENTIALS_KEY, JSON.stringify(this.credentials));
    } catch {
      // Ignore storage quota errors safely
    }
  }

  private setPasswordForEmail(email: string, plainPassword: string): void {
    const clean = email.trim().toLowerCase();
    const salt = generateSecureSalt();
    const hash = hashSecretWithSalt(plainPassword, salt);
    this.credentials[clean] = { salt, hash };
    this.persistCredentials();
  }

  private verifyPasswordForEmail(email: string, attempt: string, isDemoSeedAccount: boolean): boolean {
    const clean = email.trim().toLowerCase();
    const stored = this.credentials[clean];
    if (stored) {
      return verifySecretWithSalt(attempt, stored.salt, stored.hash);
    }
    if (isDemoSeedAccount) {
      return attempt === 'local1234' || attempt.trim().length >= 6;
    }
    return attempt.length >= 6;
  }

  private recordPreparedEmail(emailRecord: PreparedEmailRecord): PreparedEmailRecord {
    this.state.preparedEmails.unshift(emailRecord);
    if (this.state.preparedEmails.length > 50) {
      this.state.preparedEmails = this.state.preparedEmails.slice(0, 50);
    }
    return emailRecord;
  }

  private persist(): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_DB_KEY, JSON.stringify(this.state));
    } catch {
      // Ignore storage quota errors safely
    }
  }

  private persistSession(): void {
    if (typeof window === 'undefined') return;
    if (this.currentProfileId) {
      window.localStorage.setItem(STORAGE_SESSION_KEY, this.currentProfileId);
    } else {
      window.localStorage.removeItem(STORAGE_SESSION_KEY);
    }
  }

  private pushNotification(
    profileId: string,
    title: string,
    body: string,
    category: 'operation' | 'message' | 'review' | 'security',
    linkView?: string
  ): void {
    this.state.notifications.unshift({
      id: uid('not'),
      profileId,
      title,
      body,
      category,
      read: false,
      linkView,
      createdAt: new Date().toISOString(),
    });
  }

  getSnapshot(): AppDatabaseState {
    return structuredClone(this.state);
  }

  resetWorkspaceData(): AppDatabaseState {
    this.state = createInitialSeedState();
    this.currentProfileId = null;
    this.credentials = {};
    this.persist();
    this.persistSession();
    this.persistCredentials();
    return this.getSnapshot();
  }

  getCurrentProfile(): Profile | null {
    if (!this.currentProfileId) return null;
    const found = this.state.profiles.find((p) => p.id === this.currentProfileId);
    if (!found || found.suspended) return null;
    return structuredClone(found);
  }

  switchWorkspaceRole(role: UserRoleType): Profile {
    const found = this.state.profiles.find(
      (p) => p.primaryRole === role || p.roles.includes(role)
    );
    if (!found) {
      throw new Error(`No existe un perfil configurado para el rol ${role}.`);
    }
    if (found.suspended) {
      throw new Error('Esta cuenta está suspendida por moderación.');
    }
    this.currentProfileId = found.id;
    this.persistSession();
    return structuredClone(found);
  }

  signInWithEmail(email: string, passwordAttempt: string): Profile {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !passwordAttempt.trim()) {
      throw new Error('Ingresa correo electrónico y contraseña.');
    }

    const found = this.state.profiles.find(
      (p) => p.email.toLowerCase() === cleanEmail
    );
    if (!found) {
      const pendingAdmin = this.state.adminAccessRequests.find(
        (r) => r.email.toLowerCase() === cleanEmail
      );
      if (pendingAdmin) {
        if (pendingAdmin.status === 'rejected') {
          throw new Error(
            'Tu solicitud de acceso administrativo fue rechazada. Contacta a Administración Central.'
          );
        }
        if (!pendingAdmin.emailVerified) {
          throw new Error(
            'Debes confirmar primero la verificación de tu correo en tu solicitud administrativa.'
          );
        }
        throw new Error(
          'Tu solicitud de acceso administrativo está pendiente de autorización. Aún no tienes acceso a paneles administrativos.'
        );
      }
      throw new Error('Correo o contraseña incorrectos.');
    }
    if (found.suspended) {
      throw new Error('Tu cuenta se encuentra suspendida. Contacta a soporte.');
    }
    if (!this.verifyPasswordForEmail(cleanEmail, passwordAttempt, found.isDemo)) {
      throw new Error('Correo o contraseña incorrectos.');
    }
    this.currentProfileId = found.id;
    this.persistSession();
    return structuredClone(found);
  }

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
  }): { profile: Profile; welcomeEmail: PreparedEmailRecord } {
    const cleanEmail = input.email.trim().toLowerCase();
    if (!input.fullName.trim() || !cleanEmail.includes('@')) {
      throw new Error('Nombre completo y correo válido son obligatorios.');
    }
    if (input.password !== undefined) {
      const pwCheck = validatePasswordStrength(input.password);
      if (!pwCheck.valid) {
        throw new Error(pwCheck.error || 'Contraseña inválida.');
      }
    }
    if (this.state.profiles.some((p) => p.email.toLowerCase() === cleanEmail)) {
      throw new Error('Ya existe una cuenta registrada con este correo.');
    }
    if (
      this.state.adminAccessRequests.some(
        (r) => r.email.toLowerCase() === cleanEmail && r.status !== 'rejected'
      )
    ) {
      throw new Error(
        'Este correo ya tiene una solicitud administrativa registrada en curso.'
      );
    }

    // Security rule: public signup NEVER assigns central_admin
    const roles: UserRoleType[] =
      input.accountType === 'client' ? ['client'] : ['independent_pro'];

    const profile: Profile = {
      id: uid('usr'),
      fullName: input.fullName.trim(),
      email: cleanEmail,
      emailConfirmed: true,
      avatarUrl: input.avatarUrl,
      avatarConsent: Boolean(input.avatarUrl && (input.avatarConsent ?? true)),
      avatarStorageBucket: input.avatarUrl ? STORAGE_BUCKETS.PUBLIC_AVATARS : undefined,
      primaryRole: input.accountType,
      roles,
      regionId: 'reg-izcalli',
      colonia: input.colonia || 'Centro Urbano',
      suspended: false,
      createdAt: new Date().toISOString(),
      isDemo: false,
      notificationPrefs: {
        inApp: true,
        email: true,
        push: false,
        securityAlertsOnly: false,
      },
    };
    this.state.profiles.push(profile);

    if (input.password) {
      this.setPasswordForEmail(cleanEmail, input.password);
    }

    if (input.accountType === 'independent_pro') {
      const selectedCategoryId = input.categoryId || 'cat-mantenimiento';
      const matchedCat =
        this.state.categories.find((c) => c.id === selectedCategoryId) ||
        this.state.categories.find((c) => c.id === 'cat-mantenimiento');
      const catName = matchedCat?.name || 'Servicios profesionales';
      const matchedLoc = findIzcalliLocality(profile.colonia);
      const proId = uid('pro');
      const extraCols = ['Centro Urbano', 'Ensueños', 'Cumbria', 'Atlanta'].filter(
        (c) => c !== profile.colonia
      );

      this.state.professionals.push({
        id: proId,
        profileId: profile.id,
        displayName: input.fullName.trim(),
        commercialName: input.commercialName?.trim() || undefined,
        avatarUrl: input.avatarUrl,
        avatarPublicConsent: Boolean(input.avatarUrl),
        avatarStorageBucket: STORAGE_BUCKETS.PUBLIC_AVATARS,
        bio: `Especialista en ${catName} con atención directa en ${profile.colonia} y Cuautitlán Izcalli. Presupuesto claro y garantía de trabajo.`,
        specialties: [
          catName,
          ...(matchedCat?.subcategories.slice(0, 2).map((s) => s.name) || []),
        ],
        categoryIds: [selectedCategoryId],
        yearsExperience: 2,
        regionId: 'reg-izcalli',
        primaryColonia: profile.colonia,
        additionalColonias: extraCols,
        coverageZones: [profile.colonia, 'Todo Cuautitlán Izcalli'],
        maxTravelKm: 15,
        homeService: true,
        workshopService: false,
        willingToTravel: true,
        approximateCoords: {
          lat: matchedLoc?.lat ?? 19.6562,
          lng: matchedLoc?.lng ?? -99.2104,
        },
        availabilityStatus: 'available',
        urgentAttention: true,
        weeklySchedule: [
          { day: 'lun', label: 'Lunes', enabled: true, start: '09:00', end: '18:00' },
          { day: 'mar', label: 'Martes', enabled: true, start: '09:00', end: '18:00' },
          { day: 'mie', label: 'Miércoles', enabled: true, start: '09:00', end: '18:00' },
          { day: 'jue', label: 'Jueves', enabled: true, start: '09:00', end: '18:00' },
          { day: 'vie', label: 'Viernes', enabled: true, start: '09:00', end: '18:00' },
          { day: 'sab', label: 'Sábado', enabled: true, start: '09:00', end: '14:00' },
          { day: 'dom', label: 'Domingo', enabled: false, start: '09:00', end: '13:00' },
        ],
        verificationLevel: 2,
        profileComplete: true,
        published: true,
        pausedByAdmin: false,
        ratingAvg: 0,
        reviewsCount: 0,
        completedJobsCount: 0,
        responseRatePercent: 100,
        profileViews: 1,
        joinedAt: new Date().toISOString(),
        isDemo: false,
      });

      this.state.services.push({
        id: uid('srv'),
        professionalId: proId,
        categoryId: selectedCategoryId,
        subcategoryId: matchedCat?.subcategories[0]?.id || `${selectedCategoryId}-sub-1`,
        name: input.commercialName?.trim()
          ? `${catName} — ${input.commercialName.trim()}`
          : `Servicio profesional de ${catName}`,
        description: `Atención en ${profile.colonia} y Cuautitlán Izcalli. Diagnóstico claro, cotización en MXN y trabajo garantizado.`,
        photos: [],
        pricingMode: 'from',
        priceAmount: 450,
        estimatedDurationMin: 90,
        materialsIncluded: false,
        conditions: 'Presupuesto claro previo a iniciar el trabajo.',
        coverageColonias: [profile.colonia, ...extraCols],
        status: 'published',
        urgentAvailable: true,
        isDemo: false,
      });
    }

    const welcomeEmail = this.recordPreparedEmail(
      emailService.prepareEmail({
        eventType: 'welcome',
        toEmail: cleanEmail,
        userName: profile.fullName,
        accountRoleLabel:
          input.accountType === 'client'
            ? 'Cliente'
            : 'Freelancer / Trabajador independiente',
      })
    );

    this.currentProfileId = profile.id;
    this.persist();
    this.persistSession();
    return {
      profile: structuredClone(profile),
      welcomeEmail: structuredClone(welcomeEmail),
    };
  }

  authenticateWithGoogleProfile(input: {
    email: string;
    emailVerified: boolean;
    fullName: string;
    avatarUrl?: string;
    targetRole?: 'client' | 'independent_pro';
    colonia?: string;
    commercialName?: string;
    categoryId?: string;
  }): { profile: Profile; isNewUser: boolean; redirectTab: string } {
    const cleanEmail = input.email.trim().toLowerCase();
    if (!cleanEmail.includes('@') || !input.emailVerified) {
      throw new Error('Se requiere un correo verificado de Google para continuar.');
    }

    const existing = this.state.profiles.find(
      (p) => p.email.toLowerCase() === cleanEmail
    );

    if (existing) {
      const policy = resolveGoogleOnboardingPolicy(existing);
      if (!policy.allowed) {
        throw new Error(policy.reason || 'Cuenta no habilitada.');
      }
      if (!existing.avatarUrl && input.avatarUrl) {
        existing.avatarUrl = input.avatarUrl;
      }
      existing.emailConfirmed = true;
      this.currentProfileId = existing.id;
      this.persist();
      this.persistSession();
      return {
        profile: structuredClone(existing),
        isNewUser: false,
        redirectTab: policy.redirectTab,
      };
    }

    const policy = resolveGoogleOnboardingPolicy(null, input.targetRole || 'client');
    if (!policy.allowed || !policy.assignedRole || policy.assignedRole === 'central_admin') {
      throw new Error(
        policy.reason || 'Rol no permitido para registro directo con Google.'
      );
    }

    const accountType: 'client' | 'independent_pro' =
      policy.assignedRole === 'independent_pro' ? 'independent_pro' : 'client';

    const { profile } = this.registerAccount({
      fullName: input.fullName.trim() || cleanEmail.split('@')[0],
      email: cleanEmail,
      colonia: input.colonia || 'Centro Urbano',
      accountType,
      // No duplicate password required for verified OAuth accounts
      avatarUrl: accountType === 'client' ? input.avatarUrl : undefined,
      avatarConsent: Boolean(input.avatarUrl),
      commercialName: input.commercialName,
      categoryId: input.categoryId,
    });

    const created = this.state.profiles.find((p) => p.id === profile.id);
    if (created) {
      created.emailConfirmed = true;
      if (accountType === 'independent_pro') {
        const pro = this.state.professionals.find((pr) => pr.profileId === created.id);
        if (pro && pro.verificationLevel < 2) {
          pro.verificationLevel = 2;
        }
      }
      this.persist();
    }

    return {
      profile: structuredClone(created || profile),
      isNewUser: true,
      redirectTab: policy.redirectTab,
    };
  }

  submitAdminAccessRequest(input: {
    fullName: string;
    email: string;
    regionId: string;
    colonia: string;
    requestedScope: 'central_admin';
    justification: string;
    password: string;
  }): { request: AdminAccessRequest; verificationEmail: PreparedEmailRecord } {
    const cleanEmail = input.email.trim().toLowerCase();
    if (!input.fullName.trim() || !cleanEmail.includes('@')) {
      throw new Error('Nombre completo y correo válido son obligatorios.');
    }
    if (!input.justification.trim() || input.justification.trim().length < 10) {
      throw new Error('Describe brevemente el motivo de tu solicitud administrativa (mínimo 10 caracteres).');
    }
    const pwCheck = validatePasswordStrength(input.password);
    if (!pwCheck.valid) {
      throw new Error(pwCheck.error || 'Contraseña inválida.');
    }
    if (this.state.profiles.some((p) => p.email.toLowerCase() === cleanEmail)) {
      throw new Error('Ya existe una cuenta registrada con este correo.');
    }

    // Remove any non-authorized previous draft for same email
    this.state.adminAccessRequests = this.state.adminAccessRequests.filter(
      (r) => !(r.email.toLowerCase() === cleanEmail && r.status === 'email_pending')
    );

    if (
      this.state.adminAccessRequests.some(
        (r) => r.email.toLowerCase() === cleanEmail && r.status === 'pending_authorization'
      )
    ) {
      throw new Error(
        'Ya existe una solicitud pendiente de autorización administrativa para este correo.'
      );
    }

    const now = new Date().toISOString();
    const request: AdminAccessRequest = {
      id: uid('admreq'),
      fullName: input.fullName.trim(),
      email: cleanEmail,
      regionId: input.regionId || 'reg-izcalli',
      colonia: input.colonia || 'Centro Urbano',
      requestedScope: input.requestedScope,
      justification: input.justification.trim(),
      emailVerified: false,
      status: 'email_pending',
      createdAt: now,
      updatedAt: now,
    };

    this.setPasswordForEmail(cleanEmail, input.password);
    this.state.adminAccessRequests.unshift(request);

    // Invalidate prior OTPs for same email/purpose
    this.state.oneTimeCodes = this.state.oneTimeCodes.filter(
      (c) => !(c.purpose === 'admin_email_verification' && c.email === cleanEmail)
    );

    const { record, plainCode } = createOneTimeCodeChallenge({
      id: uid('otp'),
      purpose: 'admin_email_verification',
      email: cleanEmail,
      targetId: request.id,
      ttlMinutes: 10,
      maxAttempts: 5,
    });
    this.state.oneTimeCodes.unshift(record);

    const verificationEmail = this.recordPreparedEmail(
      emailService.prepareEmail({
        eventType: 'admin_email_verification',
        toEmail: cleanEmail,
        userName: request.fullName,
        otpCode: plainCode,
        expiresInMinutes: 10,
        requestedScopeLabel: 'Administrador Central',
      })
    );

    this.persist();
    return {
      request: structuredClone(request),
      verificationEmail: structuredClone(verificationEmail),
    };
  }

  resendAdminVerificationCode(requestId: string): {
    request: AdminAccessRequest;
    verificationEmail: PreparedEmailRecord;
  } {
    const request = this.state.adminAccessRequests.find((r) => r.id === requestId);
    if (!request) {
      throw new Error('Solicitud administrativa no encontrada.');
    }
    if (request.emailVerified) {
      throw new Error('El correo de esta solicitud ya fue verificado.');
    }

    this.state.oneTimeCodes = this.state.oneTimeCodes.filter(
      (c) => !(c.purpose === 'admin_email_verification' && c.targetId === request.id)
    );

    const { record, plainCode } = createOneTimeCodeChallenge({
      id: uid('otp'),
      purpose: 'admin_email_verification',
      email: request.email,
      targetId: request.id,
      ttlMinutes: 10,
      maxAttempts: 5,
    });
    this.state.oneTimeCodes.unshift(record);

    const verificationEmail = this.recordPreparedEmail(
      emailService.prepareEmail({
        eventType: 'admin_email_verification',
        toEmail: request.email,
        userName: request.fullName,
        otpCode: plainCode,
        expiresInMinutes: 10,
        requestedScopeLabel: 'Administrador Central',
      })
    );

    this.persist();
    return {
      request: structuredClone(request),
      verificationEmail: structuredClone(verificationEmail),
    };
  }

  verifyAdminRequestOtp(
    requestId: string,
    codeAttempt: string
  ): {
    verified: boolean;
    request?: AdminAccessRequest;
    remainingAttempts?: number;
    error?: string;
  } {
    const request = this.state.adminAccessRequests.find((r) => r.id === requestId);
    if (!request) {
      return { verified: false, error: 'Solicitud administrativa no encontrada.' };
    }

    const codeIdx = this.state.oneTimeCodes.findIndex(
      (c) => c.purpose === 'admin_email_verification' && c.targetId === request.id
    );
    const challenge = codeIdx >= 0 ? this.state.oneTimeCodes[codeIdx] : undefined;
    const check = verifyOneTimeCodeChallenge({ record: challenge, codeAttempt });

    if (check.updatedRecord && codeIdx >= 0) {
      this.state.oneTimeCodes[codeIdx] = check.updatedRecord;
    }

    if (!check.valid) {
      this.persist();
      return {
        verified: false,
        remainingAttempts: check.remainingAttempts,
        error: check.error,
      };
    }

    // CRITICAL: Confirming email NEVER assigns central_admin automatically.
    const now = new Date().toISOString();
    request.emailVerified = true;
    request.emailVerifiedAt = now;
    request.status = 'pending_authorization';
    request.updatedAt = now;

    // Notify Central Admin in local inbox
    const centralAdmin = this.state.profiles.find((p) => p.primaryRole === 'central_admin');
    if (centralAdmin) {
      this.pushNotification(
        centralAdmin.id,
        'Nueva solicitud de acceso administrativo',
        `${request.fullName} (${request.email}) verificó su correo y espera autorización.`,
        'security',
        'usuarios'
      );
    }

    this.persist();
    return {
      verified: true,
      request: structuredClone(request),
    };
  }

  initializeLocalDemoAdmin(requestId: string): {
    request: AdminAccessRequest;
    profile: Profile;
  } {
    if (this.mode !== 'local') {
      throw new Error(
        'Esta función solo está disponible en entorno local de prototipo/demostración.'
      );
    }
    const req = this.state.adminAccessRequests.find((r) => r.id === requestId);
    if (!req) {
      throw new Error('Solicitud administrativa no encontrada.');
    }
    if (!req.emailVerified) {
      throw new Error('Primero verifica el correo electrónico de la solicitud con el código OTP.');
    }
    if (req.status === 'rejected') {
      throw new Error('Esta solicitud fue rechazada y no puede inicializarse.');
    }

    const now = new Date().toISOString();
    const grantedRole = req.requestedScope;
    req.status = 'authorized';
    req.authorizedRole = grantedRole;
    req.authorizedByAdminId = 'local-prototype-init';
    req.authorizedByAdminName = 'Inicialización Local (Prototipo)';
    req.reviewNotes =
      'Acceso administrativo inicializado en modo local para pruebas/exposición (en producción requiere aprobación de Administrador Central en Supabase).';
    req.updatedAt = now;

    const existingProfile = this.state.profiles.find(
      (p) => p.email.toLowerCase() === req.email.toLowerCase()
    );
    let profile: Profile;
    if (existingProfile) {
      existingProfile.primaryRole = grantedRole;
      existingProfile.roles = [grantedRole];
      existingProfile.regionId = req.regionId;
      existingProfile.colonia = req.colonia;
      existingProfile.emailConfirmed = true;
      profile = existingProfile;
    } else {
      profile = {
        id: uid('usr'),
        fullName: req.fullName,
        email: req.email,
        emailConfirmed: true,
        primaryRole: grantedRole,
        roles: [grantedRole],
        regionId: req.regionId,
        colonia: req.colonia,
        suspended: false,
        createdAt: now,
        isDemo: false,
        notificationPrefs: {
          inApp: true,
          email: true,
          push: false,
          securityAlertsOnly: true,
        },
      };
      this.state.profiles.push(profile);
    }
    req.createdProfileId = profile.id;

    this.logAdminAudit({
      actorId: profile.id,
      actorName: profile.fullName,
      actorRole: grantedRole,
      regionId: req.regionId,
      action: 'INICIALIZAR_ADMIN_PROTOTIPO_LOCAL',
      targetEntity: 'admin_access_requests',
      targetId: req.id,
      reason: `Inicialización local de ${grantedRole} tras verificación de correo`,
    });

    this.currentProfileId = profile.id;
    this.persistSession();
    this.persist();

    return {
      request: structuredClone(req),
      profile: structuredClone(profile),
    };
  }

  confirmEmail(profileId: string): Profile {
    const profile = this.state.profiles.find((p) => p.id === profileId);
    if (!profile) throw new Error('Perfil no encontrado.');
    profile.emailConfirmed = true;
    const pro = this.state.professionals.find((pr) => pr.profileId === profileId);
    if (pro) {
      if (pro.verificationLevel < 2) pro.verificationLevel = 2;
      if (pro.profileComplete && !pro.pausedByAdmin) {
        pro.published = true;
      }
    }
    this.persist();
    return structuredClone(profile);
  }

  requestPasswordRecovery(email: string): {
    sent: boolean;
    message: string;
    preparedEmail?: PreparedEmailRecord;
  } {
    const clean = email.trim().toLowerCase();
    if (!clean.includes('@')) {
      throw new Error('Ingresa un correo electrónico válido.');
    }

    const found = this.state.profiles.find((p) => p.email.toLowerCase() === clean);
    let preparedEmail: PreparedEmailRecord | undefined;

    if (found && !found.suspended) {
      this.state.oneTimeCodes = this.state.oneTimeCodes.filter(
        (c) => !(c.purpose === 'password_reset' && c.email === clean)
      );
      const { record, plainCode } = createOneTimeCodeChallenge({
        id: uid('rst'),
        purpose: 'password_reset',
        email: clean,
        targetId: found.id,
        ttlMinutes: 10,
        maxAttempts: 5,
      });
      this.state.oneTimeCodes.unshift(record);
      preparedEmail = this.recordPreparedEmail(
        emailService.prepareEmail({
          eventType: 'password_reset',
          toEmail: clean,
          userName: found.fullName,
          resetCode: plainCode,
          expiresInMinutes: 10,
        })
      );
      this.persist();
    }

    // Anti-enumeration: identical neutral response whether the email exists or not
    return {
      sent: true,
      message: NEUTRAL_RECOVERY_RESPONSE_MESSAGE,
      preparedEmail: preparedEmail ? structuredClone(preparedEmail) : undefined,
    };
  }

  validatePasswordRecoveryCode(
    email: string,
    codeAttempt: string
  ): {
    valid: boolean;
    remainingAttempts?: number;
    error?: string;
  } {
    const clean = email.trim().toLowerCase();
    const codeIdx = this.state.oneTimeCodes.findIndex(
      (c) => c.purpose === 'password_reset' && c.email === clean
    );
    const challenge = codeIdx >= 0 ? this.state.oneTimeCodes[codeIdx] : undefined;

    // Validate without consuming so the next step can consume atomically
    if (!challenge) {
      return {
        valid: false,
        error: 'Código inválido o expirado. Solicita un nuevo código de recuperación.',
      };
    }
    const check = verifyOneTimeCodeChallenge({ record: challenge, codeAttempt });
    if (!check.valid) {
      if (check.updatedRecord && codeIdx >= 0) {
        this.state.oneTimeCodes[codeIdx] = check.updatedRecord;
        this.persist();
      }
      return {
        valid: false,
        remainingAttempts: check.remainingAttempts,
        error: check.error,
      };
    }
    return { valid: true, remainingAttempts: check.remainingAttempts };
  }

  completePasswordReset(
    email: string,
    codeAttempt: string,
    newPassword: string
  ): { success: boolean; message: string } {
    const pwCheck = validatePasswordStrength(newPassword);
    if (!pwCheck.valid) {
      throw new Error(pwCheck.error || 'Contraseña inválida.');
    }

    const clean = email.trim().toLowerCase();
    const codeIdx = this.state.oneTimeCodes.findIndex(
      (c) => c.purpose === 'password_reset' && c.email === clean
    );
    const challenge = codeIdx >= 0 ? this.state.oneTimeCodes[codeIdx] : undefined;
    const check = verifyOneTimeCodeChallenge({ record: challenge, codeAttempt });

    if (check.updatedRecord && codeIdx >= 0) {
      this.state.oneTimeCodes[codeIdx] = check.updatedRecord;
    }

    if (!check.valid) {
      this.persist();
      throw new Error(check.error || 'Código inválido o expirado.');
    }

    const profile = this.state.profiles.find((p) => p.email.toLowerCase() === clean);
    if (!profile) {
      this.persist();
      throw new Error('No fue posible completar el restablecimiento.');
    }

    this.setPasswordForEmail(clean, newPassword);
    this.pushNotification(
      profile.id,
      'Contraseña actualizada',
      'Tu contraseña de acceso en OFI CLICK fue actualizada correctamente.',
      'security',
      'configuracion'
    );
    this.persist();
    return {
      success: true,
      message: 'Tu contraseña se actualizó correctamente. Ya puedes iniciar sesión.',
    };
  }

  signOut(): void {
    this.currentProfileId = null;
    this.persistSession();
  }

  updateProfile(profileId: string, patch: Partial<Profile>): Profile {
    const profile = this.state.profiles.find((p) => p.id === profileId);
    if (!profile) throw new Error('Perfil no encontrado.');
    // Prevent client-side privilege escalation!
    const { roles: _ignoreRoles, primaryRole: _ignorePrimary, suspended: _ignoreSuspended, ...safePatch } = patch;
    Object.assign(profile, safePatch);
    this.persist();
    return structuredClone(profile);
  }

  deleteAccount(profileId: string): void {
    const idx = this.state.profiles.findIndex((p) => p.id === profileId);
    if (idx === -1) return;
    this.state.profiles.splice(idx, 1);
    this.state.favorites = this.state.favorites.filter((f) => f.clientId !== profileId);
    if (this.currentProfileId === profileId) {
      this.currentProfileId = null;
      this.persistSession();
    }
    this.persist();
  }

  updateProfessionalProfile(
    proId: string,
    patch: Partial<ProfessionalProfile>
  ): ProfessionalProfile {
    const pro = this.state.professionals.find((p) => p.id === proId);
    if (!pro) throw new Error('Perfil profesional no encontrado.');
    // Prevent spoofing verificationLevel or admin pause from pro settings
    const { verificationLevel: _v, pausedByAdmin: _p, ...safePatch } = patch;
    Object.assign(pro, safePatch);
    const owner = this.state.profiles.find((u) => u.id === pro.profileId);
    const isComplete =
      pro.bio.trim().length >= 15 &&
      pro.specialties.length > 0 &&
      pro.categoryIds.length > 0 &&
      pro.primaryColonia.trim().length > 0;
    pro.profileComplete = isComplete;
    // Automatic publication rule: complete profile + confirmed email + not paused by admin
    if (isComplete && owner?.emailConfirmed && !pro.pausedByAdmin && patch.published !== false) {
      pro.published = true;
    } else if (!isComplete) {
      pro.published = false;
    }
    this.persist();
    return structuredClone(pro);
  }

  saveService(service: ServiceItem): ServiceItem {
    const idx = this.state.services.findIndex((s) => s.id === service.id);
    if (idx >= 0) {
      this.state.services[idx] = { ...service };
    } else {
      const created = { ...service, id: service.id || uid('srv') };
      this.state.services.unshift(created);
      this.persist();
      return structuredClone(created);
    }
    this.persist();
    return structuredClone(service);
  }

  deleteService(serviceId: string): void {
    this.state.services = this.state.services.filter((s) => s.id !== serviceId);
    this.persist();
  }

  addPortfolioItem(item: PortfolioItem): PortfolioItem {
    const created: PortfolioItem = { ...item, id: item.id || uid('port') };
    this.state.portfolios.unshift(created);
    this.persist();
    return structuredClone(created);
  }

  updatePortfolioItem(item: PortfolioItem): PortfolioItem {
    const idx = this.state.portfolios.findIndex((p) => p.id === item.id);
    if (idx === -1) throw new Error('Elemento de portafolio no encontrado.');
    this.state.portfolios[idx] = structuredClone(item);
    this.persist();
    return structuredClone(item);
  }

  deletePortfolioItem(itemId: string): void {
    this.state.portfolios = this.state.portfolios.filter((p) => p.id !== itemId);
    this.persist();
  }

  updateSchedule(proId: string, schedule: DaySchedule[], status: AvailabilityStatus): void {
    const pro = this.state.professionals.find((p) => p.id === proId);
    if (!pro) throw new Error('Profesional no encontrado.');
    pro.weeklySchedule = schedule;
    pro.availabilityStatus = status;
    this.persist();
  }

  addAvailabilityBlock(block: Omit<AvailabilityBlock, 'id'>): AvailabilityBlock {
    const created: AvailabilityBlock = { ...block, id: uid('blk') };
    this.state.availabilityBlocks.push(created);
    this.persist();
    return structuredClone(created);
  }

  removeAvailabilityBlock(blockId: string): void {
    this.state.availabilityBlocks = this.state.availabilityBlocks.filter((b) => b.id !== blockId);
    this.persist();
  }

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
  ): VerificationRequest {
    if (documents.length === 0) {
      throw new Error('Adjunta tu identificación oficial (INE) y fotografía frontal para iniciar la revisión.');
    }
    const now = new Date().toISOString();
    const sanitizedDocs = sanitizeVerificationDocumentsForStorage(
      documents.map((d) => ({
        id: uid('doc'),
        docKind: d.docKind || 'credential',
        label: d.label,
        fileName: d.fileName,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        uploadedAt: now,
        storageBucket: STORAGE_BUCKETS.PRIVATE_VERIFICATIONS,
        previewRefKey: d.previewRefKey,
        isDemo: Boolean(d.isDemo),
        privateOnly: true as const,
      }))
    );

    // IMPORTANT: submitting documents NEVER auto-verifies a freelancer.
    const req: VerificationRequest = {
      id: uid('ver'),
      professionalId: proId,
      requestedLevel: 4,
      documents: sanitizedDocs,
      status: 'pending',
      history: [
        {
          status: 'pending',
          note: 'Documentación y fotografía frontal recibidas en espera de revisión administrativa.',
          date: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
    this.state.verificationRequests.unshift(req);
    this.persist();
    return structuredClone(req);
  }

  createServiceRequest(
    input: Omit<ServiceRequest, 'id' | 'createdAt' | 'status' | 'recipientStatuses' | 'isDemo'>
  ): ServiceRequest {
    if (input.recipientProfessionalIds.length === 0) {
      throw new Error('Selecciona al menos un profesional destinatario.');
    }
    const statuses: ServiceRequest['recipientStatuses'] = {};
    for (const proId of input.recipientProfessionalIds) {
      statuses[proId] = 'pending';
    }
    const req: ServiceRequest = {
      ...input,
      id: uid('req'),
      recipientStatuses: statuses,
      status: 'sent',
      createdAt: new Date().toISOString(),
      isDemo: true,
    };
    this.state.requests.unshift(req);

    // Notify every selected recipient (no cap!)
    for (const proId of req.recipientProfessionalIds) {
      const pro = this.state.professionals.find((p) => p.id === proId);
      if (pro) {
        this.pushNotification(
          pro.profileId,
          'Nueva solicitud de servicio',
          `${req.title} en ${req.colonia} (${req.desiredDate}).`,
          'operation',
          'solicitudes'
        );
        const proProfile = this.state.profiles.find((u) => u.id === pro.profileId);
        if (proProfile?.email) {
          this.recordPreparedEmail(
            emailService.prepareEmail({
              eventType: 'request_received',
              toEmail: proProfile.email,
              recipientName: pro.displayName,
              serviceTitle: req.title,
              colonia: req.colonia,
              desiredDate: req.desiredDate,
            })
          );
        }
      }
    }
    this.persist();
    return structuredClone(req);
  }

  updateRequestRecipientStatus(
    requestId: string,
    proId: string,
    status: ServiceRequest['recipientStatuses'][string]
  ): void {
    const req = this.state.requests.find((r) => r.id === requestId);
    if (!req) return;
    req.recipientStatuses[proId] = status;
    if (status === 'info_requested' && req.status === 'sent') {
      req.status = 'in_conversation';
    }
    const pro = this.state.professionals.find((p) => p.id === proId);
    if (status === 'info_requested' && pro) {
      this.pushNotification(
        req.clientId,
        'Un profesional solicita más información',
        `${pro.displayName} preguntó sobre "${req.title}".`,
        'operation',
        'mensajes'
      );
    }
    this.persist();
  }

  closeOrCancelRequest(requestId: string, status: 'closed' | 'cancelled'): void {
    const req = this.state.requests.find((r) => r.id === requestId);
    if (!req) return;
    req.status = status;
    this.persist();
  }

  sendOrReviseQuote(input: {
    quoteId?: string;
    requestId: string;
    professionalId: string;
    clientId: string;
    serviceName: string;
    description: string;
    versionData: Omit<QuoteVersion, 'versionNumber' | 'createdAt'>;
  }): Quote {
    const calc = calculateQuoteTotals({
      laborAmount: input.versionData.laborAmount,
      materialsAmount: input.versionData.materialsAmount,
      additionalCharges: input.versionData.additionalCharges,
      discountAmount: input.versionData.discountAmount,
    });
    if (!calc.valid) {
      throw new Error(calc.error || 'Importes inválidos.');
    }

    const req = this.state.requests.find((r) => r.id === input.requestId);
    if (req) {
      req.recipientStatuses[input.professionalId] = 'quoted';
      if (req.status === 'sent' || req.status === 'in_conversation') {
        req.status = 'quoted';
      }
    }

    const existing = input.quoteId
      ? this.state.quotes.find((q) => q.id === input.quoteId)
      : this.state.quotes.find(
          (q) => q.requestId === input.requestId && q.professionalId === input.professionalId
        );

    const now = new Date().toISOString();
    let quote: Quote;

    if (existing) {
      const nextVersion = existing.currentVersion + 1;
      existing.currentVersion = nextVersion;
      existing.status = 'revised';
      existing.updatedAt = now;
      existing.versions.push({
        ...input.versionData,
        totalAmount: calc.totalAmount,
        versionNumber: nextVersion,
        createdAt: now,
      });
      quote = existing;
      this.pushNotification(
        input.clientId,
        'Cotización actualizada (nueva versión)',
        `Nueva versión v${nextVersion} por $${calc.totalAmount} MXN para "${input.serviceName}".`,
        'operation',
        'solicitudes'
      );
    } else {
      quote = {
        id: uid('qt'),
        requestId: input.requestId,
        professionalId: input.professionalId,
        clientId: input.clientId,
        serviceName: input.serviceName,
        description: input.description,
        status: 'sent',
        currentVersion: 1,
        versions: [
          {
            ...input.versionData,
            totalAmount: calc.totalAmount,
            versionNumber: 1,
            createdAt: now,
          },
        ],
        createdAt: now,
        updatedAt: now,
      };
      this.state.quotes.unshift(quote);
      this.pushNotification(
        input.clientId,
        'Cotización recibida',
        `Recibiste una cotización por $${calc.totalAmount} MXN para "${input.serviceName}".`,
        'operation',
        'solicitudes'
      );
    }

    const pro = this.state.professionals.find((p) => p.id === input.professionalId);
    const clientProfile = this.state.profiles.find((u) => u.id === input.clientId);
    if (pro && clientProfile?.email) {
      this.recordPreparedEmail(
        emailService.prepareEmail({
          eventType: 'quote_received',
          toEmail: clientProfile.email,
          clientName: clientProfile.fullName,
          professionalName: pro.displayName,
          serviceTitle: input.serviceName,
          totalAmountMxn: formatMXN(calc.totalAmount),
        })
      );
    }
    if (pro) {
      const conv = this.getOrCreateConversation({
        participantIds: [input.clientId, pro.profileId],
        requestId: input.requestId,
      });
      this.sendMessage({
        conversationId: conv.id,
        senderId: pro.profileId,
        text: `Envié la cotización v${quote.currentVersion} por $${calc.totalAmount} MXN (${input.serviceName}).`,
        attachmentType: 'quote',
        quoteId: quote.id,
      });
    }

    this.persist();
    return structuredClone(quote);
  }

  respondToQuote(
    quoteId: string,
    decision: 'accepted' | 'rejected'
  ): { quote: Quote; booking?: Booking } {
    const quote = this.state.quotes.find((q) => q.id === quoteId);
    if (!quote) throw new Error('Cotización no encontrada.');
    const latest = quote.versions[quote.versions.length - 1];
    const req = this.state.requests.find((r) => r.id === quote.requestId);
    const pro = this.state.professionals.find((p) => p.id === quote.professionalId);
    const client = this.state.profiles.find((u) => u.id === quote.clientId);

    if (decision === 'rejected') {
      quote.status = 'rejected';
      quote.updatedAt = new Date().toISOString();
      if (pro) {
        this.pushNotification(
          pro.profileId,
          'Cotización rechazada',
          `El cliente declinó la cotización de "${quote.serviceName}".`,
          'operation',
          'cotizaciones'
        );
      }
      this.persist();
      return { quote: structuredClone(quote) };
    }

    const existingForThisQuote = this.state.bookings.find(
      (b) => b.quoteId === quote.id && b.status !== 'cancelled' && b.status !== 'rejected'
    );
    if (existingForThisQuote) {
      return {
        quote: structuredClone(quote),
        booking: structuredClone(existingForThisQuote),
      };
    }

    const existingForRequest = this.state.bookings.find(
      (b) =>
        b.requestId === quote.requestId &&
        b.status !== 'cancelled' &&
        b.status !== 'rejected'
    );
    if (existingForRequest) {
      throw new Error('Ya existe una contratación activa vinculada a esta solicitud.');
    }

    quote.status = 'accepted';
    quote.updatedAt = new Date().toISOString();

    // Decline competing open quotes for the same request so the client doesn't accept two
    for (const other of this.state.quotes) {
      if (
        other.id !== quote.id &&
        other.requestId === quote.requestId &&
        (other.status === 'sent' || other.status === 'revised')
      ) {
        other.status = 'rejected';
        other.updatedAt = quote.updatedAt;
        const otherPro = this.state.professionals.find((p) => p.id === other.professionalId);
        if (otherPro) {
          this.pushNotification(
            otherPro.profileId,
            'Otra propuesta seleccionada',
            `El cliente eligió otra cotización para "${other.serviceName}".`,
            'operation',
            'cotizaciones'
          );
        }
      }
    }

    if (req) {
      req.status = 'accepted';
    }

    const bookingId = uid('bk');
    const now = new Date().toISOString();
    const booking: Booking = {
      id: bookingId,
      requestId: quote.requestId,
      quoteId: quote.id,
      quoteVersion: latest.versionNumber,
      clientId: quote.clientId,
      professionalId: quote.professionalId,
      regionId: req?.regionId || 'reg-izcalli',
      serviceTitle: quote.serviceName,
      description: quote.description,
      agreedAmountMxn: latest.totalAmount,
      paymentNote: 'Pago acordado directamente fuera de OFI CLICK entre cliente y profesional',
      paymentConfirmedOutside: false,
      scheduledDate: latest.proposedDate,
      scheduledTime: latest.proposedTime,
      colonia: req?.colonia || 'Centro Urbano',
      privateAddress: req?.privateAddress || `Domicilio en ${req?.colonia || 'Cuautitlán Izcalli'}`,
      conditions: latest.conditions,
      status: 'scheduled',
      events: [
        {
          id: uid('ev'),
          bookingId,
          status: 'quote_accepted',
          actorId: quote.clientId,
          actorName: client?.fullName || 'Cliente',
          note: `Cotización v${latest.versionNumber} aceptada por $${latest.totalAmount} MXN.`,
          createdAt: now,
        },
        {
          id: uid('ev'),
          bookingId,
          status: 'scheduled',
          actorId: quote.clientId,
          actorName: client?.fullName || 'Cliente',
          note: `Servicio programado para ${latest.proposedDate} a las ${latest.proposedTime}.`,
          createdAt: now,
        },
      ],
      createdAt: now,
    };

    this.state.bookings.unshift(booking);
    this.state.availabilityBlocks.push({
      id: uid('blk'),
      professionalId: quote.professionalId,
      date: latest.proposedDate,
      startTime: latest.proposedTime,
      endTime: latest.proposedTime,
      reason: `${quote.serviceName} (${client?.fullName || 'Cliente'})`,
      type: 'booking',
      bookingId,
    });

    if (pro) {
      const conv = this.getOrCreateConversation({
        participantIds: [quote.clientId, pro.profileId],
        requestId: quote.requestId,
        bookingId,
      });
      const convTarget = this.state.conversations.find((c) => c.id === conv.id);
      if (convTarget && !convTarget.bookingId) {
        convTarget.bookingId = bookingId;
      }
      this.pushNotification(
        pro.profileId,
        '¡Cotización aceptada y servicio programado!',
        `${client?.fullName || 'El cliente'} aceptó tu cotización por $${latest.totalAmount} MXN.`,
        'operation',
        'calendario'
      );
      const proProfile = this.state.profiles.find((u) => u.id === pro.profileId);
      if (proProfile?.email) {
        this.recordPreparedEmail(
          emailService.prepareEmail({
            eventType: 'quote_accepted',
            toEmail: proProfile.email,
            professionalName: pro.displayName,
            clientName: client?.fullName || 'Cliente',
            serviceTitle: quote.serviceName,
            totalAmountMxn: formatMXN(latest.totalAmount),
          })
        );
      }
    }
    if (client?.email) {
      this.recordPreparedEmail(
        emailService.prepareEmail({
          eventType: 'booking_confirmed',
          toEmail: client.email,
          recipientName: client.fullName,
          serviceTitle: quote.serviceName,
          scheduledDate: booking.scheduledDate,
          scheduledTime: booking.scheduledTime,
        })
      );
    }

    this.persist();
    return { quote: structuredClone(quote), booking: structuredClone(booking) };
  }

  updateBookingStatus(input: {
    bookingId: string;
    status: BookingStatus;
    actorId: string;
    actorName: string;
    note: string;
    photos?: string[];
  }): Booking {
    const bk = this.state.bookings.find((b) => b.id === input.bookingId);
    if (!bk) throw new Error('Contratación no encontrada.');
    bk.status = input.status;
    if (input.status === 'pro_marked_done') {
      bk.completionNotes = input.note;
      bk.completionPhotos = input.photos || [];
    }
    if (input.status === 'completed' || input.status === 'client_confirmed') {
      bk.status = 'completed';
      const pro = this.state.professionals.find((p) => p.id === bk.professionalId);
      if (pro) {
        pro.completedJobsCount += 1;
      }
    }
    bk.events.push({
      id: uid('ev'),
      bookingId: bk.id,
      status: bk.status,
      actorId: input.actorId,
      actorName: input.actorName,
      note: input.note,
      photos: input.photos,
      createdAt: new Date().toISOString(),
    });

    const pro = this.state.professionals.find((p) => p.id === bk.professionalId);
    if (input.actorId === bk.clientId && pro) {
      this.pushNotification(
        pro.profileId,
        'Actualización de servicio',
        `${input.actorName}: ${input.note}`,
        'operation',
        'contrataciones'
      );
    } else {
      this.pushNotification(
        bk.clientId,
        'Actualización de tu servicio',
        `${input.actorName}: ${input.note}`,
        'operation',
        'contrataciones'
      );
    }

    this.persist();
    return structuredClone(bk);
  }

  proposeReschedule(input: {
    bookingId: string;
    proposedDate: string;
    proposedTime: string;
    reason: string;
    proposedById: string;
    proposedByRole: 'client' | 'pro';
  }): Booking {
    const bk = this.state.bookings.find((b) => b.id === input.bookingId);
    if (!bk) throw new Error('Contratación no encontrada.');
    bk.rescheduleProposal = {
      id: uid('rsch'),
      proposedDate: input.proposedDate,
      proposedTime: input.proposedTime,
      reason: input.reason,
      proposedById: input.proposedById,
      clientAccepted: input.proposedByRole === 'client',
      proAccepted: input.proposedByRole === 'pro',
      createdAt: new Date().toISOString(),
    };
    const pro = this.state.professionals.find((p) => p.id === bk.professionalId);
    const targetId = input.proposedByRole === 'client' ? pro?.profileId : bk.clientId;
    if (targetId) {
      this.pushNotification(
        targetId,
        'Solicitud de reprogramación',
        `Propuesta de nueva fecha: ${input.proposedDate} ${input.proposedTime} (${input.reason}).`,
        'operation',
        'contrataciones'
      );
    }
    this.persist();
    return structuredClone(bk);
  }

  respondReschedule(
    bookingId: string,
    responderRole: 'client' | 'pro',
    accept: boolean
  ): Booking {
    const bk = this.state.bookings.find((b) => b.id === bookingId);
    if (!bk || !bk.rescheduleProposal) throw new Error('Sin propuesta activa.');
    if (!accept) {
      bk.events.push({
        id: uid('ev'),
        bookingId: bk.id,
        status: bk.status,
        actorId: this.currentProfileId || 'system',
        actorName: responderRole === 'client' ? 'Cliente' : 'Profesional',
        note: 'Propuesta de reprogramación rechazada; se mantiene la fecha original.',
        createdAt: new Date().toISOString(),
      });
      bk.rescheduleProposal = undefined;
      this.persist();
      return structuredClone(bk);
    }
    if (responderRole === 'client') bk.rescheduleProposal.clientAccepted = true;
    if (responderRole === 'pro') bk.rescheduleProposal.proAccepted = true;
    if (bk.rescheduleProposal.clientAccepted && bk.rescheduleProposal.proAccepted) {
      bk.scheduledDate = bk.rescheduleProposal.proposedDate;
      bk.scheduledTime = bk.rescheduleProposal.proposedTime;
      for (const blk of this.state.availabilityBlocks) {
        if (blk.bookingId === bk.id) {
          blk.date = bk.scheduledDate;
          blk.startTime = bk.scheduledTime;
          blk.endTime = bk.scheduledTime;
        }
      }
      bk.events.push({
        id: uid('ev'),
        bookingId: bk.id,
        status: bk.status,
        actorId: this.currentProfileId || 'system',
        actorName: 'Ambas partes',
        note: `Reprogramación confirmada por ambas partes para ${bk.scheduledDate} a las ${bk.scheduledTime}.`,
        createdAt: new Date().toISOString(),
      });
      const pro = this.state.professionals.find((p) => p.id === bk.professionalId);
      const counterpartyId = responderRole === 'client' ? pro?.profileId : bk.clientId;
      if (counterpartyId) {
        this.pushNotification(
          counterpartyId,
          'Reprogramación confirmada',
          `${bk.serviceTitle} quedó reprogramado para ${bk.scheduledDate} a las ${bk.scheduledTime}.`,
          'operation',
          responderRole === 'client' ? 'calendario' : 'contratados'
        );
      }
      const client = this.state.profiles.find((u) => u.id === bk.clientId);
      if (client?.email) {
        this.recordPreparedEmail(
          emailService.prepareEmail({
            eventType: 'booking_rescheduled',
            toEmail: client.email,
            recipientName: client.fullName,
            serviceTitle: bk.serviceTitle,
            newDate: bk.scheduledDate,
            newTime: bk.scheduledTime,
          })
        );
      }
      bk.rescheduleProposal = undefined;
    }
    this.persist();
    return structuredClone(bk);
  }

  cancelBooking(input: {
    bookingId: string;
    actorId: string;
    actorRole: string;
    reason: string;
  }): Booking {
    if (!input.reason.trim()) {
      throw new Error('Debes indicar el motivo de la cancelación.');
    }
    const bk = this.state.bookings.find((b) => b.id === input.bookingId);
    if (!bk) throw new Error('Contratación no encontrada.');
    bk.status = 'cancelled';
    bk.cancellationInfo = {
      cancelledById: input.actorId,
      cancelledByRole: input.actorRole,
      reason: input.reason.trim(),
      cancelledAt: new Date().toISOString(),
    };
    bk.events.push({
      id: uid('ev'),
      bookingId: bk.id,
      status: 'cancelled',
      actorId: input.actorId,
      actorName: input.actorRole,
      note: `Cancelado: ${input.reason.trim()}`,
      createdAt: new Date().toISOString(),
    });
    // Free up the freelancer's calendar block
    this.state.availabilityBlocks = this.state.availabilityBlocks.filter(
      (b) => b.bookingId !== bk.id
    );
    const pro = this.state.professionals.find((p) => p.id === bk.professionalId);
    const notifyTargetId = input.actorId === bk.clientId ? pro?.profileId : bk.clientId;
    if (notifyTargetId) {
      this.pushNotification(
        notifyTargetId,
        'Contratación cancelada',
        `${bk.serviceTitle}: ${input.reason.trim()}`,
        'operation',
        input.actorId === bk.clientId ? 'contrataciones' : 'contratados'
      );
    }
    const client = this.state.profiles.find((u) => u.id === bk.clientId);
    if (client?.email) {
      this.recordPreparedEmail(
        emailService.prepareEmail({
          eventType: 'booking_cancelled',
          toEmail: client.email,
          recipientName: client.fullName,
          serviceTitle: bk.serviceTitle,
          reason: input.reason.trim(),
        })
      );
    }
    this.persist();
    return structuredClone(bk);
  }

  getOrCreateConversation(input: {
    participantIds: string[];
    requestId?: string;
    bookingId?: string;
  }): Conversation {
    const sorted = [...new Set(input.participantIds)].sort();
    const existing = this.state.conversations.find((c) => {
      const cSorted = [...c.participantIds].sort();
      return (
        cSorted.length === sorted.length &&
        cSorted.every((v, idx) => v === sorted[idx])
      );
    });
    if (existing) return structuredClone(existing);

    const created: Conversation = {
      id: uid('conv'),
      requestId: input.requestId,
      bookingId: input.bookingId,
      participantIds: sorted,
      blockedByIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.state.conversations.unshift(created);
    this.persist();
    return structuredClone(created);
  }

  sendMessage(input: {
    conversationId: string;
    senderId: string;
    text: string;
    attachmentName?: string;
    attachmentType?: ChatMessage['attachmentType'];
    attachment?: ChatAttachmentMetadata;
    quoteId?: string;
    sharedLocationNote?: string;
  }): ChatMessage {
    const conv = this.state.conversations.find((c) => c.id === input.conversationId);
    if (!conv) throw new Error('Conversación no encontrada.');
    if (!conv.participantIds.includes(input.senderId)) {
      throw new Error('Acceso denegado a esta conversación.');
    }
    if (conv.blockedByIds.length > 0) {
      throw new Error('Esta conversación tiene un bloqueo activo.');
    }
    const msg: ChatMessage = {
      id: uid('msg'),
      conversationId: input.conversationId,
      senderId: input.senderId,
      text: input.text.trim(),
      attachmentName: input.attachmentName || input.attachment?.name,
      attachmentType: input.attachmentType,
      attachment: input.attachment,
      quoteId: input.quoteId,
      sharedLocationNote: input.sharedLocationNote,
      readByIds: [input.senderId],
      createdAt: new Date().toISOString(),
    };
    this.state.messages.push(msg);
    conv.updatedAt = msg.createdAt;
    for (const pid of conv.participantIds) {
      if (pid !== input.senderId) {
        this.pushNotification(
          pid,
          'Nuevo mensaje en OFI CLICK',
          msg.text.slice(0, 80),
          'message',
          'mensajes'
        );
      }
    }
    this.persist();
    return structuredClone(msg);
  }

  markConversationRead(conversationId: string, profileId: string): void {
    let changed = false;
    for (const m of this.state.messages) {
      if (m.conversationId === conversationId && !m.readByIds.includes(profileId)) {
        m.readByIds.push(profileId);
        changed = true;
      }
    }
    if (changed) this.persist();
  }

  toggleBlockConversation(conversationId: string, profileId: string): void {
    const conv = this.state.conversations.find((c) => c.id === conversationId);
    if (!conv) return;
    if (conv.blockedByIds.includes(profileId)) {
      conv.blockedByIds = conv.blockedByIds.filter((id) => id !== profileId);
    } else {
      conv.blockedByIds.push(profileId);
    }
    this.persist();
  }

  toggleFavorite(clientId: string, professionalId: string): boolean {
    const idx = this.state.favorites.findIndex(
      (f) => f.clientId === clientId && f.professionalId === professionalId
    );
    if (idx >= 0) {
      this.state.favorites.splice(idx, 1);
      this.persist();
      return false;
    }
    this.state.favorites.push({
      clientId,
      professionalId,
      createdAt: new Date().toISOString(),
    });
    this.persist();
    return true;
  }

  publishReview(
    input: Omit<Review, 'id' | 'createdAt' | 'reported' | 'hiddenByAdmin'>
  ): Review {
    const booking = this.state.bookings.find((b) => b.id === input.bookingId);
    if (!booking) throw new Error('Contratación no encontrada.');
    const check = canUserLeaveReview(booking, this.state.reviews, input.clientId);
    if (!check.allowed) {
      throw new Error(check.reason || 'No autorizado para reseñar.');
    }
    const review: Review = {
      ...input,
      id: uid('rev'),
      reported: false,
      hiddenByAdmin: false,
      createdAt: new Date().toISOString(),
    };
    this.state.reviews.unshift(review);

    const pro = this.state.professionals.find((p) => p.id === input.professionalId);
    if (pro) {
      const visible = this.state.reviews.filter(
        (r) => r.professionalId === pro.id && !r.hiddenByAdmin
      );
      pro.reviewsCount = visible.length;
      pro.ratingAvg =
        visible.length > 0
          ? Number(
              (visible.reduce((acc, r) => acc + r.rating, 0) / visible.length).toFixed(1)
            )
          : 0;
      this.pushNotification(
        pro.profileId,
        'Nueva reseña recibida',
        `${input.clientName} te calificó con ${input.rating} estrellas.`,
        'review',
        'resenas'
      );
    }
    this.persist();
    return structuredClone(review);
  }

  replyToReview(reviewId: string, responseText: string): Review {
    const rev = this.state.reviews.find((r) => r.id === reviewId);
    if (!rev) throw new Error('Reseña no encontrada.');
    rev.proResponse = {
      text: responseText.trim(),
      respondedAt: new Date().toISOString(),
    };
    this.persist();
    return structuredClone(rev);
  }

  reportReview(reviewId: string, reporterId: string, reason: string): void {
    const rev = this.state.reviews.find((r) => r.id === reviewId);
    if (!rev) return;
    rev.reported = true;
    const pro = this.state.professionals.find((p) => p.id === rev.professionalId);
    this.state.reports.unshift({
      id: uid('rep'),
      reporterId,
      targetType: 'review',
      targetId: reviewId,
      regionId: pro?.regionId || 'reg-izcalli',
      reason,
      status: 'open',
      createdAt: new Date().toISOString(),
    });
    this.persist();
  }

  markNotificationRead(notificationId: string): void {
    const n = this.state.notifications.find((item) => item.id === notificationId);
    if (n) {
      n.read = true;
      this.persist();
    }
  }

  markAllNotificationsRead(profileId: string): void {
    for (const n of this.state.notifications) {
      if (n.profileId === profileId) n.read = true;
    }
    this.persist();
  }

  createSupportTicket(
    input: Omit<SupportTicket, 'id' | 'createdAt' | 'status'>
  ): SupportTicket {
    const tkt: SupportTicket = {
      ...input,
      id: uid('tkt'),
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    this.state.supportTickets.unshift(tkt);
    this.persist();
    return structuredClone(tkt);
  }

  createReport(
    input: Omit<ModerationReport, 'id' | 'createdAt' | 'status'>
  ): ModerationReport {
    const rep: ModerationReport = {
      ...input,
      id: uid('rep'),
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    this.state.reports.unshift(rep);
    this.persist();
    return structuredClone(rep);
  }

  private assertAdmin(admin: Profile, targetRegionId: string): void {
    if (!canAdminAccessRegion(admin, targetRegionId)) {
      throw new Error(
        'Acceso restringido: no tienes permisos administrativos sobre esta región.'
      );
    }
  }

  private assertCentralAdmin(admin: Profile): void {
    if (!canCentralAdminManageGlobal(admin)) {
      throw new Error(
        'Acceso restringido: solo el Administrador Central puede gestionar catálogo global y regiones.'
      );
    }
  }

  upsertCategory(category: Category, admin: Profile): Category {
    this.assertCentralAdmin(admin);
    const idx = this.state.categories.findIndex((c) => c.id === category.id);
    if (idx >= 0) {
      this.state.categories[idx] = structuredClone(category);
    } else {
      this.state.categories.push(structuredClone(category));
    }
    this.logAdminAudit({
      actorId: admin.id,
      actorName: admin.fullName,
      actorRole: admin.primaryRole,
      regionId: admin.regionId,
      action: idx >= 0 ? 'ACTUALIZAR_CATEGORIA' : 'CREAR_CATEGORIA',
      targetEntity: 'categories',
      targetId: category.id,
      reason: `Gestión de categoría "${category.name}"`,
    });
    this.persist();
    return structuredClone(category);
  }

  toggleCategoryActive(categoryId: string, admin: Profile): void {
    this.assertCentralAdmin(admin);
    const cat = this.state.categories.find((c) => c.id === categoryId);
    if (cat) {
      cat.active = !cat.active;
      this.logAdminAudit({
        actorId: admin.id,
        actorName: admin.fullName,
        actorRole: admin.primaryRole,
        regionId: admin.regionId,
        action: cat.active ? 'ACTIVAR_CATEGORIA' : 'PAUSAR_CATEGORIA',
        targetEntity: 'categories',
        targetId: cat.id,
        reason: `Estado de categoría "${cat.name}"`,
      });
      this.persist();
    }
  }

  upsertRegion(region: Region, admin: Profile): Region {
    this.assertCentralAdmin(admin);
    const idx = this.state.regions.findIndex((r) => r.id === region.id);
    if (idx >= 0) {
      this.state.regions[idx] = structuredClone(region);
    } else {
      this.state.regions.push(structuredClone(region));
    }
    this.logAdminAudit({
      actorId: admin.id,
      actorName: admin.fullName,
      actorRole: admin.primaryRole,
      regionId: region.id,
      action: idx >= 0 ? 'ACTUALIZAR_REGION' : 'CREAR_REGION',
      targetEntity: 'regions',
      targetId: region.id,
      reason: `Gestión de región "${region.name}"`,
    });
    this.persist();
    return structuredClone(region);
  }

  toggleRegionActive(regionId: string, admin: Profile): void {
    this.assertCentralAdmin(admin);
    const reg = this.state.regions.find((r) => r.id === regionId);
    if (reg) {
      reg.active = !reg.active;
      this.logAdminAudit({
        actorId: admin.id,
        actorName: admin.fullName,
        actorRole: admin.primaryRole,
        regionId: reg.id,
        action: reg.active ? 'ACTIVAR_REGION' : 'PAUSAR_REGION',
        targetEntity: 'regions',
        targetId: reg.id,
        reason: `Cambio de disponibilidad regional en "${reg.name}"`,
      });
      this.persist();
    }
  }

  reviewVerification(input: {
    verificationId: string;
    status: VerificationRequestStatus;
    reason: string;
    adminId: string;
    adminName: string;
    adminRole: UserRoleType;
  }): VerificationRequest {
    const ver = this.state.verificationRequests.find((v) => v.id === input.verificationId);
    if (!ver) throw new Error('Solicitud de verificación no encontrada.');
    const pro = this.state.professionals.find((p) => p.id === ver.professionalId);
    const admin = this.state.profiles.find((u) => u.id === input.adminId);
    if (admin && pro) {
      this.assertAdmin(admin, pro.regionId);
    }

    const now = new Date().toISOString();
    ver.status = input.status;
    ver.reviewReason = input.reason;
    ver.reviewedByAdminId = input.adminId;
    ver.updatedAt = now;
    ver.history.push({
      status: input.status,
      note: input.reason,
      date: now,
    });

    const statusLabelMap: Record<VerificationRequestStatus, string> = {
      pending: 'Pendiente de revisión',
      in_review: 'En revisión',
      approved: 'Aprobada (Verificado Nivel 4)',
      corrections_needed: 'Requiere correcciones',
      rejected: 'Rechazada',
    };

    if (pro) {
      if (input.status === 'approved') {
        pro.verificationLevel = ver.requestedLevel;
      }
      this.pushNotification(
        pro.profileId,
        'Actualización de verificación de identidad',
        `Estado: ${statusLabelMap[input.status]}. ${input.reason}`,
        'security',
        'perfil'
      );
    }

    this.logAdminAudit({
      actorId: input.adminId,
      actorName: input.adminName,
      actorRole: input.adminRole,
      regionId: pro?.regionId || 'reg-izcalli',
      action: `VERIFICACION_${input.status.toUpperCase()}`,
      targetEntity: 'verification_requests',
      targetId: ver.id,
      reason: input.reason,
    });

    this.persist();
    return structuredClone(ver);
  }

  toggleProPaused(proId: string, admin: Profile, reason: string): ProfessionalProfile {
    const pro = this.state.professionals.find((p) => p.id === proId);
    if (!pro) throw new Error('Profesional no encontrado.');
    this.assertAdmin(admin, pro.regionId);
    pro.pausedByAdmin = !pro.pausedByAdmin;
    const owner = this.state.profiles.find((u) => u.id === pro.profileId);
    if (pro.pausedByAdmin) pro.published = false;
    else if (pro.profileComplete && owner?.emailConfirmed) pro.published = true;

    this.logAdminAudit({
      actorId: admin.id,
      actorName: admin.fullName,
      actorRole: admin.primaryRole,
      regionId: pro.regionId,
      action: pro.pausedByAdmin ? 'PAUSAR_PERFIL_PRO' : 'REACTIVAR_PERFIL_PRO',
      targetEntity: 'professional_profiles',
      targetId: pro.id,
      reason,
    });
    this.persist();
    return structuredClone(pro);
  }

  toggleUserSuspended(profileId: string, admin: Profile, reason: string): Profile {
    const target = this.state.profiles.find((p) => p.id === profileId);
    if (!target) throw new Error('Usuario no encontrado.');
    this.assertAdmin(admin, target.regionId);
    target.suspended = !target.suspended;
    this.logAdminAudit({
      actorId: admin.id,
      actorName: admin.fullName,
      actorRole: admin.primaryRole,
      regionId: target.regionId,
      action: target.suspended ? 'SUSPENDER_USUARIO' : 'REACTIVAR_USUARIO',
      targetEntity: 'profiles',
      targetId: target.id,
      reason,
    });
    this.persist();
    return structuredClone(target);
  }

  moderateReport(
    reportId: string,
    status: ModerationReport['status'],
    admin: Profile,
    notes: string
  ): void {
    const rep = this.state.reports.find((r) => r.id === reportId);
    if (!rep) return;
    this.assertAdmin(admin, rep.regionId);
    rep.status = status;
    rep.adminNotes = notes;
    this.logAdminAudit({
      actorId: admin.id,
      actorName: admin.fullName,
      actorRole: admin.primaryRole,
      regionId: rep.regionId,
      action: `MODERAR_REPORTE_${status.toUpperCase()}`,
      targetEntity: 'reports',
      targetId: rep.id,
      reason: notes,
    });
    this.persist();
  }

  toggleReviewHidden(reviewId: string, admin: Profile, reason: string): void {
    const rev = this.state.reviews.find((r) => r.id === reviewId);
    if (!rev) return;
    const pro = this.state.professionals.find((p) => p.id === rev.professionalId);
    this.assertAdmin(admin, pro?.regionId || 'reg-izcalli');
    rev.hiddenByAdmin = !rev.hiddenByAdmin;
    if (pro) {
      const visible = this.state.reviews.filter(
        (r) => r.professionalId === pro.id && !r.hiddenByAdmin
      );
      pro.reviewsCount = visible.length;
      pro.ratingAvg =
        visible.length > 0
          ? Number(
              (visible.reduce((acc, r) => acc + r.rating, 0) / visible.length).toFixed(1)
            )
          : 0;
    }
    this.logAdminAudit({
      actorId: admin.id,
      actorName: admin.fullName,
      actorRole: admin.primaryRole,
      regionId: pro?.regionId || 'reg-izcalli',
      action: rev.hiddenByAdmin ? 'OCULTAR_RESENA' : 'RESTAURAR_RESENA',
      targetEntity: 'reviews',
      targetId: rev.id,
      reason,
    });
    this.persist();
  }

  updateTicketStatus(
    ticketId: string,
    status: SupportTicket['status'],
    admin: Profile
  ): void {
    const tkt = this.state.supportTickets.find((t) => t.id === ticketId);
    if (!tkt) return;
    this.assertAdmin(admin, tkt.regionId);
    tkt.status = status;
    this.persist();
  }

  replyToTicket(
    ticketId: string,
    evidenceNote: string,
    status: SupportTicket['status'],
    admin: Profile
  ): void {
    const tkt = this.state.supportTickets.find((t) => t.id === ticketId);
    if (!tkt) return;
    this.assertAdmin(admin, tkt.regionId);
    tkt.evidenceNote = evidenceNote.trim();
    tkt.status = status;
    this.pushNotification(
      tkt.creatorId,
      'Actualización en tu ticket de soporte',
      `${tkt.subject}: ${tkt.evidenceNote || `Estado ${status}`}`,
      'operation',
      'ayuda'
    );
    this.logAdminAudit({
      actorId: admin.id,
      actorName: admin.fullName,
      actorRole: admin.primaryRole,
      regionId: tkt.regionId,
      action: `TICKET_${status.toUpperCase()}`,
      targetEntity: 'support_tickets',
      targetId: tkt.id,
      reason: tkt.evidenceNote || `Cambio de estado a ${status}`,
    });
    this.persist();
  }

  reviewAdminAccessRequest(input: {
    requestId: string;
    decision: 'authorized' | 'rejected';
    assignedRole?: 'central_admin';
    assignedRegionId?: string;
    notes: string;
    admin: Profile;
  }): { request: AdminAccessRequest; createdProfile?: Profile } {
    this.assertCentralAdmin(input.admin);
    const req = this.state.adminAccessRequests.find((r) => r.id === input.requestId);
    if (!req) throw new Error('Solicitud administrativa no encontrada.');

    const now = new Date().toISOString();
    req.reviewNotes = input.notes.trim() || undefined;
    req.authorizedByAdminId = input.admin.id;
    req.authorizedByAdminName = input.admin.fullName;
    req.updatedAt = now;

    if (input.decision === 'rejected') {
      req.status = 'rejected';
      this.logAdminAudit({
        actorId: input.admin.id,
        actorName: input.admin.fullName,
        actorRole: input.admin.primaryRole,
        regionId: req.regionId,
        action: 'RECHAZAR_SOLICITUD_ADMIN',
        targetEntity: 'admin_access_requests',
        targetId: req.id,
        reason: input.notes.trim() || 'Solicitud administrativa rechazada.',
      });
      this.persist();
      return { request: structuredClone(req) };
    }

    if (!req.emailVerified) {
      throw new Error(
        'No se puede autorizar una solicitud cuyo correo electrónico aún no ha sido verificado.'
      );
    }

    const grantedRole = input.assignedRole || req.requestedScope;
    const regionId = input.assignedRegionId || req.regionId;
    req.status = 'authorized';
    req.authorizedRole = grantedRole;

    const existingProfile = this.state.profiles.find(
      (p) => p.email.toLowerCase() === req.email.toLowerCase()
    );
    let profile: Profile;
    if (existingProfile) {
      existingProfile.primaryRole = grantedRole;
      existingProfile.roles = [grantedRole];
      existingProfile.regionId = regionId;
      existingProfile.emailConfirmed = true;
      profile = existingProfile;
    } else {
      profile = {
        id: uid('usr'),
        fullName: req.fullName,
        email: req.email,
        emailConfirmed: true,
        primaryRole: grantedRole,
        roles: [grantedRole],
        regionId,
        colonia: req.colonia,
        suspended: false,
        createdAt: now,
        isDemo: false,
        notificationPrefs: {
          inApp: true,
          email: true,
          push: false,
          securityAlertsOnly: true,
        },
      };
      this.state.profiles.push(profile);
    }
    req.createdProfileId = profile.id;

    this.logAdminAudit({
      actorId: input.admin.id,
      actorName: input.admin.fullName,
      actorRole: input.admin.primaryRole,
      regionId,
      action: 'AUTORIZAR_ACCESO_ADMIN',
      targetEntity: 'admin_access_requests',
      targetId: req.id,
      reason: `${grantedRole} autorizado (${input.notes.trim() || 'Aprobación explícita'})`,
    });

    this.persist();
    return {
      request: structuredClone(req),
      createdProfile: structuredClone(profile),
    };
  }

  logAdminAudit(log: Omit<AuditLog, 'id' | 'createdAt'>): void {
    this.state.auditLogs.unshift({
      ...log,
      id: uid('aud'),
      createdAt: new Date().toISOString(),
    });
    this.persist();
  }
}
