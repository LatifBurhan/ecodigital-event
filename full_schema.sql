-- FULL SCHEMA DUMP FOR ECO DIGITAL EVENT
-- This combines all migrations into a single runnable SQL file for Supabase SQL Editor

-- 0. Helper Functions & Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- 1. Tables Creation

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  location text NOT NULL,
  maps_url text NOT NULL,
  organizer text NOT NULL,
  poster_url text NOT NULL,
  description text,
  lineup text[] NOT NULL DEFAULT '{}',
  facilities text[] NOT NULL DEFAULT '{}',
  socials jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_paid boolean NOT NULL DEFAULT false,
  price integer NOT NULL DEFAULT 0,
  payment_methods jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_published boolean NOT NULL DEFAULT true,
  registration_open boolean NOT NULL DEFAULT true,
  CONSTRAINT events_dates_chk CHECK (end_date >= start_date),
  CONSTRAINT events_price_chk CHECK (price >= 0)
);

CREATE TABLE public.event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  whatsapp text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  payment_method text,
  payment_proof_path text,
  amount integer NOT NULL DEFAULT 0,
  ticket_code text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  checked_in_at timestamptz,
  UNIQUE (event_id, email)
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  whatsapp text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- DEPRECATED table from early version, included for completeness
CREATE TABLE public.partner_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  organizer_name text NOT NULL,
  institution text NOT NULL,
  event_type text NOT NULL,
  duration_days integer NOT NULL,
  estimated_participants integer,
  email text NOT NULL,
  whatsapp text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'Baru'
);

-- 2. Indexes
CREATE INDEX event_registrations_event_idx ON public.event_registrations(event_id);
CREATE INDEX partner_inquiries_created_at_idx ON public.partner_inquiries (created_at DESC);
CREATE INDEX partner_inquiries_status_idx ON public.partner_inquiries (status);
CREATE INDEX partner_inquiries_event_type_idx ON public.partner_inquiries (event_type);

-- 3. Triggers for updated_at
CREATE TRIGGER events_set_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER event_registrations_set_updated_at BEFORE UPDATE ON public.event_registrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER partner_inquiries_set_updated_at BEFORE UPDATE ON public.partner_inquiries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Utility Functions
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.normalize_wa(_p text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN d LIKE '0%' THEN '62' || substr(d, 2) WHEN d LIKE '8%' THEN '62' || d ELSE d END
  FROM (SELECT regexp_replace(coalesce(_p,''), '\D', '', 'g') AS d) s
$$;

-- Trigger to automatically create profile on sign up
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.raw_user_meta_data ? 'whatsapp' THEN
    INSERT INTO public.profiles (id, full_name, email, whatsapp)
    VALUES (NEW.id, left(trim(coalesce(NEW.raw_user_meta_data->>'full_name','')),120), lower(NEW.email),
            public.normalize_wa(NEW.raw_user_meta_data->>'whatsapp'));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Business Logic Functions
CREATE OR REPLACE FUNCTION public.register_for_event(_event_id uuid, _name text, _email text, _whatsapp text, _payment_method text DEFAULT NULL::text, _proof_path text DEFAULT NULL::text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE ev public.events; pr public.profiles; code text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Silakan masuk terlebih dahulu'; END IF;
  SELECT * INTO pr FROM public.profiles WHERE id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Profil peserta tidak ditemukan'; END IF;
  SELECT * INTO ev FROM public.events WHERE id = _event_id AND is_published = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event tidak ditemukan'; END IF;
  IF NOT ev.registration_open OR ev.end_date < current_date THEN RAISE EXCEPTION 'Pendaftaran event ini sudah ditutup'; END IF;
  IF EXISTS (SELECT 1 FROM public.event_registrations WHERE event_id = _event_id AND (user_id = auth.uid() OR lower(email) = pr.email)) THEN
    RAISE EXCEPTION 'Anda sudah terdaftar di event ini';
  END IF;
  IF ev.is_paid THEN
    IF _proof_path IS NULL OR _proof_path NOT LIKE (_event_id::text || '/%') THEN RAISE EXCEPTION 'Bukti pembayaran wajib diunggah'; END IF;
    IF coalesce(trim(_payment_method),'') = '' THEN RAISE EXCEPTION 'Pilih metode pembayaran'; END IF;
  END IF;
  INSERT INTO public.event_registrations (event_id, user_id, name, email, whatsapp, status, payment_method, payment_proof_path, amount)
  VALUES (_event_id, auth.uid(), pr.full_name, pr.email, pr.whatsapp,
    CASE WHEN ev.is_paid THEN 'pending' ELSE 'approved' END,
    CASE WHEN ev.is_paid THEN left(_payment_method, 120) END,
    CASE WHEN ev.is_paid THEN _proof_path END,
    CASE WHEN ev.is_paid THEN ev.price ELSE 0 END)
  RETURNING ticket_code INTO code;
  RETURN code;
END $function$;

CREATE OR REPLACE FUNCTION public.get_ticket(_code text)
RETURNS TABLE (ticket_code text, name text, status text, amount integer, created_at timestamptz,
  event_title text, event_slug text, start_date date, end_date date, location text, poster_url text, is_paid boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.ticket_code, r.name, r.status, r.amount, r.created_at,
    e.title, e.slug, e.start_date, e.end_date, e.location, e.poster_url, e.is_paid
  FROM public.event_registrations r JOIN public.events e ON e.id = r.event_id
  WHERE r.ticket_code = _code
$$;

-- 6. Grants & RLS Policies
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT ON public.events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
GRANT SELECT, UPDATE, DELETE ON public.event_registrations TO authenticated;
GRANT ALL ON public.event_registrations TO service_role;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

GRANT EXECUTE ON FUNCTION public.register_for_event(uuid,text,text,text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ticket(text) TO anon, authenticated;

-- Policies for user_roles
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Policies for events
CREATE POLICY "Public can read published events" ON public.events FOR SELECT TO anon, authenticated USING (is_published = true);
CREATE POLICY "Admins read all events" ON public.events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert events" ON public.events FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update events" ON public.events FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete events" ON public.events FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Policies for event_registrations
CREATE POLICY "Users read own registrations" ON public.event_registrations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins read registrations" ON public.event_registrations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update registrations" ON public.event_registrations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete registrations" ON public.event_registrations FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Policies for profiles
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 7. Storage Setup & Policies
INSERT INTO storage.buckets (id, name, public) VALUES ('event-posters', 'event-posters', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins read posters" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'event-posters' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert posters" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'event-posters' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update posters" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'event-posters' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete posters" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'event-posters' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone upload payment proof" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'payment-proofs');
CREATE POLICY "Admins read payment proofs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete payment proofs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'admin'));
