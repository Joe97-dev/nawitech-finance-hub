INSERT INTO client_account_transactions (
  client_account_id, transaction_type, amount, previous_balance, new_balance, 
  organization_id, related_loan_id, notes
) VALUES (
  '0289f5ee-9ec2-49dd-b7a5-ea4499640f81', 'deposit', 400, 0, 400,
  'a0000000-0000-0000-0000-000000000001', 'f2a92a66-c783-4603-9278-a85751eca3e9',
  'Excess M-Pesa payment - UCGI59JCS7 (400 surplus backfill)'
);

UPDATE client_accounts SET balance = 400 WHERE id = '0289f5ee-9ec2-49dd-b7a5-ea4499640f81';