UPDATE public.loans
SET balance = public.calculate_outstanding_balance('a37ce1a7-825e-45bb-b4ec-9272429f3f8c'::uuid),
    updated_at = now()
WHERE id = 'a37ce1a7-825e-45bb-b4ec-9272429f3f8c'::uuid;

SELECT public.update_loan_status('a37ce1a7-825e-45bb-b4ec-9272429f3f8c'::uuid);