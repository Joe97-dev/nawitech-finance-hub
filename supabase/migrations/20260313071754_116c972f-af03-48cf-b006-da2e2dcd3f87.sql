CREATE POLICY "Org loan officers can insert loans"
ON public.loans
FOR INSERT
TO authenticated
WITH CHECK (
  (organization_id = get_user_organization_id(auth.uid()))
  AND has_role(auth.uid(), 'loan_officer'::user_role)
);