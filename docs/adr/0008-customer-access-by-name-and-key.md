# Customer Users are linked by company name plus an Access Key, and approved by the Customer Owner

A Customer User must see only the Reports of their own company. A company name typed at Registration is not proof of anything, because anyone can type any name. The name is therefore paired with an Access Key, which the Customer Owner generates and hands over in person at the first PoC meeting. Only the SHA-256 of the key is stored, and it can be regenerated. Even with a matching name and key, the Registration stays pending until the Customer Owner (or an Admin) approves it. A leaked key alone therefore grants nothing.

## Considered Options

- Matching on the e-mail domain: rejected by the product owner, because the SE onboards the customer in a meeting and hands over the key there.
- Name only: rejected, because names can be guessed or spoofed.
