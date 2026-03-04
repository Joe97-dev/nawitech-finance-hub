-- Add branch_id to profiles for officer-branch assignment
ALTER TABLE public.profiles ADD COLUMN branch_id uuid REFERENCES public.branches(id);

-- Add loan_officer_id to clients
ALTER TABLE public.clients ADD COLUMN loan_officer_id uuid;

-- Add loan_officer_id to loans
ALTER TABLE public.loans ADD COLUMN loan_officer_id uuid;

-- Update approve_user function to accept branch_id
CREATE OR REPLACE FUNCTION public.approve_user(target_user_id uuid, assigned_role user_role DEFAULT 'data_entry'::user_role, assigned_branch_id uuid DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::user_role) THEN
    RAISE EXCEPTION 'Only admins can approve users';
  END IF;
  
  UPDATE public.user_approvals 
  SET status = 'approved', approved_by = auth.uid(), approved_at = now(), updated_at = now()
  WHERE user_id = target_user_id;
  
  UPDATE auth.users SET email_confirmed_at = now() WHERE id = target_user_id;
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, assigned_role)
  ON CONFLICT (user_id) DO UPDATE SET role = assigned_role;

  IF assigned_branch_id IS NOT NULL THEN
    UPDATE public.profiles SET branch_id = assigned_branch_id, updated_at = now() WHERE id = target_user_id;
  END IF;
END;
$$;

-- Helper function to get officer's branch
CREATE OR REPLACE FUNCTION public.get_user_branch_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id FROM public.profiles WHERE id = _user_id;
$$;

-- Update RLS: Loan officers can only see clients assigned to them
DROP POLICY IF EXISTS "Data entry can view and create clients" ON public.clients;
CREATE POLICY "Users can view clients based on role" ON public.clients
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'data_entry'::user_role)
  OR (has_role(auth.uid(), 'loan_officer'::user_role) AND loan_officer_id = auth.uid())
);

-- Update RLS: Loan officers can only see loans assigned to them
DROP POLICY IF EXISTS "Data entry can view loans" ON public.loans;
CREATE POLICY "Users can view loans based on role" ON public.loans
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::user_role)
  OR has_role(auth.uid(), 'data_entry'::user_role)
  OR (has_role(auth.uid(), 'loan_officer'::user_role) AND loan_officer_id = auth.uid())
);

-- Drop duplicate policies
DROP POLICY IF EXISTS "Loan officers can view and create loans" ON public.loans;
DROP POLICY IF EXISTS "Loan officers can manage clients" ON public.clients;