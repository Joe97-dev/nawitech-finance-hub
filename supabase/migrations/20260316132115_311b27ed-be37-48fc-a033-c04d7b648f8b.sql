-- Delete loan schedules for test loans
DELETE FROM public.loan_schedule WHERE loan_id IN ('3307dd95-c5ad-46a9-977d-aedf7515949f','ff4d0151-825b-4162-93e3-0e3bd048e4e4','b2c0b753-affb-46e1-81e0-b6c8664b74ac');

-- Delete loan transactions for test loans
DELETE FROM public.loan_transactions WHERE loan_id IN ('3307dd95-c5ad-46a9-977d-aedf7515949f','ff4d0151-825b-4162-93e3-0e3bd048e4e4','b2c0b753-affb-46e1-81e0-b6c8664b74ac');

-- Delete client account transactions for test client
DELETE FROM public.client_account_transactions WHERE client_account_id IN (SELECT id FROM public.client_accounts WHERE client_id = 'd5968ca1-b379-42d4-9ad8-dbcbf1744c70');

-- Delete client account for test client
DELETE FROM public.client_accounts WHERE client_id = 'd5968ca1-b379-42d4-9ad8-dbcbf1744c70';

-- Delete the test loans
DELETE FROM public.loans WHERE id IN ('3307dd95-c5ad-46a9-977d-aedf7515949f','ff4d0151-825b-4162-93e3-0e3bd048e4e4','b2c0b753-affb-46e1-81e0-b6c8664b74ac');

-- Delete the test client
DELETE FROM public.clients WHERE id = 'd5968ca1-b379-42d4-9ad8-dbcbf1744c70';