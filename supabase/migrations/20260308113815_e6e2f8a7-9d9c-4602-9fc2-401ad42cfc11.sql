
-- Update the trigger function to skip loan number generation for fee accounts
CREATE OR REPLACE FUNCTION public.set_loan_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.loan_number IS NULL AND NEW.type != 'client_fee_account' THEN
        NEW.loan_number := generate_loan_number();
    END IF;
    RETURN NEW;
END;
$function$;

-- Remove loan numbers from existing fee accounts
UPDATE public.loans SET loan_number = NULL WHERE type = 'client_fee_account';
