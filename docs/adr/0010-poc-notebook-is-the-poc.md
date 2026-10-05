# A PoC Notebook is the PoC itself, and the Tenant is required only for a Report

A PoC used to need a Tenant and a period from the start, because it existed only to produce a Report. The PoC Notebook tracks the evaluation from planning onwards, before any Tenant exists. We store it as the same `pocs` row, not as a separate Notebook record linked to a PoC. A PoC therefore starts either as a PoC Notebook, with no Tenant, period or Sync, or straight in the Report flow. "Create the Final Report" on a Notebook asks for the Tenant, the period and the Stellar Credential, and keeps every detail already entered.

## Considered Options

- **A separate Notebook record linked to a PoC.** Rejected. The customer, contacts and Success Criteria would live in two places, or would need copying. The two copies would drift apart, which the product owner explicitly ruled out ("fields are entered once").

## Consequences

- The Tenant and the period columns become nullable. Every Sync path must refuse a PoC that has no Tenant.
- A PoC Notebook must be linked to a Customer. A PoC in the Report flow may have none.
- A Report shows Success Criteria statuses only when the PoC has a Notebook. Those statuses are frozen into the Report Data at Sync time, so a later Notebook edit never changes a delivered Report.
