-- Backfill: re-evaluate status for all non-terminal loans
DO $$
DECLARE
  l RECORD;
BEGIN
  FOR l IN SELECT id FROM public.loans WHERE status NOT IN ('closed','rejected','written_off','abandoned','pending','postponed') LOOP
    PERFORM public.update_loan_status(l.id);
  END LOOP;
END $$;

-- Schedule a daily job so aging loans get re-classified even without new transactions
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-loan-status-refresh') THEN
    PERFORM cron.unschedule('daily-loan-status-refresh');
  END IF;
END $$;

SELECT cron.schedule(
  'daily-loan-status-refresh',
  '5 0 * * *',
  $$
  DO $inner$
  DECLARE
    l RECORD;
  BEGIN
    FOR l IN SELECT id FROM public.loans WHERE status NOT IN ('closed','rejected','written_off','abandoned','pending','postponed') LOOP
      PERFORM public.update_loan_status(l.id);
    END LOOP;
  END $inner$;
  $$
);