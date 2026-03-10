
-- Insert missing profile for the loan officer
INSERT INTO public.profiles (id, username, first_name, last_name, organization_id)
VALUES (
  'b8c5fe78-1462-49da-941a-2ccb721d30b3',
  'stevek@gmail.com',
  'Steve',
  'Kairu',
  'a0000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  organization_id = EXCLUDED.organization_id;

-- Also set the organization_id on user_roles
UPDATE public.user_roles
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE user_id = 'b8c5fe78-1462-49da-941a-2ccb721d30b3';
