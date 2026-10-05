-- The PoC Schedule (CONTEXT.md): milestones with the days to the next one; dates are computed from
-- the PoC start date, so they are never stored unless set by hand.
ALTER TABLE notebook_template_items DROP CONSTRAINT notebook_template_items_section_check;
ALTER TABLE notebook_template_items ADD CONSTRAINT notebook_template_items_section_check CHECK (section IN ('process', 'schedule'));
ALTER TABLE notebook_template_items DROP CONSTRAINT notebook_template_items_kind_check;
ALTER TABLE notebook_template_items ADD CONSTRAINT notebook_template_items_kind_check CHECK (kind IN ('phase', 'group', 'item', 'note', 'milestone'));
-- Milestones only: days to the next milestone, colour group, and a stable key (kickoff, closeout).
ALTER TABLE notebook_template_items
  ADD COLUMN days smallint CHECK (days BETWEEN 0 AND 60),
  ADD COLUMN tone text CHECK (tone IN ('start', 'pre', 'poc', 'close')),
  ADD COLUMN key text;

CREATE TABLE poc_milestones (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poc_id         uuid NOT NULL REFERENCES pocs(id) ON DELETE CASCADE,
  position       double precision NOT NULL,
  key            text,
  text           jsonb NOT NULL,
  days           smallint NOT NULL DEFAULT 2 CHECK (days BETWEEN 0 AND 60),
  tone           text NOT NULL DEFAULT 'poc' CHECK (tone IN ('start', 'pre', 'poc', 'close')),
  -- A date set by hand; NULL when computed.
  date_override  date,
  updated_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX poc_milestones_poc ON poc_milestones (poc_id, position);

-- The field team's 15 milestones, in the three languages.
INSERT INTO notebook_template_items (section, kind, position, indent, text, days, tone, key)
SELECT 'schedule', 'milestone', i, 0, e->'text', (e->>'days')::smallint, e->>'tone', e->>'key'
FROM jsonb_array_elements($seed$[{"key": "start", "tone": "start", "days": 1, "text": {"pt-BR": "Dia de início da PoC", "en": "PoC start day", "es": "Día de inicio de la PoC"}}, {"key": null, "tone": "pre", "days": 1, "text": {"pt-BR": "Planejamento e discovery com o cliente", "en": "Planning and discovery with the customer", "es": "Planificación y discovery con el cliente"}}, {"key": null, "tone": "pre", "days": 2, "text": {"pt-BR": "Workshop de POV", "en": "POV workshop", "es": "Workshop de POV"}}, {"key": null, "tone": "pre", "days": 2, "text": {"pt-BR": "Revisão do POV e proposta de negócio", "en": "POV review and business proposal", "es": "Revisión del POV y propuesta de negocio"}}, {"key": null, "tone": "pre", "days": 2, "text": {"pt-BR": "Trabalho inicial da PoC para o cliente", "en": "Initial PoC work for the customer", "es": "Trabajo inicial de la PoC para el cliente"}}, {"key": null, "tone": "pre", "days": 2, "text": {"pt-BR": "Pré-kickoff da PoC", "en": "PoC pre-kickoff", "es": "Pre-kickoff de la PoC"}}, {"key": "kickoff", "tone": "poc", "days": 2, "text": {"pt-BR": "Reunião 1 da PoC (kickoff) – instalação e onboarding", "en": "PoC meeting 1 (kickoff) – installation and onboarding", "es": "Reunión 1 de la PoC (kickoff) – instalación y onboarding"}}, {"key": null, "tone": "poc", "days": 2, "text": {"pt-BR": "Reunião 2 da PoC – onboarding e revisão de logs", "en": "PoC meeting 2 – onboarding and log review", "es": "Reunión 2 de la PoC – onboarding y revisión de logs"}}, {"key": null, "tone": "poc", "days": 2, "text": {"pt-BR": "Reunião 3 da PoC – revisão de cases e tuning", "en": "PoC meeting 3 – case review and tuning", "es": "Reunión 3 de la PoC – revisión de casos y tuning"}}, {"key": null, "tone": "poc", "days": 2, "text": {"pt-BR": "Reunião 4 da PoC – revisão dos critérios de sucesso", "en": "PoC meeting 4 – success criteria review", "es": "Reunión 4 de la PoC – revisión de los criterios de éxito"}}, {"key": null, "tone": "poc", "days": 2, "text": {"pt-BR": "Reunião 5 da PoC – revisão dos critérios de sucesso", "en": "PoC meeting 5 – success criteria review", "es": "Reunión 5 de la PoC – revisión de los criterios de éxito"}}, {"key": null, "tone": "poc", "days": 2, "text": {"pt-BR": "Reunião 6 da PoC – revisão dos critérios de sucesso", "en": "PoC meeting 6 – success criteria review", "es": "Reunión 6 de la PoC – revisión de los criterios de éxito"}}, {"key": null, "tone": "poc", "days": 2, "text": {"pt-BR": "Reunião 7 da PoC – revisão dos critérios de sucesso", "en": "PoC meeting 7 – success criteria review", "es": "Reunión 7 de la PoC – revisión de los criterios de éxito"}}, {"key": null, "tone": "poc", "days": 2, "text": {"pt-BR": "Reunião 8 da PoC – revisão dos critérios de sucesso", "en": "PoC meeting 8 – success criteria review", "es": "Reunión 8 de la PoC – revisión de los criterios de éxito"}}, {"key": "closeout", "tone": "close", "days": 2, "text": {"pt-BR": "Conclusão da PoC", "en": "PoC completion", "es": "Conclusión de la PoC"}}]$seed$::jsonb) WITH ORDINALITY AS t(e, i);

-- Notebooks started before the PoC Schedule existed get it too.
INSERT INTO poc_milestones (poc_id, position, key, text, days, tone)
SELECT p.id, t.position, t.key, t.text, t.days, t.tone
FROM pocs p CROSS JOIN notebook_template_items t
WHERE p.notebook IS NOT NULL AND t.section = 'schedule' AND NOT t.hidden;
