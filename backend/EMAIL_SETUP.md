# IPCS email account setup

## Sender routing

| Purpose | Portal sender key | Account |
| --- | --- | --- |
| Drive notices and reminders | `placement` | `placementcell.ipcs@gmail.com` |
| Company and MOU messages | `company` | `corporate.ipcs@gmail.com` |
| Interviews and registration confirmations | `recruitment` | `interview.ipcs@gmail.com` |
| Welcome, Talentino, and account messages | `portal` | `portal.ipcs@gmail.com` |
| Shared fallback for any category | `fallback` | `giftyipcsglobal@gmail.com` |

The address written as `interview\.ipcs@gmail.com` in the request is configured as `interview.ipcs@gmail.com`.

## 1. Prepare all five Google accounts

The account owner (or an administrator with access to each account) must authorize its own sender. The portal cannot create App Passwords or grant Google authorization on your behalf.

For SMTP fallback, sign in to each account, enable 2-Step Verification, then create an App Password in Google Account security. Use a separate App Password for each account and save it in the backend environment. If Google does not offer App Passwords for an account, that account can still use its Apps Script sender; SMTP fallback for that account will be unavailable.

Do not put passwords or script secrets in source files, screenshots, or chat. Store them in `backend/.env` for local use and in the deployment host's secret/environment settings in production. Do not commit `.env`.

## 2. Create one Apps Script deployment per account

There is no email Apps Script project in the repository today. Use [apps-script/Code.gs](<apps-script/Code.gs>) as the source for separate email projects. Keep the existing Apps Script project and deployment untouched for now: the code you pasted includes Drive upload and password-reset behavior, and `config.js` still uses the existing deployment for file uploads. One email project cannot send as five unrelated Gmail accounts: each email deployment must run as the account that owns it.

The pasted source contains several functions named `doPost`. If these are all in one Apps Script project (even if split across multiple `.gs` files), they conflict: a web app has one `doPost` entry point, so the code should be combined behind one dispatcher before replacing anything. Do not append the new `Code.gs` to that project. The safe setup is to create separate email projects from the supplied template and leave the current Drive/reset project in place. If you later choose to reuse the current placement deployment, first consolidate its Drive upload and password-reset routes with the new email action in a single `doPost` dispatcher and test all three operations.

For each of the five accounts, do the following:

1. Sign in to that Gmail account and open [script.google.com](https://script.google.com/).
2. Create a new standalone project. Replace its `Code.gs` contents with the repository file.
3. Save the project. In **Project Settings → Script Properties**, add `MAIL_API_SECRET` with a unique, randomly generated secret of at least 32 characters. This is separate from the existing `RESET_MAIL_SHARED_SECRET`; do not replace or reuse the reset-mail secret. Keep the new value for the backend settings in step 3.
4. In **Deploy → New deployment**, choose **Web app**. Set **Execute as** to **Me** (the account currently signed in). Set access to **Anyone** so the backend can call it; the endpoint rejects requests without the secret. If your Google account policy does not allow this access setting, ask the account/domain administrator to allow a server-to-server web app deployment.
5. Authorize the requested mail and external-fetch permissions. `UrlFetchApp` is used only when an email attachment is a URL.
6. Deploy and copy the URL ending in `/exec`. Do not use the `/dev` test URL in the backend.
7. Repeat for placement, corporate, interview, portal, and Gifty fallback accounts. Use different secrets for all five deployments.

The script has two actions. `quota` reports the executing account's current `MailApp.getRemainingDailyQuota()` value; `send` checks that value under a lock, then sends the message. `MailApp` sends from the account that owns the deployment.

## 3. Configure backend secrets

Copy the relevant entries from [`.env.example`](<.env.example>) into `backend/.env` (local) or the production host's environment settings. Put each Apps Script `/exec` URL in the matching URL variable and the same secret you entered in that project's Script Properties in the matching `*_APPS_SCRIPT_SECRET` variable.

Required variable pairs:

| Account | SMTP App Password | Apps Script URL | Apps Script secret |
| --- | --- | --- | --- |
| Placement | `PLACEMENT_APP_PASSWORD` | `PLACEMENT_APPS_SCRIPT_URL` | `PLACEMENT_APPS_SCRIPT_SECRET` |
| Corporate | `COMPANY_APP_PASSWORD` | `COMPANY_APPS_SCRIPT_URL` | `COMPANY_APPS_SCRIPT_SECRET` |
| Interview | `INTERVIEW_APP_PASSWORD` | `INTERVIEW_APPS_SCRIPT_URL` | `INTERVIEW_APPS_SCRIPT_SECRET` |
| Portal | `PORTAL_APP_PASSWORD` | `PORTAL_APPS_SCRIPT_URL` | `PORTAL_APPS_SCRIPT_SECRET` |
| Gifty fallback | `FALLBACK_APP_PASSWORD` | `FALLBACK_APPS_SCRIPT_URL` | `FALLBACK_APPS_SCRIPT_SECRET` |

NodeMailer requires the matching `*_APP_PASSWORD` to be present. Render Free web services block outbound SMTP on ports 25, 465, and 587, so SMTP cannot work on that plan even with valid credentials; see [Render's free service limits](https://render.com/docs/free). The current transport uses port 465.

Set `MAIL_QUEUE_ENCRYPTION_KEY` to a stable secret and keep it unchanged while queued messages exist. Set the production environment too, then restart the backend so it loads the new values.

## 4. How delivery and failover work

For each email, the backend selects the sender mapped to its category and tries, in order:

1. That account's Apps Script deployment, if configured.
2. Gmail SMTP over IPv4, then IPv6, if Apps Script reports a definitive failure (including a quota rejection) or the backend has a recent quota reading that is too small for the message.
3. The shared fallback account's Apps Script deployment, followed by its SMTP routes if needed.

An Apps Script quota rejection is definitive: the script refused that message before calling `MailApp.sendEmail`, so the backend may safely try SMTP. An uncertain provider timeout remains different: the provider may have accepted the message, so the backend marks it for review and stops before trying another sender. A recent Apps Script remaining-recipient value is cached for 30 minutes to avoid calling an exhausted endpoint for every message; a message that fits the cached remainder may still use Apps Script.

When all configured senders are out of quota, the message is stored encrypted in the `EmailQueue` sheet. Quota failures are checked again hourly by default; other temporary network failures use the shorter retry interval. Once a sender has room, the queued message is delivered. If a provider's response leaves delivery uncertain, the backend marks it for review and does not retry or fail over automatically, because the provider may already have accepted it. Check that account's Sent folder and the recipient before retrying manually. The usage dashboard classifies these outcomes as `Review`.

Successful sends and quota-exhaustion observations are recorded in the `EmailQuotaUsage` sheet, including sender, provider, recipient count, portal-tracked remaining count, and the Apps Script remaining count when Apps Script handled the send. Provider-level results, including failed IPv4/IPv6 attempts, quota rejections, fallback success, and uncertain outcomes, are recorded in `MailDeliveryAttempts` with a shared `DeliveryID`. `Mail` keeps the final user-facing outcome; `EmailQueue` keeps only messages awaiting automatic retry or review. The backend creates these sheets if needed.

## 5. What “100 per day” means

Google currently documents the Apps Script `MailApp` quota as **100 recipients per day for consumer accounts** and **1,500 for Google Workspace accounts**. This counts recipients (To, CC, and BCC), not just messages; the documented quota resets 24 hours after the first request and Google can change quotas. [Google Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas) · [MailApp quota API](https://developers.google.com/apps-script/reference/mail/mail-app).

The backend conservatively caps its own sends at 100 unique recipients per sender over a rolling 24-hour window by default (`MAIL_ACCOUNT_DAILY_RECIPIENT_CAP`). The Apps Script route also reports Google's live quota. Gmail does not provide this backend an exact remaining SMTP quota API, so SMTP “remaining” is the portal's own tracked estimate. It cannot include messages sent manually or by other applications. Gmail's general account sending limits are separate and vary by account and use; do not treat 100 as a guaranteed Gmail SMTP limit. [Gmail sending limits](https://support.google.com/mail/answer/22839).

## 6. Smoke-check each Apps Script deployment

After deploying and setting backend variables, the backend can send the first message in that category through its Apps Script endpoint and log the remaining quota. For a manual endpoint check, send a JSON POST with `action: "quota"` and the account's secret to its `/exec` URL using a REST client. A successful response contains `success: true` and `remainingRecipients`. Do not paste the secret into a public URL or browser address bar.

Then send one test message to an address you control from each category and confirm the From address, CC/BCC behavior, any attachment, and the `EmailQuotaUsage` entry. Test Gifty fallback separately before relying on it for production delivery.
