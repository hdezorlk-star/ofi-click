import React from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useOfiClick } from '../context/OfiClickContext';
import { formatMXN, getProMinPublishedPrice } from '../utils/marketplace';
import { getPublicProAvatar } from '../utils/media';
import { AvailabilityLabel, VerificationLabel } from '../components/ProfessionalCard';
import { SafeImage } from '../components/SafeImage';

export const ComparePage: React.FC = () => {
  const { db, compareIds, toggleCompare, clearCompare, navigate, requireAuth } = useOfiClick();

  const selectedPros = compareIds
    .map((id) => db.professionals.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => !!p);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 min-h-[75vh]">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate({ page: 'explore' })}
            className="p-2 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#FFFCF7] dark:bg-[#222825] hover:bg-[#EAE3D6] dark:hover:bg-white/10"
            aria-label="Volver a explorar"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-display font-bold text-2xl text-[#252A27] dark:text-[#F5F1E8]">
              Comparar profesionales ({selectedPros.length}/3)
            </h1>
            <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">
              Evalúa especialidad, calificación, precios orientativos, cobertura y verificación.
            </p>
          </div>
        </div>
        {selectedPros.length > 0 && (
          <button
            type="button"
            onClick={clearCompare}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpiar comparación
          </button>
        )}
      </div>

      {selectedPros.length === 0 ? (
        <div className="rounded-2xl bg-[#FFFCF7] dark:bg-[#222825] border border-[#DDD5C8] dark:border-white/10 p-10 text-center">
          <p className="font-display font-semibold text-base text-[#252A27] dark:text-[#F5F1E8]">
            Aún no has seleccionado perfiles para comparar
          </p>
          <p className="text-sm text-[#73766F] dark:text-[#A3A89F] mt-1">
            Marca “Comparar” en hasta tres tarjetas desde el explorador.
          </p>
          <button
            type="button"
            onClick={() => navigate({ page: 'explore' })}
            className="mt-4 px-4 py-2 rounded-lg bg-[#304B3E] hover:bg-[#243A30] text-white text-xs font-semibold transition-colors"
          >
            Ir al explorador
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-[#FFFCF7] dark:bg-[#222825] border border-[#DDD5C8] dark:border-white/10 shadow-xs">
          <table className="w-full text-left text-sm border-collapse min-w-[680px]">
            <thead>
              <tr className="border-b border-[#DDD5C8] dark:border-white/10 bg-[#EAE3D6]/40 dark:bg-white/5">
                <th className="p-4 w-48 text-xs font-semibold text-[#73766F] dark:text-[#A3A89F]">Criterio</th>
                {selectedPros.map((pro) => (
                  <th key={pro.id} className="p-4 align-top">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <SafeImage
                          src={getPublicProAvatar(pro)}
                          alt={pro.displayName}
                          className="w-11 h-11 rounded-lg object-cover border border-[#DDD5C8] dark:border-white/10"
                        />
                        <div>
                          <p className="font-display font-bold text-sm text-[#252A27] dark:text-[#F5F1E8]">
                            {pro.commercialName || pro.displayName}
                          </p>
                          <button
                            type="button"
                            onClick={() => toggleCompare(pro.id)}
                            className="text-[11px] text-red-600 dark:text-red-400 hover:underline"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DDD5C8] dark:divide-white/10">
              <tr>
                <td className="p-4 font-medium text-xs text-[#73766F] dark:text-[#A3A89F]">Especialidades</td>
                {selectedPros.map((pro) => (
                  <td key={pro.id} className="p-4 text-xs">
                    {pro.specialties.join(', ')}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-medium text-xs text-[#73766F] dark:text-[#A3A89F]">Calificación</td>
                {selectedPros.map((pro) => (
                  <td key={pro.id} className="p-4 font-mono-num font-semibold text-[#B96F50]">
                    ★ {pro.ratingAvg.toFixed(1)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-medium text-xs text-[#73766F] dark:text-[#A3A89F]">Reseñas</td>
                {selectedPros.map((pro) => (
                  <td key={pro.id} className="p-4 font-mono-num">
                    {pro.reviewsCount} reseñas · {pro.completedJobsCount} trabajos
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-medium text-xs text-[#73766F] dark:text-[#A3A89F]">Precio orientativo</td>
                {selectedPros.map((pro) => {
                  const min = getProMinPublishedPrice(pro.id, db.services);
                  return (
                    <td key={pro.id} className="p-4 font-mono-num font-semibold text-[#304B3E] dark:text-[#EAE3D6]">
                      {min ? `Desde ${formatMXN(min)}` : 'Cotización personalizada'}
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="p-4 font-medium text-xs text-[#73766F] dark:text-[#A3A89F]">Modalidad de atención</td>
                {selectedPros.map((pro) => (
                  <td key={pro.id} className="p-4 text-xs">
                    {[
                      pro.homeService ? 'A domicilio' : null,
                      pro.workshopService ? 'En taller / local' : null,
                      pro.urgentAttention ? 'Atención urgente' : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-medium text-xs text-[#73766F] dark:text-[#A3A89F]">Disponibilidad</td>
                {selectedPros.map((pro) => (
                  <td key={pro.id} className="p-4">
                    <AvailabilityLabel status={pro.availabilityStatus} />
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-medium text-xs text-[#73766F] dark:text-[#A3A89F]">Zona de servicio</td>
                {selectedPros.map((pro) => (
                  <td key={pro.id} className="p-4 text-xs">
                    {pro.primaryColonia}
                    {pro.additionalColonias.length > 0
                      ? `, ${pro.additionalColonias.slice(0, 3).join(', ')}`
                      : ''}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-medium text-xs text-[#73766F] dark:text-[#A3A89F]">Experiencia declarada</td>
                {selectedPros.map((pro) => (
                  <td key={pro.id} className="p-4 font-mono-num">
                    {pro.yearsExperience} años
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 font-medium text-xs text-[#73766F] dark:text-[#A3A89F]">Verificación</td>
                {selectedPros.map((pro) => (
                  <td key={pro.id} className="p-4">
                    <VerificationLabel level={pro.verificationLevel} />
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4" />
                {selectedPros.map((pro) => (
                  <td key={pro.id} className="p-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => navigate({ page: 'pro-profile', proId: pro.id })}
                        className="px-3 py-1.5 rounded-lg border border-[#DDD5C8] dark:border-white/15 bg-[#EAE3D6]/50 dark:bg-white/5 text-xs font-semibold"
                      >
                        Ver perfil
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
                        className="px-3 py-1.5 rounded-lg bg-[#304B3E] hover:bg-[#243A30] text-white text-xs font-semibold transition-colors"
                      >
                        Solicitar
                      </button>
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
};
