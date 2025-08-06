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

-- Create trigger for new clients
CREATE TRIGGER trigger_set_client_number
    BEFORE INSERT ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION set_client_number();