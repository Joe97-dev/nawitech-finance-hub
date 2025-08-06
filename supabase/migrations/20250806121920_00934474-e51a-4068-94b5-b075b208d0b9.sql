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