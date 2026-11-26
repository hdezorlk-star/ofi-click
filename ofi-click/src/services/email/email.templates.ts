import type { EmailRenderResult, EmailTemplateInput } from './email.types';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function wrapBrandedEmailHtml(title: string, bodyParagraphsHtml: string, footerNote: string): string {
  return `<!doctype html>
<html lang="es-MX">
  <body style="margin:0;padding:24px;background-color:#F5F1E8;font-family:Arial,Helvetica,sans-serif;color:#252A27;">
    <div style="max-width:560px;margin:0 auto;background-color:#FFFCF7;border:1px solid #DDD5C8;border-radius:16px;overflow:hidden;">
      <div style="background-color:#304B3E;padding:20px 24px;display:flex;align-items:center;gap:12px;">
        <span style="display:inline-block;padding:6px 10px;border:1px dashed #B96F50;border-radius:8px;color:#F5F1E8;font-size:11px;font-weight:700;letter-spacing:0.06em;">LOGO</span>
        <span style="color:#F5F1E8;font-size:18px;font-weight:700;letter-spacing:-0.01em;">OFI CLICK</span>
      </div>
      <div style="padding:28px 24px;">
        <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#252A27;">${escapeHtml(title)}</h1>
        <div style="font-size:14px;line-height:1.65;color:#252A27;">
          ${bodyParagraphsHtml}
        </div>
      </div>
      <div style="padding:16px 24px;background-color:#EAE3D6;border-top:1px solid #DDD5C8;font-size:12px;line-height:1.5;color:#73766F;">
        ${escapeHtml(footerNote)}
      </div>
    </div>
  </body>
</html>`;
}

export function renderTransactionalEmail(input: EmailTemplateInput): EmailRenderResult {
  switch (input.eventType) {
    case 'welcome': {
      const safeName = escapeHtml(input.userName);
      const safeRole = escapeHtml(input.accountRoleLabel);
      const subject = '¡Te damos la bienvenida a Ofi Click!';
      const bodyHtml = `
        <p style="margin:0 0 12px;">Hola, <strong>${safeName}</strong>.</p>
        <p style="margin:0 0 12px;">¡Te damos la bienvenida a Ofi Click! Tu registro como <strong>${safeRole}</strong> se ha completado correctamente.</p>
        <p style="margin:0 0 12px;">Ya puedes ingresar a tu panel dentro de la aplicación para administrar tu perfil, solicitudes, cotizaciones y mensajes en Cuautitlán Izcalli con precios transparentes en MXN.</p>
        <p style="margin:0;color:#304B3E;font-weight:600;">Gracias por formar parte de OFI CLICK.</p>
      `;
      const textBody = [
        `Hola, ${input.userName}.`,
        '',
        `¡Te damos la bienvenida a Ofi Click! Tu registro como ${input.accountRoleLabel} se ha completado correctamente.`,
        'Ya puedes ingresar a tu panel dentro de la aplicación para administrar tu perfil, solicitudes, cotizaciones y mensajes.',
      ].join('\n');
      return {
        eventType: 'welcome',
        toEmail: input.toEmail,
        toName: input.userName,
        subject,
        htmlBody: wrapBrandedEmailHtml(
          subject,
          bodyHtml,
          'Este mensaje corresponde a la plantilla automática de bienvenida de OFI CLICK.'
        ),
        textBody,
      };
    }

    case 'admin_email_verification': {
      const safeName = escapeHtml(input.userName);
      const safeOtp = escapeHtml(input.otpCode);
      const safeScope = escapeHtml(input.requestedScopeLabel);
      const subject = 'Verifica tu correo para tu solicitud administrativa en Ofi Click';
      const bodyHtml = `
        <p style="margin:0 0 12px;">Hola, <strong>${safeName}</strong>.</p>
        <p style="margin:0 0 12px;">Recibimos tu solicitud de acceso administrativo (${safeScope}) en Ofi Click. Para confirmar la propiedad de este correo electrónico, ingresa el siguiente código de un solo uso:</p>
        <div style="margin:18px 0;padding:14px 18px;border-radius:12px;background-color:#F5F1E8;border:1px solid #B96F50;text-align:center;">
          <span style="font-size:26px;font-weight:700;letter-spacing:0.22em;color:#252A27;">${safeOtp}</span>
        </div>
        <p style="margin:0 0 12px;">Este código expira en <strong>${input.expiresInMinutes} minutos</strong> y es válido para un solo uso.</p>
        <p style="margin:0;color:#73766F;">Nota de seguridad: confirmar tu correo no otorga permisos administrativos automáticamente; tu solicitud permanecerá en espera de autorización.</p>
      `;
      const textBody = [
        `Hola, ${input.userName}.`,
        '',
        `Código de verificación de un solo uso para tu solicitud administrativa (${input.requestedScopeLabel}): ${input.otpCode}`,
        `Vigencia: ${input.expiresInMinutes} minutos.`,
        'Confirmar tu correo valida la propiedad del correo pero no otorga permisos administrativos automáticamente.',
      ].join('\n');
      return {
        eventType: 'admin_email_verification',
        toEmail: input.toEmail,
        toName: input.userName,
        subject,
        htmlBody: wrapBrandedEmailHtml(
          subject,
          bodyHtml,
          'OFI CLICK · Seguridad y control de acceso administrativo.'
        ),
        textBody,
        metadata: {
          otpPreview: input.otpCode,
        },
      };
    }

    case 'password_reset': {
      const safeName = escapeHtml(input.userName);
      const safeCode = escapeHtml(input.resetCode);
      const subject = 'Recuperación de contraseña en Ofi Click';
      const bodyHtml = `
        <p style="margin:0 0 12px;">Hola, <strong>${safeName}</strong>.</p>
        <p style="margin:0 0 12px;">Recibimos una solicitud para restablecer tu contraseña en Ofi Click. Usa este código de verificación de un solo uso:</p>
        <div style="margin:18px 0;padding:14px 18px;border-radius:12px;background-color:#F5F1E8;border:1px solid #304B3E;text-align:center;">
          <span style="font-size:26px;font-weight:700;letter-spacing:0.22em;color:#252A27;">${safeCode}</span>
        </div>
        <p style="margin:0 0 12px;">Este código expira en <strong>${input.expiresInMinutes} minutos</strong>.</p>
        <p style="margin:0;color:#73766F;">Si no solicitaste este restablecimiento, puedes ignorar este mensaje y tu contraseña actual seguirá protegida.</p>
      `;
      const textBody = [
        `Hola, ${input.userName}.`,
        '',
        `Código de recuperación de contraseña (un solo uso): ${input.resetCode}`,
        `Vigencia: ${input.expiresInMinutes} minutos.`,
        'Si no solicitaste este cambio, ignora este mensaje.',
      ].join('\n');
      return {
        eventType: 'password_reset',
        toEmail: input.toEmail,
        toName: input.userName,
        subject,
        htmlBody: wrapBrandedEmailHtml(
          subject,
          bodyHtml,
          'OFI CLICK · Recuperación segura de acceso.'
        ),
        textBody,
        metadata: {
          resetCodePreview: input.resetCode,
        },
      };
    }

    case 'request_received': {
      const subject = `Nueva solicitud de servicio recibida: ${input.serviceTitle}`;
      const bodyHtml = `
        <p style="margin:0 0 12px;">Hola, <strong>${escapeHtml(input.recipientName)}</strong>.</p>
        <p style="margin:0 0 12px;">Recibiste una nueva solicitud para <strong>${escapeHtml(input.serviceTitle)}</strong> en Col. ${escapeHtml(input.colonia)} (fecha deseada: ${escapeHtml(input.desiredDate)}).</p>
        <p style="margin:0;">Ingresa a tu panel de freelancer en Ofi Click para revisarla y enviar tu cotización.</p>
      `;
      const textBody = `Hola, ${input.recipientName}. Recibiste una solicitud para "${input.serviceTitle}" en Col. ${input.colonia} (${input.desiredDate}).`;
      return {
        eventType: 'request_received',
        toEmail: input.toEmail,
        toName: input.recipientName,
        subject,
        htmlBody: wrapBrandedEmailHtml(subject, bodyHtml, 'OFI CLICK · Notificación de solicitud.'),
        textBody,
      };
    }

    case 'quote_received': {
      const subject = `Cotización recibida para "${input.serviceTitle}"`;
      const bodyHtml = `
        <p style="margin:0 0 12px;">Hola, <strong>${escapeHtml(input.clientName)}</strong>.</p>
        <p style="margin:0 0 12px;"><strong>${escapeHtml(input.professionalName)}</strong> envió una cotización por <strong>${escapeHtml(input.totalAmountMxn)}</strong> para <strong>${escapeHtml(input.serviceTitle)}</strong>.</p>
        <p style="margin:0;">Revisa el desglose y decide desde tu panel de cliente en Ofi Click.</p>
      `;
      const textBody = `Hola, ${input.clientName}. ${input.professionalName} envió una cotización por ${input.totalAmountMxn} para "${input.serviceTitle}".`;
      return {
        eventType: 'quote_received',
        toEmail: input.toEmail,
        toName: input.clientName,
        subject,
        htmlBody: wrapBrandedEmailHtml(subject, bodyHtml, 'OFI CLICK · Cotización recibida.'),
        textBody,
      };
    }

    case 'quote_accepted': {
      const subject = `¡Cotización aceptada! Servicio: ${input.serviceTitle}`;
      const bodyHtml = `
        <p style="margin:0 0 12px;">Hola, <strong>${escapeHtml(input.professionalName)}</strong>.</p>
        <p style="margin:0 0 12px;"><strong>${escapeHtml(input.clientName)}</strong> aceptó tu cotización por <strong>${escapeHtml(input.totalAmountMxn)}</strong> para <strong>${escapeHtml(input.serviceTitle)}</strong>.</p>
        <p style="margin:0;">Consulta la cita programada en tu panel de freelancer.</p>
      `;
      const textBody = `Hola, ${input.professionalName}. ${input.clientName} aceptó tu cotización por ${input.totalAmountMxn} para "${input.serviceTitle}".`;
      return {
        eventType: 'quote_accepted',
        toEmail: input.toEmail,
        toName: input.professionalName,
        subject,
        htmlBody: wrapBrandedEmailHtml(subject, bodyHtml, 'OFI CLICK · Aceptación de cotización.'),
        textBody,
      };
    }

    case 'booking_confirmed': {
      const subject = `Servicio programado confirmado: ${input.serviceTitle}`;
      const bodyHtml = `
        <p style="margin:0 0 12px;">Hola, <strong>${escapeHtml(input.recipientName)}</strong>.</p>
        <p style="margin:0 0 12px;">Tu contratación de <strong>${escapeHtml(input.serviceTitle)}</strong> quedó programada para el <strong>${escapeHtml(input.scheduledDate)}</strong> a las <strong>${escapeHtml(input.scheduledTime)}</strong>.</p>
        <p style="margin:0;">Recuerda que el acuerdo de pago se realiza directamente entre cliente y profesional.</p>
      `;
      const textBody = `Hola, ${input.recipientName}. Servicio "${input.serviceTitle}" confirmado para ${input.scheduledDate} a las ${input.scheduledTime}.`;
      return {
        eventType: 'booking_confirmed',
        toEmail: input.toEmail,
        toName: input.recipientName,
        subject,
        htmlBody: wrapBrandedEmailHtml(subject, bodyHtml, 'OFI CLICK · Confirmación de cita.'),
        textBody,
      };
    }

    case 'booking_rescheduled': {
      const subject = `Reprogramación confirmada: ${input.serviceTitle}`;
      const bodyHtml = `
        <p style="margin:0 0 12px;">Hola, <strong>${escapeHtml(input.recipientName)}</strong>.</p>
        <p style="margin:0 0 12px;">La cita para <strong>${escapeHtml(input.serviceTitle)}</strong> fue reprogramada de común acuerdo para el <strong>${escapeHtml(input.newDate)}</strong> a las <strong>${escapeHtml(input.newTime)}</strong>.</p>
      `;
      const textBody = `Hola, ${input.recipientName}. "${input.serviceTitle}" reprogramado para ${input.newDate} a las ${input.newTime}.`;
      return {
        eventType: 'booking_rescheduled',
        toEmail: input.toEmail,
        toName: input.recipientName,
        subject,
        htmlBody: wrapBrandedEmailHtml(subject, bodyHtml, 'OFI CLICK · Reprogramación de cita.'),
        textBody,
      };
    }

    case 'booking_cancelled': {
      const subject = `Servicio cancelado: ${input.serviceTitle}`;
      const bodyHtml = `
        <p style="margin:0 0 12px;">Hola, <strong>${escapeHtml(input.recipientName)}</strong>.</p>
        <p style="margin:0 0 12px;">La contratación de <strong>${escapeHtml(input.serviceTitle)}</strong> fue cancelada. Motivo registrado: ${escapeHtml(input.reason)}.</p>
      `;
      const textBody = `Hola, ${input.recipientName}. "${input.serviceTitle}" fue cancelado. Motivo: ${input.reason}.`;
      return {
        eventType: 'booking_cancelled',
        toEmail: input.toEmail,
        toName: input.recipientName,
        subject,
        htmlBody: wrapBrandedEmailHtml(subject, bodyHtml, 'OFI CLICK · Cancelación de servicio.'),
        textBody,
      };
    }

    case 'booking_reminder': {
      const subject = `Recordatorio de servicio: ${input.serviceTitle}`;
      const bodyHtml = `
        <p style="margin:0 0 12px;">Hola, <strong>${escapeHtml(input.recipientName)}</strong>.</p>
        <p style="margin:0 0 12px;">Te recordamos tu cita para <strong>${escapeHtml(input.serviceTitle)}</strong> el <strong>${escapeHtml(input.scheduledDate)}</strong> a las <strong>${escapeHtml(input.scheduledTime)}</strong>.</p>
      `;
      const textBody = `Hola, ${input.recipientName}. Recordatorio: "${input.serviceTitle}" el ${input.scheduledDate} a las ${input.scheduledTime}.`;
      return {
        eventType: 'booking_reminder',
        toEmail: input.toEmail,
        toName: input.recipientName,
        subject,
        htmlBody: wrapBrandedEmailHtml(subject, bodyHtml, 'OFI CLICK · Recordatorio de cita.'),
        textBody,
      };
    }
  }
}
