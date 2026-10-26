CREATE OR REPLACE FUNCTION public.guard_loan_activation_requires_fee()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  total_fee NUMERIC;
BEGIN
  IF OLD.status = 'pending' AND NEW.status = 'active' AND NEW.type <> 'client_fee_account' THEN
    SELECT COALESCE(SUM(amount), 0) INTO total_fee
    FROM public.loan_transactions
    WHERE loan_id = NEW.id
      AND transaction_type = 'fee'
      AND COALESCE(is_reverted, false) = false
      AND COALESCE(notes, '') ILIKE 'processing_fee%';

    IF total_fee < 400 THEN
      -- Keep the loan pending until the full KES 400 processing fee is posted
      NEW.status := 'pending';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.guard_loan_activation_requires_fee() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_loan_activation_requires_fee ON public.loans;
CREATE TRIGGER trg_guard_loan_activation_requires_fee
BEFORE UPDATE OF status ON public.loans
FOR EACH ROW EXECUTE FUNCTION public.guard_loan_activation_requires_fee();