
-- ========================================
-- MULTI-TENANT RLS POLICIES
-- ========================================

-- Drop old policies
DROP POLICY IF EXISTS "Admins can manage all clients" ON public.clients;
DROP POLICY IF EXISTS "Data entry can insert clients" ON public.clients;
DROP POLICY IF EXISTS "Users can view clients based on role" ON public.clients;
DROP POLICY IF EXISTS "Admins can manage all loans" ON public.loans;
DROP POLICY IF EXISTS "Users can view loans based on role" ON public.loans;
DROP POLICY IF EXISTS "Admins can manage all transactions" ON public.loan_transactions;
DROP POLICY IF EXISTS "Data entry can view transactions" ON public.loan_transactions;
DROP POLICY IF EXISTS "Loan officers can view transactions" ON public.loan_transactions;
DROP POLICY IF EXISTS "Admins can manage loan schedules" ON public.loan_schedule;
DROP POLICY IF EXISTS "Data entry can view loan schedules" ON public.loan_schedule;
DROP POLICY IF EXISTS "Admins can manage loan documents" ON public.loan_documents;
DROP POLICY IF EXISTS "All authenticated users can view loan documents" ON public.loan_documents;
DROP POLICY IF EXISTS "Authenticated users can view client accounts" ON public.client_accounts;
DROP POLICY IF EXISTS "Loan officers and admins can manage client accounts" ON public.client_accounts;
DROP POLICY IF EXISTS "Authenticated users can view account transactions" ON public.client_account_transactions;
DROP POLICY IF EXISTS "Loan officers and admins can manage account transactions" ON public.client_account_transactions;
DROP POLICY IF EXISTS "Data entry can view and create client documents" ON public.client_documents;
DROP POLICY IF EXISTS "Data entry can view and create client referees" ON public.client_referees;
DROP POLICY IF EXISTS "Admins can manage all branches" ON public.branches;
DROP POLICY IF EXISTS "Data entry can view branches" ON public.branches;
DROP POLICY IF EXISTS "Loan officers can view branches" ON public.branches;
DROP POLICY IF EXISTS "Admins can manage loan products" ON public.loan_products;
DROP POLICY IF EXISTS "All authenticated users can view active loan products" ON public.loan_products;
DROP POLICY IF EXISTS "Admins can manage portfolio analysis" ON public.loan_portfolio_analysis;
DROP POLICY IF EXISTS "Loan officers can view portfolio analysis" ON public.loan_portfolio_analysis;
DROP POLICY IF EXISTS "Admins can manage migration jobs" ON public.migration_jobs;

-- Organizations
CREATE POLICY "Users can view own organization"
ON public.organizations FOR SELECT TO authenticated
USING (id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can manage organizations"
ON public.organizations FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::user_role));

-- Clients
CREATE POLICY "Org users can view clients"
ON public.clients FOR SELECT TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'data_entry'::user_role) OR (has_role(auth.uid(), 'loan_officer'::user_role) AND loan_officer_id = auth.uid())));

CREATE POLICY "Org users can insert clients"
ON public.clients FOR INSERT TO authenticated
WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role)));

CREATE POLICY "Org admins can update clients"
ON public.clients FOR UPDATE TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Org admins can delete clients"
ON public.clients FOR DELETE TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'admin'::user_role));

-- Loans
CREATE POLICY "Org users can view loans"
ON public.loans FOR SELECT TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'data_entry'::user_role) OR (has_role(auth.uid(), 'loan_officer'::user_role) AND loan_officer_id = auth.uid())));

CREATE POLICY "Org admins can manage loans"
ON public.loans FOR ALL TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'admin'::user_role));

-- Loan Transactions
CREATE POLICY "Org users can view loan transactions"
ON public.loan_transactions FOR SELECT TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role)));

CREATE POLICY "Org admins can manage loan transactions"
ON public.loan_transactions FOR ALL TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'admin'::user_role));

-- Loan Schedule
CREATE POLICY "Org users can view loan schedule"
ON public.loan_schedule FOR SELECT TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role)));

CREATE POLICY "Org admins can manage loan schedule"
ON public.loan_schedule FOR ALL TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'admin'::user_role));

-- Loan Documents
CREATE POLICY "Org users can view loan documents"
ON public.loan_documents FOR SELECT TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Org admins can manage loan documents"
ON public.loan_documents FOR ALL TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'admin'::user_role));

-- Client Accounts
CREATE POLICY "Org users can view client accounts"
ON public.client_accounts FOR SELECT TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role)));

CREATE POLICY "Org admins and officers can manage client accounts"
ON public.client_accounts FOR ALL TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role)));

-- Client Account Transactions
CREATE POLICY "Org users can view account transactions"
ON public.client_account_transactions FOR SELECT TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role)));

CREATE POLICY "Org officers and admins can manage account transactions"
ON public.client_account_transactions FOR ALL TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role)));

-- Client Documents
CREATE POLICY "Org users can manage client documents"
ON public.client_documents FOR ALL TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role)))
WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role)));

-- Client Referees
CREATE POLICY "Org users can manage client referees"
ON public.client_referees FOR ALL TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role)))
WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role)));

-- Branches
CREATE POLICY "Org users can view branches"
ON public.branches FOR SELECT TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role)));

CREATE POLICY "Org admins can manage branches"
ON public.branches FOR ALL TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'admin'::user_role));

-- Loan Products
CREATE POLICY "Org users can view active loan products"
ON public.loan_products FOR SELECT TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND (status = 'active' OR has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role)));

CREATE POLICY "Org admins can manage loan products"
ON public.loan_products FOR ALL TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'admin'::user_role));

-- Loan Portfolio Analysis
CREATE POLICY "Org users can view portfolio analysis"
ON public.loan_portfolio_analysis FOR SELECT TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND (has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role)));

CREATE POLICY "Org admins can manage portfolio analysis"
ON public.loan_portfolio_analysis FOR ALL TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'admin'::user_role));

-- Migration Jobs
CREATE POLICY "Org admins can manage migration jobs"
ON public.migration_jobs FOR ALL TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'admin'::user_role));
