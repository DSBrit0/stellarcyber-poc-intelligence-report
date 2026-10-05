# The Notebook Template lives in the database and is edited by an Admin

The PoC Process checklist and the PoC Schedule milestones come from the field team's spreadsheet. The team wants to hide, remove, add and reorder items without waiting for a deploy. The template is therefore stored in the database and edited in the Admin area, not kept as code or JSON. Each PoC Notebook copies the template when it starts, so later template edits never change an existing Notebook. Within a single Notebook, its Sales Engineer, its Owner or an Admin can adjust the items further. Only the pt-BR text of an item is required; en and es fall back to it when blank. That keeps the three-language upkeep light. The items seeded from the spreadsheet ship translated into all three languages.

## Considered Options

- **The template in code (shared i18n JSON).** Rejected. Every hide, remove or add would need a developer and a deploy.
