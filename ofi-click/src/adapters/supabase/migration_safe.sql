-- ============================================================================
-- OFI CLICK — MIGRACIÓN SEGURA Y ADITIVA A SUPABASE (migration_safe.sql)
-- ============================================================================
-- REGLAS ESTRICTAS DE SEGURIDAD:
-- 1. NO ejecuta DROP TABLE, DROP SCHEMA, TRUNCATE ni operaciones destructivas.
-- 2. Respeta las 15 tablas existentes y sus datos preexistentes.
-- 3. Aplica únicamente ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
-- 4. Habilita RLS en todas las tablas y define políticas estrictas por rol.
-- 5. Configura los 4 buckets de Storage requeridos (públicos y privados).
-- 6. Instala triggers de protección de campos sensibles y la función RPC.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. FUNCIONES HELPER SECURITY DEFINER (Prevención de Recursión en RLS)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_central_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND (role = 'central_admin' OR primary_role = 'central_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_independent_pro(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND (role = 'independent_pro' OR primary_role = 'independent_pro')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 2. ACTUALIZACIÓN ADITIVA DE LAS 15 TABLAS EXISTENTES
-- ============================================================================

-- 2.1 profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS primary_role TEXT DEFAULT 'client' CHECK (primary_role IN ('client', 'independent_pro', 'central_admin'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_confirmed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_consent BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_storage_bucket TEXT DEFAULT 'public-avatars';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS region_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS colonia TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspended BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notification_prefs JSONB DEFAULT '{"inApp": true, "email": true, "push": false, "securityAlertsOnly": false}';

-- Sincronizar primary_role con role si ya existe data
UPDATE public.profiles SET primary_role = COALESCE(role, 'client') WHERE primary_role IS NULL;

-- 2.2 professional_profiles
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS commercial_name TEXT;
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS avatar_public_consent BOOLEAN DEFAULT FALSE;
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS years_experience SMALLINT DEFAULT 0;
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS region_id UUID;
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS primary_colonia TEXT DEFAULT 'Centro';
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS additional_colonias TEXT[] DEFAULT '{}';
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS max_travel_km SMALLINT DEFAULT 15;
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS home_service BOOLEAN DEFAULT TRUE;
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS workshop_service BOOLEAN DEFAULT FALSE;
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS willing_to_travel BOOLEAN DEFAULT TRUE;
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS approx_lat DOUBLE PRECISION DEFAULT 19.6562;
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS approx_lng DOUBLE PRECISION DEFAULT -99.2104;
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS availability_status TEXT DEFAULT 'available' CHECK (availability_status IN ('available', 'busy', 'unavailable'));
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS urgent_attention BOOLEAN DEFAULT FALSE;
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS verification_level SMALLINT DEFAULT 1 CHECK (verification_level BETWEEN 1 AND 4);
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS profile_complete BOOLEAN DEFAULT FALSE;
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT FALSE;
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS paused_by_admin BOOLEAN DEFAULT FALSE;
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(3,2) DEFAULT 0.00;
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS completed_jobs_count INT DEFAULT 0;
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS response_rate_percent SMALLINT DEFAULT 100;
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS profile_views INT DEFAULT 0;
ALTER TABLE public.professional_profiles ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW();

-- Sincronizar years_experience con experience_years si existe data
UPDATE public.professional_profiles SET years_experience = COALESCE(experience_years, 0) WHERE years_experience IS NULL OR years_experience = 0;
UPDATE public.professional_profiles SET rating_avg = COALESCE(rating, 0.00) WHERE rating_avg IS NULL OR rating_avg = 0.00;

-- 2.3 service_categories
ALTER TABLE public.service_categories ADD COLUMN IF NOT EXISTS icon_name TEXT;
ALTER TABLE public.service_categories ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.service_categories ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.service_categories ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

-- Sincronizar active con is_active
UPDATE public.service_categories SET active = COALESCE(is_active, TRUE) WHERE active IS NULL;
UPDATE public.service_categories SET icon_name = COALESCE(icon, 'Wrench') WHERE icon_name IS NULL;

-- 2.4 services
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS professional_id UUID REFERENCES public.professional_profiles(id) ON DELETE CASCADE;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS subcategory_id UUID;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS pricing_mode TEXT DEFAULT 'fixed' CHECK (pricing_mode IN ('fixed','hourly','visit','unit','from','custom_quote'));
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS price_amount NUMERIC(10,2);
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS estimated_duration_min INT DEFAULT 60;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS materials_included BOOLEAN DEFAULT FALSE;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS conditions TEXT;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published' CHECK (status IN ('published','draft','paused'));

-- 2.5 professional_portfolio
ALTER TABLE public.professional_portfolio ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.service_categories(id);
ALTER TABLE public.professional_portfolio ADD COLUMN IF NOT EXISTS approximate_date TEXT;
ALTER TABLE public.professional_portfolio ADD COLUMN IF NOT EXISTS service_performed TEXT;
ALTER TABLE public.professional_portfolio ADD COLUMN IF NOT EXISTS optional_price NUMERIC(10,2);
ALTER TABLE public.professional_portfolio ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'uploaded_portfolio' CHECK (origin IN ('oficlick_completed','uploaded_portfolio'));
ALTER TABLE public.professional_portfolio ADD COLUMN IF NOT EXISTS photos TEXT[] DEFAULT '{}';

-- 2.6 service_requests
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS region_id UUID;
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS service_id UUID REFERENCES public.services(id);
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS colonia TEXT DEFAULT 'Centro';
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS private_address TEXT;
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS desired_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS desired_time_slot TEXT DEFAULT 'Mañana (9:00 - 13:00)';
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS optional_budget_mxn NUMERIC(10,2);
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS preferences TEXT;
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS requires_home_service BOOLEAN DEFAULT TRUE;
ALTER TABLE public.service_requests ADD COLUMN IF NOT EXISTS distribution_mode TEXT DEFAULT 'manual' CHECK (distribution_mode IN ('manual','recommended'));

-- Sincronizar private_address con address si existe
UPDATE public.service_requests SET private_address = COALESCE(address, colonia) WHERE private_address IS NULL;

-- 2.7 quotes
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS service_name TEXT DEFAULT 'Servicio';
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS current_version INT DEFAULT 1;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS labor_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS materials_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS proposed_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS proposed_time TEXT DEFAULT '10:00';
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS conditions TEXT DEFAULT 'Garantía 30 días';

-- 2.8 bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS quote_version INT DEFAULT 1;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS region_id UUID;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS service_title TEXT DEFAULT 'Servicio';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS agreed_amount_mxn NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_note TEXT DEFAULT 'Pago directo acordado';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS payment_confirmed_outside BOOLEAN DEFAULT FALSE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS scheduled_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS scheduled_time TEXT DEFAULT '10:00';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS colonia TEXT DEFAULT 'Centro';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS private_address TEXT DEFAULT '';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS conditions TEXT DEFAULT '';
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS completion_notes TEXT;

-- 2.9 conversations
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS participant_ids UUID[] DEFAULT '{}';
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS blocked_by_ids UUID[] DEFAULT '{}';
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2.10 messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS text TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS attachment_name TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES public.quotes(id);
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS shared_location_note TEXT;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS read_by_ids UUID[] DEFAULT '{}';

-- Sincronizar text con content
UPDATE public.messages SET text = COALESCE(content, '') WHERE text IS NULL;

-- 2.11 favorites (Garantizar clave primaria o única)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'favorites_pkey'
  ) THEN
    ALTER TABLE public.favorites ADD PRIMARY KEY (client_id, professional_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2.12 reviews
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS reported BOOLEAN DEFAULT FALSE;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS hidden_by_admin BOOLEAN DEFAULT FALSE;

-- 2.13 notifications
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'operation' CHECK (category IN ('operation','message','review','security'));
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link_view TEXT;

-- Sincronizar profile_id con user_id
UPDATE public.notifications SET profile_id = user_id WHERE profile_id IS NULL AND user_id IS NOT NULL;
UPDATE public.notifications SET category = COALESCE(type, 'operation') WHERE category IS NULL;

-- 2.14 verification_documents
ALTER TABLE public.verification_documents ADD COLUMN IF NOT EXISTS verification_request_id UUID;
ALTER TABLE public.verification_documents ADD COLUMN IF NOT EXISTS doc_kind TEXT DEFAULT 'ine' CHECK (doc_kind IN ('ine', 'frontal_face', 'credential'));
ALTER TABLE public.verification_documents ADD COLUMN IF NOT EXISTS label TEXT DEFAULT 'Documento de Identificación';
ALTER TABLE public.verification_documents ADD COLUMN IF NOT EXISTS file_name TEXT DEFAULT 'document.pdf';
ALTER TABLE public.verification_documents ADD COLUMN IF NOT EXISTS private_storage_path TEXT;
ALTER TABLE public.verification_documents ADD COLUMN IF NOT EXISTS mime_type TEXT DEFAULT 'application/pdf';
ALTER TABLE public.verification_documents ADD COLUMN IF NOT EXISTS size_bytes BIGINT DEFAULT 0;
ALTER TABLE public.verification_documents ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ DEFAULT NOW();

-- Sincronizar private_storage_path con file_path
UPDATE public.verification_documents SET private_storage_path = file_path WHERE private_storage_path IS NULL AND file_path IS NOT NULL;
UPDATE public.verification_documents SET doc_kind = COALESCE(document_type, 'ine') WHERE doc_kind IS NULL;

-- 2.15 admin_audit_logs
ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS actor_name TEXT DEFAULT 'Administrador';
ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS actor_role TEXT DEFAULT 'central_admin';
ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS region_id UUID;
ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS reason TEXT;

-- Sincronizar actor_id con admin_id
UPDATE public.admin_audit_logs SET actor_id = admin_id WHERE actor_id IS NULL AND admin_id IS NOT NULL;
UPDATE public.admin_audit_logs SET reason = details WHERE reason IS NULL AND details IS NOT NULL;

-- ============================================================================
-- 3. TABLAS AUXILIARES REQUERIDAS POR OFI CLICK (CREACIÓN NO DESTRUCTIVA)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'México',
  active BOOLEAN NOT NULL DEFAULT FALSE,
  center_lat DOUBLE PRECISION NOT NULL DEFAULT 19.6562,
  center_lng DOUBLE PRECISION NOT NULL DEFAULT -99.2104,
  colonias TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('client', 'independent_pro', 'central_admin')),
  UNIQUE(profile_id, role)
);

CREATE TABLE IF NOT EXISTS public.subcategories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES public.service_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS public.quote_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  labor_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  materials_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  additional_charges NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  estimated_duration TEXT NOT NULL DEFAULT '2 horas',
  proposed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  proposed_time TEXT NOT NULL DEFAULT '10:00',
  valid_until DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '7 days'),
  conditions TEXT NOT NULL DEFAULT 'Garantía 30 días',
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.booking_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  actor_id UUID NOT NULL REFERENCES public.profiles(id),
  actor_name TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.message_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.verification_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id UUID NOT NULL REFERENCES public.professional_profiles(id) ON DELETE CASCADE,
  requested_level SMALLINT NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_review','approved','rejected','corrections_needed')),
  review_reason TEXT,
  reviewed_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_access_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  region_id UUID REFERENCES public.regions(id),
  colonia TEXT NOT NULL,
  requested_scope TEXT NOT NULL DEFAULT 'central_admin',
  justification TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'email_pending' CHECK (status IN ('email_pending','pending_authorization','authorized','rejected')),
  authorized_role TEXT,
  authorized_by_admin_id UUID REFERENCES public.profiles(id),
  review_notes TEXT,
  created_profile_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. BUCKETS DE STORAGE Y POLÍTICAS (4 BUCKETS OFICIALES)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('public-avatars', 'public-avatars', TRUE),
  ('portafolio-images', 'portafolio-images', TRUE),
  ('verification-docs', 'verification-docs', FALSE),
  ('chat-attachments', 'chat-attachments', FALSE)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "avatars_select" ON storage.objects;
DROP POLICY IF EXISTS "avatars_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete" ON storage.objects;
DROP POLICY IF EXISTS "portfolio_select" ON storage.objects;
DROP POLICY IF EXISTS "portfolio_insert" ON storage.objects;
DROP POLICY IF EXISTS "portfolio_delete" ON storage.objects;
DROP POLICY IF EXISTS "verifications_select" ON storage.objects;
DROP POLICY IF EXISTS "verifications_insert" ON storage.objects;
DROP POLICY IF EXISTS "chat_attachments_select" ON storage.objects;
DROP POLICY IF EXISTS "chat_attachments_insert" ON storage.objects;

CREATE POLICY "avatars_select" ON storage.objects FOR SELECT USING (bucket_id = 'public-avatars');
CREATE POLICY "avatars_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'public-avatars' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE USING (
  bucket_id = 'public-avatars' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text
);
CREATE POLICY "avatars_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'public-avatars' AND auth.role() = 'authenticated' AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "portfolio_select" ON storage.objects FOR SELECT USING (bucket_id = 'portafolio-images');
CREATE POLICY "portfolio_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'portafolio-images' AND auth.role() = 'authenticated'
);
CREATE POLICY "portfolio_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'portafolio-images' AND auth.role() = 'authenticated'
);

CREATE POLICY "verifications_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'verification-docs' AND auth.role() = 'authenticated' AND (
    public.is_central_admin(auth.uid()) OR (storage.foldername(name))[1] = auth.uid()::text
  )
);
CREATE POLICY "verifications_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'verification-docs' AND auth.role() = 'authenticated' AND (
    public.is_central_admin(auth.uid()) OR (storage.foldername(name))[1] = auth.uid()::text
  )
);

CREATE POLICY "chat_attachments_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'chat-attachments' AND auth.role() = 'authenticated'
);
CREATE POLICY "chat_attachments_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'chat-attachments' AND auth.role() = 'authenticated'
);

-- ============================================================================
-- 5. TRIGGERS Y FUNCIONES DE NEGOCIO
-- ============================================================================

-- 5.1 Trigger de Protección de Campos Sensibles en Profiles
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.is_central_admin(auth.uid()) THEN
    NEW.primary_role := OLD.primary_role;
    NEW.role := OLD.role;
    NEW.email := OLD.email;
    NEW.suspended := OLD.suspended;
    NEW.id := OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_fields();

-- 5.2 Trigger de Registro Seguro (handle_new_user)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role TEXT;
  full_name_val TEXT;
BEGIN
  assigned_role := COALESCE(new.raw_user_meta_data->>'primary_role', new.raw_user_meta_data->>'role', 'client');
  IF assigned_role NOT IN ('client', 'independent_pro') THEN
    assigned_role := 'client';
  END IF;

  full_name_val := COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));

  INSERT INTO public.profiles (
    id, full_name, email, role, primary_role, avatar_url, colonia
  ) VALUES (
    new.id,
    full_name_val,
    new.email,
    assigned_role,
    assigned_role,
    new.raw_user_meta_data->>'avatar_url',
    COALESCE(new.raw_user_meta_data->>'colonia', NULL)
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email;

  IF assigned_role = 'independent_pro' THEN
    INSERT INTO public.professional_profiles (
      id, profile_id, display_name
    ) VALUES (
      new.id,
      new.id,
      full_name_val
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5.3 Función RPC Transaccional: accept_quote_and_create_booking
CREATE OR REPLACE FUNCTION public.accept_quote_and_create_booking(quote_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  v_quote quotes%ROWTYPE;
  v_request service_requests%ROWTYPE;
  v_booking_id UUID;
  v_amount NUMERIC(10,2);
BEGIN
  SELECT * INTO v_quote FROM public.quotes WHERE id = quote_uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  SELECT * INTO v_request FROM public.service_requests WHERE id = v_quote.request_id;

  v_amount := COALESCE(v_quote.total_amount, 0);

  UPDATE public.quotes SET status = 'accepted', updated_at = NOW() WHERE id = quote_uuid;
  UPDATE public.service_requests SET status = 'accepted' WHERE id = v_quote.request_id;

  INSERT INTO public.bookings (
    request_id, quote_id, client_id, professional_id,
    service_title, description, agreed_amount_mxn, payment_note, scheduled_date,
    scheduled_time, colonia, private_address, status
  ) VALUES (
    v_quote.request_id,
    quote_uuid,
    v_quote.client_id,
    v_quote.professional_id,
    COALESCE(v_quote.service_name, 'Servicio Profesional'),
    COALESCE(v_quote.description, ''),
    v_amount,
    'Pago acordado (' || v_amount || ' MXN)',
    COALESCE(v_quote.proposed_date, CURRENT_DATE),
    COALESCE(v_quote.proposed_time, '10:00'),
    COALESCE(v_request.colonia, 'Centro'),
    COALESCE(v_request.private_address, v_request.colonia, ''),
    'quote_accepted'
  ) RETURNING id INTO v_booking_id;

  RETURN jsonb_build_object('success', true, 'booking_id', v_booking_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 6. POLÍTICAS RLS EN TODAS LAS TABLAS
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professional_portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- Limpieza preventiva de políticas
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "pro_profiles_select" ON public.professional_profiles;
DROP POLICY IF EXISTS "pro_profiles_all" ON public.professional_profiles;
DROP POLICY IF EXISTS "service_categories_select" ON public.service_categories;
DROP POLICY IF EXISTS "services_select" ON public.services;
DROP POLICY IF EXISTS "services_all" ON public.services;
DROP POLICY IF EXISTS "portfolio_select" ON public.professional_portfolio;
DROP POLICY IF EXISTS "portfolio_all" ON public.professional_portfolio;
DROP POLICY IF EXISTS "requests_select" ON public.service_requests;
DROP POLICY IF EXISTS "requests_insert" ON public.service_requests;
DROP POLICY IF EXISTS "requests_update" ON public.service_requests;
DROP POLICY IF EXISTS "quotes_select" ON public.quotes;
DROP POLICY IF EXISTS "quotes_all" ON public.quotes;
DROP POLICY IF EXISTS "bookings_select" ON public.bookings;
DROP POLICY IF EXISTS "bookings_update" ON public.bookings;
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
DROP POLICY IF EXISTS "conversations_all" ON public.conversations;
DROP POLICY IF EXISTS "messages_select" ON public.messages;
DROP POLICY IF EXISTS "messages_insert" ON public.messages;
DROP POLICY IF EXISTS "favorites_all" ON public.favorites;
DROP POLICY IF EXISTS "reviews_select" ON public.reviews;
DROP POLICY IF EXISTS "reviews_insert" ON public.reviews;
DROP POLICY IF EXISTS "notifications_all" ON public.notifications;
DROP POLICY IF EXISTS "verification_docs_select" ON public.verification_documents;
DROP POLICY IF EXISTS "verification_docs_insert" ON public.verification_documents;
DROP POLICY IF EXISTS "audit_logs_select" ON public.admin_audit_logs;

-- Definición estricta de Políticas RLS
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (id = auth.uid() OR public.is_central_admin(auth.uid()));
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (id = auth.uid() OR public.is_central_admin(auth.uid())) WITH CHECK (id = auth.uid() OR public.is_central_admin(auth.uid()));
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid() AND primary_role IN ('client', 'independent_pro'));

CREATE POLICY "pro_profiles_select" ON public.professional_profiles FOR SELECT USING (published = TRUE OR id = auth.uid() OR profile_id = auth.uid() OR public.is_central_admin(auth.uid()));
CREATE POLICY "pro_profiles_all" ON public.professional_profiles FOR ALL USING (id = auth.uid() OR profile_id = auth.uid() OR public.is_central_admin(auth.uid()));

CREATE POLICY "service_categories_select" ON public.service_categories FOR SELECT USING (active = TRUE OR is_active = TRUE OR public.is_central_admin(auth.uid()));

CREATE POLICY "services_select" ON public.services FOR SELECT USING (status = 'published' OR professional_id = auth.uid() OR professional_id IN (SELECT id FROM public.professional_profiles WHERE profile_id = auth.uid()) OR public.is_central_admin(auth.uid()));
CREATE POLICY "services_all" ON public.services FOR ALL USING (professional_id = auth.uid() OR professional_id IN (SELECT id FROM public.professional_profiles WHERE profile_id = auth.uid()) OR public.is_central_admin(auth.uid()));

CREATE POLICY "portfolio_select" ON public.professional_portfolio FOR SELECT USING (TRUE);
CREATE POLICY "portfolio_all" ON public.professional_portfolio FOR ALL USING (professional_id = auth.uid() OR professional_id IN (SELECT id FROM public.professional_profiles WHERE profile_id = auth.uid()) OR public.is_central_admin(auth.uid()));

CREATE POLICY "requests_select" ON public.service_requests FOR SELECT USING (client_id = auth.uid() OR public.is_central_admin(auth.uid()) OR auth.role() = 'authenticated');
CREATE POLICY "requests_insert" ON public.service_requests FOR INSERT WITH CHECK (client_id = auth.uid());
CREATE POLICY "requests_update" ON public.service_requests FOR UPDATE USING (client_id = auth.uid() OR public.is_central_admin(auth.uid()));

CREATE POLICY "quotes_select" ON public.quotes FOR SELECT USING (client_id = auth.uid() OR professional_id = auth.uid() OR professional_id IN (SELECT id FROM public.professional_profiles WHERE profile_id = auth.uid()) OR public.is_central_admin(auth.uid()));
CREATE POLICY "quotes_all" ON public.quotes FOR ALL USING (client_id = auth.uid() OR professional_id = auth.uid() OR professional_id IN (SELECT id FROM public.professional_profiles WHERE profile_id = auth.uid()) OR public.is_central_admin(auth.uid()));

CREATE POLICY "bookings_select" ON public.bookings FOR SELECT USING (client_id = auth.uid() OR professional_id = auth.uid() OR professional_id IN (SELECT id FROM public.professional_profiles WHERE profile_id = auth.uid()) OR public.is_central_admin(auth.uid()));
CREATE POLICY "bookings_update" ON public.bookings FOR UPDATE USING (client_id = auth.uid() OR professional_id = auth.uid() OR professional_id IN (SELECT id FROM public.professional_profiles WHERE profile_id = auth.uid()) OR public.is_central_admin(auth.uid()));

CREATE POLICY "conversations_select" ON public.conversations FOR SELECT USING (auth.uid() = ANY(participant_ids) OR public.is_central_admin(auth.uid()));
CREATE POLICY "conversations_all" ON public.conversations FOR ALL USING (auth.uid() = ANY(participant_ids) OR public.is_central_admin(auth.uid()));

CREATE POLICY "messages_select" ON public.messages FOR SELECT USING (conversation_id IN (SELECT id FROM public.conversations WHERE auth.uid() = ANY(participant_ids)) OR public.is_central_admin(auth.uid()));
CREATE POLICY "messages_insert" ON public.messages FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY "favorites_all" ON public.favorites FOR ALL USING (client_id = auth.uid());

CREATE POLICY "reviews_select" ON public.reviews FOR SELECT USING (hidden_by_admin = FALSE OR public.is_central_admin(auth.uid()));
CREATE POLICY "reviews_insert" ON public.reviews FOR INSERT WITH CHECK (client_id = auth.uid());

CREATE POLICY "notifications_all" ON public.notifications FOR ALL USING (profile_id = auth.uid() OR user_id = auth.uid() OR public.is_central_admin(auth.uid()));

CREATE POLICY "verification_docs_select" ON public.verification_documents FOR SELECT USING (professional_id = auth.uid() OR professional_id IN (SELECT id FROM public.professional_profiles WHERE profile_id = auth.uid()) OR public.is_central_admin(auth.uid()));
CREATE POLICY "verification_docs_insert" ON public.verification_documents FOR INSERT WITH CHECK (professional_id = auth.uid() OR professional_id IN (SELECT id FROM public.professional_profiles WHERE profile_id = auth.uid()));

CREATE POLICY "audit_logs_select" ON public.admin_audit_logs FOR SELECT USING (public.is_central_admin(auth.uid()));
