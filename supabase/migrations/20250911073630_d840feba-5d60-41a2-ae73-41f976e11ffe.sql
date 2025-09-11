-- Add fields to support payment reversal
ALTER TABLE public.loan_transactions 
ADD COLUMN reverted_at timestamp with time zone,
ADD COLUMN reverted_by uuid,
ADD COLUMN reversal_reason text,
ADD COLUMN is_reverted boolean NOT NULL DEFAULT false;

-- Add index for better query performance
CREATE INDEX idx_loan_transactions_reverted ON public.loan_transactions(is_reverted, loan_id);