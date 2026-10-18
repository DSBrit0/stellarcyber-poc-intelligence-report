-- What else the Presenter's screen shows, so every participant's follows it too: the side panel
-- open or folded, the Spotlight (the item the Presenter points at) and the Record Trace replays.
ALTER TABLE experiences ADD COLUMN view jsonb NOT NULL DEFAULT '{"panel": true, "spot": null, "replay": 0}';
