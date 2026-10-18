# Retention acts only on Closed PoCs

The Retention Period used to delete every Report Data older than it, and then any PoC left with no Report Data and untouched for as long, unless it had a PoC Notebook. That deleted Reports of PoCs still being worked on, and kept Notebook PoCs forever. A PoC now has an explicit lifecycle: it is Active until its Owner or an Admin closes it with a Deal Result (won, lost, no decision), and it can be reopened. Retention acts only on Closed PoCs: once the Retention Period has passed since its closing, the PoC is deleted with everything it holds. Decided by the product owner on 2026-10-18, from item F3 of the architecture review.

## Considered Options

- **Active / Closed / Archived**, where only Archived PoCs are deleted. Rejected: one more step for the same result with about ten Users.
- **Keep the idle rule.** Rejected: it is the cause of the problem.

## Consequences

- An Active PoC is never deleted by retention, however old its Report Data. A PoC nobody closes stays until it is deleted by hand.
- A Closed PoC takes no new Sync; reopening it allows Syncs again and stops the countdown.
- The Retention Period counts from the closing, so changing the setting moves every pending deletion.
- Existing PoCs became Active on the migration: nothing was deleted by the change.
