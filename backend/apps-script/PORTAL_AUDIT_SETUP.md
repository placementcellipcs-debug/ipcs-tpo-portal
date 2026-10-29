# Portal audit sheet setup

The portal backend appends events to the separate `Portal_Audit_Log` tab in the spreadsheet whose ID is configured by `PORTAL_AUDIT_SPREADSHEET_ID`. The current default is the private “Log Sheet” workbook supplied for this audit. The tab and header row are initialized on the first backend log write.

## Deploy the portal code

1. Set `PORTAL_AUDIT_SPREADSHEET_ID` to the audit workbook ID if the default should not be used.
2. Set a long random `PORTAL_AUDIT_INGEST_TOKEN` in the production backend environment. Do not commit the token or place it in frontend code.
3. Deploy the backend and frontend changes. Portal API requests, authenticated and anonymous UI interactions, placement audit events, mail delivery attempts, scheduled jobs, and cache refreshes are then sent to the audit workbook.

The portal service account must retain edit access to the audit workbook. Keep its Google Drive sharing restricted to the owner and the portal service account.

## Capture direct edits to the four Google workbooks

1. Add `PortalAuditBridge.gs` to a standalone Apps Script project that can access the four workbooks listed in that file.
2. In that project's Script Properties, set `PORTAL_AUDIT_API_BASE` to the deployed portal API origin (currently `https://api-placement.ipcstalenzo.com`) and set `PORTAL_AUDIT_INGEST_TOKEN` to the same private value configured on the backend.
3. Run `installPortalAuditTriggers()` once and approve the permissions. This installs edit and sheet-change triggers for the four source workbooks.
4. In each other Apps Script project that writes to those workbooks, copy the `portalAuditAutomation()` and `portalAuditSend_()` helper functions, configure the same Script Properties, then call `portalAuditAutomation()` after each successful automated write or delete. Also call it with result `Error` from failure handling where appropriate.

The installed triggers record manual cell edits and workbook structure changes without recording cell contents. Apps Script edits, Sheets API writes, and other programmatic changes do not fire the edit trigger; those must call `portalAuditAutomation()` from the code that performs the write. Google may also hide the editor's email address from trigger events.

## Delivery limit

The portal retries failed sheet writes in memory and flushes the queue during graceful shutdown. A hard process crash, prolonged Google Sheets outage/quota failure, a browser closed before an interaction batch is sent, or an Apps Script trigger/API failure can still delay or lose an event. A Google Sheet cannot guarantee a lossless, tamper-proof audit stream by itself; the log also needs routine review and export/backup.

## Reading actor and result fields

- `Human`: the live portal session was validated; the name, email, and role come from that account.
- `Signed session (not revalidated)`: the signed portal token identifies an account, but a current account check could not be completed. This can happen while the account cache is loading; it does not mean the request was authorized.
- `Login attempt (not authenticated)`: the submitted login ID is recorded, but the password is never logged and the user was not authenticated.
- `Session claim (not validated)`: an account ID was supplied with an invalid, expired, or uncheckable session.
- `Public visitor`: a stable random browser ID links that browser's public-page activity. It does not identify a real person's name.
- `Bot`: a scheduled task, worker, cache sync, or Apps Script action.

`Unavailable` with HTTP 503 means the portal/cache/sheet data was not ready to serve the request. `Rejected` with HTTP 401/403/429 means authentication, authorization, or rate limits stopped it. For 200 responses, read `Details.reason`: session verification can return HTTP 200 while reporting `valid: false`.
