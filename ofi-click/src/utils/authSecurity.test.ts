import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NEUTRAL_RECOVERY_RESPONSE_MESSAGE,
  canAdminRequestEnterPanel,
  createOneTimeCodeChallenge,
  generateSecureSalt,
  hashSecretWithSalt,
  validatePasswordStrength,
  verifyOneTimeCodeChallenge,
  verifySecretWithSalt,
} from './authSecurity';
import { renderTransactionalEmail } from '../services/email/email.templates';
import { emailService } from '../services/email/email.service';
import type { AdminAccessRequest } from '../types/oficlick';

test('hashSecretWithSalt and verifySecretWithSalt validate matching secrets cleanly', () => {
  const salt = generateSecureSalt();
  const hash = hashSecretWithSalt('ClaveSegura2026!', salt);
  assert.equal(verifySecretWithSalt('ClaveSegura2026!', salt, hash), true);
  assert.equal(verifySecretWithSalt('OtraClave', salt, hash), false);
});

test('validatePasswordStrength enforces minimum 6 characters', () => {
  assert.equal(validatePasswordStrength('12345').valid, false);
  assert.equal(validatePasswordStrength('123456').valid, true);
});

test('OTP challenge enforces single-use, expiration, and maximum attempts', () => {
  const issuedAt = new Date('2026-11-24T12:00:00.000Z');
  const { record, plainCode } = createOneTimeCodeChallenge({
    id: 'otp-1',
    purpose: 'admin_email_verification',
    email: 'Solicitante@oficlick.mx',
    ttlMinutes: 10,
    maxAttempts: 3,
    now: issuedAt,
  });

  assert.equal(plainCode.length, 6);
  assert.equal(record.email, 'solicitante@oficlick.mx');

  // Wrong attempt #1
  const wrong1 = verifyOneTimeCodeChallenge({
    record,
    codeAttempt: '000000',
    now: new Date('2026-11-24T12:01:00.000Z'),
  });
  assert.equal(wrong1.valid, false);
  assert.equal(wrong1.remainingAttempts, 2);

  // Correct attempt on remaining attempt
  const ok = verifyOneTimeCodeChallenge({
    record: wrong1.updatedRecord,
    codeAttempt: plainCode,
    now: new Date('2026-11-24T12:02:00.000Z'),
  });
  assert.equal(ok.valid, true);
  assert.ok(ok.updatedRecord?.consumedAt);

  // Reuse of consumed single-use code must fail
  const reuse = verifyOneTimeCodeChallenge({
    record: ok.updatedRecord,
    codeAttempt: plainCode,
    now: new Date('2026-11-24T12:03:00.000Z'),
  });
  assert.equal(reuse.valid, false);
  assert.match(reuse.error || '', /ya fue utilizado/i);

  // Expired code must fail
  const expired = verifyOneTimeCodeChallenge({
    record,
    codeAttempt: plainCode,
    now: new Date('2026-11-24T12:11:00.000Z'),
  });
  assert.equal(expired.valid, false);
  assert.match(expired.error || '', /expirado/i);

  // Exhaust max attempts
  const f1 = verifyOneTimeCodeChallenge({ record, codeAttempt: '111111', now: issuedAt });
  const f2 = verifyOneTimeCodeChallenge({ record: f1.updatedRecord, codeAttempt: '222222', now: issuedAt });
  const f3 = verifyOneTimeCodeChallenge({ record: f2.updatedRecord, codeAttempt: '333333', now: issuedAt });
  assert.equal(f3.valid, false);
  assert.equal(f3.remainingAttempts, 0);

  const locked = verifyOneTimeCodeChallenge({
    record: f3.updatedRecord,
    codeAttempt: plainCode,
    now: issuedAt,
  });
  assert.equal(locked.valid, false);
  assert.match(locked.error || '', /límite máximo/i);
});

test('canAdminRequestEnterPanel never grants admin access on creation or email verification alone', () => {
  const baseReq: AdminAccessRequest = {
    id: 'admreq-1',
    fullName: 'Lucía Ramírez',
    email: 'lucia@oficlick.mx',
    regionId: 'reg-izcalli',
    colonia: 'Centro Urbano',
    requestedScope: 'central_admin',
    justification: 'Coordinación central',
    emailVerified: false,
    status: 'email_pending',
    createdAt: '2026-11-24T12:00:00.000Z',
    updatedAt: '2026-11-24T12:00:00.000Z',
  };

  assert.equal(canAdminRequestEnterPanel(baseReq), false);

  const verifiedOnly: AdminAccessRequest = {
    ...baseReq,
    emailVerified: true,
    emailVerifiedAt: '2026-11-24T12:05:00.000Z',
    status: 'pending_authorization',
  };
  assert.equal(canAdminRequestEnterPanel(verifiedOnly), false);

  const authorized: AdminAccessRequest = {
    ...verifiedOnly,
    status: 'authorized',
    authorizedRole: 'central_admin',
  };
  assert.equal(canAdminRequestEnterPanel(authorized), true);
});

test('renderTransactionalEmail builds exact welcome email and escapes HTML safely', () => {
  const welcome = renderTransactionalEmail({
    eventType: 'welcome',
    toEmail: 'laura@oficlick.mx',
    userName: 'Laura <script>alert(1)</script>',
    accountRoleLabel: 'Cliente',
  });

  assert.equal(welcome.subject, '¡Te damos la bienvenida a Ofi Click!');
  assert.match(welcome.textBody, /^Hola, Laura <script>alert\(1\)<\/script>\./);
  assert.equal(welcome.htmlBody.includes('<script>'), false);
  assert.equal(welcome.htmlBody.includes('&lt;script&gt;'), true);
});

test('emailService prepares all 10 transactional templates honestly without claiming external delivery', () => {
  const status = emailService.getProviderStatus();
  assert.equal(status.configured, false);

  const prepared = emailService.prepareEmail({
    eventType: 'booking_confirmed',
    toEmail: 'cliente@oficlick.mx',
    recipientName: 'Mariana',
    serviceTitle: 'Instalación eléctrica',
    scheduledDate: '2026-11-29',
    scheduledTime: '10:00',
  });

  assert.equal(prepared.deliveryStatus, 'prepared_local_only');
  assert.equal(prepared.providerConfigured, false);
  assert.match(prepared.subject, /Instalación eléctrica/);
  assert.match(NEUTRAL_RECOVERY_RESPONSE_MESSAGE, /Si existe una cuenta/);
});
