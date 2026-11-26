import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeftRight,
  Filter,
  List,
  LocateFixed,
  Map as MapIcon,
  RotateCcw,
  X,
} from 'lucide-react';
import { useOfiClick } from '../context/OfiClickContext';
import type { SearchFilters, SortOption } from '../types/oficlick';
import { filterAndSortProfessionals } from '../utils/marketplace';
import { ProfessionalCard } from '../components/ProfessionalCard';
import { ServiceMap } from '../components/map/ServiceMap';
import { ALL_IZCALLI_COLONIAS } from '../data/izcalliLocations';

const DEFAULT_FILTERS: SearchFilters = {
  query: '',
  categoryId: '',
  subcategoryId: '',
  serviceId: '',
  colonia: '',
  zone: '',
  maxDistanceKm: null,
  minRating: 0,
  minReviews: 0,
  maxPrice: null,
  availability: 'all',
  urgentOnly: false,
  homeServiceOnly: false,
  verifiedOnly: false,
  minExperienceYears: 0,
  minCompletedJobs: 0,
};

export const ExplorePage: React.FC<{
  initialQuery?: string;
  initialCategoryId?: string;
  initialColonia?: string;
  embedded?: boolean;
}> = ({ initialQuery = '', initialCategoryId = '', initialColonia = '', embedded = false }) => {
  const { db, navigate, compareIds } = useOfiClick();

  const [filters, setFilters] = useState<SearchFilters>({
    ...DEFAULT_FILTERS,
    query: initialQuery,
    categoryId: initialCategoryId,
    colonia: initialColonia,
  });
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const [selectedProId, setSelectedProId] = useState<string | null>(null);
  const [hoveredProId, setHoveredProId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationConsentMsg, setLocationConsentMsg] = useState('');
  const [isUpdatingFilters, setIsUpdatingFilters] = useState(false);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      query: initialQuery || prev.query,
      categoryId: initialCategoryId || prev.categoryId,
      colonia: initialColonia || prev.colonia,
    }));
  }, [initialQuery, initialCategoryId, initialColonia]);

  const activeRegion = db.regions.find((r) => r.active) || db.regions[0];
  const izcalliColonias = useMemo(
    () => (activeRegion?.colonias?.length ? activeRegion.colonias : ALL_IZCALLI_COLONIAS),
    [activeRegion]
  );
  const activeCategories = db.categories.filter((c) => c.active);
  const selectedCategory = activeCategories.find((c) => c.id === filters.categoryId);

  // Build deduplicated list of specific published services (scoped by selected category if active)
  const availableServices = useMemo(() => {
    const publishedProIds = new Set(
      db.professionals
        .filter((p) => p.published && p.profileComplete && !p.pausedByAdmin)
        .map((p) => p.id)
    );
    const seenNames = new Set<string>();
    const list: { id: string; name: string; categoryId: string }[] = [];
    for (const srv of db.services) {
      if (srv.status !== 'published' || !publishedProIds.has(srv.professionalId)) continue;
      if (filters.categoryId && srv.categoryId !== filters.categoryId) continue;
      const key = srv.name.trim().toLowerCase();
      if (seenNames.has(key)) continue;
      seenNames.add(key);
      list.push({ id: srv.id, name: srv.name, categoryId: srv.categoryId });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [db.professionals, db.services, filters.categoryId]);

  const results = useMemo(
    () =>
      filterAndSortProfessionals(
        db.professionals,
        db.services,
        filters,
        sortBy,
        userCoords
      ),
    [db.professionals, db.services, filters, sortBy, userCoords]
  );

  // Brief filter feedback and keep selectedProId synchronized with visible markers/cards
  useEffect(() => {
    setIsUpdatingFilters(true);
    const t = window.setTimeout(() => setIsUpdatingFilters(false), 140);
    return () => window.clearTimeout(t);
  }, [filters, sortBy]);

  useEffect(() => {
    if (selectedProId && !results.some((p) => p.id === selectedProId)) {
      setSelectedProId(null);
    }
  }, [results, selectedProId]);

  const handleMapSelectPro = (id: string) => {
    setSelectedProId(id);
    const node = cardRefs.current[id];
    if (node && typeof node.scrollIntoView === 'function') {
      node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const activeFilterChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = [];
    if (filters.query.trim()) {
      chips.push({
        key: 'query',
        label: `Búsqueda: "${filters.query.trim()}"`,
        clear: () => setFilters((f) => ({ ...f, query: '' })),
      });
    }
    if (filters.categoryId) {
      const cat = activeCategories.find((c) => c.id === filters.categoryId);
      chips.push({
        key: 'categoryId',
        label: `Categoría: ${cat?.name || filters.categoryId}`,
        clear: () =>
          setFilters((f) => ({ ...f, categoryId: '', subcategoryId: '', serviceId: '' })),
      });
    }
    if (filters.subcategoryId && selectedCategory) {
      const sub = selectedCategory.subcategories.find((s) => s.id === filters.subcategoryId);
      chips.push({
        key: 'subcategoryId',
        label: `Subcategoría: ${sub?.name || filters.subcategoryId}`,
        clear: () => setFilters((f) => ({ ...f, subcategoryId: '' })),
      });
    }
    if (filters.serviceId) {
      const srv = db.services.find((s) => s.id === filters.serviceId);
      chips.push({
        key: 'serviceId',
        label: `Servicio: ${srv?.name || 'Específico'}`,
        clear: () => setFilters((f) => ({ ...f, serviceId: '' })),
      });
    }
    if (filters.colonia) {
      chips.push({
        key: 'colonia',
        label: `Colonia: ${filters.colonia}`,
        clear: () => setFilters((f) => ({ ...f, colonia: '' })),
      });
    }
    if (filters.minRating > 0) {
      chips.push({
        key: 'minRating',
        label: `Mín. ${filters.minRating}★`,
        clear: () => setFilters((f) => ({ ...f, minRating: 0 })),
      });
    }
    if (filters.availability !== 'all') {
      chips.push({
        key: 'availability',
        label: `Disponibilidad: ${filters.availability === 'available' ? 'Disponible' : 'Agenda parcial'}`,
        clear: () => setFilters((f) => ({ ...f, availability: 'all' })),
      });
    }
    if (filters.maxPrice !== null) {
      chips.push({
        key: 'maxPrice',
        label: `Máx. $${filters.maxPrice} MXN`,
        clear: () => setFilters((f) => ({ ...f, maxPrice: null })),
      });
    }
    if (filters.urgentOnly) {
      chips.push({
        key: 'urgentOnly',
        label: 'Atención urgente',
        clear: () => setFilters((f) => ({ ...f, urgentOnly: false })),
      });
    }
    if (filters.homeServiceOnly) {
      chips.push({
        key: 'homeServiceOnly',
        label: 'A domicilio',
        clear: () => setFilters((f) => ({ ...f, homeServiceOnly: false })),
      });
    }
    if (filters.verifiedOnly) {
      chips.push({
        key: 'verifiedOnly',
        label: 'Perfiles revisados',
        clear: () => setFilters((f) => ({ ...f, verifiedOnly: false })),
      });
    }
    if (filters.minExperienceYears > 0) {
      chips.push({
        key: 'minExp',
        label: `Exp. ≥ ${filters.minExperienceYears} años`,
        clear: () => setFilters((f) => ({ ...f, minExperienceYears: 0 })),
      });
    }
    if (filters.minCompletedJobs > 0) {
      chips.push({
        key: 'minJobs',
        label: `Trabajos ≥ ${filters.minCompletedJobs}`,
        clear: () => setFilters((f) => ({ ...f, minCompletedJobs: 0 })),
      });
    }
    return chips;
  }, [activeCategories, db.services, filters, selectedCategory]);

  const handleRequestLocation = () => {
    if (!navigator.geolocation) {
      setLocationConsentMsg('Tu navegador no admite geolocalización.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setSortBy('distance');
        setLocationConsentMsg('Ubicación temporal autorizada para ordenar por cercanía.');
      },
      () => {
        setLocationConsentMsg('No se autorizó ubicación; puedes filtrar por colonia libremente.');
      },
      { enableHighAccuracy: false, timeout: 6000 }
    );
  };

  const resetAllFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSelectedProId(null);
  };

  const Wrapper: React.ElementType = embedded ? 'div' : 'main';
  return (
    <Wrapper className={embedded ? 'space-y-4' : 'max-w-7xl mx-auto px-4 sm:px-6 py-6 min-h-[80vh]'}>
      {/* Search & Controls Bar */}
      <div className="rounded-2xl bg-[#FFFDFA] dark:bg-[#1A2128] border border-[#DBD4C6] dark:border-white/10 p-4 mb-5 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-3">
            <label htmlFor="explore-query" className="sr-only">
              Buscar servicio o profesional
            </label>
            <input
              id="explore-query"
              type="text"
              value={filters.query}
              onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
              placeholder="Buscar servicio, colonia..."
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-[#DBD4C6] dark:border-white/15 bg-[#F7F3EA]/60 dark:bg-black/20"
            />
          </div>

          <div className="md:col-span-2">
            <label htmlFor="explore-cat" className="sr-only">
              Categoría
            </label>
            <select
              id="explore-cat"
              value={filters.categoryId}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  categoryId: e.target.value,
                  subcategoryId: '',
                  serviceId: '',
                }))
              }
              className="w-full px-3 py-2 text-sm rounded-xl border border-[#DBD4C6] dark:border-white/15 bg-[#F7F3EA]/60 dark:bg-black/20"
            >
              <option value="">Todas las categorías</option>
              {activeCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <label htmlFor="explore-service" className="sr-only">
              Servicio específico
            </label>
            <select
              id="explore-service"
              value={filters.serviceId}
              onChange={(e) => setFilters((f) => ({ ...f, serviceId: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-xl border border-[#DBD4C6] dark:border-white/15 bg-[#F7F3EA]/60 dark:bg-black/20"
            >
              <option value="">Todos los servicios</option>
              {availableServices.map((srv) => (
                <option key={srv.id} value={srv.id}>
                  {srv.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label htmlFor="explore-colonia" className="sr-only">
              Colonia o dirección
            </label>
            <select
              id="explore-colonia"
              value={filters.colonia}
              onChange={(e) => setFilters((f) => ({ ...f, colonia: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-xl border border-[#DBD4C6] dark:border-white/15 bg-[#F7F3EA]/60 dark:bg-black/20"
            >
              <option value="">Todo Cuautitlán Izcalli ({izcalliColonias.length})</option>
              {izcalliColonias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltersOpen(!filtersOpen)}
              aria-expanded={filtersOpen}
              className="w-full py-2 px-3 rounded-xl border border-[#DBD4C6] dark:border-white/15 bg-[#ECE7DC]/50 dark:bg-white/5 text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-[#ECE7DC] dark:hover:bg-white/10 transition-colors"
            >
              <Filter className="w-3.5 h-3.5" />
              Más filtros
            </button>
          </div>
        </div>

        {/* Advanced filters drawer */}
        {filtersOpen && (
          <div className="mt-4 pt-4 border-t border-[#DBD4C6] dark:border-white/10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {selectedCategory && selectedCategory.subcategories.length > 0 && (
              <div>
                <label className="block font-medium mb-1">Subcategoría</label>
                <select
                  value={filters.subcategoryId}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, subcategoryId: e.target.value }))
                  }
                  className="w-full px-2.5 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-transparent"
                >
                  <option value="">Todas</option>
                  {selectedCategory.subcategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block font-medium mb-1">Calificación mínima</label>
              <select
                value={filters.minRating}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, minRating: Number(e.target.value) }))
                }
                className="w-full px-2.5 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-transparent"
              >
                <option value={0}>Cualquiera</option>
                <option value={4}>4.0+ estrellas</option>
                <option value={4.5}>4.5+ estrellas</option>
                <option value={4.8}>4.8+ estrellas</option>
              </select>
            </div>

            <div>
              <label className="block font-medium mb-1">Disponibilidad</label>
              <select
                value={filters.availability}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    availability: e.target.value as SearchFilters['availability'],
                  }))
                }
                className="w-full px-2.5 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-transparent"
              >
                <option value="all">Todas</option>
                <option value="available">Disponible ahora</option>
                <option value="busy">Agenda parcial</option>
              </select>
            </div>

            <div>
              <label className="block font-medium mb-1">Precio orientativo máximo (MXN)</label>
              <input
                type="number"
                min={0}
                placeholder="Ej. 1500"
                value={filters.maxPrice ?? ''}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    maxPrice: e.target.value ? Number(e.target.value) : null,
                  }))
                }
                className="w-full px-2.5 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-transparent"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Experiencia mínima (años)</label>
              <input
                type="number"
                min={0}
                value={filters.minExperienceYears}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    minExperienceYears: Number(e.target.value) || 0,
                  }))
                }
                className="w-full px-2.5 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-transparent"
              />
            </div>

            <div>
              <label className="block font-medium mb-1">Trabajos completados mín.</label>
              <input
                type="number"
                min={0}
                value={filters.minCompletedJobs}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    minCompletedJobs: Number(e.target.value) || 0,
                  }))
                }
                className="w-full px-2.5 py-2 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-transparent"
              />
            </div>

            <div className="flex flex-col justify-end gap-1.5">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.urgentOnly}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, urgentOnly: e.target.checked }))
                  }
                />
                Atención urgente
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.homeServiceOnly}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, homeServiceOnly: e.target.checked }))
                  }
                />
                Servicio a domicilio
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={filters.verifiedOnly}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, verifiedOnly: e.target.checked }))
                  }
                />
                Solo perfiles revisados
              </label>
            </div>
          </div>
        )}

        {/* Active filter chips */}
        {activeFilterChips.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[#DBD4C6] dark:border-white/10 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[#73766F] font-medium">Filtros activos:</span>
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.clear}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#ECE7DC] dark:bg-white/10 text-[#1D252C] dark:text-[#F7F3EA] font-medium hover:bg-[#C7582B]/20"
              >
                <span>{chip.label}</span>
                <X className="w-3 h-3" />
              </button>
            ))}
            <button
              type="button"
              onClick={resetAllFilters}
              className="text-xs font-semibold text-[#214438] dark:text-[#C7582B] hover:underline ml-1"
            >
              Limpiar todo
            </button>
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-[#DBD4C6] dark:border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-[#1D252C] dark:text-[#F7F3EA] font-mono-num">
              {results.length} {results.length === 1 ? 'resultado' : 'resultados'} en lista y mapa
            </span>
            {isUpdatingFilters && (
              <span className="text-[11px] text-[#214438] dark:text-[#C7582B]">
                Actualizando mapa...
              </span>
            )}
            <button
              type="button"
              onClick={handleRequestLocation}
              className="inline-flex items-center gap-1 text-[#214438] dark:text-[#C7582B] font-medium hover:underline"
            >
              <LocateFixed className="w-3.5 h-3.5" />
              Ordenar por cercanía (opcional)
            </button>
            {locationConsentMsg && (
              <span className="text-[#73766F]">{locationConsentMsg}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="sort-select" className="text-[#73766F]">
              Ordenar por:
            </label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-2.5 py-1.5 rounded-lg border border-[#DBD4C6] dark:border-white/15 bg-transparent font-medium"
            >
              <option value="relevance">Relevancia</option>
              <option value="rating">Mejor calificación</option>
              <option value="reviews">Más reseñas</option>
              <option value="price_asc">Menor precio orientativo</option>
              <option value="experience">Mayor experiencia</option>
              {userCoords && <option value="distance">Cercanía autorizada</option>}
            </select>
            <button
              type="button"
              onClick={resetAllFilters}
              aria-label="Restablecer filtros"
              className="p-1.5 rounded-lg text-[#73766F] hover:bg-[#ECE7DC] dark:hover:bg-white/10"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile list/map toggle */}
      <div className="lg:hidden mb-4 grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#FFFDFA] dark:bg-[#1A2128] border border-[#DBD4C6] dark:border-white/10">
        <button
          type="button"
          onClick={() => setMobileView('list')}
          className={`py-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 ${
            mobileView === 'list' ? 'bg-[#214438] text-white' : 'text-[#73766F]'
          }`}
        >
          <List className="w-4 h-4" />
          Lista ({results.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileView('map')}
          className={`py-2 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 ${
            mobileView === 'map' ? 'bg-[#214438] text-white' : 'text-[#73766F]'
          }`}
        >
          <MapIcon className="w-4 h-4" />
          Mapa ({results.length})
        </button>
      </div>

      {/* Synchronized Split Layout: List + Interactive Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        <div
          className={`lg:col-span-7 space-y-4 ${
            mobileView === 'map' ? 'hidden lg:block' : 'block'
          }`}
        >
          {results.length === 0 ? (
            <div className="rounded-2xl bg-[#FFFDFA] dark:bg-[#1A2128] border border-[#DBD4C6] dark:border-white/10 p-10 text-center">
              <p className="font-display font-bold text-lg text-[#1D252C] dark:text-[#F7F3EA]">
                No hay profesionales con esos filtros
              </p>
              <p className="text-sm text-[#73766F] mt-1">
                Prueba limpiando el servicio específico, la colonia o ampliando la categoría en Cuautitlán Izcalli.
              </p>
              <button
                type="button"
                onClick={resetAllFilters}
                className="mt-4 px-4 py-2 rounded-lg bg-[#214438] hover:bg-[#183329] text-white text-xs font-semibold transition-colors"
              >
                Limpiar filtros
              </button>
            </div>
          ) : (
            results.map((pro) => (
              <div
                key={pro.id}
                ref={(el) => {
                  cardRefs.current[pro.id] = el;
                }}
              >
                <ProfessionalCard
                  pro={pro}
                  services={db.services}
                  highlighted={selectedProId === pro.id || hoveredProId === pro.id}
                  onSelect={() => setSelectedProId(pro.id)}
                  onHover={(h) => setHoveredProId(h ? pro.id : null)}
                />
              </div>
            ))
          )}
        </div>

        <div
          className={`lg:col-span-5 lg:sticky lg:top-20 h-[520px] lg:h-[calc(100vh-120px)] ${
            mobileView === 'list' ? 'hidden lg:block' : 'block'
          }`}
        >
          <ServiceMap
            professionals={results}
            selectedProId={selectedProId}
            hoveredProId={hoveredProId}
            selectedColonia={filters.colonia}
            onSelectColonia={(col) => setFilters((f) => ({ ...f, colonia: col }))}
            onSelectPro={handleMapSelectPro}
            onHoverPro={(id) => setHoveredProId(id)}
            onOpenProfile={(id) => navigate({ page: 'pro-profile', proId: id })}
          />
        </div>
      </div>

      {/* Compare floating trigger when 1..3 pros selected */}
      {compareIds.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 rounded-xl bg-[#214438] text-white px-4 py-2.5 shadow-xl border border-white/15 flex items-center gap-3 text-xs">
          <span className="font-mono-num">
            {compareIds.length}/3 seleccionados para comparar
          </span>
          <button
            type="button"
            onClick={() => navigate({ page: 'compare' })}
            className="px-3 py-1.5 rounded-lg bg-[#C7582B] hover:bg-[#AC4921] text-white font-semibold inline-flex items-center gap-1 transition-colors"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            Comparar ahora
          </button>
        </div>
      )}
    </Wrapper>
  );
};
