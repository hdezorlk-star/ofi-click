import { getDataProvider } from './provider';
import type {
  AvailabilityBlock,
  AvailabilityStatus,
  DaySchedule,
  ProfessionalProfile,
  Profile,
  VerificationDocKind,
} from '../types/oficlick';

export const profilesService = {
  updateProfile: (profileId: string, patch: Partial<Profile>) =>
    getDataProvider().updateProfile(profileId, patch),
  updateProfessionalProfile: (proId: string, patch: Partial<ProfessionalProfile>) =>
    getDataProvider().updateProfessionalProfile(proId, patch),
  updateSchedule: (proId: string, schedule: DaySchedule[], status: AvailabilityStatus) =>
    getDataProvider().updateSchedule(proId, schedule, status),
  addAvailabilityBlock: (block: Omit<AvailabilityBlock, 'id'>) =>
    getDataProvider().addAvailabilityBlock(block),
  removeAvailabilityBlock: (blockId: string) =>
    getDataProvider().removeAvailabilityBlock(blockId),
  submitVerificationDocuments: (
    proId: string,
    documents: {
      docKind?: VerificationDocKind;
      label: string;
      fileName: string;
      mimeType?: string;
      sizeBytes?: number;
      previewRefKey?: string;
      isDemo?: boolean;
    }[]
  ) => getDataProvider().submitVerificationDocuments(proId, documents),
  toggleFavorite: (clientId: string, professionalId: string) =>
    getDataProvider().toggleFavorite(clientId, professionalId),
};
