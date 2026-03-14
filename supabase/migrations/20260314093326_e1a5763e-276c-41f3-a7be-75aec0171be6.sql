
-- Regenerate schedule for LN00091 with correct 1-month term
SELECT generate_loan_schedule(
  '3307dd95-c5ad-46a9-977d-aedf7515949f'::uuid, 
  10000, 25, 1, 'weekly', '2026-02-16'::date
);
