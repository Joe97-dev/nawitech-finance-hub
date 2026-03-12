
CREATE OR REPLACE FUNCTION public.approve_user(target_user_id uuid, assigned_role user_role DEFAULT 'data_entry'::user_role, assigned_branch_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  admin_org_id uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::user_role) THEN
    RAISE EXCEPTION 'Only admins can approve users';
  END IF;
  
  -- Get the admin's organization_id
  SELECT organization_id INTO admin_org_id FROM public.profiles WHERE id = auth.uid();
  
  UPDATE public.user_approvals 
  SET status = 'approved', approved_by = auth.uid(), approved_at = now(), updated_at = now()
  WHERE user_id = target_user_id;
  
  UPDATE auth.users SET email_confirmed_at = now() WHERE id = target_user_id;
  
  INSERT INTO public.user_roles (user_id, role, organization_id)
  VALUES (target_user_id, assigned_role, admin_org_id)
  ON CONFLICT (user_id) DO UPDATE SET role = assigned_role, organization_id = admin_org_id;

  -- Set organization_id (and optionally branch) on the user's profile
  UPDATE public.profiles 
  SET organization_id = admin_org_id,
      branch_id = COALESCE(assigned_branch_id, branch_id),
      updated_at = now() 
  WHERE id = target_user_id;
END;
$function$;
