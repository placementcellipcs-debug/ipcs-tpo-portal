# PostgreSQL cutover preparation

The portal still uses Google Sheets as its live data source. The repository has no `DATABASE_URL`, PostgreSQL driver, or provisioned database, so a live import or read/write cutover cannot safely run from this workspace. `schema.sql` defines a target for a staged migration; it does not connect to or change production data.

## Recommended deployment sequence

1. Provision managed PostgreSQL and store its connection string as a deployment secret named `DATABASE_URL`. Do not add the connection string or student data to Git.
2. Run `schema.sql` against an empty database and verify backups and access controls.
3. Import all sheet rows into `sheet_records`, keyed by workbook, tab, and original row number. The import should upsert on that key and record per-tab source/imported counts in `migration_runs`.
4. Populate the normalized placement tables from the preserved JSON rows. Compare source counts, unique keys, and sampled records with the admin Placement Reconciliation page.
5. Deploy a dual-write adapter with an outbox/retry mechanism. Do not switch reads while Sheets writes are still the only durable copy.
6. Cut over one module at a time after reconciliation succeeds. Keep Sheets as a read-only export/rollback copy until the agreed rollback period ends.

## Data rules captured in the schema

- `placement_records` preserves one source record per `TPO_Log` row.
- `placed_placement_records` includes only rows whose normalized `Status` is exactly `Placed`.
- `joining_status` and offer states remain distinct from the placed measure.
- Talentino attendance points to a stable session ID.
- Email delivery uses a unique delivery key and explicit `review` state so a worker restart cannot silently resend an uncertain delivery.

This migration is intentionally not activated by application code until a database endpoint is provisioned and the import has been checked against the source sheets.
