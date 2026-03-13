-- Ensure buckets exist and are public
UPDATE storage.buckets SET public = true WHERE id IN ('client-id-photos', 'client-business-photos', 'client_photos');

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('client-id-photos', 'client-id-photos', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']),
  ('client-business-photos', 'client-business-photos', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can upload id photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view id photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update id photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload business photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view business photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update business photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to insert into client-id-photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to insert into client-business-photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete id photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete business photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload client photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view client photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update client photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete client photos" ON storage.objects;

-- Create policies for client-id-photos
CREATE POLICY "Authenticated users can upload id photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'client-id-photos');
CREATE POLICY "Authenticated users can view id photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'client-id-photos');
CREATE POLICY "Authenticated users can update id photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'client-id-photos');
CREATE POLICY "Authenticated users can delete id photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'client-id-photos');

-- Create policies for client-business-photos
CREATE POLICY "Authenticated users can upload business photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'client-business-photos');
CREATE POLICY "Authenticated users can view business photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'client-business-photos');
CREATE POLICY "Authenticated users can update business photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'client-business-photos');
CREATE POLICY "Authenticated users can delete business photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'client-business-photos');

-- Create policies for client_photos
CREATE POLICY "Authenticated users can upload client photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'client_photos');
CREATE POLICY "Authenticated users can view client photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'client_photos');
CREATE POLICY "Authenticated users can update client photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'client_photos');
CREATE POLICY "Authenticated users can delete client photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'client_photos');