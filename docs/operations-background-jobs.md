# Background jobs and mail delivery

The backend can run as one combined service or split into portal API and one background worker.

| `PORTAL_SERVICE_ROLE` | Portal API | Queue worker | Daily resume/event jobs | Scheduled mail reports |
| --- | --- | --- | --- | --- |
| unset or `all` | Yes | Yes | Yes | Yes |
| `api` | Yes | No | No | No |
| `worker` | Health check only | Yes | Yes | Yes |

Leave the default `all` for the current single-instance deployment. `api` and `worker` are process roles for a future split, but each process still has its own Google Sheets cache and refreshes it locally. Splitting them adds Sheets reads; horizontal API scaling can multiply those reads and risk the existing Sheets quotas. Do not split or scale these roles until a shared database/cache is deployed and the Sheets request budget is checked. The current code has no distributed worker lease; never run multiple worker replicas until the PostgreSQL outbox/locking migration is deployed.

The administrator-only manual resume trigger is separate from the company report. `resumeOnly` startup recovery and manual resume delivery do not send the company report. The company report has a once-per-date guard in the Mail sheet and is also available as an administrator-only action in Placement Reconciliation.

To make an email change fully auditable, each successful placement/status edit writes an event to `Placement_Audit_Log`. If that append fails after the placement itself saves, the response includes a warning and the successful placement is not rolled back.
