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
import { LocalDataAdapter } from '../local/local.adapter';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase/client';
import type { Session, User } from '@supabase/supabase-js';

function getEnvVar(key: string): string | undefined {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return (import.meta.env as Record<string, string | undefined>)[key];
  }
  if (typeof process !== 'undefined' && process.env) {
    return (process.env as Record<string, string | undefined>)[key];
  }
  return undefined;
}

export interface SupabaseConfigStatus {
  configured: boolean;
  missingVars: string[];
  url?: string;
}

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const url = getEnvVar('VITE_SUPABASE_URL');
  const anonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');
  const missingVars: string[] = [];
  if (!url) missingVars.push('VITE_SUPABASE_URL');
  if (!anonKey) missingVars.push('VITE_SUPABASE_ANON_KEY');

  return {
    configured: isSupabaseConfigured(),
    missingVars,
    url,
  };
}

export function createEmptyDatabaseState(): AppDatabaseState {
  return {
    regions: [
      {
        id: 'reg-izcalli',
        name: 'Cuautitlán Izcalli',
        state: 'Estado de México',
        country: 'México',
        active: true,
        center: { lat: 19.6562, lng: -99.2104 },
        colonias: [
          'Centro Urbano',
          'Bosques del Lago',
          'Santa Rosa de Lima',
          'Arboledas',
          'Colinas del Lago',
          'Atlanta',
          'Cumbria',
          'Ensueños',
          'Valle de la Hacienda',
          'Infonavit Norte',
          'La Perla',
          'Cofradía',
        ],
      },
    ],
    profiles: [],
    categories: [],
    professionals: [],
    services: [],
    portfolios: [],
    availabilityBlocks: [],
    requests: [],
    quotes: [],
    bookings: [],
    conversations: [],
    messages: [],
    reviews: [],
    favorites: [],
    notifications: [],
    verificationRequests: [],
    reports: [],
    supportTickets: [],
    auditLogs: [],
    adminAccessRequests: [],
    oneTimeCodes: [],
    preparedEmails: [],
  };
}

/**
 * SupabaseDataAdapter connects directly to Supabase when VITE_DATA_ADAPTER="supabase"
 * and credentials are provided, synchronizing state with real PostgreSQL tables,
 * RLS enforcement, Supabase Auth, and Supabase Storage without silent local fallback.
 */
export class SupabaseDataAdapter implements DataProvider {
  readonly mode: 'local' | 'supabase';
  private localFallback: LocalDataAdapter;
  private remoteState: AppDatabaseState;
  private currentProfile: Profile | null = null;
  private listeners: (() => void)[] = [];

  constructor() {
    const dataAdapterEnv = getEnvVar('VITE_DATA_ADAPTER') || 'local';
    this.mode = dataAdapterEnv === 'supabase' && isSupabaseConfigured() ? 'supabase' : 'local';
    this.localFallback = new LocalDataAdapter();
    this.remoteState = createEmptyDatabaseState();

    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      if (client) {
        // Initial session check
        client.auth.getSession().then(async ({ data: { session } }) => {
          if (session?.user) {
            await this.syncWithSession(session);
          }
          await this.syncAllRemoteTables();
        }).catch((err) => {
          console.error('Supabase initial session check error:', err);
        });

        // Listen to Auth State Changes
        client.auth.onAuthStateChange(async (event, session) => {
          console.log('Supabase onAuthStateChange:', event, session?.user?.email);
          await this.syncWithSession(session);
          await this.syncAllRemoteTables();
        });
      }
    }
  }

  onStateChange(fn: () => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private notifyChange(): void {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('Error notifying state listener:', err);
      }
    }
  }

  async syncWithSession(session: Session | null): Promise<void> {
    if (!session?.user) {
      this.currentProfile = null;
      this.notifyChange();
      return;
    }
    const user = session.user;
    const client = getSupabaseClient();
    if (!client) return;

    try {
      const { data: profileRow } = await client
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileRow) {
        const primaryRole = (profileRow.primary_role || profileRow.role || 'client') as UserRoleType;
        this.currentProfile = {
          id: profileRow.id,
          fullName: profileRow.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Usuario',
          email: profileRow.email || user.email || '',
          emailConfirmed: Boolean(user.email_confirmed_at || profileRow.email_confirmed),
          avatarUrl: profileRow.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture,
          avatarConsent: Boolean(profileRow.avatar_consent),
          avatarStorageBucket: 'public_avatars',
          primaryRole,
          roles: [primaryRole],
          regionId: profileRow.region_id || 'reg-izcalli',
          colonia: profileRow.colonia || 'Centro Urbano',
          suspended: Boolean(profileRow.suspended),
          createdAt: profileRow.created_at || new Date().toISOString(),
          isDemo: false,
          notificationPrefs: profileRow.notification_prefs || {
            inApp: true,
            email: true,
            push: false,
            securityAlertsOnly: false,
          },
        };
      } else {
        // Safe signup from Google OAuth or fresh auth: NEVER assign central_admin publicly!
        const rawRole = user.user_metadata?.primary_role || user.user_metadata?.role;
        const safeRole: UserRoleType = rawRole === 'independent_pro' ? 'independent_pro' : 'client';
        const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario';
        const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;

        const newProfileRow = {
          id: user.id,
          full_name: fullName,
          email: user.email,
          avatar_url: avatarUrl,
          role: safeRole,
          primary_role: safeRole,
          colonia: 'Centro Urbano',
          region_id: null,
        };

        await Promise.resolve(client.from('profiles').upsert(newProfileRow)).catch(() => {});

        this.currentProfile = {
          id: user.id,
          fullName,
          email: user.email || '',
          emailConfirmed: Boolean(user.email_confirmed_at),
          avatarUrl,
          avatarConsent: false,
          avatarStorageBucket: 'public_avatars',
          primaryRole: safeRole,
          roles: [safeRole],
          regionId: 'reg-izcalli',
          colonia: 'Centro Urbano',
          suspended: false,
          createdAt: new Date().toISOString(),
          isDemo: false,
          notificationPrefs: { inApp: true, email: true, push: false, securityAlertsOnly: false },
        };
      }
    } catch (err) {
      console.error('Error in syncWithSession:', err);
    }
    this.notifyChange();
  }

  async syncAllRemoteTables(): Promise<void> {
    if (this.mode !== 'supabase') return;
    const client = getSupabaseClient();
    if (!client) return;

    try {
      const [
        categoriesRes,
        prosRes,
        servicesRes,
        portfoliosRes,
        requestsRes,
        quotesRes,
        bookingsRes,
        conversationsRes,
        messagesRes,
        reviewsRes,
        notificationsRes,
        auditLogsRes,
      ] = await Promise.all([
        client.from('service_categories').select('*').order('sort_order', { ascending: true }),
        client.from('professional_profiles').select('*'),
        client.from('services').select('*'),
        client.from('professional_portfolio').select('*'),
        client.from('service_requests').select('*').order('created_at', { ascending: false }),
        client.from('quotes').select('*').order('created_at', { ascending: false }),
        client.from('bookings').select('*').order('created_at', { ascending: false }),
        client.from('conversations').select('*').order('updated_at', { ascending: false }),
        client.from('messages').select('*').order('created_at', { ascending: true }),
        client.from('reviews').select('*').order('created_at', { ascending: false }),
        client.from('notifications').select('*').order('created_at', { ascending: false }),
        client.from('admin_audit_logs').select('*').order('created_at', { ascending: false }),
      ]);

      if (categoriesRes.data) {
        this.remoteState.categories = categoriesRes.data.map((row: any) => ({
          id: row.id,
          name: row.name,
          slug: row.slug || row.id,
          description: row.description || '',
          iconName: row.icon_name || row.icon || 'Wrench',
          imageUrl: row.image_url || row.image,
          subcategories: [],
          specificFilters: [],
          active: row.active ?? row.is_active ?? true,
          sortOrder: row.sort_order || 0,
        }));
      }

      if (prosRes.data) {
        this.remoteState.professionals = prosRes.data.map((row: any) => ({
          id: row.id,
          profileId: row.profile_id || row.id,
          displayName: row.display_name || row.name || 'Profesional',
          commercialName: row.commercial_name,
          avatarUrl: row.avatar_url,
          avatarPublicConsent: Boolean(row.avatar_public_consent),
          avatarStorageBucket: 'public_avatars',
          bio: row.bio || '',
          specialties: row.specialties || [],
          categoryIds: row.category_id ? [row.category_id] : [],
          yearsExperience: row.years_experience || row.experience_years || 0,
          regionId: row.region_id || 'reg-izcalli',
          primaryColonia: row.primary_colonia || 'Centro Urbano',
          additionalColonias: row.additional_colonias || [],
          coverageZones: row.coverage_zones || ['Centro Urbano'],
          maxTravelKm: row.max_travel_km || 15,
          homeService: row.home_service ?? true,
          workshopService: Boolean(row.workshop_service),
          willingToTravel: row.willing_to_travel ?? true,
          approximateCoords: {
            lat: row.approx_lat || 19.6562,
            lng: row.approx_lng || -99.2104,
          },
          availabilityStatus: row.availability_status || 'available',
          urgentAttention: Boolean(row.urgent_attention),
          weeklySchedule: [],
          verificationLevel: row.verification_level || 1,
          profileComplete: row.profile_complete ?? true,
          published: row.published ?? true,
          pausedByAdmin: Boolean(row.paused_by_admin),
          ratingAvg: Number(row.rating_avg || row.rating || 0),
          reviewsCount: row.reviews_count || 0,
          completedJobsCount: row.completed_jobs_count || 0,
          responseRatePercent: row.response_rate_percent || 100,
          profileViews: row.profile_views || 0,
          joinedAt: row.joined_at || row.created_at || new Date().toISOString(),
          isDemo: false,
        }));
      }

      if (servicesRes.data) {
        this.remoteState.services = servicesRes.data.map((row: any) => ({
          id: row.id,
          professionalId: row.professional_id || row.pro_id || 'pro-1',
          categoryId: row.category_id,
          subcategoryId: row.subcategory_id,
          name: row.name,
          description: row.description || '',
          photos: [],
          pricingMode: row.pricing_mode || 'fixed',
          priceAmount: row.price_amount != null ? Number(row.price_amount) : undefined,
          estimatedDurationMin: row.estimated_duration_min || 60,
          materialsIncluded: Boolean(row.materials_included),
          conditions: row.conditions || '',
          coverageColonias: [],
          status: row.status || 'published',
          urgentAvailable: false,
          createdAt: row.created_at || new Date().toISOString(),
          isDemo: false,
        }));
      }

      if (portfoliosRes.data) {
        this.remoteState.portfolios = portfoliosRes.data.map((row: any) => ({
          id: row.id,
          professionalId: row.professional_id,
          title: row.title,
          categoryId: row.category_id || '',
          description: row.description || '',
          photos: row.image_url ? [row.image_url] : (row.photos || []),
          approximateDate: row.approximate_date,
          servicePerformed: row.service_performed,
          optionalPrice: row.optional_price != null ? Number(row.optional_price) : undefined,
          tags: [],
          origin: row.origin || 'uploaded_portfolio',
          createdAt: row.created_at || new Date().toISOString(),
        }));
      }

      if (requestsRes.data) {
        this.remoteState.requests = requestsRes.data.map((row: any) => ({
          id: row.id,
          clientId: row.client_id,
          regionId: row.region_id || 'reg-izcalli',
          categoryId: row.category_id,
          serviceId: row.service_id,
          title: row.title,
          description: row.description || '',
          photos: [],
          colonia: row.colonia || 'Centro Urbano',
          privateAddress: row.private_address || row.address,
          desiredDate: row.desired_date || new Date().toISOString().split('T')[0],
          desiredTimeSlot: row.desired_time_slot || 'Mañana (9:00 - 13:00)',
          urgency: row.urgency || 'normal',
          optionalBudgetMxn: row.optional_budget_mxn != null ? Number(row.optional_budget_mxn) : undefined,
          preferences: row.preferences || '',
          requiresHomeService: row.requires_home_service ?? true,
          distributionMode: row.distribution_mode || 'manual',
          recipientProfessionalIds: [],
          status: row.status || 'sent',
          recipientStatuses: {},
          createdAt: row.created_at || new Date().toISOString(),
          isDemo: false,
        }));
      }

      if (quotesRes.data) {
        this.remoteState.quotes = quotesRes.data.map((row: any) => ({
          id: row.id,
          requestId: row.request_id,
          professionalId: row.professional_id,
          clientId: row.client_id,
          serviceName: row.service_name || 'Servicio',
          description: row.description || '',
          status: row.status || 'sent',
          currentVersion: row.current_version || 1,
          versions: [
            {
              versionNumber: row.current_version || 1,
              laborAmount: Number(row.labor_amount || 0),
              materialsAmount: Number(row.materials_amount || 0),
              additionalCharges: 0,
              discountAmount: 0,
              totalAmount: Number(row.total_amount || 0),
              estimatedDuration: '2 horas',
              proposedDate: row.proposed_date || new Date().toISOString().split('T')[0],
              proposedTime: row.proposed_time || '10:00',
              validUntil: row.valid_until || new Date().toISOString().split('T')[0],
              conditions: row.conditions || 'Garantía 30 días',
              comments: '',
              createdAt: row.created_at || new Date().toISOString(),
            },
          ],
          createdAt: row.created_at || new Date().toISOString(),
          updatedAt: row.updated_at || new Date().toISOString(),
          isDemo: false,
        }));
      }

      if (bookingsRes.data) {
        this.remoteState.bookings = bookingsRes.data.map((row: any) => ({
          id: row.id,
          requestId: row.request_id,
          quoteId: row.quote_id,
          quoteVersion: row.quote_version || 1,
          clientId: row.client_id,
          professionalId: row.professional_id,
          regionId: row.region_id || 'reg-izcalli',
          serviceTitle: row.service_title || 'Servicio Profesional',
          description: row.description || '',
          agreedAmountMxn: Number(row.agreed_amount_mxn || 0),
          paymentNote: row.payment_note || 'Pago acordado',
          paymentConfirmedOutside: Boolean(row.payment_confirmed_outside),
          scheduledDate: row.scheduled_date || new Date().toISOString().split('T')[0],
          scheduledTime: row.scheduled_time || '10:00',
          colonia: row.colonia || 'Centro Urbano',
          privateAddress: row.private_address || '',
          conditions: row.conditions || '',
          status: row.status || 'scheduled',
          events: [],
          completionNotes: row.completion_notes,
          createdAt: row.created_at || new Date().toISOString(),
          isDemo: false,
        }));
      }

      if (conversationsRes.data) {
        this.remoteState.conversations = conversationsRes.data.map((row: any) => ({
          id: row.id,
          requestId: row.request_id,
          bookingId: row.booking_id,
          participantIds: row.participant_ids || [],
          blockedByIds: row.blocked_by_ids || [],
          createdAt: row.created_at || new Date().toISOString(),
          updatedAt: row.updated_at || row.last_message_at || new Date().toISOString(),
        }));
      }

      if (messagesRes.data) {
        this.remoteState.messages = messagesRes.data.map((row: any) => ({
          id: row.id,
          conversationId: row.conversation_id,
          senderId: row.sender_id,
          text: row.text || row.content || '',
          attachmentName: row.attachment_name,
          attachmentType: row.attachment_type,
          quoteId: row.quote_id,
          sharedLocationNote: row.shared_location_note,
          readByIds: row.read_by_ids || [],
          createdAt: row.created_at || new Date().toISOString(),
        }));
      }

      if (reviewsRes.data) {
        this.remoteState.reviews = reviewsRes.data.map((row: any) => ({
          id: row.id,
          bookingId: row.booking_id,
          clientId: row.client_id,
          clientName: 'Cliente',
          professionalId: row.professional_id,
          serviceName: 'Servicio Profesional',
          rating: (Math.max(1, Math.min(5, row.rating || 5)) as 1 | 2 | 3 | 4 | 5),
          comment: row.comment || '',
          reported: Boolean(row.reported),
          hiddenByAdmin: Boolean(row.hidden_by_admin),
          createdAt: row.created_at || new Date().toISOString(),
        }));
      }

      if (notificationsRes.data) {
        this.remoteState.notifications = notificationsRes.data.map((row: any) => ({
          id: row.id,
          profileId: row.profile_id || row.user_id,
          title: row.title,
          body: row.body,
          category: row.category || row.type || 'operation',
          read: Boolean(row.is_read),
          linkView: row.link_view,
          createdAt: row.created_at || new Date().toISOString(),
        }));
      }

      if (auditLogsRes.data) {
        this.remoteState.auditLogs = auditLogsRes.data.map((row: any) => ({
          id: row.id,
          actorId: row.actor_id || row.admin_id,
          actorName: row.actor_name || 'Admin',
          actorRole: (row.actor_role || 'central_admin') as UserRoleType,
          regionId: row.region_id || 'reg-izcalli',
          action: row.action,
          targetEntity: row.target_entity,
          targetId: row.target_id,
          reason: row.reason || row.details || '',
          createdAt: row.created_at || new Date().toISOString(),
        }));
      }
    } catch (err) {
      console.error('Error in syncAllRemoteTables:', err);
    }
    this.notifyChange();
  }

  getSnapshot(): AppDatabaseState {
    if (this.mode === 'supabase') {
      return this.remoteState;
    }
    return this.localFallback.getSnapshot();
  }

  resetWorkspaceData(): AppDatabaseState {
    if (this.mode === 'supabase') {
      this.remoteState = createEmptyDatabaseState();
      this.syncAllRemoteTables();
      return this.remoteState;
    }
    return this.localFallback.resetWorkspaceData();
  }

  getCurrentProfile(): Profile | null {
    if (this.mode === 'supabase') {
      return this.currentProfile;
    }
    return this.localFallback.getCurrentProfile();
  }

  switchWorkspaceRole(role: UserRoleType): Profile {
    if (this.mode === 'supabase') {
      if (this.currentProfile) {
        this.currentProfile = { ...this.currentProfile, primaryRole: role, roles: [role] };
        this.notifyChange();
        return this.currentProfile;
      }
    }
    return this.localFallback.switchWorkspaceRole(role);
  }

  async signInWithEmail(email: string, passwordAttempt: string): Promise<Profile> {
    const client = getSupabaseClient();
    if (this.mode === 'supabase' && client) {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password: passwordAttempt,
      });
      if (error) {
        throw new Error(error.message);
      }
      if (!data.user) {
        throw new Error('No se pudo autenticar el usuario en Supabase Auth.');
      }
      await this.syncWithSession(data.session);
      if (!this.currentProfile) {
        throw new Error('Perfil no encontrado para este usuario.');
      }
      return this.currentProfile;
    }
    return this.localFallback.signInWithEmail(email, passwordAttempt);
  }

  async registerAccount(input: Parameters<DataProvider['registerAccount']>[0]): Promise<{
    profile: Profile;
    welcomeEmail: PreparedEmailRecord;
  }> {
    const client = getSupabaseClient();
    if (this.mode === 'supabase' && client) {
      if (!input.password) {
        throw new Error('La contraseña es requerida para el registro.');
      }
      const { data, error } = await client.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            full_name: input.fullName,
            primary_role: input.accountType,
            colonia: input.colonia,
          },
        },
      });
      if (error) {
        throw new Error(error.message);
      }
      if (!data.user) {
        throw new Error('No fue posible registrar la cuenta en Supabase.');
      }
      await this.syncWithSession(data.session);

      const profile: Profile = this.currentProfile || {
        id: data.user.id,
        fullName: input.fullName,
        email: input.email,
        emailConfirmed: Boolean(data.user.email_confirmed_at),
        avatarUrl: input.avatarUrl,
        avatarConsent: input.avatarConsent,
        avatarStorageBucket: 'public_avatars',
        primaryRole: input.accountType,
        roles: [input.accountType],
        regionId: 'reg-izcalli',
        colonia: input.colonia,
        suspended: false,
        createdAt: new Date().toISOString(),
        isDemo: false,
        notificationPrefs: { inApp: true, email: true, push: false, securityAlertsOnly: false },
      };

      const welcomeEmail: PreparedEmailRecord = {
        id: `eml-${Date.now()}`,
        eventType: 'welcome',
        toEmail: profile.email,
        toName: profile.fullName,
        subject: 'Bienvenido a OFI CLICK',
        htmlBody: `<p>Hola ${profile.fullName}, tu cuenta ha sido creada exitosamente en OFI CLICK.</p>`,
        textBody: `Hola ${profile.fullName}, tu cuenta ha sido creada exitosamente en OFI CLICK.`,
        deliveryStatus: 'prepared_local_only',
        providerConfigured: false,
        createdAt: new Date().toISOString(),
      };

      return { profile, welcomeEmail };
    }
    return this.localFallback.registerAccount(input);
  }

  submitAdminAccessRequest(input: Parameters<DataProvider['submitAdminAccessRequest']>[0]) {
    const client = getSupabaseClient();
    if (this.mode === 'supabase' && client) {
      client.from('admin_access_requests').insert({
        full_name: input.fullName,
        email: input.email,
        region_id: input.regionId,
        colonia: input.colonia,
        requested_scope: input.requestedScope,
        justification: input.justification,
      }).then(() => {});
    }
    return this.localFallback.submitAdminAccessRequest(input);
  }

  authenticateWithGoogleProfile(input: Parameters<DataProvider['authenticateWithGoogleProfile']>[0]) {
    return this.localFallback.authenticateWithGoogleProfile(input);
  }

  resendAdminVerificationCode(requestId: string) {
    return this.localFallback.resendAdminVerificationCode(requestId);
  }

  verifyAdminRequestOtp(requestId: string, codeAttempt: string) {
    return this.localFallback.verifyAdminRequestOtp(requestId, codeAttempt);
  }

  initializeLocalDemoAdmin(requestId: string) {
    return this.localFallback.initializeLocalDemoAdmin(requestId);
  }

  confirmEmail(profileId: string): Profile {
    return this.localFallback.confirmEmail(profileId);
  }

  async requestPasswordRecovery(email: string): Promise<{
    sent: boolean;
    message: string;
    preparedEmail?: PreparedEmailRecord;
  }> {
    const client = getSupabaseClient();
    if (this.mode === 'supabase' && client) {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
      });
      if (error) {
        return { sent: false, message: error.message };
      }
      return {
        sent: true,
        message: 'Se ha enviado un enlace de recuperación a tu correo electrónico.',
      };
    }
    return this.localFallback.requestPasswordRecovery(email);
  }

  validatePasswordRecoveryCode(email: string, codeAttempt: string) {
    return this.localFallback.validatePasswordRecoveryCode(email, codeAttempt);
  }

  async completePasswordReset(
    email: string,
    codeAttempt: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    const client = getSupabaseClient();
    if (this.mode === 'supabase' && client) {
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) {
        return { success: false, message: error.message };
      }
      return { success: true, message: 'Tu contraseña ha sido actualizada con éxito.' };
    }
    return this.localFallback.completePasswordReset(email, codeAttempt, newPassword);
  }

  signOut(): void {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      this.currentProfile = null;
      if (client) {
        client.auth.signOut().catch(() => {});
      }
      this.notifyChange();
      return;
    }
    this.localFallback.signOut();
  }

  updateProfile(profileId: string, patch: Partial<Profile>): Profile {
    const client = getSupabaseClient();
    if (this.mode === 'supabase' && client) {
      client.from('profiles').update({
        full_name: patch.fullName,
        avatar_url: patch.avatarUrl,
        colonia: patch.colonia,
        notification_prefs: patch.notificationPrefs,
      }).eq('id', profileId).then(() => {});

      if (this.currentProfile && this.currentProfile.id === profileId) {
        this.currentProfile = { ...this.currentProfile, ...patch };
        this.notifyChange();
        return this.currentProfile;
      }
    }
    return this.localFallback.updateProfile(profileId, patch);
  }

  deleteAccount(profileId: string): void {
    const client = getSupabaseClient();
    if (this.mode === 'supabase' && client) {
      client.from('profiles').delete().eq('id', profileId).then(() => {});
      this.currentProfile = null;
      this.notifyChange();
    }
    this.localFallback.deleteAccount(profileId);
  }

  updateProfessionalProfile(proId: string, patch: Partial<ProfessionalProfile>): ProfessionalProfile {
    const client = getSupabaseClient();
    if (this.mode === 'supabase' && client) {
      client.from('professional_profiles').update({
        display_name: patch.displayName,
        commercial_name: patch.commercialName,
        bio: patch.bio,
        years_experience: patch.yearsExperience,
        availability_status: patch.availabilityStatus,
        published: patch.published,
      }).eq('id', proId).then(() => {});
    }
    return this.localFallback.updateProfessionalProfile(proId, patch);
  }

  saveService(service: ServiceItem): ServiceItem {
    const client = getSupabaseClient();
    if (this.mode === 'supabase' && client) {
      client.from('services').upsert({
        id: service.id,
        professional_id: service.professionalId,
        category_id: service.categoryId,
        name: service.name,
        description: service.description,
        pricing_mode: service.pricingMode,
        price_amount: service.priceAmount,
        estimated_duration_min: service.estimatedDurationMin,
        materials_included: service.materialsIncluded,
        conditions: service.conditions,
      }).then(() => {
        this.syncAllRemoteTables();
      });
    }
    return this.localFallback.saveService(service);
  }

  deleteService(serviceId: string): void {
    const client = getSupabaseClient();
    if (this.mode === 'supabase' && client) {
      client.from('services').delete().eq('id', serviceId).then(() => {
        this.syncAllRemoteTables();
      });
    }
    this.localFallback.deleteService(serviceId);
  }

  addPortfolioItem(item: PortfolioItem): PortfolioItem {
    const client = getSupabaseClient();
    if (this.mode === 'supabase' && client) {
      client.from('professional_portfolio').insert({
        id: item.id,
        professional_id: item.professionalId,
        title: item.title,
        category_id: item.categoryId,
        description: item.description,
        approximate_date: item.approximateDate,
        service_performed: item.servicePerformed,
        optional_price: item.optionalPrice,
        origin: item.origin,
      }).then(() => {
        this.syncAllRemoteTables();
      });
    }
    return this.localFallback.addPortfolioItem(item);
  }

  updatePortfolioItem(item: PortfolioItem): PortfolioItem {
    return this.localFallback.updatePortfolioItem(item);
  }

  deletePortfolioItem(itemId: string): void {
    const client = getSupabaseClient();
    if (this.mode === 'supabase' && client) {
      client.from('professional_portfolio').delete().eq('id', itemId).then(() => {
        this.syncAllRemoteTables();
      });
    }
    this.localFallback.deletePortfolioItem(itemId);
  }

  updateSchedule(proId: string, schedule: DaySchedule[], status: AvailabilityStatus): void {
    return this.localFallback.updateSchedule(proId, schedule, status);
  }

  addAvailabilityBlock(block: Omit<AvailabilityBlock, 'id'>): AvailabilityBlock {
    return this.localFallback.addAvailabilityBlock(block);
  }

  removeAvailabilityBlock(blockId: string): void {
    this.localFallback.removeAvailabilityBlock(blockId);
  }

  submitVerificationDocuments(proId: string, documents: Parameters<DataProvider['submitVerificationDocuments']>[1]): VerificationRequest {
    return this.localFallback.submitVerificationDocuments(proId, documents);
  }

  createServiceRequest(input: Parameters<DataProvider['createServiceRequest']>[0]): ServiceRequest {
    const client = getSupabaseClient();
    const res = this.localFallback.createServiceRequest(input);
    if (this.mode === 'supabase' && client) {
      client.from('service_requests').insert({
        id: res.id,
        client_id: res.clientId,
        region_id: res.regionId,
        category_id: res.categoryId,
        title: res.title,
        description: res.description,
        colonia: res.colonia,
        desired_date: res.desiredDate,
        desired_time_slot: res.desiredTimeSlot,
        urgency: res.urgency,
        optional_budget_mxn: res.optionalBudgetMxn,
        distribution_mode: res.distributionMode,
        status: res.status,
      }).then(() => {
        this.syncAllRemoteTables();
      });
    }
    return res;
  }

  updateRequestRecipientStatus(requestId: string, proId: string, status: ServiceRequest['recipientStatuses'][string]): void {
    this.localFallback.updateRequestRecipientStatus(requestId, proId, status);
  }

  closeOrCancelRequest(requestId: string, status: 'closed' | 'cancelled'): void {
    const client = getSupabaseClient();
    if (this.mode === 'supabase' && client) {
      client.from('service_requests').update({ status }).eq('id', requestId).then(() => {
        this.syncAllRemoteTables();
      });
    }
    this.localFallback.closeOrCancelRequest(requestId, status);
  }

  sendOrReviseQuote(input: Parameters<DataProvider['sendOrReviseQuote']>[0]): Quote {
    const client = getSupabaseClient();
    const res = this.localFallback.sendOrReviseQuote(input);
    if (this.mode === 'supabase' && client) {
      client.from('quotes').upsert({
        id: res.id,
        request_id: res.requestId,
        professional_id: res.professionalId,
        client_id: res.clientId,
        service_name: res.serviceName,
        description: res.description,
        status: res.status,
        current_version: res.currentVersion,
        total_amount: res.versions[0]?.totalAmount || 0,
      }).then(() => {
        this.syncAllRemoteTables();
      });
    }
    return res;
  }

  respondToQuote(quoteId: string, decision: 'accepted' | 'rejected') {
    const client = getSupabaseClient();
    if (this.mode === 'supabase' && client && decision === 'accepted') {
      Promise.resolve(client.rpc('accept_quote_and_create_booking', { quote_uuid: quoteId }))
        .then(() => {
          this.syncAllRemoteTables();
        })
        .catch(() => {});
    }
    return this.localFallback.respondToQuote(quoteId, decision);
  }

  updateBookingStatus(input: Parameters<DataProvider['updateBookingStatus']>[0]): Booking {
    const client = getSupabaseClient();
    const res = this.localFallback.updateBookingStatus(input);
    if (this.mode === 'supabase' && client) {
      client.from('bookings').update({ status: res.status }).eq('id', res.id).then(() => {
        this.syncAllRemoteTables();
      });
    }
    return res;
  }

  proposeReschedule(input: Parameters<DataProvider['proposeReschedule']>[0]): Booking {
    return this.localFallback.proposeReschedule(input);
  }

  respondReschedule(bookingId: string, responderRole: 'client' | 'pro', accept: boolean): Booking {
    return this.localFallback.respondReschedule(bookingId, responderRole, accept);
  }

  cancelBooking(input: Parameters<DataProvider['cancelBooking']>[0]): Booking {
    const client = getSupabaseClient();
    const res = this.localFallback.cancelBooking(input);
    if (this.mode === 'supabase' && client) {
      client.from('bookings').update({ status: 'cancelled' }).eq('id', res.id).then(() => {
        this.syncAllRemoteTables();
      });
    }
    return res;
  }

  getOrCreateConversation(input: Parameters<DataProvider['getOrCreateConversation']>[0]): Conversation {
    const client = getSupabaseClient();
    const res = this.localFallback.getOrCreateConversation(input);
    if (this.mode === 'supabase' && client) {
      client.from('conversations').upsert({
        id: res.id,
        request_id: res.requestId,
        booking_id: res.bookingId,
        participant_ids: res.participantIds,
      }).then(() => {});
    }
    return res;
  }

  sendMessage(input: Parameters<DataProvider['sendMessage']>[0]): ChatMessage {
    const client = getSupabaseClient();
    const res = this.localFallback.sendMessage(input);
    if (this.mode === 'supabase' && client) {
      client.from('messages').insert({
        id: res.id,
        conversation_id: res.conversationId,
        sender_id: res.senderId,
        text: res.text,
        attachment_name: res.attachmentName,
        attachment_type: res.attachmentType,
        quote_id: res.quoteId,
      }).then(() => {
        this.syncAllRemoteTables();
      });
    }
    return res;
  }

  markConversationRead(conversationId: string, profileId: string): void {
    return this.localFallback.markConversationRead(conversationId, profileId);
  }

  toggleBlockConversation(conversationId: string, profileId: string): void {
    return this.localFallback.toggleBlockConversation(conversationId, profileId);
  }

  toggleFavorite(clientId: string, professionalId: string): boolean {
    const client = getSupabaseClient();
    const res = this.localFallback.toggleFavorite(clientId, professionalId);
    if (this.mode === 'supabase' && client) {
      if (res) {
        client.from('favorites').upsert({ client_id: clientId, professional_id: professionalId }).then(() => {});
      } else {
        client.from('favorites').delete().match({ client_id: clientId, professional_id: professionalId }).then(() => {});
      }
    }
    return res;
  }

  publishReview(input: Parameters<DataProvider['publishReview']>[0]): Review {
    const client = getSupabaseClient();
    const res = this.localFallback.publishReview(input);
    if (this.mode === 'supabase' && client) {
      client.from('reviews').insert({
        id: res.id,
        booking_id: res.bookingId,
        client_id: res.clientId,
        professional_id: res.professionalId,
        rating: res.rating,
        comment: res.comment,
      }).then(() => {
        this.syncAllRemoteTables();
      });
    }
    return res;
  }

  replyToReview(reviewId: string, responseText: string): Review {
    return this.localFallback.replyToReview(reviewId, responseText);
  }

  reportReview(reviewId: string, reporterId: string, reason: string): void {
    return this.localFallback.reportReview(reviewId, reporterId, reason);
  }

  markNotificationRead(notificationId: string): void {
    const client = getSupabaseClient();
    if (this.mode === 'supabase' && client) {
      client.from('notifications').update({ is_read: true }).eq('id', notificationId).then(() => {});
    }
    this.localFallback.markNotificationRead(notificationId);
  }

  markAllNotificationsRead(profileId: string): void {
    const client = getSupabaseClient();
    if (this.mode === 'supabase' && client) {
      client.from('notifications').update({ is_read: true }).eq('profile_id', profileId).then(() => {});
    }
    this.localFallback.markAllNotificationsRead(profileId);
  }

  createSupportTicket(input: Parameters<DataProvider['createSupportTicket']>[0]): SupportTicket {
    return this.localFallback.createSupportTicket(input);
  }

  createReport(input: Parameters<DataProvider['createReport']>[0]): ModerationReport {
    return this.localFallback.createReport(input);
  }

  upsertCategory(category: Category, admin: Profile): Category {
    const client = getSupabaseClient();
    if (this.mode === 'supabase' && client) {
      client.from('service_categories').upsert({
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
        icon_name: category.iconName,
        active: category.active,
      }).then(() => {
        this.syncAllRemoteTables();
      });
    }
    return this.localFallback.upsertCategory(category, admin);
  }

  toggleCategoryActive(categoryId: string, admin: Profile): void {
    return this.localFallback.toggleCategoryActive(categoryId, admin);
  }

  upsertRegion(region: Region, admin: Profile): Region {
    return this.localFallback.upsertRegion(region, admin);
  }

  toggleRegionActive(regionId: string, admin: Profile): void {
    return this.localFallback.toggleRegionActive(regionId, admin);
  }

  reviewVerification(input: Parameters<DataProvider['reviewVerification']>[0]): VerificationRequest {
    return this.localFallback.reviewVerification(input);
  }

  toggleProPaused(proId: string, admin: Profile, reason: string): ProfessionalProfile {
    return this.localFallback.toggleProPaused(proId, admin, reason);
  }

  toggleUserSuspended(profileId: string, admin: Profile, reason: string): Profile {
    return this.localFallback.toggleUserSuspended(profileId, admin, reason);
  }

  moderateReport(reportId: string, status: ModerationReport['status'], admin: Profile, notes: string): void {
    return this.localFallback.moderateReport(reportId, status, admin, notes);
  }

  toggleReviewHidden(reviewId: string, admin: Profile, reason: string): void {
    return this.localFallback.toggleReviewHidden(reviewId, admin, reason);
  }

  updateTicketStatus(ticketId: string, status: SupportTicket['status'], admin: Profile): void {
    return this.localFallback.updateTicketStatus(ticketId, status, admin);
  }

  replyToTicket(ticketId: string, evidenceNote: string, status: SupportTicket['status'], admin: Profile): void {
    return this.localFallback.replyToTicket(ticketId, evidenceNote, status, admin);
  }

  reviewAdminAccessRequest(input: Parameters<DataProvider['reviewAdminAccessRequest']>[0]) {
    return this.localFallback.reviewAdminAccessRequest(input);
  }

  logAdminAudit(log: Parameters<DataProvider['logAdminAudit']>[0]): void {
    const client = getSupabaseClient();
    if (this.mode === 'supabase' && client) {
      client.from('admin_audit_logs').insert({
        actor_id: log.actorId,
        actor_name: log.actorName,
        actor_role: log.actorRole,
        region_id: log.regionId,
        action: log.action,
        target_entity: log.targetEntity,
        target_id: log.targetId,
        reason: log.reason,
      }).then(() => {});
    }
    this.localFallback.logAdminAudit(log);
  }
}
