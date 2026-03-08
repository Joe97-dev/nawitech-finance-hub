
-- Create client_photos bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('client_photos', 'client_photos', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to client_photos
CREATE POLICY "Authenticated users can upload client photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'client_photos');

-- Allow authenticated users to read client photos
CREATE POLICY "Authenticated users can read client photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'client_photos');
