
-- Corrective withdrawal transactions for fees paid via draw_down_account that were never deducted
-- This inserts a withdrawal record and updates the account balance for each affected client

WITH affected AS (
  SELECT ca.id as account_id, ca.balance, ca.organization_id,
    (SELECT COALESCE(SUM(lt.amount), 0) FROM loan_transactions lt 
     JOIN loans l ON lt.loan_id = l.id 
     WHERE l.client = (c.first_name || ' ' || c.last_name) 
     AND lt.transaction_type = 'fee' 
     AND lt.payment_method = 'draw_down_account'
     AND lt.is_reverted = false) as fees_to_deduct
  FROM clients c
  JOIN client_accounts ca ON ca.client_id = c.id
  WHERE (SELECT COALESCE(SUM(lt.amount), 0) FROM loan_transactions lt 
     JOIN loans l ON lt.loan_id = l.id 
     WHERE l.client = (c.first_name || ' ' || c.last_name) 
     AND lt.transaction_type = 'fee' 
     AND lt.payment_method = 'draw_down_account'
     AND lt.is_reverted = false) > 0
  AND NOT EXISTS (
    SELECT 1 FROM client_account_transactions cat 
    WHERE cat.client_account_id = ca.id 
    AND cat.notes LIKE 'Corrective fee withdrawal%'
  )
)
INSERT INTO client_account_transactions (client_account_id, amount, transaction_type, notes, previous_balance, new_balance, organization_id)
SELECT account_id, -fees_to_deduct, 'withdrawal', 
  'Corrective fee withdrawal: processing fees previously not deducted from draw down account',
  balance, balance - fees_to_deduct, organization_id
FROM affected;

-- Now update the actual balances
UPDATE client_accounts ca
SET balance = ca.balance - sub.fees_to_deduct, updated_at = now()
FROM (
  SELECT ca2.id as account_id,
    (SELECT COALESCE(SUM(lt.amount), 0) FROM loan_transactions lt 
     JOIN loans l ON lt.loan_id = l.id 
     WHERE l.client = (c.first_name || ' ' || c.last_name) 
     AND lt.transaction_type = 'fee' 
     AND lt.payment_method = 'draw_down_account'
     AND lt.is_reverted = false) as fees_to_deduct
  FROM clients c
  JOIN client_accounts ca2 ON ca2.client_id = c.id
  WHERE (SELECT COALESCE(SUM(lt.amount), 0) FROM loan_transactions lt 
     JOIN loans l ON lt.loan_id = l.id 
     WHERE l.client = (c.first_name || ' ' || c.last_name) 
     AND lt.transaction_type = 'fee' 
     AND lt.payment_method = 'draw_down_account'
     AND lt.is_reverted = false) > 0
) sub
WHERE ca.id = sub.account_id;
