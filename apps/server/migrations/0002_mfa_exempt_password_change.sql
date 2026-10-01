-- mfa_exempt: an Admin-controlled exception to mandatory TOTP (used by the installation Admin).
-- must_change_password: until set false, a session may only change the password or sign out.
ALTER TABLE users
  ADD COLUMN mfa_exempt boolean NOT NULL DEFAULT false,
  ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;
