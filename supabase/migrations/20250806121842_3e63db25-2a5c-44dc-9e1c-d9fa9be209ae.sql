-- Create trigger function to set client number automatically
CREATE OR REPLACE FUNCTION public.set_client_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
    IF NEW.client_number IS NULL THEN
        NEW.client_number := generate_client_number();
    END IF;
    RETURN NEW;
END;
$function$