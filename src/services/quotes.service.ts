import { getDataProvider } from './provider';

export const quotesService = {
  sendOrReviseQuote: (
    input: Parameters<ReturnType<typeof getDataProvider>['sendOrReviseQuote']>[0]
  ) => getDataProvider().sendOrReviseQuote(input),
  respondToQuote: (quoteId: string, decision: 'accepted' | 'rejected') =>
    getDataProvider().respondToQuote(quoteId, decision),
};
