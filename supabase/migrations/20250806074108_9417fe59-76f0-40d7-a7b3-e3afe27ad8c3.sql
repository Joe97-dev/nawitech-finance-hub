-- Enable RLS on critical tables that are currently exposed
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_portfolio_analysis ENABLE ROW LEVEL SECURITY;

-- Create secure RLS policies for loans table
CREATE POLICY "Admins can manage all loans" 
ON public.loans 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Loan officers can view and create loans" 
ON public.loans 
FOR SELECT 
USING (has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Loan officers can insert loans" 
ON public.loans 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Data entry can view loans" 
ON public.loans 
FOR SELECT 
USING (has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

-- Create secure RLS policies for loan portfolio analysis
CREATE POLICY "Admins can manage portfolio analysis" 
ON public.loan_portfolio_analysis 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Loan officers can view portfolio analysis" 
ON public.loan_portfolio_analysis 
FOR SELECT 
USING (has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

-- Tighten overly permissive policies on other tables
DROP POLICY IF EXISTS "Allow authenticated users full access to branches" ON public.branches;
DROP POLICY IF EXISTS "Allow authenticated users full access to clients" ON public.clients;
DROP POLICY IF EXISTS "All authenticated users can view loan schedules" ON public.loan_schedule;

-- Create more restrictive policies for branches
CREATE POLICY "Admins can manage all branches" 
ON public.branches 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Loan officers can view branches" 
ON public.branches 
FOR SELECT 
USING (has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Data entry can view branches" 
ON public.branches 
FOR SELECT 
USING (has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

-- Create more restrictive policies for clients
CREATE POLICY "Admins can manage all clients" 
ON public.clients 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Loan officers can manage clients" 
ON public.clients 
FOR ALL 
USING (has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Data entry can view and create clients" 
ON public.clients 
FOR SELECT 
USING (has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Data entry can insert clients" 
ON public.clients 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

-- Create more restrictive policies for loan schedules
CREATE POLICY "Admins and loan officers can manage loan schedules" 
ON public.loan_schedule 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role));

CREATE POLICY "Data entry can view loan schedules" 
ON public.loan_schedule 
FOR SELECT 
USING (has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

-- Fix function security issues - update has_role function to be more secure
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$function$;