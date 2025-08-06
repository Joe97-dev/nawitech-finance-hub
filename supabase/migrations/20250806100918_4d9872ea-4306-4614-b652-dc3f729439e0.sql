-- Create missing approval record for joekazungu@gmail.com
DO $$
DECLARE
    target_user_id uuid;
BEGIN
    -- Get the user ID for joekazungu@gmail.com
    SELECT id INTO target_user_id 
    FROM auth.users 
    WHERE email = 'joekazungu@gmail.com';
    
    IF target_user_id IS NOT NULL THEN
        -- Insert approval record if it doesn't exist
        INSERT INTO public.user_approvals (user_id, status, approved_at)
        VALUES (target_user_id, 'approved', now())
        ON CONFLICT (user_id) DO UPDATE SET
            status = 'approved',
            approved_at = now(),
            updated_at = now();
        
        RAISE NOTICE 'Approval record created/updated for joekazungu@gmail.com';
    ELSE
        RAISE NOTICE 'User joekazungu@gmail.com not found';
    END IF;
END $$;