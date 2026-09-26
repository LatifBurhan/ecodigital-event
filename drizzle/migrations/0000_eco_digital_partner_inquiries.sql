-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can read own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Partner inquiries
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
  status text NOT NULL DEFAULT 'Baru',
  CONSTRAINT partner_inquiries_duration_check CHECK (duration_days >= 1 AND duration_days <= 365),
  CONSTRAINT partner_inquiries_participants_check CHECK (estimated_participants IS NULL OR estimated_participants > 0),
  CONSTRAINT partner_inquiries_status_check CHECK (status IN ('Baru','Dihubungi','Dalam Proses','Selesai')),
  CONSTRAINT partner_inquiries_event_type_check CHECK (event_type IN ('Conference','Seminar','Workshop','Meeting','Exhibition','Lainnya')),
  CONSTRAINT partner_inquiries_name_check CHECK (char_length(trim(organizer_name)) BETWEEN 2 AND 120),
  CONSTRAINT partner_inquiries_institution_check CHECK (char_length(trim(institution)) BETWEEN 2 AND 160),
  CONSTRAINT partner_inquiries_email_check CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND char_length(email) <= 200),
  CONSTRAINT partner_inquiries_whatsapp_check CHECK (whatsapp ~ '^[0-9+][0-9]{7,17}$'),
  CONSTRAINT partner_inquiries_notes_check CHECK (notes IS NULL OR char_length(notes) <= 2000)
);

CREATE INDEX partner_inquiries_created_at_idx ON public.partner_inquiries (created_at DESC);
CREATE INDEX partner_inquiries_status_idx ON public.partner_inquiries (status);
CREATE INDEX partner_inquiries_event_type_idx ON public.partner_inquiries (event_type);

GRANT INSERT ON public.partner_inquiries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_inquiries TO authenticated;
GRANT ALL ON public.partner_inquiries TO service_role;

ALTER TABLE public.partner_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit an inquiry"
  ON public.partner_inquiries FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'Baru');

CREATE POLICY "Admins can read inquiries"
  ON public.partner_inquiries FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update inquiries"
  ON public.partner_inquiries FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete inquiries"
  ON public.partner_inquiries FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

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

CREATE TRIGGER partner_inquiries_set_updated_at
  BEFORE UPDATE ON public.partner_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
