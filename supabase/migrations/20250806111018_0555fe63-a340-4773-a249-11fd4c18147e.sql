-- Create an enum for approval status including deactivated
DO $$ BEGIN
    -- Add 'deactivated' to the approval_status enum if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'deactivated' AND enumtypid = 'approval_status'::regtype) THEN
        ALTER TYPE approval_status ADD VALUE 'deactivated';
    END IF;
END $$;

-- Create function to deactivate user access
CREATE OR REPLACE FUNCTION public.deactivate_user(target_user_id uuid, reason text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check if the current user is an admin
  IF NOT has_role(auth.uid(), 'admin'::user_role) THEN
    RAISE EXCEPTION 'Only admins can deactivate users';
  END IF;
  
  -- Update approval status to deactivated
  UPDATE public.user_approvals 
  SET 
    status = 'deactivated',
    approved_by = auth.uid(),
    approved_at = now(),
    rejection_reason = reason,
    updated_at = now()
  WHERE user_id = target_user_id;
  
  -- Remove user from user_roles to revoke all permissions
  DELETE FROM public.user_roles 
  WHERE user_id = target_user_id;
END;
$$;