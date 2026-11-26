import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  MapPin,
  Search,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { useOfiClick } from '../context/OfiClickContext';
import { LOCAL_IMAGES } from '../adapters/local/seed-data';
import { CategoryIcon } from '../components/CategoryIcon';
import { ProfessionalCard } from '../components/ProfessionalCard';
import { SafeImage } from '../components/SafeImage';
import { formatPricingLabel } from '../utils/marketplace';

const SEARCH_EXAMPLES = [
  'Reparar una fuga de agua',
  'Instalar lámparas',
  'Pintar una habitación',
  'Construir una barda',
  'Cambiar una cerradura',
  'Instalar cámaras de seguridad',
];

const FAQS = [
  {
    q: '¿Tiene algún costo explorar o solicitar cotizaciones en OFI CLICK?',
    a: 'No. En esta primera versión puedes explorar profesionales, comparar perfiles, enviar solicitudes y recibir cotizaciones sin comisiones ni suscripciones.',
  },
  {
    q: '¿Cómo se realizan los pagos por un servicio contratado?',
    a: 'Cliente y profesional acuerdan directamente la forma de pago (efectivo o transferencia) fuera de OFI CLICK. La plataforma registra el importe acordado en la cotización aceptada para mantener claridad.',
  },
  {
    q: '¿Por qué los perfiles muestran zonas aproximadas en el mapa?',
    a: 'Por privacidad, nunca publicamos domicilios particulares de profesionales ni de clientes. La dirección exacta del servicio solo se comparte con las partes autorizadas al concretar la contratación.',
  },
  {
    q: '¿Cómo funcionan las verificaciones de profesionales?',
    a: 'Distinguimos entre cuenta registrada, correo confirmado, perfil revisado y credenciales revisadas con documentación privada. Nunca mostramos insignias sin revisión previa.',
  },
];

export const LandingPage: React.FC = () => {
  const { db, navigate, openAuthModal, requireAuth } = useOfiClick();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedColonia, setSelectedColonia] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showAllCats, setShowAllCats] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const activeRegion = db.regions.find((r) => r.active) || db.regions[0];
  const activeCategories = useMemo(
    () =>
      db.categories
        .filter((c) => c.active)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    [db.categories]
  );

  const suggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const matches: { label: string; type: string; query: string; categoryId?: string }[] = [];
    for (const cat of activeCategories) {
      if (cat.name.toLowerCase().includes(q)) {
        matches.push({ label: cat.name, type: 'Categoría', query: '', categoryId: cat.id });
      }
    }
    for (const srv of db.services.filter((s) => s.status === 'published')) {
      if (srv.name.toLowerCase().includes(q)) {
        matches.push({ label: srv.name, type: 'Servicio', query: srv.name });
      }
    }
    for (const ex of SEARCH_EXAMPLES) {
      if (ex.toLowerCase().includes(q)) {
        matches.push({ label: ex, type: 'Búsqueda frecuente', query: ex });
      }
    }
    return matches.slice(0, 6);
  }, [activeCategories, db.services, searchQuery]);

  const publishedPros = useMemo(
    () => db.professionals.filter((p) => p.published && p.profileComplete && !p.pausedByAdmin),
    [db.professionals]
  );

  const recommendedPros = useMemo(() => publishedPros.slice(0, 3), [publishedPros]);

  const topRatedPros = useMemo(
    () =>
      [...publishedPros]
        .sort((a, b) => b.ratingAvg - a.ratingAvg || b.reviewsCount - a.reviewsCount)
        .slice(0, 3),
    [publishedPros]
  );

  const popularServices = useMemo(
    () => db.services.filter((s) => s.status === 'published').slice(0, 4),
    [db.services]
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    navigate({
      page: 'explore',
      query: searchQuery.trim(),
      colonia: selectedColonia,
    });
  };

  return (
    <main className="bg-[#F5F1E8] dark:bg-[#171B19]">
      {/* 1. HERO SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-14 lg:pt-14 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-center">
            <p className="inline-flex items-center gap-2 text-xs font-semibold text-[#304B3E] dark:text-[#9CB08D] tracking-wide mb-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#B96F50]" aria-hidden="true" />
              Cuautitlán Izcalli, Estado de México · Precios en MXN
            </p>
            <h1 className="font-display font-extrabold text-[clamp(2.15rem,4vw,3.5rem)] leading-[1.08] tracking-tight text-[#252A27] dark:text-[#F5F1E8] text-balance">
              Encuentra al profesional ideal para lo que necesitas
            </h1>
            <p className="mt-4 text-base text-[#252A27]/80 dark:text-[#F5F1E8]/75 max-w-xl leading-relaxed">
              Compara freelancers y profesionales independientes verificados en tu colonia, solicita
              cotizaciones detalladas sin costo de intermediación y da seguimiento
              completo a cada trabajo.
            </p>

            {/* Central Search Bar + Location Selector + Autocomplete */}
            <form
              onSubmit={handleSearchSubmit}
              className="mt-7 relative bg-[#FFFCF7] dark:bg-[#222825] rounded-2xl border border-[#DDD5C8] dark:border-white/15 p-2 shadow-sm"
            >
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                <div className="sm:col-span-6 relative">
                  <label htmlFor="hero-search-input" className="sr-only">
                    ¿Qué servicio necesitas?
                  </label>
                  <Search
                    className="w-4 h-4 text-[#73766F] absolute left-3.5 top-3.5"
                    aria-hidden="true"
                  />
                  <input
                    id="hero-search-input"
                    type="text"
                    value={searchQuery}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowSuggestions(true);
                    }}
                    placeholder="Ej. Reparar una fuga de agua"
                    className="w-full pl-10 pr-3 py-2.5 text-sm rounded-xl bg-transparent text-[#252A27] dark:text-[#F5F1E8] placeholder:text-[#73766F] focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-4 relative border-t sm:border-t-0 sm:border-l border-[#DDD5C8] dark:border-white/10 pt-2 sm:pt-0 sm:pl-2">
                  <label htmlFor="hero-colonia-select" className="sr-only">
                    Colonia en Cuautitlán Izcalli
                  </label>
                  <MapPin
                    className="w-4 h-4 text-[#73766F] absolute left-3.5 top-4.5 sm:top-3"
                    aria-hidden="true"
                  />
                  <select
                    id="hero-colonia-select"
                    value={selectedColonia}
                    onChange={(e) => setSelectedColonia(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl bg-transparent text-[#252A27] dark:text-[#F5F1E8] focus:outline-none"
                  >
                    <option value="">Todo Cuautitlán Izcalli</option>
                    {activeRegion.colonias.map((col) => (
                      <option key={col} value={col}>
                        {col}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 rounded-xl bg-[#304B3E] hover:bg-[#243A30] text-white text-sm font-semibold transition-colors whitespace-nowrap"
                  >
                    Buscar
                  </button>
                </div>
              </div>

              {showSuggestions && suggestions.length > 0 && (
                <ul
                  role="listbox"
                  aria-label="Sugerencias de búsqueda"
                  className="absolute left-0 right-0 top-full mt-2 z-30 rounded-xl bg-[#FFFCF7] dark:bg-[#222825] border border-[#DDD5C8] dark:border-white/15 shadow-xl divide-y divide-[#DDD5C8]/60 dark:divide-white/5 overflow-hidden"
                >
                  {suggestions.map((s, idx) => (
                    <li key={`${s.label}-${idx}`}>
                      <button
                        type="button"
                        onMouseDown={() => {
                          setShowSuggestions(false);
                          navigate({
                            page: 'explore',
                            query: s.query,
                            categoryId: s.categoryId,
                            colonia: selectedColonia,
                          });
                        }}
                        className="w-full px-4 py-2.5 text-left text-sm flex items-center justify-between hover:bg-[#EAE3D6]/70 dark:hover:bg-white/10"
                      >
                        <span className="font-medium text-[#252A27] dark:text-[#F5F1E8]">
                          {s.label}
                        </span>
                        <span className="text-xs text-[#73766F]">{s.type}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </form>

            {/* Interactive search example buttons */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#73766F] dark:text-[#A3A89F]">Búsquedas comunes:</span>
              {SEARCH_EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() =>
                    navigate({
                      page: 'explore',
                      query: example,
                      colonia: selectedColonia,
                    })
                  }
                  className="px-2.5 py-1 text-xs rounded-lg bg-[#FFFCF7] dark:bg-white/5 border border-[#DDD5C8] dark:border-white/10 text-[#252A27] dark:text-[#F5F1E8] hover:border-[#304B3E] dark:hover:border-[#B96F50] transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="h-full min-h-[280px] lg:min-h-[420px] rounded-2xl overflow-hidden border border-[#DDD5C8] dark:border-white/10 shadow-sm relative">
              <SafeImage
                src={LOCAL_IMAGES.hero}
                alt="Especialista realizando instalación de grifería en cocina residencial"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#1D2822]/95 via-[#1D2822]/75 to-transparent pt-14 p-5 text-white">
                <p className="text-xs font-semibold text-[#E8B8A2]">
                  Encuentra talento. Haz que suceda.
                </p>
                <p className="font-display font-semibold text-base mt-0.5">
                  Especialistas locales listos para cotizar en tu colonia
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. POPULAR CATEGORIES */}
      <section
        id="categorias-populares"
        className="bg-[#EAE3D6] dark:bg-[#1C211E] border-t border-[#DDD5C8] dark:border-white/10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#252A27] dark:text-[#F5F1E8]">
                Categorías de servicios
              </h2>
              <p className="mt-1 text-sm text-[#73766F] dark:text-[#A3A89F]">
                Explora las {activeCategories.length} especialidades disponibles en Cuautitlán Izcalli.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAllCats(!showAllCats)}
              className="text-sm font-semibold text-[#304B3E] dark:text-[#B96F50] hover:underline"
            >
              {showAllCats ? 'Ver principales' : `Ver las ${activeCategories.length} categorías`}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {(showAllCats ? activeCategories : activeCategories.slice(0, 10)).map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => navigate({ page: 'explore', categoryId: cat.id })}
                className="group text-left p-4 rounded-xl bg-[#FFFCF7] dark:bg-[#222825] border border-[#DDD5C8] dark:border-white/10 hover:border-[#304B3E] dark:hover:border-[#B96F50] transition-all flex flex-col justify-between gap-3 shadow-xs hover:-translate-y-0.5"
              >
                <CategoryIcon
                  name={cat.iconName}
                  className="w-5 h-5 text-[#304B3E] group-hover:text-[#B96F50] dark:text-[#9CB08D] transition-colors"
                />
                <div>
                  <h3 className="font-display font-semibold text-sm text-[#252A27] dark:text-[#F5F1E8]">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-[#73766F] dark:text-[#A3A89F] mt-0.5 line-clamp-2">
                    {cat.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 3. RECOMMENDED & TOP RATED PROFESSIONALS */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 border-t border-[#DDD5C8] dark:border-white/10">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#252A27] dark:text-[#F5F1E8]">
              Profesionales recomendados y mejor calificados
            </h2>
            <p className="mt-1 text-sm text-[#73766F] dark:text-[#A3A89F]">
              Perfiles activos en Cuautitlán Izcalli con reseñas de contrataciones reales.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate({ page: 'explore' })}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#304B3E] dark:text-[#B96F50] hover:underline"
          >
            Explorar mapa completo
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {recommendedPros.map((pro) => (
            <ProfessionalCard
              key={pro.id}
              pro={pro}
              services={db.services}
              onSelect={() => navigate({ page: 'pro-profile', proId: pro.id })}
            />
          ))}
          {topRatedPros
            .filter((p) => !recommendedPros.some((r) => r.id === p.id))
            .slice(0, 1)
            .map((pro) => (
              <ProfessionalCard
                key={pro.id}
                pro={pro}
                services={db.services}
                onSelect={() => navigate({ page: 'pro-profile', proId: pro.id })}
              />
            ))}
        </div>
      </section>

      {/* 4. POPULAR SERVICES */}
      <section className="bg-[#EAE3D6] dark:bg-[#1C211E] border-t border-[#DDD5C8] dark:border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#252A27] dark:text-[#F5F1E8] mb-6">
            Servicios populares en tu zona
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {popularServices.map((srv, idx) => {
              const pro = db.professionals.find((p) => p.id === srv.professionalId);
              const fallbackImg =
                idx === 0
                  ? LOCAL_IMAGES.plumbing
                  : idx === 1
                  ? LOCAL_IMAGES.hero
                  : idx === 2
                  ? LOCAL_IMAGES.electrical
                  : LOCAL_IMAGES.carpentry;
              return (
                <article
                  key={srv.id}
                  className="rounded-2xl bg-[#FFFCF7] dark:bg-[#222825] border border-[#DDD5C8] dark:border-white/10 overflow-hidden flex flex-col shadow-xs"
                >
                  <div className="aspect-[4/3] overflow-hidden">
                    <SafeImage
                      src={srv.photos[0] || fallbackImg}
                      alt={srv.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">
                        {pro?.commercialName || pro?.displayName} · {pro?.primaryColonia}
                      </p>
                      <h3 className="font-display font-semibold text-sm text-[#252A27] dark:text-[#F5F1E8] mt-1">
                        {srv.name}
                      </h3>
                    </div>
                    <div className="pt-3 border-t border-[#DDD5C8] dark:border-white/10 flex items-center justify-between gap-2">
                      <span className="font-display font-bold text-sm text-[#304B3E] dark:text-[#B96F50] font-mono-num">
                        {formatPricingLabel(srv.pricingMode, srv.priceAmount)}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          requireAuth('solicitar este servicio', () =>
                            navigate({
                              page: 'request-new',
                              preselectedProId: srv.professionalId,
                              preselectedCategoryId: srv.categoryId,
                            })
                          )
                        }
                        className="text-xs font-semibold text-[#304B3E] dark:text-[#F5F1E8] hover:underline"
                      >
                        Solicitar
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. HOW OFI CLICK WORKS & ADVANTAGES */}
      <section
        id="como-funciona"
        className="max-w-7xl mx-auto px-4 sm:px-6 py-14 border-t border-[#DDD5C8] dark:border-white/10"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-6 space-y-6">
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#252A27] dark:text-[#F5F1E8]">
              Cómo funciona OFI CLICK
            </h2>
            <div className="space-y-5">
              {[
                {
                  num: '01.',
                  title: 'Describe lo que necesitas y elige destinatarios',
                  text: 'Selecciona profesionales manualmente o usa la recomendación inteligente sin límite de destinatarios compatibles en tu colonia.',
                },
                {
                  num: '02.',
                  title: 'Recibe cotizaciones detalladas y conversa por chat',
                  text: 'Compara mano de obra, materiales, vigencia y tiempos de entrega. Cada cambio genera una nueva versión clara que tú apruebas.',
                },
                {
                  num: '03.',
                  title: 'Agenda, da seguimiento y califica con respaldo',
                  text: 'Sigue cada etapa desde la programación hasta la confirmación final. Solo contrataciones completadas pueden publicar reseñas.',
                },
              ].map((step) => (
                <div
                  key={step.num}
                  className="pb-5 border-b border-[#DDD5C8] dark:border-white/10 last:border-b-0"
                >
                  <h3 className="font-display font-bold text-base text-[#252A27] dark:text-[#F5F1E8]">
                    <span className="text-[#B96F50] mr-2 font-mono-num">{step.num}</span>
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-[#73766F] dark:text-[#A3A89F] leading-relaxed">
                    {step.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-6 rounded-2xl bg-[#FFFCF7] dark:bg-[#222825] border border-[#DDD5C8] dark:border-white/10 p-6 sm:p-8 flex flex-col justify-between shadow-xs">
            <div>
              <h2 className="font-display font-bold text-2xl text-[#252A27] dark:text-[#F5F1E8]">
                Ventajas de contratar en OFI CLICK
              </h2>
              <ul className="mt-5 space-y-3.5 text-sm text-[#252A27]/85 dark:text-[#F5F1E8]/85">
                <li className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#75836A] dark:text-[#9CB08D] shrink-0 mt-0.5" />
                  <span>
                    Sin comisiones ni cargos ocultos: acuerda el pago directamente con tu profesional.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#304B3E] dark:text-[#9CB08D] shrink-0 mt-0.5" />
                  <span>
                    Niveles reales de verificación documental privada y distinción clara entre portafolio propio y trabajos completados en la plataforma.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <Star className="w-4 h-4 text-[#B96F50] shrink-0 mt-0.5" />
                  <span>
                    Reseñas protegidas: únicamente clientes con contratación completada pueden evaluar.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-[#75836A] dark:text-[#9CB08D] shrink-0 mt-0.5" />
                  <span>
                    Cobertura local especializada en colonias de Cuautitlán Izcalli con privacidad de domicilio.
                  </span>
                </li>
              </ul>
            </div>

            <div className="mt-6 pt-5 border-t border-[#DDD5C8] dark:border-white/10">
              <button
                type="button"
                onClick={() =>
                  requireAuth('crear una solicitud de servicio', () =>
                    navigate({ page: 'request-new' })
                  )
                }
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#304B3E] hover:bg-[#243A30] text-white text-sm font-semibold transition-colors"
              >
                Crear solicitud de servicio
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. PRO REGISTRATION CTA */}
      <section
        id="registro-profesional"
        className="max-w-7xl mx-auto px-4 sm:px-6 py-12"
      >
        <div className="rounded-2xl bg-[#304B3E] text-[#FFFCF7] p-8 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center shadow-sm">
          <div className="lg:col-span-8">
            <p className="text-xs font-semibold text-[#E8B8A2]">
              Para freelancers y profesionales independientes en Cuautitlán Izcalli
            </p>
            <h2 className="font-display font-bold text-2xl sm:text-3xl mt-2 text-balance">
              Publica tus servicios, gestiona cotizaciones y organiza tu agenda en un solo lugar
            </h2>
            <p className="mt-3 text-sm text-[#F5F1E8]/85 max-w-2xl leading-relaxed">
              Crea tu perfil independiente, publica tu catálogo con tarifas claras,
              define tus colonias de cobertura y recibe solicitudes compatibles sin
              límite artificial.
            </p>
          </div>
          <div className="lg:col-span-4 flex lg:justify-end">
            <button
              type="button"
              onClick={() => openAuthModal('register')}
              className="px-6 py-3 rounded-xl bg-[#B96F50] hover:bg-[#a65e41] text-white font-display font-bold text-sm transition-colors whitespace-nowrap"
            >
              Registrarme como freelancer
            </button>
          </div>
        </div>
      </section>

      {/* 7. FAQ */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-14">
        <h2 className="font-display font-bold text-2xl sm:text-3xl text-[#252A27] dark:text-[#F5F1E8] mb-6">
          Preguntas frecuentes
        </h2>
        <div className="divide-y divide-[#DDD5C8] dark:divide-white/10 border-y border-[#DDD5C8] dark:border-white/10">
          {FAQS.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={item.q} className="py-4">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between gap-4 text-left font-display font-semibold text-base text-[#252A27] dark:text-[#F5F1E8]"
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 shrink-0 text-[#73766F] transition-transform ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {isOpen && (
                  <p className="mt-2.5 text-sm text-[#73766F] dark:text-[#A3A89F] leading-relaxed">
                    {item.a}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
};
