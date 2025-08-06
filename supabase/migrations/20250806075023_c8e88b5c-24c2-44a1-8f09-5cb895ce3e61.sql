-- Create loan disbursal workflow table
CREATE TABLE public.loan_disbursal_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  loan_id UUID NOT NULL,
  requested_amount NUMERIC NOT NULL,
  requester_id UUID NOT NULL,
  requester_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending_approval',
  request_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Approval stage
  approver_id UUID,
  approval_date TIMESTAMP WITH TIME ZONE,
  approval_notes TEXT,
  
  -- Disbursal stage  
  disburser_id UUID,
  disbursal_date TIMESTAMP WITH TIME ZONE,
  disbursal_notes TEXT,
  actual_amount_disbursed NUMERIC,
  disbursal_method TEXT,
  disbursal_reference TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_status CHECK (status IN ('pending_approval', 'approved', 'disbursed', 'rejected', 'cancelled')),
  CONSTRAINT valid_disbursal_method CHECK (disbursal_method IS NULL OR disbursal_method IN ('bank_transfer', 'cash', 'mobile_money', 'cheque'))
);

-- Enable RLS
ALTER TABLE public.loan_disbursal_requests ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Admins can manage all disbursal requests" 
ON public.loan_disbursal_requests 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Loan officers can view and create disbursal requests" 
ON public.loan_disbursal_requests 
FOR SELECT 
USING (has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Loan officers can insert disbursal requests" 
ON public.loan_disbursal_requests 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Data entry can view disbursal requests" 
ON public.loan_disbursal_requests 
FOR SELECT 
USING (has_role(auth.uid(), 'data_entry'::user_role) OR has_role(auth.uid(), 'loan_officer'::user_role) OR has_role(auth.uid(), 'admin'::user_role));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_disbursal_request_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_disbursal_requests_updated_at
BEFORE UPDATE ON public.loan_disbursal_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_disbursal_request_updated_at();

-- Add indexes for better performance
CREATE INDEX idx_loan_disbursal_requests_loan_id ON public.loan_disbursal_requests(loan_id);
CREATE INDEX idx_loan_disbursal_requests_status ON public.loan_disbursal_requests(status);
CREATE INDEX idx_loan_disbursal_requests_requester ON public.loan_disbursal_requests(requester_id);
CREATE INDEX idx_loan_disbursal_requests_approver ON public.loan_disbursal_requests(approver_id);

-- Create workflow status enum for better type safety
CREATE TYPE public.disbursal_status AS ENUM ('pending_approval', 'approved', 'disbursed', 'rejected', 'cancelled');

-- Update the table to use the enum
ALTER TABLE public.loan_disbursal_requests 
DROP CONSTRAINT valid_status,
ALTER COLUMN status TYPE disbursal_status USING status::disbursal_status;