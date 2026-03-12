-- Recreate approve_user overloads with unified logic
DROP FUNCTION IF EXISTS public.approve_user(uuid, user_role, uuid);
DROP FUNCTION IF EXISTS public.approve_user(uuid, user_role);
DROP FUNCTION IF EXISTS public.approve_user(uuid);

CREATE FUNCTION public.approve_user(
  target_user_id uuid,
  assigned_role user_role,
  assigned_branch_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  admin_org_id uuid;
  target_email text;
  target_first_name text;
  target_last_name text;
BEGIN
  IF NOT has_role(auth.uid(), 'admin'::user_role) THEN
    RAISE EXCEPTION 'Only admins can approve users';
  END IF;

  SELECT organization_id
  INTO admin_org_id
  FROM public.profiles
  WHERE id = auth.uid();

  IF admin_org_id IS NULL THEN
    RAISE EXCEPTION 'Admin organization is not set';
  END IF;

  SELECT
    email,
    NULLIF(BTRIM(raw_user_meta_data->>'first_name'), ''),
    NULLIF(BTRIM(raw_user_meta_data->>'last_name'), '')
  INTO target_email, target_first_name, target_last_name
  FROM auth.users
  WHERE id = target_user_id;

  UPDATE public.user_approvals
  SET
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = now(),
    updated_at = now()
  WHERE user_id = target_user_id;

  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE id = target_user_id;

  INSERT INTO public.user_roles (user_id, role, organization_id)
  VALUES (target_user_id, assigned_role, admin_org_id)
  ON CONFLICT (user_id)
  DO UPDATE SET
    role = EXCLUDED.role,
    organization_id = EXCLUDED.organization_id,
    updated_at = now();

  INSERT INTO public.profiles (
    id,
    username,
    first_name,
    last_name,
    organization_id,
    branch_id,
    updated_at
  )
  VALUES (
    target_user_id,
    target_email,
    target_first_name,
    target_last_name,
    admin_org_id,
    assigned_branch_id,
    now()
  )
  ON CONFLICT (id)
  DO UPDATE SET
    username = COALESCE(NULLIF(EXCLUDED.username, ''), public.profiles.username),
    first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), public.profiles.first_name),
    last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), public.profiles.last_name),
    organization_id = EXCLUDED.organization_id,
    branch_id = COALESCE(EXCLUDED.branch_id, public.profiles.branch_id),
    updated_at = now();
END;
$function$;

CREATE FUNCTION public.approve_user(target_user_id uuid, assigned_role user_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.approve_user(target_user_id, assigned_role, NULL::uuid);
END;
$function$;

CREATE FUNCTION public.approve_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.approve_user(target_user_id, 'data_entry'::user_role, NULL::uuid);
END;
$function$;

-- Backfill role organization from approver's organization for legacy records
UPDATE public.user_roles ur
SET
  organization_id = ap.organization_id,
  updated_at = now()
FROM public.user_approvals ua
JOIN public.profiles ap ON ap.id = ua.approved_by
WHERE ur.user_id = ua.user_id
  AND ua.status = 'approved'
  AND ur.organization_id IS NULL
  AND ap.organization_id IS NOT NULL;

-- Backfill missing profile rows for already-approved users
INSERT INTO public.profiles (
  id,
  username,
  first_name,
  last_name,
  organization_id,
  updated_at
)
SELECT
  ur.user_id,
  au.email,
  NULLIF(BTRIM(au.raw_user_meta_data->>'first_name'), ''),
  NULLIF(BTRIM(au.raw_user_meta_data->>'last_name'), ''),
  ur.organization_id,
  now()
FROM public.user_roles ur
JOIN public.user_approvals ua
  ON ua.user_id = ur.user_id
  AND ua.status = 'approved'
JOIN auth.users au
  ON au.id = ur.user_id
LEFT JOIN public.profiles p
  ON p.id = ur.user_id
WHERE p.id IS NULL
  AND ur.organization_id IS NOT NULL;

-- Backfill names/usernames for existing profiles where missing
UPDATE public.profiles p
SET
  username = COALESCE(NULLIF(p.username, ''), au.email),
  first_name = COALESCE(NULLIF(p.first_name, ''), NULLIF(BTRIM(au.raw_user_meta_data->>'first_name'), '')),
  last_name = COALESCE(NULLIF(p.last_name, ''), NULLIF(BTRIM(au.raw_user_meta_data->>'last_name'), '')),
  updated_at = now()
FROM auth.users au
WHERE p.id = au.id
  AND (
    p.username IS NULL OR p.username = '' OR
    p.first_name IS NULL OR p.first_name = '' OR
    p.last_name IS NULL OR p.last_name = ''
  );