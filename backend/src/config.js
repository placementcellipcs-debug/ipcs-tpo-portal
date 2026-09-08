require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { google } = require('googleapis');
const nodemailer = require('nodemailer');
const axios = require('axios');

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
  scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
});

const doc = new GoogleSpreadsheet(process.env.SPREADSHEET_ID, serviceAccountAuth);
const drive = google.drive({ version: 'v3', auth: serviceAccountAuth });

let globalCache = null;
let isFetching = false;

const getCache = () => globalCache;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchSheetWithRetry(sheet, retries = 3) {
  if (!sheet) return [];
  for (let i = 0; i < retries; i++) {
    try {
      return await sheet.getRows();
    } catch (error) {
      if (error.response && error.response.status === 429) {
        console.warn(`⚠️ Google API Rate Limit Hit (429). Retrying in ${1500 * (i + 1)}ms...`);
        await delay(1500 * (i + 1));
      } else {
        throw error;
      }
    }
  }
  return [];
}

async function refreshCache() {
  if (isFetching) return;
  isFetching = true;
  try {
    await doc.loadInfo();
    
    // 🚨 INDESTRUCTIBLE FUZZY MATCHER
    const getSheetFuzzy = (keyword) => {
      const cleanKeyword = keyword.toLowerCase().replace(/[^a-z0-9]/g, '');
      return doc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanKeyword));
    };

    const sheetsToFetch = [
      getSheetFuzzy("Data"), getSheetFuzzy("OpeningApplied"), getSheetFuzzy("NewsLetter"), getSheetFuzzy("Event"), getSheetFuzzy("Issues"), 
      getSheetFuzzy("TalentinoSchedule"), getSheetFuzzy("TalentinoAttendance"), getSheetFuzzy("Clients"), getSheetFuzzy("TPOLog"), 
      getSheetFuzzy("StudyMaterials"), getSheetFuzzy("TechQuestions"), getSheetFuzzy("TechResults"),
      getSheetFuzzy("AptitudeQuestions"), getSheetFuzzy("AptitudeResults"), getSheetFuzzy("TalentinoQuestions"), getSheetFuzzy("TalentinoResults"),
      getSheetFuzzy("Courses"), getSheetFuzzy("DriveRegistration"), getSheetFuzzy("Contact"), getSheetFuzzy("User"), getSheetFuzzy("Branches"), getSheetFuzzy("Mail"),
      getSheetFuzzy("trainer"), getSheetFuzzy("security")
    ];

    const fetchedData = [];
    for (let i = 0; i < sheetsToFetch.length; i++) {
      fetchedData.push(await fetchSheetWithRetry(sheetsToFetch[i]));
      await delay(200); 
    }

    const [
      stuRows, appRows, vacRows, eventRows, issueRows, tSchedRows, tAttRows, clientRows, tpoLogRows, 
      matRows, tqRows, trRows, aptQRows, aptRRows, talQRows, talRRows,
      courseRows, driveRows, contactRows, userRows, branchRows, mailRows, trainerLogRows, securityRows
    ] = fetchedData;

    let coursesDict = {};
    const courseSheet = sheetsToFetch[16];
    if (courseSheet) {
      const cRows = courseRows || [];
      let currentMain = "General";
      const headers = courseSheet.headerValues;
      if (headers[0] && headers[0].trim() !== '') { currentMain = headers[0].replace(/^\d+\.\s*/, '').trim(); coursesDict[currentMain] = []; }
      if (headers[1] && headers[1].trim() !== '') coursesDict[currentMain].push(headers[1].trim());

      cRows.forEach(r => {
         const valA = r._rawData[0]; const valB = r._rawData[1];
         if (valA && valA.trim() !== '') { currentMain = valA.replace(/^\d+\.\s*/, '').trim(); if (!coursesDict[currentMain]) coursesDict[currentMain] = []; }
         if (valB && valB.trim() !== '') { if (!coursesDict[currentMain]) coursesDict[currentMain] = []; coursesDict[currentMain].push(valB.trim()); }
      });
    }

    globalCache = { 
      students: stuRows, applications: appRows, vacancies: vacRows, events: eventRows, issues: issueRows, 
      tSched: tSchedRows, tAtt: tAttRows, clients: clientRows, tpoLogs: tpoLogRows, materials: matRows, 
      techQuestions: tqRows, techResults: trRows, aptQuestions: aptQRows, aptResults: aptRRows, 
      talQuestions: talQRows, talResults: talRRows, coursesDict: coursesDict, drives: driveRows,
      contacts: contactRows, users: userRows, branches: branchRows, mails: mailRows,
      trainerLogs: trainerLogRows,
      securityLogs: securityRows
    };
    
    console.log("✅ Cache successfully synced with Google Sheets!");
    isFetching = false;
  } catch (err) { 
    console.error("❌ Cache sync failed:", err.message); 
    isFetching = false;
    if (!globalCache) { setTimeout(refreshCache, 5000); }
  }
}

refreshCache();
setInterval(refreshCache, 300000); 

const getStandardCourse = (c) => {
  if (!c) return 'Others';
  const lower = c.toLowerCase().trim();
  if (lower.includes('bms') || lower.includes('cctv')) return 'BMS AND CCTV';
  if (lower.includes('automation') || lower.includes('plc') || lower.includes('scada')) return 'Industrial Automation';
  if (lower.includes('embed') || lower.includes('iot')) return 'Embedded and IoT';
  if (lower.includes('digital') || lower.includes('dm') || lower.includes('marketing')) return 'Digital Marketing';
  if (lower.includes('it') || lower.includes('python') || lower.includes('software') || lower.includes('data')) return 'Information technology (IT)';
  return 'Others';
};

function checkBranchMatch(branch, tpoBranchesArray) {
  if (!branch || !tpoBranchesArray || !Array.isArray(tpoBranchesArray)) return false;
  let cleanSB = branch.toString().toLowerCase().trim();
  if (tpoBranchesArray.includes("all") || cleanSB === "all") return true;
  return tpoBranchesArray.some(b => cleanSB.includes(b) || b.includes(cleanSB));
}

function hasAccess(rowBranch, rowCourse, role, assignedBranchesArray, assignedCourse) {
  if (!role) role = 'TPO'; 
  const upperRole = role.toUpperCase();
  if (upperRole.includes('ADMIN') || upperRole === 'GENERAL MANAGER' || upperRole === 'TECHNICAL HEAD' || upperRole === 'ZONAL PLACEMENT HEAD') return true; 
  
  const stdRowCourse = getStandardCourse(rowCourse);
  const stdAssignedCourse = getStandardCourse(assignedCourse);
  const matchCourse = (stdRowCourse === stdAssignedCourse) || stdAssignedCourse === 'OTHERS'; 
  const matchBranch = checkBranchMatch(rowBranch, assignedBranchesArray);

  if (upperRole.includes('RTH') || upperRole === 'REGIONAL TECHNICAL HEAD') return matchCourse; 
  if (upperRole.includes('TTH') || upperRole === 'TERRITORY TECHNICAL HEAD' || upperRole.includes('TRAINER')) return matchBranch && matchCourse;
  return matchBranch; 
}

const getFuzzyHeader = (headers, target) => {
  const cleanTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '');
  return headers.find(h => h.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget) || target;
};

// =========================================================
// 🚨 BULLETPROOF FUZZY EMAIL LOOKUP FUNCTIONS
// =========================================================
const getTpoEmail = (tpoName) => {
  if (!globalCache || !globalCache.contacts) return '';
  const searchName = (tpoName || '').toLowerCase().trim();
  const row = globalCache.contacts.find(r => {
    const rd = r.toObject();
    const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const name = (rd[getH('tponame')] || rd[getH('name')] || '').toLowerCase();
    return name && (name.includes(searchName) || searchName.includes(name));
  });
  if (row) {
    const rd = row.toObject();
    const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
    return rd[getH('mailid')] || rd[getH('email')] || '';
  }
  return '';
};

const getBranchManagerEmail = (branch) => {
  if (!globalCache || !globalCache.users) return '';
  const searchBranch = (branch || '').toLowerCase().replace('branch', '').trim();
  
  const row = globalCache.users.find(r => {
    const rd = r.toObject();
    const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const role = (rd[getH('role')] || '').toLowerCase();
    const br = (rd[getH('sittingbranch')] || rd[getH('assignedbranches')] || '').toLowerCase();
    return role.includes('manager') && br.includes(searchBranch);
  });
  
  if (row) {
    const rd = row.toObject();
    const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
    return rd[getH('mailid')] || rd[getH('email')] || '';
  }
  return '';
};

const getAllTpoEmails = () => {
  if (!globalCache || !globalCache.contacts) return [];
  return globalCache.contacts.map(r => {
    const rd = r.toObject();
    const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
    return rd[getH('mailid')] || rd[getH('email')] || '';
  }).filter(Boolean);
};

const getAllBranchManagerEmails = () => {
  if (!globalCache || !globalCache.users) return [];
  return globalCache.users.filter(r => {
    const rd = r.toObject();
    const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const role = (rd[getH('role')] || '').toLowerCase();
    return role.includes('manager');
  }).map(r => {
    const rd = r.toObject();
    const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
    return rd[getH('mailid')] || rd[getH('email')] || '';
  }).filter(Boolean);
};

const getSuperAdminEmails = () => {
  if (!globalCache || !globalCache.users) return [];
  return globalCache.users.filter(r => {
    const rd = r.toObject();
    const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const role = (rd[getH('role')] || '').toLowerCase();
    const access = (rd[getH('access')] || '').toLowerCase();
    return access.includes('admin') || role.includes('general manager') || role.includes('technical head') || role.includes('zonal');
  }).map(r => {
    const rd = r.toObject();
    const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
    return rd[getH('mailid')] || rd[getH('email')] || '';
  }).filter(Boolean);
};

async function logMailToSheet(receiverName, receiverMail, mailType, subject, status) {
  try {
    const sheet = doc.sheetsByTitle["Mail"];
    if (sheet) {
      await sheet.addRow({
        'TimeStamp': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        'Reciver Name': receiverName || 'Unknown',
        'Reciver Mail': receiverMail || 'Unknown',
        'Mail Type': mailType || 'System Alert',
        'Subject': subject || 'Notification',
        'Status': status || 'Sent'
      });
    }
  } catch (e) { console.error("Failed to log mail to sheet:", e); }
}

const transporter = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, family: 4, auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }});

async function sendIPCSMail(mailOptions, logDetails) {
  try {
    if (process.env.EMAIL_MODE === 'APPS_SCRIPT') {
      const emailWebAppUrl = process.env.APPS_SCRIPT_EMAIL_URL || "https://script.google.com/macros/s/AKfycbzKAEsc5_OR2YjHeO_8yyS9BoxFeJOXjNUzNMqGby7pIHuoIQVM5f31GxXJHxleGds4dQ/exec";
      const payload = { 
        to: mailOptions.to, cc: mailOptions.cc || '', bcc: mailOptions.bcc || '', 
        subject: mailOptions.subject, html: mailOptions.html, attachments: [] 
      };

      if (mailOptions.attachments && Array.isArray(mailOptions.attachments)) {
        mailOptions.attachments.forEach(att => {
          if (att.content) { payload.attachments.push({ filename: att.filename, mimeType: 'application/pdf', contentBytes: att.content.toString('base64') }); } 
          else if (att.href) { payload.attachments.push({ filename: att.filename, href: att.href }); }
        });
      }

      const res = await axios.post(emailWebAppUrl, payload);
      if (!res.data.success) throw new Error(res.data.error || "Apps Script returned false");
    } else {
      await transporter.sendMail(mailOptions);
    }
    
    if (logDetails) await logMailToSheet(logDetails.name, logDetails.email, logDetails.type, mailOptions.subject, 'Success');
    return true;
  } catch (err) {
    if (logDetails) await logMailToSheet(logDetails.name, logDetails.email, logDetails.type, mailOptions.subject, `Failed: ${err.message}`);
    throw err;
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

module.exports = { 
  doc, getCache, refreshCache, hasAccess, getFuzzyHeader, 
  sendIPCSMail, uploadToDrive,
  getTpoEmail, getBranchManagerEmail, getAllTpoEmails, getAllBranchManagerEmails, getSuperAdminEmails 
};