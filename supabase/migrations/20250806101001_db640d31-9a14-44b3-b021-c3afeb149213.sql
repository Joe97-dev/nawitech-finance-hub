-- Create approval record for joekazungu@gmail.com
INSERT INTO public.user_approvals (user_id, status, approved_at)
SELECT au.id, 'approved', now()
FROM auth.users au 
WHERE au.email = 'joekazungu@gmail.com'
AND NOT EXISTS (
    SELECT 1 FROM public.user_approvals ua 
    WHERE ua.user_id = au.id
);