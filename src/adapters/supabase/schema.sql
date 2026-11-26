-- ============================================================================
-- OFI CLICK — ESQUEMA SQL SUPABASE DEFINITIVO (V3.1)
-- Correcciones de seguridad, triggers de protección, orden de dependencias, RLS y Storage.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 0. FUNCIONES HELPER SECURITY DEFINER (Prevención de Recursión en RLS)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_central_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE profile_id = user_id AND role = 'central_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_independent_pro(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE profile_id = user_id AND role = 'independent_pro'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 1. TABLAS PRINCIPALES (Orden riguroso de dependencias)
-- ============================================================================
CREATE TABLE IF NOT EXISTS regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'México',
  active BOOLEAN NOT NULL DEFAULT FALSE,
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  colonias TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  email_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  avatar_url TEXT,
  avatar_consent BOOLEAN NOT NULL DEFAULT FALSE,
  avatar_storage_bucket TEXT,
  primary_role TEXT NOT NULL CHECK (primary_role IN ('client', 'independent_pro', 'central_admin')),
  region_id UUID REFERENCES regions(id),
  colonia TEXT,
  suspended BOOLEAN NOT NULL DEFAULT FALSE,
  notification_prefs JSONB NOT NULL DEFAULT '{"inApp": true, "email": true, "push": false, "securityAlertsOnly": false}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('client', 'independent_pro', 'central_admin')),
  UNIQUE(profile_id, role)
);

CREATE TABLE IF NOT EXISTS professional_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  display_name TEXT NOT NULL,
  commercial_name TEXT,
  avatar_url TEXT,
  avatar_public_consent BOOLEAN NOT NULL DEFAULT FALSE,
  bio TEXT NOT NULL DEFAULT '',
  years_experience SMALLINT NOT NULL DEFAULT 0,
  region_id UUID REFERENCES regions(id),
  primary_colonia TEXT NOT NULL,
  additional_colonias TEXT[] NOT NULL DEFAULT '{}',
  coverage_zones TEXT[] NOT NULL DEFAULT '{}',
  max_travel_km SMALLINT NOT NULL DEFAULT 15,
  home_service BOOLEAN NOT NULL DEFAULT TRUE,
  workshop_service BOOLEAN NOT NULL DEFAULT FALSE,
  willing_to_travel BOOLEAN NOT NULL DEFAULT TRUE,
  approx_lat DOUBLE PRECISION NOT NULL DEFAULT 19.6562,
  approx_lng DOUBLE PRECISION NOT NULL DEFAULT -99.2104,
  availability_status TEXT NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available', 'busy', 'unavailable')),
  urgent_attention BOOLEAN NOT NULL DEFAULT FALSE,
  verification_level SMALLINT NOT NULL DEFAULT 1 CHECK (verification_level BETWEEN 1 AND 4),
  profile_complete BOOLEAN NOT NULL DEFAULT FALSE,
  published BOOLEAN NOT NULL DEFAULT FALSE,
  paused_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
  rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0.00,
  reviews_count INT NOT NULL DEFAULT 0,
  completed_jobs_count INT NOT NULL DEFAULT 0,
  response_rate_percent SMALLINT NOT NULL DEFAULT 100,
  profile_views INT NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  icon_name TEXT NOT NULL,
  image_url TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subcategories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id UUID NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories(id),
  subcategory_id UUID REFERENCES subcategories(id),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  pricing_mode TEXT NOT NULL CHECK (pricing_mode IN ('fixed','hourly','visit','unit','from','custom_quote')),
  price_amount NUMERIC(10,2),
  estimated_duration_min INT NOT NULL DEFAULT 60,
  materials_included BOOLEAN NOT NULL DEFAULT FALSE,
  conditions TEXT,
  status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published','draft','paused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS service_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_areas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id UUID NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
  region_id UUID NOT NULL REFERENCES regions(id),
  colonias TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id UUID NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS availability_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id UUID NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
  blocked_date DATE NOT NULL,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS portfolios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id UUID NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id),
  description TEXT NOT NULL,
  approximate_date TEXT,
  service_performed TEXT,
  optional_price NUMERIC(10,2),
  origin TEXT NOT NULL CHECK (origin IN ('oficlick_completed','uploaded_portfolio')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS portfolio_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  portfolio_id UUID NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS service_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  region_id UUID REFERENCES regions(id),
  category_id UUID NOT NULL REFERENCES categories(id),
  service_id UUID REFERENCES services(id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  colonia TEXT NOT NULL,
  private_address TEXT,
  desired_date DATE NOT NULL,
  desired_time_slot TEXT NOT NULL,
  urgency TEXT NOT NULL CHECK (urgency IN ('normal','soon','urgent')),
  optional_budget_mxn NUMERIC(10,2),
  preferences TEXT,
  requires_home_service BOOLEAN NOT NULL DEFAULT TRUE,
  distribution_mode TEXT NOT NULL CHECK (distribution_mode IN ('manual','recommended')),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','in_conversation','quoted','accepted','closed','cancelled','expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS request_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','viewed','info_requested','quoted','rejected')),
  UNIQUE(request_id, professional_id)
);

CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','revised','accepted','rejected','expired')),
  current_version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quote_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  labor_amount NUMERIC(10,2) NOT NULL CHECK (labor_amount >= 0),
  materials_amount NUMERIC(10,2) NOT NULL CHECK (materials_amount >= 0),
  additional_charges NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount > 0),
  estimated_duration TEXT NOT NULL,
  proposed_date DATE NOT NULL,
  proposed_time TEXT NOT NULL,
  valid_until DATE NOT NULL,
  conditions TEXT NOT NULL,
  comments TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES service_requests(id),
  quote_id UUID NOT NULL REFERENCES quotes(id),
  quote_version INT NOT NULL,
  client_id UUID NOT NULL REFERENCES profiles(id),
  professional_id UUID NOT NULL REFERENCES professional_profiles(id),
  region_id UUID REFERENCES regions(id),
  service_title TEXT NOT NULL,
  description TEXT NOT NULL,
  agreed_amount_mxn NUMERIC(10,2) NOT NULL,
  payment_note TEXT NOT NULL,
  payment_confirmed_outside BOOLEAN NOT NULL DEFAULT FALSE,
  scheduled_date DATE NOT NULL,
  scheduled_time TEXT NOT NULL,
  colonia TEXT NOT NULL,
  private_address TEXT NOT NULL,
  conditions TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('quote_accepted','scheduled','on_the_way','in_progress','pro_marked_done','client_confirmed','completed','rejected','cancelled','expired','disputed','not_performed')),
  completion_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  actor_id UUID NOT NULL REFERENCES profiles(id),
  actor_name TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID REFERENCES service_requests(id),
  booking_id UUID REFERENCES bookings(id),
  participant_ids UUID[] NOT NULL,
  blocked_by_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id),
  text TEXT NOT NULL,
  attachment_name TEXT,
  attachment_type TEXT CHECK (attachment_type IN ('image','file','quote','location')),
  quote_id UUID REFERENCES quotes(id),
  shared_location_note TEXT,
  read_by_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS favorites (
  client_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(client_id, professional_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES profiles(id),
  professional_id UUID NOT NULL REFERENCES professional_profiles(id),
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL,
  reported BOOLEAN NOT NULL DEFAULT FALSE,
  hidden_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID NOT NULL UNIQUE REFERENCES reviews(id) ON DELETE CASCADE,
  professional_id UUID NOT NULL REFERENCES professional_profiles(id),
  response_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('operation','message','review','security')),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  link_view TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  professional_id UUID NOT NULL REFERENCES professional_profiles(id) ON DELETE CASCADE,
  requested_level SMALLINT NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_review','approved','rejected','corrections_needed')),
  review_reason TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  verification_request_id UUID NOT NULL REFERENCES verification_requests(id) ON DELETE CASCADE,
  doc_kind TEXT NOT NULL CHECK (doc_kind IN ('ine', 'frontal_face', 'credential')),
  label TEXT NOT NULL,
  file_name TEXT NOT NULL,
  private_storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES profiles(id),
  target_type TEXT NOT NULL CHECK (target_type IN ('professional','review','conversation','booking')),
  target_id UUID NOT NULL,
  region_id UUID REFERENCES regions(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','resolved','dismissed')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES profiles(id),
  region_id UUID REFERENCES regions(id),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','closed')),
  evidence_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID NOT NULL REFERENCES profiles(id),
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  region_id UUID REFERENCES regions(id),
  action TEXT NOT NULL,
  target_entity TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_access_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  region_id UUID REFERENCES regions(id),
  colonia TEXT NOT NULL,
  requested_scope TEXT NOT NULL DEFAULT 'central_admin',
  justification TEXT NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'email_pending' CHECK (status IN ('email_pending','pending_authorization','authorized','rejected')),
  authorized_role TEXT,
  authorized_by_admin_id UUID REFERENCES profiles(id),
  review_notes TEXT,
  created_profile_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. TRIGGERS DE PROTECCIÓN Y SEGURIDAD DE NEGOCIO
-- ============================================================================

-- A. Proteger campos sensibles de profiles (primary_role, email, suspended, id)
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.is_central_admin(auth.uid()) THEN
    NEW.primary_role := OLD.primary_role;
    NEW.email := OLD.email;
    NEW.suspended := OLD.suspended;
    NEW.id := OLD.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON profiles;
CREATE TRIGGER trg_protect_profile_fields
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_fields();

-- B. Proteger participantes de conversaciones (no agregar arbitrariamente)
CREATE OR REPLACE FUNCTION public.protect_conversation_participants()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.is_central_admin(auth.uid()) THEN
    IF TG_OP = 'UPDATE' AND NEW.participant_ids IS DISTINCT FROM OLD.participant_ids THEN
      RAISE EXCEPTION 'No está permitido modificar los participantes de una conversación arbitrariamente';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_conversation ON conversations;
CREATE TRIGGER trg_protect_conversation
  BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION public.protect_conversation_participants();

-- C. Proteger aprobación de verificación (el pro no puede aprobarse a sí mismo)
CREATE OR REPLACE FUNCTION public.protect_verification_request()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.is_central_admin(auth.uid()) THEN
    IF TG_OP = 'INSERT' THEN
      NEW.status := 'pending';
      NEW.reviewed_by := NULL;
      NEW.review_reason := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.status IS DISTINCT FROM OLD.status OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by OR NEW.review_reason IS DISTINCT FROM OLD.review_reason THEN
        RAISE EXCEPTION 'Los profesionales no pueden aprobar ni modificar el estado de revisión de sus solicitudes';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_verification ON verification_requests;
CREATE TRIGGER trg_protect_verification
  BEFORE INSERT OR UPDATE ON verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.protect_verification_request();

-- D. Proteger datos económicos en bookings
CREATE OR REPLACE FUNCTION public.protect_booking_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.is_central_admin(auth.uid()) THEN
    IF NEW.agreed_amount_mxn IS DISTINCT FROM OLD.agreed_amount_mxn THEN
      RAISE EXCEPTION 'No está permitido alterar el monto acordado unilateralmente';
    END IF;
    IF NEW.client_id IS DISTINCT FROM OLD.client_id OR NEW.professional_id IS DISTINCT FROM OLD.professional_id THEN
      RAISE EXCEPTION 'No está permitido modificar las partes contratantes';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_booking ON bookings;
CREATE TRIGGER trg_protect_booking
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION public.protect_booking_update();

-- ============================================================================
-- 3. ÍNDICES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_pros_region_published ON professional_profiles(region_id, published, profile_complete);
CREATE INDEX IF NOT EXISTS idx_requests_client ON service_requests(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_client_pro ON bookings(client_id, professional_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_profile ON notifications(profile_id, is_read);

-- ============================================================================
-- 4. RLS (ROW LEVEL SECURITY) Y POLÍTICAS
-- ============================================================================
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE professional_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_access_requests ENABLE ROW LEVEL SECURITY;

-- Limpieza de políticas previas
DROP POLICY IF EXISTS "regions_select" ON regions;
DROP POLICY IF EXISTS "categories_select" ON categories;
DROP POLICY IF EXISTS "subcategories_select" ON subcategories;
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "user_roles_select" ON user_roles;
DROP POLICY IF EXISTS "user_roles_admin" ON user_roles;
DROP POLICY IF EXISTS "pro_profiles_select" ON professional_profiles;
DROP POLICY IF EXISTS "pro_profiles_all" ON professional_profiles;
DROP POLICY IF EXISTS "services_select" ON services;
DROP POLICY IF EXISTS "services_all" ON services;
DROP POLICY IF EXISTS "service_photos_all" ON service_photos;
DROP POLICY IF EXISTS "service_areas_all" ON service_areas;
DROP POLICY IF EXISTS "availability_all" ON availability;
DROP POLICY IF EXISTS "availability_blocks_all" ON availability_blocks;
DROP POLICY IF EXISTS "portfolios_select" ON portfolios;
DROP POLICY IF EXISTS "portfolios_all" ON portfolios;
DROP POLICY IF EXISTS "portfolio_photos_all" ON portfolio_photos;
DROP POLICY IF EXISTS "requests_select" ON service_requests;
DROP POLICY IF EXISTS "requests_insert" ON service_requests;
DROP POLICY IF EXISTS "requests_update" ON service_requests;
DROP POLICY IF EXISTS "recipients_all" ON request_recipients;
DROP POLICY IF EXISTS "quotes_select" ON quotes;
DROP POLICY IF EXISTS "quotes_all" ON quotes;
DROP POLICY IF EXISTS "quote_versions_select" ON quote_versions;
DROP POLICY IF EXISTS "quote_versions_insert" ON quote_versions;
DROP POLICY IF EXISTS "bookings_select" ON bookings;
DROP POLICY IF EXISTS "bookings_update" ON bookings;
DROP POLICY IF EXISTS "booking_events_all" ON booking_events;
DROP POLICY IF EXISTS "conversations_select" ON conversations;
DROP POLICY IF EXISTS "conversations_all" ON conversations;
DROP POLICY IF EXISTS "messages_select" ON messages;
DROP POLICY IF EXISTS "messages_insert" ON messages;
DROP POLICY IF EXISTS "message_attachments_all" ON message_attachments;
DROP POLICY IF EXISTS "favorites_all" ON favorites;
DROP POLICY IF EXISTS "reviews_select" ON reviews;
DROP POLICY IF EXISTS "reviews_insert" ON reviews;
DROP POLICY IF EXISTS "review_responses_all" ON review_responses;
DROP POLICY IF EXISTS "notifications_all" ON notifications;
DROP POLICY IF EXISTS "verification_docs_select" ON verification_documents;
DROP POLICY IF EXISTS "verification_docs_insert" ON verification_documents;
DROP POLICY IF EXISTS "verification_requests_all" ON verification_requests;
DROP POLICY IF EXISTS "reports_all" ON reports;
DROP POLICY IF EXISTS "support_tickets_all" ON support_tickets;
DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;
DROP POLICY IF EXISTS "admin_access_requests_all" ON admin_access_requests;

-- Creación de Políticas RLS definitivas V3.1
CREATE POLICY "regions_select" ON regions FOR SELECT USING (active = TRUE OR public.is_central_admin(auth.uid()));
CREATE POLICY "categories_select" ON categories FOR SELECT USING (active = TRUE OR public.is_central_admin(auth.uid()));
CREATE POLICY "subcategories_select" ON subcategories FOR SELECT USING (active = TRUE);

CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (id = auth.uid() OR public.is_central_admin(auth.uid()));
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (id = auth.uid() OR public.is_central_admin(auth.uid())) WITH CHECK (id = auth.uid() OR public.is_central_admin(auth.uid()));
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (id = auth.uid() AND primary_role IN ('client', 'independent_pro'));

CREATE POLICY "user_roles_select" ON user_roles FOR SELECT USING (profile_id = auth.uid() OR public.is_central_admin(auth.uid()));
CREATE POLICY "user_roles_admin" ON user_roles FOR ALL USING (public.is_central_admin(auth.uid()));

CREATE POLICY "pro_profiles_select" ON professional_profiles FOR SELECT USING (published = TRUE OR profile_id = auth.uid() OR public.is_central_admin(auth.uid()));
CREATE POLICY "pro_profiles_all" ON professional_profiles FOR ALL USING (profile_id = auth.uid() OR public.is_central_admin(auth.uid()));

CREATE POLICY "services_select" ON services FOR SELECT USING (status = 'published' OR professional_id IN (SELECT id FROM professional_profiles WHERE profile_id = auth.uid()) OR public.is_central_admin(auth.uid()));
CREATE POLICY "services_all" ON services FOR ALL USING (professional_id IN (SELECT id FROM professional_profiles WHERE profile_id = auth.uid()) OR public.is_central_admin(auth.uid()));

CREATE POLICY "service_photos_all" ON service_photos FOR ALL USING (service_id IN (SELECT s.id FROM services s JOIN professional_profiles pp ON pp.id = s.professional_id WHERE pp.profile_id = auth.uid()) OR public.is_central_admin(auth.uid()));
CREATE POLICY "service_areas_all" ON service_areas FOR ALL USING (professional_id IN (SELECT id FROM professional_profiles WHERE profile_id = auth.uid()) OR public.is_central_admin(auth.uid()));
CREATE POLICY "availability_all" ON availability FOR ALL USING (professional_id IN (SELECT id FROM professional_profiles WHERE profile_id = auth.uid()) OR public.is_central_admin(auth.uid()));
CREATE POLICY "availability_blocks_all" ON availability_blocks FOR ALL USING (professional_id IN (SELECT id FROM professional_profiles WHERE profile_id = auth.uid()) OR public.is_central_admin(auth.uid()));

CREATE POLICY "portfolios_select" ON portfolios FOR SELECT USING (TRUE);
CREATE POLICY "portfolios_all" ON portfolios FOR ALL USING (professional_id IN (SELECT id FROM professional_profiles WHERE profile_id = auth.uid()) OR public.is_central_admin(auth.uid()));
CREATE POLICY "portfolio_photos_all" ON portfolio_photos FOR ALL USING (portfolio_id IN (SELECT p.id FROM portfolios p JOIN professional_profiles pp ON pp.id = p.professional_id WHERE pp.profile_id = auth.uid()) OR public.is_central_admin(auth.uid()));

CREATE POLICY "requests_select" ON service_requests FOR SELECT USING (client_id = auth.uid() OR id IN (SELECT request_id FROM request_recipients rr JOIN professional_profiles pp ON pp.id = rr.professional_id WHERE pp.profile_id = auth.uid()) OR public.is_central_admin(auth.uid()));
CREATE POLICY "requests_insert" ON service_requests FOR INSERT WITH CHECK (client_id = auth.uid());
CREATE POLICY "requests_update" ON service_requests FOR UPDATE USING (client_id = auth.uid() OR public.is_central_admin(auth.uid()));

CREATE POLICY "recipients_all" ON request_recipients FOR ALL USING (professional_id IN (SELECT id FROM professional_profiles WHERE profile_id = auth.uid()) OR request_id IN (SELECT id FROM service_requests WHERE client_id = auth.uid()) OR public.is_central_admin(auth.uid()));

CREATE POLICY "quotes_select" ON quotes FOR SELECT USING (client_id = auth.uid() OR professional_id IN (SELECT id FROM professional_profiles WHERE profile_id = auth.uid()) OR public.is_central_admin(auth.uid()));
CREATE POLICY "quotes_all" ON quotes FOR ALL USING (professional_id IN (SELECT id FROM professional_profiles WHERE profile_id = auth.uid()) OR client_id = auth.uid() OR public.is_central_admin(auth.uid()));

CREATE POLICY "quote_versions_select" ON quote_versions FOR SELECT USING (quote_id IN (SELECT id FROM quotes WHERE client_id = auth.uid() OR professional_id IN (SELECT id FROM professional_profiles WHERE profile_id = auth.uid())) OR public.is_central_admin(auth.uid()));
CREATE POLICY "quote_versions_insert" ON quote_versions FOR INSERT WITH CHECK (quote_id IN (SELECT id FROM quotes WHERE professional_id IN (SELECT id FROM professional_profiles WHERE profile_id = auth.uid())));

CREATE POLICY "bookings_select" ON bookings FOR SELECT USING (client_id = auth.uid() OR professional_id IN (SELECT id FROM professional_profiles WHERE profile_id = auth.uid()) OR public.is_central_admin(auth.uid()));
CREATE POLICY "bookings_update" ON bookings FOR UPDATE USING (client_id = auth.uid() OR professional_id IN (SELECT id FROM professional_profiles WHERE profile_id = auth.uid()) OR public.is_central_admin(auth.uid()));

CREATE POLICY "booking_events_all" ON booking_events FOR ALL USING (booking_id IN (SELECT id FROM bookings WHERE client_id = auth.uid() OR professional_id IN (SELECT id FROM professional_profiles WHERE profile_id = auth.uid())) OR public.is_central_admin(auth.uid()));

CREATE POLICY "conversations_select" ON conversations FOR SELECT USING (auth.uid() = ANY(participant_ids) OR public.is_central_admin(auth.uid()));
CREATE POLICY "conversations_all" ON conversations FOR ALL USING (auth.uid() = ANY(participant_ids) OR public.is_central_admin(auth.uid()));

CREATE POLICY "messages_select" ON messages FOR SELECT USING (conversation_id IN (SELECT id FROM conversations WHERE auth.uid() = ANY(participant_ids)) OR public.is_central_admin(auth.uid()));
CREATE POLICY "messages_insert" ON messages FOR INSERT WITH CHECK (sender_id = auth.uid() AND conversation_id IN (SELECT id FROM conversations WHERE auth.uid() = ANY(participant_ids)));
CREATE POLICY "message_attachments_all" ON message_attachments FOR ALL USING (message_id IN (SELECT m.id FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE auth.uid() = ANY(c.participant_ids)) OR public.is_central_admin(auth.uid()));

CREATE POLICY "favorites_all" ON favorites FOR ALL USING (client_id = auth.uid());
CREATE POLICY "reviews_select" ON reviews FOR SELECT USING (hidden_by_admin = FALSE OR public.is_central_admin(auth.uid()));
CREATE POLICY "reviews_insert" ON reviews FOR INSERT WITH CHECK (client_id = auth.uid());
CREATE POLICY "review_responses_all" ON review_responses FOR ALL USING (professional_id IN (SELECT id FROM professional_profiles WHERE profile_id = auth.uid()) OR public.is_central_admin(auth.uid()));

CREATE POLICY "notifications_all" ON notifications FOR ALL USING (profile_id = auth.uid() OR public.is_central_admin(auth.uid()));

CREATE POLICY "verification_docs_select" ON verification_documents FOR SELECT USING (
  verification_request_id IN (
    SELECT vr.id FROM verification_requests vr
    JOIN professional_profiles pp ON pp.id = vr.professional_id
    WHERE pp.profile_id = auth.uid() OR public.is_central_admin(auth.uid())
  )
);
CREATE POLICY "verification_docs_insert" ON verification_documents FOR INSERT WITH CHECK (
  verification_request_id IN (
    SELECT vr.id FROM verification_requests vr
    JOIN professional_profiles pp ON pp.id = vr.professional_id
    WHERE pp.profile_id = auth.uid()
  )
);

CREATE POLICY "verification_requests_all" ON verification_requests FOR ALL USING (
  professional_id IN (SELECT id FROM professional_profiles WHERE profile_id = auth.uid()) OR public.is_central_admin(auth.uid())
);

CREATE POLICY "reports_all" ON reports FOR ALL USING (reporter_id = auth.uid() OR public.is_central_admin(auth.uid()));
CREATE POLICY "support_tickets_all" ON support_tickets FOR ALL USING (creator_id = auth.uid() OR public.is_central_admin(auth.uid()));
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT USING (public.is_central_admin(auth.uid()));
CREATE POLICY "admin_access_requests_all" ON admin_access_requests FOR ALL USING (email = (SELECT email FROM profiles WHERE id = auth.uid()) OR public.is_central_admin(auth.uid()));

-- ============================================================================
-- 5. AUTH TRIGGER SEGURO (handle_new_user)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  assigned_role TEXT;
  target_region_id UUID;
  default_colonia TEXT;
BEGIN
  -- Impide tajantemente asignar central_admin desde registro público
  assigned_role := COALESCE(new.raw_user_meta_data->>'primary_role', 'client');
  IF assigned_role NOT IN ('client', 'independent_pro') THEN
    assigned_role := 'client';
  END IF;

  -- Selecciona la primera región activa si existe (sin crear datos ficticios)
  SELECT id INTO target_region_id FROM regions WHERE active = TRUE LIMIT 1;
  default_colonia := COALESCE(new.raw_user_meta_data->>'colonia', NULL);

  INSERT INTO public.profiles (
    id, full_name, email, email_confirmed, avatar_url, primary_role, region_id, colonia
  ) VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    COALESCE(new.email_confirmed_at IS NOT NULL, FALSE),
    new.raw_user_meta_data->>'avatar_url',
    assigned_role,
    target_region_id,
    default_colonia
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (profile_id, role)
  VALUES (new.id, assigned_role)
  ON CONFLICT DO NOTHING;

  IF assigned_role = 'independent_pro' AND target_region_id IS NOT NULL THEN
    INSERT INTO public.professional_profiles (
      profile_id, display_name, region_id, primary_colonia, coverage_zones, bio
    ) VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      target_region_id,
      COALESCE(default_colonia, 'Centro'),
      ARRAY[COALESCE(default_colonia, 'Centro')],
      ''
    ) ON CONFLICT (profile_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- RPC FUNCTION: accept_quote_and_create_booking
-- ============================================================================
CREATE OR REPLACE FUNCTION public.accept_quote_and_create_booking(quote_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  v_quote quotes%ROWTYPE;
  v_version quote_versions%ROWTYPE;
  v_request service_requests%ROWTYPE;
  v_booking_id UUID;
BEGIN
  SELECT * INTO v_quote FROM quotes WHERE id = quote_uuid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote not found';
  END IF;

  SELECT * INTO v_version FROM quote_versions WHERE quote_id = quote_uuid ORDER BY version_number DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quote version not found';
  END IF;

  SELECT * INTO v_request FROM service_requests WHERE id = v_quote.request_id;

  UPDATE quotes SET status = 'accepted', updated_at = NOW() WHERE id = quote_uuid;
  UPDATE service_requests SET status = 'accepted' WHERE id = v_quote.request_id;

  INSERT INTO bookings (
    request_id, quote_id, quote_version, client_id, professional_id, region_id,
    service_title, description, agreed_amount_mxn, payment_note, scheduled_date,
    scheduled_time, colonia, private_address, conditions, status
  ) VALUES (
    v_quote.request_id,
    quote_uuid,
    v_version.version_number,
    v_quote.client_id,
    v_quote.professional_id,
    v_request.region_id,
    v_quote.service_name,
    v_quote.description,
    v_version.total_amount,
    'Pago acordado según cotización (' || v_version.total_amount || ' MXN)',
    v_version.proposed_date,
    v_version.proposed_time,
    v_request.colonia,
    COALESCE(v_request.private_address, v_request.colonia),
    v_version.conditions,
    'quote_accepted'
  ) RETURNING id INTO v_booking_id;

  RETURN jsonb_build_object('success', true, 'booking_id', v_booking_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 6. STORAGE BUCKETS Y POLÍTICAS SEGURAS
-- ============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('public-avatars', 'public-avatars', TRUE),
  ('portafolio-images', 'portafolio-images', TRUE),
  ('verification-docs', 'verification-docs', FALSE),
  ('chat-attachments', 'chat-attachments', FALSE)
ON CONFLICT (id) DO NOTHING;

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

-- Avatares públicos: validación de ruta y propiedad
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

-- Fotos de portafolio: propiedad del profesional
CREATE POLICY "portfolio_select" ON storage.objects FOR SELECT USING (bucket_id = 'portafolio-images');
CREATE POLICY "portfolio_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'portafolio-images' AND auth.role() = 'authenticated' AND (
    public.is_central_admin(auth.uid()) OR
    auth.uid() IN (SELECT pp.profile_id FROM professional_profiles pp WHERE pp.id::text = (storage.foldername(name))[1])
  )
);
CREATE POLICY "portfolio_delete" ON storage.objects FOR DELETE USING (
  bucket_id = 'portafolio-images' AND auth.role() = 'authenticated' AND (
    public.is_central_admin(auth.uid()) OR
    auth.uid() IN (SELECT pp.profile_id FROM professional_profiles pp WHERE pp.id::text = (storage.foldername(name))[1])
  )
);

-- Documentos de verificación: estrictamente propietario y administradores
CREATE POLICY "verifications_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'verification-docs' AND auth.role() = 'authenticated' AND (
    public.is_central_admin(auth.uid()) OR
    auth.uid() IN (
      SELECT pp.profile_id FROM verification_documents vd
      JOIN verification_requests vr ON vr.id = vd.verification_request_id
      JOIN professional_profiles pp ON pp.id = vr.professional_id
      WHERE vd.private_storage_path = name
    )
  )
);
CREATE POLICY "verifications_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'verification-docs' AND auth.role() = 'authenticated' AND (
    public.is_central_admin(auth.uid()) OR
    auth.uid() IN (
      SELECT pp.profile_id FROM verification_requests vr
      JOIN professional_profiles pp ON pp.id = vr.professional_id
      WHERE pp.id::text = (storage.foldername(name))[1]
    )
  )
);

-- Adjuntos de chat: solo participantes de la conversación y administradores
CREATE POLICY "chat_attachments_select" ON storage.objects FOR SELECT USING (
  bucket_id = 'chat-attachments' AND auth.role() = 'authenticated' AND (
    public.is_central_admin(auth.uid()) OR
    auth.uid() IN (
      SELECT unnest(c.participant_ids) FROM message_attachments ma
      JOIN messages m ON m.id = ma.message_id
      JOIN conversations c ON c.id = m.conversation_id
      WHERE ma.storage_path = name
    )
  )
);
CREATE POLICY "chat_attachments_insert" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'chat-attachments' AND auth.role() = 'authenticated'
);
