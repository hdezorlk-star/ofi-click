import React, { useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flag,
  Images,
  MapPin,
  MessageSquare,
  Star,
  ZoomIn,
} from 'lucide-react';
import { useOfiClick } from '../context/OfiClickContext';
import { SafeImage } from '../components/SafeImage';
import { AvailabilityLabel, VerificationLabel } from '../components/ProfessionalCard';
import { PortfolioGalleryModal } from '../components/media/PortfolioGalleryModal';
import { formatDateMX, formatMXN, formatPricingLabel } from '../utils/marketplace';
import { getPublicProAvatar } from '../utils/media';
import { buildExternalDirectionsUrl } from '../components/map/ServiceMap';
import { messagesService } from '../services/messages.service';
import { reviewsService } from '../services/reviews.service';
import type { PortfolioItem } from '../types/oficlick';

export const ProProfilePage: React.FC<{ proId: string }> = ({ proId }) => {
  const {
    db,
    currentUser,
    navigate,
    requireAuth,
    toggleFavorite,
    refreshDb,
    notify,
  } = useOfiClick();

  const [galleryState, setGalleryState] = useState<{
    item: PortfolioItem;
    index: number;
  } | null>(null);

  const pro = db.professionals.find((p) => p.id === proId);
  if (!pro) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-12 text-center">
        <p className="font-display font-bold text-lg">Profesional no encontrado</p>
        <button
          type="button"
          onClick={() => navigate({ page: 'explore' })}
          className="mt-4 px-4 py-2 rounded-lg bg-[#214438] hover:bg-[#183329] text-white text-xs font-semibold"
        >
          Volver al explorador
        </button>
      </main>
    );
  }

  const proServices = db.services.filter(
    (s) => s.professionalId === pro.id && s.status === 'published'
  );
  const proPortfolio = db.portfolios.filter((p) => p.professionalId === pro.id);
  const proReviews = db.reviews.filter(
    (r) => r.professionalId === pro.id && !r.hiddenByAdmin
  );
  const proCategories = db.categories.filter((c) => pro.categoryIds.includes(c.id));
  const isFav = currentUser
    ? db.favorites.some(
        (f) => f.clientId === currentUser.id && f.professionalId === pro.id
      )
    : false;

  const handleOpenChat = () => {
    requireAuth('enviar un mensaje privado', (user) => {
      messagesService.getOrCreateConversation({
        participantIds: [user.id, pro.profileId],
      });
      refreshDb();
      const targetPage =
        user.primaryRole === 'independent_pro' ? 'pro-panel' : 'client-panel';
      navigate({ page: targetPage, tab: 'mensajes' });
    });
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <button
          type="button"
          onClick={() => navigate({ page: 'explore' })}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#73766F] hover:text-[#1D252C] dark:hover:text-white"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Volver a búsqueda
        </button>
      </div>

      {/* Header Profile Block — strictly no private phone/email/home address */}
      <section className="rounded-2xl bg-[#FFFDFA] dark:bg-[#1A2128] border border-[#DBD4C6] dark:border-white/10 p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
          <div className="flex flex-col sm:flex-row gap-5">
            <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0 border border-[#DBD4C6] dark:border-white/10">
              <SafeImage
                src={getPublicProAvatar(pro)}
                alt={pro.commercialName || pro.displayName}
                fallbackLabel={pro.displayName}
                className="w-full h-full object-cover"
              />
            </div>

            <div>
              <p className="text-xs font-medium text-[#73766F] dark:text-[#A3A89F]">
                Freelancer independiente · Registrado en {formatDateMX(pro.joinedAt)}
              </p>
              <h1 className="font-display font-bold text-2xl sm:text-3xl text-[#1D252C] dark:text-[#F7F3EA] mt-1">
                {pro.commercialName || pro.displayName}
              </h1>
              {pro.commercialName && (
                <p className="text-sm text-[#73766F] dark:text-[#A3A89F]">
                  Titular: {pro.displayName}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                <span className="inline-flex items-center gap-1 font-bold text-[#1D252C] dark:text-[#F7F3EA] font-mono-num">
                  <Star className="w-4 h-4 text-[#C7582B] fill-[#C7582B]" />
                  {pro.ratingAvg.toFixed(1)} ({pro.reviewsCount} reseñas)
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num">
                  {pro.completedJobsCount} trabajos completados
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num">{pro.yearsExperience} años de exp.</span>
                <span aria-hidden="true">·</span>
                <AvailabilityLabel status={pro.availabilityStatus} />
                <span aria-hidden="true">·</span>
                <VerificationLabel level={pro.verificationLevel} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => toggleFavorite(pro.id)}
              className={`px-3.5 py-2.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                isFav
                  ? 'border-[#C7582B] bg-[#C7582B]/12 text-[#C7582B]'
                  : 'border-[#DBD4C6] dark:border-white/15 bg-[#ECE7DC]/40 dark:bg-white/5'
              }`}
            >
              <Bookmark className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
              {isFav ? 'Guardado' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={handleOpenChat}
              className="px-3.5 py-2.5 rounded-xl border border-[#DBD4C6] dark:border-white/15 bg-[#ECE7DC]/40 dark:bg-white/5 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <MessageSquare className="w-4 h-4" />
              Enviar mensaje
            </button>
            <button
              type="button"
              onClick={() =>
                requireAuth('solicitar servicio', () =>
                  navigate({
                    page: 'request-new',
                    preselectedProId: pro.id,
                    preselectedCategoryId: pro.categoryIds[0],
                  })
                )
              }
              className="px-5 py-2.5 rounded-xl bg-[#214438] hover:bg-[#183329] text-white text-xs font-semibold transition-colors"
            >
              Solicitar servicio
            </button>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-[#DBD4C6] dark:border-white/10 grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-4">
            <div>
              <h2 className="font-display font-bold text-base mb-1.5 text-[#1D252C] dark:text-[#F7F3EA]">Presentación</h2>
              <p className="text-sm text-[#1D252C]/85 dark:text-[#F7F3EA]/85 leading-relaxed">
                {pro.bio}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-semibold text-[#73766F] mb-1">Categorías y especialidades</p>
                <p className="text-[#1D252C] dark:text-[#F7F3EA]">
                  {proCategories.map((c) => c.name).join(' · ')}
                </p>
                <p className="text-[#73766F] mt-1">{pro.specialties.join(' · ')}</p>
              </div>
              <div>
                <p className="font-semibold text-[#73766F] mb-1">
                  Zona de cobertura aproximada
                </p>
                <p className="text-[#1D252C] dark:text-[#F7F3EA] flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-[#C7582B]" />
                  Base en {pro.primaryColonia} (hasta {pro.maxTravelKm} km)
                </p>
                <p className="text-[#73766F] mt-1">
                  {pro.additionalColonias.join(', ')}
                </p>
                <a
                  href={buildExternalDirectionsUrl(pro.primaryColonia)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-1.5 text-[#214438] dark:text-[#C7582B] font-medium hover:underline"
                >
                  Cómo llegar a la zona en Google Maps
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 rounded-xl bg-[#ECE7DC]/55 dark:bg-black/25 border border-[#DBD4C6]/70 dark:border-white/10 p-4 text-xs space-y-2">
            <h3 className="font-display font-bold text-sm flex items-center gap-1.5 text-[#1D252C] dark:text-[#F7F3EA]">
              <Clock className="w-4 h-4 text-[#C7582B]" />
              Horarios de atención
            </h3>
            <div className="space-y-1">
              {pro.weeklySchedule.map((day) => (
                <div key={day.day} className="flex justify-between">
                  <span className="text-[#73766F]">{day.label}</span>
                  <span className="font-mono-num font-medium">
                    {day.enabled ? `${day.start} – ${day.end}` : 'Descanso'}
                  </span>
                </div>
              ))}
            </div>
            <p className="pt-2 border-t border-[#DBD4C6] dark:border-white/10 text-[11px] text-[#73766F]">
              Modalidad: {pro.homeService ? 'A domicilio' : ''}{' '}
              {pro.workshopService ? '· En taller/local' : ''}
              {pro.urgentAttention ? ' · Atención urgente disponible' : ''}
            </p>
          </div>
        </div>
      </section>

      {/* Services */}
      <section>
        <h2 className="font-display font-bold text-xl mb-4 text-[#1D252C] dark:text-[#F7F3EA]">
          Servicios publicados ({proServices.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {proServices.map((srv) => (
            <article
              key={srv.id}
              className="rounded-2xl bg-[#FFFDFA] dark:bg-[#1A2128] border border-[#DBD4C6] dark:border-white/10 p-5 flex flex-col justify-between gap-4 shadow-xs"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display font-bold text-base text-[#1D252C] dark:text-[#F7F3EA]">{srv.name}</h3>
                  <span className="font-display font-bold text-sm text-[#214438] dark:text-[#C7582B] font-mono-num shrink-0">
                    {formatPricingLabel(srv.pricingMode, srv.priceAmount)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-[#73766F] dark:text-[#A3A89F]">
                  {srv.description}
                </p>
                <p className="mt-2 text-xs text-[#73766F]">
                  Duración estimada: {srv.estimatedDurationMin} min ·{' '}
                  {srv.materialsIncluded ? 'Incluye materiales' : 'Materiales por separado'}
                </p>
                {srv.conditions && (
                  <p className="mt-1 text-xs text-[#73766F]">Condiciones: {srv.conditions}</p>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#DBD4C6] dark:border-white/10 text-xs">
                <span className="text-[#73766F]">
                  Precio orientativo sujeto a cotización formal
                </span>
                <button
                  type="button"
                  onClick={() =>
                    requireAuth('solicitar este servicio', () =>
                      navigate({
                        page: 'request-new',
                        preselectedProId: pro.id,
                        preselectedCategoryId: srv.categoryId,
                      })
                    )
                  }
                  className="px-3.5 py-2 rounded-lg bg-[#214438] hover:bg-[#183329] text-white font-semibold transition-colors"
                >
                  Solicitar
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Portfolio — multi-photo gallery, lightbox & clear origin distinction */}
      <section>
        <h2 className="font-display font-bold text-xl mb-4 text-[#1D252C] dark:text-[#F7F3EA]">
          Portafolio de proyectos ({proPortfolio.length})
        </h2>
        {proPortfolio.length === 0 ? (
          <p className="text-sm text-[#73766F]">
            Este profesional aún no ha publicado proyectos en su portafolio.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {proPortfolio.map((item) => {
              const cat = db.categories.find((c) => c.id === item.categoryId);
              const photos = item.photos.length > 0 ? item.photos : [''];
              return (
                <article
                  key={item.id}
                  className="rounded-2xl bg-[#FFFDFA] dark:bg-[#1A2128] border border-[#DBD4C6] dark:border-white/10 overflow-hidden flex flex-col shadow-xs"
                >
                  <div className="relative group aspect-[4/3] bg-[#ECE7DC]/50 dark:bg-[#161C22]">
                    <button
                      type="button"
                      onClick={() => setGalleryState({ item, index: 0 })}
                      aria-label={`Ampliar galería de ${item.title}`}
                      className="w-full h-full block text-left"
                    >
                      <SafeImage
                        src={photos[0]}
                        alt={item.title}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-black/65 text-white text-[11px] font-semibold">
                        <Images className="w-3 h-3" />
                        {item.photos.length} {item.photos.length === 1 ? 'foto' : 'fotos'}
                      </span>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity absolute inset-0 bg-black/25 flex items-center justify-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFFDFA]/95 text-[#1D252C] text-xs font-semibold shadow-sm">
                          <ZoomIn className="w-3.5 h-3.5" />
                          Ver galería
                        </span>
                      </span>
                    </button>
                  </div>

                  {item.photos.length > 1 && (
                    <div className="px-3 pt-2.5 flex items-center gap-1.5 overflow-x-auto">
                      {item.photos.slice(0, 4).map((photo, idx) => (
                        <button
                          key={`${item.id}-p-${idx}`}
                          type="button"
                          onClick={() => setGalleryState({ item, index: idx })}
                          aria-label={`Abrir foto ${idx + 1} de ${item.title}`}
                          className="w-12 h-9 rounded-md overflow-hidden border border-[#DBD4C6] dark:border-white/15 hover:border-[#C7582B] shrink-0"
                        >
                          <SafeImage
                            src={photo}
                            alt={`${item.title} miniatura ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                      {item.photos.length > 4 && (
                        <button
                          type="button"
                          onClick={() => setGalleryState({ item, index: 4 })}
                          className="px-2 h-9 rounded-md bg-[#ECE7DC] dark:bg-white/10 text-[11px] font-semibold text-[#1D252C] dark:text-[#F7F3EA] shrink-0"
                        >
                          +{item.photos.length - 4}
                        </button>
                      )}
                    </div>
                  )}

                  <div className="p-4 flex-1 flex flex-col justify-between gap-2.5">
                    <div>
                      <p className="text-[11px] font-semibold text-[#214438] dark:text-[#9CB08D] flex items-center gap-1">
                        {item.origin === 'oficlick_completed' ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            Trabajo contratado y completado en OFI CLICK
                          </>
                        ) : (
                          <>
                            <Calendar className="w-3.5 h-3.5 shrink-0" />
                            Fotografía aportada al portafolio
                          </>
                        )}
                      </p>
                      <h3 className="font-display font-bold text-sm mt-1 text-[#1D252C] dark:text-[#F7F3EA]">{item.title}</h3>
                      {cat && (
                        <p className="text-[11px] font-medium text-[#73766F] mt-0.5">
                          {cat.name} · {item.servicePerformed}
                        </p>
                      )}
                      <p className="text-xs text-[#73766F] mt-1.5 leading-relaxed">
                        {item.description}
                      </p>
                      {item.optionalMaterials && (
                        <p className="text-[11px] text-[#73766F] mt-1.5">
                          <strong>Materiales:</strong> {item.optionalMaterials}
                        </p>
                      )}
                    </div>
                    <div className="pt-2 border-t border-[#DBD4C6] dark:border-white/10 text-[11px] text-[#73766F] flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        <span>{item.approximateDate}</span>
                        {item.approximateDuration && <span>· {item.approximateDuration}</span>}
                        {item.optionalPrice && (
                          <span className="font-mono-num">
                            · Ref. {formatMXN(item.optionalPrice)}
                          </span>
                        )}
                      </div>
                      {item.photos.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setGalleryState({ item, index: 0 })}
                          className="text-[#214438] dark:text-[#C7582B] font-semibold hover:underline"
                        >
                          Ampliar
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Reviews */}
      <section>
        <h2 className="font-display font-bold text-xl mb-4 text-[#1D252C] dark:text-[#F7F3EA]">
          Reseñas verificadas ({proReviews.length})
        </h2>
        <div className="space-y-4">
          {proReviews.map((rev) => (
            <article
              key={rev.id}
              className="rounded-2xl bg-[#FFFDFA] dark:bg-[#1A2128] border border-[#DBD4C6] dark:border-white/10 p-5 shadow-xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs">
                  <span className="font-display font-bold text-sm text-[#1D252C] dark:text-[#F7F3EA]">{rev.clientName}</span>
                  <span className="text-[#73766F] ml-2">
                    {rev.serviceName} · {formatDateMX(rev.createdAt)}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono-num font-bold text-xs text-[#C7582B]">
                    {'★'.repeat(rev.rating)} ({rev.rating}/5)
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      requireAuth('reportar una reseña', (user) => {
                        reviewsService.reportReview(
                          rev.id,
                          user.id,
                          'Reportada para revisión de moderación.'
                        );
                        refreshDb();
                        notify('Reseña enviada a revisión administrativa.', 'info');
                      })
                    }
                    className="text-[11px] text-[#73766F] hover:text-red-600 inline-flex items-center gap-1"
                  >
                    <Flag className="w-3 h-3" />
                    Reportar
                  </button>
                </div>
              </div>
              <p className="mt-2 text-sm text-[#1D252C]/85 dark:text-[#F7F3EA]/85">
                {rev.comment}
              </p>
              {rev.proResponse && (
                <div className="mt-3 pl-4 border-l border-[#DBD4C6] dark:border-white/15 text-xs text-[#73766F] dark:text-[#A3A89F]">
                  <p className="font-semibold text-[#1D252C] dark:text-[#F7F3EA]">
                    Respuesta de {pro.displayName}:
                  </p>
                  <p className="mt-0.5">{rev.proResponse.text}</p>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <PortfolioGalleryModal
        item={galleryState?.item || null}
        categoryName={
          galleryState
            ? db.categories.find((c) => c.id === galleryState.item.categoryId)?.name
            : undefined
        }
        initialIndex={galleryState?.index || 0}
        onClose={() => setGalleryState(null)}
      />
    </main>
  );
};
