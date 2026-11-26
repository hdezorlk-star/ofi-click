import type { Profile, UserRoleType } from '../../types/oficlick';

export interface GoogleIdentityProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
  avatarUrl?: string;
}

export interface GoogleOAuthConfigStatus {
  configured: boolean;
  providerMode: 'supabase_google' | 'google_oidc_client' | 'unconfigured';
  missingRequirements: string[];
  clientIdPresent: boolean;
  supabaseConfigured: boolean;
  note: string;
}

export interface GoogleOAuthInitiationResult {
  initiated: boolean;
  reason?: 'not_configured';
  status: GoogleOAuthConfigStatus;
  authorizationUrl?: string;
  message: string;
}

export type GoogleOnboardingRoleChoice = 'client' | 'independent_pro';

export interface GoogleOnboardingPolicy {
  allowed: boolean;
  requiresPasswordSetup: boolean;
  requiresFrontalPhoto: boolean;
  redirectTab: string;
  assignedRole: UserRoleType | null;
  reason?: string;
}

function readPublicEnv(key: string): string | undefined {
  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env;
  const val = metaEnv?.[key];
  return typeof val === 'string' && val.trim().length > 0 ? val.trim() : undefined;
}

export function getGoogleOAuthConfigStatus(): GoogleOAuthConfigStatus {
  const googleClientId = readPublicEnv('VITE_GOOGLE_OAUTH_CLIENT_ID');
  const dataAdapter = readPublicEnv('VITE_DATA_ADAPTER');
  const supabaseUrl = readPublicEnv('VITE_SUPABASE_URL');
  const supabaseKey = readPublicEnv('VITE_SUPABASE_ANON_KEY');
  const supabaseConfigured = Boolean(
    dataAdapter === 'supabase' && supabaseUrl && supabaseKey
  );

  if (supabaseConfigured) {
    return {
      configured: true,
      providerMode: 'supabase_google',
      missingRequirements: [],
      clientIdPresent: Boolean(googleClientId),
      supabaseConfigured: true,
      note: 'Proveedor Google OAuth listo mediante Supabase Auth (sin secretos en el cliente).',
    };
  }

  if (googleClientId) {
    return {
      configured: true,
      providerMode: 'google_oidc_client',
      missingRequirements: [],
      clientIdPresent: true,
      supabaseConfigured: false,
      note: 'Client ID público de Google configurado para flujo PKCE.',
    };
  }

  return {
    configured: false,
    providerMode: 'unconfigured',
    missingRequirements: [
      'Configurar proveedor Google en Supabase Auth o definir VITE_GOOGLE_OAUTH_CLIENT_ID en el entorno.',
      'Registrar las URLs de redirección autorizadas en Google Cloud Console.',
    ],
    clientIdPresent: false,
    supabaseConfigured: false,
    note: 'Modo prototipo local: la integración real con Google OAuth no tiene credenciales configuradas todavía.',
  };
}

/**
 * Inicia el flujo real de Google OAuth únicamente cuando existe configuración válida.
 * Nunca simula una autenticación real de Google si no hay proveedor configurado.
 */
export function initiateGoogleOAuth(intent: 'login' | 'register'): GoogleOAuthInitiationResult {
  const status = getGoogleOAuthConfigStatus();

  if (!status.configured) {
    return {
      initiated: false,
      reason: 'not_configured',
      status,
      message:
        intent === 'login'
          ? 'Google OAuth aún no está conectado en este entorno local. No simulamos accesos reales de Google sin credenciales configuradas.'
          : 'El registro real con Google requiere configurar Google OAuth en Supabase Auth o definir VITE_GOOGLE_OAUTH_CLIENT_ID. La interfaz y las reglas de onboarding ya están preparadas.',
    };
  }

  if (status.providerMode === 'supabase_google') {
    const supabaseUrl = readPublicEnv('VITE_SUPABASE_URL')!;
    const redirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/` : '';
    const params = new URLSearchParams({
      provider: 'google',
      redirect_to: redirectTo,
    });
    return {
      initiated: true,
      status,
      authorizationUrl: `${supabaseUrl.replace(/\/+$/, '')}/auth/v1/authorize?${params.toString()}`,
      message: 'Redirección OAuth preparada mediante Supabase Auth.',
    };
  }

  const clientId = readPublicEnv('VITE_GOOGLE_OAUTH_CLIENT_ID')!;
  const redirectUri =
    typeof window !== 'undefined' ? `${window.location.origin}/` : '';
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    prompt: 'select_account',
  });

  return {
    initiated: true,
    status,
    authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    message: 'Solicitud OAuth preparada con el Client ID público de Google.',
  };
}

/**
 * Política de autenticación/onboarding para cuentas provenientes de Google OAuth:
 * - Usuarios existentes acceden directo a su panel sin pedir contraseña secundaria.
 * - Cuentas nuevas eligen únicamente 'client' o 'independent_pro' (NUNCA 'central_admin').
 * - Clientes nunca requieren foto frontal obligatoria ni segunda contraseña.
 * - Freelancers ingresan directo a su panel en la pestaña de perfil/verificación.
 */
export function resolveGoogleOnboardingPolicy(
  existingProfile: Pick<Profile, 'primaryRole' | 'suspended'> | null | undefined,
  requestedRole?: GoogleOnboardingRoleChoice | UserRoleType
): GoogleOnboardingPolicy {
  if (existingProfile) {
    if (existingProfile.suspended) {
      return {
        allowed: false,
        requiresPasswordSetup: false,
        requiresFrontalPhoto: false,
        redirectTab: 'inicio',
        assignedRole: null,
        reason: 'Tu cuenta se encuentra suspendida. Contacta a soporte.',
      };
    }

    return {
      allowed: true,
      requiresPasswordSetup: false,
      requiresFrontalPhoto: false,
      redirectTab:
        existingProfile.primaryRole === 'central_admin' ? 'resumen' : 'inicio',
      assignedRole: existingProfile.primaryRole,
    };
  }

  if (requestedRole === 'central_admin') {
    return {
      allowed: false,
      requiresPasswordSetup: false,
      requiresFrontalPhoto: false,
      redirectTab: 'inicio',
      assignedRole: null,
      reason:
        'Las cuentas de Administrador Central nunca pueden asignarse automáticamente mediante Google OAuth.',
    };
  }

  const safeRole: GoogleOnboardingRoleChoice =
    requestedRole === 'independent_pro' ? 'independent_pro' : 'client';

  return {
    allowed: true,
    requiresPasswordSetup: false,
    requiresFrontalPhoto: false,
    redirectTab: safeRole === 'independent_pro' ? 'perfil' : 'inicio',
    assignedRole: safeRole,
  };
}
