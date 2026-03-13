-- Create missing storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('client-id-photos', 'client-id-photos', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']),
  ('client-business-photos', 'client-business-photos', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- RLS policies for client-id-photos
CREATE POLICY "Authenticated users can upload id photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'client-id-photos');

CREATE POLICY "Authenticated users can view id photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'client-id-photos');

CREATE POLICY "Authenticated users can update id photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'client-id-photos');

-- RLS policies for client-business-photos
CREATE POLICY "Authenticated users can upload business photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'client-business-photos');

CREATE POLICY "Authenticated users can view business photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'client-business-photos');

CREATE POLICY "Authenticated users can update business photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'client-business-photos');