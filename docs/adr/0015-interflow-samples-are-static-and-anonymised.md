# Interflow samples are captured once, anonymised and shipped as static content

The Normalization Stage shows a raw log turning into Interflow for the Customer's chosen Data Sources. Rather than querying an Instance live during the Experience, we capture one real raw log and its Interflow per data-source category (Firewall, EDR, Network/DPI, Cloud, Identity, Email, Web Proxy…) once, replace every IP, hostname, user and domain with coherent fictional values (RFC 5737 addresses, `example.com`), and ship them with the app. Each Data Source Catalog entry maps to a category. A live query would need a Stellar Credential during every Experience, which this tool asks for only to run a Sync (ADR 0009), and would put a customer's real data on a shared screen.

## Consequences

- The samples are real in shape but not in content, and can drift from the newest Interflow version; they are refreshed by capturing again.
- A Data Source with no category of its own shows its category's sample.
- The screen does not say which steps of a sample come from a real capture and which are illustrative (the user had the "real, anonymised" and "illustrative example" marks removed on 2026-10-17). The `real` flag stays in the samples for whoever maintains them.
