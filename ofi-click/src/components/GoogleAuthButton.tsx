import React, { useState } from 'react';
import { Info } from 'lucide-react';
import {
  getGoogleOAuthConfigStatus,
  initiateGoogleOAuth,
  type GoogleOAuthInitiationResult,
} from '../services/auth/googleOAuth.service';
import { getSupabaseClient } from '../lib/supabase/client';

interface GoogleAuthButtonProps {
  intent: 'login' | 'register';
  separatorLabel?: string;
}

export const GoogleGIcon: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4 shrink-0',
}) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={className}
  >
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
}) => {
  const [oauthNotice, setOauthNotice] = useState<GoogleOAuthInitiationResult | null>(null);

  const handleClick = async () => {
    const client = getSupabaseClient();
    if (client) {
      try {
        const { error } = await client.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
            queryParams: {
              access_type: 'offline',
              prompt: 'select_account',
            },
          },
        });
        if (error) {
          setOauthNotice({
            initiated: false,
            reason: 'not_configured',
            status: getGoogleOAuthConfigStatus(),
            message: `Error al conectar con Google en Supabase: ${error.message}`,
          });
        }
        return;
      } catch (err) {
        setOauthNotice({
          initiated: false,
          reason: 'not_configured',
          status: getGoogleOAuthConfigStatus(),
          message: err instanceof Error ? err.message : 'Error al conectar con Google OAuth.',
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
        onClick={handleClick}
        data-testid={`google-oauth-btn-${intent}`}
        className="w-full py-2.5 px-4 rounded-xl border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#222825] hover:bg-[#EAE3D6]/60 dark:hover:bg-white/10 text-[#252A27] dark:text-[#F5F1E8] text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2.5 shadow-2xs"
      >
        <GoogleGIcon className="w-4 h-4 shrink-0" />
        <span>Continuar con Google</span>
      </button>

      {oauthNotice && !oauthNotice.initiated && (
        <div
          role="status"
          data-testid={`google-oauth-notice-${intent}`}
          className="rounded-xl border border-[#75836A]/40 bg-[#EAE3D6]/75 dark:bg-[#1C211E] p-3 text-xs text-[#252A27] dark:text-[#F5F1E8] space-y-1.5"
        >
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-[#304B3E] dark:text-[#75836A] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-[#304B3E] dark:text-[#EAE3D6]">
                Acceso con Google preparado para conexión OAuth real
              </p>
              <p className="text-[#73766F] dark:text-[#A3A89F] leading-relaxed">
                {oauthNotice.message}
              </p>
              <ul className="list-disc pl-4 text-[11px] text-[#73766F] dark:text-[#A3A89F] space-y-0.5">
                {oauthNotice.status.missingRequirements.map((req) => (
                  <li key={req}>{req}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="relative flex items-center py-1">
        <div className="flex-grow border-t border-[#DDD5C8] dark:border-white/12" />
        <span className="shrink mx-3 text-[11px] font-medium text-[#73766F] dark:text-[#A3A89F]">
          {separatorLabel}
        </span>
        <div className="flex-grow border-t border-[#DDD5C8] dark:border-white/12" />
      </div>
    </div>
  );
};
