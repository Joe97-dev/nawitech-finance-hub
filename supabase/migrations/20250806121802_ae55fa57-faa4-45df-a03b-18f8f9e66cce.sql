-- Create function to generate client numbers in format CL00001
CREATE OR REPLACE FUNCTION public.generate_client_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
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