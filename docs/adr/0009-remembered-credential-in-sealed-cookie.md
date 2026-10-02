# The Stellar Credential may be remembered in the User's browser, sealed by the server

Typing a Scoped API Key for every Sync was too much friction for SEs, who re-Sync the same Instance many times during a PoC. The User can now let their browser remember the credential for 90 days, one cookie per Instance URL.

The server seals the credential with AES-256-GCM, using ENCRYPTION_KEY, and binds it to the User and the Instance through the authenticated data. It sets it as an `HttpOnly; Secure; SameSite=Strict` cookie scoped to `/api`.

- **Still never in the database.** A leaked database holds no Stellar Credential. Only a request from this User's browser, through this server, can use a remembered credential.
- **Page scripts cannot read it.** The cookie is HttpOnly, so an XSS cannot steal it either.
- **It is tied to one User.** Another User who signs in on the same browser cannot use it.
- **It can be forgotten.** "Forget" clears it at once, and rotating ENCRYPTION_KEY voids every remembered credential.

Supersedes ADR 0005.
