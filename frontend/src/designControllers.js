const { doc, uploadToDrive } = require('./config');

// Helper for Fuzzy Headers
const getFuzzyHeader = (headers, target) => {
  const cleanTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '');
  return headers.find(h => h.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget) || target;
};

// Replace these with the Drive Folder IDs you created in Phase 1
const FOLDER_POSTERS = 'YOUR_POSTER_FOLDER_ID_HERE'; 
const FOLDER_VIDEOS = 'YOUR_VIDEO_FOLDER_ID_HERE';

exports.getDesignTasks = async (req, res) => {
  try {
    const taskSheet = doc.sheetsByTitle["01_Design_Tasks"];
    const socialSheet = doc.sheetsByTitle["04_Design_Social_Media"];
    if (!taskSheet) return res.status(404).json({ success: false, message: "Design Tasks sheet missing" });

    const rows = await taskSheet.getRows();
    const h = taskSheet.headerValues;

    const tasks = rows.map(r => ({
      designId: r.get(getFuzzyHeader(h, 'designid')) || '',
      studentName: r.get(getFuzzyHeader(h, 'studentname')) || '',
      roll: r.get(getFuzzyHeader(h, 'rollnumber')) || '',
      branch: r.get(getFuzzyHeader(h, 'branch')) || '',
      course: r.get(getFuzzyHeader(h, 'course')) || '',
      company: r.get(getFuzzyHeader(h, 'company')) || '',
      position: r.get(getFuzzyHeader(h, 'position')) || '',
      package: r.get(getFuzzyHeader(h, 'package')) || '',
      profilePhoto: r.get(getFuzzyHeader(h, 'profilephoto')) || '',
      designType: r.get(getFuzzyHeader(h, 'designtype')) || 'Poster',
      status: r.get(getFuzzyHeader(h, 'status')) || 'Pending',
      session1File: r.get(getFuzzyHeader(h, 'session1file')) || '',
      session2File: r.get(getFuzzyHeader(h, 'session2file')) || ''
    }));

    // Generate basic Social Stats
    let published = 0;
    if (socialSheet) {
        const sRows = await socialSheet.getRows();
        published = sRows.length;
    }

    res.json({ success: true, tasks: tasks.reverse(), socialStats: { published } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.uploadDesignFile = async (req, res) => {
  try {
    const { designId, sessionLevel, status } = req.body;
    let fileLink = '';

    if (req.file) {
      // Logic to pick the right folder based on file extension could go here. Defaulting to Posters.
      fileLink = await uploadToDrive(req.file, FOLDER_POSTERS);
    }

    // 1. Update the Main Task Sheet
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

    // 2. Log strictly to 02_Design_Files
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
                [getFuzzyHeader(fh, 'uploadeddate')]: new Date().toLocaleString('en-IN')
            });
        }
    }

    res.json({ success: true, message: "Design file updated successfully", link: fileLink });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.trackSocialMedia = async (req, res) => {
  try {
    const { designId, platform, postType, postLink, status } = req.body;
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
      [getFuzzyHeader(sh, 'publisheddate')]: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    });

    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// 🚨 AUTOMATION EXPORT (Used inside your placement controllers)
exports.autoCreateDesignTask = async (appData) => {
  try {
    const status = String(appData.status || '').toLowerCase();
    if (!status.includes('placed') && !status.includes('joined') && !status.includes('got offer')) return;

    const sheet = doc.sheetsByTitle["01_Design_Tasks"];
    if (!sheet) return;

    const rows = await sheet.getRows();
    const h = sheet.headerValues;
    
    // Prevent duplicates
    const exists = rows.find(r => r.get(getFuzzyHeader(h, 'rollnumber')) === appData.roll && r.get(getFuzzyHeader(h, 'company')) === appData.company);
    if (exists) return;

    const designId = `DES-${Math.floor(10000 + Math.random() * 90000)}`;

    await sheet.addRow({
      [getFuzzyHeader(h, 'designid')]: designId,
      [getFuzzyHeader(h, 'createddate')]: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      [getFuzzyHeader(h, 'source')]: 'Placement Auto',
      [getFuzzyHeader(h, 'rollnumber')]: appData.roll || '',
      [getFuzzyHeader(h, 'studentname')]: appData.name || '',
      [getFuzzyHeader(h, 'course')]: appData.course || '',
      [getFuzzyHeader(h, 'branch')]: appData.branch || '',
      [getFuzzyHeader(h, 'jobid')]: appData.jobId || '',
      [getFuzzyHeader(h, 'company')]: appData.company || '',
      [getFuzzyHeader(h, 'position')]: appData.position || '',
      [getFuzzyHeader(h, 'package')]: appData.packageLpa || '',
      [getFuzzyHeader(h, 'designcategory')]: 'Placement',
      [getFuzzyHeader(h, 'designtype')]: 'Placement Poster',
      [getFuzzyHeader(h, 'status')]: 'Pending'
    });

    // Optionally log to 05_Design_Activity_Log here
  } catch(e) { console.error("Auto Create Design Error:", e); }
};