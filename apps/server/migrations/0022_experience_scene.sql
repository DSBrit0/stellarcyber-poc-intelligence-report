-- What the Presenter's 3D scene shows: the interaction model being compared (a prototype choice)
-- and the object the Presenter has entered, if any. Everyone's view follows; leaving a Stage leaves the object.
ALTER TABLE experiences ADD COLUMN scene jsonb NOT NULL DEFAULT '{"model": "chamber", "target": null}';
