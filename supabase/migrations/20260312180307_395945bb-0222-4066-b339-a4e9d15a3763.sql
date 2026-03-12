-- Reset password directly via auth.users update using Supabase's built-in crypt
SELECT auth.uid(); -- This won't work in migration context, using admin API instead
