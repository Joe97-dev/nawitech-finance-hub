-- Create trigger for new clients
CREATE TRIGGER trigger_set_client_number
    BEFORE INSERT ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION set_client_number();