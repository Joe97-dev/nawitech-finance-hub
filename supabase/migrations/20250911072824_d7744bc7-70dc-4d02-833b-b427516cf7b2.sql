-- Create global draw down account table
CREATE TABLE public.global_draw_down_account (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  total_balance NUMERIC NOT NULL DEFAULT 0.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.global_draw_down_account ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can manage global draw down account" 
ON public.global_draw_down_account 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Loan officers and data entry can view global draw down account" 
ON public.global_draw_down_account 
FOR SELECT 
USING (has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

-- Insert initial record
INSERT INTO public.global_draw_down_account (total_balance) VALUES (0.0);

-- Create function to calculate total balance from all client accounts
CREATE OR REPLACE FUNCTION public.calculate_global_draw_down_balance()
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    total_balance NUMERIC;
BEGIN
    SELECT COALESCE(SUM(balance), 0)
    INTO total_balance
    FROM public.client_draw_down_accounts;
    
    RETURN total_balance;
END;
$$;

-- Create function to update global draw down account
CREATE OR REPLACE FUNCTION public.update_global_draw_down_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    new_total NUMERIC;
BEGIN
    -- Calculate the new total balance
    new_total := calculate_global_draw_down_balance();
    
    -- Update the global account
    UPDATE public.global_draw_down_account 
    SET total_balance = new_total, updated_at = now();
    
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers on client_draw_down_accounts to update global balance
CREATE TRIGGER update_global_balance_on_insert
    AFTER INSERT ON public.client_draw_down_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_global_draw_down_balance();

CREATE TRIGGER update_global_balance_on_update
    AFTER UPDATE ON public.client_draw_down_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_global_draw_down_balance();

CREATE TRIGGER update_global_balance_on_delete
    AFTER DELETE ON public.client_draw_down_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_global_draw_down_balance();

-- Create trigger for updated_at on global account
CREATE TRIGGER update_global_draw_down_updated_at
    BEFORE UPDATE ON public.global_draw_down_account
    FOR EACH ROW
    EXECUTE FUNCTION public.update_client_draw_down_updated_at();

-- Update the initial balance to reflect current state
UPDATE public.global_draw_down_account 
SET total_balance = (SELECT calculate_global_draw_down_balance());