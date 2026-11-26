import type {
  Booking,
  PricingMode,
  ProfessionalProfile,
  Profile,
  Review,
  SearchFilters,
  ServiceItem,
  ServiceRequest,
  SortOption,
  UserRoleType,
} from '../types/oficlick';

export const OFFICIAL_ROLES: readonly UserRoleType[] = [
  'client',
  'independent_pro',
  'central_admin',
] as const;

export type WorkspacePanelPage =
  | 'client-panel'
  | 'pro-panel'
  | 'central-admin-panel';

export function getDefaultRouteForRole(role: UserRoleType): {
  page: WorkspacePanelPage;
  tab: string;
} {
  switch (role) {
    case 'independent_pro':
      return { page: 'pro-panel', tab: 'inicio' };
    case 'central_admin':
      return { page: 'central-admin-panel', tab: 'resumen' };
    case 'client':
    default:
      return { page: 'client-panel', tab: 'inicio' };
  }
}

export function canAccessWorkspaceRoute(
  user: Pick<Profile, 'primaryRole' | 'roles'> | null,
  page: WorkspacePanelPage
): boolean {
  if (!user) return false;
  switch (page) {
    case 'client-panel':
      return user.primaryRole === 'client';
    case 'pro-panel':
      return user.primaryRole === 'independent_pro';
    case 'central-admin-panel':
      return user.primaryRole === 'central_admin' || user.roles.includes('central_admin');
    default:
      return false;
  }
}

export function isRoutePageAllowedForUser(
  user: Pick<Profile, 'primaryRole' | 'roles'> | null,
  page: string
): boolean {
  const isWorkspacePanel =
    page === 'client-panel' ||
    page === 'pro-panel' ||
    page === 'central-admin-panel';
  if (!user) {
    return !isWorkspacePanel;
  }
  switch (user.primaryRole) {
    case 'independent_pro':
      return page === 'pro-panel';
    case 'central_admin':
      return page === 'central-admin-panel';
    case 'client':
      return page !== 'pro-panel' && page !== 'central-admin-panel';
    default:
      return false;
  }
}

export function canCentralAdminManageGlobal(
  admin: Pick<Profile, 'primaryRole' | 'roles'> | null
): boolean {
  if (!admin) return false;
  return admin.primaryRole === 'central_admin' || admin.roles.includes('central_admin');
}

export function formatMXN(amount?: number | null): string {
  if (amount === undefined || amount === null || Number.isNaN(amount)) {
    return 'A cotizar';
  }
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateMX(iso: string, includeTime = false): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  }).format(date);
}

export function formatPricingLabel(mode: PricingMode, amount?: number): string {
  switch (mode) {
    case 'fixed':
      return amount ? `${formatMXN(amount)} fijo` : 'Precio fijo';
    case 'hourly':
      return amount ? `${formatMXN(amount)} / hora` : 'Por hora';
    case 'visit':
      return amount ? `${formatMXN(amount)} visita` : 'Por visita';
    case 'unit':
      return amount ? `${formatMXN(amount)} / unidad` : 'Por unidad';
    case 'from':
      return amount ? `Desde ${formatMXN(amount)}` : 'Precio desde';
    case 'custom_quote':
    default:
      return 'Cotización personalizada';
  }
}

export function calculateQuoteTotals(input: {
  laborAmount: number;
  materialsAmount: number;
  additionalCharges: number;
  discountAmount: number;
}): { subtotal: number; totalAmount: number; valid: boolean; error?: string } {
  const { laborAmount, materialsAmount, additionalCharges, discountAmount } = input;
  if (
    laborAmount < 0 ||
    materialsAmount < 0 ||
    additionalCharges < 0 ||
    discountAmount < 0
  ) {
    return {
      subtotal: 0,
      totalAmount: 0,
      valid: false,
      error: 'Los importes no pueden ser negativos.',
    };
  }
  const subtotal = laborAmount + materialsAmount + additionalCharges;
  if (discountAmount > subtotal) {
    return {
      subtotal,
      totalAmount: 0,
      valid: false,
      error: 'El descuento no puede superar el subtotal de la cotización.',
    };
  }
  const totalAmount = Math.max(0, subtotal - discountAmount);
  if (totalAmount <= 0) {
    return {
      subtotal,
      totalAmount: 0,
      valid: false,
      error: 'El importe total debe ser mayor a $0 MXN.',
    };
  }
  return { subtotal, totalAmount, valid: true };
}

/**
 * Haversine distance in km (only used when user explicitly authorizes location or between approximate zone centroids).
 */
export function calculateDistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Compatibility matcher for open requests.
 * IMPORTANT: Returns ALL compatible professionals with NO arbitrary 3/5/10 limit.
 */
export function isProfessionalCompatible(
  pro: ProfessionalProfile,
  request: Pick<
    ServiceRequest,
    'categoryId' | 'colonia' | 'regionId' | 'urgency' | 'requiresHomeService'
  >
): boolean {
  if (!pro.published || !pro.profileComplete || pro.pausedByAdmin) {
    return false;
  }
  if (pro.regionId !== request.regionId) {
    return false;
  }
  if (!pro.categoryIds.includes(request.categoryId)) {
    return false;
  }
  if (pro.availabilityStatus === 'unavailable') {
    return false;
  }
  if (request.requiresHomeService && !pro.homeService && !pro.willingToTravel) {
    return false;
  }
  if (request.urgency === 'urgent' && !pro.urgentAttention) {
    return false;
  }
  const coloniaLower = request.colonia.trim().toLowerCase();
  if (coloniaLower) {
    const coversColonia =
      pro.primaryColonia.toLowerCase() === coloniaLower ||
      pro.additionalColonias.some((c) => c.toLowerCase() === coloniaLower) ||
      pro.coverageZones.some(
        (z) =>
          z.toLowerCase().includes('todo cuautitlán izcalli') ||
          z.toLowerCase() === coloniaLower
      );
    if (!coversColonia) {
      return false;
    }
  }
  return true;
}

export function findCompatibleProfessionals(
  pros: ProfessionalProfile[],
  request: Pick<
    ServiceRequest,
    'categoryId' | 'colonia' | 'regionId' | 'urgency' | 'requiresHomeService'
  >
): ProfessionalProfile[] {
  return pros
    .filter((pro) => isProfessionalCompatible(pro, request))
    .sort((a, b) => {
      const scoreA =
        a.ratingAvg * 20 +
        Math.min(a.completedJobsCount, 50) * 0.4 +
        (a.verificationLevel >= 3 ? 10 : 0);
      const scoreB =
        b.ratingAvg * 20 +
        Math.min(b.completedJobsCount, 50) * 0.4 +
        (b.verificationLevel >= 3 ? 10 : 0);
      return scoreB - scoreA;
    });
}

export function getProMinPublishedPrice(
  proId: string,
  services: ServiceItem[]
): number | null {
  const prices = services
    .filter(
      (s) =>
        s.professionalId === proId &&
        s.status === 'published' &&
        typeof s.priceAmount === 'number' &&
        s.priceAmount > 0
    )
    .map((s) => s.priceAmount as number);
  if (prices.length === 0) return null;
  return Math.min(...prices);
}

export function filterAndSortProfessionals(
  pros: ProfessionalProfile[],
  services: ServiceItem[],
  filters: SearchFilters,
  sortBy: SortOption,
  userCoords?: { lat: number; lng: number } | null
): ProfessionalProfile[] {
  const q = filters.query.trim().toLowerCase();
  const coloniaFilter = filters.colonia.trim().toLowerCase();
  const zoneFilter = filters.zone.trim().toLowerCase();
  const selectedServiceRef = filters.serviceId
    ? services.find((s) => s.id === filters.serviceId)
    : undefined;
  const selectedServiceNameLower = selectedServiceRef?.name.trim().toLowerCase() || '';

  const filtered = pros.filter((pro) => {
    // Only complete, published, non-paused pros appear in public search
    if (!pro.published || !pro.profileComplete || pro.pausedByAdmin) return false;

    if (filters.categoryId && !pro.categoryIds.includes(filters.categoryId)) {
      return false;
    }
    if (filters.subcategoryId) {
      const hasSubcatService = services.some(
        (s) =>
          s.professionalId === pro.id &&
          s.status === 'published' &&
          s.subcategoryId === filters.subcategoryId
      );
      if (!hasSubcatService) return false;
    }
    if (filters.serviceId) {
      const hasMatchingService = services.some(
        (s) =>
          s.professionalId === pro.id &&
          s.status === 'published' &&
          (s.id === filters.serviceId ||
            (selectedServiceNameLower.length > 0 &&
              s.name.trim().toLowerCase() === selectedServiceNameLower))
      );
      if (!hasMatchingService) return false;
    }
    if (coloniaFilter) {
      const matchesColonia =
        pro.primaryColonia.toLowerCase().includes(coloniaFilter) ||
        pro.additionalColonias.some((c) => c.toLowerCase().includes(coloniaFilter)) ||
        pro.coverageZones.some((z) =>
          z.toLowerCase().includes('todo cuautitlán izcalli')
        );
      if (!matchesColonia) return false;
    }
    if (zoneFilter) {
      const matchesZone = pro.coverageZones.some((z) =>
        z.toLowerCase().includes(zoneFilter)
      );
      if (!matchesZone) return false;
    }
    if (filters.maxDistanceKm !== null && userCoords) {
      const dist = calculateDistanceKm(userCoords, pro.approximateCoords);
      if (dist > filters.maxDistanceKm) return false;
    }
    if (filters.minRating > 0 && pro.ratingAvg < filters.minRating) return false;
    if (filters.minReviews > 0 && pro.reviewsCount < filters.minReviews) {
      return false;
    }
    if (filters.maxPrice !== null) {
      const minPrice = getProMinPublishedPrice(pro.id, services);
      if (minPrice === null || minPrice > filters.maxPrice) return false;
    }
    if (
      filters.availability !== 'all' &&
      pro.availabilityStatus !== filters.availability
    ) {
      return false;
    }
    if (filters.urgentOnly && !pro.urgentAttention) return false;
    if (filters.homeServiceOnly && !pro.homeService) return false;
    if (filters.verifiedOnly && pro.verificationLevel < 3) return false;
    if (
      filters.minExperienceYears > 0 &&
      pro.yearsExperience < filters.minExperienceYears
    ) {
      return false;
    }
    if (
      filters.minCompletedJobs > 0 &&
      pro.completedJobsCount < filters.minCompletedJobs
    ) {
      return false;
    }
    if (q) {
      const proServices = services.filter(
        (s) => s.professionalId === pro.id && s.status === 'published'
      );
      const haystack = [
        pro.displayName,
        pro.commercialName ?? '',
        pro.bio,
        pro.primaryColonia,
        ...pro.specialties,
        ...pro.additionalColonias,
        ...proServices.map((s) => `${s.name} ${s.description}`),
      ]
        .join(' ')
        .toLowerCase();
      const tokens = q.split(/\s+/).filter(Boolean);
      const matchesAllTokens = tokens.every((tok) => haystack.includes(tok));
      if (!matchesAllTokens) return false;
    }
    return true;
  });

  return [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'rating':
        return b.ratingAvg - a.ratingAvg || b.reviewsCount - a.reviewsCount;
      case 'reviews':
        return b.reviewsCount - a.reviewsCount || b.ratingAvg - a.ratingAvg;
      case 'experience':
        return b.yearsExperience - a.yearsExperience;
      case 'price_asc': {
        const pA = getProMinPublishedPrice(a.id, services) ?? Number.MAX_SAFE_INTEGER;
        const pB = getProMinPublishedPrice(b.id, services) ?? Number.MAX_SAFE_INTEGER;
        return pA - pB;
      }
      case 'distance': {
        if (!userCoords) return b.ratingAvg - a.ratingAvg;
        const dA = calculateDistanceKm(userCoords, a.approximateCoords);
        const dB = calculateDistanceKm(userCoords, b.approximateCoords);
        return dA - dB;
      }
      case 'relevance':
      default: {
        const scoreA =
          a.ratingAvg * 15 +
          Math.min(a.completedJobsCount, 80) * 0.25 +
          (a.verificationLevel >= 3 ? 8 : 0) +
          (a.availabilityStatus === 'available' ? 5 : 0);
        const scoreB =
          b.ratingAvg * 15 +
          Math.min(b.completedJobsCount, 80) * 0.25 +
          (b.verificationLevel >= 3 ? 8 : 0) +
          (b.availabilityStatus === 'available' ? 5 : 0);
        return scoreB - scoreA;
      }
    }
  });
}

export function canUserLeaveReview(
  booking: Booking,
  existingReviews: Review[],
  clientId: string
): { allowed: boolean; reason?: string } {
  if (booking.clientId !== clientId) {
    return {
      allowed: false,
      reason: 'Solo el cliente titular de la contratación puede publicar una reseña.',
    };
  }
  if (booking.status !== 'completed') {
    return {
      allowed: false,
      reason: 'La reseña solo se habilita cuando el servicio está completado.',
    };
  }
  const duplicate = existingReviews.some(
    (r) => r.bookingId === booking.id && r.clientId === clientId
  );
  if (duplicate) {
    return {
      allowed: false,
      reason: 'Ya publicaste una reseña para esta contratación.',
    };
  }
  return { allowed: true };
}

export function canAdminAccessRegion(
  admin: Pick<Profile, 'roles' | 'regionId'>,
  _targetRegionId: string
): boolean {
  return admin.roles.includes('central_admin');
}
