import type { PreparedEmailRecord, TransactionalEmailEventType } from '../../types/oficlick';

export type EmailTemplateInput =
  | {
      eventType: 'welcome';
      toEmail: string;
      userName: string;
      accountRoleLabel: 'Cliente' | 'Freelancer / Trabajador independiente';
    }
  | {
      eventType: 'admin_email_verification';
      toEmail: string;
      userName: string;
      otpCode: string;
      expiresInMinutes: number;
      requestedScopeLabel: string;
    }
  | {
      eventType: 'password_reset';
      toEmail: string;
      userName: string;
      resetCode: string;
      expiresInMinutes: number;
    }
  | {
      eventType: 'request_received';
      toEmail: string;
      recipientName: string;
      serviceTitle: string;
      colonia: string;
      desiredDate: string;
    }
  | {
      eventType: 'quote_received';
      toEmail: string;
      clientName: string;
      professionalName: string;
      serviceTitle: string;
      totalAmountMxn: string;
    }
  | {
      eventType: 'quote_accepted';
      toEmail: string;
      professionalName: string;
      clientName: string;
      serviceTitle: string;
      totalAmountMxn: string;
    }
  | {
      eventType: 'booking_confirmed';
      toEmail: string;
      recipientName: string;
      serviceTitle: string;
      scheduledDate: string;
      scheduledTime: string;
    }
  | {
      eventType: 'booking_rescheduled';
      toEmail: string;
      recipientName: string;
      serviceTitle: string;
      newDate: string;
      newTime: string;
    }
  | {
      eventType: 'booking_cancelled';
      toEmail: string;
      recipientName: string;
      serviceTitle: string;
      reason: string;
    }
  | {
      eventType: 'booking_reminder';
      toEmail: string;
      recipientName: string;
      serviceTitle: string;
      scheduledDate: string;
      scheduledTime: string;
    };

export interface EmailRenderResult {
  eventType: TransactionalEmailEventType;
  toEmail: string;
  toName: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  metadata?: Record<string, string>;
}

export interface EmailProviderAdapter {
  readonly providerName: string;
  readonly configured: boolean;
  prepare(rendered: EmailRenderResult): PreparedEmailRecord;
}
