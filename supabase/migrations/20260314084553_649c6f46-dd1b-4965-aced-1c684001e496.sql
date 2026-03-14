
CREATE OR REPLACE FUNCTION public.generate_loan_schedule(
  p_loan_id uuid, 
  p_amount numeric, 
  p_interest_rate numeric, 
  p_term_months integer, 
  p_frequency text, 
  p_start_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    installment_count INTEGER;
    principal_amount DECIMAL;
    interest_amount DECIMAL;
    total_interest DECIMAL;
    next_due_date DATE;
    interval_text TEXT;
    i INTEGER;
    v_organization_id uuid;
    v_interest_method text;
    remaining_principal DECIMAL;
    monthly_rate DECIMAL;
BEGIN
    -- Get org and interest method from loan
    SELECT organization_id, interest_method 
    INTO v_organization_id, v_interest_method 
    FROM public.loans WHERE id = p_loan_id;
    
    DELETE FROM public.loan_schedule WHERE loan_id = p_loan_id;
    
    CASE p_frequency
        WHEN 'weekly' THEN installment_count := p_term_months * 4; interval_text := '1 week';
        WHEN 'bi-weekly' THEN installment_count := p_term_months * 2; interval_text := '2 weeks';
        WHEN 'monthly' THEN installment_count := p_term_months; interval_text := '1 month';
        WHEN 'quarterly' THEN installment_count := CEIL(p_term_months / 3.0); interval_text := '3 months';
        ELSE installment_count := p_term_months; interval_text := '1 month';
    END CASE;
    
    IF v_interest_method = 'reducing' THEN
        -- Reducing balance: interest calculated on remaining principal each period
        monthly_rate := p_interest_rate / 100.0;
        remaining_principal := p_amount;
        principal_amount := p_amount / installment_count;
        
        next_due_date := p_start_date;
        FOR i IN 1..installment_count LOOP
            next_due_date := next_due_date + interval_text::INTERVAL;
            interest_amount := remaining_principal * monthly_rate;
            
            INSERT INTO public.loan_schedule (loan_id, due_date, principal_due, interest_due, total_due, amount_paid, status, organization_id)
            VALUES (p_loan_id, next_due_date, principal_amount, interest_amount, principal_amount + interest_amount, 0.0, 'pending', v_organization_id);
            
            remaining_principal := remaining_principal - principal_amount;
        END LOOP;
    ELSE
        -- Flat rate: original logic
        total_interest := p_amount * (p_interest_rate / 100) * p_term_months;
        principal_amount := p_amount / installment_count;
        interest_amount := total_interest / installment_count;
        
        next_due_date := p_start_date;
        FOR i IN 1..installment_count LOOP
            next_due_date := next_due_date + interval_text::INTERVAL;
            INSERT INTO public.loan_schedule (loan_id, due_date, principal_due, interest_due, total_due, amount_paid, status, organization_id)
            VALUES (p_loan_id, next_due_date, principal_amount, interest_amount, principal_amount + interest_amount, 0.0, 'pending', v_organization_id);
        END LOOP;
    END IF;
END;
$function$;
