import type { VerificationDocument, VerificationRequest } from '../types/oficlick';

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const ALLOWED_VERIFICATION_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
] as const;

export const ALLOWED_CHAT_ATTACHMENT_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

export const STORAGE_BUCKETS = {
  PUBLIC_AVATARS: 'public_avatars',
  PORTFOLIO_PHOTOS: 'portfolio_photos',
  PRIVATE_VERIFICATIONS: 'private_verifications',
  PRIVATE_CHAT_ATTACHMENTS: 'private_chat_attachments',
} as const;

export type StorageBucketName = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

export interface FileLikeMetadata {
  name: string;
  type: string;
  size: number;
}

export function validateImageFile(
  file: FileLikeMetadata,
  options?: { allowPdf?: boolean; maxBytes?: number }
): { valid: boolean; error?: string } {
  const maxBytes = options?.maxBytes ?? MAX_IMAGE_BYTES;
  const allowedTypes: readonly string[] = options?.allowPdf
    ? ALLOWED_VERIFICATION_MIME_TYPES
    : ALLOWED_IMAGE_MIME_TYPES;

  if (!file || !file.name) {
    return { valid: false, error: 'Selecciona un archivo válido desde tu dispositivo.' };
  }

  const normalizedType = (file.type || '').toLowerCase();
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const inferredType =
    normalizedType ||
    (ext === 'jpg' || ext === 'jpeg'
      ? 'image/jpeg'
      : ext === 'png'
      ? 'image/png'
      : ext === 'webp'
      ? 'image/webp'
      : ext === 'pdf'
      ? 'application/pdf'
      : '');

  if (!allowedTypes.includes(inferredType)) {
    return {
      valid: false,
      error: options?.allowPdf
        ? 'Formato no permitido. Usa JPG, PNG, WEBP o PDF.'
        : 'Formato no permitido. Usa una fotografía JPG, PNG o WEBP.',
    };
  }

  if (file.size <= 0) {
    return { valid: false, error: 'El archivo seleccionado está vacío.' };
  }

  if (file.size > maxBytes) {
    const maxMb = Math.round((maxBytes / (1024 * 1024)) * 10) / 10;
    return {
      valid: false,
      error: `El archivo supera el tamaño máximo de ${maxMb} MB.`,
    };
  }

  return { valid: true };
}

export function isPrivateVerificationRef(url?: string): boolean {
  if (!url) return false;
  return (
    url.startsWith('private://') ||
    url.includes('private_verifications') ||
    url.startsWith('ver-doc://')
  );
}

export function getPublicProAvatar(pro?: {
  avatarUrl?: string;
  avatarPublicConsent?: boolean;
}): string | undefined {
  if (!pro || !pro.avatarUrl) return undefined;
  if (pro.avatarPublicConsent === false) return undefined;
  if (isPrivateVerificationRef(pro.avatarUrl)) return undefined;
  return pro.avatarUrl;
}

export function sanitizeVerificationDocumentsForStorage(
  docs: Array<
    VerificationDocument & { previewUrl?: string; rawDataUrl?: string }
  >
): VerificationDocument[] {
  return docs.map((d) => {
    const clean: VerificationDocument = {
      id: d.id,
      docKind: d.docKind || 'credential',
      label: d.label,
      fileName: d.fileName,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      uploadedAt: d.uploadedAt,
      storageBucket: STORAGE_BUCKETS.PRIVATE_VERIFICATIONS,
      previewRefKey: d.previewRefKey,
      isDemo: Boolean(d.isDemo),
      privateOnly: true,
    };
    return clean;
  });
}

export type VerificationStageCode =
  | 'incomplete'
  | 'pending'
  | 'in_review'
  | 'corrections_needed'
  | 'rejected'
  | 'verified';

export interface VerificationStageSummary {
  code: VerificationStageCode;
  label: string;
  description: string;
  badgeClass: string;
}

export function getVerificationStageSummary(
  verifications: VerificationRequest[],
  proVerificationLevel: number
): VerificationStageSummary {
  const sorted = [...verifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const latest = sorted[0];

  if (!latest) {
    if (proVerificationLevel >= 4) {
      return {
        code: 'verified',
        label: 'Verificado',
        description: 'Identidad y credenciales aprobadas por el equipo de OFI CLICK.',
        badgeClass: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
      };
    }
    return {
      code: 'incomplete',
      label: 'Pendiente de completar',
      description:
        'Adjunta tu INE vigente y fotografía frontal de rostro para solicitar la revisión.',
      badgeClass: 'bg-slate-100 text-slate-800 dark:bg-white/10 dark:text-[#F5F1E8]',
    };
  }

  switch (latest.status) {
    case 'approved':
      return {
        code: 'verified',
        label: 'Verificado',
        description: 'Credenciales aprobadas por administración.',
        badgeClass: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
      };
    case 'in_review':
      return {
        code: 'in_review',
        label: 'En revisión',
        description: 'Un administrador está revisando tus documentos privados.',
        badgeClass: 'bg-blue-100 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200',
      };
    case 'corrections_needed':
      return {
        code: 'corrections_needed',
        label: 'Requiere correcciones',
        description:
          latest.reviewReason || 'Revisa las observaciones administrativas y vuelve a enviar.',
        badgeClass: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
      };
    case 'rejected':
      return {
        code: 'rejected',
        label: 'Rechazado',
        description:
          latest.reviewReason ||
          'La solicitud fue rechazada. Puedes enviar nuevos documentos legibles.',
        badgeClass: 'bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200',
      };
    case 'pending':
    default:
      return {
        code: 'pending',
        label: 'Pendiente de revisión',
        description:
          'Documentos recibidos en espera de revisión administrativa. El envío no aprueba automáticamente tu perfil.',
        badgeClass: 'bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
      };
  }
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function readAndResizePublicImage(
  file: File,
  maxDimension = 720,
  quality = 0.84
): Promise<string> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('No se pudo leer el archivo seleccionado.'));
    };
    reader.onerror = () => reject(new Error('Error al leer la imagen.'));
    reader.readAsDataURL(file);
  });

  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return rawDataUrl;
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, maxDimension / Math.max(img.width || 1, img.height || 1));
      const targetW = Math.max(1, Math.round(img.width * ratio));
      const targetH = Math.max(1, Math.round(img.height * ratio));
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(rawDataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);
      try {
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed.length < rawDataUrl.length ? compressed : rawDataUrl);
      } catch {
        resolve(rawDataUrl);
      }
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

export async function readFileAsMemoryPreviewUrl(file: File): Promise<string> {
  const validation = validateImageFile(file, { allowPdf: true });
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    return URL.createObjectURL(file);
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('No se pudo generar la vista previa.'));
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

export function inferChatAttachmentKind(
  file: FileLikeMetadata
): 'image' | 'pdf' | 'document' | 'other' {
  const mime = (file?.type || '').toLowerCase();
  const ext = (file?.name || '').split('.').pop()?.toLowerCase() || '';
  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
    return 'image';
  }
  if (mime === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }
  if (
    mime.includes('word') ||
    mime.startsWith('text/') ||
    ['doc', 'docx', 'txt'].includes(ext)
  ) {
    return 'document';
  }
  return 'other';
}

export function validateChatAttachmentFile(
  file: FileLikeMetadata,
  maxBytes = 8 * 1024 * 1024
): { valid: boolean; kind: 'image' | 'pdf' | 'document' | 'other'; mimeType: string; error?: string } {
  if (!file || !file.name) {
    return {
      valid: false,
      kind: 'other',
      mimeType: 'application/octet-stream',
      error: 'Selecciona un archivo válido.',
    };
  }
  const ext = (file.name || '').split('.').pop()?.toLowerCase() || '';
  const mimeType =
    (file.type || '').toLowerCase() ||
    (ext === 'jpg' || ext === 'jpeg'
      ? 'image/jpeg'
      : ext === 'png'
      ? 'image/png'
      : ext === 'webp'
      ? 'image/webp'
      : ext === 'pdf'
      ? 'application/pdf'
      : ext === 'txt'
      ? 'text/plain'
      : ext === 'doc'
      ? 'application/msword'
      : ext === 'docx'
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : '');

  const allowed: readonly string[] = ALLOWED_CHAT_ATTACHMENT_MIME_TYPES;
  if (!allowed.includes(mimeType)) {
    return {
      valid: false,
      kind: 'other',
      mimeType: mimeType || 'application/octet-stream',
      error: 'Formato no permitido. Adjunta imágenes (JPG, PNG, WEBP) o documentos (PDF, DOC, DOCX, TXT).',
    };
  }
  if (file.size <= 0) {
    return {
      valid: false,
      kind: inferChatAttachmentKind(file),
      mimeType,
      error: 'El archivo está vacío.',
    };
  }
  if (file.size > maxBytes) {
    return {
      valid: false,
      kind: inferChatAttachmentKind(file),
      mimeType,
      error: 'El archivo supera el límite de 8 MB para adjuntos en chat.',
    };
  }
  return {
    valid: true,
    kind: inferChatAttachmentKind({ name: file.name, size: file.size, type: mimeType }),
    mimeType,
  };
}

export async function readChatAttachmentFile(file: File): Promise<{
  previewUrl: string;
  mimeType: string;
  sizeBytes: number;
  kind: 'image' | 'pdf' | 'document' | 'other';
}> {
  const validation = validateChatAttachmentFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }
  if (validation.kind === 'image') {
    const resized = await readAndResizePublicImage(file, 1280, 0.84);
    return {
      previewUrl: resized,
      mimeType: validation.mimeType,
      sizeBytes: file.size,
      kind: 'image',
    };
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('No se pudo leer el documento adjunto.'));
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo adjunto.'));
    reader.readAsDataURL(file);
  });
  return {
    previewUrl: dataUrl,
    mimeType: validation.mimeType,
    sizeBytes: file.size,
    kind: validation.kind,
  };
}
