const axios = require('axios');

const INDIA_TZ = 'Asia/Kolkata';
const DASHBOARD_TITLE = 'Mail_Usage_Dashboard';
const HISTORY_TITLE = 'Mail_Usage_History';
const QUEUE_HEADERS = [
  'ID', 'Category', 'EmailCategory', 'Payload', 'Context', 'Status', 'Attempts',
  'NextAttemptAt', 'CreatedAt', 'UpdatedAt', 'LastError', 'Provider',
  'LogName', 'LogEmail', 'MailType'
];
const USAGE_HEADERS = [
  'ID', 'SenderKey', 'EmailCategory', 'SenderEmail', 'Provider',
  'RecipientCount', 'TrackedRemaining', 'AppsScriptRemaining', 'SentAt'
];
const MAIL_HEADERS = ['TimeStamp', 'Reciver Name', 'Reciver Mail', 'Mail Type', 'Subject', 'Status'];

const createMailReportService = ({
  doc,
  sheetsApi,
  getSpreadsheetIdForSheetName,
  loadDocInfo,
  senderConfig,
  sendMail
}) => {
  const usageSheetName = String(process.env.MAIL_USAGE_SHEET || 'EmailQuotaUsage').trim() || 'EmailQuotaUsage';
  const queueSheetName = String(process.env.MAIL_QUEUE_SHEET || 'EmailQueue').trim() || 'EmailQueue';
  const dashboardRefreshIntervalMs = Math.max(15, Number(process.env.MAIL_DASHBOARD_REFRESH_MINUTES) || 30) * 60 * 1000;
  const dailyCap = Math.max(1, Number(process.env.MAIL_ACCOUNT_DAILY_RECIPIENT_CAP) || 100);
  let refreshTimer = null;
  let isRefreshing = false;
  let sheetIdsPromise = null;
  let chartsInitialized = false;

  const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const timeParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: INDIA_TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });

  const formatDateKey = date => {
    const parts = Object.fromEntries(timeParts.formatToParts(date).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  const formatMonthKey = date => formatDateKey(date).slice(0, 7);
  const formatYearKey = date => formatDateKey(date).slice(0, 4);
  const formatIndiaDateTime = date => {
    const parts = Object.fromEntries(timeParts.formatToParts(date).map(part => [part.type, part.value]));
    return `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}:${parts.second}`;
  };
  const parseDate = value => {
    if (value instanceof Date && Number.isFinite(value.getTime())) return value;
    if (typeof value === 'number' && Number.isFinite(value)) {
      // Google Sheets date serials are wall-clock values in the workbook's
      // Asia/Kolkata timezone, while JavaScript dates are absolute UTC values.
      return new Date(Date.UTC(1899, 11, 30) + value * 86400000 - 330 * 60000);
    }
    const text = String(value ?? '').trim();
    if (!text) return null;
    const localMatch = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (localMatch) {
      const [, day, month, year, hour = '0', minute = '0', second = '0'] = localMatch;
      // Mail log timestamps are displayed in India time without a timezone suffix.
      return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 5, Number(minute) - 30, Number(second)));
    }
    const parsed = Date.parse(text);
    if (Number.isFinite(parsed)) return new Date(parsed);
    return null;
  };
  const sheetRange = (title, columns = 'A:Z') => `'${String(title).replace(/'/g, "''")}'!${columns}`;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);

  const configuredSenders = () => {
    const sendersByEmail = new Map();
    for (const [senderKey, config] of Object.entries(senderConfig)) {
      const email = String(process.env[`${config.prefix}_EMAIL`] || config.email || '').trim();
      if (!email) continue;
      const key = email.toLowerCase();
      if (!sendersByEmail.has(key)) {
        sendersByEmail.set(key, { email, senderKeys: [], quotaConfigs: [] });
      }
      const entry = sendersByEmail.get(key);
      entry.senderKeys.push(senderKey);
      entry.quotaConfigs.push({ prefix: config.prefix, senderKey });
    }
    return [...sendersByEmail.values()];
  };

  const ensureSheet = async (title, headers) => {
    await loadDocInfo();
    let sheet = doc.sheetsByTitle[title];
    if (!sheet) {
      try {
        sheet = await doc.addSheet({ title, headerValues: headers });
      } catch (error) {
        await loadDocInfo();
        sheet = doc.sheetsByTitle[title];
        if (!sheet) throw error;
      }
    }
    return sheet;
  };

  const ensureReportSheets = async () => {
    const usageHeaders = [...USAGE_HEADERS];
    const queueHeaders = [...QUEUE_HEADERS];
    await ensureSheet(usageSheetName, usageHeaders);
    await ensureSheet(queueSheetName, queueHeaders);
    await ensureSheet('Mail', MAIL_HEADERS);
    const dashboard = await ensureSheet(DASHBOARD_TITLE, ['IPCS Mail Usage & Delivery Dashboard']);
    const history = await ensureSheet(HISTORY_TITLE, ['IPCS Mail Usage History']);
    return { dashboard, history };
  };

  const getReportSheetIds = async () => {
    if (!sheetIdsPromise) {
      sheetIdsPromise = ensureReportSheets().then(({ dashboard, history }) => ({
        dashboardId: dashboard.sheetId,
        historyId: history.sheetId,
        spreadsheetId: getSpreadsheetIdForSheetName(DASHBOARD_TITLE)
      })).catch(error => {
        sheetIdsPromise = null;
        throw error;
      });
    }
    return sheetIdsPromise;
  };

  const readReportSources = async () => {
    const spreadsheetId = getSpreadsheetIdForSheetName(usageSheetName);
    const response = await sheetsApi.spreadsheets.values.batchGet({
      spreadsheetId,
      // Do not read encrypted queue payloads or recipient details just to build
      // aggregate reports; only read the columns the report actually needs.
      ranges: [sheetRange(usageSheetName, 'A:I'), sheetRange('Mail', 'A:F'), sheetRange(queueSheetName, 'F:J')],
      valueRenderOption: 'UNFORMATTED_VALUE'
    });
    const ranges = response.data?.valueRanges || [];
    const usage = rowsToObjects(ranges[0]?.values || []);
    const mail = rowsToObjects(ranges[1]?.values || []);
    const queue = rowsToObjects(ranges[2]?.values || []);
    return { usage, mail, queue };
  };

  const rowsToObjects = rows => {
    if (!Array.isArray(rows) || rows.length < 2) return [];
    const headers = rows[0].map(header => normalize(header));
    return rows.slice(1).filter(row => row.some(value => value !== '' && value != null)).map(row => {
      const result = {};
      headers.forEach((header, index) => { if (header) result[header] = row[index] ?? ''; });
      return result;
    });
  };
  const field = (row, name) => row?.[normalize(name)] ?? '';

  const getLiveQuota = async sender => {
    const configured = sender.quotaConfigs.find(item => {
      return String(process.env[`${item.prefix}_APPS_SCRIPT_URL`] || '').trim()
        && String(process.env[`${item.prefix}_APPS_SCRIPT_SECRET`] || '').trim();
    });
    if (!configured) return { remaining: null, status: 'Not configured', checkedAt: '' };
    const url = String(process.env[`${configured.prefix}_APPS_SCRIPT_URL`] || '').trim();
    const secret = String(process.env[`${configured.prefix}_APPS_SCRIPT_SECRET`] || '').trim();
    try {
      const response = await axios.post(url, { action: 'quota', secret }, { timeout: 12000 });
      const remaining = Number(response.data?.remainingRecipients);
      if (response.data?.success !== true || !Number.isFinite(remaining)) {
        return { remaining: null, status: 'Unavailable', checkedAt: '' };
      }
      return { remaining: Math.max(0, remaining), status: 'Live', checkedAt: formatIndiaDateTime(new Date()) };
    } catch (error) {
      const status = Number(error.response?.status) === 429 ? 'Apps Script rate limited' : 'Unavailable';
      return { remaining: null, status, checkedAt: '' };
    }
  };

  const getPeriodKeys = now => {
    const day = formatDateKey(now);
    return { day, month: day.slice(0, 7), year: day.slice(0, 4) };
  };
  const usageTimestamp = row => parseDate(field(row, 'SentAt'));
  const mailTimestamp = row => parseDate(field(row, 'TimeStamp'));
  const queueTimestamp = row => parseDate(field(row, 'UpdatedAt')) || parseDate(field(row, 'CreatedAt'));
  const isInPeriod = (date, periodKey, period) => {
    if (!date) return false;
    if (period === 'all') return true;
    if (period === 'day') return formatDateKey(date) === periodKey;
    if (period === 'month') return formatMonthKey(date) === periodKey;
    return formatYearKey(date) === periodKey;
  };
  const isDeliveredUsage = row => Number(field(row, 'RecipientCount')) > 0 && !String(field(row, 'Provider')).toLowerCase().startsWith('quota-exhausted:');
  const statusGroup = value => {
    const status = String(value || '').trim().toLowerCase();
    if (status.includes('review') || status.includes('uncertain')) return 'review';
    if (status.startsWith('success') || status === 'sent') return 'sent';
    if (status.startsWith('queued')) return 'queued';
    if (status.startsWith('failed')) return 'failed';
    return 'other';
  };
  const periodMetrics = (sources, periodKey, period) => {
    const deliveries = sources.usage.filter(row => isInPeriod(usageTimestamp(row), periodKey, period) && isDeliveredUsage(row));
    const mailRows = sources.mail.filter(row => isInPeriod(mailTimestamp(row), periodKey, period));
    const queueRows = sources.queue.filter(row => isInPeriod(queueTimestamp(row), periodKey, period));
    const providerCounts = new Map();
    const categoryCounts = new Map();
    deliveries.forEach(row => {
      const provider = String(field(row, 'Provider') || 'unknown');
      const senderEmail = String(field(row, 'SenderEmail') || 'unknown');
      const key = `${senderEmail.toLowerCase()}\u0000${provider.toLowerCase()}`;
      const item = providerCounts.get(key) || { senderEmail, provider, messages: 0, recipients: 0, quotaBlocks: 0 };
      item.messages += 1;
      item.recipients += Math.max(0, Number(field(row, 'RecipientCount')) || 0);
      providerCounts.set(key, item);
      const category = String(field(row, 'EmailCategory') || 'uncategorized');
      const categoryKey = category.toLowerCase();
      const categoryItem = categoryCounts.get(categoryKey) || { category, messages: 0, recipients: 0 };
      categoryItem.messages += 1;
      categoryItem.recipients += Math.max(0, Number(field(row, 'RecipientCount')) || 0);
      categoryCounts.set(categoryKey, categoryItem);
    });
    sources.usage.filter(row => isInPeriod(usageTimestamp(row), periodKey, period)
      && String(field(row, 'Provider')).toLowerCase().startsWith('quota-exhausted:'))
      .forEach(row => {
        const provider = String(field(row, 'Provider') || 'quota-exhausted:unknown');
        const senderEmail = String(field(row, 'SenderEmail') || 'unknown');
        const key = `${senderEmail.toLowerCase()}\u0000${provider.toLowerCase()}`;
        const item = providerCounts.get(key) || { senderEmail, provider, messages: 0, recipients: 0, quotaBlocks: 0 };
        item.quotaBlocks += 1;
        providerCounts.set(key, item);
      });
    const mailCounts = mailRows.reduce((counts, row) => {
      const group = statusGroup(field(row, 'Status'));
      counts[group] = (counts[group] || 0) + 1;
      return counts;
    }, {});
    const mailTypes = new Map();
    mailRows.forEach(row => {
      const type = String(field(row, 'Mail Type') || 'Uncategorized');
      const group = statusGroup(field(row, 'Status'));
      const item = mailTypes.get(type.toLowerCase()) || { type, sent: 0, queued: 0, failed: 0, review: 0, other: 0 };
      item[group] = (item[group] || 0) + 1;
      mailTypes.set(type.toLowerCase(), item);
    });
    const queueCounts = queueRows.reduce((counts, row) => {
      const group = statusGroup(field(row, 'Status'));
      counts[group] = (counts[group] || 0) + 1;
      return counts;
    }, {});
    return {
      messageCount: deliveries.length,
      recipientCount: deliveries.reduce((sum, row) => sum + Math.max(0, Number(field(row, 'RecipientCount')) || 0), 0),
      providerCounts: [...providerCounts.values()],
      categoryCounts: [...categoryCounts.values()],
      mailCounts,
      mailTypes: [...mailTypes.values()],
      queueCounts,
      queueCurrently: sources.queue.reduce((counts, row) => {
        const group = String(field(row, 'Status') || 'other').trim().toLowerCase();
        counts[group] = (counts[group] || 0) + 1;
        return counts;
      }, {})
    };
  };

  const monthlyKeys = now => {
    const current = new Date(`${formatMonthKey(now)}-01T00:00:00Z`);
    return Array.from({ length: 13 }, (_, index) => {
      const date = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - (12 - index), 1));
      return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    });
  };
  const dailyKeys = now => Array.from({ length: 31 }, (_, index) => {
    const date = new Date(now.getTime() - (30 - index) * 86400000);
    return formatDateKey(date);
  });
  const yearlyKeys = now => Array.from({ length: 6 }, (_, index) => String(Number(formatYearKey(now)) - (5 - index)));

  const aggregateRecipientsByPeriod = (usageRows, senders, keys, period) => {
    const values = new Map();
    for (const key of keys) values.set(key, new Map(senders.map(sender => [sender.email.toLowerCase(), 0])));
    usageRows.filter(isDeliveredUsage).forEach(row => {
      const date = usageTimestamp(row);
      if (!date) return;
      const key = period === 'day' ? formatDateKey(date) : period === 'month' ? formatMonthKey(date) : formatYearKey(date);
      const item = values.get(key);
      if (!item) return;
      const email = String(field(row, 'SenderEmail') || '').trim().toLowerCase();
      if (item.has(email)) item.set(email, item.get(email) + Math.max(0, Number(field(row, 'RecipientCount')) || 0));
    });
    return values;
  };

  const buildHistoryValues = (sources, senders, now) => {
    const headers = ['Period', ...senders.map(sender => sender.email)];
    const daily = dailyKeys(now);
    const monthly = monthlyKeys(now);
    const yearly = yearlyKeys(now);
    const dailyData = aggregateRecipientsByPeriod(sources.usage, senders, daily, 'day');
    const monthlyData = aggregateRecipientsByPeriod(sources.usage, senders, monthly, 'month');
    const yearlyData = aggregateRecipientsByPeriod(sources.usage, senders, yearly, 'year');
    const rows = Array.from({ length: 58 }, () => []);
    rows[0] = ['Daily delivered recipients — last 31 calendar days'];
    rows[1] = headers;
    daily.forEach((key, index) => { rows[index + 2] = [key, ...senders.map(sender => dailyData.get(key)?.get(sender.email.toLowerCase()) || 0)]; });
    rows[34] = ['Monthly delivered recipients — last 13 calendar months'];
    rows[35] = headers;
    monthly.forEach((key, index) => { rows[index + 36] = [key, ...senders.map(sender => monthlyData.get(key)?.get(sender.email.toLowerCase()) || 0)]; });
    rows[50] = ['Yearly delivered recipients — last 6 calendar years'];
    rows[51] = headers;
    yearly.forEach((key, index) => { rows[index + 52] = [key, ...senders.map(sender => yearlyData.get(key)?.get(sender.email.toLowerCase()) || 0)]; });
    return rows;
  };

  const buildDashboardValues = async (sources, senders, now) => {
    const keys = getPeriodKeys(now);
    const quotaResults = await Promise.all(senders.map(getLiveQuota));
    const liveQuotaByEmail = new Map(senders.map((sender, index) => [sender.email.toLowerCase(), quotaResults[index]]));
    const periods = {
      day: periodMetrics(sources, keys.day, 'day'),
      month: periodMetrics(sources, keys.month, 'month'),
      year: periodMetrics(sources, keys.year, 'year')
    };
    const allTime = periodMetrics(sources, 'all', 'all');
    const dailyRecipients = new Map();
    const monthRecipients = new Map();
    const yearRecipients = new Map();
    const rollingRecipients = new Map();
    const rollingCutoff = now.getTime() - 24 * 60 * 60 * 1000;
    sources.usage.filter(isDeliveredUsage).forEach(row => {
      const email = String(field(row, 'SenderEmail') || '').trim().toLowerCase();
      const date = usageTimestamp(row);
      if (!email || !date) return;
      const recipients = Math.max(0, Number(field(row, 'RecipientCount')) || 0);
      if (formatDateKey(date) === keys.day) dailyRecipients.set(email, (dailyRecipients.get(email) || 0) + recipients);
      if (formatMonthKey(date) === keys.month) monthRecipients.set(email, (monthRecipients.get(email) || 0) + recipients);
      if (formatYearKey(date) === keys.year) yearRecipients.set(email, (yearRecipients.get(email) || 0) + recipients);
      if (date.getTime() >= rollingCutoff) rollingRecipients.set(email, (rollingRecipients.get(email) || 0) + recipients);
    });
    const configuredKeysByEmail = new Map();
    configuredSenders().forEach(sender => configuredKeysByEmail.set(sender.email.toLowerCase(), sender.senderKeys.join(', ')));
    const headerRow = [
      'Sender email', 'Sender key(s)', 'Recipients today', 'Recipients this month', 'Recipients this year',
      'Live Apps Script remaining', 'Quota check (IST)', 'Tracked remaining (rolling 24h)', 'Portal cap (rolling 24h)', 'Quota status'
    ];
    const dashboardRows = [
      ['IPCS MAIL USAGE & DELIVERY DASHBOARD'],
      ['Last refreshed (IST)', formatIndiaDateTime(now)],
      [],
      headerRow
    ];
    senders.forEach(sender => {
      const quota = liveQuotaByEmail.get(sender.email.toLowerCase()) || { remaining: null, status: 'Unavailable', checkedAt: '' };
      const usedRolling = rollingRecipients.get(sender.email.toLowerCase()) || 0;
      dashboardRows.push([
        sender.email,
        configuredKeysByEmail.get(sender.email.toLowerCase()) || 'historical sender',
        dailyRecipients.get(sender.email.toLowerCase()) || 0,
        monthRecipients.get(sender.email.toLowerCase()) || 0,
        yearRecipients.get(sender.email.toLowerCase()) || 0,
        quota.remaining == null ? '' : quota.remaining,
        quota.checkedAt,
        Math.max(0, dailyCap - usedRolling),
        dailyCap,
        quota.status
      ]);
    });
    dashboardRows.push([], ['MAIL EVENTS AND DELIVERY COUNTS'], ['Metric', 'Today', 'This month', 'This year', 'All time / current']);
    const metrics = [
      ['Delivered messages', 'messageCount'],
      ['Delivered recipients', 'recipientCount'],
      ['Mail log: success events', 'mailSent'],
      ['Mail log: queued events', 'mailQueued'],
      ['Mail log: failed events', 'mailFailed'],
      ['Mail log: review / uncertain events', 'mailReview'],
      ['Queue outcomes: sent in period', 'queueSent'],
      ['Queue outcomes: failed in period', 'queueFailed'],
      ['Queue outcomes: review in period', 'queueReview'],
      ['Queue items currently queued', 'queueQueuedNow'],
      ['Queue items currently sending', 'queueSendingNow'],
      ['Queue items currently failed', 'queueFailedNow'],
      ['Queue items currently under review', 'queueReviewNow'],
      ['Quota exhaustion observations', 'quotaBlocks']
    ];
    const metricsValues = {
      day: periods.day, month: periods.month, year: periods.year, all: allTime
    };
    const metricValue = (summary, key) => {
      if (key === 'messageCount' || key === 'recipientCount') return summary[key];
      if (key === 'quotaBlocks') return summary.providerCounts.reduce((sum, entry) => sum + entry.quotaBlocks, 0);
      if (key === 'queueSent' || key === 'queueFailed' || key === 'queueReview') return summary.queueCounts[key.slice(5).toLowerCase()] || 0;
      if (key.endsWith('Now')) {
        if (summary !== metricsValues.all) return '';
        if (key === 'queueQueuedNow') return summary.queueCurrently.queued || 0;
        if (key === 'queueSendingNow') return summary.queueCurrently.sending || 0;
        if (key === 'queueFailedNow') return summary.queueCurrently.failed || 0;
        if (key === 'queueReviewNow') return summary.queueCurrently.review || 0;
      }
      const group = key.slice(4).toLowerCase();
      return summary.mailCounts[group] || 0;
    };
    metrics.forEach(([label, key]) => dashboardRows.push([
      label,
      metricValue(metricsValues.day, key),
      metricValue(metricsValues.month, key),
      metricValue(metricsValues.year, key),
      metricValue(metricsValues.all, key)
    ]));
    dashboardRows.push([], ['PROVIDER AND SENDER DELIVERY BREAKDOWN'], [
      'Sender email', 'Provider', 'Messages today', 'Recipients today', 'Messages this month',
      'Recipients this month', 'Messages this year', 'Recipients this year', 'Messages all time', 'Recipients all time', 'Quota blocks today'
    ]);
    const allProviders = new Map();
    [...periods.day.providerCounts, ...periods.month.providerCounts, ...periods.year.providerCounts, ...allTime.providerCounts]
      .forEach(entry => allProviders.set(`${entry.senderEmail.toLowerCase()}\u0000${entry.provider.toLowerCase()}`, entry));
    [...allProviders.values()].sort((a, b) => a.senderEmail.localeCompare(b.senderEmail) || a.provider.localeCompare(b.provider)).forEach(entry => {
      const aggregate = summary => summary.providerCounts.find(item => item.senderEmail.toLowerCase() === entry.senderEmail.toLowerCase() && item.provider.toLowerCase() === entry.provider.toLowerCase()) || { messages: 0, recipients: 0, quotaBlocks: 0 };
      const today = aggregate(periods.day);
      const month = aggregate(periods.month);
      const year = aggregate(periods.year);
      const total = aggregate(allTime);
      dashboardRows.push([
        entry.senderEmail, entry.provider, today.messages, today.recipients,
        month.messages, month.recipients, year.messages, year.recipients,
        total.messages, total.recipients, today.quotaBlocks
      ]);
    });
    dashboardRows.push([], ['EMAIL CATEGORY DELIVERY COUNTS'], ['Email category', 'Messages today', 'Recipients today', 'Messages this month', 'Recipients this month', 'Messages this year', 'Recipients this year', 'Messages all time', 'Recipients all time']);
    const allCategories = new Map();
    [periods.day, periods.month, periods.year, allTime].forEach(summary => summary.categoryCounts.forEach(item => allCategories.set(item.category.toLowerCase(), item.category)));
    [...allCategories.values()].sort((a, b) => a.localeCompare(b)).forEach(category => {
      const aggregate = summary => summary.categoryCounts.find(item => item.category.toLowerCase() === category.toLowerCase()) || { messages: 0, recipients: 0 };
      const today = aggregate(periods.day);
      const month = aggregate(periods.month);
      const year = aggregate(periods.year);
      const total = aggregate(allTime);
      dashboardRows.push([category, today.messages, today.recipients, month.messages, month.recipients, year.messages, year.recipients, total.messages, total.recipients]);
    });
    dashboardRows.push([], ['MAIL LOG COUNTS BY MAIL TYPE'], ['Mail type', 'Sent today', 'Queued today', 'Failed today', 'Review today', 'Sent this month', 'Queued this month', 'Failed this month', 'Review this month', 'Sent this year', 'Queued this year', 'Failed this year', 'Review this year']);
    const allMailTypes = new Map();
    [periods.day, periods.month, periods.year, allTime].forEach(summary => summary.mailTypes.forEach(item => allMailTypes.set(item.type.toLowerCase(), item.type)));
    [...allMailTypes.values()].sort((a, b) => a.localeCompare(b)).forEach(type => {
      const aggregate = summary => summary.mailTypes.find(item => item.type.toLowerCase() === type.toLowerCase()) || { sent: 0, queued: 0, failed: 0, review: 0 };
      const today = aggregate(periods.day);
      const month = aggregate(periods.month);
      const year = aggregate(periods.year);
      dashboardRows.push([type, today.sent, today.queued, today.failed, today.review, month.sent, month.queued, month.failed, month.review, year.sent, year.queued, year.failed, year.review]);
    });
    dashboardRows.push([], ['DELIVERY FAILOVER ORDER'], ['Primary Apps Script sends first. If it explicitly reports quota exhaustion, use the shared fallback account directly. For other definitive failures, try primary Gmail SMTP IPv4 and IPv6, then the fallback account. Ambiguous outcomes are marked for review to avoid duplicate sends.']);
    dashboardRows.push(['Quota notes'], ['Live quota is MailApp.getRemainingDailyQuota() from each configured Apps Script account. SMTP has no API that exposes exact remaining quota; its value is the portal tracked rolling 24-hour estimate.']);
    dashboardRows.push(['Report counts'], ['Delivered totals come from EmailQuotaUsage. Mail log and queue outcomes are separate event counts and may describe the same message at different stages. Historical totals include only records retained in the configured sheets.']);
    const width = Math.max(11, ...dashboardRows.map(row => row.length));
    const paddedRows = dashboardRows.map(row => [...row, ...Array(Math.max(0, width - row.length)).fill('')]);
    while (paddedRows.length < 100) paddedRows.push(Array(width).fill(''));
    return { values: paddedRows.slice(0, 100) };
  };

  const createChartRequest = ({ title, historyId, dashboardId, headerRow, endRow, anchorRow, senderCount }) => {
    const domain = {
      sheetId: historyId,
      startRowIndex: headerRow,
      endRowIndex: endRow,
      startColumnIndex: 0,
      endColumnIndex: 1
    };
    const series = Array.from({ length: senderCount }, (_, index) => ({
      series: { sourceRange: { sources: [{
        sheetId: historyId,
        startRowIndex: headerRow,
        endRowIndex: endRow,
        startColumnIndex: index + 1,
        endColumnIndex: index + 2
      }] } },
      targetAxis: 'LEFT_AXIS'
    }));
    return {
      addChart: {
        chart: {
          spec: {
            title,
            basicChart: {
              chartType: 'COLUMN',
              legendPosition: 'BOTTOM_LEGEND',
              headerCount: 1,
              domains: [{ domain: { sourceRange: { sources: [domain] } } }],
              series
            }
          },
          position: { overlayPosition: {
            anchorCell: { sheetId: dashboardId, rowIndex: anchorRow, columnIndex: 12 },
            widthPixels: 840,
            heightPixels: 380
          } }
        }
      }
    };
  };

  const ensureCharts = async (ids, senderCount) => {
    if (chartsInitialized || senderCount < 1) return;
    const response = await sheetsApi.spreadsheets.get({
      spreadsheetId: ids.spreadsheetId,
      fields: 'sheets(properties(sheetId,title),charts(chartId,spec(title)))'
    });
    const dashboard = (response.data?.sheets || []).find(sheet => sheet.properties?.sheetId === ids.dashboardId);
    const existing = new Set((dashboard?.charts || []).map(chart => String(chart.spec?.title || '')));
    const chartDefinitions = [
      { title: 'Daily email recipient usage — last 31 days', headerRow: 1, endRow: 33, anchorRow: 1 },
      { title: 'Monthly email recipient usage — last 13 months', headerRow: 35, endRow: 49, anchorRow: 22 },
      { title: 'Yearly email recipient usage — last 6 years', headerRow: 51, endRow: 58, anchorRow: 43 }
    ];
    const requests = chartDefinitions.filter(chart => !existing.has(chart.title)).map(chart => createChartRequest({
      ...chart,
      historyId: ids.historyId,
      dashboardId: ids.dashboardId,
      senderCount
    }));
    if (requests.length) {
      await sheetsApi.spreadsheets.batchUpdate({ spreadsheetId: ids.spreadsheetId, requestBody: { requests } });
    }
    chartsInitialized = true;
  };

  const formatDashboard = async (ids, dashboardRows) => {
    const dark = { red: 0.07, green: 0.16, blue: 0.29 };
    const accent = { red: 0.11, green: 0.34, blue: 0.48 };
    const pale = { red: 0.88, green: 0.93, blue: 0.97 };
    const white = { red: 1, green: 1, blue: 1 };
    const requests = [{
      updateSheetProperties: {
        properties: { sheetId: ids.dashboardId, gridProperties: { frozenRowCount: 4 } },
        fields: 'gridProperties.frozenRowCount'
      }
    }, {
      updateSheetProperties: {
        properties: { sheetId: ids.historyId, gridProperties: { frozenRowCount: 2 } },
        fields: 'gridProperties.frozenRowCount'
      }
    }, {
      repeatCell: {
        range: { sheetId: ids.dashboardId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 11 },
        cell: { userEnteredFormat: { backgroundColor: dark, textFormat: { foregroundColor: white, bold: true, fontSize: 16 }, verticalAlignment: 'MIDDLE' } },
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment)'
      }
    }, {
      repeatCell: {
        range: { sheetId: ids.historyId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 6 },
        cell: { userEnteredFormat: { backgroundColor: dark, textFormat: { foregroundColor: white, bold: true, fontSize: 14 } } },
        fields: 'userEnteredFormat(backgroundColor,textFormat)'
      }
    }];
    const sectionTitles = new Set([
      'MAIL EVENTS AND DELIVERY COUNTS',
      'PROVIDER AND SENDER DELIVERY BREAKDOWN',
      'EMAIL CATEGORY DELIVERY COUNTS',
      'MAIL LOG COUNTS BY MAIL TYPE',
      'DELIVERY FAILOVER ORDER'
    ]);
    dashboardRows.forEach((row, index) => {
      if (index === 3 || row[0] === 'Metric' || (row[0] === 'Sender email' && row[1] === 'Provider')
        || row[0] === 'Email category' || row[0] === 'Mail type') {
        requests.push({
          repeatCell: {
            range: { sheetId: ids.dashboardId, startRowIndex: index, endRowIndex: index + 1, startColumnIndex: 0, endColumnIndex: 13 },
            cell: { userEnteredFormat: { backgroundColor: accent, textFormat: { foregroundColor: white, bold: true }, wrapStrategy: 'WRAP', verticalAlignment: 'MIDDLE' } },
            fields: 'userEnteredFormat(backgroundColor,textFormat,wrapStrategy,verticalAlignment)'
          }
        });
      }
      if (sectionTitles.has(String(row[0] || ''))) {
        requests.push({
          repeatCell: {
            range: { sheetId: ids.dashboardId, startRowIndex: index, endRowIndex: index + 1, startColumnIndex: 0, endColumnIndex: 13 },
            cell: { userEnteredFormat: { backgroundColor: pale, textFormat: { foregroundColor: dark, bold: true }, verticalAlignment: 'MIDDLE' } },
            fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment)'
          }
        });
      }
      if ([0, 34, 50].includes(index)) {
        requests.push({
          repeatCell: {
            range: { sheetId: ids.historyId, startRowIndex: index, endRowIndex: index + 1, startColumnIndex: 0, endColumnIndex: 6 },
            cell: { userEnteredFormat: { backgroundColor: pale, textFormat: { foregroundColor: dark, bold: true } } },
            fields: 'userEnteredFormat(backgroundColor,textFormat)'
          }
        });
      }
      if ([1, 35, 51].includes(index)) {
        requests.push({
          repeatCell: {
            range: { sheetId: ids.historyId, startRowIndex: index, endRowIndex: index + 1, startColumnIndex: 0, endColumnIndex: 6 },
            cell: { userEnteredFormat: { backgroundColor: accent, textFormat: { foregroundColor: white, bold: true }, wrapStrategy: 'WRAP' } },
            fields: 'userEnteredFormat(backgroundColor,textFormat,wrapStrategy)'
          }
        });
      }
    });
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: ids.dashboardId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 245 },
        fields: 'pixelSize'
      }
    }, {
      updateDimensionProperties: {
        range: { sheetId: ids.dashboardId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
        properties: { pixelSize: 175 },
        fields: 'pixelSize'
      }
    }, {
      updateDimensionProperties: {
        range: { sheetId: ids.dashboardId, dimension: 'COLUMNS', startIndex: 2, endIndex: 13 },
        properties: { pixelSize: 132 },
        fields: 'pixelSize'
      }
    });
    await sheetsApi.spreadsheets.batchUpdate({ spreadsheetId: ids.spreadsheetId, requestBody: { requests } });
  };

  const refreshDashboard = async () => {
    if (isRefreshing) return { skipped: true, reason: 'refresh already running' };
    isRefreshing = true;
    try {
      const ids = await getReportSheetIds();
      const sources = await readReportSources();
      const now = new Date();
      const sendersByEmail = new Map();
      configuredSenders().forEach(sender => sendersByEmail.set(sender.email.toLowerCase(), sender));
      sources.usage.forEach(row => {
        const email = String(field(row, 'SenderEmail') || '').trim();
        if (email && !sendersByEmail.has(email.toLowerCase())) {
          sendersByEmail.set(email.toLowerCase(), { email, senderKeys: [], quotaConfigs: [] });
        }
      });
      const senders = [...sendersByEmail.values()].sort((a, b) => a.email.localeCompare(b.email));
      const dashboard = await buildDashboardValues(sources, senders, now);
      const historyRows = buildHistoryValues(sources, senders, now);
      const width = Math.max(1, senders.length + 1);
      const normalizedHistory = historyRows.map(row => [...row, ...Array(Math.max(0, width - row.length)).fill('')].slice(0, width));
      await sheetsApi.spreadsheets.values.batchUpdate({
        spreadsheetId: ids.spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: [
            { range: `'${DASHBOARD_TITLE}'!A1`, majorDimension: 'ROWS', values: dashboard.values },
            { range: `'${HISTORY_TITLE}'!A1`, majorDimension: 'ROWS', values: normalizedHistory }
          ]
        }
      });
      await ensureCharts(ids, senders.length);
      await formatDashboard(ids, dashboard.values);
      console.log(`[MAIL REPORT] Updated mail usage dashboard for ${senders.length} unique sender addresses.`);
      return { updated: true, senderCount: senders.length, refreshedAt: formatIndiaDateTime(now) };
    } finally {
      isRefreshing = false;
    }
  };

  const reportPeriodBounds = (period, now = new Date()) => {
    const localDay = formatDateKey(now);
    if (period === 'daily') {
      const date = new Date(`${localDay}T00:00:00Z`);
      date.setUTCDate(date.getUTCDate() - 1);
      return { type: 'day', key: date.toISOString().slice(0, 10), label: date.toISOString().slice(0, 10) };
    }
    if (period === 'monthly') {
      const currentMonth = new Date(`${localDay.slice(0, 7)}-01T00:00:00Z`);
      currentMonth.setUTCMonth(currentMonth.getUTCMonth() - 1);
      const key = `${currentMonth.getUTCFullYear()}-${String(currentMonth.getUTCMonth() + 1).padStart(2, '0')}`;
      return { type: 'month', key, label: key };
    }
    const year = Number(localDay.slice(0, 4)) - 1;
    return { type: 'year', key: String(year), label: String(year) };
  };

  const createReportHtml = (period, bounds, summary, dashboardRows, senderCount) => {
    const senders = dashboardRows.slice(4, 4 + senderCount);
    const senderRows = senders.map(row => `<tr><td>${escapeHtml(row[0])}</td><td>${escapeHtml(row[2])}</td><td>${escapeHtml(row[3])}</td><td>${escapeHtml(row[4])}</td><td>${escapeHtml(row[5] === '' ? 'Unavailable' : row[5])}</td><td>${escapeHtml(row[7])}</td></tr>`).join('');
    const providers = summary.providerCounts.map(item => `<tr><td>${escapeHtml(item.senderEmail)}</td><td>${escapeHtml(item.provider)}</td><td>${item.messages}</td><td>${item.recipients}</td><td>${item.quotaBlocks}</td></tr>`).join('');
    const categories = summary.categoryCounts.map(item => `<tr><td>${escapeHtml(item.category)}</td><td>${item.messages}</td><td>${item.recipients}</td></tr>`).join('');
    const mailTypes = summary.mailTypes.map(item => `<tr><td>${escapeHtml(item.type)}</td><td>${item.sent}</td><td>${item.queued}</td><td>${item.failed}</td><td>${item.review}</td></tr>`).join('');
    const metricTable = [
      ['Delivered messages', summary.messageCount],
      ['Delivered recipients', summary.recipientCount],
      ['Mail log successful events', summary.mailCounts.sent || 0],
      ['Mail log queued events', summary.mailCounts.queued || 0],
      ['Mail log failed events', summary.mailCounts.failed || 0],
      ['Mail log review / uncertain events', summary.mailCounts.review || 0],
      ['Queue outcomes: sent in period', summary.queueCounts.sent || 0],
      ['Queue outcomes: failed in period', summary.queueCounts.failed || 0],
      ['Queue outcomes: under review in period', summary.queueCounts.review || 0],
      ['Queue currently queued', summary.queueCurrently.queued || 0],
      ['Queue currently sending', summary.queueCurrently.sending || 0],
      ['Queue currently failed', summary.queueCurrently.failed || 0],
      ['Queue currently under review', summary.queueCurrently.review || 0]
    ].map(([label, value]) => `<tr><td>${escapeHtml(label)}</td><td>${value}</td></tr>`).join('');
    const tableStyle = 'border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:14px;color:#172033;margin:14px 0 24px';
    const cellStyle = 'border:1px solid #d7dce5;padding:8px;text-align:left';
    const headerStyle = `${cellStyle};background:#edf2f8`;
    return `<div style="font-family:Arial,sans-serif;color:#172033"><h2>IPCS mail report — ${escapeHtml(period)} (${escapeHtml(bounds.label)})</h2><p>The primary account uses Apps Script first. If it explicitly reports quota exhaustion, the system switches directly to the shared fallback account. Other definitive primary failures may try Gmail SMTP IPv4/IPv6 first. Ambiguous outcomes are marked for review to avoid duplicate sends.</p><h3>Sender quota snapshot</h3><table style="${tableStyle}"><thead><tr>${['Sender', 'Recipients today', 'This month', 'This year', 'Live Apps Script remaining', 'Tracked remaining (24h)'].map(label => `<th style="${headerStyle}">${label}</th>`).join('')}</tr></thead><tbody>${senderRows || '<tr><td colspan="6">No sender data yet</td></tr>'}</tbody></table><h3>Report-period and queue counts</h3><table style="${tableStyle}"><thead><tr><th style="${headerStyle}">Metric</th><th style="${headerStyle}">Count</th></tr></thead><tbody>${metricTable}</tbody></table><h3>Mail category breakdown</h3><table style="${tableStyle}"><thead><tr>${['Category', 'Messages', 'Recipients'].map(label => `<th style="${headerStyle}">${label}</th>`).join('')}</tr></thead><tbody>${categories || '<tr><td colspan="3">No category data for this period</td></tr>'}</tbody></table><h3>Mail log counts by mail type</h3><table style="${tableStyle}"><thead><tr>${['Mail type', 'Sent', 'Queued', 'Failed', 'Review'].map(label => `<th style="${headerStyle}">${label}</th>`).join('')}</tr></thead><tbody>${mailTypes || '<tr><td colspan="5">No mail log events for this period</td></tr>'}</tbody></table><h3>Delivery providers</h3><table style="${tableStyle}"><thead><tr>${['Sender', 'Provider / quota observation', 'Messages', 'Recipients', 'Quota blocks'].map(label => `<th style="${headerStyle}">${label}</th>`).join('')}</tr></thead><tbody>${providers || '<tr><td colspan="5">No delivered email records for this period</td></tr>'}</tbody></table><p>Live quota is read from Apps Script. Gmail SMTP does not expose an exact remaining-quota API; the tracked remaining count is a portal estimate based on the configured rolling 24-hour cap. Mail log outcomes and queue states are separate lifecycle counts and may describe the same message at different stages. Totals cover records retained in the mail sheets.</p></div>`;
  };

  const sendScheduledReport = async period => {
    const recipient = String(process.env.MAIL_REPORT_RECIPIENTS || 'giftyipcsglobal@gmail.com').trim();
    const recipients = recipient.split(/[;,]+/).map(value => value.trim()).filter(Boolean);
    if (String(process.env.MAIL_REPORTS_ENABLED || 'true').toLowerCase() === 'false' || !recipients.length) {
      console.log(`[MAIL REPORT] ${period} report email skipped; report delivery is disabled or has no recipient.`);
      return { skipped: true };
    }
    const ids = await getReportSheetIds();
    const sources = await readReportSources();
    const now = new Date();
    const bounds = reportPeriodBounds(period, now);
    const summary = periodMetrics(sources, bounds.key, bounds.type);
    const senders = configuredSenders();
    const dashboard = await buildDashboardValues(sources, senders, now);
    const subject = `[IPCS MAIL REPORT] ${period.toUpperCase()} — ${bounds.label}`;
    const logOutcome = async status => {
      try {
        const mailSheet = doc.sheetsByTitle.Mail || await ensureSheet('Mail', MAIL_HEADERS);
        await mailSheet.addRow({
          TimeStamp: formatIndiaDateTime(new Date()),
          'Reciver Name': 'Gifty',
          'Reciver Mail': recipients.join(','),
          'Mail Type': `${period} mail report`,
          Subject: subject,
          Status: status
        });
      } catch (error) {
        console.error('[MAIL REPORT] Could not add report outcome to the Mail sheet:', error.message);
      }
    };
    let result;
    try {
      result = await sendMail({
        from: { name: 'IPCS Global Mail Reports' },
        to: recipients.join(','),
        subject,
        text: `IPCS ${period} mail report for ${bounds.label}. Delivered messages: ${summary.messageCount}; delivered recipients: ${summary.recipientCount}. See the Mail_Usage_Dashboard sheet for provider, sender, quota and queue details.`,
        html: createReportHtml(period, bounds, summary, dashboard.values, senders.length)
      }, { category: String(process.env.MAIL_REPORT_CATEGORY || 'placement').trim().toLowerCase(), logDetails: { name: 'Gifty', email: recipients.join(','), type: `${period} mail report` } });
    } catch (error) {
      const deliveryUncertain = error?.ambiguousDelivery || /delivery outcome is uncertain/i.test(String(error?.message || error));
      await logOutcome(`${deliveryUncertain ? 'Review' : 'Failed'}: ${String(error.message || error).slice(0, 500)}`);
      throw error;
    }
    await logOutcome(result.queued ? `Queued: ${result.queueId}` : 'Success');
    console.log(`[MAIL REPORT] Sent ${period} report for ${bounds.label} via ${result.provider || 'queue'}${result.queued ? ` (queued ${result.queueId})` : ''}.`);
    return { ...result, period, key: bounds.key };
  };

  const startDashboardRefresh = () => {
    if (refreshTimer) return refreshTimer;
    const refresh = () => refreshDashboard().catch(error => console.error('[MAIL REPORT] Dashboard refresh failed:', error.message));
    const initialTimer = setTimeout(refresh, 90_000);
    if (typeof initialTimer.unref === 'function') initialTimer.unref();
    refreshTimer = setInterval(refresh, dashboardRefreshIntervalMs);
    if (typeof refreshTimer.unref === 'function') refreshTimer.unref();
    return refreshTimer;
  };

  return { refreshDashboard, sendScheduledReport, startDashboardRefresh };
};

module.exports = { createMailReportService, DASHBOARD_TITLE, HISTORY_TITLE };
