
-- Create table to store M-Pesa C2B transactions
CREATE TABLE public.mpesa_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type text NOT NULL,
  trans_id text NOT NULL UNIQUE,
  trans_time text NOT NULL,
  trans_amount numeric NOT NULL,
  business_short_code text NOT NULL,
  bill_ref_number text,
  invoice_number text,
  org_account_balance numeric,
  third_party_trans_id text,
  msisdn text NOT NULL,
  first_name text,
  middle_name text,
  last_name text,
  matched_client_id uuid REFERENCES public.clients(id),
  matched_loan_id uuid REFERENCES public.loans(id),
  payment_applied boolean NOT NULL DEFAULT false,
  loan_transaction_id uuid REFERENCES public.loan_transactions(id),
  organization_id uuid REFERENCES public.organizations(id),
  status text NOT NULL DEFAULT 'received',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mpesa_transactions ENABLE ROW LEVEL SECURITY;

-- Admins can manage all mpesa transactions in their org
CREATE POLICY "Org admins can manage mpesa transactions"
ON public.mpesa_transactions
FOR ALL
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'admin'::user_role)
);

-- Org users can view mpesa transactions
CREATE POLICY "Org users can view mpesa transactions"
ON public.mpesa_transactions
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::user_role)
    OR has_role(auth.uid(), 'loan_officer'::user_role)
  )
);

-- Allow anon inserts from edge functions (M-Pesa callbacks)
CREATE POLICY "Allow anon insert for mpesa callbacks"
ON public.mpesa_transactions
FOR INSERT
TO anon
WITH CHECK (true);

-- Allow service role updates
CREATE POLICY "Allow anon update for mpesa callbacks"
ON public.mpesa_transactions
FOR UPDATE
TO anon
USING (true);
