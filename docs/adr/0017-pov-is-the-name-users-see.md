# PoV is the name Users see; the code keeps "poc"

The product was renamed on 2026-10-28 by the product owner: it is now the **POV Intelligence Portal**, and what Users, Customers and the Reports call a PoC (Proof of Concept) is now a PoV (Proof of Value; Prova de Valor, Prueba de Valor). Only what people see changed: the three UI catalogues, the Report texts and titles, the help guide, the page title, the PDF file names and the issuer shown in authenticator apps for new MFA enrolments.

The code, the API routes and URLs (`/pocs`), the database (`pocs`, `poc_*`), the Docker images and the server paths (`poc-intel`, `/opt/poc-intel`) keep "poc". In code and in CONTEXT.md, PoC remains the domain term; PoV is its display name.

## Considered Options

- **Rename the code and the URLs too.** Rejected for now: about 1,600 identifiers in 125 files and broken bookmarks, for no change Users can see.
- **Rename everything, database and server included.** Rejected: a maintenance window and data moves on the server for the same visible result.

## Consequences

- New UI text says PoV; code, logs and the database say poc. Do not "fix" one to match the other.
- The Notebook Template's process text is data, written by the field team, and it already uses POV and PoC as two different stages (e.g. "Gap analysis between POV and PoC"). It was not rewritten; Admins change it in Admin → Template.
- MFA entries created before the rename keep the old issuer name in authenticator apps; they still work.
