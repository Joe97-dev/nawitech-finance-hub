-- Clean database for production use
-- This removes all test/dummy data while preserving schema and user accounts

-- Delete loan-related data first (respecting foreign key constraints)
DELETE FROM public.loan_documents;
DELETE FROM public.loan_transactions;
DELETE FROM public.loan_schedule;
DELETE FROM public.loans;

-- Delete client and branch data
DELETE FROM public.clients;
DELETE FROM public.branches;

-- Delete analysis and migration data
DELETE FROM public.loan_portfolio_analysis;
DELETE FROM public.migration_jobs;

-- Reset sequences to start fresh
SELECT setval('client_number_seq', 1, false);
SELECT setval('loan_number_seq', 1, false);

-- Note: Keeping user_roles, user_approvals, and profiles as they're tied to actual user accounts
-- Note: Keeping loan_products as they represent system configuration