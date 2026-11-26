import { getDataProvider } from './provider';
import type { Profile, UserRoleType } from '../types/oficlick';

export const authService = {
  getCurrentProfile: (): Profile | null => getDataProvider().getCurrentProfile(),
  switchWorkspaceRole: (role: UserRoleType): Profile => getDataProvider().switchWorkspaceRole(role),
  signInWithEmail: (email: string, passwordAttempt: string) =>
    getDataProvider().signInWithEmail(email, passwordAttempt),
  registerAccount: (input: Parameters<ReturnType<typeof getDataProvider>['registerAccount']>[0]) =>
    getDataProvider().registerAccount(input),
  authenticateWithGoogleProfile: (
    input: Parameters<ReturnType<typeof getDataProvider>['authenticateWithGoogleProfile']>[0]
  ) => getDataProvider().authenticateWithGoogleProfile(input),
  submitAdminAccessRequest: (
    input: Parameters<ReturnType<typeof getDataProvider>['submitAdminAccessRequest']>[0]
  ) => getDataProvider().submitAdminAccessRequest(input),
  resendAdminVerificationCode: (requestId: string) =>
    getDataProvider().resendAdminVerificationCode(requestId),
  verifyAdminRequestOtp: (requestId: string, codeAttempt: string) =>
    getDataProvider().verifyAdminRequestOtp(requestId, codeAttempt),
  initializeLocalDemoAdmin: (requestId: string) =>
    getDataProvider().initializeLocalDemoAdmin(requestId),
  confirmEmail: (profileId: string): Profile => getDataProvider().confirmEmail(profileId),
  requestPasswordRecovery: (email: string) => getDataProvider().requestPasswordRecovery(email),
  validatePasswordRecoveryCode: (email: string, codeAttempt: string) =>
    getDataProvider().validatePasswordRecoveryCode(email, codeAttempt),
  completePasswordReset: (email: string, codeAttempt: string, newPassword: string) =>
    getDataProvider().completePasswordReset(email, codeAttempt, newPassword),
  resendSignupConfirmation: (email: string) =>
    getDataProvider().resendSignupConfirmation
      ? getDataProvider().resendSignupConfirmation!(email)
      : Promise.resolve({ sent: false, message: 'No disponible en modo local.' }),
  signOut: () => getDataProvider().signOut(),
  deleteAccount: (profileId: string) => getDataProvider().deleteAccount(profileId),
};

