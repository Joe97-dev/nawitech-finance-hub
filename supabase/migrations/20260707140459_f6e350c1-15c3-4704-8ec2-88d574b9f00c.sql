
-- Helper: check a client-based storage object belongs to the caller's organization
CREATE OR REPLACE FUNCTION public.storage_client_object_in_org(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients c
    WHERE (storage.foldername(object_name))[2] ~ '^[0-9a-f-]{36}$'
      AND c.id = ((storage.foldername(object_name))[2])::uuid
      AND c.organization_id = public.get_user_organization_id(auth.uid())
  );
$$;

-- Helper: check a loan-based storage object belongs to the caller's organization
CREATE OR REPLACE FUNCTION public.storage_loan_object_in_org(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.loans l
    WHERE (storage.foldername(object_name))[1] ~ '^[0-9a-f-]{36}$'
      AND l.id = ((storage.foldername(object_name))[1])::uuid
      AND l.organization_id = public.get_user_organization_id(auth.uid())
  );
$$;

-- ============ loan_documents: replace permissive SELECT ============
DROP POLICY IF EXISTS "Authenticated users can view loan documents" ON storage.objects;
CREATE POLICY "Org members can view loan documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'loan_documents'
  AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role))
  AND public.storage_loan_object_in_org(name)
);

-- ============ client_photos: role + org scope ============
DROP POLICY IF EXISTS "Authenticated users can view client photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read client photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update client photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete client photos" ON storage.objects;

CREATE POLICY "Org members can view client photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'client_photos'
  AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'data_entry'::user_role))
  AND public.storage_client_object_in_org(name)
);
CREATE POLICY "Org members can update client photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'client_photos'
  AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'data_entry'::user_role))
  AND public.storage_client_object_in_org(name)
);
CREATE POLICY "Org members can delete client photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'client_photos'
  AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'data_entry'::user_role))
  AND public.storage_client_object_in_org(name)
);

-- ============ client-id-photos: role + org scope ============
DROP POLICY IF EXISTS "Authenticated users can view id photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update id photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete id photos" ON storage.objects;

CREATE POLICY "Org members can view id photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'client-id-photos'
  AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'data_entry'::user_role))
  AND public.storage_client_object_in_org(name)
);
CREATE POLICY "Org members can update id photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'client-id-photos'
  AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'data_entry'::user_role))
  AND public.storage_client_object_in_org(name)
);
CREATE POLICY "Org members can delete id photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'client-id-photos'
  AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'data_entry'::user_role))
  AND public.storage_client_object_in_org(name)
);

-- ============ client-business-photos: role + org scope ============
DROP POLICY IF EXISTS "Authenticated users can view business photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update business photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete business photos" ON storage.objects;

CREATE POLICY "Org members can view business photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'client-business-photos'
  AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'data_entry'::user_role))
  AND public.storage_client_object_in_org(name)
);
CREATE POLICY "Org members can update business photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'client-business-photos'
  AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'data_entry'::user_role))
  AND public.storage_client_object_in_org(name)
);
CREATE POLICY "Org members can delete business photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'client-business-photos'
  AND (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'data_entry'::user_role))
  AND public.storage_client_object_in_org(name)
);

-- ============ Revoke anonymous execution of public database functions ============
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated, service_role;
