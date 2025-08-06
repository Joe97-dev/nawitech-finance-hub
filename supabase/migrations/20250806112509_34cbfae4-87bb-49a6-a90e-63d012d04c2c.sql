-- Create migration jobs table to track import processes
CREATE TABLE public.migration_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID NOT NULL,
  job_name TEXT NOT NULL,
  data_type TEXT NOT NULL CHECK (data_type IN ('clients', 'loans', 'transactions', 'all')),
  source_file_name TEXT NOT NULL,
  source_file_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  is_scheduled BOOLEAN NOT NULL DEFAULT false,
  schedule_frequency TEXT CHECK (schedule_frequency IN ('daily', 'weekly', 'monthly') OR schedule_frequency IS NULL),
  total_records INTEGER DEFAULT 0,
  processed_records INTEGER DEFAULT 0,
  successful_records INTEGER DEFAULT 0,
  failed_records INTEGER DEFAULT 0,
  error_summary JSONB,
  mapping_config JSONB,
  validation_results JSONB,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.migration_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies for migration jobs
CREATE POLICY "Admins can manage migration jobs" 
ON public.migration_jobs 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role));

-- Create storage bucket for migration files
INSERT INTO storage.buckets (id, name, public) VALUES ('migration-files', 'migration-files', false);

-- Create storage policies for migration files
CREATE POLICY "Admins can upload migration files" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'migration-files' AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can view migration files" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'migration-files' AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can update migration files" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'migration-files' AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Admins can delete migration files" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'migration-files' AND has_role(auth.uid(), 'admin'::user_role));

-- Create function to update migration job updated_at
CREATE OR REPLACE FUNCTION public.update_migration_job_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_migration_jobs_updated_at
BEFORE UPDATE ON public.migration_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_migration_job_updated_at();