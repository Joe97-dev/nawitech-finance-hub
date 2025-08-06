-- Update the approve_user function to accept a role parameter
CREATE OR REPLACE FUNCTION public.approve_user(target_user_id uuid, assigned_role user_role DEFAULT 'data_entry'::user_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if the current user is an admin
  IF NOT has_role(auth.uid(), 'admin'::user_role) THEN
    RAISE EXCEPTION 'Only admins can approve users';
  END IF;
  
  -- Update approval status
  UPDATE public.user_approvals 
  SET 
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = now(),
    updated_at = now()
  WHERE user_id = target_user_id;
  
  -- Confirm the user's email in the auth.users table
  UPDATE auth.users 
  SET email_confirmed_at = now()
  WHERE id = target_user_id;
  
  -- Assign the specified role to approved user
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, assigned_role)
  ON CONFLICT (user_id) DO UPDATE SET role = assigned_role;
END;
$$;