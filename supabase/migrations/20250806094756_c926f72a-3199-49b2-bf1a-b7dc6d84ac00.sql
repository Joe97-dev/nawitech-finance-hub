-- Add approval status to track user registration status
CREATE TYPE public.approval_status AS ENUM ('pending', 'approved', 'rejected');

-- Create user_approvals table to track registration approval status
CREATE TABLE public.user_approvals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status approval_status NOT NULL DEFAULT 'pending',
  approved_by uuid REFERENCES auth.users(id),
  approved_at timestamp with time zone,
  rejection_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on user_approvals
ALTER TABLE public.user_approvals ENABLE ROW LEVEL SECURITY;

-- Create policies for user_approvals
CREATE POLICY "Admins can manage all user approvals" 
ON public.user_approvals 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role));

CREATE POLICY "Users can view their own approval status" 
ON public.user_approvals 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Insert approval record for new user
  INSERT INTO public.user_approvals (user_id, status)
  VALUES (NEW.id, 'pending');
  
  RETURN NEW;
END;
$$;

-- Create trigger to automatically create approval record for new users
CREATE TRIGGER on_auth_user_created_approval
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user_approval();

-- Create function to approve user
CREATE OR REPLACE FUNCTION public.approve_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check if the current user is an admin
  IF NOT has_role(auth.uid(), 'admin'::user_role) THEN
    RAISE EXCEPTION 'Only admins can approve users';
  END IF;
  
  -- Update approval status
  UPDATE public.user_approvals 
  SET 
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = now(),
    updated_at = now()
  WHERE user_id = target_user_id;
  
  -- Assign default role (data_entry) to approved user
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'data_entry'::user_role)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- Create function to reject user
CREATE OR REPLACE FUNCTION public.reject_user(target_user_id uuid, reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Check if the current user is an admin
  IF NOT has_role(auth.uid(), 'admin'::user_role) THEN
    RAISE EXCEPTION 'Only admins can reject users';
  END IF;
  
  -- Update approval status
  UPDATE public.user_approvals 
  SET 
    status = 'rejected',
    approved_by = auth.uid(),
    approved_at = now(),
    rejection_reason = reason,
    updated_at = now()
  WHERE user_id = target_user_id;
END;
$$;