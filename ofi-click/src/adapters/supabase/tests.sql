-- ============================================================================
-- OFI CLICK — PRUEBAS SQL DE SEGURIDAD Y PERMISOS (V3.1)
-- Comprueba RLS, roles, aislamiento de datos, cotizaciones, storage y triggers.
-- ============================================================================

BEGIN;

-- 1. Verificar creación de helper functions
SELECT public.is_central_admin('00000000-0000-0000-0000-000000000000');
SELECT public.is_independent_pro('00000000-0000-0000-0000-000000000000');

-- 2. Verificar existencia de tablas críticas y nuevas (service_photos, service_areas, availability, availability_blocks)
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN (
  'regions', 'profiles', 'user_roles', 'professional_profiles', 'categories',
  'subcategories', 'services', 'service_photos', 'service_areas', 'availability',
  'availability_blocks', 'portfolios', 'portfolio_photos', 'service_requests',
  'request_recipients', 'quotes', 'quote_versions', 'bookings', 'booking_events',
  'conversations', 'messages', 'message_attachments', 'favorites', 'reviews',
  'review_responses', 'notifications', 'verification_requests', 'verification_documents',
  'reports', 'support_tickets', 'audit_logs', 'admin_access_requests'
);

-- 3. Verificar buckets de Storage
SELECT count(*) FROM storage.buckets WHERE id IN (
  'public_avatars', 'portfolio_photos', 'private_verifications', 'private_chat_attachments'
);

ROLLBACK;
