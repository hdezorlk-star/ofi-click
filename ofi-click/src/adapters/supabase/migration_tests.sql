-- ============================================================================
-- OFI CLICK — PRUEBAS SQL DE VALIDACIÓN POST-MIGRACIÓN (migration_tests.sql)
-- ============================================================================
-- Se recomienda ejecutar estas validaciones en el SQL Editor de Supabase
-- tras ejecutar migration_safe.sql.
-- ============================================================================

BEGIN;

-- 1. Validar la existencia de funciones helper SECURITY DEFINER
SELECT public.is_central_admin('00000000-0000-0000-0000-000000000000') AS is_admin_check;
SELECT public.is_independent_pro('00000000-0000-0000-0000-000000000000') AS is_pro_check;

-- 2. Validar que las 15 tablas existentes contienen las columnas aditivas
SELECT 
  table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'profiles' 
  AND column_name IN ('primary_role', 'email_confirmed', 'suspended', 'colonia', 'notification_prefs');

SELECT 
  table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'professional_profiles' 
  AND column_name IN ('profile_id', 'display_name', 'availability_status', 'published', 'verification_level');

SELECT 
  table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'quotes' 
  AND column_name IN ('service_name', 'total_amount', 'status', 'current_version');

SELECT 
  table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'bookings' 
  AND column_name IN ('service_title', 'agreed_amount_mxn', 'status', 'scheduled_date');

-- 3. Validar existencia de los 4 buckets de Storage oficiales
SELECT id, name, public 
FROM storage.buckets 
WHERE id IN ('public-avatars', 'portafolio-images', 'verification-docs', 'chat-attachments');

-- 4. Validar existencia y firma de accept_quote_and_create_booking
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public' AND routine_name = 'accept_quote_and_create_booking';

-- 5. Validar que RLS está activo en las tablas críticas
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'profiles', 'professional_profiles', 'service_categories', 'services',
    'quotes', 'bookings', 'conversations', 'messages', 'reviews',
    'notifications', 'verification_documents', 'admin_audit_logs'
  );

-- 6. Validar que el trigger on_auth_user_created está registrado
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public' AND trigger_name = 'on_auth_user_created';

ROLLBACK;
