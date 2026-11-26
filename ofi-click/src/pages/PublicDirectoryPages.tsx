import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Search,
  ShieldCheck,
  Star,
  UserCheck,
} from 'lucide-react';
import { useOfiClick } from '../context/OfiClickContext';
import { CategoryIcon } from '../components/CategoryIcon';
import { ProfessionalCard } from '../components/ProfessionalCard';
import { filterAndSortProfessionals } from '../utils/marketplace';
import type { SearchFilters } from '../types/oficlick';

const EMPTY_FILTERS: SearchFilters = {
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

export const CategoriesPage: React.FC = () => {
  const { db, navigate } = useOfiClick();
  const [query, setQuery] = useState('');
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null);

  const activeCategories = useMemo(
    () =>
      db.categories
        .filter((c) => c.active)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .filter((c) => {
          const q = query.trim().toLowerCase();
          if (!q) return true;
          return (
            c.name.toLowerCase().includes(q) ||
            c.description.toLowerCase().includes(q) ||
            c.subcategories.some((s) => s.name.toLowerCase().includes(q))
          );
        }),
    [db.categories, query]
  );

  const publishedPros = useMemo(
    () => db.professionals.filter((p) => p.published && p.profileComplete && !p.pausedByAdmin),
    [db.professionals]
  );

  return (
    <main className="bg-[#F5F1E8] dark:bg-[#171B19] min-h-[80vh]">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#304B3E] dark:text-[#9CB08D] uppercase tracking-wider">
              Catálogo oficial de oficios y servicios
            </p>
            <h1 className="font-display font-bold text-3xl text-[#252A27] dark:text-[#F5F1E8] mt-1">
              Categorías en OFI CLICK
            </h1>
            <p className="text-sm text-[#73766F] dark:text-[#A3A89F] mt-1 max-w-2xl">
              Explora todas las especialidades disponibles con freelancers locales verificados en Cuautitlán Izcalli.
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 text-[#73766F] absolute left-3.5 top-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar categoría o subcategoría..."
              className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#222825]"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeCategories.map((cat) => {
            const prosInCat = publishedPros.filter((p) => p.categoryIds.includes(cat.id)).length;
            const expanded = expandedCatId === cat.id;
            const activeSubs = cat.subcategories.filter((s) => s.active);

            return (
              <article
                key={cat.id}
                className="rounded-2xl bg-[#FFFCF7] dark:bg-[#222825] border border-[#DDD5C8] dark:border-white/10 p-5 flex flex-col justify-between gap-4 shadow-xs"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#EAE3D6] dark:bg-white/10 flex items-center justify-center">
                      <CategoryIcon
                        name={cat.iconName}
                        className="w-5 h-5 text-[#304B3E] dark:text-[#B96F50]"
                      />
                    </div>
                    <span className="text-xs font-mono-num text-[#73766F] dark:text-[#A3A89F]">
                      {prosInCat} {prosInCat === 1 ? 'freelancer' : 'freelancers'}
                    </span>
                  </div>

                  <div>
                    <h2 className="font-display font-bold text-base text-[#252A27] dark:text-[#F5F1E8]">
                      {cat.name}
                    </h2>
                    <p className="text-xs text-[#73766F] dark:text-[#A3A89F] mt-1 leading-relaxed">
                      {cat.description}
                    </p>
                  </div>

                  {activeSubs.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setExpandedCatId(expanded ? null : cat.id)}
                        className="text-xs font-semibold text-[#304B3E] dark:text-[#B96F50] hover:underline"
                      >
                        {expanded
                          ? 'Ocultar subcategorías'
                          : `Ver ${activeSubs.length} subcategorías`}
                      </button>
                      {expanded && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {activeSubs.map((sub) => (
                            <button
                              key={sub.id}
                              type="button"
                              onClick={() =>
                                navigate({
                                  page: 'explore',
                                  categoryId: cat.id,
                                  query: sub.name,
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-[#EAE3D6]/70 dark:bg-white/8 text-[11px] font-medium hover:bg-[#B96F50]/20 text-left"
                            >
                              {sub.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-[#DDD5C8] dark:border-white/10 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => navigate({ page: 'explore', categoryId: cat.id })}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#304B3E] dark:text-[#B96F50] hover:underline"
                  >
                    Explorar especialistas
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate({ page: 'request-new', preselectedCategoryId: cat.id })}
                    className="px-3 py-1.5 rounded-lg bg-[#304B3E] hover:bg-[#243A30] text-white text-xs font-semibold transition-colors"
                  >
                    Solicitar
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
};

export const HowItWorksPage: React.FC = () => {
  const { navigate, openAuthModal, requireAuth } = useOfiClick();

  return (
    <main className="bg-[#F5F1E8] dark:bg-[#171B19] min-h-[80vh]">
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12 space-y-10">
        <div className="space-y-3">
          <p className="text-xs font-semibold text-[#304B3E] dark:text-[#9CB08D] uppercase tracking-wider">
            Guía de uso para clientes y freelancers
          </p>
          <h1 className="font-display font-bold text-3xl sm:text-4xl text-[#252A27] dark:text-[#F5F1E8]">
            Cómo funciona OFI CLICK
          </h1>
          <p className="text-base text-[#73766F] dark:text-[#A3A89F] max-w-2xl leading-relaxed">
            Conectamos directamente a clientes con freelancers y profesionales independientes verificados en Cuautitlán Izcalli, sin intermediarios financieros ni comisiones ocultas.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              step: '01',
              title: 'Explora o publica tu necesidad',
              text: 'Busca por categoría, colonia o calificación, o crea una solicitud dirigida manualmente o a todos los freelancers compatibles en tu zona.',
            },
            {
              step: '02',
              title: 'Compara cotizaciones claras',
              text: 'Recibe presupuestos detallados en MXN (mano de obra, materiales y vigencia), resuelve dudas por chat privado y aprueba la versión que más te convenga.',
            },
            {
              step: '03',
              title: 'Da seguimiento y califica',
              text: 'Visualiza el progreso paso a paso hasta confirmar la finalización. El pago se acuerda directamente entre tú y el profesional, y solo trabajos completados habilitan reseñas.',
            },
          ].map((item) => (
            <div
              key={item.step}
              className="rounded-2xl bg-[#FFFCF7] dark:bg-[#222825] border border-[#DDD5C8] dark:border-white/10 p-6 space-y-2.5 shadow-xs"
            >
              <span className="font-mono-num text-2xl font-bold text-[#B96F50]">{item.step}</span>
              <h2 className="font-display font-bold text-lg text-[#252A27] dark:text-[#F5F1E8]">
                {item.title}
              </h2>
              <p className="text-sm text-[#73766F] dark:text-[#A3A89F] leading-relaxed">
                {item.text}
              </p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-[#FFFCF7] dark:bg-[#222825] border border-[#DDD5C8] dark:border-white/10 p-6 space-y-3 shadow-xs">
            <h2 className="font-display font-bold text-lg flex items-center gap-2 text-[#252A27] dark:text-[#F5F1E8]">
              <ShieldCheck className="w-5 h-5 text-[#304B3E] dark:text-[#9CB08D]" />
              Niveles de verificación transparentes
            </h2>
            <ul className="space-y-2 text-sm text-[#73766F] dark:text-[#A3A89F]">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#75836A] shrink-0 mt-0.5" />
                <span>Nivel 1 y 2: Cuenta registrada y correo confirmado.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#75836A] shrink-0 mt-0.5" />
                <span>Nivel 3: Perfil profesional revisado por administración de OFI CLICK.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#75836A] shrink-0 mt-0.5" />
                <span>Nivel 4: Credenciales e identificación revisadas de forma privada.</span>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl bg-[#FFFCF7] dark:bg-[#222825] border border-[#DDD5C8] dark:border-white/10 p-6 space-y-3 shadow-xs">
            <h2 className="font-display font-bold text-lg flex items-center gap-2 text-[#252A27] dark:text-[#F5F1E8]">
              <MapPin className="w-5 h-5 text-[#304B3E] dark:text-[#9CB08D]" />
              Privacidad de ubicación y acuerdos directos
            </h2>
            <ul className="space-y-2 text-sm text-[#73766F] dark:text-[#A3A89F]">
              <li className="flex items-start gap-2">
                <Star className="w-4 h-4 text-[#B96F50] shrink-0 mt-0.5" />
                <span>Los perfiles muestran colonias y radios aproximados, nunca domicilios privados.</span>
              </li>
              <li className="flex items-start gap-2">
                <UserCheck className="w-4 h-4 text-[#B96F50] shrink-0 mt-0.5" />
                <span>Dirección exacta compartida únicamente tras aceptar una cotización formal.</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="rounded-2xl bg-[#304B3E] text-[#FFFCF7] p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div>
            <h2 className="font-display font-bold text-xl">¿Listo para comenzar en OFI CLICK?</h2>
            <p className="text-sm text-[#F5F1E8]/85 mt-1">
              Solicita un servicio hoy mismo o publica tu perfil profesional independiente.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() =>
                requireAuth('crear una solicitud', () => navigate({ page: 'request-new' }))
              }
              className="px-4 py-2.5 rounded-xl bg-[#FFFCF7] text-[#304B3E] text-xs font-bold hover:bg-[#EAE3D6] transition-colors"
            >
              Solicitar servicio
            </button>
            <button
              type="button"
              onClick={() => openAuthModal('register')}
              className="px-4 py-2.5 rounded-xl bg-[#B96F50] text-white text-xs font-bold hover:bg-[#a65e41] transition-colors"
            >
              Registrarme como freelancer
            </button>
          </div>
        </div>
      </section>
    </main>
  );
};

export const ProfessionalsDirectoryPage: React.FC<{
  initialQuery?: string;
  initialCategoryId?: string;
}> = ({ initialQuery = '', initialCategoryId = '' }) => {
  const { db, navigate, openAuthModal } = useOfiClick();
  const [query, setQuery] = useState(initialQuery);
  const [categoryId, setCategoryId] = useState(initialCategoryId);
  const [colonia, setColonia] = useState('');

  const activeRegion = db.regions.find((r) => r.active) || db.regions[0];
  const activeCategories = db.categories.filter((c) => c.active);

  const pros = useMemo(
    () =>
      filterAndSortProfessionals(
        db.professionals,
        db.services,
        {
          ...EMPTY_FILTERS,
          query,
          categoryId,
          colonia,
        },
        'rating'
      ),
    [db.professionals, db.services, query, categoryId, colonia]
  );

  return (
    <main className="bg-[#F5F1E8] dark:bg-[#171B19] min-h-[80vh]">
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-[#304B3E] dark:text-[#9CB08D] uppercase tracking-wider">
              Directorio verificado de talento local
            </p>
            <h1 className="font-display font-bold text-3xl text-[#252A27] dark:text-[#F5F1E8] mt-1">
              Freelancers en OFI CLICK
            </h1>
            <p className="text-sm text-[#73766F] dark:text-[#A3A89F] mt-1">
              Profesionales independientes activos en Cuautitlán Izcalli listos para cotizar tu proyecto.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => navigate({ page: 'explore' })}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#222825] text-xs font-semibold hover:border-[#304B3E]"
            >
              Ver en mapa interactivo
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => openAuthModal('register')}
              className="px-4 py-2 rounded-xl bg-[#B96F50] hover:bg-[#a65e41] text-white text-xs font-bold transition-colors"
            >
              Ofrecer mis servicios
            </button>
          </div>
        </div>

        <div className="rounded-2xl bg-[#FFFCF7] dark:bg-[#222825] border border-[#DDD5C8] dark:border-white/10 p-4 grid grid-cols-1 md:grid-cols-3 gap-3 shadow-xs">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nombre, oficio o servicio..."
            className="px-3.5 py-2 text-sm rounded-xl border border-[#DDD5C8] dark:border-white/15 bg-[#F5F1E8]/60 dark:bg-black/20"
          />
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="px-3.5 py-2 text-sm rounded-xl border border-[#DDD5C8] dark:border-white/15 bg-[#F5F1E8]/60 dark:bg-black/20"
          >
            <option value="">Todas las categorías</option>
            {activeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={colonia}
            onChange={(e) => setColonia(e.target.value)}
            className="px-3.5 py-2 text-sm rounded-xl border border-[#DDD5C8] dark:border-white/15 bg-[#F5F1E8]/60 dark:bg-black/20"
          >
            <option value="">Todas las colonias</option>
            {activeRegion.colonias.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {pros.length === 0 ? (
            <div className="lg:col-span-2 rounded-2xl bg-[#FFFCF7] dark:bg-[#222825] border border-[#DDD5C8] dark:border-white/10 p-10 text-center">
              <p className="font-display font-bold text-lg text-[#252A27] dark:text-[#F5F1E8]">
                No encontramos freelancers con esos criterios
              </p>
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setCategoryId('');
                  setColonia('');
                }}
                className="mt-3 px-4 py-2 rounded-lg bg-[#304B3E] hover:bg-[#243A30] text-white text-xs font-semibold"
              >
                Limpiar búsqueda
              </button>
            </div>
          ) : (
            pros.map((pro) => (
              <ProfessionalCard
                key={pro.id}
                pro={pro}
                services={db.services}
                onSelect={() => navigate({ page: 'pro-profile', proId: pro.id })}
              />
            ))
          )}
        </div>
      </section>
    </main>
  );
};
