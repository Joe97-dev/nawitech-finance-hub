
-- Drop the existing permissive SELECT policy that gives all roles full org access
DROP POLICY "Org users can view loan transactions" ON public.loan_transactions;

-- Admins and data_entry can view all org transactions
CREATE POLICY "Org admins and data_entry can view loan transactions"
ON public.loan_transactions
FOR SELECT
TO authenticated
USING (
  (organization_id = get_user_organization_id(auth.uid()))
  AND (
    has_role(auth.uid(), 'admin'::user_role)
    OR has_role(auth.uid(), 'data_entry'::user_role)
  )
);

-- Loan officers can only view transactions on loans they manage
CREATE POLICY "Loan officers can view own loan transactions"
ON public.loan_transactions
FOR SELECT
TO authenticated
USING (
  (organization_id = get_user_organization_id(auth.uid()))
  AND has_role(auth.uid(), 'loan_officer'::user_role)
  AND loan_id IN (
    SELECT id FROM public.loans WHERE loan_officer_id = auth.uid()
  )
);
