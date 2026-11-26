import { getDataProvider } from './provider';
import type { BookingStatus } from '../types/oficlick';

export const bookingsService = {
  updateStatus: (input: {
    bookingId: string;
    status: BookingStatus;
    actorId: string;
    actorName: string;
    note: string;
    photos?: string[];
  }) => getDataProvider().updateBookingStatus(input),
  proposeReschedule: (
    input: Parameters<ReturnType<typeof getDataProvider>['proposeReschedule']>[0]
  ) => getDataProvider().proposeReschedule(input),
  respondReschedule: (bookingId: string, responderRole: 'client' | 'pro', accept: boolean) =>
    getDataProvider().respondReschedule(bookingId, responderRole, accept),
  cancelBooking: (input: {
    bookingId: string;
    actorId: string;
    actorRole: string;
    reason: string;
  }) => getDataProvider().cancelBooking(input),
};
