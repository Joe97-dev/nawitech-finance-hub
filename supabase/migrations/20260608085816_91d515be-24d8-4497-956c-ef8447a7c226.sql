-- 1. PUBLIC_USER_DATA: profiles publicly readable -> org-scoped, authenticated only
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;

CREATE POLICY "Users can view profiles in their organization"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR organization_id = public.get_user_organization_id(auth.uid())
);

-- 2. PRIVILEGE_ESCALATION: make role management admin-only and explicit
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;

CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::user_role));

-- 3. UNAUTHENTICATED_WRITE_ACCESS: remove anon write access to mpesa_transactions.
-- Edge functions use the service role key which bypasses RLS, so callbacks still work.
DROP POLICY IF EXISTS "Allow anon insert for mpesa callbacks" ON public.mpesa_transactions;
DROP POLICY IF EXISTS "Allow anon update for mpesa callbacks" ON public.mpesa_transactions;

-- 4. SUPA_function_search_path_mutable for update_migration_job_updated_at
CREATE OR REPLACE FUNCTION public.update_migration_job_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;