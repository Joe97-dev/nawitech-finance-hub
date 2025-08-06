-- Clean up duplicate user approval records
-- First, create a temporary table to identify duplicates
WITH ranked_approvals AS (
  SELECT 
    id,
    user_id,
    status,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
  FROM user_approvals
),
duplicates_to_delete AS (
  SELECT id 
  FROM ranked_approvals 
  WHERE rn > 1
)
DELETE FROM user_approvals 
WHERE id IN (SELECT id FROM duplicates_to_delete);

-- Add a unique constraint to prevent future duplicates
ALTER TABLE user_approvals 
ADD CONSTRAINT unique_user_approval UNIQUE (user_id);