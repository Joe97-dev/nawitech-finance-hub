CREATE OR REPLACE FUNCTION public.generate_loan_schedule(p_loan_id uuid, p_amount numeric, p_interest_rate numeric, p_term_months integer, p_frequency text, p_start_date date)
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
    v_term_unit text;
    v_term_value integer;
    total_days INTEGER;
    effective_months DECIMAL;
    use_exact_days BOOLEAN := FALSE;
BEGIN
    SELECT l.organization_id, l.interest_method
    INTO v_organization_id, v_interest_method 
    FROM public.loans l WHERE l.id = p_loan_id;
    
    DELETE FROM public.loan_schedule WHERE loan_id = p_loan_id;
    
    effective_months := p_term_months;
    total_days := ROUND(effective_months * 30);
    
    -- For short-term loans (<=30 days), use exact day arithmetic instead of month intervals
    IF total_days <= 30 THEN
        use_exact_days := TRUE;
    END IF;
    
    CASE p_frequency
        WHEN 'daily' THEN 
            installment_count := total_days;
            interval_text := '1 day';
        WHEN 'weekly' THEN 
            installment_count := GREATEST(1, ROUND(total_days / 7.0));
            interval_text := NULL;
        WHEN 'bi-weekly' THEN 
            installment_count := GREATEST(1, ROUND(total_days / 14.0));
            interval_text := NULL;
        WHEN 'monthly' THEN 
            installment_count := GREATEST(1, ROUND(effective_months));
            IF use_exact_days THEN
                interval_text := NULL; -- will use exact days below
            ELSE
                interval_text := '1 month';
            END IF;
        WHEN 'quarterly' THEN 
            installment_count := GREATEST(1, CEIL(effective_months / 3.0));
            interval_text := '3 months';
        ELSE 
            installment_count := GREATEST(1, ROUND(effective_months));
            IF use_exact_days THEN
                interval_text := NULL;
            ELSE
                interval_text := '1 month';
            END IF;
    END CASE;

    IF installment_count < 1 THEN
        installment_count := 1;
    END IF;
    
    IF v_interest_method = 'reducing' THEN
        DECLARE
            rate_per_installment DECIMAL;
        BEGIN
            rate_per_installment := (p_interest_rate / 100.0) * effective_months / installment_count;
            remaining_principal := p_amount;
            principal_amount := p_amount / installment_count;
            
            next_due_date := p_start_date;
            FOR i IN 1..installment_count LOOP
                IF interval_text IS NOT NULL THEN
                    next_due_date := next_due_date + interval_text::INTERVAL;
                ELSE
                    -- Use exact day spacing
                    next_due_date := p_start_date + (ROUND(total_days::DECIMAL / installment_count * i))::INTEGER;
                END IF;
                
                interest_amount := remaining_principal * rate_per_installment;
                
                INSERT INTO public.loan_schedule (loan_id, due_date, principal_due, interest_due, total_due, amount_paid, status, organization_id)
                VALUES (p_loan_id, next_due_date, principal_amount, interest_amount, principal_amount + interest_amount, 0.0, 'pending', v_organization_id);
                
                remaining_principal := remaining_principal - principal_amount;
            END LOOP;
        END;
    ELSE
        total_interest := p_amount * (p_interest_rate / 100.0) * effective_months;
        principal_amount := p_amount / installment_count;
        interest_amount := total_interest / installment_count;
        
        next_due_date := p_start_date;
        FOR i IN 1..installment_count LOOP
            IF interval_text IS NOT NULL THEN
                next_due_date := next_due_date + interval_text::INTERVAL;
            ELSE
                -- Use exact day spacing
                next_due_date := p_start_date + (ROUND(total_days::DECIMAL / installment_count * i))::INTEGER;
            END IF;
            
            INSERT INTO public.loan_schedule (loan_id, due_date, principal_due, interest_due, total_due, amount_paid, status, organization_id)
            VALUES (p_loan_id, next_due_date, principal_amount, interest_amount, principal_amount + interest_amount, 0.0, 'pending', v_organization_id);
        END LOOP;
    END IF;
END;
$function$;