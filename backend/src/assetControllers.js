const { assetDoc, getAssetCache, refreshAssetCache } = require('./assetConfig');
const { getCache } = require('./config');

// Helper to safely map sheet headers regardless of spaces or cases
const getH = (headers, target) => {
  const cleanTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '');
  return headers.find(h => (h||'').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget) || target;
};
const getOptionalH = (headers, target) => {
  const cleanTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '');
  return headers.find(h => (h || '').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget) || null;
};
const normalize = value => String(value || '').trim().toLowerCase().replace(/\s*branch\s*/g, ' ').replace(/[^a-z0-9]/g, '');
const rowValue = (row, field) => {
  const values = row?.toObject?.() || {};
  const key = Object.keys(values).find(header => normalize(header) === normalize(field));
  return key ? values[key] : '';
};
const isAssetAdmin = req => {
  const user = req.portalUser || {};
  const role = String(user.role || '').toUpperCase();
  return user.accessType === 'superadmin' || ['SYSTEM ADMIN', 'GENERAL MANAGER', 'ZONAL PLACEMENT HEAD', 'TECHNICAL HEAD'].includes(role);
};
const canAccessAssetBranch = (req, branch) => {
  if (isAssetAdmin(req)) return true;
  const user = req.portalUser || {};
  const branches = Array.isArray(user.assignedBranchesArray) ? user.assignedBranchesArray : [];
  const assigned = branches.length ? branches : [user.sittingBranch];
  if (assigned.some(value => String(value).trim().toLowerCase() === 'all')) return false;
  const target = normalize(branch);
  return Boolean(target && assigned.some(value => normalize(value) === target));
};

// =========================================================
// 1. ASSET DASHBOARD ANALYTICS
// =========================================================
exports.getAssetDashboardStats = async (req, res) => {
  try {
    const cache = getAssetCache();
    const assets = (cache.assets || []).filter(row => canAccessAssetBranch(req, rowValue(row, 'Branch')));
    const allowedAssetIds = new Set(assets.map(row => String(rowValue(row, 'Asset_ID') || '').trim().toLowerCase()));
    const inventory = (cache.inventory || []).filter(row => canAccessAssetBranch(req, rowValue(row, 'Branch')));
    const maintenance = (cache.maintenance || []).filter(row => allowedAssetIds.has(String(rowValue(row, 'Asset_ID') || '').trim().toLowerCase()));

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

      totalAssets++;
      const cost = parseFloat(getV('purchasecost')) || 0;
      totalValue += cost;

      const status = (getV('status') || '').toUpperCase();
      if (status === 'ASSIGNED') assigned++;
      else if (status === 'AVAILABLE') available++;
      else if (status === 'UNDER_MAINTENANCE') underMaintenance++;

      const branch = getV('branch') || 'Unknown';
      branchStats[branch] = (branchStats[branch] || 0) + 1;

      const category = getV('category') || 'Other';
      categoryStats[category] = (categoryStats[category] || 0) + 1;
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
        activeMaintenance 
      }
    });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

// =========================================================
// 2. FETCH FORM PREREQUISITES (DROPDOWNS)
// =========================================================
exports.getRegistrationData = async (req, res) => {
  try {
    const cache = getAssetCache();
    const gCache = getCache(); // The Main Placement Portal Cache

    // 🚨 FIXED: Bulletproof extractor for the Branches sheet
    let branches = [];
    if (gCache && gCache.branches) {
       branches = gCache.branches.map(r => {
         if (typeof r.get === 'function') return r.get('Branch');
         if (r._rawData && r._rawData.length > 2) return r._rawData[2]; // Fallback to column C
         return null;
       }).filter(Boolean);
    }

    // Deduplicate and sort branches alphabetically
    branches = [...new Set(branches)].sort();
    if (!isAssetAdmin(req)) branches = branches.filter(branch => canAccessAssetBranch(req, branch));

    // Map Asset DB Sheets
    const mapSheet = (rows) => rows.map(r => {
      if (typeof r.toObject !== 'function') return {};
      const obj = r.toObject();
      const cleanObj = {};
      Object.keys(obj).forEach(k => { 
        cleanObj[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = obj[k]; 
      });
      return cleanObj;
    });
    const locations = mapSheet(cache.locations || []);

    res.json({ 
      success: true, 
      branches, 
      categories: mapSheet(cache.categories || []), 
      subcategories: mapSheet(cache.subcategories || []), 
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
  try {
    const { asset, customFields, userName, userEmail } = req.body || {};
    if (!asset?.name || !asset?.category || !asset?.branch) return res.status(400).json({ success: false, message: 'Asset name, category, and branch are required.' });
    if (!canAccessAssetBranch(req, asset.branch)) return res.status(403).json({ success: false, message: 'You cannot register an asset for that branch.' });

    const getSheet = (keyword) => assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes(keyword));
    const assetSheet = getSheet('assets');
    const customSheet = getSheet('assetcustomdata');
    const historySheet = getSheet('history');

    if (!assetSheet) return res.status(404).json({ success: false, message: "Asset sheet missing in database." });

    // Generate Unique IDs
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const uniqueHash = Math.random().toString(36).substring(2, 6).toUpperCase();
    const assetId = `IPCS-AST-${Date.now().toString().slice(-4)}${uniqueHash}`;

    // 1. Write to Main Assets Sheet
    const aH = assetSheet.headerValues;
    await assetSheet.addRow({
      [getH(aH, 'Asset_ID')]: assetId,
      [getH(aH, 'Asset_Name')]: asset.name,
      [getH(aH, 'Category')]: asset.category,
      [getH(aH, 'Subcategory')]: asset.subcategory,
      [getH(aH, 'Branch')]: asset.branch,
      [getH(aH, 'Location')]: asset.location,
      [getH(aH, 'Status')]: 'AVAILABLE',
      [getH(aH, 'Condition')]: asset.condition,
      [getH(aH, 'Brand')]: asset.brand || '',
      [getH(aH, 'Model')]: asset.model || '',
      [getH(aH, 'Purchase_Date')]: asset.purchaseDate || '',
      [getH(aH, 'Purchase_Cost')]: asset.purchaseCost || '',
      [getH(aH, 'Vendor')]: asset.vendor || '',
      [getH(aH, 'Invoice_Number')]: asset.invoice || '',
      [getH(aH, 'Warranty_End')]: asset.warrantyEnd || '',
      [getH(aH, 'Created_By')]: userName,
      [getH(aH, 'Timestamp')]: timestamp,
    });

    // 2. Write Dynamic Data to Custom Data Sheet (EAV Model)
    if (customSheet && customFields && customFields.length > 0) {
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
         [getH(hH, 'Remarks')]: 'Initial Asset Registration'
      });
    }

    refreshAssetCache();
    res.json({ success: true, assetId, message: "Asset successfully registered!" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// =========================================================
// 4. GET ALL ASSETS (WITH FILTERS & SEARCH)
// =========================================================
exports.getAssets = async (req, res) => {
  try {
    const cache = getAssetCache();
    const rawAssets = (cache.assets || []).filter(row => canAccessAssetBranch(req, rowValue(row, 'Branch')));

    const assets = rawAssets.map(r => {
      const rd = r.toObject();
      const getVal = (str) => {
        const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
        return k ? rd[k] : '';
      };

      return {
        rowNumber: r.rowNumber,
        assetId: getVal('assetid'),
        name: getVal('assetname'),
        category: getVal('category'),
        subcategory: getVal('subcategory'),
        branch: getVal('branch'),
        location: getVal('location'),
        status: getVal('status') || 'AVAILABLE',
        condition: getVal('condition') || 'GOOD',
        brand: getVal('brand'),
        model: getVal('model'),
        purchaseDate: getVal('purchasedate'),
        purchaseCost: isAssetAdmin(req) ? getVal('purchasecost') : '',
        vendor: getVal('vendor'),
        invoice: getVal('invoicenumber'),
        warrantyEnd: getVal('warrantyend'),
        createdBy: getVal('createdby'),
        timestamp: getVal('timestamp')
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
      return { assignmentId: getVal('assignmentid'), employeeName: getVal('employeename'), assignedBy: getVal('assignedby'), assignedDate: getVal('assigneddate'), returnedDate: getVal('returneddate'), status: getVal('status') };
    }).reverse();

    // 4. Audit Trail
    const history = (cache.history || []).filter(r => {
      const rd = r.toObject();
      const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === 'assetid');
      return (rd[k] || '').toString().trim().toLowerCase() === cleanId;
    }).map(r => {
      const rd = r.toObject();
      const getVal = (str) => { const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, '')); return k ? rd[k] : ''; };
      return { action: getVal('action'), performedBy: getVal('performedby'), timestamp: getVal('timestamp'), remarks: getVal('remarks') };
    }).reverse();

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

    res.json({ success: true, customSpecs, assignments, history, documents });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// =========================================================
// 6. ASSIGN ASSET TO EMPLOYEE
// =========================================================
exports.assignAsset = async (req, res) => {
  try {
    const { assetId, employeeName, employeeId, conditionOnIssue, accessories, remarks, userName } = req.body;

    const getSheet = (keyword) => assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes(keyword));
    const assetSheet = getSheet('assets');
    const assignmentSheet = getSheet('assignments');
    const historySheet = getSheet('history');

    // 1. Locate Row in 07_Assets
    const rows = await assetSheet.getRows();
    const assetRow = rows.find(r => {
      const rd = r.toObject();
      const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === 'assetid');
      return (rd[k] || '').toString().trim().toLowerCase() === assetId.trim().toLowerCase();
    });

    if (!assetRow) return res.status(404).json({ success: false, message: "Asset row not found." });
    const assetBranch = assetRow.get(getH(assetSheet.headerValues, 'Branch')) || '';
    if (!canAccessAssetBranch(req, assetBranch)) return res.status(403).json({ success: false, message: 'This asset is outside your branch assignment.' });
    const currentStatus = String(assetRow.get(getH(assetSheet.headerValues, 'Status')) || '').toUpperCase();
    if (currentStatus !== 'AVAILABLE') return res.status(409).json({ success: false, message: 'Only available assets can be assigned.' });

    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const assignmentId = `ASN-${Date.now()}`;

    // 2. Update Status to ASSIGNED in 07_Assets
    const aH = assetSheet.headerValues;
    assetRow.assign({
      [getH(aH, 'Status')]: 'ASSIGNED',
      [getH(aH, 'Condition')]: conditionOnIssue || assetRow.get(getH(aH, 'Condition')) || 'GOOD'
    });
    await assetRow.save();

    // 3. Append Row to 09_Assignments
    if (assignmentSheet) {
      const asgH = assignmentSheet.headerValues;
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

    // 4. Log in 17_History
    if (historySheet) {
      const hH = historySheet.headerValues;
      await historySheet.addRow({
        [getH(hH, 'History_ID')]: `HIS-${Date.now()}`,
        [getH(hH, 'Asset_ID')]: assetId,
        [getH(hH, 'Action')]: 'ASSET_ASSIGNED',
        [getH(hH, 'Old_Value')]: 'AVAILABLE',
        [getH(hH, 'New_Value')]: `ASSIGNED to ${employeeName}`,
        [getH(hH, 'Performed_By')]: userName,
        [getH(hH, 'Branch')]: assetBranch,
        [getH(hH, 'Timestamp')]: timestamp,
        [getH(hH, 'Remarks')]: remarks || `Issued with: ${accessories || 'Standard Accessories'}`
      });
    }

    refreshAssetCache();
    res.json({ success: true, message: `Asset successfully assigned to ${employeeName}!` });
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

    const getSheet = (keyword) => assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes(keyword));
    const assetSheet = getSheet('assets');
    const assignmentSheet = getSheet('assignments');
    const historySheet = getSheet('history');

    // 1. Locate Row in 07_Assets
    const rows = await assetSheet.getRows();
    const aH = assetSheet.headerValues;
    const assetRow = rows.find(r => {
      const rd = r.toObject();
      const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === 'assetid');
      return (rd[k] || '').toString().trim().toLowerCase() === assetId.trim().toLowerCase();
    });

    if (!assetRow) return res.status(404).json({ success: false, message: "Asset row not found." });
    const assetBranch = assetRow.get(getH(aH, 'Branch')) || '';
    if (!canAccessAssetBranch(req, assetBranch)) return res.status(403).json({ success: false, message: 'This asset is outside your branch assignment.' });
    if (String(assetRow.get(getH(aH, 'Status')) || '').toUpperCase() !== 'ASSIGNED') {
      return res.status(409).json({ success: false, message: 'This asset does not have an active assignment to return.' });
    }

    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
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
      const asgH = assignmentSheet.headerValues;
      const activeAsg = asgRows.reverse().find(r => {
        const rd = r.toObject();
        const kId = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === 'assetid');
        const kSt = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === 'status');
        return (rd[kId] || '').toString().trim().toLowerCase() === assetId.trim().toLowerCase() && (rd[kSt] || '') === 'ACTIVE';
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

    // 4. Log in 17_History
    if (historySheet) {
      const hH = historySheet.headerValues;
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
        category: getV('category'), 
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
    if (!item?.name || !item?.branch || !Number.isInteger(quantity) || quantity < 0 || !Number.isInteger(minimumQuantity) || minimumQuantity < 0) {
      return res.status(400).json({ success: false, message: 'Item name, branch, whole-number quantity, and minimum quantity are required.' });
    }
    if (!canAccessAssetBranch(req, item.branch)) return res.status(403).json({ success: false, message: 'You cannot manage inventory for that branch.' });
    
    // 🚨 STRICT MATCHER: Ignores the Transaction sheet!
    const invSheet = assetDoc.sheetsByIndex.find(s => {
      const t = s.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      return t.includes('inventory') && !t.includes('transaction');
    });
    
    if (!invSheet) return res.status(404).json({ success: false, message: "Inventory sheet missing." });

    const itemId = `INV-${Date.now().toString().slice(-6)}`;
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const iH = invSheet.headerValues;
    await invSheet.addRow({
      [getH(iH, 'Item_ID')]: itemId, 
      [getH(iH, 'Item_Name')]: item.name, 
      [getH(iH, 'Category')]: item.category, 
      [getH(iH, 'Branch')]: item.branch,
      [getH(iH, 'Quantity')]: quantity,
      [getH(iH, 'Minimum_Quantity')]: minimumQuantity,
      [getH(iH, 'Status')]: quantity === 0 ? 'OUT OF STOCK' : quantity <= minimumQuantity ? 'LOW STOCK' : 'IN STOCK',
      [getH(iH, 'Updated_At')]: timestamp
    });

    const txSheet = assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('inventorytransaction'));
    if (txSheet) {
      const tH = txSheet.headerValues;
      await txSheet.addRow({ 
        [getH(tH, 'Transaction_ID')]: `TX-${Date.now()}`, 
        [getH(tH, 'Item_ID')]: itemId, 
        [getH(tH, 'Type')]: 'INITIAL_STOCK', 
        [getH(tH, 'Quantity')]: item.quantity, 
        [getH(tH, 'Previous')]: 0, 
        [getH(tH, 'New')]: item.quantity, 
        [getH(tH, 'Performed_By')]: userName, 
        [getH(tH, 'Date')]: timestamp 
      });
    }
    
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
    
    // 🚨 STRICT MATCHER
    const invSheet = assetDoc.sheetsByIndex.find(s => {
      const t = s.title.toLowerCase().replace(/[^a-z0-9]/g, '');
      return t.includes('inventory') && !t.includes('transaction');
    });
    
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
      [getH(iH, 'Updated_At')]: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) 
    });
    
    await itemRow.save();

    const txSheet = assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('inventorytransaction'));
    if (txSheet) {
      const tH = txSheet.headerValues;
      await txSheet.addRow({ 
        [getH(tH, 'Transaction_ID')]: `TX-${Date.now()}`, 
        [getH(tH, 'Item_ID')]: itemId, 
      [getH(tH, 'Type')]: normalizedAction === 'IN' ? 'STOCK_IN' : 'STOCK_OUT',
        [getH(tH, 'Quantity')]: change, 
        [getH(tH, 'Previous')]: currentQty, 
        [getH(tH, 'New')]: newQty, 
        [getH(tH, 'Performed_By')]: userName, 
        [getH(tH, 'Date')]: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) 
      });
    }
    
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
    }).filter(t => t.transferId !== '' && (canAccessAssetBranch(req, t.fromBranch) || canAccessAssetBranch(req, t.toBranch)));
    
    res.json({ success: true, transfers: transfers.reverse() });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

exports.requestTransfer = async (req, res) => {
  try {
    const { assetId, toBranch, remarks, userName } = req.body || {};
    if (!assetId || !toBranch) return res.status(400).json({ success: false, message: 'Asset and destination branch are required.' });
    const trfSheet = assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('transfers'));
    if (!trfSheet) return res.status(503).json({ success: false, message: 'Transfer register is unavailable.' });
    const tH = trfSheet.headerValues;
    const assetSheet = assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('assets'));
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

    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
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
    
    refreshAssetCache(); 
    res.status(201).json({ success: true, transferId, message: 'Transfer request submitted for approval.' });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

exports.approveTransfer = async (req, res) => {
  try {
    const { transferId, userName } = req.body || {};
    if (!transferId) return res.status(400).json({ success: false, message: 'Transfer ID is required.' });
    const trfSheet = assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('transfers'));
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
    const assetSheet = assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('assets'));
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
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const approvalUpdate = {
      [getH(tH, 'Status')]: 'IN_TRANSIT',
      [getH(tH, 'Approved_By')]: userName || ''
    };
    const approvedAtHeader = getOptionalH(tH, 'Approved_At') || getOptionalH(tH, 'Dispatched_At');
    if (approvedAtHeader) approvalUpdate[approvedAtHeader] = timestamp;
    trfRow.assign(approvalUpdate);
    await trfRow.save();
    const historySheet = assetDoc.sheetsByIndex.find(sheet => sheet.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('history'));
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

    refreshAssetCache(); 
    res.json({ success: true, message: 'Transfer dispatched. The destination branch must confirm receipt.' });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

exports.receiveTransfer = async (req, res) => {
  try {
    const { transferId, userName, condition, remarks } = req.body || {};
    if (!transferId) return res.status(400).json({ success: false, message: 'Transfer ID is required.' });
    const trfSheet = assetDoc.sheetsByIndex.find(sheet => sheet.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('transfers'));
    const assetSheet = assetDoc.sheetsByIndex.find(sheet => sheet.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('assets'));
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
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
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
    const historySheet = assetDoc.sheetsByIndex.find(sheet => sheet.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('history'));
    if (historySheet) {
      const h = historySheet.headerValues;
      await historySheet.addRow({
        [getH(h, 'History_ID')]: `HIS-${Date.now()}`, [getH(h, 'Asset_ID')]: assetId,
        [getH(h, 'Action')]: 'TRANSFER_RECEIVED', [getH(h, 'Old_Value')]: transferRow.get(getH(tH, 'From_Branch')) || '',
        [getH(h, 'New_Value')]: destination, [getH(h, 'Performed_By')]: userName || '', [getH(h, 'Branch')]: destination,
        [getH(h, 'Timestamp')]: timestamp, [getH(h, 'Remarks')]: `Transfer ${transferId} received. ${remarks || ''}`
      });
    }
    refreshAssetCache();
    res.json({ success: true, message: 'Receipt confirmed and asset branch updated.' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// =========================================================
// 10. MAINTENANCE
// =========================================================
exports.getMaintenance = async (req, res) => {
  try {
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
    const mSheet = assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('maintenance'));
    const assetSheet = assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('assets'));
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
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
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
    const mSheet = assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('maintenance'));
    const assetSheet = assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('assets'));
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
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    mRow.assign({
      [getH(mH, 'Status')]: 'COMPLETED',
      [getH(mH, 'Cost')]: Number(cost),
      [getH(mH, 'Remarks')]: remarks,
      [getH(mH, 'Completed_Date')]: timestamp
    });
    await mRow.save();
    assetRow.assign({ [getH(aH, 'Status')]: previousStatus === 'ASSIGNED' ? 'ASSIGNED' : 'AVAILABLE' });
    await assetRow.save();

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
    const { categoryName, type } = req.body;
    const sheet = assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('categories'));
    if (!sheet) return res.status(404).json({ success: false, message: "Categories sheet missing." });

    const h = sheet.headerValues;
    const catId = `CAT-${Math.floor(1000 + Math.random() * 9000)}`;
    const catCode = categoryName.substring(0, 3).toUpperCase();

    await sheet.addRow({
      [getH(h, 'Category_ID')]: catId,
      [getH(h, 'Category_Code')]: catCode,
      [getH(h, 'Category_Name')]: categoryName,
      [getH(h, 'Type')]: type || 'ASSET',
      [getH(h, 'Status')]: 'ACTIVE'
    });

    refreshAssetCache();
    res.json({ success: true, message: `Category '${categoryName}' added successfully!` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addSubcategory = async (req, res) => {
  try {
    const { categoryId, subcategoryName } = req.body;
    const sheet = assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('subcategories'));
    if (!sheet) return res.status(404).json({ success: false, message: "Subcategories sheet missing." });

    const h = sheet.headerValues;
    const subId = `SUB-${Math.floor(1000 + Math.random() * 9000)}`;
    const subCode = subcategoryName.substring(0, 3).toUpperCase();

    await sheet.addRow({
      [getH(h, 'Subcategory_ID')]: subId,
      [getH(h, 'Category_ID')]: categoryId,
      [getH(h, 'Code')]: subCode,
      [getH(h, 'Name')]: subcategoryName,
      [getH(h, 'Status')]: 'ACTIVE'
    });

    refreshAssetCache();
    res.json({ success: true, message: `Subcategory '${subcategoryName}' added successfully!` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addLocation = async (req, res) => {
  try {
    const { branchName, room, area } = req.body;
    const sheet = assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('locations'));
    if (!sheet) return res.status(404).json({ success: false, message: "Locations sheet missing." });

    const h = sheet.headerValues;
    const locId = `LOC-${Math.floor(1000 + Math.random() * 9000)}`;
    const locationName = `${room} (${area})`;

    await sheet.addRow({
      [getH(h, 'Location_ID')]: locId,
      [getH(h, 'Branch_ID')]: branchName, // Mapping name directly for simplicity in dropdowns
      [getH(h, 'Building')]: 'Main',
      [getH(h, 'Floor')]: '1',
      [getH(h, 'Room')]: room,
      [getH(h, 'Area')]: area,
      [getH(h, 'Location_Name')]: locationName,
      [getH(h, 'Status')]: 'ACTIVE',
      [getH(h, 'Created_At')]: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    });

    refreshAssetCache();
    res.json({ success: true, message: `Location '${locationName}' added successfully to ${branchName}!` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addVendor = async (req, res) => {
  try {
    const { vendorName, contactPerson, phone, email } = req.body;
    const sheet = assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('vendors'));
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
      [getH(h, 'Created_At')]: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
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

    const asset = (await assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('assets'))?.getRows()) || [];
    const assetRow = asset.find(row => String(row.get(getH(row._worksheet.headerValues, 'Asset_ID')) || '').trim().toLowerCase() === String(assetId || '').trim().toLowerCase());
    if (!assetRow) return res.status(404).json({ success: false, message: 'Asset not found.' });
    if (!canAccessAssetBranch(req, assetRow.get(getH(assetRow._worksheet.headerValues, 'Branch')) || '')) return res.status(403).json({ success: false, message: 'This asset is outside your branch assignment.' });

    // Upload to Google Drive using existing helper
    const fileUrl = await uploadToDrive(req.file, process.env.DRIVE_FOLDER_ID || '');
    
    const docSheet = assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('documents'));
    if (!docSheet) return res.status(404).json({ success: false, message: "Documents sheet missing." });

    const h = docSheet.headerValues;
    await docSheet.addRow({
      [getH(h, 'Document_ID')]: `DOC-${Date.now()}`,
      [getH(h, 'Asset_ID')]: assetId,
      [getH(h, 'Document_Type')]: documentType || 'PHOTO',
      [getH(h, 'File_Name')]: req.file.originalname,
      [getH(h, 'Drive_URL')]: fileUrl,
      [getH(h, 'Uploaded_By')]: req.portalUser?.name || '',
      [getH(h, 'Uploaded_At')]: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
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
    const { assetId, reason, method, value, userName } = req.body || {};
    const cleanAssetId = String(assetId || '').trim();
    const cleanReason = String(reason || '').trim();
    const cleanMethod = String(method || '').trim();
    const disposalValue = value === '' || value === undefined || value === null ? 0 : Number(value);
    if (!cleanAssetId || !cleanReason || !cleanMethod || !Number.isFinite(disposalValue) || disposalValue < 0) {
      return res.status(400).json({ success: false, message: 'Asset, disposal reason, method, and a non-negative value are required.' });
    }

    const assetSheet = assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('assets'));
    const dispSheet = assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('disposals'));
    const histSheet = assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('history'));
    if (!assetSheet || !dispSheet || !histSheet) return res.status(503).json({ success: false, message: 'Asset disposal, register, or audit sheet is unavailable. No changes were made.' });

    const rows = await assetSheet.getRows();
    const assetRow = rows.find(r => {
      const rd = r.toObject();
      const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === 'assetid');
      return (rd[k] || '').toString().trim().toLowerCase() === cleanAssetId.toLowerCase();
    });

    if(!assetRow) return res.status(404).json({ success: false, message: "Asset not found." });
    if (!canAccessAssetBranch(req, assetRow.get(getH(assetSheet.headerValues, 'Branch')) || '')) return res.status(403).json({ success: false, message: 'This asset is outside your branch assignment.' });
    const aH = assetSheet.headerValues;
    const oldStatus = String(assetRow.get(getH(aH, 'Status')) || '').toUpperCase();
    if (oldStatus !== 'AVAILABLE') return res.status(409).json({ success: false, message: 'Only available assets can be disposed. Return, complete maintenance, or finish transfers first.' });
    const maintenanceSheet = assetDoc.sheetsByIndex.find(sheet => sheet.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('maintenance'));
    if (maintenanceSheet) {
      const openTicket = (await maintenanceSheet.getRows()).some(row => String(row.get(getH(maintenanceSheet.headerValues, 'Asset_ID')) || '').trim().toLowerCase() === cleanAssetId.toLowerCase() && String(row.get(getH(maintenanceSheet.headerValues, 'Status')) || '').toUpperCase() === 'OPEN');
      if (openTicket) return res.status(409).json({ success: false, message: 'Resolve the open maintenance ticket before disposal.' });
    }

    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const disposalId = `DSP-${Date.now()}`;
    const dH = dispSheet.headerValues;
    await dispSheet.addRow({
      [getH(dH, 'Disposal_ID')]: disposalId,
      [getH(dH, 'Asset_ID')]: cleanAssetId,
      [getH(dH, 'Reason')]: cleanReason,
      [getH(dH, 'Disposal_Method')]: cleanMethod,
      [getH(dH, 'Disposal_Value')]: disposalValue,
      [getH(dH, 'Requested_By')]: userName || '',
      [getH(dH, 'Approved_By')]: userName || '',
      [getH(dH, 'Disposed_Date')]: timestamp,
      [getH(dH, 'Remarks')]: 'Asset permanently retired.'
    });

    assetRow.assign({ [getH(aH, 'Status')]: 'DISPOSED' });
    await assetRow.save();

    const hH = histSheet.headerValues;
    await histSheet.addRow({
       [getH(hH, 'History_ID')]: `HIS-${Date.now()}`,
       [getH(hH, 'Asset_ID')]: cleanAssetId,
       [getH(hH, 'Action')]: 'ASSET_DISPOSED',
       [getH(hH, 'Old_Value')]: oldStatus,
       [getH(hH, 'New_Value')]: 'DISPOSED',
       [getH(hH, 'Performed_By')]: userName || '',
       [getH(hH, 'Timestamp')]: timestamp,
       [getH(hH, 'Remarks')]: `Disposal ${disposalId}; method: ${cleanMethod} | reason: ${cleanReason}`
    });

    refreshAssetCache();
    res.json({ success: true, message: "Asset has been permanently disposed." });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};
