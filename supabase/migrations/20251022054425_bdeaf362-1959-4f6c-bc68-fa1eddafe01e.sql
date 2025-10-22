-- Create client accounts table
CREATE TABLE public.client_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  balance NUMERIC NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

-- Create client account transactions table for audit trail
CREATE TABLE public.client_account_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_account_id UUID NOT NULL REFERENCES public.client_accounts(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'loan_payment', 'fee_deduction')),
  related_loan_id UUID REFERENCES public.loans(id),
  related_transaction_id UUID REFERENCES public.loan_transactions(id),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  previous_balance NUMERIC NOT NULL,
  new_balance NUMERIC NOT NULL
);

-- Enable RLS
ALTER TABLE public.client_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_account_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for client_accounts
CREATE POLICY "Authenticated users can view client accounts"
  ON public.client_accounts FOR SELECT
  USING (
    has_role(auth.uid(), 'data_entry'::user_role) OR 
    has_role(auth.uid(), 'loan_officer'::user_role) OR 
    has_role(auth.uid(), 'admin'::user_role)
  );

CREATE POLICY "Loan officers and admins can manage client accounts"
  ON public.client_accounts FOR ALL
  USING (
    has_role(auth.uid(), 'loan_officer'::user_role) OR 
    has_role(auth.uid(), 'admin'::user_role)
  );

-- RLS Policies for client_account_transactions
CREATE POLICY "Authenticated users can view account transactions"
  ON public.client_account_transactions FOR SELECT
  USING (
    has_role(auth.uid(), 'data_entry'::user_role) OR 
    has_role(auth.uid(), 'loan_officer'::user_role) OR 
    has_role(auth.uid(), 'admin'::user_role)
  );

CREATE POLICY "Loan officers and admins can manage account transactions"
  ON public.client_account_transactions FOR ALL
  USING (
    has_role(auth.uid(), 'loan_officer'::user_role) OR 
    has_role(auth.uid(), 'admin'::user_role)
  );

-- Create function to update client account balance
CREATE OR REPLACE FUNCTION public.update_client_account_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.client_accounts
  SET balance = NEW.new_balance,
      updated_at = now()
  WHERE id = NEW.client_account_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-update account balance
CREATE TRIGGER update_client_account_balance_trigger
  AFTER INSERT ON public.client_account_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_client_account_balance();

-- Create indexes for performance
CREATE INDEX idx_client_accounts_client_id ON public.client_accounts(client_id);
CREATE INDEX idx_client_account_transactions_account_id ON public.client_account_transactions(client_account_id);
CREATE INDEX idx_client_account_transactions_loan_id ON public.client_account_transactions(related_loan_id);