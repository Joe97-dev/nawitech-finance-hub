-- Fix existing 30-day loans that were incorrectly marked as "in arrears" before their term expired
UPDATE loans 
SET status = 'active' 
WHERE term_months <= 1 
  AND status = 'in arrears' 
  AND type != 'client_fee_account'
  AND (CURRENT_DATE - date) <= (COALESCE(term_months, 1) * 30);