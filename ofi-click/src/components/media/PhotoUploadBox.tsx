import React, { useId, useState } from 'react';
import { Camera, RefreshCw, Trash2, Upload, User } from 'lucide-react';
import { readAndResizePublicImage, validateImageFile } from '../../utils/media';

interface PhotoUploadBoxProps {
  label: string;
  helperText?: string;
  value?: string;
  onChange: (nextDataUrl?: string) => void;
  required?: boolean;
  allowRemove?: boolean;
  frontalFaceGuidance?: boolean;
  compact?: boolean;
  maxDimension?: number;
  uploadButtonLabel?: string;
}

export const PhotoUploadBox: React.FC<PhotoUploadBoxProps> = ({
  label,
  helperText,
  value,
  onChange,
  required = false,
  allowRemove = true,
  frontalFaceGuidance = false,
  compact = false,
  maxDimension = 720,
  uploadButtonLabel = 'Subir fotografía',
}) => {
  const inputId = useId();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError('');
    const check = validateImageFile(file);
    if (!check.valid) {
      setError(check.error || 'Archivo no válido.');
      return;
    }

    setLoading(true);
    try {
      const dataUrl = await readAndResizePublicImage(file, maxDimension);
      onChange(dataUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo procesar la fotografía.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={inputId} className="block text-xs font-semibold text-[#252A27] dark:text-[#F5F1E8]">
          {label}
          {required && <span className="text-red-600 ml-0.5">*</span>}
        </label>
        <span className="text-[11px] text-[#73766F] dark:text-[#A3A89F]">
          JPG, PNG o WEBP · Máx. 5 MB
        </span>
      </div>

      <div
        className={`rounded-xl border border-[#DDD5C8] dark:border-white/15 bg-[#EAE3D6]/55 dark:bg-[#1C211E] ${
          compact ? 'p-3' : 'p-4'
        } flex flex-col sm:flex-row items-center gap-4`}
      >
        <div
          className={`${
            compact ? 'w-16 h-16' : 'w-20 h-20'
          } rounded-full overflow-hidden shrink-0 border-2 border-[#B96F50]/60 bg-[#FFFCF7] dark:bg-[#222825] flex items-center justify-center`}
        >
          {value ? (
            <img
              src={value}
              alt="Vista previa de fotografía"
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-7 h-7 text-[#73766F]" aria-hidden="true" />
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2 text-center sm:text-left">
          {frontalFaceGuidance && (
            <p className="text-xs text-[#252A27]/85 dark:text-[#F5F1E8]/85 leading-snug">
              Usa una fotografía frontal donde tu rostro se vea completo, centrado y bien iluminado.
            </p>
          )}
          {helperText && (
            <p className="text-[11px] text-[#73766F] dark:text-[#A3A89F] leading-snug">
              {helperText}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-0.5">
            <label
              htmlFor={inputId}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#304B3E] hover:bg-[#243A30] text-white dark:bg-[#B96F50] dark:hover:bg-[#a65e41] dark:text-white text-xs font-semibold cursor-pointer transition-colors"
            >
              {value ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{loading ? 'Procesando...' : 'Cambiar foto'}</span>
                </>
              ) : (
                <>
                  {frontalFaceGuidance ? (
                    <Camera className="w-3.5 h-3.5" />
                  ) : (
                    <Upload className="w-3.5 h-3.5" />
                  )}
                  <span>{loading ? 'Procesando...' : uploadButtonLabel}</span>
                </>
              )}
              <input
                id={inputId}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>

            {value && allowRemove && (
              <button
                type="button"
                onClick={() => {
                  setError('');
                  onChange(undefined);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-300 dark:border-red-900/50 text-red-700 dark:text-red-300 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
};
