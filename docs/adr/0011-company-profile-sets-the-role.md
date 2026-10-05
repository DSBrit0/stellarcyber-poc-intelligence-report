# A Company has a Customer or Partner Profile, and its Users take that Profile as their Role

ADR 0008 linked self-registered Users to a Customer by company name plus an Access Key, and always made them Customer Users. A Sales Engineer therefore could not onboard a reseller's staff that way. Those Partners had to be approved one by one by an Admin, with no link back to the Sales Engineer who works with them. A registered company is now a Company with a Profile, either Customer or Partner, chosen by its Customer Owner. A User who joins with the Company's Access Key gets the matching Role. Changing the Profile changes the Role of every User of that Company, and the change is audited. The Sales Engineer who registered a Partner Company sees the PoCs and Customers of its Users.

## Considered Options

- **Every Sales Engineer sees every Partner's PoCs.** Rejected because it is too broad.
- **An Admin links each Partner User to a Sales Engineer.** Rejected because it is manual upkeep that goes stale.
- **A Role per User, independent of the Company.** Rejected. A mix of Roles inside one Company invites mistakes, and the Profile is a property of the organisation.

Amends ADR 0008: the name-and-key matching and the approval by the Customer Owner are unchanged.
