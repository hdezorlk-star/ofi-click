import React, { useState } from 'react';
import { ExternalLink, Info } from 'lucide-react';
import {
  getGoogleOAuthConfigStatus,
  initiateGoogleOAuth,
  type GoogleOAuthInitiationResult,
} from '../services/auth/googleOAuth.service';
import { getSupabaseClient } from '../lib/supabase/client';
import { GOOGLE_ONBOARDING_ROLE_KEY } from '../adapters/supabase/supabase.adapter';

interface GoogleAuthButtonProps {
  intent: 'login' | 'register';
  separatorLabel?: string;
  onboardingRole?: 'client' | 'independent_pro';
}

export const GoogleGIcon: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4 shrink-0',
}) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.86c2.26-2.08 3.58-5.15 3.58-8.85z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.07 7.94-2.91l-3.86-3c-1.07.72-2.44 1.14-4.08 1.14-3.14 0-5.8-2.12-6.75-4.97H1.26v3.09A12 12 0 0 0 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.25 14.26A7.2 7.2 0 0 1 4.87 12c0-.78.14-1.54.38-2.26V6.65H1.26A12 12 0 0 0 0 12c0 1.94.46 3.77 1.26 5.35l3.99-3.09z"
    />
    <path
      fill="#EA4335"
      d="M12 4.77c1.76 0 3.34.61 4.58 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.65l3.99 3.09c.95-2.85 3.61-4.97 6.75-4.97z"
    />
  </svg>
);

export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  intent,
  separatorLabel = 'o continúa con correo electrónico',
  onboardingRole,
}) => {
  const [oauthNotice, setOauthNotice] = useState<GoogleOAuthInitiationResult | null>(null);
  const [externalOAuthUrl, setExternalOAuthUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setOauthNotice(null);
    setExternalOAuthUrl(null);

    if (typeof window !== 'undefined' && onboardingRole) {
      try {
        window.sessionStorage.setItem(GOOGLE_ONBOARDING_ROLE_KEY, onboardingRole);
      } catch {
        // ignore storage restrictions
      }
    }

    const client = getSupabaseClient();
    if (client) {
      setLoading(true);
      try {
        const redirectTo =
          typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
        const { data, error } = await client.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo,
            skipBrowserRedirect: true,
            queryParams: {
              access_type: 'offline',
              prompt: 'select_account',
            },
          },
        });
        setLoading(false);

        if (error) {
          setOauthNotice({
            initiated: false,
            reason: 'not_configured',
            status: getGoogleOAuthConfigStatus(),
            message: `No se pudo iniciar Google OAuth en Supabase: ${error.message}`,
          });
          return;
        }

        if (data?.url && typeof window !== 'undefined') {
          const isFramed = window.self !== window.top;
          if (!isFramed) {
            window.location.assign(data.url);
            return;
          }
          try {
            if (window.top) {
              window.top.location.assign(data.url);
              return;
            }
          } catch {
            // Cross-origin iframe prevents direct top-window navigation; provide safe direct link
            setExternalOAuthUrl(data.url);
            return;
          }
          setExternalOAuthUrl(data.url);
          return;
        }
      } catch (err) {
        setLoading(false);
        setOauthNotice({
          initiated: false,
          reason: 'not_configured',
          status: getGoogleOAuthConfigStatus(),
          message:
            err instanceof Error ? err.message : 'Error al conectar con Google OAuth.',
        });
        return;
      }
    }

    const result = initiateGoogleOAuth(intent);
    if (result.initiated && result.authorizationUrl && typeof window !== 'undefined') {
      window.location.assign(result.authorizationUrl);
      return;
    }
    setOauthNotice(result);
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={loading}
        onClick={handleClick}
        data-testid={`google-oauth-btn-${intent}`}
        className="w-full py-2.5 px-4 rounded-xl border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#1A2128] hover:bg-[#ECE7DC]/75 dark:hover:bg-white/10 text-[#1D252C] dark:text-[#F7F3EA] text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2.5 shadow-2xs disabled:opacity-60"
      >
        <GoogleGIcon className="w-4 h-4 shrink-0" />
        <span>{loading ? 'Conectando con Google...' : 'Continuar con Google'}</span>
      </button>

      {externalOAuthUrl && (
        <div
          role="status"
          className="rounded-xl border border-[#C7582B]/40 bg-[#ECE7DC]/80 dark:bg-[#161C22] p-3 text-xs text-[#1D252C] dark:text-[#F7F3EA] space-y-2"
        >
          <p className="leading-relaxed">
            Google bloquea mostrar su pantalla de acceso dentro de vistas previas embebidas. Ábrela
            directamente para completar tu inicio de sesión:
          </p>
          <a
            href={externalOAuthUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1D252C] hover:bg-[#2C3741] text-[#F7F3EA] font-semibold transition-colors"
          >
            <span>Abrir acceso de Google</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {oauthNotice && !oauthNotice.initiated && (
        <div
          role="status"
          data-testid={`google-oauth-notice-${intent}`}
          className="rounded-xl border border-[#5B6B5F]/40 bg-[#ECE7DC]/75 dark:bg-[#161C22] p-3 text-xs text-[#1D252C] dark:text-[#F7F3EA] space-y-1.5"
        >
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-[#214438] dark:text-[#C7582B] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-[#1D252C] dark:text-[#F7F3EA]">
                Acceso con Google OAuth
              </p>
              <p className="text-[#5B636B] dark:text-[#A8B0B8] leading-relaxed">
                {oauthNotice.message}
              </p>
              <ul className="list-disc pl-4 text-[11px] text-[#5B636B] dark:text-[#A8B0B8] space-y-0.5">
                {oauthNotice.status.missingRequirements.map((req) => (
                  <li key={req}>{req}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="relative flex items-center py-1">
        <div className="flex-grow border-t border-[#DBD4C6] dark:border-white/12" />
        <span className="shrink mx-3 text-[11px] font-medium text-[#5B636B] dark:text-[#A8B0B8]">
          {separatorLabel}
        </span>
        <div className="flex-grow border-t border-[#DBD4C6] dark:border-white/12" />
      </div>
    </div>
  );
};
