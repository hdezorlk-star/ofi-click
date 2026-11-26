import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_IMAGE_BYTES,
  STORAGE_BUCKETS,
  getPublicProAvatar,
  getVerificationStageSummary,
  sanitizeVerificationDocumentsForStorage,
  validateImageFile,
} from './media';
import type { VerificationRequest } from '../types/oficlick';

test('validateImageFile accepts valid JPG/PNG/WEBP under 5MB and rejects unsupported or oversized files', () => {
  assert.equal(
    validateImageFile({ name: 'rostro.jpg', type: 'image/jpeg', size: 350_000 }).valid,
    true
  );
  assert.equal(
    validateImageFile({ name: 'rostro.webp', type: 'image/webp', size: 1_200_000 }).valid,
    true
  );

  const pdfForAvatar = validateImageFile({
    name: 'ine.pdf',
    type: 'application/pdf',
    size: 200_000,
  });
  assert.equal(pdfForAvatar.valid, false);

  const pdfForVerification = validateImageFile(
    { name: 'ine.pdf', type: 'application/pdf', size: 200_000 },
    { allowPdf: true }
  );
  assert.equal(pdfForVerification.valid, true);

  const oversized = validateImageFile({
    name: 'huge.png',
    type: 'image/png',
    size: MAX_IMAGE_BYTES + 1,
  });
  assert.equal(oversized.valid, false);
});

test('getPublicProAvatar respects public consent and never exposes private verification refs', () => {
  assert.equal(
    getPublicProAvatar({
      avatarUrl: '/assets/pro.jpg',
      avatarPublicConsent: true,
    }),
    '/assets/pro.jpg'
  );
  assert.equal(
    getPublicProAvatar({
      avatarUrl: '/assets/pro.jpg',
      avatarPublicConsent: false,
    }),
    undefined
  );
  assert.equal(
    getPublicProAvatar({
      avatarUrl: 'private://private_verifications/ine.jpg',
      avatarPublicConsent: true,
    }),
    undefined
  );
});

test('getVerificationStageSummary distinguishes incomplete, pending review, in_review, corrections, rejected, and verified without auto-approving uploads', () => {
  assert.equal(getVerificationStageSummary([], 2).code, 'incomplete');

  const pendingReq: VerificationRequest = {
    id: 'ver-1',
    professionalId: 'pro-1',
    requestedLevel: 4,
    documents: [
      {
        id: 'd1',
        docKind: 'ine',
        label: 'INE',
        fileName: 'ine.jpg',
        uploadedAt: '2026-11-24T10:00:00.000Z',
        storageBucket: STORAGE_BUCKETS.PRIVATE_VERIFICATIONS,
        privateOnly: true,
      },
      {
        id: 'd2',
        docKind: 'frontal_face',
        label: 'Foto frontal',
        fileName: 'rostro.jpg',
        uploadedAt: '2026-11-24T10:01:00.000Z',
        storageBucket: STORAGE_BUCKETS.PRIVATE_VERIFICATIONS,
        privateOnly: true,
      },
    ],
    status: 'pending',
    history: [],
    createdAt: '2026-11-24T10:02:00.000Z',
  };

  assert.equal(getVerificationStageSummary([pendingReq], 2).code, 'pending');
  assert.equal(
    getVerificationStageSummary([{ ...pendingReq, status: 'in_review' }], 2).code,
    'in_review'
  );
  assert.equal(
    getVerificationStageSummary([{ ...pendingReq, status: 'corrections_needed' }], 2).code,
    'corrections_needed'
  );
  assert.equal(
    getVerificationStageSummary([{ ...pendingReq, status: 'rejected' }], 2).code,
    'rejected'
  );
  assert.equal(
    getVerificationStageSummary([{ ...pendingReq, status: 'approved' }], 4).code,
    'verified'
  );
});

test('sanitizeVerificationDocumentsForStorage removes any previewUrl/rawDataUrl before localStorage persistence', () => {
  const sanitized = sanitizeVerificationDocumentsForStorage([
    {
      id: 'd1',
      docKind: 'ine',
      label: 'INE',
      fileName: 'ine_real.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 120000,
      uploadedAt: '2026-11-24T10:00:00.000Z',
      storageBucket: STORAGE_BUCKETS.PRIVATE_VERIFICATIONS,
      previewRefKey: 'mem-1',
      privateOnly: true,
      previewUrl: 'data:image/jpeg;base64,/9j/SENSITIVE',
      rawDataUrl: 'data:image/jpeg;base64,/9j/SENSITIVE',
    },
  ]);

  const json = JSON.stringify(sanitized);
  assert.equal(json.includes('SENSITIVE'), false);
  assert.equal(json.includes('data:image'), false);
  assert.equal(sanitized[0].storageBucket, 'private_verifications');
  assert.equal(sanitized[0].privateOnly, true);
});
