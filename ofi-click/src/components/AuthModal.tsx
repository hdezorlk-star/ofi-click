import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { useOfiClick } from '../context/OfiClickContext';
import { authService } from '../services/auth.service';
import { INITIAL_REGIONS } from '../adapters/local/seed-data';
import { GoogleAuthButton } from './GoogleAuthButton';
import { BrandLogo } from './BrandLogo';
import type { AdminAccessRequest, PreparedEmailRecord } from '../types/oficlick';

type RegisterRoleChoice = 'client' | 'independent_pro' | 'admin_request';

export const AuthModal: React.FC = () => {
  const {
    authModalOpen,
    authModalMode,
    pendingActionLabel,
    closeAuthModal,
    completeAuthSuccess,
    openAuthModal,
    refreshDb,
    db,
    notify,
  } = useOfiClick();

  const [email, setEmail] = useState('cliente@oficlick.mx');
  const [password, setPassword] = useState('local1234');
  const [showPassword, setShowPassword] = useState(false);

  // Register state
  const [regRole, setRegRole] = useState<RegisterRoleChoice>('client');
  const [fullName, setFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [colonia, setColonia] = useState('Centro Urbano');
  const [commercialName, setCommercialName] = useState('');
  const [categoryId, setCategoryId] = useState('cat-plomeria');

  // Admin access request state (Central Admin only)
  const [adminRegionId, setAdminRegionId] = useState('reg-izcalli');
  const [adminJustification, setAdminJustification] = useState('');
  const [adminStep, setAdminStep] = useState<'form' | 'otp' | 'pending'>('form');
  const [activeAdminRequest, setActiveAdminRequest] = useState<AdminAccessRequest | null>(null);
  const [adminOtpInput, setAdminOtpInput] = useState('');
  const [adminOtpError, setAdminOtpError] = useState('');

  // Multi-step password recovery state
  const [recStep, setRecStep] = useState<'email' | 'code' | 'new_password' | 'done'>('email');
  const [recEmail, setRecEmail] = useState('');
  const [recCode, setRecCode] = useState('');
  const [recNewPassword, setRecNewPassword] = useState('');
  const [recConfirmPassword, setRecConfirmPassword] = useState('');
  const [recMessage, setRecMessage] = useState('');

  // Prepared local email viewer state
  const [previewEmail, setPreviewEmail] = useState<PreparedEmailRecord | null>(null);
  const [showPreviewDrawer, setShowPreviewDrawer] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const regions = db.regions.length > 0 ? db.regions : INITIAL_REGIONS;
  const colonias = useMemo(() => {
    const targetRegion =
      regRole === 'admin_request'
        ? regions.find((r) => r.id === adminRegionId) || regions[0]
        : regions[0];
    return targetRegion?.colonias || INITIAL_REGIONS[0].colonias;
  }, [adminRegionId, regRole, regions]);

  if (!authModalOpen) return null;

  const latestPreparedEmails = previewEmail
    ? [previewEmail]
    : db.preparedEmails.slice(0, 2);

  const resetMessages = () => {
    setErrorMsg('');
    setAdminOtpError('');
    setRecMessage('');
  };

  const switchTab = (nextMode: 'login' | 'register' | 'recovery' | 'admin') => {
    resetMessages();
    if (nextMode === 'register') {
      setAdminStep('form');
      setActiveAdminRequest(null);
    }
    if (nextMode === 'recovery') {
      setRecStep('email');
      setRecCode('');
      setRecNewPassword('');
      setRecConfirmPassword('');
    }
    openAuthModal(nextMode);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const profile = await authService.signInWithEmail(email, password);
      if (
        authModalMode === 'admin' &&
        !profile.roles.includes('central_admin')
      ) {
        authService.signOut();
        setErrorMsg('Esta cuenta no tiene permisos administrativos autorizados.');
        return;
      }
      completeAuthSuccess(profile);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al iniciar sesión.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (regRole === 'admin_request') {
      try {
        const res = authService.submitAdminAccessRequest({
          fullName,
          email: regEmail,
          regionId: adminRegionId,
          colonia,
          requestedScope: 'central_admin',
          justification: adminJustification,
          password: regPassword,
        });
        setActiveAdminRequest(res.request);
        setPreviewEmail(res.verificationEmail);
        setShowPreviewDrawer(true);
        setAdminOtpInput('');
        setAdminOtpError('');
        setAdminStep('otp');
        refreshDb();
        notify('Solicitud administrativa registrada. Verifica el código OTP preparado abajo.', 'info');
      } catch (err) {
        setErrorMsg(
          err instanceof Error ? err.message : 'No se pudo registrar la solicitud administrativa.'
        );
      }
      return;
    }

    try {
      const { profile, welcomeEmail } = await authService.registerAccount({
        fullName,
        email: regEmail,
        password: regPassword,
        colonia,
        accountType: regRole,
        commercialName:
          regRole === 'independent_pro' && commercialName.trim()
            ? commercialName.trim()
            : undefined,
        categoryId: regRole === 'independent_pro' ? categoryId : undefined,
      });
      setPreviewEmail(welcomeEmail);
      notify(
        'Cuenta creada exitosamente. Revisa tu correo para confirmar tu registro.',
        'success'
      );
      completeAuthSuccess(profile);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo completar el registro.');
    }
  };

  const handleVerifyAdminOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAdminRequest) return;
    setAdminOtpError('');
    const res = authService.verifyAdminRequestOtp(activeAdminRequest.id, adminOtpInput);
    if (!res.verified || !res.request) {
      setAdminOtpError(res.error || 'Código inválido.');
      return;
    }
    setActiveAdminRequest(res.request);
    setAdminStep('pending');
    refreshDb();
    notify('Correo verificado. Ahora espera autorización o inicializa el acceso local de prototipo.', 'success');
  };

  const handleResendAdminOtp = () => {
    if (!activeAdminRequest) return;
    setAdminOtpError('');
    try {
      const res = authService.resendAdminVerificationCode(activeAdminRequest.id);
      setActiveAdminRequest(res.request);
      setPreviewEmail(res.verificationEmail);
      setShowPreviewDrawer(true);
      refreshDb();
      notify('Nuevo código OTP preparado en vista previa local.', 'info');
    } catch (err) {
      setAdminOtpError(err instanceof Error ? err.message : 'No se pudo reenviar el código.');
    }
  };

  const handleInitializeLocalAdmin = () => {
    if (!activeAdminRequest) return;
    setErrorMsg('');
    try {
      const { profile } = authService.initializeLocalDemoAdmin(activeAdminRequest.id);
      notify(
        `Acceso administrativo local inicializado para ${profile.fullName}.`,
        'success'
      );
      completeAuthSuccess(profile);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo inicializar el administrador local.'
      );
    }
  };

  const handleRequestRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setRecMessage('');
    try {
      const res = await authService.requestPasswordRecovery(recEmail);
      setRecMessage(res.message);
      if (res.preparedEmail) {
        setPreviewEmail(res.preparedEmail);
        setShowPreviewDrawer(true);
      }
      setRecStep('code');
      refreshDb();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Correo inválido.');
    }
  };

  const handleValidateRecoveryCode = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const check = authService.validatePasswordRecoveryCode(recEmail, recCode);
    if (!check.valid) {
      setErrorMsg(check.error || 'Código inválido o expirado.');
      return;
    }
    setRecStep('new_password');
  };

  const handleCompletePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (recNewPassword !== recConfirmPassword) {
      setErrorMsg('Las contraseñas no coinciden.');
      return;
    }
    try {
      const res = await authService.completePasswordReset(recEmail, recCode, recNewPassword);
      setRecMessage(res.message);
      setRecStep('done');
      refreshDb();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo actualizar la contraseña.');
    }
  };

  const quickAccounts = [
    { label: 'Cliente', email: 'cliente@oficlick.mx' },
    { label: 'Plomera freelancer', email: 'plomero@oficlick.mx' },
    { label: 'Electricista freelancer', email: 'carlos.elec@oficlick.mx' },
    { label: 'Admin Central', email: 'admin@oficlick.mx' },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#FFFCF7] dark:bg-[#222825] border border-[#DDD5C8] dark:border-white/10 shadow-2xl p-6 my-8 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <BrandLogo variant="icon" size="lg" />
            <div className="min-w-0">
              <h2
                id="auth-modal-title"
                className="font-display text-xl font-bold text-[#252A27] dark:text-[#F5F1E8]"
              >
                {authModalMode === 'register'
                  ? 'Crear cuenta en OFI CLICK'
                  : authModalMode === 'recovery'
                  ? 'Recuperar acceso'
                  : authModalMode === 'admin'
                  ? 'Acceso administrativo autorizado'
                  : 'Iniciar sesión en OFI CLICK'}
              </h2>
              {pendingActionLabel && (
                <p className="mt-1 text-xs text-[#304B3E] dark:text-[#75836A] font-medium">
                  Inicia sesión o regístrate para {pendingActionLabel}. Al entrar continuarás automáticamente.
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={closeAuthModal}
            aria-label="Cerrar ventana de acceso"
            className="p-2 rounded-lg text-[#73766F] hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {authModalMode !== 'admin' && authModalMode !== 'recovery' && (
          <div className="mt-4 grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#EAE3D6] dark:bg-black/30">
            <button
              type="button"
              onClick={() => switchTab('login')}
              className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                authModalMode === 'login'
                  ? 'bg-[#FFFCF7] dark:bg-[#222825] text-[#252A27] dark:text-white shadow-xs'
                  : 'text-[#73766F]'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => switchTab('register')}
              className={`py-2 text-xs font-semibold rounded-lg transition-colors ${
                authModalMode === 'register'
                  ? 'bg-[#FFFCF7] dark:bg-[#222825] text-[#252A27] dark:text-white shadow-xs'
                  : 'text-[#73766F]'
              }`}
            >
              Registrarse
            </button>
          </div>
        )}

        {errorMsg && (
          <div
            role="alert"
            className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300"
          >
            {errorMsg}
          </div>
        )}

        {recMessage && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-200">
            {recMessage}
          </div>
        )}

        {(authModalMode === 'login' || authModalMode === 'admin') && (
          <form onSubmit={handleLogin} className="mt-4 space-y-4">
            {authModalMode === 'login' && (
              <GoogleAuthButton intent="login" separatorLabel="o ingresa con tu correo" />
            )}

            {authModalMode === 'admin' && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Portal operativo de Administrador Central. En producción los permisos administrativos se validan en el servidor mediante Supabase Auth y RLS.
                </span>
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="block text-xs font-medium text-[#252A27] dark:text-[#F5F1E8] mb-1"
              >
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#73766F] absolute left-3 top-3" />
                <input
                  id="auth-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-black/20 focus:outline-2 focus:outline-[#304B3E]"
                  placeholder="tu@correo.com"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="block text-xs font-medium text-[#252A27] dark:text-[#F5F1E8] mb-1"
              >
                Contraseña
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#73766F] absolute left-3 top-3" />
                <input
                  id="auth-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-10 py-2.5 text-sm rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-black/20 focus:outline-2 focus:outline-[#304B3E]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  className="absolute right-2.5 top-2.5 p-1 text-[#73766F] hover:text-[#252A27] dark:hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl bg-[#304B3E] hover:bg-[#243A30] text-white text-sm font-semibold transition-colors"
            >
              Entrar a mi cuenta
            </button>

            {import.meta.env.DEV && (
              <div className="pt-2 border-t border-[#DDD5C8] dark:border-white/10">
                <p className="text-[11px] text-[#73766F] mb-2">
                  Accesos rápidos locales (solo desarrollo):
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {quickAccounts.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => {
                        setEmail(acc.email);
                        setPassword('local1234');
                      }}
                      className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-[#EAE3D6] dark:bg-white/10 hover:bg-[#304B3E]/15 text-[#252A27] dark:text-[#F5F1E8]"
                    >
                      {acc.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => {
                  setRecEmail(email);
                  switchTab('recovery');
                }}
                className="text-[#304B3E] dark:text-[#75836A] font-medium hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
              {authModalMode === 'login' ? (
                <button
                  type="button"
                  onClick={() => {
                    setEmail('');
                    setPassword('');
                    switchTab('admin');
                  }}
                  className="text-[#73766F] hover:text-[#252A27] dark:hover:text-white"
                >
                  Acceso operativo / Admin
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => switchTab('login')}
                  className="text-[#304B3E] dark:text-[#75836A] hover:underline"
                >
                  Volver al acceso general
                </button>
              )}
            </div>
          </form>
        )}

        {authModalMode === 'register' && (
          <div className="mt-4 space-y-4">
            {!(regRole === 'admin_request' && adminStep !== 'form') && (
              <form onSubmit={handleRegister} className="space-y-3.5">
                {regRole !== 'admin_request' && (
                  <GoogleAuthButton
                    intent="register"
                    separatorLabel="o crea tu cuenta con correo"
                  />
                )}
                <div>
                  <span className="block text-xs font-semibold mb-1.5">
                    Tipo de cuenta
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'client' as const, title: 'Cliente', desc: 'Contratar servicios' },
                      { id: 'independent_pro' as const, title: 'Freelancer', desc: 'Ofrecer servicios' },
                      { id: 'admin_request' as const, title: 'Admin central', desc: 'Gestión operativa' },
                    ].map((opt) => {
                      const active = regRole === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setRegRole(opt.id);
                            setErrorMsg('');
                          }}
                          className={`p-2.5 rounded-xl border text-left transition-colors ${
                            active
                              ? 'border-[#304B3E] bg-[#304B3E]/10 dark:border-[#75836A] dark:bg-[#75836A]/20'
                              : 'border-[#DDD5C8] dark:border-white/15 hover:bg-[#EAE3D6]/50 dark:hover:bg-white/5'
                          }`}
                        >
                          <div className="text-xs font-bold">{opt.title}</div>
                          <div className="text-[10px] text-[#73766F] dark:text-[#A3A89F]">
                            {opt.desc}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-name" className="block text-xs font-medium mb-1">
                    Nombre completo *
                  </label>
                  <input
                    id="reg-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Ej. Laura Hernández"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-black/20"
                  />
                </div>

                {regRole === 'independent_pro' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="reg-biz" className="block text-xs font-medium mb-1">
                        Nombre comercial (opcional)
                      </label>
                      <input
                        id="reg-biz"
                        type="text"
                        value={commercialName}
                        onChange={(e) => setCommercialName(e.target.value)}
                        placeholder="Ej. Electricidad Hernández"
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-black/20"
                      />
                    </div>
                    <div>
                      <label htmlFor="reg-cat" className="block text-xs font-medium mb-1">
                        Categoría principal
                      </label>
                      <select
                        id="reg-cat"
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-black/20"
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
                  </div>
                )}

                {regRole === 'admin_request' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40">
                    <div>
                      <span className="block text-xs font-medium mb-1">
                        Nivel solicitado
                      </span>
                      <div className="px-3 py-2 text-sm rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#1C211E] font-semibold text-[#304B3E] dark:text-[#EAE3D6]">
                        Administrador Central
                      </div>
                    </div>
                    <div>
                      <label htmlFor="reg-admin-region" className="block text-xs font-medium mb-1">
                        Región de referencia
                      </label>
                      <select
                        id="reg-admin-region"
                        value={adminRegionId}
                        onChange={(e) => setAdminRegionId(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#1C211E]"
                      >
                        {regions.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="reg-email" className="block text-xs font-medium mb-1">
                      Correo electrónico *
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="nombre@correo.com"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-black/20"
                    />
                  </div>
                  <div>
                    <label htmlFor="reg-colonia" className="block text-xs font-medium mb-1">
                      Colonia
                    </label>
                    <select
                      id="reg-colonia"
                      value={colonia}
                      onChange={(e) => setColonia(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-black/20"
                    >
                      {colonias.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-password" className="block text-xs font-medium mb-1">
                    Contraseña (mín. 6 caracteres) *
                  </label>
                  <input
                    id="reg-password"
                    type="password"
                    required
                    minLength={6}
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="Crea una contraseña segura"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-black/20"
                  />
                </div>

                {regRole === 'admin_request' && (
                  <div>
                    <label htmlFor="reg-admin-just" className="block text-xs font-medium mb-1">
                      Motivo o función administrativa solicitada *
                    </label>
                    <textarea
                      id="reg-admin-just"
                      required
                      minLength={10}
                      rows={2}
                      value={adminJustification}
                      onChange={(e) => setAdminJustification(e.target.value)}
                      placeholder="Ej. Supervisión de verificaciones, catálogo y moderación en OFI CLICK."
                      className="w-full px-3 py-2 text-sm rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-black/20"
                    />
                  </div>
                )}

                {regRole === 'client' && (
                  <p className="text-[11px] text-[#73766F] dark:text-[#A3A89F]">
                    Tu foto de perfil es opcional y podrás añadirla en cualquier momento desde la pestaña <strong>Mi perfil</strong>.
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-[#304B3E] hover:bg-[#243A30] text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
                >
                  <UserCheck className="w-4 h-4" />
                  {regRole === 'admin_request'
                    ? 'Enviar solicitud administrativa y verificar correo'
                    : 'Registrarme en OFI CLICK'}
                </button>
              </form>
            )}

            {regRole === 'admin_request' && adminStep === 'otp' && activeAdminRequest && (
              <form onSubmit={handleVerifyAdminOtp} className="space-y-4">
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800 text-xs text-amber-950 dark:text-amber-100 space-y-1">
                  <p className="font-bold">Paso 2 · Verificación de correo electrónico (OTP)</p>
                  <p>
                    Ingresa el código de 6 dígitos preparado para{' '}
                    <strong>{activeAdminRequest.email}</strong> (disponible abajo en la vista previa local).
                  </p>
                </div>

                {adminOtpError && (
                  <div
                    role="alert"
                    className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300"
                  >
                    {adminOtpError}
                  </div>
                )}

                <div>
                  <label htmlFor="modal-admin-otp" className="block text-xs font-semibold mb-1.5">
                    Código de verificación (6 dígitos)
                  </label>
                  <input
                    id="modal-admin-otp"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={adminOtpInput}
                    onChange={(e) => setAdminOtpInput(e.target.value)}
                    placeholder="000000"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#1C211E] text-base font-mono-num tracking-[0.25em] text-center"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-4 rounded-lg bg-[#304B3E] hover:bg-[#243A30] text-white text-sm font-semibold transition-colors"
                  >
                    Confirmar código OTP
                  </button>
                  <button
                    type="button"
                    onClick={handleResendAdminOtp}
                    className="px-3.5 py-2.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 text-xs font-semibold inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Reenviar
                  </button>
                </div>
              </form>
            )}

            {regRole === 'admin_request' && adminStep === 'pending' && activeAdminRequest && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-950 dark:text-emerald-100 space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Correo verificado · Estado: pendiente de autorización</span>
                  </div>
                  <p>
                    En producción, un <strong>Administrador Central</strong> debe aprobar esta solicitud antes de asignar privilegios administrativos en Supabase RLS.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-[#304B3E]/25 bg-[#EAE3D6]/50 dark:bg-[#1C211E] space-y-2.5 text-xs">
                  <div className="flex items-center gap-2 font-bold text-[#304B3E] dark:text-[#B96F50]">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Inicialización local para prototipo / exposición</span>
                  </div>
                  <p className="text-[#73766F] dark:text-[#A3A89F]">
                    Como estás probando el prototipo local sin servidor Supabase conectado, puedes inicializar tu acceso como{' '}
                    <strong>Administrador Central</strong>{' '}
                    de forma auditada para evaluar el panel operativo de inmediato.
                  </p>
                  <button
                    type="button"
                    data-testid="init-local-admin-btn"
                    onClick={handleInitializeLocalAdmin}
                    className="w-full py-2.5 px-4 rounded-lg bg-[#304B3E] hover:bg-[#243A30] text-white text-xs font-semibold transition-colors"
                  >
                    Inicializar acceso administrativo local (prototipo)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {authModalMode === 'recovery' && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold flex items-center gap-1.5 text-[#304B3E] dark:text-[#B96F50]">
                <KeyRound className="w-4 h-4" />
                Restablecer contraseña
              </span>
              <button
                type="button"
                onClick={() => switchTab('login')}
                className="text-[#73766F] hover:underline"
              >
                Volver a iniciar sesión
              </button>
            </div>

            {recStep === 'email' && (
              <form onSubmit={handleRequestRecovery} className="space-y-4">
                <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">
                  Ingresa tu correo para preparar un código temporal de recuperación en entorno local.
                </p>
                <div>
                  <label htmlFor="rec-email" className="block text-xs font-medium mb-1">
                    Correo electrónico
                  </label>
                  <input
                    id="rec-email"
                    type="email"
                    required
                    value={recEmail}
                    onChange={(e) => setRecEmail(e.target.value)}
                    placeholder="tu@correo.com"
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-black/20"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-lg bg-[#304B3E] hover:bg-[#243A30] text-white text-sm font-semibold transition-colors"
                >
                  Solicitar código de recuperación
                </button>
              </form>
            )}

            {recStep === 'code' && (
              <form onSubmit={handleValidateRecoveryCode} className="space-y-4">
                <div>
                  <label htmlFor="rec-code" className="block text-xs font-medium mb-1">
                    Código de recuperación (6 dígitos)
                  </label>
                  <input
                    id="rec-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={recCode}
                    onChange={(e) => setRecCode(e.target.value)}
                    placeholder="000000"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#1C211E] text-base font-mono-num tracking-[0.25em] text-center"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-4 rounded-lg bg-[#304B3E] hover:bg-[#243A30] text-white text-sm font-semibold transition-colors"
                  >
                    Validar código
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecStep('email')}
                    className="px-3 py-2.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 text-xs font-semibold"
                  >
                    Cambiar correo
                  </button>
                </div>
              </form>
            )}

            {recStep === 'new_password' && (
              <form onSubmit={handleCompletePasswordReset} className="space-y-4">
                <div>
                  <label htmlFor="rec-pw1" className="block text-xs font-medium mb-1">
                    Nueva contraseña (mín. 6 caracteres)
                  </label>
                  <input
                    id="rec-pw1"
                    type="password"
                    required
                    minLength={6}
                    value={recNewPassword}
                    onChange={(e) => setRecNewPassword(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-black/20"
                  />
                </div>
                <div>
                  <label htmlFor="rec-pw2" className="block text-xs font-medium mb-1">
                    Confirmar nueva contraseña
                  </label>
                  <input
                    id="rec-pw2"
                    type="password"
                    required
                    minLength={6}
                    value={recConfirmPassword}
                    onChange={(e) => setRecConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-black/20"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-lg bg-[#304B3E] hover:bg-[#243A30] text-white text-sm font-semibold transition-colors"
                >
                  Guardar nueva contraseña
                </button>
              </form>
            )}

            {recStep === 'done' && (
              <button
                type="button"
                onClick={() => {
                  setEmail(recEmail);
                  setPassword('');
                  switchTab('login');
                }}
                className="w-full py-2.5 px-4 rounded-lg bg-[#304B3E] hover:bg-[#243A30] text-white text-sm font-semibold transition-colors"
              >
                Ir a Iniciar sesión
              </button>
            )}
          </div>
        )}

        {/* Honest Local Prepared Email Outbox Preview (for OTP / Recovery verification in local prototype) */}
        {(authModalMode === 'register' || authModalMode === 'recovery') &&
          latestPreparedEmails.length > 0 && (
            <div className="mt-4 pt-3 border-t border-[#DDD5C8] dark:border-white/10 text-xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[#304B3E] dark:text-[#B96F50] flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  Plantilla preparada (solo entorno local, sin envío SMTP)
                </span>
                <button
                  type="button"
                  onClick={() => setShowPreviewDrawer((v) => !v)}
                  className="text-[11px] font-semibold underline"
                >
                  {showPreviewDrawer ? 'Ocultar' : 'Ver código/correo'}
                </button>
              </div>
              {showPreviewDrawer && (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {latestPreparedEmails.map((em) => (
                    <div
                      key={em.id}
                      className="p-2.5 rounded-lg bg-[#EAE3D6]/70 dark:bg-[#1C211E] border border-[#DDD5C8] dark:border-white/10 space-y-1"
                    >
                      <div className="font-semibold text-[11px]">
                        Asunto: {em.subject} · Para: {em.toEmail}
                      </div>
                      <pre className="whitespace-pre-wrap font-sans text-[11px] text-[#252A27]/85 dark:text-[#F5F1E8]/85">
                        {em.textBody}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  );
};
