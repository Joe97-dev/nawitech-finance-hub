
CREATE OR REPLACE FUNCTION public.generate_loan_schedule(p_loan_id uuid, p_amount numeric, p_interest_rate numeric, p_term_months integer, p_frequency text, p_start_date date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    installment_count INTEGER;
    installment_amount DECIMAL;
    principal_amount DECIMAL;
    interest_amount DECIMAL;
    total_interest DECIMAL;
    next_due_date DATE;
    interval_text TEXT;
    i INTEGER;
BEGIN
    -- Delete existing schedule for this loan
    DELETE FROM public.loan_schedule WHERE loan_id = p_loan_id;
    
    -- Calculate number of installments based on frequency
    CASE p_frequency
        WHEN 'weekly' THEN 
            installment_count := p_term_months * 4;
            interval_text := '1 week';
        WHEN 'bi-weekly' THEN 
            installment_count := p_term_months * 2;
            interval_text := '2 weeks';
        WHEN 'monthly' THEN 
            installment_count := p_term_months;
            interval_text := '1 month';
        WHEN 'quarterly' THEN 
            installment_count := CEIL(p_term_months / 3.0);
            interval_text := '3 months';
        ELSE
            installment_count := p_term_months;
            interval_text := '1 month';
    END CASE;
    
    -- Calculate installment amounts
    -- Interest rate is per month, so multiply by term_months for total interest
    total_interest := p_amount * (p_interest_rate / 100) * p_term_months;
    principal_amount := p_amount / installment_count;
    interest_amount := total_interest / installment_count;
    installment_amount := principal_amount + interest_amount;
    
    -- Generate schedule
    next_due_date := p_start_date;
    FOR i IN 1..installment_count LOOP
        -- Calculate next due date
        next_due_date := next_due_date + interval_text::INTERVAL;
        
        -- Insert schedule item
        INSERT INTO public.loan_schedule (
            loan_id,
            due_date,
            principal_due,
            interest_due,
            total_due,
            amount_paid,
            status
        ) VALUES (
            p_loan_id,
            next_due_date,
            principal_amount,
            interest_amount,
            installment_amount,
            0.0,
            'pending'
        );
    END LOOP;
END;
$function$;
