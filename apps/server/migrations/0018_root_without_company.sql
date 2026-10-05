-- The Root Administrator belongs to no Company (ADR 0013): otherwise a Company's user decisions,
-- profile changes or deletion would reach it. Migration 0017 could promote a former Company user.
UPDATE users SET customer_id = NULL, updated_at = now() WHERE is_root AND customer_id IS NOT NULL;
