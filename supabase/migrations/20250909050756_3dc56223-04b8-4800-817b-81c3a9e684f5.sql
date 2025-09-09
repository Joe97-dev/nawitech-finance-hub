-- Create storage buckets for client documents and photos if they don't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('client-documents', 'client-documents', false),
  ('client-id-photos', 'client-id-photos', false),
  ('client-business-photos', 'client-business-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Add marital_status column to clients table
ALTER TABLE public.clients 
ADD COLUMN IF NOT EXISTS marital_status text;

-- Create client_referees table to store referee information
CREATE TABLE IF NOT EXISTS public.client_referees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  relationship text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on client_referees
ALTER TABLE public.client_referees ENABLE ROW LEVEL SECURITY;

-- Create policies for client_referees
CREATE POLICY "Data entry can view and create client referees" 
ON public.client_referees 
FOR ALL
USING (has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

-- Create client_documents table to store client documents
CREATE TABLE IF NOT EXISTS public.client_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL,
  document_name text NOT NULL,
  file_path text NOT NULL,
  document_type text NOT NULL,
  uploaded_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on client_documents
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;

-- Create policies for client_documents
CREATE POLICY "Data entry can view and create client documents" 
ON public.client_documents 
FOR ALL
USING (has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

-- Create storage policies for client-documents bucket
CREATE POLICY "Users can view client documents" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'client-documents' AND (has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role)));

CREATE POLICY "Users can upload client documents" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'client-documents' AND (has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role)));

-- Create storage policies for client-id-photos bucket
CREATE POLICY "Users can view client ID photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'client-id-photos' AND (has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role)));

CREATE POLICY "Users can upload client ID photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'client-id-photos' AND (has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role)));

-- Create storage policies for client-business-photos bucket
CREATE POLICY "Users can view client business photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'client-business-photos' AND (has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role)));

CREATE POLICY "Users can upload client business photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'client-business-photos' AND (has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role)));