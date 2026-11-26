import React, { useState } from 'react';
import { Download, Smartphone, WifiOff, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const PWAInstallButton: React.FC<{ variant?: 'header' | 'banner' }> = ({
  variant = 'banner',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={
          variant === 'header'
            ? 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[#DBD4C6] dark:border-[#F7F3EA]/20 text-[#1D252C] dark:text-[#F7F3EA] hover:bg-[#ECE7DC]/60 dark:hover:bg-white/10 transition-colors whitespace-nowrap shrink-0'
            : 'inline-flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg bg-[#214438] text-white hover:bg-[#183329] transition-colors whitespace-nowrap shrink-0'
        }
      >
        <Download className="w-3.5 h-3.5" aria-hidden="true" />
        <span>Instalar app</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#FFFDFA] dark:bg-[#1A2128] border border-[#DBD4C6] dark:border-white/10 p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-[#C7582B]" aria-hidden="true" />
                <h3
                  id="pwa-guide-title"
                  className="font-display text-lg font-semibold text-[#1D252C] dark:text-[#F7F3EA]"
                >
                  Instalar OFI CLICK en tu dispositivo
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="Cerrar guía de instalación"
                className="p-1.5 rounded-lg text-[#73766F] hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <ol className="mt-4 space-y-2 text-sm text-[#1D252C]/85 dark:text-[#F7F3EA]/85 list-decimal list-inside">
                <li>Toca el botón Compartir en la barra inferior de Safari.</li>
                <li>Desplázate y selecciona “Agregar a inicio”.</li>
                <li>Confirma tocando “Agregar” para abrir OFI CLICK como app independiente.</li>
              </ol>
            ) : (
              <p className="mt-4 text-sm text-[#1D252C]/85 dark:text-[#F7F3EA]/85 leading-relaxed">
                En Chrome, Edge o navegador móvil, abre el menú del navegador y elige{' '}
                <strong className="font-semibold">“Instalar aplicación”</strong> o{' '}
                <strong className="font-semibold">“Agregar a pantalla principal”</strong>.
                OFI CLICK almacenará recursos estáticos para consulta rápida.
              </p>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-[#214438] hover:bg-[#183329] text-white transition-colors"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-20 md:bottom-5 left-4 z-50 flex items-center gap-2 rounded-xl bg-[#1D252C] dark:bg-[#C7582B] text-[#F7F3EA] dark:text-white px-3.5 py-2 text-xs font-medium shadow-lg border border-white/10"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>
        Sin conexión: puedes consultar datos guardados; cotizaciones y mensajes requieren internet.
      </span>
    </div>
  );
};
