-- Approve user joekazungu@gmail.com and assign admin role
DO $$
DECLARE
    target_user_id uuid;
BEGIN
    -- Get the user ID for joekazungu@gmail.com
    SELECT id INTO target_user_id 
    FROM auth.users 
    WHERE email = 'joekazungu@gmail.com';
    
    IF target_user_id IS NOT NULL THEN
        -- Update approval status to approved
        UPDATE public.user_approvals 
        SET 
            status = 'approved',
            approved_at = now(),
            updated_at = now()
        WHERE user_id = target_user_id;
        
        -- Insert or update user role to admin
        INSERT INTO public.user_roles (user_id, role)
        VALUES (target_user_id, 'admin'::user_role)
        ON CONFLICT (user_id) DO UPDATE SET
            role = 'admin'::user_role,
            updated_at = now();
        
        RAISE NOTICE 'User joekazungu@gmail.com has been approved and assigned admin role';
    ELSE
        RAISE NOTICE 'User joekazungu@gmail.com not found';
    END IF;
END $$;