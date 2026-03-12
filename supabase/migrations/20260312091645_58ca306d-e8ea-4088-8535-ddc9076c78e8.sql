
-- The handle_new_user and handle_new_user_approval functions are SECURITY DEFINER,
-- so RLS shouldn't block them. Let's verify triggers exist by dropping and recreating cleanly.

-- Drop existing triggers first to avoid conflicts
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_created_approval ON auth.users;

-- Recreate both triggers
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER on_auth_user_created_approval
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_approval();
