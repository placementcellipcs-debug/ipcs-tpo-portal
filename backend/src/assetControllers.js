const { assetDoc, getAssetCache, refreshAssetCache } = require('./assetConfig');
const { getCache } = require('./config');

// Helper to safely map sheet headers regardless of spaces or cases
const getH = (headers, target) => {
  const cleanTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '');
  return headers.find(h => (h||'').toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget) || target;
};

// =========================================================
// 1. ASSET DASHBOARD ANALYTICS
// =========================================================
exports.getAssetDashboardStats = async (req, res) => {
  try {
    const cache = getAssetCache();
    const assets = cache.assets || [];
    const inventory = cache.inventory || [];
    const maintenance = cache.maintenance || [];

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
        totalValue, 
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
// 3. REGISTER NEW ASSET
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
// 4. GET ALL ASSETS (WITH FILTERS & SEARCH)
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
// 5. GET ASSET DETAILS (CUSTOM SPECS, ASSIGNMENT & AUDIT HISTORY)
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
// 6. ASSIGN ASSET TO EMPLOYEE
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
// 7. RETURN ASSET FROM EMPLOYEE
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
    }).filter(i => i.itemId !== '');
    
    res.json({ success: true, inventory: inventory.reverse() });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

exports.addInventory = async (req, res) => {
  try {
    const { item, userName } = req.body;
    
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
      [getH(iH, 'Quantity')]: item.quantity, 
      [getH(iH, 'Minimum_Quantity')]: item.minQuantity, 
      [getH(iH, 'Status')]: 'IN STOCK', 
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
    const { itemId, action, quantity, userName } = req.body; 
    
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

    const iH = invSheet.headerValues;
    const currentQty = parseInt(itemRow.get(getH(iH, 'Quantity')) || 0);
    const change = parseInt(quantity);
    const newQty = action === 'IN' ? currentQty + change : currentQty - change;

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
        [getH(tH, 'Type')]: action === 'IN' ? 'STOCK_IN' : 'STOCK_OUT', 
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
        status: getV('status'), 
        date: getV('requestedat'), 
        assetId: getV('assetid') 
      };
    }).filter(t => t.transferId !== '');
    
    res.json({ success: true, transfers: transfers.reverse() });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

exports.requestTransfer = async (req, res) => {
  try {
    const { assetId, toBranch, remarks, userName, userBranch } = req.body;
    const trfSheet = assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('transfers'));
    const tH = trfSheet.headerValues;
    
    await trfSheet.addRow({
      [getH(tH, 'Transfer_ID')]: `TRF-${Date.now()}`, 
      [getH(tH, 'Asset_ID')]: assetId, 
      [getH(tH, 'From_Branch')]: userBranch, 
      [getH(tH, 'To_Branch')]: toBranch,
      [getH(tH, 'Requested_By')]: userName, 
      [getH(tH, 'Status')]: 'PENDING', 
      [getH(tH, 'Requested_At')]: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), 
      [getH(tH, 'Remarks')]: remarks
    });

    const assetSheet = assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('assets'));
    const rows = await assetSheet.getRows();
    const assetRow = rows.find(r => { 
      const rd = r.toObject(); 
      const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === 'assetid'); 
      return (rd[k] || '').toString().trim().toLowerCase() === assetId.trim().toLowerCase(); 
    });
    
    if(assetRow) { 
      assetRow.assign({ [getH(assetSheet.headerValues, 'Status')]: 'TRANSFER_PENDING' }); 
      await assetRow.save(); 
    }
    
    refreshAssetCache(); 
    res.json({ success: true, message: "Transfer requested successfully!" });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

exports.approveTransfer = async (req, res) => {
  try {
    const { transferId, assetId, toBranch, userName } = req.body;
    const trfSheet = assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('transfers'));
    const rows = await trfSheet.getRows();
    const tH = trfSheet.headerValues;
    
    const trfRow = rows.find(r => { 
      const rd = r.toObject(); 
      const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === 'transferid'); 
      return (rd[k] || '').toString().trim().toLowerCase() === transferId.trim().toLowerCase(); 
    });
    
    if(trfRow) {
      trfRow.assign({ 
        [getH(tH, 'Status')]: 'COMPLETED', 
        [getH(tH, 'Approved_By')]: userName, 
        [getH(tH, 'Completed_At')]: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) 
      });
      await trfRow.save();
    }

    const assetSheet = assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('assets'));
    const aRows = await assetSheet.getRows();
    
    const assetRow = aRows.find(r => { 
      const rd = r.toObject(); 
      const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === 'assetid'); 
      return (rd[k] || '').toString().trim().toLowerCase() === assetId.trim().toLowerCase(); 
    });
    
    if(assetRow) {
      const aH = assetSheet.headerValues;
      assetRow.assign({ [getH(aH, 'Status')]: 'AVAILABLE', [getH(aH, 'Branch')]: toBranch });
      await assetRow.save();
    }

    refreshAssetCache(); 
    res.json({ success: true, message: "Transfer approved and branch updated!" });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

// =========================================================
// 10. MAINTENANCE
// =========================================================
exports.getMaintenance = async (req, res) => {
  try {
    const cache = getAssetCache();
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
    }).filter(m => m.maintenanceId !== '');
    
    res.json({ success: true, maintenance: maintenance.reverse() });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

exports.reportMaintenance = async (req, res) => {
  try {
    const { assetId, issue, userName } = req.body;
    const mSheet = assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('maintenance'));
    const mH = mSheet.headerValues;
    
    await mSheet.addRow({
      [getH(mH, 'Maintenance_ID')]: `MNT-${Date.now()}`, 
      [getH(mH, 'Asset_ID')]: assetId, 
      [getH(mH, 'Issue')]: issue,
      [getH(mH, 'Reported_By')]: userName, 
      [getH(mH, 'Status')]: 'OPEN', 
      [getH(mH, 'Reported_Date')]: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    });

    const assetSheet = assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('assets'));
    const rows = await assetSheet.getRows();
    
    const assetRow = rows.find(r => { 
      const rd = r.toObject(); 
      const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === 'assetid'); 
      return (rd[k] || '').toString().trim().toLowerCase() === assetId.trim().toLowerCase(); 
    });
    
    if(assetRow) { 
      assetRow.assign({ [getH(assetSheet.headerValues, 'Status')]: 'UNDER_MAINTENANCE' }); 
      await assetRow.save(); 
    }
    
    refreshAssetCache(); 
    res.json({ success: true, message: "Maintenance reported successfully!" });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

exports.resolveMaintenance = async (req, res) => {
  try {
    const { maintenanceId, assetId, cost, remarks } = req.body;
    const mSheet = assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('maintenance'));
    const rows = await mSheet.getRows();
    const mH = mSheet.headerValues;
    
    const mRow = rows.find(r => { 
      const rd = r.toObject(); 
      const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === 'maintenanceid'); 
      return (rd[k] || '').toString().trim().toLowerCase() === maintenanceId.trim().toLowerCase(); 
    });
    
    if(mRow) {
      mRow.assign({ 
        [getH(mH, 'Status')]: 'COMPLETED', 
        [getH(mH, 'Cost')]: cost, 
        [getH(mH, 'Remarks')]: remarks, 
        [getH(mH, 'Completed_Date')]: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) 
      });
      await mRow.save();
    }

    const assetSheet = assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('assets'));
    const aRows = await assetSheet.getRows();
    
    const assetRow = aRows.find(r => { 
      const rd = r.toObject(); 
      const k = Object.keys(rd).find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === 'assetid'); 
      return (rd[k] || '').toString().trim().toLowerCase() === assetId.trim().toLowerCase(); 
    });
    
    if(assetRow) { 
      assetRow.assign({ [getH(assetSheet.headerValues, 'Status')]: 'AVAILABLE' }); 
      await assetRow.save(); 
    }

    refreshAssetCache(); 
    res.json({ success: true, message: "Asset resolved and available!" });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};