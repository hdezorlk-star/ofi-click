import { getDataProvider } from './provider';
import type { Review } from '../types/oficlick';

export const reviewsService = {
  publishReview: (
    input: Omit<Review, 'id' | 'createdAt' | 'reported' | 'hiddenByAdmin'>
  ) => getDataProvider().publishReview(input),
  replyToReview: (reviewId: string, responseText: string) =>
    getDataProvider().replyToReview(reviewId, responseText),
  reportReview: (reviewId: string, reporterId: string, reason: string) =>
    getDataProvider().reportReview(reviewId, reporterId, reason),
};
