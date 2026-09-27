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
GRANT SELECT ON public.events TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO authenticated;
GRANT ALL ON public.events TO service_role;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read published events" ON public.events FOR SELECT TO anon, authenticated USING (is_published = true);
CREATE POLICY "Admins read all events" ON public.events FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert events" ON public.events FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update events" ON public.events FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete events" ON public.events FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER events_set_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
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
CREATE INDEX event_registrations_event_idx ON public.event_registrations(event_id);
GRANT SELECT, UPDATE, DELETE ON public.event_registrations TO authenticated;
GRANT ALL ON public.event_registrations TO service_role;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read registrations" ON public.event_registrations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update registrations" ON public.event_registrations FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete registrations" ON public.event_registrations FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER event_registrations_set_updated_at BEFORE UPDATE ON public.event_registrations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.register_for_event(
  _event_id uuid, _name text, _email text, _whatsapp text,
  _payment_method text DEFAULT NULL, _proof_path text DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ev public.events; code text;
BEGIN
  SELECT * INTO ev FROM public.events WHERE id = _event_id AND is_published = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Event tidak ditemukan'; END IF;
  IF NOT ev.registration_open OR ev.end_date < current_date THEN RAISE EXCEPTION 'Pendaftaran event ini sudah ditutup'; END IF;
  IF length(trim(coalesce(_name,''))) < 2 OR length(_name) > 120 THEN RAISE EXCEPTION 'Nama tidak valid'; END IF;
  IF _email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(_email) > 200 THEN RAISE EXCEPTION 'Email tidak valid'; END IF;
  IF length(regexp_replace(coalesce(_whatsapp,''), '\D', '', 'g')) < 9 OR length(_whatsapp) > 20 THEN RAISE EXCEPTION 'Nomor WhatsApp tidak valid'; END IF;
  IF EXISTS (SELECT 1 FROM public.event_registrations WHERE event_id = _event_id AND lower(email) = lower(trim(_email))) THEN
    RAISE EXCEPTION 'Email ini sudah terdaftar di event ini';
  END IF;
  IF ev.is_paid THEN
    IF _proof_path IS NULL OR _proof_path NOT LIKE (_event_id::text || '/%') THEN RAISE EXCEPTION 'Bukti pembayaran wajib diunggah'; END IF;
    IF coalesce(trim(_payment_method),'') = '' THEN RAISE EXCEPTION 'Pilih metode pembayaran'; END IF;
  END IF;
  INSERT INTO public.event_registrations (event_id, name, email, whatsapp, status, payment_method, payment_proof_path, amount)
  VALUES (_event_id, trim(_name), lower(trim(_email)), trim(_whatsapp),
    CASE WHEN ev.is_paid THEN 'pending' ELSE 'approved' END,
    CASE WHEN ev.is_paid THEN left(_payment_method, 120) END,
    CASE WHEN ev.is_paid THEN _proof_path END,
    CASE WHEN ev.is_paid THEN ev.price ELSE 0 END)
  RETURNING ticket_code INTO code;
  RETURN code;
END $$;
GRANT EXECUTE ON FUNCTION public.register_for_event(uuid,text,text,text,text,text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_ticket(_code text)
RETURNS TABLE (ticket_code text, name text, status text, amount integer, created_at timestamptz,
  event_title text, event_slug text, start_date date, end_date date, location text, poster_url text, is_paid boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.ticket_code, r.name, r.status, r.amount, r.created_at,
    e.title, e.slug, e.start_date, e.end_date, e.location, e.poster_url, e.is_paid
  FROM public.event_registrations r JOIN public.events e ON e.id = r.event_id
  WHERE r.ticket_code = _code
$$;
GRANT EXECUTE ON FUNCTION public.get_ticket(text) TO anon, authenticated;

CREATE POLICY "Admins read posters" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'event-posters' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert posters" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'event-posters' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update posters" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'event-posters' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete posters" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'event-posters' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone upload payment proof" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'payment-proofs');
CREATE POLICY "Admins read payment proofs" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete payment proofs" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'payment-proofs' AND public.has_role(auth.uid(), 'admin'));

COMMENT ON TABLE public.partner_inquiries IS 'DEPRECATED: partner inquiry form removed, replaced by events';