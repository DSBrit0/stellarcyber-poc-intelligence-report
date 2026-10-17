# A Stellar Experience stays live by polling, not by a push channel

During a Stellar Experience the Presenter's current Stage and every participant's Answers must reach the other screens. We poll the Experience every second while it is Active, the same way the PoC Notebook and Sync progress already refresh, instead of opening WebSockets or Server-Sent Events. About 10 Users use this tool and an Experience has a handful of participants, so the load is negligible. A push channel would add connection state, proxy configuration and reconnect logic to an app that today has none (ADR 0006). A view can trail the Presenter by about a second, which a guided walk-through tolerates.

## Considered Options

- **WebSockets or Server-Sent Events.** Rejected for now: instant updates, but long-lived connections through the reverse proxy and a second delivery path to keep correct. Revisit if Experiences are run with many more participants.

## Consequences

- Polling runs only while an Experience is Active and the page is open; a Finished Experience is read once.
- Answer conflicts never arise: each participant writes their own Answer, and approving one is a separate write.
