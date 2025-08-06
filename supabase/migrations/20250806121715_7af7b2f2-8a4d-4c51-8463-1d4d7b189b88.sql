-- Add client_number field to clients table
ALTER TABLE public.clients ADD COLUMN client_number TEXT;

-- Create sequence for client numbers
CREATE SEQUENCE IF NOT EXISTS client_number_seq START 1;

-- Create function to generate client numbers in format CL00001
CREATE OR REPLACE FUNCTION public.generate_client_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    next_num INTEGER;
    client_id TEXT;
BEGIN
    -- Get the next number from sequence
    SELECT nextval('client_number_seq') INTO next_num;
    
    -- Format as CL + 5-digit padded number
    client_id := 'CL' || LPAD(next_num::text, 5, '0');
    
    RETURN client_id;
END;
$function$

-- Create trigger function to set client number automatically
CREATE OR REPLACE FUNCTION public.set_client_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.client_number IS NULL THEN
        NEW.client_number := generate_client_number();
    END IF;
    RETURN NEW;
END;
$function$

-- Create trigger for new clients
CREATE TRIGGER trigger_set_client_number
    BEFORE INSERT ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION set_client_number();

-- Update existing clients to have client numbers
DO $$
DECLARE
    client_record RECORD;
    counter INTEGER := 1;
BEGIN
    FOR client_record IN 
        SELECT id FROM public.clients WHERE client_number IS NULL ORDER BY created_at
    LOOP
        UPDATE public.clients 
        SET client_number = 'CL' || LPAD(counter::text, 5, '0')
        WHERE id = client_record.id;
        
        counter := counter + 1;
    END LOOP;
    
    -- Update the sequence to continue from where we left off
    PERFORM setval('client_number_seq', counter);
END $$;