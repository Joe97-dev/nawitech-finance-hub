-- Real trigger regression tests. All fixtures are rolled back inside the block.
DO $$
DECLARE
  org_id uuid := gen_random_uuid();
  other_org_id uuid := gen_random_uuid();
  client_id uuid := gen_random_uuid();
  duplicate_id uuid := gen_random_uuid();
  fee_account_id uuid := gen_random_uuid();
  fee_id uuid := gen_random_uuid();
  blocked boolean;
BEGIN
  BEGIN
    INSERT INTO public.organizations (id, name, subdomain)
    VALUES (org_id, 'Activation test', 'test-' || org_id::text),
           (other_org_id, 'Other activation test', 'test-' || other_org_id::text);

    -- Rule: a new client cannot be inserted as active without KES 100.
    blocked := false;
    BEGIN
      INSERT INTO public.clients (first_name, last_name, phone, id_number, status, organization_id)
      VALUES ('FeeTest', client_id::text, '0700000000', 'test-' || gen_random_uuid()::text, 'active', org_id);
    EXCEPTION WHEN check_violation THEN blocked := true;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'FAIL: active insert without registration fee'; END IF;

    INSERT INTO public.clients (id, first_name, last_name, phone, id_number, status, organization_id)
    VALUES (client_id, 'FeeTest', client_id::text, '0700000000', 'test-' || client_id::text, 'pending', org_id);

    -- Rule: zero posted registration fees must block activation.
    blocked := false;
    BEGIN
      UPDATE public.clients SET status = 'active' WHERE id = client_id AND organization_id = org_id;
    EXCEPTION WHEN check_violation THEN blocked := true;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'FAIL: zero fee activated client'; END IF;

    -- Rule: changing pending to inactive must not bypass the registration requirement.
    UPDATE public.clients SET status = 'inactive' WHERE id = client_id AND organization_id = org_id;
    blocked := false;
    BEGIN
      UPDATE public.clients SET status = 'active' WHERE id = client_id AND organization_id = org_id;
    EXCEPTION WHEN check_violation THEN blocked := true;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'FAIL: inactive status bypassed registration fee'; END IF;

    INSERT INTO public.loans (id, client, type, amount, balance, status, date, organization_id)
    VALUES (fee_account_id, '  FeeTest   ' || client_id::text, 'client_fee_account', 0, 0, 'fee_account', CURRENT_DATE, org_id);
    INSERT INTO public.loan_transactions (id, loan_id, amount, transaction_type, notes, organization_id)
    VALUES (fee_id, fee_account_id, 99, 'fee', 'registration_fee: test', org_id);

    -- Rule: KES 99 is insufficient, even on a normalized legacy-name fee account.
    blocked := false;
    BEGIN
      UPDATE public.clients SET status = 'active' WHERE id = client_id AND organization_id = org_id;
    EXCEPTION WHEN check_violation THEN blocked := true;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'FAIL: KES 99 activated client'; END IF;

    -- Rule: the full KES 100 registration fee allows activation.
    UPDATE public.loan_transactions SET amount = 100 WHERE id = fee_id AND organization_id = org_id;
    UPDATE public.clients SET status = 'active' WHERE id = client_id AND organization_id = org_id;
    IF (SELECT status FROM public.clients WHERE id = client_id) <> 'active' THEN
      RAISE EXCEPTION 'FAIL: KES 100 did not allow activation';
    END IF;

    -- Rule: reversed fees cannot authorize a later activation.
    UPDATE public.clients SET status = 'pending' WHERE id = client_id AND organization_id = org_id;
    UPDATE public.loan_transactions SET is_reverted = true WHERE id = fee_id AND organization_id = org_id;
    blocked := false;
    BEGIN
      UPDATE public.clients SET status = 'active' WHERE id = client_id AND organization_id = org_id;
    EXCEPTION WHEN check_violation THEN blocked := true;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'FAIL: reversed fee authorized activation'; END IF;

    -- Rule: another organization's transactions cannot authorize activation.
    UPDATE public.loan_transactions SET is_reverted = false, organization_id = other_org_id WHERE id = fee_id;
    blocked := false;
    BEGIN
      UPDATE public.clients SET status = 'active' WHERE id = client_id AND organization_id = org_id;
    EXCEPTION WHEN check_violation THEN blocked := true;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'FAIL: foreign organization fee authorized activation'; END IF;
    UPDATE public.loan_transactions SET organization_id = org_id WHERE id = fee_id;

    -- Rule: ambiguous names must not let one client use another client's fees.
    INSERT INTO public.clients (id, first_name, last_name, phone, id_number, status, organization_id)
    VALUES (duplicate_id, 'FeeTest', client_id::text, '0700000001', 'test-' || duplicate_id::text, 'pending', org_id);
    blocked := false;
    BEGIN
      UPDATE public.clients SET status = 'active' WHERE id = duplicate_id AND organization_id = org_id;
    EXCEPTION WHEN check_violation THEN blocked := true;
    END;
    IF NOT blocked THEN RAISE EXCEPTION 'FAIL: duplicate name borrowed registration fee'; END IF;

    -- Rule: UUID-linked fees work even when names are duplicated.
    UPDATE public.loans SET client = client_id::text WHERE id = fee_account_id AND organization_id = org_id;
    UPDATE public.clients SET status = 'active' WHERE id = client_id AND organization_id = org_id;
    IF (SELECT status FROM public.clients WHERE id = client_id) <> 'active' THEN
      RAISE EXCEPTION 'FAIL: UUID fee did not allow activation';
    END IF;
    RAISE EXCEPTION 'All activation tests passed; rolling fixtures back' USING ERRCODE = 'ZT001';
  EXCEPTION WHEN SQLSTATE 'ZT001' THEN
    RAISE NOTICE 'PASS: all client registration activation tests; fixtures rolled back';
  END;
END;
$$;