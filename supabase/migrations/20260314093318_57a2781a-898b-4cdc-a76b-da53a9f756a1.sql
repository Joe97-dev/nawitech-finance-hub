
-- Fix LN00091: update term_months to 1 (30 days = 1 month) and recalculate balance
UPDATE loans SET term_months = 1, balance = 12500 WHERE id = '3307dd95-c5ad-46a9-977d-aedf7515949f';

-- Delete old schedule and regenerate
DELETE FROM loan_schedule WHERE loan_id = '3307dd95-c5ad-46a9-977d-aedf7515949f';
