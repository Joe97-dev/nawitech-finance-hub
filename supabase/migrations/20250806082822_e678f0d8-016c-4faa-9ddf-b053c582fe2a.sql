-- Create function to calculate total outstanding balance (principal + interest - payments)
CREATE OR REPLACE FUNCTION calculate_outstanding_balance(p_loan_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    outstanding_balance DECIMAL;
BEGIN
    SELECT COALESCE(SUM(total_due - COALESCE(amount_paid, 0)), 0)
    INTO outstanding_balance
    FROM public.loan_schedule
    WHERE loan_id = p_loan_id;
    
    RETURN outstanding_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to update loan balance when schedule payments are made
CREATE OR REPLACE FUNCTION update_loan_balance_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the loan balance to reflect total outstanding amount
    UPDATE public.loans 
    SET balance = calculate_outstanding_balance(NEW.loan_id)
    WHERE id = NEW.loan_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger that fires when loan_schedule amount_paid is updated
DROP TRIGGER IF EXISTS loan_schedule_payment_trigger ON public.loan_schedule;
CREATE TRIGGER loan_schedule_payment_trigger
    AFTER UPDATE OF amount_paid ON public.loan_schedule
    FOR EACH ROW
    EXECUTE FUNCTION update_loan_balance_trigger();

-- Update existing loans to have correct outstanding balance
UPDATE public.loans 
SET balance = calculate_outstanding_balance(id)
WHERE id IN (SELECT DISTINCT loan_id FROM public.loan_schedule);