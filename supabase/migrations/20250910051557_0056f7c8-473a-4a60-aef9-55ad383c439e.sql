-- Add photo URL fields to clients table
ALTER TABLE public.clients 
ADD COLUMN id_photo_front_url TEXT,
ADD COLUMN id_photo_back_url TEXT, 
ADD COLUMN business_photo_url TEXT;