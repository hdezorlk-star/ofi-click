import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react';
import { useOfiClick } from '../context/OfiClickContext';
import { requestsService } from '../services/requests.service';
import { findCompatibleProfessionals, formatMXN } from '../utils/marketplace';
import type { RequestDistributionMode, UrgencyLevel } from '../types/oficlick';

interface RequestWizardPageProps {
  preselectedProId?: string;
  preselectedCategoryId?: string;
}

export const RequestWizardPage: React.FC<RequestWizardPageProps> = ({
  preselectedProId,
  preselectedCategoryId,
}) => {
  const { db, currentUser, navigate, requireAuth, notify, refreshDb } = useOfiClick();

  const preselectedPro = useMemo(
    () => db.professionals.find((p) => p.id === preselectedProId),
    [db.professionals, preselectedProId]
  );

  const activeCategories = useMemo(
    () => db.categories.filter((c) => c.active).sort((a, b) => a.sortOrder - b.sortOrder),
    [db.categories]
  );

  const izcalliColonias = useMemo(() => {
    const reg = db.regions.find((r) => r.id === 'reg-izcalli');
    return reg?.colonias || ['Centro Urbano', 'Ensueños', 'Atlanta', 'Cumbre Norte'];
  }, [db.regions]);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [categoryId, setCategoryId] = useState<string>(
    preselectedCategoryId ||
      preselectedPro?.categoryIds[0] ||
      activeCategories[0]?.id ||
      'cat-plomeria'
  );
  const [serviceId, setServiceId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [colonia, setColonia] = useState<string>(
    currentUser?.colonia || preselectedPro?.primaryColonia || izcalliColonias[0]
  );
  const [privateAddress, setPrivateAddress] = useState('');
  const [desiredDate, setDesiredDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [desiredTimeSlot, setDesiredTimeSlot] = useState('10:00 - 13:00');
  const [urgency, setUrgency] = useState<UrgencyLevel>('normal');
  const [optionalBudget, setOptionalBudget] = useState('');
  const [requiresHomeService, setRequiresHomeService] = useState(true);
  const [preferences, setPreferences] = useState('');

  const [distributionMode, setDistributionMode] = useState<RequestDistributionMode>(
    preselectedPro ? 'manual' : 'recommended'
  );
  const [selectedProIds, setSelectedProIds] = useState<string[]>(
    preselectedPro ? [preselectedPro.id] : []
  );

  const categoryServices = useMemo(
    () =>
      db.services.filter(
        (s) =>
          s.status === 'published' &&
          s.categoryId === categoryId &&
          (!preselectedPro || s.professionalId === preselectedPro.id)
      ),
    [db.services, categoryId, preselectedPro]
  );

  // ALL compatible professionals with NO fixed 3/5/10 cap
  const compatiblePros = useMemo(() => {
    return findCompatibleProfessionals(db.professionals, {
      categoryId,
      colonia,
      regionId: 'reg-izcalli',
      urgency,
      requiresHomeService,
    });
  }, [db.professionals, categoryId, colonia, urgency, requiresHomeService]);

  const allPublishedPros = useMemo(
    () => db.professionals.filter((p) => p.published && p.profileComplete && !p.pausedByAdmin),
    [db.professionals]
  );

  // Sync recommended selection whenever user toggles to 'recommended' or parameters change
  useEffect(() => {
    if (distributionMode === 'recommended') {
      setSelectedProIds(compatiblePros.map((p) => p.id));
    }
  }, [distributionMode, compatiblePros]);

  const toggleRecipient = (proId: string) => {
    setSelectedProIds((prev) =>
      prev.includes(proId) ? prev.filter((id) => id !== proId) : [...prev, proId]
    );
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validNames = files
      .filter((f) => f.size <= 5 * 1024 * 1024)
      .map((f) => f.name);
    if (validNames.length < files.length) {
      notify('Algunas imágenes superan 5 MB y fueron omitidas.', 'error');
    }
    setPhotos((prev) => [...prev, ...validNames]);
    e.target.value = '';
  };

  const handleConfirmSend = () => {
    if (selectedProIds.length === 0) {
      notify('Selecciona al menos un freelancer o profesional para enviar tu solicitud.', 'error');
      return;
    }
    requireAuth('enviar tu solicitud de servicio en Cuautitlán Izcalli', (authedUser) => {
      try {
        requestsService.createServiceRequest({
          clientId: authedUser.id,
          regionId: 'reg-izcalli',
          categoryId,
          serviceId: serviceId || undefined,
          title: title.trim(),
          description: description.trim(),
          photos,
          colonia,
          privateAddress: privateAddress.trim() || `Referencia privada en Col. ${colonia}`,
          desiredDate,
          desiredTimeSlot,
          urgency,
          optionalBudgetMxn: optionalBudget ? Number(optionalBudget) : undefined,
          preferences: preferences.trim() || 'Sin preferencias adicionales',
          requiresHomeService,
          distributionMode,
          recipientProfessionalIds: selectedProIds,
        });
        refreshDb();
        notify(
          `Solicitud enviada a ${selectedProIds.length} ${
            selectedProIds.length === 1 ? 'profesional' : 'profesionales'
          }.`,
          'success'
        );
        navigate({ page: 'client-panel', tab: 'solicitudes' });
      } catch (err) {
        notify(err instanceof Error ? err.message : 'No se pudo enviar la solicitud.', 'error');
      }
    });
  };

  const candidateList = distributionMode === 'recommended' ? compatiblePros : allPublishedPros;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate({ page: 'explore' })}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#73766F] hover:text-[#252A27] dark:hover:text-[#F5F1E8] mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Volver a explorar profesionales
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#252A27] dark:text-[#F5F1E8]">
            Solicitar servicio en Cuautitlán Izcalli
          </h1>
          <p className="text-sm text-[#73766F] dark:text-[#A3A89F] mt-1">
            Recibe cotizaciones detalladas y acuerda directamente con especialistas verificados.
          </p>
        </div>

        {/* Stepper Indicator */}
        <div className="flex items-center gap-2 text-xs font-semibold">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`px-3 py-1.5 rounded-lg border ${
                step === n
                  ? 'bg-[#304B3E] text-white border-[#304B3E] dark:bg-[#75836A] dark:border-[#75836A]'
                  : step > n
                  ? 'bg-[#75836A]/20 text-[#304B3E] dark:text-[#F5F1E8] border-[#75836A]'
                  : 'border-[#DDD5C8] dark:border-white/15 text-[#73766F]'
              }`}
            >
              Paso {n}
            </div>
          ))}
        </div>
      </div>

      {/* Step 1: Service & Location */}
      {step === 1 && (
        <div className="rounded-2xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-6 space-y-5 shadow-xs">
          <h2 className="text-lg font-bold text-[#252A27] dark:text-[#F5F1E8]">
            1. ¿Qué necesitas resolver?
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#252A27] dark:text-[#F5F1E8] mb-1.5">
                Categoría del servicio
              </label>
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setServiceId('');
                }}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#1C211E] text-sm"
              >
                {activeCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#252A27] dark:text-[#F5F1E8] mb-1.5">
                Servicio específico del catálogo (opcional)
              </label>
              <select
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value);
                  const found = categoryServices.find((s) => s.id === e.target.value);
                  if (found && !title) setTitle(found.name);
                }}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#1C211E] text-sm"
              >
                <option value="">Servicio personalizado / diagnóstico</option>
                {categoryServices.map((srv) => (
                  <option key={srv.id} value={srv.id}>
                    {srv.name} {srv.priceAmount ? `(${formatMXN(srv.priceAmount)})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#252A27] dark:text-[#F5F1E8] mb-1.5">
              Título breve de tu solicitud *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Fuga en tubería bajo tarja de cocina"
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#1C211E] text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#252A27] dark:text-[#F5F1E8] mb-1.5">
              Descripción detallada *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe el problema, medidas aproximadas, acceso o si ya cuentas con material..."
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#1C211E] text-sm"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#252A27] dark:text-[#F5F1E8] mb-1.5">
                Colonia en Cuautitlán Izcalli *
              </label>
              <select
                value={colonia}
                onChange={(e) => setColonia(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#1C211E] text-sm"
              >
                {izcalliColonias.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#252A27] dark:text-[#F5F1E8] mb-1.5">
                Dirección exacta (privada, solo visible al aceptar cita)
              </label>
              <input
                type="text"
                value={privateAddress}
                onChange={(e) => setPrivateAddress(e.target.value)}
                placeholder="Calle, número exterior/interior y referencias"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#1C211E] text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#252A27] dark:text-[#F5F1E8] mb-1.5">
              Fotos de referencia (opcional, máx. 5 MB por archivo)
            </label>
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-[#B96F50]/60 cursor-pointer text-xs font-medium hover:bg-[#EAE3D6]/50 dark:hover:bg-white/5">
              <Upload className="w-4 h-4 text-[#B96F50]" />
              <span>Adjuntar fotos del espacio o falla</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </label>
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {photos.map((name, i) => (
                  <span
                    key={`${name}-${i}`}
                    className="px-2.5 py-1 rounded bg-[#EAE3D6] dark:bg-[#1C211E] text-xs"
                  >
                    {name}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => {
                if (!title.trim() || !description.trim()) {
                  notify('Completa el título y la descripción para continuar.', 'error');
                  return;
                }
                setStep(2);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#304B3E] hover:bg-[#243A30] text-white text-sm font-semibold transition-colors"
            >
              Continuar a fecha y urgencia
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Schedule, Urgency, Budget */}
      {step === 2 && (
        <div className="rounded-2xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-6 space-y-5 shadow-xs">
          <h2 className="text-lg font-bold text-[#252A27] dark:text-[#F5F1E8]">
            2. Fecha deseada, urgencia y presupuesto
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5">Fecha deseada</label>
              <input
                type="date"
                value={desiredDate}
                onChange={(e) => setDesiredDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#1C211E] text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5">Franja horaria</label>
              <select
                value={desiredTimeSlot}
                onChange={(e) => setDesiredTimeSlot(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#1C211E] text-sm"
              >
                <option value="09:00 - 12:00">Mañana (09:00 - 12:00)</option>
                <option value="10:00 - 13:00">Media mañana (10:00 - 13:00)</option>
                <option value="13:00 - 16:00">Tarde temprana (13:00 - 16:00)</option>
                <option value="16:00 - 19:00">Tarde (16:00 - 19:00)</option>
                <option value="Horario flexible">Horario flexible</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5">Nivel de urgencia</label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'normal', label: 'Normal' },
                    { id: 'soon', label: 'Pronto (48h)' },
                    { id: 'urgent', label: 'Urgente hoy' },
                  ] as const
                ).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setUrgency(u.id)}
                    className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                      urgency === u.id
                        ? 'bg-[#304B3E] text-white border-[#304B3E] dark:bg-[#75836A]'
                        : 'border-[#DDD5C8] dark:border-white/15'
                    }`}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5">
                Presupuesto orientativo en MXN (opcional)
              </label>
              <input
                type="number"
                min={0}
                value={optionalBudget}
                onChange={(e) => setOptionalBudget(e.target.value)}
                placeholder="Ej. 1500"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#1C211E] text-sm"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-sm font-medium cursor-pointer">
            <input
              type="checkbox"
              checked={requiresHomeService}
              onChange={(e) => setRequiresHomeService(e.target.checked)}
            />
            Requiere atención presencial a domicilio en {colonia}
          </label>

          <div>
            <label className="block text-xs font-semibold mb-1.5">
              Preferencias adicionales (opcional)
            </label>
            <input
              type="text"
              value={preferences}
              onChange={(e) => setPreferences(e.target.value)}
              placeholder="Ej. Prefiero facturación, materiales incluidos o visita diagnóstica previa"
              className="w-full px-3.5 py-2.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#1C211E] text-sm"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 text-sm font-medium"
            >
              Atrás
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#304B3E] hover:bg-[#243A30] text-white text-sm font-semibold transition-colors"
            >
              Elegir profesionales destinatarios
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Manual vs OFI CLICK Compatible Recommendation (NO arbitrary limit!) */}
      {step === 3 && (
        <div className="rounded-2xl border border-[#DDD5C8] dark:border-white/12 bg-[#FFFCF7] dark:bg-[#222825] p-6 space-y-5 shadow-xs">
          <div>
            <h2 className="text-lg font-bold text-[#252A27] dark:text-[#F5F1E8]">
              3. Selecciona quién recibe tu solicitud
            </h2>
            <p className="text-xs text-[#73766F] dark:text-[#A3A89F] mt-1">
              Puedes usar la recomendación automática de OFI CLICK (muestra a todos los especialistas
              compatibles en {colonia} sin límite fijo) o elegir manualmente.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDistributionMode('recommended')}
              className={`p-4 rounded-xl border text-left transition-colors ${
                distributionMode === 'recommended'
                  ? 'border-[#304B3E] bg-[#304B3E]/8 dark:border-[#B96F50] dark:bg-[#1C211E]'
                  : 'border-[#DDD5C8] dark:border-white/12'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-sm text-[#252A27] dark:text-[#F5F1E8]">
                <Sparkles className="w-4 h-4 text-[#B96F50]" />
                Recomendación compatible de OFI CLICK
              </div>
              <p className="text-xs text-[#73766F] dark:text-[#A3A89F] mt-1">
                {compatiblePros.length} profesionales compatibles por categoría, cobertura en{' '}
                {colonia}, disponibilidad y urgencia.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setDistributionMode('manual')}
              className={`p-4 rounded-xl border text-left transition-colors ${
                distributionMode === 'manual'
                  ? 'border-[#304B3E] bg-[#304B3E]/8 dark:border-[#B96F50] dark:bg-[#1C211E]'
                  : 'border-[#DDD5C8] dark:border-white/12'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-sm text-[#252A27] dark:text-[#F5F1E8]">
                <Users className="w-4 h-4 text-[#304B3E] dark:text-[#9CB08D]" />
                Selección manual directa
              </div>
              <p className="text-xs text-[#73766F] dark:text-[#A3A89F] mt-1">
                Elige libremente a uno o varios especialistas publicados en Cuautitlán Izcalli.
              </p>
            </button>
          </div>

          {/* Recipient Review Checklist */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-[#73766F]">
              <span>
                Destinatarios revisados ({selectedProIds.length} seleccionados de{' '}
                {candidateList.length})
              </span>
              {candidateList.length > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    setSelectedProIds(
                      selectedProIds.length === candidateList.length
                        ? []
                        : candidateList.map((p) => p.id)
                    )
                  }
                  className="text-[#304B3E] dark:text-[#B96F50] hover:underline"
                >
                  {selectedProIds.length === candidateList.length
                    ? 'Deseleccionar todos'
                    : 'Seleccionar todos'}
                </button>
              )}
            </div>

            {candidateList.length === 0 ? (
              <div className="p-5 rounded-xl border border-amber-300/60 bg-amber-50/70 dark:bg-amber-950/20 text-xs space-y-2">
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  No encontramos coincidencia automática exacta con todos tus criterios en{' '}
                  {colonia}.
                </p>
                <p className="text-amber-800 dark:text-amber-300">
                  Cambia a &ldquo;Selección manual directa&rdquo; o ajusta el nivel de urgencia /
                  colonia para ver más opciones.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[340px] overflow-y-auto pr-1">
                {candidateList.map((pro) => {
                  const checked = selectedProIds.includes(pro.id);
                  return (
                    <button
                      key={pro.id}
                      type="button"
                      onClick={() => toggleRecipient(pro.id)}
                      className={`p-3.5 rounded-xl border text-left flex items-start justify-between gap-3 transition-colors ${
                        checked
                          ? 'border-[#304B3E] bg-[#EAE3D6]/55 dark:border-[#B96F50] dark:bg-[#1C211E]'
                          : 'border-[#DDD5C8] dark:border-white/12'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-sm text-[#252A27] dark:text-[#F5F1E8] truncate">
                            {pro.commercialName || pro.displayName}
                          </span>
                          {pro.verificationLevel >= 3 && (
                            <ShieldCheck className="w-3.5 h-3.5 text-[#304B3E] dark:text-[#9CB08D] shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-[#73766F] dark:text-[#A3A89F] mt-0.5 truncate">
                          {pro.primaryColonia} · {pro.ratingAvg.toFixed(1)} ({pro.reviewsCount}{' '}
                          reseñas)
                        </p>
                      </div>
                      <span
                        className={`w-5 h-5 rounded flex items-center justify-center shrink-0 border ${
                          checked
                            ? 'bg-[#304B3E] border-[#304B3E] text-white dark:bg-[#75836A] dark:border-[#75836A]'
                            : 'border-[#DDD5C8] dark:border-white/30'
                        }`}
                      >
                        {checked && <Check className="w-3.5 h-3.5" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Summary Box */}
          <div className="p-4 rounded-xl bg-[#EAE3D6]/60 dark:bg-[#1C211E] border border-[#DDD5C8]/70 dark:border-white/10 text-xs space-y-1.5">
            <div className="font-semibold text-[#252A27] dark:text-[#F5F1E8] flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#B96F50]" />
              Resumen de envío
            </div>
            <p className="text-[#73766F] dark:text-[#A3A89F]">
              <strong>{title}</strong> · Col. {colonia} · Fecha solicitada: {desiredDate} (
              {desiredTimeSlot}) ·{' '}
              {optionalBudget ? `Presupuesto ref: ${formatMXN(Number(optionalBudget))}` : 'Abierto a cotización'}
            </p>
            <p className="text-[#73766F] dark:text-[#A3A89F]">
              Tu dirección exacta permanece privada hasta que aceptes una cotización y confirmes la
              cita. El pago del servicio se acuerda directamente con el profesional fuera de OFI CLICK.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="px-4 py-2.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 text-sm font-medium"
            >
              Atrás
            </button>
            <button
              type="button"
              onClick={handleConfirmSend}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#304B3E] hover:bg-[#243A30] text-white text-sm font-semibold transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Confirmar y enviar solicitud ({selectedProIds.length})
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
