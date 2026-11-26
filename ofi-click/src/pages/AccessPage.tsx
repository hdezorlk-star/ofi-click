import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Moon,
  ShieldAlert,
  ShieldCheck,
  Sun,
  UserCheck,
  UserPlus,
  Wrench,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { PhotoUploadBox } from '../components/media/PhotoUploadBox';
import { useOfiClick } from '../context/OfiClickContext';
import { authService } from '../services/auth.service';
import { ALL_IZCALLI_COLONIAS } from '../data/izcalliLocations';
import { GoogleAuthButton } from '../components/GoogleAuthButton';
import type { AdminAccessRequest, PreparedEmailRecord } from '../types/oficlick';

type AccessMode = 'login' | 'register' | 'recovery';
type RegisterRoleChoice = 'client' | 'independent_pro' | 'admin_request';

export const AccessPage: React.FC = () => {
  const {
    db,
    dataMode,
    theme,
    resolvedTheme,
    setTheme,
    completeAuthSuccess,
    refreshDb,
    notify,
  } = useOfiClick();

  const [mode, setMode] = useState<AccessMode>('login');
  const [showLegalModal, setShowLegalModal] = useState<'privacy' | 'terms' | null>(null);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Registration state (3 role options)
  const [regRole, setRegRole] = useState<RegisterRoleChoice>('client');
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regColonia, setRegColonia] = useState('Centro Urbano');
  const [regCommercialName, setRegCommercialName] = useState('');
  const [regCategoryId, setRegCategoryId] = useState('cat-plomeria');
  const [clientAvatarUrl, setClientAvatarUrl] = useState<string | undefined>(undefined);
  const [regError, setRegError] = useState('');

  // Admin request flow state (Central Admin only)
  const [adminRegionId, setAdminRegionId] = useState('reg-izcalli');
  const [adminJustification, setAdminJustification] = useState('');
  const [adminStep, setAdminStep] = useState<'form' | 'otp' | 'pending'>('form');
  const [activeAdminRequest, setActiveAdminRequest] = useState<AdminAccessRequest | null>(null);
  const [adminOtpInput, setAdminOtpInput] = useState('');
  const [adminOtpError, setAdminOtpError] = useState('');
  const [adminOtpAttemptsLeft, setAdminOtpAttemptsLeft] = useState<number | null>(null);

  // Password recovery flow state
  const [recStep, setRecStep] = useState<'email' | 'code' | 'new_password' | 'done'>('email');
  const [recEmail, setRecEmail] = useState('');
  const [recCode, setRecCode] = useState('');
  const [recNewPassword, setRecNewPassword] = useState('');
  const [recConfirmPassword, setRecConfirmPassword] = useState('');
  const [recMessage, setRecMessage] = useState('');
  const [recError, setRecError] = useState('');

  // Local prepared email preview (honestly labeled, zero external delivery claim)
  const [previewEmail, setPreviewEmail] = useState<PreparedEmailRecord | null>(null);
  const [showPreviewDrawer, setShowPreviewDrawer] = useState(false);

  const activeCategories = useMemo(
    () => db.categories.filter((c) => c.active),
    [db.categories]
  );

  const selectedAdminColonias = useMemo(() => {
    const reg = db.regions.find((r) => r.id === adminRegionId);
    return reg && reg.colonias.length > 0 ? reg.colonias : ALL_IZCALLI_COLONIAS;
  }, [db.regions, adminRegionId]);

  const clientProColonias = useMemo(() => {
    const reg = db.regions.find((r) => r.id === 'reg-izcalli');
    return reg && reg.colonias.length > 0 ? reg.colonias : ALL_IZCALLI_COLONIAS;
  }, [db.regions]);

  const switchMode = (next: AccessMode) => {
    setMode(next);
    setLoginError('');
    setRegError('');
    setRecError('');
    setAdminOtpError('');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const profile = await authService.signInWithEmail(loginEmail, loginPassword);
      completeAuthSuccess(profile);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'No fue posible iniciar sesión.');
    }
  };

  const handleStandardRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    if (regRole === 'admin_request') {
      try {
        const res = authService.submitAdminAccessRequest({
          fullName: regFullName,
          email: regEmail,
          regionId: adminRegionId,
          colonia: regColonia,
          requestedScope: 'central_admin',
          justification: adminJustification,
          password: regPassword,
        });
        setActiveAdminRequest(res.request);
        setPreviewEmail(res.verificationEmail);
        setShowPreviewDrawer(false);
        setAdminOtpInput('');
        setAdminOtpError('');
        setAdminOtpAttemptsLeft(5);
        setAdminStep('otp');
        refreshDb();
        notify('Solicitud registrada. Verifica tu correo con el código de un solo uso.', 'info');
      } catch (err) {
        setRegError(
          err instanceof Error ? err.message : 'No se pudo registrar la solicitud administrativa.'
        );
      }
      return;
    }

    try {
      const { profile, welcomeEmail, requiresEmailConfirmation } = await authService.registerAccount({
        fullName: regFullName,
        email: regEmail,
        colonia: regColonia,
        accountType: regRole,
        password: regPassword,
        avatarUrl: regRole === 'client' ? clientAvatarUrl : undefined,
        avatarConsent: regRole === 'client' ? true : undefined,
        commercialName:
          regRole === 'independent_pro' && regCommercialName.trim()
            ? regCommercialName.trim()
            : undefined,
        categoryId: regRole === 'independent_pro' ? regCategoryId : undefined,
      });
      setPreviewEmail(welcomeEmail);
      setClientAvatarUrl(undefined);
      if (requiresEmailConfirmation) {
        notify(
          `Registro creado. Revisa tu bandeja de ${regEmail} y abre el enlace de confirmación.`,
          'success'
        );
        switchMode('login');
        setLoginEmail(regEmail);
        return;
      }
      notify(
        welcomeEmail.deliveryStatus === 'sent'
          ? 'Cuenta creada y correo de bienvenida enviado.'
          : 'Cuenta creada correctamente.',
        'success'
      );
      completeAuthSuccess(profile);
    } catch (err) {
      setRegError(err instanceof Error ? err.message : 'No se pudo completar el registro.');
    }
  };

  const handleVerifyAdminOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAdminRequest) return;
    setAdminOtpError('');
    const result = authService.verifyAdminRequestOtp(activeAdminRequest.id, adminOtpInput);
    refreshDb();
    if (!result.verified || !result.request) {
      setAdminOtpError(result.error || 'Código incorrecto.');
      if (typeof result.remainingAttempts === 'number') {
        setAdminOtpAttemptsLeft(result.remainingAttempts);
      }
      return;
    }
    setActiveAdminRequest(result.request);
    setAdminStep('pending');
    notify(
      'Correo confirmado. Tu solicitud quedó pendiente de autorización administrativa.',
      'success'
    );
  };

  const handleResendAdminOtp = () => {
    if (!activeAdminRequest) return;
    setAdminOtpError('');
    try {
      const res = authService.resendAdminVerificationCode(activeAdminRequest.id);
      setActiveAdminRequest(res.request);
      setPreviewEmail(res.verificationEmail);
      setAdminOtpAttemptsLeft(5);
      setAdminOtpInput('');
      refreshDb();
      notify('Se generó un nuevo código de verificación de un solo uso.', 'info');
    } catch (err) {
      setAdminOtpError(err instanceof Error ? err.message : 'No se pudo reenviar el código.');
    }
  };

  const handleRequestRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecError('');
    setRecMessage('');
    try {
      const res = await authService.requestPasswordRecovery(recEmail);
      if (!res.sent) {
        setRecError(res.message);
        return;
      }
      setRecMessage(res.message);
      setPreviewEmail(res.preparedEmail ?? null);
      setRecCode('');
      setRecStep(dataMode === 'supabase' ? 'done' : 'code');
      refreshDb();
    } catch (err) {
      setRecError(err instanceof Error ? err.message : 'Ingresa un correo válido.');
    }
  };

  const handleValidateRecoveryCode = (e: React.FormEvent) => {
    e.preventDefault();
    setRecError('');
    const check = authService.validatePasswordRecoveryCode(recEmail, recCode);
    refreshDb();
    if (!check.valid) {
      setRecError(check.error || 'Código inválido o expirado.');
      return;
    }
    setRecStep('new_password');
  };

  const handleCompletePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecError('');
    if (recNewPassword !== recConfirmPassword) {
      setRecError('Las contraseñas no coinciden.');
      return;
    }
    try {
      const res = await authService.completePasswordReset(recEmail, recCode, recNewPassword);
      refreshDb();
      setRecMessage(res.message);
      setRecStep('done');
      notify('Contraseña actualizada correctamente.', 'success');
    } catch (err) {
      setRecError(err instanceof Error ? err.message : 'No se pudo actualizar la contraseña.');
    }
  };

  const latestPreparedEmails = previewEmail
    ? [previewEmail, ...db.preparedEmails.filter((e) => e.id !== previewEmail.id)].slice(0, 3)
    : db.preparedEmails.slice(0, 3);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F3EA] dark:bg-[#12171C] text-[#1D252C] dark:text-[#F7F3EA]">
      {/* Minimal branded top header */}
      <header className="border-b border-[#DBD4C6] dark:border-white/10 bg-[#F7F3EA]/95 dark:bg-[#12171C]/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <BrandLogo variant="horizontal" size="md" />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowLegalModal('privacy')}
              className="hidden sm:inline-flex px-3 py-1.5 rounded-lg text-xs font-medium text-[#73766F] hover:text-[#1D252C] dark:text-[#A3A89F] dark:hover:text-[#F7F3EA]"
            >
              Privacidad
            </button>
            <button
              type="button"
              onClick={() => setShowLegalModal('terms')}
              className="hidden sm:inline-flex px-3 py-1.5 rounded-lg text-xs font-medium text-[#73766F] hover:text-[#1D252C] dark:text-[#A3A89F] dark:hover:text-[#F7F3EA]"
            >
              Términos
            </button>
            <button
              type="button"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
              aria-label={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              className="p-2 rounded-lg border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] hover:border-[#214438]/40 transition-colors"
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="w-4 h-4 text-[#C7582B]" />
              ) : (
                <Moon className="w-4 h-4 text-[#1D252C]" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 lg:py-14 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Identity Column */}
          <section className="lg:col-span-5 space-y-6 lg:pt-4">
            <div className="flex items-center gap-4">
              <BrandLogo variant="icon" size="xl" />
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#214438]/10 dark:bg-[#75836A]/20 text-[#214438] dark:text-[#A8B89A] text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Cuautitlán Izcalli · Acceso oficial</span>
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="font-display font-bold text-3xl sm:text-4xl tracking-tight leading-tight text-[#1D252C] dark:text-[#F7F3EA]">
                Encuentra talento. Haz que suceda.
              </h1>
              <p className="text-sm sm:text-base text-[#1D252C]/75 dark:text-[#F7F3EA]/75 leading-relaxed">
                Inicia sesión o crea tu cuenta en OFI CLICK para acceder directamente a tu espacio
                de trabajo según tu rol autorizado.
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <div className="rounded-xl border border-[#DBD4C6] dark:border-white/10 bg-[#FFFDFA] dark:bg-[#1A2128] p-4 flex items-start gap-3">
                <UserCheck className="w-5 h-5 text-[#214438] dark:text-[#75836A] shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-bold">Clientes</h2>
                  <p className="text-xs text-[#73766F] dark:text-[#A3A89F] mt-0.5">
                    Explora profesionales locales verificados, solicita cotizaciones en MXN y
                    gestiona tus contrataciones desde tu panel.
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-[#DBD4C6] dark:border-white/10 bg-[#FFFDFA] dark:bg-[#1A2128] p-4 flex items-start gap-3">
                <Wrench className="w-5 h-5 text-[#C7582B] shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-bold">Freelancers / Trabajadores independientes</h2>
                  <p className="text-xs text-[#73766F] dark:text-[#A3A89F] mt-0.5">
                    Panel operativo exclusivo para atender solicitudes, enviar cotizaciones,
                    administrar tu portafolio y agenda.
                  </p>
                </div>
              </div>
              <div className="rounded-xl border border-[#DBD4C6] dark:border-white/10 bg-[#FFFDFA] dark:bg-[#1A2128] p-4 flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-[#214438] dark:text-[#75836A] shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-sm font-bold">Administración</h2>
                  <p className="text-xs text-[#73766F] dark:text-[#A3A89F] mt-0.5">
                    Las solicitudes administrativas requieren verificación de correo y autorización
                    explícita antes de habilitar el acceso.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Right Auth Card */}
          <section className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl bg-[#FFFDFA] dark:bg-[#1A2128] border border-[#DBD4C6] dark:border-white/12 shadow-xl p-6 sm:p-8">
              {/* Primary Two-Option Toggle: Iniciar sesión / Registrarse */}
              <div
                className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#ECE7DC] dark:bg-[#161C22]"
                role="tablist"
                aria-label="Opciones de acceso"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'login'}
                  onClick={() => switchMode('login')}
                  className={`py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors ${
                    mode === 'login'
                      ? 'bg-[#FFFDFA] dark:bg-[#2A312D] text-[#1D252C] dark:text-[#F7F3EA] shadow-xs'
                      : 'text-[#73766F] hover:text-[#1D252C] dark:text-[#A3A89F] dark:hover:text-[#F7F3EA]'
                  }`}
                >
                  Iniciar sesión
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'register'}
                  onClick={() => switchMode('register')}
                  className={`py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors ${
                    mode === 'register'
                      ? 'bg-[#FFFDFA] dark:bg-[#2A312D] text-[#1D252C] dark:text-[#F7F3EA] shadow-xs'
                      : 'text-[#73766F] hover:text-[#1D252C] dark:text-[#A3A89F] dark:hover:text-[#F7F3EA]'
                  }`}
                >
                  Registrarse
                </button>
              </div>

              {/* MODE 1: INICIAR SESIÓN */}
              {mode === 'login' && (
                <form onSubmit={handleLoginSubmit} className="mt-6 space-y-4">
                  <div>
                    <h2 className="font-display text-xl font-bold">
                      Iniciar sesión en OFI CLICK
                    </h2>
                    <p className="text-xs text-[#73766F] dark:text-[#A3A89F] mt-1">
                      Al ingresar, te llevaremos automáticamente al panel correspondiente a tu cuenta.
                    </p>
                  </div>

                  <GoogleAuthButton intent="login" />

                  {loginError && (
                    <div
                      role="alert"
                      className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300"
                    >
                      {loginError}
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="access-login-email"
                      className="block text-xs font-semibold mb-1.5"
                    >
                      Correo electrónico
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-[#73766F] absolute left-3 top-3" />
                      <input
                        id="access-login-email"
                        type="email"
                        required
                        autoComplete="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="tu@correo.com"
                        className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] focus:outline-2 focus:outline-[#214438]"
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="access-login-password"
                      className="block text-xs font-semibold mb-1.5"
                    >
                      Contraseña
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-[#73766F] absolute left-3 top-3" />
                      <input
                        id="access-login-password"
                        type={showLoginPw ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-9 pr-10 py-2.5 text-sm rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] focus:outline-2 focus:outline-[#214438]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPw((v) => !v)}
                        aria-label={showLoginPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        className="absolute right-2.5 top-2.5 p-1 text-[#73766F] hover:text-[#1D252C] dark:hover:text-white"
                      >
                        {showLoginPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-lg bg-[#214438] hover:bg-[#183329] text-white text-sm font-semibold transition-colors"
                  >
                    Entrar a mi panel
                  </button>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setRecStep('email');
                        setRecEmail(loginEmail);
                        setRecError('');
                        setRecMessage('');
                        switchMode('recovery');
                      }}
                      className="text-[#214438] dark:text-[#C7582B] font-medium hover:underline"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode('register')}
                      className="text-[#73766F] hover:text-[#1D252C] dark:text-[#A3A89F] dark:hover:text-white"
                    >
                      ¿Aún no tienes cuenta? Regístrate
                    </button>
                  </div>
                </form>
              )}

              {/* MODE 2: REGISTRARSE */}
              {mode === 'register' && (
                <div className="mt-6 space-y-5">
                  {adminStep === 'form' && (
                    <>
                      <div>
                        <h2 className="font-display text-xl font-bold">
                          Crear cuenta en OFI CLICK
                        </h2>
                        <p className="text-xs text-[#73766F] dark:text-[#A3A89F] mt-1">
                          Selecciona el tipo de cuenta que deseas crear para continuar con tu
                          registro.
                        </p>
                      </div>

                      {regRole !== 'admin_request' && (
                        <GoogleAuthButton
                          intent="register"
                          onboardingRole={regRole}
                          separatorLabel="o completa el registro con correo"
                        />
                      )}

                      {/* 3 Role Options */}
                      <div
                        className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
                        role="radiogroup"
                        aria-label="Tipo de cuenta"
                      >
                        {(
                          [
                            {
                              id: 'client' as const,
                              title: 'Cliente',
                              desc: 'Buscar y contratar servicios',
                            },
                            {
                              id: 'independent_pro' as const,
                              title: 'Freelancer / Trabajador independiente',
                              desc: 'Ofrecer servicios profesionales',
                            },
                            {
                              id: 'admin_request' as const,
                              title: 'Administrador',
                              desc: 'Solicitar acceso con validación',
                            },
                          ] as const
                        ).map((opt) => {
                          const selected = regRole === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              role="radio"
                              aria-checked={selected}
                              onClick={() => {
                                setRegRole(opt.id);
                                setRegError('');
                              }}
                              className={`text-left p-3 rounded-xl border transition-colors ${
                                selected
                                  ? 'border-[#214438] bg-[#214438]/8 dark:border-[#75836A] dark:bg-[#75836A]/18'
                                  : 'border-[#DBD4C6] dark:border-white/15 hover:bg-[#ECE7DC]/55 dark:hover:bg-white/5'
                              }`}
                            >
                              <div className="text-xs font-bold text-[#1D252C] dark:text-[#F7F3EA]">
                                {opt.title}
                              </div>
                              <div className="text-[11px] text-[#73766F] dark:text-[#A3A89F] mt-0.5">
                                {opt.desc}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {regError && (
                        <div
                          role="alert"
                          className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300"
                        >
                          {regError}
                        </div>
                      )}

                      <form onSubmit={handleStandardRegisterSubmit} className="space-y-4">
                        {regRole === 'admin_request' && (
                          <div className="p-3 rounded-xl bg-[#ECE7DC]/70 dark:bg-[#161C22] border border-[#C7582B]/35 text-xs text-[#1D252C] dark:text-[#F7F3EA] flex items-start gap-2.5">
                            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-[#C7582B]" />
                            <span>
                              Seleccionar <strong>Administrador</strong> inicia una solicitud de
                              acceso. Confirmar tu correo no otorga permisos administrativos; se
                              requiere autorización explícita posterior.
                            </span>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div>
                            <label htmlFor="reg-name" className="block text-xs font-semibold mb-1">
                              Nombre completo
                            </label>
                            <input
                              id="reg-name"
                              type="text"
                              required
                              value={regFullName}
                              onChange={(e) => setRegFullName(e.target.value)}
                              placeholder="Ej. Laura Hernández"
                              className="w-full px-3 py-2 text-sm rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22]"
                            />
                          </div>

                          <div>
                            <label htmlFor="reg-email" className="block text-xs font-semibold mb-1">
                              Correo electrónico
                            </label>
                            <input
                              id="reg-email"
                              type="email"
                              required
                              value={regEmail}
                              onChange={(e) => setRegEmail(e.target.value)}
                              placeholder="nombre@correo.com"
                              className="w-full px-3 py-2 text-sm rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22]"
                            />
                          </div>
                        </div>

                        {regRole === 'independent_pro' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                              <label htmlFor="reg-biz" className="block text-xs font-semibold mb-1">
                                Nombre o especialidad comercial (opcional)
                              </label>
                              <input
                                id="reg-biz"
                                type="text"
                                value={regCommercialName}
                                onChange={(e) => setRegCommercialName(e.target.value)}
                                placeholder="Ej. Electricidad Residencial Hernández"
                                className="w-full px-3 py-2 text-sm rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22]"
                              />
                            </div>
                            <div>
                              <label htmlFor="reg-cat" className="block text-xs font-semibold mb-1">
                                Categoría principal
                              </label>
                              <select
                                id="reg-cat"
                                value={regCategoryId}
                                onChange={(e) => setRegCategoryId(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22]"
                              >
                                {activeCategories.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}

                        {regRole === 'admin_request' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                              <span className="block text-xs font-semibold mb-1">
                                Nivel administrativo solicitado
                              </span>
                              <div className="w-full px-3 py-2 text-sm rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#ECE7DC]/40 dark:bg-[#161C22] font-semibold text-[#214438] dark:text-[#ECE7DC]">
                                Administrador Central
                              </div>
                            </div>
                            <div>
                              <label
                                htmlFor="reg-admin-region"
                                className="block text-xs font-semibold mb-1"
                              >
                                Región de referencia
                              </label>
                              <select
                                id="reg-admin-region"
                                value={adminRegionId}
                                onChange={(e) => {
                                  setAdminRegionId(e.target.value);
                                  const cols =
                                    db.regions.find((r) => r.id === e.target.value)?.colonias ||
                                    [];
                                  if (cols.length > 0) setRegColonia(cols[0]);
                                }}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22]"
                              >
                                {db.regions.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name} ({r.state})
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div>
                            <label
                              htmlFor="reg-colonia"
                              className="block text-xs font-semibold mb-1"
                            >
                              {regRole === 'admin_request'
                                ? 'Colonia de referencia'
                                : 'Colonia (Cuautitlán Izcalli)'}
                            </label>
                            <select
                              id="reg-colonia"
                              value={regColonia}
                              onChange={(e) => setRegColonia(e.target.value)}
                              className="w-full px-3 py-2 text-sm rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22]"
                            >
                              {(regRole === 'admin_request'
                                ? selectedAdminColonias
                                : clientProColonias
                              ).map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label
                              htmlFor="reg-password"
                              className="block text-xs font-semibold mb-1"
                            >
                              Contraseña (mín. 6 caracteres)
                            </label>
                            <input
                              id="reg-password"
                              type="password"
                              required
                              minLength={6}
                              value={regPassword}
                              onChange={(e) => setRegPassword(e.target.value)}
                              placeholder="Crea una contraseña segura"
                              className="w-full px-3 py-2 text-sm rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22]"
                            />
                          </div>
                        </div>

                        {regRole === 'client' && (
                          <p className="text-[11px] text-[#73766F] dark:text-[#A3A89F]">
                            Tu foto de perfil es opcional y podrás añadirla desde <strong>Mi perfil</strong> después de registrarte.
                          </p>
                        )}

                        {regRole === 'admin_request' && (
                          <div>
                            <label
                              htmlFor="reg-admin-justification"
                              className="block text-xs font-semibold mb-1"
                            >
                              Motivo o función administrativa solicitada
                            </label>
                            <textarea
                              id="reg-admin-justification"
                              required
                              minLength={10}
                              rows={2}
                              value={adminJustification}
                              onChange={(e) => setAdminJustification(e.target.value)}
                              placeholder="Indica tu rol operativo o motivo de solicitud para revisión de Administración Central..."
                              className="w-full px-3 py-2 text-sm rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22]"
                            />
                          </div>
                        )}

                        <button
                          type="submit"
                          className="w-full py-2.5 px-4 rounded-lg bg-[#214438] hover:bg-[#183329] text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
                        >
                          <UserPlus className="w-4 h-4" />
                          <span>
                            {regRole === 'admin_request'
                              ? 'Enviar solicitud y verificar correo'
                              : 'Registrarme en OFI CLICK'}
                          </span>
                        </button>
                      </form>
                    </>
                  )}

                  {/* Admin Step 2: Single-use OTP Email Verification */}
                  {adminStep === 'otp' && activeAdminRequest && (
                    <form onSubmit={handleVerifyAdminOtp} className="space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="font-display text-lg font-bold">
                          Verifica tu correo electrónico
                        </h2>
                        <span className="px-2.5 py-0.5 rounded bg-[#214438]/12 text-[#214438] dark:text-[#A8B89A] text-[11px] font-semibold">
                          Código de un solo uso
                        </span>
                      </div>

                      <p className="text-xs text-[#73766F] dark:text-[#A3A89F] leading-relaxed">
                        Preparamos un código de verificación de 6 dígitos para{' '}
                        <strong className="text-[#1D252C] dark:text-[#F7F3EA]">
                          {activeAdminRequest.email}
                        </strong>
                        . Ingresa el código dentro de los próximos 10 minutos para confirmar la
                        propiedad de tu correo.
                      </p>

                      {adminOtpError && (
                        <div
                          role="alert"
                          className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300"
                        >
                          {adminOtpError}
                        </div>
                      )}

                      <div>
                        <label
                          htmlFor="admin-otp-input"
                          className="block text-xs font-semibold mb-1.5"
                        >
                          Código de verificación (6 dígitos)
                        </label>
                        <input
                          id="admin-otp-input"
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          required
                          value={adminOtpInput}
                          onChange={(e) => setAdminOtpInput(e.target.value)}
                          placeholder="000000"
                          className="w-full px-3.5 py-2.5 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-base font-mono-num tracking-[0.25em] text-center"
                        />
                        {adminOtpAttemptsLeft !== null && (
                          <p className="mt-1 text-[11px] text-[#73766F]">
                            Intentos restantes: {adminOtpAttemptsLeft}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="submit"
                          className="flex-1 py-2.5 px-4 rounded-lg bg-[#214438] hover:bg-[#183329] text-white text-sm font-semibold transition-colors"
                        >
                          Confirmar correo
                        </button>
                        <button
                          type="button"
                          onClick={handleResendAdminOtp}
                          className="py-2.5 px-3.5 rounded-lg border border-[#DBD4C6] dark:border-white/15 text-xs font-semibold hover:bg-[#ECE7DC]/50"
                        >
                          Reenviar código
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setAdminStep('form')}
                        className="inline-flex items-center gap-1.5 text-xs text-[#73766F] hover:underline"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Volver al formulario
                      </button>
                    </form>
                  )}

                  {/* Admin Step 3: Email Verified, Pending Authorization (NEVER grants access) */}
                  {adminStep === 'pending' && activeAdminRequest && (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-[#214438]/10 dark:bg-[#75836A]/18 border border-[#75836A]/35 flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-[#214438] dark:text-[#A8B89A] shrink-0 mt-0.5" />
                        <div className="space-y-1 text-xs">
                          <h2 className="text-sm font-bold text-[#1D252C] dark:text-[#F7F3EA]">
                            Correo confirmado · Solicitud pendiente de autorización administrativa
                          </h2>
                          <p className="text-[#1D252C]/85 dark:text-[#F7F3EA]/85 leading-relaxed">
                            Registramos la solicitud de{' '}
                            <strong>{activeAdminRequest.fullName}</strong> (
                            {activeAdminRequest.email}) con estado{' '}
                            <strong>Pendiente de autorización</strong>.
                          </p>
                        </div>
                      </div>

                      <div className="p-4 rounded-xl bg-[#ECE7DC]/70 dark:bg-[#161C22] border border-[#DBD4C6] dark:border-white/10 text-xs space-y-1.5">
                        <p className="font-semibold text-[#1D252C] dark:text-[#F7F3EA]">
                          ¿Qué sigue?
                        </p>
                        <p className="text-[#73766F] dark:text-[#A3A89F] leading-relaxed">
                          Confirmar tu correo electrónico únicamente verifica la titularidad de la
                          dirección. No cuentas con acceso a paneles administrativos hasta que un
                          Administrador Central autorice explícitamente tu solicitud.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAdminStep('form');
                            setActiveAdminRequest(null);
                            switchMode('login');
                          }}
                          className="px-4 py-2.5 rounded-lg bg-[#214438] hover:bg-[#183329] text-white text-xs font-semibold transition-colors"
                        >
                          Volver a Iniciar sesión
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAdminStep('form');
                            setActiveAdminRequest(null);
                          }}
                          className="px-4 py-2.5 rounded-lg border border-[#DBD4C6] dark:border-white/15 text-xs font-semibold hover:bg-[#ECE7DC]/50"
                        >
                          Crear otra cuenta
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* MODE 3: RECUPERACIÓN DE CONTRASEÑA */}
              {mode === 'recovery' && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-xl font-bold flex items-center gap-2">
                      <KeyRound className="w-5 h-5 text-[#214438] dark:text-[#C7582B]" />
                      Recuperar contraseña
                    </h2>
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className="text-xs text-[#73766F] hover:underline"
                    >
                      Volver a acceso
                    </button>
                  </div>

                  {recError && (
                    <div
                      role="alert"
                      className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300"
                    >
                      {recError}
                    </div>
                  )}

                  {recMessage && (
                    <div className="p-3 rounded-lg bg-[#214438]/10 dark:bg-[#75836A]/20 border border-[#75836A]/35 text-xs text-[#1D252C] dark:text-[#F7F3EA]">
                      {recMessage}
                    </div>
                  )}

                  {recStep === 'email' && (
                    <form onSubmit={handleRequestRecovery} className="space-y-4">
                      <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">
                        Ingresa tu correo electrónico para preparar un código de recuperación de un
                        solo uso.
                      </p>
                      <div>
                        <label
                          htmlFor="access-rec-email"
                          className="block text-xs font-semibold mb-1.5"
                        >
                          Correo electrónico
                        </label>
                        <input
                          id="access-rec-email"
                          type="email"
                          required
                          value={recEmail}
                          onChange={(e) => setRecEmail(e.target.value)}
                          placeholder="tu@correo.com"
                          className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22]"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2.5 px-4 rounded-lg bg-[#214438] hover:bg-[#183329] text-white text-sm font-semibold transition-colors"
                      >
                        Solicitar código de recuperación
                      </button>
                    </form>
                  )}

                  {recStep === 'code' && (
                    <form onSubmit={handleValidateRecoveryCode} className="space-y-4">
                      <div>
                        <label
                          htmlFor="access-rec-code"
                          className="block text-xs font-semibold mb-1.5"
                        >
                          Código de recuperación (6 dígitos)
                        </label>
                        <input
                          id="access-rec-code"
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          required
                          value={recCode}
                          onChange={(e) => setRecCode(e.target.value)}
                          placeholder="000000"
                          className="w-full px-3.5 py-2.5 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22] text-base font-mono-num tracking-[0.25em] text-center"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="submit"
                          className="flex-1 py-2.5 px-4 rounded-lg bg-[#214438] hover:bg-[#183329] text-white text-sm font-semibold transition-colors"
                        >
                          Validar código
                        </button>
                        <button
                          type="button"
                          onClick={() => setRecStep('email')}
                          className="py-2.5 px-3 rounded-lg border border-[#DBD4C6] dark:border-white/15 text-xs font-semibold hover:bg-[#ECE7DC]/50"
                        >
                          Cambiar correo
                        </button>
                      </div>
                    </form>
                  )}

                  {recStep === 'new_password' && (
                    <form onSubmit={handleCompletePasswordReset} className="space-y-4">
                      <div>
                        <label
                          htmlFor="access-rec-pw1"
                          className="block text-xs font-semibold mb-1.5"
                        >
                          Nueva contraseña (mín. 6 caracteres)
                        </label>
                        <input
                          id="access-rec-pw1"
                          type="password"
                          required
                          minLength={6}
                          value={recNewPassword}
                          onChange={(e) => setRecNewPassword(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22]"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="access-rec-pw2"
                          className="block text-xs font-semibold mb-1.5"
                        >
                          Confirmar nueva contraseña
                        </label>
                        <input
                          id="access-rec-pw2"
                          type="password"
                          required
                          minLength={6}
                          value={recConfirmPassword}
                          onChange={(e) => setRecConfirmPassword(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#FFFDFA] dark:bg-[#161C22]"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2.5 px-4 rounded-lg bg-[#214438] hover:bg-[#183329] text-white text-sm font-semibold transition-colors"
                      >
                        Guardar nueva contraseña
                      </button>
                    </form>
                  )}

                  {recStep === 'done' && (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => {
                          setLoginEmail(recEmail);
                          setLoginPassword('');
                          switchMode('login');
                        }}
                        className="w-full py-2.5 px-4 rounded-lg bg-[#214438] hover:bg-[#183329] text-white text-sm font-semibold transition-colors"
                      >
                        Ir a Iniciar sesión
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Honest Local Prepared Email Outbox Inspector (only shown when prepared templates exist) */}
            {latestPreparedEmails.length > 0 && (
              <div
                data-testid="local-email-preview"
                className="rounded-xl border border-[#DBD4C6] dark:border-white/12 bg-[#FFFDFA] dark:bg-[#1A2128] p-4 text-xs space-y-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#214438] dark:text-[#C7582B]" />
                    <span className="font-bold">
                      Correos automáticos preparados (vista previa local)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPreviewDrawer((v) => !v)}
                    className="text-[#214438] dark:text-[#C7582B] font-semibold hover:underline"
                  >
                    {showPreviewDrawer ? 'Ocultar vista previa' : 'Ver plantilla preparada'}
                  </button>
                </div>
                <p className="text-[11px] text-[#73766F] dark:text-[#A3A89F]">
                  Sin proveedor de correo conectado todavía: estos mensajes están listos para
                  integración SMTP/transaccional y no se han enviado externamente.
                </p>

                {showPreviewDrawer && (
                  <div className="space-y-2 pt-1">
                    {latestPreparedEmails.map((em) => (
                      <div
                        key={em.id}
                        className="p-3 rounded-lg bg-[#ECE7DC]/65 dark:bg-[#161C22] border border-[#DBD4C6] dark:border-white/10 space-y-1"
                      >
                        <div className="flex flex-wrap justify-between gap-1 font-semibold">
                          <span>Asunto: {em.subject}</span>
                          <span className="text-[#73766F]">Para: {em.toEmail}</span>
                        </div>
                        <pre className="whitespace-pre-wrap font-sans text-[11px] text-[#1D252C]/85 dark:text-[#F7F3EA]/85 leading-relaxed">
                          {em.textBody}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className="border-t border-[#DBD4C6] dark:border-white/10 py-5 px-4 sm:px-6 text-xs text-[#73766F] dark:text-[#A3A89F]">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>© 2026 OFI CLICK México · Cuautitlán Izcalli, Estado de México</span>
          <span>Precios en MXN · Acceso seguro por rol autorizado</span>
        </div>
      </footer>

      {showLegalModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setShowLegalModal(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-[#FFFDFA] dark:bg-[#1A2128] border border-[#DBD4C6] dark:border-white/12 p-6 space-y-3 text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display font-bold text-lg">
              {showLegalModal === 'privacy' ? 'Aviso de Privacidad' : 'Términos de Uso'}
            </h3>
            <p className="text-xs text-[#73766F] dark:text-[#A3A89F] leading-relaxed">
              {showLegalModal === 'privacy'
                ? 'OFI CLICK resguarda tu fotografía frontal de perfil, correos y documentos privados conforme a los lineamientos de seguridad de la plataforma. Nunca publicamos tu dirección particular ni datos privados en búsquedas públicas.'
                : 'OFI CLICK conecta clientes y freelancers independientes en Cuautitlán Izcalli con cotizaciones transparentes en MXN y acuerdo de pago directo entre las partes.'}
            </p>
            <button
              type="button"
              onClick={() => setShowLegalModal(null)}
              className="px-4 py-2 rounded-lg bg-[#214438] hover:bg-[#183329] text-white text-xs font-semibold transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
