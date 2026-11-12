# Shared MySQL migration status

**Updated:** 12 November 2026

The Student Portal and TPO Portal use separate APIs and frontends, but are being migrated to one shared MySQL database. Local migration and verification come first; Hostinger setup and production cutover come later. The final target is MySQL as the only live backend, with no Sheets runtime or fallback.

## Current local progress

Selected features have MySQL implementations behind disabled flags:

- TPO placement tracker, deletion request review, and vacancy management.
- TPO staff login and live session/account-status checks.
- TPO staff directory edits, profile photos, monthly target storage, and active-only public placement-team profiles.
- Student registration, sign-in, password recovery, and session invalidation.
- Student leave history/submission and TPO academic leave listing/review now use the shared `student_leave_requests` table behind `MYSQL_STUDENT_LEAVE_ENABLED` in both APIs. The staged `Leave_Applications` tab has one row linked to a student profile; the rollback-only Student request and TPO review checks passed. The older TPO `08_Leave_Requests` tab was not present in the local source archive, so historical rows from that tab still need to be staged and reconciled before enabling the shared flag. Training, batches, topics, sessions, attendance and diary in the same academic screen still read from Sheets.
- Student support issue submission and TPO issue resolution share the normalized `support_issues` table. Seven archived issues were imported, each linked to a student profile. Student submission and TPO list/status/remarks/audit checks passed inside rollback transactions. This remains behind `MYSQL_SUPPORT_ISSUES_ENABLED` in both APIs.
- TPO event calendar create/list/cancel/reschedule now has a MySQL path on the shared `drives` table. The Student Portal event listing and RSVP service reads both imported event snapshots and TPO-created MySQL events. Local rollback checks verified create, list, reschedule, cancel, mail status, audit, branch/course visibility, RSVP and rollback. Keep `MYSQL_TPO_EVENTS_ENABLED=false` until `MYSQL_EMAIL_ENABLED=true` and the shared dataset is reconciled.

The shared schema and imported source snapshot are in the Student Portal `database` folder. The refreshed local snapshot contains 8 workbooks, 103 tabs, and 246,113 non-header rows. Normalized imports include student profiles, 7,887 tracker rows, 2,336 placement outcomes, companies, targets, and deletion requests. All source rows remain available for reconciliation. The TPO staff accounts are imported into `users` with password hashes and their profile/scope fields. All Sheets-backed workflows that have not been migrated still depend on the existing Sheet runtime, so do not revoke its credentials or switch production flags yet.

The TPO login slice was verified using the local `ipcs_portal_dev` database in a transaction. It checked username and email lookup, wrong-password rejection, the imported scrypt password format, session/profile reconstruction, role and access scope, `last_login_at`, persistent login audit, session invalidation after password change, and inactive-account rejection. The temporary account and audit entry were rolled back and confirmed absent. The staff directory check also passed create/list/update, profile fields and photo URL, target persistence, sign-in refresh, and inactive-account rejection, then rolled back its test user. Staff directory work is behind `MYSQL_TPO_USER_MANAGEMENT_ENABLED`; it uses the shared `users`, `user_branch_assignments`, and `placement_targets` tables. The mail service now has a separate `MYSQL_EMAIL_ENABLED` path for encrypted outbox storage, retry processing, sender quota usage, provider attempts, and mail history. Its local check passed idempotency, due-job claiming, usage, attempts, and history, cleaned up its synthetic rows, and sent no email. When that flag is on, the MySQL worker does not fall back to the Sheets queue. Scheduled mail reports and status-triggered student emails are not migrated yet. Target assignment emails use the saved active TPO roster only after every active TPO has a valid email and a target for that month. Keep all flags off until the rollback-only checks and data reconciliation pass. No production settings have changed.

The imported tracker source has 1,357 owner labels that were not uniquely matched to an active TPO, so its MySQL list intentionally hides those records from individual TPOs rather than assigning them incorrectly. Those rows remain visible to administrators for review and in the source snapshot. Do not enable the TPO tracker for the team until owner reconciliation is complete.

## Local environment settings

Use the same local database settings in both backend `.env` files. Keep these credentials local and never commit them:

```dotenv
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=ipcs_portal_dev
MYSQL_USER=<your local MySQL user>
MYSQL_PASSWORD=<your local MySQL password>
MYSQL_SSL=false
MYSQL_ENABLED=true
MYSQL_TPO_AUTH_ENABLED=false
MYSQL_TPO_USER_MANAGEMENT_ENABLED=false
MYSQL_EMAIL_ENABLED=false
MYSQL_PLACEMENT_TRACKER_ENABLED=false
MYSQL_VACANCY_MANAGEMENT_ENABLED=false
MYSQL_TPO_EVENTS_ENABLED=false
MYSQL_STUDENT_LEAVE_ENABLED=false
```

The Student Portal also has `MYSQL_STUDENT_AUTH_ENABLED=false`, `MYSQL_STUDENT_LEAVE_ENABLED=false`, `MYSQL_STUDENT_DRIVES_ENABLED=false`, and `MYSQL_SUPPORT_ISSUES_ENABLED=false`. The TPO Portal also has `MYSQL_SUPPORT_ISSUES_ENABLED=false`, `MYSQL_TPO_EVENTS_ENABLED=false`, and `MYSQL_STUDENT_LEAVE_ENABLED=false`. Keep the leave flag off in both backends until the missing TPO leave archive is reconciled and the remaining academic data sources are migrated. Keep the event flag off until the database, active TPO/BM recipients, and MySQL email queue are ready. Talentino schedule and attendance still need migration, so Talentino event creation and status changes are intentionally rejected by the gated MySQL event path until that workflow is migrated. No Vite/browser setting should contain database credentials.

## Local verification

From the TPO Portal `backend` folder:

```powershell
npm test
npm run db:check-placement-approval
npm run db:check-tpo-auth
npm run db:check-admin-users
npm run db:check-email-store
npm run db:check-events
npm run db:check-academic-leave
```

`db:check-tpo-auth` is limited to a loopback MySQL host and the local `ipcs_portal` or `ipcs_portal_dev` database. It writes only a synthetic account inside a transaction and rolls it back.
`db:check-email-store` is also local-only. It inserts one synthetic outbox message, verifies idempotency, queue claiming, attempts, quota usage, and history without sending email, then removes the synthetic rows.

From the Student Portal `backend` folder, preview historical monthly TPO targets captured in the staging snapshot with `npm run db:preview-targets`. Review the counts and months before applying them with `npm run db:load-targets`; the importer upserts on TPO and month, and does not read or write Google Sheets.

From the Student Portal `backend` folder:

```powershell
npm test
npm run db:check-student-auth
npm run db:check-student-leave
npm run db:preview-support-issues
npm run db:check-support-issues
npm run db:check-student-drives
```

## Before Hostinger or production

1. Migrate and reconcile each remaining feature, including scheduled jobs, email queues, admin edits, assets, academic records, student dashboards, and shared placement flows.
2. Verify both portals locally against MySQL only for every feature; include authorization, reports, email sending, retries, and failure recovery.
3. Import and reconcile the final source data while preserving backups. Production should not be switched until both backends are ready to write to the same canonical schema.
4. Configure private server-side MySQL access for both APIs, enable TLS and backups, and deploy only after staging checks succeed.
5. Remove the Sheets fallback and runtime credentials only after all features and scheduled tasks no longer need Google Sheets.

Do not enable `MYSQL_TPO_AUTH_ENABLED` in Render or another live environment as a test. It is a local migration flag until the complete system is ready for a coordinated cutover.
