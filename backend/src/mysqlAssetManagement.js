const { randomUUID } = require('crypto');
const axios = require('axios');
const mysqlPool = require('./mysqlPool');
const { isPortalAdmin } = require('./rolePolicy');
const { uploadToDrive } = require('./driveUploads');
const { sendIPCSMail } = require('./config');

const text = value => String(value ?? '').trim();
const normalized = value => text(value).toLocaleLowerCase('en-US').replace(/[^a-z0-9]/g, '');
const parseJson = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
};
const parts = value => Array.isArray(value) ? value.map(text).filter(Boolean) : text(value).split(/[,;|\n]+/).map(text).filter(Boolean);
const dateOnly = value => {
  const raw = text(value);
  if (!raw) return null;
  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let result;
  if (match) result = `${match[1]}-${String(match[2]).padStart(2, '0')}-${String(match[3]).padStart(2, '0')}`;
  else {
    match = raw.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
    if (match) result = `${match[3]}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;
  }
  if (!result) throw dbError('Enter a date in DD/MM/YYYY or YYYY-MM-DD format.');
  const [year, month, day] = result.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) throw dbError('Enter a valid calendar date.');
  return result;
};
const dateValue = value => value instanceof Date ? value.toISOString().slice(0, 10) : text(value).slice(0, 10);
const isMySqlMode = () => String(process.env.MYSQL_ASSET_MANAGEMENT_ENABLED || '').trim().toLowerCase() === 'true';
const dbError = (message, status = 400) => Object.assign(new Error(message), { status });

function canSeeAll(req) {
  return isPortalAdmin(req.portalUser || {}) || text(req.portalUser?.email).toLowerCase() === 'rakesh@ipcsglobal.com';
}

async function visibleBranchIds(connection, req) {
  if (canSeeAll(req)) return null;
  const requested = [...new Set([...parts(req.portalUser?.assignedBranchesArray), text(req.portalUser?.sittingBranch)].filter(Boolean).map(normalized))];
  if (!requested.length || requested.includes('all')) return [];
  const [rows] = await connection.execute('SELECT id, normalized_name, name FROM branches');
  return rows.filter(row => requested.includes(normalized(row.normalized_name || row.name))).map(row => row.id);
}

async function actorUserId(connection, actor = {}) {
  const email = text(actor.email).toLocaleLowerCase('en-US');
  const candidateId = text(actor.id);
  if (!email && !candidateId) return null;
  const [rows] = await connection.execute(
    'SELECT id FROM users WHERE (? <> \'\' AND id = ?) OR (? <> \'\' AND normalized_email = ?) LIMIT 1',
    [candidateId, candidateId, email, email],
  );
  return rows[0]?.id || null;
}

async function assertBranchAccess(connection, req, branchId) {
  const visible = await visibleBranchIds(connection, req);
  if (visible && !visible.includes(branchId)) throw dbError('This branch is outside your assigned asset access.', 403);
}

function assetShape(row) {
  const metadata = parseJson(row.metadata);
  const fields = parseJson(metadata.fields, {});
  const condition = text(row.asset_condition || metadata.condition || 'NEW').toUpperCase();
  return {
    assetId: row.asset_code,
    id: row.id,
    name: row.name,
    category: row.category || '',
    categoryId: row.category_classification_id || '',
    subcategory: row.subcategory || '',
    subcategoryId: row.subcategory_classification_id || '',
    assetType: row.asset_type || '',
    assetTypeId: row.type_classification_id || '',
    trackingMode: text(row.tracking_mode || metadata.trackingMode || 'INDIVIDUAL').toUpperCase(),
    quantity: Number(row.quantity || 1),
    branch: row.branch_name || metadata.branchName || '',
    branchId: row.branch_id || '',
    location: row.location_name || metadata.locationName || '',
    locationId: row.location_id || '',
    status: text(row.status || 'available').replaceAll('_', ' ').toUpperCase().replaceAll(' ', '_'),
    condition,
    brand: row.brand || metadata.brand || '',
    model: row.model || metadata.model || '',
    serialNumber: row.serial_number || metadata.serialNumber || '',
    purchaseDate: dateValue(row.purchased_at || fields.Purchase_Date || fields.PurchaseDate),
    purchaseCost: row.purchase_cost ?? fields.Purchase_Cost ?? '',
    vendor: row.vendor_name || metadata.vendor || '',
    invoice: row.invoice_number || metadata.invoiceNumber || '',
    warrantyEnd: dateValue(row.warranty_end || metadata.warrantyEnd),
    photoUrl: row.image_url || fields.Photo_URL || fields.Photo || '',
    model3dUrl: row.model_3d_url || '',
    createdBy: row.created_by_name || metadata.createdBy || '',
    timestamp: row.created_at,
    updatedBy: row.updated_by_name || metadata.updatedBy || '',
    updatedAt: row.updated_at,
    assignedTo: row.assignment_name || '',
    assignedEmployeeId: row.assignment_employee_id || '',
    source: row.source || '',
  };
}

async function queryAssets(connection, req, { includeArchived = false, assetCode = '' } = {}) {
  const branchIds = await visibleBranchIds(connection, req);
  if (branchIds && !branchIds.length) return [];
  const clauses = [];
  const values = [];
  if (!includeArchived) clauses.push("LOWER(a.status) <> 'archived'");
  if (assetCode) { clauses.push('LOWER(a.asset_code) = LOWER(?)'); values.push(assetCode); }
  if (branchIds) { clauses.push(`a.branch_id IN (${branchIds.map(() => '?').join(',')})`); values.push(...branchIds); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const [rows] = await connection.execute(
    `SELECT a.*, b.name AS branch_name, l.name AS location_name,
            active_assignment.employee_name AS assignment_name,
            active_assignment.employee_id AS assignment_employee_id
       FROM assets a
       LEFT JOIN branches b ON b.id = a.branch_id
       LEFT JOIN asset_locations l ON l.id = a.location_id
       LEFT JOIN asset_assignments active_assignment
         ON active_assignment.asset_id = a.id AND LOWER(active_assignment.status) = 'assigned'
       ${where}
      ORDER BY a.updated_at DESC, a.name`,
    values,
  );
  return rows;
}

async function logChange(connection, req, asset, action, beforeState, afterState, remarks = '') {
  const actor = req.portalUser || {};
  const now = new Date();
  const actorId = await actorUserId(connection, actor);
  await connection.execute(
    `INSERT INTO asset_history
      (id, asset_id, action, actor_user_id, actor_name, branch_name, occurred_at, before_state, after_state, remarks, source, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'tpo_portal', JSON_OBJECT('source', 'mysql_asset_management'))`,
    [randomUUID(), asset?.id || null, action, actorId, text(actor.name || actor.email), asset?.branch_name || '', now,
      JSON.stringify(beforeState || {}), JSON.stringify(afterState || {}), text(remarks) || null],
  );
  if (asset?.id) {
    await connection.execute(
      `INSERT INTO asset_activity (id, asset_id, actor_user_id, action, occurred_at, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [randomUUID(), asset.id, actorId, action, now,
        JSON.stringify({ assetId: asset.asset_code, actorName: text(actor.name || actor.email), before: beforeState || {}, after: afterState || {}, remarks: text(remarks) })],
    );
  }
}

async function ensureQrLabel(connection, asset, actor = {}) {
  const [existing] = await connection.execute("SELECT id FROM asset_qr_labels WHERE asset_id = ? AND LOWER(status) = 'active' LIMIT 1", [asset.id]);
  if (existing[0]) return;
  const portalOrigin = String(process.env.TPO_PORTAL_URL || process.env.FRONTEND_URL || 'https://placement.ipcstalenzo.com').split(',')[0].trim().replace(/\/$/, '');
  const qrValue = `${portalOrigin}/assets/item/${encodeURIComponent(asset.asset_code)}`;
  const actorId = await actorUserId(connection, actor);
  await connection.execute(
    `INSERT INTO asset_qr_labels (id, asset_id, qr_value, qr_version, status, created_by_user_id, created_by_name, created_at, source, metadata)
     VALUES (?, ?, ?, 'PORTAL_LINK_V1', 'active', ?, ?, UTC_TIMESTAMP(), 'tpo_portal', ?)`,
    [randomUUID(), asset.id, qrValue, actorId, text(actor.name || actor.email), JSON.stringify({ source: 'mysql_asset_management' })],
  );
}

const qrSizeOptions = new Set(['2.5', '5', '7', '12', '25']);
function pngWithPhysicalSize(buffer, sizeCm) {
  const signature = buffer.subarray(0, 8);
  if (signature.toString('hex') !== '89504e470d0a1a0a') throw new Error('QR provider returned an invalid PNG image.');
  const chunks = [];
  let offset = 8;
  let inserted = false;
  const pixelsPerMeter = Math.round(100 / Number(sizeCm) * 100);
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    const chunk = buffer.subarray(offset, end);
    if (!inserted && buffer.toString('ascii', offset + 4, offset + 8) === 'IDAT') {
      const data = Buffer.alloc(9);
      data.writeUInt32BE(pixelsPerMeter, 0);
      data.writeUInt32BE(pixelsPerMeter, 4);
      data.writeUInt8(1, 8);
      const crcInput = Buffer.concat([Buffer.from('pHYs'), data]);
      let crc = 0xffffffff;
      for (const byte of crcInput) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
      const phys = Buffer.alloc(4 + crcInput.length + 4);
      phys.writeUInt32BE(data.length, 0);
      crcInput.copy(phys, 4);
      phys.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 4 + crcInput.length);
      chunks.push(phys);
      inserted = true;
    }
    chunks.push(chunk);
    offset = end;
  }
  return Buffer.concat([signature, ...chunks]);
}

async function findBranch(connection, branchName) {
  const clean = text(branchName);
  if (!clean) throw dbError('Choose a branch.');
  const [rows] = await connection.execute('SELECT id, name FROM branches');
  const branch = rows.find(row => normalized(row.name) === normalized(clean));
  if (!branch) throw dbError(`Branch “${clean}” is not in the MySQL branch directory.`, 400);
  return branch;
}

async function findClassification(connection, { id, name, kind, parentId = null, parentName = '' }) {
  let clauses = ['kind = ?', "LOWER(status) = 'active'"];
  const values = [kind];
  if (id) { clauses.push('id = ?'); values.push(id); }
  else { clauses.push('LOWER(name) = LOWER(?)'); values.push(text(name)); }
  if (parentId) { clauses.push('parent_id = ?'); values.push(parentId); }
  const [rows] = await connection.execute(
    `SELECT id, name, type_class, parent_id FROM asset_classifications WHERE ${clauses.join(' AND ')} LIMIT 2`, values,
  );
  if (!rows.length && !parentId && parentName) {
    const [parents] = await connection.execute("SELECT id FROM asset_classifications WHERE kind = 'category' AND LOWER(status) = 'active' AND LOWER(name) = LOWER(?) LIMIT 1", [parentName]);
    if (parents[0]) return findClassification(connection, { id, name, kind, parentId: parents[0].id });
  }
  if (rows.length !== 1) throw dbError(`Choose a valid ${kind.replace('_', ' ')} from the classification library.`);
  return rows[0];
}

async function resolveAssetReferences(connection, asset) {
  const category = await findClassification(connection, { id: asset.categoryId, name: asset.category, kind: 'category' });
  const subcategory = await findClassification(connection, { id: asset.subcategoryId, name: asset.subcategory, kind: 'subcategory', parentId: category.id });
  const type = await findClassification(connection, { id: asset.assetTypeId, name: asset.assetType, kind: 'asset_type', parentId: subcategory.id });
  if (/consum/i.test(type.type_class || '')) throw dbError('Consumable items must be managed from the inventory register.');
  return { category, subcategory, type };
}

async function findOrCreateLocation(connection, { branch, asset }) {
  let name = text(asset.location);
  if (asset.createLocation) {
    const room = text(asset.locationRoom);
    const area = text(asset.locationArea || 'OTHER').toUpperCase();
    if (!room || !['LAB', 'OFFICE', 'STORAGE', 'OTHER'].includes(area)) throw dbError('Enter a room name and choose a valid location type.');
    name = `${room} (${area})`;
  }
  if (!name) throw dbError('Choose or enter the physical location.');
  const [existing] = await connection.execute('SELECT id, name FROM asset_locations WHERE branch_id = ? AND normalized_name = ? LIMIT 1', [branch.id, normalized(name)]);
  if (existing[0]) return { ...existing[0], created: false };
  if (!asset.createLocation) throw dbError('Choose a location from this branch or add it as a new room.');
  const location = { id: randomUUID(), name };
  await connection.execute(
    'INSERT INTO asset_locations (id, name, normalized_name, branch_id, metadata) VALUES (?, ?, ?, ?, ?)',
    [location.id, name, normalized(name), branch.id, JSON.stringify({ area: text(asset.locationArea || 'OTHER').toUpperCase(), createdBy: 'asset_register' })],
  );
  return { ...location, created: true };
}

async function saveCustomFields(connection, assetId, fields) {
  await connection.execute('DELETE FROM asset_custom_fields WHERE asset_id = ?', [assetId]);
  for (const field of Array.isArray(fields) ? fields : []) {
    const name = text(field.name);
    const value = text(field.value);
    if (!name || !value) continue;
    await connection.execute(
      'INSERT INTO asset_custom_fields (id, asset_id, field_name, field_value, source, metadata) VALUES (?, ?, ?, ?, ?, ?)',
      [randomUUID(), assetId, name.slice(0, 200), value, 'tpo_portal', JSON.stringify({ source: 'asset_register' })],
    );
  }
}

function readAssetInput(req) {
  let asset = req.body?.asset || {};
  if (typeof asset === 'string') { try { asset = JSON.parse(asset); } catch { asset = {}; } }
  let customFields = req.body?.customFields || [];
  if (typeof customFields === 'string') { try { customFields = JSON.parse(customFields); } catch { customFields = []; } }
  if (!text(asset.name) || !text(asset.category) || !text(asset.subcategory) || !text(asset.assetType) || !text(asset.branch)) {
    throw dbError('Item name, category, subcategory, item type, and branch are required.');
  }
  const quantity = text(asset.trackingMode).toUpperCase() === 'QUANTITY' ? Number(asset.quantity) : 1;
  if (!Number.isSafeInteger(quantity) || quantity < 1) throw dbError('Quantity must be a whole number of at least 1.');
  if (text(asset.purchaseCost) && (!Number.isFinite(Number(asset.purchaseCost)) || Number(asset.purchaseCost) < 0)) throw dbError('Purchase cost must be zero or a positive number.');
  return { asset, customFields: Array.isArray(customFields) ? customFields : [], quantity };
}

async function makePhotoUrl(req, oldUrl = '') {
  if (!req.file) return oldUrl;
  return uploadToDrive(req.file, process.env.ASSET_DRIVE_FOLDER_ID || process.env.DRIVE_FOLDER_ID || '');
}

function asyncHandler(handler) {
  return (req, res) => Promise.resolve(handler(req, res)).catch(error => {
    console.error('[ASSET MYSQL]', error.message);
    res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'Could not complete the asset request. Please retry.' });
  });
}

const controllers = {};

controllers.getAssets = asyncHandler(async (req, res) => {
  const rows = await queryAssets(mysqlPool.getPool(), req);
  let result = rows.map(assetShape);
  const filters = req.query || {};
  if (filters.branch) result = result.filter(item => normalized(item.branch) === normalized(filters.branch));
  if (filters.status) result = result.filter(item => item.status === text(filters.status).toUpperCase());
  if (filters.q) { const query = normalized(filters.q); result = result.filter(item => normalized(`${item.assetId} ${item.name} ${item.category} ${item.subcategory} ${item.assetType} ${item.branch} ${item.location}`).includes(query)); }
  return res.json({ success: true, assets: result, source: 'mysql' });
});

controllers.getRegistrationData = asyncHandler(async (req, res) => {
  const pool = mysqlPool.getPool();
  const [branches, classifications, locations, vendors] = await Promise.all([
    pool.execute('SELECT id, name FROM branches ORDER BY name'),
    pool.execute("SELECT c.id, c.name, c.kind, c.parent_id, c.type_class, p.name AS parent_name FROM asset_classifications c LEFT JOIN asset_classifications p ON p.id = c.parent_id WHERE LOWER(c.status) = 'active' ORDER BY c.kind, c.name"),
    pool.execute("SELECT l.id, l.name AS locationname, b.name AS branch FROM asset_locations l LEFT JOIN branches b ON b.id = l.branch_id ORDER BY b.name, l.name"),
    pool.execute("SELECT id, name FROM asset_vendors WHERE LOWER(status) = 'active' ORDER BY name"),
  ]);
  const visibleNames = visibleBranchIdsForName(req);
  const branchRows = branches[0].filter(row => canSeeAll(req) || visibleNames.includes(normalized(row.name)));
  return res.json({
    success: true,
    branches: branchRows.map(row => ({ id: row.id, name: row.name, branchname: row.name })),
    categories: classifications[0].filter(row => row.kind === 'category').map(row => ({ id: row.id, categoryId: row.id, categoryid: row.id, name: row.name, categoryName: row.name, categoryname: row.name, type: row.type_class || 'ASSET' })),
    subcategories: classifications[0].filter(row => row.kind === 'subcategory').map(row => ({ id: row.id, subcategoryId: row.id, subcategoryid: row.id, categoryId: row.parent_id, categoryid: row.parent_id, categoryName: row.parent_name, categoryname: row.parent_name, name: row.name, subcategoryname: row.name, type: row.type_class || 'ASSET' })),
    assetTypes: classifications[0].filter(row => row.kind === 'asset_type').map(row => ({ id: row.id, assetTypeId: row.id, assettypeid: row.id, subcategoryId: row.parent_id, subcategoryid: row.parent_id, name: row.name, assettypename: row.name, type: row.type_class || 'ASSET' })),
    locations: locations[0].filter(row => canSeeAll(req) || visibleNames.includes(normalized(row.branch))),
    vendors: vendors[0].map(row => ({ id: row.id, vendorId: row.id, name: row.name, vendorname: row.name })),
    source: 'mysql',
  });
});

function visibleBranchIdsForName(req) {
  return [...new Set([...parts(req.portalUser?.assignedBranchesArray), text(req.portalUser?.sittingBranch)].filter(Boolean).map(normalized))];
}

controllers.getAssetDetails = asyncHandler(async (req, res) => {
  const [assetRow] = await queryAssets(mysqlPool.getPool(), req, { assetCode: req.params.assetId });
  if (!assetRow) return res.status(404).json({ success: false, message: 'Asset not found in your permitted branches.' });
  const [customSpecs, assignments, history, documents, disposals, maintenance, transfers] = await Promise.all([
    mysqlPool.query('SELECT field_name AS name, field_value AS value FROM asset_custom_fields WHERE asset_id = ? ORDER BY field_name', [assetRow.id]),
    mysqlPool.query('SELECT assignment_code AS assignmentId, employee_id AS employeeId, employee_name AS employeeName, assigned_at AS assignedAt, returned_at AS returnedAt, status, remarks FROM asset_assignments WHERE asset_id = ? ORDER BY COALESCE(returned_at, assigned_at) DESC', [assetRow.id]),
    mysqlPool.query('SELECT action, actor_name AS performedBy, branch_name AS branch, occurred_at AS timestamp, before_state AS oldValue, after_state AS newValue, remarks FROM asset_history WHERE asset_id = ? ORDER BY occurred_at DESC', [assetRow.id]),
    mysqlPool.query('SELECT document_type AS type, file_name AS fileName, url, uploaded_by_name AS uploadedBy, uploaded_at AS uploadedAt FROM asset_documents WHERE asset_id = ? ORDER BY uploaded_at DESC', [assetRow.id]),
    mysqlPool.query('SELECT disposal_code AS disposalId, reason, method, value, disposed_at AS disposedAt, remarks FROM asset_disposals WHERE asset_id = ? ORDER BY created_at DESC', [assetRow.id]),
    mysqlPool.query('SELECT ticket_code AS maintenanceId, issue, status, reported_by_name AS reportedBy, reported_at AS reportedAt, resolved_at AS completedAt, cost, remarks FROM asset_maintenance_tickets WHERE asset_id = ? ORDER BY reported_at DESC', [assetRow.id]),
    mysqlPool.query('SELECT transfer_code AS transferId, status, requested_at AS requestedAt, approved_at AS approvedAt, received_at AS receivedAt, remarks FROM asset_transfers WHERE asset_id = ? ORDER BY requested_at DESC', [assetRow.id]),
  ]);
  const asset = assetShape(assetRow);
  return res.json({ success: true, asset, customSpecs: customSpecs[0], assignments: assignments[0], history: history[0], documents: documents[0], disposals: disposals[0], maintenance: maintenance[0], transfers: transfers[0], source: 'mysql' });
});

controllers.registerAssetQrLabel = asyncHandler(async (req, res) => {
  const rows = await queryAssets(mysqlPool.getPool(), req, { assetCode: req.params.assetId });
  const asset = rows[0];
  if (!asset) return res.status(404).json({ success: false, message: 'Asset not found in your permitted branches.' });
  await mysqlPool.withTransaction(connection => ensureQrLabel(connection, asset, req.portalUser || {}));
  return res.json({ success: true, message: 'The item QR label is ready.', source: 'mysql' });
});

controllers.downloadAssetQrImage = asyncHandler(async (req, res) => {
  const rows = await queryAssets(mysqlPool.getPool(), req, { assetCode: req.params.assetId });
  const asset = rows[0];
  if (!asset) return res.status(404).json({ success: false, message: 'Asset not found in your permitted branches.' });
  const sizeCm = text(req.query.sizeCm || '2.5');
  const format = text(req.query.format || 'svg').toLowerCase();
  if (!qrSizeOptions.has(sizeCm)) throw dbError('Choose one of the available QR label sizes.');
  if (!['svg', 'png'].includes(format)) throw dbError('Choose SVG or PNG for the QR image.');
  let origin;
  let requestOrigin;
  try {
    origin = new URL(text(req.query.origin));
    requestOrigin = new URL(text(req.get('origin') || req.get('referer')));
  } catch { throw dbError('Open the QR download from the asset portal.'); }
  if (origin.origin !== requestOrigin.origin) throw dbError('The QR download origin did not match the asset portal.', 403);
  const targetUrl = new URL(`/assets/item/${encodeURIComponent(asset.asset_code)}`, origin.origin).toString();
  const response = await axios.get('https://api.qrserver.com/v1/create-qr-code/', {
    params: { data: targetUrl, size: '1000x1000', format, ecc: 'Q', margin: 4, 'charset-source': 'UTF-8' },
    responseType: 'arraybuffer', timeout: 20000,
  });
  let image = Buffer.from(response.data);
  if (format === 'svg') {
    const svg = image.toString('utf8');
    if (!/<svg\b/i.test(svg)) throw new Error('QR provider returned an invalid SVG image.');
    image = Buffer.from(svg.replace(/<svg\b([^>]*)>/i, (_tag, attributes) => `<svg${attributes.replace(/\s(?:width|height)=(['"])[\s\S]*?\1/gi, '')} width="${sizeCm}cm" height="${sizeCm}cm">`));
  } else image = pngWithPhysicalSize(image, sizeCm);
  res.set('Content-Type', format === 'svg' ? 'image/svg+xml; charset=utf-8' : 'image/png');
  res.set('Content-Disposition', `attachment; filename="${asset.asset_code.replace(/[^a-z0-9_-]/gi, '_')}-QR-${sizeCm}cm.${format}"`);
  res.set('Cache-Control', 'private, no-store');
  return res.send(image);
});

controllers.addAsset = asyncHandler(async (req, res) => {
  const { asset, customFields, quantity } = readAssetInput(req);
  const result = await mysqlPool.withTransaction(async connection => {
    const branch = await findBranch(connection, asset.branch);
    await assertBranchAccess(connection, req, branch.id);
    const refs = await resolveAssetReferences(connection, asset);
    const location = await findOrCreateLocation(connection, { branch, asset });
    const assetId = `IPCS-AST-${new Date().getFullYear()}-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    const id = randomUUID();
    const actor = req.portalUser || {};
    const photoUrl = await makePhotoUrl(req);
    const status = text(asset.condition).toUpperCase() === 'DAMAGED' ? 'under_maintenance' : 'available';
    const damagedIssue = text(asset.damageIssue);
    if (status === 'under_maintenance' && damagedIssue.length < 3) throw dbError('Describe the damage before registering this item as damaged.');
    const metadata = { trackingMode: text(asset.trackingMode).toUpperCase() === 'QUANTITY' ? 'QUANTITY' : 'INDIVIDUAL', condition: text(asset.condition || 'NEW').toUpperCase(), createdBy: text(actor.name || actor.email), source: 'asset_register' };
    await connection.execute(
      `INSERT INTO assets (id, asset_code, name, category, subcategory, asset_type, tracking_mode, quantity, status,
        location_id, qr_token, image_url, purchased_at, purchase_cost, source, source_record_key, metadata,
        category_classification_id, subcategory_classification_id, type_classification_id, branch_id,
        asset_condition, brand, model, serial_number, vendor_name, invoice_number, warranty_end, created_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'tpo_portal', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, assetId, text(asset.name), refs.category.name, refs.subcategory.name, refs.type.name, metadata.trackingMode.toLowerCase(), quantity,
        status, location.id, randomUUID(), photoUrl || null, dateOnly(asset.purchaseDate), asset.purchaseCost === '' ? null : Number(asset.purchaseCost),
        `tpo_portal:${assetId}`, JSON.stringify(metadata), refs.category.id, refs.subcategory.id, refs.type.id, branch.id,
        metadata.condition, text(asset.brand) || null, text(asset.model) || null, text(asset.serialNumber) || null,
        text(asset.vendor) || null, text(asset.invoice) || null, dateOnly(asset.warrantyEnd), metadata.createdBy || null],
    );
    await saveCustomFields(connection, id, customFields);
    await ensureQrLabel(connection, { id, asset_code: assetId }, actor);
    if (photoUrl) {
      await connection.execute('INSERT INTO asset_documents (id, document_code, asset_id, document_type, file_name, url, uploaded_by_user_id, uploaded_by_name, uploaded_at, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?)', [randomUUID(), `DOC-${randomUUID().slice(0, 8).toUpperCase()}`, id, 'PHOTO_REGISTERED', text(req.file?.originalname) || 'asset-photo', photoUrl, await actorUserId(connection, actor), text(actor.name || actor.email), 'tpo_portal']);
    }
    await logChange(connection, req, { id, asset_code: assetId, branch_name: branch.name }, status === 'under_maintenance' ? 'ASSET_REGISTERED_DAMAGED' : 'ASSET_REGISTERED', {}, { assetId, name: text(asset.name), category: refs.category.name, subcategory: refs.subcategory.name, assetType: refs.type.name, branch: branch.name, location: location.name, status, condition: metadata.condition, quantity, trackingMode: metadata.trackingMode }, damagedIssue);
    if (status === 'under_maintenance') {
      const maintenanceId = `MNT-${randomUUID().slice(0, 8).toUpperCase()}`;
      await connection.execute('INSERT INTO asset_maintenance_tickets (id, ticket_code, asset_id, issue, status, reported_by_user_id, reported_by_name, reported_at, previous_status, remarks, source) VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?, ?, ?)', [randomUUID(), maintenanceId, id, damagedIssue, 'open', await actorUserId(connection, actor), text(actor.name || actor.email), 'available', 'Item was registered with existing damage.', 'tpo_portal']);
      return { assetId, id, locationName: location.name, locationCreated: location.created, maintenanceId, photoUrl };
    }
    return { assetId, id, locationName: location.name, locationCreated: location.created, photoUrl };
  });
  return res.status(201).json({ success: true, ...result, message: result.maintenanceId ? 'Damaged item registered and a maintenance ticket was opened.' : 'Asset registered in MySQL.', source: 'mysql' });
});

controllers.updateAsset = asyncHandler(async (req, res) => {
  const { asset, customFields, quantity } = readAssetInput(req);
  const result = await mysqlPool.withTransaction(async connection => {
    const rows = await queryAssets(connection, req, { assetCode: req.params.assetId });
    const current = rows[0];
    if (!current) throw dbError('Asset not found in your permitted branches.', 404);
    if (String(current.status).toLowerCase() !== 'available') throw dbError('Only available items can be edited. Return or resolve the item first.', 409);
    const branch = await findBranch(connection, asset.branch);
    await assertBranchAccess(connection, req, branch.id);
    if (branch.id !== current.branch_id) throw dbError('Branch changes must use the transfer workflow so approvals and receipt are recorded.', 409);
    const refs = await resolveAssetReferences(connection, asset);
    const location = await findOrCreateLocation(connection, { branch, asset });
    const photoUrl = await makePhotoUrl(req, current.image_url || '');
    const trackingMode = text(asset.trackingMode).toUpperCase() === 'QUANTITY' ? 'quantity' : 'individual';
    const before = assetShape(current);
    const after = { ...before, name: text(asset.name), category: refs.category.name, subcategory: refs.subcategory.name, assetType: refs.type.name, location: location.name, condition: text(asset.condition || 'NEW').toUpperCase(), brand: text(asset.brand), model: text(asset.model), serialNumber: text(asset.serialNumber), vendor: text(asset.vendor), invoice: text(asset.invoice), purchaseDate: dateOnly(asset.purchaseDate), purchaseCost: asset.purchaseCost, warrantyEnd: dateOnly(asset.warrantyEnd), quantity, trackingMode: trackingMode.toUpperCase() };
    if (['DAMAGED', 'UNDER_MAINTENANCE'].includes(after.condition)) throw dbError('Use the damage report action to mark an item damaged and open its maintenance ticket.');
    const metadata = { ...parseJson(current.metadata), trackingMode: trackingMode.toUpperCase(), condition: after.condition, brand: after.brand, model: after.model, vendor: after.vendor, serialNumber: after.serialNumber, invoiceNumber: after.invoice, warrantyEnd: after.warrantyEnd, updatedBy: text(req.portalUser?.name || req.portalUser?.email) };
    await connection.execute(
      `UPDATE assets SET name = ?, category = ?, subcategory = ?, asset_type = ?, tracking_mode = ?, quantity = ?, location_id = ?,
        image_url = ?, purchased_at = ?, purchase_cost = ?, category_classification_id = ?, subcategory_classification_id = ?,
        type_classification_id = ?, asset_condition = ?, brand = ?, model = ?, serial_number = ?, vendor_name = ?, invoice_number = ?,
        warranty_end = ?, updated_by_name = ?, metadata = ? WHERE id = ?`,
      [after.name, refs.category.name, refs.subcategory.name, refs.type.name, trackingMode, quantity, location.id, photoUrl || null, after.purchaseDate,
        asset.purchaseCost === '' ? null : Number(asset.purchaseCost), refs.category.id, refs.subcategory.id, refs.type.id,
        after.condition, after.brand || null, after.model || null, after.serialNumber || null, after.vendor || null, after.invoice || null,
        after.warrantyEnd, metadata.updatedBy, JSON.stringify(metadata), current.id],
    );
    await saveCustomFields(connection, current.id, customFields);
    if (req.file) await connection.execute('INSERT INTO asset_documents (id, document_code, asset_id, document_type, file_name, url, uploaded_by_user_id, uploaded_by_name, uploaded_at, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?)', [randomUUID(), `DOC-${randomUUID().slice(0, 8).toUpperCase()}`, current.id, 'PHOTO_UPDATED', text(req.file.originalname) || 'asset-photo', photoUrl, await actorUserId(connection, req.portalUser || {}), text(req.portalUser?.name || req.portalUser?.email), 'tpo_portal']);
    await logChange(connection, req, current, 'ASSET_UPDATED', before, after, 'Asset details updated.');
    return { assetId: current.asset_code, photoUrl, locationName: location.name, locationCreated: location.created };
  });
  return res.json({ success: true, ...result, message: 'Asset details updated in MySQL.', source: 'mysql' });
});

controllers.markAssetDamaged = asyncHandler(async (req, res) => {
  const issue = text(req.body?.issue);
  if (issue.length < 3) throw dbError('Describe the damage before saving the report.');
  const result = await mysqlPool.withTransaction(async connection => {
    const rows = await queryAssets(connection, req, { assetCode: req.params.assetId });
    const current = rows[0];
    if (!current) throw dbError('Asset not found in your permitted branches.', 404);
    if (['archived', 'disposed'].includes(String(current.status).toLowerCase())) throw dbError('Archived or disposed assets cannot be marked damaged.', 409);
    const [open] = await connection.execute("SELECT id FROM asset_maintenance_tickets WHERE asset_id = ? AND LOWER(status) IN ('open','in_progress','pending') LIMIT 1", [current.id]);
    if (open[0]) throw dbError('This asset already has an open maintenance ticket.', 409);
    const previous = { status: current.status, condition: current.asset_condition };
    const ticketCode = `MNT-${randomUUID().slice(0, 8).toUpperCase()}`;
    await connection.execute('INSERT INTO asset_maintenance_tickets (id, ticket_code, asset_id, issue, status, reported_by_user_id, reported_by_name, reported_at, previous_status, source) VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?, ?)', [randomUUID(), ticketCode, current.id, issue, 'open', await actorUserId(connection, req.portalUser || {}), text(req.portalUser?.name || req.portalUser?.email), current.status, 'tpo_portal']);
    await connection.execute("UPDATE assets SET status = 'under_maintenance', asset_condition = 'DAMAGED', metadata = JSON_SET(COALESCE(metadata, JSON_OBJECT()), '$.condition', 'DAMAGED'), updated_by_name = ? WHERE id = ?", [text(req.portalUser?.name || req.portalUser?.email), current.id]);
    await logChange(connection, req, current, 'ASSET_MARKED_DAMAGED', previous, { status: 'under_maintenance', condition: 'DAMAGED', maintenanceId: ticketCode, issue }, issue);
    return { assetId: current.asset_code, maintenanceId: ticketCode };
  });
  return res.json({ success: true, ...result, message: 'Asset marked damaged and added to the maintenance register.', source: 'mysql' });
});

controllers.archiveAsset = asyncHandler(async (req, res) => {
  const reason = text(req.body?.reason);
  if (reason.length < 3) throw dbError('Enter a short reason before archiving this asset.');
  const result = await mysqlPool.withTransaction(async connection => {
    const rows = await queryAssets(connection, req, { assetCode: req.params.assetId });
    const current = rows[0];
    if (!current) throw dbError('Asset not found in your permitted branches.', 404);
    if (String(current.status).toLowerCase() === 'assigned') throw dbError('Return the asset before archiving it.', 409);
    if (['archived', 'disposed'].includes(String(current.status).toLowerCase())) throw dbError('This asset is already archived or disposed.', 409);
    await connection.execute("UPDATE assets SET status = 'archived', updated_by_name = ? WHERE id = ?", [text(req.portalUser?.name || req.portalUser?.email), current.id]);
    await logChange(connection, req, current, 'ASSET_ARCHIVED', { status: current.status }, { status: 'archived' }, reason);
    return { assetId: current.asset_code };
  });
  return res.json({ success: true, ...result, message: 'Asset archived in MySQL. Its history is retained.', source: 'mysql' });
});

controllers.getAssetActivity = asyncHandler(async (req, res) => {
  const branchIds = await visibleBranchIds(mysqlPool.getPool(), req);
  if (branchIds && !branchIds.length) return res.json({ success: true, activity: [], source: 'mysql' });
  const clauses = [];
  const values = [];
  if (branchIds) { clauses.push(`a.branch_id IN (${branchIds.map(() => '?').join(',')})`); values.push(...branchIds); }
  if (req.query?.assetId) { clauses.push('LOWER(a.asset_code) = LOWER(?)'); values.push(text(req.query.assetId)); }
  if (req.query?.q) { clauses.push('(LOWER(h.action) LIKE ? OR LOWER(h.actor_name) LIKE ? OR LOWER(h.remarks) LIKE ? OR LOWER(a.asset_code) LIKE ? OR LOWER(a.name) LIKE ?)'); const q = `%${text(req.query.q).toLowerCase()}%`; values.push(q, q, q, q, q); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const [rows] = await mysqlPool.query(
    `SELECT h.id, a.asset_code AS assetId, h.action, h.actor_name AS performedBy, h.branch_name AS branch,
            h.occurred_at AS timestamp, h.before_state AS oldValue, h.after_state AS newValue,
            h.remarks, 'Asset' AS entityType
       FROM asset_history h JOIN assets a ON a.id = h.asset_id ${where}
      ORDER BY h.occurred_at DESC LIMIT 500`, values,
  );
  return res.json({ success: true, activity: rows.map(row => ({ ...row, historyId: row.id, oldValue: JSON.stringify(parseJson(row.oldValue)), newValue: JSON.stringify(parseJson(row.newValue)) })), source: 'mysql' });
});

controllers.getMaintenance = asyncHandler(async (req, res) => {
  const branchIds = await visibleBranchIds(mysqlPool.getPool(), req);
  if (branchIds && !branchIds.length) return res.json({ success: true, maintenance: [], source: 'mysql' });
  const clauses = [];
  const values = [];
  if (branchIds) { clauses.push(`a.branch_id IN (${branchIds.map(() => '?').join(',')})`); values.push(...branchIds); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const [rows] = await mysqlPool.query(
    `SELECT m.ticket_code AS maintenanceId, a.asset_code AS assetId, a.name AS assetName,
            b.name AS branch, m.issue, m.status, m.reported_by_name AS reportedBy, m.reported_at AS reportedDate,
            m.previous_status AS previousStatus, m.cost, m.remarks, m.resolved_at AS completedDate
       FROM asset_maintenance_tickets m LEFT JOIN assets a ON a.id = m.asset_id
       LEFT JOIN branches b ON b.id = a.branch_id ${where}
      ORDER BY m.reported_at DESC LIMIT 1000`, values,
  );
  return res.json({ success: true, maintenance: rows, source: 'mysql' });
});

controllers.reportMaintenance = (req, res, next) => {
  if (!req.params?.assetId) req.params = { ...req.params, assetId: text(req.body?.assetId) };
  return controllers.markAssetDamaged(req, res, next);
};

controllers.resolveMaintenance = asyncHandler(async (req, res) => {
  const maintenanceId = text(req.body?.maintenanceId);
  const cost = text(req.body?.cost) === '' ? 0 : Number(req.body.cost);
  if (!maintenanceId || !Number.isFinite(cost) || cost < 0) throw dbError('Choose a maintenance ticket and enter a valid cost.');
  await mysqlPool.withTransaction(async connection => {
    const [rows] = await connection.execute('SELECT m.*, a.asset_code, a.status AS asset_status, a.id AS linked_asset_id, a.branch_id, b.name AS branch_name FROM asset_maintenance_tickets m LEFT JOIN assets a ON a.id = m.asset_id LEFT JOIN branches b ON b.id = a.branch_id WHERE m.ticket_code = ? LIMIT 1', [maintenanceId]);
    const ticket = rows[0];
    if (!ticket) throw dbError('Maintenance ticket not found.', 404);
    if (String(ticket.status).toLowerCase() === 'completed') throw dbError('This maintenance ticket is already completed.', 409);
    if (ticket.linked_asset_id && !canSeeAll(req)) {
      const visible = await visibleBranchIds(connection, req);
      if (!visible?.includes(ticket.branch_id)) throw dbError('This maintenance ticket is outside your assigned branches.', 403);
    }
    await connection.execute("UPDATE asset_maintenance_tickets SET status = 'completed', cost = ?, remarks = ?, resolved_at = UTC_TIMESTAMP() WHERE id = ?", [cost, text(req.body?.remarks) || null, ticket.id]);
    if (ticket.linked_asset_id) {
      await connection.execute("UPDATE assets SET status = 'available', asset_condition = 'GOOD', updated_by_name = ? WHERE id = ?", [text(req.portalUser?.name || req.portalUser?.email), ticket.linked_asset_id]);
      await logChange(connection, req, { id: ticket.linked_asset_id, asset_code: ticket.asset_code, branch_name: ticket.branch_name }, 'MAINTENANCE_COMPLETED', { status: ticket.asset_status }, { status: 'available', maintenanceId, cost }, text(req.body?.remarks));
    }
  });
  return res.json({ success: true, message: 'Maintenance ticket completed and the item restored.', source: 'mysql' });
});

controllers.getAssetDashboardStats = asyncHandler(async (req, res) => {
  const rows = await queryAssets(mysqlPool.getPool(), req);
  const units = row => String(row.tracking_mode || '').toLowerCase() === 'quantity' ? Number(row.quantity || 0) : 1;
  const countUnits = status => rows.filter(row => String(row.status).toLowerCase() === status).reduce((sum, row) => sum + units(row), 0);
  const totalUnits = rows.reduce((sum, row) => sum + units(row), 0);
  const branchIds = await visibleBranchIds(mysqlPool.getPool(), req);
  if (branchIds && !branchIds.length) return res.json({ success: true, stats: { totalAssets: 0, totalUnits: 0, available: 0, assigned: 0, underMaintenance: 0, archived: 0, openMaintenance: 0 }, source: 'mysql' });
  const maintenanceFilter = branchIds ? ` AND a.branch_id IN (${branchIds.map(() => '?').join(',')})` : '';
  const [openMaintenance] = await mysqlPool.query(`SELECT COUNT(*) AS count FROM asset_maintenance_tickets m JOIN assets a ON a.id = m.asset_id WHERE LOWER(m.status) IN ('open','in_progress','pending')${maintenanceFilter}`, branchIds || []);
  const byBranch = new Map();
  const byCategory = new Map();
  let totalValue = 0;
  for (const row of rows) {
    const amount = units(row);
    const branch = row.branch_name || 'Unknown';
    const category = row.category || 'Other';
    byBranch.set(branch, (byBranch.get(branch) || 0) + amount);
    byCategory.set(category, (byCategory.get(category) || 0) + amount);
    totalValue += Number(row.purchase_cost || 0);
  }
  const [recent] = await mysqlPool.query(`SELECT h.id, a.asset_code AS assetId, h.action, h.actor_name AS performedBy, h.branch_name AS branch, h.occurred_at AS timestamp FROM asset_history h JOIN assets a ON a.id = h.asset_id ${branchIds ? `WHERE a.branch_id IN (${branchIds.map(() => '?').join(',')})` : ''} ORDER BY h.occurred_at DESC LIMIT 8`, branchIds || []);
  const recentActivity = recent.map(item => ({ ...item, historyId: item.id }));
  const trend = Array.from({ length: 8 }, (_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (7 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return { key, month: date.toLocaleDateString('en-IN', { month: 'short' }), events: 0 };
  });
  const trendMap = new Map(trend.map(item => [item.key, item]));
  const [trendRows] = await mysqlPool.query(`SELECT DATE_FORMAT(h.occurred_at, '%Y-%m') AS month_key, COUNT(*) AS events FROM asset_history h JOIN assets a ON a.id = h.asset_id WHERE h.occurred_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 8 MONTH)${branchIds ? ` AND a.branch_id IN (${branchIds.map(() => '?').join(',')})` : ''} GROUP BY DATE_FORMAT(h.occurred_at, '%Y-%m')`, branchIds || []);
  for (const row of trendRows) if (trendMap.has(row.month_key)) trendMap.get(row.month_key).events = Number(row.events || 0);
  const inventoryWhere = branchIds ? `WHERE i.branch_id IN (${branchIds.map(() => '?').join(',')}) AND LOWER(i.status) = 'active'` : "WHERE LOWER(i.status) = 'active'";
  const [inventory] = await mysqlPool.query(`SELECT i.name, b.name AS branch, i.quantity, i.minimum_quantity FROM asset_inventory_items i LEFT JOIN branches b ON b.id = i.branch_id ${inventoryWhere} ORDER BY i.name LIMIT 100`, branchIds || []);
  const lowStock = inventory.filter(item => Number(item.quantity) <= Number(item.minimum_quantity)).map(item => ({ name: item.name, branch: item.branch || '', qty: Number(item.quantity), min: Number(item.minimum_quantity) }));
  const approvalWhere = branchIds ? `WHERE LOWER(decision) = 'pending' AND branch_id IN (${branchIds.map(() => '?').join(',')})` : "WHERE LOWER(decision) = 'pending'";
  const [approvals] = await mysqlPool.query(`SELECT COUNT(*) AS count FROM asset_approvals ${approvalWhere}`, branchIds || []);
  const stats = {
    totalAssets: totalUnits,
    totalValue,
    assigned: countUnits('assigned'),
    available: countUnits('available'),
    underMaintenance: countUnits('under_maintenance'),
    activeMaintenance: Number(openMaintenance[0]?.count || 0),
    pendingApprovals: Number(approvals[0]?.count || 0),
    branches: [...byBranch].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    categories: [...byCategory].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    lowStock,
    activityTrend: trend,
    recentActivity,
    updatedAt: new Date().toISOString(),
  };
  return res.json({ success: true, stats, source: 'mysql' });
});

controllers.addLocation = asyncHandler(async (req, res) => {
  const branchName = text(req.body?.branch || req.body?.branchName);
  const locationName = text(req.body?.locationName || req.body?.name || req.body?.room);
  if (!locationName) throw dbError('Enter a location name.');
  const created = await mysqlPool.withTransaction(async connection => {
    const branch = await findBranch(connection, branchName);
    const [existing] = await connection.execute('SELECT id FROM asset_locations WHERE branch_id = ? AND normalized_name = ? LIMIT 1', [branch.id, normalized(locationName)]);
    if (existing[0]) return { id: existing[0].id, name: locationName, branch: branch.name, created: false };
    const id = randomUUID();
    await connection.execute('INSERT INTO asset_locations (id, name, normalized_name, branch_id, metadata) VALUES (?, ?, ?, ?, ?)', [id, locationName, normalized(locationName), branch.id, JSON.stringify({ createdBy: text(req.portalUser?.name || req.portalUser?.email) })]);
    await connection.execute('INSERT INTO asset_history (id, action, actor_user_id, actor_name, branch_name, occurred_at, after_state, remarks, source) VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?, ?, ?)', [randomUUID(), 'ASSET_LOCATION_CREATED', await actorUserId(connection, req.portalUser || {}), text(req.portalUser?.name || req.portalUser?.email), branch.name, JSON.stringify({ locationId: id, locationName }), 'Location added to the asset register.', 'tpo_portal']);
    return { id, name: locationName, branch: branch.name, created: true };
  });
  return res.status(created.created ? 201 : 200).json({ success: true, location: created, message: created.created ? 'Location added.' : 'This location already exists for the branch.', source: 'mysql' });
});

function createClassificationHandler(kind, parentKind, nameField, parentField, fallbackType = 'ASSET') {
  return asyncHandler(async (req, res) => {
    const name = text(req.body?.[nameField] || req.body?.name);
    if (!name) throw dbError('Enter a classification name.');
    const id = randomUUID();
    const saved = await mysqlPool.withTransaction(async connection => {
      let parent = null;
      if (parentKind) {
        const parentId = text(req.body?.[parentField] || req.body?.categoryId || req.body?.subcategoryId);
        const parentName = text(req.body?.[parentField === 'categoryId' ? 'categoryName' : 'subcategoryName']);
        parent = await findClassification(connection, { id: parentId, name: parentName, kind: parentKind });
      }
      const [existing] = await connection.execute(
        `SELECT id, name FROM asset_classifications WHERE kind = ? AND IFNULL(parent_id, '') = IFNULL(?, '') AND LOWER(name) = LOWER(?) LIMIT 1`,
        [kind, parent?.id || null, name],
      );
      if (existing[0]) return { id: existing[0].id, name: existing[0].name, created: false };
      const classificationCode = `${kind.toUpperCase().replaceAll('_', '-')}-${id.slice(0, 8).toUpperCase()}`;
      await connection.execute('INSERT INTO asset_classifications (id, classification_code, kind, name, parent_id, type_class, status, source, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, classificationCode, kind, name, parent?.id || null, text(req.body?.type || fallbackType).toUpperCase(), 'active', 'tpo_portal', JSON.stringify({ createdBy: text(req.portalUser?.name || req.portalUser?.email) })]);
      return { id, name, created: true, parentId: parent?.id || '' };
    });
    return res.status(saved.created ? 201 : 200).json({ success: true, classification: saved, message: saved.created ? 'Classification added.' : 'That classification already exists.', source: 'mysql' });
  });
}

controllers.addCategory = createClassificationHandler('category', null, 'categoryName', '', 'ASSET');
controllers.addSubcategory = createClassificationHandler('subcategory', 'category', 'subcategoryName', 'categoryId', 'ASSET');
controllers.addAssetType = createClassificationHandler('asset_type', 'subcategory', 'assetTypeName', 'subcategoryId', 'ASSET');

async function lockAssetByCode(connection, req, assetCode) {
  const [rows] = await connection.execute('SELECT * FROM assets WHERE LOWER(asset_code) = LOWER(?) LIMIT 1 FOR UPDATE', [text(assetCode)]);
  const asset = rows[0];
  if (!asset) throw dbError('Asset not found.', 404);
  await assertBranchAccess(connection, req, asset.branch_id);
  const [[branch]] = asset.branch_id
    ? await connection.execute('SELECT name FROM branches WHERE id = ? LIMIT 1', [asset.branch_id])
    : [[null]];
  const [[location]] = asset.location_id
    ? await connection.execute('SELECT name FROM asset_locations WHERE id = ? LIMIT 1', [asset.location_id])
    : [[null]];
  return { ...asset, branch_name: branch?.name || '', location_name: location?.name || '' };
}

async function storeAssetPhoto(connection, req, asset, file, documentType) {
  if (!file) return '';
  const url = await uploadToDrive(file, process.env.ASSET_DRIVE_FOLDER_ID || process.env.DRIVE_FOLDER_ID || '');
  await connection.execute(
    `INSERT INTO asset_documents
      (id, document_code, asset_id, document_type, file_name, url, uploaded_by_user_id, uploaded_by_name, uploaded_at, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), 'tpo_portal')`,
    [randomUUID(), `DOC-${randomUUID().slice(0, 8).toUpperCase()}`, asset.id, documentType, text(file.originalname) || 'asset-photo', url,
      await actorUserId(connection, req.portalUser || {}), text(req.portalUser?.name || req.portalUser?.email)],
  );
  return url;
}

controllers.assignAsset = asyncHandler(async (req, res) => {
  const assetCode = text(req.body?.assetId);
  const employeeName = text(req.body?.employeeName);
  const employeeId = text(req.body?.employeeId);
  const issuePhoto = req.files?.photo?.[0] || req.file || null;
  const returnPhoto = req.files?.returnPhoto?.[0] || null;
  if (!assetCode || !employeeName) throw dbError('Asset and employee name are required.');
  const result = await mysqlPool.withTransaction(async connection => {
    const current = await lockAssetByCode(connection, req, assetCode);
    if (text(current.tracking_mode).toLowerCase() === 'quantity') throw dbError('This is a quantity group. Register individual pieces before assigning them to a person.', 409);
    const status = text(current.status).toLowerCase();
    const isReassignment = status === 'assigned';
    if (!['available', 'assigned'].includes(status)) throw dbError('Only available or currently assigned assets can be handed over.', 409);
    const [activeRows] = await connection.execute(
      `SELECT * FROM asset_assignments WHERE asset_id = ? AND LOWER(status) IN ('active', 'assigned')
       ORDER BY assigned_at DESC LIMIT 1 FOR UPDATE`, [current.id],
    );
    const active = activeRows[0];
    if (isReassignment && !active) throw dbError('No active employee assignment was found. Record the return before assigning this item again.', 409);
    if (isReassignment && !returnPhoto) throw dbError('Add a photo of the asset as it is returned from the current employee.');
    if (isReassignment && text(req.body?.conditionOnReturn).toUpperCase() === 'DAMAGED') throw dbError('This item is marked damaged. Record the return and send it to maintenance before reassigning.', 409);
    const issueCondition = text(req.body?.conditionOnIssue || current.asset_condition || 'GOOD').toUpperCase();
    if (['DAMAGED', 'UNDER_MAINTENANCE'].includes(issueCondition)) throw dbError('A damaged item cannot be assigned. Send it to maintenance first.', 409);
    const returnPhotoUrl = await storeAssetPhoto(connection, req, current, returnPhoto, 'PHOTO_RETURN');
    const issuePhotoUrl = await storeAssetPhoto(connection, req, current, issuePhoto, 'PHOTO_ISSUE');
    const actor = req.portalUser || {};
    const actorId = await actorUserId(connection, actor);
    const actorName = text(actor.name || actor.email);
    const assignedAt = new Date();
    const assignmentCode = `ASN-${randomUUID().slice(0, 12).toUpperCase()}`;
    if (active) {
      const returnedAt = assignedAt;
      const returnCondition = text(req.body?.conditionOnReturn || current.asset_condition || 'GOOD').toUpperCase();
      const returnRemarks = text(req.body?.returnRemarks);
      await connection.execute(
        `UPDATE asset_assignments SET returned_at = ?, condition_on_return = ?, status = 'returned',
         remarks = CONCAT(COALESCE(remarks, ''), ?) WHERE id = ?`,
        [returnedAt, returnCondition, returnRemarks ? ` | Return: ${returnRemarks}` : ' | Returned during reassignment', active.id],
      );
      if (returnPhotoUrl) await connection.execute(
        `UPDATE asset_documents SET metadata = JSON_SET(COALESCE(metadata, JSON_OBJECT()), '$.assignmentCode', ?)
         WHERE asset_id = ? AND url = ?`, [active.assignment_code, current.id, returnPhotoUrl],
      );
    }
    await connection.execute(
      `UPDATE assets SET status = 'assigned', asset_condition = ?, updated_by_name = ? WHERE id = ?`,
      [issueCondition, actorName, current.id],
    );
    await connection.execute(
      `INSERT INTO asset_assignments
        (id, assignment_code, asset_id, employee_id, employee_name, branch_id, assigned_by_user_id, assigned_at,
         condition_on_issue, status, remarks, source, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'assigned', ?, 'tpo_portal', ?)`,
      [randomUUID(), assignmentCode, current.id, employeeId || null, employeeName, current.branch_id, actorId, assignedAt,
        issueCondition, text(req.body?.remarks) || null,
        JSON.stringify({ accessories: text(req.body?.accessories), issuePhotoUrl, source: 'asset_assignment' })],
    );
    await logChange(connection, req, current, isReassignment ? 'ASSET_REASSIGNED' : 'ASSET_ASSIGNED',
      { status, employeeName: active?.employee_name || '' }, { status: 'assigned', employeeName, employeeId, assignmentCode, condition: issueCondition }, text(req.body?.remarks || req.body?.accessories));
    return { assetId: current.asset_code, assignmentId: assignmentCode, employeeName, isReassignment };
  });
  return res.json({ success: true, ...result, message: `Asset successfully ${result.isReassignment ? 'reassigned' : 'assigned'} to ${result.employeeName}.`, source: 'mysql' });
});

controllers.returnAsset = asyncHandler(async (req, res) => {
  const assetCode = text(req.body?.assetId);
  const condition = text(req.body?.conditionOnReturn || 'GOOD').toUpperCase();
  const requestedStatus = text(req.body?.returnStatus || 'AVAILABLE').toUpperCase();
  if (!assetCode) throw dbError('Choose the asset being returned.');
  if (!req.file) throw dbError('Upload a photo showing the item condition at return.');
  if (!['GOOD', 'NEW', 'FAIR', 'DAMAGED'].includes(condition)) throw dbError('Choose a valid item condition.');
  if (!['AVAILABLE', 'UNDER_MAINTENANCE'].includes(requestedStatus)) throw dbError('Choose Available or Under Maintenance for the returned item.');
  if (condition === 'DAMAGED' && requestedStatus === 'AVAILABLE') throw dbError('A damaged item must be sent to maintenance when it is returned.');
  const result = await mysqlPool.withTransaction(async connection => {
    const current = await lockAssetByCode(connection, req, assetCode);
    if (text(current.status).toLowerCase() !== 'assigned') throw dbError('This asset does not have an active assignment to return.', 409);
    const [assignments] = await connection.execute(
      `SELECT * FROM asset_assignments WHERE asset_id = ? AND LOWER(status) IN ('active', 'assigned')
       ORDER BY assigned_at DESC LIMIT 1 FOR UPDATE`, [current.id],
    );
    const active = assignments[0];
    if (!active) throw dbError('No active assignment was found for this asset.', 409);
    const photoUrl = await storeAssetPhoto(connection, req, current, req.file, 'PHOTO_RETURN');
    const actor = req.portalUser || {};
    const actorId = await actorUserId(connection, actor);
    const actorName = text(actor.name || actor.email);
    const now = new Date();
    const status = condition === 'DAMAGED' ? 'under_maintenance' : requestedStatus.toLowerCase();
    const remarks = text(req.body?.remarks);
    await connection.execute(
      `UPDATE asset_assignments SET returned_at = ?, condition_on_return = ?, status = 'returned',
       remarks = CONCAT(COALESCE(remarks, ''), ?) WHERE id = ?`,
      [now, condition, remarks ? ` | Return: ${remarks}` : '', active.id],
    );
    await connection.execute('UPDATE assets SET status = ?, asset_condition = ?, updated_by_name = ? WHERE id = ?', [status, condition, actorName, current.id]);
    let maintenanceId = '';
    if (status === 'under_maintenance') {
      maintenanceId = `MNT-${randomUUID().slice(0, 8).toUpperCase()}`;
      const issue = remarks || (condition === 'DAMAGED' ? 'Item was returned in damaged condition.' : 'Item was returned for maintenance.');
      await connection.execute(
        `INSERT INTO asset_maintenance_tickets
          (id, ticket_code, asset_id, issue, status, reported_by_user_id, reported_by_name, reported_at, previous_status, remarks, source)
         VALUES (?, ?, ?, ?, 'open', ?, ?, UTC_TIMESTAMP(), 'assigned', ?, 'tpo_portal')`,
        [randomUUID(), maintenanceId, current.id, issue, actorId, actorName, remarks || null],
      );
    }
    await logChange(connection, req, current, 'ASSET_RETURNED', { status: 'assigned', employeeName: active.employee_name },
      { status, condition, maintenanceId, photoUrl }, remarks);
    return { assetId: current.asset_code, returnStatus: status.toUpperCase(), maintenanceId };
  });
  return res.json({ success: true, ...result, message: result.maintenanceId ? 'Asset returned, marked damaged, and sent to maintenance.' : 'Asset successfully returned and logged.', source: 'mysql' });
});

controllers.getInventory = asyncHandler(async (req, res) => {
  const branchIds = await visibleBranchIds(mysqlPool.getPool(), req);
  if (branchIds && !branchIds.length) return res.json({ success: true, inventory: [], source: 'mysql' });
  const where = branchIds ? `WHERE i.branch_id IN (${branchIds.map(() => '?').join(',')})` : '';
  const [rows] = await mysqlPool.query(
    `SELECT i.*, b.name AS branch_name FROM asset_inventory_items i LEFT JOIN branches b ON b.id = i.branch_id ${where}
     ORDER BY i.updated_at DESC, i.name`, branchIds || [],
  );
  const inventory = rows.map(row => {
    const metadata = parseJson(row.metadata);
    const fields = parseJson(metadata.fields, {});
    const quantity = Number(row.quantity || 0);
    const minimum = Number(row.minimum_quantity || 0);
    return {
      itemId: row.item_code, name: row.name, categoryId: metadata.categoryId || fields.Category_ID || '', category: row.category || '',
      subcategoryId: metadata.subcategoryId || fields.Subcategory_ID || '', subcategory: row.subcategory || '',
      assetTypeId: metadata.assetTypeId || fields.Asset_Type_ID || '', assetType: row.asset_type || '', branch: row.branch_name || metadata.branchName || '',
      quantity, minQuantity: minimum, status: quantity <= 0 ? 'OUT OF STOCK' : quantity <= minimum ? 'LOW STOCK' : 'IN STOCK',
    };
  });
  return res.json({ success: true, inventory, source: 'mysql' });
});

async function resolveInventoryClassification(connection, item) {
  const category = await findClassification(connection, { id: text(item.categoryId), name: item.category, kind: 'category' });
  const subcategory = await findClassification(connection, { id: text(item.subcategoryId), name: item.subcategory, kind: 'subcategory', parentId: category.id });
  const type = await findClassification(connection, { id: text(item.assetTypeId), name: item.assetType, kind: 'asset_type', parentId: subcategory.id });
  if (!/consum/i.test(type.type_class || '')) throw dbError('This item type is a trackable asset. Register it using the asset option.');
  return { category, subcategory, type };
}

controllers.addInventory = asyncHandler(async (req, res) => {
  const item = req.body?.item || {};
  const quantity = Number(item.quantity);
  const minimum = Number(item.minQuantity);
  if (!text(item.name) || !text(item.category) || !text(item.subcategory) || !text(item.assetType) || !text(item.branch)
    || !Number.isSafeInteger(quantity) || quantity < 0 || !Number.isSafeInteger(minimum) || minimum < 0) {
    throw dbError('Item name, category, subcategory, item type, branch, whole-number quantity, and minimum quantity are required.');
  }
  const result = await mysqlPool.withTransaction(async connection => {
    const branch = await findBranch(connection, item.branch);
    await assertBranchAccess(connection, req, branch.id);
    const refs = await resolveInventoryClassification(connection, item);
    const code = `INV-${new Date().getFullYear()}-${randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()}`;
    const id = randomUUID();
    const metadata = { categoryId: refs.category.id, subcategoryId: refs.subcategory.id, assetTypeId: refs.type.id, branchName: branch.name, createdBy: text(req.portalUser?.name || req.portalUser?.email), source: 'mysql_inventory' };
    await connection.execute(
      `INSERT INTO asset_inventory_items
        (id, item_code, name, category, subcategory, asset_type, branch_id, quantity, minimum_quantity, unit, status, source, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 'tpo_portal', ?)`,
      [id, code, text(item.name), refs.category.name, refs.subcategory.name, refs.type.name, branch.id, quantity, minimum, text(item.unit) || null, JSON.stringify(metadata)],
    );
    await connection.execute(
      `INSERT INTO asset_inventory_transactions
        (id, transaction_code, inventory_item_id, transaction_type, quantity, previous_quantity, new_quantity, actor_user_id, actor_name, occurred_at, source, metadata)
       VALUES (?, ?, ?, 'INITIAL_STOCK', ?, 0, ?, ?, ?, UTC_TIMESTAMP(), 'tpo_portal', ?)`,
      [randomUUID(), `TX-${randomUUID().slice(0, 12).toUpperCase()}`, id, quantity, quantity, await actorUserId(connection, req.portalUser || {}), text(req.portalUser?.name || req.portalUser?.email), JSON.stringify({ itemCode: code })],
    );
    return { itemId: code, quantity, status: quantity <= 0 ? 'OUT OF STOCK' : quantity <= minimum ? 'LOW STOCK' : 'IN STOCK' };
  });
  return res.status(201).json({ success: true, ...result, message: 'Item added to MySQL inventory.', source: 'mysql' });
});

controllers.updateStock = asyncHandler(async (req, res) => {
  const itemCode = text(req.body?.itemId);
  const action = text(req.body?.action).toUpperCase();
  const change = Number(req.body?.quantity);
  if (!itemCode || !['IN', 'OUT'].includes(action) || !Number.isSafeInteger(change) || change <= 0) throw dbError('Choose stock in/out and enter a positive whole-number quantity.');
  const result = await mysqlPool.withTransaction(async connection => {
    const [rows] = await connection.execute('SELECT * FROM asset_inventory_items WHERE LOWER(item_code) = LOWER(?) LIMIT 1 FOR UPDATE', [itemCode]);
    const item = rows[0];
    if (!item) throw dbError('Inventory item not found.', 404);
    await assertBranchAccess(connection, req, item.branch_id);
    const [branchRows] = item.branch_id ? await connection.execute('SELECT name FROM branches WHERE id = ? LIMIT 1', [item.branch_id]) : [[]];
    item.branch_name = branchRows[0]?.name || '';
    const previous = Number(item.quantity || 0);
    const next = action === 'IN' ? previous + change : previous - change;
    if (next < 0) throw dbError('Stock cannot be negative.');
    const minimum = Number(item.minimum_quantity || 0);
    await connection.execute('UPDATE asset_inventory_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [next, item.id]);
    await connection.execute(
      `INSERT INTO asset_inventory_transactions
        (id, transaction_code, inventory_item_id, transaction_type, quantity, previous_quantity, new_quantity, actor_user_id, actor_name, occurred_at, source, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), 'tpo_portal', ?)`,
      [randomUUID(), `TX-${randomUUID().slice(0, 12).toUpperCase()}`, item.id, action === 'IN' ? 'STOCK_IN' : 'STOCK_OUT', change, previous, next,
        await actorUserId(connection, req.portalUser || {}), text(req.portalUser?.name || req.portalUser?.email), JSON.stringify({ itemCode: item.item_code })],
    );
    return { itemId: item.item_code, previousQuantity: previous, quantity: next, minQuantity: minimum, status: next <= 0 ? 'OUT OF STOCK' : next <= minimum ? 'LOW STOCK' : 'IN STOCK' };
  });
  return res.json({ success: true, ...result, message: `Stock successfully updated. New quantity: ${result.quantity}`, source: 'mysql' });
});

function isAssetApprover(req) {
  return text(req.portalUser?.email).toLowerCase() === 'rakesh@ipcsglobal.com';
}

async function createAssetApproval(connection, { requestCode, requestType, asset, req, reason, payload }) {
  const actor = req.portalUser || {};
  await connection.execute(
    `INSERT INTO asset_approvals
      (id, request_code, request_type, asset_id, branch_id, requested_by_user_id, requested_by_name, requested_by_email,
       requested_at, decision, reason, source, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), 'pending', ?, 'tpo_portal', ?)`,
    [randomUUID(), requestCode, requestType, asset?.id || null, asset?.branch_id || null, await actorUserId(connection, actor),
      text(actor.name || actor.email), text(actor.email).toLowerCase(), text(reason) || null, JSON.stringify(payload || {})],
  );
}

controllers.getTransfers = asyncHandler(async (req, res) => {
  const [rows] = await mysqlPool.query(
    `SELECT t.transfer_code, t.asset_id, t.from_branch_id, t.to_branch_id, a.asset_code, a.name AS asset_name,
            fb.name AS from_branch, tb.name AS to_branch, t.requested_at, t.approved_at, t.received_at,
            t.status, t.remarks, t.metadata
       FROM asset_transfers t LEFT JOIN assets a ON a.id = t.asset_id
       LEFT JOIN branches fb ON fb.id = t.from_branch_id LEFT JOIN branches tb ON tb.id = t.to_branch_id
      ORDER BY t.requested_at DESC LIMIT 1000`,
  );
  const visible = await visibleBranchIds(mysqlPool.getPool(), req);
  const transfers = rows.filter(row => !visible || visible.includes(row.from_branch_id) || visible.includes(row.to_branch_id)
    || visible.some(id => normalized(id) === normalized(row.from_branch) || normalized(id) === normalized(row.to_branch)))
    .map(row => {
      const metadata = parseJson(row.metadata);
      return {
        transferId: row.transfer_code, assetId: row.asset_code || '', assetName: row.asset_name || '',
        fromBranch: row.from_branch || '', toBranch: row.to_branch || '', requestedBy: metadata.requestedBy || '',
        approvedBy: metadata.approvedBy || '', receivedBy: metadata.receivedBy || '', status: text(row.status).toUpperCase(),
        date: row.requested_at, dispatchedAt: row.approved_at, receivedAt: row.received_at, remarks: row.remarks || '',
      };
    });
  return res.json({ success: true, transfers, source: 'mysql' });
});

controllers.requestTransfer = asyncHandler(async (req, res) => {
  const assetCode = text(req.body?.assetId);
  const destinationName = text(req.body?.toBranch);
  if (!assetCode || !destinationName) throw dbError('Asset and destination branch are required.');
  const result = await mysqlPool.withTransaction(async connection => {
    const asset = await lockAssetByCode(connection, req, assetCode);
    const destination = await findBranch(connection, destinationName);
    if (asset.branch_id === destination.id) throw dbError('Choose a different destination branch.');
    if (text(asset.status).toLowerCase() !== 'available') throw dbError('Only available assets can be transferred. Return or resolve the asset first.', 409);
    const [active] = await connection.execute(
      `SELECT id FROM asset_transfers WHERE asset_id = ? AND LOWER(status) IN ('pending', 'in_transit') LIMIT 1 FOR UPDATE`, [asset.id],
    );
    if (active[0]) throw dbError('This asset already has an open transfer.', 409);
    const transferCode = `TRF-${randomUUID().slice(0, 12).toUpperCase()}`;
    const actor = req.portalUser || {};
    const actorId = await actorUserId(connection, actor);
    const remarks = text(req.body?.remarks);
    await connection.execute(
      `INSERT INTO asset_transfers
        (id, transfer_code, asset_id, from_branch_id, to_branch_id, requested_by_user_id, requested_at, status, remarks, source, metadata)
       VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), 'pending', ?, 'tpo_portal', ?)`,
      [randomUUID(), transferCode, asset.id, asset.branch_id, destination.id, actorId, remarks || null,
        JSON.stringify({ requestedBy: text(actor.name || actor.email), requestedByEmail: text(actor.email).toLowerCase() })],
    );
    await createAssetApproval(connection, { requestCode: transferCode, requestType: 'TRANSFER', asset, req, reason: remarks, payload: { toBranch: destination.name } });
    await connection.execute("UPDATE assets SET status = 'transfer_pending', updated_by_name = ? WHERE id = ?", [text(actor.name || actor.email), asset.id]);
    await logChange(connection, req, asset, 'TRANSFER_REQUESTED', { status: 'available', branch: asset.branch_name },
      { status: 'transfer_pending', destination: destination.name, transferId: transferCode }, remarks);
    return { transferId: transferCode, fromBranch: asset.branch_name, toBranch: destination.name };
  });
  return res.status(201).json({ success: true, ...result, message: 'Transfer request submitted for approval.', source: 'mysql' });
});

controllers.approveTransfer = asyncHandler(async (req, res) => {
  if (!isAssetApprover(req)) throw dbError('Only Rakesh can approve asset transfers.', 403);
  const transferCode = text(req.body?.transferId);
  if (!transferCode) throw dbError('Transfer ID is required.');
  await mysqlPool.withTransaction(async connection => {
    const [rows] = await connection.execute('SELECT * FROM asset_transfers WHERE LOWER(transfer_code) = LOWER(?) LIMIT 1 FOR UPDATE', [transferCode]);
    const transfer = rows[0];
    if (!transfer) throw dbError('Transfer request not found.', 404);
    if (text(transfer.status).toLowerCase() !== 'pending') throw dbError('Only pending transfer requests can be approved.', 409);
    const [assetRows] = await connection.execute('SELECT * FROM assets WHERE id = ? LIMIT 1 FOR UPDATE', [transfer.asset_id]);
    const asset = assetRows[0];
    if (!asset) throw dbError('Transfer asset no longer exists.', 404);
    if (text(asset.status).toLowerCase() !== 'transfer_pending') throw dbError('Asset is no longer awaiting transfer.', 409);
    const actor = req.portalUser || {};
    const actorId = await actorUserId(connection, actor);
    await connection.execute("UPDATE asset_transfers SET status = 'in_transit', approved_by_user_id = ?, approved_at = UTC_TIMESTAMP(), metadata = JSON_SET(COALESCE(metadata, JSON_OBJECT()), '$.approvedBy', ?) WHERE id = ?", [actorId, text(actor.name || actor.email), transfer.id]);
    await connection.execute("UPDATE asset_approvals SET decision = 'approved', decided_by_user_id = ?, decided_by_name = ?, decided_at = UTC_TIMESTAMP() WHERE request_code = ? AND LOWER(decision) = 'pending'", [actorId, text(actor.name || actor.email), transfer.transfer_code]);
    const [branchRows] = await connection.execute('SELECT id, name FROM branches WHERE id IN (?, ?)', [transfer.from_branch_id, transfer.to_branch_id]);
    const fromName = branchRows.find(item => item.id === transfer.from_branch_id)?.name || '';
    const toName = branchRows.find(item => item.id === transfer.to_branch_id)?.name || '';
    await logChange(connection, req, { ...asset, branch_name: fromName }, 'TRANSFER_DISPATCHED', { status: 'transfer_pending' }, { status: 'in_transit', destination: toName, transferId: transfer.transfer_code }, `Transfer ${transfer.transfer_code} approved; awaiting destination receipt.`);
  });
  return res.json({ success: true, message: 'Transfer dispatched. The destination branch must confirm receipt.', source: 'mysql' });
});

controllers.rejectTransfer = asyncHandler(async (req, res) => {
  if (!isAssetApprover(req)) throw dbError('Only Rakesh can reject asset transfers.', 403);
  const transferCode = text(req.body?.transferId);
  const reason = text(req.body?.reason);
  if (!transferCode || !reason) throw dbError('Transfer ID and rejection reason are required.');
  await mysqlPool.withTransaction(async connection => {
    const [rows] = await connection.execute('SELECT * FROM asset_transfers WHERE LOWER(transfer_code) = LOWER(?) LIMIT 1 FOR UPDATE', [transferCode]);
    const transfer = rows[0];
    if (!transfer) throw dbError('Transfer request not found.', 404);
    if (text(transfer.status).toLowerCase() !== 'pending') throw dbError('Only pending transfer requests can be rejected.', 409);
    const [assetRows] = await connection.execute('SELECT * FROM assets WHERE id = ? LIMIT 1 FOR UPDATE', [transfer.asset_id]);
    const asset = assetRows[0];
    if (!asset) throw dbError('Transfer asset no longer exists.', 404);
    if (text(asset.status).toLowerCase() !== 'transfer_pending') throw dbError('Asset is no longer awaiting transfer.', 409);
    const actor = req.portalUser || {};
    const actorId = await actorUserId(connection, actor);
    await connection.execute("UPDATE asset_transfers SET status = 'rejected', remarks = CONCAT(COALESCE(remarks, ''), ?), metadata = JSON_SET(COALESCE(metadata, JSON_OBJECT()), '$.rejectionReason', ?, '$.rejectedBy', ?) WHERE id = ?", [` | Rejected: ${reason}`, reason, text(actor.name || actor.email), transfer.id]);
    await connection.execute("UPDATE assets SET status = 'available', updated_by_name = ? WHERE id = ?", [text(actor.name || actor.email), asset.id]);
    await connection.execute("UPDATE asset_approvals SET decision = 'rejected', decided_by_user_id = ?, decided_by_name = ?, decided_at = UTC_TIMESTAMP(), reason = ? WHERE request_code = ? AND LOWER(decision) = 'pending'", [actorId, text(actor.name || actor.email), reason, transfer.transfer_code]);
    const [branches] = await connection.execute('SELECT name FROM branches WHERE id = ? LIMIT 1', [transfer.from_branch_id]);
    await logChange(connection, req, { ...asset, branch_name: branches[0]?.name || '' }, 'TRANSFER_REJECTED', { status: 'transfer_pending' }, { status: 'available', transferId: transfer.transfer_code, reason }, reason);
  });
  return res.json({ success: true, message: 'Transfer request rejected and the asset is available again.', source: 'mysql' });
});

controllers.receiveTransfer = asyncHandler(async (req, res) => {
  const transferCode = text(req.body?.transferId);
  if (!transferCode) throw dbError('Transfer ID is required.');
  const result = await mysqlPool.withTransaction(async connection => {
    const [rows] = await connection.execute('SELECT * FROM asset_transfers WHERE LOWER(transfer_code) = LOWER(?) LIMIT 1 FOR UPDATE', [transferCode]);
    const transfer = rows[0];
    if (!transfer) throw dbError('Transfer request not found.', 404);
    if (text(transfer.status).toLowerCase() !== 'in_transit') throw dbError('Only dispatched transfers can be received.', 409);
    await assertBranchAccess(connection, req, transfer.to_branch_id);
    const [assetRows] = await connection.execute('SELECT * FROM assets WHERE id = ? LIMIT 1 FOR UPDATE', [transfer.asset_id]);
    const asset = assetRows[0];
    if (!asset) throw dbError('Transfer asset not found.', 404);
    if (text(asset.status).toLowerCase() !== 'transfer_pending') throw dbError('Asset is no longer in transfer.', 409);
    const condition = text(req.body?.condition || 'GOOD').toUpperCase();
    if (!['NEW', 'GOOD', 'FAIR', 'DAMAGED'].includes(condition)) throw dbError('Choose a valid item condition.');
    const [branches] = await connection.execute('SELECT id, name FROM branches WHERE id IN (?, ?)', [transfer.from_branch_id, transfer.to_branch_id]);
    const fromName = branches.find(item => item.id === transfer.from_branch_id)?.name || '';
    const toName = branches.find(item => item.id === transfer.to_branch_id)?.name || '';
    const [oldLocations] = asset.location_id ? await connection.execute('SELECT normalized_name FROM asset_locations WHERE id = ? LIMIT 1', [asset.location_id]) : [[]];
    const [locations] = oldLocations[0]?.normalized_name
      ? await connection.execute('SELECT id FROM asset_locations WHERE branch_id = ? AND normalized_name = ? LIMIT 1', [transfer.to_branch_id, oldLocations[0].normalized_name])
      : [[]];
    const nextLocationId = locations[0]?.id || null;
    const actor = req.portalUser || {};
    const actorId = await actorUserId(connection, actor);
    const status = condition === 'DAMAGED' ? 'under_maintenance' : 'available';
    await connection.execute('UPDATE assets SET branch_id = ?, location_id = ?, status = ?, asset_condition = ?, updated_by_name = ? WHERE id = ?', [transfer.to_branch_id, nextLocationId, status, condition, text(actor.name || actor.email), asset.id]);
    await connection.execute("UPDATE asset_transfers SET status = 'completed', received_by_user_id = ?, received_at = UTC_TIMESTAMP(), remarks = CONCAT(COALESCE(remarks, ''), ?) WHERE id = ?", [actorId, text(req.body?.remarks) ? ` | Receipt: ${text(req.body.remarks)}` : '', transfer.id]);
    let maintenanceId = '';
    if (status === 'under_maintenance') {
      maintenanceId = `MNT-${randomUUID().slice(0, 8).toUpperCase()}`;
      await connection.execute("INSERT INTO asset_maintenance_tickets (id, ticket_code, asset_id, issue, status, reported_by_user_id, reported_by_name, reported_at, previous_status, remarks, source) VALUES (?, ?, ?, ?, 'open', ?, ?, UTC_TIMESTAMP(), 'transfer_pending', ?, 'tpo_portal')", [randomUUID(), maintenanceId, asset.id, text(req.body?.remarks) || 'Asset arrived damaged during transfer.', actorId, text(actor.name || actor.email), text(req.body?.remarks) || null]);
    }
    await logChange(connection, req, { ...asset, branch_name: toName }, 'TRANSFER_RECEIVED', { status: 'in_transit', branch: fromName }, { status, branch: toName, transferId: transfer.transfer_code, condition, maintenanceId }, text(req.body?.remarks));
    await connection.execute("UPDATE asset_transfers SET metadata = JSON_SET(COALESCE(metadata, JSON_OBJECT()), '$.receivedBy', ?) WHERE id = ?", [text(actor.name || actor.email), transfer.id]);
    return { transferId: transfer.transfer_code, branch: toName, status: status.toUpperCase(), maintenanceId };
  });
  return res.json({ success: true, ...result, message: result.maintenanceId ? 'Receipt confirmed; the damaged item was sent to maintenance.' : 'Receipt confirmed and asset branch updated.', source: 'mysql' });
});

controllers.getAssetApprovals = asyncHandler(async (req, res) => {
  if (!isAssetApprover(req)) throw dbError('This approval desk is available only to Rakesh.', 403);
  const [rows] = await mysqlPool.query(
    `SELECT ap.request_code, ap.request_type, ap.requested_by_name, ap.requested_by_email, ap.requested_at,
            ap.decision, ap.decided_by_name, ap.decided_at, ap.reason, ap.payload,
            a.asset_code, a.name AS asset_name, b.name AS branch_name
       FROM asset_approvals ap LEFT JOIN assets a ON a.id = ap.asset_id LEFT JOIN branches b ON b.id = ap.branch_id
      ORDER BY ap.requested_at DESC LIMIT 1000`,
  );
  const requests = rows.map(row => ({
    requestId: row.request_code, requestType: text(row.request_type).toUpperCase(), assetId: row.asset_code || '',
    assetName: row.asset_name || '', branch: row.branch_name || '', requestedBy: row.requested_by_name || '',
    requestedByEmail: row.requested_by_email || '', requestedAt: row.requested_at, decision: text(row.decision).toUpperCase(),
    decidedBy: row.decided_by_name || '', decidedAt: row.decided_at, reason: row.reason || '', payload: parseJson(row.payload),
  }));
  return res.json({ success: true, requests, pendingCount: requests.filter(item => item.decision === 'PENDING').length, source: 'mysql' });
});

controllers.decideAssetApproval = asyncHandler(async (req, res) => {
  if (!isAssetApprover(req)) throw dbError('Only Rakesh can decide asset approval requests.', 403);
  const requestCode = text(req.params?.requestId);
  const decision = text(req.body?.decision).toLowerCase();
  const reason = text(req.body?.reason);
  if (!requestCode || !['approved', 'rejected'].includes(decision)) throw dbError('Choose approve or reject for this request.');
  if (decision === 'rejected' && !reason) throw dbError('Add a reason when rejecting a request.');
  await mysqlPool.withTransaction(async connection => {
    const [approvals] = await connection.execute('SELECT * FROM asset_approvals WHERE LOWER(request_code) = LOWER(?) LIMIT 1 FOR UPDATE', [requestCode]);
    const approval = approvals[0];
    if (!approval) throw dbError('Approval request was not found.', 404);
    if (text(approval.request_type).toUpperCase() !== 'DELETE_ASSET') throw dbError('Use the transfer approval action for transfer requests.');
    if (text(approval.decision).toLowerCase() !== 'pending') throw dbError('This request has already been reviewed.', 409);
    const [assets] = await connection.execute('SELECT * FROM assets WHERE id = ? LIMIT 1 FOR UPDATE', [approval.asset_id]);
    const asset = assets[0];
    if (!asset) throw dbError('The asset is no longer in the register.', 404);
    const actor = req.portalUser || {};
    const actorId = await actorUserId(connection, actor);
    const payload = parseJson(approval.payload);
    if (decision === 'approved') {
      if (!['available', 'disposed'].includes(text(asset.status).toLowerCase())) throw dbError('The asset is no longer available. Resolve its assignment or transfer before retiring it.', 409);
      const [tickets] = await connection.execute("SELECT id FROM asset_maintenance_tickets WHERE asset_id = ? AND LOWER(status) IN ('open','in_progress','pending') LIMIT 1", [asset.id]);
      if (tickets[0]) throw dbError('Resolve the open maintenance ticket before disposal.', 409);
      await connection.execute(
        `INSERT INTO asset_disposals (id, disposal_code, asset_id, reason, method, value, requested_by_user_id, approved_by_user_id, disposed_at, remarks, source, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), ?, 'tpo_portal', ?)`,
        [randomUUID(), `DSP-${requestCode.replace(/[^a-z0-9-]/gi, '')}`, asset.id, text(payload.reason || approval.reason), text(payload.method), Number(payload.value || 0), approval.requested_by_user_id, actorId, [text(payload.remarks), `Approval ${requestCode}`].filter(Boolean).join(' · '), JSON.stringify({ requestedBy: approval.requested_by_name })],
      );
      await connection.execute("UPDATE assets SET status = 'disposed', updated_by_name = ? WHERE id = ?", [text(actor.name || actor.email), asset.id]);
    }
    await connection.execute('UPDATE asset_approvals SET decision = ?, decided_by_user_id = ?, decided_by_name = ?, decided_at = UTC_TIMESTAMP(), reason = ? WHERE id = ?', [decision, actorId, text(actor.name || actor.email), decision === 'rejected' ? reason : approval.reason, approval.id]);
    const [branches] = await connection.execute('SELECT name FROM branches WHERE id = ? LIMIT 1', [approval.branch_id]);
    await logChange(connection, req, { ...asset, branch_name: branches[0]?.name || '' }, decision === 'approved' ? 'ASSET_DISPOSED' : 'ASSET_DISPOSAL_REJECTED',
      { status: asset.status }, { status: decision === 'approved' ? 'disposed' : asset.status, requestCode, reason: decision === 'rejected' ? reason : approval.reason }, reason || text(approval.reason));
  });
  return res.json({ success: true, message: decision === 'approved' ? 'Asset disposal approved and recorded.' : 'Asset disposal request rejected.', source: 'mysql' });
});

controllers.disposeAsset = asyncHandler(async (req, res) => {
  const assetCode = text(req.body?.assetId);
  const reason = text(req.body?.reason);
  const method = text(req.body?.method);
  const value = req.body?.value === '' || req.body?.value == null ? 0 : Number(req.body.value);
  if (!assetCode || !reason || !method || !Number.isFinite(value) || value < 0) throw dbError('Asset, disposal reason, method, and a non-negative value are required.');
  const result = await mysqlPool.withTransaction(async connection => {
    const asset = await lockAssetByCode(connection, req, assetCode);
    if (text(asset.status).toLowerCase() !== 'available') throw dbError('Only available assets can be submitted for retirement. Return the item or complete maintenance and transfers first.', 409);
    const [tickets] = await connection.execute("SELECT id FROM asset_maintenance_tickets WHERE asset_id = ? AND LOWER(status) IN ('open','in_progress','pending') LIMIT 1", [asset.id]);
    if (tickets[0]) throw dbError('Resolve the open maintenance ticket before disposal.', 409);
    const [existing] = await connection.execute("SELECT id FROM asset_approvals WHERE asset_id = ? AND request_type = 'DELETE_ASSET' AND LOWER(decision) = 'pending' LIMIT 1 FOR UPDATE", [asset.id]);
    if (existing[0]) throw dbError('A retirement request for this item is already waiting for approval.', 409);
    const requestCode = `DEL-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
    const payload = { reason, method, value, remarks: text(req.body?.remarks) };
    await createAssetApproval(connection, { requestCode, requestType: 'DELETE_ASSET', asset, req, reason, payload });
    await logChange(connection, req, asset, 'ASSET_RETIREMENT_REQUESTED', { status: asset.status }, { status: asset.status, requestCode, reason }, reason);
    return { requestId: requestCode };
  });
  return res.status(201).json({ success: true, ...result, message: 'Retirement request sent for approval. The item remains in the register until it is approved.', source: 'mysql' });
});

controllers.addVendor = asyncHandler(async (req, res) => {
  const name = text(req.body?.vendorName || req.body?.name);
  if (!name) throw dbError('Enter a vendor name.');
  const vendor = await mysqlPool.withTransaction(async connection => {
    const [existing] = await connection.execute('SELECT id, vendor_code, name FROM asset_vendors WHERE LOWER(name) = LOWER(?) LIMIT 1', [name]);
    if (existing[0]) return { ...existing[0], created: false };
    const id = randomUUID();
    const code = `VND-${randomUUID().slice(0, 10).toUpperCase()}`;
    await connection.execute(
      `INSERT INTO asset_vendors (id, vendor_code, name, contact_person, phone, email, status, source, metadata)
       VALUES (?, ?, ?, ?, ?, ?, 'active', 'tpo_portal', ?)`,
      [id, code, name, text(req.body?.contactPerson) || null, text(req.body?.phone) || null,
        text(req.body?.email).toLowerCase() || null, JSON.stringify({ createdBy: text(req.portalUser?.name || req.portalUser?.email) })],
    );
    return { id, vendor_code: code, name, created: true };
  });
  return res.status(vendor.created ? 201 : 200).json({ success: true, vendor, message: vendor.created ? `Vendor “${name}” added.` : `Vendor “${name}” already exists.`, source: 'mysql' });
});

controllers.uploadAssetDocument = asyncHandler(async (req, res) => {
  const assetCode = text(req.body?.assetId);
  if (!req.file) throw dbError('Choose a file to upload.');
  if (!assetCode) throw dbError('Choose an asset for this document.');
  const result = await mysqlPool.withTransaction(async connection => {
    const asset = await lockAssetByCode(connection, req, assetCode);
    const documentType = text(req.body?.documentType || 'DOCUMENT').slice(0, 80).toUpperCase();
    const url = await storeAssetPhoto(connection, req, asset, req.file, documentType);
    return { url, assetId: asset.asset_code, documentType };
  });
  return res.status(201).json({ success: true, ...result, message: 'File uploaded and recorded in MySQL.', source: 'mysql' });
});

controllers.getAssetNotifications = asyncHandler(async (req, res) => {
  const branchIds = await visibleBranchIds(mysqlPool.getPool(), req);
  if (branchIds && !branchIds.length) return res.json({ success: true, notifications: [], source: 'mysql' });
  const clauses = [];
  const values = [];
  if (!isPortalAdmin(req.portalUser || {})) {
    clauses.push('LOWER(COALESCE(n.recipient, \'\')) = ?');
    values.push(text(req.portalUser?.email).toLowerCase());
  }
  if (branchIds) { clauses.push(`(COALESCE(n.branch_name, '') = '' OR b.id IN (${branchIds.map(() => '?').join(',')}))`); values.push(...branchIds); }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const [rows] = await mysqlPool.query(
    `SELECT n.id, n.event_type, n.recipient, n.subject, n.delivery_status, n.provider, n.queue_id, n.attempt_count,
            n.created_at, n.last_error, n.related_entity_id, n.branch_name
       FROM asset_notification_log n LEFT JOIN branches b ON LOWER(b.name) = LOWER(n.branch_name)
       ${where} ORDER BY n.created_at DESC LIMIT 100`, values,
  );
  return res.json({ success: true, notifications: rows.map(row => ({
    notificationId: row.id, eventType: row.event_type, recipient: row.recipient || '', subject: row.subject || '',
    status: row.delivery_status, provider: row.provider || '', queueId: row.queue_id || '', attempts: row.attempt_count,
    timestamp: row.created_at, lastError: row.last_error || '', entityId: row.related_entity_id || '', branch: row.branch_name || '',
  })), source: 'mysql' });
});

controllers.sendAssetSummaryEmail = asyncHandler(async (req, res) => {
  const recipient = text(req.portalUser?.email).toLowerCase();
  if (!recipient) throw dbError('Your portal account does not have an email address.');
  const assets = await queryAssets(mysqlPool.getPool(), req);
  const units = row => text(row.tracking_mode).toLowerCase() === 'quantity' ? Math.max(0, Number(row.quantity || 0)) : 1;
  const totalUnits = assets.reduce((sum, row) => sum + units(row), 0);
  const assigned = assets.filter(row => text(row.status).toLowerCase() === 'assigned').reduce((sum, row) => sum + units(row), 0);
  const available = assets.filter(row => text(row.status).toLowerCase() === 'available').reduce((sum, row) => sum + units(row), 0);
  const branchIds = await visibleBranchIds(mysqlPool.getPool(), req);
  const transferWhere = branchIds ? `AND from_branch_id IN (${branchIds.map(() => '?').join(',')})` : '';
  const [transferRows] = await mysqlPool.query(
    `SELECT COUNT(*) AS total FROM asset_transfers WHERE LOWER(status) = 'pending' ${transferWhere}`,
    branchIds || [],
  );
  const inventoryWhere = branchIds ? `WHERE branch_id IN (${branchIds.map(() => '?').join(',')})` : '';
  const [inventory] = await mysqlPool.query(`SELECT quantity, minimum_quantity FROM asset_inventory_items ${inventoryWhere}`, branchIds || []);
  const lowStock = inventory.filter(row => Number(row.quantity) <= Number(row.minimum_quantity)).length;
  const branchLabel = text(req.portalUser?.sittingBranch) || 'your assigned branches';
  const date = new Date().toLocaleDateString('en-IN');
  const subject = `Your IPCS asset operations summary · ${date}`;
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const reportValues = [
    ['Physical units', totalUnits], ['Asset records', assets.length], ['Assigned units', assigned],
    ['Available units', available], ['Pending transfers', Number(transferRows[0]?.total || 0)], ['Low stock alerts', lowStock],
  ];
  const html = `<div style="font-family:Arial,sans-serif;color:#17253a;max-width:620px;margin:auto"><div style="padding:22px 24px;background:#10283b;color:#eaf6ff;border-radius:14px 14px 0 0"><small style="letter-spacing:2px;color:#7ee7d4">IPCS ASSET OPERATIONS</small><h1 style="font-size:23px;margin:9px 0 4px">Asset summary</h1><p style="margin:0;color:#b3c7da">${escapeHtml(branchLabel)} · ${escapeHtml(date)}</p></div><div style="padding:22px 24px;background:#f5f9fc;border:1px solid #d9e5ed;border-top:0;border-radius:0 0 14px 14px"><table style="width:100%;border-collapse:collapse"><tbody>${reportValues.map(([label, value]) => `<tr><td style="padding:12px;border-bottom:1px solid #dce6ed">${escapeHtml(label)}</td><td style="padding:12px;border-bottom:1px solid #dce6ed;text-align:right;font-weight:bold">${Number(value)}</td></tr>`).join('')}</tbody></table><p style="font-size:12px;color:#73869b;margin:18px 0 0">This report was requested from the IPCS Asset Management portal.</p></div></div>`;
  const textBody = `Asset summary for ${branchLabel}: ${totalUnits} physical units across ${assets.length} asset records, ${assigned} assigned, ${available} available, ${Number(transferRows[0]?.total || 0)} pending transfers, ${lowStock} low-stock alerts.`;
  const demoMode = String(process.env.ASSET_DEMO_MODE || '').trim().toLowerCase() === 'true';
  if (!demoMode && String(process.env.MYSQL_EMAIL_ENABLED || '').trim().toLowerCase() !== 'true') {
    return res.status(503).json({ success: false, code: 'MYSQL_EMAIL_PERSISTENCE_REQUIRED', message: 'Asset email is not enabled for MySQL yet. No email was sent.' });
  }
  let mail = { queued: false, provider: 'demo-mode', queueId: '' };
  if (!demoMode) {
    mail = await sendIPCSMail({ to: recipient, subject, text: textBody, html }, {
      category: 'portal', logDetails: { name: req.portalUser?.name || '', email: recipient, type: 'asset-summary' },
      context: { source: 'asset-management', branch: branchLabel },
    });
  }
  const status = demoMode ? 'PREVIEW_ONLY' : mail.queued ? 'QUEUED' : 'SENT';
  await mysqlPool.query(
    `INSERT INTO asset_notification_log
      (id, event_type, recipient, subject, delivery_status, provider, queue_id, attempt_count, related_entity_id, branch_name, created_at, source, metadata)
     VALUES (?, 'ASSET_SUMMARY', ?, ?, ?, ?, ?, 0, NULL, ?, UTC_TIMESTAMP(), 'tpo_portal', ?)`,
    [randomUUID(), recipient, subject, status, mail.provider || '', mail.queueId || null, branchLabel, JSON.stringify({ source: 'mysql_asset_management', demoMode })],
  );
  return res.json({ success: true, status, message: demoMode ? 'Demo mode is on, so no email was sent. The preview was logged to MySQL.' : mail.queued ? 'The report was added to the email retry queue.' : 'The asset summary was sent to your portal email.', source: 'mysql' });
});

controllers.unmigrated = asyncHandler(async (req, res) => res.status(501).json({
  success: false,
  code: 'ASSET_FEATURE_MIGRATION_PENDING',
  message: 'This asset workflow is not switched to MySQL yet. It is disabled here to prevent a write to Google Sheets during the database migration.',
}));

module.exports = { controllers, isMySqlMode };
