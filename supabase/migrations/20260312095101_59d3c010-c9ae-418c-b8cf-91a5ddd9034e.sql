
-- Clear all transactional/dependent data first, then parent tables
DELETE FROM public.client_account_transactions;
DELETE FROM public.loan_transactions;
DELETE FROM public.loan_schedule;
DELETE FROM public.loan_documents;
DELETE FROM public.client_documents;
DELETE FROM public.client_referees;
DELETE FROM public.client_accounts;
DELETE FROM public.loan_portfolio_analysis;
DELETE FROM public.loans;
DELETE FROM public.clients;

-- Reset sequences to start fresh at 1
ALTER SEQUENCE public.client_number_seq RESTART WITH 1;
ALTER SEQUENCE public.loan_number_seq RESTART WITH 1;
