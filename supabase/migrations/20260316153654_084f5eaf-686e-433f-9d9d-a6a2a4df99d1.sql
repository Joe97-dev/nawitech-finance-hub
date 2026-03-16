
-- Allow loan officers to update their assigned clients
CREATE POLICY "Org loan officers can update their clients"
ON public.clients
FOR UPDATE
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'loan_officer'::user_role)
  AND loan_officer_id = auth.uid()
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'loan_officer'::user_role)
  AND loan_officer_id = auth.uid()
);
