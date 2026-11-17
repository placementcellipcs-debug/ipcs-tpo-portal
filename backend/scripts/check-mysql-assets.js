// This verifier exercises only MySQL. Do not start the legacy Google Sheets
// cache refresh as a side effect of loading the controller modules below.
process.env.SKIP_INITIAL_SHEET_CACHE_REFRESH ||= 'true';

const assert = require('node:assert/strict');
const mysqlPool = require('../src/mysqlPool');
const { controllers } = require('../src/mysqlAssetManagement');

const actor = {
  id: '',
  name: 'Local MySQL Verification',
  email: 'rakesh@ipcsglobal.com',
  role: 'SYSTEM ADMIN',
  accessType: 'superadmin',
  assignedBranchesArray: ['All'],
  sittingBranch: 'All',
};

async function callController(handler, req) {
  let statusCode = 200;
  let payload;
  const res = {
    status(code) { statusCode = code; return this; },
    json(value) { payload = value; return this; },
    set() { return this; },
    send(value) { payload = value; return this; },
  };
  await handler(req, res, error => { if (error) throw error; });
  assert.ok(statusCode < 400, `${req.method || 'GET'} ${req.path || ''} returned ${statusCode}: ${payload?.message || ''}`);
  assert.notEqual(payload?.success, false, payload?.message || 'Controller returned success:false.');
  return payload;
}

async function count(connection, table) {
  const [rows] = await connection.execute(`SELECT COUNT(*) AS total FROM ${table}`);
  return Number(rows[0].total);
}

async function main() {
  if (!mysqlPool.isEnabled()) throw new Error('Set MYSQL_ENABLED=true in the local TPO backend .env before running this local-only verification.');
  const connection = await mysqlPool.getPool().getConnection();
  const originalWithTransaction = mysqlPool.withTransaction;
  const tables = ['assets', 'asset_history', 'asset_activity', 'asset_assignments', 'asset_transfers', 'asset_approvals', 'asset_disposals', 'asset_inventory_items', 'asset_inventory_transactions', 'asset_maintenance_tickets'];
  const before = {};
  const completed = [];
  let transactionOpen = false;
  try {
    await connection.beginTransaction();
    transactionOpen = true;
    for (const table of tables) before[table] = await count(connection, table);
    mysqlPool.withTransaction = callback => callback(connection);

    const readReq = { method: 'GET', portalUser: actor, query: {}, params: {}, get: () => '' };
    const simulate = async (name, operation) => {
      await connection.query('SAVEPOINT local_mysql_asset_check');
      try {
        await operation();
        await connection.query('ROLLBACK TO SAVEPOINT local_mysql_asset_check');
        await connection.query('RELEASE SAVEPOINT local_mysql_asset_check');
        completed.push(name);
      } catch (error) {
        await connection.query('ROLLBACK TO SAVEPOINT local_mysql_asset_check').catch(() => {});
        await connection.query('RELEASE SAVEPOINT local_mysql_asset_check').catch(() => {});
        throw error;
      }
    };
    const form = await callController(controllers.getRegistrationData, readReq);
    assert.ok(form.branches.length > 0, 'MySQL asset form has no branches.');
    assert.ok(form.categories.length > 0, 'MySQL asset form has no categories.');
    assert.ok(form.subcategories.length > 0, 'MySQL asset form has no subcategories.');
    assert.ok(form.assetTypes.length > 0, 'MySQL asset form has no item types.');
    completed.push('asset form data');

    const list = await callController(controllers.getAssets, readReq);
    const existingAsset = list.assets?.[0];
    assert.ok(existingAsset, 'No imported asset is visible in MySQL.');
    await callController(controllers.getAssetDetails, { ...readReq, params: { assetId: existingAsset.assetId } });
    await callController(controllers.getAssetDashboardStats, readReq);
    await callController(controllers.getAssetActivity, readReq);
    await callController(controllers.getMaintenance, readReq);
    await callController(controllers.getAssetNotifications, readReq);
    await callController(controllers.getAssetApprovals, readReq);
    await callController(controllers.getTransfers, readReq);
    await callController(controllers.getInventory, readReq);
    completed.push('asset register/details/dashboard/history/maintenance/approvals/transfers/inventory reads');

    const [activeMaintenance] = await connection.execute("SELECT DISTINCT asset_id FROM asset_maintenance_tickets WHERE LOWER(status) IN ('open','in_progress','pending')");
    const [activeTransfers] = await connection.execute("SELECT DISTINCT asset_id FROM asset_transfers WHERE LOWER(status) IN ('pending','in_transit')");
    const unavailableAssetIds = new Set([...activeMaintenance, ...activeTransfers].map(row => row.asset_id));
    const availableRows = list.assets.filter(item => item.status === 'AVAILABLE' && item.trackingMode !== 'QUANTITY' && !item.assignedTo
      && item.branchId && !unavailableAssetIds.has(item.id))
      .map(item => ({ asset_code: item.assetId, status: item.status, branch_id: item.branchId, id: item.id }));
    const [branchRows] = await connection.execute('SELECT id, name FROM branches ORDER BY name');

    const reusableAsset = availableRows[0];
    if (reusableAsset) {
      await simulate('transactional asset assignment', async () => {
        const assignmentReq = {
          method: 'POST', path: 'assign', portalUser: actor, params: {}, query: {},
          body: { assetId: reusableAsset.asset_code, employeeName: 'Local MySQL Verification', employeeId: 'LOCAL-VERIFY', conditionOnIssue: 'GOOD', remarks: 'Rollback-only local integration verification.' },
          files: {},
        };
        await callController(controllers.assignAsset, assignmentReq);
      });
      await simulate('damage report and maintenance ticket creation', async () => {
        const damage = await callController(controllers.markAssetDamaged, {
          method: 'POST', path: 'damage', portalUser: actor, params: { assetId: reusableAsset.asset_code }, query: {}, body: { issue: 'Rollback-only local maintenance verification.' },
        });
        assert.ok(damage.maintenanceId, 'Damage report did not create a maintenance ticket.');
      });

      await simulate('asset edit and audit history', async () => {
        const details = await callController(controllers.getAssetDetails, { ...readReq, params: { assetId: reusableAsset.asset_code } });
        const originalName = details.asset.name;
        const updatedName = `${originalName} (local check)`;
        await callController(controllers.updateAsset, {
          method: 'PUT', path: 'asset-update', portalUser: actor, params: { assetId: reusableAsset.asset_code }, query: {},
          body: { asset: { ...details.asset, name: updatedName }, customFields: details.customSpecs }, files: {},
        });
        const [updatedRows] = await connection.execute('SELECT name FROM assets WHERE id = ?', [reusableAsset.id]);
        const [historyRows] = await connection.execute("SELECT action FROM asset_history WHERE asset_id = ? AND action = 'ASSET_UPDATED' ORDER BY occurred_at DESC LIMIT 1", [reusableAsset.id]);
        assert.equal(updatedRows[0]?.name, updatedName, 'Asset edit did not update the register row.');
        assert.equal(historyRows[0]?.action, 'ASSET_UPDATED', 'Asset edit did not write an audit-history event.');
      });

      await simulate('asset archive and audit history', async () => {
        await callController(controllers.archiveAsset, {
          method: 'POST', path: 'asset-archive', portalUser: actor, params: { assetId: reusableAsset.asset_code }, query: {},
          body: { reason: 'Rollback-only local archive verification.' },
        });
        const [archivedRows] = await connection.execute('SELECT status FROM assets WHERE id = ?', [reusableAsset.id]);
        const [historyRows] = await connection.execute("SELECT action FROM asset_history WHERE asset_id = ? AND action = 'ASSET_ARCHIVED' ORDER BY occurred_at DESC LIMIT 1", [reusableAsset.id]);
        assert.equal(archivedRows[0]?.status, 'archived', 'Remove action did not archive the asset.');
        assert.equal(historyRows[0]?.action, 'ASSET_ARCHIVED', 'Remove action did not write an audit-history event.');
      });
    }

    const transferAsset = availableRows.find(item => branchRows.some(branch => branch.id !== item.branch_id));
    if (transferAsset) {
      const sourceBranch = branchRows.find(branch => branch.id === transferAsset.branch_id);
      const destination = branchRows.find(branch => branch.id !== transferAsset.branch_id);
      await simulate('transfer request, approval, receipt, and disposal approval', async () => {
        const transfer = await callController(controllers.requestTransfer, {
          method: 'POST', path: 'transfer-request', portalUser: actor, params: {}, query: {},
          body: { assetId: transferAsset.asset_code, toBranch: destination.name, remarks: 'Rollback-only local transfer verification.' },
        });
        await callController(controllers.approveTransfer, { method: 'POST', path: 'transfer-approve', portalUser: actor, params: {}, query: {}, body: { transferId: transfer.transferId } });
        const received = await callController(controllers.receiveTransfer, { method: 'POST', path: 'transfer-receive', portalUser: actor, params: {}, query: {}, body: { transferId: transfer.transferId, condition: 'GOOD', remarks: 'Rollback-only local receipt verification.' } });
        assert.equal(received.branch, destination.name, 'Receipt did not set the destination branch.');
        assert.ok(sourceBranch, 'Transfer source branch did not resolve.');
        const disposal = await callController(controllers.disposeAsset, {
          method: 'POST', path: 'dispose', portalUser: actor, params: {}, query: {},
          body: { assetId: transferAsset.asset_code, reason: 'Rollback-only local disposal verification.', method: 'Recycling', value: 0 },
        });
        await callController(controllers.decideAssetApproval, {
          method: 'POST', path: 'disposal-approval', portalUser: actor, params: { requestId: disposal.requestId }, query: {}, body: { decision: 'APPROVED' },
        });
      });
    }

    const [consumables] = await connection.execute(
      `SELECT typ.id AS type_id, typ.name AS type_name, sub.id AS subcategory_id, sub.name AS subcategory_name,
              cat.id AS category_id, cat.name AS category_name
         FROM asset_classifications typ
         JOIN asset_classifications sub ON sub.id = typ.parent_id
         JOIN asset_classifications cat ON cat.id = sub.parent_id
        WHERE typ.kind = 'asset_type' AND LOWER(typ.status) = 'active' AND LOWER(typ.type_class) LIKE '%consum%'
        ORDER BY typ.name LIMIT 1`,
    );
    if (consumables[0] && branchRows[0]) {
      const type = consumables[0];
      await simulate('consumable creation and stock ledger update', async () => {
        const inventory = await callController(controllers.addInventory, {
          method: 'POST', path: 'inventory-add', portalUser: actor, params: {}, query: {},
          body: { item: { name: 'Rollback-only inventory verification', category: type.category_name, categoryId: type.category_id, subcategory: type.subcategory_name, subcategoryId: type.subcategory_id, assetType: type.type_name, assetTypeId: type.type_id, branch: branchRows[0].name, quantity: 5, minQuantity: 1, unit: 'piece' } },
        });
        const stock = await callController(controllers.updateStock, {
          method: 'POST', path: 'inventory-stock', portalUser: actor, params: {}, query: {}, body: { itemId: inventory.itemId, action: 'OUT', quantity: 2 },
        });
        assert.equal(stock.quantity, 3, 'Stock ledger did not apply the stock-out quantity.');
      });
    }

    for (const table of tables) {
      const current = await count(connection, table);
      assert.ok(current >= before[table], `${table} unexpectedly lost rows during the rollback-only check.`);
    }
    await connection.rollback();
    transactionOpen = false;
    for (const table of tables) {
      const [rows] = await connection.execute(`SELECT COUNT(*) AS total FROM ${table}`);
      assert.equal(Number(rows[0].total), before[table], `${table} changed after rollback; inspect local test data before proceeding.`);
    }
    console.log(`MySQL asset verification passed: ${completed.join('; ')}. No simulated writes remained after rollback.`);
  } finally {
    mysqlPool.withTransaction = originalWithTransaction;
    if (transactionOpen) await connection.rollback();
    connection.release();
    await mysqlPool.close();
  }
}

main().catch(error => {
  console.error(`MySQL asset verification failed: ${error.message}`);
  process.exitCode = 1;
});
