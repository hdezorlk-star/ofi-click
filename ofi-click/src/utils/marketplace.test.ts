import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFICIAL_ROLES,
  calculateQuoteTotals,
  canAccessWorkspaceRoute,
  canAdminAccessRegion,
  canCentralAdminManageGlobal,
  canUserLeaveReview,
  filterAndSortProfessionals,
  findCompatibleProfessionals,
  formatMXN,
  getDefaultRouteForRole,
  isRoutePageAllowedForUser,
} from './marketplace';
import { validateChatAttachmentFile } from './media';
import { LocalDataAdapter } from '../adapters/local/local.adapter';
import type { Booking, ProfessionalProfile, Review, SearchFilters, ServiceItem } from '../types/oficlick';

const makePro = (id: string, overrides: Partial<ProfessionalProfile> = {}): ProfessionalProfile => ({
  id,
  profileId: `user-${id}`,
  displayName: `Pro ${id}`,
  bio: 'Servicio profesional',
  specialties: ['Plomería'],
  categoryIds: ['cat-plomeria'],
  yearsExperience: 5,
  regionId: 'reg-izcalli',
  primaryColonia: 'Centro Urbano',
  additionalColonias: ['Ensueños', 'Cumbria'],
  coverageZones: ['Cuautitlán Izcalli Centro'],
  maxTravelKm: 15,
  homeService: true,
  workshopService: false,
  willingToTravel: true,
  approximateCoords: { lat: 19.656, lng: -99.21 },
  availabilityStatus: 'available',
  urgentAttention: true,
  weeklySchedule: [],
  verificationLevel: 3,
  profileComplete: true,
  published: true,
  pausedByAdmin: false,
  ratingAvg: 4.8,
  reviewsCount: 14,
  completedJobsCount: 25,
  responseRatePercent: 95,
  profileViews: 120,
  joinedAt: '2025-01-15T10:00:00.000Z',
  isDemo: true,
  ...overrides,
});

test('calculateQuoteTotals computes valid MXN total and rejects invalid discounts', () => {
  const ok = calculateQuoteTotals({
    laborAmount: 850,
    materialsAmount: 350,
    additionalCharges: 100,
    discountAmount: 100,
  });
  assert.equal(ok.valid, true);
  assert.equal(ok.subtotal, 1300);
  assert.equal(ok.totalAmount, 1200);

  const badDiscount = calculateQuoteTotals({
    laborAmount: 500,
    materialsAmount: 0,
    additionalCharges: 0,
    discountAmount: 700,
  });
  assert.equal(badDiscount.valid, false);
});

test('findCompatibleProfessionals returns ALL compatible pros without arbitrary 3/5/10 limit', () => {
  const pros = Array.from({ length: 14 }, (_, idx) => makePro(`p-${idx + 1}`));
  // Add 1 unavailable and 1 paused pro that must be excluded
  pros.push(makePro('p-unavail', { availabilityStatus: 'unavailable' }));
  pros.push(makePro('p-paused', { pausedByAdmin: true }));

  const matches = findCompatibleProfessionals(pros, {
    categoryId: 'cat-plomeria',
    colonia: 'Ensueños',
    regionId: 'reg-izcalli',
    urgency: 'urgent',
    requiresHomeService: true,
  });

  assert.equal(matches.length, 14);
});

test('canUserLeaveReview strictly requires completed booking, matching client, and no duplicates', () => {
  const booking: Booking = {
    id: 'bk-1',
    requestId: 'req-1',
    quoteId: 'qt-1',
    quoteVersion: 1,
    clientId: 'client-1',
    professionalId: 'pro-1',
    regionId: 'reg-izcalli',
    serviceTitle: 'Reparación de fuga',
    description: 'Fuga bajo tarja',
    agreedAmountMxn: 900,
    paymentNote: 'Pago directo en efectivo al finalizar',
    paymentConfirmedOutside: false,
    scheduledDate: '2026-11-24',
    scheduledTime: '11:00',
    colonia: 'Cumbria',
    privateAddress: 'Calle 1 #23',
    conditions: 'Garantía 30 días',
    status: 'completed',
    events: [],
    createdAt: '2026-11-20T10:00:00.000Z',
  };

  assert.equal(canUserLeaveReview(booking, [], 'client-1').allowed, true);
  assert.equal(canUserLeaveReview(booking, [], 'other-user').allowed, false);
  assert.equal(
    canUserLeaveReview({ ...booking, status: 'in_progress' }, [], 'client-1').allowed,
    false
  );

  const existing: Review[] = [
    {
      id: 'rev-1',
      bookingId: 'bk-1',
      clientId: 'client-1',
      clientName: 'Ana',
      professionalId: 'pro-1',
      serviceName: 'Reparación de fuga',
      rating: 5,
      comment: 'Excelente trabajo',
      reported: false,
      hiddenByAdmin: false,
      createdAt: '2026-11-21T10:00:00.000Z',
    },
  ];
  assert.equal(canUserLeaveReview(booking, existing, 'client-1').allowed, false);
});

test('canAdminAccessRegion only allows central_admin and denies non-central roles', () => {
  const client = { roles: ['client' as const], regionId: 'reg-izcalli' };
  const central = { roles: ['central_admin' as const], regionId: 'reg-izcalli' };

  assert.equal(canAdminAccessRegion(client, 'reg-izcalli'), false);
  assert.equal(canAdminAccessRegion(central, 'reg-izcalli'), true);
  assert.equal(canAdminAccessRegion(central, 'reg-tlalnepantla'), true);
});

test('formatMXN formats Mexican pesos cleanly', () => {
  assert.match(formatMXN(1250), /1,250/);
  assert.equal(formatMXN(undefined), 'A cotizar');
});

test('OFFICIAL_ROLES strictly defines only the 3 official roles with no business or regional_admin roles', () => {
  assert.deepEqual(OFFICIAL_ROLES, [
    'client',
    'independent_pro',
    'central_admin',
  ]);
  assert.equal(getDefaultRouteForRole('client').page, 'client-panel');
  assert.equal(getDefaultRouteForRole('independent_pro').page, 'pro-panel');
  assert.equal(getDefaultRouteForRole('central_admin').page, 'central-admin-panel');
});

test('canAccessWorkspaceRoute & canCentralAdminManageGlobal strictly separate workspace roles', () => {
  const client = { primaryRole: 'client' as const, roles: ['client' as const] };
  const freelancer = { primaryRole: 'independent_pro' as const, roles: ['independent_pro' as const, 'client' as const] };
  const central = { primaryRole: 'central_admin' as const, roles: ['central_admin' as const] };

  assert.equal(canAccessWorkspaceRoute(null, 'client-panel'), false);
  assert.equal(canAccessWorkspaceRoute(client, 'client-panel'), true);
  assert.equal(canAccessWorkspaceRoute(client, 'pro-panel'), false);
  assert.equal(canAccessWorkspaceRoute(freelancer, 'pro-panel'), true);
  assert.equal(canAccessWorkspaceRoute(freelancer, 'client-panel'), false);
  assert.equal(canAccessWorkspaceRoute(freelancer, 'central-admin-panel'), false);
  assert.equal(canAccessWorkspaceRoute(central, 'central-admin-panel'), true);
  assert.equal(canAccessWorkspaceRoute(central, 'client-panel'), false);

  assert.equal(isRoutePageAllowedForUser(null, 'landing'), true);
  assert.equal(isRoutePageAllowedForUser(null, 'explore'), true);
  assert.equal(isRoutePageAllowedForUser(null, 'categories'), true);
  assert.equal(isRoutePageAllowedForUser(null, 'client-panel'), false);
  assert.equal(isRoutePageAllowedForUser(null, 'pro-panel'), false);
  assert.equal(isRoutePageAllowedForUser(null, 'central-admin-panel'), false);
  assert.equal(isRoutePageAllowedForUser(freelancer, 'pro-panel'), true);
  assert.equal(isRoutePageAllowedForUser(freelancer, 'landing'), false);
  assert.equal(isRoutePageAllowedForUser(freelancer, 'explore'), false);
  assert.equal(isRoutePageAllowedForUser(freelancer, 'client-panel'), false);
  assert.equal(isRoutePageAllowedForUser(client, 'client-panel'), true);
  assert.equal(isRoutePageAllowedForUser(client, 'explore'), true);
  assert.equal(isRoutePageAllowedForUser(central, 'central-admin-panel'), true);
  assert.equal(isRoutePageAllowedForUser(central, 'explore'), false);

  assert.equal(canCentralAdminManageGlobal(client), false);
  assert.equal(canCentralAdminManageGlobal(freelancer), false);
  assert.equal(canCentralAdminManageGlobal(central), true);
});

test('filterAndSortProfessionals filters by specific serviceId accurately', () => {
  const pro1 = makePro('pro-1', { categoryIds: ['cat-plomeria'] });
  const pro2 = makePro('pro-2', { categoryIds: ['cat-plomeria'] });
  const services: ServiceItem[] = [
    {
      id: 'srv-fuga',
      professionalId: 'pro-1',
      categoryId: 'cat-plomeria',
      subcategoryId: 'sub-1',
      name: 'Detección de fugas con geófono',
      description: 'Revisión sin romper muro',
      photos: [],
      pricingMode: 'fixed',
      priceAmount: 650,
      estimatedDurationMin: 60,
      materialsIncluded: false,
      conditions: 'Garantía 30 días',
      coverageColonias: ['Centro Urbano'],
      status: 'published',
      urgentAvailable: true,
      isDemo: true,
    },
    {
      id: 'srv-tinaco',
      professionalId: 'pro-2',
      categoryId: 'cat-plomeria',
      subcategoryId: 'sub-2',
      name: 'Lavado de tinaco',
      description: 'Desinfección completa',
      photos: [],
      pricingMode: 'fixed',
      priceAmount: 550,
      estimatedDurationMin: 120,
      materialsIncluded: true,
      conditions: 'Garantía 15 días',
      coverageColonias: ['Centro Urbano'],
      status: 'published',
      urgentAvailable: false,
      isDemo: true,
    },
  ];

  const baseFilters: SearchFilters = {
    query: '',
    categoryId: '',
    subcategoryId: '',
    serviceId: 'srv-fuga',
    colonia: '',
    zone: '',
    maxDistanceKm: null,
    minRating: 0,
    minReviews: 0,
    maxPrice: null,
    availability: 'all',
    urgentOnly: false,
    homeServiceOnly: false,
    verifiedOnly: false,
    minExperienceYears: 0,
    minCompletedJobs: 0,
  };

  const results = filterAndSortProfessionals([pro1, pro2], services, baseFilters, 'relevance');
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'pro-1');
});

test('validateChatAttachmentFile validates image/document formats, empty files, and 8MB ceiling', () => {
  const validImg = validateChatAttachmentFile({ name: 'fuga.jpg', type: 'image/jpeg', size: 240_000 });
  assert.equal(validImg.valid, true);
  assert.equal(validImg.kind, 'image');

  const validPdf = validateChatAttachmentFile({ name: 'presupuesto.pdf', type: 'application/pdf', size: 480_000 });
  assert.equal(validPdf.valid, true);
  assert.equal(validPdf.kind, 'pdf');

  const badExt = validateChatAttachmentFile({ name: 'script.exe', type: 'application/x-msdownload', size: 1024 });
  assert.equal(badExt.valid, false);

  const emptyFile = validateChatAttachmentFile({ name: 'vacio.png', type: 'image/png', size: 0 });
  assert.equal(emptyFile.valid, false);

  const tooBig = validateChatAttachmentFile({ name: 'grande.pdf', type: 'application/pdf', size: 9 * 1024 * 1024 });
  assert.equal(tooBig.valid, false);

  // Browser File objects expose name/type/size as non-enumerable getters on prototype
  class NativeLikeFile {
    get name() {
      return 'evidencia-fuga.png';
    }
    get type() {
      return 'image/png';
    }
    get size() {
      return 128_000;
    }
  }
  const nativeFileRes = validateChatAttachmentFile(new NativeLikeFile());
  assert.equal(nativeFileRes.valid, true);
  assert.equal(nativeFileRes.kind, 'image');
  assert.equal(nativeFileRes.mimeType, 'image/png');
});

test('LocalDataAdapter enforces quote dedup, competing-quote rejection, calendar sync on reschedule/cancel, and local prototype admin init', () => {
  const adapter = new LocalDataAdapter();
  const snap = adapter.getSnapshot();
  const client = snap.profiles.find((p) => p.primaryRole === 'client')!;
  const pros = snap.professionals.filter((p) => p.published);
  assert.ok(pros.length >= 2);

  // Client registration succeeds without mandatory photo
  const { profile: newClient } = adapter.registerAccount({
    fullName: 'Sofía Mendoza',
    email: 'sofia.test@oficlick.mx',
    password: 'Password123',
    accountType: 'client',
    colonia: 'Centro Urbano',
  });
  assert.equal(newClient.primaryRole, 'client');
  assert.equal(newClient.avatarUrl, undefined);

  // Create request to 2 pros -> both quote -> accepting 1 rejects the other and creates 1 booking + calendar block
  const req = adapter.createServiceRequest({
    clientId: client.id,
    categoryId: pros[0].categoryIds[0],
    title: 'Revisión de presión hidráulica',
    description: 'Baja presión en regadera principal',
    photos: [],
    urgency: 'normal',
    desiredDate: '2026-12-05',
    desiredTimeSlot: '10:00 - 12:00',
    regionId: 'reg-izcalli',
    colonia: 'Centro Urbano',
    privateAddress: 'Calle Nevado #12',
    preferences: 'Acceso por portón lateral',
    requiresHomeService: true,
    distributionMode: 'manual',
    recipientProfessionalIds: [pros[0].id, pros[1].id],
  });

  const q1 = adapter.sendOrReviseQuote({
    requestId: req.id,
    professionalId: pros[0].id,
    clientId: client.id,
    serviceName: req.title,
    description: 'Diagnóstico y ajuste de bomba',
    versionData: {
      laborAmount: 500,
      materialsAmount: 200,
      additionalCharges: 0,
      discountAmount: 0,
      totalAmount: 700,
      estimatedDuration: '2 horas',
      proposedDate: '2026-12-06',
      proposedTime: '10:00',
      validUntil: '2026-12-10',
      conditions: 'Garantía 30 días',
      comments: 'Incluye revisión de llave de paso',
    },
  });

  const q2 = adapter.sendOrReviseQuote({
    requestId: req.id,
    professionalId: pros[1].id,
    clientId: client.id,
    serviceName: req.title,
    description: 'Revisión integral',
    versionData: {
      laborAmount: 650,
      materialsAmount: 150,
      additionalCharges: 0,
      discountAmount: 0,
      totalAmount: 800,
      estimatedDuration: '2 horas',
      proposedDate: '2026-12-06',
      proposedTime: '12:00',
      validUntil: '2026-12-10',
      conditions: 'Garantía 30 días',
      comments: 'Sin costo de diagnóstico al contratar',
    },
  });

  const accepted = adapter.respondToQuote(q1.id, 'accepted');
  assert.ok(accepted.booking);
  assert.equal(accepted.quote.status, 'accepted');

  // Calling respondToQuote again returns the existing booking without duplicating
  const idempotent = adapter.respondToQuote(q1.id, 'accepted');
  assert.equal(idempotent.booking?.id, accepted.booking!.id);

  // Competing quote must be rejected automatically, and accepting it must throw
  const afterAcceptSnap = adapter.getSnapshot();
  const competingQuote = afterAcceptSnap.quotes.find((q) => q.id === q2.id);
  assert.equal(competingQuote?.status, 'rejected');
  assert.throws(() => adapter.respondToQuote(q2.id, 'accepted'));

  // Calendar block created and synced on reschedule -> freed on cancel
  const initialBlock = afterAcceptSnap.availabilityBlocks.find((b) => b.bookingId === accepted.booking!.id);
  assert.ok(initialBlock);
  assert.equal(initialBlock.date, '2026-12-06');

  adapter.proposeReschedule({
    bookingId: accepted.booking!.id,
    proposedDate: '2026-12-08',
    proposedTime: '15:30',
    reason: 'Ajuste de horario',
    proposedById: client.id,
    proposedByRole: 'client',
  });
  const rescheduled = adapter.respondReschedule(accepted.booking!.id, 'pro', true);
  assert.equal(rescheduled.scheduledDate, '2026-12-08');
  assert.equal(rescheduled.scheduledTime, '15:30');
  const updatedBlock = adapter.getSnapshot().availabilityBlocks.find((b) => b.bookingId === accepted.booking!.id);
  assert.equal(updatedBlock?.date, '2026-12-08');
  assert.equal(updatedBlock?.startTime, '15:30');

  adapter.cancelBooking({
    bookingId: accepted.booking!.id,
    actorId: client.id,
    actorRole: 'Cliente',
    reason: 'Cambio de planes',
  });
  const blockAfterCancel = adapter.getSnapshot().availabilityBlocks.find((b) => b.bookingId === accepted.booking!.id);
  assert.equal(blockAfterCancel, undefined);

  // Admin request -> OTP verification -> local prototype init
  const { request: admReq, verificationEmail } = adapter.submitAdminAccessRequest({
    fullName: 'Valeria Admin Local',
    email: 'valeria.admin@oficlick.mx',
    password: 'AdminPass123',
    regionId: 'reg-izcalli',
    colonia: 'Centro Urbano',
    requestedScope: 'central_admin',
    justification: 'Presentación académica local',
  });
  const otpMatch = verificationEmail.textBody.match(/\b(\d{6})\b/);
  assert.ok(otpMatch, 'OTP code must be in verification email textBody');

  const otpRes = adapter.verifyAdminRequestOtp(admReq.id, otpMatch[1]);
  assert.equal(otpRes.verified, true);
  assert.equal(otpRes.request?.status, 'pending_authorization');

  const initRes = adapter.initializeLocalDemoAdmin(admReq.id);
  assert.equal(initRes.profile.primaryRole, 'central_admin');
  assert.equal(adapter.getCurrentProfile()?.id, initRes.profile.id);
  assert.ok(
    adapter
      .getSnapshot()
      .auditLogs.some((log) => log.action === 'INICIALIZAR_ADMIN_PROTOTIPO_LOCAL' && log.targetId === admReq.id)
  );
});


