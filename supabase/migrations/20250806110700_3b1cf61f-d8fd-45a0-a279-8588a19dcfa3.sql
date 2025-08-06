-- Remove loan officers' ability to insert transactions (make payments)
-- Drop the existing policy that allows loan officers to insert transactions
DROP POLICY IF EXISTS "Loan officers can insert transactions" ON public.loan_transactions;

-- Update the policy to only allow viewing for loan officers (remove create ability)
DROP POLICY IF EXISTS "Loan officers can view and create transactions" ON public.loan_transactions;

-- Create new policy for loan officers - VIEW ONLY
CREATE POLICY "Loan officers can view transactions" 
ON public.loan_transactions 
FOR SELECT 
USING (
  has_role(auth.uid(), 'loan_officer'::user_role) OR 
  has_role(auth.uid(), 'admin'::user_role)
);

-- Keep admin's full access
-- (The existing "Admins can manage all transactions" policy remains unchanged)

-- Keep data entry view access
-- (The existing "Data entry can view transactions" policy remains unchanged)