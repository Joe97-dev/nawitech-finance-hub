
-- Add interest_method column to loan_products (flat or reducing)
ALTER TABLE public.loan_products 
ADD COLUMN IF NOT EXISTS interest_method text NOT NULL DEFAULT 'flat';

-- Add interest_method column to loans to track which method was used
ALTER TABLE public.loans 
ADD COLUMN IF NOT EXISTS interest_method text NOT NULL DEFAULT 'flat';
