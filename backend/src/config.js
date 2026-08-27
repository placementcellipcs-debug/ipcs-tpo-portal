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

async function refreshCache() {
  try {
    await doc.loadInfo();
    const getSheet = (title) => doc.sheetsByIndex.find(s => s.title.trim().toLowerCase() === title.toLowerCase());

    const [
      stuSheet, appSheet, vacSheet, eventSheet, issueSheet, tSchedSheet, tAttSheet, clientSheet, tpoLogSheet, 
      matSheet, tqSheet, trSheet, aptQSheet, aptRSheet, talQSheet, talRSheet, courseSheet, driveSheet
    ] = [
      getSheet("Data"), getSheet("Opening_Applied"), getSheet("NewsLetter"), getSheet("Event"), getSheet("Issues"), 
      getSheet("Talentino_Schedule"), getSheet("Talentino_Attendance"), getSheet("Clients"), getSheet("TPO_Log"), 
      getSheet("Study_Materials"), getSheet("Tech_Questions"), getSheet("Tech_Results"),
      getSheet("Aptitude_Questions"), getSheet("Aptitude_Results"), getSheet("Talentino_Questions"), getSheet("Talentino_Results"), 
      getSheet("Courses"), getSheet("Drive_Registration") // 🚨 Safely grabbing the drive sheet
    ];

    const [
      stuRows, appRows, vacRows, eventRows, issueRows, tSchedRows, tAttRows, clientRows, tpoLogRows, 
      matRows, tqRows, trRows, aptQRows, aptRRows, talQRows, talRRows, driveRows
    ] = await Promise.all([
      stuSheet?.getRows() || [], appSheet?.getRows() || [], vacSheet?.getRows() || [], eventSheet?.getRows() || [], 
      issueSheet?.getRows() || [], tSchedSheet?.getRows() || [], tAttSheet?.getRows() || [], clientSheet?.getRows() || [], 
      tpoLogSheet?.getRows() || [], matSheet?.getRows() || [], tqSheet?.getRows() || [], trSheet?.getRows() || [],
      aptQSheet?.getRows() || [], aptRSheet?.getRows() || [], talQSheet?.getRows() || [], talRSheet?.getRows() || [], 
      driveSheet?.getRows() || [] // 🚨 Resolving drive rows safely
    ]);

    let coursesDict = {};
    if (courseSheet) {
      const cRows = await courseSheet.getRows();
      let currentMain = "General";
      
      const headers = courseSheet.headerValues;
      if (headers[0] && headers[0].trim() !== '') {
         currentMain = headers[0].replace(/^\d+\.\s*/, '').trim();
         coursesDict[currentMain] = [];
      }
      if (headers[1] && headers[1].trim() !== '') coursesDict[currentMain].push(headers[1].trim());

      cRows.forEach(r => {
         const valA = r._rawData[0];
         const valB = r._rawData[1];
         if (valA && valA.trim() !== '') {
            currentMain = valA.replace(/^\d+\.\s*/, '').trim();
            if (!coursesDict[currentMain]) coursesDict[currentMain] = [];
         }
         if (valB && valB.trim() !== '') {
            if (!coursesDict[currentMain]) coursesDict[currentMain] = [];
            coursesDict[currentMain].push(valB.trim());
         }
      });
    }

    // 🚨 The Master Object: ensures "drives" is explicitly included!
    globalCache = { 
      students: stuRows, applications: appRows, vacancies: vacRows, events: eventRows, issues: issueRows, 
      tSched: tSchedRows, tAtt: tAttRows, clients: clientRows, tpoLogs: tpoLogRows, materials: matRows, 
      techQuestions: tqRows, techResults: trRows, aptQuestions: aptQRows, aptResults: aptRRows, 
      talQuestions: talQRows, talResults: talRRows, coursesDict: coursesDict, drives: driveRows 
    };
  } catch (err) { console.error("❌ Cache sync failed:", err.message); }
}

refreshCache();
setInterval(refreshCache, 300000); 

const getStandardCourse = (c) => {
  if (!c) return 'Others';
  const lower = c.toLowerCase().trim();
  if (lower.includes('bms') || lower.includes('cctv') || lower.includes('building management') || lower.includes('security system')) return 'BMS AND CCTV';
  if (lower.includes('automation') || lower.includes('plc') || lower.includes('dcs') || lower.includes('scada') || lower.includes('vfd') || lower.includes('panel') || lower.includes('marine') || lower.includes('networking')) return 'Industrial Automation';
  if (lower.includes('embed') || lower.includes('iot') || lower.includes('raspberry') || lower.includes('labview')) return 'Embedded and IoT';
  if (lower.includes('digital') || lower.includes('dm') || lower.includes('seo') || lower.includes('social media') || lower.includes('affiliate') || lower.includes('blogging') || lower.includes('marketing')) return 'Digital Marketing';
  if (lower.includes('it') || lower.includes('python') || lower.includes('software') || lower.includes('information') || lower.includes('data science') || lower.includes('full stack') || lower.includes('java') || lower.includes('stack') || lower.includes('artificial intelligence') || lower.includes('ai')) return 'Information technology (IT)';
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

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com', port: 465, secure: true, family: 4, 
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

async function sendIPCSMail(mailOptions) {
  if (process.env.EMAIL_MODE === 'APPS_SCRIPT') {
    const payload = { to: mailOptions.to, subject: mailOptions.subject, html: mailOptions.html, attachments: [] };
    if (mailOptions.attachments) {
      mailOptions.attachments.forEach(att => {
        if (att.content) payload.attachments.push({ filename: att.filename, mimeType: 'application/pdf', contentBytes: att.content.toString('base64') });
        else if (att.href) payload.attachments.push({ filename: att.filename, href: att.href });
      });
    }
    const res = await axios.post(process.env.APPS_SCRIPT_EMAIL_URL, payload);
    if (!res.data.success) throw new Error("Apps Script Error");
    return true;
  }
  return await transporter.sendMail(mailOptions);
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

module.exports = { doc, getCache: () => globalCache, refreshCache, hasAccess, getFuzzyHeader, sendIPCSMail, uploadToDrive };