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
$function$;