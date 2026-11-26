import { getDataProvider } from './provider';
import type { Category, ModerationReport, Profile, Region, SupportTicket, UserRoleType, VerificationRequestStatus } from '../types/oficlick';

export const adminService = {
  upsertCategory: (category: Category, admin: Profile) =>
    getDataProvider().upsertCategory(category, admin),
  toggleCategoryActive: (categoryId: string, admin: Profile) =>
    getDataProvider().toggleCategoryActive(categoryId, admin),
  upsertRegion: (region: Region, admin: Profile) =>
    getDataProvider().upsertRegion(region, admin),
  toggleRegionActive: (regionId: string, admin: Profile) =>
    getDataProvider().toggleRegionActive(regionId, admin),
  reviewVerification: (input: {
    verificationId: string;
    status: VerificationRequestStatus;
    reason: string;
    adminId: string;
    adminName: string;
    adminRole: UserRoleType;
  }) => getDataProvider().reviewVerification(input),
  toggleProPaused: (proId: string, admin: Profile, reason: string) =>
    getDataProvider().toggleProPaused(proId, admin, reason),
  toggleUserSuspended: (profileId: string, admin: Profile, reason: string) =>
    getDataProvider().toggleUserSuspended(profileId, admin, reason),
  moderateReport: (
    reportId: string,
    status: ModerationReport['status'],
    admin: Profile,
    notes: string
  ) => getDataProvider().moderateReport(reportId, status, admin, notes),
  toggleReviewHidden: (reviewId: string, admin: Profile, reason: string) =>
    getDataProvider().toggleReviewHidden(reviewId, admin, reason),
  createSupportTicket: (input: Omit<SupportTicket, 'id' | 'createdAt' | 'status'>) =>
    getDataProvider().createSupportTicket(input),
  updateTicketStatus: (ticketId: string, status: SupportTicket['status'], admin: Profile) =>
    getDataProvider().updateTicketStatus(ticketId, status, admin),
  replyToTicket: (
    ticketId: string,
    evidenceNote: string,
    status: SupportTicket['status'],
    admin: Profile
  ) => getDataProvider().replyToTicket(ticketId, evidenceNote, status, admin),
  createReport: (input: Omit<ModerationReport, 'id' | 'createdAt' | 'status'>) =>
    getDataProvider().createReport(input),
  reviewAdminAccessRequest: (
    input: Parameters<ReturnType<typeof getDataProvider>['reviewAdminAccessRequest']>[0]
  ) => getDataProvider().reviewAdminAccessRequest(input),
  logAdminAudit: (input: Parameters<ReturnType<typeof getDataProvider>['logAdminAudit']>[0]) =>
    getDataProvider().logAdminAudit(input),
};
