
-- Fix LN00033 schedule: allocate 12,601 in repayments to schedule items
-- Item 1 (1045e621): total_due=12500, should be fully paid
UPDATE public.loan_schedule 
SET amount_paid = 12500, status = 'paid' 
WHERE id = '1045e621-ea2b-41fb-ab5c-697652d09116';

-- Item 2 (b7f3d17f): total_due=100 (penalty), should be fully paid  
UPDATE public.loan_schedule 
SET amount_paid = 100, status = 'paid' 
WHERE id = 'b7f3d17f-f7b7-485d-a034-397a05ef7c20';

-- Update loan balance: total_due (12600) - amount_paid (12600) = 0
UPDATE public.loans SET balance = 0, status = 'closed' WHERE id = '23da2864-5936-4e7f-b021-025b60350c05';
