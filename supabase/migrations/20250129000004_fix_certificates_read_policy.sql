-- Fix RLS policies for certificates table
-- Ensure authenticated users can read certificates for attendance display

-- Drop existing SELECT policies if any
DROP POLICY IF EXISTS "Users can read their own certificates" ON certificates;
DROP POLICY IF EXISTS "Authenticated users can read certificates" ON certificates;
DROP POLICY IF EXISTS "Public can read certificates" ON certificates;

-- Create policy for authenticated users to read all certificates
-- (Admin needs this to display certificate status in attendance page)
CREATE POLICY "Authenticated users can read certificates"
ON certificates
FOR SELECT
TO authenticated
USING (true);

-- Ensure users can read their own certificates (for public certificate page)
-- This is covered by the above policy, but we keep it explicit for clarity
CREATE POLICY "Users can read their own registration certificates"
ON certificates
FOR SELECT
TO authenticated
USING (
  registration_id IN (
    SELECT id FROM event_registrations 
    WHERE user_id = auth.uid() OR email = auth.email()
  )
);

-- Public can read certificates via direct link (for sharing)
CREATE POLICY "Public can read certificates with valid registration"
ON certificates
FOR SELECT
TO public
USING (
  status = 'generated' AND certificate_url IS NOT NULL
);
