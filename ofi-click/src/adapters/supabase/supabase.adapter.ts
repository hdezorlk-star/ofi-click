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
  VerificationRequest,
} from '../../types/oficlick';
import { LocalDataAdapter } from '../local/local.adapter';
import { getSupabaseClient, isSupabaseConfigured, normalizeSupabaseUrl } from '../../lib/supabase/client';
import { ALL_IZCALLI_COLONIAS, findIzcalliLocality } from '../../data/izcalliLocations';
import { emailService } from '../../services/email/email.service';
import type { Session } from '@supabase/supabase-js';

export const GOOGLE_ONBOARDING_ROLE_KEY = 'oficlick_google_onboarding_role_v1';

function getEnvVar(key: string): string | undefined {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return (import.meta.env as Record<string, string | undefined>)[key];
  }
  if (typeof process !== 'undefined' && process.env) {
    return (process.env as Record<string, string | undefined>)[key];
  }
  return undefined;
}

function isProdBuild(): boolean {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return Boolean((import.meta.env as Record<string, unknown>).PROD);
  }
  return process.env.NODE_ENV === 'production';
}

export interface SupabaseConfigStatus {
  configured: boolean;
  missingVars: string[];
  url?: string;
}

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const url = normalizeSupabaseUrl(getEnvVar('VITE_SUPABASE_URL'));
  const anonKey = getEnvVar('VITE_SUPABASE_ANON_KEY')?.trim();
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
        colonias: ALL_IZCALLI_COLONIAS,
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

function makeUuidLike(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * SupabaseDataAdapter connects directly to Supabase when configured (and NEVER falls back
 * silently to fictional seed data in Supabase or production builds).
 */
export class SupabaseDataAdapter implements DataProvider {
  readonly mode: 'local' | 'supabase';
  private localFallback: LocalDataAdapter | null = null;
  private remoteState: AppDatabaseState;
  private currentProfile: Profile | null = null;
  private listeners: (() => void)[] = [];
  private configWarning: string | null = null;

  constructor() {
    const dataAdapterEnv = getEnvVar('VITE_DATA_ADAPTER');
    const configured = isSupabaseConfigured();
    const wantsLocalExplicitly = dataAdapterEnv === 'local';

    if (dataAdapterEnv === 'supabase' || (isProdBuild() && !wantsLocalExplicitly)) {
      this.mode = 'supabase';
      if (!configured) {
        const missing = getSupabaseConfigStatus().missingVars.join(', ');
        this.configWarning = `Faltan variables de entorno de Supabase (${missing}) en este despliegue. Configúralas en tu proveedor de hosting sin usar datos ficticios locales.`;
      }
    } else {
      this.mode = 'local';
      this.localFallback = new LocalDataAdapter();
    }

    this.remoteState = createEmptyDatabaseState();

    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      if (client) {
        client.auth
          .getSession()
          .then(async ({ data: { session } }) => {
            if (session?.user) {
              await this.syncWithSession(session);
            }
            await this.syncAllRemoteTables();
          })
          .catch((err) => {
            console.error('Supabase initial session check error:', err);
          });

        client.auth.onAuthStateChange(async (_event, session) => {
          await this.syncWithSession(session);
          await this.syncAllRemoteTables();
        });
      }
    }
  }

  getConfigWarning(): string | null {
    return this.configWarning;
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

  private consumePendingGoogleRole(): 'client' | 'independent_pro' | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = window.sessionStorage.getItem(GOOGLE_ONBOARDING_ROLE_KEY);
      if (raw === 'independent_pro' || raw === 'client') {
        window.sessionStorage.removeItem(GOOGLE_ONBOARDING_ROLE_KEY);
        return raw;
      }
    } catch {
      // ignore storage access issues
    }
    return null;
  }

  async syncWithSession(session: Session | null): Promise<void> {
    if (this.mode !== 'supabase') return;
    if (!session?.user) {
      this.currentProfile = null;
      this.notifyChange();
      return;
    }

    const user = session.user;
    const client = getSupabaseClient();
    if (!client) return;

    try {
      const { data: profileRow, error: selectErr } = await client
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (selectErr && selectErr.code !== 'PGRST116') {
        console.warn('Supabase profiles select warning:', selectErr.message);
      }

      const pendingGoogleRole = this.consumePendingGoogleRole();

      if (profileRow) {
        const rawPrimary = (profileRow.primary_role || profileRow.role || 'client') as UserRoleType;
        const primaryRole: UserRoleType =
          rawPrimary === 'central_admin'
            ? 'central_admin'
            : rawPrimary === 'independent_pro'
            ? 'independent_pro'
            : 'client';
        this.currentProfile = {
          id: profileRow.id,
          fullName:
            profileRow.full_name ||
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            'Usuario',
          email: profileRow.email || user.email || '',
          emailConfirmed: Boolean(user.email_confirmed_at || profileRow.email_confirmed),
          avatarUrl:
            profileRow.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture,
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
        // Fresh OAuth or email signup: NEVER assign central_admin automatically
        const metaRole = user.user_metadata?.primary_role || user.user_metadata?.role;
        const candidateRole = pendingGoogleRole || metaRole;
        const safeRole: UserRoleType =
          candidateRole === 'independent_pro' ? 'independent_pro' : 'client';
        const fullName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          user.email?.split('@')[0] ||
          'Usuario';
        const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
        const colonia = (user.user_metadata?.colonia as string | undefined) || 'Centro Urbano';

        // Try extended schema upsert first; fall back seamlessly to core columns if migration_safe.sql is not yet applied
        const extendedPayload = {
          id: user.id,
          full_name: fullName,
          email: user.email,
          avatar_url: avatarUrl,
          role: safeRole,
          primary_role: safeRole,
          colonia,
        };

        const { error: extErr } = await client.from('profiles').upsert(extendedPayload);
        if (extErr) {
          await client.from('profiles').upsert({
            id: user.id,
            full_name: fullName,
            email: user.email,
            avatar_url: avatarUrl,
            role: safeRole,
          });
        }

        if (safeRole === 'independent_pro') {
          const { error: proExtErr } = await client.from('professional_profiles').upsert({
            id: user.id,
            profile_id: user.id,
            display_name: fullName,
            commercial_name: user.user_metadata?.commercial_name || null,
            primary_colonia: colonia,
            published: true,
            profile_complete: true,
          });
          if (proExtErr) {
            await client.from('professional_profiles').upsert({
              id: user.id,
              user_id: user.id,
              display_name: fullName,
            });
          }
        }

        this.currentProfile = {
          id: user.id,
          fullName,
          email: user.email || '',
          emailConfirmed: Boolean(user.email_confirmed_at),
          avatarUrl,
          avatarConsent: Boolean(avatarUrl),
          avatarStorageBucket: 'public_avatars',
          primaryRole: safeRole,
          roles: [safeRole],
          regionId: 'reg-izcalli',
          colonia,
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
      // Avoid ordering by optional extended columns (sort_order / updated_at) that may not exist on remote yet
      const [
        profilesRes,
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
        favoritesRes,
        notificationsRes,
        verifRes,
        auditLogsRes,
      ] = await Promise.all([
        client.from('profiles').select('*'),
        client.from('service_categories').select('*'),
        client.from('professional_profiles').select('*'),
        client.from('services').select('*'),
        client.from('professional_portfolio').select('*'),
        client.from('service_requests').select('*').order('created_at', { ascending: false }),
        client.from('quotes').select('*').order('created_at', { ascending: false }),
        client.from('bookings').select('*').order('created_at', { ascending: false }),
        client.from('conversations').select('*'),
        client.from('messages').select('*').order('created_at', { ascending: true }),
        client.from('reviews').select('*').order('created_at', { ascending: false }),
        client.from('favorites').select('*'),
        client.from('notifications').select('*').order('created_at', { ascending: false }),
        client.from('verification_documents').select('*'),
        client.from('admin_audit_logs').select('*').order('created_at', { ascending: false }),
      ]);

      if (profilesRes.data) {
        this.remoteState.profiles = profilesRes.data.map((row: any) => {
          const primaryRole = (row.primary_role || row.role || 'client') as UserRoleType;
          return {
            id: row.id,
            fullName: row.full_name || 'Usuario',
            email: row.email || '',
            emailConfirmed: Boolean(row.email_confirmed ?? true),
            avatarUrl: row.avatar_url,
            avatarConsent: Boolean(row.avatar_consent),
            avatarStorageBucket: 'public_avatars',
            primaryRole,
            roles: [primaryRole],
            regionId: row.region_id || 'reg-izcalli',
            colonia: row.colonia || 'Centro Urbano',
            suspended: Boolean(row.suspended),
            createdAt: row.created_at || new Date().toISOString(),
            isDemo: false,
            notificationPrefs: row.notification_prefs || {
              inApp: true,
              email: true,
              push: false,
              securityAlertsOnly: false,
            },
          };
        });
      }

      if (categoriesRes.data) {
        this.remoteState.categories = categoriesRes.data
          .map((row: any, idx: number) => ({
            id: row.id,
            name: row.name,
            slug: row.slug || row.id,
            description: row.description || '',
            iconName: row.icon_name || row.icon || 'Wrench',
            imageUrl: row.image_url || row.image,
            subcategories: [],
            specificFilters: [],
            active: row.active ?? row.is_active ?? true,
            sortOrder: typeof row.sort_order === 'number' ? row.sort_order : idx,
          }))
          .sort((a, b) => a.sortOrder - b.sortOrder);
      }

      if (prosRes.data) {
        this.remoteState.professionals = prosRes.data.map((row: any) => {
          const col = row.primary_colonia || 'Centro Urbano';
          const matchedLoc = findIzcalliLocality(col);
          return {
            id: row.id,
            profileId: row.profile_id || row.user_id || row.id,
            displayName: row.display_name || row.name || 'Profesional',
            commercialName: row.commercial_name,
            avatarUrl: row.avatar_url,
            avatarPublicConsent: Boolean(row.avatar_public_consent),
            avatarStorageBucket: 'public_avatars',
            bio: row.bio || '',
            specialties: row.specialties || [],
            categoryIds: row.category_id ? [row.category_id] : row.category_ids || [],
            yearsExperience: row.years_experience || row.experience_years || 0,
            regionId: row.region_id || 'reg-izcalli',
            primaryColonia: col,
            additionalColonias: row.additional_colonias || [],
            coverageZones: row.coverage_zones || [col],
            maxTravelKm: row.max_travel_km || 15,
            homeService: row.home_service ?? true,
            workshopService: Boolean(row.workshop_service),
            willingToTravel: row.willing_to_travel ?? true,
            approximateCoords: {
              lat: Number(row.approx_lat) || matchedLoc?.lat || 19.6562,
              lng: Number(row.approx_lng) || matchedLoc?.lng || -99.2104,
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
          };
        });
      }

      if (servicesRes.data) {
        this.remoteState.services = servicesRes.data.map((row: any) => ({
          id: row.id,
          professionalId: row.professional_id || row.pro_id,
          categoryId: row.category_id,
          subcategoryId: row.subcategory_id,
          name: row.name,
          description: row.description || '',
          photos: row.photos || [],
          pricingMode: row.pricing_mode || 'fixed',
          priceAmount: row.price_amount != null ? Number(row.price_amount) : undefined,
          estimatedDurationMin: row.estimated_duration_min || 60,
          materialsIncluded: Boolean(row.materials_included),
          conditions: row.conditions || '',
          coverageColonias: row.coverage_colonias || [],
          status: row.status || 'published',
          urgentAvailable: Boolean(row.urgent_available),
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
          photos: row.image_url ? [row.image_url] : row.photos || [],
          approximateDate: row.approximate_date,
          servicePerformed: row.service_performed,
          optionalPrice: row.optional_price != null ? Number(row.optional_price) : undefined,
          tags: row.tags || [],
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
          photos: row.photos || [],
          colonia: row.colonia || 'Centro Urbano',
          privateAddress: row.private_address || row.address,
          desiredDate: row.desired_date || new Date().toISOString().split('T')[0],
          desiredTimeSlot: row.desired_time_slot || 'Mañana (9:00 - 13:00)',
          urgency: row.urgency || 'normal',
          optionalBudgetMxn:
            row.optional_budget_mxn != null ? Number(row.optional_budget_mxn) : undefined,
          preferences: row.preferences || '',
          requiresHomeService: row.requires_home_service ?? true,
          distributionMode: row.distribution_mode || 'manual',
          recipientProfessionalIds: row.recipient_professional_ids || [],
          status: row.status || 'sent',
          recipientStatuses: row.recipient_statuses || {},
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
          versions: Array.isArray(row.versions)
            ? row.versions
            : [
                {
                  versionNumber: row.current_version || 1,
                  laborAmount: Number(row.labor_amount || 0),
                  materialsAmount: Number(row.materials_amount || 0),
                  additionalCharges: 0,
                  discountAmount: 0,
                  totalAmount: Number(row.total_amount || 0),
                  estimatedDuration: row.estimated_duration || '2 horas',
                  proposedDate: row.proposed_date || new Date().toISOString().split('T')[0],
                  proposedTime: row.proposed_time || '10:00',
                  validUntil: row.valid_until || new Date().toISOString().split('T')[0],
                  conditions: row.conditions || 'Garantía 30 días',
                  comments: row.comments || '',
                  createdAt: row.created_at || new Date().toISOString(),
                },
              ],
          createdAt: row.created_at || new Date().toISOString(),
          updatedAt: row.updated_at || row.created_at || new Date().toISOString(),
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
          events: row.events || [],
          completionNotes: row.completion_notes,
          createdAt: row.created_at || new Date().toISOString(),
          isDemo: false,
        }));
      }

      if (conversationsRes.data) {
        this.remoteState.conversations = conversationsRes.data
          .map((row: any) => ({
            id: row.id,
            requestId: row.request_id,
            bookingId: row.booking_id,
            participantIds: row.participant_ids || [],
            blockedByIds: row.blocked_by_ids || [],
            createdAt: row.created_at || new Date().toISOString(),
            updatedAt: row.updated_at || row.last_message_at || row.created_at || new Date().toISOString(),
          }))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
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
          clientName: row.client_name || 'Cliente',
          professionalId: row.professional_id,
          serviceName: row.service_name || 'Servicio Profesional',
          rating: Math.max(1, Math.min(5, row.rating || 5)) as 1 | 2 | 3 | 4 | 5,
          comment: row.comment || '',
          proResponse: row.pro_response,
          proResponseAt: row.pro_response_at,
          reported: Boolean(row.reported),
          hiddenByAdmin: Boolean(row.hidden_by_admin),
          createdAt: row.created_at || new Date().toISOString(),
        }));
      }

      if (favoritesRes.data) {
        this.remoteState.favorites = favoritesRes.data.map((row: any) => ({
          clientId: row.client_id,
          professionalId: row.professional_id,
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

      if (verifRes.data) {
        this.remoteState.verificationRequests = verifRes.data.map((row: any) => {
          const status = (row.status || 'in_review') as VerificationRequest['status'];
          const createdAt = row.created_at || new Date().toISOString();
          return {
            id: row.id,
            professionalId: row.professional_id,
            requestedLevel: (row.target_level || row.requested_level || 4) as VerificationRequest['requestedLevel'],
            status,
            documents: row.documents || [],
            reviewReason: row.reviewer_notes || row.review_reason,
            reviewedByAdminId: row.reviewed_by_id || row.reviewed_by_admin_id,
            history: Array.isArray(row.history)
              ? row.history
              : [
                  {
                    status,
                    note: row.reviewer_notes || 'Solicitud registrada en verificación.',
                    date: row.reviewed_at || createdAt,
                  },
                ],
            createdAt,
            updatedAt: row.updated_at || row.reviewed_at || createdAt,
          };
        });
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
    return this.localFallback!.getSnapshot();
  }

  resetWorkspaceData(): AppDatabaseState {
    if (this.mode === 'supabase') {
      this.remoteState = createEmptyDatabaseState();
      this.syncAllRemoteTables();
      return this.remoteState;
    }
    return this.localFallback!.resetWorkspaceData();
  }

  getCurrentProfile(): Profile | null {
    if (this.mode === 'supabase') {
      return this.currentProfile;
    }
    return this.localFallback!.getCurrentProfile();
  }

  switchWorkspaceRole(role: UserRoleType): Profile {
    if (this.mode === 'supabase') {
      if (!this.currentProfile) {
        throw new Error('Debes iniciar sesión para gestionar tu espacio.');
      }
      if (role === 'central_admin' && !this.currentProfile.roles.includes('central_admin')) {
        throw new Error('Acceso administrativo denegado: tu cuenta no tiene rol central_admin.');
      }
      if (!this.currentProfile.roles.includes(role) && role !== 'client') {
        throw new Error('No tienes permisos para cambiar a ese rol.');
      }
      this.currentProfile = { ...this.currentProfile, primaryRole: role };
      this.notifyChange();
      return this.currentProfile;
    }
    return this.localFallback!.switchWorkspaceRole(role);
  }

  async signInWithEmail(email: string, passwordAttempt: string): Promise<Profile> {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error(
          this.configWarning ||
            'Supabase no está configurado en este entorno. Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.'
        );
      }
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password: passwordAttempt,
      });
      if (error) {
        if (error.message.toLowerCase().includes('email not confirmed')) {
          throw new Error(
            'Tu correo electrónico aún no ha sido confirmado. Revisa tu bandeja de entrada o spam.'
          );
        }
        throw new Error(error.message);
      }
      if (!data.user) {
        throw new Error('No se pudo autenticar el usuario en Supabase Auth.');
      }
      await this.syncWithSession(data.session);
      await this.syncAllRemoteTables();
      if (!this.currentProfile) {
        throw new Error('Perfil no encontrado para este usuario.');
      }
      return this.currentProfile;
    }
    return this.localFallback!.signInWithEmail(email, passwordAttempt);
  }

  async registerAccount(input: Parameters<DataProvider['registerAccount']>[0]): Promise<{
    profile: Profile;
    welcomeEmail: PreparedEmailRecord;
    requiresEmailConfirmation?: boolean;
  }> {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      if (!client) {
        throw new Error(
          this.configWarning ||
            'Supabase no está configurado en este entorno. Configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.'
        );
      }
      if (!input.password) {
        throw new Error('La contraseña es requerida para el registro.');
      }

      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
      const { data, error } = await client.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          emailRedirectTo: redirectTo,
          data: {
            full_name: input.fullName,
            primary_role: input.accountType,
            role: input.accountType,
            colonia: input.colonia,
            commercial_name: input.commercialName,
            category_id: input.categoryId,
          },
        },
      });

      if (error) {
        throw new Error(error.message);
      }
      if (!data.user) {
        throw new Error('No fue posible registrar la cuenta en Supabase.');
      }

      const requiresEmailConfirmation = !data.session;
      if (data.session) {
        await this.syncWithSession(data.session);
        await this.syncAllRemoteTables();
      }

      const profile: Profile = this.currentProfile || {
        id: data.user.id,
        fullName: input.fullName,
        email: input.email,
        emailConfirmed: Boolean(data.user.email_confirmed_at),
        avatarUrl: input.avatarUrl,
        avatarConsent: Boolean(input.avatarConsent),
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

      const welcomeEmail = await emailService.sendEmail({
        eventType: 'welcome',
        toEmail: profile.email,
        userName: profile.fullName,
        accountRoleLabel:
          input.accountType === 'independent_pro'
            ? 'Freelancer / Trabajador independiente'
            : 'Cliente',
      });

      this.remoteState.preparedEmails = [welcomeEmail, ...this.remoteState.preparedEmails].slice(0, 20);
      this.notifyChange();

      return { profile, welcomeEmail, requiresEmailConfirmation };
    }
    return this.localFallback!.registerAccount(input);
  }

  async resendSignupConfirmation(email: string): Promise<{ sent: boolean; message: string }> {
    if (this.mode !== 'supabase') {
      return {
        sent: false,
        message: 'En modo prototipo local no se requiere confirmación por correo externo.',
      };
    }
    const client = getSupabaseClient();
    if (!client) {
      return { sent: false, message: 'Cliente Supabase no inicializado.' };
    }
    const { error } = await client.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
      },
    });
    if (error) {
      return { sent: false, message: error.message };
    }
    return {
      sent: true,
      message: `Reenviamos el enlace de confirmación a ${email}. Revisa bandeja principal y spam.`,
    };
  }

  submitAdminAccessRequest(input: Parameters<DataProvider['submitAdminAccessRequest']>[0]) {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      const request: AdminAccessRequest = {
        id: makeUuidLike('adm-req'),
        fullName: input.fullName,
        email: input.email,
        regionId: input.regionId,
        colonia: input.colonia,
        requestedScope: 'central_admin',
        justification: input.justification,
        emailVerified: false,
        status: 'email_pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (client) {
        client
          .from('admin_audit_logs')
          .insert({
            actor_name: input.fullName,
            actor_role: 'client',
            region_id: input.regionId,
            action: 'ADMIN_ACCESS_REQUESTED',
            target_entity: 'admin_access_requests',
            target_id: request.id,
            reason: input.justification,
          })
          .then(() => {});
      }
      const verificationEmail = emailService.prepareEmail({
        eventType: 'admin_email_verification',
        toEmail: input.email,
        userName: input.fullName,
        otpCode: '000000',
        requestedScopeLabel: 'Administrador Central',
        expiresInMinutes: 10,
      });
      this.remoteState.adminAccessRequests = [request, ...this.remoteState.adminAccessRequests];
      this.notifyChange();
      return { request, verificationEmail };
    }
    return this.localFallback!.submitAdminAccessRequest(input);
  }

  authenticateWithGoogleProfile(
    input: Parameters<DataProvider['authenticateWithGoogleProfile']>[0]
  ) {
    if (this.mode === 'supabase') {
      throw new Error(
        'Usa el flujo oficial de Google OAuth (supabase.auth.signInWithOAuth) en modo Supabase.'
      );
    }
    return this.localFallback!.authenticateWithGoogleProfile(input);
  }

  resendAdminVerificationCode(requestId: string) {
    if (this.mode === 'supabase') {
      throw new Error('Las solicitudes administrativas en Supabase se autorizan por el administrador central.');
    }
    return this.localFallback!.resendAdminVerificationCode(requestId);
  }

  verifyAdminRequestOtp(requestId: string, codeAttempt: string) {
    if (this.mode === 'supabase') {
      return {
        verified: false,
        error: 'Las cuentas administrativas en Supabase requieren alta y rol asignado directamente por el propietario del proyecto.',
      };
    }
    return this.localFallback!.verifyAdminRequestOtp(requestId, codeAttempt);
  }

  initializeLocalDemoAdmin(requestId: string) {
    if (this.mode === 'supabase') {
      throw new Error('No se permite inicializar administradores demo locales cuando Supabase está activo.');
    }
    return this.localFallback!.initializeLocalDemoAdmin(requestId);
  }

  confirmEmail(profileId: string): Profile {
    if (this.mode === 'supabase') {
      if (this.currentProfile && this.currentProfile.id === profileId) {
        this.currentProfile = { ...this.currentProfile, emailConfirmed: true };
        this.notifyChange();
        return this.currentProfile;
      }
      throw new Error('Perfil no encontrado.');
    }
    return this.localFallback!.confirmEmail(profileId);
  }

  async requestPasswordRecovery(email: string): Promise<{
    sent: boolean;
    message: string;
    preparedEmail?: PreparedEmailRecord;
  }> {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      if (!client) {
        return {
          sent: false,
          message: 'Supabase no está configurado para enviar correos de recuperación.',
        };
      }
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
      });
      if (error) {
        return { sent: false, message: error.message };
      }
      return {
        sent: true,
        message: `Enviamos un enlace de recuperación a ${email}. Abre el enlace desde tu correo (revisa también spam) para definir tu nueva contraseña.`,
      };
    }
    return this.localFallback!.requestPasswordRecovery(email);
  }

  validatePasswordRecoveryCode(email: string, codeAttempt: string) {
    if (this.mode === 'supabase') {
      return {
        valid: false,
        error: 'En modo Supabase, abre el enlace enviado a tu correo electrónico para restablecer tu contraseña.',
      };
    }
    return this.localFallback!.validatePasswordRecoveryCode(email, codeAttempt);
  }

  async completePasswordReset(
    email: string,
    codeAttempt: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string }> {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      if (!client) {
        return { success: false, message: 'Cliente Supabase no disponible.' };
      }
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) {
        throw new Error(error.message);
      }
      return { success: true, message: 'Tu contraseña ha sido actualizada correctamente en Supabase.' };
    }
    return this.localFallback!.completePasswordReset(email, codeAttempt, newPassword);
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
    this.localFallback!.signOut();
  }

  updateProfile(profileId: string, patch: Partial<Profile>): Profile {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      if (client) {
        const updatePayload: Record<string, unknown> = {};
        if (patch.fullName !== undefined) updatePayload.full_name = patch.fullName;
        if (patch.avatarUrl !== undefined) updatePayload.avatar_url = patch.avatarUrl;
        if (patch.colonia !== undefined) updatePayload.colonia = patch.colonia;
        if (patch.notificationPrefs !== undefined) updatePayload.notification_prefs = patch.notificationPrefs;

        Promise.resolve(client.from('profiles').update(updatePayload).eq('id', profileId))
          .then(({ error }) => {
            if (error && patch.fullName !== undefined) {
              return client
                .from('profiles')
                .update({ full_name: patch.fullName, avatar_url: patch.avatarUrl })
                .eq('id', profileId);
            }
            return undefined;
          })
          .catch(() => {});
      }

      if (this.currentProfile && this.currentProfile.id === profileId) {
        this.currentProfile = { ...this.currentProfile, ...patch };
      }
      this.remoteState.profiles = this.remoteState.profiles.map((p) =>
        p.id === profileId ? { ...p, ...patch } : p
      );
      this.notifyChange();
      return (
        this.currentProfile ||
        this.remoteState.profiles.find((p) => p.id === profileId) || {
          id: profileId,
          fullName: patch.fullName || 'Usuario',
          email: '',
          emailConfirmed: true,
          avatarConsent: false,
          avatarStorageBucket: 'public_avatars',
          primaryRole: 'client',
          roles: ['client'],
          regionId: 'reg-izcalli',
          colonia: patch.colonia || 'Centro Urbano',
          suspended: false,
          createdAt: new Date().toISOString(),
          isDemo: false,
          notificationPrefs: { inApp: true, email: true, push: false, securityAlertsOnly: false },
        }
      );
    }
    return this.localFallback!.updateProfile(profileId, patch);
  }

  deleteAccount(profileId: string): void {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      if (client) {
        Promise.resolve(client.from('profiles').delete().eq('id', profileId)).catch(() => {});
        client.auth.signOut().catch(() => {});
      }
      this.currentProfile = null;
      this.remoteState.profiles = this.remoteState.profiles.filter((p) => p.id !== profileId);
      this.notifyChange();
      return;
    }
    this.localFallback!.deleteAccount(profileId);
  }

  updateProfessionalProfile(
    proId: string,
    patch: Partial<ProfessionalProfile>
  ): ProfessionalProfile {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      if (client) {
        Promise.resolve(
          client
            .from('professional_profiles')
            .update({
              display_name: patch.displayName,
              commercial_name: patch.commercialName,
              bio: patch.bio,
              years_experience: patch.yearsExperience,
              primary_colonia: patch.primaryColonia,
              additional_colonias: patch.additionalColonias,
              availability_status: patch.availabilityStatus,
              urgent_attention: patch.urgentAttention,
              published: patch.published,
            })
            .eq('id', proId)
        )
          .then(() => this.syncAllRemoteTables())
          .catch(() => {});
      }

      let updated: ProfessionalProfile | undefined;
      this.remoteState.professionals = this.remoteState.professionals.map((p) => {
        if (p.id === proId) {
          updated = { ...p, ...patch };
          return updated;
        }
        return p;
      });
      this.notifyChange();
      if (updated) return updated;
      return {
        id: proId,
        profileId: proId,
        displayName: patch.displayName || 'Profesional',
        avatarPublicConsent: false,
        avatarStorageBucket: 'public_avatars',
        bio: patch.bio || '',
        specialties: patch.specialties || [],
        categoryIds: patch.categoryIds || [],
        yearsExperience: patch.yearsExperience || 0,
        regionId: 'reg-izcalli',
        primaryColonia: patch.primaryColonia || 'Centro Urbano',
        additionalColonias: patch.additionalColonias || [],
        coverageZones: [patch.primaryColonia || 'Centro Urbano'],
        maxTravelKm: 15,
        homeService: true,
        workshopService: false,
        willingToTravel: true,
        approximateCoords: { lat: 19.6562, lng: -99.2104 },
        availabilityStatus: patch.availabilityStatus || 'available',
        urgentAttention: Boolean(patch.urgentAttention),
        weeklySchedule: [],
        verificationLevel: 1,
        profileComplete: true,
        published: Boolean(patch.published),
        pausedByAdmin: false,
        ratingAvg: 0,
        reviewsCount: 0,
        completedJobsCount: 0,
        responseRatePercent: 100,
        profileViews: 0,
        joinedAt: new Date().toISOString(),
        isDemo: false,
      };
    }
    return this.localFallback!.updateProfessionalProfile(proId, patch);
  }

  saveService(service: ServiceItem): ServiceItem {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      const nextService: ServiceItem = {
        ...service,
        id: service.id || makeUuidLike('srv'),
      };
      if (client) {
        Promise.resolve(
          client.from('services').upsert({
            id: nextService.id,
            professional_id: nextService.professionalId,
            category_id: nextService.categoryId,
            name: nextService.name,
            description: nextService.description,
            pricing_mode: nextService.pricingMode,
            price_amount: nextService.priceAmount,
            estimated_duration_min: nextService.estimatedDurationMin,
            materials_included: nextService.materialsIncluded,
            conditions: nextService.conditions,
          })
        )
          .then(() => this.syncAllRemoteTables())
          .catch(() => {});
      }
      const exists = this.remoteState.services.some((s) => s.id === nextService.id);
      this.remoteState.services = exists
        ? this.remoteState.services.map((s) => (s.id === nextService.id ? nextService : s))
        : [nextService, ...this.remoteState.services];
      this.notifyChange();
      return nextService;
    }
    return this.localFallback!.saveService(service);
  }

  deleteService(serviceId: string): void {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      if (client) {
        Promise.resolve(client.from('services').delete().eq('id', serviceId))
          .then(() => this.syncAllRemoteTables())
          .catch(() => {});
      }
      this.remoteState.services = this.remoteState.services.filter((s) => s.id !== serviceId);
      this.notifyChange();
      return;
    }
    this.localFallback!.deleteService(serviceId);
  }

  addPortfolioItem(item: PortfolioItem): PortfolioItem {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      const next: PortfolioItem = {
        ...item,
        id: item.id || makeUuidLike('port'),
      };
      if (client) {
        Promise.resolve(
          client.from('professional_portfolio').insert({
            id: next.id,
            professional_id: next.professionalId,
            title: next.title,
            category_id: next.categoryId,
            description: next.description,
            approximate_date: next.approximateDate,
            service_performed: next.servicePerformed,
            optional_price: next.optionalPrice,
            origin: next.origin,
          })
        )
          .then(() => this.syncAllRemoteTables())
          .catch(() => {});
      }
      this.remoteState.portfolios = [next, ...this.remoteState.portfolios];
      this.notifyChange();
      return next;
    }
    return this.localFallback!.addPortfolioItem(item);
  }

  updatePortfolioItem(item: PortfolioItem): PortfolioItem {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      if (client) {
        Promise.resolve(
          client
            .from('professional_portfolio')
            .update({
              title: item.title,
              description: item.description,
              approximate_date: item.approximateDate,
              service_performed: item.servicePerformed,
              optional_price: item.optionalPrice,
            })
            .eq('id', item.id)
        )
          .then(() => this.syncAllRemoteTables())
          .catch(() => {});
      }
      this.remoteState.portfolios = this.remoteState.portfolios.map((p) =>
        p.id === item.id ? item : p
      );
      this.notifyChange();
      return item;
    }
    return this.localFallback!.updatePortfolioItem(item);
  }

  deletePortfolioItem(itemId: string): void {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      if (client) {
        Promise.resolve(client.from('professional_portfolio').delete().eq('id', itemId))
          .then(() => this.syncAllRemoteTables())
          .catch(() => {});
      }
      this.remoteState.portfolios = this.remoteState.portfolios.filter((p) => p.id !== itemId);
      this.notifyChange();
      return;
    }
    this.localFallback!.deletePortfolioItem(itemId);
  }

  updateSchedule(proId: string, schedule: DaySchedule[], status: AvailabilityStatus): void {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      if (client) {
        Promise.resolve(
          client
            .from('professional_profiles')
            .update({ availability_status: status })
            .eq('id', proId)
        ).catch(() => {});
      }
      this.remoteState.professionals = this.remoteState.professionals.map((p) =>
        p.id === proId ? { ...p, weeklySchedule: schedule, availabilityStatus: status } : p
      );
      this.notifyChange();
      return;
    }
    this.localFallback!.updateSchedule(proId, schedule, status);
  }

  addAvailabilityBlock(block: Omit<AvailabilityBlock, 'id'>): AvailabilityBlock {
    if (this.mode === 'supabase') {
      const next: AvailabilityBlock = { ...block, id: makeUuidLike('blk') };
      this.remoteState.availabilityBlocks = [...this.remoteState.availabilityBlocks, next];
      this.notifyChange();
      return next;
    }
    return this.localFallback!.addAvailabilityBlock(block);
  }

  removeAvailabilityBlock(blockId: string): void {
    if (this.mode === 'supabase') {
      this.remoteState.availabilityBlocks = this.remoteState.availabilityBlocks.filter(
        (b) => b.id !== blockId
      );
      this.notifyChange();
      return;
    }
    this.localFallback!.removeAvailabilityBlock(blockId);
  }

  submitVerificationDocuments(
    proId: string,
    documents: Parameters<DataProvider['submitVerificationDocuments']>[1]
  ): VerificationRequest {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      const now = new Date().toISOString();
      const req: VerificationRequest = {
        id: makeUuidLike('ver'),
        professionalId: proId,
        requestedLevel: 4,
        status: 'in_review',
        documents: documents.map((d, idx) => ({
          id: makeUuidLike(`doc-${idx}`),
          docKind: d.docKind,
          label: d.label,
          fileName: d.fileName,
          mimeType: d.mimeType || 'application/octet-stream',
          sizeBytes: d.sizeBytes || 0,
          storageBucket: 'private_verifications',
          uploadedAt: now,
          previewRefKey: d.previewRefKey,
          isDemo: false,
          privateOnly: true,
        })),
        history: [
          {
            status: 'in_review',
            note: 'Documentos enviados a revisión.',
            date: now,
          },
        ],
        createdAt: now,
        updatedAt: now,
      };
      if (client) {
        Promise.resolve(
          client.from('verification_documents').insert({
            id: req.id,
            professional_id: proId,
            status: req.status,
            documents: req.documents,
          })
        ).catch(() => {});
      }
      this.remoteState.verificationRequests = [req, ...this.remoteState.verificationRequests];
      this.notifyChange();
      return req;
    }
    return this.localFallback!.submitVerificationDocuments(proId, documents);
  }

  createServiceRequest(
    input: Parameters<DataProvider['createServiceRequest']>[0]
  ): ServiceRequest {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      const recipientStatuses: ServiceRequest['recipientStatuses'] = {};
      for (const pid of input.recipientProfessionalIds) {
        recipientStatuses[pid] = 'pending';
      }
      const res: ServiceRequest = {
        ...input,
        id: makeUuidLike('req'),
        status: 'sent',
        recipientStatuses,
        createdAt: new Date().toISOString(),
        isDemo: false,
      };

      if (client) {
        Promise.resolve(
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
          })
        )
          .then(() => this.syncAllRemoteTables())
          .catch(() => {});
      }

      this.remoteState.requests = [res, ...this.remoteState.requests];
      this.notifyChange();
      return res;
    }
    return this.localFallback!.createServiceRequest(input);
  }

  updateRequestRecipientStatus(
    requestId: string,
    proId: string,
    status: ServiceRequest['recipientStatuses'][string]
  ): void {
    if (this.mode === 'supabase') {
      this.remoteState.requests = this.remoteState.requests.map((r) =>
        r.id === requestId
          ? { ...r, recipientStatuses: { ...r.recipientStatuses, [proId]: status } }
          : r
      );
      this.notifyChange();
      return;
    }
    this.localFallback!.updateRequestRecipientStatus(requestId, proId, status);
  }

  closeOrCancelRequest(requestId: string, status: 'closed' | 'cancelled'): void {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      if (client) {
        Promise.resolve(client.from('service_requests').update({ status }).eq('id', requestId))
          .then(() => this.syncAllRemoteTables())
          .catch(() => {});
      }
      this.remoteState.requests = this.remoteState.requests.map((r) =>
        r.id === requestId ? { ...r, status } : r
      );
      this.notifyChange();
      return;
    }
    this.localFallback!.closeOrCancelRequest(requestId, status);
  }

  sendOrReviseQuote(input: Parameters<DataProvider['sendOrReviseQuote']>[0]): Quote {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      const existing =
        (input.quoteId && this.remoteState.quotes.find((q) => q.id === input.quoteId)) ||
        this.remoteState.quotes.find(
          (q) =>
            q.requestId === input.requestId &&
            q.professionalId === input.professionalId &&
            q.status !== 'rejected'
        );

      const now = new Date().toISOString();
      const nextVersionNum = existing ? existing.currentVersion + 1 : 1;
      const version: QuoteVersion = {
        ...input.versionData,
        versionNumber: nextVersionNum,
        createdAt: now,
      };
      const quote: Quote = existing
        ? {
            ...existing,
            serviceName: input.serviceName,
            description: input.description,
            currentVersion: nextVersionNum,
            versions: [version, ...existing.versions],
            status: 'sent',
            updatedAt: now,
          }
        : {
            id: makeUuidLike('qt'),
            requestId: input.requestId,
            professionalId: input.professionalId,
            clientId: input.clientId,
            serviceName: input.serviceName,
            description: input.description,
            status: 'sent',
            currentVersion: 1,
            versions: [version],
            createdAt: now,
            updatedAt: now,
          };

      if (client) {
        Promise.resolve(
          client.from('quotes').upsert({
            id: quote.id,
            request_id: quote.requestId,
            professional_id: quote.professionalId,
            client_id: quote.clientId,
            service_name: quote.serviceName,
            description: quote.description,
            status: quote.status,
            current_version: quote.currentVersion,
            total_amount: version.totalAmount,
            labor_amount: version.laborAmount,
            materials_amount: version.materialsAmount,
            proposed_date: version.proposedDate,
            proposed_time: version.proposedTime,
            valid_until: version.validUntil,
            conditions: version.conditions,
          })
        )
          .then(() => this.syncAllRemoteTables())
          .catch(() => {});
      }

      this.remoteState.quotes = existing
        ? this.remoteState.quotes.map((q) => (q.id === quote.id ? quote : q))
        : [quote, ...this.remoteState.quotes];
      this.notifyChange();
      return quote;
    }
    return this.localFallback!.sendOrReviseQuote(input);
  }

  respondToQuote(quoteId: string, decision: 'accepted' | 'rejected') {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      const targetQuote = this.remoteState.quotes.find((q) => q.id === quoteId);
      if (!targetQuote) {
        throw new Error('Cotización no encontrada.');
      }

      const updatedQuote: Quote = {
        ...targetQuote,
        status: decision,
        updatedAt: new Date().toISOString(),
      };
      this.remoteState.quotes = this.remoteState.quotes.map((q) =>
        q.id === quoteId
          ? updatedQuote
          : decision === 'accepted' && q.requestId === targetQuote.requestId && q.status === 'sent'
          ? { ...q, status: 'rejected' }
          : q
      );

      let booking: Booking | undefined;
      if (decision === 'accepted') {
        const latestVer = targetQuote.versions[0];
        const req = this.remoteState.requests.find((r) => r.id === targetQuote.requestId);
        const bookingId = makeUuidLike('bkg');
        const createdBooking: Booking = {
          id: bookingId,
          requestId: targetQuote.requestId,
          quoteId: targetQuote.id,
          quoteVersion: targetQuote.currentVersion,
          clientId: targetQuote.clientId,
          professionalId: targetQuote.professionalId,
          regionId: req?.regionId || 'reg-izcalli',
          serviceTitle: targetQuote.serviceName,
          description: targetQuote.description,
          agreedAmountMxn: latestVer?.totalAmount || 0,
          paymentNote: 'Pago directo entre cliente y profesional',
          paymentConfirmedOutside: false,
          scheduledDate: latestVer?.proposedDate || new Date().toISOString().split('T')[0],
          scheduledTime: latestVer?.proposedTime || '10:00',
          colonia: req?.colonia || 'Centro Urbano',
          privateAddress: req?.privateAddress || '',
          conditions: latestVer?.conditions || '',
          status: 'scheduled',
          events: [
            {
              id: makeUuidLike('evt'),
              bookingId,
              status: 'scheduled',
              actorId: targetQuote.clientId,
              actorName: this.currentProfile?.fullName || 'Cliente',
              note: 'Cotización aceptada y servicio programado.',
              createdAt: new Date().toISOString(),
            },
          ],
          createdAt: new Date().toISOString(),
        };
        booking = createdBooking;
        this.remoteState.bookings = [createdBooking, ...this.remoteState.bookings];

        if (client) {
          Promise.resolve(client.rpc('accept_quote_and_create_booking', { quote_uuid: quoteId }))
            .then(({ error }) => {
              if (error) {
                return Promise.all([
                  client.from('quotes').update({ status: 'accepted' }).eq('id', quoteId),
                  client.from('bookings').insert({
                    id: createdBooking.id,
                    request_id: createdBooking.requestId,
                    quote_id: createdBooking.quoteId,
                    client_id: createdBooking.clientId,
                    professional_id: createdBooking.professionalId,
                    service_title: createdBooking.serviceTitle,
                    agreed_amount_mxn: createdBooking.agreedAmountMxn,
                    scheduled_date: createdBooking.scheduledDate,
                    scheduled_time: createdBooking.scheduledTime,
                    colonia: createdBooking.colonia,
                    status: 'scheduled',
                  }),
                ]);
              }
              return undefined;
            })
            .then(() => this.syncAllRemoteTables())
            .catch(() => {});
        }
      } else if (client) {
        Promise.resolve(client.from('quotes').update({ status: 'rejected' }).eq('id', quoteId))
          .then(() => this.syncAllRemoteTables())
          .catch(() => {});
      }

      this.notifyChange();
      return { quote: updatedQuote, booking };
    }
    return this.localFallback!.respondToQuote(quoteId, decision);
  }

  updateBookingStatus(input: Parameters<DataProvider['updateBookingStatus']>[0]): Booking {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      const target = this.remoteState.bookings.find((b) => b.id === input.bookingId);
      if (!target) {
        throw new Error('Contratación no encontrada.');
      }
      const nextBooking: Booking = {
        ...target,
        status: input.status,
        events: [
          ...target.events,
          {
            id: makeUuidLike('evt'),
            bookingId: input.bookingId,
            status: input.status,
            actorId: input.actorId,
            actorName: input.actorName,
            note: input.note,
            photos: input.photos,
            createdAt: new Date().toISOString(),
          },
        ],
      };
      this.remoteState.bookings = this.remoteState.bookings.map((b) =>
        b.id === input.bookingId ? nextBooking : b
      );
      if (client) {
        Promise.resolve(
          client.from('bookings').update({ status: input.status }).eq('id', input.bookingId)
        )
          .then(() => this.syncAllRemoteTables())
          .catch(() => {});
      }
      this.notifyChange();
      return nextBooking;
    }
    return this.localFallback!.updateBookingStatus(input);
  }

  proposeReschedule(input: Parameters<DataProvider['proposeReschedule']>[0]): Booking {
    if (this.mode === 'supabase') {
      const target = this.remoteState.bookings.find((b) => b.id === input.bookingId);
      if (!target) throw new Error('Contratación no encontrada.');
      const next: Booking = {
        ...target,
        rescheduleProposal: {
          id: makeUuidLike('rsch'),
          proposedDate: input.proposedDate,
          proposedTime: input.proposedTime,
          reason: input.reason,
          proposedById: input.proposedById,
          clientAccepted: input.proposedByRole === 'client',
          proAccepted: input.proposedByRole === 'pro',
          createdAt: new Date().toISOString(),
        },
      };
      this.remoteState.bookings = this.remoteState.bookings.map((b) =>
        b.id === input.bookingId ? next : b
      );
      this.notifyChange();
      return next;
    }
    return this.localFallback!.proposeReschedule(input);
  }

  respondReschedule(bookingId: string, responderRole: 'client' | 'pro', accept: boolean): Booking {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      const target = this.remoteState.bookings.find((b) => b.id === bookingId);
      if (!target || !target.rescheduleProposal) {
        throw new Error('Propuesta de reprogramación no encontrada.');
      }
      const updatedProposal = {
        ...target.rescheduleProposal,
        clientAccepted:
          responderRole === 'client' ? accept : target.rescheduleProposal.clientAccepted,
        proAccepted: responderRole === 'pro' ? accept : target.rescheduleProposal.proAccepted,
      };
      const bothAccepted = accept && updatedProposal.clientAccepted && updatedProposal.proAccepted;
      const next: Booking = !accept
        ? {
            ...target,
            rescheduleProposal: undefined,
            events: [
              ...target.events,
              {
                id: makeUuidLike('evt'),
                bookingId,
                status: target.status,
                actorId: this.currentProfile?.id || 'system',
                actorName: responderRole === 'client' ? 'Cliente' : 'Profesional',
                note: 'Propuesta de reprogramación rechazada; se mantiene la fecha original.',
                createdAt: new Date().toISOString(),
              },
            ],
          }
        : bothAccepted
        ? {
            ...target,
            scheduledDate: updatedProposal.proposedDate,
            scheduledTime: updatedProposal.proposedTime,
            rescheduleProposal: updatedProposal,
            events: [
              ...target.events,
              {
                id: makeUuidLike('evt'),
                bookingId,
                status: target.status,
                actorId: this.currentProfile?.id || 'system',
                actorName: 'Ambas partes',
                note: `Reprogramación confirmada para ${updatedProposal.proposedDate} a las ${updatedProposal.proposedTime}.`,
                createdAt: new Date().toISOString(),
              },
            ],
          }
        : {
            ...target,
            rescheduleProposal: updatedProposal,
          };
      this.remoteState.bookings = this.remoteState.bookings.map((b) =>
        b.id === bookingId ? next : b
      );
      if (bothAccepted && client) {
        Promise.resolve(
          client
            .from('bookings')
            .update({
              scheduled_date: next.scheduledDate,
              scheduled_time: next.scheduledTime,
            })
            .eq('id', bookingId)
        ).catch(() => {});
      }
      this.notifyChange();
      return next;
    }
    return this.localFallback!.respondReschedule(bookingId, responderRole, accept);
  }

  cancelBooking(input: Parameters<DataProvider['cancelBooking']>[0]): Booking {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      const target = this.remoteState.bookings.find((b) => b.id === input.bookingId);
      if (!target) throw new Error('Contratación no encontrada.');
      const next: Booking = {
        ...target,
        status: 'cancelled',
        cancellationInfo: {
          cancelledById: input.actorId,
          cancelledByRole: input.actorRole,
          reason: input.reason,
          cancelledAt: new Date().toISOString(),
        },
      };
      this.remoteState.bookings = this.remoteState.bookings.map((b) =>
        b.id === input.bookingId ? next : b
      );
      if (client) {
        Promise.resolve(
          client.from('bookings').update({ status: 'cancelled' }).eq('id', input.bookingId)
        )
          .then(() => this.syncAllRemoteTables())
          .catch(() => {});
      }
      this.notifyChange();
      return next;
    }
    return this.localFallback!.cancelBooking(input);
  }

  getOrCreateConversation(
    input: Parameters<DataProvider['getOrCreateConversation']>[0]
  ): Conversation {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      const existing = this.remoteState.conversations.find((c) =>
        input.participantIds.every((pid) => c.participantIds.includes(pid))
      );
      if (existing) return existing;

      const conv: Conversation = {
        id: makeUuidLike('conv'),
        requestId: input.requestId,
        bookingId: input.bookingId,
        participantIds: input.participantIds,
        blockedByIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      if (client) {
        Promise.resolve(
          client.from('conversations').upsert({
            id: conv.id,
            request_id: conv.requestId,
            booking_id: conv.bookingId,
            participant_ids: conv.participantIds,
          })
        ).catch(() => {});
      }
      this.remoteState.conversations = [conv, ...this.remoteState.conversations];
      this.notifyChange();
      return conv;
    }
    return this.localFallback!.getOrCreateConversation(input);
  }

  sendMessage(input: Parameters<DataProvider['sendMessage']>[0]): ChatMessage {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      const msg: ChatMessage = {
        id: makeUuidLike('msg'),
        conversationId: input.conversationId,
        senderId: input.senderId,
        text: input.text,
        attachmentName: input.attachmentName,
        attachmentType: input.attachmentType,
        attachment: input.attachment,
        quoteId: input.quoteId,
        sharedLocationNote: input.sharedLocationNote,
        readByIds: [input.senderId],
        createdAt: new Date().toISOString(),
      };
      if (client) {
        Promise.resolve(
          client.from('messages').insert({
            id: msg.id,
            conversation_id: msg.conversationId,
            sender_id: msg.senderId,
            text: msg.text,
            attachment_name: msg.attachmentName,
            attachment_type: msg.attachmentType,
            quote_id: msg.quoteId,
          })
        )
          .then(() => this.syncAllRemoteTables())
          .catch(() => {});
      }
      this.remoteState.messages = [...this.remoteState.messages, msg];
      this.notifyChange();
      return msg;
    }
    return this.localFallback!.sendMessage(input);
  }

  markConversationRead(conversationId: string, profileId: string): void {
    if (this.mode === 'supabase') {
      this.remoteState.messages = this.remoteState.messages.map((m) =>
        m.conversationId === conversationId && !m.readByIds.includes(profileId)
          ? { ...m, readByIds: [...m.readByIds, profileId] }
          : m
      );
      this.notifyChange();
      return;
    }
    this.localFallback!.markConversationRead(conversationId, profileId);
  }

  toggleBlockConversation(conversationId: string, profileId: string): void {
    if (this.mode === 'supabase') {
      this.remoteState.conversations = this.remoteState.conversations.map((c) => {
        if (c.id !== conversationId) return c;
        const blocked = c.blockedByIds.includes(profileId);
        return {
          ...c,
          blockedByIds: blocked
            ? c.blockedByIds.filter((id) => id !== profileId)
            : [...c.blockedByIds, profileId],
        };
      });
      this.notifyChange();
      return;
    }
    this.localFallback!.toggleBlockConversation(conversationId, profileId);
  }

  toggleFavorite(clientId: string, professionalId: string): boolean {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      const exists = this.remoteState.favorites.some(
        (f) => f.clientId === clientId && f.professionalId === professionalId
      );
      if (exists) {
        this.remoteState.favorites = this.remoteState.favorites.filter(
          (f) => !(f.clientId === clientId && f.professionalId === professionalId)
        );
        if (client) {
          Promise.resolve(
            client
              .from('favorites')
              .delete()
              .match({ client_id: clientId, professional_id: professionalId })
          ).catch(() => {});
        }
        this.notifyChange();
        return false;
      }

      this.remoteState.favorites = [
        ...this.remoteState.favorites,
        { clientId, professionalId, createdAt: new Date().toISOString() },
      ];
      if (client) {
        Promise.resolve(
          client
            .from('favorites')
            .upsert({ client_id: clientId, professional_id: professionalId })
        ).catch(() => {});
      }
      this.notifyChange();
      return true;
    }
    return this.localFallback!.toggleFavorite(clientId, professionalId);
  }

  publishReview(input: Parameters<DataProvider['publishReview']>[0]): Review {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      const rev: Review = {
        ...input,
        id: makeUuidLike('rev'),
        reported: false,
        hiddenByAdmin: false,
        createdAt: new Date().toISOString(),
      };
      if (client) {
        Promise.resolve(
          client.from('reviews').insert({
            id: rev.id,
            booking_id: rev.bookingId,
            client_id: rev.clientId,
            professional_id: rev.professionalId,
            rating: rev.rating,
            comment: rev.comment,
          })
        )
          .then(() => this.syncAllRemoteTables())
          .catch(() => {});
      }
      this.remoteState.reviews = [rev, ...this.remoteState.reviews];
      this.notifyChange();
      return rev;
    }
    return this.localFallback!.publishReview(input);
  }

  replyToReview(reviewId: string, responseText: string): Review {
    if (this.mode === 'supabase') {
      const target = this.remoteState.reviews.find((r) => r.id === reviewId);
      if (!target) throw new Error('Reseña no encontrada.');
      const next: Review = {
        ...target,
        proResponse: {
          text: responseText,
          respondedAt: new Date().toISOString(),
        },
      };
      this.remoteState.reviews = this.remoteState.reviews.map((r) =>
        r.id === reviewId ? next : r
      );
      this.notifyChange();
      return next;
    }
    return this.localFallback!.replyToReview(reviewId, responseText);
  }

  reportReview(reviewId: string, _reporterId: string, _reason: string): void {
    if (this.mode === 'supabase') {
      this.remoteState.reviews = this.remoteState.reviews.map((r) =>
        r.id === reviewId ? { ...r, reported: true } : r
      );
      this.notifyChange();
      return;
    }
    this.localFallback!.reportReview(reviewId, _reporterId, _reason);
  }

  markNotificationRead(notificationId: string): void {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      if (client) {
        Promise.resolve(
          client.from('notifications').update({ is_read: true }).eq('id', notificationId)
        ).catch(() => {});
      }
      this.remoteState.notifications = this.remoteState.notifications.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n
      );
      this.notifyChange();
      return;
    }
    this.localFallback!.markNotificationRead(notificationId);
  }

  markAllNotificationsRead(profileId: string): void {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      if (client) {
        Promise.resolve(
          client.from('notifications').update({ is_read: true }).eq('profile_id', profileId)
        ).catch(() => {});
      }
      this.remoteState.notifications = this.remoteState.notifications.map((n) =>
        n.profileId === profileId ? { ...n, read: true } : n
      );
      this.notifyChange();
      return;
    }
    this.localFallback!.markAllNotificationsRead(profileId);
  }

  createSupportTicket(input: Parameters<DataProvider['createSupportTicket']>[0]): SupportTicket {
    if (this.mode === 'supabase') {
      const ticket: SupportTicket = {
        ...input,
        id: makeUuidLike('tkt'),
        status: 'open',
        createdAt: new Date().toISOString(),
      };
      this.remoteState.supportTickets = [ticket, ...this.remoteState.supportTickets];
      this.notifyChange();
      return ticket;
    }
    return this.localFallback!.createSupportTicket(input);
  }

  createReport(input: Parameters<DataProvider['createReport']>[0]): ModerationReport {
    if (this.mode === 'supabase') {
      const rep: ModerationReport = {
        ...input,
        id: makeUuidLike('rep'),
        status: 'open',
        createdAt: new Date().toISOString(),
      };
      this.remoteState.reports = [rep, ...this.remoteState.reports];
      this.notifyChange();
      return rep;
    }
    return this.localFallback!.createReport(input);
  }

  upsertCategory(category: Category, admin: Profile): Category {
    if (this.mode === 'supabase') {
      if (admin.primaryRole !== 'central_admin') {
        throw new Error('Permiso denegado: requiere rol Administrador Central.');
      }
      const client = getSupabaseClient();
      if (client) {
        Promise.resolve(
          client.from('service_categories').upsert({
            id: category.id,
            name: category.name,
            slug: category.slug,
            description: category.description,
            icon: category.iconName,
            is_active: category.active,
          })
        )
          .then(() => this.syncAllRemoteTables())
          .catch(() => {});
      }
      const exists = this.remoteState.categories.some((c) => c.id === category.id);
      this.remoteState.categories = exists
        ? this.remoteState.categories.map((c) => (c.id === category.id ? category : c))
        : [...this.remoteState.categories, category];
      this.notifyChange();
      return category;
    }
    return this.localFallback!.upsertCategory(category, admin);
  }

  toggleCategoryActive(categoryId: string, admin: Profile): void {
    if (this.mode === 'supabase') {
      if (admin.primaryRole !== 'central_admin') {
        throw new Error('Permiso denegado.');
      }
      const cat = this.remoteState.categories.find((c) => c.id === categoryId);
      if (!cat) return;
      this.upsertCategory({ ...cat, active: !cat.active }, admin);
      return;
    }
    this.localFallback!.toggleCategoryActive(categoryId, admin);
  }

  upsertRegion(region: Region, admin: Profile): Region {
    if (this.mode === 'supabase') {
      if (admin.primaryRole !== 'central_admin') throw new Error('Permiso denegado.');
      const exists = this.remoteState.regions.some((r) => r.id === region.id);
      this.remoteState.regions = exists
        ? this.remoteState.regions.map((r) => (r.id === region.id ? region : r))
        : [...this.remoteState.regions, region];
      this.notifyChange();
      return region;
    }
    return this.localFallback!.upsertRegion(region, admin);
  }

  toggleRegionActive(regionId: string, admin: Profile): void {
    if (this.mode === 'supabase') {
      if (admin.primaryRole !== 'central_admin') throw new Error('Permiso denegado.');
      this.remoteState.regions = this.remoteState.regions.map((r) =>
        r.id === regionId ? { ...r, active: !r.active } : r
      );
      this.notifyChange();
      return;
    }
    this.localFallback!.toggleRegionActive(regionId, admin);
  }

  reviewVerification(input: Parameters<DataProvider['reviewVerification']>[0]): VerificationRequest {
    if (this.mode === 'supabase') {
      if (input.adminRole !== 'central_admin') throw new Error('Permiso denegado.');
      const client = getSupabaseClient();
      const target = this.remoteState.verificationRequests.find(
        (v) => v.id === input.verificationId
      );
      if (!target) throw new Error('Solicitud de verificación no encontrada.');
      const now = new Date().toISOString();
      const next: VerificationRequest = {
        ...target,
        status: input.status,
        reviewReason: input.reason,
        reviewedByAdminId: input.adminId,
        history: [
          ...target.history,
          {
            status: input.status,
            note: input.reason,
            date: now,
          },
        ],
        updatedAt: now,
      };
      this.remoteState.verificationRequests = this.remoteState.verificationRequests.map((v) =>
        v.id === input.verificationId ? next : v
      );
      if (client) {
        Promise.resolve(
          client
            .from('verification_documents')
            .update({ status: input.status, reviewer_notes: input.reason })
            .eq('id', input.verificationId)
        ).catch(() => {});
      }
      this.notifyChange();
      return next;
    }
    return this.localFallback!.reviewVerification(input);
  }

  toggleProPaused(proId: string, admin: Profile, reason: string): ProfessionalProfile {
    if (this.mode === 'supabase') {
      if (admin.primaryRole !== 'central_admin') throw new Error('Permiso denegado.');
      const target = this.remoteState.professionals.find((p) => p.id === proId);
      if (!target) throw new Error('Profesional no encontrado.');
      const next = this.updateProfessionalProfile(proId, { pausedByAdmin: !target.pausedByAdmin });
      this.logAdminAudit({
        actorId: admin.id,
        actorName: admin.fullName,
        actorRole: admin.primaryRole,
        regionId: admin.regionId,
        action: next.pausedByAdmin ? 'PRO_PAUSED' : 'PRO_RESUMED',
        targetEntity: 'professional_profiles',
        targetId: proId,
        reason,
      });
      return next;
    }
    return this.localFallback!.toggleProPaused(proId, admin, reason);
  }

  toggleUserSuspended(profileId: string, admin: Profile, reason: string): Profile {
    if (this.mode === 'supabase') {
      if (admin.primaryRole !== 'central_admin') throw new Error('Permiso denegado.');
      const target = this.remoteState.profiles.find((p) => p.id === profileId);
      if (!target) throw new Error('Usuario no encontrado.');
      const next = this.updateProfile(profileId, { suspended: !target.suspended });
      this.logAdminAudit({
        actorId: admin.id,
        actorName: admin.fullName,
        actorRole: admin.primaryRole,
        regionId: admin.regionId,
        action: next.suspended ? 'USER_SUSPENDED' : 'USER_RESTORED',
        targetEntity: 'profiles',
        targetId: profileId,
        reason,
      });
      return next;
    }
    return this.localFallback!.toggleUserSuspended(profileId, admin, reason);
  }

  moderateReport(
    reportId: string,
    status: ModerationReport['status'],
    admin: Profile,
    notes: string
  ): void {
    if (this.mode === 'supabase') {
      if (admin.primaryRole !== 'central_admin') throw new Error('Permiso denegado.');
      this.remoteState.reports = this.remoteState.reports.map((r) =>
        r.id === reportId ? { ...r, status, adminNotes: notes } : r
      );
      this.notifyChange();
      return;
    }
    this.localFallback!.moderateReport(reportId, status, admin, notes);
  }

  toggleReviewHidden(reviewId: string, admin: Profile, _reason: string): void {
    if (this.mode === 'supabase') {
      if (admin.primaryRole !== 'central_admin') throw new Error('Permiso denegado.');
      this.remoteState.reviews = this.remoteState.reviews.map((r) =>
        r.id === reviewId ? { ...r, hiddenByAdmin: !r.hiddenByAdmin } : r
      );
      this.notifyChange();
      return;
    }
    this.localFallback!.toggleReviewHidden(reviewId, admin, _reason);
  }

  updateTicketStatus(ticketId: string, status: SupportTicket['status'], admin: Profile): void {
    if (this.mode === 'supabase') {
      if (admin.primaryRole !== 'central_admin') throw new Error('Permiso denegado.');
      this.remoteState.supportTickets = this.remoteState.supportTickets.map((t) =>
        t.id === ticketId ? { ...t, status } : t
      );
      this.notifyChange();
      return;
    }
    this.localFallback!.updateTicketStatus(ticketId, status, admin);
  }

  replyToTicket(
    ticketId: string,
    evidenceNote: string,
    status: SupportTicket['status'],
    admin: Profile
  ): void {
    if (this.mode === 'supabase') {
      if (admin.primaryRole !== 'central_admin') throw new Error('Permiso denegado.');
      this.remoteState.supportTickets = this.remoteState.supportTickets.map((t) =>
        t.id === ticketId ? { ...t, status, evidenceNote } : t
      );
      this.notifyChange();
      return;
    }
    this.localFallback!.replyToTicket(ticketId, evidenceNote, status, admin);
  }

  reviewAdminAccessRequest(input: Parameters<DataProvider['reviewAdminAccessRequest']>[0]) {
    if (this.mode === 'supabase') {
      if (input.admin.primaryRole !== 'central_admin') throw new Error('Permiso denegado.');
      const target = this.remoteState.adminAccessRequests.find((r) => r.id === input.requestId);
      if (!target) throw new Error('Solicitud no encontrada.');
      const next: AdminAccessRequest = {
        ...target,
        status: input.decision,
        reviewNotes: input.notes,
        authorizedByAdminId: input.admin.id,
        authorizedByAdminName: input.admin.fullName,
        updatedAt: new Date().toISOString(),
      };
      this.remoteState.adminAccessRequests = this.remoteState.adminAccessRequests.map((r) =>
        r.id === input.requestId ? next : r
      );
      this.notifyChange();
      return { request: next };
    }
    return this.localFallback!.reviewAdminAccessRequest(input);
  }

  logAdminAudit(log: Parameters<DataProvider['logAdminAudit']>[0]): void {
    if (this.mode === 'supabase') {
      const client = getSupabaseClient();
      const entry: AuditLog = {
        ...log,
        id: makeUuidLike('aud'),
        createdAt: new Date().toISOString(),
      };
      if (client) {
        Promise.resolve(
          client.from('admin_audit_logs').insert({
            actor_id: log.actorId,
            actor_name: log.actorName,
            actor_role: log.actorRole,
            region_id: log.regionId,
            action: log.action,
            target_entity: log.targetEntity,
            target_id: log.targetId,
            reason: log.reason,
          })
        ).catch(() => {});
      }
      this.remoteState.auditLogs = [entry, ...this.remoteState.auditLogs];
      this.notifyChange();
      return;
    }
    this.localFallback!.logAdminAudit(log);
  }
}
