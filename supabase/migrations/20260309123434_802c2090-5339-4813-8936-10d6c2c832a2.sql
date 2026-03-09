
-- ========================================
-- MULTI-TENANT SaaS MIGRATION - PART 1: Schema + Data
-- ========================================

-- 1. Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subdomain text UNIQUE NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- 2. Add organization_id columns (if not already added from failed migration)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'organization_id') THEN
    ALTER TABLE public.profiles ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_roles' AND column_name = 'organization_id') THEN
    ALTER TABLE public.user_roles ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'organization_id') THEN
    ALTER TABLE public.clients ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loans' AND column_name = 'organization_id') THEN
    ALTER TABLE public.loans ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loan_transactions' AND column_name = 'organization_id') THEN
    ALTER TABLE public.loan_transactions ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loan_schedule' AND column_name = 'organization_id') THEN
    ALTER TABLE public.loan_schedule ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loan_documents' AND column_name = 'organization_id') THEN
    ALTER TABLE public.loan_documents ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_accounts' AND column_name = 'organization_id') THEN
    ALTER TABLE public.client_accounts ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_account_transactions' AND column_name = 'organization_id') THEN
    ALTER TABLE public.client_account_transactions ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_documents' AND column_name = 'organization_id') THEN
    ALTER TABLE public.client_documents ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'client_referees' AND column_name = 'organization_id') THEN
    ALTER TABLE public.client_referees ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'branches' AND column_name = 'organization_id') THEN
    ALTER TABLE public.branches ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loan_products' AND column_name = 'organization_id') THEN
    ALTER TABLE public.loan_products ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'loan_portfolio_analysis' AND column_name = 'organization_id') THEN
    ALTER TABLE public.loan_portfolio_analysis ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'migration_jobs' AND column_name = 'organization_id') THEN
    ALTER TABLE public.migration_jobs ADD COLUMN organization_id uuid REFERENCES public.organizations(id);
  END IF;
END $$;

-- 3. Insert the first organization (idempotent)
INSERT INTO public.organizations (id, name, subdomain)
VALUES ('00000000-0000-0000-0000-000000000001', 'Kirannah Digital', 'kirannah')
ON CONFLICT (id) DO NOTHING;

-- 4. Migrate all existing data
UPDATE public.profiles SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.user_roles SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.clients SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.loans SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.loan_transactions SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.loan_schedule SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.loan_documents SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.client_accounts SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.client_account_transactions SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.client_documents SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.client_referees SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.branches SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.loan_products SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.loan_portfolio_analysis SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;
UPDATE public.migration_jobs SET organization_id = '00000000-0000-0000-0000-000000000001' WHERE organization_id IS NULL;

-- 5. Make NOT NULL on core business tables
ALTER TABLE public.clients ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.loans ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.loan_transactions ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.loan_schedule ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.loan_documents ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.client_accounts ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.client_account_transactions ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.client_documents ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.client_referees ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.branches ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.loan_products ALTER COLUMN organization_id SET NOT NULL;
ALTER TABLE public.loan_portfolio_analysis ALTER COLUMN organization_id SET NOT NULL;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_clients_org ON public.clients(organization_id);
CREATE INDEX IF NOT EXISTS idx_loans_org ON public.loans(organization_id);
CREATE INDEX IF NOT EXISTS idx_loan_transactions_org ON public.loan_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_loan_schedule_org ON public.loan_schedule(organization_id);
CREATE INDEX IF NOT EXISTS idx_branches_org ON public.branches(organization_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_loan_products_org ON public.loan_products(organization_id);

-- 7. Security definer function (now columns exist)
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = _user_id;
$$;
