
CREATE TRIGGER update_loan_balance_after_insert
AFTER INSERT ON public.loan_schedule
FOR EACH ROW
EXECUTE FUNCTION public.update_loan_balance_trigger();

CREATE TRIGGER update_loan_balance_after_update
AFTER UPDATE ON public.loan_schedule
FOR EACH ROW
EXECUTE FUNCTION public.update_loan_balance_trigger();

CREATE TRIGGER update_loan_balance_after_delete
AFTER DELETE ON public.loan_schedule
FOR EACH ROW
EXECUTE FUNCTION public.update_loan_balance_trigger();
