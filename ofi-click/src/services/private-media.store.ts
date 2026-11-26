import type { VerificationDocKind } from '../types/oficlick';

export interface PrivateMediaEntry {
  previewUrl: string;
  mimeType: string;
  fileName: string;
  docKind: VerificationDocKind;
  isDemo: boolean;
  createdAt: string;
}

const memoryVault = new Map<string, PrivateMediaEntry>();

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getDemoVerificationPreviewUrl(
  docKind: VerificationDocKind,
  label: string,
  fileName: string
): string {
  const title =
    docKind === 'frontal_face'
      ? 'FOTO FRONTAL DE VERIFICACIÓN (DEMO)'
      : docKind === 'ine'
      ? 'IDENTIFICACIÓN OFICIAL INE (DEMO)'
      : 'DOCUMENTO PRIVADO (DEMO)';

  const svg =
    docKind === 'frontal_face'
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="280" viewBox="0 0 420 280">
  <rect width="420" height="280" rx="16" fill="#F5F1E8"/>
  <rect x="16" y="16" width="388" height="248" rx="12" fill="#FFFCF7" stroke="#304B3E" stroke-width="2" stroke-dasharray="6 4"/>
  <circle cx="210" cy="108" r="36" fill="#DDD5C8" stroke="#304B3E" stroke-width="2"/>
  <circle cx="210" cy="96" r="14" fill="#304B3E" opacity="0.85"/>
  <path d="M185 130c5-12 45-12 50 0" fill="#304B3E" opacity="0.85"/>
  <rect x="76" y="164" width="268" height="24" rx="6" fill="#304B3E"/>
  <text x="210" y="180" text-anchor="middle" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#FFFFFF">${escapeXml(title)}</text>
  <text x="210" y="210" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" fill="#252A27">${escapeXml(label)}</text>
  <text x="210" y="232" text-anchor="middle" font-family="monospace" font-size="10" fill="#73766F">${escapeXml(fileName)}</text>
</svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="280" viewBox="0 0 420 280">
  <rect width="420" height="280" rx="16" fill="#F5F1E8"/>
  <rect x="20" y="24" width="380" height="232" rx="12" fill="#FFFCF7" stroke="#252A27" stroke-opacity="0.2" stroke-width="2"/>
  <rect x="20" y="24" width="380" height="44" rx="10" fill="#304B3E"/>
  <text x="210" y="51" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#FFFFFF">${escapeXml(title)}</text>
  <rect x="40" y="88" width="76" height="92" rx="8" fill="#EAE3D6"/>
  <circle cx="78" cy="122" r="16" fill="#73766F"/>
  <path d="M54 166c4-16 44-16 48 0" fill="#73766F"/>
  <rect x="132" y="92" width="232" height="14" rx="4" fill="#252A27" opacity="0.14"/>
  <rect x="132" y="116" width="180" height="12" rx="4" fill="#252A27" opacity="0.1"/>
  <rect x="132" y="140" width="210" height="12" rx="4" fill="#252A27" opacity="0.1"/>
  <text x="210" y="212" text-anchor="middle" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="#252A27">${escapeXml(label)}</text>
  <text x="210" y="234" text-anchor="middle" font-family="monospace" font-size="10" fill="#73766F">${escapeXml(fileName)}</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const privateMediaStore = {
  setPreview(key: string, entry: PrivateMediaEntry): void {
    const existing = memoryVault.get(key);
    if (existing && existing.previewUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(existing.previewUrl);
      } catch {
        // Ignore revoke failures
      }
    }
    memoryVault.set(key, entry);
  },

  getPreview(key?: string): PrivateMediaEntry | undefined {
    if (!key) return undefined;
    return memoryVault.get(key);
  },

  removePreview(key?: string): void {
    if (!key) return;
    const existing = memoryVault.get(key);
    if (existing && existing.previewUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(existing.previewUrl);
      } catch {
        // Ignore revoke failures
      }
    }
    memoryVault.delete(key);
  },

  resolveDocumentPreview(doc: {
    previewRefKey?: string;
    docKind?: VerificationDocKind;
    label: string;
    fileName: string;
    mimeType?: string;
    isDemo?: boolean;
  }): { url: string; inSessionMemory: boolean; isDemo: boolean } {
    const fromMemory = doc.previewRefKey ? memoryVault.get(doc.previewRefKey) : undefined;
    if (fromMemory) {
      return {
        url: fromMemory.previewUrl,
        inSessionMemory: true,
        isDemo: fromMemory.isDemo,
      };
    }
    return {
      url: getDemoVerificationPreviewUrl(
        doc.docKind || 'credential',
        doc.label,
        doc.fileName
      ),
      inSessionMemory: false,
      isDemo: doc.isDemo ?? true,
    };
  },

  setChatAttachment(
    key: string,
    entry: {
      previewUrl: string;
      mimeType: string;
      fileName: string;
      kind: 'image' | 'pdf' | 'document' | 'other';
      sizeBytes: number;
    }
  ): void {
    memoryVault.set(key, {
      previewUrl: entry.previewUrl,
      mimeType: entry.mimeType,
      fileName: entry.fileName,
      docKind: 'credential',
      isDemo: false,
      createdAt: new Date().toISOString(),
    });
    if (typeof window !== 'undefined' && entry.previewUrl.length < 1_400_000) {
      try {
        window.sessionStorage.setItem(
          `oficlick_chat_att_${key}`,
          JSON.stringify({
            previewUrl: entry.previewUrl,
            mimeType: entry.mimeType,
            fileName: entry.fileName,
          })
        );
      } catch {
        // Ignore sessionStorage quota issues gracefully; memoryVault still holds it
      }
    }
  },

  resolveChatAttachment(att?: {
    previewRefKey?: string;
    name?: string;
    mimeType?: string;
  }): { url: string | null; inSessionMemory: boolean } {
    if (!att?.previewRefKey) {
      return { url: null, inSessionMemory: false };
    }
    const fromMem = memoryVault.get(att.previewRefKey);
    if (fromMem) {
      return { url: fromMem.previewUrl, inSessionMemory: true };
    }
    if (typeof window !== 'undefined') {
      try {
        const raw = window.sessionStorage.getItem(`oficlick_chat_att_${att.previewRefKey}`);
        if (raw) {
          const parsed = JSON.parse(raw) as { previewUrl?: string; mimeType?: string; fileName?: string };
          if (parsed.previewUrl) {
            memoryVault.set(att.previewRefKey, {
              previewUrl: parsed.previewUrl,
              mimeType: parsed.mimeType || att.mimeType || 'application/octet-stream',
              fileName: parsed.fileName || att.name || 'archivo',
              docKind: 'credential',
              isDemo: false,
              createdAt: new Date().toISOString(),
            });
            return { url: parsed.previewUrl, inSessionMemory: true };
          }
        }
      } catch {
        // Ignore parse failures
      }
    }
    return { url: null, inSessionMemory: false };
  },
};
