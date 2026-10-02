-- api_calls and app_logs are history written in batches after the fact: a foreign key made a whole
-- batch fail when its User or Sync had been deleted in the meantime. Ids stay as plain references.
ALTER TABLE api_calls DROP CONSTRAINT IF EXISTS api_calls_sync_id_fkey;
ALTER TABLE api_calls DROP CONSTRAINT IF EXISTS api_calls_user_id_fkey;
ALTER TABLE app_logs DROP CONSTRAINT IF EXISTS app_logs_user_id_fkey;
