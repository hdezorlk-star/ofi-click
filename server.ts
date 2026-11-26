import 'dotenv/config';
import express from 'express';
import nodemailer from 'nodemailer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getEmailProviderConfig() {
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim();
  const smtpFrom = process.env.SMTP_FROM?.trim() || smtpUser || 'no-reply@oficlick.mx';
  const resendApiKey = process.env.RESEND_API_KEY?.trim();

  if (smtpHost && smtpUser && smtpPass) {
    return {
      configured: true,
      provider: 'smtp' as const,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      from: smtpFrom,
    };
  }

  if (resendApiKey) {
    return {
      configured: true,
      provider: 'resend' as const,
      resendApiKey,
      from: process.env.SMTP_FROM?.trim() || 'OFI CLICK <onboarding@resend.dev>',
    };
  }

  return {
    configured: false,
    provider: 'none' as const,
    from: smtpFrom,
  };
}

function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim().slice(0, 200);
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '256kb' }));

  app.get('/api/emails/status', (_req, res) => {
    const cfg = getEmailProviderConfig();
    res.json({
      configured: cfg.configured,
      provider: cfg.provider,
    });
  });

  app.post('/api/emails/send', async (req, res) => {
    const body = req.body as {
      toEmail?: unknown;
      toName?: unknown;
      subject?: unknown;
      htmlBody?: unknown;
      textBody?: unknown;
      eventType?: unknown;
    };

    const toEmail = typeof body.toEmail === 'string' ? sanitizeHeaderValue(body.toEmail) : '';
    const toName = typeof body.toName === 'string' ? sanitizeHeaderValue(body.toName) : '';
    const subject = typeof body.subject === 'string' ? sanitizeHeaderValue(body.subject) : '';
    const htmlBody = typeof body.htmlBody === 'string' ? body.htmlBody.slice(0, 50_000) : '';
    const textBody = typeof body.textBody === 'string' ? body.textBody.slice(0, 20_000) : '';

    if (!EMAIL_RE.test(toEmail) || !subject || (!htmlBody && !textBody)) {
      res.status(400).json({
        delivered: false,
        providerConfigured: false,
        provider: 'none',
        message: 'Datos inválidos para el envío del correo.',
      });
      return;
    }

    const cfg = getEmailProviderConfig();
    if (!cfg.configured) {
      res.status(200).json({
        delivered: false,
        providerConfigured: false,
        provider: 'none',
        message: 'Proveedor SMTP o Resend no configurado en el servidor.',
      });
      return;
    }

    try {
      if (cfg.provider === 'smtp') {
        const transporter = nodemailer.createTransport({
          host: cfg.smtpHost,
          port: cfg.smtpPort,
          secure: cfg.smtpPort === 465,
          auth: {
            user: cfg.smtpUser,
            pass: cfg.smtpPass,
          },
        });

        await transporter.sendMail({
          from: cfg.from,
          to: toName ? `"${toName.replace(/"/g, '')}" <${toEmail}>` : toEmail,
          subject,
          text: textBody,
          html: htmlBody,
        });

        res.json({
          delivered: true,
          providerConfigured: true,
          provider: 'smtp',
          message: 'Correo enviado correctamente vía SMTP.',
        });
        return;
      }

      if (cfg.provider === 'resend') {
        const resendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfg.resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: cfg.from,
            to: [toEmail],
            subject,
            html: htmlBody,
            text: textBody,
          }),
        });

        if (!resendRes.ok) {
          const detail = await resendRes.text().catch(() => '');
          res.status(502).json({
            delivered: false,
            providerConfigured: true,
            provider: 'resend',
            message: detail || 'No fue posible entregar el correo mediante Resend.',
          });
          return;
        }

        res.json({
          delivered: true,
          providerConfigured: true,
          provider: 'resend',
          message: 'Correo enviado correctamente vía Resend.',
        });
        return;
      }
    } catch (err) {
      res.status(502).json({
        delivered: false,
        providerConfigured: true,
        provider: cfg.provider,
        message: err instanceof Error ? err.message : 'Error al enviar correo.',
      });
    }
  });

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
      },
      appType: 'spa',
    });

    app.get('/@vite/client', async (req, res, next) => {
      try {
        const result = await vite.transformRequest(req.originalUrl);
        if (!result) return next();
        const patched = result.code
          .replace(
            'transport.connect(createHMRHandler(handleMessage));',
            '/* HMR WebSocket disabled in middlewareMode */'
          )
          .replace(
            'else throw new SendBeforeConnectError("send was called before connect");',
            'else return;'
          );
        res.type('application/javascript').send(patched);
      } catch (err) {
        next(err);
      }
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OFI CLICK server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
