-- Fix the search path security issue for all functions
CREATE OR REPLACE FUNCTION public.approve_user(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
  
  -- Confirm the user's email in the auth.users table
  UPDATE auth.users 
  SET 
    email_confirmed_at = now(),
    confirmed_at = now()
  WHERE id = target_user_id;
  
  -- Assign default role (data_entry) to approved user
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'data_entry'::user_role)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- Fix all other functions to have proper search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Insert approval record for new user with pending status
  INSERT INTO public.user_approvals (user_id, status, created_at, updated_at)
  VALUES (NEW.id, 'pending', now(), now());
  
  RETURN NEW;
END;
$$;