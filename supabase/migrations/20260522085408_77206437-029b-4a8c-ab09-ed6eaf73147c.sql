
-- Enforce processing fee total cap of 400 per loan and auto-manage activation
CREATE OR REPLACE FUNCTION public.enforce_processing_fee_cap()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_total NUMERIC;
BEGIN
  IF NEW.transaction_type = 'fee'
     AND COALESCE(NEW.is_reverted, false) = false
     AND COALESCE(NEW.notes, '') ILIKE 'processing_fee%' THEN
    SELECT COALESCE(SUM(amount), 0) INTO current_total
    FROM public.loan_transactions
    WHERE loan_id = NEW.loan_id
      AND transaction_type = 'fee'
      AND COALESCE(is_reverted, false) = false
      AND COALESCE(notes, '') ILIKE 'processing_fee%'
      AND id <> NEW.id;

    IF current_total + NEW.amount > 400 THEN
      RAISE EXCEPTION 'Processing fee total for this loan would exceed KES 400. Already posted: KES %, attempted: KES %, allowed remaining: KES %',
        current_total, NEW.amount, GREATEST(400 - current_total, 0);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_processing_fee_cap ON public.loan_transactions;
CREATE TRIGGER trg_enforce_processing_fee_cap
BEFORE INSERT OR UPDATE ON public.loan_transactions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_processing_fee_cap();

-- Auto-manage loan activation based on cumulative processing fee
CREATE OR REPLACE FUNCTION public.sync_loan_activation_from_fees()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan_id UUID;
  total_fee NUMERIC;
  cur_status TEXT;
BEGIN
  v_loan_id := COALESCE(NEW.loan_id, OLD.loan_id);

  SELECT COALESCE(SUM(amount), 0) INTO total_fee
  FROM public.loan_transactions
  WHERE loan_id = v_loan_id
    AND transaction_type = 'fee'
    AND COALESCE(is_reverted, false) = false
    AND COALESCE(notes, '') ILIKE 'processing_fee%';

  SELECT status INTO cur_status FROM public.loans WHERE id = v_loan_id;

  IF total_fee >= 400 AND cur_status = 'pending' THEN
    UPDATE public.loans SET status = 'active' WHERE id = v_loan_id;
  ELSIF total_fee < 400 AND cur_status = 'active' THEN
    UPDATE public.loans SET status = 'pending' WHERE id = v_loan_id;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_loan_activation_from_fees ON public.loan_transactions;
CREATE TRIGGER trg_sync_loan_activation_from_fees
AFTER INSERT OR UPDATE OR DELETE ON public.loan_transactions
FOR EACH ROW
EXECUTE FUNCTION public.sync_loan_activation_from_fees();

-- Fix LN00288: revert to pending since processing fee is only KES 50
UPDATE public.loans
SET status = 'pending'
WHERE loan_number = 'LN00288'
  AND status = 'active';
