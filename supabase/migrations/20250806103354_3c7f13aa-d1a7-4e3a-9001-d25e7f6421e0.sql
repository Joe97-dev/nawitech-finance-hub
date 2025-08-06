-- Create a function to get user email by user_id for admin use
CREATE OR REPLACE FUNCTION public.get_user_email(user_id_input uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_email text;
BEGIN
  -- Check if the current user is an admin
  IF NOT has_role(auth.uid(), 'admin'::user_role) THEN
    RAISE EXCEPTION 'Only admins can access user emails';
  END IF;
  
  -- Get user email from auth.users
  SELECT email INTO user_email
  FROM auth.users 
  WHERE id = user_id_input;
  
  RETURN user_email;
END;
$$;