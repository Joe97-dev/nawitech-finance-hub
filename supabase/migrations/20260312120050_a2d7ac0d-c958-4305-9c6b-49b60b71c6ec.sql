
-- Delete loan transactions
DELETE FROM loan_transactions WHERE loan_id IN ('85faff61-4edc-43d9-a965-a0c27dc444af', '04e76c3a-4f20-458e-b107-7cf1c53de7d3');

-- Delete loan schedule
DELETE FROM loan_schedule WHERE loan_id IN ('85faff61-4edc-43d9-a965-a0c27dc444af', '04e76c3a-4f20-458e-b107-7cf1c53de7d3');

-- Delete loans
DELETE FROM loans WHERE id IN ('85faff61-4edc-43d9-a965-a0c27dc444af', '04e76c3a-4f20-458e-b107-7cf1c53de7d3');

-- Delete client
DELETE FROM clients WHERE id = '4e89d277-089e-43f4-b361-b7e8907bee4f';
