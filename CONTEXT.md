# Stellar Cyber PoC Intelligence Report

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

**Sales Engineer**:
A Stellar Cyber employee who runs PoCs. Sees only the PoCs they own.
_Avoid_: SE (allowed only as an abbreviation)

**Partner**:
A reseller's staff member who runs PoCs. Sees only the PoCs they own.

**Customer**:
A company evaluating Stellar Cyber, registered in advance by a Sales Engineer or Partner (its Customer Owner). Linking a PoC to a Customer is optional; when it is linked, that Customer's Customer Users can reach the PoC's Reports.
_Avoid_: Client, account, tenant (a Tenant is a data partition in an Instance)

**Customer Owner**:
The User who registered a Customer. They approve that Customer's Customer Users.

**Access Key**:
A secret the Customer Owner generates for a Customer and hands over at the first meeting. A Registration that gives the Customer's name and its Access Key is linked to that Customer.
_Avoid_: Invite code, password

**Customer User**:
A User with the Customer Role: someone from a Customer who can view, download and comment on the Reports of the PoCs linked to their Customer, and nothing else.

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
One customer's evaluation of Stellar Cyber on one Tenant over a period of up to 30 days. It is owned by a User, and holds the customer details, contacts, success criteria and Verdict.
_Avoid_: Project, trial, evaluation

**Draft PoC**:
A PoC whose first Sync was started but whose details were never saved. It shows in the list marked as a draft, so it can be resumed or deleted.
_Avoid_: Incomplete PoC, pending PoC

**Sync**:
One collection run that pulls a PoC's period data from the Instance API and condenses it into Report Data.
_Avoid_: Refresh, import, fetch

**Report Data**:
The frozen set of figures that one Sync collected for a PoC. A Report renders it together with the PoC's current details, so the Report can be regenerated without contacting the Instance again.
_Avoid_: Raw data, cache, dump

**Report**:
The rendering of Report Data in a given Template and language. It can be viewed as a responsive page or exported to PDF, and both show the same content.
_Avoid_: Export, document

**Retention Period**:
How long Report Data is kept and its Reports stay downloadable. An Admin can change it at any time; the default is 90 days. When it ends, the Report Data is permanently deleted.
_Avoid_: TTL, expiry

**Template**:
The layout of a Report. Technical and Executive are carried over from the previous tool; Insight is the new redesign.

**Verdict**:
The PoC outcome: Approved, Conditional or Rejected.

**AI Triage**:
Stellar Cyber's AI verdict on a Case: True Positive, False Positive, Benign or Inconclusive. It is collected only when the Owner marks that AI Triage was tested in the PoC.

**Effort Premises**:
The assumed analyst minutes per Alert and per Case, used to estimate the effort avoided.

**Detection Story**:
The five-part executive narrative in the Executive Template: signal funnel, top threats, priority matrix, response scorecard and effort avoided.
