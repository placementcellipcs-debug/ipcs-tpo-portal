require('dotenv').config();

// 🚨 FORCES IPV4 FOR RENDER NETWORKS
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const multer = require('multer');
const { google } = require('googleapis');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// ==========================================
// GOOGLE DRIVE FOLDER IDs
// ==========================================
const FOLDER_OFFER_LETTERS = '1184PpFnRndFM0pwIt1Qob_FHMs8hPjV5';
const FOLDER_CLIENT_LOGOS = '11M8jGi1ISWP2mOpWRZncHhThHLoc7cDi'; 
const FOLDER_MOU_CERTIFICATES = '1Hu1zPs56nFXyJPSl7PVfs-oFW4QrKqiD';

// ==========================================
// GOOGLE AUTHENTICATION
// ==========================================
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
  scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
});

const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID, serviceAccountAuth);
const drive = google.drive({ version: 'v3', auth: serviceAccountAuth });

// ==========================================
// EMAIL SENDING ENGINE (DUAL MODE TOGGLE)
// ==========================================
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  family: 4, 
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

// 🚨 THE TOGGLE FUNCTION: Uses Apps Script on Render, or SMTP on ipcsglobal.info
async function sendIPCSMail(mailOptions) {
  if (process.env.EMAIL_MODE === 'APPS_SCRIPT') {
    if (!process.env.APPS_SCRIPT_EMAIL_URL) throw new Error("Missing APPS_SCRIPT_EMAIL_URL in Render");
    
    const payload = {
      to: mailOptions.to,
      subject: mailOptions.subject,
      html: mailOptions.html,
      attachments: []
    };
    
    if (mailOptions.attachments) {
      mailOptions.attachments.forEach(att => {
        if (att.content) { // Handles the direct PDF buffers
          payload.attachments.push({ filename: att.filename, mimeType: 'application/pdf', contentBytes: att.content.toString('base64') });
        } else if (att.href) { // Handles the Google Drive URLs for the CRON job
          payload.attachments.push({ filename: att.filename, href: att.href });
        }
      });
    }
    
    const response = await axios.post(process.env.APPS_SCRIPT_EMAIL_URL, payload);
    if (!response.data.success) throw new Error("Apps Script Error: " + response.data.error);
    return true;
  } else {
    return await transporter.sendMail(mailOptions);
  }
}

const APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyAJWuQlO7Ie3e-hsWkr965tZD3vfTBG5E9oBxFMleXBNi5ocSTnilPmFYzDXgQ-cOcbw/exec";

async function uploadToDrive(file, folderId) {
  try {
    const base64Data = file.buffer.toString('base64');
    const payload = { folderId: folderId, filename: `${Date.now()}_${file.originalname}`, mimeType: file.mimetype, data: base64Data };
    const response = await axios.post(APPS_SCRIPT_WEB_APP_URL, payload);
    if (response.data.success) return response.data.link; 
    throw new Error(response.data.error);
  } catch (err) { throw new Error(`Apps Script Error: ${err.message}`); }
}

// ==========================================
// BACKGROUND POLLING CACHE
// ==========================================
let globalCache = null;

async function refreshCache() {
  try {
    console.log("🔄 Background Sync: Fetching fresh data from Google Sheets...");
    await doc.loadInfo();
    const getSheet = (title) => doc.sheetsByIndex.find(s => s.title.trim().toLowerCase() === title.toLowerCase());

    // 🚨 ADDED TPO_LOG TO THE SYNC LIST
    const [stuSheet, appSheet, vacSheet, eventSheet, issueSheet, tSchedSheet, tAttSheet, clientSheet, tpoLogSheet] = [
      getSheet("Data"), getSheet("Opening_Applied"), getSheet("NewsLetter"), getSheet("Event"), getSheet("Issues"), getSheet("Talentino_Schedule"), getSheet("Talentino_Attendance"), getSheet("Clients"), getSheet("TPO_Log")
    ];

    const [stuRows, appRows, vacRows, eventRows, issueRows, tSchedRows, tAttRows, clientRows, tpoLogRows] = await Promise.all([
      stuSheet ? stuSheet.getRows() : [], appSheet ? appSheet.getRows() : [], vacSheet ? vacSheet.getRows() : [],
      eventSheet ? eventSheet.getRows() : [], issueSheet ? issueSheet.getRows() : [], tSchedSheet ? tSchedSheet.getRows() : [], 
      tAttSheet ? tAttSheet.getRows() : [], clientSheet ? clientSheet.getRows() : [], tpoLogSheet ? tpoLogSheet.getRows() : []
    ]);

    globalCache = { students: stuRows, applications: appRows, vacancies: vacRows, events: eventRows, issues: issueRows, tSched: tSchedRows, tAtt: tAttRows, clients: clientRows, tpoLogs: tpoLogRows };
    console.log(`✅ Cache updated! Found ${clientRows.length} clients in the sheet.`);
  } catch (err) { console.error("❌ Cache sync failed:", err.message); }
}

refreshCache();
setInterval(refreshCache, 60000);

function checkBranchMatch(branch, tpoBranchesArray) {
  if (!branch || !tpoBranchesArray || !Array.isArray(tpoBranchesArray)) return false;
  let cleanSB = branch.toString().toLowerCase().trim();
  if (tpoBranchesArray.includes("all") || cleanSB === "all") return true;
  return tpoBranchesArray.some(b => cleanSB.includes(b) || b.includes(cleanSB));
}

app.use('/api/tpo', (req, res, next) => {
  if (!globalCache) return res.status(503).json({ success: false, message: "Server is warming up, please try again in 5 seconds." });
  next();
});

// ==========================================
// CORE ROUTES
// ==========================================

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle["Contact"];
    const rows = await sheet.getRows();
    const cleanEmail = email.trim().toLowerCase();
    const tpoRow = rows.find(row => (row.get('Mail ID') || '').toString().trim().toLowerCase() === cleanEmail && (row.get('Password') || '').toString().trim() === password);

    if (!tpoRow) return res.status(401).json({ success: false, message: "Invalid credentials." });
    
    const assignedRaw = tpoRow.get('Assigned Branches') || '';
    let assignedArray = assignedRaw.replace(/[0-9.]/g, '').split(/[\n,]/).map(b => b.trim().toLowerCase()).filter(b => b !== '');
    return res.json({ success: true, tpo: { name: tpoRow.get('TPO Name') || 'Officer', email: cleanEmail, sittingBranch: tpoRow.get('Sitting Branch') || 'N/A', assignedBranchesArray: assignedArray.length > 0 ? assignedArray : ['all'], photo: tpoRow.get('Profile Photo') || '' }});
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.post('/api/tpo/dashboard-stats', (req, res) => {
  const { assignedBranchesArray } = req.body;
  let studentCount = 0, pendingApps = 0, placedCount = 0, activeVacs = 0;

  globalCache.students.forEach(row => { if (checkBranchMatch(row.get('Branch'), assignedBranchesArray)) studentCount++; });
  
  // 🚨 USE TPO LOGS FOR ACCURATE STATS
  const appSource = (globalCache.tpoLogs && globalCache.tpoLogs.length > 0) ? globalCache.tpoLogs : globalCache.applications;
  appSource.forEach(row => {
    if (checkBranchMatch(row.get('Branch'), assignedBranchesArray)) {
      const stat = (row.get('Status') || '').toString().toLowerCase();
      if (stat === 'applied') pendingApps++;
      if (stat.includes('placed') || stat.includes('joined') || stat.includes('offer')) placedCount++;
    }
  });
  
  globalCache.vacancies.forEach(row => {
    const stat = (row.get('Status') || 'Open').toString().toLowerCase();
    if (stat.includes('open') || stat.includes('yes')) activeVacs++;
  });

  let eventsList = globalCache.events.slice(-8).map(row => ({
    title: row.get('Title') || 'Event', date: row.get('Date') || '', time: row.get('Time') || '', type: row.get('Type') || 'Placement Drive', location: row.get('Location') || ''
  }));

  res.json({ success: true, stats: { totalStudents: studentCount, pendingApps, placed: placedCount, activeVacancies: activeVacs }, events: eventsList.reverse() });
});

app.post('/api/tpo/students', (req, res) => {
  const { assignedBranchesArray } = req.body;
  let students = [];
  let stats = { total: 0, pending: 0, notResponding: 0, noNeed: 0, branchCounts: {}, courseCounts: {} };

  globalCache.students.forEach(row => {
    const rowData = row.toObject();
    const getHeader = (searchString) => Object.keys(rowData).find(k => k.toLowerCase().includes(searchString.toLowerCase()));
    const branch = rowData['Branch'] || 'Unknown';
    if (checkBranchMatch(branch, assignedBranchesArray)) {
      stats.total++;
      const pStatKey = getHeader('placement stat');
      const pStatus = (pStatKey && rowData[pStatKey] ? rowData[pStatKey] : 'Pending').toString().trim();
      const pLower = pStatus.toLowerCase();
      
      if (pLower.includes('not responding')) stats.notResponding++;
      else if (pLower.includes('no need')) stats.noNeed++;
      else if (pLower.includes('pending') || pLower === '') stats.pending++;

      stats.branchCounts[branch] = (stats.branchCounts[branch] || 0) + 1;
      const course = rowData['Course'] || 'Unknown';
      stats.courseCounts[course] = (stats.courseCounts[course] || 0) + 1;

      const phone = rowData['Phone No.'] || rowData['Phone No'] || 'N/A';
      const statusKey = getHeader('currently studying');
      const status = statusKey && rowData[statusKey] ? rowData[statusKey] : 'N/A';
      const vacKey = getHeader('vacancy open') || getHeader('vaccancy open');

      students.push({
        rowIdx: row.rowNumber, name: rowData['Name'] || '', email: rowData['Mail ID'] || '', phone: phone,
        roll: rowData['IPCS Roll Number'] || rowData['Roll Number'] || '', branch: branch, course: course,
        photo: rowData['Profile Photo'] || '', qual: rowData['Qualification'] || '', stream: rowData['Stream'] || '',
        status: status, resume: rowData['Resume'] || '', certificate: rowData['Certificate'] || '',
        vacOpen: (vacKey && rowData[vacKey] ? rowData[vacKey] : 'Yes'), placementStatus: pStatus, rawData: rowData
      });
    }
  });
  res.json({ success: true, students: students.reverse(), stats });
});

app.post('/api/tpo/students/update-student', async (req, res) => {
  const { rowNumber, vacOpen, placementStatus } = req.body;
  try {
    const stuSheet = doc.sheetsByTitle["Data"];
    const rows = await stuSheet.getRows({ offset: rowNumber - 2, limit: 1 });
    if (rows.length > 0) {
      const headers = stuSheet.headerValues;
      const vacHeader = headers.find(h => h.toLowerCase().includes('vacancy open') || h.toLowerCase().includes('vaccancy open')) || 'Vacancy Open';
      const pStatusHeader = headers.find(h => h.toLowerCase().includes('placement stat')) || 'Placement Status';
      rows[0].assign({ [vacHeader]: vacOpen, [pStatusHeader]: placementStatus });
      await rows[0].save(); refreshCache(); 
      res.json({ success: true, message: "Student record updated!" });
    } else { res.status(404).json({ success: false, message: "Row not found." }); }
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ==========================================
// JOB TRACKER & PLACED STUDENTS
// ==========================================

app.post('/api/tpo/applications', (req, res) => {
  const { assignedBranchesArray, tpoName } = req.body;
  let appsMap = {}; 
  const cleanTpoName = (tpoName || '').toString().toLowerCase().trim();
  
  // 🚨 USE TPO_LOG FOR EXACT DATA MAPPING
  const sourceData = (globalCache.tpoLogs && globalCache.tpoLogs.length > 0) ? globalCache.tpoLogs : globalCache.applications;

  sourceData.forEach((row) => {
    const rowData = row.toObject();
    const getHeader = (searchString) => Object.keys(rowData).find(k => k.toLowerCase().includes(searchString.toLowerCase()));
    
    const branchKey = getHeader('branch');
    const branch = branchKey && rowData[branchKey] ? rowData[branchKey] : 'Unknown';
    const officerKey = getHeader('placement officer');
    const officerName = officerKey && rowData[officerKey] ? rowData[officerKey].toString().toLowerCase().trim() : '';

    if (checkBranchMatch(branch, assignedBranchesArray) || (cleanTpoName !== '' && officerName === cleanTpoName)) {
      const roll = rowData[getHeader('roll')] || '';
      const jobId = rowData[getHeader('job id') || getHeader('jobid')] || '';
      
      let phone = rowData[getHeader('contact')] || rowData[getHeader('phone')] || '';
      let email = rowData[getHeader('mail')] || rowData[getHeader('email')] || '';
      let resume = rowData[getHeader('resume')] || rowData[getHeader('cv')] || '';
      let qual = rowData[getHeader('qual')] || '';

      if (!phone || !email) {
        const studentData = globalCache.students.find(s => {
          const sRow = s.toObject();
          const sRollKey = Object.keys(sRow).find(k => k.toLowerCase().includes('roll'));
          return sRollKey && sRow[sRollKey] === roll;
        });

        if (studentData) {
          const sRow = studentData.toObject();
          const sGetHeader = (str) => Object.keys(sRow).find(k => k.toLowerCase().includes(str.toLowerCase()));
          if (!phone) phone = sRow[sGetHeader('phone')] || sRow[sGetHeader('contact')] || '';
          if (!email) email = sRow[sGetHeader('mail')] || sRow[sGetHeader('email')] || '';
          if (!resume) resume = sRow[sGetHeader('resume')] || sRow[sGetHeader('cv')] || '';
          if (!qual) qual = sRow[sGetHeader('qual')] || '';
        }
      }

      appsMap[`${roll}_${jobId}`] = {
        rowNumber: row.rowNumber, name: rowData[getHeader('name')] || '', roll: roll, branch: branch, course: rowData[getHeader('course')] || '', qual: qual || 'Not Specified', jobId: jobId, company: rowData[getHeader('company')] || 'Unknown Company', position: rowData[getHeader('position')] || 'Unknown Position', date: rowData[getHeader('time')] || rowData[getHeader('date')] || '', status: rowData[getHeader('status')] || 'Applied', remarks: rowData[getHeader('remarks')] || '', tpoName: rowData[getHeader('placement officer')] || '', phone: phone, email: email, resume: resume, datePlaced: rowData[getHeader('date placed')] || '', packageLpa: rowData[getHeader('package')] || '', offerLetter: rowData[getHeader('offer letter')] || '', joiningStatus: rowData[getHeader('joining status')] || ''
      };
    }
  });
  res.json({ success: true, applications: Object.values(appsMap) });
});

app.post('/api/tpo/applications/update', upload.single('offerLetterFile'), async (req, res) => {
  const rowNumber = parseInt(req.body.rowNumber);
  const { status, remarks, datePlaced, packageLpa, joiningStatus } = req.body;
  const fullApp = JSON.parse(req.body.fullApp || '{}');
  let offerLetterLink = req.body.offerLetter || fullApp.offerLetter || '';

  try {
    if (req.file) offerLetterLink = await uploadToDrive(req.file, FOLDER_OFFER_LETTERS);
    const appSheet = doc.sheetsByTitle["Opening_Applied"];
    const rows = await appSheet.getRows({ offset: rowNumber - 2, limit: 1 });
    if (rows.length > 0) {
      const headers = appSheet.headerValues;
      const updateObj = { 'Status': status };
      if(headers.includes('Remarks') && remarks !== undefined) updateObj['Remarks'] = remarks;
      if(headers.includes('DATE PLACED') && datePlaced !== undefined) updateObj['DATE PLACED'] = datePlaced;
      if(headers.includes('PACKAGE (LPA)') && packageLpa !== undefined) updateObj['PACKAGE (LPA)'] = packageLpa;
      if(headers.includes('Offer Letter')) updateObj['Offer Letter'] = offerLetterLink;
      if(headers.includes('Joining Status') && joiningStatus !== undefined) updateObj['Joining Status'] = joiningStatus;

      rows[0].assign(updateObj); await rows[0].save(); 
      const logSheet = doc.sheetsByTitle["TPO_Log"];
      if (logSheet && fullApp) {
        await logSheet.addRow({
          'TimeStamp': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), 'Student Name': fullApp.name || '', 'Contact': fullApp.phone || '', 'Mail ID': fullApp.email || '', 'Roll Number': fullApp.roll || '', 'Course': fullApp.course || '', 'Branch': fullApp.branch || '', 'Qualification': fullApp.qual || '', 'Resume': fullApp.resume || '', 'Job ID': fullApp.jobId || '', 'Company Name': fullApp.company || '', 'Placement Officer': fullApp.tpoName || '', 'Status': status || '', 'Remarks': remarks || '', 'DATE PLACED': datePlaced !== undefined ? datePlaced : (fullApp.datePlaced || ''), 'PACKAGE (LPA)': packageLpa !== undefined ? packageLpa : (fullApp.packageLpa || ''), 'Offer Letter Status': offerLetterLink, 'Joining Status': joiningStatus || ''
        });
      }
      refreshCache(); res.json({ success: true, message: "Updated!" });
    } else { res.status(404).json({ success: false, message: "Row not found." }); }
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.post('/api/tpo/applications/add', upload.single('offerLetterFile'), async (req, res) => {
  const appData = JSON.parse(req.body.appData);
  const tpoName = req.body.tpoName;
  try {
    let offerLetterLink = '';
    if (req.file) offerLetterLink = await uploadToDrive(req.file, FOLDER_OFFER_LETTERS);
    const appSheet = doc.sheetsByTitle["Opening_Applied"];
    const newRow = { 'TimeStamp': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), 'Student Name': appData.name, 'Contact': appData.phone, 'Mail ID': appData.email, 'Roll Number': appData.roll, 'Course': appData.course, 'Branch': appData.branch, 'Qualification': appData.qual || '', 'Resume': appData.resume || '', 'Job ID': 'MANUAL-ADD', 'Company Name': appData.company, 'Position': appData.position, 'Placement Officer': tpoName, 'Status': appData.status || 'Placed', 'Remarks': appData.remarks, 'DATE PLACED': appData.datePlaced, 'PACKAGE (LPA)': appData.packageLpa, 'Offer Letter': offerLetterLink, 'Joining Status': appData.joiningStatus };
    await appSheet.addRow(newRow);
    const logSheet = doc.sheetsByTitle["TPO_Log"];
    if (logSheet) { await logSheet.addRow({ ...newRow, 'Offer Letter Status': offerLetterLink }); }
    refreshCache(); res.json({ success: true, message: "Placement added manually." });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ==========================================
// OTHER DATA ROUTES
// ==========================================

// 🚨 EXACT MAPPING FOR NEWSLETTER JOB VACANCIES
app.get('/api/tpo/vacancies', (req, res) => {
  let vacs = globalCache.vacancies.map((row, i) => {
    const rowData = row.toObject();
    const getVal = (possibleKeys) => {
       for(let key of Object.keys(rowData)) {
          if (possibleKeys.includes(key.trim())) return rowData[key];
       }
       return '';
    };

    return {
      id: getVal(['JOBID', 'Job ID', 'ID']) || `JOB-${i+1}`,
      company: getVal(['Company Name', 'Company']),
      position: getVal(['Position', 'Role']),
      location: getVal(['Opening AT ( Location )', 'Opening AT( Location )', 'Location']),
      state: getVal(['State']),
      mode: getVal(['Work Mode', 'Mode']),
      lastDate: getVal(['Last Date']),
      course: getVal(['Course']),
      qualification: getVal(['Qualification']),
      description: getVal(['Job Description']),
      experience: getVal(['Experience']),
      salary: getVal(['Salary']),
      gender: getVal(['Gender Preference']),
      status: getVal(['Status']) || 'Open'
    };
  });
  res.json({ success: true, vacancies: vacs.reverse() });
});

app.get('/api/tpo/events', (req, res) => {
  let allEvents = globalCache.events.map(row => ({
    date: row.get('Date') || '', branch: row.get('Branch') || 'Bangalore', title: row.get('Title') || 'Placement Drive', type: row.get('Type') || 'Placement Drive', time: row.get('Time') || '', location: row.get('Location') || ''
  }));
  res.json({ success: true, events: allEvents.reverse() });
});

app.post('/api/tpo/issues', (req, res) => {
  const { assignedBranchesArray } = req.body;
  let issuesList = globalCache.issues.filter(row => checkBranchMatch(row.get('Branch'), assignedBranchesArray)).map(row => ({ rowNumber: row.rowNumber, name: row.get('Name') || 'Student', branch: row.get('Branch'), details: row.get('Issue Details') || '', status: row.get('Status') || 'Pending', remarks: row.get('Remarks') || '' }));
  res.json({ success: true, issues: issuesList.reverse() });
});

app.post('/api/tpo/issues/update', async (req, res) => {
  const { rowNumber, status, remarks } = req.body;
  try {
    const issueSheet = doc.sheetsByTitle["Issues"];
    const rows = await issueSheet.getRows({ offset: rowNumber - 2, limit: 1 });
    if (rows.length > 0) { rows[0].assign({ 'Status': status, 'Remarks': remarks }); await rows[0].save(); refreshCache(); res.json({ success: true, message: "Issue updated!" }); } 
    else { res.status(404).json({ success: false, message: "Row not found." }); }
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.post('/api/tpo/reports', (req, res) => {
  const { assignedBranchesArray } = req.body;
  let students = [], applications = [], issues = [], talentino = [];
  globalCache.students.forEach(row => { if (checkBranchMatch(row.get('Branch'), assignedBranchesArray)) students.push({ name: row.get('Name'), roll: row.get('Roll Number'), branch: row.get('Branch'), course: row.get('Course'), status: row.get('Status') }); });
  globalCache.applications.forEach(row => { if (checkBranchMatch(row.get('Branch'), assignedBranchesArray)) applications.push({ name: row.get('Student Name'), roll: row.get('Roll Number'), jobId: row.get('Job ID'), company: row.get('Company Name'), date: row.get('TimeStamp'), status: row.get('Status'), remarks: row.get('Remarks') }); });
  globalCache.issues.forEach(row => { if (checkBranchMatch(row.get('Branch'), assignedBranchesArray)) issues.push({ name: row.get('Name'), branch: row.get('Branch'), details: row.get('Issue Details'), status: row.get('Status'), remarks: row.get('Remarks') }); });
  globalCache.tAtt.forEach(row => { if (checkBranchMatch(row.get('Branch'), assignedBranchesArray)) talentino.push({ name: row.get('Name'), branch: row.get('Branch'), date: row.get('Check-in') || row.get('Date'), rating: row.get('Rating'), notes: row.get('Notes') }); });
  let vacancies = globalCache.vacancies.map(row => ({ id: row.get('Job ID') || row.get('ID') || '', company: row.get('Company') || '', location: row.get('Location') || '', mode: row.get('Mode') || '', status: row.get('Status') || 'Open' }));
  let events = globalCache.events.map(row => ({ date: row.get('Date') || '' }));
  res.json({ success: true, students, applications, issues, talentino, vacancies, events });
});

app.post('/api/tpo/talentino', (req, res) => {
  const { assignedBranchesArray } = req.body;
  let dates = new Set();
  globalCache.tSched.forEach(row => { const d = row.get('Date'); if (d) dates.add(d.trim()); });
  let records = globalCache.tAtt.filter(row => checkBranchMatch(row.get('Branch'), assignedBranchesArray)).map(row => ({ name: row.get('Name') || '', branch: row.get('Branch'), date: row.get('Check-in') || row.get('Date') || '', rating: row.get('Rating') || '', notes: row.get('Notes') || '' }));
  res.json({ success: true, dates: Array.from(dates).sort().reverse(), records: records.reverse() });
});

// ==========================================
// CLIENTS & MOU CERTIFICATE SYSTEM
// ==========================================

app.post('/api/tpo/clients', (req, res) => {
  if (!globalCache || !globalCache.clients) return res.status(503).json({ success: false });
  const cleanTpoName = (req.body.tpoName || '').toString().toLowerCase().trim();
  let clients = [];

  globalCache.clients.forEach(row => {
    const rowData = row.toObject();
    const officer = (rowData['Placement Officer'] || '').toString().toLowerCase().trim();
    const isMatch = cleanTpoName === '' || officer === '' || officer.includes(cleanTpoName) || cleanTpoName.includes(officer);

    if (isMatch) {
      clients.push({ rowNumber: row.rowNumber, companyName: rowData['Company Name'] || 'Unknown', website: rowData['Company Website'] || '', location: rowData['Company Location'] || '', contact: rowData['Company Contact'] || '', email: rowData['Company Mail ID'] || '', contactPerson: rowData['Company Contact Person'] || '', logo: rowData['Company Logo'] || '', mailStatus: rowData['Mail Status'] || 'Pending', documentStatus: rowData['Document Status'] || 'Pending', mouLink: rowData['MOU'] || '' });
    }
  });
  res.json({ success: true, clients: clients.reverse() });
});

app.get('/api/tpo/clients/:id', (req, res) => {
  if (!globalCache || !globalCache.clients) return res.status(503).json({ success: false });
  const targetRow = parseInt(req.params.id);
  const row = globalCache.clients.find(r => r.rowNumber === targetRow);
  if (!row) return res.status(404).json({ success: false, message: "Client not found" });
  
  const rowData = row.toObject();
  const getHeader = (str) => Object.keys(rowData).find(k => k.toLowerCase().includes(str.toLowerCase()));
  
  res.json({ success: true, client: { rowNumber: row.rowNumber, companyName: rowData[getHeader('company name') || getHeader('company')] || 'Unknown', email: rowData[getHeader('mail id') || getHeader('email')] || '', contactPerson: rowData[getHeader('contact person') || getHeader('person')] || '', contact: rowData[getHeader('company contact') || getHeader('contact')] || '', logo: rowData[getHeader('logo')] || '', documentStatus: rowData[getHeader('document status') || getHeader('doc status')] || 'Pending' }});
});

app.post('/api/tpo/clients/update', upload.single('logoFile'), async (req, res) => {
  const { rowNumber, email, phone, location, contactPerson } = req.body;
  const existingLogo = req.body.logo || '';
  try {
    let logoLink = existingLogo;
    if (req.file) { logoLink = await uploadToDrive(req.file, FOLDER_CLIENT_LOGOS); }
    const sheet = doc.sheetsByTitle["Clients"]; 
    const rows = await sheet.getRows({ offset: parseInt(rowNumber) - 2, limit: 1 });
    if (rows.length > 0) {
      const headers = sheet.headerValues;
      const getHeader = (str) => headers.find(h => h.toLowerCase() === str.toLowerCase() || h.toLowerCase().includes(str.toLowerCase()));
      const updateObj = {};
      const mailCol = getHeader('mail id') || getHeader('email');
      const phoneCol = headers.find(h => h.toLowerCase() === 'company contact' || h.toLowerCase() === 'contact');
      const locCol = getHeader('location');
      const personCol = getHeader('contact person') || getHeader('person');
      const logoCol = getHeader('logo');

      if(mailCol) updateObj[mailCol] = email;
      if(phoneCol) updateObj[phoneCol] = phone;
      if(locCol) updateObj[locCol] = location;
      if(personCol) updateObj[personCol] = contactPerson;
      if(logoCol) updateObj[logoCol] = logoLink;

      rows[0].assign(updateObj); await rows[0].save(); refreshCache(); res.json({ success: true, logoLink });
    } else { res.status(404).json({ success: false, message: "Row not found." }); }
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

app.post('/api/tpo/clients/request-mou', async (req, res) => {
  const { rowNumber, companyEmail, companyName } = req.body;
  try {
    const signingLink = `https://ipcs-tpo-portal.vercel.app/sign-certificate/${rowNumber}`;
    const refId = Math.floor(10000 + Math.random() * 90000); 

    const mailOptions = {
      from: `"IPCS Placement Portal" <${process.env.EMAIL_USER}>`,
      to: companyEmail,
      subject: `Action Required: IPCS Partnership Certificate for ${companyName} [Ref: ${refId}]`, 
      html: `<div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;"><div style="background-color: #0f1523; padding: 20px; text-align: center; border-bottom: 4px solid #38bdf8;"><h2 style="color: #ffffff; margin: 0;">IPCS PARTNERSHIP</h2></div><div style="padding: 30px;"><p>Dear ${companyName} Team,</p><p>We are thrilled to welcome you as a Preferred Hiring Partner with IPCS Global!</p><p>To finalize our association, please review and digitally sign your Certificate of Partnership by clicking the secure button below. You will be able to upload your company logo and authorized signature directly on the document.</p><div style="text-align: center; margin: 40px 0;"><a href="${signingLink}" style="background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; font-size: 16px;">Review & Sign Certificate</a></div><p style="font-size: 13px; color: #64748b;">If the button does not work, copy and paste this link into your browser: <br/>${signingLink}</p></div></div>`
    };

    await sendIPCSMail(mailOptions); 

    const sheet = doc.sheetsByTitle["Clients"]; 
    const rows = await sheet.getRows({ offset: parseInt(rowNumber) - 2, limit: 1 });
    if(rows.length > 0) {
      const headers = sheet.headerValues;
      const statusCol = headers.find(h => h.toLowerCase().includes('mail status'));
      if (statusCol) { rows[0].assign({ [statusCol]: 'Request Sent' }); await rows[0].save(); }
    }
    refreshCache(); res.json({ success: true });
  } catch (error) { 
    console.error("Email Error:", error);
    res.status(500).json({ success: false, message: error.message }); 
  }
});

app.post('/api/tpo/clients/submit-mou', upload.any(), async (req, res) => {
  const { rowNumber, companyName, companyEmail, tpoEmail } = req.body;
  try {
    const certFile = req.files.find(f => f.fieldname === 'certificatePdf');
    const logoFile = req.files.find(f => f.fieldname === 'logoFile');
    if (!certFile) return res.status(400).json({ success: false, message: "PDF missing" });

    const pdfLink = await uploadToDrive(certFile, FOLDER_MOU_CERTIFICATES);
    let logoLink = null;
    if (logoFile) { logoLink = await uploadToDrive(logoFile, FOLDER_CLIENT_LOGOS); }

    const sheet = doc.sheetsByTitle["Clients"]; 
    const rows = await sheet.getRows({ offset: parseInt(rowNumber) - 2, limit: 1 });
    if (rows.length > 0) {
      const headers = sheet.headerValues;
      const getHeader = (str) => headers.find(h => h.toLowerCase() === str.toLowerCase() || h.toLowerCase().includes(str.toLowerCase()));
      const updateObj = {};
      if(getHeader('document status') || getHeader('doc status')) updateObj[getHeader('document status') || getHeader('doc status')] = 'Completed';
      if(getHeader('mou') || getHeader('mou link')) updateObj[getHeader('mou') || getHeader('mou link')] = pdfLink;
      if(logoLink && getHeader('logo')) updateObj[getHeader('logo')] = logoLink;
      rows[0].assign(updateObj); await rows[0].save();
    }

    const zonalManagerEmail = 'giftyipcsglobal@gmail.com'; 
    const refId = Math.floor(10000 + Math.random() * 90000); 
    
    const mailOptions = {
      from: `"IPCS Placement Portal" <${process.env.EMAIL_USER}>`,
      to: [companyEmail, zonalManagerEmail, tpoEmail].filter(Boolean).join(','),
      subject: `MOU Completed: Hiring Partnership Confirmation – ${companyName} [Ref: ${refId}]`, 
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #0f1523; padding: 20px; text-align: center; border-bottom: 4px solid #10b981;">
            <h2 style="color: #ffffff; margin: 0; font-size: 22px; letter-spacing: 1px;">PARTNERSHIP CONFIRMED</h2>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <p style="font-size: 16px; margin-top: 0;">Dear <b>${companyName}</b> Team,</p>
            <p style="font-size: 15px; line-height: 1.6; color: #475569;">The Hiring Partnership Confirmation has been digitally signed and successfully processed. We are incredibly excited to officially partner with you!</p>
            <p style="font-size: 15px; line-height: 1.6; color: #475569;">You can securely view and download your official, countersigned partnership agreement below:</p>
            
            <div style="text-align: center; margin: 35px 0;">
              <a href="${pdfLink}" style="background-color: #0284c7; color: white; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; font-size: 16px; display: inline-block;">View Official Agreement</a>
            </div>
            
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">
              <p style="margin: 0 0 5px 0;">Regards,</p>
              <p style="margin: 0 0 2px 0; font-weight: bold; color: #0f1523; font-size: 14px;">IPCS Placement Portal</p>
              <p style="margin: 0;">Placement & Corporate Relations Department</p>
              <p style="margin: 0;">IPCS Global</p>
            </div>
          </div>
        </div>
      `,
      attachments: [{ filename: `${companyName.replace(/\s+/g, '_')}_Agreement.pdf`, content: certFile.buffer }]
    };
    
    await sendIPCSMail(mailOptions); 
    
    refreshCache(); res.json({ success: true, pdfLink });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
});

// ==========================================
// AUTOMATED EMAILS 
// ==========================================

const extractAppInfo = (appRow) => {
  const rowData = appRow.toObject();
  const getHeader = (str) => Object.keys(rowData).find(k => k.toLowerCase().includes(str.toLowerCase()));

  let phone = rowData[getHeader('contact')] || rowData[getHeader('phone')] || '';
  let email = rowData[getHeader('mail')] || rowData[getHeader('email')] || '';
  let qual = rowData[getHeader('qual')] || '';
  let resume = rowData[getHeader('resume')] || rowData[getHeader('cv')] || '';
  let name = rowData[getHeader('name')] || 'Student';
  let roll = rowData[getHeader('roll')] || '';
  let course = rowData[getHeader('course')] || '';
  let branch = rowData[getHeader('branch')] || '';

  if (!phone || !email || !qual || !resume) {
    const studentData = globalCache.students.find(s => {
      const sRow = s.toObject();
      const sRollKey = Object.keys(sRow).find(k => k.toLowerCase().includes('roll'));
      return sRollKey && sRow[sRollKey] === roll;
    });

    if (studentData) {
      const sRow = studentData.toObject();
      const sGetHeader = (str) => Object.keys(sRow).find(k => k.toLowerCase().includes(str.toLowerCase()));
      if (!phone) phone = sRow[sGetHeader('phone')] || sRow[sGetHeader('contact')] || '';
      if (!email) email = sRow[sGetHeader('mail')] || sRow[sGetHeader('email')] || '';
      if (!qual) qual = sRow[sGetHeader('qual')] || '';
      if (!resume) resume = sRow[sGetHeader('resume')] || sRow[sGetHeader('cv')] || '';
    }
  }
  return { name, roll, phone, email, qual, resume, course, branch };
};

cron.schedule('0 8 * * *', async () => {
  if (!globalCache) return;
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split('T')[0]; 

  const expiredJobs = globalCache.vacancies.filter(v => {
    if (!v.get('Last Date')) return false;
    try { return new Date(v.get('Last Date')).toISOString().split('T')[0] === yStr; } catch(e) { return false; }
  });

  for (let job of expiredJobs) {
    const jobId = job.get('Job ID') || job.get('ID');
    const applicants = globalCache.applications.filter(app => app.get('Job ID') === jobId);
    if (applicants.length === 0) continue;

    const tpoName = applicants[0].get('Placement Officer');
    const contactRows = await doc.sheetsByTitle["Contact"].getRows();
    const tpoRow = contactRows.find(r => r.get('TPO Name') === tpoName);
    const tpoEmail = tpoRow ? tpoRow.get('Mail ID') : null;
    if (!tpoEmail) continue;

    let tableRows = ''; let attachments = [];
    applicants.forEach((appRow, index) => {
      const info = extractAppInfo(appRow);
      let resumeBtn = 'N/A';
      if (info.resume) {
        const driveMatch = info.resume.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
        if (driveMatch) {
            const driveId = driveMatch[1];
            resumeBtn = `<a href="https://drive.google.com/file/d/${driveId}/view" style="background: #0f172a; color: white; padding: 6px 12px; text-decoration: none; border-radius: 4px; font-size: 12px; display: inline-block; white-space: nowrap;">View CV</a>`;
            attachments.push({ filename: `${info.name.replace(/\s+/g, '_')}_Resume.pdf`, href: `https://drive.google.com/uc?export=download&id=${driveId}` });
        } else { resumeBtn = `<a href="${info.resume}">Link</a>`; }
      }
      tableRows += `<tr><td style="padding:10px;border:1px solid #cbd5e1;text-align:center;">${index+1}</td><td style="padding:10px;border:1px solid #cbd5e1;"><b>${info.name}</b></td><td style="padding:10px;border:1px solid #cbd5e1;">${info.phone}</td><td style="padding:10px;border:1px solid #cbd5e1;">${info.email}</td><td style="padding:10px;border:1px solid #cbd5e1;text-align:center;">${info.roll}</td><td style="padding:10px;border:1px solid #cbd5e1;">${info.course}</td><td style="padding:10px;border:1px solid #cbd5e1;">${info.branch}</td><td style="padding:10px;border:1px solid #cbd5e1;">${info.qual}</td><td style="padding:10px;border:1px solid #cbd5e1;text-align:center;">${resumeBtn}</td></tr>`;
    });

    const mailOptions = {
      from: `"IPCS Placement Portal" <${process.env.EMAIL_USER}>`,
      to: tpoEmail,
      subject: `Applications Received – ${job.get('Company Name') || job.get('Company')} | ${job.get('Position')} | ${jobId}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto;">
          <h2 style="color: #0f1523;">Applications Received</h2>
          <p>Please find attached the resumes for the applicants to <b>${job.get('Company Name') || job.get('Company')}</b> for the position of ${job.get('Position')}.</p>
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
              <tr style="background-color: #f1f5f9; text-align: left;">
                <th style="padding: 10px; border: 1px solid #cbd5e1;">#</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Name</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Phone</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Email</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Roll No</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Course</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Branch</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Qual.</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Resume</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          <p style="margin-top: 20px; font-size: 12px; color: #64748b;">This is an automated report generated by the IPCS Placement Portal.</p>
        </div>
      `,
      attachments: attachments
    };
    
    await sendIPCSMail(mailOptions); 
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 TPO Backend is running on http://localhost:${PORT}`));