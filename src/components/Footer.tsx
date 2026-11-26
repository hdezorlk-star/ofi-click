import React from 'react';
import { Monitor, Moon, RotateCcw, Sun } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { PWAInstallButton } from './PWAControls';
import { useOfiClick } from '../context/OfiClickContext';

export const Footer: React.FC = () => {
  const { navigate, theme, setTheme, resetLocalWorkspace, dataMode, refreshDb, notify } = useOfiClick();

  return (
    <footer className="border-t border-[#DBD4C6] dark:border-white/10 bg-[#1D252C] text-[#F7F3EA]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-white/12">
          <div className="md:col-span-5 space-y-3">
            <BrandLogo variant="horizontal" size="md" />
            <p className="text-sm text-[#F7F3EA]/75 max-w-sm leading-relaxed">
              Encuentra talento. Haz que suceda. Marketplace local de servicios
              profesionales con cobertura en todo Cuautitlán Izcalli, Estado de México.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <PWAInstallButton variant="banner" />
              <div
                className="inline-flex items-center p-1 rounded-lg bg-[#12171C] border border-white/12"
                role="group"
                aria-label="Preferencia de tema"
              >
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  aria-label="Modo claro"
                  className={`p-1.5 rounded-md transition-colors ${
                    theme === 'light'
                      ? 'bg-[#214438] text-white'
                      : 'text-[#F7F3EA]/65 hover:text-white'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('dark')}
                  aria-label="Modo oscuro"
                  className={`p-1.5 rounded-md transition-colors ${
                    theme === 'dark'
                      ? 'bg-[#C7582B] text-white'
                      : 'text-[#F7F3EA]/65 hover:text-white'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('system')}
                  aria-label="Seguir sistema operativo"
                  className={`p-1.5 rounded-md transition-colors ${
                    theme === 'system'
                      ? 'bg-[#5B6B5F] text-white'
                      : 'text-[#F7F3EA]/65 hover:text-white'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 space-y-2.5 text-sm">
            <h4 className="font-display font-semibold text-xs text-[#F7F3EA]/60">
              Marketplace
            </h4>
            <ul className="space-y-2 text-[#F7F3EA]/90">
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'explore' })}
                  className="hover:text-[#E58359] transition-colors"
                >
                  Explorar mapa
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'categories' })}
                  className="hover:text-[#E58359] transition-colors"
                >
                  Categorías
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'how-it-works' })}
                  className="hover:text-[#E58359] transition-colors"
                >
                  Cómo funciona
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'professionals' })}
                  className="hover:text-[#E58359] transition-colors"
                >
                  Freelancers
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'compare' })}
                  className="hover:text-[#E58359] transition-colors"
                >
                  Comparar perfiles
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'request-new' })}
                  className="hover:text-[#E58359] transition-colors"
                >
                  Solicitar servicio
                </button>
              </li>
            </ul>
          </div>

          <div className="md:col-span-2 space-y-2.5 text-sm">
            <h4 className="font-display font-semibold text-xs text-[#F7F3EA]/60">
              Legal y soporte
            </h4>
            <ul className="space-y-2 text-[#F7F3EA]/90">
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'legal', section: 'privacy' })}
                  className="hover:text-[#E58359] transition-colors"
                >
                  Privacidad
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'legal', section: 'terms' })}
                  className="hover:text-[#E58359] transition-colors"
                >
                  Términos de uso
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'legal', section: 'contact' })}
                  className="hover:text-[#E58359] transition-colors"
                >
                  Contacto
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'legal', section: 'support' })}
                  className="hover:text-[#E58359] transition-colors"
                >
                  Centro de ayuda
                </button>
              </li>
            </ul>
          </div>

          <div className="md:col-span-3 space-y-2.5 text-sm">
            {dataMode === 'supabase' ? (
              <>
                <h4 className="font-display font-semibold text-xs text-[#F7F3EA]/60">
                  Plataforma en la nube
                </h4>
                <p className="text-xs text-[#F7F3EA]/75 leading-relaxed">
                  Tu cuenta, solicitudes, cotizaciones y mensajes se sincronizan directamente con
                  Supabase y almacenamiento seguro.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    refreshDb();
                    notify('Vista sincronizada con la base de datos.', 'info');
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#E58359] hover:underline"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  Sincronizar datos
                </button>
              </>
            ) : (
              <>
                <h4 className="font-display font-semibold text-xs text-[#F7F3EA]/60">
                  Datos
                </h4>
                <p className="text-xs text-[#F7F3EA]/75 leading-relaxed">
                </p>
                <button
                  type="button"
                  onClick={resetLocalWorkspace}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#E58359] hover:underline"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                
                </button>
              </>
            )}
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#F7F3EA]/65">
          <span>© 2026 OFI CLICK México · Cuautitlán Izcalli, Estado de México</span>
          <span>Precios expresados en MXN · Acuerdos de pago directos fuera de la plataforma</span>
        </div>
      </div>
    </footer>
  );
};
