-- Drop all triggers first
DROP TRIGGER IF EXISTS update_global_balance_on_insert ON public.client_draw_down_accounts;
DROP TRIGGER IF EXISTS update_global_balance_on_update ON public.client_draw_down_accounts;
DROP TRIGGER IF EXISTS update_global_balance_on_delete ON public.client_draw_down_accounts;

-- Drop functions with CASCADE to handle dependencies
DROP FUNCTION IF EXISTS public.calculate_global_draw_down_balance() CASCADE;
DROP FUNCTION IF EXISTS public.update_global_draw_down_balance() CASCADE;
DROP FUNCTION IF EXISTS public.update_client_draw_down_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.get_or_create_client_draw_down_account(uuid) CASCADE;

-- Remove draw_down_balance column from loans table
ALTER TABLE public.loans DROP COLUMN IF EXISTS draw_down_balance;

-- Drop the tables
DROP TABLE IF EXISTS public.client_draw_down_accounts CASCADE;
DROP TABLE IF EXISTS public.global_draw_down_account CASCADE;