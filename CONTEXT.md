# Stellar Cyber POV Intelligence Portal

Internal tool for Stellar Cyber Sales Engineers and Partners: it connects to a customer's Stellar Cyber platform through its API, collects evidence from a PoC period and produces the final PoC Report.

## Language

### People and access

**User**:
A person who signs in to this tool: a Stellar Cyber Sales Engineer or a Partner.
_Avoid_: Account, login, customer

**Role**:
The level of access a User has: Admin, Sales Engineer, Partner or Customer. Only an Admin changes a User's Role.
_Avoid_: Permission, group

**Admin**:
A User who approves registrations, manages Users and settings, and can see every PoC.

**Root Administrator**:
The built-in Admin account (`administrator@stellarcyber.ai`, "Administrator") every installation has from the start. Its Role never changes, it is never disabled or deleted, it signs in with MFA like everyone, and it is the only User who changes their own password on screen (ADR 0013).
_Avoid_: Super user, master account

**Sales Engineer**:
A Stellar Cyber employee who runs PoCs. Sees the PoCs they own, plus the PoCs and Customers of the Users of the Partner Companies they registered.
_Avoid_: SE (allowed only as an abbreviation)

**Partner**:
A reseller's staff member who runs PoCs, usually a User of a Partner Company. Sees only the PoCs they own.

**Company**:
An organisation registered in advance by a Sales Engineer or Partner (its Customer Owner), with a Profile of Customer or Partner. Every User who joins it with its Access Key takes its Profile as their Role; changing the Profile changes all of them.
_Avoid_: Account, organisation, tenant

**Customer**:
A Company with the Customer Profile: a company evaluating Stellar Cyber. Linking a PoC to a Customer is optional for the Report flow and required for a PoC Notebook; when it is linked, that Customer's Customer Users can reach the PoC.
_Avoid_: Client, account, tenant (a Tenant is a data partition in an Instance)

**Partner Company**:
A Company with the Partner Profile: a reseller whose Users become Partners. The Sales Engineer who registered it follows its Users' PoCs. A Customer that buys and becomes a Partner Company keeps, read-only, the PoCs it was evaluated in; it cannot turn back into a Customer while its Users own PoCs or Companies.

**Customer Owner**:
The User who registered a Company. They approve the Users who join it.

**Access Key**:
A secret the Customer Owner generates for a Company and hands over at the first meeting. A Registration that gives the Company's name and its Access Key is linked to that Company.
_Avoid_: Invite code, password

**Customer User**:
A User with the Customer Role: someone from a Customer who can view, download and comment on the Reports of the PoCs linked to their Customer, and view and edit every part of those PoCs' PoC Notebooks. Nothing else.

**Comment**:
A remark a User leaves on a Report. An **Internal Comment** stays in the app; a **Report Comment** is a change note that creates a new minor Report Version and is printed in the Report's version history. Staff can mark an Internal Comment **Private**: the Customer Users do not see it.

**Report Version**:
The version of a Report, major.minor: the major number counts the Reports (data collections) of the PoC, the minor number the Report Comments on that Report. Version 1.0 is the first Report with no Report Comment.
_Avoid_: Report Data version (the format of the stored data, unrelated)

**Registration**:
A self-service request to become a User. It stays Pending until an Admin approves or rejects it.
_Avoid_: Signup, invite

**Owner**:
The User who created a PoC and its Reports.
_Avoid_: Author, creator

**Stellar Credential**:
A Scoped API Key, or a username and token, that grants access to a Stellar Cyber Instance's API. It is distinct from the User's own sign-in.
_Avoid_: Login, password, token

**Audit Event**:
A record of something a User did that matters for accountability, such as signing in, approving a User, or deleting a Report.

**API Call**:
One request the app made to an Instance, recorded with its outcome and latency, and tied to the Sync or the User that made it.

**App Log**:
A line of the application's own log, with a level (debug, info, warn, error) and a category. It is kept for the Retention Period, debug lines for 7 days.
_Avoid_: Audit Event (an App Log describes the system, not a User's act)

### Stellar Cyber platform

**Instance**:
One Stellar Cyber deployment, identified by its base URL.
_Avoid_: Platform, server, environment

**Tenant**:
A data partition inside an Instance (`cust_id`). Every collection is scoped to exactly one Tenant.
_Avoid_: Customer, cust

**Tenant Group**:
A label that groups Tenants inside an Instance and holds no data of its own.

**Case**:
A correlated incident in Stellar Cyber, made of one or more Alerts and rated by Severity.
_Avoid_: Incident, ticket

**Alert**:
A single detection inside a Case, tagged with MITRE ATT&CK or XDR Kill Chain tactics and techniques.
_Avoid_: Event, detection

**Severity**:
One of Critical, High, Medium or Low on a Case.

**Connector**:
An integration that sends logs or data from a third-party source into an Instance.

**Data Sensor**:
A Stellar Cyber sensor (modular, device or server agent) that collects data into an Instance.
_Avoid_: Agent, probe

**Ingestion**:
Raw bytes received from Data Sensors and Connectors, measured before enrichment.

**Licensing Volume**:
GB per day stored after enrichment and compression. It is the figure used for license compliance.
_Avoid_: Ingestion (they are different measurements)

**Asset Count**:
The number of licensed assets observed per day.
_Avoid_: Entity count

**License Compliance**:
The assessment of Asset Count or Licensing Volume against the licensed amount under the Stellar 7.0 tolerance rule, with the levels Warning, Violation and Out of Compliance.

### PoC and reporting

**PoC**:
Shown to people as **PoV** (Proof of Value) since 2026-10-28; the code, URLs and database keep PoC (ADR 0017). One customer's evaluation of Stellar Cyber, owned by a User. It starts either as a PoC Notebook, with no Tenant yet, or straight in the Report flow; a Report always covers one Tenant over a period of up to 30 days. It holds the customer details, contacts, success criteria and Verdict. A PoC is Active until its Owner or an Admin closes it with a Deal Result; a Closed PoC can be reopened.
_Avoid_: Project, trial, evaluation

**Closed PoC**:
A PoC its Owner or an Admin has closed, with a Deal Result. It takes no new Sync, and it is deleted with everything it holds once the Retention Period has passed since its closing, unless it is reopened first.
_Avoid_: Archived, finished, encerrada (in English text)

**Deal Result**:
How a Closed PoC ended commercially: Won, Lost or No decision. Not the Verdict, which is the technical outcome.
_Avoid_: Outcome, verdict

**PoC Notebook**:
The working record of a PoC from planning to closeout, kept with the customer: overview, Data Sources and Connectors, Success Criteria and Use Cases, Meeting Notes, PoC Process and PoC Schedule. It shares the PoC's details (customer, contacts, success criteria) with the PoC's Reports, so they are entered once. A PoC Notebook always belongs to a Customer; a PoC started straight in the Report flow may have none.
_Avoid_: Tracker, spreadsheet, test notebook, caderno de teste

**PoC Schedule**:
The PoC Notebook's milestones, from PoC Start Day to PoC Completion. Its dates are suggested from the PoC start date, on Mondays, Wednesdays and Fridays; a date set by hand moves only that milestone. Every milestone after the start day stands for one phase of the PoC Process: it disappears with its phase, and it is done once every item of that phase is completed or not applicable.
_Avoid_: Timeline, Gantt, POV Schedule

**Notebook Template**:
The Admin-maintained list of PoC Process items and PoC Schedule milestones that a new PoC Notebook starts from. Hiding, removing or adding an item affects only PoC Notebooks started afterwards. Within one PoC Notebook, only its Sales Engineer, its Owner or an Admin can hide, remove or add items; the Partner and Customer Users fill them in.

**Data Source Catalog**:
The list of Stellar Cyber log parsers (with their ports) and Connectors, read every week from the official documentation pages an Admin points it to. A PoC Notebook picks its Data Sources and Connectors from it; an entry that later leaves the documentation stays in the PoCs that use it, marked as removed.
_Avoid_: Integrations list, parser list

**Draft PoC**:
A PoC whose first Sync was started but whose details were never saved. It shows in the list marked as a draft, so it can be resumed or deleted.
_Avoid_: Incomplete PoC, pending PoC

**Sync**:
One collection run that pulls a PoC's period data from the Instance API and condenses it into Report Data.
_Avoid_: Refresh, import, fetch

**Report Data**:
The frozen set of figures that one Sync collected for a PoC, together with the status of each Success Criterion at that moment when the PoC has a PoC Notebook. A PoC without one has Success Criteria but no statuses. A Report renders it together with the PoC's current details, so the Report can be regenerated without contacting the Instance again.
_Avoid_: Raw data, cache, dump

**Report**:
The rendering of Report Data in a given Template and language. It can be viewed as a responsive page or exported to PDF, and both show the same content.
_Avoid_: Export, document

**Retention Period**:
How long a Closed PoC is kept, counted from its closing; the default is 90 days and an Admin can change it at any time. When it ends, the PoC and everything it holds (Report Data, PoC Notebook, Stellar Experiences) are permanently deleted. An Active PoC is never deleted by it. Audit events, API calls and logs are kept for the same period.
_Avoid_: TTL, expiry

**Template**:
The layout of a Report. Technical and Executive are carried over from the previous tool; Insight is the new redesign.

**Verdict**:
The PoC outcome: Approved, Conditional or Rejected.

**Auto Triage**:
Stellar Cyber's AI verdict on a Case: True Positive, False Positive, Benign or Inconclusive. It requires an add-on license. It is collected only by a Sync started while the Owner has confirmed that Auto Triage was tested in the PoC; each Report shows what its own Sync collected.
_Avoid_: AI Triage, Triagem por IA

**Effort Premises**:
The assumed analyst minutes per Alert and per Case, used to estimate the effort avoided.

**Detection Story**:
The five-part executive narrative in the Executive Template: signal funnel, top threats, priority matrix, response scorecard and effort avoided.

### Stellar Experience

**Stellar Experience**:
A live, guided 3D walk through the Stellar Cyber data pipeline that a Sales Engineer runs with a Customer during a PoC Notebook. The Sales Engineer enables it, leads it and finishes it; the Customer Users of the PoC follow along on their own screens and answer its questions. A PoC Notebook can have several (for example one with the technical team and one with the executives), each with its own answers. It is Disabled, Active or Finished: only an Active one takes answers, a Finished one replays read-only, and the Sales Engineer can reopen it. It keeps the list of Stages chosen when it was enabled, so a later change to the Stages never alters it. Partners cannot run one.
_Avoid_: Architecture Tour, demo, presentation

**Presenter**:
The Sales Engineer leading a Stellar Experience. Every other participant's view follows the Presenter's screen: the current Stage, the Briefing topics, the scene, the side panel open or folded, the Record Trace replays, the Spotlight, the Stack layer under the Presenter's pointer and how far each panel is scrolled. Only the camera (turning, moving and zooming the Stack) stays each participant's own.
_Avoid_: Host, driver

**Spotlight**:
The item the Presenter points at during a Stellar Experience (an Interflow field or mapping, a Record Trace step, the Case, a Briefing topic, an Answer, a Customer Question), framed on every participant's screen and scrolled into view. Opening a Briefing topic or picking an Answer puts it in the Spotlight; clicking an item again, or changing Stage, phase or scene, clears it.
_Avoid_: Highlight, selection

**Stage**:
One step of a Stellar Experience, such as Data Sources, Normalization, Detection or Response. Each Stage opens on its Briefing; the Presenter then opens its question, and moves on only once an Answer is approved or the Stage is Skipped. The Closing's Stages ask no question.
_Avoid_: Step, phase, scene

**Answer**:
One participant's reply to a Stage's question. Every participant sends their own; the Sales Engineer or a Customer User approves one (or, for a list question, several, merged) as the **Approved Answer**. Approved Data Sources are written to the PoC Notebook's Data Sources.
_Avoid_: Response (a Response is a remediation action)

**Briefing**:
The technical explanation that opens a Stage: how the technology works, what it brings to the SOC, the SOC objectives it serves, the frameworks that back it and the ATT&CK techniques it helps detect or contain. Its topics start summarized on one line each; the Presenter opens each one while explaining it, and every participant's view follows. It ends with the Stage's official documentation.
_Avoid_: Intro, slide

**Engine Chamber**:
Shown on screen as "Data ingestion". A way into the Stack: the Presenter enters a Data Source or a Stage and everyone is taken inside its engine, where raw records cross it and come out as Interflow, field by field.

**Record Trace**:
Shown on screen as "Pipeline". The other way into the Stack: one record leaves a Data Source and flies down the same tunnel through one ring per engine, its Interflow growing at each one, until it becomes part of a Case and triggers a response.

**Customer Question**:
A question any participant writes during a Stage, kept with the Stellar Experience and seen by everyone. The Sales Engineer gives it a **Reply** in writing or marks it answered live; one left without either is pending follow-up.
_Avoid_: Answer (an Answer replies to the Stage's own question), comment

**Skipped**:
A Stage the Presenter moved past without an Approved Answer.

**Closing**:
The last Chapter of a Stellar Experience, off the 3D Stack: the **Topology** Stage shows how Stellar Cyber is deployed (Modular and Server Sensors, API integrations, normalization into the platform), and the **Lab** Stage shows the lab environment and its attack chain and invites the participants to it (coe.stellarcyber.cloud). Its Stages ask no question: the Presenter moves on from their Briefing, and they are never Skipped or approved. They have no side panel.
_Avoid_: Outro, wrap-up slide

**Participant**:
Anyone in an Active Stellar Experience session, seen through their live-state polling (present if seen in the last 30 seconds). On the Lab Stage the Presenter sees every Participant's e-mail to invite them, and each Customer User confirms their own **Lab Access** with a thumbs-up.

**Current MTTD**:
The Customer's own figure for their mean time to detect, given in a Stellar Experience together with the time each manual phase takes them today. The detection gain shown is the time of the phases Stellar Cyber automates, from the Customer's own figures; the Experience never shows a reference figure of its own.

**Chapter**:
One of the three layers of Stellar Cyber's Multi-Layer AI™ Stack that group the Stages, named as in the Multi-Layer AI v4 brief (June 2026): AI-Native Data Engine, Open XDR Platform and Autonomous SOC.

**Audience Profile**:
Technical or Executive, chosen when a Stellar Experience is created. It only pre-selects the Stages; the questions are the same.
