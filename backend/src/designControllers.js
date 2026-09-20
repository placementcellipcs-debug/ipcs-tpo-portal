const { doc, getCache, uploadToDrive } = require('./config');

const getFuzzyHeader = (headers, target) => {
  const cleanTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '');
  return headers.find(h => h.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget) || target;
};

// 🚨 UPDATE THESE TO YOUR ACTUAL GOOGLE DRIVE FOLDER IDS
const FOLDER_POSTERS = 'YOUR_POSTER_FOLDER_ID_HERE'; 
const FOLDER_VIDEOS = 'YOUR_VIDEO_FOLDER_ID_HERE';

// 📌 LOG ACTIVITY HELPER
const logDesignActivity = async (user, designId, action, remarks = '') => {
  try {
    const sheet = doc.sheetsByTitle["05_Design_Activity_Log"];
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
    // Load all 6 sheets
    const tSheet = doc.sheetsByTitle["01_Design_Tasks"];
    const fSheet = doc.sheetsByTitle["02_Design_Files"];
    const cSheet = doc.sheetsByTitle["03_Design_Categories"];
    const sSheet = doc.sheetsByTitle["04_Design_Social_Media"];
    const lSheet = doc.sheetsByTitle["05_Design_Activity_Log"];
    const cfgSheet = doc.sheetsByTitle["06_Design_Settings"];

    if (!tSheet) return res.status(404).json({ success: false, message: "Design Tasks sheet missing" });

    // Parallel fetch for speed
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
      designType: r.get(getFuzzyHeader(th, 'designtype')) || 'Poster',
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

    res.json({ success: true, tasks: tasks.reverse(), files: files.reverse(), social: social.reverse(), logs: logs.reverse() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.uploadDesignFile = async (req, res) => {
  try {
    const { designId, sessionLevel, status, user } = req.body;
    let fileLink = '';

    if (req.file) {
      fileLink = await uploadToDrive(req.file, FOLDER_POSTERS);
    }

    // 1. Update 01_Design_Tasks
    const tSheet = doc.sheetsByTitle["01_Design_Tasks"];
    const tRows = await tSheet.getRows();
    const th = tSheet.headerValues;
    const taskRow = tRows.find(r => r.get(getFuzzyHeader(th, 'designid')) === designId);

    if (taskRow) {
      const updateData = { [getFuzzyHeader(th, 'status')]: status };
      if (status === 'Completed') updateData[getFuzzyHeader(th, 'completeddate')] = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

      if (sessionLevel === 'Session 1') {
        updateData[getFuzzyHeader(th, 'session1status')] = status;
        if (fileLink) updateData[getFuzzyHeader(th, 'session1file')] = fileLink;
        updateData[getFuzzyHeader(th, 'session1date')] = new Date().toLocaleString('en-IN');
      } else {
        updateData[getFuzzyHeader(th, 'session2status')] = status;
        if (fileLink) updateData[getFuzzyHeader(th, 'session2file')] = fileLink;
        updateData[getFuzzyHeader(th, 'session2date')] = new Date().toLocaleString('en-IN');
      }
      taskRow.assign(updateData);
      await taskRow.save();
    }

    // 2. Log to 02_Design_Files
    if (fileLink) {
        const fSheet = doc.sheetsByTitle["02_Design_Files"];
        if (fSheet) {
            const fh = fSheet.headerValues;
            await fSheet.addRow({
                [getFuzzyHeader(fh, 'fileid')]: `FIL-${Date.now().toString().slice(-6)}`,
                [getFuzzyHeader(fh, 'designid')]: designId,
                [getFuzzyHeader(fh, 'session')]: sessionLevel,
                [getFuzzyHeader(fh, 'filename')]: req.file.originalname,
                [getFuzzyHeader(fh, 'filetype')]: req.file.mimetype,
                [getFuzzyHeader(fh, 'drivelink')]: fileLink,
                [getFuzzyHeader(fh, 'uploadedby')]: user || 'Designer',
                [getFuzzyHeader(fh, 'uploadeddate')]: new Date().toLocaleString('en-IN')
            });
        }
    }

    // 3. Log to 05_Design_Activity_Log
    await logDesignActivity(user, designId, `Uploaded ${sessionLevel} File and set status to ${status}`);

    res.json({ success: true, message: "File updated successfully", link: fileLink });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.trackSocialMedia = async (req, res) => {
  try {
    const { designId, platform, postType, postLink, status, user } = req.body;
    const sSheet = doc.sheetsByTitle["04_Design_Social_Media"];
    if (!sSheet) return res.status(404).json({ success: false });

    const sh = sSheet.headerValues;
    await sSheet.addRow({
      [getFuzzyHeader(sh, 'socialid')]: `SOC-${Date.now().toString().slice(-5)}`,
      [getFuzzyHeader(sh, 'designid')]: designId,
      [getFuzzyHeader(sh, 'platform')]: platform,
      [getFuzzyHeader(sh, 'posttype')]: postType,
      [getFuzzyHeader(sh, 'postlink')]: postLink,
      [getFuzzyHeader(sh, 'status')]: status || 'Published',
      [getFuzzyHeader(sh, 'postedby')]: user || 'System',
      [getFuzzyHeader(sh, 'publisheddate')]: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    });

    await logDesignActivity(user, designId, `Published ${postType} on ${platform}`);

    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// 🚨 PLACEMENT AUTOMATION TRIGGER
exports.autoCreateDesignTask = async (appData) => {
  try {
    const status = String(appData.status || '').toLowerCase();
    if (!status.includes('placed') && !status.includes('joined') && !status.includes('got offer')) return;

    const sheet = doc.sheetsByTitle["01_Design_Tasks"];
    if (!sheet) return;

    const rows = await sheet.getRows();
    const h = sheet.headerValues;
    const safeH = (target) => getFuzzyHeader(h, target);
    
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

    const designId = `DES-${Math.floor(10000 + Math.random() * 90000)}`;

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
      [safeH('designcategory')]: 'Placement',
      [safeH('designtype')]: 'Placement Poster',
      [safeH('status')]: 'Pending'
    });

    await logDesignActivity('System Automation', designId, `Auto-Created Design Task for ${appData.name}`);

  } catch(e) { console.error("Auto Create Design Error:", e); }
};