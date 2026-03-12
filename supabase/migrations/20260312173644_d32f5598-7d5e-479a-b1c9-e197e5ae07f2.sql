-- Remove duplicate clients, keeping the oldest record (by created_at) for each group
DELETE FROM clients
WHERE id IN (
  SELECT unnest(ids[2:])
  FROM (
    SELECT array_agg(id ORDER BY created_at ASC) as ids
    FROM clients
    GROUP BY first_name, last_name, id_number, phone
    HAVING COUNT(*) > 1
  ) sub
);