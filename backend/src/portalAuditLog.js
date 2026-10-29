const { randomUUID } = require('crypto');

const PORTAL_AUDIT_HEADERS = [
  'Event ID', 'Timestamp (UTC)', 'Actor Type', 'Actor Name', 'Actor Email', 'Actor Role',
  'Source', 'Action', 'Resource', 'Method', 'Route', 'Result', 'HTTP Status',
  'Duration (ms)', 'Request ID', 'Details'
];

const quoteSheet = title => `'${String(title || '').replace(/'/g, "''")}'`;
const cellText = (value, max = 2000) => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, max);
const normalizeTitle = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const createPortalAuditLogger = ({ sheetsApi, spreadsheetId, sheetTitle = 'Portal_Audit_Log' }) => {
  const pending = [];
  let ensureSheetPromise = null;
  let flushPromise = null;
  let retryTimer = null;
  let flushTimer = null;

  const ensureSheet = async () => {
    if (!ensureSheetPromise) {
      ensureSheetPromise = (async () => {
        const meta = await sheetsApi.spreadsheets.get({
          spreadsheetId,
          fields: 'sheets.properties(sheetId,title,gridProperties(frozenRowCount))'
        });
        let properties = (meta.data.sheets || []).map(sheet => sheet.properties || {})
          .find(sheet => normalizeTitle(sheet.title) === normalizeTitle(sheetTitle));
        if (!properties) {
          const existing = (meta.data.sheets || []).map(sheet => sheet.properties || {});
          const blankSheet = existing.find(sheet => /^sheet\s*1$/i.test(sheet.title || ''));
          if (blankSheet) {
            const renamed = await sheetsApi.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: { requests: [{ updateSheetProperties: {
                properties: { sheetId: blankSheet.sheetId, title: sheetTitle, gridProperties: { frozenRowCount: 1 } },
                fields: 'title,gridProperties.frozenRowCount'
              } }] }
            });
            properties = renamed.data.replies?.[0]?.updateSheetProperties?.properties || { ...blankSheet, title: sheetTitle };
          } else {
            const added = await sheetsApi.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: { requests: [{ addSheet: { properties: {
                title: sheetTitle,
                gridProperties: { rowCount: 1000, columnCount: PORTAL_AUDIT_HEADERS.length, frozenRowCount: 1 }
              } } }] }
            });
            properties = added.data.replies?.[0]?.addSheet?.properties;
          }
        }
        if (!Number.isInteger(Number(properties?.sheetId))) throw new Error(`Could not locate or create ${sheetTitle}.`);

        const headerRange = `${quoteSheet(sheetTitle)}!A1:P1`;
        const headerResult = await sheetsApi.spreadsheets.values.get({ spreadsheetId, range: headerRange });
        const currentHeaders = headerResult.data.values?.[0] || [];
        if (!currentHeaders.length) {
          await sheetsApi.spreadsheets.values.update({
            spreadsheetId,
            range: headerRange,
            valueInputOption: 'RAW',
            requestBody: { values: [PORTAL_AUDIT_HEADERS] }
          });
        } else if (currentHeaders.length !== PORTAL_AUDIT_HEADERS.length || PORTAL_AUDIT_HEADERS.some((header, index) => currentHeaders[index] !== header)) {
          throw new Error(`${sheetTitle} already has a different header row; refusing to overwrite it.`);
        }

        await sheetsApi.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: [
            { updateSheetProperties: {
              properties: { sheetId: Number(properties.sheetId), gridProperties: { frozenRowCount: 1 } },
              fields: 'gridProperties.frozenRowCount'
            } },
            { repeatCell: {
              range: { sheetId: Number(properties.sheetId), startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: PORTAL_AUDIT_HEADERS.length },
              cell: { userEnteredFormat: { backgroundColor: { red: 0.09, green: 0.17, blue: 0.27 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true }, wrapStrategy: 'WRAP' } },
              fields: 'userEnteredFormat(backgroundColor,textFormat,wrapStrategy)'
            } },
            { setBasicFilter: { filter: { range: { sheetId: Number(properties.sheetId), startRowIndex: 0, startColumnIndex: 0, endColumnIndex: PORTAL_AUDIT_HEADERS.length } } } },
            ...[280, 165, 105, 150, 225, 145, 115, 235, 175, 85, 320, 105, 95, 105, 265, 420].map((pixelSize, index) => ({ updateDimensionProperties: {
              range: { sheetId: Number(properties.sheetId), dimension: 'COLUMNS', startIndex: index, endIndex: index + 1 },
              properties: { pixelSize },
              fields: 'pixelSize'
            } }))
          ] }
        });
        return properties;
      })().catch(error => {
        ensureSheetPromise = null;
        throw error;
      });
    }
    return ensureSheetPromise;
  };

  const toRow = event => {
    const actor = event.actor || {};
    const detail = typeof event.details === 'string'
      ? event.details
      : event.details && typeof event.details === 'object' ? JSON.stringify(event.details) : '';
    return [
      cellText(event.eventId || randomUUID(), 80),
      cellText(event.timestamp || new Date().toISOString(), 80),
      cellText(event.actorType || (actor.email ? 'Human' : 'Anonymous'), 40),
      cellText(event.actorName || actor.name, 180),
      cellText(event.actorEmail || actor.email, 254).toLowerCase(),
      cellText(event.actorRole || actor.role, 100),
      cellText(event.source || 'API', 60),
      cellText(event.action || 'Portal action', 180),
      cellText(event.resource || '', 180),
      cellText(event.method || '', 20),
      cellText(event.route || '', 500),
      cellText(event.result || 'Recorded', 60),
      Number.isFinite(Number(event.httpStatus)) ? Number(event.httpStatus) : '',
      Number.isFinite(Number(event.durationMs)) ? Number(event.durationMs) : '',
      cellText(event.requestId || '', 100),
      cellText(detail, 4000)
    ];
  };

  const scheduleRetry = () => {
    if (retryTimer) return;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void flush();
    }, 5000);
    retryTimer.unref?.();
  };

  const flush = async () => {
    if (flushPromise) return flushPromise;
    if (!pending.length) return true;
    flushPromise = (async () => {
      await ensureSheet();
      while (pending.length) {
        const batch = pending.splice(0, 100);
        try {
          await sheetsApi.spreadsheets.values.append({
            spreadsheetId,
            range: `${quoteSheet(sheetTitle)}!A:P`,
            valueInputOption: 'RAW',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: batch }
          });
        } catch (error) {
          pending.unshift(...batch);
          console.error('[PORTAL AUDIT] Could not append audit events; keeping them queued for retry:', error.message);
          scheduleRetry();
          return false;
        }
      }
      return true;
    })().catch(error => {
      console.error('[PORTAL AUDIT] Audit sheet is unavailable; events remain queued for retry:', error.message);
      scheduleRetry();
      return false;
    }).finally(() => { flushPromise = null; });
    return flushPromise;
  };

  const log = event => {
    if (!spreadsheetId || !sheetsApi) {
      console.error('[PORTAL AUDIT] Missing audit spreadsheet configuration; event was not recorded.');
      return false;
    }
    pending.push(toRow(event || {}));
    if (pending.length >= 25) void flush();
    else if (!flushTimer) {
      flushTimer = setTimeout(() => {
        flushTimer = null;
        void flush();
      }, 300);
      flushTimer.unref?.();
    }
    return true;
  };

  return { log, flush, ensureSheet, headers: [...PORTAL_AUDIT_HEADERS] };
};

module.exports = { PORTAL_AUDIT_HEADERS, createPortalAuditLogger };
