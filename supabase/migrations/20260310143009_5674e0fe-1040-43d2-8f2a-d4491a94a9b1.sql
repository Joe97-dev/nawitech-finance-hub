
-- Delete all data from all tables (CASCADE handles foreign key dependencies)
TRUNCATE TABLE 
  public.client_account_transactions,
  public.client_accounts,
  public.client_documents,
  public.client_referees,
  public.loan_documents,
  public.loan_transactions,
  public.loan_schedule,
  public.loan_portfolio_analysis,
  public.loans,
  public.clients,
  public.loan_products,
  public.branches,
  public.migration_jobs,
  public.user_approvals,
  public.user_roles,
  public.profiles,
  public.organizations
CASCADE;
