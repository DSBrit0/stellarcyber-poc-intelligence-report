# Two separate authentication layers: User sign-in and Stellar Credential

A User signs in to the tool with a local account; Google SSO will be added later, and the design is ready for it. Separately, the User supplies a Stellar Credential to reach an Instance. The previous tool had only the second layer, so it could not control who used it or keep a User's past Reports. Keeping the two layers apart means a User's identity never depends on which Instances that User can reach.
