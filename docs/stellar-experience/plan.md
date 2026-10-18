# Stellar Experience: delivery plan

Terms are defined in `CONTEXT.md` (section "Stellar Experience"); decisions in ADR 0014 and 0015.

## Rules agreed

- Runs on a PoC Notebook. Run by its Sales Engineer (Owner or the SE following the Owner) or an Admin; never by a Partner. Customer Users of the PoC take part.
- Several Experiences per PoC, each named, with an Audience Profile (Technical: all Stages; Executive: Data Sources, Detection, Correlation, Agentic SOC, Response) that pre-selects the Stages; the Presenter can change the selection while Active.
- Disabled → Active → Finished; one Active per PoC; Finished replays read-only and can be reopened. Activate, finish and reopen are Audit Events.
- Every Stage opens on its Briefing, a terminal-style technical explanation (how it works, SOC value, SOC objectives, frameworks, ATT&CK techniques); the Presenter then opens its question. Executive profile: "how it works" and the techniques start folded. References (ATT&CK, NIST CSF 2.0, CIS v8, PCI DSS v4.0, ISO 27001:2022, D3FEND, LGPD) live once in `briefing-refs.ts`, outside the locale files.
- Any participant asks Customer Questions during a Stage; the Sales Engineer replies in writing or marks them answered live, during or after the session; unanswered ones show as pending on the PoC.
- Everything the Presenter does on screen is mirrored: the side panel open or folded, the Record Trace replays, and the Spotlight, a frame on the item the Presenter points at (Interflow fields, trace steps, Briefing topics, Answers, Customer Questions). Also the Stack layer under the Presenter's pointer and how far each panel is scrolled (as a share of its height). Kept in the Experience's `view` (migration 0023), polled with the rest. The camera stays each viewer's own; a small legend in the bottom-right corner explains it.
- The Closing (2026-10-18) ends every Experience, both profiles: Topology (the deployment drawing from the Lab presentation, slide 1) and Lab (the lab network, the Caldera chain, the invitation to coe.stellarcyber.cloud, the session's Participants with e-mails for the Presenter and a thumbs-up for each Customer User). They ask no question and have no side panel; presence and lab access live in `experience_participants` (migration 0024).
- Every Stage asks a question. Each participant sends their own Answer; the Presenter or a Customer User approves one (list questions: several, merged). The Presenter moves forward only past an approved or Skipped Stage. Everyone's view follows the Presenter, polled every second (ADR 0014).
- Approved Data Sources are written to the PoC Notebook's Data Sources. The Notebook shows each Experience's approved Answers, read-only.
- MTTD gain: only the Customer's own figures (current MTTD and the time of each manual phase).
- Interflow samples: one real, anonymised sample per data-source category, static (ADR 0015).

## Stages (code order; each Experience copies its selection)

| Chapter | Stage id | Question | Answer kind |
|---|---|---|---|
| Data Engine | `data_sources` | Which data sources do you have? | data sources (list) |
| | `collection` | Where do they live? | multiple choice |
| | `normalization` | How many tools does an investigation open today? | number |
| | `threat_intel` | Which threat-intelligence feeds do you use? | multiple choice |
| | `enrichment` | Which assets and users are critical? | items (list) |
| | `ingestion_filters` | Up to 3 log types to drop or reduce | filters (list, max 3) |
| | `data_lake` | How long must data be kept? | single choice |
| Open XDR | `ndr` | East-west visibility today? | single choice |
| | `sandbox` | Where do suspicious files arrive? | multiple choice |
| | `fim` | Which servers and files must be watched? | items (list) |
| | `itdr_ueba` | Which anomalous behaviour worries you most? | multiple choice |
| | `detection` | Current MTTD and time per manual phase | MTTD |
| | `correlation` | Alerts per day today? | number |
| Agentic SOC | `agentic_soc` | Minutes to triage a Case today? | number |
| | `response` | Which responses to automate? | multiple choice (options follow the approved Data Sources) |
| Closing | `topology` | (none: presents the deployment topology) | none |
| | `lab` | (none: presents the lab and invites to it) | none |

## Visual direction (brand guidelines 2026 v4)

- Palette: Midnight Blue `#0A1823` (ground), Dark Sky Blue `#3044E0` (structure), Light Sky Blue `#41C5F9` (valid data), Mid Sky Blue `#3295F8`, AI Purple `#9320E0` (ML/AI only), Solar Orange `#FF9B1D` → Burnt Orange `#F05B2A` (threats, alerts, the Case), Silver `#FAFAF4` (text). Official gradients only.
- Type: Roboto 400/500/700, one family.
- The memorable element is the Multi-Layer AI™ Stack in 3D: glass slabs grouped in three Chapters; the camera climbs slab by slab; the ingestion tunnel enters at the base; NDR, Sandbox, FIM, ITDR/UEBA and TI orbit the Open XDR layer; the Case forms at the top. Everything else stays quiet: one glass HUD panel, a Stage rail, the Blades as background.
- Reduced motion or small screens: no tunnel, no depth of field or chromatic aberration.

## Slices (each validated on the local server before the next)

1. **Model and live session.** Migration, shared Stage definitions and Answer schemas, API (create, activate/finish/reopen, Stage selection, Answers, approve, skip, Presenter navigation, live state), access rules with tests, Experience tab on the PoC page, "live" entry for Customer Users, full-screen route with the HUD (questions, Answers, approval, Presenter controls) over a static on-brand background. i18n en/es/pt-BR.
2. **3D Stack.** Lazy-loaded R3F scene: Stack, Chapters, Stage focus driven by the Presenter, GSAP camera moves, satellites, Blades background, bloom; reduced-motion path.
3. **Entering objects: Engine Chamber and Record Trace (Q38–Q40; both kept).** The Presenter clicks a Data Source tile or a Stage's plate and everyone goes in with them. A, "engine chamber": a tunnel where raw records cross the engine's ring and leave as Interflow, with the raw → Interflow mapping beside it. B, "record trace": one record climbs the Stack engine by engine while its Interflow grows field by field, up to the Case and the response. Both stay: the Presenter switches between them. They run on illustrative samples marked on screen until the real captures (slice 4).
4. **Real Interflow (done for network and endpoint, 2026-10-17).** `apps/server/src/cli/capture-interflow.ts` reads the latest record per family from an Instance's Data Lake (read-only; credential from the environment only), keeps an allowlist of fields, anonymises values and the raw log, and writes `apps/web/src/pages/experience/content/interflow-captured.json`. Review the output before committing it. Network (Modular Sensor flow + its real alert) and endpoint (Cylance Optics detection) are real up to detection; Case, triage and response, and the firewall story, stay illustrative and are marked as such per step.
   Ingestion tunnel per approved Data Source: still to do. Tunnel per approved Data Source; capture and anonymise the Interflow samples (needs a Stellar Credential from the user at capture time); category mapping from the Data Source Catalog; the raw → Interflow HUD with highlighting.
5. **Per-Stage scenes.** Filters cutting particles, TI stamping, sandbox detonation, FIM, UEBA baseline, Detection with the MTTD gain, Graph ML Case built from the Customer's sources, Agentic SOC, Response playbooks firing back at the sources.
6. **Notebook section and finish.** Read-only Experience section in the PoC Notebook, replay of Finished Experiences, technical-claims review list for the user, performance pass.

## Visual lab

The 3D look is tuned without a server, database, login or live session: in a dev build, `/lab/experience` runs the real Experience page over an in-memory server (`apps/web/src/pages/experience/lab/`). Its state comes from the URL (`?profile=&stage=&phase=&model=&target=kind:key&open=topic`), so any scene can be reached and re-shot. `npm run lab:shots -w @poc-intel/web` takes screenshots of the key states with the installed Chrome into `apps/web/.lab-shots/`. Production builds drop the route and its code.
