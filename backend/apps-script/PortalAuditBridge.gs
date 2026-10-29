/**
 * Audit bridge for the four IPCS Google Sheets workbooks.
 *
 * Setup:
 * 1. Add this file to a standalone Apps Script project that can access all four workbooks.
 * 2. In Project Settings > Script Properties, set PORTAL_AUDIT_API_BASE and
 *    PORTAL_AUDIT_INGEST_TOKEN. Keep the token private.
 * 3. Run installPortalAuditTriggers once and approve the requested permissions.
 * 4. Call portalAuditAutomation(action, resource, details) after each automated
 *    write/delete in every other Apps Script project.
 *
 * Cell values are intentionally never sent to the audit log.
 */

const PORTAL_AUDIT_SPREADSHEET_IDS = [
  '14WvBO50cY66NLQVQXs1OrR-jcOD6AQSKz9Yya60KG3o', // IPCS Students
  '1eSMP6u8G11ErXOYS1XTU0qR4RvyCNcFQtP19dHkNz5c', // IPCS Placements & Recruitment
  '18alS1bVj33kZ8wX7VcQiwrPzLSfOyQWkc8fRooTD7Nk', // IPCS Learning & Academics
  '1qLS3e0xJX0IVhNoGFGM8uPtet7mxI6QHzpz-AwfoBnI'  // IPCS Operations & System Logs
];

const PORTAL_AUDIT_LOG_SPREADSHEET_ID = '11FH7p5rYIc0EmKvT6fd0PIIoc2ns8Vj-EjksX1BLZ-w';

function installPortalAuditTriggers() {
  const handlerNames = new Set(['portalAuditOnEdit', 'portalAuditOnChange']);
  const existing = ScriptApp.getProjectTriggers();
  existing.forEach(trigger => {
    if (handlerNames.has(trigger.getHandlerFunction())) ScriptApp.deleteTrigger(trigger);
  });

  PORTAL_AUDIT_SPREADSHEET_IDS.forEach(spreadsheetId => {
    ScriptApp.newTrigger('portalAuditOnEdit').forSpreadsheet(spreadsheetId).onEdit().create();
    ScriptApp.newTrigger('portalAuditOnChange').forSpreadsheet(spreadsheetId).onChange().create();
  });
  portalAuditAutomation('Audit triggers installed', 'Google Sheets', {
    operation: 'installPortalAuditTriggers',
    summary: 'Installed edit and structure-change triggers for four IPCS workbooks.'
  });
}

function portalAuditOnEdit(event) {
  if (!event || !event.range || !event.source) return;
  const range = event.range;
  const spreadsheetId = event.source.getId();
  if (spreadsheetId === PORTAL_AUDIT_LOG_SPREADSHEET_ID) return;

  portalAuditSend_({
    actorType: 'Human',
    actorName: 'Google Sheets editor',
    actorEmail: portalAuditEditorEmail_(event),
    action: 'Google Sheet cells edited',
    resource: event.source.getName(),
    result: 'Observed',
    details: {
      spreadsheetId,
      sheet: range.getSheet().getName(),
      range: range.getA1Notation(),
      rowCount: range.getNumRows(),
      columnCount: range.getNumColumns(),
      operation: 'manual-cell-edit'
    }
  });
}

function portalAuditOnChange(event) {
  if (!event || !event.source) return;
  const spreadsheetId = event.source.getId();
  if (spreadsheetId === PORTAL_AUDIT_LOG_SPREADSHEET_ID) return;

  portalAuditSend_({
    actorType: 'Human',
    actorName: 'Google Sheets editor',
    actorEmail: portalAuditEditorEmail_(event),
    action: 'Google Sheet structure changed',
    resource: event.source.getName(),
    result: 'Observed',
    details: { spreadsheetId, changeType: String(event.changeType || 'OTHER'), operation: 'sheet-structure-change' }
  });
}

/** Call this after a bot/script changes data in one of the source workbooks. */
function portalAuditAutomation(action, resource, details, result) {
  return portalAuditSend_({
    actorType: 'Bot',
    actorName: 'Google Apps Script',
    action: String(action || 'Apps Script action'),
    resource: String(resource || 'Google Sheets'),
    result: ['Success', 'Error', 'Started', 'Completed', 'Observed'].includes(String(result || 'Success')) ? String(result || 'Success') : 'Observed',
    details: details || {}
  });
}

function portalAuditEditorEmail_(event) {
  try {
    if (event.user && event.user.getEmail) return event.user.getEmail();
  } catch (_error) { /* Google may hide the active editor identity. */ }
  try { return Session.getActiveUser().getEmail() || ''; }
  catch (_error) { return ''; }
}

function portalAuditSend_(event) {
  const properties = PropertiesService.getScriptProperties();
  const apiBase = String(properties.getProperty('PORTAL_AUDIT_API_BASE') || '').replace(/\/$/, '');
  const token = String(properties.getProperty('PORTAL_AUDIT_INGEST_TOKEN') || '');
  if (!apiBase || !token) throw new Error('Set PORTAL_AUDIT_API_BASE and PORTAL_AUDIT_INGEST_TOKEN in Script Properties.');

  const response = UrlFetchApp.fetch(apiBase + '/api/audit/automation-events', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-portal-audit-token': token },
    payload: JSON.stringify({ events: [event] }),
    muteHttpExceptions: true
  });
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error('Portal audit endpoint returned HTTP ' + status + '.');
  }
  return true;
}
