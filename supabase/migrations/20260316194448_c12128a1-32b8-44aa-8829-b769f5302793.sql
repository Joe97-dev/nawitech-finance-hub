
-- Delete the two erroneous fee transactions (400 each via draw_down_account) for Lewis Mwangi Kariri's loan
DELETE FROM public.loan_transactions 
WHERE id IN (
  'de23016d-61dd-4e36-98ee-79af9d23e86c',
  'fc2798ed-686a-4237-b2ca-819f92274b79'
);
