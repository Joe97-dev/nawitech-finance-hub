-- Add draw down account functionality to loans
-- This will track excess payments that can be used for future loan payments

ALTER TABLE public.loans 
ADD COLUMN draw_down_balance NUMERIC DEFAULT 0.0 NOT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN public.loans.draw_down_balance IS 'Track excess payments that can be drawn to pay for future loan installments';