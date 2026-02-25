
-- Delete existing schedule for LN00007 and regenerate with correct calculations
DELETE FROM public.loan_schedule WHERE loan_id = '764198a4-10e9-456a-b5d9-bccda750421d';

-- Regenerate: 8000 principal, 20% monthly rate, 2 months, weekly, start 2026-02-24
-- Total interest = 8000 * 0.20 * 2 = 3200
-- 8 weekly installments: principal = 1000, interest = 400, total = 1400
INSERT INTO public.loan_schedule (loan_id, due_date, principal_due, interest_due, total_due, amount_paid, status)
VALUES
  ('764198a4-10e9-456a-b5d9-bccda750421d', '2026-03-03', 1000, 400, 1400, 0, 'pending'),
  ('764198a4-10e9-456a-b5d9-bccda750421d', '2026-03-10', 1000, 400, 1400, 0, 'pending'),
  ('764198a4-10e9-456a-b5d9-bccda750421d', '2026-03-17', 1000, 400, 1400, 0, 'pending'),
  ('764198a4-10e9-456a-b5d9-bccda750421d', '2026-03-24', 1000, 400, 1400, 0, 'pending'),
  ('764198a4-10e9-456a-b5d9-bccda750421d', '2026-03-31', 1000, 400, 1400, 0, 'pending'),
  ('764198a4-10e9-456a-b5d9-bccda750421d', '2026-04-07', 1000, 400, 1400, 0, 'pending'),
  ('764198a4-10e9-456a-b5d9-bccda750421d', '2026-04-14', 1000, 400, 1400, 0, 'pending'),
  ('764198a4-10e9-456a-b5d9-bccda750421d', '2026-04-21', 1000, 400, 1400, 0, 'pending');

-- Update loan balance to reflect correct total
UPDATE public.loans SET balance = 11200 WHERE id = '764198a4-10e9-456a-b5d9-bccda750421d';
