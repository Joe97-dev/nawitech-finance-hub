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
    loan_term_months INTEGER;
    loan_date DATE;
    day_age INTEGER;
    total_days INTEGER;
BEGIN
    -- Get current loan balance, status, term, and date
    SELECT balance, status, term_months, date 
    INTO current_balance, loan_current_status, loan_term_months, loan_date
    FROM public.loans 
    WHERE id = p_loan_id;
    
    -- If loan is fully paid (balance = 0), mark as closed
    IF current_balance <= 0 THEN
        UPDATE public.loans 
        SET status = 'closed'
        WHERE id = p_loan_id AND status != 'closed';
        RETURN;
    END IF;
    
    -- For short-term loans (30-day / term_months <= 1), only mark arrears after term expires
    IF COALESCE(loan_term_months, 12) <= 1 THEN
        day_age := CURRENT_DATE - loan_date;
        total_days := GREATEST(1, COALESCE(loan_term_months, 1)) * 30;
        
        IF day_age > total_days THEN
            UPDATE public.loans 
            SET status = 'in arrears'
            WHERE id = p_loan_id AND status NOT IN ('in arrears', 'pending', 'rejected', 'postponed');
        ELSE
            -- Keep as active if term hasn't expired
            UPDATE public.loans 
            SET status = 'active'
            WHERE id = p_loan_id AND status IN ('in arrears');
        END IF;
        RETURN;
    END IF;
    
    -- For longer-term loans, use installment-based arrears logic
    SELECT COUNT(*) INTO overdue_count
    FROM public.loan_schedule
    WHERE loan_id = p_loan_id 
      AND due_date < CURRENT_DATE
      AND COALESCE(amount_paid, 0) < total_due
      AND status != 'paid';
    
    IF overdue_count > 0 THEN
        UPDATE public.loans 
        SET status = 'in arrears'
        WHERE id = p_loan_id AND status NOT IN ('in arrears', 'pending', 'rejected', 'postponed');
    ELSE
        UPDATE public.loans 
        SET status = 'active'
        WHERE id = p_loan_id AND status IN ('closed', 'in arrears');
    END IF;
END;
$function$;