-- Add frequency and term columns to loans table
ALTER TABLE public.loans 
ADD COLUMN frequency TEXT CHECK (frequency IN ('weekly', 'bi-weekly', 'monthly', 'quarterly')) DEFAULT 'monthly',
ADD COLUMN term_months INTEGER DEFAULT 12,
ADD COLUMN interest_rate DECIMAL(5,2) DEFAULT 15.0;

-- Add amount_paid column to loan_schedule to track payments
ALTER TABLE public.loan_schedule 
ADD COLUMN amount_paid DECIMAL(15,2) DEFAULT 0.0;

-- Create function to generate loan schedule based on frequency
CREATE OR REPLACE FUNCTION generate_loan_schedule(
    p_loan_id UUID,
    p_amount DECIMAL,
    p_interest_rate DECIMAL,
    p_term_months INTEGER,
    p_frequency TEXT,
    p_start_date DATE
) RETURNS VOID AS $$
DECLARE
    installment_count INTEGER;
    installment_amount DECIMAL;
    principal_amount DECIMAL;
    interest_amount DECIMAL;
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
    principal_amount := p_amount / installment_count;
    interest_amount := (p_amount * p_interest_rate / 100) / installment_count;
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
$$ LANGUAGE plpgsql SECURITY DEFINER;