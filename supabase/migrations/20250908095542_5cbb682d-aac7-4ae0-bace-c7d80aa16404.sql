-- Recalculate draw down balance for loans with existing transactions
-- This addresses the issue where excess payments weren't properly allocated to draw down accounts

DO $$
DECLARE
    loan_record RECORD;
    total_paid DECIMAL;
    total_schedule_due DECIMAL;
    excess_amount DECIMAL;
BEGIN
    -- Loop through all loans
    FOR loan_record IN SELECT id, amount FROM loans LOOP
        -- Calculate total amount paid for this loan
        SELECT COALESCE(SUM(lt.amount), 0) 
        INTO total_paid
        FROM loan_transactions lt
        WHERE lt.loan_id = loan_record.id 
        AND lt.transaction_type = 'repayment';
        
        -- Calculate total due from schedule
        SELECT COALESCE(SUM(ls.total_due), 0)
        INTO total_schedule_due
        FROM loan_schedule ls
        WHERE ls.loan_id = loan_record.id;
        
        -- If total paid exceeds total due, the excess should be in draw down
        IF total_paid > total_schedule_due THEN
            excess_amount := total_paid - total_schedule_due;
            
            -- Update the loan's draw down balance
            UPDATE loans 
            SET draw_down_balance = excess_amount
            WHERE id = loan_record.id;
            
            RAISE NOTICE 'Updated loan % with draw down balance of %', loan_record.id, excess_amount;
        END IF;
    END LOOP;
END $$;