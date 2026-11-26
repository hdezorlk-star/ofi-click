import React from 'react';
import { Monitor, Moon, RotateCcw, Sun } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { PWAInstallButton } from './PWAControls';
import { useOfiClick } from '../context/OfiClickContext';

export const Footer: React.FC = () => {
  const { navigate, theme, setTheme, resetLocalWorkspace } = useOfiClick();

  return (
    <footer className="border-t border-[#DDD5C8] dark:border-white/10 bg-[#EAE3D6] dark:bg-[#191E1B] text-[#252A27] dark:text-[#F5F1E8]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-[#DDD5C8] dark:border-white/10">
          <div className="md:col-span-5 space-y-3">
            <BrandLogo variant="horizontal" size="md" />
            <p className="text-sm text-[#73766F] dark:text-[#A3A89F] max-w-sm leading-relaxed">
              Encuentra talento. Haz que suceda. Marketplace local de servicios
              profesionales con lanzamiento en Cuautitlán Izcalli, Estado de México.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-3">
              <PWAInstallButton variant="banner" />
              <div
                className="inline-flex items-center p-1 rounded-lg bg-[#FFFCF7] dark:bg-black/30 border border-[#DDD5C8] dark:border-white/10"
                role="group"
                aria-label="Preferencia de tema"
              >
                <button
                  type="button"
                  onClick={() => setTheme('light')}
                  aria-label="Modo claro"
                  className={`p-1.5 rounded-md transition-colors ${
                    theme === 'light'
                      ? 'bg-[#304B3E] text-white'
                      : 'text-[#73766F] hover:text-[#252A27] dark:hover:text-white'
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
                      ? 'bg-[#B96F50] text-white'
                      : 'text-[#73766F] hover:text-[#252A27] dark:hover:text-white'
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
                      ? 'bg-[#75836A] text-white'
                      : 'text-[#73766F] hover:text-[#252A27] dark:hover:text-white'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 space-y-2.5 text-sm">
            <h4 className="font-display font-semibold text-xs text-[#73766F] dark:text-[#A3A89F]">
              Marketplace
            </h4>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'explore' })}
                  className="hover:text-[#304B3E] dark:hover:text-[#B96F50]"
                >
                  Explorar mapa
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'categories' })}
                  className="hover:text-[#304B3E] dark:hover:text-[#B96F50]"
                >
                  Categorías
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'how-it-works' })}
                  className="hover:text-[#304B3E] dark:hover:text-[#B96F50]"
                >
                  Cómo funciona
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'professionals' })}
                  className="hover:text-[#304B3E] dark:hover:text-[#B96F50]"
                >
                  Freelancers
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'compare' })}
                  className="hover:text-[#304B3E] dark:hover:text-[#B96F50]"
                >
                  Comparar perfiles
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'request-new' })}
                  className="hover:text-[#304B3E] dark:hover:text-[#B96F50]"
                >
                  Solicitar servicio
                </button>
              </li>
            </ul>
          </div>

          <div className="md:col-span-2 space-y-2.5 text-sm">
            <h4 className="font-display font-semibold text-xs text-[#73766F] dark:text-[#A3A89F]">
              Legal y soporte
            </h4>
            <ul className="space-y-2">
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'legal', section: 'privacy' })}
                  className="hover:text-[#304B3E] dark:hover:text-[#B96F50]"
                >
                  Privacidad
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'legal', section: 'terms' })}
                  className="hover:text-[#304B3E] dark:hover:text-[#B96F50]"
                >
                  Términos de uso
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'legal', section: 'contact' })}
                  className="hover:text-[#304B3E] dark:hover:text-[#B96F50]"
                >
                  Contacto
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate({ page: 'legal', section: 'support' })}
                  className="hover:text-[#304B3E] dark:hover:text-[#B96F50]"
                >
                  Centro de ayuda
                </button>
              </li>
            </ul>
          </div>

          <div className="md:col-span-3 space-y-2.5 text-sm">
            <h4 className="font-display font-semibold text-xs text-[#73766F] dark:text-[#A3A89F]">
              Datos locales
            </h4>
            <p className="text-xs text-[#73766F] dark:text-[#A3A89F] leading-relaxed">
              Tus solicitudes, cotizaciones y mensajes se guardan localmente en este navegador en MXN.
            </p>
            <button
              type="button"
              onClick={resetLocalWorkspace}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#304B3E] dark:text-[#EAE3D6] hover:underline"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Restablecer datos locales
            </button>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#73766F] dark:text-[#A3A89F]">
          <span>© 2026 OFI CLICK México · Cuautitlán Izcalli, Estado de México</span>
          <span>Precios expresados en MXN · Acuerdos de pago directos fuera de la plataforma</span>
        </div>
      </div>
    </footer>
  );
};
