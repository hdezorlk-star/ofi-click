import React, { useEffect, useState } from 'react';
import { Calendar, CheckCircle2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { PortfolioItem } from '../../types/oficlick';
import { formatMXN } from '../../utils/marketplace';
import { SafeImage } from '../SafeImage';

interface PortfolioGalleryModalProps {
  item: PortfolioItem | null;
  categoryName?: string;
  initialIndex?: number;
  onClose: () => void;
}

export const PortfolioGalleryModal: React.FC<PortfolioGalleryModalProps> = ({
  item,
  categoryName,
  initialIndex = 0,
  onClose,
}) => {
  const [activeIdx, setActiveIdx] = useState(initialIndex);

  useEffect(() => {
    setActiveIdx(initialIndex);
  }, [item?.id, initialIndex]);

  useEffect(() => {
    if (!item) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && item.photos.length > 1) {
        setActiveIdx((prev) => (prev + 1) % item.photos.length);
      }
      if (e.key === 'ArrowLeft' && item.photos.length > 1) {
        setActiveIdx((prev) => (prev - 1 + item.photos.length) % item.photos.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  const photos = item.photos.length > 0 ? item.photos : [''];
  const currentIdx = Math.min(activeIdx, photos.length - 1);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="portfolio-lightbox-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-6 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl rounded-2xl bg-[#FFFCF7] dark:bg-[#222825] border border-[#DDD5C8] dark:border-white/15 overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 border-b border-[#DDD5C8] dark:border-white/10 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#304B3E] dark:text-[#B96F50] flex items-center gap-1.5">
              {item.origin === 'oficlick_completed' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Trabajo contratado y completado en OFI CLICK
                </>
              ) : (
                <>
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  Fotografía aportada al portafolio
                </>
              )}
              {categoryName && <span>· {categoryName}</span>}
            </p>
            <h3
              id="portfolio-lightbox-title"
              className="font-display font-bold text-base sm:text-lg text-[#252A27] dark:text-[#F5F1E8] truncate"
            >
              {item.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar galería de proyecto"
            className="p-2 rounded-lg border border-[#DDD5C8] dark:border-white/15 text-[#73766F] hover:text-[#252A27] dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Enlarged Main Image */}
        <div className="relative bg-[#171B19] flex items-center justify-center min-h-[260px] max-h-[60vh]">
          <SafeImage
            src={photos[currentIdx]}
            alt={`${item.title} - foto ${currentIdx + 1}`}
            fallbackLabel={item.title}
            className="w-full max-h-[60vh] object-contain"
          />

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setActiveIdx((prev) => (prev - 1 + photos.length) % photos.length)}
                aria-label="Foto anterior"
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/65 text-white hover:bg-black/85"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => setActiveIdx((prev) => (prev + 1) % photos.length)}
                aria-label="Foto siguiente"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-black/65 text-white hover:bg-black/85"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-md bg-black/70 text-white text-xs font-mono-num">
                {currentIdx + 1} / {photos.length}
              </span>
            </>
          )}
        </div>

        {/* Thumbnails */}
        {photos.length > 1 && (
          <div className="px-5 py-3 bg-[#EAE3D6]/50 dark:bg-[#1C211E] border-t border-[#DDD5C8] dark:border-white/10 flex items-center gap-2 overflow-x-auto">
            {photos.map((photo, idx) => (
              <button
                key={`${item.id}-thumb-${idx}`}
                type="button"
                onClick={() => setActiveIdx(idx)}
                aria-label={`Ver fotografía ${idx + 1}`}
                className={`w-16 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                  idx === currentIdx
                    ? 'border-[#B96F50] ring-2 ring-[#B96F50]/30'
                    : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <SafeImage
                  src={photo}
                  alt={`Miniatura ${idx + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        )}

        {/* Project Details */}
        <div className="p-5 space-y-2.5 text-sm">
          <p className="text-[#252A27]/90 dark:text-[#F5F1E8]/90 leading-relaxed">
            {item.description}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#73766F] dark:text-[#A3A89F]">
            <span>
              <strong>Servicio:</strong> {item.servicePerformed}
            </span>
            <span>
              <strong>Fecha aprox.:</strong> {item.approximateDate}
            </span>
            {item.approximateDuration && (
              <span>
                <strong>Duración:</strong> {item.approximateDuration}
              </span>
            )}
            {item.optionalPrice !== undefined && item.optionalPrice > 0 && (
              <span className="font-mono-num">
                <strong>Precio ref.:</strong> {formatMXN(item.optionalPrice)}
              </span>
            )}
          </div>
          {item.optionalMaterials && (
            <p className="text-xs text-[#73766F] dark:text-[#A3A89F]">
              <strong>Materiales utilizados:</strong> {item.optionalMaterials}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
