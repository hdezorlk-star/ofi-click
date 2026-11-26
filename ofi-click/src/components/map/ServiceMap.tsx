import React, { useCallback, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMapComponent,
  Pin,
  useApiLoadingStatus,
  APILoadingStatus,
  useAdvancedMarkerRef,
} from '@vis.gl/react-google-maps';
import { ExternalLink, Info, MapPin, Navigation, Shield } from 'lucide-react';
import type { ProfessionalProfile } from '../../types/oficlick';

interface ServiceMapProps {
  professionals: ProfessionalProfile[];
  selectedProId: string | null;
  hoveredProId: string | null;
  onSelectPro: (proId: string) => void;
  onHoverPro: (proId: string | null) => void;
  onOpenProfile: (proId: string) => void;
}

const IZCALLI_CENTER = { lat: 19.6545, lng: -99.2115 };

// Geographic bounds for Cuautitlán Izcalli local map projection
const BOUNDS = {
  minLat: 19.622,
  maxLat: 19.68,
  minLng: -99.252,
  maxLng: -99.185,
};

function projectCoords(lat: number, lng: number): { xPct: number; yPct: number } {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * 100;
  const y = (1 - (lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 100;
  return {
    xPct: Math.min(90, Math.max(10, x)),
    yPct: Math.min(88, Math.max(12, y)),
  };
}

export function buildExternalDirectionsUrl(colonia: string): string {
  const q = encodeURIComponent(`${colonia}, Cuautitlán Izcalli, Estado de México`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

const ProGoogleMarker: React.FC<{
  pro: ProfessionalProfile;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onOpenProfile: () => void;
}> = ({ pro, isSelected, isHovered, onSelect, onOpenProfile }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [infoOpen, setInfoOpen] = useState(false);

  React.useEffect(() => {
    setInfoOpen(isSelected);
  }, [isSelected]);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={pro.approximateCoords}
        zIndex={isSelected ? 1000 : isHovered ? 999 : 10}
        onClick={() => {
          onSelect();
          setInfoOpen(true);
        }}
      >
        <Pin
          background={isSelected ? '#B96F50' : isHovered ? '#75836A' : '#304B3E'}
          borderColor="#FFFFFF"
          glyphColor="#FFFFFF"
          scale={isSelected ? 1.2 : 1}
        />
      </AdvancedMarker>
      {infoOpen && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => setInfoOpen(false)}>
          <div className="p-1 max-w-[220px] text-[#252A27]">
            <p className="font-semibold text-sm">{pro.commercialName || pro.displayName}</p>
            <p className="text-xs text-[#73766F] mt-0.5">
              Zona aprox.: {pro.primaryColonia} · ★ {pro.ratingAvg.toFixed(1)}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenProfile}
                className="text-xs font-semibold text-[#304B3E] hover:underline"
              >
                Ver perfil
              </button>
              <a
                href={buildExternalDirectionsUrl(pro.primaryColonia)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#73766F] hover:underline inline-flex items-center gap-1"
              >
                Cómo llegar
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

const GoogleMapsLiveSurface: React.FC<ServiceMapProps & { onFallback: (reason: string) => void }> = ({
  professionals,
  selectedProId,
  hoveredProId,
  onSelectPro,
  onOpenProfile,
  onFallback,
}) => {
  const status = useApiLoadingStatus();

  React.useEffect(() => {
    if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
      onFallback('No se pudo autenticar Google Maps; mostrando vista local de Cuautitlán Izcalli');
    }
  }, [status, onFallback]);

  React.useEffect(() => {
    const quotaHandler = () => {
      onFallback('Cuota de Google Maps excedida; mostrando vista local de Cuautitlán Izcalli');
    };
    window.addEventListener('gmp-quota-exceeded', quotaHandler);
    return () => window.removeEventListener('gmp-quota-exceeded', quotaHandler);
  }, [onFallback]);

  React.useEffect(() => {
    if (status === APILoadingStatus.LOADED) return;
    const timer = window.setTimeout(() => {
      onFallback('Vista interactiva local de Cuautitlán Izcalli activa');
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [status, onFallback]);

  return (
    <div className="relative w-full h-full min-h-[420px]">
      {status !== APILoadingStatus.LOADED && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#EAE3D6]/90 dark:bg-[#171B19]/90 text-xs font-medium text-[#252A27] dark:text-[#F5F1E8]">
          Cargando mapa interactivo de Cuautitlán Izcalli...
        </div>
      )}
      {status === APILoadingStatus.LOADED && professionals.length === 0 && (
        <div className="absolute inset-x-4 top-4 z-10 rounded-xl bg-[#FFFCF7]/95 dark:bg-[#222825]/95 border border-[#DDD5C8] dark:border-white/15 px-4 py-3 text-xs font-medium text-center shadow-md">
          No hay profesionales en el mapa que coincidan con los filtros seleccionados.
        </div>
      )}
      <GoogleMapComponent
        mapId="DEMO_MAP_ID"
        defaultCenter={IZCALLI_CENTER}
        defaultZoom={13}
        gestureHandling="greedy"
        disableDefaultUI={false}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%', minHeight: '420px' }}
      >
        {professionals.map((pro) => (
          <ProGoogleMarker
            key={pro.id}
            pro={pro}
            isSelected={selectedProId === pro.id}
            isHovered={hoveredProId === pro.id}
            onSelect={() => onSelectPro(pro.id)}
            onOpenProfile={() => onOpenProfile(pro.id)}
          />
        ))}
      </GoogleMapComponent>
    </div>
  );
};

const LocalCuautitlanMap: React.FC<ServiceMapProps & { reason: string }> = ({
  professionals,
  selectedProId,
  hoveredProId,
  onSelectPro,
  onHoverPro,
  onOpenProfile,
  reason,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const selectedPro = professionals.find((p) => p.id === selectedProId) || null;

  const landmarks = [
    { name: 'Centro Urbano', lat: 19.6562, lng: -99.2104 },
    { name: 'Ensueños', lat: 19.6512, lng: -99.2164 },
    { name: 'Cumbria', lat: 19.6442, lng: -99.2191 },
    { name: 'Atlanta', lat: 19.6495, lng: -99.2035 },
    { name: 'Bosques del Lago', lat: 19.6295, lng: -99.2421 },
    { name: 'Arcos del Alba', lat: 19.6641, lng: -99.2055 },
    { name: 'Infonavit Norte', lat: 19.6712, lng: -99.2185 },
    { name: 'Tepalcapa', lat: 19.6392, lng: -99.1932 },
  ];

  const handleZoomIn = useCallback(() => setZoomLevel((z) => Math.min(1.4, z + 0.15)), []);
  const handleZoomOut = useCallback(() => setZoomLevel((z) => Math.max(0.9, z - 0.15)), []);

  return (
    <div
      data-testid="local-service-map"
      className="relative w-full h-full min-h-[420px] rounded-2xl overflow-hidden border border-[#DDD5C8] dark:border-white/15 bg-[#EAE3D6] dark:bg-[#1C211E] select-none"
    >
      {/* Honest configuration notice */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#FFFCF7]/95 dark:bg-[#222825]/95 border border-[#DDD5C8] dark:border-white/10 text-xs shadow-sm">
        <div className="flex items-center gap-2 text-[#252A27] dark:text-[#F5F1E8]">
          <Info className="w-3.5 h-3.5 text-[#B96F50] shrink-0" />
          <span className="font-medium">
            Mapa interactivo local · Cuautitlán Izcalli
          </span>
        </div>
        <span className="text-[11px] text-[#73766F] dark:text-[#A3A89F]">{reason}</span>
      </div>

      {/* Stylized Cuautitlán Izcalli cartographic grid */}
      <div
        className="absolute inset-0 transition-transform duration-300"
        style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
      >
        <svg
          viewBox="0 0 800 600"
          className="w-full h-full object-cover opacity-55 dark:opacity-35"
          aria-hidden="true"
        >
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.6"
                className="text-[#252A27]/15 dark:text-white/15"
              />
            </pattern>
          </defs>
          <rect width="800" height="600" fill="url(#grid)" />
          {/* Autopista México-Querétaro & Av. Constitución / Jorge Jiménez Cantú */}
          <path
            d="M 520 0 Q 540 300 595 600"
            stroke="#B96F50"
            strokeWidth="7"
            fill="none"
            opacity="0.55"
          />
          <path
            d="M 80 420 Q 340 320 680 180"
            stroke="#304B3E"
            strokeWidth="4.5"
            fill="none"
            opacity="0.45"
          />
          <path
            d="M 220 90 Q 380 280 470 530"
            stroke="#73766F"
            strokeWidth="3"
            fill="none"
            opacity="0.4"
          />
          {/* Lago de Guadalupe & Parque Espejo de los Lirios */}
          <ellipse cx="140" cy="495" rx="75" ry="42" fill="#75836A" opacity="0.24" />
          <ellipse cx="430" cy="285" rx="28" ry="18" fill="#75836A" opacity="0.22" />
        </svg>

        {/* Colonia labels */}
        {landmarks.map((lm) => {
          const pos = projectCoords(lm.lat, lm.lng);
          return (
            <div
              key={lm.name}
              style={{ left: `${pos.xPct}%`, top: `${pos.yPct}%` }}
              className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            >
              <span className="text-[10px] font-medium text-[#252A27]/60 dark:text-[#F5F1E8]/50 whitespace-nowrap">
                {lm.name}
              </span>
            </div>
          );
        })}

        {/* Approximate coverage halos & markers */}
        {professionals.map((pro) => {
          const pos = projectCoords(pro.approximateCoords.lat, pro.approximateCoords.lng);
          const isSelected = selectedProId === pro.id;
          const isHovered = hoveredProId === pro.id;

          return (
            <div
              key={pro.id}
              style={{ left: `${pos.xPct}%`, top: `${pos.yPct}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 ${
                isSelected ? 'z-30' : isHovered ? 'z-20' : 'z-10'
              }`}
            >
              {isSelected && (
                <span
                  aria-hidden="true"
                  className="absolute -inset-6 rounded-full bg-[#304B3E]/15 dark:bg-[#B96F50]/20 border border-[#304B3E]/30 dark:border-[#B96F50]/40 pointer-events-none"
                />
              )}
              <button
                type="button"
                onClick={() => onSelectPro(pro.id)}
                onMouseEnter={() => onHoverPro(pro.id)}
                onMouseLeave={() => onHoverPro(null)}
                aria-label={`Seleccionar ${pro.commercialName || pro.displayName} en ${pro.primaryColonia}`}
                className={`relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold shadow-md transition-transform ${
                  isSelected
                    ? 'bg-[#B96F50] text-white scale-110 ring-2 ring-white'
                    : isHovered
                    ? 'bg-[#75836A] text-white scale-105'
                    : 'bg-[#304B3E] text-white hover:bg-[#243A30]'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-nowrap">
                  {pro.displayName.split(' ')[0]} · {pro.ratingAvg.toFixed(1)}★
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {professionals.length === 0 && (
        <div className="absolute inset-0 z-15 flex items-center justify-center p-6 pointer-events-none">
          <div className="rounded-xl bg-[#FFFCF7]/95 dark:bg-[#222825]/95 border border-[#DDD5C8] dark:border-white/15 px-5 py-4 text-center shadow-lg max-w-xs">
            <p className="text-sm font-bold text-[#252A27] dark:text-[#F5F1E8]">
              Sin marcadores activos
            </p>
            <p className="text-xs text-[#73766F] dark:text-[#A3A89F] mt-1">
              Ningún profesional coincide con los filtros actuales en Cuautitlán Izcalli.
            </p>
          </div>
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1 bg-[#FFFCF7] dark:bg-[#222825] rounded-xl border border-[#DDD5C8] dark:border-white/15 p-1 shadow-md">
        <button
          type="button"
          onClick={handleZoomIn}
          aria-label="Acercar mapa"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold hover:bg-black/5 dark:hover:bg-white/10"
        >
          +
        </button>
        <button
          type="button"
          onClick={handleZoomOut}
          aria-label="Alejar mapa"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold hover:bg-black/5 dark:hover:bg-white/10"
        >
          −
        </button>
      </div>

      {/* Selected professional drawer */}
      {selectedPro && (
        <div className="absolute bottom-4 left-4 right-16 z-20 max-w-sm rounded-xl bg-[#FFFCF7]/95 dark:bg-[#222825]/95 border border-[#DDD5C8] dark:border-white/15 p-3.5 shadow-xl backdrop-blur-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-display font-bold text-sm text-[#252A27] dark:text-[#F5F1E8]">
                {selectedPro.commercialName || selectedPro.displayName}
              </p>
              <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">
                Zona aprox.: {selectedPro.primaryColonia} · ★ {selectedPro.ratingAvg.toFixed(1)} (
                {selectedPro.reviewsCount})
              </p>
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenProfile(selectedPro.id)}
              className="px-3 py-1.5 rounded-lg bg-[#304B3E] hover:bg-[#243A30] text-white text-xs font-semibold transition-colors"
            >
              Consultar perfil
            </button>
            <a
              href={buildExternalDirectionsUrl(selectedPro.primaryColonia)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10"
            >
              <Navigation className="w-3 h-3" />
              Cómo llegar
            </a>
          </div>
        </div>
      )}

      {/* Privacy reminder */}
      <div className="sr-only">
        <Shield className="w-3 h-3" />
        Los marcadores muestran zonas aproximadas; nunca el domicilio privado del profesional.
      </div>
    </div>
  );
};

export const ServiceMap: React.FC<ServiceMapProps> = (props) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);

  const handleFallback = useCallback((reason: string) => {
    setFallbackReason((prev) => prev || reason);
  }, []);

  if (!apiKey || fallbackReason) {
    const reason =
      fallbackReason ||
      'Configura VITE_GOOGLE_MAPS_API_KEY para activar Google Maps Platform';
    return <LocalCuautitlanMap {...props} reason={reason} />;
  }

  return (
    <div className="relative w-full h-full min-h-[420px] rounded-2xl overflow-hidden border border-[#DDD5C8] dark:border-white/15">
      <APIProvider apiKey={apiKey} libraries={['marker', 'places']} language="es" region="MX">
        <GoogleMapsLiveSurface {...props} onFallback={handleFallback} />
      </APIProvider>
    </div>
  );
};
