-- First, let's recreate the trigger for new user signups
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_approval();

-- Update the handle_new_user_approval function to handle duplicates gracefully
CREATE OR REPLACE FUNCTION public.handle_new_user_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Insert approval record for new user with pending status
  -- Use ON CONFLICT to handle duplicates gracefully
  INSERT INTO public.user_approvals (user_id, status, created_at, updated_at)
  VALUES (NEW.id, 'pending', now(), now())
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;