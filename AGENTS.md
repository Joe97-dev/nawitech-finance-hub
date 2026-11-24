# Architecture rules
- Enforce client registration-fee activation with a database trigger on inserts and status transitions; UI restrictions alone can be bypassed.
- Resolve legacy client fee accounts by normalized name only when that name is unique within the organization; UUID-linked accounts avoid attributing another client's fees.