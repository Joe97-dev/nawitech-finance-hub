CREATE OR REPLACE FUNCTION public.guard_client_activation_requires_fee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_fee numeric;
  normalized_name text;
  name_is_unique boolean;
BEGIN
  IF NEW.status IS DISTINCT FROM 'active' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'active' THEN
      RETURN NEW;
    END IF;
  END IF;

  normalized_name := lower(regexp_replace(btrim(NEW.first_name || ' ' || NEW.last_name), '\s+', ' ', 'g'));
  SELECT NOT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.organization_id = NEW.organization_id
      AND c.id <> NEW.id
      AND lower(regexp_replace(btrim(c.first_name || ' ' || c.last_name), '\s+', ' ', 'g')) = normalized_name
  ) INTO name_is_unique;

  SELECT COALESCE(SUM(t.amount), 0) INTO total_fee
  FROM public.loans l
  JOIN public.loan_transactions t ON t.loan_id = l.id
  WHERE l.organization_id = NEW.organization_id
    AND t.organization_id = NEW.organization_id
    AND l.type = 'client_fee_account'
    AND (l.client = NEW.id::text OR (
      name_is_unique
      AND lower(regexp_replace(btrim(l.client), '\s+', ' ', 'g')) = normalized_name
    ))
    AND t.transaction_type = 'fee'
    AND COALESCE(t.is_reverted, false) = false
    AND COALESCE(t.notes, '') ILIKE 'registration_fee%';

  IF total_fee < 100 THEN
    RAISE EXCEPTION 'Client remains pending: post the full KES 100 registration fee before activation. Posted: KES %.', total_fee
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_client_activation_requires_fee() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_guard_client_activation_requires_fee
BEFORE INSERT OR UPDATE OF status ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.guard_client_activation_requires_fee();