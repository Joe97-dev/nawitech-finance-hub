-- Add foreign key constraint between loan_schedule and loans tables
ALTER TABLE public.loan_schedule 
ADD CONSTRAINT fk_loan_schedule_loan_id 
FOREIGN KEY (loan_id) REFERENCES public.loans(id) 
ON DELETE CASCADE;