-- Create trigger on loan_transactions to update status when payments are made
DROP TRIGGER IF EXISTS trigger_update_loan_status_on_transaction ON public.loan_transactions;
CREATE TRIGGER trigger_update_loan_status_on_transaction
    AFTER INSERT ON public.loan_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_loan_balance_trigger();