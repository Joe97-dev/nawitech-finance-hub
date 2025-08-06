-- Add custom loan_number column to loans table
ALTER TABLE public.loans ADD COLUMN loan_number TEXT UNIQUE;

-- Create a sequence for loan numbers
CREATE SEQUENCE IF NOT EXISTS loan_number_seq START 1;

-- Create a function to generate the next loan number
CREATE OR REPLACE FUNCTION generate_loan_number()
RETURNS TEXT AS $$
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
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate loan number on insert
CREATE OR REPLACE FUNCTION set_loan_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.loan_number IS NULL THEN
        NEW.loan_number := generate_loan_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER trigger_set_loan_number
    BEFORE INSERT ON public.loans
    FOR EACH ROW
    EXECUTE FUNCTION set_loan_number();

-- Update existing loans with loan numbers (if any exist)
UPDATE public.loans 
SET loan_number = generate_loan_number() 
WHERE loan_number IS NULL;