-- Certificate Templates Table
CREATE TABLE public.certificate_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  template_url text NOT NULL,
  
  -- Name field configuration
  name_position_x integer NOT NULL DEFAULT 500,
  name_position_y integer NOT NULL DEFAULT 400,
  name_font_size integer NOT NULL DEFAULT 48,
  name_font_color text NOT NULL DEFAULT '#000000',
  name_font_family text NOT NULL DEFAULT 'Arial',
  name_text_align text NOT NULL DEFAULT 'center' CHECK (name_text_align IN ('left', 'center', 'right')),
  
  -- Certificate number field configuration
  cert_number_position_x integer NOT NULL DEFAULT 100,
  cert_number_position_y integer NOT NULL DEFAULT 100,
  cert_number_font_size integer NOT NULL DEFAULT 24,
  cert_number_font_color text NOT NULL DEFAULT '#000000',
  cert_number_font_family text NOT NULL DEFAULT 'Arial',
  cert_number_text_align text NOT NULL DEFAULT 'left' CHECK (cert_number_text_align IN ('left', 'center', 'right')),
  
  -- Template metadata
  template_width integer NOT NULL DEFAULT 1920,
  template_height integer NOT NULL DEFAULT 1080,
  
  UNIQUE(event_id)
);

CREATE INDEX certificate_templates_event_idx ON public.certificate_templates(event_id);

-- Grant permissions
GRANT SELECT ON public.certificate_templates TO authenticated;
GRANT ALL ON public.certificate_templates TO service_role;

-- Enable RLS
ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins read certificate templates" 
  ON public.certificate_templates FOR SELECT 
  TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert certificate templates" 
  ON public.certificate_templates FOR INSERT 
  TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update certificate templates" 
  ON public.certificate_templates FOR UPDATE 
  TO authenticated 
  USING (public.has_role(auth.uid(), 'admin')) 
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete certificate templates" 
  ON public.certificate_templates FOR DELETE 
  TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER certificate_templates_set_updated_at 
  BEFORE UPDATE ON public.certificate_templates 
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Certificates Table
CREATE TABLE public.certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  registration_id uuid NOT NULL REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  certificate_number text NOT NULL UNIQUE,
  certificate_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'generated', 'failed')),
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  generated_at timestamptz,
  
  UNIQUE(registration_id)
);

CREATE INDEX certificates_registration_idx ON public.certificates(registration_id);
CREATE INDEX certificates_event_idx ON public.certificates(event_id);
CREATE INDEX certificates_status_idx ON public.certificates(status);

-- Grant permissions
GRANT SELECT ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;

-- Enable RLS
ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins read all certificates" 
  ON public.certificates FOR SELECT 
  TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users read own certificates"
  ON public.certificates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.event_registrations r
      WHERE r.id = certificates.registration_id
      AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins insert certificates" 
  ON public.certificates FOR INSERT 
  TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update certificates" 
  ON public.certificates FOR UPDATE 
  TO authenticated 
  USING (public.has_role(auth.uid(), 'admin')) 
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete certificates" 
  ON public.certificates FOR DELETE 
  TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER certificates_set_updated_at 
  BEFORE UPDATE ON public.certificates 
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Certificate Generation Queue Table (for background processing)
CREATE TABLE public.certificate_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  registration_id uuid NOT NULL REFERENCES public.event_registrations(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  priority integer NOT NULL DEFAULT 0,
  retry_count integer NOT NULL DEFAULT 0,
  last_error text,
  processed_at timestamptz
);

CREATE INDEX certificate_queue_status_idx ON public.certificate_queue(status, priority DESC, created_at);
CREATE INDEX certificate_queue_event_idx ON public.certificate_queue(event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificate_queue TO authenticated;
GRANT ALL ON public.certificate_queue TO service_role;

ALTER TABLE public.certificate_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access queue" 
  ON public.certificate_queue FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);

-- Function to generate certificate number
CREATE OR REPLACE FUNCTION public.generate_certificate_number(
  _event_id uuid,
  _registration_id uuid
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  event_slug text;
  sequence_num integer;
  cert_number text;
BEGIN
  -- Get event slug
  SELECT slug INTO event_slug FROM public.events WHERE id = _event_id;
  
  -- Get next sequence number for this event
  SELECT COUNT(*) + 1 INTO sequence_num 
  FROM public.certificates 
  WHERE event_id = _event_id;
  
  -- Format: EVENTSLUG-001
  cert_number := upper(event_slug) || '-' || lpad(sequence_num::text, 3, '0');
  
  RETURN cert_number;
END $$;

GRANT EXECUTE ON FUNCTION public.generate_certificate_number(uuid, uuid) TO authenticated, service_role;

-- Function to queue certificate generation after check-in
CREATE OR REPLACE FUNCTION public.queue_certificate_generation()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Only queue if checked_in_at changed from NULL to a timestamp
  IF NEW.checked_in_at IS NOT NULL AND OLD.checked_in_at IS NULL THEN
    -- Check if certificate template exists for this event
    IF EXISTS (SELECT 1 FROM public.certificate_templates WHERE event_id = NEW.event_id) THEN
      -- Insert into queue if not already exists
      INSERT INTO public.certificate_queue (registration_id, event_id, status, priority)
      VALUES (NEW.id, NEW.event_id, 'pending', 0)
      ON CONFLICT DO NOTHING;
      
      -- Create certificate record
      INSERT INTO public.certificates (registration_id, event_id, certificate_number, status)
      VALUES (
        NEW.id, 
        NEW.event_id, 
        public.generate_certificate_number(NEW.event_id, NEW.id),
        'pending'
      )
      ON CONFLICT (registration_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END $$;

-- Trigger on check-in to queue certificate generation
CREATE TRIGGER event_registrations_queue_certificate 
  AFTER UPDATE ON public.event_registrations
  FOR EACH ROW 
  EXECUTE FUNCTION public.queue_certificate_generation();

-- Storage buckets and policies for certificates
CREATE POLICY "Public read certificate templates" 
  ON storage.objects FOR SELECT 
  TO anon, authenticated 
  USING (bucket_id = 'certificate-templates');

CREATE POLICY "Admins insert certificate templates storage" 
  ON storage.objects FOR INSERT 
  TO authenticated 
  WITH CHECK (bucket_id = 'certificate-templates' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete certificate templates storage" 
  ON storage.objects FOR DELETE 
  TO authenticated 
  USING (bucket_id = 'certificate-templates' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read certificates storage" 
  ON storage.objects FOR SELECT 
  TO anon, authenticated 
  USING (bucket_id = 'certificates');

CREATE POLICY "Service role manage certificates storage" 
  ON storage.objects FOR ALL 
  TO service_role 
  USING (bucket_id = 'certificates');

COMMENT ON TABLE public.certificate_templates IS 'Stores certificate template images and text positioning configuration per event';
COMMENT ON TABLE public.certificates IS 'Generated certificates for participants who attended events';
COMMENT ON TABLE public.certificate_queue IS 'Background job queue for certificate generation processing';
