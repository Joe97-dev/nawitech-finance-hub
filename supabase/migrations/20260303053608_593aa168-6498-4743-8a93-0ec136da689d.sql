
-- Remove loan_officer from loan INSERT policy
DROP POLICY IF EXISTS "Loan officers can insert loans" ON public.loans;

-- Remove loan_officer from loan_transactions INSERT policy
DROP POLICY IF EXISTS "Loan officers can insert transactions" ON public.loan_transactions;

-- Remove loan_officer from loan_schedule ALL policy and replace with SELECT only
DROP POLICY IF EXISTS "Admins and loan officers can manage loan schedules" ON public.loan_schedule;
CREATE POLICY "Admins can manage loan schedules" ON public.loan_schedule
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::user_role));

-- Remove loan_officer from loan_documents INSERT policy
DROP POLICY IF EXISTS "Loan officers can insert loan documents" ON public.loan_documents;

-- Add loan_officer SELECT for loan_schedule (they already have it via data_entry policy)
-- Add loan_officer SELECT for loan_documents (they already have it via the "All authenticated" policy)

-- Also need to handle loans UPDATE - currently only admin ALL policy allows updates
-- loan_officer should NOT be able to update loans anymore (already handled since only admin ALL policy exists)
