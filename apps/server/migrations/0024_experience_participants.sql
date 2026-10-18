-- Who is in a Stellar Experience session: seen on the live-state polling (at most every few seconds),
-- and whether they confirmed their access to the lab on the Closing's Lab Stage.
CREATE TABLE experience_participants (
  experience_id     uuid NOT NULL REFERENCES experiences(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_seen_at      timestamptz NOT NULL DEFAULT now(),
  lab_confirmed_at  timestamptz,
  PRIMARY KEY (experience_id, user_id)
);
