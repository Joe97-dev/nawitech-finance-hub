-- Backfill missing profiles for existing auth users
INSERT INTO public.profiles (id, username)
SELECT u.id, u.email
FROM auth.users u
WHERE u.id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;