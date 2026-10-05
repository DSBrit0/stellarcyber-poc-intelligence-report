-- A Company is a Customer or a Partner Company; its Users take the Profile as their Role (ADR 0011).
-- Every existing Company was registered as a Customer.
ALTER TABLE customers ADD COLUMN profile text NOT NULL DEFAULT 'customer' CHECK (profile IN ('customer', 'partner'));
