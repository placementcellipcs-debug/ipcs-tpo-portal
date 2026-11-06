require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { google } = require('googleapis');
const { randomUUID } = require('crypto');
const { logPortalAuditEvent } = require('./config');
const assetTaxonomy = require('./assetTaxonomy');

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const assetDoc = new GoogleSpreadsheet(process.env.ASSET_SPREADSHEET_ID || '17tEo324Xyfc3ku98hmsnKZDry4OgCt_hnUlK8hGtVXA', serviceAccountAuth);

const assetRegisterHeaders = [
  'Asset_ID', 'Record_Type', 'Asset_Name', 'Category_ID', 'Category', 'Subcategory_ID', 'Subcategory', 'Asset_Type_ID', 'Asset_Type',
  'Branch', 'Location', 'Tracking_Mode', 'Quantity', 'Minimum_Quantity', 'Status', 'Condition', 'Brand', 'Model',
  'Serial_Number', 'Purchase_Date', 'Purchase_Cost', 'Vendor', 'Invoice_Number', 'Warranty_End',
  'Created_By', 'Timestamp', 'Updated_By', 'Updated_At', 'Legacy_Source', 'Legacy_Row_Number',
  'Legacy_Category', 'Legacy_Subcategory', 'Legacy_Item_Type', 'Legacy_Data_JSON'
];
const inventoryHeaders = [
  'Item_ID', 'Record_Type', 'Item_Name', 'Category_ID', 'Category', 'Subcategory_ID', 'Subcategory', 'Asset_Type_ID', 'Asset_Type',
  'Branch', 'Quantity', 'Minimum_Quantity', 'Status', 'Created_By', 'Updated_At', 'Legacy_Source', 'Legacy_Row_Number',
  'Legacy_Category', 'Legacy_Subcategory', 'Legacy_Item_Type', 'Legacy_Data_JSON'
];

const legacyColumns = ['Legacy_Source', 'Legacy_Row_Number', 'Legacy_Data_JSON'];

const managedOperationalSheets = [
  { title: 'Asset_Register_V3', headers: assetRegisterHeaders },
  { title: 'Asset_Inventory_V3', headers: inventoryHeaders },
  // V3 is the clean, canonical taxonomy. Older category tabs remain intact as
  // archives so the new rebuild cannot inherit their duplicate/flat entries.
  { title: 'Asset_Category_Master_V3', headers: assetTaxonomy.headers.categories, seed: assetTaxonomy.categoryRows, key: 'categories' },
  { title: 'Asset_Subcategory_Master_V3', headers: assetTaxonomy.headers.subcategories, seed: assetTaxonomy.subcategoryRows, key: 'subcategories' },
  { title: 'Asset_Type_Master_V3', headers: assetTaxonomy.headers.assetTypes, seed: assetTaxonomy.assetTypeRows, key: 'assetTypes' },
  { title: 'Asset_Migration_Log', headers: ['Migration_Key', 'Source_Sheet', 'Target_Sheet', 'Rows_Copied', 'Rows_Skipped', 'Completed_At', 'Status', 'Details'] },
  { title: 'Asset_Approvals_V3', headers: ['Approval_ID', 'Request_ID', 'Request_Type', 'Asset_ID', 'Branch', 'Requested_By', 'Requested_At', 'Decision', 'Decided_By', 'Decided_At', 'Reason', 'Requested_By_Email', 'Reviewed_By_Email', 'Payload_JSON', ...legacyColumns] },
  { title: 'Asset_Notification_Log_V3', headers: ['Notification_ID', 'Event_Type', 'Recipient', 'Subject', 'Delivery_Status', 'Provider', 'Queue_ID', 'Attempt_Count', 'Created_At', 'Last_Error', 'Related_Entity_ID', 'Branch', ...legacyColumns] },
  { title: 'Asset_QR_Registry_V3', headers: ['QR_ID', 'Asset_ID', 'QR_Value', 'QR_Version', 'Created_By', 'Created_At', 'Status', ...legacyColumns] },
  { title: 'Asset_Activity_Log_V3', headers: ['Event_ID', 'Timestamp', 'Actor_ID', 'Actor_Name', 'Actor_Email', 'Actor_Role', 'Branch', 'Action', 'Entity_Type', 'Entity_ID', 'Before_JSON', 'After_JSON', 'Source', 'Request_ID', ...legacyColumns] },
  { title: 'Asset_Assignments_V3', headers: ['Assignment_ID', 'Asset_ID', 'Employee_ID', 'Employee_Name', 'Branch_ID', 'Assigned_By', 'Assigned_Date', 'Returned_Date', 'Condition_On_Issue', 'Condition_On_Return', 'Accessories', 'Remarks', 'Status', ...legacyColumns] },
  { title: 'Asset_History_V3', headers: ['History_ID', 'Asset_ID', 'Action', 'Old_Value', 'New_Value', 'Performed_By', 'Branch', 'Timestamp', 'Remarks', ...legacyColumns] },
  { title: 'Asset_Disposals_V3', headers: ['Disposal_ID', 'Asset_ID', 'Reason', 'Disposal_Method', 'Disposal_Value', 'Requested_By', 'Approved_By', 'Disposed_Date', 'Remarks', ...legacyColumns] },
  { title: 'Asset_Custom_Data_V3', headers: ['Field_ID', 'Asset_ID', 'Field_Name', 'Field_Value', ...legacyColumns] },
  { title: 'Asset_Transfers_V3', headers: ['Transfer_ID', 'Asset_ID', 'From_Branch', 'To_Branch', 'Requested_By', 'Requested_At', 'Status', 'Approved_By', 'Approved_At', 'Received_By', 'Received_At', 'Remarks', 'Rejected_By', 'Rejected_At', 'Rejection_Reason', ...legacyColumns] },
  { title: 'Asset_Transfer_Items_V3', headers: ['Transfer_ID', 'Asset_ID', 'Item_Name', 'Quantity', ...legacyColumns] },
  { title: 'Asset_Maintenance_V3', headers: ['Maintenance_ID', 'Asset_ID', 'Issue', 'Reported_By', 'Status', 'Reported_Date', 'Previous_Status', 'Cost', 'Remarks', 'Completed_Date', ...legacyColumns] },
  { title: 'Asset_Inventory_Transactions_V3', headers: ['Transaction_ID', 'Item_ID', 'Type', 'Quantity', 'Previous', 'New', 'Performed_By', 'Date', ...legacyColumns] },
  { title: 'Asset_Vendors_V3', headers: ['Vendor_ID', 'Vendor_Name', 'Contact_Person', 'Phone', 'Email', 'Address', 'GST_Number', 'Status', 'Created_At', ...legacyColumns] },
  { title: 'Asset_Documents_V3', headers: ['Document_ID', 'Asset_ID', 'Document_Type', 'File_Name', 'Drive_URL', 'Uploaded_By', 'Uploaded_At', ...legacyColumns] },
  { title: 'Asset_Locations_V3', headers: ['Location_ID', 'Branch_ID', 'Branch', 'Building', 'Floor', 'Room', 'Area', 'Location_Name', 'Status', 'Created_At', ...legacyColumns] },
  { title: 'Asset_Audits_V3', headers: ['Audit_ID', 'Audit_Name', 'Branch', 'Created_By', 'Created_At', 'Status', ...legacyColumns] },
  { title: 'Asset_Audit_Items_V3', headers: ['Audit_Item_ID', 'Audit_ID', 'Asset_ID', 'Expected_Status', 'Counted_Status', 'Counted_By', 'Counted_At', 'Remarks', ...legacyColumns] }
];

let assetCache = null;
let assetCacheUpdatedAt = null;
let isFetching = false;
let refreshRequested = false;
let operationalSheetsReady = false;
const pendingMigrationNotices = new Set();

const getAssetCache = () => assetCache;
const getAssetCacheUpdatedAt = () => assetCacheUpdatedAt;
const isAssetCacheReady = () => assetCache !== null;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function ensureManagedSheetHeaders(sheet, requiredHeaders) {
  await sheet.loadHeaderRow();
  const current = [...(sheet.headerValues || [])];
  const normalize = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const missing = requiredHeaders.filter(header => !current.some(existing => normalize(existing) === normalize(header)));
  if (!missing.length) return current;
  const next = [...current, ...missing];
  if (next.length > (Number(sheet.columnCount) || 0)) await sheet.resize({ columnCount: next.length });
  await sheet.setHeaderRow(next);
  sheet._headerValues = next;
  return next;
}

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
  if (!operationalSheetsReady) {
    let setupHadErrors = false;
    const normalizeTitle = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedBase = value => normalizeTitle(value).replace(/^\d+/, '');
    for (const definition of managedOperationalSheets) {
      const acceptedTitles = [definition.title, ...(definition.aliases || [])].map(normalizeTitle);
      const existing = assetDoc.sheetsByIndex.find(sheet => {
        const title = normalizeTitle(sheet.title);
        const base = normalizedBase(sheet.title);
        // Only exact aliases are safe here. Suffix matching made
        // Asset_Activity_History look like the per-item Asset_History sheet.
        return acceptedTitles.some(candidate => title === candidate || base === candidate);
      });
      if (existing) {
        await ensureManagedSheetHeaders(existing, definition.headers);
        if (definition.seed) await seedTaxonomySheet(existing, definition);
        continue;
      }
      try {
        const created = await assetDoc.addSheet({
          title: definition.title,
          headerValues: definition.headers,
          gridProperties: { rowCount: 1000, columnCount: Math.max(26, definition.headers.length) }
        });
        if (definition.headers.length > (Number(created.columnCount) || 0)) await created.resize({ columnCount: definition.headers.length });
        if (definition.seed) await seedTaxonomySheet(created, definition);
        console.log(`[ASSET SHEETS] Created operational tab ${definition.title}.`);
        logPortalAuditEvent({ actorType: 'Bot', source: 'Automation', action: 'Asset operational tab created', resource: definition.title, result: 'Success', details: { columns: definition.headers.length, rowsSeeded: definition.seed?.length || 0 } });
      } catch (error) {
        setupHadErrors = true;
        console.error(`[ASSET SHEETS] Could not create ${definition.title}: ${error.message}`);
        logPortalAuditEvent({ actorType: 'Bot', source: 'Automation', action: 'Asset operational tab creation failed', resource: definition.title, result: 'Error', details: { error: String(error.message || error).slice(0, 400) } });
      }
    }
    operationalSheetsReady = !setupHadErrors;
  }
  // Keep checking migration sources so a legacy tab added later is still
  // discovered, while avoiding a full schema/header audit on every cache poll.
  await migrateLegacyAssetRows();
}

function normalizedHeader(value) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, ''); }

function plainRowValue(row, candidates) {
  const values = row?.toObject?.() || row || {};
  const keys = Object.keys(values);
  for (const candidate of candidates) {
    const key = keys.find(header => normalizedHeader(header) === normalizedHeader(candidate));
    if (key && values[key] !== undefined && values[key] !== null) return values[key];
  }
  return '';
}

async function migrateLegacyAssetRows() {
  const logSheet = assetDoc.sheetsByIndex.find(sheet => normalizedHeader(sheet.title) === 'assetmigrationlog');
  const registerSheet = assetDoc.sheetsByIndex.find(sheet => normalizedHeader(sheet.title) === 'assetregisterv3');
  const inventorySheet = assetDoc.sheetsByIndex.find(sheet => normalizedHeader(sheet.title) === 'assetinventoryv3');
  if (!logSheet || !registerSheet || !inventorySheet) return;

  const logHeaders = ['Migration_Key', 'Source_Sheet', 'Target_Sheet', 'Rows_Copied', 'Rows_Skipped', 'Completed_At', 'Status', 'Details'];
  const migrationHeaders = [...(logSheet.headerValues || [])];
  const missingLogHeaders = logHeaders.filter(header => !migrationHeaders.some(existing => normalizedHeader(existing) === normalizedHeader(header)));
  if (missingLogHeaders.length) {
    const currentRows = await logSheet.getRows();
    if (currentRows.length) {
      console.error('[ASSET MIGRATION] Migration log headers are incompatible; legacy rows were preserved without migration.');
      return;
    }
    const headers = [...migrationHeaders, ...missingLogHeaders];
    if (headers.length > (Number(logSheet.columnCount) || 0)) await logSheet.resize({ columnCount: headers.length });
    await logSheet.setHeaderRow(headers);
    logSheet._headerValues = headers;
  }
  const existingMigrations = await logSheet.getRows();
  const completed = new Set(existingMigrations.filter(row => String(row.get('Status') || '').toUpperCase() === 'COMPLETED').map(row => String(row.get('Migration_Key') || '')));

  const migrateOne = async ({ key, sourceName, target, headers, recordType, idCandidates, nameCandidates, categoryCandidates, subcategoryCandidates, assetTypeCandidates, branchCandidates }) => {
    if (completed.has(key)) return;
    const source = assetDoc.sheetsByIndex.find(sheet => normalizedHeader(sheet.title) === normalizedHeader(sourceName));
    // A missing tab is not a completed migration. Some workbooks add or rename
    // legacy tabs after the first service start; retry once they are present.
    if (!source || source === target) {
      if (!pendingMigrationNotices.has(key)) {
        pendingMigrationNotices.add(key);
        console.info(`[ASSET MIGRATION] ${sourceName} is not available yet; ${key} remains pending.`);
      }
      return;
    }
    pendingMigrationNotices.delete(key);
    let rowsCopied = 0;
    let rowsSkipped = 0;
    await source.loadHeaderRow();
    const sourceRows = await source.getRows();
    await target.loadHeaderRow();
    const targetHeaders = [...(target.headerValues || [])];
    const needed = headers.filter(header => !targetHeaders.some(existing => normalizedHeader(existing) === normalizedHeader(header)));
    if (needed.length) {
      const nextHeaders = [...targetHeaders, ...needed];
      if (nextHeaders.length > (Number(target.columnCount) || 0)) await target.resize({ columnCount: nextHeaders.length });
      await target.setHeaderRow(nextHeaders);
      target._headerValues = nextHeaders;
    }
    const targetRows = await target.getRows();
    const targetIds = new Set(targetRows.map(row => String(plainRowValue(row, idCandidates) || '').trim().toLowerCase()).filter(Boolean));
    const mappedRows = [];
    const targetHeaderList = target.headerValues || headers;
    const mappedHeader = (candidates) => targetHeaderList.find(header => (candidates || []).some(candidate => normalizedHeader(header) === normalizedHeader(candidate)));
    for (const row of sourceRows) {
      const rowId = String(plainRowValue(row, idCandidates) || '').trim();
      const rowName = String(plainRowValue(row, nameCandidates) || '').trim();
      if (!rowId && !rowName) { rowsSkipped += 1; continue; }
      const id = rowId || `MIG-${recordType}-${normalizedHeader(sourceName).slice(0, 8)}-${String(row.rowNumber || mappedRows.length + 2).padStart(6, '0')}`;
      if (targetIds.has(id.toLowerCase())) { rowsSkipped += 1; continue; }
      const rowObject = row.toObject?.() || {};
      const mapped = {};
      for (const header of targetHeaderList) {
        const normalized = normalizedHeader(header);
        const match = Object.keys(rowObject).find(sourceHeader => normalizedHeader(sourceHeader) === normalized);
        if (match) mapped[header] = rowObject[match];
      }
      const targetIdHeader = mappedHeader(idCandidates);
      const typeHeader = targetHeaderList.find(header => normalizedHeader(header) === 'recordtype');
      const sourceHeader = targetHeaderList.find(header => normalizedHeader(header) === 'legacysource');
      const rowNumberHeader = targetHeaderList.find(header => normalizedHeader(header) === 'legacyrownumber');
      const categoryHeader = mappedHeader(['Category']);
      const categoryIdHeader = mappedHeader(['Category_ID']);
      const subcategoryHeader = mappedHeader(['Subcategory']);
      const subcategoryIdHeader = mappedHeader(['Subcategory_ID']);
      const assetTypeHeader = mappedHeader(['Asset_Type']);
      const assetTypeIdHeader = mappedHeader(['Asset_Type_ID']);
      const branchHeader = mappedHeader(['Branch']);
      const displayNameHeader = mappedHeader(nameCandidates);
      if (targetIdHeader) mapped[targetIdHeader] = id;
      if (displayNameHeader && !String(mapped[displayNameHeader] || '').trim()) mapped[displayNameHeader] = rowName;
      if (typeHeader) mapped[typeHeader] = recordType;
      if (sourceHeader) mapped[sourceHeader] = source.title;
      if (rowNumberHeader) mapped[rowNumberHeader] = row.rowNumber || '';
      if (branchHeader && !String(mapped[branchHeader] || '').trim() && branchCandidates?.length) mapped[branchHeader] = plainRowValue(row, branchCandidates);

      const legacyCategory = String(plainRowValue(row, categoryCandidates || ['Category']) || '').trim();
      const legacySubcategory = String(plainRowValue(row, subcategoryCandidates || ['Subcategory']) || '').trim();
      const legacyAssetType = String(plainRowValue(row, assetTypeCandidates || ['Asset_Type']) || '').trim();
      const legacyItemText = `${rowName} ${legacyCategory} ${legacySubcategory} ${legacyAssetType}`;
      const categoryAliases = [
        { id: 'AUT', words: ['industrial automation', 'automation equipment', 'plc', 'scada', 'dcs', 'vfd', 'process control'] },
        { id: 'BMS', words: ['bms', 'building management', 'cctv', 'surveillance', 'access control', 'fire alarm'] },
        { id: 'EMB', words: ['embedded', 'iot', 'arduino', 'raspberry pi', 'microcontroller'] },
        { id: 'SW', words: ['software', 'digital marketing', 'software testing', 'analytics', 'programming tools'] },
        { id: 'IT', words: ['information technology', 'computing', 'computer', 'networking', 'python', 'ai lab'] },
        { id: 'ELE', words: ['electrical', 'wiring', 'lighting'] },
        { id: 'MEC', words: ['mechanical', 'workshop', 'fabrication'] },
        { id: 'PLB', words: ['plumbing', 'water', 'sanitation'] },
        { id: 'FUR', words: ['furniture', 'classroom', 'office furniture', 'presentation equipment'] },
        { id: 'SAF', words: ['safety', 'emergency', 'protective equipment'] },
        { id: 'LAB', words: ['laboratory', 'measurement instrument', 'lab instrument'] },
        { id: 'GEN', words: ['general asset', 'consumable', 'stationery', 'miscellaneous'] }
      ];
      let canonicalCategory = assetTaxonomy.categoryRows.find(item => normalizedHeader(item.categoryname) === normalizedHeader(legacyCategory));
      if (!canonicalCategory) {
        const legacyCategoryText = normalizedHeader(`${legacyCategory} ${legacySubcategory}`);
        const aliasMatch = categoryAliases.find(({ words }) => words.some(word => legacyCategoryText.includes(normalizedHeader(word))));
        if (aliasMatch) canonicalCategory = assetTaxonomy.categoryRows.find(item => item.categoryid === aliasMatch.id);
      }
      let canonicalSubcategory = assetTaxonomy.subcategoryRows.find(item => normalizedHeader(item.subcategoryname) === normalizedHeader(legacySubcategory)
        && (!canonicalCategory || normalizedHeader(item.categoryid) === normalizedHeader(canonicalCategory.categoryid)));
      let canonicalAssetType = assetTaxonomy.assetTypeRows.find(item => normalizedHeader(item.assettypename) === normalizedHeader(legacyAssetType)
        && (!canonicalSubcategory || normalizedHeader(item.subcategoryid) === normalizedHeader(canonicalSubcategory.subcategoryid)));

      // Legacy registers often used the product name itself as the category.
      // Match recognizable item types against the approved tree before using
      // the explicit general fallback, while keeping every original field in
      // Legacy_Data_JSON and the dedicated Legacy_* columns.
      if (!canonicalAssetType) {
        const exactType = assetTaxonomy.assetTypeRows.find(item =>
          normalizedHeader(item.assettypename) === normalizedHeader(legacyAssetType || rowName));
        const searchable = normalizedHeader(legacyItemText);
        const nameType = exactType || assetTaxonomy.assetTypeRows
          .filter(item => normalizedHeader(item.assettypename).length >= 3 && searchable.includes(normalizedHeader(item.assettypename)))
          .sort((a, b) => normalizedHeader(b.assettypename).length - normalizedHeader(a.assettypename).length)[0];
        if (nameType) {
          canonicalAssetType = nameType;
          canonicalSubcategory = assetTaxonomy.subcategoryRows.find(item => normalizedHeader(item.subcategoryid) === normalizedHeader(nameType.subcategoryid));
          canonicalCategory = assetTaxonomy.categoryRows.find(item => normalizedHeader(item.categoryid) === normalizedHeader(nameType.categoryid));
        }
      }

      if (recordType === 'CONSUMABLE') {
        canonicalCategory = assetTaxonomy.categoryRows.find(item => item.categoryid === 'GEN');
        canonicalSubcategory = assetTaxonomy.subcategoryRows.find(item => item.subcategoryid === 'GEN-SC02');
        const consumableText = normalizedHeader(`${legacyAssetType} ${rowName} ${legacySubcategory}`);
        canonicalAssetType = assetTaxonomy.assetTypeRows
          .filter(item => item.subcategoryid === 'GEN-SC02' && item.assettypename !== 'Consumable lab material')
          .sort((a, b) => normalizedHeader(b.assettypename).length - normalizedHeader(a.assettypename).length)
          .find(item => normalizedHeader(item.assettypename).length >= 3 && consumableText.includes(normalizedHeader(item.assettypename)))
          || assetTaxonomy.assetTypeRows.find(item => item.assettypename === 'Consumable supply' && item.subcategoryid === 'GEN-SC02');
      } else if (!canonicalCategory || !canonicalSubcategory || !canonicalAssetType) {
        canonicalCategory = assetTaxonomy.categoryRows.find(item => item.categoryid === 'GEN');
        canonicalSubcategory = assetTaxonomy.subcategoryRows.find(item => item.subcategoryid === 'GEN-SC04');
        canonicalAssetType = assetTaxonomy.assetTypeRows.find(item => item.assettypename === 'Other managed item' && item.subcategoryid === 'GEN-SC04');
      }

      if (categoryHeader) mapped[categoryHeader] = canonicalCategory?.categoryname || 'General Assets, Consumables & Miscellaneous';
      if (categoryIdHeader) mapped[categoryIdHeader] = canonicalCategory?.categoryid || 'GEN';
      if (subcategoryHeader) mapped[subcategoryHeader] = canonicalSubcategory?.subcategoryname || 'Other / Unclassified Assets';
      if (subcategoryIdHeader) mapped[subcategoryIdHeader] = canonicalSubcategory?.subcategoryid || 'GEN-SC04';
      if (assetTypeHeader) mapped[assetTypeHeader] = canonicalAssetType?.assettypename || 'Other managed item';
      if (assetTypeIdHeader) mapped[assetTypeIdHeader] = canonicalAssetType?.assettypeid || '';
      const legacyCategoryHeader = mappedHeader(['Legacy_Category']);
      const legacySubcategoryHeader = mappedHeader(['Legacy_Subcategory']);
      const legacyItemTypeHeader = mappedHeader(['Legacy_Item_Type']);
      const legacyJsonHeader = mappedHeader(['Legacy_Data_JSON']);
      if (legacyCategoryHeader) mapped[legacyCategoryHeader] = legacyCategory;
      if (legacySubcategoryHeader) mapped[legacySubcategoryHeader] = legacySubcategory;
      if (legacyItemTypeHeader) mapped[legacyItemTypeHeader] = legacyAssetType;
      if (legacyJsonHeader) mapped[legacyJsonHeader] = JSON.stringify(rowObject);
      mappedRows.push(mapped);
      targetIds.add(id.toLowerCase());
    }
    for (let offset = 0; offset < mappedRows.length; offset += 300) await target.addRows(mappedRows.slice(offset, offset + 300));
    rowsCopied = mappedRows.length;
    await logSheet.addRow({ Migration_Key: key, Source_Sheet: sourceName, Target_Sheet: target.title, Rows_Copied: rowsCopied, Rows_Skipped: rowsSkipped, Completed_At: new Date().toISOString(), Status: 'COMPLETED', Details: 'Rows copied to the new register. Original source tab remains unchanged as an archive.' });
    console.log(`[ASSET MIGRATION] ${key} completed: ${rowsCopied} copied, ${rowsSkipped} skipped.`);
  };

  try {
    await migrateOne({ key: 'ASSETS_TO_REGISTER_V3', sourceName: 'Assets', target: registerSheet, headers: assetRegisterHeaders, recordType: 'ASSET', idCandidates: ['Asset_ID', 'Asset Code', 'Asset Tag'], nameCandidates: ['Asset_Name', 'Name', 'Item_Name', 'Product Name'], categoryCandidates: ['Category', 'Category_Name'], subcategoryCandidates: ['Subcategory', 'Subcategory_Name'], assetTypeCandidates: ['Asset_Type', 'Item Type'], branchCandidates: ['Branch', 'Branch_Name'] });
    await migrateOne({ key: 'ASSET_REGISTER_TO_V3', sourceName: 'Asset_Register', target: registerSheet, headers: assetRegisterHeaders, recordType: 'ASSET', idCandidates: ['Asset_ID', 'Asset Code', 'Asset Tag'], nameCandidates: ['Asset_Name', 'Name', 'Item_Name', 'Product Name'], categoryCandidates: ['Category', 'Category_Name'], subcategoryCandidates: ['Subcategory', 'Subcategory_Name'], assetTypeCandidates: ['Asset_Type', 'Item Type'], branchCandidates: ['Branch', 'Branch_Name'] });
    await migrateOne({ key: 'INVENTORY_TO_V3', sourceName: 'Inventory', target: inventorySheet, headers: inventoryHeaders, recordType: 'CONSUMABLE', idCandidates: ['Item_ID', 'Inventory_ID', 'Item Code'], nameCandidates: ['Item_Name', 'Name', 'Asset_Name', 'Product Name'], categoryCandidates: ['Category', 'Category_Name'], subcategoryCandidates: ['Subcategory', 'Subcategory_Name'], assetTypeCandidates: ['Asset_Type', 'Item Type'], branchCandidates: ['Branch', 'Branch_Name'] });
    await migrateOne({ key: 'ASSET_INVENTORY_TO_V3', sourceName: 'Asset_Inventory', target: inventorySheet, headers: inventoryHeaders, recordType: 'CONSUMABLE', idCandidates: ['Item_ID', 'Inventory_ID', 'Item Code'], nameCandidates: ['Item_Name', 'Name', 'Asset_Name', 'Product Name'], categoryCandidates: ['Category', 'Category_Name'], subcategoryCandidates: ['Subcategory', 'Subcategory_Name'], assetTypeCandidates: ['Asset_Type', 'Item Type'], branchCandidates: ['Branch', 'Branch_Name'] });

    const operationalMigrations = [
      { key: 'ASSIGNMENTS_TO_V3', source: ['Assignments', 'Asset Assignment', 'Asset Assignments'], target: 'Asset_Assignments_V3', id: 'Assignment_ID' },
      { key: 'HISTORY_TO_V3', source: ['History', 'Asset History', 'Asset Register History'], target: 'Asset_History_V3', id: 'History_ID' },
      { key: 'DISPOSALS_TO_V3', source: ['Disposals', 'Asset Disposal', 'Asset Disposals'], target: 'Asset_Disposals_V3', id: 'Disposal_ID' },
      { key: 'CUSTOM_DATA_TO_V3', source: ['AssetCustomData', 'Asset Custom Data'], target: 'Asset_Custom_Data_V3', id: 'Field_ID' },
      { key: 'TRANSFERS_TO_V3', source: ['Transfers', 'Asset Transfers'], target: 'Asset_Transfers_V3', id: 'Transfer_ID' },
      { key: 'TRANSFER_ITEMS_TO_V3', source: ['TransferItems', 'Transfer Items'], target: 'Asset_Transfer_Items_V3', id: 'Transfer_ID' },
      { key: 'MAINTENANCE_TO_V3', source: ['Maintenance', 'Asset Maintenance'], target: 'Asset_Maintenance_V3', id: 'Maintenance_ID' },
      { key: 'INVENTORY_TRANSACTIONS_TO_V3', source: ['InventoryTransactions', 'Inventory Transactions', 'Asset Inventory Transactions'], target: 'Asset_Inventory_Transactions_V3', id: 'Transaction_ID' },
      { key: 'VENDORS_TO_V3', source: ['Vendors', 'Asset Vendors'], target: 'Asset_Vendors_V3', id: 'Vendor_ID' },
      { key: 'DOCUMENTS_TO_V3', source: ['Documents', 'Asset Documents', 'Document Register'], target: 'Asset_Documents_V3', id: 'Document_ID' },
      { key: 'LOCATIONS_TO_V3', source: ['Locations', 'Asset Locations'], target: 'Asset_Locations_V3', id: 'Location_ID' },
      { key: 'AUDITS_TO_V3', source: ['Audits', 'Asset Audits'], target: 'Asset_Audits_V3', id: 'Audit_ID' },
      { key: 'AUDIT_ITEMS_TO_V3', source: ['AuditItems', 'Audit Items', 'Asset Audit Items'], target: 'Asset_Audit_Items_V3', id: 'Audit_Item_ID' },
      { key: 'APPROVALS_TO_V3', source: ['Asset_Approvals', 'Approvals'], target: 'Asset_Approvals_V3', id: 'Approval_ID' },
      { key: 'NOTIFICATIONS_TO_V3', source: ['Asset_Notification_Log', 'Asset Notification Log'], target: 'Asset_Notification_Log_V3', id: 'Notification_ID' },
      { key: 'QR_REGISTRY_TO_V3', source: ['Asset_QR_Registry', 'Asset QR Registry'], target: 'Asset_QR_Registry_V3', id: 'QR_ID' },
      { key: 'ACTIVITY_TO_V3', source: ['Asset_Activity_Log', 'Asset Activity Log'], target: 'Asset_Activity_Log_V3', id: 'Event_ID' },
      { key: 'ACTIVITY_HISTORY_TO_V3', source: ['Asset_Activity_History', 'Activity History'], target: 'Asset_Activity_Log_V3', id: 'Event_ID' }
    ];
    for (const migration of operationalMigrations) {
      if (completed.has(migration.key)) continue;
      const target = assetDoc.sheetsByIndex.find(sheet => normalizedHeader(sheet.title) === normalizedHeader(migration.target));
      const acceptedSources = migration.source.map(normalizedHeader);
      const source = assetDoc.sheetsByIndex.find(sheet => acceptedSources.includes(normalizedHeader(sheet.title).replace(/^\d+/, '')));
      if (!source || !target || source === target) continue;
      try {
        await source.loadHeaderRow();
        await target.loadHeaderRow();
        const sourceRows = await source.getRows();
        const targetHeaders = [...(target.headerValues || [])];
        const missing = [...targetHeaders, ...legacyColumns].filter((header, index, all) => all.findIndex(item => normalizedHeader(item) === normalizedHeader(header)) === index)
          .filter(header => !targetHeaders.some(existing => normalizedHeader(existing) === normalizedHeader(header)));
        if (missing.length) {
          const nextHeaders = [...targetHeaders, ...missing];
          if (nextHeaders.length > (Number(target.columnCount) || 0)) await target.resize({ columnCount: nextHeaders.length });
          await target.setHeaderRow(nextHeaders);
          target._headerValues = nextHeaders;
        }
        const existingTargetRows = await target.getRows();
        const migratedOrigins = new Set(existingTargetRows.map(row => `${normalizedHeader(plainRowValue(row, ['Legacy_Source']))}:${String(plainRowValue(row, ['Legacy_Row_Number']) || '')}`).filter(key => !key.endsWith(':')));
        const targetHeaderList = target.headerValues || [];
        const sourceRowsToAppend = [];
        let skipped = 0;
        for (const row of sourceRows) {
          const rowObject = row.toObject?.() || {};
          if (!Object.values(rowObject).some(value => String(value ?? '').trim())) { skipped += 1; continue; }
          const rowNumber = row.rowNumber || '';
          const originKey = `${normalizedHeader(source.title)}:${String(rowNumber)}`;
          if (migratedOrigins.has(originKey)) { skipped += 1; continue; }
          const mapped = {};
          for (const header of targetHeaderList) {
            if (legacyColumns.some(column => normalizedHeader(column) === normalizedHeader(header))) continue;
            const match = Object.keys(rowObject).find(sourceHeader => normalizedHeader(sourceHeader) === normalizedHeader(header));
            if (match) mapped[header] = rowObject[match];
          }
          const idHeader = targetHeaderList.find(header => normalizedHeader(header) === normalizedHeader(migration.id));
          if (idHeader && !String(mapped[idHeader] || '').trim()) mapped[idHeader] = `MIG-${normalizedHeader(source.title).slice(0, 10)}-${String(rowNumber || sourceRowsToAppend.length + 2).padStart(6, '0')}`;
          const sourceHeader = targetHeaderList.find(header => normalizedHeader(header) === 'legacysource');
          const rowNumberHeader = targetHeaderList.find(header => normalizedHeader(header) === 'legacyrownumber');
          const jsonHeader = targetHeaderList.find(header => normalizedHeader(header) === 'legacydatajson');
          if (sourceHeader) mapped[sourceHeader] = source.title;
          if (rowNumberHeader) mapped[rowNumberHeader] = rowNumber;
          if (jsonHeader) mapped[jsonHeader] = JSON.stringify(rowObject);
          sourceRowsToAppend.push(mapped);
          migratedOrigins.add(originKey);
        }
        for (let offset = 0; offset < sourceRowsToAppend.length; offset += 300) await target.addRows(sourceRowsToAppend.slice(offset, offset + 300));
        await logSheet.addRow({ Migration_Key: migration.key, Source_Sheet: source.title, Target_Sheet: target.title, Rows_Copied: sourceRowsToAppend.length, Rows_Skipped: skipped, Completed_At: new Date().toISOString(), Status: 'COMPLETED', Details: 'Asset operation rows copied to the clean V3 tab; original source tab remains unchanged as an archive.' });
        completed.add(migration.key);
        console.log(`[ASSET MIGRATION] ${migration.key} completed: ${sourceRowsToAppend.length} copied, ${skipped} skipped.`);
      } catch (error) {
        console.error(`[ASSET MIGRATION] ${migration.key} failed; source rows remain unchanged. ${error.message}`);
      }
    }
  } catch (error) {
    console.error(`[ASSET MIGRATION] Legacy data copy failed; source rows remain untouched. ${error.message}`);
    logPortalAuditEvent({ actorType: 'Bot', source: 'Automation', action: 'Asset sheet migration failed', resource: 'Asset management v3', result: 'Error', details: { error: String(error.message || error).slice(0, 500) } });
  }
}

async function seedTaxonomySheet(sheet, definition) {
  if (!Array.isArray(definition.seed) || !definition.seed.length) return;
  let headers = await ensureManagedSheetHeaders(sheet, definition.headers);
  const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const hasAllHeaders = definition.headers.every(header => headers.some(existing => normalize(existing) === normalize(header)));
  if (!hasAllHeaders) {
    const existingRows = await sheet.getRows();
    if (existingRows.length) {
      console.error(`[ASSET SHEETS] ${definition.title} has data with an incompatible header. Preserving it without seeding.`);
      return;
    }
    if ((Number(sheet.columnCount) || 0) < definition.headers.length) await sheet.resize({ columnCount: definition.headers.length });
    await sheet.setHeaderRow(definition.headers);
    sheet._headerValues = definition.headers;
    headers = definition.headers;
  }
  const existingRows = await sheet.getRows();
  const keyMap = {
    categories: ['categoryid', 'categorycode', 'categoryname', 'type', 'status'],
    subcategories: ['subcategoryid', 'categoryid', 'categoryname', 'subcategoryname', 'type', 'status'],
    assetTypes: ['assettypeid', 'categoryid', 'categoryname', 'subcategoryid', 'subcategoryname', 'assettypename', 'type', 'status']
  }[definition.key];
  if (!keyMap) return;
  const idHeader = keyMap[0];
  const existingIds = new Set(existingRows.map(row => String(row.get(headers.find(header => normalize(header) === idHeader) || '') || '').trim().toLowerCase()).filter(Boolean));
  const rows = definition.seed.filter(item => !existingIds.has(String(item[idHeader] || '').trim().toLowerCase())).map(item => Object.fromEntries(headers.map(header => {
    const normalized = normalize(header);
    const index = keyMap.indexOf(normalized);
    return [header, index >= 0 ? item[keyMap[index]] || '' : ''];
  })));
  if (rows.length) {
    await sheet.addRows(rows);
    console.log(`[ASSET SHEETS] Added ${rows.length} missing canonical rows in ${definition.title}.`);
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
      const normalizedBase = sheet => normalizedTitle(sheet).replace(/^\d+/, '');
      const canonicalTabs = {
        assets: 'assetregisterv3', inventory: 'assetinventoryv3', categories: 'assetcategorymasterv3',
        assetcategorymaster: 'assetcategorymasterv3', subcategories: 'assetsubcategorymasterv3',
        assetsubcategorymaster: 'assetsubcategorymasterv3', assettypemaster: 'assettypemasterv3',
        assetcustomdata: 'assetcustomdatav3', assignments: 'assetassignmentsv3', transfers: 'assettransfersv3',
        transferitems: 'assettransferitemsv3', maintenance: 'assetmaintenancev3',
        inventorytransactions: 'assetinventorytransactionsv3', inventorytransaction: 'assetinventorytransactionsv3',
        vendors: 'assetvendorsv3', documents: 'assetdocumentsv3', history: 'assethistoryv3',
        audits: 'assetauditsv3', audititems: 'assetaudititemsv3', disposals: 'assetdisposalsv3',
        locations: 'assetlocationsv3', assetapprovals: 'assetapprovalsv3',
        assetnotificationlog: 'assetnotificationlogv3', assetqrregistry: 'assetqrregistryv3',
        assetactivitylog: 'assetactivitylogv3'
      };
      const canonical = canonicalTabs[cleanKeyword];
      if (canonical) return sheets.find(sheet => normalizedBase(sheet) === canonical) || null;
      const exact = sheets.find(sheet => normalizedTitle(sheet) === cleanKeyword);
      if (exact) return exact;
      const exactAlias = sheets.find(sheet => normalizedBase(sheet) === cleanKeyword || normalizedBase(sheet) === `asset${cleanKeyword}`);
      if (exactAlias) return exactAlias;
      // Numbered legacy tabs such as `07_Assets` remain supported. Avoid broad
      // substring matching (for example, `Activity_History` as the History tab).
      return sheets.find(sheet => normalizedBase(sheet) === cleanKeyword || normalizedBase(sheet) === `asset${cleanKeyword}`) || null;
    };

    const sheetKeys = [
      'branches', 'users', 'employees', 'categories', 'subcategories', 'assetcategorymaster', 'assetsubcategorymaster', 'assettypemaster',
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

    // Prefer the new canonical three-level library over legacy category tabs.
    fetchedData.categories = fetchedData.assetcategorymaster?.length ? fetchedData.assetcategorymaster : fetchedData.categories;
    fetchedData.subcategories = fetchedData.assetsubcategorymaster?.length ? fetchedData.assetsubcategorymaster : fetchedData.subcategories;
    fetchedData.assetTypes = fetchedData.assettypemaster || [];

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
