-- The Briefing's topics start summarized; the Presenter opens each one while explaining it, and
-- every participant's view follows. Reset whenever the Presenter changes Stage.
ALTER TABLE experiences ADD COLUMN briefing_open jsonb NOT NULL DEFAULT '[]';
