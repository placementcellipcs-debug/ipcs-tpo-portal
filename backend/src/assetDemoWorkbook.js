// Synthetic sample content for a separate asset-test spreadsheet only.
// Every person, email, code, and record below is fictional.
const sheets = {
  Branches: {
    headers: ['Branch_ID', 'Branch_Name', 'Status'],
    rows: [['DEMO-BR-01', 'Demo Bengaluru', 'ACTIVE'], ['DEMO-BR-02', 'Demo Mysuru', 'ACTIVE']]
  },
  Users: {
    headers: ['User_ID', 'Name', 'Email', 'Role', 'Access_Type', 'Assigned_Branches', 'Status'],
    rows: [['DEMO-U-01', 'Demo Asset Manager', 'asset.manager@example.invalid', 'BRANCH ASSET MANAGER', 'Asset Manager', 'Demo Bengaluru, Demo Mysuru', 'ACTIVE'], ['DEMO-U-02', 'Demo Branch Manager', 'branch.manager@example.invalid', 'BRANCH MANAGER', '', 'Demo Bengaluru', 'ACTIVE']]
  },
  Employees: {
    headers: ['Employee_ID', 'Employee_Name', 'Branch', 'Email', 'Status'],
    rows: [['DEMO-EMP-01', 'Alex Sample', 'Demo Bengaluru', 'alex.sample@example.invalid', 'ACTIVE'], ['DEMO-EMP-02', 'Robin Sample', 'Demo Mysuru', 'robin.sample@example.invalid', 'ACTIVE']]
  },
  Categories: {
    headers: ['Category_ID', 'Category_Code', 'Category_Name', 'Type', 'Status'],
    rows: [['DEMO-CAT-01', 'LAP', 'Laptop', 'ASSET', 'ACTIVE'], ['DEMO-CAT-02', 'AV', 'Audio Visual', 'ASSET', 'ACTIVE'], ['DEMO-CAT-03', 'OFF', 'Office Supplies', 'CONSUMABLE', 'ACTIVE']]
  },
  Subcategories: {
    headers: ['Subcategory_ID', 'Category_Name', 'Subcategory_Name', 'Status'],
    rows: [['DEMO-SUB-01', 'Laptop', 'Staff laptop', 'ACTIVE'], ['DEMO-SUB-02', 'Audio Visual', 'Projector', 'ACTIVE']]
  },
  Locations: {
    headers: ['Location_ID', 'Branch', 'Location_Name', 'Status'],
    rows: [['DEMO-LOC-01', 'Demo Bengaluru', 'Training room A', 'ACTIVE'], ['DEMO-LOC-02', 'Demo Mysuru', 'Front office', 'ACTIVE']]
  },
  Assets: {
    headers: ['Asset_ID', 'Asset_Name', 'Brand', 'Model', 'Category', 'Subcategory', 'Branch', 'Location', 'Serial_Number', 'Purchase_Date', 'Purchase_Cost', 'Vendor', 'Invoice_Number', 'Warranty_End', 'Depreciation_Method', 'Useful_Life_Years', 'Salvage_Value', 'Status', 'Condition', 'Created_By', 'Timestamp'],
    rows: [
      ['DEMO-AST-001', 'Staff laptop A', 'ExampleTech', 'DemoBook 14', 'Laptop', 'Staff laptop', 'Demo Bengaluru', 'Training room A', 'DEMO-SERIAL-001', '2026-02-10', '58000', 'Demo Vendor Co', 'DEMO-INV-001', '2028-02-10', 'STRAIGHT_LINE', '4', '0', 'ASSIGNED', 'GOOD', 'Demo Asset Manager', '2026-02-10 10:00:00'],
      ['DEMO-AST-002', 'Meeting room projector', 'ExampleView', 'DemoBeam 2', 'Audio Visual', 'Projector', 'Demo Bengaluru', 'Training room A', 'DEMO-SERIAL-002', '2026-03-18', '42000', 'Demo Vendor Co', 'DEMO-INV-002', '2028-03-18', 'STRAIGHT_LINE', '5', '0', 'AVAILABLE', 'EXCELLENT', 'Demo Asset Manager', '2026-03-18 12:30:00'],
      ['DEMO-AST-003', 'Service laptop B', 'ExampleTech', 'DemoBook 13', 'Laptop', 'Staff laptop', 'Demo Bengaluru', 'Front office', 'DEMO-SERIAL-003', '2026-04-08', '51000', 'Demo Vendor Co', 'DEMO-INV-003', '2028-04-08', 'STRAIGHT_LINE', '4', '0', 'UNDER_MAINTENANCE', 'FAIR', 'Demo Asset Manager', '2026-04-08 09:15:00'],
      ['DEMO-AST-004', 'Demo Mysuru laptop', 'ExampleTech', 'DemoBook 14', 'Laptop', 'Staff laptop', 'Demo Mysuru', 'Front office', 'DEMO-SERIAL-004', '2026-05-22', '56000', 'Demo Vendor Co', 'DEMO-INV-004', '2028-05-22', 'STRAIGHT_LINE', '4', '0', 'TRANSFER_PENDING', 'GOOD', 'Demo Asset Manager', '2026-05-22 11:00:00']
    ]
  },
  AssetCustomData: {
    headers: ['Field_ID', 'Asset_ID', 'Field_Name', 'Field_Value'],
    rows: [['DEMO-F-01', 'DEMO-AST-001', 'RAM', '16 GB'], ['DEMO-F-02', 'DEMO-AST-001', 'Storage', '512 GB SSD'], ['DEMO-F-03', 'DEMO-AST-002', 'Lumens', '4200']]
  },
  Assignments: {
    headers: ['Assignment_ID', 'Asset_ID', 'Employee_ID', 'Employee_Name', 'Branch_ID', 'Assigned_By', 'Assigned_Date', 'Returned_Date', 'Condition_On_Issue', 'Condition_On_Return', 'Accessories', 'Remarks', 'Status'],
    rows: [['DEMO-ASG-01', 'DEMO-AST-001', 'DEMO-EMP-01', 'Alex Sample', 'Demo Bengaluru', 'Demo Asset Manager', '2026-02-12 10:00:00', '', 'GOOD', '', 'Charger, bag', 'Demo handover record', 'ACTIVE']]
  },
  Transfers: {
    headers: ['Transfer_ID', 'Asset_ID', 'From_Branch', 'To_Branch', 'Requested_By', 'Requested_At', 'Status', 'Approved_By', 'Approved_At', 'Received_By', 'Received_At', 'Remarks', 'Rejected_By', 'Rejected_At', 'Rejection_Reason'],
    rows: [['DEMO-TRF-01', 'DEMO-AST-004', 'Demo Mysuru', 'Demo Bengaluru', 'Demo Asset Manager', '2026-10-28 14:20:00', 'PENDING', '', '', '', '', 'Synthetic pending request for approval workflow.', '', '', '']]
  },
  TransferItems: { headers: ['Transfer_ID', 'Asset_ID', 'Item_Name', 'Quantity'], rows: [['DEMO-TRF-01', 'DEMO-AST-004', 'Demo Mysuru laptop', '1']] },
  Maintenance: {
    headers: ['Maintenance_ID', 'Asset_ID', 'Issue', 'Reported_By', 'Status', 'Reported_Date', 'Previous_Status', 'Cost', 'Remarks', 'Completed_Date'],
    rows: [['DEMO-MNT-01', 'DEMO-AST-003', 'Synthetic test: battery replacement', 'Demo Asset Manager', 'OPEN', '2026-10-27 09:00:00', 'AVAILABLE', '', 'Test row only', '']]
  },
  Inventory: {
    headers: ['Item_ID', 'Item_Name', 'Category', 'Branch', 'Quantity', 'Minimum_Quantity', 'Unit', 'Updated_By', 'Updated_At'],
    rows: [['DEMO-STK-01', 'Printer paper', 'Office Supplies', 'Demo Bengaluru', '8', '10', 'Reams', 'Demo Asset Manager', '2026-10-28 10:10:00'], ['DEMO-STK-02', 'Whiteboard markers', 'Office Supplies', 'Demo Mysuru', '24', '8', 'Units', 'Demo Asset Manager', '2026-10-28 10:12:00']]
  },
  InventoryTransactions: {
    headers: ['Transaction_ID', 'Item_ID', 'Type', 'Quantity', 'Previous', 'New', 'Performed_By', 'Date'],
    rows: [['DEMO-STX-01', 'DEMO-STK-01', 'STOCK_OUT', '2', '10', '8', 'Demo Asset Manager', '2026-10-28 10:10:00']]
  },
  Vendors: { headers: ['Vendor_ID', 'Vendor_Name', 'Contact_Person', 'Phone', 'Email', 'Address', 'GST_Number'], rows: [['DEMO-VND-01', 'Demo Vendor Co', 'Sample Contact', '0000000000', 'vendor@example.invalid', 'Demo-only address', 'DEMO-GST-000']] },
  Documents: { headers: ['Document_ID', 'Asset_ID', 'Document_Type', 'File_Name', 'Drive_URL', 'Uploaded_By', 'Uploaded_At'], rows: [['DEMO-DOC-01', 'DEMO-AST-001', 'DEMO_SAMPLE', 'demo-invoice-placeholder.txt', '', 'Demo Asset Manager', '2026-02-10 10:05:00']] },
  History: {
    headers: ['History_ID', 'Asset_ID', 'Action', 'Old_Value', 'New_Value', 'Performed_By', 'Branch', 'Timestamp', 'Remarks'],
    rows: [
      ['DEMO-HIS-01', 'DEMO-AST-001', 'ASSET_REGISTERED', '', 'AVAILABLE', 'Demo Asset Manager', 'Demo Bengaluru', '2026-02-10 10:00:00', 'Synthetic demo record'],
      ['DEMO-HIS-02', 'DEMO-AST-001', 'ASSET_ASSIGNED', 'AVAILABLE', 'ASSIGNED to Alex Sample', 'Demo Asset Manager', 'Demo Bengaluru', '2026-02-12 10:00:00', 'Synthetic demo handover'],
      ['DEMO-HIS-03', 'DEMO-AST-003', 'MAINTENANCE_REPORTED', 'AVAILABLE', 'UNDER_MAINTENANCE', 'Demo Asset Manager', 'Demo Bengaluru', '2026-10-27 09:00:00', 'Synthetic sample maintenance ticket'],
      ['DEMO-HIS-04', 'DEMO-AST-004', 'TRANSFER_REQUESTED', 'Demo Mysuru', 'Demo Bengaluru', 'Demo Asset Manager', 'Demo Mysuru', '2026-10-28 14:20:00', 'Synthetic sample transfer approval']
    ]
  },
  Audits: { headers: ['Audit_ID', 'Audit_Name', 'Branch', 'Created_By', 'Created_At', 'Status'], rows: [['DEMO-AUD-01', 'Quarterly sample count', 'Demo Bengaluru', 'Demo Asset Manager', '2026-10-20 10:00:00', 'IN_PROGRESS']] },
  AuditItems: { headers: ['Audit_Item_ID', 'Audit_ID', 'Asset_ID', 'Expected_Status', 'Counted_Status', 'Counted_By', 'Counted_At', 'Remarks'], rows: [['DEMO-AI-01', 'DEMO-AUD-01', 'DEMO-AST-001', 'ASSIGNED', 'ASSIGNED', 'Demo Asset Manager', '2026-10-20 10:10:00', 'Synthetic test match']] },
  Disposals: { headers: ['Disposal_ID', 'Asset_ID', 'Reason', 'Disposal_Method', 'Disposal_Value', 'Requested_By', 'Approved_By', 'Disposed_Date', 'Remarks'], rows: [] },
  Asset_Approvals: { headers: ['Approval_ID', 'Request_ID', 'Request_Type', 'Asset_ID', 'Branch', 'Requested_By', 'Requested_At', 'Decision', 'Decided_By', 'Decided_At', 'Reason'], rows: [['DEMO-APR-01', 'DEMO-TRF-01', 'TRANSFER', 'DEMO-AST-004', 'Demo Mysuru', 'Demo Asset Manager', '2026-10-28 14:20:00', 'PENDING', '', '', 'Synthetic approval queue sample']] },
  Asset_Notification_Log: { headers: ['Notification_ID', 'Event_Type', 'Recipient', 'Subject', 'Delivery_Status', 'Provider', 'Queue_ID', 'Attempt_Count', 'Created_At', 'Last_Error', 'Related_Entity_ID', 'Branch'], rows: [['DEMO-NOT-01', 'TRANSFER_REQUESTED', 'asset.manager@example.invalid', 'Synthetic transfer approval request', 'DEMO_ONLY', 'none', '', '0', '2026-10-28 14:20:01', '', 'DEMO-TRF-01', 'Demo Mysuru']] },
  Asset_QR_Registry: { headers: ['QR_ID', 'Asset_ID', 'QR_Value', 'QR_Version', 'Created_By', 'Created_At', 'Status'], rows: [['DEMO-QR-01', 'DEMO-AST-001', '/assets/register?assetId=DEMO-AST-001', 'PORTAL_LINK_V1', 'Demo Asset Manager', '2026-02-10 10:03:00', 'ACTIVE']] },
  Asset_Activity_Log: { headers: ['Event_ID', 'Timestamp', 'Actor_ID', 'Actor_Name', 'Actor_Email', 'Actor_Role', 'Branch', 'Action', 'Entity_Type', 'Entity_ID', 'Before_JSON', 'After_JSON', 'Source', 'Request_ID'], rows: [['DEMO-EVT-01', '2026-10-28 14:20:00', 'DEMO-U-01', 'Demo Asset Manager', 'asset.manager@example.invalid', 'BRANCH ASSET MANAGER', 'Demo Mysuru', 'TRANSFER_REQUESTED', 'Transfer', 'DEMO-TRF-01', '{"status":"AVAILABLE"}', '{"status":"PENDING"}', 'Demo seed', 'DEMO-REQ-01']] }
};

module.exports = { sheets };
