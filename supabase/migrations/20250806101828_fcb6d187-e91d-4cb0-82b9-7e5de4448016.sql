-- Check if the trigger exists and fix the user approval flow
-- First, ensure we have the trigger to create approval records on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Recreate the trigger function to handle new user approvals
CREATE OR REPLACE FUNCTION public.handle_new_user_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert approval record for new user with pending status
  INSERT INTO public.user_approvals (user_id, status, created_at, updated_at)
  VALUES (NEW.id, 'pending', now(), now());
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger to automatically create approval records
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_approval();