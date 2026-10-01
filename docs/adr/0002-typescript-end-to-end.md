# TypeScript end to end

The workload is waiting on a slow external API (I/O-bound), not CPU, so Node's async model is a good fit. Using TypeScript lets the proven aggregation logic of the previous JavaScript tool be ported instead of rewritten. Static types also replace the guesswork about field names in the Stellar Cyber API's responses.

## Considered Options

- Go: better raw concurrency, but every rule (license compliance, Detection Story, i18n) would have to be rewritten. The target load, about 10 concurrent Users, does not need it.
- Python with FastAPI: a fine fit, but it would mean a second language next to the React frontend.
