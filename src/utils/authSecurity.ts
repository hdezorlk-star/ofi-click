import type {
  AdminAccessRequest,
  OneTimeCodePurpose,
  OneTimeCodeRecord,
} from '../types/oficlick';

export const NEUTRAL_RECOVERY_RESPONSE_MESSAGE =
  'Si existe una cuenta asociada a ese correo electrónico, hemos preparado las instrucciones y el código de recuperación de un solo uso.';

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

export function sha256Hex(message: string): string {
  const bytes = new TextEncoder().encode(message);
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  const highBits = Math.floor(bitLen / 0x100000000);
  const lowBits = bitLen >>> 0;
  view.setUint32(paddedLen - 8, highBits, false);
  view.setUint32(paddedLen - 4, lowBits, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i += 1) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((val) => val.toString(16).padStart(8, '0'))
    .join('');
}

export function generateSecureSalt(): string {
  const buf = new Uint8Array(16);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < buf.length; i += 1) {
      buf[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function generateNumericOtp(digits = 6): string {
  const buf = new Uint32Array(digits);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < digits; i += 1) {
      buf[i] = Math.floor(Math.random() * 100000);
    }
  }
  return Array.from(buf, (v) => String(v % 10)).join('');
}

export function hashSecretWithSalt(secret: string, salt: string): string {
  return sha256Hex(`${salt}::${secret}`);
}

export function verifySecretWithSalt(secret: string, salt: string, expectedHash: string): boolean {
  const actual = hashSecretWithSalt(secret, salt);
  if (actual.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) {
    diff |= actual.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  }
  return diff === 0;
}

export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  const trimmed = password.trim();
  if (trimmed.length < 6) {
    return {
      valid: false,
      error: 'La contraseña debe tener al menos 6 caracteres.',
    };
  }
  if (trimmed.length > 128) {
    return {
      valid: false,
      error: 'La contraseña no puede superar 128 caracteres.',
    };
  }
  return { valid: true };
}

export function createOneTimeCodeChallenge(input: {
  id: string;
  purpose: OneTimeCodePurpose;
  email: string;
  targetId?: string;
  ttlMinutes?: number;
  maxAttempts?: number;
  now?: Date;
}): { record: OneTimeCodeRecord; plainCode: string } {
  const now = input.now ?? new Date();
  const ttlMinutes = input.ttlMinutes ?? 10;
  const maxAttempts = input.maxAttempts ?? 5;
  const plainCode = generateNumericOtp(6);
  const salt = generateSecureSalt();
  const codeHash = hashSecretWithSalt(plainCode, salt);
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000).toISOString();

  return {
    plainCode,
    record: {
      id: input.id,
      purpose: input.purpose,
      email: input.email.trim().toLowerCase(),
      targetId: input.targetId,
      codeHash,
      salt,
      expiresAt,
      attempts: 0,
      maxAttempts,
      createdAt: now.toISOString(),
    },
  };
}

export function verifyOneTimeCodeChallenge(input: {
  record: OneTimeCodeRecord | undefined;
  codeAttempt: string;
  now?: Date;
}): {
  valid: boolean;
  updatedRecord?: OneTimeCodeRecord;
  remainingAttempts?: number;
  error?: string;
} {
  const { record, codeAttempt } = input;
  const now = input.now ?? new Date();

  if (!record) {
    return {
      valid: false,
      error: 'Código inválido o expirado. Solicita un nuevo código de verificación.',
    };
  }

  if (record.consumedAt) {
    return {
      valid: false,
      updatedRecord: record,
      remainingAttempts: 0,
      error: 'Este código de un solo uso ya fue utilizado. Solicita uno nuevo.',
    };
  }

  if (record.attempts >= record.maxAttempts) {
    return {
      valid: false,
      updatedRecord: record,
      remainingAttempts: 0,
      error: 'Se alcanzó el límite máximo de intentos permitidos. Solicita un nuevo código.',
    };
  }

  const expiresMs = new Date(record.expiresAt).getTime();
  if (Number.isNaN(expiresMs) || now.getTime() > expiresMs) {
    return {
      valid: false,
      updatedRecord: record,
      remainingAttempts: Math.max(0, record.maxAttempts - record.attempts),
      error: 'El código ha expirado. Solicita un nuevo código.',
    };
  }

  const cleanAttempt = codeAttempt.trim();
  const isMatch = verifySecretWithSalt(cleanAttempt, record.salt, record.codeHash);
  if (!isMatch) {
    const nextAttempts = record.attempts + 1;
    const remaining = Math.max(0, record.maxAttempts - nextAttempts);
    return {
      valid: false,
      remainingAttempts: remaining,
      updatedRecord: {
        ...record,
        attempts: nextAttempts,
      },
      error:
        remaining > 0
          ? `Código incorrecto. Te quedan ${remaining} ${remaining === 1 ? 'intento' : 'intentos'}.`
          : 'Código incorrecto. Se agotaron los intentos; solicita un nuevo código.',
    };
  }

  return {
    valid: true,
    remainingAttempts: Math.max(0, record.maxAttempts - record.attempts),
    updatedRecord: {
      ...record,
      consumedAt: now.toISOString(),
    },
  };
}

export function canAdminRequestEnterPanel(
  request: Pick<AdminAccessRequest, 'emailVerified' | 'status' | 'authorizedRole'> | null | undefined
): boolean {
  if (!request) return false;
  if (!request.emailVerified) return false;
  if (request.status !== 'authorized') return false;
  return request.authorizedRole === 'central_admin';
}
