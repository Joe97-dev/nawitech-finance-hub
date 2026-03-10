
INSERT INTO client_account_transactions (
  client_account_id, amount, transaction_type, related_loan_id, 
  notes, created_by, previous_balance, new_balance, organization_id
)
SELECT 
  '64ff5153-0ed3-493c-a419-c8e2fb0f9677',
  -30000,
  'withdrawal',
  '0608f06d-b939-4c05-b753-9c6bbefb209e',
  'Correction: excess deposit reversed (payment was previously reverted)',
  (SELECT created_by FROM client_account_transactions WHERE id = '364d86be-1850-44fc-b033-3c2c14c28a4f'),
  30000,
  0,
  'a0000000-0000-0000-0000-000000000001'
WHERE NOT EXISTS (
  SELECT 1 FROM client_account_transactions 
  WHERE client_account_id = '64ff5153-0ed3-493c-a419-c8e2fb0f9677'
  AND transaction_type = 'withdrawal'
  AND related_loan_id = '0608f06d-b939-4c05-b753-9c6bbefb209e'
)
