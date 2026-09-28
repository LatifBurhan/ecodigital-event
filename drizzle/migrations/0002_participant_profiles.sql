CREATE OR REPLACE FUNCTION public.normalize_wa(_p text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN d LIKE '0%' THEN '62' || substr(d, 2) WHEN d LIKE '8%' THEN '62' || d ELSE d END
  FROM (SELECT regexp_replace(coalesce(_p,''), '\D', '', 'g') AS d) s
$$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  whatsapp text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins read profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

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

ALTER TABLE public.event_registrations ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE POLICY "Users read own registrations" ON public.event_registrations FOR SELECT TO authenticated USING (auth.uid() = user_id);

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