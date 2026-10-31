require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { google } = require('googleapis');
const { randomUUID } = require('crypto');
const { logPortalAuditEvent } = require('./config');

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const assetDoc = new GoogleSpreadsheet(process.env.ASSET_SPREADSHEET_ID || '17tEo324Xyfc3ku98hmsnKZDry4OgCt_hnUlK8hGtVXA', serviceAccountAuth);

const managedOperationalSheets = [
  { title: 'Asset_Approvals', headers: ['Approval_ID', 'Request_ID', 'Request_Type', 'Asset_ID', 'Branch', 'Requested_By', 'Requested_At', 'Decision', 'Decided_By', 'Decided_At', 'Reason'] },
  { title: 'Asset_Notification_Log', headers: ['Notification_ID', 'Event_Type', 'Recipient', 'Subject', 'Delivery_Status', 'Provider', 'Queue_ID', 'Attempt_Count', 'Created_At', 'Last_Error', 'Related_Entity_ID', 'Branch'] },
  { title: 'Asset_QR_Registry', headers: ['QR_ID', 'Asset_ID', 'QR_Value', 'QR_Version', 'Created_By', 'Created_At', 'Status'] },
  { title: 'Asset_Activity_Log', headers: ['Event_ID', 'Timestamp', 'Actor_ID', 'Actor_Name', 'Actor_Email', 'Actor_Role', 'Branch', 'Action', 'Entity_Type', 'Entity_ID', 'Before_JSON', 'After_JSON', 'Source', 'Request_ID'] }
];

let assetCache = null;
let assetCacheUpdatedAt = null;
let isFetching = false;
let refreshRequested = false;

const getAssetCache = () => assetCache;
const getAssetCacheUpdatedAt = () => assetCacheUpdatedAt;
const isAssetCacheReady = () => assetCache !== null;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchAssetBatchWithRetry(sheetsApi, spreadsheetId, ranges, retries = 3) {
  const backoffs = [10000, 30000, 60000];
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      return await sheetsApi.spreadsheets.values.batchGet({
        spreadsheetId,
        ranges,
        valueRenderOption: 'FORMATTED_VALUE',
      });
    } catch (error) {
      if (error.response?.status !== 429 || attempt === retries - 1) throw error;
      const waitTime = backoffs[attempt] || backoffs[backoffs.length - 1];
      console.warn(`⚠️ Google Sheets quota is busy while refreshing the Asset DB. Retrying in ${waitTime}ms...`);
      await delay(waitTime);
    }
  }
  return [];
}

async function ensureOperationalSheets() {
  const normalizeTitle = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const definition of managedOperationalSheets) {
    const existing = assetDoc.sheetsByIndex.find(sheet => normalizeTitle(sheet.title) === normalizeTitle(definition.title));
    if (existing) continue;
    try {
      await assetDoc.addSheet({ title: definition.title, headerValues: definition.headers });
      console.log(`[ASSET SHEETS] Created empty operational tab ${definition.title}.`);
      logPortalAuditEvent({ actorType: 'Bot', source: 'Automation', action: 'Asset operational tab created', resource: definition.title, result: 'Success', details: { columns: definition.headers.length, rowsSeeded: 0 } });
    } catch (error) {
      console.error(`[ASSET SHEETS] Could not create ${definition.title}: ${error.message}`);
      logPortalAuditEvent({ actorType: 'Bot', source: 'Automation', action: 'Asset operational tab creation failed', resource: definition.title, result: 'Error', details: { error: String(error.message || error).slice(0, 400) } });
    }
  }
}

function rowsFromValues(sheet, values) {
  const headers = (values?.[0] || []).map(value => String(value ?? '').trim());
  if (!headers.some(Boolean)) return [];
  // Keep google-spreadsheet consumers on this worksheet aligned with the
  // headers from the same batch response; getRows() would add one request per tab.
  sheet._headerValues = headers;
  return values.slice(1).map((rawData, index) => ({
    _rawData: rawData,
    rowNumber: index + 2,
    get(header) {
      const columnIndex = headers.indexOf(header);
      return columnIndex < 0 ? undefined : (rawData[columnIndex] ?? '');
    },
    toObject() {
      return Object.fromEntries(headers
        .map((header, columnIndex) => [header, rawData[columnIndex] ?? ''])
        .filter(([header]) => Boolean(header)));
    },
  }));
}

async function refreshAssetCache() {
  if (isFetching) {
    refreshRequested = true;
    logPortalAuditEvent({ actorType: 'Bot', source: 'Automation', action: 'Asset cache refresh coalesced', resource: 'Asset Google Sheets cache', result: 'Skipped', details: { reason: 'A refresh is already in progress.' } });
    return;
  }
  isFetching = true;
  const requestId = randomUUID();
  const startedAt = Date.now();
  logPortalAuditEvent({ requestId, actorType: 'Bot', source: 'Automation', action: 'Asset cache refresh started', resource: 'Asset Google Sheets cache', result: 'Started' });
  try {
    await assetDoc.loadInfo();
    await ensureOperationalSheets();
    const sheetsApi = google.sheets({ version: 'v4', auth: serviceAccountAuth });
    
    const getSheetFuzzy = (keyword) => {
      const cleanKeyword = keyword.toLowerCase().replace(/[^a-z0-9]/g, '');
      const sheets = assetDoc.sheetsByIndex;
      const normalizedTitle = sheet => sheet.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      const exact = sheets.find(sheet => normalizedTitle(sheet) === cleanKeyword);
      if (exact) return exact;
      if (cleanKeyword === 'categories') {
        return sheets.find(sheet => {
          const title = normalizedTitle(sheet);
          return title.endsWith('categories') && !title.includes('subcategories');
        });
      }
      if (cleanKeyword === 'subcategories') {
        return sheets.find(sheet => normalizedTitle(sheet).includes('subcategories'));
      }
      return sheets.find(sheet => normalizedTitle(sheet).includes(cleanKeyword));
    };

    const sheetKeys = [
      'branches', 'users', 'employees', 'categories', 'subcategories', 
      'locations', 'assets', 'assetcustomdata', 'assignments', 'transfers', 
      'transferitems', 'maintenance', 'inventory', 'inventorytransactions', 
      'vendors', 'documents', 'history', 'audits', 'audititems', 'disposals',
      'assetapprovals', 'assetnotificationlog', 'assetqrregistry', 'assetactivitylog'
    ];

    const selectedSheets = sheetKeys.map(key => getSheetFuzzy(key));
    const existingSheets = selectedSheets.filter(Boolean);
    // Asset tabs use fewer than 60 columns. Bounding the requested width keeps
    // the initial cache read small even when a sheet has an oversized grid.
    const ranges = existingSheets.map(sheet => `'${String(sheet.title).replace(/'/g, "''")}'!A1:BH`);
    const response = ranges.length
      ? await fetchAssetBatchWithRetry(sheetsApi, assetDoc.spreadsheetId, ranges)
      : { data: { valueRanges: [] } };
    const valueRanges = response.data?.valueRanges || [];
    const fetchedData = {};
    let responseIndex = 0;
    sheetKeys.forEach((key, index) => {
      const sheet = selectedSheets[index];
      fetchedData[key] = sheet
        ? rowsFromValues(sheet, valueRanges[responseIndex++]?.values || [])
        : [];
    });

    assetCache = fetchedData;
    assetCacheUpdatedAt = new Date().toISOString();
    console.log("📦 Asset Management Cache successfully synced with Google Sheets!");
    logPortalAuditEvent({ requestId, actorType: 'Bot', source: 'Automation', action: 'Asset cache refresh completed', resource: 'Asset Google Sheets cache', result: 'Success', durationMs: Date.now() - startedAt, details: { sheetsRead: existingSheets.length } });
  } catch (err) { 
    console.error("❌ Asset Management Cache sync failed:", err.message); 
    logPortalAuditEvent({ requestId, actorType: 'Bot', source: 'Automation', action: 'Asset cache refresh failed', resource: 'Asset Google Sheets cache', result: 'Error', durationMs: Date.now() - startedAt, details: { error: String(err.message || err).slice(0, 500) } });
    setTimeout(refreshAssetCache, err.response?.status === 429 ? 60000 : 15000);
  } finally {
    isFetching = false;
    if (refreshRequested) {
      refreshRequested = false;
      setTimeout(refreshAssetCache, 0);
    }
  }
}

// Start after the placement cache's initial load has begun.
setTimeout(refreshAssetCache, 5000);
// 🚨 Run every 6 minutes instead of 5 to further reduce overlap
setInterval(refreshAssetCache, 360000); 

module.exports = { assetDoc, getAssetCache, getAssetCacheUpdatedAt, isAssetCacheReady, refreshAssetCache };
