import React from 'react';
import {
  ArrowLeftRight,
  Bookmark,
  CheckCircle2,
  MapPin,
  ShieldCheck,
  Star,
} from 'lucide-react';
import type { ProfessionalProfile, ServiceItem } from '../types/oficlick';
import { formatMXN, getProMinPublishedPrice } from '../utils/marketplace';
import { getPublicProAvatar } from '../utils/media';
import { SafeImage } from './SafeImage';
import { useOfiClick } from '../context/OfiClickContext';

interface ProfessionalCardProps {
  pro: ProfessionalProfile;
  services: ServiceItem[];
  highlighted?: boolean;
  onSelect?: () => void;
  onHover?: (hovering: boolean) => void;
}

export const VerificationLabel: React.FC<{ level: ProfessionalProfile['verificationLevel'] }> = ({
  level,
}) => {
  if (level === 4) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#214438] dark:text-[#9CB08D]">
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        Credenciales revisadas
      </span>
    );
  }
  if (level === 3) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-[#75836A] dark:text-[#9CB08D]">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
        Perfil revisado
      </span>
    );
  }
  if (level === 2) {
    return <span className="text-xs text-[#73766F] dark:text-[#A3A89F]">Correo confirmado</span>;
  }
  return <span className="text-xs text-[#73766F] dark:text-[#A3A89F]">Cuenta registrada</span>;
};

export const AvailabilityLabel: React.FC<{
  status: ProfessionalProfile['availabilityStatus'];
}> = ({ status }) => {
  const map = {
    available: { label: 'Disponible', cls: 'text-[#214438] dark:text-emerald-400' },
    busy: { label: 'Agenda parcial', cls: 'text-[#C7582B] dark:text-amber-400' },
    unavailable: { label: 'No disponible', cls: 'text-[#73766F]' },
  }[status];
  return <span className={`text-xs font-medium ${map.cls}`}>{map.label}</span>;
};

export const ProfessionalCard: React.FC<ProfessionalCardProps> = ({
  pro,
  services,
  highlighted = false,
  onSelect,
  onHover,
}) => {
  const {
    currentUser,
    db,
    compareIds,
    toggleCompare,
    toggleFavorite,
    navigate,
    requireAuth,
  } = useOfiClick();

  const minPrice = getProMinPublishedPrice(pro.id, services);
  const isFav = currentUser
    ? db.favorites.some(
        (f) => f.clientId === currentUser.id && f.professionalId === pro.id
      )
    : false;
  const isCompared = compareIds.includes(pro.id);

  const handleRequest = (e: React.MouseEvent) => {
    e.stopPropagation();
    requireAuth('enviar una solicitud de servicio', () => {
      navigate({
        page: 'request-new',
        preselectedProId: pro.id,
        preselectedCategoryId: pro.categoryIds[0],
      });
    });
  };

  return (
    <article
      onClick={onSelect}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      className={`rounded-2xl bg-[#FFFDFA] dark:bg-[#1A2128] border transition-all duration-200 p-5 shadow-xs hover:shadow-sm ${
        highlighted
          ? 'border-[#214438] dark:border-[#C7582B] ring-2 ring-[#214438]/15 dark:ring-[#C7582B]/20'
          : 'border-[#DBD4C6] dark:border-white/10 hover:border-[#75836A] dark:hover:border-white/25'
      }`}
    >
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-[#DBD4C6] dark:border-white/10">
          <SafeImage
            src={getPublicProAvatar(pro)}
            alt={pro.commercialName || pro.displayName}
            fallbackLabel={pro.displayName}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-display font-bold text-base text-[#1D252C] dark:text-[#F7F3EA] truncate">
                {pro.commercialName || pro.displayName}
              </h3>
              <p className="text-xs text-[#73766F] dark:text-[#A3A89F] mt-0.5 truncate">
                {pro.commercialName ? `${pro.displayName} · ` : ''}
                Freelancer independiente · {pro.specialties.slice(0, 2).join(', ')}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(pro.id);
                }}
                aria-label={`${isFav ? 'Quitar de' : 'Guardar en'} favoritos a ${pro.displayName}`}
                className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border transition-colors ${
                  isFav
                    ? 'border-[#C7582B] bg-[#C7582B]/12 text-[#C7582B]'
                    : 'border-[#DBD4C6] dark:border-white/10 text-[#73766F] hover:text-[#1D252C] dark:hover:text-white'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCompare(pro.id);
                }}
                aria-label={`${isCompared ? 'Quitar de' : 'Agregar a'} comparación a ${pro.displayName}`}
                className={`min-h-[40px] px-2.5 flex items-center gap-1 rounded-lg border text-xs font-medium transition-colors ${
                  isCompared
                    ? 'border-[#214438] bg-[#214438] text-white'
                    : 'border-[#DBD4C6] dark:border-white/10 text-[#73766F] hover:text-[#1D252C] dark:hover:text-white'
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isCompared ? 'Comparando' : 'Comparar'}</span>
              </button>
            </div>
          </div>

          <p className="mt-2 text-sm text-[#1D252C]/85 dark:text-[#F7F3EA]/85 line-clamp-2 leading-relaxed">
            {pro.bio}
          </p>

          {/* Clean unboxed metadata line */}
          <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#73766F] dark:text-[#A3A89F]">
            <span className="inline-flex items-center gap-1 font-semibold text-[#1D252C] dark:text-[#F7F3EA] font-mono-num">
              <Star className="w-3.5 h-3.5 text-[#C7582B] fill-[#C7582B]" aria-hidden="true" />
              {pro.ratingAvg.toFixed(1)}
              <span className="font-normal text-[#73766F] dark:text-[#A3A89F]">
                ({pro.reviewsCount})
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num">{pro.completedJobsCount} trabajos completados</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
              {pro.primaryColonia}
              {pro.additionalColonias.length > 0 ? ` +${pro.additionalColonias.length} col.` : ''}
            </span>
            <span aria-hidden="true">·</span>
            <AvailabilityLabel status={pro.availabilityStatus} />
            <span aria-hidden="true">·</span>
            <VerificationLabel level={pro.verificationLevel} />
          </div>

          <div className="mt-4 pt-3 border-t border-[#DBD4C6] dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs">
              <span className="text-[#73766F] dark:text-[#A3A89F]">Precio orientativo: </span>
              <span className="font-display font-bold text-sm text-[#1D252C] dark:text-[#F7F3EA] font-mono-num">
                {minPrice ? `Desde ${formatMXN(minPrice)}` : 'Bajo cotización'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate({ page: 'pro-profile', proId: pro.id });
                }}
                className="px-3.5 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-[#ECE7DC]/50 dark:bg-white/5 text-xs font-semibold text-[#1D252C] dark:text-[#F7F3EA] hover:bg-[#ECE7DC] dark:hover:bg-white/10 transition-colors whitespace-nowrap"
              >
                Consultar perfil
              </button>
              <button
                type="button"
                onClick={handleRequest}
                className="px-3.5 py-2 rounded-lg bg-[#214438] hover:bg-[#183329] text-white text-xs font-semibold transition-colors whitespace-nowrap"
              >
                Solicitar servicio
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};
