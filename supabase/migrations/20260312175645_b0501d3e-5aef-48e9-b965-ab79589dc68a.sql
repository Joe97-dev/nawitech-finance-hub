
-- Insert missing profile for superdonmerchants@gmail.com
INSERT INTO public.profiles (id, username, created_at, updated_at)
VALUES ('155cde57-8a6d-4969-9faf-3c9ced8b00ca', 'superdonmerchants@gmail.com', now(), now())
ON CONFLICT (id) DO NOTHING;

-- Insert missing approval record
INSERT INTO public.user_approvals (user_id, status, created_at, updated_at)
VALUES ('155cde57-8a6d-4969-9faf-3c9ced8b00ca', 'pending', now(), now())
ON CONFLICT (user_id) DO NOTHING;
