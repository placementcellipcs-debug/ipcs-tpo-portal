const { assetDoc, getAssetCache, getAssetCacheUpdatedAt, isAssetCacheReady, refreshAssetCache } = require('./assetConfig');
const { getCache, uploadToDrive, sendIPCSMail, logPortalAuditEvent } = require('./config');
const { randomBytes } = require('crypto');
const { formatIndiaTimestamp } = require('./utils/dateTime');
const assetTaxonomy = require('./assetTaxonomy');

// Helper to safely map sheet headers regardless of spaces or cases
const getH = (headers, target) => {
  const cleanTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '');
  return headers.find(h => (h||'').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget) || target;
};
const getOptionalH = (headers, target) => {
  const cleanTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '');
  return headers.find(h => (h || '').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget) || null;
};
async function ensureAssetHeaders(sheet, requiredHeaders) {
  await sheet.loadHeaderRow();
  let headers = [...(sheet.headerValues || [])];
  const normalized = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const missing = requiredHeaders.filter(header => !headers.some(existing => normalized(existing) === normalized(header)));
  if (missing.length) {
    const requiredColumnCount = headers.length + missing.length;
    if ((Number(sheet.columnCount) || 0) < requiredColumnCount) {
      await sheet.resize({ columnCount: requiredColumnCount });
    }
    headers = [...headers, ...missing];
    await sheet.setHeaderRow(headers);
    sheet._headerValues = headers;
  }
  return headers;
}
const normalize = value => String(value || '').trim().toLowerCase().replace(/\s*branch\s*/g, ' ').replace(/[^a-z0-9]/g, '');
const normalizeHeader = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const stableCategoryCode = (name, existingRows, headers) => {
  const codeHeader = getH(headers, 'Category_Code');
  const idHeader = getH(headers, 'Category_ID');
  const used = new Set(existingRows.flatMap(row => [row.get(codeHeader), row.get(idHeader)]).map(value => normalizeHeader(value)).filter(Boolean));
  const base = String(name || '').trim().split(/[^A-Za-z0-9]+/).filter(Boolean).map(word => word[0]).join('').toUpperCase().slice(0, 6) || 'CAT';
  let candidate = base;
  for (let suffix = 2; used.has(normalizeHeader(candidate)); suffix += 1) candidate = `${base}${suffix}`;
  return candidate;
};
const nextHierarchyId = (rows, headers, idField, prefix, parentField, parentId) => {
  const idHeader = getH(headers, idField);
  const parentHeader = parentField ? getH(headers, parentField) : null;
  const regex = new RegExp(`^${String(prefix)}-(?:SC|T)(\\d+)$`, 'i');
  let max = 0;
  rows.forEach(row => {
    if (parentHeader && normalize(row.get(parentHeader)) !== normalize(parentId)) return;
    const match = String(row.get(idHeader) || '').trim().match(regex);
    if (match) max = Math.max(max, Number(match[1]));
  });
  const marker = idField === 'Subcategory_ID' ? 'SC' : 'T';
  return `${prefix}-${marker}${String(max + 1).padStart(2, '0')}`;
};
const findAssetSheet = kind => {
  const wanted = normalizeHeader(kind);
  const sheets = assetDoc.sheetsByIndex || [];
  const base = sheet => normalizeHeader(sheet.title).replace(/^\d+/, '');
  const accepted = wanted === 'categories' ? ['assetcategorymasterv3']
    : wanted === 'subcategories' ? ['assetsubcategorymasterv3']
      : wanted === 'assettypes' ? ['assettypemasterv3'] : [wanted, `asset${wanted}`];
  return accepted.map(candidate => sheets.find(sheet => normalizeHeader(sheet.title) === candidate || base(sheet) === candidate)).find(Boolean)
    || null;
};
const rowValue = (row, field) => {
  const values = row?.toObject?.() || {};
  const key = Object.keys(values).find(header => normalizeHeader(header) === normalizeHeader(field));
  return key ? values[key] : '';
};
const isQuantityTracked = row => String(rowValue(row, 'Tracking_Mode') || 'INDIVIDUAL').trim().toUpperCase() === 'QUANTITY';
const parseJsonField = (value, fallback) => {
  if (typeof value !== 'string') return value ?? fallback;
  try { return JSON.parse(value); } catch { return fallback; }
};
const sheetByKey = key => {
  const sheets = assetDoc.sheetsByIndex || [];
  const normalizeTitle = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const aliases = {
    assets: ['assetregisterv3'], assignments: ['assetassignmentsv3'],
    history: ['assethistoryv3'], disposals: ['assetdisposalsv3'],
    assetapprovals: ['assetapprovalsv3'], transfers: ['assettransfersv3'],
    inventory: ['assetinventoryv3'], inventorytransaction: ['assetinventorytransactionsv3'],
    assetactivitylog: ['assetactivitylogv3'], assetqrregistry: ['assetqrregistryv3'], assetcustomdata: ['assetcustomdatav3'],
    documents: ['assetdocumentsv3'], maintenance: ['assetmaintenancev3'],
    locations: ['assetlocationsv3'], vendors: ['assetvendorsv3'],
    categories: ['assetcategorymasterv3'],
    subcategories: ['assetsubcategorymasterv3'],
    assetcategorymaster: ['assetcategorymasterv3'],
    assetsubcategorymaster: ['assetsubcategorymasterv3'],
    assettypemaster: ['assettypemasterv3'],
    assettypes: ['assettypemasterv3']
  };
  const accepted = aliases[key] || [key];
  const normalizedBase = sheet => normalizeTitle(sheet.title).replace(/^\d+/, '');
  return accepted.map(candidate => sheets.find(sheet => normalizeTitle(sheet.title) === candidate || normalizedBase(sheet) === candidate)).find(Boolean) || null;
};
const cacheAppendedRow = (key, row) => {
  const cache = getAssetCache();
  if (row && Array.isArray(cache?.[key])) cache[key].push(row);
};
const respondWhileAssetDataLoads = res => {
  if (isAssetCacheReady()) return false;
  res.status(503).json({
    success: false,
    code: 'ASSET_DATA_LOADING',
    message: 'Asset data is still syncing from the workbook. Please retry in a few seconds.'
  });
  return true;
};

async function appendAssetActivity(req, event) {
  const sheet = sheetByKey('assetactivitylog');
  if (!sheet) return;
  try {
    const headers = await ensureAssetHeaders(sheet, ['Event_ID', 'Timestamp', 'Actor_ID', 'Actor_Name', 'Actor_Email', 'Actor_Role', 'Branch', 'Action', 'Entity_Type', 'Entity_ID', 'Before_JSON', 'After_JSON', 'Source', 'Request_ID']);
    const actor = req.portalUser || {};
    const savedRow = await sheet.addRow({
      [getH(headers, 'Event_ID')]: `AST-EVT-${randomBytes(9).toString('hex').toUpperCase()}`,
      [getH(headers, 'Timestamp')]: formatIndiaTimestamp(),
      [getH(headers, 'Actor_ID')]: actor.userId || actor.id || actor.employeeId || '',
      [getH(headers, 'Actor_Name')]: actor.name || event.actorName || '',
      [getH(headers, 'Actor_Email')]: actor.email || '',
      [getH(headers, 'Actor_Role')]: actor.role || '',
      [getH(headers, 'Branch')]: event.branch || actor.sittingBranch || '',
      [getH(headers, 'Action')]: event.action || '',
      [getH(headers, 'Entity_Type')]: event.entityType || 'Asset',
      [getH(headers, 'Entity_ID')]: event.entityId || '',
      [getH(headers, 'Before_JSON')]: JSON.stringify(event.before ?? {}),
      [getH(headers, 'After_JSON')]: JSON.stringify(event.after ?? {}),
      [getH(headers, 'Source')]: 'Asset Management portal',
      [getH(headers, 'Request_ID')]: req.portalAuditRequestId || ''
    });
    cacheAppendedRow('assetactivitylog', savedRow);
  } catch (error) {
    logPortalAuditEvent({ requestId: req.portalAuditRequestId, actorType: 'Bot', source: 'Automation', action: 'Asset activity record failed', resource: event.entityType || 'Asset', result: 'Warning', details: { action: event.action || '', entityId: event.entityId || '', error: String(error.message || error).slice(0, 300) } });
  }
}

async function appendAssetApproval(event) {
  const sheet = sheetByKey('assetapprovals');
  if (!sheet) return;
  try {
    const headers = await ensureAssetHeaders(sheet, ['Approval_ID', 'Request_ID', 'Request_Type', 'Asset_ID', 'Branch', 'Requested_By', 'Requested_At', 'Decision', 'Decided_By', 'Decided_At', 'Reason', 'Requested_By_Email', 'Reviewed_By_Email', 'Payload_JSON']);
    const savedRow = await sheet.addRow({
      [getH(headers, 'Approval_ID')]: `APR-${randomBytes(8).toString('hex').toUpperCase()}`,
      [getH(headers, 'Request_ID')]: event.requestId || '',
      [getH(headers, 'Request_Type')]: event.requestType || 'TRANSFER',
      [getH(headers, 'Asset_ID')]: event.assetId || '',
      [getH(headers, 'Branch')]: event.branch || '',
      [getH(headers, 'Requested_By')]: event.requestedBy || '',
      [getH(headers, 'Requested_At')]: event.requestedAt || formatIndiaTimestamp(),
      [getH(headers, 'Decision')]: event.decision || 'PENDING',
      [getH(headers, 'Decided_By')]: event.decidedBy || '',
      [getH(headers, 'Decided_At')]: event.decidedAt || '',
      [getH(headers, 'Reason')]: event.reason || '',
      [getH(headers, 'Requested_By_Email')]: event.requestedByEmail || '',
      [getH(headers, 'Reviewed_By_Email')]: event.reviewedByEmail || '',
      [getH(headers, 'Payload_JSON')]: JSON.stringify(event.payload || {})
    });
    cacheAppendedRow('assetapprovals', savedRow);
  } catch (error) {
    logPortalAuditEvent({ actorType: 'Bot', source: 'Automation', action: 'Asset approval ledger write failed', resource: 'Asset_Approvals', result: 'Warning', details: { requestId: event.requestId || '', error: String(error.message || error).slice(0, 300) } });
  }
}

async function updateAssetApproval(event) {
  const sheet = sheetByKey('assetapprovals');
  if (!sheet) return;
  try {
    const headers = await ensureAssetHeaders(sheet, ['Approval_ID', 'Request_ID', 'Request_Type', 'Asset_ID', 'Branch', 'Requested_By', 'Requested_At', 'Decision', 'Decided_By', 'Decided_At', 'Reason', 'Requested_By_Email', 'Reviewed_By_Email', 'Payload_JSON']);
    const rows = await sheet.getRows();
    const row = rows.find(item => String(item.get(getH(headers, 'Request_ID')) || '').trim().toLowerCase() === String(event.requestId || '').trim().toLowerCase());
    if (!row) return appendAssetApproval(event);
    row.assign({
      [getH(headers, 'Decision')]: event.decision || '',
      [getH(headers, 'Decided_By')]: event.decidedBy || '',
      [getH(headers, 'Decided_At')]: event.decidedAt || formatIndiaTimestamp(),
      [getH(headers, 'Reason')]: event.reason || '',
      [getH(headers, 'Reviewed_By_Email')]: event.reviewedByEmail || ''
    });
    await row.save();
  } catch (error) {
    logPortalAuditEvent({ actorType: 'Bot', source: 'Automation', action: 'Asset approval decision ledger update failed', resource: 'Asset_Approvals', result: 'Warning', details: { requestId: event.requestId || '', error: String(error.message || error).slice(0, 300) } });
  }
}

async function appendAssetQrLabel(event) {
  const sheet = sheetByKey('assetqrregistry');
  if (!sheet) return false;
  try {
    const headers = await ensureAssetHeaders(sheet, ['QR_ID', 'Asset_ID', 'QR_Value', 'QR_Version', 'Created_By', 'Created_At', 'Status']);
    const rows = await sheet.getRows();
    const assetId = String(event.assetId || '').trim();
    const existing = rows.find(row => String(row.get(getH(headers, 'Asset_ID')) || '').trim().toLowerCase() === assetId.toLowerCase() && String(row.get(getH(headers, 'Status')) || '').trim().toUpperCase() === 'ACTIVE');
    const values = {
      [getH(headers, 'QR_ID')]: existing?.get(getH(headers, 'QR_ID')) || `QR-${randomBytes(8).toString('hex').toUpperCase()}`,
      [getH(headers, 'Asset_ID')]: assetId,
      [getH(headers, 'QR_Value')]: `/assets/item/${encodeURIComponent(assetId)}`,
      [getH(headers, 'QR_Version')]: 'PORTAL_LINK_V1',
      [getH(headers, 'Created_By')]: event.createdBy || '',
      [getH(headers, 'Created_At')]: formatIndiaTimestamp(),
      [getH(headers, 'Status')]: 'ACTIVE'
    };
    if (existing) { existing.assign(values); await existing.save(); }
    else {
      const savedRow = await sheet.addRow(values);
      cacheAppendedRow('assetqrregistry', savedRow);
    }
    return true;
  } catch (error) {
    logPortalAuditEvent({ actorType: 'Bot', source: 'Automation', action: 'Asset QR registry write failed', resource: 'Asset_QR_Registry', result: 'Warning', details: { assetId: event.assetId || '', error: String(error.message || error).slice(0, 300) } });
    return false;
  }
}

exports.registerAssetQrLabel = async (req, res) => {
  try {
    const assetId = String(req.params.assetId || '').trim();
    const asset = (getAssetCache()?.assets || []).find(row => String(rowValue(row, 'Asset_ID') || '').trim().toLowerCase() === assetId.toLowerCase());
    if (!asset) return res.status(404).json({ success: false, message: 'That asset could not be found.' });
    const branch = rowValue(asset, 'Branch') || '';
    if (!canAccessAssetBranch(req, branch)) return res.status(403).json({ success: false, message: 'That asset is outside your branch access.' });
    if (isQuantityTracked(asset)) return res.status(409).json({ success: false, message: 'Quantity groups do not receive individual QR labels. Register each serial-tracked item separately to label it.' });
    const saved = await appendAssetQrLabel({ assetId, createdBy: req.portalUser?.name || req.portalUser?.email || '' });
    if (!saved) return res.status(503).json({ success: false, message: 'The QR registry could not be updated, so the label was not prepared.' });
    await appendAssetActivity(req, { action: 'QR_LABEL_CREATED', entityType: 'Asset', entityId: assetId, branch, after: { qrVersion: 'PORTAL_LINK_V1' } });
    refreshAssetCache();
    return res.json({ success: true, message: 'The item label is ready.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: `Could not create the QR label: ${error.message}` });
  }
};

async function appendAssetNotification(event) {
  const sheet = sheetByKey('assetnotificationlog');
  if (!sheet) return;
  try {
    const headers = await ensureAssetHeaders(sheet, ['Notification_ID', 'Event_Type', 'Recipient', 'Subject', 'Delivery_Status', 'Provider', 'Queue_ID', 'Attempt_Count', 'Created_At', 'Last_Error', 'Related_Entity_ID', 'Branch']);
    const savedRow = await sheet.addRow({
      [getH(headers, 'Notification_ID')]: `NTF-${randomBytes(8).toString('hex').toUpperCase()}`,
      [getH(headers, 'Event_Type')]: event.eventType || 'ASSET_SUMMARY',
      [getH(headers, 'Recipient')]: event.recipient || '',
      [getH(headers, 'Subject')]: event.subject || '',
      [getH(headers, 'Delivery_Status')]: event.status || 'SENT',
      [getH(headers, 'Provider')]: event.provider || '',
      [getH(headers, 'Queue_ID')]: event.queueId || '',
      [getH(headers, 'Attempt_Count')]: event.attemptCount || 0,
      [getH(headers, 'Created_At')]: formatIndiaTimestamp(),
      [getH(headers, 'Last_Error')]: event.error || '',
      [getH(headers, 'Related_Entity_ID')]: event.entityId || '',
      [getH(headers, 'Branch')]: event.branch || ''
    });
    cacheAppendedRow('assetnotificationlog', savedRow);
  } catch (error) {
    logPortalAuditEvent({ actorType: 'Bot', source: 'Automation', action: 'Asset mail ledger write failed', resource: 'Asset_Notification_Log', result: 'Warning', details: { eventType: event.eventType || '', error: String(error.message || error).slice(0, 300) } });
  }
}

async function saveAssetPhoto(assetId, file, documentType, userName, fileUrl = '') {
  if (!file) return '';
  const docSheet = sheetByKey('documents');
  if (!docSheet) throw new Error('Asset photo history is unavailable. Add the Documents sheet before uploading photos.');
  const storedUrl = fileUrl || await uploadToDrive(file, process.env.DRIVE_FOLDER_ID || '');
  const headers = docSheet.headerValues;
  await docSheet.addRow({
    [getH(headers, 'Document_ID')]: `DOC-${randomBytes(5).toString('hex').toUpperCase()}`,
    [getH(headers, 'Asset_ID')]: assetId,
    [getH(headers, 'Document_Type')]: documentType,
    [getH(headers, 'File_Name')]: file.originalname,
    [getH(headers, 'Drive_URL')]: storedUrl,
    [getH(headers, 'Uploaded_By')]: userName || '',
    [getH(headers, 'Uploaded_At')]: formatIndiaTimestamp()
  });
  return storedUrl;
}
const isAssetAdmin = req => {
  const user = req.portalUser || {};
  const role = String(user.role || '').toUpperCase();
  return user.accessType === 'superadmin' || ['SYSTEM ADMIN', 'GENERAL MANAGER', 'ZONAL PLACEMENT HEAD', 'TECHNICAL HEAD'].includes(role);
};
const ASSET_APPROVER_EMAIL = 'rakesh@ipcsglobal.com';
const isAssetApprover = req => String(req.portalUser?.email || '').trim().toLowerCase() === ASSET_APPROVER_EMAIL;
const canAccessAssetBranch = (req, branch) => {
  // The designated approver reviews requests across the whole asset estate.
  if (isAssetApprover(req)) return true;
  if (isAssetAdmin(req)) return true;
  const user = req.portalUser || {};
  const branches = Array.isArray(user.assignedBranchesArray) ? user.assignedBranchesArray : [];
  const assigned = branches.length ? branches : [user.sittingBranch];
  if (assigned.some(value => String(value).trim().toLowerCase() === 'all')) return false;
  const target = normalize(branch);
  return Boolean(target && assigned.some(value => normalize(value) === target));
};

function getVisibleAssetActivity(req, cache) {
  const assetBranchById = new Map((cache.assets || []).map(row => [
    String(rowValue(row, 'Asset_ID') || '').trim().toLowerCase(), rowValue(row, 'Branch') || ''
  ]));
  const unified = (cache.assetactivitylog || []).map(row => ({
    historyId: rowValue(row, 'Event_ID'),
    assetId: rowValue(row, 'Entity_ID'),
    entityType: rowValue(row, 'Entity_Type'),
    action: rowValue(row, 'Action'),
    branch: rowValue(row, 'Branch'),
    performedBy: rowValue(row, 'Actor_Name'),
    actorRole: rowValue(row, 'Actor_Role'),
    timestamp: rowValue(row, 'Timestamp'),
    oldValue: rowValue(row, 'Before_JSON'),
    newValue: rowValue(row, 'After_JSON'),
    remarks: rowValue(row, 'Remarks'),
    requestId: rowValue(row, 'Request_ID'),
    source: rowValue(row, 'Source'),
    unified: true
  }));
  const legacy = (cache.history || []).map(row => {
    const assetId = rowValue(row, 'Asset_ID');
    return {
      historyId: rowValue(row, 'History_ID'), assetId, action: rowValue(row, 'Action'),
      entityType: 'Asset',
      branch: rowValue(row, 'Branch') || assetBranchById.get(String(assetId || '').trim().toLowerCase()) || '',
      performedBy: rowValue(row, 'Performed_By'), timestamp: rowValue(row, 'Timestamp'),
      actorRole: '',
      oldValue: rowValue(row, 'Old_Value'), newValue: rowValue(row, 'New_Value'),
      remarks: rowValue(row, 'Remarks'), unified: false
    };
  });
  const parseTime = value => {
    const match = String(value || '').match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0)).getTime();
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const canonicalAction = value => String(value || '').trim().toUpperCase().replace('TRANSFER_DISPATCHED', 'TRANSFER_APPROVED');
  const visibleUnified = unified.filter(item => canAccessAssetBranch(req, item.branch));
  const visibleLegacy = legacy.filter(item => canAccessAssetBranch(req, item.branch));
  const merged = [...visibleUnified];
  for (const item of visibleLegacy) {
    const itemTime = parseTime(item.timestamp);
    const duplicate = visibleUnified.some(current => {
      const sameRecord = canonicalAction(current.action) === canonicalAction(item.action)
        && String(current.assetId || '').trim().toLowerCase() === String(item.assetId || '').trim().toLowerCase()
        && normalize(current.branch) === normalize(item.branch);
      return sameRecord && Math.abs(parseTime(current.timestamp) - itemTime) <= 10_000;
    });
    if (!duplicate) merged.push(item);
  }
  return merged.sort((left, right) => parseTime(right.timestamp) - parseTime(left.timestamp));
}

// =========================================================
// 1. ASSET DASHBOARD ANALYTICS
// =========================================================
exports.getAssetDashboardStats = async (req, res) => {
  try {
    if (respondWhileAssetDataLoads(res)) return;
    const cache = getAssetCache();
    const assets = (cache.assets || []).filter(row => canAccessAssetBranch(req, rowValue(row, 'Branch')));
    const allowedAssetIds = new Set(assets.map(row => String(rowValue(row, 'Asset_ID') || '').trim().toLowerCase()));
    const inventory = (cache.inventory || []).filter(row => canAccessAssetBranch(req, rowValue(row, 'Branch')));
    const maintenance = (cache.maintenance || []).filter(row => allowedAssetIds.has(String(rowValue(row, 'Asset_ID') || '').trim().toLowerCase()));
    const transfers = (cache.transfers || []).filter(row => canAccessAssetBranch(req, rowValue(row, 'From_Branch')));
    const activity = getVisibleAssetActivity(req, cache);

    const parseAssetDate = value => {
      const raw = String(value || '').trim();
      if (!raw) return null;
      const localDate = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
      if (localDate) {
        const [, day, month, year, hour = '0', minute = '0', second = '0'] = localDate;
        const parsed = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      }
      const parsed = new Date(raw);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    let totalAssets = 0;
    let totalValue = 0;
    let assigned = 0;
    let available = 0;
    let underMaintenance = 0;
    let branchStats = {};
    let categoryStats = {};

    assets.forEach(r => {
      const rd = r.toObject();
      const getV = (str) => { 
        const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, '')); 
        return k ? rd[k] : ''; 
      };
      
      const assetId = getV('assetid');
      if (!assetId) return;

      const units = isQuantityTracked(r) ? Math.max(1, parseInt(getV('quantity'), 10) || 1) : 1;
      totalAssets += units;
      const cost = parseFloat(getV('purchasecost')) || 0;
      totalValue += cost;

      const status = (getV('status') || '').toUpperCase();
      if (status === 'ASSIGNED') assigned += units;
      else if (status === 'AVAILABLE') available += units;
      else if (status === 'UNDER_MAINTENANCE') underMaintenance += units;

      const branch = getV('branch') || 'Unknown';
      branchStats[branch] = (branchStats[branch] || 0) + units;

      const category = getV('category') || 'Other';
      categoryStats[category] = (categoryStats[category] || 0) + units;
    });

    const formattedBranches = Object.keys(branchStats)
      .map(k => ({ name: k, value: branchStats[k] }))
      .sort((a,b) => b.value - a.value);
      
    const formattedCategories = Object.keys(categoryStats)
      .map(k => ({ name: k, value: categoryStats[k] }))
      .sort((a,b) => b.value - a.value);

    const lowStock = inventory.map(r => {
      const rd = r.toObject();
      const getV = (str) => { 
        const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, '')); 
        return k ? rd[k] : ''; 
      };
      return { 
        name: getV('itemname'), 
        branch: getV('branch'), 
        qty: parseInt(getV('quantity') || 0), 
        min: parseInt(getV('minimumquantity') || 0) 
      };
    }).filter(i => i.qty <= i.min);

    const activeMaintenance = maintenance.filter(r => {
      const rd = r.toObject();
      const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === 'status');
      return (rd[k] || '').toUpperCase() === 'OPEN';
    }).length;

    const monthFormatter = new Intl.DateTimeFormat('en-IN', { month: 'short' });
    const now = new Date();
    const activityTrend = Array.from({ length: 8 }, (_, index) => {
      const month = new Date(now.getFullYear(), now.getMonth() - (7 - index), 1);
      return { key: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`, month: monthFormatter.format(month), events: 0 };
    });
    const trendByMonth = new Map(activityTrend.map(item => [item.key, item]));
    activity.forEach(item => {
      const date = parseAssetDate(item.timestamp);
      if (!date) return;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const month = trendByMonth.get(key);
      if (month) month.events += 1;
    });
    const recentActivity = activity
      .map(item => ({ ...item, _date: parseAssetDate(item.timestamp) }))
      .sort((a, b) => (b._date?.getTime() || 0) - (a._date?.getTime() || 0))
      .slice(0, 8)
      .map(({ _date, ...item }) => item);
    const pendingTransfers = transfers.filter(row => String(rowValue(row, 'Status') || '').trim().toUpperCase() === 'PENDING').length;
    const pendingRetirements = (cache.assetapprovals || []).filter(row =>
      String(rowValue(row, 'Request_Type') || '').trim().toUpperCase() === 'DELETE_ASSET'
      && String(rowValue(row, 'Decision') || 'PENDING').trim().toUpperCase() === 'PENDING'
      && canAccessAssetBranch(req, rowValue(row, 'Branch'))
    ).length;
    const pendingApprovals = pendingTransfers + pendingRetirements;
    const updatedAt = getAssetCacheUpdatedAt();

    res.json({
      success: true,
      stats: { 
        totalAssets, 
        totalValue: isAssetAdmin(req) ? totalValue : null,
        assigned, 
        available, 
        underMaintenance, 
        branches: formattedBranches, 
        categories: formattedCategories, 
        lowStock, 
        activeMaintenance,
        pendingApprovals,
        activityTrend,
        recentActivity,
        updatedAt
      }
    });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

exports.sendAssetSummaryEmail = async (req, res) => {
  try {
    if (respondWhileAssetDataLoads(res)) return;
    const recipient = String(req.portalUser?.email || '').trim().toLowerCase();
    if (!recipient) return res.status(400).json({ success: false, message: 'Your portal account does not have an email address.' });
    const cache = getAssetCache();
    const assets = (cache.assets || []).filter(row => canAccessAssetBranch(req, rowValue(row, 'Branch')));
    const inventory = (cache.inventory || []).filter(row => canAccessAssetBranch(req, rowValue(row, 'Branch')));
    const transfers = (cache.transfers || []).filter(row => canAccessAssetBranch(req, rowValue(row, 'From_Branch')));
    const units = assets.reduce((sum, row) => sum + (isQuantityTracked(row) ? Math.max(1, parseInt(rowValue(row, 'Quantity'), 10) || 1) : 1), 0);
    const assigned = assets.filter(row => String(rowValue(row, 'Status') || '').toUpperCase() === 'ASSIGNED').reduce((sum, row) => sum + (isQuantityTracked(row) ? Math.max(1, parseInt(rowValue(row, 'Quantity'), 10) || 1) : 1), 0);
    const available = assets.filter(row => String(rowValue(row, 'Status') || '').toUpperCase() === 'AVAILABLE').reduce((sum, row) => sum + (isQuantityTracked(row) ? Math.max(1, parseInt(rowValue(row, 'Quantity'), 10) || 1) : 1), 0);
    const pendingTransfers = transfers.filter(row => String(rowValue(row, 'Status') || '').toUpperCase() === 'PENDING').length;
    const lowStock = inventory.filter(row => Number(rowValue(row, 'Quantity') || 0) <= Number(rowValue(row, 'Minimum_Quantity') || 0)).length;
    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
    const branchLabel = String(req.portalUser?.sittingBranch || 'your assigned branches');
    const subject = `Your IPCS asset operations summary · ${new Date().toLocaleDateString('en-IN')}`;
    if (String(process.env.ASSET_DEMO_MODE || '').toLowerCase() === 'true') {
      await appendAssetNotification({ eventType: 'ASSET_SUMMARY', recipient, subject, status: 'PREVIEW_ONLY', provider: 'demo-mode', branch: branchLabel });
      return res.json({ success: true, status: 'PREVIEW_ONLY', message: 'Demo mode is on, so no email was sent. The report request was logged as a preview.' });
    }
    const mail = await sendIPCSMail({
      to: recipient,
      subject,
      text: `Asset summary for ${branchLabel}: ${units} physical units across ${assets.length} asset records, ${assigned} assigned, ${available} available, ${pendingTransfers} pending transfers, ${lowStock} low-stock alerts.`,
      html: `<div style="font-family:Arial,sans-serif;color:#17253a;max-width:620px;margin:auto"><div style="padding:22px 24px;background:#10283b;color:#eaf6ff;border-radius:14px 14px 0 0"><small style="letter-spacing:2px;color:#7ee7d4">IPCS ASSET OPERATIONS</small><h1 style="font-size:23px;margin:9px 0 4px">Asset summary</h1><p style="margin:0;color:#b3c7da">${escapeHtml(branchLabel)} · ${escapeHtml(new Date().toLocaleDateString('en-IN'))}</p></div><div style="padding:22px 24px;background:#f5f9fc;border:1px solid #d9e5ed;border-top:0;border-radius:0 0 14px 14px"><table style="width:100%;border-collapse:collapse"><tbody>${[['Physical units', units], ['Asset records', assets.length], ['Assigned units', assigned], ['Available units', available], ['Pending transfers', pendingTransfers], ['Low stock alerts', lowStock]].map(([label, value]) => `<tr><td style="padding:12px;border-bottom:1px solid #dce6ed">${label}</td><td style="padding:12px;border-bottom:1px solid #dce6ed;text-align:right;font-weight:bold">${value}</td></tr>`).join('')}</tbody></table><p style="font-size:12px;color:#73869b;margin:18px 0 0">This report was requested from the IPCS Asset Management portal.</p></div></div>`
    }, { category: 'portal', logDetails: { name: req.portalUser.name || '', email: recipient, type: 'asset-summary' }, context: { source: 'asset-management', branch: branchLabel } });
    await appendAssetNotification({ eventType: 'ASSET_SUMMARY', recipient, subject, status: mail.queued ? 'QUEUED' : 'SENT', provider: mail.provider || '', queueId: mail.queueId || '', branch: branchLabel });
    return res.json({ success: true, status: mail.queued ? 'QUEUED' : 'SENT', message: mail.queued ? 'The report was added to the email retry queue.' : 'The asset summary was sent to your portal email.' });
  } catch (err) {
    return res.status(502).json({ success: false, message: `Could not send the asset summary: ${err.message}` });
  }
};

exports.getAssetActivity = (req, res) => {
  try {
    if (respondWhileAssetDataLoads(res)) return;
    const cache = getAssetCache();
    const assetsById = new Map((cache.assets || []).map(row => [String(rowValue(row, 'Asset_ID') || '').trim().toLowerCase(), row]));
    const requestedAssetId = String(req.query.assetId || '').trim().toLowerCase();
    const query = String(req.query.q || '').trim().toLowerCase();
    const activity = getVisibleAssetActivity(req, cache).filter(item => {
      const asset = assetsById.get(String(item.assetId || '').trim().toLowerCase());
      if (requestedAssetId && String(item.assetId || '').trim().toLowerCase() !== requestedAssetId) return false;
      if (!query) return true;
      return [item.assetId, item.branch, item.action, item.entityType, item.performedBy,
        rowValue(asset, 'Asset_Name'), rowValue(asset, 'Name'), rowValue(asset, 'Category'), rowValue(asset, 'Subcategory')]
        .some(value => String(value || '').toLowerCase().includes(query));
    }).slice(0, 500);
    return res.json({ success: true, activity, count: activity.length });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAssetNotifications = (req, res) => {
  try {
    if (respondWhileAssetDataLoads(res)) return;
    const cache = getAssetCache();
    const userEmail = String(req.portalUser?.email || '').trim().toLowerCase();
    const isAdmin = isAssetAdmin(req);
    const notifications = (cache.assetnotificationlog || []).map(row => ({
      notificationId: rowValue(row, 'Notification_ID'), eventType: rowValue(row, 'Event_Type'),
      recipient: rowValue(row, 'Recipient'), subject: rowValue(row, 'Subject'),
      status: rowValue(row, 'Delivery_Status'), provider: rowValue(row, 'Provider'),
      queueId: rowValue(row, 'Queue_ID'), attempts: rowValue(row, 'Attempt_Count'),
      timestamp: rowValue(row, 'Created_At'), lastError: rowValue(row, 'Last_Error'),
      entityId: rowValue(row, 'Related_Entity_ID'), branch: rowValue(row, 'Branch')
    })).filter(item => (isAdmin || String(item.recipient || '').trim().toLowerCase() === userEmail)
      && (!item.branch || canAccessAssetBranch(req, item.branch))).reverse().slice(0, 100);
    return res.json({ success: true, notifications });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

// =========================================================
// 2. FETCH FORM PREREQUISITES (DROPDOWNS)
// =========================================================
exports.getRegistrationData = async (req, res) => {
  try {
    if (respondWhileAssetDataLoads(res)) return;
    const cache = getAssetCache();
    const gCache = getCache();
    // Prefer the Asset Management workbook's own branch list. Use the portal's
    // branch directory only as a compatibility fallback for older asset books.
    let branches = (cache.branches || []).map(row => rowValue(row, 'Branch_Name') || rowValue(row, 'Branch') || rowValue(row, 'Name'))
      .filter(Boolean);
    if (!branches.length && gCache?.branches) {
      branches = gCache.branches.map(row => {
        if (typeof row.get === 'function') return row.get('Branch') || row.get('Branch_Name') || row.get('Name');
        if (row._rawData && row._rawData.length > 2) return row._rawData[2];
        return null;
      }).filter(Boolean);
    }

    // Deduplicate and sort branches alphabetically
    branches = [...new Set(branches)].sort();
    if (!isAssetAdmin(req)) branches = branches.filter(branch => canAccessAssetBranch(req, branch));

    // Map Asset DB Sheets, accepting either a flat Categories table with one
    // category/subcategory pair per row or separate Categories/Subcategories tabs.
    const mapSheet = (rows) => rows.map(r => {
      const obj = typeof r?.toObject === 'function' ? r.toObject() : (r || {});
      const cleanObj = {};
      Object.keys(obj).forEach(k => { 
        cleanObj[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = obj[k]; 
      });
      return cleanObj;
    });
    const locations = mapSheet(cache.locations || []);
    const rawCategories = mapSheet(cache.assetcategorymaster?.length ? cache.assetcategorymaster : assetTaxonomy.categoryRows);
    const rawSubcategories = mapSheet(cache.assetsubcategorymaster?.length ? cache.assetsubcategorymaster : assetTaxonomy.subcategoryRows);
    const rawAssetTypes = mapSheet(cache.assettypemaster?.length ? cache.assettypemaster : assetTaxonomy.assetTypeRows);
    const active = row => {
      const status = String(row.status || '').trim().toLowerCase();
      return !status || ['active', 'enabled', 'current'].includes(status);
    };
    const cleanName = value => String(value || '').trim();
    const categoryByNameAndType = new Map();
    const categoryById = new Map();
    const categoryKey = (name, type) => `${normalize(name)}|${normalize(type)}`;
    const categories = [];
    const registerCategory = (nameValue, idValue, typeValue, statusValue) => {
      const name = cleanName(nameValue);
      if (!name) return null;
      // Existing category tabs predate the Type field. Treat their entries as
      // durable assets so they remain usable in the unified registration flow.
      const rawType = cleanName(typeValue).toUpperCase();
      const type = rawType.includes('GENERAL') ? 'GENERAL' : !rawType ? 'ASSET' : rawType.includes('CONSUM') || rawType.includes('STOCK') ? 'CONSUMABLE' : 'ASSET';
      const key = categoryKey(name, type);
      const idKey = normalize(idValue);
      let category = (idKey && categoryById.get(idKey)) || categoryByNameAndType.get(key);
      if (!category) {
        category = { categoryid: cleanName(idValue), categoryname: name, type, status: cleanName(statusValue) || 'ACTIVE' };
        categories.push(category);
      } else {
        if (!category.categoryid && idValue) category.categoryid = cleanName(idValue);
        if (!category.type && type) category.type = type;
      }
      categoryByNameAndType.set(categoryKey(category.categoryname, category.type), category);
      if (idValue) categoryById.set(idKey, category);
      return category;
    };
    rawCategories.forEach(row => {
      if (!active(row)) return;
      const categoryName = row.categoryname || row.name || row.category;
      const category = registerCategory(categoryName, row.categoryid, row.type || row.categorytype, row.status);
      if (!category) return;
      const subName = cleanName(row.subcategoryname || row.subcategory || row.childcategory || row.subcategorytitle);
      if (subName) {
        const key = `${categoryKey(category.categoryname, category.type)}|${normalize(subName)}`;
        if (!rawSubcategories._derivedKeys) rawSubcategories._derivedKeys = new Set();
        if (!rawSubcategories._derivedKeys.has(key)) {
          rawSubcategories._derivedKeys.add(key);
          rawSubcategories.push({ categoryid: category.categoryid, categoryname: category.categoryname, name: subName, subcategoryid: cleanName(row.subcategoryid), status: cleanName(row.status) || 'ACTIVE' });
        }
      }
    });
    const subcategoryKeys = new Set();
    const subcategories = [];
    rawSubcategories.forEach(row => {
      if (!active(row)) return;
      const name = cleanName(row.subcategoryname || row.name || row.subcategory || row.childcategory);
      if (!name) return;
      const parentId = cleanName(row.categoryid || row.parentcategoryid || row.parentid);
      const parentName = cleanName(row.categoryname || row.category || row.parentcategory);
      const category = (parentId && categoryById.get(normalize(parentId)))
        || categories.find(item => normalize(item.categoryname) === normalize(parentName));
      const categoryNameValue = category?.categoryname || parentName;
      const canonicalParentId = category?.categoryid || parentId;
      const key = `${normalize(canonicalParentId || categoryNameValue)}|${normalize(name)}`;
      if (subcategoryKeys.has(key)) return;
      subcategoryKeys.add(key);
      subcategories.push({ categoryid: canonicalParentId, categoryname: categoryNameValue, name, subcategoryid: cleanName(row.subcategoryid), type: cleanName(row.type).toUpperCase() || category?.type || 'ASSET', status: cleanName(row.status) || 'ACTIVE' });
    });

    const assetTypeKeys = new Set();
    const assetTypes = rawAssetTypes.filter(active).map(row => ({
      assettypeid: cleanName(row.assettypeid || row.typeid),
      categoryid: cleanName(row.categoryid),
      categoryname: cleanName(row.categoryname),
      subcategoryid: cleanName(row.subcategoryid),
      subcategoryname: cleanName(row.subcategoryname),
      name: cleanName(row.assettypename || row.assettype || row.name),
      type: cleanName(row.type).toUpperCase() || 'ASSET',
      status: cleanName(row.status) || 'ACTIVE'
    })).filter(row => {
      if (!row.name) return false;
      const key = `${normalize(row.subcategoryid || row.subcategoryname)}|${normalize(row.name)}`;
      if (assetTypeKeys.has(key)) return false;
      assetTypeKeys.add(key);
      return true;
    });

    res.json({ 
      success: true, 
      branches, 
      categories: categories.sort((a, b) => a.categoryname.localeCompare(b.categoryname)),
      subcategories: subcategories.sort((a, b) => a.name.localeCompare(b.name)),
      assetTypes: assetTypes.sort((a, b) => a.name.localeCompare(b.name)),
      locations,
      vendors: mapSheet(cache.vendors || []) 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// =========================================================
// 3. REGISTER NEW ASSET
// =========================================================
exports.addAsset = async (req, res) => {
  let assetId = '';
  let assetRecordSaved = false;
  try {
    const { userName, userEmail } = req.body || {};
    const asset = parseJsonField(req.body?.asset, {});
    const customFields = parseJsonField(req.body?.customFields, []);
    if (!asset?.name || !asset?.category || !asset?.subcategory || !asset?.assetType || !asset?.branch) return res.status(400).json({ success: false, message: 'Item name, category, subcategory, asset type, and branch are required.' });
    if (!canAccessAssetBranch(req, asset.branch)) return res.status(403).json({ success: false, message: 'You cannot register an asset for that branch.' });

    const trackingMode = String(asset.trackingMode || 'INDIVIDUAL').trim().toUpperCase() === 'QUANTITY' ? 'QUANTITY' : 'INDIVIDUAL';
    const quantity = trackingMode === 'QUANTITY' ? Number(asset.quantity) : 1;
    if (trackingMode === 'QUANTITY' && (!Number.isSafeInteger(quantity) || quantity < 1)) {
      return res.status(400).json({ success: false, message: 'Quantity must be a whole number of at least 1.' });
    }

    const assetSheet = sheetByKey('assets');
    const customSheet = sheetByKey('assetcustomdata');
    const historySheet = sheetByKey('history');
    const documentsSheet = sheetByKey('documents');

    if (!assetSheet) return res.status(404).json({ success: false, message: "Asset sheet missing in database." });
    if (req.file && !documentsSheet) return res.status(503).json({ success: false, message: 'Asset photo history is unavailable. No asset was registered.' });
    const assetHeaders = await ensureAssetHeaders(assetSheet, [
      'Asset_ID', 'Record_Type', 'Asset_Name', 'Category', 'Category_ID', 'Subcategory', 'Subcategory_ID', 'Asset_Type', 'Asset_Type_ID', 'Branch', 'Location',
      'Status', 'Condition', 'Brand', 'Model', 'Purchase_Date', 'Purchase_Cost',
      'Vendor', 'Invoice_Number', 'Warranty_End', 'Created_By', 'Timestamp', 'Tracking_Mode', 'Quantity', 'Serial_Number'
    ]);

    // Generate Unique IDs
    const timestamp = formatIndiaTimestamp();
    // The previous ID check loaded every asset row before each registration.
    // A 48-bit random suffix makes collisions vanishingly unlikely without a
    // full-sheet read on the submit path.
    assetId = `IPCS-AST-${new Date().getFullYear()}-${randomBytes(6).toString('hex').toUpperCase()}`;
    const photoUrl = req.file ? await uploadToDrive(req.file, process.env.DRIVE_FOLDER_ID || '') : '';

    const taxonomyRows = (rows, fallback) => (rows?.length ? rows : fallback).map(row => row?.toObject?.() || row || {});
    const categoryRows = taxonomyRows(getAssetCache()?.assetcategorymaster, assetTaxonomy.categoryRows);
    const subcategoryRows = taxonomyRows(getAssetCache()?.assetsubcategorymaster, assetTaxonomy.subcategoryRows);
    const assetTypeRows = taxonomyRows(getAssetCache()?.assettypemaster, assetTaxonomy.assetTypeRows);
    const taxonomyValue = (row, field) => {
      const values = row?.toObject?.() || row || {};
      const key = Object.keys(values).find(name => normalizeHeader(name) === normalizeHeader(field));
      return key ? values[key] : '';
    };
    const selectedCategory = categoryRows.find(row => asset.categoryId
      ? normalize(taxonomyValue(row, 'Category_ID')) === normalize(asset.categoryId)
      : normalize(taxonomyValue(row, 'Category_Name')) === normalize(asset.category));
    const selectedCategoryId = taxonomyValue(selectedCategory, 'Category_ID');
    const selectedSubcategory = subcategoryRows.find(row => (asset.subcategoryId
      ? normalize(taxonomyValue(row, 'Subcategory_ID')) === normalize(asset.subcategoryId)
      : normalize(taxonomyValue(row, 'Subcategory_Name')) === normalize(asset.subcategory))
      && normalize(taxonomyValue(row, 'Category_ID')) === normalize(selectedCategoryId));
    const selectedSubcategoryId = taxonomyValue(selectedSubcategory, 'Subcategory_ID');
    const selectedAssetType = assetTypeRows.find(row => (asset.assetTypeId
      ? normalize(taxonomyValue(row, 'Asset_Type_ID')) === normalize(asset.assetTypeId)
      : normalize(taxonomyValue(row, 'Asset_Type_Name')) === normalize(asset.assetType))
      && normalize(taxonomyValue(row, 'Subcategory_ID')) === normalize(selectedSubcategoryId));
    if (!selectedCategory || !selectedSubcategory || !selectedAssetType) {
      return res.status(400).json({ success: false, message: 'Select a valid category, subcategory, and asset type from the classification library.' });
    }
    const selectedTypeClass = String(taxonomyValue(selectedAssetType, 'Type') || taxonomyValue(selectedSubcategory, 'Type') || taxonomyValue(selectedCategory, 'Type') || 'ASSET').trim().toUpperCase();
    if (selectedTypeClass === 'CONSUMABLE') return res.status(400).json({ success: false, message: 'This item type is classified as consumable stock. Register it from the unified registration page using Consumable stock.' });

    // 1. Write to Main Assets Sheet
    const aH = assetHeaders;
    await assetSheet.addRow({
      [getH(aH, 'Asset_ID')]: assetId,
      [getH(aH, 'Record_Type')]: 'ASSET',
      [getH(aH, 'Asset_Name')]: asset.name,
      [getH(aH, 'Category')]: asset.category,
      [getH(aH, 'Category_ID')]: selectedCategoryId,
      [getH(aH, 'Subcategory')]: asset.subcategory,
      [getH(aH, 'Subcategory_ID')]: selectedSubcategoryId,
      [getH(aH, 'Asset_Type')]: asset.assetType,
      [getH(aH, 'Asset_Type_ID')]: taxonomyValue(selectedAssetType, 'Asset_Type_ID'),
      [getH(aH, 'Branch')]: asset.branch,
      [getH(aH, 'Location')]: asset.location,
      [getH(aH, 'Status')]: 'AVAILABLE',
      [getH(aH, 'Condition')]: asset.condition,
      [getH(aH, 'Brand')]: asset.brand || '',
      [getH(aH, 'Model')]: asset.model || '',
      [getH(aH, 'Serial_Number')]: asset.serialNumber || '',
      [getH(aH, 'Purchase_Date')]: asset.purchaseDate || '',
      [getH(aH, 'Purchase_Cost')]: asset.purchaseCost || '',
      [getH(aH, 'Vendor')]: asset.vendor || '',
      [getH(aH, 'Invoice_Number')]: asset.invoice || '',
      [getH(aH, 'Warranty_End')]: asset.warrantyEnd || '',
      [getH(aH, 'Created_By')]: userName,
      [getH(aH, 'Timestamp')]: timestamp,
      [getH(aH, 'Tracking_Mode')]: trackingMode,
      [getH(aH, 'Quantity')]: quantity,
    });
    assetRecordSaved = true;

    if (req.file) await saveAssetPhoto(assetId, req.file, 'PHOTO_REGISTERED', userName, photoUrl);

    // 2. Write Dynamic Data to Custom Data Sheet (EAV Model)
    if (trackingMode === 'INDIVIDUAL' && customSheet && customFields && customFields.length > 0) {
      const cH = customSheet.headerValues;
      const customRows = customFields.map((f, i) => ({
         [getH(cH, 'Field_ID')]: `${assetId}-F${i+1}`,
         [getH(cH, 'Asset_ID')]: assetId,
         [getH(cH, 'Field_Name')]: f.name,
         [getH(cH, 'Field_Value')]: f.value,
      }));
      await customSheet.addRows(customRows);
    }

    // 3. Write strict Audit trail to History Sheet
    if (historySheet) {
      const hH = historySheet.headerValues;
      await historySheet.addRow({
         [getH(hH, 'History_ID')]: `HIS-${Date.now()}`,
         [getH(hH, 'Asset_ID')]: assetId,
         [getH(hH, 'Action')]: 'ASSET_REGISTERED',
         [getH(hH, 'Old_Value')]: '',
         [getH(hH, 'New_Value')]: 'AVAILABLE',
         [getH(hH, 'Performed_By')]: userName,
         [getH(hH, 'Branch')]: asset.branch,
         [getH(hH, 'Timestamp')]: timestamp,
         [getH(hH, 'Remarks')]: trackingMode === 'QUANTITY'
           ? `Initial quantity group registration · ${quantity} units`
           : 'Initial Asset Registration'
      });
    }

    const followUpResults = await Promise.allSettled([
      trackingMode === 'INDIVIDUAL' ? appendAssetQrLabel({ assetId, createdBy: userName }) : Promise.resolve(),
      appendAssetActivity(req, { action: 'ASSET_REGISTERED', entityType: trackingMode === 'QUANTITY' ? 'Asset quantity group' : 'Asset', entityId: assetId, branch: asset.branch, after: { name: asset.name, category: asset.category, status: 'AVAILABLE', trackingMode, quantity } })
    ]);

    const followUpFailed = followUpResults.some(result => result.status === 'rejected');
    if (followUpFailed) console.error(`[ASSET REGISTER] Asset ${assetId} saved; a QR or activity follow-up could not be written.`);

    refreshAssetCache();
    res.status(201).json({
      success: true,
      assetId,
      photoUrl,
      warning: followUpFailed ? 'The asset was registered, but its QR label or activity entry needs a follow-up.' : '',
      message: "Asset successfully registered!"
    });

  } catch (err) {
    console.error(err);
    if (assetRecordSaved) {
      refreshAssetCache();
      return res.status(201).json({ success: true, assetId, warning: `Asset ${assetId} was saved, but a follow-up record could not be completed. ${err.message}` });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// =========================================================
// 4. GET ALL ASSETS (WITH FILTERS & SEARCH)
// =========================================================
exports.getAssets = async (req, res) => {
  try {
    if (respondWhileAssetDataLoads(res)) return;
    const cache = getAssetCache();
    const rawAssets = (cache.assets || []).filter(row => canAccessAssetBranch(req, rowValue(row, 'Branch')));

    const documents = cache.documents || [];
    const assets = rawAssets.map(r => {
      const rd = r.toObject();
      const getVal = (str) => {
        const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
        return k ? rd[k] : '';
      };

      const assetId = getVal('assetid');
      const photos = documents.filter(document =>
        String(rowValue(document, 'Asset_ID') || '').trim().toLowerCase() === String(assetId).trim().toLowerCase() &&
        String(rowValue(document, 'Document_Type') || '').toUpperCase().startsWith('PHOTO')
      );
      const activeAssignment = (cache.assignments || []).find(assignment =>
        String(rowValue(assignment, 'Asset_ID') || '').trim().toLowerCase() === String(assetId).trim().toLowerCase() &&
        ['ACTIVE', 'ASSIGNED'].includes(String(rowValue(assignment, 'Status') || '').trim().toUpperCase())
      );
      return {
        rowNumber: r.rowNumber,
        assetId,
        name: getVal('assetname'),
        category: getVal('category'),
        subcategory: getVal('subcategory'),
        assetType: getVal('assettype'),
        trackingMode: String(getVal('trackingmode') || 'INDIVIDUAL').trim().toUpperCase() === 'QUANTITY' ? 'QUANTITY' : 'INDIVIDUAL',
        quantity: String(getVal('trackingmode') || 'INDIVIDUAL').trim().toUpperCase() === 'QUANTITY' ? Math.max(1, parseInt(getVal('quantity'), 10) || 1) : 1,
        branch: getVal('branch'),
        location: getVal('location'),
        status: getVal('status') || 'AVAILABLE',
        assignedTo: activeAssignment ? rowValue(activeAssignment, 'Employee_Name') : '',
        assignedEmployeeId: activeAssignment ? rowValue(activeAssignment, 'Employee_ID') : '',
        condition: getVal('condition') || 'GOOD',
        brand: getVal('brand'),
        model: getVal('model'),
        purchaseDate: getVal('purchasedate'),
        purchaseCost: isAssetAdmin(req) ? getVal('purchasecost') : '',
        vendor: getVal('vendor'),
        invoice: getVal('invoicenumber'),
        warrantyEnd: getVal('warrantyend'),
        createdBy: getVal('createdby'),
        timestamp: getVal('timestamp'),
        photoUrl: photos.length ? rowValue(photos[photos.length - 1], 'Drive_URL') : ''
      };
    }).filter(a => a.assetId !== '');

    res.json({ success: true, assets: assets.reverse() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// =========================================================
// 5. GET ASSET DETAILS (SPECS, HISTORY, & DOCUMENTS)
// =========================================================
exports.getAssetDetails = async (req, res) => {
  try {
    if (respondWhileAssetDataLoads(res)) return;
    const { assetId } = req.params;
    const cache = getAssetCache();
    const cleanId = assetId.toString().trim().toLowerCase();

    // 1. Find Asset
    const rawAsset = (cache.assets || []).find(r => {
      const rd = r.toObject();
      const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === 'assetid');
      return (rd[k] || '').toString().trim().toLowerCase() === cleanId;
    });

    if (!rawAsset) return res.status(404).json({ success: false, message: "Asset not found." });
    if (!canAccessAssetBranch(req, rowValue(rawAsset, 'Branch'))) return res.status(403).json({ success: false, message: 'This asset is outside your branch assignment.' });

    // 2. Custom Specs
    const customSpecs = (cache.assetcustomdata || []).filter(r => {
      const rd = r.toObject();
      const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === 'assetid');
      return (rd[k] || '').toString().trim().toLowerCase() === cleanId;
    }).map(r => {
      const rd = r.toObject();
      const getVal = (str) => { const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, '')); return k ? rd[k] : ''; };
      return { name: getVal('fieldname'), value: getVal('fieldvalue') };
    });

    // 3. Assignments
    const assignments = (cache.assignments || []).filter(r => {
      const rd = r.toObject();
      const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === 'assetid');
      return (rd[k] || '').toString().trim().toLowerCase() === cleanId;
    }).map(r => {
      const rd = r.toObject();
      const getVal = (str) => { const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, '')); return k ? rd[k] : ''; };
      return {
        assignmentId: getVal('assignmentid'), employeeName: getVal('employeename'), employeeId: getVal('employeeid'),
        assignedBy: getVal('assignedby'), assignedDate: getVal('assigneddate'), returnedDate: getVal('returneddate'),
        conditionOnIssue: getVal('conditiononissue'), conditionOnReturn: getVal('conditiononreturn'),
        accessories: getVal('accessories'), remarks: getVal('remarks'), status: getVal('status')
      };
    }).reverse();

    // 4. Audit Trail
    const history = getVisibleAssetActivity(req, cache).filter(item => String(item.assetId || '').trim().toLowerCase() === cleanId);

    // 5. 🚨 NEW: DOCUMENTS & PHOTOS
    const documents = (cache.documents || []).filter(r => {
      const rd = r.toObject();
      const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === 'assetid');
      return (rd[k] || '').toString().trim().toLowerCase() === cleanId;
    }).map(r => {
      const rd = r.toObject();
      const getVal = (str) => { const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, '')); return k ? rd[k] : ''; };
      return { documentId: getVal('documentid'), type: getVal('documenttype'), fileName: getVal('filename'), url: getVal('driveurl'), uploadedBy: getVal('uploadedby'), date: getVal('uploadedat') };
    }).reverse();

    const rawData = rawAsset.toObject();
    const readAssetValue = name => {
      const key = Object.keys(rawData).find(value => value.toLowerCase().replace(/[^a-z0-9]/g, '') === name.toLowerCase().replace(/[^a-z0-9]/g, ''));
      return key ? rawData[key] : '';
    };
    const disposals = (cache.disposals || []).filter(row => String(rowValue(row, 'Asset_ID') || '').trim().toLowerCase() === cleanId).map(row => {
      const rd = row.toObject();
      const getVal = name => { const key = Object.keys(rd).find(value => value.toLowerCase().replace(/[^a-z0-9]/g, '') === name.toLowerCase().replace(/[^a-z0-9]/g, '')); return key ? rd[key] : ''; };
      return {
        disposalId: getVal('disposalid'), reason: getVal('reason'), method: getVal('disposalmethod'),
        value: getVal('disposalvalue'), requestedBy: getVal('requestedby'), approvedBy: getVal('approvedby'),
        date: getVal('disposeddate'), remarks: getVal('remarks')
      };
    }).reverse();
    const asset = {
      assetId: readAssetValue('assetid'),
      name: readAssetValue('assetname') || readAssetValue('name') || readAssetValue('itemname'),
      category: readAssetValue('category'), subcategory: readAssetValue('subcategory'),
      assetType: readAssetValue('assettype'),
      branch: readAssetValue('branch'), location: readAssetValue('location'),
      status: readAssetValue('status') || 'AVAILABLE', condition: readAssetValue('condition') || 'GOOD',
      brand: readAssetValue('brand'), model: readAssetValue('model'),
      photoUrl: documents.find(document => /PHOTO|CONDITION/i.test(String(document.type || '')))?.url || '',
      vendor: readAssetValue('vendor'), invoice: readAssetValue('invoicenumber'), purchaseDate: readAssetValue('purchasedate'),
      trackingMode: String(readAssetValue('trackingmode') || 'INDIVIDUAL').trim().toUpperCase() === 'QUANTITY' ? 'QUANTITY' : 'INDIVIDUAL',
      quantity: String(readAssetValue('trackingmode') || 'INDIVIDUAL').trim().toUpperCase() === 'QUANTITY' ? Math.max(1, parseInt(readAssetValue('quantity'), 10) || 1) : 1,
      purchaseCost: isAssetAdmin(req) ? readAssetValue('purchasecost') : '', warrantyEnd: readAssetValue('warrantyend'),
      createdBy: readAssetValue('createdby'), registeredAt: readAssetValue('timestamp')
    };
    const vendorKey = String(asset.vendor || '').trim().toLowerCase();
    const vendorDetails = (cache.vendors || []).map(row => row.toObject()).map(values => {
      const getVal = (...names) => {
        const key = Object.keys(values).find(header => names.some(name => header.toLowerCase().replace(/[^a-z0-9]/g, '') === name));
        return key ? values[key] : '';
      };
      return {
        id: getVal('vendorid'), name: getVal('vendorname', 'name'), contactPerson: getVal('contactperson'),
        phone: getVal('phone', 'contactnumber'), email: getVal('email'), address: getVal('address'), gstNumber: getVal('gstnumber')
      };
    }).find(vendor => vendorKey && [vendor.id, vendor.name].some(value => String(value || '').trim().toLowerCase() === vendorKey));

    res.json({ success: true, asset: { ...asset, vendorDetails: vendorDetails || null }, customSpecs, assignments, history, documents, disposals });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// =========================================================
// 6. ASSIGN ASSET TO EMPLOYEE
// =========================================================
exports.assignAsset = async (req, res) => {
  try {
    const { assetId, employeeName, employeeId, conditionOnIssue, conditionOnReturn, accessories, remarks, returnRemarks, userName } = req.body;
    const issuePhoto = req.files?.photo?.[0] || req.file || null;
    const returnPhoto = req.files?.returnPhoto?.[0] || null;
    if (!assetId || !String(employeeName || '').trim()) return res.status(400).json({ success: false, message: 'Asset and employee name are required.' });

    // Avoid fuzzy matching: "assets" can resolve to Asset_Categories before
    // the actual asset register, which makes valid items impossible to assign.
    const assetSheet = sheetByKey('assets');
    const assignmentSheet = sheetByKey('assignments');
    const historySheet = sheetByKey('history');
    if (!assetSheet) return res.status(503).json({ success: false, message: 'Asset register is unavailable. No handover was made.' });
    const aH = await ensureAssetHeaders(assetSheet, ['Asset_ID', 'Branch', 'Tracking_Mode', 'Status', 'Condition']);

    // 1. Locate Row in 07_Assets
    const rows = await assetSheet.getRows();
    const assetRow = rows.find(r => String(rowValue(r, 'Asset_ID') || '').trim().toLowerCase() === assetId.trim().toLowerCase());

    if (!assetRow) return res.status(404).json({ success: false, message: "Asset row not found." });
    const assetBranch = assetRow.get(getH(aH, 'Branch')) || '';
    if (!canAccessAssetBranch(req, assetBranch)) return res.status(403).json({ success: false, message: 'This asset is outside your branch assignment.' });
    if (isQuantityTracked(assetRow)) return res.status(409).json({ success: false, message: 'This is a quantity group. Register individual pieces separately before assigning them to a person.' });
    const currentStatus = String(assetRow.get(getH(aH, 'Status')) || '').toUpperCase();
    const isReassignment = currentStatus === 'ASSIGNED';
    if (!['AVAILABLE', 'ASSIGNED'].includes(currentStatus)) return res.status(409).json({ success: false, message: 'Only available or currently assigned assets can be handed over.' });
    if (!assignmentSheet) return res.status(503).json({ success: false, message: 'Assignment history is unavailable. No handover was made.' });
    if (!historySheet) return res.status(503).json({ success: false, message: 'Asset audit history is unavailable. No handover was made.' });
    if (isReassignment && !returnPhoto) return res.status(400).json({ success: false, message: 'Add a photo of the asset as it is returned from the current employee.' });
    if (isReassignment && String(conditionOnReturn || '').toUpperCase() === 'DAMAGED') return res.status(409).json({ success: false, message: 'This item is marked damaged. Record the return and send it to maintenance before reassigning.' });
    if ((issuePhoto || returnPhoto) && !sheetByKey('documents')) return res.status(503).json({ success: false, message: 'Asset photo history is unavailable. No handover was made.' });

    const asgH = await ensureAssetHeaders(assignmentSheet, ['Assignment_ID', 'Asset_ID', 'Employee_ID', 'Employee_Name', 'Branch_ID', 'Assigned_By', 'Assigned_Date', 'Returned_Date', 'Condition_On_Issue', 'Condition_On_Return', 'Accessories', 'Remarks', 'Status']);
    const hH = await ensureAssetHeaders(historySheet, ['History_ID', 'Asset_ID', 'Action', 'Old_Value', 'New_Value', 'Performed_By', 'Branch', 'Timestamp', 'Remarks']);
    const assignmentRows = assignmentSheet ? await assignmentSheet.getRows() : [];
    const activeAssignment = assignmentRows.slice().reverse().find(row =>
      String(rowValue(row, 'Asset_ID') || '').trim().toLowerCase() === assetId.trim().toLowerCase() &&
      ['ACTIVE', 'ASSIGNED'].includes(String(rowValue(row, 'Status') || '').trim().toUpperCase())
    );
    if (isReassignment && !activeAssignment) return res.status(409).json({ success: false, message: 'No active employee assignment was found. Record the return before assigning this item again.' });

    const timestamp = formatIndiaTimestamp();
    const assignmentId = `ASN-${Date.now()}`;
    const issuePhotoUrl = issuePhoto ? await uploadToDrive(issuePhoto, process.env.DRIVE_FOLDER_ID || '') : '';
    const returnPhotoUrl = returnPhoto ? await uploadToDrive(returnPhoto, process.env.DRIVE_FOLDER_ID || '') : '';

    if (activeAssignment) {
      activeAssignment.assign({
        [getH(asgH, 'Returned_Date')]: timestamp,
        [getH(asgH, 'Condition_On_Return')]: conditionOnReturn || assetRow.get(getH(aH, 'Condition')) || 'GOOD',
        [getH(asgH, 'Status')]: 'RETURNED',
        [getH(asgH, 'Remarks')]: `${activeAssignment.get(getH(asgH, 'Remarks')) || ''}${returnRemarks ? ` | Return: ${returnRemarks}` : ' | Returned during reassignment'}`
      });
      await activeAssignment.save();
    }

    // Keep the same asset record while closing the old custody period and opening a new one.
    assetRow.assign({
      [getH(aH, 'Status')]: 'ASSIGNED',
      [getH(aH, 'Condition')]: conditionOnIssue || assetRow.get(getH(aH, 'Condition')) || 'GOOD'
    });
    await assetRow.save();

    // Append a separate custody record so the previous employee remains in the audit history.
    if (assignmentSheet) {
      await assignmentSheet.addRow({
        [getH(asgH, 'Assignment_ID')]: assignmentId,
        [getH(asgH, 'Asset_ID')]: assetId,
        [getH(asgH, 'Employee_ID')]: employeeId || '',
        [getH(asgH, 'Employee_Name')]: employeeName,
        [getH(asgH, 'Branch_ID')]: assetBranch,
        [getH(asgH, 'Assigned_By')]: userName,
        [getH(asgH, 'Assigned_Date')]: timestamp,
        [getH(asgH, 'Returned_Date')]: '',
        [getH(asgH, 'Condition_On_Issue')]: conditionOnIssue || 'GOOD',
        [getH(asgH, 'Condition_On_Return')]: '',
        [getH(asgH, 'Accessories')]: accessories || '',
        [getH(asgH, 'Remarks')]: remarks || '',
        [getH(asgH, 'Status')]: 'ACTIVE'
      });
    }

    if (returnPhoto) await saveAssetPhoto(assetId, returnPhoto, 'PHOTO_RETURN', userName, returnPhotoUrl);
    if (issuePhoto) await saveAssetPhoto(assetId, issuePhoto, 'PHOTO_ISSUE', userName, issuePhotoUrl);

    // Log assignment and reassignment as distinct lifecycle events.
    if (historySheet) {
      const previousHolder = activeAssignment?.get(getH(asgH, 'Employee_Name')) || '';
      await historySheet.addRow({
        [getH(hH, 'History_ID')]: `HIS-${Date.now()}`,
        [getH(hH, 'Asset_ID')]: assetId,
        [getH(hH, 'Action')]: isReassignment ? 'ASSET_REASSIGNED' : 'ASSET_ASSIGNED',
        [getH(hH, 'Old_Value')]: isReassignment ? `ASSIGNED to ${previousHolder}` : 'AVAILABLE',
        [getH(hH, 'New_Value')]: `ASSIGNED to ${employeeName}`,
        [getH(hH, 'Performed_By')]: userName,
        [getH(hH, 'Branch')]: assetBranch,
        [getH(hH, 'Timestamp')]: timestamp,
        [getH(hH, 'Remarks')]: `${remarks || `Issued with: ${accessories || 'Standard Accessories'}`}${isReassignment ? ` · returned in ${conditionOnReturn || 'GOOD'} condition` : ''}`
      });
    }

    await appendAssetActivity(req, { action: isReassignment ? 'ASSET_REASSIGNED' : 'ASSET_ASSIGNED', entityType: 'Asset', entityId: assetId, branch: assetBranch, before: { status: isReassignment ? 'ASSIGNED' : 'AVAILABLE' }, after: { status: 'ASSIGNED', employeeName } });

    refreshAssetCache();
    res.json({ success: true, message: `Asset successfully ${isReassignment ? 'reassigned' : 'assigned'} to ${employeeName}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// =========================================================
// 7. RETURN ASSET FROM EMPLOYEE
// =========================================================
exports.returnAsset = async (req, res) => {
  try {
    const { assetId, conditionOnReturn, returnStatus, remarks, userName } = req.body;

    const assetSheet = sheetByKey('assets');
    const assignmentSheet = sheetByKey('assignments');
    const historySheet = sheetByKey('history');
    if (!assetSheet) return res.status(503).json({ success: false, message: 'Asset register is unavailable. No return was recorded.' });
    const aH = await ensureAssetHeaders(assetSheet, ['Asset_ID', 'Branch', 'Status', 'Condition']);

    // 1. Locate Row in 07_Assets
    const rows = await assetSheet.getRows();
    const assetRow = rows.find(r => String(rowValue(r, 'Asset_ID') || '').trim().toLowerCase() === assetId.trim().toLowerCase());

    if (!assetRow) return res.status(404).json({ success: false, message: "Asset row not found." });
    const assetBranch = assetRow.get(getH(aH, 'Branch')) || '';
    if (!canAccessAssetBranch(req, assetBranch)) return res.status(403).json({ success: false, message: 'This asset is outside your branch assignment.' });
    if (!assignmentSheet || !historySheet || !sheetByKey('documents')) return res.status(503).json({ success: false, message: 'Assignment, history, and photo records must be available before returning an asset.' });
    const asgH = await ensureAssetHeaders(assignmentSheet, ['Assignment_ID', 'Asset_ID', 'Employee_ID', 'Employee_Name', 'Branch_ID', 'Assigned_By', 'Assigned_Date', 'Returned_Date', 'Condition_On_Issue', 'Condition_On_Return', 'Accessories', 'Remarks', 'Status']);
    const hH = await ensureAssetHeaders(historySheet, ['History_ID', 'Asset_ID', 'Action', 'Old_Value', 'New_Value', 'Performed_By', 'Branch', 'Timestamp', 'Remarks']);
    if (!req.file) return res.status(400).json({ success: false, message: 'Upload a photo showing the item condition at return.' });
    if (String(assetRow.get(getH(aH, 'Status')) || '').toUpperCase() !== 'ASSIGNED') {
      return res.status(409).json({ success: false, message: 'This asset does not have an active assignment to return.' });
    }
    if (req.file && !sheetByKey('documents')) return res.status(503).json({ success: false, message: 'Asset photo history is unavailable. No return was recorded.' });
    const returnPhotoUrl = req.file ? await uploadToDrive(req.file, process.env.DRIVE_FOLDER_ID || '') : '';

    const timestamp = formatIndiaTimestamp();
    const targetStatus = returnStatus || (conditionOnReturn === 'DAMAGED' ? 'UNDER_MAINTENANCE' : 'AVAILABLE');

    // 2. Update 07_Assets
    assetRow.assign({
      [getH(aH, 'Status')]: targetStatus,
      [getH(aH, 'Condition')]: conditionOnReturn || 'GOOD'
    });
    await assetRow.save();

    // 3. Update Latest Assignment Record in 09_Assignments
    if (assignmentSheet) {
      const asgRows = await assignmentSheet.getRows();
      const activeAsg = asgRows.reverse().find(r => {
        return String(rowValue(r, 'Asset_ID') || '').trim().toLowerCase() === assetId.trim().toLowerCase() && ['ACTIVE', 'ASSIGNED'].includes(String(rowValue(r, 'Status') || '').trim().toUpperCase());
      });

      if (activeAsg) {
        activeAsg.assign({
          [getH(asgH, 'Returned_Date')]: timestamp,
          [getH(asgH, 'Condition_On_Return')]: conditionOnReturn || 'GOOD',
          [getH(asgH, 'Status')]: 'RETURNED',
          [getH(asgH, 'Remarks')]: remarks ? `${activeAsg.get(getH(asgH, 'Remarks')) || ''} | Return: ${remarks}` : activeAsg.get(getH(asgH, 'Remarks'))
        });
        await activeAsg.save();
      }
    }

    if (req.file) await saveAssetPhoto(assetId, req.file, 'PHOTO_RETURN', userName, returnPhotoUrl);

    // 4. Log in 17_History
    if (historySheet) {
      await historySheet.addRow({
        [getH(hH, 'History_ID')]: `HIS-${Date.now()}`,
        [getH(hH, 'Asset_ID')]: assetId,
        [getH(hH, 'Action')]: 'ASSET_RETURNED',
        [getH(hH, 'Old_Value')]: 'ASSIGNED',
        [getH(hH, 'New_Value')]: targetStatus,
        [getH(hH, 'Performed_By')]: userName,
        [getH(hH, 'Branch')]: assetBranch,
        [getH(hH, 'Timestamp')]: timestamp,
        [getH(hH, 'Remarks')]: `Returned in condition: ${conditionOnReturn || 'GOOD'}. ${remarks || ''}`
      });
    }

    await appendAssetActivity(req, { action: 'ASSET_RETURNED', entityType: 'Asset', entityId: assetId, branch: assetBranch, before: { status: 'ASSIGNED' }, after: { status: targetStatus, condition: conditionOnReturn || 'GOOD' } });

    refreshAssetCache();
    res.json({ success: true, message: "Asset successfully returned and logged!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// =========================================================
// 8. INVENTORY (CONSUMABLES)
// =========================================================
exports.getInventory = async (req, res) => {
  try {
    if (respondWhileAssetDataLoads(res)) return;
    const cache = getAssetCache();
    const inventory = (cache.inventory || []).map(r => {
      const rd = r.toObject(); 
      const getV = (str) => { 
        const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, '')); 
        return k ? rd[k] : ''; 
      };
      return { 
        itemId: getV('itemid'), 
        name: getV('itemname'), 
        categoryId: getV('categoryid'),
        category: getV('category'),
        subcategoryId: getV('subcategoryid'),
        subcategory: getV('subcategory'),
        assetTypeId: getV('assettypeid'),
        assetType: getV('assettype'),
        branch: getV('branch'), 
        quantity: parseInt(getV('quantity') || 0), 
        minQuantity: parseInt(getV('minimumquantity') || 0), 
        status: getV('status') || 'IN STOCK' 
      };
    }).filter(i => i.itemId !== '' && canAccessAssetBranch(req, i.branch));
    
    res.json({ success: true, inventory: inventory.reverse() });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

exports.addInventory = async (req, res) => {
  try {
    const { item, userName } = req.body || {};
    const quantity = Number(item?.quantity);
    const minimumQuantity = Number(item?.minQuantity);
    if (!item?.name || !item?.category || !item?.branch || !Number.isInteger(quantity) || quantity < 0 || !Number.isInteger(minimumQuantity) || minimumQuantity < 0) {
      return res.status(400).json({ success: false, message: 'Item name, category, branch, whole-number quantity, and minimum quantity are required.' });
    }
    if (!canAccessAssetBranch(req, item.branch)) return res.status(403).json({ success: false, message: 'You cannot manage inventory for that branch.' });
    
    const invSheet = sheetByKey('inventory');
    
    if (!invSheet) return res.status(404).json({ success: false, message: "Inventory sheet missing." });

    if (!item?.subcategory || !item?.assetType) return res.status(400).json({ success: false, message: 'Choose a subcategory and item type.' });

    const cache = getAssetCache() || {};
    const categoryRows = cache.assetcategorymaster?.length ? cache.assetcategorymaster : assetTaxonomy.categoryRows;
    const subcategoryRows = cache.assetsubcategorymaster?.length ? cache.assetsubcategorymaster : assetTaxonomy.subcategoryRows;
    const assetTypeRows = cache.assettypemaster?.length ? cache.assettypemaster : assetTaxonomy.assetTypeRows;
    const plain = row => row?.toObject?.() || row || {};
    const value = (row, field) => {
      const values = plain(row);
      const key = Object.keys(values).find(header => normalizeHeader(header) === normalizeHeader(field));
      return key ? values[key] : '';
    };
    const selectedCategory = categoryRows.find(row => item.categoryId
      ? normalize(value(row, 'Category_ID')) === normalize(item.categoryId)
      : normalize(value(row, 'Category_Name')) === normalize(item.category));
    const selectedCategoryId = value(selectedCategory, 'Category_ID');
    const selectedSubcategory = subcategoryRows.find(row => (item.subcategoryId
      ? normalize(value(row, 'Subcategory_ID')) === normalize(item.subcategoryId)
      : normalize(value(row, 'Subcategory_Name')) === normalize(item.subcategory))
      && normalize(value(row, 'Category_ID')) === normalize(selectedCategoryId));
    const selectedSubcategoryId = value(selectedSubcategory, 'Subcategory_ID');
    const selectedAssetType = assetTypeRows.find(row => (item.assetTypeId
      ? normalize(value(row, 'Asset_Type_ID')) === normalize(item.assetTypeId)
      : normalize(value(row, 'Asset_Type_Name')) === normalize(item.assetType))
      && normalize(value(row, 'Subcategory_ID')) === normalize(selectedSubcategoryId));
    if (!selectedCategory || !selectedSubcategory || !selectedAssetType) {
      return res.status(400).json({ success: false, message: 'Select a valid category, subcategory, and item type from the classification library.' });
    }
    const selectedTypeClass = String(value(selectedAssetType, 'Type') || value(selectedSubcategory, 'Type') || value(selectedCategory, 'Type') || 'ASSET').trim().toUpperCase();
    if (selectedTypeClass !== 'CONSUMABLE') return res.status(400).json({ success: false, message: 'This item type is a trackable asset. Register it using the asset option.' });

    const itemId = `INV-${new Date().getFullYear()}-${randomBytes(5).toString('hex').toUpperCase()}`;
    const timestamp = formatIndiaTimestamp();
    const iH = await ensureAssetHeaders(invSheet, ['Item_ID', 'Record_Type', 'Item_Name', 'Category', 'Category_ID', 'Subcategory', 'Subcategory_ID', 'Asset_Type', 'Asset_Type_ID', 'Branch', 'Quantity', 'Minimum_Quantity', 'Status', 'Created_By', 'Updated_At']);
    await invSheet.addRow({
      [getH(iH, 'Record_Type')]: 'CONSUMABLE',
      [getH(iH, 'Item_ID')]: itemId,
      [getH(iH, 'Item_Name')]: item.name,
      [getH(iH, 'Category')]: item.category,
      [getH(iH, 'Category_ID')]: selectedCategoryId,
      [getH(iH, 'Subcategory')]: item.subcategory || '',
      [getH(iH, 'Subcategory_ID')]: selectedSubcategoryId,
      [getH(iH, 'Asset_Type')]: item.assetType,
      [getH(iH, 'Asset_Type_ID')]: value(selectedAssetType, 'Asset_Type_ID'),
      [getH(iH, 'Branch')]: item.branch,
      [getH(iH, 'Quantity')]: quantity,
      [getH(iH, 'Minimum_Quantity')]: minimumQuantity,
      [getH(iH, 'Status')]: quantity === 0 ? 'OUT OF STOCK' : quantity <= minimumQuantity ? 'LOW STOCK' : 'IN STOCK',
      [getH(iH, 'Created_By')]: userName || req.portalUser?.name || req.portalUser?.email || '',
      [getH(iH, 'Updated_At')]: timestamp
    });

    const txSheet = sheetByKey('inventorytransaction');
    if (txSheet) {
      const tH = await ensureAssetHeaders(txSheet, ['Transaction_ID', 'Item_ID', 'Type', 'Quantity', 'Previous', 'New', 'Performed_By', 'Date']);
      await txSheet.addRow({ 
        [getH(tH, 'Transaction_ID')]: `TX-${Date.now()}`,
        [getH(tH, 'Item_ID')]: itemId,
        [getH(tH, 'Type')]: 'INITIAL_STOCK',
        [getH(tH, 'Quantity')]: quantity,
        [getH(tH, 'Previous')]: 0,
        [getH(tH, 'New')]: item.quantity,
        [getH(tH, 'Performed_By')]: userName,
        [getH(tH, 'Date')]: timestamp
      });
    }

    await appendAssetActivity(req, { action: 'INVENTORY_CREATED', entityType: 'Inventory', entityId: itemId, branch: item.branch, after: { name: item.name, category: item.category, subcategory: item.subcategory, assetType: item.assetType, quantity, minimumQuantity } });
    
    refreshAssetCache(); 
    res.json({ success: true, message: "Item added to inventory!" });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

exports.updateStock = async (req, res) => {
  try {
    const { itemId, action, quantity, userName } = req.body || {};
    const change = Number(quantity);
    if (!itemId || !['IN', 'OUT'].includes(String(action || '').toUpperCase()) || !Number.isInteger(change) || change <= 0) {
      return res.status(400).json({ success: false, message: 'Choose stock in/out and enter a positive whole-number quantity.' });
    }
    
    const invSheet = sheetByKey('inventory');
    if (!invSheet) return res.status(404).json({ success: false, message: 'Inventory sheet missing.' });
    
    const rows = await invSheet.getRows();
    const itemRow = rows.find(r => { 
      const rd = r.toObject(); 
      const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === 'itemid'); 
      return (rd[k] || '').toString().trim().toLowerCase() === itemId.trim().toLowerCase(); 
    });
    
    if (!itemRow) return res.status(404).json({ success: false, message: "Item not found." });
    if (!canAccessAssetBranch(req, itemRow.get(getH(invSheet.headerValues, 'Branch')) || '')) return res.status(403).json({ success: false, message: 'This inventory item is outside your branch assignment.' });

    const iH = invSheet.headerValues;
    const currentQty = parseInt(itemRow.get(getH(iH, 'Quantity')) || 0);
    const normalizedAction = String(action).toUpperCase();
    const newQty = normalizedAction === 'IN' ? currentQty + change : currentQty - change;

    if (newQty < 0) return res.status(400).json({ success: false, message: "Stock cannot be negative." });

    const minQty = parseInt(itemRow.get(getH(iH, 'Minimum_Quantity')) || 0);
    const newStatus = newQty === 0 ? 'OUT OF STOCK' : (newQty <= minQty ? 'LOW STOCK' : 'IN STOCK');

    itemRow.assign({ 
      [getH(iH, 'Quantity')]: newQty, 
      [getH(iH, 'Status')]: newStatus, 
      [getH(iH, 'Updated_At')]: formatIndiaTimestamp()
    });
    
    await itemRow.save();

    const txSheet = sheetByKey('inventorytransaction');
    if (txSheet) {
      const tH = await ensureAssetHeaders(txSheet, ['Transaction_ID', 'Item_ID', 'Type', 'Quantity', 'Previous', 'New', 'Performed_By', 'Date']);
      await txSheet.addRow({ 
        [getH(tH, 'Transaction_ID')]: `TX-${Date.now()}`, 
        [getH(tH, 'Item_ID')]: itemId, 
      [getH(tH, 'Type')]: normalizedAction === 'IN' ? 'STOCK_IN' : 'STOCK_OUT',
        [getH(tH, 'Quantity')]: change, 
        [getH(tH, 'Previous')]: currentQty, 
        [getH(tH, 'New')]: newQty, 
        [getH(tH, 'Performed_By')]: userName, 
        [getH(tH, 'Date')]: formatIndiaTimestamp()
      });
    }

    await appendAssetActivity(req, { action: `STOCK_${normalizedAction}`, entityType: 'Inventory', entityId: itemId, branch: itemRow.get(getH(iH, 'Branch')) || '', before: { quantity: currentQty }, after: { quantity: newQty, minimumQuantity: minQty } });
    
    refreshAssetCache(); 
    res.json({ success: true, message: `Stock successfully updated. New Quantity: ${newQty}` });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

// =========================================================
// 9. TRANSFERS
// =========================================================
exports.getTransfers = async (req, res) => {
  try {
    if (respondWhileAssetDataLoads(res)) return;
    const cache = getAssetCache();
    const transfers = (cache.transfers || []).map(r => {
      const rd = r.toObject(); 
      const getV = (str) => { 
        const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, '')); 
        return k ? rd[k] : ''; 
      };
      return { 
        transferId: getV('transferid'), 
        fromBranch: getV('frombranch'), 
        toBranch: getV('tobranch'), 
        requestedBy: getV('requestedby'), 
        approvedBy: getV('approvedby'),
        receivedBy: getV('receivedby'),
        status: getV('status'), 
        date: getV('requestedat'), 
        dispatchedAt: getV('approvedat') || getV('dispatchedat'),
        receivedAt: getV('receivedat'),
        remarks: getV('remarks'),
        assetId: getV('assetid') 
      };
    }).filter(t => t.transferId !== '' && (isAssetApprover(req) || canAccessAssetBranch(req, t.fromBranch) || canAccessAssetBranch(req, t.toBranch)));
    
    res.json({ success: true, transfers: transfers.reverse() });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

exports.requestTransfer = async (req, res) => {
  try {
    const { assetId, toBranch, remarks, userName } = req.body || {};
    if (!assetId || !toBranch) return res.status(400).json({ success: false, message: 'Asset and destination branch are required.' });
    const trfSheet = sheetByKey('transfers');
    if (!trfSheet) return res.status(503).json({ success: false, message: 'Transfer register is unavailable.' });
    const tH = trfSheet.headerValues;
    const assetSheet = sheetByKey('assets');
    if (!assetSheet) return res.status(503).json({ success: false, message: 'Asset register is unavailable.' });
    const rows = await assetSheet.getRows();
    const assetRow = rows.find(r => { 
      const rd = r.toObject(); 
      const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === 'assetid'); 
      return (rd[k] || '').toString().trim().toLowerCase() === String(assetId).trim().toLowerCase();
    });
    if (!assetRow) return res.status(404).json({ success: false, message: 'Asset not found.' });
    const aH = assetSheet.headerValues;
    const readAsset = target => { const header = getH(aH, target); return assetRow.get(header) || ''; };
    const currentBranch = String(readAsset('Branch') || '').trim();
    const currentStatus = String(readAsset('Status') || '').trim().toUpperCase();
    if (!canAccessAssetBranch(req, currentBranch)) return res.status(403).json({ success: false, message: 'The asset is outside your branch assignment.' });
    if (currentBranch.toLowerCase() === String(toBranch).trim().toLowerCase()) {
      return res.status(400).json({ success: false, message: 'Choose a different destination branch.' });
    }
    if (currentStatus !== 'AVAILABLE') {
      return res.status(409).json({ success: false, message: 'Only available assets can be transferred. Return or resolve the asset first.' });
    }
    const existing = await trfSheet.getRows();
    const activeTransfer = existing.find(row => {
      const values = row.toObject();
      const key = name => Object.keys(values).find(header => header.toLowerCase().replace(/[^a-z0-9]/g, '') === name);
      const rowAsset = values[key('assetid')];
      const rowStatus = String(values[key('status')] || '').toUpperCase();
      return String(rowAsset || '').trim().toLowerCase() === String(assetId).trim().toLowerCase() && ['PENDING', 'IN_TRANSIT'].includes(rowStatus);
    });
    if (activeTransfer) return res.status(409).json({ success: false, message: 'This asset already has an open transfer.' });

    const timestamp = formatIndiaTimestamp();
    const transferId = `TRF-${Date.now()}`;
    await trfSheet.addRow({
      [getH(tH, 'Transfer_ID')]: transferId,
      [getH(tH, 'Asset_ID')]: assetId,
      [getH(tH, 'From_Branch')]: currentBranch,
      [getH(tH, 'To_Branch')]: String(toBranch).trim(),
      [getH(tH, 'Requested_By')]: userName || '',
      [getH(tH, 'Status')]: 'PENDING',
      [getH(tH, 'Requested_At')]: timestamp,
      [getH(tH, 'Remarks')]: remarks || ''
    });
    assetRow.assign({ [getH(aH, 'Status')]: 'TRANSFER_PENDING' });
    await assetRow.save();

    await Promise.all([
      appendAssetApproval({ requestId: transferId, requestType: 'TRANSFER', assetId, branch: currentBranch, requestedBy: userName || '', requestedByEmail: req.portalUser?.email || '', requestedAt: timestamp, decision: 'PENDING', reason: remarks || '' }),
      appendAssetActivity(req, { action: 'TRANSFER_REQUESTED', entityType: 'Transfer', entityId: assetId, branch: currentBranch, before: { status: 'AVAILABLE', branch: currentBranch }, after: { status: 'TRANSFER_PENDING', destination: String(toBranch).trim(), transferId } })
    ]);
    
    refreshAssetCache(); 
    res.status(201).json({ success: true, transferId, message: 'Transfer request submitted for approval.' });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

exports.approveTransfer = async (req, res) => {
  try {
    if (!isAssetApprover(req)) return res.status(403).json({ success: false, message: 'Only Rakesh can approve asset transfers.' });
    const { transferId, userName } = req.body || {};
    if (!transferId) return res.status(400).json({ success: false, message: 'Transfer ID is required.' });
    const trfSheet = sheetByKey('transfers');
    if (!trfSheet) return res.status(503).json({ success: false, message: 'Transfer register is unavailable.' });
    const rows = await trfSheet.getRows();
    const tH = trfSheet.headerValues;
    
    const trfRow = rows.find(r => { 
      const rd = r.toObject(); 
      const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === 'transferid'); 
      return (rd[k] || '').toString().trim().toLowerCase() === transferId.trim().toLowerCase(); 
    });
    
    if (!trfRow) return res.status(404).json({ success: false, message: 'Transfer request not found.' });
    if (String(trfRow.get(getH(tH, 'Status')) || '').toUpperCase() !== 'PENDING') {
      return res.status(409).json({ success: false, message: 'Only pending transfer requests can be approved.' });
    }
    const transferValues = trfRow.toObject();
    const readTransfer = target => {
      const header = Object.keys(transferValues).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === target);
      return header ? transferValues[header] : '';
    };
    const assetId = String(readTransfer('assetid') || '').trim();
    const fromBranch = String(readTransfer('frombranch') || '').trim();
    const assetSheet = sheetByKey('assets');
    if (!assetSheet) return res.status(503).json({ success: false, message: 'Asset register is unavailable.' });
    const aRows = await assetSheet.getRows();
    const assetRow = aRows.find(row => {
      const values = row.toObject();
      const header = Object.keys(values).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === 'assetid');
      return String(values[header] || '').trim().toLowerCase() === assetId.toLowerCase();
    });
    if (!assetRow) return res.status(404).json({ success: false, message: 'Transfer asset no longer exists.' });
    const assetStatusHeader = getH(assetSheet.headerValues, 'Status');
    if (String(assetRow.get(assetStatusHeader) || '').toUpperCase() !== 'TRANSFER_PENDING') {
      return res.status(409).json({ success: false, message: 'Asset is no longer awaiting transfer.' });
    }
    const timestamp = formatIndiaTimestamp();
    const approvalUpdate = {
      [getH(tH, 'Status')]: 'IN_TRANSIT',
      [getH(tH, 'Approved_By')]: userName || ''
    };
    const approvedAtHeader = getOptionalH(tH, 'Approved_At') || getOptionalH(tH, 'Dispatched_At');
    if (approvedAtHeader) approvalUpdate[approvedAtHeader] = timestamp;
    trfRow.assign(approvalUpdate);
    await trfRow.save();
    const historySheet = sheetByKey('history');
    if (historySheet) {
      const h = historySheet.headerValues;
      await historySheet.addRow({
        [getH(h, 'History_ID')]: `HIS-${Date.now()}`, [getH(h, 'Asset_ID')]: assetId,
        [getH(h, 'Action')]: 'TRANSFER_DISPATCHED', [getH(h, 'Old_Value')]: readTransfer('frombranch'),
        [getH(h, 'New_Value')]: readTransfer('tobranch'), [getH(h, 'Performed_By')]: userName || '',
        [getH(h, 'Branch')]: readTransfer('frombranch'), [getH(h, 'Timestamp')]: timestamp,
        [getH(h, 'Remarks')]: `Transfer ${transferId} approved; awaiting destination receipt.`
      });
    }

    await Promise.all([
      updateAssetApproval({ requestId: transferId, decision: 'APPROVED', decidedBy: userName || '', decidedAt: timestamp, reason: '' }),
      appendAssetActivity(req, { action: 'TRANSFER_APPROVED', entityType: 'Transfer', entityId: assetId, branch: fromBranch, before: { status: 'PENDING' }, after: { status: 'IN_TRANSIT', transferId, destination: readTransfer('tobranch') } })
    ]);

    refreshAssetCache(); 
    res.json({ success: true, message: 'Transfer dispatched. The destination branch must confirm receipt.' });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

exports.rejectTransfer = async (req, res) => {
  try {
    if (!isAssetApprover(req)) return res.status(403).json({ success: false, message: 'Only Rakesh can reject asset transfers.' });
    const { transferId, userName, reason } = req.body || {};
    if (!transferId || !String(reason || '').trim()) return res.status(400).json({ success: false, message: 'Transfer ID and rejection reason are required.' });
    const transferSheet = sheetByKey('transfers');
    const assetSheet = sheetByKey('assets');
    if (!transferSheet || !assetSheet) return res.status(503).json({ success: false, message: 'Transfer or asset register is unavailable.' });
    const tH = transferSheet.headerValues;
    const transferRows = await transferSheet.getRows();
    const transfer = transferRows.find(row => String(row.get(getH(tH, 'Transfer_ID')) || '').trim().toLowerCase() === String(transferId).trim().toLowerCase());
    if (!transfer) return res.status(404).json({ success: false, message: 'Transfer request not found.' });
    if (String(transfer.get(getH(tH, 'Status')) || '').trim().toUpperCase() !== 'PENDING') return res.status(409).json({ success: false, message: 'Only pending transfer requests can be rejected.' });
    const fromBranch = String(transfer.get(getH(tH, 'From_Branch')) || '').trim();
    const assetId = String(transfer.get(getH(tH, 'Asset_ID')) || '').trim();
    const aH = assetSheet.headerValues;
    const assetRows = await assetSheet.getRows();
    const assetRow = assetRows.find(row => String(row.get(getH(aH, 'Asset_ID')) || '').trim().toLowerCase() === assetId.toLowerCase());
    if (!assetRow) return res.status(404).json({ success: false, message: 'Transfer asset no longer exists.' });
    if (String(assetRow.get(getH(aH, 'Status')) || '').trim().toUpperCase() !== 'TRANSFER_PENDING') return res.status(409).json({ success: false, message: 'Asset is no longer awaiting transfer.' });
    const timestamp = formatIndiaTimestamp();
    const statusHeader = getH(tH, 'Status');
    const remarksHeader = getH(tH, 'Remarks');
    const previousRemarks = String(transfer.get(remarksHeader) || '').trim();
    const rejectionHeader = getOptionalH(tH, 'Rejected_By');
    const rejectionAtHeader = getOptionalH(tH, 'Rejected_At');
    const reasonHeader = getOptionalH(tH, 'Rejection_Reason');
    const rejectionUpdate = {
      [statusHeader]: 'REJECTED',
      [remarksHeader]: [previousRemarks, `Rejected by ${userName || 'asset manager'}: ${String(reason).trim()}`].filter(Boolean).join(' | ')
    };
    if (rejectionHeader) rejectionUpdate[rejectionHeader] = userName || '';
    if (rejectionAtHeader) rejectionUpdate[rejectionAtHeader] = timestamp;
    if (reasonHeader) rejectionUpdate[reasonHeader] = String(reason).trim();
    transfer.assign(rejectionUpdate);
    await transfer.save();
    assetRow.assign({ [getH(aH, 'Status')]: 'AVAILABLE' });
    await assetRow.save();
    const historySheet = sheetByKey('history');
    if (historySheet) {
      const h = historySheet.headerValues;
      await historySheet.addRow({
        [getH(h, 'History_ID')]: `HIS-${Date.now()}`, [getH(h, 'Asset_ID')]: assetId,
        [getH(h, 'Action')]: 'TRANSFER_REJECTED', [getH(h, 'Old_Value')]: 'TRANSFER_PENDING',
        [getH(h, 'New_Value')]: 'AVAILABLE', [getH(h, 'Performed_By')]: userName || '',
        [getH(h, 'Branch')]: fromBranch, [getH(h, 'Timestamp')]: timestamp,
        [getH(h, 'Remarks')]: `Transfer ${transferId} rejected: ${String(reason).trim()}`
      });
    }
    await Promise.all([
      updateAssetApproval({ requestId: transferId, decision: 'REJECTED', decidedBy: userName || '', decidedAt: timestamp, reason: String(reason).trim() }),
      appendAssetActivity(req, { action: 'TRANSFER_REJECTED', entityType: 'Transfer', entityId: assetId, branch: fromBranch, before: { status: 'PENDING' }, after: { status: 'REJECTED', transferId, reason: String(reason).trim() } })
    ]);
    refreshAssetCache();
    return res.json({ success: true, message: 'Transfer request rejected and the asset is available again.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

exports.receiveTransfer = async (req, res) => {
  try {
    const { transferId, userName, condition, remarks } = req.body || {};
    if (!transferId) return res.status(400).json({ success: false, message: 'Transfer ID is required.' });
    const trfSheet = sheetByKey('transfers');
    const assetSheet = sheetByKey('assets');
    if (!trfSheet || !assetSheet) return res.status(503).json({ success: false, message: 'Transfer or asset register is unavailable.' });
    const tH = trfSheet.headerValues;
    const transferRow = (await trfSheet.getRows()).find(row => String(row.get(getH(tH, 'Transfer_ID')) || '').trim().toLowerCase() === String(transferId).trim().toLowerCase());
    if (!transferRow) return res.status(404).json({ success: false, message: 'Transfer request not found.' });
    const transferStatus = String(transferRow.get(getH(tH, 'Status')) || '').toUpperCase();
    if (transferStatus !== 'IN_TRANSIT') return res.status(409).json({ success: false, message: 'Only dispatched transfers can be received.' });
    const destination = String(transferRow.get(getH(tH, 'To_Branch')) || '').trim();
    if (!canAccessAssetBranch(req, destination)) {
      return res.status(403).json({ success: false, message: 'Receipt must be confirmed by the destination branch.' });
    }
    const assetId = String(transferRow.get(getH(tH, 'Asset_ID')) || '').trim();
    const aH = assetSheet.headerValues;
    const assetRow = (await assetSheet.getRows()).find(row => String(row.get(getH(aH, 'Asset_ID')) || '').trim().toLowerCase() === assetId.toLowerCase());
    if (!assetRow) return res.status(404).json({ success: false, message: 'Transfer asset not found.' });
    if (String(assetRow.get(getH(aH, 'Status')) || '').toUpperCase() !== 'TRANSFER_PENDING') {
      return res.status(409).json({ success: false, message: 'Asset is no longer in transfer.' });
    }
    const timestamp = formatIndiaTimestamp();
    assetRow.assign({
      [getH(aH, 'Branch')]: destination,
      [getH(aH, 'Status')]: 'AVAILABLE',
      [getH(aH, 'Condition')]: condition || 'GOOD'
    });
    await assetRow.save();
    const receiptUpdate = {
      [getH(tH, 'Status')]: 'COMPLETED',
      [getH(tH, 'Remarks')]: remarks ? `${transferRow.get(getH(tH, 'Remarks')) || ''} | Receipt: ${remarks}` : transferRow.get(getH(tH, 'Remarks')) || ''
    };
    const receivedByHeader = getOptionalH(tH, 'Received_By');
    const receivedAtHeader = getOptionalH(tH, 'Received_At');
    const completedAtHeader = getOptionalH(tH, 'Completed_At');
    if (receivedByHeader) receiptUpdate[receivedByHeader] = userName || '';
    if (receivedAtHeader) receiptUpdate[receivedAtHeader] = timestamp;
    if (completedAtHeader) receiptUpdate[completedAtHeader] = timestamp;
    transferRow.assign(receiptUpdate);
    await transferRow.save();
    const historySheet = sheetByKey('history');
    if (historySheet) {
      const h = historySheet.headerValues;
      await historySheet.addRow({
        [getH(h, 'History_ID')]: `HIS-${Date.now()}`, [getH(h, 'Asset_ID')]: assetId,
        [getH(h, 'Action')]: 'TRANSFER_RECEIVED', [getH(h, 'Old_Value')]: transferRow.get(getH(tH, 'From_Branch')) || '',
        [getH(h, 'New_Value')]: destination, [getH(h, 'Performed_By')]: userName || '', [getH(h, 'Branch')]: destination,
        [getH(h, 'Timestamp')]: timestamp, [getH(h, 'Remarks')]: `Transfer ${transferId} received. ${remarks || ''}`
      });
    }
    await appendAssetActivity(req, { action: 'TRANSFER_RECEIVED', entityType: 'Transfer', entityId: assetId, branch: destination, before: { status: 'IN_TRANSIT' }, after: { status: 'COMPLETED', branch: destination, transferId } });
    refreshAssetCache();
    res.json({ success: true, message: 'Receipt confirmed and asset branch updated.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// =========================================================
// 10. MAINTENANCE
// =========================================================
exports.getMaintenance = async (req, res) => {
  try {
    if (respondWhileAssetDataLoads(res)) return;
    const cache = getAssetCache();
    const scopedAssetIds = new Set((cache.assets || []).filter(row => canAccessAssetBranch(req, rowValue(row, 'Branch'))).map(row => String(rowValue(row, 'Asset_ID') || '').trim().toLowerCase()));
    const maintenance = (cache.maintenance || []).map(r => {
      const rd = r.toObject(); 
      const getV = (str) => { 
        const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, '')); 
        return k ? rd[k] : ''; 
      };
      return { 
        maintenanceId: getV('maintenanceid'), 
        assetId: getV('assetid'), 
        issue: getV('issue'), 
        reportedBy: getV('reportedby'), 
        status: getV('status'), 
        cost: getV('cost'), 
        date: getV('reporteddate') 
      };
    }).filter(m => m.maintenanceId !== '' && scopedAssetIds.has(String(m.assetId || '').trim().toLowerCase()));
    
    res.json({ success: true, maintenance: maintenance.reverse() });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

exports.reportMaintenance = async (req, res) => {
  try {
    const { assetId, issue, userName } = req.body || {};
    if (!assetId || !String(issue || '').trim()) return res.status(400).json({ success: false, message: 'Asset and issue description are required.' });
    const mSheet = sheetByKey('maintenance');
    const assetSheet = sheetByKey('assets');
    if (!mSheet || !assetSheet) return res.status(503).json({ success: false, message: 'Asset or maintenance register is unavailable.' });
    const assetRows = await assetSheet.getRows();
    const aH = assetSheet.headerValues;
    const assetRow = assetRows.find(r => String(r.get(getH(aH, 'Asset_ID')) || '').trim().toLowerCase() === String(assetId).trim().toLowerCase());
    if (!assetRow) return res.status(404).json({ success: false, message: 'Asset not found.' });
    if (!canAccessAssetBranch(req, assetRow.get(getH(aH, 'Branch')) || '')) return res.status(403).json({ success: false, message: 'This asset is outside your branch assignment.' });
    const previousStatus = String(assetRow.get(getH(aH, 'Status')) || 'AVAILABLE').toUpperCase();
    if (['DISPOSED', 'TRANSFER_PENDING'].includes(previousStatus)) return res.status(409).json({ success: false, message: 'Disposed or transferring assets cannot receive a maintenance ticket.' });
    const mH = mSheet.headerValues;
    const activeTickets = await mSheet.getRows();
    const openTicket = activeTickets.find(row => String(row.get(getH(mH, 'Asset_ID')) || '').trim().toLowerCase() === String(assetId).trim().toLowerCase() && String(row.get(getH(mH, 'Status')) || '').toUpperCase() === 'OPEN');
    if (openTicket) return res.status(409).json({ success: false, message: 'This asset already has an open maintenance ticket.' });
    const timestamp = formatIndiaTimestamp();
    const ticketValues = {
      [getH(mH, 'Maintenance_ID')]: `MNT-${Date.now()}`,
      [getH(mH, 'Asset_ID')]: assetId,
      [getH(mH, 'Issue')]: String(issue).trim(),
      [getH(mH, 'Reported_By')]: userName || '',
      [getH(mH, 'Status')]: 'OPEN',
      [getH(mH, 'Reported_Date')]: timestamp
    };
    const previousStatusHeader = getOptionalH(mH, 'Previous_Status');
    if (previousStatusHeader) ticketValues[previousStatusHeader] = previousStatus;
    const remarksHeader = getOptionalH(mH, 'Remarks');
    if (remarksHeader && !previousStatusHeader) ticketValues[remarksHeader] = `Previous status: ${previousStatus}`;
    await mSheet.addRow(ticketValues);
    assetRow.assign({ [getH(aH, 'Status')]: 'UNDER_MAINTENANCE' });
    await assetRow.save();

    await appendAssetActivity(req, { action: 'MAINTENANCE_REPORTED', entityType: 'Maintenance', entityId: ticketValues[getH(mH, 'Maintenance_ID')], branch: assetRow.get(getH(aH, 'Branch')) || '', before: { status: previousStatus }, after: { status: 'OPEN', issue: String(issue).trim(), assetId } });

    refreshAssetCache();
    res.status(201).json({ success: true, message: 'Maintenance ticket created.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.resolveMaintenance = async (req, res) => {
  try {
    const { maintenanceId, assetId, cost, remarks } = req.body || {};
    if (!maintenanceId || !assetId || !String(remarks || '').trim() || !Number.isFinite(Number(cost)) || Number(cost) < 0) {
      return res.status(400).json({ success: false, message: 'Ticket, asset, non-negative repair cost, and corrective action are required.' });
    }
    const mSheet = sheetByKey('maintenance');
    const assetSheet = sheetByKey('assets');
    if (!mSheet || !assetSheet) return res.status(503).json({ success: false, message: 'Asset or maintenance register is unavailable.' });
    const mH = mSheet.headerValues;
    const rows = await mSheet.getRows();
    const mRow = rows.find(r => String(r.get(getH(mH, 'Maintenance_ID')) || '').trim().toLowerCase() === String(maintenanceId).trim().toLowerCase());
    if (!mRow) return res.status(404).json({ success: false, message: 'Maintenance ticket not found.' });
    if (String(mRow.get(getH(mH, 'Status')) || '').toUpperCase() !== 'OPEN') return res.status(409).json({ success: false, message: 'This ticket is already closed.' });
    if (String(mRow.get(getH(mH, 'Asset_ID')) || '').trim().toLowerCase() !== String(assetId).trim().toLowerCase()) return res.status(400).json({ success: false, message: 'Ticket does not match the selected asset.' });

    const aH = assetSheet.headerValues;
    const assetRow = (await assetSheet.getRows()).find(r => String(r.get(getH(aH, 'Asset_ID')) || '').trim().toLowerCase() === String(assetId).trim().toLowerCase());
    if (!assetRow) return res.status(404).json({ success: false, message: 'Ticket asset no longer exists.' });
    if (!canAccessAssetBranch(req, assetRow.get(getH(aH, 'Branch')) || '')) return res.status(403).json({ success: false, message: 'This asset is outside your branch assignment.' });
    const prevStatusHeader = getOptionalH(mH, 'Previous_Status');
    const savedRemarks = String(mRow.get(getH(mH, 'Remarks')) || '');
    const previousStatus = String((prevStatusHeader && mRow.get(prevStatusHeader)) || savedRemarks.match(/Previous status:\s*([A-Z_]+)/i)?.[1] || 'AVAILABLE').toUpperCase();
    const timestamp = formatIndiaTimestamp();

    mRow.assign({
      [getH(mH, 'Status')]: 'COMPLETED',
      [getH(mH, 'Cost')]: Number(cost),
      [getH(mH, 'Remarks')]: remarks,
      [getH(mH, 'Completed_Date')]: timestamp
    });
    await mRow.save();
    assetRow.assign({ [getH(aH, 'Status')]: previousStatus === 'ASSIGNED' ? 'ASSIGNED' : 'AVAILABLE' });
    await assetRow.save();

    await appendAssetActivity(req, { action: 'MAINTENANCE_COMPLETED', entityType: 'Maintenance', entityId: maintenanceId, branch: assetRow.get(getH(aH, 'Branch')) || '', before: { status: 'OPEN' }, after: { status: 'COMPLETED', cost: Number(cost), assetStatus: previousStatus === 'ASSIGNED' ? 'ASSIGNED' : 'AVAILABLE' } });

    refreshAssetCache();
    res.json({ success: true, message: 'Maintenance completed and asset status restored.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// =========================================================
// 11. ERP SYSTEM CONFIGURATION (UI-DRIVEN DB MANAGEMENT)
// =========================================================

exports.addCategory = async (req, res) => {
  try {
    const categoryName = String(req.body?.categoryName || '').trim();
    const requestedType = String(req.body?.type || 'ASSET').trim().toUpperCase();
    if (!categoryName) return res.status(400).json({ success: false, message: 'Category name is required.' });
    if (!['ASSET', 'CONSUMABLE'].includes(requestedType)) return res.status(400).json({ success: false, message: 'Category type must be ASSET or CONSUMABLE.' });
    const sheet = sheetByKey('assetcategorymaster');
    if (!sheet) return res.status(503).json({ success: false, message: 'The new asset category library is not available yet.' });
    const h = await ensureAssetHeaders(sheet, assetTaxonomy.headers.categories);
    const existingRows = await sheet.getRows();
    const nameHeader = getH(h, 'Category_Name');
    const duplicate = existingRows.some(row => normalize(row.get(nameHeader)) === normalize(categoryName));
    if (duplicate) return res.status(409).json({ success: false, message: 'That category already exists.' });
    const catId = stableCategoryCode(categoryName, existingRows, h);
    const categoryRow = { Category_ID: catId, Category_Code: catId, Category_Name: categoryName, Type: requestedType, Status: 'ACTIVE' };
    await sheet.addRow(categoryRow);
    const normalized = { categoryid: catId, categorycode: categoryRow.Category_Code, categoryname: categoryName, type: requestedType, status: 'ACTIVE' };
    const cache = getAssetCache();
    if (Array.isArray(cache?.assetcategorymaster)) cache.assetcategorymaster.push(normalized);
    if (cache) cache.categories = cache.assetcategorymaster || cache.categories;
    void refreshAssetCache();
    res.json({ success: true, message: `Category '${categoryName}' added successfully!`, category: normalized });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addSubcategory = async (req, res) => {
  try {
    const categoryId = String(req.body?.categoryId || '').trim();
    const subcategoryName = String(req.body?.subcategoryName || '').trim();
    const requestedType = String(req.body?.type || 'ASSET').trim().toUpperCase();
    if (!categoryId || !subcategoryName) return res.status(400).json({ success: false, message: 'Parent category and subcategory name are required.' });
    if (!['ASSET', 'CONSUMABLE'].includes(requestedType)) return res.status(400).json({ success: false, message: 'Subcategory type must be ASSET or CONSUMABLE.' });
    const categoriesSheet = sheetByKey('assetcategorymaster');
    const sheet = sheetByKey('assetsubcategorymaster');
    if (!sheet || !categoriesSheet) return res.status(503).json({ success: false, message: 'The new asset classification library is not available yet.' });
    const categoryHeaders = await ensureAssetHeaders(categoriesSheet, assetTaxonomy.headers.categories);
    const h = await ensureAssetHeaders(sheet, assetTaxonomy.headers.subcategories);
    const categories = await categoriesSheet.getRows();
    const categoryIdHeader = getH(categoryHeaders, 'Category_ID');
    const categoryNameHeader = getH(categoryHeaders, 'Category_Name');
    const categoryTypeHeader = getH(categoryHeaders, 'Type');
    const parentCategory = categories.find(row => normalize(row.get(categoryIdHeader)) === normalize(categoryId));
    if (!parentCategory) return res.status(404).json({ success: false, message: 'The selected parent category could not be found.' });
    const parentCategoryName = parentCategory.get(categoryNameHeader) || '';
    const parentCategoryType = String(parentCategory.get(categoryTypeHeader) || '').trim().toUpperCase();
    if (parentCategoryType !== 'GENERAL' && parentCategoryType && parentCategoryType !== requestedType) {
      return res.status(400).json({ success: false, message: `Subcategories in this category must be classified as ${parentCategoryType.toLowerCase()}.` });
    }
    const subcategoryType = parentCategoryType === 'GENERAL' ? requestedType : parentCategoryType;
    const existingRows = await sheet.getRows();
    const parentIdHeader = getH(h, 'Category_ID');
    const parentNameHeader = getH(h, 'Category_Name');
    const subcategoryIdHeader = getH(h, 'Subcategory_ID');
    const subcategoryHeader = getH(h, 'Subcategory_Name');
    const duplicate = existingRows.some(row => normalize(row.get(parentIdHeader)) === normalize(categoryId)
      && normalize(row.get(subcategoryHeader)) === normalize(subcategoryName));
    if (duplicate) return res.status(409).json({ success: false, message: 'That subcategory already exists in this category.' });
    const subId = nextHierarchyId(existingRows, h, 'Subcategory_ID', categoryId, 'Category_ID', categoryId);
    const subcategoryRow = { Subcategory_ID: subId, Category_ID: categoryId, Category_Name: parentCategoryName, Subcategory_Name: subcategoryName, Type: subcategoryType, Status: 'ACTIVE' };
    await sheet.addRow(subcategoryRow);
    const normalized = { subcategoryid: subId, categoryid: categoryId, categoryname: parentCategoryName, name: subcategoryName, type: subcategoryType, status: 'ACTIVE' };
    const cache = getAssetCache();
    if (Array.isArray(cache?.assetsubcategorymaster)) cache.assetsubcategorymaster.push(normalized);
    if (cache) cache.subcategories = cache.assetsubcategorymaster || cache.subcategories;
    void refreshAssetCache();
    res.json({ success: true, message: `Subcategory '${subcategoryName}' added successfully!`, subcategory: normalized });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addAssetType = async (req, res) => {
  try {
    const categoryId = String(req.body?.categoryId || '').trim();
    const subcategoryId = String(req.body?.subcategoryId || '').trim();
    const assetTypeName = String(req.body?.assetTypeName || '').trim();
    const requestedType = String(req.body?.type || 'ASSET').trim().toUpperCase();
    if (!categoryId || !subcategoryId || !assetTypeName) return res.status(400).json({ success: false, message: 'Choose a category and subcategory, then enter the item type.' });
    if (!['ASSET', 'CONSUMABLE'].includes(requestedType)) return res.status(400).json({ success: false, message: 'Item type classification must be ASSET or CONSUMABLE.' });
    const categoriesSheet = sheetByKey('assetcategorymaster');
    const subcategoriesSheet = sheetByKey('assetsubcategorymaster');
    const sheet = sheetByKey('assettypemaster');
    if (!categoriesSheet || !subcategoriesSheet || !sheet) return res.status(503).json({ success: false, message: 'The new asset classification library is not available yet.' });
    const categoryHeaders = await ensureAssetHeaders(categoriesSheet, assetTaxonomy.headers.categories);
    const subcategoryHeaders = await ensureAssetHeaders(subcategoriesSheet, assetTaxonomy.headers.subcategories);
    const typeHeaders = await ensureAssetHeaders(sheet, assetTaxonomy.headers.assetTypes);
    const [categories, subcategories, existingRows] = await Promise.all([categoriesSheet.getRows(), subcategoriesSheet.getRows(), sheet.getRows()]);
    const category = categories.find(row => normalize(row.get(getH(categoryHeaders, 'Category_ID'))) === normalize(categoryId));
    const subcategory = subcategories.find(row => normalize(row.get(getH(subcategoryHeaders, 'Subcategory_ID'))) === normalize(subcategoryId)
      && normalize(row.get(getH(subcategoryHeaders, 'Category_ID'))) === normalize(categoryId));
    if (!category || !subcategory) return res.status(404).json({ success: false, message: 'The selected category path is no longer valid. Refresh and try again.' });
    const subcategoryType = String(subcategory.get(getH(subcategoryHeaders, 'Type')) || category.get(getH(categoryHeaders, 'Type')) || 'ASSET').trim().toUpperCase();
    const categoryType = String(category.get(getH(categoryHeaders, 'Type')) || '').trim().toUpperCase();
    const effectiveType = subcategoryType === 'GENERAL' || subcategoryType === 'CONSUMABLE' || subcategoryType === 'ASSET'
      ? subcategoryType : categoryType === 'GENERAL' ? requestedType : categoryType;
    if (effectiveType !== requestedType) return res.status(400).json({ success: false, message: `This subcategory is classified as ${effectiveType.toLowerCase()}. Its item types must use the same classification.` });
    const duplicate = existingRows.some(row => normalize(row.get(getH(typeHeaders, 'Subcategory_ID'))) === normalize(subcategoryId)
      && normalize(row.get(getH(typeHeaders, 'Asset_Type_Name'))) === normalize(assetTypeName));
    if (duplicate) return res.status(409).json({ success: false, message: 'That item type already exists under this subcategory.' });
    const assetTypeId = nextHierarchyId(existingRows, typeHeaders, 'Asset_Type_ID', subcategoryId, 'Subcategory_ID', subcategoryId);
    const categoryName = category.get(getH(categoryHeaders, 'Category_Name')) || '';
    const subcategoryName = subcategory.get(getH(subcategoryHeaders, 'Subcategory_Name')) || '';
    await sheet.addRow({ Asset_Type_ID: assetTypeId, Category_ID: categoryId, Category_Name: categoryName, Subcategory_ID: subcategoryId, Subcategory_Name: subcategoryName, Asset_Type_Name: assetTypeName, Type: effectiveType, Status: 'ACTIVE' });
    const normalized = { assettypeid: assetTypeId, categoryid: categoryId, categoryname: categoryName, subcategoryid: subcategoryId, subcategoryname: subcategoryName, name: assetTypeName, type: effectiveType, status: 'ACTIVE' };
    const cache = getAssetCache();
    if (Array.isArray(cache?.assettypemaster)) cache.assettypemaster.push(normalized);
    if (cache) cache.assetTypes = cache.assettypemaster || cache.assetTypes;
    void refreshAssetCache();
    return res.json({ success: true, message: `Item type '${assetTypeName}' added successfully!`, assetType: normalized });
  } catch (err) { return res.status(500).json({ success: false, message: err.message }); }
};

exports.addLocation = async (req, res) => {
  try {
    const branchName = String(req.body?.branchName || '').trim();
    const room = String(req.body?.room || '').trim();
    const area = String(req.body?.area || '').trim();
    if (!branchName || !room || !area) {
      return res.status(400).json({ success: false, message: 'Branch, room, and area are required.' });
    }
    if (!canAccessAssetBranch(req, branchName)) {
      return res.status(403).json({ success: false, message: 'You cannot add a location for that branch.' });
    }
    const sheet = sheetByKey('locations');
    if (!sheet) return res.status(404).json({ success: false, message: "Locations sheet missing." });

    const h = sheet.headerValues;
    const locationName = `${room} (${area})`;
    const existing = (getAssetCache()?.locations || []).some(row =>
      normalize(rowValue(row, 'Branch') || rowValue(row, 'Branch_ID')) === normalize(branchName)
      && normalize(rowValue(row, 'Location_Name')) === normalize(locationName)
      && String(rowValue(row, 'Status') || '').trim().toUpperCase() !== 'INACTIVE'
    );
    if (existing) return res.status(409).json({ success: false, message: 'That room and area already exist for this branch.' });
    const locId = `LOC-${randomUUID().slice(0, 8).toUpperCase()}`;

    await sheet.addRow({
      [getH(h, 'Location_ID')]: locId,
      [getH(h, 'Branch_ID')]: branchName, // Mapping name directly for simplicity in dropdowns
      [getH(h, 'Branch')]: branchName,
      [getH(h, 'Building')]: 'Main',
      [getH(h, 'Floor')]: '1',
      [getH(h, 'Room')]: room,
      [getH(h, 'Area')]: area,
      [getH(h, 'Location_Name')]: locationName,
      [getH(h, 'Status')]: 'ACTIVE',
      [getH(h, 'Created_At')]: formatIndiaTimestamp()
    });

    refreshAssetCache();
    res.json({ success: true, message: `Location '${locationName}' added successfully to ${branchName}!` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addVendor = async (req, res) => {
  try {
    const { vendorName, contactPerson, phone, email } = req.body;
    const sheet = sheetByKey('vendors');
    if (!sheet) return res.status(404).json({ success: false, message: "Vendors sheet missing." });

    const h = sheet.headerValues;
    const vendorId = `VND-${Math.floor(1000 + Math.random() * 9000)}`;

    await sheet.addRow({
      [getH(h, 'Vendor_ID')]: vendorId,
      [getH(h, 'Vendor_Name')]: vendorName,
      [getH(h, 'Contact_Person')]: contactPerson || '',
      [getH(h, 'Phone')]: phone || '',
      [getH(h, 'Email')]: email || '',
      [getH(h, 'Address')]: '',
      [getH(h, 'GST_Number')]: '',
      [getH(h, 'Status')]: 'ACTIVE',
      [getH(h, 'Created_At')]: formatIndiaTimestamp()
    });

    refreshAssetCache();
    res.json({ success: true, message: `Vendor '${vendorName}' added successfully!` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// =========================================================
// 12. DOCUMENTS & PHOTOS UPLOAD
// =========================================================
exports.uploadAssetDocument = async (req, res) => {
  try {
    const { assetId, documentType } = req.body || {};
    if (!req.file) return res.status(400).json({ success: false, message: "No file provided." });

    const asset = (await sheetByKey('assets')?.getRows()) || [];
    const assetRow = asset.find(row => String(row.get(getH(row._worksheet.headerValues, 'Asset_ID')) || '').trim().toLowerCase() === String(assetId || '').trim().toLowerCase());
    if (!assetRow) return res.status(404).json({ success: false, message: 'Asset not found.' });
    if (!canAccessAssetBranch(req, assetRow.get(getH(assetRow._worksheet.headerValues, 'Branch')) || '')) return res.status(403).json({ success: false, message: 'This asset is outside your branch assignment.' });

    // Upload to Google Drive using existing helper
    const fileUrl = await uploadToDrive(req.file, process.env.DRIVE_FOLDER_ID || '');
    
    const docSheet = sheetByKey('documents');
    if (!docSheet) return res.status(404).json({ success: false, message: "Documents sheet missing." });

    const h = docSheet.headerValues;
    await docSheet.addRow({
      [getH(h, 'Document_ID')]: `DOC-${Date.now()}`,
      [getH(h, 'Asset_ID')]: assetId,
      [getH(h, 'Document_Type')]: documentType || 'PHOTO',
      [getH(h, 'File_Name')]: req.file.originalname,
      [getH(h, 'Drive_URL')]: fileUrl,
      [getH(h, 'Uploaded_By')]: req.portalUser?.name || '',
      [getH(h, 'Uploaded_At')]: formatIndiaTimestamp()
    });

    refreshAssetCache();
    res.json({ success: true, message: "File uploaded successfully!", url: fileUrl });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// =========================================================
// 13. ASSET DISPOSAL
// =========================================================
exports.disposeAsset = async (req, res) => {
  try {
    const { assetId, reason, method, value, userName, remarks } = req.body || {};
    const cleanAssetId = String(assetId || '').trim();
    const cleanReason = String(reason || '').trim();
    const cleanMethod = String(method || '').trim();
    const disposalValue = value === '' || value === undefined || value === null ? 0 : Number(value);
    if (!cleanAssetId || !cleanReason || !cleanMethod || !Number.isFinite(disposalValue) || disposalValue < 0) {
      return res.status(400).json({ success: false, message: 'Asset, disposal reason, method, and a non-negative value are required.' });
    }

    const assetSheet = sheetByKey('assets');
    const approvalSheet = sheetByKey('assetapprovals');
    if (!assetSheet || !approvalSheet) return res.status(503).json({ success: false, message: 'Asset register or approval desk is unavailable. No changes were made.' });
    const rows = await assetSheet.getRows();
    const assetRow = rows.find(r => {
      const rd = r.toObject();
      const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === 'assetid');
      return (rd[k] || '').toString().trim().toLowerCase() === cleanAssetId.toLowerCase();
    });

    if (!assetRow) return res.status(404).json({ success: false, message: 'Asset not found.' });
    if (!canAccessAssetBranch(req, assetRow.get(getH(assetSheet.headerValues, 'Branch')) || '')) return res.status(403).json({ success: false, message: 'This asset is outside your branch assignment.' });
    const aH = assetSheet.headerValues;
    const oldStatus = String(assetRow.get(getH(aH, 'Status')) || '').toUpperCase();
    if (oldStatus !== 'AVAILABLE') return res.status(409).json({ success: false, message: 'Only available assets can be submitted for retirement. Return the item or complete maintenance and transfers first.' });
    const maintenanceSheet = sheetByKey('maintenance');
    if (maintenanceSheet) {
      const openTicket = (await maintenanceSheet.getRows()).some(row => String(row.get(getH(maintenanceSheet.headerValues, 'Asset_ID')) || '').trim().toLowerCase() === cleanAssetId.toLowerCase() && String(row.get(getH(maintenanceSheet.headerValues, 'Status')) || '').toUpperCase() === 'OPEN');
      if (openTicket) return res.status(409).json({ success: false, message: 'Resolve the open maintenance ticket before disposal.' });
    }

    const approvalHeaders = await ensureAssetHeaders(approvalSheet, ['Approval_ID', 'Request_ID', 'Request_Type', 'Asset_ID', 'Branch', 'Requested_By', 'Requested_At', 'Decision', 'Decided_By', 'Decided_At', 'Reason', 'Requested_By_Email', 'Reviewed_By_Email', 'Payload_JSON']);
    const approvalRows = await approvalSheet.getRows();
    const existingRequest = approvalRows.find(row => String(rowValue(row, 'Asset_ID') || '').trim().toLowerCase() === cleanAssetId.toLowerCase()
      && String(rowValue(row, 'Request_Type') || '').trim().toUpperCase() === 'DELETE_ASSET'
      && String(rowValue(row, 'Decision') || '').trim().toUpperCase() === 'PENDING');
    if (existingRequest) return res.status(409).json({ success: false, message: 'A retirement request for this item is already waiting for Rakesh.' });

    const timestamp = formatIndiaTimestamp();
    const requestId = `DEL-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const requestData = { reason: cleanReason, method: cleanMethod, value: disposalValue, remarks: String(remarks || '').trim() };
    await appendAssetApproval({
      requestId, requestType: 'DELETE_ASSET', assetId: cleanAssetId,
      branch: assetRow.get(getH(aH, 'Branch')) || '', requestedBy: userName || req.portalUser?.name || '',
      requestedByEmail: req.portalUser?.email || '', requestedAt: timestamp, decision: 'PENDING',
      reason: cleanReason, payload: requestData
    });
    await appendAssetActivity(req, { action: 'ASSET_RETIREMENT_REQUESTED', entityType: 'AssetApproval', entityId: cleanAssetId, branch: assetRow.get(getH(aH, 'Branch')) || '', before: { status: oldStatus }, after: { status: oldStatus, requestId, reason: cleanReason } });

    refreshAssetCache();
    return res.status(201).json({ success: true, requestId, message: 'Retirement request sent to Rakesh for approval. The item remains in the register until it is approved.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getAssetApprovals = async (req, res) => {
  if (!isAssetApprover(req)) return res.status(403).json({ success: false, message: 'This approval desk is available only to Rakesh.' });
  if (respondWhileAssetDataLoads(res)) return;
  try {
    const cache = getAssetCache() || {};
    const assetsById = new Map((cache.assets || []).map(row => [String(rowValue(row, 'Asset_ID') || '').trim().toLowerCase(), row]));
    const requests = (cache.assetapprovals || []).map(row => {
      const requestId = String(rowValue(row, 'Request_ID') || '').trim();
      const assetId = String(rowValue(row, 'Asset_ID') || '').trim();
      const asset = assetsById.get(assetId.toLowerCase());
      return {
        requestId,
        requestType: String(rowValue(row, 'Request_Type') || 'TRANSFER').trim().toUpperCase(),
        assetId,
        assetName: rowValue(asset, 'Asset_Name') || rowValue(asset, 'Name') || rowValue(asset, 'Item_Name') || '',
        branch: rowValue(row, 'Branch') || rowValue(asset, 'Branch') || '',
        requestedBy: rowValue(row, 'Requested_By'),
        requestedByEmail: rowValue(row, 'Requested_By_Email'),
        requestedAt: rowValue(row, 'Requested_At'),
        decision: String(rowValue(row, 'Decision') || 'PENDING').trim().toUpperCase(),
        decidedBy: rowValue(row, 'Decided_By'),
        decidedAt: rowValue(row, 'Decided_At'),
        reason: rowValue(row, 'Reason'),
        payload: parseJsonField(rowValue(row, 'Payload_JSON'), {})
      };
    }).filter(request => request.requestId).reverse();
    return res.json({ success: true, requests, pendingCount: requests.filter(item => item.decision === 'PENDING').length });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.decideAssetApproval = async (req, res) => {
  if (!isAssetApprover(req)) return res.status(403).json({ success: false, message: 'Only Rakesh can decide asset approval requests.' });
  try {
    const requestId = String(req.params.requestId || '').trim();
    const decision = String(req.body?.decision || '').trim().toUpperCase();
    const reason = String(req.body?.reason || '').trim();
    if (!requestId || !['APPROVED', 'REJECTED'].includes(decision)) return res.status(400).json({ success: false, message: 'Choose approve or reject for this request.' });
    if (decision === 'REJECTED' && !reason) return res.status(400).json({ success: false, message: 'Add a reason when rejecting a request.' });
    const approvalSheet = sheetByKey('assetapprovals');
    const approvalHeaders = await ensureAssetHeaders(approvalSheet, ['Approval_ID', 'Request_ID', 'Request_Type', 'Asset_ID', 'Branch', 'Requested_By', 'Requested_At', 'Decision', 'Decided_By', 'Decided_At', 'Reason', 'Requested_By_Email', 'Reviewed_By_Email', 'Payload_JSON']);
    const approvals = await approvalSheet.getRows();
    const approval = approvals.find(row => String(rowValue(row, 'Request_ID') || '').trim().toLowerCase() === requestId.toLowerCase());
    if (!approval) return res.status(404).json({ success: false, message: 'Approval request was not found.' });
    const requestType = String(rowValue(approval, 'Request_Type') || '').trim().toUpperCase();
    if (requestType !== 'DELETE_ASSET') return res.status(400).json({ success: false, message: 'Use the transfer approval action for transfer requests.' });
    if (String(rowValue(approval, 'Decision') || '').trim().toUpperCase() !== 'PENDING') return res.status(409).json({ success: false, message: 'This request has already been reviewed.' });
    const assetId = String(rowValue(approval, 'Asset_ID') || '').trim();
    const assetSheet = sheetByKey('assets');
    const assetRows = await assetSheet.getRows();
    const asset = assetRows.find(row => String(rowValue(row, 'Asset_ID') || '').trim().toLowerCase() === assetId.toLowerCase());
    if (!asset) return res.status(404).json({ success: false, message: 'The asset is no longer in the register.' });
    const payload = parseJsonField(rowValue(approval, 'Payload_JSON'), {});
    const timestamp = formatIndiaTimestamp();
    const branch = rowValue(approval, 'Branch') || rowValue(asset, 'Branch') || '';

    if (decision === 'APPROVED') {
      const assetStatus = String(rowValue(asset, 'Status') || '').trim().toUpperCase();
      if (!['AVAILABLE', 'DISPOSED'].includes(assetStatus)) return res.status(409).json({ success: false, message: 'The asset is no longer available. Resolve its assignment or transfer before retiring it.' });
      const disposalSheet = sheetByKey('disposals');
      const disposalHeaders = await ensureAssetHeaders(disposalSheet, ['Disposal_ID', 'Asset_ID', 'Reason', 'Disposal_Method', 'Disposal_Value', 'Requested_By', 'Approved_By', 'Disposed_Date', 'Remarks']);
      const disposalId = `DSP-${requestId.replace(/[^a-z0-9-]/gi, '')}`;
      const disposalRows = await disposalSheet.getRows();
      if (!disposalRows.some(row => String(rowValue(row, 'Disposal_ID') || '').trim() === disposalId)) {
        await disposalSheet.addRow({
          [getH(disposalHeaders, 'Disposal_ID')]: disposalId,
          [getH(disposalHeaders, 'Asset_ID')]: assetId,
          [getH(disposalHeaders, 'Reason')]: payload.reason || rowValue(approval, 'Reason'),
          [getH(disposalHeaders, 'Disposal_Method')]: payload.method || '',
          [getH(disposalHeaders, 'Disposal_Value')]: Number(payload.value || 0),
          [getH(disposalHeaders, 'Requested_By')]: rowValue(approval, 'Requested_By'),
          [getH(disposalHeaders, 'Approved_By')]: req.portalUser?.name || ASSET_APPROVER_EMAIL,
          [getH(disposalHeaders, 'Disposed_Date')]: timestamp,
          [getH(disposalHeaders, 'Remarks')]: [payload.remarks, `Approval ${requestId}`].filter(Boolean).join(' · ')
        });
      }
      const assetHeaders = await ensureAssetHeaders(assetSheet, ['Asset_ID', 'Status']);
      if (assetStatus !== 'DISPOSED') {
        asset.assign({ [getH(assetHeaders, 'Status')]: 'DISPOSED' });
        await asset.save();
      }
      const historySheet = sheetByKey('history');
      const historyHeaders = await ensureAssetHeaders(historySheet, ['History_ID', 'Asset_ID', 'Action', 'Old_Value', 'New_Value', 'Performed_By', 'Branch', 'Timestamp', 'Remarks']);
      const historyRows = await historySheet.getRows();
      if (!historyRows.some(row => String(rowValue(row, 'Remarks') || '').includes(`Approval ${requestId}`))) {
        await historySheet.addRow({
          [getH(historyHeaders, 'History_ID')]: `HIS-${randomBytes(7).toString('hex').toUpperCase()}`,
          [getH(historyHeaders, 'Asset_ID')]: assetId,
          [getH(historyHeaders, 'Action')]: 'ASSET_DISPOSED',
          [getH(historyHeaders, 'Old_Value')]: 'AVAILABLE',
          [getH(historyHeaders, 'New_Value')]: 'DISPOSED',
          [getH(historyHeaders, 'Performed_By')]: req.portalUser?.name || ASSET_APPROVER_EMAIL,
          [getH(historyHeaders, 'Branch')]: branch,
          [getH(historyHeaders, 'Timestamp')]: timestamp,
          [getH(historyHeaders, 'Remarks')]: `Approval ${requestId} · ${payload.reason || rowValue(approval, 'Reason') || 'Retired'}`
        });
      }
    }

    await updateAssetApproval({ requestId, decision, decidedBy: req.portalUser?.name || ASSET_APPROVER_EMAIL, decidedAt: timestamp, reason, reviewedByEmail: req.portalUser?.email || ASSET_APPROVER_EMAIL });
    await appendAssetActivity(req, {
      action: decision === 'APPROVED' ? 'ASSET_RETIREMENT_APPROVED' : 'ASSET_RETIREMENT_REJECTED',
      entityType: 'AssetApproval', entityId: assetId, branch,
      before: { decision: 'PENDING' }, after: { decision, requestId, reason }
    });
    refreshAssetCache();
    return res.json({ success: true, message: decision === 'APPROVED' ? 'Retirement approved. The asset is now recorded as retired.' : 'Retirement request rejected. The asset remains active.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
