-- Create a default organization
INSERT INTO public.organizations (id, name, subdomain)
VALUES ('a0000000-0000-0000-0000-000000000001', 'NawiTech Finance', 'nawitech');

-- Create profile for the user
INSERT INTO public.profiles (id, username, first_name, last_name, organization_id)
VALUES ('faca3b84-3a31-488d-937f-76ed5696f17b', 'joekazungu@gmail.com', 'Joe', 'Kazungu', 'a0000000-0000-0000-0000-000000000001');

-- Create approved user_approval record
INSERT INTO public.user_approvals (user_id, status, approved_at)
VALUES ('faca3b84-3a31-488d-937f-76ed5696f17b', 'approved', now());

-- Assign admin role
INSERT INTO public.user_roles (user_id, role, organization_id)
VALUES ('faca3b84-3a31-488d-937f-76ed5696f17b', 'admin', 'a0000000-0000-0000-0000-000000000001');

-- Confirm email in auth
UPDATE auth.users SET email_confirmed_at = now() WHERE id = 'faca3b84-3a31-488d-937f-76ed5696f17b';
