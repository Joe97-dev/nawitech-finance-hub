-- Fix security warnings by setting search_path for functions

-- Drop and recreate the generate_loan_number function with proper security settings
DROP FUNCTION IF EXISTS generate_loan_number();

CREATE OR REPLACE FUNCTION generate_loan_number()
RETURNS TEXT 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    next_num INTEGER;
    loan_id TEXT;
BEGIN
    -- Get the next number from sequence
    SELECT nextval('loan_number_seq') INTO next_num;
    
    -- Format as LN + 5-digit padded number
    loan_id := 'LN' || LPAD(next_num::text, 5, '0');
    
    RETURN loan_id;
END;
$$;

-- Drop and recreate the set_loan_number function with proper security settings
DROP FUNCTION IF EXISTS set_loan_number();

CREATE OR REPLACE FUNCTION set_loan_number()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    IF NEW.loan_number IS NULL THEN
        NEW.loan_number := generate_loan_number();
    END IF;
    RETURN NEW;
END;
$$;