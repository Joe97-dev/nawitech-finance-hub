
-- Allow loan officers to insert loan transactions (fees and repayments)
CREATE POLICY "Loan officers can insert transactions"
ON public.loan_transactions
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role));
