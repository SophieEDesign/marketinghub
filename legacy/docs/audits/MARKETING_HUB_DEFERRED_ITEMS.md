# Marketing Hub Deferred Items

This pass intentionally keeps the existing engine, schema, and table model unchanged.

## Deferred (schema or engine dependent)

- KPI definitions that require fields not present in a workspace (for example: missing date, status, or reliable linked fields) remain out of scope until field availability is confirmed.
- Supporting table expansion for `Sponsorships` and `Contact` beyond minimal usage is deferred unless explicit approval is given for broader integration patterns.
- Any navigation prominence model requiring a new persisted "pin" or "priority" field is deferred; current implementation uses existing ordering and admin visibility pathways.
- Any new block type contract or query behavior (beyond current list/gallery/calendar/kpi capabilities) is deferred to avoid engine-level changes.
- Any full workflow automation layer (campaign lifecycle automation, SLA alerts, or approval routing) is deferred unless explicitly approved as a separate implementation phase.
