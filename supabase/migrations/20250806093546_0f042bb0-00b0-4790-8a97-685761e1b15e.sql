-- Update the existing balance trigger to also update status
CREATE OR REPLACE FUNCTION public.update_loan_balance_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    -- Update the loan balance to reflect total outstanding amount
    UPDATE public.loans 
    SET balance = calculate_outstanding_balance(NEW.loan_id)
    WHERE id = NEW.loan_id;
    
    -- Update loan status based on payment conditions
    PERFORM update_loan_status(NEW.loan_id);
    
    RETURN NEW;
END;
$function$;