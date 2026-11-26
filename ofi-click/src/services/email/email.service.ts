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

class TransactionalEmailService {
  private adapter: EmailProviderAdapter = new LocalPreparedEmailAdapter();

  getProviderStatus(): { providerName: string; configured: boolean } {
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
}

export const emailService = new TransactionalEmailService();
