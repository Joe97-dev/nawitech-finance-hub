-- Create function to update loan status based on payment conditions
CREATE OR REPLACE FUNCTION public.update_loan_status(p_loan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    current_balance DECIMAL;
    overdue_count INTEGER;
    loan_current_status TEXT;
BEGIN
    -- Get current loan balance and status
    SELECT balance, status INTO current_balance, loan_current_status
    FROM public.loans 
    WHERE id = p_loan_id;
    
    -- If loan is fully paid (balance = 0), mark as closed
    IF current_balance <= 0 THEN
        UPDATE public.loans 
        SET status = 'closed'
        WHERE id = p_loan_id AND status != 'closed';
        RETURN;
    END IF;
    
    -- Check for overdue payments (due_date < current_date and amount_paid < total_due)
    SELECT COUNT(*) INTO overdue_count
    FROM public.loan_schedule
    WHERE loan_id = p_loan_id 
      AND due_date < CURRENT_DATE
      AND COALESCE(amount_paid, 0) < total_due
      AND status != 'paid';
    
    -- If there are overdue payments, mark as in arrears
    IF overdue_count > 0 THEN
        UPDATE public.loans 
        SET status = 'in arrears'
        WHERE id = p_loan_id AND status NOT IN ('closed', 'in arrears');
    ELSIF loan_current_status = 'in arrears' THEN
        -- If no overdue payments and currently in arrears, change back to active
        UPDATE public.loans 
        SET status = 'active'
        WHERE id = p_loan_id;
    END IF;
END;
$function$

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
$function$

-- Create trigger on loan_schedule changes to update status
DROP TRIGGER IF EXISTS trigger_update_loan_status ON public.loan_schedule;
CREATE TRIGGER trigger_update_loan_status
    AFTER INSERT OR UPDATE ON public.loan_schedule
    FOR EACH ROW
    EXECUTE FUNCTION public.update_loan_balance_trigger();

-- Create trigger on loan_transactions to update status
DROP TRIGGER IF EXISTS trigger_update_loan_status_on_transaction ON public.loan_transactions;
CREATE TRIGGER trigger_update_loan_status_on_transaction
    AFTER INSERT ON public.loan_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_loan_balance_trigger();