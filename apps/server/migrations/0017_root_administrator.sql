-- The Root Administrator (ADR 0013): one built-in Admin account, named "Administrator", that cannot
-- lose its Role, be disabled or deleted. It signs in with MFA, like every User.
ALTER TABLE users ADD COLUMN is_root boolean NOT NULL DEFAULT false;
CREATE UNIQUE INDEX users_single_root ON users (is_root) WHERE is_root;

-- An existing installation: the first Admin becomes the Root Administrator.
UPDATE users
SET is_root = true, name = 'Administrator', email = 'administrator@stellarcyber.ai', role = 'admin', status = 'active',
    mfa_exempt = false, updated_at = now()
WHERE id = (SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'administrator@stellarcyber.ai');
