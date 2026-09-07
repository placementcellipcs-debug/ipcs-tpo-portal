const { assetDoc, getAssetCache, refreshAssetCache } = require('./assetConfig');
const { getCache } = require('./config');

// Helper to safely map sheet headers regardless of spaces or cases
const getH = (headers, target) => {
  const cleanTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '');
  return headers.find(h => (h||'').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget) || target;
};

// =========================================================
// 1. FETCH FORM PREREQUISITES (DROPDOWNS)
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

    // Map Asset DB Sheets
    const mapSheet = (rows) => rows.map(r => {
      if (typeof r.toObject !== 'function') return {};
      const obj = r.toObject();
      const cleanObj = {};
      Object.keys(obj).forEach(k => { cleanObj[k.toLowerCase().replace(/[^a-z0-9]/g, '')] = obj[k]; });
      return cleanObj;
    });

    res.json({ 
      success: true, 
      branches, 
      categories: mapSheet(cache.categories || []), 
      subcategories: mapSheet(cache.subcategories || []), 
      locations: mapSheet(cache.locations || []), 
      vendors: mapSheet(cache.vendors || []) 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// =========================================================
// 2. REGISTER NEW ASSET
// =========================================================
exports.addAsset = async (req, res) => {
  try {
    const { asset, customFields, userName, userEmail } = req.body;

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
// 3. GET ALL ASSETS (WITH FILTERS & SEARCH)
// =========================================================
exports.getAssets = async (req, res) => {
  try {
    const cache = getAssetCache();
    const rawAssets = cache.assets || [];

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
        purchaseCost: getVal('purchasecost'),
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
// 4. GET ASSET DETAILS (CUSTOM SPECS, ASSIGNMENT & AUDIT HISTORY)
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

    // 2. Custom Specifications (from 08_Asset_Custom_Data)
    const customSpecs = (cache.assetcustomdata || []).filter(r => {
      const rd = r.toObject();
      const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === 'assetid');
      return (rd[k] || '').toString().trim().toLowerCase() === cleanId;
    }).map(r => {
      const rd = r.toObject();
      const getVal = (str) => {
        const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
        return k ? rd[k] : '';
      };
      return { name: getVal('fieldname'), value: getVal('fieldvalue') };
    });

    // 3. Assignment History (from 09_Assignments)
    const assignments = (cache.assignments || []).filter(r => {
      const rd = r.toObject();
      const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === 'assetid');
      return (rd[k] || '').toString().trim().toLowerCase() === cleanId;
    }).map(r => {
      const rd = r.toObject();
      const getVal = (str) => {
        const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
        return k ? rd[k] : '';
      };
      return {
        assignmentId: getVal('assignmentid'),
        employeeName: getVal('employeename'),
        assignedBy: getVal('assignedby'),
        assignedDate: getVal('assigneddate'),
        returnedDate: getVal('returneddate'),
        conditionOnIssue: getVal('conditiononissue'),
        conditionOnReturn: getVal('conditiononreturn'),
        accessories: getVal('accessories'),
        remarks: getVal('remarks'),
        status: getVal('status')
      };
    }).reverse();

    // 4. Audit Trail (from 17_History)
    const history = (cache.history || []).filter(r => {
      const rd = r.toObject();
      const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === 'assetid');
      return (rd[k] || '').toString().trim().toLowerCase() === cleanId;
    }).map(r => {
      const rd = r.toObject();
      const getVal = (str) => {
        const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
        return k ? rd[k] : '';
      };
      return {
        action: getVal('action'),
        oldValue: getVal('oldvalue'),
        newValue: getVal('newvalue'),
        performedBy: getVal('performedby'),
        branch: getVal('branch'),
        timestamp: getVal('timestamp'),
        remarks: getVal('remarks')
      };
    }).reverse();

    res.json({
      success: true,
      customSpecs,
      assignments,
      history
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// =========================================================
// 5. ASSIGN ASSET TO EMPLOYEE
// =========================================================
exports.assignAsset = async (req, res) => {
  try {
    const { assetId, employeeName, employeeId, conditionOnIssue, accessories, remarks, userName, userBranch } = req.body;

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
        [getH(asgH, 'Branch_ID')]: userBranch || assetRow.get(getH(aH, 'Branch')) || '',
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
        [getH(hH, 'Branch')]: userBranch || assetRow.get(getH(aH, 'Branch')),
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
// 6. RETURN ASSET FROM EMPLOYEE
// =========================================================
exports.returnAsset = async (req, res) => {
  try {
    const { assetId, conditionOnReturn, returnStatus, remarks, userName, userBranch } = req.body;

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
        [getH(hH, 'Branch')]: userBranch || assetRow.get(getH(aH, 'Branch')),
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