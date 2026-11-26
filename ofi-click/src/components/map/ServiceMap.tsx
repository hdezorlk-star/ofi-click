import React, { useCallback, useMemo, useState } from 'react';
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
import { ExternalLink, Info, MapPin, Navigation, Search, Shield, X } from 'lucide-react';
import type { ProfessionalProfile } from '../../types/oficlick';
import {
  CUAUTITLAN_IZCALLI_LOCALITIES,
  IZCALLI_CENTER,
  IZCALLI_MAP_BOUNDS,
  type IzcalliLocality,
  type IzcalliZone,
} from '../../data/izcalliLocations';

interface ServiceMapProps {
  professionals: ProfessionalProfile[];
  selectedProId: string | null;
  hoveredProId: string | null;
  onSelectPro: (proId: string) => void;
  onHoverPro: (proId: string | null) => void;
  onOpenProfile: (proId: string) => void;
  selectedColonia?: string;
  onSelectColonia?: (colonia: string) => void;
}

function projectCoords(lat: number, lng: number): { xPct: number; yPct: number } {
  const x =
    ((lng - IZCALLI_MAP_BOUNDS.minLng) /
      (IZCALLI_MAP_BOUNDS.maxLng - IZCALLI_MAP_BOUNDS.minLng)) *
    100;
  const y =
    (1 -
      (lat - IZCALLI_MAP_BOUNDS.minLat) /
        (IZCALLI_MAP_BOUNDS.maxLat - IZCALLI_MAP_BOUNDS.minLat)) *
    100;
  return {
    xPct: Math.min(93, Math.max(7, x)),
    yPct: Math.min(90, Math.max(10, y)),
  };
}

export function buildExternalDirectionsUrl(colonia: string): string {
  const q = encodeURIComponent(`${colonia}, Cuautitlán Izcalli, Estado de México`);
  return `https://www.google.com/maps/search/?api=1&query=${q}`;
}

const KEY_LANDMARKS: IzcalliLocality[] = [
  // Centro
  { name: 'Centro Urbano', zone: 'Centro', kind: 'colonia', lat: 19.6562, lng: -99.2104 },
  { name: 'Ensueños', zone: 'Centro', kind: 'colonia', lat: 19.6512, lng: -99.2164 },
  { name: 'Cumbria', zone: 'Centro', kind: 'colonia', lat: 19.6442, lng: -99.2191 },
  { name: 'Atlanta', zone: 'Centro', kind: 'colonia', lat: 19.6485, lng: -99.203 },
  { name: 'Arcos del Alba', zone: 'Centro', kind: 'fraccionamiento', lat: 19.6641, lng: -99.2055 },
  { name: 'Jardines de la Hacienda', zone: 'Centro', kind: 'fraccionamiento', lat: 19.6558, lng: -99.1984 },
  // Norte
  { name: 'Infonavit Norte', zone: 'Norte', kind: 'unidad_habitacional', lat: 19.6725, lng: -99.217 },
  { name: 'Cofradía de San Miguel', zone: 'Norte', kind: 'unidad_habitacional', lat: 19.684, lng: -99.214 },
  { name: 'San Lorenzo Río Tenco', zone: 'Norte', kind: 'pueblo', lat: 19.6982, lng: -99.2045 },
  { name: 'San Sebastián Xhala', zone: 'Norte', kind: 'pueblo', lat: 19.7085, lng: -99.1885 },
  { name: 'Santa Bárbara', zone: 'Norte', kind: 'pueblo', lat: 19.6924, lng: -99.1932 },
  { name: 'San Juan Atlamica', zone: 'Norte', kind: 'pueblo', lat: 19.6824, lng: -99.1958 },
  // Poniente
  { name: 'Bosques del Lago', zone: 'Poniente', kind: 'fraccionamiento', lat: 19.6295, lng: -99.2421 },
  { name: 'Lago de Guadalupe', zone: 'Poniente', kind: 'colonia', lat: 19.6245, lng: -99.2535 },
  { name: 'Axotlán', zone: 'Poniente', kind: 'pueblo', lat: 19.6642, lng: -99.2365 },
  { name: 'El Rosario', zone: 'Poniente', kind: 'pueblo', lat: 19.6615, lng: -99.2485 },
  { name: 'San José Huilango', zone: 'Poniente', kind: 'pueblo', lat: 19.6715, lng: -99.2595 },
  { name: 'San Francisco Tepojaco', zone: 'Poniente', kind: 'pueblo', lat: 19.6498, lng: -99.2555 },
  // Sur
  { name: 'La Quebrada', zone: 'Sur', kind: 'colonia', lat: 19.6138, lng: -99.2135 },
  { name: 'San Martín Tepetlixpan', zone: 'Sur', kind: 'pueblo', lat: 19.6228, lng: -99.2215 },
  { name: 'Lomas de Cuautitlán', zone: 'Sur', kind: 'colonia', lat: 19.6185, lng: -99.2295 },
  { name: 'Hacienda del Parque', zone: 'Sur', kind: 'fraccionamiento', lat: 19.6095, lng: -99.1995 },
  // Oriente
  { name: 'Santiago Tepalcapa', zone: 'Oriente', kind: 'pueblo', lat: 19.6392, lng: -99.1932 },
  { name: 'Industrial Cuamatla', zone: 'Oriente', kind: 'parque_industrial', lat: 19.6612, lng: -99.1815 },
  { name: 'San Mateo Ixtacalco', zone: 'Oriente', kind: 'pueblo', lat: 19.6875, lng: -99.1665 },
  { name: 'Parque Ind. Tres Ríos', zone: 'Oriente', kind: 'parque_industrial', lat: 19.6535, lng: -99.1745 },
];

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
          background={isSelected ? '#C7582B' : isHovered ? '#214438' : '#1D252C'}
          borderColor="#FFFFFF"
          glyphColor="#FFFFFF"
          scale={isSelected ? 1.2 : 1}
        />
      </AdvancedMarker>
      {infoOpen && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => setInfoOpen(false)}>
          <div className="p-1 max-w-[220px] text-[#1D252C]">
            <p className="font-semibold text-sm">{pro.commercialName || pro.displayName}</p>
            <p className="text-xs text-[#5B636B] mt-0.5">
              Zona aprox.: {pro.primaryColonia} · ★ {pro.ratingAvg.toFixed(1)}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenProfile}
                className="text-xs font-semibold text-[#214438] hover:underline"
              >
                Ver perfil
              </button>
              <a
                href={buildExternalDirectionsUrl(pro.primaryColonia)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#5B636B] hover:underline inline-flex items-center gap-1"
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

const LocalityPinMarker: React.FC<{ locality: IzcalliLocality }> = ({ locality }) => {
  return (
    <AdvancedMarker
      position={{ lat: locality.lat, lng: locality.lng }}
      zIndex={500}
      title={`${locality.name} · Zona ${locality.zone}`}
    >
      <Pin
        background="#C7582B"
        borderColor="#F7F3EA"
        glyphColor="#F7F3EA"
        scale={1.05}
      />
    </AdvancedMarker>
  );
};

const GoogleMapsLiveSurface: React.FC<
  ServiceMapProps & { onFallback: (reason: string) => void; activeLocality: IzcalliLocality | null }
> = ({
  professionals,
  selectedProId,
  hoveredProId,
  onSelectPro,
  onOpenProfile,
  onFallback,
  activeLocality,
}) => {
  const status = useApiLoadingStatus();

  React.useEffect(() => {
    if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
      onFallback('No se pudo autenticar Google Maps; mostrando vista completa de Cuautitlán Izcalli');
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
      onFallback('Vista interactiva local completa de Cuautitlán Izcalli activa');
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [status, onFallback]);

  const mapCenter = activeLocality
    ? { lat: activeLocality.lat, lng: activeLocality.lng }
    : IZCALLI_CENTER;

  return (
    <div className="relative w-full h-full min-h-[420px]">
      {status !== APILoadingStatus.LOADED && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#ECE7DC]/90 dark:bg-[#12171C]/90 text-xs font-medium text-[#1D252C] dark:text-[#F7F3EA]">
          Cargando mapa completo de Cuautitlán Izcalli...
        </div>
      )}
      {status === APILoadingStatus.LOADED && professionals.length === 0 && (
        <div className="absolute inset-x-4 bottom-4 z-10 rounded-xl bg-[#FFFDFA]/95 dark:bg-[#1A2128]/95 border border-[#DBD4C6] dark:border-white/15 px-4 py-2.5 text-xs font-medium text-center shadow-md pointer-events-none">
          No hay profesionales en el mapa que coincidan con los filtros seleccionados.
        </div>
      )}
      <GoogleMapComponent
        mapId="DEMO_MAP_ID"
        defaultCenter={mapCenter}
        defaultZoom={activeLocality ? 14 : 12}
        gestureHandling="greedy"
        disableDefaultUI={false}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%', minHeight: '420px' }}
      >
        {activeLocality && <LocalityPinMarker locality={activeLocality} />}
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

const LocalCuautitlanMap: React.FC<
  ServiceMapProps & { reason: string; activeLocality: IzcalliLocality | null }
> = ({
  professionals,
  selectedProId,
  hoveredProId,
  onSelectPro,
  onHoverPro,
  onOpenProfile,
  onSelectColonia,
  reason,
  activeLocality,
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [zoneFilter, setZoneFilter] = useState<IzcalliZone | 'Todas'>('Todas');
  const [localitySearch, setLocalitySearch] = useState('');
  const [highlightedLoc, setHighlightedLoc] = useState<IzcalliLocality | null>(activeLocality);
  const selectedPro = professionals.find((p) => p.id === selectedProId) || null;

  React.useEffect(() => {
    setHighlightedLoc(activeLocality);
  }, [activeLocality]);

  const matchingLocalities = useMemo(() => {
    const q = localitySearch.trim().toLowerCase();
    return CUAUTITLAN_IZCALLI_LOCALITIES.filter((loc) => {
      if (zoneFilter !== 'Todas' && loc.zone !== zoneFilter) return false;
      if (q && !loc.name.toLowerCase().includes(q)) return false;
      return true;
    }).slice(0, 8);
  }, [localitySearch, zoneFilter]);

  const visibleLandmarks = useMemo(() => {
    return KEY_LANDMARKS.filter((lm) => zoneFilter === 'Todas' || lm.zone === zoneFilter);
  }, [zoneFilter]);

  const handleZoomIn = useCallback(() => setZoomLevel((z) => Math.min(1.45, z + 0.15)), []);
  const handleZoomOut = useCallback(() => setZoomLevel((z) => Math.max(0.88, z - 0.15)), []);

  return (
    <div
      data-testid="local-service-map"
      className="relative w-full h-full min-h-[460px] rounded-2xl overflow-hidden border border-[#DBD4C6] dark:border-white/15 bg-[#ECE7DC] dark:bg-[#161C22] select-none"
    >
      {/* Top Bar + Complete Cuautitlán Izcalli Locality Lookup */}
      <div className="absolute top-3 left-3 right-3 z-20 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#FFFDFA]/95 dark:bg-[#1A2128]/95 border border-[#DBD4C6] dark:border-white/12 text-xs shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2 text-[#1D252C] dark:text-[#F7F3EA]">
            <Info className="w-3.5 h-3.5 text-[#C7582B] shrink-0" />
            <span className="font-semibold">
              Cuautitlán Izcalli completo · {CUAUTITLAN_IZCALLI_LOCALITIES.length} colonias y 13 pueblos
            </span>
          </div>
          <span className="text-[11px] text-[#5B636B] dark:text-[#A8B0B8]">{reason}</span>
        </div>

        {/* Interactive Locality Search & Zone Filter */}
        <div className="rounded-xl bg-[#FFFDFA]/95 dark:bg-[#1A2128]/95 border border-[#DBD4C6] dark:border-white/12 p-2 shadow-sm backdrop-blur-sm space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-[#5B636B] absolute left-2.5 top-2" aria-hidden="true" />
              <input
                type="text"
                value={localitySearch}
                onChange={(e) => setLocalitySearch(e.target.value)}
                placeholder="Ubicar colonia, pueblo o fraccionamiento en Izcalli..."
                aria-label="Ubicar colonia en Cuautitlán Izcalli"
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border border-[#DBD4C6] dark:border-white/12 bg-[#F7F3EA]/70 dark:bg-[#12171C] text-[#1D252C] dark:text-[#F7F3EA] focus:outline-1 focus:outline-[#214438]"
              />
              {(localitySearch || highlightedLoc) && (
                <button
                  type="button"
                  aria-label="Limpiar ubicación"
                  onClick={() => {
                    setLocalitySearch('');
                    setHighlightedLoc(null);
                    onSelectColonia?.('');
                  }}
                  className="absolute right-2 top-1.5 text-[#5B636B] hover:text-[#1D252C] dark:hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            {(['Todas', 'Centro', 'Norte', 'Poniente', 'Sur', 'Oriente'] as const).map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => setZoneFilter(z)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors ${
                  zoneFilter === z
                    ? 'bg-[#1D252C] text-[#F7F3EA] dark:bg-[#C7582B]'
                    : 'bg-[#ECE7DC] dark:bg-white/8 text-[#1D252C]/75 dark:text-[#F7F3EA]/75 hover:bg-[#DBD4C6]'
                }`}
              >
                {z}
              </button>
            ))}
          </div>

          {localitySearch.trim().length > 0 && (
            <div className="max-h-32 overflow-y-auto divide-y divide-[#DBD4C6]/60 dark:divide-white/8 rounded-lg border border-[#DBD4C6] dark:border-white/10 bg-[#FFFDFA] dark:bg-[#12171C]">
              {matchingLocalities.length === 0 ? (
                <p className="px-2.5 py-2 text-[11px] text-[#5B636B]">
                  Sin coincidencias en esa zona. Prueba seleccionando &ldquo;Todas&rdquo;.
                </p>
              ) : (
                matchingLocalities.map((loc) => (
                  <button
                    key={loc.name}
                    type="button"
                    onClick={() => {
                      setHighlightedLoc(loc);
                      setLocalitySearch(loc.name);
                      onSelectColonia?.(loc.name);
                    }}
                    className="w-full px-2.5 py-1.5 text-left text-[11px] flex items-center justify-between hover:bg-[#ECE7DC]/70 dark:hover:bg-white/10"
                  >
                    <span className="font-medium text-[#1D252C] dark:text-[#F7F3EA]">
                      {loc.name}
                    </span>
                    <span className="text-[10px] text-[#5B636B] dark:text-[#A8B0B8]">
                      Zona {loc.zone}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stylized Cuautitlán Izcalli complete municipal cartographic canvas */}
      <div
        className="absolute inset-0 transition-transform duration-300"
        style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
      >
        <svg
          viewBox="0 0 800 600"
          className="w-full h-full object-cover opacity-60 dark:opacity-40"
          aria-hidden="true"
        >
          <defs>
            <pattern id="izcalli-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.6"
                className="text-[#1D252C]/15 dark:text-white/15"
              />
            </pattern>
          </defs>
          <rect width="800" height="600" fill="url(#izcalli-grid)" />
          {/* Autopista México-Querétaro (Norte-Sur) */}
          <path
            d="M 460 0 Q 495 290 545 600"
            stroke="#C7582B"
            strokeWidth="7"
            fill="none"
            opacity="0.6"
          />
          {/* Circuito Exterior Mexiquense (Oriente-Norte) */}
          <path
            d="M 100 120 Q 450 95 760 220"
            stroke="#1D252C"
            strokeWidth="3.5"
            strokeDasharray="8 4"
            fill="none"
            opacity="0.45"
          />
          {/* Av. Constitución / Av. Huehuetoca / Jorge Jiménez Cantú */}
          <path
            d="M 85 450 Q 340 325 695 215"
            stroke="#214438"
            strokeWidth="4.5"
            fill="none"
            opacity="0.5"
          />
          <path
            d="M 245 85 Q 375 305 465 550"
            stroke="#5B636B"
            strokeWidth="3"
            fill="none"
            opacity="0.42"
          />
          {/* Lago de Guadalupe (Poniente), Laguna de Axotlán & Parque Espejo de los Lirios */}
          <ellipse cx="145" cy="465" rx="76" ry="42" fill="#214438" opacity="0.22" />
          <ellipse cx="265" cy="275" rx="22" ry="15" fill="#214438" opacity="0.2" />
          <ellipse cx="430" cy="310" rx="25" ry="15" fill="#214438" opacity="0.22" />
        </svg>

        {/* Territorial labels across ALL zones of Cuautitlán Izcalli */}
        {visibleLandmarks.map((lm) => {
          const pos = projectCoords(lm.lat, lm.lng);
          const isTarget = highlightedLoc?.name === lm.name;
          return (
            <button
              key={lm.name}
              type="button"
              onClick={() => {
                setHighlightedLoc(lm);
                onSelectColonia?.(lm.name);
              }}
              style={{ left: `${pos.xPct}%`, top: `${pos.yPct}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded transition-colors ${
                isTarget
                  ? 'bg-[#C7582B] text-white font-bold shadow-sm z-20'
                  : 'text-[#1D252C]/70 dark:text-[#F7F3EA]/60 hover:text-[#C7582B] hover:bg-[#FFFDFA]/80 dark:hover:bg-black/40'
              }`}
            >
              <span className="text-[10px] font-medium whitespace-nowrap">
                {lm.kind === 'pueblo' ? `• ${lm.name}` : lm.name}
              </span>
            </button>
          );
        })}

        {/* Highlighted searched locality marker */}
        {highlightedLoc && (
          <div
            style={{
              left: `${projectCoords(highlightedLoc.lat, highlightedLoc.lng).xPct}%`,
              top: `${projectCoords(highlightedLoc.lat, highlightedLoc.lng).yPct}%`,
            }}
            className="absolute -translate-x-1/2 -translate-y-1/2 z-25 pointer-events-none"
          >
            <span className="absolute -inset-5 rounded-full bg-[#C7582B]/20 border border-[#C7582B]/50 animate-pulse" />
            <div className="relative px-2 py-1 rounded-lg bg-[#1D252C] text-[#F7F3EA] text-[10px] font-bold shadow-lg whitespace-nowrap border border-[#C7582B]">
              {highlightedLoc.name} · Zona {highlightedLoc.zone}
            </div>
          </div>
        )}

        {/* Professional approximate coverage halos & markers */}
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
                  className="absolute -inset-6 rounded-full bg-[#214438]/15 dark:bg-[#C7582B]/20 border border-[#214438]/35 dark:border-[#C7582B]/45 pointer-events-none"
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
                    ? 'bg-[#C7582B] text-white scale-110 ring-2 ring-white'
                    : isHovered
                    ? 'bg-[#214438] text-white scale-105'
                    : 'bg-[#1D252C] text-[#F7F3EA] hover:bg-[#214438]'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 shrink-0 text-[#C7582B]" />
                <span className="whitespace-nowrap">
                  {pro.displayName.split(' ')[0]} · {pro.ratingAvg.toFixed(1)}★
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {professionals.length === 0 && !highlightedLoc && (
        <div className="absolute inset-0 z-15 flex items-center justify-center p-6 pointer-events-none">
          <div className="rounded-xl bg-[#FFFDFA]/95 dark:bg-[#1A2128]/95 border border-[#DBD4C6] dark:border-white/15 px-5 py-4 text-center shadow-lg max-w-xs">
            <p className="text-sm font-bold text-[#1D252C] dark:text-[#F7F3EA]">
              Sin marcadores activos
            </p>
            <p className="text-xs text-[#5B636B] dark:text-[#A8B0B8] mt-1">
              Ningún profesional coincide con los filtros actuales en Cuautitlán Izcalli.
            </p>
          </div>
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1 bg-[#FFFDFA] dark:bg-[#1A2128] rounded-xl border border-[#DBD4C6] dark:border-white/15 p-1 shadow-md">
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
        <div className="absolute bottom-4 left-4 right-16 z-20 max-w-sm rounded-xl bg-[#FFFDFA]/95 dark:bg-[#1A2128]/95 border border-[#DBD4C6] dark:border-white/15 p-3.5 shadow-xl backdrop-blur-sm">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-display font-bold text-sm text-[#1D252C] dark:text-[#F7F3EA]">
                {selectedPro.commercialName || selectedPro.displayName}
              </p>
              <p className="text-xs text-[#5B636B] dark:text-[#A8B0B8]">
                Zona aprox.: {selectedPro.primaryColonia} · ★ {selectedPro.ratingAvg.toFixed(1)} (
                {selectedPro.reviewsCount})
              </p>
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenProfile(selectedPro.id)}
              className="px-3 py-1.5 rounded-lg bg-[#214438] hover:bg-[#183329] text-white text-xs font-semibold transition-colors"
            >
              Consultar perfil
            </button>
            <a
              href={buildExternalDirectionsUrl(selectedPro.primaryColonia)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#DBD4C6] dark:border-white/15 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10"
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

  const activeLocality = useMemo(() => {
    if (!props.selectedColonia) return null;
    return (
      CUAUTITLAN_IZCALLI_LOCALITIES.find(
        (l) => l.name.toLowerCase() === props.selectedColonia?.trim().toLowerCase()
      ) || null
    );
  }, [props.selectedColonia]);

  const handleFallback = useCallback((reason: string) => {
    setFallbackReason((prev) => prev || reason);
  }, []);

  if (!apiKey || fallbackReason) {
    const reason =
      fallbackReason ||
      'Mapa territorial completo';
    return <LocalCuautitlanMap {...props} reason={reason} activeLocality={activeLocality} />;
  }

  return (
    <div className="relative w-full h-full min-h-[460px] rounded-2xl overflow-hidden border border-[#DBD4C6] dark:border-white/15">
      <APIProvider apiKey={apiKey} libraries={['marker', 'places']} language="es" region="MX">
        <GoogleMapsLiveSurface
          {...props}
          onFallback={handleFallback}
          activeLocality={activeLocality}
        />
      </APIProvider>
    </div>
  );
};
