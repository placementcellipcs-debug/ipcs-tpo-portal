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

async function refreshCache() {
  if (isFetching) return;
  isFetching = true;
  try {
    await doc.loadInfo();
    const getSheet = (title) => doc.sheetsByIndex.find(s => s.title.trim().toLowerCase() === title.toLowerCase());

    const sheetNames = [
      "Data", "Opening_Applied", "NewsLetter", "Event", "Issues", 
      "Talentino_Schedule", "Talentino_Attendance", "Clients", "TPO_Log", 
      "Study_Materials", "Tech_Questions", "Tech_Results",
      "Aptitude_Questions", "Aptitude_Results", "Talentino_Questions", 
      "Talentino_Results", "Courses", "Drive_Registration",
      "Contact", "User"
    ];

    // 🚨 RATE LIMIT FIX: Fetch sheets sequentially with a 200ms delay between each 
    // to prevent hitting Google's 60 requests-per-minute rate limit (Error 429).
    const results = {};
    for (let name of sheetNames) {
      const sheet = getSheet(name);
      if (sheet) {
        try {
          results[name] = await sheet.getRows();
          await new Promise(r => setTimeout(r, 200)); 
        } catch (sheetErr) {
          console.error(`Warning: Failed to fetch sheet ${name}:`, sheetErr.message);
          results[name] = [];
        }
      } else {
        results[name] = [];
      }
    }

    let coursesDict = {};
    const courseSheet = getSheet("Courses");
    if (courseSheet) {
      const cRows = results["Courses"] || [];
      let currentMain = "General";
      const headers = courseSheet.headerValues;
      if (headers && headers[0] && headers[0].trim() !== '') { 
        currentMain = headers[0].replace(/^\d+\.\s*/, '').trim(); 
        coursesDict[currentMain] = []; 
      }
      if (headers && headers[1] && headers[1].trim() !== '') {
        if (!coursesDict[currentMain]) coursesDict[currentMain] = [];
        coursesDict[currentMain].push(headers[1].trim());
      }

      cRows.forEach(r => {
         const valA = r._rawData ? r._rawData[0] : r.get(headers[0]); 
         const valB = r._rawData ? r._rawData[1] : r.get(headers[1]);
         
         if (valA && valA.toString().trim() !== '') { 
            currentMain = valA.toString().replace(/^\d+\.\s*/, '').trim(); 
            if (!coursesDict[currentMain]) coursesDict[currentMain] = []; 
         }
         if (valB && valB.toString().trim() !== '') { 
            if (!coursesDict[currentMain]) coursesDict[currentMain] = []; 
            coursesDict[currentMain].push(valB.toString().trim()); 
         }
      });
    }

    globalCache = { 
      students: results["Data"], 
      applications: results["Opening_Applied"], 
      vacancies: results["NewsLetter"], 
      events: results["Event"], 
      issues: results["Issues"], 
      tSched: results["Talentino_Schedule"], 
      tAtt: results["Talentino_Attendance"], 
      clients: results["Clients"], 
      tpoLogs: results["TPO_Log"], 
      materials: results["Study_Materials"], 
      techQuestions: results["Tech_Questions"], 
      techResults: results["Tech_Results"], 
      aptQuestions: results["Aptitude_Questions"], 
      aptResults: results["Aptitude_Results"], 
      talQuestions: results["Talentino_Questions"], 
      talResults: results["Talentino_Results"], 
      coursesDict: coursesDict, 
      drives: results["Drive_Registration"],
      contacts: results["Contact"], 
      users: results["User"] 
    };
    
    console.log("✅ Cache successfully synced with Google Sheets!");
    isFetching = false;
  } catch (err) { 
    console.error("❌ Cache sync failed:", err.message); 
    isFetching = false;
    
    // 🚨 BACKOFF FIX: If a 429 rate limit occurs, wait 30 seconds before retrying instead of hammering it every 3s
    const retryDelay = err.message.includes('429') ? 30000 : 5000;
    if (!globalCache) {
      console.log(`⚠️ Retrying cache sync in ${retryDelay / 1000} seconds...`);
      setTimeout(refreshCache, retryDelay);
    }
  }
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

const transporter = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, family: 4, auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }});

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