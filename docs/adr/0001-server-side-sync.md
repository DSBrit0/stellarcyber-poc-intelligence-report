# Sync runs on the server, not in the browser

The previous tool (stellarcyber-poc-report) ran every API call, aggregation and PDF render in the user's browser behind an open CORS proxy. As a result, a Sync took 1.5 to 5 minutes, was lost when the tab closed, was never reused, and the proxy was an unauthenticated relay. In this tool, the browser only starts a Sync and watches its progress. A background worker calls the Instance API, condenses the results into Report Data and stores it. The PDF is rendered on the server from that stored Report Data.
