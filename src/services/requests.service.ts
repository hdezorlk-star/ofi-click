import { getDataProvider } from './provider';
import type { ServiceRequest } from '../types/oficlick';

export const requestsService = {
  createServiceRequest: (
    input: Omit<ServiceRequest, 'id' | 'createdAt' | 'status' | 'recipientStatuses' | 'isDemo'>
  ) => getDataProvider().createServiceRequest(input),
  updateRecipientStatus: (
    requestId: string,
    proId: string,
    status: ServiceRequest['recipientStatuses'][string]
  ) => getDataProvider().updateRequestRecipientStatus(requestId, proId, status),
  closeOrCancelRequest: (requestId: string, status: 'closed' | 'cancelled') =>
    getDataProvider().closeOrCancelRequest(requestId, status),
};
