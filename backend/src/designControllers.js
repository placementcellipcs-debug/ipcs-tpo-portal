const { JWT } = require('google-auth-library');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { getCache, uploadToDrive, doc: mainDoc } = require('./config');

// Authenticate specifically for the new Design Spreadsheet
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
  scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
});

// The New Design Sheet ID
const designDoc = new GoogleSpreadsheet('149BVIP9GDXjPx3QYWE_b_6Wt4-J4Slu0kfYWWubu8sI', serviceAccountAuth);
let isDesignDocLoaded = false;

async function loadDesignDoc() {
  if (!isDesignDocLoaded) {
    await designDoc.loadInfo();
    isDesignDocLoaded = true;
  }
}

const getFuzzyHeader = (headers, target) => {
  const cleanTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '');
  return headers.find(h => h.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget) || target;
};

// 📌 LOG ACTIVITY HELPER
const logDesignActivity = async (user, designId, action, remarks = '') => {
  try {
    await loadDesignDoc();
    const sheet = designDoc.sheetsByTitle["Design_Activity_Log"];
    if (!sheet) return;
    const h = sheet.headerValues;
    await sheet.addRow({
      [getFuzzyHeader(h, 'logid')]: `LOG-${Date.now().toString().slice(-6)}`,
      [getFuzzyHeader(h, 'datetime')]: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      [getFuzzyHeader(h, 'user')]: user || 'System',
      [getFuzzyHeader(h, 'designid')]: designId,
      [getFuzzyHeader(h, 'action')]: action,
      [getFuzzyHeader(h, 'remarks')]: remarks
    });
  } catch(e) { console.error("Failed to log design activity:", e); }
};

exports.getDesignDashboardData = async (req, res) => {
  try {
    await loadDesignDoc();
    const tSheet = designDoc.sheetsByTitle["Design_Tasks"];
    const fSheet = designDoc.sheetsByTitle["Design_Files"];
    const cSheet = designDoc.sheetsByTitle["Design_Categories"];
    const sSheet = designDoc.sheetsByTitle["Design_Social_Media"];
    const lSheet = designDoc.sheetsByTitle["Design_Activity_Log"];
    const cfgSheet = designDoc.sheetsByTitle["Design_Settings"];

    if (!tSheet) return res.status(404).json({ success: false, message: "Design Tasks sheet missing" });

    // Fetch all sheets in parallel
    const [tRows, fRows, cRows, sRows, lRows, cfgRows] = await Promise.all([
      tSheet.getRows(),
      fSheet ? fSheet.getRows() : [],
      cSheet ? cSheet.getRows() : [],
      sSheet ? sSheet.getRows() : [],
      lSheet ? lSheet.getRows() : [],
      cfgSheet ? cfgSheet.getRows() : []
    ]);

    const th = tSheet.headerValues;
    const tasks = tRows.map(r => ({
      designId: r.get(getFuzzyHeader(th, 'designid')) || '',
      createdDate: r.get(getFuzzyHeader(th, 'createddate')) || '',
      source: r.get(getFuzzyHeader(th, 'source')) || '',
      roll: r.get(getFuzzyHeader(th, 'rollnumber')) || '',
      studentName: r.get(getFuzzyHeader(th, 'studentname')) || '',
      course: r.get(getFuzzyHeader(th, 'course')) || '',
      branch: r.get(getFuzzyHeader(th, 'branch')) || '',
      company: r.get(getFuzzyHeader(th, 'company')) || '',
      position: r.get(getFuzzyHeader(th, 'position')) || '',
      package: r.get(getFuzzyHeader(th, 'package')) || '',
      profilePhoto: r.get(getFuzzyHeader(th, 'profilephoto')) || '',
      designCategory: r.get(getFuzzyHeader(th, 'designcategory')) || '',
      designType: r.get(getFuzzyHeader(th, 'designtype')) || 'Placement Poster',
      status: r.get(getFuzzyHeader(th, 'status')) || 'Pending',
      session1Status: r.get(getFuzzyHeader(th, 'session1status')) || '',
      session1File: r.get(getFuzzyHeader(th, 'session1file')) || '',
      session2Status: r.get(getFuzzyHeader(th, 'session2status')) || '',
      session2File: r.get(getFuzzyHeader(th, 'session2file')) || '',
    }));

    const files = fRows.map(r => ({
      fileId: r.get(getFuzzyHeader(fSheet.headerValues, 'fileid')),
      designId: r.get(getFuzzyHeader(fSheet.headerValues, 'designid')),
      session: r.get(getFuzzyHeader(fSheet.headerValues, 'session')),
      fileName: r.get(getFuzzyHeader(fSheet.headerValues, 'filename')),
      fileType: r.get(getFuzzyHeader(fSheet.headerValues, 'filetype')),
      link: r.get(getFuzzyHeader(fSheet.headerValues, 'drivelink')),
      date: r.get(getFuzzyHeader(fSheet.headerValues, 'uploadeddate'))
    }));

    const social = sRows.map(r => ({
      socialId: r.get(getFuzzyHeader(sSheet.headerValues, 'socialid')),
      designId: r.get(getFuzzyHeader(sSheet.headerValues, 'designid')),
      platform: r.get(getFuzzyHeader(sSheet.headerValues, 'platform')),
      postType: r.get(getFuzzyHeader(sSheet.headerValues, 'posttype')),
      link: r.get(getFuzzyHeader(sSheet.headerValues, 'postlink')),
      status: r.get(getFuzzyHeader(sSheet.headerValues, 'status')),
      date: r.get(getFuzzyHeader(sSheet.headerValues, 'publisheddate'))
    }));

    const logs = lRows.map(r => ({
      date: r.get(getFuzzyHeader(lSheet.headerValues, 'datetime')),
      user: r.get(getFuzzyHeader(lSheet.headerValues, 'user')),
      designId: r.get(getFuzzyHeader(lSheet.headerValues, 'designid')),
      action: r.get(getFuzzyHeader(lSheet.headerValues, 'action'))
    }));

    const categories = cRows.map(r => ({
      category: r.get(getFuzzyHeader(cSheet.headerValues, 'category')),
      designType: r.get(getFuzzyHeader(cSheet.headerValues, 'designtype'))
    }));

    let settings = {};
    if (cfgRows.length > 0) {
       settings = {
         posterFolder: cfgRows[0].get(getFuzzyHeader(cfgSheet.headerValues, 'posterfolder')),
         videoFolder: cfgRows[0].get(getFuzzyHeader(cfgSheet.headerValues, 'videofolder')),
         autoPlacement: cfgRows[0].get(getFuzzyHeader(cfgSheet.headerValues, 'autocreateplacementtask'))
       };
    }

    res.json({ success: true, tasks: tasks.reverse(), files: files.reverse(), social: social.reverse(), logs: logs.reverse(), categories, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.uploadDesignFile = async (req, res) => {
  try {
    const { designId, sessionLevel, status, user } = req.body || {};
    const actor = req.portalUser?.name || user || 'Designer';
    const cleanDesignId = String(designId || '').trim();
    const cleanSessionLevel = String(sessionLevel || '').trim();
    const cleanStatus = String(status || '').trim();
    if (!cleanDesignId || !['Session 1', 'Session 2'].includes(cleanSessionLevel)) {
      return res.status(400).json({ success: false, message: 'Choose a valid design task and session.' });
    }
    if (!['In Progress', 'Review', 'Completed'].includes(cleanStatus)) {
      return res.status(400).json({ success: false, message: 'Choose a valid task status.' });
    }
    if (!req.file) return res.status(400).json({ success: false, message: 'Attach a design file before saving this update.' });
    if (cleanStatus === 'Completed' && cleanSessionLevel !== 'Session 2') {
      return res.status(400).json({ success: false, message: 'A task can only be completed with a final Session 2 file.' });
    }
    await loadDesignDoc();

    const tSheet = designDoc.sheetsByTitle['Design_Tasks'];
    if (!tSheet) return res.status(503).json({ success: false, message: 'Design task register is unavailable.' });
    const th = tSheet.headerValues;
    const tRows = await tSheet.getRows();
    const taskRow = tRows.find(row => String(row.get(getFuzzyHeader(th, 'designid')) || '').trim() === cleanDesignId);
    if (!taskRow) return res.status(404).json({ success: false, message: 'Design task was not found.' });
    if (String(taskRow.get(getFuzzyHeader(th, 'status')) || '').trim().toLowerCase() === 'completed') {
      return res.status(409).json({ success: false, message: 'This task is already complete.' });
    }

    // Dynamically pull the Folder ID from Settings, default to an empty string if missing
    let targetFolder = '';
    const cfgSheet = designDoc.sheetsByTitle["Design_Settings"];
    if (cfgSheet) {
      const cRows = await cfgSheet.getRows();
      if (cRows.length > 0) {
        // Automatically put videos in the video folder, everything else in the poster folder
        const isVideo = req.file.mimetype.includes('video');
        targetFolder = isVideo 
          ? cRows[0].get(getFuzzyHeader(cfgSheet.headerValues, 'videofolder')) 
          : cRows[0].get(getFuzzyHeader(cfgSheet.headerValues, 'posterfolder'));
      }
    }

    const fileLink = await uploadToDrive(req.file, targetFolder || '1184PpFnRndFM0pwIt1Qob_FHMs8hPjV5');
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const sessionNumber = cleanSessionLevel === 'Session 1' ? '1' : '2';
    const overallStatus = cleanStatus === 'Completed' ? 'Completed' : cleanStatus;
    const updateData = {
      [getFuzzyHeader(th, `session${sessionNumber}status`)]: cleanStatus,
      [getFuzzyHeader(th, `session${sessionNumber}file`)]: fileLink,
      [getFuzzyHeader(th, `session${sessionNumber}date`)]: timestamp,
      [getFuzzyHeader(th, 'status')]: overallStatus,
    };
    if (cleanStatus === 'Completed') updateData[getFuzzyHeader(th, 'completeddate')] = timestamp;
    taskRow.assign(updateData);
    await taskRow.save();

    // 2. Log to Design_Files
    if (fileLink) {
        const fSheet = designDoc.sheetsByTitle["Design_Files"];
        if (fSheet) {
            const fh = fSheet.headerValues;
            await fSheet.addRow({
                [getFuzzyHeader(fh, 'fileid')]: `FIL-${Date.now().toString().slice(-6)}`,
                [getFuzzyHeader(fh, 'designid')]: designId,
                [getFuzzyHeader(fh, 'session')]: cleanSessionLevel,
                [getFuzzyHeader(fh, 'filename')]: req.file.originalname,
                [getFuzzyHeader(fh, 'filetype')]: req.file.mimetype,
                [getFuzzyHeader(fh, 'drivelink')]: fileLink,
                [getFuzzyHeader(fh, 'uploadedby')]: actor,
                [getFuzzyHeader(fh, 'uploadeddate')]: timestamp
            });
        }
    }

    // 3. Log to Design_Activity_Log
    await logDesignActivity(actor, cleanDesignId, `Uploaded ${cleanSessionLevel} file and set status to ${cleanStatus}`);

    res.json({ success: true, message: "File updated successfully", link: fileLink });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.trackSocialMedia = async (req, res) => {
  try {
    const { designId, platform, postType, postLink, status, user } = req.body;
    const actor = req.portalUser?.name || user || 'System';
    await loadDesignDoc();
    const sSheet = designDoc.sheetsByTitle["Design_Social_Media"];
    if (!sSheet) return res.status(404).json({ success: false });

    const sh = sSheet.headerValues;
    await sSheet.addRow({
      [getFuzzyHeader(sh, 'socialid')]: `SOC-${Date.now().toString().slice(-5)}`,
      [getFuzzyHeader(sh, 'designid')]: designId,
      [getFuzzyHeader(sh, 'platform')]: platform,
      [getFuzzyHeader(sh, 'posttype')]: postType,
      [getFuzzyHeader(sh, 'postlink')]: postLink,
      [getFuzzyHeader(sh, 'status')]: status || 'Published',
      [getFuzzyHeader(sh, 'postedby')]: actor,
      [getFuzzyHeader(sh, 'publisheddate')]: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    });

    await logDesignActivity(actor, designId, `Published ${postType} on ${platform}`);

    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// 🚨 PLACEMENT AUTOMATION TRIGGER
exports.autoCreateDesignTask = async (appData) => {
  try {
    const status = String(appData.status || '').toLowerCase();
    if (!status.includes('placed') && !status.includes('joined') && !status.includes('got offer')) return;

    await loadDesignDoc();
    const sheet = designDoc.sheetsByTitle["Design_Tasks"];
    if (!sheet) return;

    const rows = await sheet.getRows();
    const h = sheet.headerValues;
    const safeH = (target) => getFuzzyHeader(h, target);
    
    // Prevent duplicate tasks for the exact same job role & student
    const exists = rows.find(r => r.get(safeH('rollnumber')) === appData.roll && r.get(safeH('company')) === appData.company);
    if (exists) return;

    let photo = '';
    const cache = getCache();
    if (cache && cache.students) {
      const student = cache.students.find(s => {
        const headers = s._worksheet.headerValues.map(x => x.toLowerCase().replace(/[^a-z0-9]/g, ''));
        const rIndex = headers.indexOf('rollnumber') !== -1 ? headers.indexOf('rollnumber') : headers.findIndex(x => x.includes('roll'));
        return rIndex !== -1 && s._rawData[rIndex] === appData.roll;
      });
      if (student) {
         const pIndex = student._worksheet.headerValues.map(x => x.toLowerCase().replace(/[^a-z0-9]/g, '')).findIndex(x => x.includes('photo'));
         if (pIndex !== -1) photo = student._rawData[pIndex] || '';
      }
    }

    const designId = `DES-${Date.now().toString().slice(-7)}-${Math.floor(100 + Math.random() * 900)}`;

    await sheet.addRow({
      [safeH('designid')]: designId,
      [safeH('createddate')]: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      [safeH('source')]: 'Placement Auto',
      [safeH('rollnumber')]: appData.roll || '',
      [safeH('studentname')]: appData.name || '',
      [safeH('course')]: appData.course || '',
      [safeH('branch')]: appData.branch || '',
      [safeH('profilephoto')]: photo,
      [safeH('jobid')]: appData.jobId || '',
      [safeH('company')]: appData.company || '',
      [safeH('position')]: appData.position || '',
      [safeH('package')]: appData.packageLpa || '',
      [safeH('dateplaced')]: appData.datePlaced || '',
      [safeH('designcategory')]: 'Placement',
      [safeH('designtype')]: 'Placement Poster',
      [safeH('status')]: 'Pending'
    });

    await logDesignActivity('System Automation', designId, `Auto-Created Design Task for ${appData.name}`);

  } catch(e) { console.error("Auto Create Design Error:", e); }
};

// 🚨 ONE-TIME SYNC FOR EXISTING PLACEMENTS (USES CACHE)
exports.syncExistingPlacements = async (req, res) => {
  try {
    await loadDesignDoc();
    const dSheet = designDoc.sheetsByTitle["Design_Tasks"];
    
    if (!dSheet) return res.status(404).json({success: false, message: "Design_Tasks sheet missing in the Design Database."});

    const dRows = await dSheet.getRows();
    const dH = dSheet.headerValues;
    const getDH = (target) => getFuzzyHeader(dH, target);

    let addedCount = 0;
    const cache = getCache();
    
    // 🚨 Safe check to ensure cache is loaded
    if (!cache || !cache.applications) {
        return res.status(503).json({success: false, message: "Main database is still syncing. Please wait 10 seconds and click Sync again."});
    }

    const appRows = cache.applications;
    const existingPlacements = new Set(dRows.map(row => `${String(row.get(getDH('rollnumber')) || '').trim().toLowerCase()}|${String(row.get(getDH('company')) || '').trim().toLowerCase()}`));

    for (let r of appRows) {
      const aH = r._worksheet.headerValues;
      const getAH = (target) => getFuzzyHeader(aH, target);

      const status = String(r.get(getAH('status')) || '').toLowerCase();
      if (status.includes('placed') || status.includes('joined') || status.includes('got offer')) {
        const roll = r.get(getAH('rollnumber')) || '';
        const company = r.get(getAH('companyname')) || r.get(getAH('company')) || '';
        
        // Check if it already exists in the Design sheet to prevent duplicates
        const placementKey = `${String(roll).trim().toLowerCase()}|${String(company).trim().toLowerCase()}`;
        if (!existingPlacements.has(placementKey) && roll && company) {
           // Fetch photo from cache
           let photo = '';
           if (cache.students) {
             const student = cache.students.find(s => {
               const hdrs = s._worksheet.headerValues.map(x => x.toLowerCase().replace(/[^a-z0-9]/g, ''));
               const rIndex = hdrs.indexOf('rollnumber') !== -1 ? hdrs.indexOf('rollnumber') : hdrs.findIndex(x => x.includes('roll'));
               return rIndex !== -1 && s._rawData[rIndex] === roll;
             });
             if (student) {
                const pIndex = student._worksheet.headerValues.map(x => x.toLowerCase().replace(/[^a-z0-9]/g, '')).findIndex(x => x.includes('photo'));
                if (pIndex !== -1) photo = student._rawData[pIndex] || '';
             }
           }

           const designId = `DES-${Date.now().toString().slice(-7)}-${Math.floor(100 + Math.random() * 900)}`;
           await dSheet.addRow({
              [getDH('designid')]: designId,
              [getDH('createddate')]: r.get(getAH('timestamp')) || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
              [getDH('source')]: 'Legacy Sync',
              [getDH('rollnumber')]: roll,
              [getDH('studentname')]: r.get(getAH('studentname')) || r.get(getAH('name')) || '',
              [getDH('course')]: r.get(getAH('course')) || '',
              [getDH('branch')]: r.get(getAH('branch')) || '',
              [getDH('profilephoto')]: photo,
              [getDH('jobid')]: r.get(getAH('jobid')) || '',
              [getDH('company')]: company,
              [getDH('position')]: r.get(getAH('position')) || '',
              [getDH('package')]: r.get(getAH('package')) || '',
              [getDH('dateplaced')]: r.get(getAH('dateplaced')) || '',
              [getDH('designcategory')]: 'Placement',
              [getDH('designtype')]: 'Placement Poster',
              [getDH('status')]: 'Pending'
           });
           existingPlacements.add(placementKey);
           addedCount++;
        }
      }
    }

    await logDesignActivity('System Admin', 'SYNC', `Synced ${addedCount} legacy placements into Design Tasks`);
    res.json({success: true, message: `Successfully synced ${addedCount} existing placements into the Design Queue!`});
  } catch(e) {
    console.error("Sync Error:", e);
    res.status(500).json({success: false, message: `Server Error: ${e.message}`});
  }
};

// 🚨 CREATE MANUAL CATEGORY
exports.addDesignCategory = async (req, res) => {
  try {
    const category = String(req.body?.category || '').trim();
    const designType = String(req.body?.designType || '').trim();
    if (!category || !designType) return res.status(400).json({ success: false, message: 'Category and design type are required.' });
    await loadDesignDoc();
    const sheet = designDoc.sheetsByTitle["Design_Categories"];
    if (!sheet) return res.status(503).json({ success: false, message: 'Design categories are unavailable.' });
    const h = sheet.headerValues;
    const rows = await sheet.getRows();
    const duplicate = rows.some(row => String(row.get(getFuzzyHeader(h, 'category')) || '').trim().toLowerCase() === category.toLowerCase() && String(row.get(getFuzzyHeader(h, 'designtype')) || '').trim().toLowerCase() === designType.toLowerCase());
    if (duplicate) return res.status(409).json({ success: false, message: 'That design type already exists in this category.' });
    await sheet.addRow({
      [getFuzzyHeader(h, 'category')]: category,
      [getFuzzyHeader(h, 'designtype')]: designType
    });
    res.json({ success: true, message: "Category added successfully!" });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};

// 🚨 CREATE MANUAL DESIGN TASK (For Social Media, Visits, etc.)
exports.createManualTask = async (req, res) => {
  try {
    const { studentName, company, designCategory, designType, remarks, user } = req.body || {};
    const cleanName = String(studentName || '').trim();
    const cleanCategory = String(designCategory || '').trim();
    const cleanType = String(designType || '').trim();
    if (!cleanType) return res.status(400).json({ success: false, message: 'Select a design type before creating a task.' });
    await loadDesignDoc();
    const sheet = designDoc.sheetsByTitle["Design_Tasks"];
    if (!sheet) return res.status(503).json({ success: false, message: 'Design task register is unavailable.' });
    const h = sheet.headerValues;
    const designId = `DES-${Date.now().toString().slice(-7)}-${Math.floor(100 + Math.random() * 900)}`;

    await sheet.addRow({
      [getFuzzyHeader(h, 'designid')]: designId,
      [getFuzzyHeader(h, 'createddate')]: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      [getFuzzyHeader(h, 'source')]: 'Manual Request',
      [getFuzzyHeader(h, 'studentname')]: cleanName,
      [getFuzzyHeader(h, 'company')]: String(company || '').trim(),
      [getFuzzyHeader(h, 'designcategory')]: cleanCategory || 'Custom',
      [getFuzzyHeader(h, 'designtype')]: cleanType,
      [getFuzzyHeader(h, 'remarks')]: remarks || '',
      [getFuzzyHeader(h, 'status')]: 'Pending',
      [getFuzzyHeader(h, 'assignedto')]: req.portalUser?.name || user || ''
    });

    await logDesignActivity(req.portalUser?.name || user || '', designId, `Created custom task: ${cleanType}`);
    res.json({ success: true, message: "Custom task added to Active Queue!" });
  } catch(e) { res.status(500).json({ success: false, message: e.message }); }
};
