-- Deduplicate client with id_number 14567771 (Lucy Wanjiku Gitau)
-- Keeping the older record (aafa30d9-d6a4-4c13-b2b8-d86cfcd92aaa)
-- Merging references from the newer duplicate (9421bc8c-88df-41c6-b16d-a5cdd6f579c9)

UPDATE client_referees
SET client_id = 'aafa30d9-d6a4-4c13-b2b8-d86cfcd92aaa'
WHERE client_id = '9421bc8c-88df-41c6-b16d-a5cdd6f579c9';

UPDATE loans
SET client = 'Lucy Wanjiku Gitau'
WHERE client = 'Lucy Wanjiku  Gitau';

DELETE FROM clients WHERE id = '9421bc8c-88df-41c6-b16d-a5cdd6f579c9';

-- Deduplicate client with id_number 34664624 (Mary nyambura)
-- Keeping the older record (e6f4d473-abf8-49f7-9805-9a5567fef8a1)
-- Merging references from the newer duplicate (e1516a5b-2382-48e6-a96d-4a1b93015bd6)

UPDATE client_documents
SET client_id = 'e6f4d473-abf8-49f7-9805-9a5567fef8a1'
WHERE client_id = 'e1516a5b-2382-48e6-a96d-4a1b93015bd6';

UPDATE client_referees
SET client_id = 'e6f4d473-abf8-49f7-9805-9a5567fef8a1'
WHERE client_id = 'e1516a5b-2382-48e6-a96d-4a1b93015bd6';

DELETE FROM clients WHERE id = 'e1516a5b-2382-48e6-a96d-4a1b93015bd6';

-- Prevent future duplicate national ID numbers within the same organization
CREATE UNIQUE INDEX idx_clients_unique_id_number ON clients (organization_id, id_number) WHERE id_number IS NOT NULL;