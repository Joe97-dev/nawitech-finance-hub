
-- The trigger already handled the balance update, so the explicit UPDATE double-deducted.
-- Restore balances to match the new_balance from the corrective transactions.
UPDATE client_accounts ca
SET balance = cat.new_balance, updated_at = now()
FROM client_account_transactions cat
WHERE cat.client_account_id = ca.id
AND cat.notes = 'Corrective fee withdrawal: processing fees previously not deducted from draw down account';
