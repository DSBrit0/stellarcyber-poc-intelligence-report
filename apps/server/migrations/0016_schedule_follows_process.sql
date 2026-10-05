-- Each PoC Schedule milestone stands for one PoC Process phase: a stable key ties them in the
-- template, and a Notebook's milestone points to its own phase (removed with it).
ALTER TABLE poc_process_items ADD COLUMN key text;
ALTER TABLE poc_milestones ADD COLUMN phase_id uuid REFERENCES poc_process_items(id) ON DELETE CASCADE;

-- The template's process phases, in order.
WITH phases AS (
  SELECT id, row_number() OVER (ORDER BY position) AS n
  FROM notebook_template_items WHERE section = 'process' AND kind = 'phase'
), keys(n, key) AS (
  VALUES (1, 'planning'), (2, 'pov_workshop'), (3, 'pov_review'), (4, 'initial_work'), (5, 'pre_kickoff'),
         (6, 'kickoff'), (7, 'meeting_2'), (8, 'meeting_3'), (9, 'meeting_4'), (10, 'meeting_5'),
         (11, 'meeting_6'), (12, 'meeting_7'), (13, 'meeting_8'), (14, 'closeout'), (15, 'final_evaluation')
)
UPDATE notebook_template_items t SET key = keys.key FROM phases JOIN keys USING (n) WHERE t.id = phases.id;

-- The template's milestones after the start day carry the key of their phase.
WITH ms AS (
  SELECT id, row_number() OVER (ORDER BY position) AS n
  FROM notebook_template_items WHERE section = 'schedule'
), keys(n, key) AS (
  VALUES (1, 'start'), (2, 'planning'), (3, 'pov_workshop'), (4, 'pov_review'), (5, 'initial_work'), (6, 'pre_kickoff'),
         (7, 'kickoff'), (8, 'meeting_2'), (9, 'meeting_3'), (10, 'meeting_4'), (11, 'meeting_5'),
         (12, 'meeting_6'), (13, 'meeting_7'), (14, 'meeting_8'), (15, 'closeout')
)
UPDATE notebook_template_items t SET key = keys.key FROM ms JOIN keys USING (n) WHERE t.id = ms.id;

-- Notebooks already started: their phases get the template's keys (matched on the English text), and
-- their milestones get the same keys in order, then point to their phase.
UPDATE poc_process_items p SET key = t.key
FROM notebook_template_items t
WHERE p.kind = 'phase' AND t.section = 'process' AND t.kind = 'phase' AND p.text->>'en' = t.text->>'en';

WITH ms AS (
  SELECT id, poc_id, row_number() OVER (PARTITION BY poc_id ORDER BY position) AS n FROM poc_milestones
), tpl AS (
  SELECT key, row_number() OVER (ORDER BY position) AS n FROM notebook_template_items WHERE section = 'schedule'
)
UPDATE poc_milestones m SET key = tpl.key FROM ms JOIN tpl USING (n) WHERE m.id = ms.id AND m.key IS DISTINCT FROM 'start' AND ms.n > 1;

UPDATE poc_milestones m SET phase_id = p.id
FROM poc_process_items p
WHERE p.poc_id = m.poc_id AND p.kind = 'phase' AND p.key = m.key AND m.key <> 'start';
