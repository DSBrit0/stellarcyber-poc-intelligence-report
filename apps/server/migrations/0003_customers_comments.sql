-- Customers registered in advance by an SE/Partner (owner). access_key_hash = SHA-256 of the Access Key.
CREATE TABLE customers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  name_key         text NOT NULL UNIQUE,
  owner_id         uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  access_key_hash  text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customers_owner_id_idx ON customers (owner_id);

-- Customer Users belong to one Customer; a Registration carries the Customer it claims.
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'sales_engineer', 'partner', 'customer'));
ALTER TABLE users ADD COLUMN customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX users_customer_id_idx ON users (customer_id);

ALTER TABLE pocs ADD COLUMN customer_id uuid REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX pocs_customer_id_idx ON pocs (customer_id);

CREATE TABLE report_comments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_data_id  uuid NOT NULL REFERENCES report_data(id) ON DELETE CASCADE,
  user_id         uuid REFERENCES users(id) ON DELETE SET NULL,
  body            text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX report_comments_report_idx ON report_comments (report_data_id, created_at);
