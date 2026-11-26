import { getDataProvider } from './provider';
import type { ChatAttachmentMetadata, ChatMessage } from '../types/oficlick';

export const messagesService = {
  getOrCreateConversation: (input: {
    participantIds: string[];
    requestId?: string;
    bookingId?: string;
  }) => getDataProvider().getOrCreateConversation(input),
  sendMessage: (input: {
    conversationId: string;
    senderId: string;
    text: string;
    attachmentName?: string;
    attachmentType?: ChatMessage['attachmentType'];
    attachment?: ChatAttachmentMetadata;
    quoteId?: string;
    sharedLocationNote?: string;
  }) => getDataProvider().sendMessage(input),
  markRead: (conversationId: string, profileId: string) =>
    getDataProvider().markConversationRead(conversationId, profileId),
  toggleBlock: (conversationId: string, profileId: string) =>
    getDataProvider().toggleBlockConversation(conversationId, profileId),
};
