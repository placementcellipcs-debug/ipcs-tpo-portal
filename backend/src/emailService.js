const axios = require('axios');
const nodemailer = require('nodemailer');
const { createCipheriv, createDecipheriv, createHash, randomBytes } = require('crypto');
const { Readable } = require('stream');
const { createMailReportService } = require('./mailReportService');

const SENDER_CONFIG = {
  placement: {
    prefix: 'PLACEMENT',
    email: 'placementcell.ipcs@gmail.com',
    emailCategory: 'placementNotification',
    appPassword: 'PLACEMENT_APP_PASSWORD'
  },
  company: {
    prefix: 'COMPANY',
    email: 'corporate.ipcs@gmail.com',
    emailCategory: 'companyMou',
    appPassword: 'COMPANY_APP_PASSWORD'
  },
  recruitment: {
    prefix: 'INTERVIEW',
    email: 'interview.ipcs@gmail.com',
    emailCategory: 'interviewSchedule',
    appPassword: 'INTERVIEW_APP_PASSWORD'
  },
  portal: {
    prefix: 'PORTAL',
    email: 'portal.ipcs@gmail.com',
    emailCategory: 'welcomeEmail',
    appPassword: 'PORTAL_APP_PASSWORD'
  },
  fallback: {
    prefix: 'FALLBACK',
    email: 'giftyipcsglobal@gmail.com',
    emailCategory: 'sharedFallback',
    appPassword: 'FALLBACK_APP_PASSWORD',
    fallback: true
  }
};

const QUEUE_HEADERS = [
  'ID', 'Category', 'EmailCategory', 'Payload', 'Context', 'Status', 'Attempts',
  'NextAttemptAt', 'CreatedAt', 'UpdatedAt', 'LastError', 'Provider',
  'LogName', 'LogEmail', 'MailType'
];
const USAGE_HEADERS = [
  'ID', 'SenderKey', 'EmailCategory', 'SenderEmail', 'Provider',
  'RecipientCount', 'TrackedRemaining', 'AppsScriptRemaining', 'SentAt'
];
const ATTEMPT_HEADERS = [
  'AttemptID', 'DeliveryID', 'Category', 'EmailCategory', 'SenderKey', 'SenderEmail',
  'Provider', 'Outcome', 'RecipientCount', 'AppsScriptRemaining', 'AttemptedAt',
  'Subject', 'Error', 'MessageID'
];
const MAX_CELL_CHARS = 45000;

const createEmailService = ({ doc, drive, loadDocInfo, refreshCache, formatIndiaTimestamp, sheetsApi, getSpreadsheetIdForSheetName }) => {
  const transports = new Map();
  let queueSheetPromise = null;
  let usageSheetPromise = null;
  let attemptSheetPromise = null;
  let workerTimer = null;
  let workerRunning = false;

  const queueSheetName = String(process.env.MAIL_QUEUE_SHEET || 'EmailQueue').trim() || 'EmailQueue';
  const usageSheetName = String(process.env.MAIL_USAGE_SHEET || 'EmailQuotaUsage').trim() || 'EmailQuotaUsage';
  const accountRecipientCap = Math.max(1, Number(process.env.MAIL_ACCOUNT_DAILY_RECIPIENT_CAP) || 100);
  const quotaWindowMs = 24 * 60 * 60 * 1000;
  const usageSnapshotTtlMs = 30 * 1000;
  const maxAttempts = Math.max(1, Number(process.env.MAIL_MAX_ATTEMPTS) || 8);
  const baseDelaySeconds = Math.max(10, Number(process.env.MAIL_RETRY_BASE_SECONDS) || 60);
  const quotaDelaySeconds = Math.max(baseDelaySeconds, Number(process.env.MAIL_QUOTA_RETRY_SECONDS) || 3600);
  const workerIntervalMs = Math.max(60_000, Number(process.env.MAIL_WORKER_INTERVAL_MS) || 60_000);
  const categoryAliases = Object.fromEntries(Object.entries(SENDER_CONFIG).map(([key, sender]) => [sender.emailCategory.toLowerCase(), key]));
  const senderQueues = new Map();
  const usageSnapshots = new Map();
  const appsScriptQuotaSnapshots = new Map();
  const unpersistedUsage = [];
  const appsScriptQuotaSnapshotTtlMs = 30 * 60 * 1000;

  const normalizeHeader = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const isValidAddress = address => {
    const atIndex = address.indexOf('@');
    if (atIndex < 1 || atIndex !== address.lastIndexOf('@')) return false;
    const local = address.slice(0, atIndex);
    const domain = address.slice(atIndex + 1);
    if (!/^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local) || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false;
    const labels = domain.split('.');
    return labels.length > 1 && labels.every(label => /^[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?$/i.test(label));
  };
  const splitAddresses = value => {
    const values = Array.isArray(value) ? value : String(value || '').split(/[;,]+/);
    const unique = new Map();
    for (const item of values) {
      // Sheet and form values sometimes include sentence punctuation, e.g.
      // "support@example.com.". Remove delimiters before validating/sending.
      const address = String(item || '').trim().replace(/[\s.,;]+$/, '');
      if (isValidAddress(address)) unique.set(address.toLowerCase(), address);
    }
    return [...unique.values()];
  };
  const cleanRecipients = value => splitAddresses(value).join(',');
  const queueEncryptionKey = () => {
    const seed = process.env.MAIL_QUEUE_ENCRYPTION_KEY || process.env.AUTH_SESSION_SECRET || process.env.GOOGLE_PRIVATE_KEY;
    if (!seed) throw new Error('Configure MAIL_QUEUE_ENCRYPTION_KEY to encrypt queued email content.');
    return createHash('sha256').update('IPCS:EMAIL:QUEUE:V1\0').update(String(seed)).digest();
  };
  const encryptPayload = serialized => {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', queueEncryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(serialized, 'utf8'), cipher.final()]);
    return JSON.stringify({
      format: 'ipcs-email-queue-v1',
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      data: encrypted.toString('base64')
    });
  };
  const decryptPayload = parsed => {
    if (parsed?.format !== 'ipcs-email-queue-v1') return parsed;
    const decipher = createDecipheriv('aes-256-gcm', queueEncryptionKey(), Buffer.from(parsed.iv, 'base64'));
    decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'));
    const clear = Buffer.concat([
      decipher.update(Buffer.from(parsed.data, 'base64')),
      decipher.final()
    ]).toString('utf8');
    return JSON.parse(clear);
  };

  const getSender = category => {
    const normalizedCategory = String(category || '').trim().toLowerCase();
    const senderKey = categoryAliases[normalizedCategory] || normalizedCategory;
    const config = SENDER_CONFIG[senderKey];
    if (!config) throw new Error(`Unknown email sender category: ${category || '(empty)'}`);

    const email = String(process.env[`${config.prefix}_EMAIL`] || config.email).trim();
    let appPassword = String(process.env[config.appPassword] || '').trim();

    // Keep the existing placement-cell Gmail login working when it is the same account.
    if (category === 'placement' && !appPassword && String(process.env.EMAIL_USER || '').trim().toLowerCase() === email.toLowerCase()) {
      appPassword = String(process.env.EMAIL_PASS || '').trim();
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Configure a valid ${config.prefix}_EMAIL address.`);
    return { ...config, category: senderKey, email, appPassword };
  };

  const getTransport = (sender, family) => {
    if (!sender.appPassword) throw new Error(`Configure ${sender.appPasswordEnv || sender.prefix + '_APP_PASSWORD'} for ${sender.category} email.`);
    const transportKey = `${sender.category}:ipv${family}`;
    if (!transports.has(transportKey)) {
      transports.set(transportKey, nodemailer.createTransport({
        pool: true,
        maxConnections: 1,
        maxMessages: 100,
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        family,
        connectionTimeout: 12000,
        greetingTimeout: 12000,
        socketTimeout: 30000,
        auth: { user: sender.email, pass: sender.appPassword }
      }));
    }
    return transports.get(transportKey);
  };

  const formatSenderName = from => {
    if (from && typeof from === 'object') return String(from.name || '').trim();
    const text = String(from || '');
    return (text.includes('<') ? text.slice(0, text.indexOf('<')) : text).replace(/["']/g, '').trim();
  };

  const toPersistableMail = mailOptions => ({
    fromName: formatSenderName(mailOptions.from),
    to: cleanRecipients(mailOptions.to),
    cc: cleanRecipients(mailOptions.cc),
    bcc: cleanRecipients(mailOptions.bcc),
    replyTo: cleanRecipients(mailOptions.replyTo),
    subject: String(mailOptions.subject || ''),
    text: mailOptions.text ? String(mailOptions.text) : '',
    html: mailOptions.html ? String(mailOptions.html) : '',
    attachments: (Array.isArray(mailOptions.attachments) ? mailOptions.attachments : []).map(attachment => {
      const saved = {
        filename: String(attachment.filename || 'attachment'),
        contentType: String(attachment.contentType || attachment.content_type || 'application/octet-stream')
      };
      if (attachment.content !== undefined && attachment.content !== null) {
        const content = Buffer.isBuffer(attachment.content)
          ? attachment.content
          : Buffer.from(String(attachment.content), String(attachment.encoding || '').toLowerCase() === 'base64' ? 'base64' : 'utf8');
        saved.contentBase64 = content.toString('base64');
      } else if (attachment.contentBytes !== undefined && attachment.contentBytes !== null) {
        saved.contentBase64 = Buffer.isBuffer(attachment.contentBytes)
          ? attachment.contentBytes.toString('base64')
          : String(attachment.contentBytes);
      } else if (attachment.href || attachment.path) {
        saved.href = String(attachment.href || attachment.path);
      } else {
        throw new Error(`Attachment ${saved.filename} has no content or URL.`);
      }
      return saved;
    })
  });

  const fromPersistableMail = (mail, sender) => ({
    from: { name: mail.fromName || 'IPCS Global', address: sender.email },
    to: mail.to,
    cc: mail.cc,
    bcc: mail.bcc,
    replyTo: mail.replyTo,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    attachments: (mail.attachments || []).map(attachment => attachment.contentBase64
      ? { filename: attachment.filename, contentType: attachment.contentType, content: Buffer.from(attachment.contentBase64, 'base64') }
      : { filename: attachment.filename, contentType: attachment.contentType, path: attachment.href })
  });

  const isQuotaError = error => {
    const value = [error?.message, error?.code, error?.response?.data?.error, error?.response?.data?.message]
      .filter(Boolean).join(' ').toLowerCase();
    return error?.code === 'QUOTA_EXCEEDED' || /quota|too many (?:times|messages)|daily.{0,30}(?:limit|email)|sending limit|5\.4\.5/.test(value);
  };
  const isPasswordResetMail = (category, subject) => category === 'portal'
    && /password.{0,20}reset|reset.{0,20}password/i.test(String(subject || ''));

  const isRetryable = error => {
    if (error?.retryable === true) return true;
    if (error?.retryable === false) return false;
    if (isQuotaError(error)) return true;
    if ([408, 425, 429].includes(Number(error?.response?.status))) return true;
    if (Number(error?.response?.status) >= 500) return true;
    if ([421, 450, 451, 452].includes(Number(error?.responseCode))) return true;
    const code = String(error?.code || '').toUpperCase();
    if (['EAI_AGAIN', 'ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH'].includes(code)) return true;
    // Only retry timeouts/resets if SMTP confirms failure before message delivery.
    // Once DATA may have been accepted, automatic retry could send a duplicate.
    return ['ETIMEDOUT', 'ECONNABORTED', 'ECONNRESET', 'ECONNECTION', 'ESOCKET'].includes(code)
      && ['CONN', 'EHLO', 'STARTTLS'].includes(String(error?.command || '').toUpperCase());
  };

  const getQueueSheet = async () => {
    if (!queueSheetPromise) {
      queueSheetPromise = (async () => {
        await loadDocInfo();
        let sheet = doc.sheetsByTitle[queueSheetName];
        if (!sheet) {
          try {
            sheet = await doc.addSheet({ title: queueSheetName, headerValues: QUEUE_HEADERS });
          } catch (error) {
            await loadDocInfo();
            sheet = doc.sheetsByTitle[queueSheetName];
            if (!sheet) throw error;
          }
        }
        await sheet.loadHeaderRow();
        const headers = [...(sheet.headerValues || [])];
        const missing = QUEUE_HEADERS.filter(header => !headers.some(existing => normalizeHeader(existing) === normalizeHeader(header)));
        if (missing.length) {
          const requiredColumns = headers.length + missing.length;
          if ((Number(sheet.columnCount) || 0) < requiredColumns) await sheet.resize({ columnCount: requiredColumns });
          await sheet.setHeaderRow([...headers, ...missing]);
          await sheet.loadHeaderRow();
        }
        return sheet;
      })().catch(error => {
        queueSheetPromise = null;
        throw error;
      });
    }
    return queueSheetPromise;
  };

  const getUsageSheet = async () => {
    if (!usageSheetPromise) {
      usageSheetPromise = (async () => {
        await loadDocInfo();
        let sheet = doc.sheetsByTitle[usageSheetName];
        if (!sheet) {
          try {
            sheet = await doc.addSheet({ title: usageSheetName, headerValues: USAGE_HEADERS });
          } catch (error) {
            await loadDocInfo();
            sheet = doc.sheetsByTitle[usageSheetName];
            if (!sheet) throw error;
          }
        }
        await sheet.loadHeaderRow();
        const headers = [...(sheet.headerValues || [])];
        const missing = USAGE_HEADERS.filter(header => !headers.some(existing => normalizeHeader(existing) === normalizeHeader(header)));
        if (missing.length) {
          const requiredColumns = headers.length + missing.length;
          if ((Number(sheet.columnCount) || 0) < requiredColumns) await sheet.resize({ columnCount: requiredColumns });
          await sheet.setHeaderRow([...headers, ...missing]);
          await sheet.loadHeaderRow();
        }
        return sheet;
      })().catch(error => {
        usageSheetPromise = null;
        throw error;
      });
    }
    return usageSheetPromise;
  };

  const getAttemptSheet = async () => {
    if (!attemptSheetPromise) {
      attemptSheetPromise = (async () => {
        await loadDocInfo();
        let sheet = doc.sheetsByTitle.MailDeliveryAttempts;
        if (!sheet) {
          try {
            sheet = await doc.addSheet({ title: 'MailDeliveryAttempts', headerValues: ATTEMPT_HEADERS });
          } catch (error) {
            await loadDocInfo();
            sheet = doc.sheetsByTitle.MailDeliveryAttempts;
            if (!sheet) throw error;
          }
        }
        await sheet.loadHeaderRow();
        const headers = [...(sheet.headerValues || [])];
        const missing = ATTEMPT_HEADERS.filter(header => !headers.some(existing => normalizeHeader(existing) === normalizeHeader(header)));
        if (missing.length) {
          const requiredColumns = headers.length + missing.length;
          if ((Number(sheet.columnCount) || 0) < requiredColumns) await sheet.resize({ columnCount: requiredColumns });
          await sheet.setHeaderRow([...headers, ...missing]);
          await sheet.loadHeaderRow();
        }
        return sheet;
      })().catch(error => {
        attemptSheetPromise = null;
        throw error;
      });
    }
    return attemptSheetPromise;
  };

  const recordProviderAttempt = async ({ deliveryId, category, sender, provider, outcome, recipientCount, emailCategory, remainingRecipients = '', subject, error = '', messageId = '' }) => {
    try {
      const sheet = await getAttemptSheet();
      await sheet.addRow({
        AttemptID: randomBytes(12).toString('hex'),
        DeliveryID: deliveryId,
        Category: category,
        EmailCategory: emailCategory,
        SenderKey: sender.category,
        SenderEmail: sender.email,
        Provider: provider,
        Outcome: outcome,
        RecipientCount: recipientCount,
        AppsScriptRemaining: remainingRecipients === '' ? '' : Math.max(0, Number(remainingRecipients) || 0),
        AttemptedAt: new Date().toISOString(),
        Subject: String(subject || '').slice(0, 500),
        Error: String(error?.message || error || '').slice(0, 1500),
        MessageID: String(messageId || '')
      });
    } catch (logError) {
      console.error(`[MAIL ATTEMPT] Could not record ${provider} ${outcome} for ${sender.email}:`, logError.message);
    }
  };

  const getAppsScriptConfig = sender => ({
    url: String(process.env[`${sender.prefix}_APPS_SCRIPT_URL`] || '').trim(),
    secret: String(process.env[`${sender.prefix}_APPS_SCRIPT_SECRET`] || '').trim()
  });

  const countRecipients = mail => new Set([
    ...splitAddresses(mail?.to),
    ...splitAddresses(mail?.cc),
    ...splitAddresses(mail?.bcc)
  ].map(address => address.toLowerCase())).size;

  const getUsageSnapshot = async senderKey => {
    const sender = getSender(senderKey);
    const now = Date.now();
    let snapshot = usageSnapshots.get(senderKey);
    if (!snapshot || snapshot.expiresAt <= now) {
      const sheet = await getUsageSheet();
      const rows = await sheet.getRows();
      const cutoff = now - quotaWindowMs;
      const sheetUsedRecipients = rows.reduce((total, row) => {
        if (String(row.get('SenderKey') || '').trim().toLowerCase() !== senderKey.toLowerCase()) return total;
        const sentAt = Date.parse(row.get('SentAt') || '');
        if (!Number.isFinite(sentAt) || sentAt < cutoff) return total;
        return total + Math.max(0, Number(row.get('RecipientCount')) || 0);
      }, 0);
      snapshot = { sheetUsedRecipients, expiresAt: now + usageSnapshotTtlMs };
      usageSnapshots.set(senderKey, snapshot);
    }
    const cutoff = now - quotaWindowMs;
    const memoryUsage = unpersistedUsage.reduce((total, entry) =>
      entry.senderKey === senderKey && entry.sentAt >= cutoff ? total + entry.recipientCount : total, 0);
    const usedRecipients = snapshot.sheetUsedRecipients + memoryUsage;
    return {
      senderKey,
      emailCategory: sender.emailCategory,
      email: sender.email,
      usedRecipients,
      trackedRemaining: Math.max(0, accountRecipientCap - usedRecipients),
      cap: accountRecipientCap
    };
  };

  const withSenderLock = async (senderKey, action) => {
    const previous = senderQueues.get(senderKey) || Promise.resolve();
    let release;
    const current = new Promise(resolve => { release = resolve; });
    senderQueues.set(senderKey, current);
    await previous.catch(() => {});
    try {
      return await action();
    } finally {
      release();
      if (senderQueues.get(senderKey) === current) senderQueues.delete(senderKey);
    }
  };

  const recordUsage = async (sender, provider, recipientCount, appScriptRemaining = '', emailCategory = sender.emailCategory) => {
    const sentAt = new Date().toISOString();
    try {
      const current = await getUsageSnapshot(sender.category);
      const trackedRemaining = Math.max(0, current.trackedRemaining - recipientCount);
      const sheet = await getUsageSheet();
      await sheet.addRow({
        ID: randomBytes(12).toString('hex'),
        SenderKey: sender.category,
        EmailCategory: emailCategory,
        SenderEmail: sender.email,
        Provider: provider,
        RecipientCount: recipientCount,
        TrackedRemaining: trackedRemaining,
        AppsScriptRemaining: appScriptRemaining === '' ? '' : Math.max(0, Number(appScriptRemaining) || 0),
        SentAt: sentAt
      });
      const snapshot = usageSnapshots.get(sender.category);
      if (snapshot) {
        snapshot.sheetUsedRecipients += recipientCount;
        snapshot.expiresAt = Date.now() + usageSnapshotTtlMs;
      }
    } catch (error) {
      unpersistedUsage.push({ senderKey: sender.category, recipientCount, sentAt: Date.parse(sentAt) });
      usageSnapshots.delete(sender.category);
      console.error(`[MAIL QUOTA] Delivery succeeded via ${provider}, but usage could not be saved for ${sender.email}:`, error.message);
    }
  };

  const recordQuotaObservation = async (sender, provider, appScriptRemaining = '', emailCategory = sender.emailCategory) => {
    const current = await getUsageSnapshot(sender.category);
    const sheet = await getUsageSheet();
    if (provider === 'apps-script' && appScriptRemaining !== '' && Number.isFinite(Number(appScriptRemaining))) {
      appsScriptQuotaSnapshots.set(sender.category, {
        remainingRecipients: Math.max(0, Number(appScriptRemaining)),
        expiresAt: Date.now() + appsScriptQuotaSnapshotTtlMs
      });
    }
    await sheet.addRow({
      ID: randomBytes(12).toString('hex'),
      SenderKey: sender.category,
      EmailCategory: emailCategory,
      SenderEmail: sender.email,
      Provider: `quota-exhausted:${provider}`,
      RecipientCount: 0,
      TrackedRemaining: current.trackedRemaining,
      AppsScriptRemaining: appScriptRemaining === '' ? '' : Math.max(0, Number(appScriptRemaining) || 0),
      SentAt: new Date().toISOString()
    });
  };

  const putPayloadInDrive = async (id, serialized) => {
    const folderId = String(process.env.MAIL_QUEUE_DRIVE_FOLDER_ID || '').trim();
    const body = {
      name: `email-queue-${id}.json`,
      mimeType: 'application/json',
      appProperties: { purpose: 'queued-email-payload', queueId: id }
    };
    if (folderId) body.parents = [folderId];
    const response = await drive.files.create({
      requestBody: body,
      media: { mimeType: 'application/json', body: Readable.from([Buffer.from(serialized, 'utf8')]) },
      fields: 'id'
    });
    if (!response.data?.id) throw new Error('Could not store the large email payload securely in Google Drive.');
    return response.data.id;
  };

  const savePayload = async (id, mail) => {
    const serialized = encryptPayload(JSON.stringify(mail));
    if (serialized.length <= MAX_CELL_CHARS) return { value: serialized, driveFileId: '' };
    const driveFileId = await putPayloadInDrive(id, serialized);
    return { value: JSON.stringify({ storage: 'drive', fileId: driveFileId }), driveFileId };
  };

  const readPayload = async storedValue => {
    const stored = JSON.parse(String(storedValue || '{}'));
    if (stored.storage === 'drive' && stored.fileId) {
      const response = await drive.files.get({ fileId: stored.fileId, alt: 'media' }, { responseType: 'arraybuffer' });
      return decryptPayload(JSON.parse(Buffer.from(response.data).toString('utf8')));
    }
    return decryptPayload(stored);
  };

  const deletePayloadFile = async storedValue => {
    try {
      const stored = JSON.parse(String(storedValue || '{}'));
      if (stored.storage === 'drive' && stored.fileId) await drive.files.delete({ fileId: stored.fileId });
    } catch (error) {
      console.warn('[MAIL QUEUE] Could not remove a completed email payload from Drive:', error.message);
    }
  };

  const appScriptAttachments = attachments => (attachments || []).map(attachment => {
    if (attachment.content !== undefined && attachment.content !== null) {
      const content = Buffer.isBuffer(attachment.content)
        ? attachment.content
        : Buffer.from(String(attachment.content), String(attachment.encoding || '').toLowerCase() === 'base64' ? 'base64' : 'utf8');
      return { filename: attachment.filename || 'attachment', mimeType: attachment.contentType || 'application/octet-stream', contentBytes: content.toString('base64') };
    }
    if (attachment.contentBytes !== undefined && attachment.contentBytes !== null) {
      const content = Buffer.isBuffer(attachment.contentBytes) ? attachment.contentBytes.toString('base64') : String(attachment.contentBytes);
      return { filename: attachment.filename || 'attachment', mimeType: attachment.contentType || 'application/octet-stream', contentBytes: content };
    }
    const href = attachment.href || attachment.path;
    if (/^https?:\/\//i.test(String(href || ''))) return { filename: attachment.filename || 'attachment', href: String(href) };
    throw new Error(`Apps Script cannot use the local path for ${attachment.filename || 'attachment'}.`);
  });

  const sendViaAppsScript = async (sender, mail) => {
    const { url, secret } = getAppsScriptConfig(sender);
    if (!url || !secret) throw new Error(`${sender.prefix}_APPS_SCRIPT_URL and ${sender.prefix}_APPS_SCRIPT_SECRET are not configured.`);

    try {
      const response = await axios.post(url, {
        action: 'send',
        secret,
        fromName: mail.fromName || 'IPCS Global',
        to: mail.to,
        cc: mail.cc,
        bcc: mail.bcc,
        replyTo: mail.replyTo,
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        attachments: appScriptAttachments(mail.attachments)
      }, { timeout: 30000 });
      if (response.data?.success !== true) {
        const error = new Error(response.data?.error || response.data?.message || 'Apps Script rejected the email.');
        error.code = response.data?.code;
        error.remainingRecipients = response.data?.remainingRecipients;
        error.retryable = isQuotaError(error) || [429, 500, 502, 503, 504].includes(Number(response.status));
        throw error;
      }
      return {
        provider: 'apps-script',
        messageId: response.data.messageId || '',
        remainingRecipients: response.data.remainingRecipients
      };
    } catch (error) {
      if (error.response && error.retryable === undefined) {
        error.retryable = Number(error.response.status) === 429 || Number(error.response.status) >= 500;
      }
      throw error;
    }
  };

  const isAmbiguousDelivery = error => {
    if (error?.ambiguousDelivery === true) return true;
    const code = String(error?.code || '').toUpperCase();
    const command = String(error?.command || '').toUpperCase();
    if (['ETIMEDOUT', 'ECONNABORTED', 'ECONNRESET'].includes(code)) {
      return !['CONN', 'EHLO', 'STARTTLS', 'AUTH', 'MAIL FROM', 'RCPT TO'].includes(command);
    }
    if (error?.isAxiosError && !error.response) {
      return !['EAI_AGAIN', 'ECONNREFUSED', 'ENETUNREACH', 'EHOSTUNREACH', 'ENOTFOUND'].includes(code);
    }
    if (error?.isAxiosError && Number(error.response?.status) >= 500 && error.response?.data?.success !== false) return true;
    return command === 'DATA';
  };

  const sendThroughAccount = async (sender, mail, recipientCount, emailCategory, deliveryId, deliveryCategory) => {
    const usage = await getUsageSnapshot(sender.category);
    if (usage.trackedRemaining < recipientCount) {
      await recordQuotaObservation(sender, 'portal-cap', '', emailCategory);
      const error = Object.assign(new Error(`${sender.email} reached the portal quota safety cap of ${accountRecipientCap} recipients in the rolling 24-hour window.`), {
        code: 'QUOTA_EXCEEDED', retryable: true
      });
      await recordProviderAttempt({
        deliveryId, category: deliveryCategory, sender, provider: 'portal-cap', outcome: 'QUOTA_REJECTED',
        recipientCount, emailCategory, subject: mail.subject, error
      });
      throw error;
    }

    const appsScript = getAppsScriptConfig(sender);
    const providerErrors = [];
    const cachedAppsScriptQuota = appsScriptQuotaSnapshots.get(sender.category);
    const cachedRemaining = cachedAppsScriptQuota && cachedAppsScriptQuota.expiresAt > Date.now()
      ? cachedAppsScriptQuota.remainingRecipients
      : null;
    if (cachedAppsScriptQuota && cachedAppsScriptQuota.expiresAt <= Date.now()) appsScriptQuotaSnapshots.delete(sender.category);

    if (appsScript.url && appsScript.secret && (cachedRemaining === null || cachedRemaining >= recipientCount)) {
      try {
        const result = await sendViaAppsScript(sender, mail);
        if (result.remainingRecipients !== undefined && Number.isFinite(Number(result.remainingRecipients))) {
          appsScriptQuotaSnapshots.set(sender.category, {
            remainingRecipients: Math.max(0, Number(result.remainingRecipients)),
            expiresAt: Date.now() + appsScriptQuotaSnapshotTtlMs
          });
        }
        await recordUsage(sender, result.provider, recipientCount, result.remainingRecipients, emailCategory);
        await recordProviderAttempt({
          deliveryId, category: deliveryCategory, sender, provider: result.provider, outcome: 'SENT',
          recipientCount, emailCategory, remainingRecipients: result.remainingRecipients,
          subject: mail.subject, messageId: result.messageId
        });
        return { ...result, senderKey: sender.category, senderEmail: sender.email };
      } catch (error) {
        if (isQuotaError(error)) {
          if (error.remainingRecipients !== undefined && Number.isFinite(Number(error.remainingRecipients))) {
            appsScriptQuotaSnapshots.set(sender.category, {
              remainingRecipients: Math.max(0, Number(error.remainingRecipients)),
              expiresAt: Date.now() + appsScriptQuotaSnapshotTtlMs
            });
          }
          try {
            await recordQuotaObservation(sender, 'apps-script', error.remainingRecipients, emailCategory);
          } catch (logError) {
            console.error(`[MAIL QUOTA] Could not record Apps Script quota status for ${sender.email}:`, logError.message);
          }
          error.retryable = true;
          error.code = error.code || 'QUOTA_EXCEEDED';
          await recordProviderAttempt({
            deliveryId, category: deliveryCategory, sender, provider: 'apps-script', outcome: 'QUOTA_REJECTED',
            recipientCount, emailCategory, remainingRecipients: error.remainingRecipients,
            subject: mail.subject, error
          });
          providerErrors.push(error);
        } else if (isAmbiguousDelivery(error)) {
          error.ambiguousDelivery = true;
          await recordProviderAttempt({
            deliveryId, category: deliveryCategory, sender, provider: 'apps-script', outcome: 'REVIEW',
            recipientCount, emailCategory, subject: mail.subject, error
          });
          throw error;
        } else {
          await recordProviderAttempt({
            deliveryId, category: deliveryCategory, sender, provider: 'apps-script', outcome: 'FAILED',
            recipientCount, emailCategory, subject: mail.subject, error
          });
          providerErrors.push(error);
        }
      }
    } else if (appsScript.url && appsScript.secret && cachedRemaining !== null && cachedRemaining < recipientCount) {
      const error = Object.assign(new Error(`Apps Script quota cache has ${cachedRemaining} recipient(s) left; this message needs ${recipientCount}.`), {
        code: 'QUOTA_EXCEEDED', retryable: true
      });
      providerErrors.push(error);
      await recordProviderAttempt({
        deliveryId, category: deliveryCategory, sender, provider: 'apps-script', outcome: 'SKIPPED_KNOWN_QUOTA',
        recipientCount, emailCategory, remainingRecipients: cachedRemaining,
        subject: mail.subject, error
      });
    }

    const fromName = mail.fromName || formatSenderName(mail.from) || 'IPCS Global';
    const mailPayload = { ...mail };
    delete mailPayload.fromName;
    const message = {
      ...mailPayload,
      from: { name: fromName, address: sender.email },
      to: cleanRecipients(mail.to),
      cc: cleanRecipients(mail.cc),
      bcc: cleanRecipients(mail.bcc)
    };
    if (!sender.appPassword) {
      const error = new Error(`Configure ${sender.appPasswordEnv || sender.prefix + '_APP_PASSWORD'} for ${sender.category} email.`);
      providerErrors.push(error);
      await recordProviderAttempt({
        deliveryId, category: deliveryCategory, sender, provider: 'smtp-config', outcome: 'FAILED',
        recipientCount, emailCategory, subject: mail.subject, error
      });
    } else {
      for (const family of [4, 6]) {
        const provider = `smtp-ipv${family}`;
        try {
          const result = await getTransport(sender, family).sendMail(message);
          await recordUsage(sender, provider, recipientCount, '', emailCategory);
          await recordProviderAttempt({
            deliveryId, category: deliveryCategory, sender, provider, outcome: 'SENT',
            recipientCount, emailCategory, subject: mail.subject, messageId: result.messageId
          });
          return { provider, messageId: result.messageId || '', senderKey: sender.category, senderEmail: sender.email };
        } catch (error) {
          if (isQuotaError(error)) {
            try {
              await recordQuotaObservation(sender, provider, '', emailCategory);
            } catch (logError) {
              console.error(`[MAIL QUOTA] Could not record ${provider} quota status for ${sender.email}:`, logError.message);
            }
            await recordProviderAttempt({
              deliveryId, category: deliveryCategory, sender, provider, outcome: 'QUOTA_REJECTED',
              recipientCount, emailCategory, subject: mail.subject, error
            });
            throw error;
          }
          if (isAmbiguousDelivery(error)) {
            error.ambiguousDelivery = true;
            await recordProviderAttempt({
              deliveryId, category: deliveryCategory, sender, provider, outcome: 'REVIEW',
              recipientCount, emailCategory, subject: mail.subject, error
            });
            throw error;
          }
          await recordProviderAttempt({
            deliveryId, category: deliveryCategory, sender, provider, outcome: 'FAILED',
            recipientCount, emailCategory, subject: mail.subject, error
          });
          providerErrors.push(error);
        }
      }
    }

    if (providerErrors.length === 0) {
      providerErrors.push(new Error(`No delivery provider is configured for ${sender.email}.`));
    }

    const error = new Error(providerErrors.map(item => item.message).filter(Boolean).join(' | ') || `No delivery provider is configured for ${sender.email}.`);
    error.retryable = providerErrors.some(isRetryable);
    error.providerErrors = providerErrors;
    throw error;
  };

  const sendNow = async (category, mail, deliveryId = randomBytes(12).toString('hex')) => {
    const sender = getSender(category);
    if (!splitAddresses(mail.to).length) throw new Error('A valid recipient email address is required.');
    if (!String(mail.subject || '').trim()) throw new Error('An email subject is required.');
    const recipientCount = countRecipients(mail);
    const emailCategory = sender.emailCategory;
    const attempts = [];
    const senderKeys = sender.category === 'fallback' ? ['fallback'] : [sender.category, 'fallback'];

    for (const senderKey of senderKeys) {
      try {
        const result = await withSenderLock(senderKey, () => sendThroughAccount(getSender(senderKey), mail, recipientCount, emailCategory, deliveryId, sender.category));
        return { ...result, deliveryId };
      } catch (error) {
        if (isAmbiguousDelivery(error)) {
          const reviewError = new Error(`Delivery outcome is uncertain for ${getSender(senderKey).email}. Check its Sent folder and the recipient before retrying. Original error: ${error.message}`);
          reviewError.ambiguousDelivery = true;
          reviewError.retryable = false;
          reviewError.code = 'DELIVERY_UNCERTAIN';
          reviewError.deliveryId = deliveryId;
          throw reviewError;
        }
        attempts.push({ senderKey, error });
        console.warn(`[MAIL] Delivery ${deliveryId}: ${getSender(senderKey).email} failed; checking the next configured sender: ${error.message}`);
      }
    }

    const error = new Error(attempts.map(item => `${getSender(item.senderKey).email}: ${item.error.message}`).join(' | ') || 'No sender account could deliver this email.');
    error.retryable = attempts.some(item => isRetryable(item.error) || item.error?.retryable === true);
    error.deliveryId = deliveryId;
    if (attempts.every(item => isQuotaError(item.error))) error.code = 'QUOTA_EXCEEDED';
    throw error;
  };

  const appendMailLog = async (details, status, subject) => {
    if (!details) return;
    try {
      const sheet = doc.sheetsByTitle.Mail;
      if (!sheet) return;
      await sheet.addRow({
        TimeStamp: formatIndiaTimestamp(),
        'Reciver Name': details.name || 'Unknown',
        'Reciver Mail': details.email || 'Unknown',
        'Mail Type': details.type || 'System Alert',
        Subject: subject || 'Notification',
        Status: status
      });
    } catch (error) {
      console.error('[MAIL] Could not record email status:', error.message);
    }
  };

  const updateEventMailStatus = async (context, status, errorMessage = '') => {
    if (!context?.eventId && !context?.sheetName) return;
    try {
      await loadDocInfo();
      const allowedSheets = new Set(['Event', 'Clients', 'Corporate Training Inquiries', 'Hiring Inquiries']);
      if (context.sheetName && !allowedSheets.has(context.sheetName)) return;
      const sheet = doc.sheetsByTitle[context.sheetName || 'Event'];
      if (!sheet) return;
      await sheet.loadHeaderRow();
      const headers = sheet.headerValues || [];
      const findHeader = aliases => headers.find(header => aliases.includes(normalizeHeader(header)));
      const idHeader = context.idHeader
        ? headers.find(header => normalizeHeader(header) === normalizeHeader(context.idHeader))
        : findHeader(['eventid', 'event_id']);
      const statusHeader = context.statusHeader
        ? headers.find(header => normalizeHeader(header) === normalizeHeader(context.statusHeader))
        : findHeader(['mailstatus']);
      const errorHeader = context.errorHeader
        ? headers.find(header => normalizeHeader(header) === normalizeHeader(context.errorHeader))
        : findHeader(['mailerror']);
      const sentAtHeader = context.sentAtHeader
        ? headers.find(header => normalizeHeader(header) === normalizeHeader(context.sentAtHeader))
        : findHeader(['mailsentat']);
      const hasRowNumber = Number.isInteger(Number(context.rowNumber)) && Number(context.rowNumber) > 0;
      if (!idHeader && !hasRowNumber) return;
      const rows = await sheet.getRows();
      const row = hasRowNumber
        ? rows.find(item => Number(item.rowNumber) === Number(context.rowNumber))
        : rows.find(item => String(item.get(idHeader) || '').trim() === String(context.eventId || context.idValue || '').trim());
      if (!row) return;
      const prefix = String(context.statusPrefix || '').trim();
      const statusErrorPrefix = status === 'REVIEW'
        ? String(context.reviewValuePrefix || 'Review: ')
        : String(context.failedValuePrefix || '');
      const hasDeliveryError = status === 'FAILED' || status === 'REVIEW';
      const statusText = context.statusValues?.[status]
        || (status === 'FAILED' && context.failedValuePrefix
          ? `${context.failedValuePrefix}${String(errorMessage).slice(0, 500)}`
          : status === 'REVIEW'
            ? `${statusErrorPrefix}${String(errorMessage).slice(0, 500)}`
          : `${prefix ? `${prefix} ` : ''}${status}`);
      if (statusHeader) row.set(statusHeader, statusText);
      if (errorHeader) row.set(errorHeader, hasDeliveryError ? statusErrorPrefix + String(errorMessage).slice(0, 500) : '');
      if (sentAtHeader && status === 'SENT') row.set(sentAtHeader, formatIndiaTimestamp());
      await row.save();
      if (typeof refreshCache === 'function') void Promise.resolve(refreshCache()).catch(refreshError => console.warn('[MAIL QUEUE] Event cache refresh failed:', refreshError.message));
    } catch (error) {
      console.error('[MAIL QUEUE] Could not update event notification status:', error.message);
    }
  };

  const retryAt = (error, attempt) => {
    const delaySeconds = isQuotaError(error)
      ? quotaDelaySeconds
      : Math.min(baseDelaySeconds * (2 ** Math.max(0, attempt - 1)), quotaDelaySeconds);
    return new Date(Date.now() + delaySeconds * 1000).toISOString();
  };

  const queueFailedMail = async (category, mail, sendDetails, deliveryError) => {
    const id = randomBytes(16).toString('hex');
    const queuedPayload = {
      mail: toPersistableMail(mail),
      deliveryId: String(sendDetails.deliveryId || id),
      logDetails: {
        name: sendDetails.logDetails?.name || '',
        email: sendDetails.logDetails?.email || '',
        type: sendDetails.logDetails?.type || ''
      },
      queueContext: sendDetails.queueContext || {}
    };
    const savedPayload = await savePayload(id, queuedPayload);
    const now = new Date().toISOString();
    const sheet = await getQueueSheet();
    try {
      await sheet.addRow({
        ID: id,
        Category: category,
        EmailCategory: getSender(category).emailCategory,
        Payload: savedPayload.value,
        Context: '',
        Status: 'queued',
        Attempts: 1,
        NextAttemptAt: retryAt(deliveryError, 1),
        CreatedAt: now,
        UpdatedAt: now,
        LastError: String(deliveryError.message || deliveryError).slice(0, 1000),
        Provider: 'auto-failover',
        LogName: '',
        LogEmail: '',
        MailType: ''
      });
    } catch (error) {
      await deletePayloadFile(savedPayload.value);
      throw error;
    }
    console.warn(`[MAIL QUEUE] Email ${id} was queued for ${category}; next retry at ${retryAt(deliveryError, 1)}.`);
    return { queued: true, queueId: id };
  };

  const sendMail = async (mailOptions, sendDetails = {}) => {
    const requestedCategory = String(sendDetails.category || 'placement').trim().toLowerCase();
    const category = categoryAliases[requestedCategory] || requestedCategory;
    const sender = getSender(category);
    const mail = {
      ...mailOptions,
      to: cleanRecipients(mailOptions.to),
      cc: cleanRecipients(mailOptions.cc),
      bcc: cleanRecipients(mailOptions.bcc),
      replyTo: cleanRecipients(mailOptions.replyTo),
      fromName: formatSenderName(mailOptions.from)
    };
    const deliveryId = randomBytes(12).toString('hex');
    try {
      const result = await sendNow(category, mail, deliveryId);
      return { queued: false, ...result };
    } catch (error) {
      if (!isRetryable(error)) throw error;
      const queued = await queueFailedMail(category, mail, { ...sendDetails, deliveryId }, error);
      return { ...queued, provider: 'auto-failover' };
    }
  };

  const processQueue = async () => {
    if (workerRunning) return;
    workerRunning = true;
    try {
      const sheet = await getQueueSheet();
      const rows = await sheet.getRows();
      const now = Date.now();
      for (const row of rows) {
        const status = String(row.get('Status') || '').toLowerCase();

        if (status === 'sending') {
          const updatedAt = Date.parse(row.get('UpdatedAt') || '');
          if (Number.isFinite(updatedAt) && now - updatedAt > 30 * 60 * 1000) {
            const category = String(row.get('Category') || '').trim().toLowerCase();
            const createdAt = Date.parse(row.get('CreatedAt') || '');
            if (category === 'portal' && Number.isFinite(createdAt) && now - createdAt > 30 * 60 * 1000) {
              try {
                const payload = await readPayload(row.get('Payload'));
                if (isPasswordResetMail(category, payload.mail?.subject || payload.subject)) {
                  const storedPayload = row.get('Payload');
                  const details = payload.logDetails || {
                    name: row.get('LogName'), email: row.get('LogEmail'), type: row.get('MailType')
                  };
                  row.set('Status', 'failed');
                  row.set('LastError', 'Password reset email expired before delivery. Send a new reset link.');
                  row.set('Payload', '');
                  row.set('UpdatedAt', new Date().toISOString());
                  await row.save();
                  await deletePayloadFile(storedPayload);
                  await appendMailLog(details, 'Failed: password reset email expired', 'Password reset');
                  continue;
                }
              } catch (error) {
                console.warn('[MAIL QUEUE] Could not inspect an expired portal message before review:', error.message);
              }
            }
            row.set('Status', 'review');
            row.set('LastError', 'Worker stopped during delivery. Check the recipient before retrying to avoid a duplicate.');
            row.set('UpdatedAt', new Date().toISOString());
            await row.save();
          }
          continue;
        }
        if (status !== 'queued') continue;

        // Do not resend jobs left in the queue by an older version after an
        // ambiguous provider timeout. They must be checked by a person first.
        if (/delivery outcome is uncertain/i.test(String(row.get('LastError') || ''))) {
          row.set('Status', 'review');
          row.set('UpdatedAt', new Date().toISOString());
          await row.save();
          continue;
        }

        const dueAt = Date.parse(row.get('NextAttemptAt') || '');
        if (Number.isFinite(dueAt) && dueAt > now) continue;
        const attempts = Number(row.get('Attempts') || 0);
        const category = String(row.get('Category') || '').trim().toLowerCase();
        let details = {
          name: row.get('LogName'),
          email: row.get('LogEmail'),
          type: row.get('MailType')
        };
        let context = {};
        let deliveryId = String(row.get('ID') || randomBytes(12).toString('hex'));
        try { context = JSON.parse(String(row.get('Context') || '{}')); } catch { context = {}; }
        const createdAt = Date.parse(row.get('CreatedAt') || '');
        let mail;

        try {
          const queuedPayload = await readPayload(row.get('Payload'));
          mail = queuedPayload.mail || queuedPayload;
          deliveryId = String(queuedPayload.deliveryId || deliveryId);
          details = queuedPayload.logDetails || details;
          if (queuedPayload.queueContext) context = queuedPayload.queueContext;
          if (isPasswordResetMail(category, mail.subject) && Number.isFinite(createdAt) && now - createdAt > 30 * 60 * 1000) {
            throw Object.assign(new Error('Password reset email expired before delivery. Send a new reset link.'), { retryable: false });
          }
        } catch (error) {
          row.set('Status', 'failed');
          row.set('LastError', String(error.message || error).slice(0, 1000));
          row.set('UpdatedAt', new Date().toISOString());
          const storedPayload = row.get('Payload');
          await deletePayloadFile(storedPayload);
          row.set('Payload', '');
          await row.save();
          await appendMailLog(details, 'Failed: queued payload could not be loaded', 'Queued email');
          await updateEventMailStatus(context, 'FAILED', error.message);
          continue;
        }

        const quotaBlocked = isQuotaError({ message: row.get('LastError') });
        if (attempts >= maxAttempts && !quotaBlocked) {
          row.set('Status', 'failed');
          row.set('LastError', 'Maximum email delivery attempts reached.');
          row.set('UpdatedAt', new Date().toISOString());
          await deletePayloadFile(row.get('Payload'));
          row.set('Payload', '');
          await row.save();
          await appendMailLog(details, 'Failed: maximum delivery attempts reached', mail.subject);
          await updateEventMailStatus(context, 'FAILED', 'Maximum email delivery attempts reached.');
          continue;
        }

        row.set('Status', 'sending');
        row.set('Attempts', attempts + 1);
        row.set('UpdatedAt', new Date().toISOString());
        await row.save();

        let deliveryResult;
        try {
          const sender = getSender(category);
          deliveryResult = await sendNow(category, fromPersistableMail(mail, sender), deliveryId);
        } catch (error) {
          const attempt = attempts + 1;
          const deliveryUncertain = isAmbiguousDelivery(error) || /delivery outcome is uncertain/i.test(String(error.message || error));
          const retryable = !deliveryUncertain && (isQuotaError(error) || (isRetryable(error) && attempt < maxAttempts));
          row.set('Status', deliveryUncertain ? 'review' : retryable ? 'queued' : 'failed');
          row.set('LastError', String(error.message || error).slice(0, 1000));
          row.set('UpdatedAt', new Date().toISOString());
          if (retryable) {
            row.set('NextAttemptAt', retryAt(error, attempt));
          } else if (!deliveryUncertain) {
            const storedPayload = row.get('Payload');
            row.set('Payload', '');
            await deletePayloadFile(storedPayload);
          }
          await row.save();
          if (!retryable) {
            await appendMailLog(details, `${deliveryUncertain ? 'Review' : 'Failed'}: ${String(error.message || error).slice(0, 500)}`, mail.subject);
            await updateEventMailStatus(context, deliveryUncertain ? 'REVIEW' : 'FAILED', error.message);
          }
          continue;
        }

        // Delivery has succeeded. If the sheet write fails, leave the job in
        // "sending" for manual review; automatically retrying could duplicate it.
        const storedPayload = row.get('Payload');
        row.set('Status', 'sent');
        row.set('Provider', deliveryResult.provider || '');
        row.set('LastError', '');
        row.set('Payload', '');
        row.set('UpdatedAt', new Date().toISOString());
        try {
          await row.save();
        } catch (saveError) {
          console.error(`[MAIL QUEUE] Email ${row.get('ID')} was delivered, but its queue status could not be saved. It will be marked for review instead of resent:`, saveError.message);
          continue;
        }
        await deletePayloadFile(storedPayload);
        await appendMailLog(details, 'Success (queued delivery)', mail.subject);
        await updateEventMailStatus(context, 'SENT');
      }
    } catch (error) {
      console.error('[MAIL QUEUE] Worker cycle failed:', error.message);
    } finally {
      workerRunning = false;
    }
  };

  const startWorker = () => {
    if (workerTimer) return workerTimer;
    void processQueue();
    workerTimer = setInterval(() => void processQueue(), workerIntervalMs);
    return workerTimer;
  };

  const mailReportService = createMailReportService({
    doc,
    sheetsApi,
    getSpreadsheetIdForSheetName,
    loadDocInfo,
    senderConfig: SENDER_CONFIG,
    sendMail
  });

  return {
    sendMail,
    processQueue,
    startWorker,
    refreshMailDashboard: mailReportService.refreshDashboard,
    sendScheduledMailReport: mailReportService.sendScheduledReport,
    startMailDashboardRefresh: mailReportService.startDashboardRefresh
  };
};

module.exports = { createEmailService, SENDER_CONFIG };
