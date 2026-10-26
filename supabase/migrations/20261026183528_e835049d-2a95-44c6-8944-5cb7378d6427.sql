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
    SELECT balance, status, term_months, date
    INTO current_balance, loan_current_status, loan_term_months, loan_date
    FROM public.loans WHERE id = p_loan_id;

    IF current_balance <= 0 THEN
        UPDATE public.loans SET status = 'closed'
        WHERE id = p_loan_id AND status NOT IN ('closed', 'abandoned', 'rejected');
        RETURN;
    END IF;

    IF COALESCE(loan_term_months, 12) <= 1 THEN
        day_age := CURRENT_DATE - loan_date;
        total_days := GREATEST(1, COALESCE(loan_term_months, 1)) * 30;
        IF day_age > total_days THEN
            UPDATE public.loans SET status = 'in arrears'
            WHERE id = p_loan_id AND status NOT IN ('in arrears', 'pending', 'rejected', 'postponed', 'abandoned', 'written_off');
        ELSE
            UPDATE public.loans SET status = 'active'
            WHERE id = p_loan_id AND status IN ('closed', 'in arrears');
        END IF;
        RETURN;
    END IF;

    SELECT COUNT(*) INTO overdue_count
    FROM public.loan_schedule
    WHERE loan_id = p_loan_id AND due_date < CURRENT_DATE
      AND COALESCE(amount_paid, 0) < total_due AND status != 'paid';

    IF overdue_count > 0 THEN
        UPDATE public.loans SET status = 'in arrears'
        WHERE id = p_loan_id AND status NOT IN ('in arrears', 'pending', 'rejected', 'postponed', 'abandoned', 'written_off');
    ELSE
        UPDATE public.loans SET status = 'active'
        WHERE id = p_loan_id AND status IN ('closed', 'in arrears');
    END IF;
END;
$function$;

-- Correct LN00814: valid repayments total 5,920
UPDATE public.loan_schedule
SET amount_paid = 5920, status = 'partial'
WHERE id = '39819b85-d908-4117-82cf-013f8d052b2d';