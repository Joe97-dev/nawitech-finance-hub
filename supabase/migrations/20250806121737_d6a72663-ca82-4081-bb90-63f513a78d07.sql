-- Add client_number field to clients table
ALTER TABLE public.clients ADD COLUMN client_number TEXT;

-- Create sequence for client numbers
CREATE SEQUENCE IF NOT EXISTS client_number_seq START 1;