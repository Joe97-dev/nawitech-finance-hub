-- Create client_draw_down_accounts table to track client-specific draw down balances
CREATE TABLE public.client_draw_down_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  balance NUMERIC NOT NULL DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(client_id)
);

-- Enable RLS
ALTER TABLE public.client_draw_down_accounts ENABLE ROW LEVEL SECURITY;

-- Create policies for client draw down accounts
CREATE POLICY "Admins can manage client draw down accounts" 
ON public.client_draw_down_accounts 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Loan officers can view and manage client draw down accounts" 
ON public.client_draw_down_accounts 
FOR ALL 
USING (has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Data entry can view client draw down accounts" 
ON public.client_draw_down_accounts 
FOR SELECT 
USING (has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

-- Create trigger for automatic timestamp updates
CREATE OR REPLACE FUNCTION public.update_client_draw_down_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_client_draw_down_accounts_updated_at
BEFORE UPDATE ON public.client_draw_down_accounts
FOR EACH ROW
EXECUTE FUNCTION public.update_client_draw_down_updated_at();

-- Function to get or create client draw down account
CREATE OR REPLACE FUNCTION public.get_or_create_client_draw_down_account(p_client_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    account_id UUID;
BEGIN
    -- Try to get existing account
    SELECT id INTO account_id
    FROM public.client_draw_down_accounts
    WHERE client_id = p_client_id;
    
    -- If no account exists, create one
    IF account_id IS NULL THEN
        INSERT INTO public.client_draw_down_accounts (client_id, balance)
        VALUES (p_client_id, 0.0)
        RETURNING id INTO account_id;
    END IF;
    
    RETURN account_id;
END;
$$;