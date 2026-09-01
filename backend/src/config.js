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

async function refreshCache() {
  if (isFetching) return;
  isFetching = true;
  try {
    await doc.loadInfo();
    const getSheet = (title) => doc.sheetsByIndex.find(s => s.title.trim().toLowerCase() === title.toLowerCase());

    const sheetsToFetch = [
      getSheet("Data"), getSheet("Opening_Applied"), getSheet("NewsLetter"), getSheet("Event"), getSheet("Issues"), 
      getSheet("Talentino_Schedule"), getSheet("Talentino_Attendance"), getSheet("Clients"), getSheet("TPO_Log"), 
      getSheet("Study_Materials"), getSheet("Tech_Questions"), getSheet("Tech_Results"),
      getSheet("Aptitude_Questions"), getSheet("Aptitude_Results"), getSheet("Talentino_Questions"), getSheet("Talentino_Results"), getSheet("Courses"), getSheet("Drive_Registration"),
      getSheet("Contact"), getSheet("User"), getSheet("Branches"), getSheet("Mail")
    ];

    const fetchedData = [];
    
    // 🚨 FIX: Fetch sheets sequentially with a 200ms delay to prevent Google API 429 Quota Errors!
    for (const sheet of sheetsToFetch) {
      if (sheet) {
        fetchedData.push(await sheet.getRows());
      } else {
        fetchedData.push([]);
      }
      await new Promise(resolve => setTimeout(resolve, 200)); 
    }

    const [
      stuRows, appRows, vacRows, eventRows, issueRows, tSchedRows, tAttRows, clientRows, tpoLogRows, 
      matRows, tqRows, trRows, aptQRows, aptRRows, talQRows, talRRows, driveRows, contactRows, userRows, branchRows, mailRows
    ] = fetchedData;

    let coursesDict = {};
    const courseSheet = sheetsToFetch[16];
    if (courseSheet) {
      const cRows = fetchedData[16];
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
      contacts: contactRows, users: userRows, branches: branchRows, mails: mailRows
    };
    
    console.log("✅ Cache successfully synced with Google Sheets!");
    isFetching = false;
  } catch (err) { 
    console.error("❌ Cache sync failed:", err.message); 
    isFetching = false;
    if (!globalCache) { setTimeout(refreshCache, 3000); }
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
  const cleanTarget = target.toLowerCase().replace(/\s/g, '');
  return headers.find(h => h.toLowerCase().replace(/\s/g, '') === cleanTarget) || target;
};

const getTpoEmail = (tpoName) => {
  if (!globalCache) return '';
  const row = globalCache.contacts.find(r => {
    const name = r.get('TPO Name') || r.get('Name') || '';
    return name.toLowerCase().includes((tpoName || '').toLowerCase());
  });
  return row ? row.get('Mail ID') : '';
};

const getBranchManagerEmail = (branch) => {
  if (!globalCache) return '';
  const row = globalCache.users.find(r => {
    const role = (r.get('Role') || '').toLowerCase();
    const br = (r.get('Sitting Branch') || r.get('Assigned Branches') || '').toLowerCase();
    return role.includes('manager') && br.includes((branch || '').toLowerCase());
  });
  return row ? row.get('Mail ID') : '';
};

const getAllTpoEmails = () => {
  if (!globalCache) return [];
  return globalCache.contacts.map(r => r.get('Mail ID')).filter(Boolean);
};

const getAllBranchManagerEmails = () => {
  if (!globalCache) return [];
  return globalCache.users
    .filter(r => (r.get('Role') || '').toLowerCase().includes('branch manager'))
    .map(r => r.get('Mail ID')).filter(Boolean);
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
  } catch (e) {
    console.error("Failed to log mail to sheet:", e);
  }
}

const transporter = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, family: 4, auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }});

async function sendIPCSMail(mailOptions, logDetails) {
  try {
    if (process.env.EMAIL_MODE === 'APPS_SCRIPT') {
      const payload = { to: mailOptions.to, cc: mailOptions.cc, bcc: mailOptions.bcc, subject: mailOptions.subject, html: mailOptions.html, attachments: [] };
      if (mailOptions.attachments) {
        mailOptions.attachments.forEach(att => {
          if (att.content) payload.attachments.push({ filename: att.filename, mimeType: 'application/pdf', contentBytes: att.content.toString('base64') });
          else if (att.href) payload.attachments.push({ filename: att.filename, href: att.href });
        });
      }
      const res = await axios.post(process.env.APPS_SCRIPT_EMAIL_URL, payload);
      if (!res.data.success) throw new Error("Apps Script Error");
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
  getTpoEmail, getBranchManagerEmail, getAllTpoEmails, getAllBranchManagerEmails 
};