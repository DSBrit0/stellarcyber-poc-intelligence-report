# A built-in Root Administrator that cannot be locked out

Every installation has one Root Administrator: `administrator@stellarcyber.ai`, named "Administrator", created at the first start, with its first password taken from `ROOT_PASSWORD`. It is the operator's way in when every other Admin is gone or locked out.

It is protected from the actions that would remove that way in:
- Its Role stays Admin.
- It cannot be disabled or deleted.

It signs in with MFA like every User (ADR 0007); another Admin can reset its MFA if its authenticator is lost. It is the only account that changes its own password on screen. Every other User keeps the reset-link flow.

An installation that existed before this decision turned its first Admin into the Root Administrator.
