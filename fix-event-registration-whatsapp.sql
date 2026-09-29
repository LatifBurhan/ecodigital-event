-- ============================================================
-- FIX EVENT REGISTRATION WHATSAPP NULL ISSUE
-- ============================================================
-- Allow NULL whatsapp in event_registrations table
-- This fixes the error when profile.whatsapp is NULL
-- ============================================================

BEGIN;

-- Step 1: Make whatsapp nullable in event_registrations
ALTER TABLE public.event_registrations ALTER COLUMN whatsapp DROP NOT NULL;

-- Step 2: Set empty whatsapp to NULL for consistency
UPDATE public.event_registrations SET whatsapp = NULL WHERE whatsapp = '';

-- Step 3: Update register_for_event function to use fallback whatsapp
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
  
  -- Use profile whatsapp, fallback to email if NULL
  INSERT INTO public.event_registrations (event_id, user_id, name, email, whatsapp, status, payment_method, payment_proof_path, amount)
  VALUES (_event_id, auth.uid(), pr.full_name, pr.email, 
    COALESCE(pr.whatsapp, split_part(pr.email, '@', 1)), -- Fallback to email username if whatsapp is NULL
    CASE WHEN ev.is_paid THEN 'pending' ELSE 'approved' END,
    CASE WHEN ev.is_paid THEN left(_payment_method, 120) END,
    CASE WHEN ev.is_paid THEN _proof_path END,
    CASE WHEN ev.is_paid THEN ev.price ELSE 0 END)
  RETURNING ticket_code INTO code;
  RETURN code;
END $function$;

COMMIT;

-- Verify
SELECT 'Fix applied successfully!' as status;
