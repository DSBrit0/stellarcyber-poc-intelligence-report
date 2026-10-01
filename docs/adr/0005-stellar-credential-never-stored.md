# The Stellar Credential is never stored

A Stellar Credential grants read access to a customer's security data, so a leak of this tool's database must never expose one. The credential is typed for each Sync, sealed with AES-256-GCM using ENCRYPTION_KEY (which lives outside the database) and placed in the Sync job. The worker opens it, keeps it only in memory for the Sync, and deletes the job row when the Sync ends. Regenerating a Report needs no credential, because it renders from the stored Report Data.

## Consequences

- There are no scheduled or unattended Syncs: every Sync has a User present to type the credential.
- Each User types the credential again for every new Sync.
