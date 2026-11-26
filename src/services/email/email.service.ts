import type { PreparedEmailRecord } from '../../types/oficlick';
import { renderTransactionalEmail } from './email.templates';
import type { EmailProviderAdapter, EmailRenderResult, EmailTemplateInput } from './email.types';

class LocalPreparedEmailAdapter implements EmailProviderAdapter {
  readonly providerName = 'local_prepared_outbox';
  readonly configured = false;

  prepare(rendered: EmailRenderResult): PreparedEmailRecord {
    return {
      id: `eml-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`,
      eventType: rendered.eventType,
      toEmail: rendered.toEmail,
      toName: rendered.toName,
      subject: rendered.subject,
      htmlBody: rendered.htmlBody,
      textBody: rendered.textBody,
      deliveryStatus: 'prepared_local_only',
      providerConfigured: false,
      metadata: rendered.metadata,
      createdAt: new Date().toISOString(),
    };
  }
}

export interface ServerEmailStatus {
  configured: boolean;
  provider: 'smtp' | 'resend' | 'none';
}

class TransactionalEmailService {
  private adapter: EmailProviderAdapter = new LocalPreparedEmailAdapter();
  private lastServerStatus: ServerEmailStatus | null = null;

  getProviderStatus(): { providerName: string; configured: boolean } {
    if (this.lastServerStatus?.configured) {
      return {
        providerName: this.lastServerStatus.provider,
        configured: true,
      };
    }
    return {
      providerName: this.adapter.providerName,
      configured: this.adapter.configured,
    };
  }

  setAdapter(adapter: EmailProviderAdapter): void {
    this.adapter = adapter;
  }

  prepareEmail(input: EmailTemplateInput): PreparedEmailRecord {
    const rendered = renderTransactionalEmail(input);
    return this.adapter.prepare(rendered);
  }

  async checkServerEmailStatus(): Promise<ServerEmailStatus> {
    if (typeof fetch === 'undefined') {
      return { configured: false, provider: 'none' };
    }
    try {
      const res = await fetch('/api/emails/status', { method: 'GET' });
      if (!res.ok) {
        return { configured: false, provider: 'none' };
      }
      const data = (await res.json()) as ServerEmailStatus;
      this.lastServerStatus = data;
      return data;
    } catch {
      return { configured: false, provider: 'none' };
    }
  }

  async sendEmail(input: EmailTemplateInput): Promise<PreparedEmailRecord> {
    const record = this.prepareEmail(input);
    if (typeof fetch === 'undefined') {
      return record;
    }

    try {
      const res = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toEmail: record.toEmail,
          toName: record.toName,
          subject: record.subject,
          htmlBody: record.htmlBody,
          textBody: record.textBody,
          eventType: record.eventType,
        }),
      });

      if (!res.ok) {
        return {
          ...record,
          deliveryStatus: 'failed',
          providerConfigured: this.lastServerStatus?.configured ?? false,
        };
      }

      const payload = (await res.json()) as {
        delivered?: boolean;
        providerConfigured?: boolean;
        provider?: 'smtp' | 'resend' | 'none';
      };

      this.lastServerStatus = {
        configured: Boolean(payload.providerConfigured),
        provider: payload.provider || 'none',
      };

      return {
        ...record,
        providerConfigured: Boolean(payload.providerConfigured),
        deliveryStatus: payload.delivered
          ? 'sent'
          : payload.providerConfigured
          ? 'failed'
          : 'prepared_local_only',
      };
    } catch {
      return record;
    }
  }
}

export const emailService = new TransactionalEmailService();
