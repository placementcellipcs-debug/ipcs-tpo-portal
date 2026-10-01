const { createHash, randomBytes, timingSafeEqual } = require('crypto');

// 🚨 IN-MEMORY MULTI-DEVICE SESSION REGISTRY
const activeSessions = new Map();
const activeAccounts = new Map();

function parseUserAgent(ua = '') {
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';
  let device = 'Desktop';

  if (/mobile/i.test(ua)) device = 'Mobile';
  else if (/tablet|ipad/i.test(ua)) device = 'Tablet';

  if (/windows/i.test(ua)) os = 'Windows';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/chrome|crios/i.test(ua) && !/opr|opera/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/opr|opera/i.test(ua)) browser = 'Opera';

  return { browser, os, device };
}

const { 
  doc, drive, getCache, refreshCache, loadDocInfo, hasAccess, getFuzzyHeader,
  sendIPCSMail, uploadToDrive
} = require('./config');

const { autoCreateDesignTask } = require('./designControllers');
const { normalizePlacementText, placementIdentity, latestPlacementRows } = require('./placementRecords');

const FOLDER_OFFER_LETTERS = '1184PpFnRndFM0pwIt1Qob_FHMs8hPjV5';
const FOLDER_CLIENT_LOGOS = '11M8jGi1ISWP2mOpWRZncHhThHLoc7cDi'; 
const FOLDER_MOU_CERTIFICATES = '1Hu1zPs56nFXyJPSl7PVfs-oFW4QrKqiD';

// =========================================================
// 🚨 BULLETPROOF DATA EXTRACTOR (Ignores Google Sheets Bugs)
// =========================================================
const getValByHeader = (row, headerOptions) => {
  if (!row || !row._worksheet || !row._worksheet.headerValues) return '';
  const headers = row._worksheet.headerValues.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const targets = Array.isArray(headerOptions) ? headerOptions : [headerOptions];
  
  for (let target of targets) {
    const cleanTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '');
    let index = headers.indexOf(cleanTarget);
    if (index === -1) index = headers.findIndex(h => h.includes(cleanTarget));
    
    if (index !== -1 && index < row._rawData.length && row._rawData[index] !== undefined && row._rawData[index] !== null) {
      return row._rawData[index].toString().trim();
    }
  }
  return '';
};

const normalizeBranch = (branch) => (branch || '').toLowerCase().replace(/branch/g, '').trim();
const getAssignedBranchKeys = user => {
  const values = [
    ...(Array.isArray(user?.assignedBranchesArray) ? user.assignedBranchesArray : []),
    ...String(user?.assignedBranches || '').split(/[\n,;]+/),
    user?.sittingBranch
  ];
  return [...new Set(values.map(normalizePlacementText).filter(Boolean))];
};
const userHasBranch = (user, branch) => {
  const rowBranch = normalizePlacementText(branch);
  const assigned = getAssignedBranchKeys(user);
  return Boolean(rowBranch && assigned.some(value => value === 'all' || value === 'allbranches' || rowBranch === value || rowBranch.includes(value) || value.includes(rowBranch)));
};

// 🚨 NEW: SMART DATE PARSER FOR GOOGLE SHEETS
const safeParseDate = (dateStr) => {
  if (!dateStr) return null;
  const input = String(dateStr).trim();
  const slashDate = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  let parsedDate;
  if (slashDate) {
    const [, first, second, year] = slashDate;
    const firstNumber = Number(first);
    const secondNumber = Number(second);
    // The portal's sheets use Indian day-first dates. If one part exceeds 12,
    // use it to recognize an unambiguous month-first date from older rows.
    const month = firstNumber > 12 ? secondNumber : secondNumber > 12 ? firstNumber : secondNumber;
    const day = firstNumber > 12 ? firstNumber : secondNumber > 12 ? secondNumber : firstNumber;
    parsedDate = new Date(Number(year), month - 1, day);
  } else {
    parsedDate = new Date(input);
  }
  return isNaN(parsedDate.getTime()) ? null : parsedDate;
};

// 🚨 UPSERT HELPER FOR TPO_STATS
const syncTpoStats = async (userName, updates) => {
  if (!userName) throw new Error("TPO Name is missing");
  
  const sheet = doc.sheetsByTitle["TPO_Stats"];
  if (!sheet) {
    throw new Error("The sheet named 'TPO_Stats' was not found in the Google Spreadsheet.");
  }
  
  const rows = await sheet.getRows();
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' });
  const currentMonthPrefix = formatter.format(new Date()).slice(0, 7); // e.g., "2026-09"
  
  let targetRow = rows.find(r => {
     const un = (r.get('USER') || '').toLowerCase().trim();
     const ts = r.get('TimeStamp') || '';
     const rowDate = safeParseDate(ts);
     const rowMonthStr = rowDate ? formatter.format(rowDate).slice(0, 7) : '';
     return un === userName.toLowerCase().trim() && rowMonthStr === currentMonthPrefix;
  });

  if (targetRow) {
     targetRow.assign(updates);
     await targetRow.save();
  } else {
     await sheet.addRow({
       'TimeStamp': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
       'USER': userName,
       ...updates
     });
  }
};

// =========================================================
// 🚨 ENTERPRISE DYNAMIC LOOKUP FUNCTIONS
// =========================================================
const getUserEmailById = (userId) => {
  const cache = getCache();
  if (!cache || !cache.users || !userId) return '';
  const cleanId = String(userId).trim().toLowerCase();
  
  const row = cache.users.find(r => {
    const rd = r.toObject();
    const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const uid = (rd[getH('userid')] || rd[getH('empid')] || '').toLowerCase().trim();
    return uid === cleanId;
  });
  
  if (row) {
    const rd = row.toObject();
    const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
    return rd[getH('email')] || rd[getH('mailid')] || '';
  }
  return '';
};

const getTpoEmailByName = (tpoName) => {
  const cache = getCache();
  if (!cache || !cache.contacts) return '';
  const searchName = (tpoName || '').toLowerCase().replace(/\s/g, '');
  if (!searchName) return '';
  
  for (let row of cache.contacts) {
    const name = getValByHeader(row, ['tponame', 'name']).toLowerCase().replace(/\s/g, '');
    if (name === searchName) {
      return getValByHeader(row, ['mailid', 'email']);
    }
  }
  return '';
};

const getAssignedTpoEmail = (branch) => {
  const cache = getCache();
  if (!cache || !cache.contacts) return '';
  const searchBranch = normalizeBranch(branch);
  if (!searchBranch) return '';

  for (let row of cache.contacts) {
    const assigned = getValByHeader(row, ['assignedbranches']).toLowerCase();
    const sitting = getValByHeader(row, ['sittingbranch']).toLowerCase();
    
    if (assigned.includes('all') || assigned.includes(searchBranch) || sitting.includes(searchBranch)) {
      return getValByHeader(row, ['mailid', 'email']);
    }
  }
  return '';
};

const getBranchManagerEmail = (branch) => {
  const cache = getCache();
  if (!cache || !cache.users) return '';
  const searchBranch = normalizeBranch(branch);
  if (!searchBranch) return '';

  for (let row of cache.users) {
    const rawRole = getValByHeader(row, ['role']).toLowerCase().replace(/\s/g, '');
    const br1 = getValByHeader(row, ['sittingbranch']).toLowerCase();
    const br2 = getValByHeader(row, ['assignedbranches']).toLowerCase();
    
    if (rawRole.includes('branchmanager') && (br1.includes(searchBranch) || br2.includes(searchBranch) || searchBranch === 'all')) {
      return getValByHeader(row, ['mailid', 'email']);
    }
  }
  return '';
};

const getAllTpoEmails = () => {
  const cache = getCache();
  if (!cache || !cache.contacts) return [];
  return cache.contacts.map(r => getValByHeader(r, ['mailid', 'email'])).filter(Boolean);
};

const getAllBranchManagerEmails = () => {
  const cache = getCache();
  if (!cache || !cache.users) return [];
  return cache.users.filter(r => {
    const role = getValByHeader(r, ['role']).toLowerCase().replace(/\s/g, '');
    return role.includes('branchmanager');
  }).map(r => getValByHeader(r, ['mailid', 'email'])).filter(Boolean);
};

const logMailToSheet = async (receiverName, receiverMail, mailType, subject, status) => {
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
};

const sendMailAndLog = async (mailOptions, logDetails) => {
  try {
    await sendIPCSMail(mailOptions);
    await logMailToSheet(logDetails.name, logDetails.email, logDetails.type, mailOptions.subject, 'Success');
    return true;
  } catch (err) {
    await logMailToSheet(logDetails.name, logDetails.email, logDetails.type, mailOptions.subject, `Failed: ${err.message}`);
    console.error("Mail Dispatch Error:", err);
    throw err;
  }
};

// ---------------------------------------------------------
// 🚨 MASTER STUDENT EMAIL ENGINE (NOW WITH .ICS INVITES)
// ---------------------------------------------------------
const checkAndSendStudentMails = async (studentData, newStatus, interviewDetails = {}, currentUserEmail = '') => {
  if (!studentData.email || !newStatus) return;
  const status = newStatus.toLowerCase().trim();
  
  const cache = getCache();
  const logs = (cache.tpoLogs || []).filter(r => 
    (getValByHeader(r, ['rollnumber', 'roll']) === studentData.roll || getValByHeader(r, ['studentname', 'name']) === studentData.name)
  );

  const noAttendJobs = new Set();
  const rejectedJobs = new Set();

  logs.forEach(r => {
    const s = getValByHeader(r, ['status']).toLowerCase();
    const jId = getValByHeader(r, ['jobid']) || 'NO_ID';
    const cName = getValByHeader(r, ['companyname', 'company']) || 'NO_COMP';
    const uniqueKey = `${jId}_${cName}`;
    
    if (s === 'interview not attended') noAttendJobs.add(uniqueKey);
    if (s.includes('student rejected') || s.includes('offer rejected')) rejectedJobs.add(uniqueKey);
  });

  const currJId = studentData.jobId || 'NO_ID';
  const currCName = studentData.company || 'NO_COMP';
  const currKey = `${currJId}_${currCName}`;

  if (status === 'interview not attended') noAttendJobs.add(currKey);
  if (status.includes('student rejected') || status.includes('offer rejected')) rejectedJobs.add(currKey);

  const noAttendCount = noAttendJobs.size;
  const rejectCount = rejectedJobs.size;

  const assignedTpoEmail = getAssignedTpoEmail(studentData.branch);
  const scheduledTpoEmail = getTpoEmailByName(studentData.tpoName);
  const bmEmail = getBranchManagerEmail(studentData.branch);
  const giftyEmail = getUserEmailById('U003');

  let ccArray = [];

  if (status === 'interview scheduled') {
    ccArray = [scheduledTpoEmail, assignedTpoEmail];
  } else if (status === 'interview not attended' || status.includes('student rejected') || status.includes('offer rejected')) {
    if ((status === 'interview not attended' && noAttendCount >= 3) || 
        ((status.includes('student rejected') || status.includes('offer rejected')) && rejectCount >= 3)) {
      ccArray = [scheduledTpoEmail, assignedTpoEmail, giftyEmail, bmEmail];
    } else {
      ccArray = [assignedTpoEmail];
    }
  } else {
    ccArray = [currentUserEmail, assignedTpoEmail];
  }

  const ccList = [...new Set(ccArray)].filter(Boolean).join(',');

  let subject = ''; let html = ''; let mailType = ''; let attachments = []; 
  const refId = Math.floor(10000 + Math.random() * 90000); 

  const logo1 = "https://lh3.googleusercontent.com/d/1VqmH9-l2lBHErJPW1tCjtCu-SrTEMPtN";
  const logo2 = "https://lh3.googleusercontent.com/d/1bHpUfH_578DmfityB9cOgFNYhbBGdG9J";
  const watermark = "https://lh3.googleusercontent.com/d/1dr27VR3Xu8EwDf4dCAO1ucq441VjpfwB";

  const buildBrandedEmail = (title, headerColor, bodyContent) => `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); background-color: #ffffff;">
      <div style="background-color: #0f1523; padding: 25px 20px; text-align: center; border-bottom: 5px solid ${headerColor};">
        <div style="margin-bottom: 12px;">
          <img src="${logo1}" alt="IPCS Logo" style="max-height: 38px; margin: 0 8px; display: inline-block; vertical-align: middle;" />
          <img src="${logo2}" alt="Talenzo Logo" style="max-height: 38px; margin: 0 8px; display: inline-block; vertical-align: middle;" />
        </div>
        <h2 style="color: #ffffff; margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px;">${title}</h2>
        <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 13px;">IPCS Global Placement Cell</p>
      </div>
      <div style="background-image: url('${watermark}'); background-repeat: no-repeat; background-position: center center; background-size: cover; background-color: #ffffff;">
        <div style="padding: 35px 30px; background-color: rgba(255, 255, 255, 0.94); color: #334155; font-size: 15px; line-height: 1.65;">
          ${bodyContent}
        </div>
      </div>
    </div>
  `;

  if (status === 'interview scheduled') {
    subject = `Congratulations, ${studentData.name} ! Your Interview Awaits! # ${studentData.company} [Ref: ${refId}]`;
    mailType = 'Interview Schedule';
    
    html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
        <div style="background-color: #0f1523; padding: 35px 20px; text-align: center; border-bottom: 5px solid #8b5cf6;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px; text-transform: uppercase;">Interview Invitation</h1>
          <p style="color: #94a3b8; margin: 10px 0 0 0; font-size: 14px;">IPCS Global Placement Cell</p>
        </div>
        <div style="padding: 40px 35px;">
          <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 22px;">Congratulations, ${studentData.name}!</h2>
          <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 30px 0;">
            We are thrilled to inform you that you have been <strong style="color: #0f1523;">selected for an interview</strong> with one of our esteemed partner companies.
          </p>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 5px solid #8b5cf6; border-radius: 8px; padding: 25px; margin-bottom: 30px;">
            <h3 style="margin: 0 0 15px 0; color: #0f1523; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;">Event Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tbody>
                <tr><td style="padding: 10px 0; color: #64748b; font-size: 14px; font-weight: 600; width: 35%; border-bottom: 1px solid #e2e8f0;">Company:</td><td style="padding: 10px 0; color: #0f1523; font-size: 16px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${studentData.company}</td></tr>
                <tr><td style="padding: 10px 0; color: #64748b; font-size: 14px; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Position:</td><td style="padding: 10px 0; color: #0f1523; font-size: 15px; border-bottom: 1px solid #e2e8f0;">${studentData.position || 'Professional'}</td></tr>
                <tr><td style="padding: 10px 0; color: #64748b; font-size: 14px; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Date:</td><td style="padding: 10px 0; color: #0f1523; font-size: 15px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${interviewDetails.date || 'TBD'}</td></tr>
                <tr><td style="padding: 10px 0; color: #64748b; font-size: 14px; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Time:</td><td style="padding: 10px 0; color: #0f1523; font-size: 15px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${interviewDetails.time || 'TBD'}</td></tr>
                <tr><td style="padding: 10px 0; color: #64748b; font-size: 14px; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Venue / Link:</td><td style="padding: 10px 0; color: #8b5cf6; font-size: 15px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${interviewDetails.venue || 'TBD'}</td></tr>
              </tbody>
            </table>
          </div>
          <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 25px 0; padding: 15px; background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px;">
            Please find the <b>Calendar Invite</b> attached to this email. You can click it to add this interview directly to your phone's calendar so you do not miss it.
          </p>
          <div style="border-top: 1px solid #e2e8f0; padding-top: 25px;">
            <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 15px 0;">We wish you the very best of luck!</p>
            <p style="font-size: 15px; color: #0f1523; font-weight: bold; margin: 0;">Regards,<br><span style="color: #8b5cf6;">IPCS Placement Cell</span></p>
          </div>
        </div>
      </div>
    `;

    // 🚨 CALENDAR .ICS ATTACHMENT GENERATOR 🚨
    if (interviewDetails.date && interviewDetails.time) {
      try {
        const formattedDate = interviewDetails.date.replace(/-/g, '');
        const formattedTime = interviewDetails.time.replace(/:/g, '') + '00';
        const dtStart = `${formattedDate}T${formattedTime}`;
        const icsContent = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Talenzo//IPCS//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:REQUEST\r\nBEGIN:VEVENT\r\nSUMMARY:Interview at ${studentData.company}\r\nDTSTART;TZID=Asia/Kolkata:${dtStart}\r\nLOCATION:${interviewDetails.venue || 'TBD'}\r\nDESCRIPTION:You have an interview scheduled for the ${studentData.position || 'Professional'} role. Please be on time.\r\nSTATUS:CONFIRMED\r\nEND:VEVENT\r\nEND:VCALENDAR`;

        attachments.push({
          filename: 'interview-invite.ics',
          content: icsContent,
          contentType: 'text/calendar'
        });
      } catch(e) { console.error("Failed to generate ICS file", e); }
    }
  }
  else if (status === 'interview not attended') {
    if (noAttendCount === 2) {
      subject = `❗Warning – Non-Attendance for Scheduled Interview [Ref: ${refId}]`;
      mailType = 'Warning Mail';
      html = buildBrandedEmail('Official Warning', '#f59e0b', `
        <p style="font-size: 16px; margin-top: 0;">Dear <b>${studentData.name}</b>,</p>
        <p>Greetings from the Placement Team.</p>
        <p>This is to formally inform you that you have <b>failed to attend the interview scheduled for you for the second time</b> without prior intimation or a valid reason.</p>
        <p>We expect your full cooperation and commitment towards the placement process.</p>
      `);
    } else if (noAttendCount >= 3) {
      subject = `❗Final Warning – Placement Assistance Put on Hold [Ref: ${refId}]`;
      mailType = 'Hold Mail';
      html = buildBrandedEmail('Placement Assistance Put on Hold', '#ef4444', `
        <p style="font-size: 16px; margin-top: 0;">Dear <b>${studentData.name}</b>,</p>
        <p>Greetings from the Placement Team.</p>
        <p>This is to formally inform you that you have <b>failed to attend the interview scheduled for you for the third time.</b></p>
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #991b1b; font-weight: bold; font-size: 15px;">Your placement assistance is hereby put on hold with immediate effect.</p>
        </div>
        <p><b>Please treat this matter as serious and final.</b></p>
      `);
    }
  }
  else if (status.includes('student rejected') || status.includes('offer rejected')) {
    if (rejectCount === 2) {
      subject = `❗Warning – Rejection of Job Offer for the Second Time [Ref: ${refId}]`;
      mailType = 'Warning Mail';
      html = buildBrandedEmail('Official Warning', '#f59e0b', `
        <p style="font-size: 16px; margin-top: 0;">Dear <b>${studentData.name}</b>,</p>
        <p>Greetings from the Placement Team.</p>
        <p>This is to formally inform you that you have <b>rejected a job offer for the second time</b> after being selected through the IPCS Global placement process.</p>
        <p>Please take this warning seriously and ensure strict adherence to the IPCS Placement Policy going forward.</p>
      `);
    } else if (rejectCount >= 3) {
      subject = `❗Final Warning – Placement Assistance Put on Hold [Ref: ${refId}]`;
      mailType = 'Hold Mail';
      html = buildBrandedEmail('Placement Assistance Put on Hold', '#ef4444', `
        <p style="font-size: 16px; margin-top: 0;">Dear <b>${studentData.name}</b>,</p>
        <p>Greetings from the Placement Team.</p>
        <p>This is to formally inform you that you have <b>rejected a job offer for the third time</b> after being selected through the IPCS Global placement process.</p>
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #991b1b; font-weight: bold; font-size: 15px;">Accordingly, your placement assistance is hereby put on hold with immediate effect.</p>
        </div>
      `);
    }
  }
  else if (status.includes('placed') || status.includes('joined') || status.includes('got offer')) {
    subject = `Congratulations! Placement Confirmed at ${studentData.company} [Ref: ${refId}]`;
    mailType = 'Congratulation Mail';
    html = buildBrandedEmail('Congratulations on Your Placement!', '#10b981', `
      <p style="font-size: 18px; color: #10b981; font-weight: bold; margin-top: 0;">Congratulations on your placement!</p>
      <p>Dear <b>${studentData.name}</b>,</p>
      <p>We are incredibly proud to announce that your placement at <b>${studentData.company}</b> has been confirmed!</p>
      <p>Your hard work and dedication have paid off. We wish you the absolute best in your new career journey. Make IPCS proud!</p>
    `);
  }

  if (subject && html) {
    await sendMailAndLog({
      from: `"IPCS Placement Cell" <${process.env.EMAIL_USER}>`,
      to: studentData.email,
      cc: ccList,
      subject: subject,
      html: html,
      attachments: attachments 
    }, { name: studentData.name, email: studentData.email, type: mailType });
  }
};

// ---------------------------------------------------------
// AUTHENTICATION
// ---------------------------------------------------------
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    const cache = getCache();
    
    if (!cache?.authCacheReady || !Array.isArray(cache.contacts) || !Array.isArray(cache.users)) {
       return res.status(503).json({ success: false, message: "System is booting up. Please try again in 5 seconds." });
    }

    const cleanInput = (email || '').toString().trim().toLowerCase();
    const cleanPass = (password || '').toString().trim();
    let foundUser = null; 
    let role = 'TPO'; 
    let course = 'All'; 
    let userName = '';
    let department = '';

    for (let row of cache.contacts) {
      const sheetMail = getValByHeader(row, ['mailid', 'email']).toLowerCase();
      const sheetPass = getValByHeader(row, ['password']);
      
      if (sheetMail === cleanInput && sheetPass === cleanPass && cleanInput !== '') {
        foundUser = {
          email: getValByHeader(row, ['mailid', 'email']) || cleanInput,
          sittingbranch: getValByHeader(row, ['sittingbranch']),
          assignedbranches: getValByHeader(row, ['assignedbranches']),
          assignedcourses: getValByHeader(row, ['assignedcourses', 'assignedcourse', 'course']),
          department: getValByHeader(row, ['department']),
          access: getValByHeader(row, ['access', 'accesstype']),
          profilephoto: getValByHeader(row, ['profilephoto', 'profilephotourl', 'photo']),
          contactnumber: getValByHeader(row, ['contactnumber', 'contact', 'phoneno']),
          empId: getValByHeader(row, ['empid', 'employeeid']),
          target: getValByHeader(row, ['target', 'targetofthemonth'])
        };
        role = 'TPO';
        course = foundUser.assignedcourses || 'All Courses';
        department = foundUser.department;
        userName = getValByHeader(row, ['tponame', 'name']) || 'TPO User';
        break;
      }
    }

    if (!foundUser) {
      for (let row of cache.users) {
        const sheetUsername = getValByHeader(row, ['username', 'name']).toLowerCase();
        const sheetMail = getValByHeader(row, ['mailid', 'email']).toLowerCase();
        const sheetLoginId = getValByHeader(row, ['loginid']).toLowerCase();
        const sheetPass = getValByHeader(row, ['password']);
        
        if ((sheetUsername === cleanInput || sheetMail === cleanInput || sheetLoginId === cleanInput) && sheetPass === cleanPass && cleanInput !== '') {
          foundUser = {
            email: getValByHeader(row, ['mailid', 'email']) || cleanInput,
            sittingbranch: getValByHeader(row, ['sittingbranch']),
            assignedbranches: getValByHeader(row, ['assignedbranches']),
          assignedcourses: getValByHeader(row, ['assignedcourses', 'assignedcourse', 'course']),
          department: getValByHeader(row, ['department']),
            access: getValByHeader(row, ['access', 'accesstype']),
            profilephoto: getValByHeader(row, ['profilephoto', 'profilephotourl', 'photo']),
            contactnumber: getValByHeader(row, ['contactnumber', 'contact', 'phoneno']),
            empId: getValByHeader(row, ['empid', 'employeeid']),
            target: getValByHeader(row, ['target', 'targetofthemonth'])
          };
          role = getValByHeader(row, ['role']) || 'RTH';
          course = foundUser.assignedcourses || 'All';
          department = foundUser.department;
          userName = getValByHeader(row, ['username', 'name']) || 'User';
          break;
        }
      }
    }

    if (!foundUser) {
      if (!cache.authSheetsHealthy?.contacts || !cache.authSheetsHealthy?.users) {
        return res.status(503).json({ success: false, message: 'Login records are temporarily unavailable. Please retry shortly.' });
      }
      return res.status(401).json({ success: false, message: "Invalid Login ID or Password." });
    }

    const parseAssignments = value => String(value || '').split(/[\n,;]+/).map(item => item.trim().replace(/^\d+\.\s*/, '').toLowerCase()).filter(item => item && !/^(?:[-–—]|n\/a|none)$/i.test(item));
    let assignedArray = parseAssignments(foundUser.assignedbranches);
    if (!assignedArray.length) assignedArray = parseAssignments(foundUser.sittingbranch);
    const upperRole = role.toUpperCase();
    let accessType = 'edit';
    const sheetAccess = (foundUser['access'] || '').toString().toUpperCase();
    
    if (upperRole.includes('ADMIN') || upperRole === 'GENERAL MANAGER' || upperRole === 'TECHNICAL HEAD' || upperRole === 'ZONAL PLACEMENT HEAD' || sheetAccess.includes('SUPER_ADMIN')) {
      accessType = 'superadmin';
    } else if (sheetAccess.includes('VIEW ONLY') && !sheetAccess.includes('EDIT')) {
      accessType = 'view';
    } else if (sheetAccess.includes('VIEW & EDIT') || sheetAccess.includes('EDIT') || sheetAccess.includes('MANAGER') || sheetAccess.includes('TRAINER') || sheetAccess.includes('STAFF')) {
      accessType = 'edit';
    }

    if (accessType === 'superadmin') {
      assignedArray = ['all'];
    }

    const sessionToken = `IPCS_SESS_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const sessionKey = String(foundUser.email || cleanInput).trim().toLowerCase();
    const sessionUser = {
      name: userName,
      email: sessionKey,
      loginId: cleanInput,
      sittingBranch: foundUser['sittingbranch'] || 'N/A',
      assignedBranchesArray: assignedArray,
      photo: foundUser['profilephoto'] || '',
      phone: foundUser['contactnumber'] || 'Not Provided',
      role,
      department,
      assignedCourse: course,
      accessType,
      empId: foundUser.empId || '',
      target: foundUser.target || '0'
    };
    activeSessions.set(sessionKey, sessionToken);
    activeAccounts.set(sessionKey, sessionUser);

    (async () => {
      try {
        const sheet = doc.sheetsByIndex.find(s => s.title.replace(/\s/g, '').toLowerCase().includes('security_logs'));
        if (sheet) {
          const rawIp = req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || 'Unknown IP';
          const cleanIp = rawIp.replace('::ffff:', '').trim();
          const uaInfo = parseUserAgent(req.headers['user-agent'] || '');

          await sheet.addRow({
            'TimeStamp': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            'UserName': userName,
            'Email': cleanInput,
            'Role': role,
            'Branch': foundUser['sittingbranch'] || 'All Branches',
            'IPAddress': cleanIp,
            'Device': uaInfo.device,
            'OS': uaInfo.os,
            'Browser': uaInfo.browser,
            'Status': 'Active'
          });
        }
      } catch (logErr) {}
    })();

    return res.json({ 
      success: true, 
      tpo: { ...sessionUser, sessionToken }
    });
  } catch (error) { 
    res.status(500).json({ success: false, message: error.message }); 
  }
};

exports.getDashboardStats = async (req, res) => {
  const { assignedBranchesArray, role, assignedCourse, department } = req.body;
  const checkAccess = (rBranch, rCourse) => hasAccess(rBranch, rCourse, role, assignedBranchesArray, assignedCourse, department);

  const cache = getCache();
  let studentCount = 0, pendingApps = 0, placedCount = 0, activeVacs = 0;
  const clientRows = cache.clients || [];
  const totalCompanies = clientRows.reduce((count, row) => {
    const companyName = getValByHeader(row, ['companyname', 'company']).trim();
    return count + (companyName ? 1 : 0);
  }, 0);

  cache.students.forEach(row => { 
    const branch = getValByHeader(row, ['branch']);
    const course = getValByHeader(row, ['course']);
    if (checkAccess(branch, course)) studentCount++; 
  });
  
  const logsSource = cache.tpoLogs || [];
  const dedupedLogs = latestPlacementRows(logsSource, getValByHeader);

  dedupedLogs.forEach(row => {
    const branch = getValByHeader(row, ['branch']);
    const course = getValByHeader(row, ['course']);
    
    if (checkAccess(branch, course)) {
      const stat = getValByHeader(row, ['status']).toLowerCase();
      const joinStat = getValByHeader(row, ['joiningstatus']).toLowerCase();
      const placeStat = getValByHeader(row, ['placementstatus']).toLowerCase();

      if (stat === 'applied') pendingApps++;
      if (stat.includes('placed') || stat.includes('got offer') || stat.includes('offer') || joinStat.includes('join') || placeStat.includes('placed')) {
        placedCount++;
      }
    }
  });
  
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);

  (cache.vacancies || []).forEach(row => {
    const status = getValByHeader(row, ['status']).toLowerCase() || 'open';
    const lastDateStr = getValByHeader(row, ['lastdate']);
    let isExpired = false;

    if (lastDateStr) {
      const parsedDate = safeParseDate(lastDateStr);
      if (parsedDate && parsedDate < todayStart) isExpired = true;
    }

    if ((status.includes('open') || status.includes('yes')) && !isExpired && checkAccess('All', getValByHeader(row, ['course', 'program']))) {
      activeVacs++;
    }
  });

  let eventsList = cache.events.filter(row => checkAccess(getValByHeader(row, ['branch', 'sittingbranch']), getValByHeader(row, ['course', 'assignedcourse'])))
    .slice(-8)
    .map(row => ({ title: getValByHeader(row, ['title']) || 'Event', date: getValByHeader(row, ['date']) || '', time: getValByHeader(row, ['time']) || '', type: getValByHeader(row, ['type', 'event']) || 'Placement Drive', location: getValByHeader(row, ['location', 'eventhappeningin']) || '' }));
  
  res.json({ 
    success: true, 
    stats: { 
      totalStudents: studentCount, 
      pendingApps, 
      placed: placedCount, 
      activeVacancies: activeVacs,
      totalCompanies
    }, 
    events: eventsList.reverse() 
  });
};

exports.getStudents = (req, res) => {
  const { assignedBranchesArray, role, assignedCourse } = req.body;
  const cache = getCache();
  let students = []; let stats = { total: 0, pending: 0, notResponding: 0, noNeed: 0, branchCounts: {}, courseCounts: {} };

  cache.students.forEach(row => {
    const branch = getValByHeader(row, ['branch']) || 'Unknown';
    const course = getValByHeader(row, ['course']) || 'Unknown';

    if (hasAccess(branch, course, role, assignedBranchesArray, assignedCourse, req.portalUser?.department)) {
      stats.total++;
      
      const pStatus = (getValByHeader(row, ['placementstat', 'placementstatus']) || 'Pending').toString().trim();
      const pLower = pStatus.toLowerCase();
      
      if (pLower.includes('not responding')) stats.notResponding++;
      else if (pLower.includes('no need')) stats.noNeed++;
      else if (pLower.includes('pending') || pLower === '') stats.pending++;

      stats.branchCounts[branch] = (stats.branchCounts[branch] || 0) + 1;
      stats.courseCounts[course] = (stats.courseCounts[course] || 0) + 1;

      students.push({
        rowIdx: row.rowNumber, 
        name: getValByHeader(row, ['name', 'studentname']) || '', 
        email: getValByHeader(row, ['mailid', 'email']) || '', 
        phone: getValByHeader(row, ['phone', 'contact']) || 'N/A', 
        roll: getValByHeader(row, ['ipcsrollnumber', 'rollnumber', 'roll']) || '', 
        branch: branch, 
        course: course, 
        photo: getValByHeader(row, ['profilephoto', 'photo']) || '', 
        qual: getValByHeader(row, ['qualification', 'qual']) || '', 
        stream: getValByHeader(row, ['stream']) || '', 
        status: getValByHeader(row, ['coursestatus', 'status(currently']) || 'N/A', 
        resume: getValByHeader(row, ['resume', 'cv']) || '', 
        certificate: getValByHeader(row, ['certificate']) || '',
        vacOpen: getValByHeader(row, ['vacancyopen', 'vaccancyopen']) || 'Yes', 
        studyAccess: getValByHeader(row, ['studymaterialaccess']) || 'No', 
        examAccess: getValByHeader(row, ['technialexam', 'technicalexam']) || 'No', 
        placementStatus: pStatus,
        rawData: typeof row.toObject === 'function' ? row.toObject() : {}
      });
    }
  });
  res.json({ success: true, students: students.reverse(), stats });
};

exports.updateStudent = async (req, res) => {
  const { rowNumber, vacOpen, placementStatus, studyAccess, examAccess, courseStatus, coursePercentage } = req.body || {};
  const rowIndex = Number(rowNumber);
  const user = req.portalUser;
  const role = String(user?.role || '').toUpperCase();
  const isAdmin = user?.accessType === 'superadmin' || ['SYSTEM ADMIN', 'GENERAL MANAGER', 'ZONAL PLACEMENT HEAD', 'TECHNICAL HEAD'].includes(role);
  const isPlacementEditor = isAdmin || role === 'TPO' || role.includes('PLACEMENT OFFICER');
  const isTechnicalLead = /TECH(?:NICAL)?\s+LEAD/.test(role) || /(^|[^A-Z0-9])TL([^A-Z0-9]|$)/.test(role);
  const isRth = /(^|[^A-Z0-9])RTH([^A-Z0-9]|$)/.test(role) || role === 'REGIONAL TECHNICAL HEAD';
  const isTth = /(^|[^A-Z0-9])TTH([^A-Z0-9]|$)/.test(role) || role === 'TERRITORY TECHNICAL HEAD';
  const isTrainer = role.includes('TRAINER') && (!String(user?.department || '').trim() || String(user.department).toUpperCase() === 'ACADEMIC');
  const isAcademicEditor = isAdmin || isRth || isTth || isTrainer || isTechnicalLead;
  if (!Number.isInteger(rowIndex) || rowIndex < 2) return res.status(400).json({ success: false, message: 'A valid student record is required.' });
  if (!isPlacementEditor && !isAcademicEditor) return res.status(403).json({ success: false, message: 'Your role cannot update this student record.' });
  if (studyAccess !== undefined && !['yes', 'no'].includes(String(studyAccess).toLowerCase())) return res.status(400).json({ success: false, message: 'Study access must be Yes or No.' });
  if (examAccess !== undefined && !['yes', 'no'].includes(String(examAccess).toLowerCase())) return res.status(400).json({ success: false, message: 'Technical exam access must be Yes or No.' });
  try {
    const stuSheet = doc.sheetsByTitle["Data"];
    if (!stuSheet) return res.status(503).json({ success: false, message: 'Student register is unavailable.' });
    const rows = await stuSheet.getRows({ offset: rowIndex - 2, limit: 1 });
    if (rows.length > 0) {
      const studentBranch = getValByHeader(rows[0], ['branch']) || '';
      const studentCourse = getValByHeader(rows[0], ['course']) || '';
      if (!hasAccess(studentBranch, studentCourse, user.role, user.assignedBranchesArray, user.assignedCourse, user.department)) {
        return res.status(403).json({ success: false, message: 'This student is outside your branch or course assignment.' });
      }
      const headers = stuSheet.headerValues.map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
      const updateObj = {};
      
      const getRealHeader = (searchStrs) => {
        for (let s of searchStrs) {
          const clean = s.toLowerCase().replace(/\s/g, '');
          const index = headers.indexOf(clean);
          if (index !== -1) return stuSheet.headerValues[index];
        }
        return null;
      };

      const getOldVal = (hName) => {
        const idx = stuSheet.headerValues.indexOf(hName);
        if (idx === -1) return '';
        return rows[0]._rawData[idx] ? rows[0]._rawData[idx].toString().trim() : '';
      };

      const vH = getRealHeader(['vacancyopen', 'vaccancyopen']); 
      let oldVacOpen = vH ? getOldVal(vH).toLowerCase() : '';
      if(isPlacementEditor && vH && vacOpen !== undefined) updateObj[vH] = vacOpen;
      
      const pH = getRealHeader(['placementstatus', 'placementstat', 'placementstatsu']); if(isPlacementEditor && pH && placementStatus !== undefined) updateObj[pH] = placementStatus;
      const sH = getRealHeader(['studymaterialaccess']); if(isAcademicEditor && sH && studyAccess !== undefined) updateObj[sH] = studyAccess;
      const eH = getRealHeader(['technicalexam', 'technialexam']); if(isAcademicEditor && eH && examAccess !== undefined) updateObj[eH] = examAccess;
      
      const cPercH = getRealHeader(['coursepercentage']);
      if (isAcademicEditor && cPercH && coursePercentage !== undefined) updateObj[cPercH] = coursePercentage;

      const cStatusH = getRealHeader(['coursestatus', 'status(currently']); 
      if (isAcademicEditor && cStatusH) {
        if (coursePercentage === '100% completed' || coursePercentage === '100%') {
          updateObj[cStatusH] = 'Completed Course';
        } else if (courseStatus !== undefined) {
          updateObj[cStatusH] = courseStatus;
        }
      }

      if (Object.keys(updateObj).length === 0) return res.status(400).json({ success: false, message: 'No permitted student fields were provided.' });
      rows[0].assign(updateObj); 
      await rows[0].save(); 

      if (vacOpen && vacOpen.toString().toLowerCase() === 'yes' && oldVacOpen !== 'yes') {
         let sName = getValByHeader(rows[0], ['name', 'studentname']) || 'Student';
         let sEmail = getValByHeader(rows[0], ['mailid', 'email']);

         if (sEmail) {
            const refId = Math.floor(10000 + Math.random() * 90000); 
            const html = `
              <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #0f1523; padding: 20px; text-align: center; border-bottom: 4px solid #8b5cf6;">
                  <h2 style="color: #ffffff; margin: 0;">PORTAL ACCESS GRANTED!</h2>
                </div>
                <div style="padding: 30px; background-color: #ffffff;">
                  <p style="font-size: 16px; margin-top: 0;">Dear <b>${sName}</b>,</p>
                  <p style="font-size: 15px; line-height: 1.6; color: #475569;">Congratulations! Your trainer has confirmed your exceptional performance.</p>
                  <p style="font-size: 15px; line-height: 1.6; color: #475569;"><b>Your placement portal access is now fully active.</b> You can now browse active vacancies and apply directly for job openings.</p>
                  <div style="text-align: center; margin: 35px 0;">
                    <a href="https://placement.ipcsglobal.info" style="background-color: #0284c7; color: white; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; font-size: 16px; display: inline-block;">Access Placement Portal</a>
                  </div>
                  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">
                    <p style="margin: 0 0 5px 0;">Regards,</p>
                    <p style="margin: 0 0 2px 0; font-weight: bold; color: #0f1523; font-size: 14px;">IPCS Placement Cell</p>
                  </div>
                </div>
              </div>
            `;
            sendMailAndLog({ from: `"IPCS Placement Cell" <${process.env.EMAIL_USER}>`, to: sEmail, subject: `Welcome to IPCS Placements! Your Profile is Active [Ref: ${refId}]`, html: html }, { name: sName, email: sEmail, type: 'Course Completion Welcome' })
              .catch(error => console.error('Student welcome email failed:', error.message));
         }
      }

      refreshCache(); 
      res.json({ success: true, message: "Student record updated!" });
    } else { res.status(404).json({ success: false, message: "Row not found." }); }
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.getApplications = async (req, res) => {
  const { assignedBranchesArray, role, assignedCourse, department } = req.body;
  if (!getCache()) await refreshCache();
  if (!getCache()) return res.status(503).json({ success: false, message: 'Placement data is still syncing. Please refresh shortly.' });
  let appsList = []; 
  const cache = getCache();
  
  const sourceData = cache.applications || [];

  sourceData.forEach((row) => {
    const branch = getValByHeader(row, ['branch']) || 'Unknown';
    const course = getValByHeader(row, ['course']) || 'Unknown';
    if (hasAccess(branch, course, role, assignedBranchesArray, assignedCourse, department)) {
      const roll = getValByHeader(row, ['roll']) || ''; 
      const jobId = getValByHeader(row, ['jobid']) || '';
      let phone = getValByHeader(row, ['contact', 'phone']) || '';
      let email = getValByHeader(row, ['mail', 'email']) || '';
      let resume = getValByHeader(row, ['resume', 'cv']) || '';
      let qual = getValByHeader(row, ['qual']) || '';

      if (!phone || !email) {
        const studentData = (cache.students || []).find(s => {
          const sRoll = getValByHeader(s, ['roll', 'rollnumber', 'ipcsrollnumber']);
          return sRoll && sRoll === roll;
        });
        if (studentData) {
          if (!phone) phone = getValByHeader(studentData, ['phone', 'contact']) || '';
          if (!email) email = getValByHeader(studentData, ['mailid', 'email']) || '';
          if (!resume) resume = getValByHeader(studentData, ['resume', 'cv']) || '';
          if (!qual) qual = getValByHeader(studentData, ['qual', 'qualification']) || '';
        }
      }

      appsList.push({
        rowNumber: row.rowNumber, name: getValByHeader(row, ['name', 'studentname']) || '', roll: roll, branch: branch, course: course, qual: qual || 'Not Specified', jobId: jobId, company: getValByHeader(row, ['company', 'companyname']) || 'Unknown Company', position: getValByHeader(row, ['position', 'role']) || 'Unknown Position', date: getValByHeader(row, ['time', 'date', 'timestamp']) || '', status: getValByHeader(row, ['status']) || 'Applied', remarks: getValByHeader(row, ['remarks']) || '', tpoName: getValByHeader(row, ['placementofficer']) || '', phone: phone, email: email, resume: resume, datePlaced: getValByHeader(row, ['dateplaced']) || '', packageLpa: getValByHeader(row, ['package']) || '', offerLetter: getValByHeader(row, ['offerletter']) || '', joiningStatus: getValByHeader(row, ['joiningstatus']) || ''
      });
    }
  });
  
  res.json({ success: true, applications: appsList });
};

exports.updateApplication = async (req, res) => {
  const rowNumber = parseInt(req.body.rowNumber);
  const { status, remarks, datePlaced, packageLpa, joiningStatus, currentUserEmail, interviewDate, interviewTime, interviewVenue } = req.body;
  
  let fullApp = {};
  if (typeof req.body.fullApp === 'string') {
    try {
      if (req.body.fullApp !== "[object Object]") {
        fullApp = JSON.parse(req.body.fullApp);
      }
    } catch(e) {}
  } else if (typeof req.body.fullApp === 'object' && req.body.fullApp !== null) {
    fullApp = req.body.fullApp;
  }

  let offerLetterLink = req.body.offerLetter || fullApp.offerLetter || '';

  try {
    const appSheet = doc.sheetsByTitle["Opening_Applied"];
    if (!appSheet || isNaN(rowNumber)) return res.status(400).json({ success: false, message: "Invalid payload or sheet missing." });

    const rows = await appSheet.getRows({ offset: rowNumber - 2, limit: 1 });
    
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: "Application record not found in Google Sheets." });
    }

    const user = req.portalUser;
    const sourceRow = rows[0];
    const sourceBranch = getValByHeader(sourceRow, ['branch']);
    const sourceCourse = getValByHeader(sourceRow, ['course']);
    if (!hasAccess(sourceBranch, sourceCourse, user?.role, user?.assignedBranchesArray, user?.assignedCourse, user?.department)) {
      return res.status(403).json({ success: false, message: 'This application is outside your branch or course assignment.' });
    }
    if (req.file) offerLetterLink = await uploadToDrive(req.file, FOLDER_OFFER_LETTERS);
    
    const headers = appSheet.headerValues;
    const getSafeH = (searchStrs) => {
      for (let s of searchStrs) {
        const clean = s.toLowerCase().replace(/\s/g, '');
        const exact = headers.find(h => h.toLowerCase().replace(/\s/g, '') === clean);
        if (exact) return exact;
      }
      for (let s of searchStrs) {
        const clean = s.toLowerCase().replace(/\s/g, '');
        const partial = headers.find(h => h.toLowerCase().replace(/\s/g, '').includes(clean));
        if (partial) return partial;
      }
      return null;
    };

    const oldStatusH = getSafeH(['status']);
    const oldStatus = oldStatusH && rows[0]._rawData[headers.indexOf(oldStatusH)] ? rows[0]._rawData[headers.indexOf(oldStatusH)].toString().toLowerCase() : '';

    // Treat the selected sheet row as the source of placement identity; the
    // browser's fullApp payload is only presentation data and is not trusted.
    const sName = getValByHeader(sourceRow, ['name', 'studentname']) || fullApp.name || '';
    const sContact = getValByHeader(sourceRow, ['contact', 'phone']) || fullApp.phone || '';
    const sMail = getValByHeader(sourceRow, ['mailid', 'email']) || fullApp.email || '';
    const sRoll = getValByHeader(sourceRow, ['rollnumber', 'rollno']) || fullApp.roll || '';
    const sCourse = sourceCourse || fullApp.course || '';
    const sBranch = sourceBranch || fullApp.branch || '';
    const sQual = getValByHeader(sourceRow, ['qualification', 'qual']) || fullApp.qual || '';
    const sResume = getValByHeader(sourceRow, ['resume', 'cv']) || fullApp.resume || '';
    const sJobId = getValByHeader(sourceRow, ['jobid']) || fullApp.jobId || '';
    const sCompany = getValByHeader(sourceRow, ['companyname', 'company']) || fullApp.company || '';
    const sPosition = getValByHeader(sourceRow, ['position', 'role']) || fullApp.position || '';
    const sTpo = getValByHeader(sourceRow, ['placementofficer', 'tponame']) || user?.name || '';

    const updateObj = {};
    if (oldStatusH) updateObj[oldStatusH] = status;
    
    const hRemarks = getSafeH(['remarks']); if (hRemarks && remarks !== undefined) updateObj[hRemarks] = remarks;
    const hDatePlaced = getSafeH(['dateplaced']); if (hDatePlaced && datePlaced !== undefined) updateObj[hDatePlaced] = datePlaced;
    const hPackage = getSafeH(['package']); if (hPackage && packageLpa !== undefined) updateObj[hPackage] = packageLpa;
    const hOffer = getSafeH(['offerletter']); if (hOffer && offerLetterLink) updateObj[hOffer] = offerLetterLink;
    const hJoining = getSafeH(['joiningstatus']); if (hJoining && joiningStatus !== undefined) updateObj[hJoining] = joiningStatus;
    
    const hDate = getSafeH(['interviewdate']);
    const hTime = getSafeH(['interviewtime', 'intervewtime']);
    const hVenue = getSafeH(['interviewvenue']);
    
    if (hDate && interviewDate !== undefined) updateObj[hDate] = interviewDate;
    if (hTime && interviewTime !== undefined) updateObj[hTime] = interviewTime;
    if (hVenue && interviewVenue !== undefined) updateObj[hVenue] = updateObj[hVenue] = interviewVenue;

    rows[0].assign(updateObj); 
    await rows[0].save(); 
    
    try {
      const logSheet = doc.sheetsByTitle["TPO_Log"];
      if (logSheet) {
        const logHeaders = logSheet.headerValues;
        const logObj = {};
        
        const setLogH = (key, val) => {
           const cleanKey = key.toLowerCase().replace(/\s/g, '');
           const foundHeader = logHeaders.find(h => h.toLowerCase().replace(/\s/g, '') === cleanKey);
           if (foundHeader) logObj[foundHeader] = val;
        };

        setLogH('timestamp', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
        setLogH('studentname', sName);
        setLogH('contact', sContact);
        setLogH('mailid', sMail);
        setLogH('rollnumber', sRoll);
        setLogH('course', sCourse);
        setLogH('branch', sBranch);
        setLogH('qualification', sQual);
        setLogH('resume', sResume);
        setLogH('jobid', sJobId);
        setLogH('companyname', sCompany);
        setLogH('position', sPosition);
        setLogH('placementofficer', sTpo);
        setLogH('status', status || '');
        setLogH('remarks', remarks !== undefined ? remarks : '');
        setLogH('dateplaced', datePlaced !== undefined ? datePlaced : '');
        setLogH('package', packageLpa !== undefined ? packageLpa : '');
        setLogH('offerletterstatus', offerLetterLink || '');
        setLogH('joiningstatus', joiningStatus !== undefined ? joiningStatus : '');
        setLogH('interviewdate', interviewDate || '');
        setLogH('interviewtime', interviewTime || '');
        setLogH('intervewtime', interviewTime || ''); 
        setLogH('interviewvenue', interviewVenue || '');

        const identity = `${normalizePlacementText(sRoll) || normalizePlacementText(sName)}|${normalizePlacementText(sCompany)}`;
        const existingLogs = identity
          ? latestPlacementRows((await logSheet.getRows()).filter(row => placementIdentity(row, getValByHeader) === identity), getValByHeader)
          : [];
        if (existingLogs.length) {
          existingLogs[0].assign(logObj);
          await existingLogs[0].save();
        } else {
          await logSheet.addRow(logObj);
        }
      }
    } catch(e) { console.error('Placement log sync failed:', e.message); }
    
    if (oldStatus !== (status || '').toLowerCase()) {
       checkAndSendStudentMails({
         name: sName, roll: sRoll, email: sMail, company: sCompany, 
         position: sPosition, tpoName: sTpo, branch: sBranch, jobId: sJobId
       }, status, { date: interviewDate, time: interviewTime, venue: interviewVenue }, currentUserEmail)
       .catch(e => console.error('Placement status email failed:', e.message));
    }

    // 🚨 DESIGN PORTAL AUTO-TRIGGER: Sends the student to Media Team if Placed/Joined
    await autoCreateDesignTask({ ...fullApp, name: sName, roll: sRoll, email: sMail, course: sCourse, branch: sBranch, company: sCompany, position: sPosition, status });

    refreshCache(); 
    res.json({ success: true, message: "Updated!" });
  } catch (error) { 
    console.error(error);
    res.status(500).json({ success: false, message: `Update Failed: ${error.message}` }); 
  }
};

exports.updatePlacementLog = async (req, res) => {
  const rowNumber = Number.parseInt(req.body.rowNumber, 10);
  const user = req.portalUser;
  if (!Number.isInteger(rowNumber) || rowNumber < 2) {
    return res.status(400).json({ success: false, message: 'A valid placement log row is required.' });
  }

  try {
    await loadDocInfo();
    const logSheet = doc.sheetsByTitle['TPO_Log'];
    if (!logSheet) return res.status(503).json({ success: false, message: 'The placement log sheet is unavailable.' });
    const rows = await logSheet.getRows({ offset: rowNumber - 2, limit: 1 });
    if (!rows.length || Number(rows[0].rowNumber) !== rowNumber) {
      return res.status(404).json({ success: false, message: 'Placement log record was not found.' });
    }

    const row = rows[0];
    if (!hasAccess(getValByHeader(row, ['branch']), getValByHeader(row, ['course']), user?.role, user?.assignedBranchesArray, user?.assignedCourse, user?.department)) {
      return res.status(403).json({ success: false, message: 'This placement is outside your branch or course assignment.' });
    }

    let offerLetterLink = getValByHeader(row, ['offerletterstatus', 'offerletter']) || '';
    if (req.file) offerLetterLink = await uploadToDrive(req.file, FOLDER_OFFER_LETTERS);

    const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const headers = logSheet.headerValues || [];
    const findHeader = aliases => {
      for (const alias of aliases) {
        const header = headers.find(item => normalize(item) === normalize(alias));
        if (header) return header;
      }
      for (const alias of aliases) {
        const target = normalize(alias);
        const header = headers.find(item => target.length >= 5 && normalize(item).includes(target));
        if (header) return header;
      }
      return null;
    };
    const update = {};
    const setValue = (aliases, value) => {
      const header = findHeader(aliases);
      if (header && value !== undefined) update[header] = value;
    };
    setValue(['status'], req.body.status || 'Placed');
    setValue(['remarks'], req.body.remarks || '');
    setValue(['dateplaced'], req.body.datePlaced || '');
    setValue(['package', 'package(lpa)'], req.body.packageLpa || '');
    setValue(['joiningstatus'], req.body.joiningStatus || '');
    if (offerLetterLink) setValue(['offerletterstatus', 'offerletter'], offerLetterLink);
    if (!Object.keys(update).length) return res.status(422).json({ success: false, message: 'No editable placement fields were found in the log sheet.' });

    row.assign(update);
    await row.save();
    refreshCache();
    return res.json({ success: true, message: 'Placement log updated.' });
  } catch (error) {
    console.error('Placement log update failed:', error);
    return res.status(500).json({ success: false, message: `Update failed: ${error.message}` });
  }
};

exports.addApplication = async (req, res) => {
  let appData = {};
  if (typeof req.body.appData === 'string') {
    try {
      if (req.body.appData !== "[object Object]") appData = JSON.parse(req.body.appData);
    } catch(e) {}
  } else if (typeof req.body.appData === 'object' && req.body.appData !== null) {
    appData = req.body.appData;
  }
  
  const user = req.portalUser;
  const tpoName = user?.name || '';
  if (!hasAccess(appData.branch, appData.course, user?.role, user?.assignedBranchesArray, user?.assignedCourse, user?.department)) {
    return res.status(403).json({ success: false, message: 'This student is outside your branch or course assignment.' });
  }
  try {
    let offerLetterLink = '';
    if (req.file) offerLetterLink = await uploadToDrive(req.file, FOLDER_OFFER_LETTERS);
    
    const appSheet = doc.sheetsByTitle["Opening_Applied"];
    const logSheet = doc.sheetsByTitle["TPO_Log"];

    if (!appSheet) return res.status(503).json({ success: false, message: 'The applications sheet is unavailable.' });

    const newRowObj = {
      'TimeStamp': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), 
      'Student Name': appData.name || '', 'Contact': appData.phone || '', 'Mail ID': appData.email || '', 
      'Roll Number': appData.roll || '', 'Course': appData.course || '', 'Branch': appData.branch || '', 
      'Qualification': appData.qual || '', 'Resume': appData.resume || '', 'Job ID': 'MANUAL-ADD', 
      'Company Name': appData.company || '', 'Position': appData.position || '', 
      'Placement Officer': tpoName || '', 'Status': appData.status || 'Placed', 
      'Remarks': appData.remarks || '', 'DATE PLACED': appData.datePlaced || '', 
      'PACKAGE (LPA)': appData.packageLpa || '', 'Offer Letter': offerLetterLink, 
      'Joining Status': appData.joiningStatus || '' 
    };

    const identity = `${normalizePlacementText(appData.roll) || normalizePlacementText(appData.name)}|${normalizePlacementText(appData.company)}`;
    const applicationRows = await appSheet.getRows();
    const existingApplications = identity
      ? latestPlacementRows(applicationRows.filter(row => placementIdentity(row, getValByHeader) === identity), getValByHeader)
      : [];
    const existingApplication = existingApplications[0] || null;
    if (existingApplication) {
      existingApplication.assign(newRowObj);
      await existingApplication.save();
    } else {
      await appSheet.addRow(newRowObj);
    }

    if (logSheet) {
      const logData = { ...newRowObj, 'Offer Letter Status': offerLetterLink };
      delete logData['Offer Letter'];
      const existingLogs = identity
        ? latestPlacementRows((await logSheet.getRows()).filter(row => placementIdentity(row, getValByHeader) === identity), getValByHeader)
        : [];
      if (existingLogs.length) {
        existingLogs[0].assign(logData);
        await existingLogs[0].save();
      } else {
        await logSheet.addRow(logData);
      }
    }
    
    checkAndSendStudentMails({ ...appData, tpoName: tpoName }, appData.status || 'Placed', {}, req.body.currentUserEmail)
      .catch(error => console.error('Manual placement email failed:', error.message));

    // 🚨 DESIGN PORTAL AUTO-TRIGGER: Sends the manual addition to the Media Team
    await autoCreateDesignTask({ ...appData, status: appData.status || 'Placed' });

    refreshCache(); res.json({ success: true, updated: Boolean(existingApplication), rowNumber: existingApplication?.rowNumber || null, message: existingApplication ? 'Existing placement updated.' : 'Placement added manually.' });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// ---------------------------------------------------------
// 🚨 EVENTS / VACANCIES / ISSUES / REPORTS
// ---------------------------------------------------------

exports.getVacancies = (req, res) => {
  try {
    const cache = getCache();
    // 🚨 EXTREME BACKEND SAFETY: Prevents server crash if Google Sheet is empty/syncing
    if (!cache || !cache.vacancies || !Array.isArray(cache.vacancies)) {
      return res.json({ success: true, vacancies: [] });
    }

    const companyLogos = new Map((cache.clients || []).map(row => {
      const name = getValByHeader(row, ['companyname', 'company']).trim().toLowerCase();
      const logo = getValByHeader(row, ['companylogo', 'logo']).trim();
      return [name, logo];
    }).filter(([name, logo]) => name && logo));

    let vacs = cache.vacancies.map((row, i) => {
      const company = getValByHeader(row, ['companyname', 'company']);
      return {
        id: getValByHeader(row, ['jobid', 'id']) || `JOB-${i+1}`, 
        company,
        companyLogo: getValByHeader(row, ['companylogo', 'logo']).trim() || companyLogos.get(company.trim().toLowerCase()) || '',
        position: getValByHeader(row, ['position', 'role']), 
        location: getValByHeader(row, ['openingat(location)', 'location']), 
        state: getValByHeader(row, ['state']), 
        mode: getValByHeader(row, ['workmode', 'mode']), 
        lastDate: getValByHeader(row, ['lastdate']), 
        course: getValByHeader(row, ['course']), 
        qualification: getValByHeader(row, ['qualification']), 
        description: getValByHeader(row, ['jobdescription']), 
        experience: getValByHeader(row, ['experience']), 
        salary: getValByHeader(row, ['salary']), 
        gender: getValByHeader(row, ['genderpreference']), 
        status: getValByHeader(row, ['status']) || 'Open',
        tpoName: getValByHeader(row, ['placementofficer', 'tpo', 'tponame']) || 'Unknown',
        datePosted: getValByHeader(row, ['timestamp', 'date', 'posteddate']) || ''
      };
    }).filter(vacancy => {
      const user = req.portalUser;
      if (!user) return false;
      return hasAccess('All', vacancy.course, user.role, user.assignedBranchesArray, user.assignedCourse, user.department);
    });
    res.json({ success: true, vacancies: vacs.reverse() });
  } catch (err) {
    console.error("Get Vacancies Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const getVacancyPlacementOfficers = async () => {
  let rows = getCache()?.contacts;
  if (!Array.isArray(rows) || rows.length === 0) {
    await loadDocInfo();
    const contactSheet = doc.sheetsByTitle['Contact'] || doc.sheetsByIndex.find(sheet =>
      sheet.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('contact')
    );
    if (!contactSheet) throw new Error('The Contact sheet is unavailable.');
    rows = await contactSheet.getRows();
  }

  const officers = new Map();
  rows.forEach(row => {
    const name = getValByHeader(row, ['name', 'tponame', 'placementofficer']).trim();
    const role = getValByHeader(row, ['role', 'designation', 'position']).trim();
    if (!name || (role && !/(tpo|placement|career guidance)/i.test(role))) return;
    const key = normalizePlacementText(name);
    if (key && !officers.has(key)) officers.set(key, name);
  });
  return [...officers.values()].sort((a, b) => a.localeCompare(b));
};

exports.getVacancyFormOptions = async (_req, res) => {
  try {
    return res.json({ success: true, placementOfficers: await getVacancyPlacementOfficers() });
  } catch (error) {
    console.error('Could not load placement officers for vacancy form:', error.message);
    return res.status(503).json({ success: false, message: 'Placement officer names are unavailable. Please try again shortly.' });
  }
};

const vacancyHeaderSpecs = [
  { key: 'date', title: 'Date', aliases: ['date', 'timestamp', 'posteddate'] },
  { key: 'companyLogo', title: 'Company Logo', aliases: ['companylogo', 'logo'] },
  { key: 'companyName', title: 'Company Name', aliases: ['companyname', 'company'] },
  { key: 'companyContact', title: 'Company Contact', aliases: ['companycontact', 'contactnumber', 'phone', 'contact'] },
  { key: 'companyMailId', title: 'Company Mail ID', aliases: ['companymailid', 'companyemail', 'mailid', 'email'] },
  { key: 'companyContactPerson', title: 'Company Contact Person', aliases: ['companycontactperson', 'contactperson', 'person'] },
  { key: 'companyWebsite', title: 'Company Website', aliases: ['companywebsite', 'website', 'url'] },
  { key: 'course', title: 'Course', aliases: ['course', 'program'] },
  { key: 'position', title: 'Position', aliases: ['position', 'role', 'jobtitle'] },
  { key: 'state', title: 'State', aliases: ['state', 'region'] },
  { key: 'location', title: 'Opening At (Location)', aliases: ['openingat(location)', 'openingatlocation', 'location', 'city'] },
  { key: 'workMode', title: 'Work Mode', aliases: ['workmode', 'mode'] },
  { key: 'openings', title: 'No. of Openings', aliases: ['noofopenings', 'numberofopenings', 'openings'] },
  { key: 'qualification', title: 'Qualification', aliases: ['qualification', 'educationalqualification', 'eligibility'] },
  { key: 'jobDescription', title: 'Job Description', aliases: ['jobdescription', 'description', 'roleoverview'] },
  { key: 'experience', title: 'Experience', aliases: ['experience', 'yearsofexperience'] },
  { key: 'salary', title: 'Salary', aliases: ['salary', 'package', 'ctc', 'compensation'] },
  { key: 'genderPreference', title: 'Gender Preference', aliases: ['genderpreference', 'gender'] },
  { key: 'interviewDate', title: 'Interview Date', aliases: ['interviewdate'] },
  { key: 'lastDate', title: 'Last Date', aliases: ['lastdate', 'applicationdeadline'] },
  { key: 'placementOfficer', title: 'Placement Officer', aliases: ['placementofficer', 'tpo', 'tponame'] },
  { key: 'jobId', title: 'Job ID', aliases: ['jobid', 'id'] },
  { key: 'status', title: 'Status', aliases: ['status', 'openingstatus'] }
];

const normalizeVacancyHeader = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const findVacancyHeader = (headers, aliases) => {
  for (const alias of aliases) {
    const normalizedAlias = normalizeVacancyHeader(alias);
    const exact = headers.find(header => normalizeVacancyHeader(header) === normalizedAlias);
    if (exact) return exact;
  }
  return null;
};

const formatTodayForVacancy = () => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric'
}).format(new Date());

exports.addVacancy = async (req, res) => {
  try {
    const input = req.body || {};
    const requiredFields = [
      'companyName', 'companyContact', 'companyMailId', 'companyContactPerson', 'companyWebsite',
      'course', 'position', 'state', 'location', 'workMode', 'openings', 'qualification',
      'jobDescription', 'experience', 'salary', 'genderPreference', 'interviewPlan', 'lastDate', 'placementOfficer'
    ];
    const missingFields = requiredFields.filter(field => !String(input[field] || '').trim());
    if (missingFields.length) return res.status(400).json({ success: false, message: `Please complete all required fields: ${missingFields.join(', ')}.` });
    if (!req.file) return res.status(400).json({ success: false, message: 'Please upload the company logo.' });
    if (!String(req.file.mimetype || '').startsWith('image/')) return res.status(400).json({ success: false, message: 'The company logo must be an image.' });
    if (req.file.size > 10 * 1024 * 1024) return res.status(413).json({ success: false, message: 'The company logo must be 10 MB or smaller.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input.companyMailId).trim())) {
      return res.status(400).json({ success: false, message: 'Enter a valid company email address.' });
    }
    if (!['Will Inform Once Scheduled', 'Interview Scheduled'].includes(String(input.interviewPlan || ''))) {
      return res.status(400).json({ success: false, message: 'Select an interview scheduling option.' });
    }
    if (input.interviewPlan === 'Interview Scheduled' && !/^\d{4}-\d{2}-\d{2}$/.test(String(input.interviewDate || ''))) {
      return res.status(400).json({ success: false, message: 'Select the scheduled interview date.' });
    }
    const experience = input.experience === 'Other' ? String(input.experienceOther || '').trim() : String(input.experience).trim();
    if (!experience) return res.status(400).json({ success: false, message: 'Enter the custom experience requirement.' });

    const placementOfficers = await getVacancyPlacementOfficers();
    const selectedOfficer = placementOfficers.find(name => normalizePlacementText(name) === normalizePlacementText(input.placementOfficer));
    if (!selectedOfficer) return res.status(400).json({ success: false, message: 'Choose a placement officer from the Contact sheet list.' });

    await loadDocInfo();
    const sheet = doc.sheetsByTitle['NewsLetter'] || doc.sheetsByIndex.find(item =>
      item.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('newsletter')
    );
    if (!sheet) return res.status(503).json({ success: false, message: 'The NewsLetter sheet is unavailable.' });
    await sheet.loadHeaderRow();
    let headers = [...(sheet.headerValues || [])];
    const headerMap = new Map();
    const missingHeaders = [];
    vacancyHeaderSpecs.forEach(spec => {
      const existing = findVacancyHeader(headers, spec.aliases);
      if (existing) headerMap.set(spec.key, existing);
      else missingHeaders.push(spec);
    });
    if (missingHeaders.length) {
      const requiredColumnCount = headers.length + missingHeaders.length;
      if ((Number(sheet.columnCount) || 0) < requiredColumnCount) await sheet.resize({ columnCount: requiredColumnCount });
      headers = [...headers, ...missingHeaders.map(spec => spec.title)];
      await sheet.setHeaderRow(headers);
      await sheet.loadHeaderRow();
      missingHeaders.forEach(spec => headerMap.set(spec.key, spec.title));
    }

    const logoUrl = await uploadToDrive(req.file, FOLDER_CLIENT_LOGOS);
    const jobId = `JOB-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const rowData = {
      date: formatTodayForVacancy(),
      companyLogo: logoUrl,
      companyName: String(input.companyName).trim(),
      companyContact: String(input.companyContact).trim(),
      companyMailId: String(input.companyMailId).trim(),
      companyContactPerson: String(input.companyContactPerson).trim(),
      companyWebsite: String(input.companyWebsite).trim(),
      course: String(input.course).trim(),
      position: String(input.position).trim(),
      state: String(input.state).trim(),
      location: String(input.location).trim(),
      workMode: String(input.workMode).trim(),
      openings: String(input.openings).trim(),
      qualification: String(input.qualification).trim(),
      jobDescription: String(input.jobDescription).trim(),
      experience,
      salary: String(input.salary).trim(),
      genderPreference: String(input.genderPreference).trim(),
      interviewDate: input.interviewPlan === 'Interview Scheduled' ? String(input.interviewDate) : 'Will inform once scheduled',
      lastDate: String(input.lastDate).trim(),
      placementOfficer: selectedOfficer,
      jobId,
      status: 'Open'
    };
    const rowValues = Object.fromEntries(Object.entries(rowData).map(([key, value]) => [headerMap.get(key), value]));
    const savedRow = await sheet.addRow(rowValues);
    const cache = getCache();
    if (Array.isArray(cache?.vacancies)) cache.vacancies.push(savedRow);
    refreshCache();

    const vacancy = {
      id: jobId,
      company: rowData.companyName,
      companyLogo: logoUrl,
      position: rowData.position,
      location: rowData.location,
      state: rowData.state,
      mode: rowData.workMode,
      lastDate: rowData.lastDate,
      course: rowData.course,
      qualification: rowData.qualification,
      description: rowData.jobDescription,
      experience: rowData.experience,
      salary: rowData.salary,
      gender: rowData.genderPreference,
      interviewDate: rowData.interviewDate,
      status: 'Open',
      tpoName: rowData.placementOfficer,
      datePosted: rowData.date
    };
    return res.status(201).json({ success: true, vacancy, message: 'Vacancy added to the NewsLetter sheet.' });
  } catch (error) {
    console.error('Vacancy creation failed:', error.message);
    return res.status(500).json({ success: false, message: error.message || 'The vacancy could not be saved.' });
  }
};

exports.getIssues = (req, res) => {
  try {
    const { assignedBranchesArray, role, assignedCourse } = req.body;
    const cache = getCache();
    
    // 🚨 PREVENTS CRASH IF SHEET IS EMPTY OR MISSING
    if (!cache || !cache.issues) {
      return res.json({ success: true, issues: [] });
    }

    let issuesList = cache.issues.filter(row => {
      const rowBranch = getValByHeader(row, ['branch']);
      const studentName = getValByHeader(row, ['name']) || '';
      const studentData = (cache.students || []).find(s => (getValByHeader(s, ['name']) || '').toLowerCase().trim() === studentName.toLowerCase().trim());
      const sCourse = studentData ? getValByHeader(studentData, ['course']) : 'Unknown';
      return hasAccess(rowBranch, sCourse, role, assignedBranchesArray, assignedCourse, req.portalUser?.department);
    }).map(row => ({ 
      rowNumber: row.rowNumber, 
      name: getValByHeader(row, ['name']) || 'Student', 
      branch: getValByHeader(row, ['branch']), 
      details: getValByHeader(row, ['issuedetails']) || '', 
      status: getValByHeader(row, ['status']) || 'Pending', 
      remarks: getValByHeader(row, ['remarks']) || '' 
    }));
    
    res.json({ success: true, issues: issuesList.reverse() });
  } catch (err) {
    console.error("Get Issues Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateIssue = async (req, res) => {
  const { rowNumber, status, remarks } = req.body;
  try {
    const issueSheet = doc.sheetsByTitle["Issues"];
    if (!issueSheet) return res.status(503).json({ success: false, message: 'Issues register is unavailable.' });
    const rows = await issueSheet.getRows({ offset: rowNumber - 2, limit: 1 });
    if (rows.length > 0) {
      const user = req.portalUser;
      const issueBranch = getValByHeader(rows[0], ['branch']);
      const studentName = getValByHeader(rows[0], ['name', 'studentname']);
      const student = (getCache()?.students || []).find(row => normalizePlacementText(getValByHeader(row, ['name', 'studentname'])) === normalizePlacementText(studentName));
      const issueCourse = getValByHeader(rows[0], ['course']) || (student && getValByHeader(student, ['course'])) || '';
      if (!hasAccess(issueBranch, issueCourse, user?.role, user?.assignedBranchesArray, user?.assignedCourse, user?.department)) {
        return res.status(403).json({ success: false, message: 'This issue is outside your branch or course assignment.' });
      }
      rows[0].assign({ 'Status': status, 'Remarks': remarks }); await rows[0].save(); refreshCache(); res.json({ success: true, message: "Issue updated!" });
    }
    else { res.status(404).json({ success: false, message: "Row not found." }); }
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.getReports = async (req, res) => {
  const { assignedBranchesArray, role, assignedCourse, department } = req.body;
  const checkAccess = (rBranch, rCourse) => hasAccess(rBranch, rCourse, role, assignedBranchesArray, assignedCourse, department);

  if (!getCache()) await refreshCache();
  if (!getCache()) return res.status(503).json({ success: false, message: 'Report data is still syncing. Please refresh shortly.' });
  let students = [], applications = [], issues = [], talentino = [], tpoLogs = [];
  const cache = getCache();
  
  (cache.students || []).forEach(row => {
    if(!checkAccess(getValByHeader(row, ['branch']), getValByHeader(row, ['course']))) return;
    students.push({ 
      name: getValByHeader(row, ['name']), 
      roll: getValByHeader(row, ['rollnumber', 'roll']), 
      branch: getValByHeader(row, ['branch']), 
      course: getValByHeader(row, ['course']), 
      status: getValByHeader(row, ['status']), 
      placementStatus: getValByHeader(row, ['placementstat', 'placementstatus']),
      timestamp: getValByHeader(row, ['timestamp']) // 🚨 Added to plot the Area Chart applications
    });
  });
  
  (cache.applications || []).forEach(row => {
    if(!checkAccess(getValByHeader(row, ['branch']), getValByHeader(row, ['course']))) return;
    applications.push({ name: getValByHeader(row, ['studentname', 'name']), roll: getValByHeader(row, ['rollnumber', 'roll']), jobId: getValByHeader(row, ['jobid']), company: getValByHeader(row, ['companyname', 'company']), date: getValByHeader(row, ['timestamp']), status: getValByHeader(row, ['status']), remarks: getValByHeader(row, ['remarks']), tpoName: getValByHeader(row, ['placementofficer']), branch: getValByHeader(row, ['branch']), course: getValByHeader(row, ['course']) });
  });
  
  (cache.issues || []).forEach(row => {
    if (checkAccess(getValByHeader(row, ['branch']), getValByHeader(row, ['course']))) issues.push({ name: getValByHeader(row, ['name']), branch: getValByHeader(row, ['branch']), details: getValByHeader(row, ['issuedetails']), status: getValByHeader(row, ['status']), remarks: getValByHeader(row, ['remarks']) }); 
  });
  
  (cache.tAtt || []).forEach(row => {
    if (checkAccess(getValByHeader(row, ['branch']), getValByHeader(row, ['course']))) talentino.push({ name: getValByHeader(row, ['name']), branch: getValByHeader(row, ['branch']), date: getValByHeader(row, ['check-in', 'date']), rating: getValByHeader(row, ['rating']), notes: getValByHeader(row, ['notes']) }); 
  });
  
  let vacancies = (cache.vacancies || []).map(row => ({ id: getValByHeader(row, ['jobid', 'id']) || '', company: getValByHeader(row, ['company']) || '', location: getValByHeader(row, ['location']) || '', mode: getValByHeader(row, ['mode']) || '', status: getValByHeader(row, ['status']) || 'Open', course: getValByHeader(row, ['course']) || '', date: getValByHeader(row, ['lastdate', 'date']) || '' }));
  let events = (cache.events || []).map(row => ({ date: getValByHeader(row, ['date']) || '' }));

  if (cache.tpoLogs) {
    cache.tpoLogs.forEach(row => { 
      try { 
        const rowData = row.toObject();
        // Strict mapping to ensure global view processes properly
        if(checkAccess(getValByHeader(row, ['branch']), getValByHeader(row, ['course']))) {
          tpoLogs.push({ ...rowData, rowNumber: row.rowNumber, sourceSheet: 'TPO_Log' });
        }
      } catch(e) {}
    });
  }
  tpoLogs = latestPlacementRows(tpoLogs, (row, aliases) => {
    const keys = Object.keys(row || {});
    const clean = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const alias of (Array.isArray(aliases) ? aliases : [aliases])) {
      const key = keys.find(candidate => clean(candidate) === clean(alias));
      if (key && row[key] !== undefined && row[key] !== null) return String(row[key]).trim();
    }
    for (const alias of (Array.isArray(aliases) ? aliases : [aliases])) {
      const target = clean(alias);
      const key = keys.find(candidate => target.length >= 5 && clean(candidate).includes(target));
      if (key && row[key] !== undefined && row[key] !== null) return String(row[key]).trim();
    }
    return '';
  });

  // 🚨 EXPORT TPO STATS FOR FRONTEND
  let tpoStatsList = [];
  if (cache.tpoStats) {
    cache.tpoStats.forEach(r => {
      try { tpoStatsList.push(r.toObject()); } catch(e) {}
    });
  }

  res.json({ success: true, students, applications, issues, talentino, vacancies, events, tpoLogs, tpoStats: tpoStatsList });
};

exports.getTalentino = (req, res) => {
  const actor = req.portalUser || {};
  const { assignedBranchesArray: requestedBranches, role: requestedRole, assignedCourse: requestedCourse } = req.body;
  const assignedBranchesArray = Array.isArray(actor.assignedBranchesArray) ? actor.assignedBranchesArray : requestedBranches;
  const role = actor.role || requestedRole;
  const assignedCourse = actor.assignedCourse || requestedCourse;
  let records = getCache().tAtt.filter(row => {
    const rowBranch = getValByHeader(row, ['branch']);
    const studentName = getValByHeader(row, ['name', 'student']) || '';
    const studentRoll = normalizePlacementText(getValByHeader(row, ['roll', 'rollno', 'rollnumber', 'ipcsrollnumber']));
    const studentData = getCache().students.find(s => {
      const sheetRoll = normalizePlacementText(getValByHeader(s, ['roll', 'rollno', 'rollnumber', 'ipcsrollnumber']));
      return (studentRoll && sheetRoll === studentRoll) || normalizePlacementText(getValByHeader(s, ['name', 'studentname'])) === normalizePlacementText(studentName);
    });
    const sCourse = getValByHeader(row, ['course', 'program']) || (studentData ? getValByHeader(studentData, ['course']) : 'Unknown');
    return hasAccess(rowBranch, sCourse, role, assignedBranchesArray, assignedCourse, actor.department);
  }).map(row => {
    const date = getValByHeader(row, ['timestamp', 'date', 'time', 'present check-ins date']);
    const branch = getValByHeader(row, ['branch']);
    const schedule = (getCache().tSched || []).find(item => {
      const scheduleDate = getValByHeader(item, ['date', 'dateoftheevent', 'sessiondate', 'timestamp']);
      const parsedScheduleDate = safeParseDate(scheduleDate);
      const parsedAttendanceDate = safeParseDate(date);
      const sameDate = Boolean(parsedScheduleDate && parsedAttendanceDate && parsedScheduleDate.toDateString() === parsedAttendanceDate.toDateString());
      return sameDate && normalizePlacementText(getValByHeader(item, ['branch', 'sittingbranch'])) === normalizePlacementText(branch);
    });
    return { name: getValByHeader(row, ['name', 'student']), branch, date, rating: getValByHeader(row, ['rating']), notes: getValByHeader(row, ['notes', 'remark']), tpo: getValByHeader(row, ['tpo', 'placementofficer', 'conductedby', 'createdby']) || getValByHeader(schedule, ['tpo', 'placementofficer', 'conductedby', 'createdby']), sessionId: getValByHeader(row, ['sessionid', 'eventid', 'event id']) || getValByHeader(schedule, ['sessionid', 'eventid', 'event id']) };
  });
  const upperRole = String(role || '').toUpperCase();
  const isRth = /(^|[^A-Z0-9])RTH([^A-Z0-9]|$)/.test(upperRole) || upperRole.includes('REGIONAL TECHNICAL HEAD');
  const sessions = (getCache().tSched || []).map(row => {
    const branch = getValByHeader(row, ['branch', 'sittingbranch']);
    const course = getValByHeader(row, ['course', 'program', 'assignedcourse']);
    const date = getValByHeader(row, ['date', 'dateoftheevent', 'sessiondate', 'timestamp']);
    const tpo = getValByHeader(row, ['tpo', 'placementofficer', 'conductedby', 'createdby']);
    const sessionId = getValByHeader(row, ['sessionid', 'eventid', 'event id', 'id']);
    return { branch, course, date, tpo, sessionId };
  }).filter(session => {
    if (!session.branch || !session.date) return false;
    if (!session.course && isRth) return userHasBranch(actor, session.branch);
    return hasAccess(session.branch, session.course || 'Unknown', role, assignedBranchesArray, assignedCourse, actor.department);
  });
  const dates = new Set();
  [...records, ...sessions].forEach(record => { const cleanDate = (record.date || '').split(' ')[0].trim(); if (cleanDate && cleanDate !== 'N/A') dates.add(cleanDate); });
  res.json({ success: true, dates: Array.from(dates).sort().reverse(), records: records.reverse(), sessions: sessions.reverse() });
};

exports.getEvents = (req, res) => {
  const user = req.portalUser;
  const role = String(user?.role || '').toUpperCase();
  const canSeePlacementDrives = canManageEveryDrive(user)
    || role.includes('ADMIN')
    || role === 'BM'
    || role.includes('BRANCH MANAGER')
    || role.includes('TPO')
    || role.includes('PLACEMENT OFFICER');
  let allEvents = getCache().events.map(row => {
    return {
      date: getValByHeader(row, ['dateoftheevent', 'date']), 
      tpo: getValByHeader(row, ['tpo', 'placementofficer']), 
      branch: getValByHeader(row, ['branch']), 
      type: getValByHeader(row, ['event', 'type']), 
      title: getValByHeader(row, ['title']), 
      description: getValByHeader(row, ['descripation', 'description']), 
      time: getValByHeader(row, ['timeoftheevent', 'time']), 
      location: getValByHeader(row, ['eventhappeningin', 'location']), 
      poster: getValByHeader(row, ['posterlink', 'poster'])
    };
  });
  res.json({ success: true, events: allEvents.filter(e => e.date && e.title && (canSeePlacementDrives || !String(e.type || '').toLowerCase().includes('placement drive'))) });
};

// =========================================================
// 🚨 RULES 1 & 2: TALENTINO & PLACEMENT DRIVE EVENTS (NEW ARCHITECTURE)
// =========================================================
exports.addEvent = async (req, res) => {
  const { date, tpo, branch, type, title, description, time, location, userName } = req.body;
  try {
    const eventSheet = doc.sheetsByTitle["Event"];
    let posterLink = '';
    if (req.file) posterLink = await uploadToDrive(req.file, FOLDER_OFFER_LETTERS); 
    
    const evType = (type || '').toLowerCase();
    const senderEmail = process.env.EMAIL_USER || 'placementcell.ipcs@gmail.com';
    const formattedDesc = String(description || 'N/A').replace(/(?:\r\n|\r|\n)/g, '<br/>');

    // 🚨 Check Branch Manager for Talentino BEFORE saving the event
    if (evType.includes('talentino')) {
      const bmCheck = getBranchManagerEmail(branch);
      if (!bmCheck) {
        return res.status(400).json({ 
          success: false, 
          message: `Mail cannot be sent: No Branch Manager is available for the ${branch} branch.` 
        });
      }
    }

    // 🚨 Generate Enterprise Event ID
    const dateObj = new Date();
    const dateStr = dateObj.toISOString().split('T')[0].replace(/-/g, '');
    const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
    const eventId = `EVT-${dateStr}-${randomStr}`;
    const timestamp = dateObj.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    // Prepare row data including new system columns
    const rowData = { 
      'Date of the Event': date, 
      'TPO': tpo, 
      'Branch': branch, 
      'Event': type, 
      'Title': title, 
      'Descripation': description || '', 
      'Time of the Event': time || '', 
      'Event Happening in': location || '', 
      'Poster Link': posterLink,
      'Event_ID': eventId,
      'Created_At': timestamp,
      'Created_By': userName || tpo,
      'Mail_Status': 'PENDING'
    };

    // Add to sheet
    const newRow = await eventSheet.addRow(rowData);

    // 🚨 GUARANTEED EXECUTIVE EMAILS (Fallback to hardcoded if ID lookup fails)
    const giftyEmail = getUserEmailById('U003') || 'gifty@ipcsglobal.com';
    const ajithEmail = getUserEmailById('U001') || 'ajith@ipcsglobal.com';
    const rakeshEmail = getUserEmailById('U002') || 'rakesh@ipcsglobal.com';

    const logo1 = "https://lh3.googleusercontent.com/d/1VqmH9-l2lBHErJPW1tCjtCu-SrTEMPtN";
    const logo2 = "https://lh3.googleusercontent.com/d/1bHpUfH_578DmfityB9cOgFNYhbBGdG9J";
    const watermark = "https://lh3.googleusercontent.com/d/1dr27VR3Xu8EwDf4dCAO1ucq441VjpfwB";

    let mailOptions = null;

    if (evType.includes('placement drive')) {
      const allTpos = getAllTpoEmails();
      const allBMs = getAllBranchManagerEmails();
      
      const toEmail = giftyEmail || senderEmail;
      const ccList = [ajithEmail, rakeshEmail].filter(Boolean).join(',');
      
      // 🚨 FIX: BCC gets ALL TPOs and ALL Branch Managers (No Super Admins)
      const bccList = [...new Set([...allBMs, ...allTpos])].filter(Boolean).join(',');

      const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); background-color: #ffffff;">
          <div style="background-color: #0f1523; padding: 25px 20px; text-align: center; border-bottom: 5px solid #3b82f6;">
            <div style="margin-bottom: 12px;">
              <img src="${logo1}" alt="IPCS Logo" style="max-height: 38px; margin: 0 8px; display: inline-block; vertical-align: middle;" />
              <img src="${logo2}" alt="Talenzo Logo" style="max-height: 38px; margin: 0 8px; display: inline-block; vertical-align: middle;" />
            </div>
            <h2 style="color: #ffffff; margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px;">Placement Drive Notification</h2>
            <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 13px;">IPCS Global Placement Cell</p>
          </div>
          <div style="background-image: url('${watermark}'); background-repeat: no-repeat; background-position: center center; background-size: cover; background-color: #ffffff;">
            <div style="padding: 35px 30px; background-color: rgba(255, 255, 255, 0.94); color: #334155; font-size: 15px; line-height: 1.65;">
              <p style="font-size: 16px; font-weight: bold; color: #0f1523; margin-top: 0;">Dear Team,</p>
              <p>Greetings from the Placement Department, IPCS Global.</p>
              <p>This is to inform you that a Placement Drive has been scheduled. Kindly find the details below:</p>
              
              <div style="background-color: rgba(248, 250, 252, 0.95); border: 1px solid #cbd5e1; border-left: 5px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h3 style="margin: 0 0 12px 0; color: #0f1523; font-size: 15px; text-transform: uppercase;">&#128204; Placement Drive Details</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr><td style="padding: 6px 0; color: #64748b; width: 35%;">Drive Title:</td><td style="padding: 6px 0; color: #0f1523; font-weight: bold;">${title}</td></tr>
                  <tr><td style="padding: 6px 0; color: #64748b;">Date:</td><td style="padding: 6px 0; color: #0f1523; font-weight: bold;">${date}</td></tr>
                  <tr><td style="padding: 6px 0; color: #64748b;">Time:</td><td style="padding: 6px 0; color: #0f1523; font-weight: bold;">${time || 'TBD'}</td></tr>
                  <tr><td style="padding: 6px 0; color: #64748b;">Location / Mode:</td><td style="padding: 6px 0; color: #0284c7; font-weight: bold;">${location || 'Venue / Online'}</td></tr>
                  <tr><td style="padding: 6px 0; color: #64748b;">Eligible Branch:</td><td style="padding: 6px 0; color: #0f1523;">${branch || 'All Branches'}</td></tr>
                  <tr><td style="padding: 6px 0; color: #64748b; vertical-align: top;">Description:</td><td style="padding: 6px 0; color: #334155; white-space: pre-line;">${formattedDesc}</td></tr>
                </table>
              </div>
              <h3 style="color: #ef4444; margin: 20px 0 10px 0; font-size: 16px;">&#9888;&#65039; Action Required</h3>
              <p>All concerned branches are requested to immediately inform all eligible students about this placement opportunity and encourage maximum participation.</p>
              <p>Please ensure that the interested and eligible students strictly register for the drive through the IPCS Global Student Portal:</p>
              
              <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <p style="margin: 0; font-size: 15px; color: #1e3a8a;">
                  &#127760; <b>Student Portal:</b> <a href="https://placement.ipcsglobal.info" target="_blank" style="color: #0284c7; font-weight: bold; text-decoration: underline;">placement.ipcsglobal.info</a>
                </p>
              </div>

              <p style="color: #b91c1c; font-weight: bold;">Portal registration is mandatory for participation in the placement drive.</p>
              <p>Students must complete their registration through the portal within the given registration period. Branch-level confirmation, WhatsApp confirmation, or verbal confirmation will not be considered as a substitute for portal registration.</p>
              <p style="font-weight: bold; margin-bottom: 5px;">We request all branches to ensure that:</p>
              <ul style="padding-left: 20px; margin-top: 5px;">
                <li style="margin-bottom: 6px;">All eligible students are informed about the drive.</li>
                <li style="margin-bottom: 6px;">Interested students complete their registration through the Student Portal.</li>
                <li style="margin-bottom: 6px;">Students are reminded to register strictly through the portal before the registration deadline.</li>
                <li style="margin-bottom: 6px;">Registered students are properly informed about the drive and instructed to attend on time.</li>
              </ul>
              <p>Your support and coordination are essential to ensure smooth execution of the placement drive and maximum student participation.</p>
              <p>For any clarification, please coordinate with the Placement Team.</p>
              <p>Thank you for your cooperation.</p>

              <div style="margin-top: 35px; padding-top: 20px; border-top: 1px solid #cbd5e1; font-size: 14px; color: #0f1523;">
                <p style="margin: 0 0 3px 0;">Regards,</p>
                <p style="margin: 0 0 2px 0; font-weight: bold;">Placement Team</p>
                <p style="margin: 0; font-weight: bold; color: #8b5cf6;">IPCS Global</p>
              </div>
            </div>
          </div>
        </div>
      `;

      mailOptions = {
        from: `"IPCS Placements" <${senderEmail}>`,
        to: toEmail, 
        cc: ccList,
        bcc: bccList,
        subject: `Placement Drive Notification – ${date} | ${time || 'TBD'} [Ref: ${eventId}]`,
        html: html
      };

    } else if (evType.includes('talentino')) {
      const scheduledTpoEmail = getTpoEmailByName(tpo);
      const bmMail = getBranchManagerEmail(branch);
      
      let toEmail = bmMail;

      const ccArray = [giftyEmail, scheduledTpoEmail];
      const ccList = [...new Set(ccArray)]
        .filter(email => email && email.toLowerCase() !== toEmail.toLowerCase())
        .join(',');

      const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); background-color: #ffffff;">
          
          <!-- HEADER SECTION -->
          <div style="background-color: #0f1523; padding: 25px 20px; text-align: center; border-bottom: 5px solid #a855f7;">
            <div style="margin-bottom: 12px;">
              <img src="${logo1}" alt="IPCS Logo" style="max-height: 38px; margin: 0 8px; display: inline-block; vertical-align: middle;" />
              <img src="${logo2}" alt="Talenzo Logo" style="max-height: 38px; margin: 0 8px; display: inline-block; vertical-align: middle;" />
            </div>
            <h2 style="color: #ffffff; margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px;">Talentino Session Notification</h2>
            <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 13px;">IPCS Global Placement Cell</p>
          </div>

          <!-- BODY SECTION -->
          <div style="background-image: url('${watermark}'); background-repeat: no-repeat; background-position: center center; background-size: cover; background-color: #ffffff;">
            <div style="padding: 35px 30px; background-color: rgba(255, 255, 255, 0.94); color: #334155; font-size: 15px; line-height: 1.65;">
              
              <p style="font-size: 16px; font-weight: bold; color: #0f1523; margin-top: 0;">Dear Team,</p>
              <p>Greetings from the Placement Department, IPCS Global.</p>
              <p>This is to inform you that a Talentino Session has been scheduled at your branch. Kindly find the details below:</p>
              
              <!-- DETAILS BOX -->
              <div style="background-color: rgba(248, 250, 252, 0.95); border: 1px solid #cbd5e1; border-left: 5px solid #a855f7; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <h3 style="margin: 0 0 12px 0; color: #0f1523; font-size: 15px; text-transform: uppercase;">&#128204; Talentino Session Details</h3>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                  <tr><td style="padding: 6px 0; color: #64748b; width: 35%;">Date:</td><td style="padding: 6px 0; color: #0f1523; font-weight: bold;">${date}</td></tr>
                  <tr><td style="padding: 6px 0; color: #64748b;">Time:</td><td style="padding: 6px 0; color: #0f1523; font-weight: bold;">${time || 'TBD'}</td></tr>
                  <tr><td style="padding: 6px 0; color: #64748b;">Location / Mode:</td><td style="padding: 6px 0; color: #0284c7; font-weight: bold;">${location || branch || 'Branch Venue'}</td></tr>
                  <tr><td style="padding: 6px 0; color: #64748b;">Conducted By:</td><td style="padding: 6px 0; color: #0f1523;">${tpo}</td></tr>
                  <tr><td style="padding: 6px 0; color: #64748b; vertical-align: top;">Description:</td><td style="padding: 6px 0; color: #334155; white-space: pre-line;">${formattedDesc}</td></tr>
                </table>
              </div>

              <!-- ACTION REQUIRED SECTION -->
              <h3 style="color: #ef4444; margin: 20px 0 10px 0; font-size: 16px;">&#9888;&#65039; Action Required</h3>
              <p>The concerned branch is requested to inform the students about the scheduled Talentino session and ensure maximum participation.</p>
              <p style="font-weight: bold; margin-bottom: 5px;">Please ensure that:</p>
              <ul style="padding-left: 20px; margin-top: 5px;">
                <li style="margin-bottom: 6px;">All concerned students are informed about the session in advance.</li>
                <li style="margin-bottom: 6px;">Students are instructed to be present at the branch on time.</li>
                <li style="margin-bottom: 6px;">The required arrangements are made at the branch for conducting the session smoothly.</li>
                <li style="margin-bottom: 6px;">Students are encouraged to actively participate in all the activities conducted during Talentino.</li>
                <li style="margin-bottom: 6px;">The concerned TPO coordinates with the branch team and students throughout the session.</li>
              </ul>

              <!-- BLUE NOTE BOX -->
              <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #1e3a8a;">
                  <b>Note:</b> No separate registration is required for the Talentino session. Students can participate directly as instructed by the concerned TPO.
                </p>
              </div>

              <!-- FOOTER TEXT -->
              <p>The Talentino session is designed to engage students through interactive activities, challenges, and placement-oriented exercises, helping them improve their confidence, communication, aptitude, problem-solving, and overall placement readiness.</p>
              <p>Your support and coordination are essential to ensure the smooth execution of the Talentino session and active student participation.</p>
              <p>For any clarification or coordination, please connect with the Placement Team.<br/>Thank you for your cooperation.</p>

              <!-- SIGN-OFF -->
              <div style="margin-top: 35px; padding-top: 20px; border-top: 1px solid #cbd5e1; font-size: 14px; color: #0f1523;">
                <p style="margin: 0 0 3px 0;">Regards,</p>
                <p style="margin: 0 0 2px 0; font-weight: bold;">Placement Team</p>
                <p style="margin: 0; font-weight: bold; color: #8b5cf6;">IPCS Global</p>
              </div>
            </div>
          </div>
        </div>
      `;

      mailOptions = {
        from: `"IPCS Talentino" <${senderEmail}>`,
        to: toEmail,
        cc: ccList,
        bcc: '', // 🚨 Empty BCC for Talentino
        subject: `Talentino Session Notification – ${date} | ${time || 'TBD'} [Ref: ${eventId}]`,
        html: html
      };
    }

    if (mailOptions) {
      try {
        await sendMailAndLog(mailOptions, { name: branch, email: mailOptions.to, type: 'Event Notification' });
        
        const getH = (str) => newRow._worksheet.headerValues.find(h => (h||'').toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
        const updateData = {};
        const mailStatusH = getH('mailstatus');
        const mailSentAtH = getH('mailsentat');
        
        if (mailStatusH) updateData[mailStatusH] = 'SENT';
        if (mailSentAtH) updateData[mailSentAtH] = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        
        if (Object.keys(updateData).length > 0) {
           newRow.assign(updateData);
           await newRow.save();
        }
        
      } catch (mailErr) {
        const getH = (str) => newRow._worksheet.headerValues.find(h => (h||'').toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
        const updateData = {};
        const mailStatusH = getH('mailstatus');
        const mailErrorH = getH('mailerror');
        
        if (mailStatusH) updateData[mailStatusH] = 'FAILED';
        if (mailErrorH) updateData[mailErrorH] = mailErr.message;
        
        if (Object.keys(updateData).length > 0) {
           newRow.assign(updateData);
           await newRow.save();
        }
      }
    }
    refreshCache(); 
    
    // 🚨 Check if the mail Options existed but failed to send
    if (mailOptions && newRow.get(newRow._worksheet.headerValues.find(h => (h||'').toLowerCase().replace(/[^a-z0-9]/g, '') === 'mailstatus')) === 'FAILED') {
      const errorReason = newRow.get(newRow._worksheet.headerValues.find(h => (h||'').toLowerCase().replace(/[^a-z0-9]/g, '') === 'mailerror')) || 'Unknown timeout';
      // Returns success: true so the event saves and the modal closes, but triggers a warning popup text
      return res.json({ success: true, message: `⚠️ EVENT SAVED, BUT EMAILS FAILED TO SEND! Reason: ${errorReason}`, eventId: eventId });
    }

    res.json({ success: true, message: "Event added and emails sent successfully!", eventId: eventId });
  } catch (error) { 
    console.error("Event add error:", error);
    res.status(500).json({ success: false, message: error.message }); 
  }
};

// =========================================================
// 🚨 RULE 3: CRON HELPER (RESUME DELIVERY & DRIVE SUMMARY)
// =========================================================
exports.runDailyCron = async () => {
  console.log("🚨 [CRON] Starting Daily Automated Tasks...");
  const cache = getCache();
  if (!cache || !cache.vacancies || cache.vacancies.length === 0) {
      console.warn("⚠️ [CRON] Cache is empty or currently syncing. Aborting cron job.");
      return;
  }

  // ------------------------------------------------------------------
  // 🕒 TIME SETUP (IST)
  // ------------------------------------------------------------------
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  
  const today = new Date();
  const todayStr = formatter.format(today); // e.g. "2026-09-14"

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = formatter.format(yesterday); // e.g. "2026-09-13"

  // ==================================================================
  // 📌 TASK 1: YESTERDAY'S EXPIRED JOB RESUMES TO COMPANIES
  // ==================================================================
  console.log(`🚨 [CRON-TASK 1] Target Date for Expired Jobs: ${yStr}`);

  const expiredJobs = cache.vacancies.filter(v => {
    const lastDateKey = getValByHeader(v, ['lastdate', 'last date', 'column17', 'interviewdate', 'interview date']);
    if (!lastDateKey) return false;

    try {
      let parsedDate = new Date(lastDateKey);
      if (isNaN(parsedDate.getTime()) && lastDateKey.includes('/')) {
         const parts = lastDateKey.split(/[/\s,.-]+/);
         if (parts.length >= 3) { parsedDate = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`); }
      }
      if (!isNaN(parsedDate.getTime())) { return formatter.format(parsedDate) === yStr; }
      return false;
    } catch(e) { return false; }
  });

  console.log(`🚨 [CRON-TASK 1] Found ${expiredJobs.length} expired jobs matching ${yStr}.`);

  for (let job of expiredJobs) {
    const jobId = getValByHeader(job, ['jobid', 'id']) || '';
    const companyEmail = getValByHeader(job, ['companymailid', 'companyemail']) || ''; 
    const companyName = getValByHeader(job, ['companyname', 'company']) || '';
    const position = getValByHeader(job, ['position', 'role']) || '';

    if (!companyEmail) continue;

    const cleanTargetJobId = jobId.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
    const applicants = cache.applications.filter(app => {
      const appJobId = (getValByHeader(app, ['jobid']) || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
      return appJobId === cleanTargetJobId && cleanTargetJobId !== '';
    });

    if (applicants.length === 0) continue;

    const tpoName = getValByHeader(job, ['placementofficer']);
    const tpoEmail = getTpoEmailByName(tpoName);

    let tableRows = ''; let attachments = [];
    applicants.forEach((appRow, index) => {
      const info = { 
        name: getValByHeader(appRow, ['name', 'studentname']) || '', 
        phone: getValByHeader(appRow, ['contact', 'phone']) || '', 
        email: getValByHeader(appRow, ['mail', 'email', 'mailid']) || '', 
        qual: getValByHeader(appRow, ['qual', 'qualification']) || '', 
        resume: getValByHeader(appRow, ['resume', 'cv']) || '' 
      };
      
      let resumeBtn = 'N/A';
      if (info.resume) {
        const driveMatch = info.resume.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
        if (driveMatch) {
            const driveId = driveMatch[1];
            resumeBtn = `<a href="https://drive.google.com/file/d/${driveId}/view" style="background: #0f172a; color: white; padding: 6px 12px; text-decoration: none; border-radius: 4px; font-size: 12px; display: inline-block; white-space: nowrap;">View CV</a>`;
            attachments.push({ filename: `${info.name.replace(/\s+/g, '_')}_Resume.pdf`, href: `https://drive.google.com/uc?export=download&id=${driveId}` });
        } else { resumeBtn = `<a href="${info.resume}">Link</a>`; }
      }
      tableRows += `<tr><td style="padding:10px;border:1px solid #cbd5e1;text-align:center;">${index+1}</td><td style="padding:10px;border:1px solid #cbd5e1;"><b>${info.name}</b></td><td style="padding:10px;border:1px solid #cbd5e1;">${info.phone}</td><td style="padding:10px;border:1px solid #cbd5e1;">${info.email}</td><td style="padding:10px;border:1px solid #cbd5e1;">${info.qual}</td><td style="padding:10px;border:1px solid #cbd5e1;text-align:center;">${resumeBtn}</td></tr>`;
    });

    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0f1523; padding: 20px; text-align: center; border-bottom: 4px solid #10b981;">
          <h2 style="color: #ffffff; margin: 0; letter-spacing: 1px;">APPLICANT RESUMES</h2>
        </div>
        <div style="padding: 30px; background-color: #ffffff;">
          <p style="font-size: 16px; margin-top: 0;">Dear <b>${companyName}</b> Hiring Team,</p>
          <p style="font-size: 15px; line-height: 1.6; color: #475569;">Greetings from IPCS Global Placement Cell.</p>
          <p style="font-size: 15px; line-height: 1.6; color: #475569;">Please find attached the consolidated list of pre-screened resumes for the <b>${position}</b> opening (Ref: ${jobId}).</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 25px;">
            <thead>
              <tr style="background-color: #f1f5f9; text-align: left; font-size: 13px;">
                <th style="padding: 10px; border: 1px solid #cbd5e1; text-align:center;">#</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Applicant Name</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Phone</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Email</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Qualification</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Resume Link</th>
              </tr>
            </thead>
            <tbody style="font-size: 13px;">
              ${tableRows}
            </tbody>
          </table>
        </div>
      </div>
    `;

    await sendMailAndLog({
      from: `"IPCS Corporate Relations" <${process.env.EMAIL_USER}>`, 
      to: companyEmail,
      cc: tpoEmail || '',
      subject: `Applicant Resumes: ${position} Opening [Ref: ${jobId}]`,
      html: html,
      attachments: attachments
    }, { name: companyName, email: companyEmail, type: 'Resume Delivery' }); 
    
    console.log(`✅ Sent to ${companyName}. Pausing 5 seconds...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }


  // ==================================================================
  // 📌 TASK 2: TODAY'S PLACEMENT DRIVE REGISTRATIONS TO TPO
  // ==================================================================
  console.log(`🚨 [CRON-TASK 2] Target Date for Placement Drives: ${todayStr}`);

  // 1. Find Drives happening Today
  const drivesToday = (cache.events || []).filter(e => {
    const evType = getValByHeader(e, ['event', 'type', 'event_type']).toLowerCase();
    if (!evType.includes('drive')) return false;
    
    const evDateStr = getValByHeader(e, ['dateoftheevent', 'date']);
    if (!evDateStr) return false;
    
    try {
      let parsedDate = new Date(evDateStr);
      if (isNaN(parsedDate.getTime()) && evDateStr.includes('/')) {
         const parts = evDateStr.split(/[/\s,.-]+/);
         if (parts.length >= 3) { parsedDate = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`); }
      }
      if (!isNaN(parsedDate.getTime())) { return formatter.format(parsedDate) === todayStr; }
      return false;
    } catch(err) { return false; }
  });

  console.log(`🚨 [CRON-TASK 2] Found ${drivesToday.length} Placement Drives scheduled for today.`);

  for (let drive of drivesToday) {
    const dId = (getValByHeader(drive, ['driveid', 'drive id', 'drive_id']) || getValByHeader(drive, ['event_id', 'eventid', 'id'])).toUpperCase().trim();
    const tpoName = getValByHeader(drive, ['tpo', 'placementofficer']) || 'Placement Team';
    const title = getValByHeader(drive, ['title']) || 'Placement Drive';

    // 2. Get ALL students registered for this specific drive
    const allDriveStudents = (cache.drives || []).filter(row => {
      const rowDId = (getValByHeader(row, ['driveid', 'drive id']) || '').toUpperCase().trim();
      return rowDId === dId && dId !== '';
    });

    if (allDriveStudents.length === 0) {
      console.log(`⚠️ Skipped Drive ${dId} - Zero students registered.`);
      continue;
    }

    // 3. Split into Interested and Not Interested
    const interestedStudents = allDriveStudents.filter(row => {
        const regStatus = (getValByHeader(row, ['status']) || '').toLowerCase();
        const tpoStatus = (getValByHeader(row, ['studentstatus']) || '').toLowerCase();
        return !regStatus.includes('not interested') && !tpoStatus.includes('not interested');
    });

    const notInterestedStudents = allDriveStudents.filter(row => {
        const regStatus = (getValByHeader(row, ['status']) || '').toLowerCase();
        const tpoStatus = (getValByHeader(row, ['studentstatus']) || '').toLowerCase();
        return regStatus.includes('not interested') || tpoStatus.includes('not interested');
    });

    // 4. Build Mailing List
    const tpoEmail = getTpoEmailByName(tpoName);
    const giftyEmail = 'giftyipcsglobal@gmail.com'; 
    const allTpos = getAllTpoEmails();

    const ccSet = new Set([giftyEmail, ...allTpos]);
    if (tpoEmail) ccSet.delete(tpoEmail);
    const ccList = Array.from(ccSet).filter(Boolean).join(',');

    const toEmail = tpoEmail || giftyEmail; 

    // 5. Build HTML Row Helper Function
    const buildRows = (studentsArray) => {
      let rows = '';
      studentsArray.forEach((appRow, index) => {
        const name = getValByHeader(appRow, ['name', 'studentname']) || 'Unknown';
        const branch = getValByHeader(appRow, ['branch']) || 'N/A';
        const course = getValByHeader(appRow, ['course']) || 'N/A';
        const phone = getValByHeader(appRow, ['contact', 'phone']) || 'N/A';
        const resume = getValByHeader(appRow, ['resume']) || '';

        let resumeBtn = 'N/A';
        if (resume && resume !== 'N/A') {
          const driveMatch = resume.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
          if (driveMatch) {
              const driveId = driveMatch[1];
              resumeBtn = `<a href="https://drive.google.com/file/d/${driveId}/view" style="background: #0f172a; color: white; padding: 6px 12px; text-decoration: none; border-radius: 4px; font-size: 12px; display: inline-block; white-space: nowrap;">View CV</a>`;
          } else { resumeBtn = `<a href="${resume}">Link</a>`; }
        }

        rows += `<tr><td style="padding:10px;border:1px solid #cbd5e1;text-align:center;">${index+1}</td><td style="padding:10px;border:1px solid #cbd5e1;"><b>${name}</b></td><td style="padding:10px;border:1px solid #cbd5e1;">${branch}</td><td style="padding:10px;border:1px solid #cbd5e1;">${course}</td><td style="padding:10px;border:1px solid #cbd5e1;">${phone}</td><td style="padding:10px;border:1px solid #cbd5e1;text-align:center;">${resumeBtn}</td></tr>`;
      });
      return rows;
    };

    const tableRowsInterested = buildRows(interestedStudents);
    const tableRowsNotInterested = buildRows(notInterestedStudents);

    // 6. Build the Final HTML Template with Two Tables
    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0f1523; padding: 20px; text-align: center; border-bottom: 4px solid #8b5cf6;">
          <h2 style="color: #ffffff; margin: 0; letter-spacing: 1px;">PLACEMENT DRIVE REGISTRATIONS</h2>
        </div>
        <div style="padding: 30px; background-color: #ffffff;">
          <p style="font-size: 16px; margin-top: 0;">Dear <b>${tpoName}</b>,</p>
          <p style="font-size: 15px; line-height: 1.6; color: #475569;">Greetings from IPCS Global Placement Cell.</p>
          <p style="font-size: 15px; line-height: 1.6; color: #475569;">This is the consolidated list of <b>${allDriveStudents.length} students</b> registered for the Placement Drive scheduled for today: <b>${title}</b> (Ref: ${dId}).</p>
          
          <!-- ✅ INTERESTED STUDENTS TABLE -->
          <h3 style="color: #0f1523; margin-top: 30px; margin-bottom: 10px; font-size: 16px; text-transform: uppercase;">✅ Interested Candidates (${interestedStudents.length})</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f0fdf4; color: #166534; text-align: left; font-size: 13px;">
                <th style="padding: 10px; border: 1px solid #cbd5e1; text-align:center;">#</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Applicant Name</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Branch</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Course</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Phone</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Resume Link</th>
              </tr>
            </thead>
            <tbody style="font-size: 13px;">
              ${tableRowsInterested || '<tr><td colspan="6" style="padding:10px;text-align:center;border:1px solid #cbd5e1; color: #64748b;">No interested candidates</td></tr>'}
            </tbody>
          </table>

          <!-- ❌ NOT INTERESTED STUDENTS TABLE (Only shows if there are any) -->
          ${notInterestedStudents.length > 0 ? `
          <h3 style="color: #ef4444; margin-top: 40px; margin-bottom: 10px; font-size: 16px; text-transform: uppercase;">❌ Not Interested / Opt-Outs (${notInterestedStudents.length})</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #fef2f2; color: #991b1b; text-align: left; font-size: 13px;">
                <th style="padding: 10px; border: 1px solid #cbd5e1; text-align:center;">#</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Applicant Name</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Branch</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Course</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Phone</th>
                <th style="padding: 10px; border: 1px solid #cbd5e1;">Resume Link</th>
              </tr>
            </thead>
            <tbody style="font-size: 13px;">
              ${tableRowsNotInterested}
            </tbody>
          </table>
          ` : ''}
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">
            <p style="margin: 0 0 5px 0;">Please ensure that all registered students are assisted appropriately during the drive today.</p>
            <p style="margin: 15px 0 2px 0;">Regards,</p>
            <p style="margin: 0 0 2px 0; font-weight: bold; color: #0f1523; font-size: 14px;">IPCS Placement Portal</p>
          </div>
        </div>
      </div>
    `;

    await sendMailAndLog({
      from: `"IPCS Placement Desk" <${process.env.EMAIL_USER}>`, 
      to: toEmail,
      cc: ccList,
      subject: `Today's Drive Registrations: ${title} [Ref: ${dId}]`,
      html: html
    }, { name: tpoName, email: toEmail, type: 'Drive Registrations Summary' }); 
    
    console.log(`✅ Sent Drive Summary to ${tpoName}. Pausing 5 seconds...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  console.log("🎉 All Cron automated tasks completed successfully!");
};

exports.triggerDailyCron = async (req, res) => {
  try {
    await exports.runDailyCron();
    res.json({ success: true, message: "Manual Resume Delivery process completed!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================
// 🚨 SAFER STRICT MATCHING FOR CLIENTS SHEET
// =========================================================
const canManageEveryClient = (user) => {
  const role = String(user?.role || '').toUpperCase();
  return user?.accessType === 'superadmin' || ['SYSTEM ADMIN', 'GENERAL MANAGER', 'ZONAL PLACEMENT HEAD', 'TECHNICAL HEAD'].includes(role) || role === 'BM' || role.includes('BRANCH MANAGER') || role.includes('MANAGER');
};
const canManageEveryDrive = user => {
  const role = String(user?.role || '').toUpperCase();
  return user?.accessType === 'superadmin' || role.includes('ADMIN') || ['SYSTEM ADMIN', 'GENERAL MANAGER', 'ZONAL PLACEMENT HEAD', 'TECHNICAL HEAD'].includes(role);
};
const isBranchManagerUser = user => {
  const role = String(user?.role || '').toUpperCase();
  return role === 'BM' || role.includes('BRANCH MANAGER');
};

const canManageClientRow = (user, row) => {
  if (canManageEveryClient(user)) return true;
  const assignedTo = getValByHeader(row, ['placementofficer', 'tponame']).toLowerCase().trim();
  const signedInName = String(user?.name || '').toLowerCase().trim();
  return Boolean(assignedTo && signedInName && assignedTo === signedInName);
};

exports.getClients = async (req, res) => {
  try {
    const rows = getCache()?.clients;
    if (!Array.isArray(rows)) return res.status(503).json({ success: false, message: 'Client records are still loading. Please retry shortly.' });
    const clients = rows.reduce((result, row) => {
      const officer = getValByHeader(row, ['placementofficer', 'tponame']);
      if (canManageClientRow(req.portalUser, row)) {
        result.push({
          rowNumber: row.rowNumber,
          companyName: getValByHeader(row, ['companyname', 'company']) || 'Unknown',
          website: getValByHeader(row, ['companywebsite', 'website']) || '',
          location: getValByHeader(row, ['companylocation', 'location']) || '',
          contact: getValByHeader(row, ['companycontact', 'contactnumber', 'phone']) || '',
          email: getValByHeader(row, ['companymailid', 'companyemail', 'mailid', 'email']) || '',
          contactPerson: getValByHeader(row, ['companycontactperson', 'contactperson', 'person']) || '',
          logo: getValByHeader(row, ['companylogo', 'logo']) || '',
          mailStatus: getValByHeader(row, ['mailstatus']) || 'Pending',
          documentStatus: getValByHeader(row, ['documentstatus', 'docstatus']) || 'Pending',
          mouLink: getValByHeader(row, ['mou', 'moulink']) || '',
          tpoName: officer || 'Unknown'
        });
      }
      return result;
    }, []);

    res.json({ success: true, clients: clients.reverse() });
  } catch (err) {
    console.error("Error fetching clients:", err.message);
    res.status(500).json({ success: false, message: "Server encountered an error fetching clients." });
  }
};

let publicPartnerRowsCache = { expiresAt: 0, rows: [] };
let publicPartnerRowsLoading = null;

async function getPublicPartnerRows() {
  const cachedRows = getCache()?.clients;
  if (Array.isArray(cachedRows)) return cachedRows;
  if (publicPartnerRowsCache.expiresAt > Date.now()) return publicPartnerRowsCache.rows;
  if (!publicPartnerRowsLoading) {
    publicPartnerRowsLoading = (async () => {
      await loadDocInfo();
      const clientSheet = doc.sheetsByTitle['Clients'] || doc.sheetsByIndex.find(sheet => sheet.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('clients'));
      if (!clientSheet) throw new Error('Clients sheet was not found.');
      const rows = await clientSheet.getRows();
      publicPartnerRowsCache = { expiresAt: Date.now() + 60 * 1000, rows };
      return rows;
    })();
  }
  try {
    return await publicPartnerRowsLoading;
  } finally {
    publicPartnerRowsLoading = null;
  }
}

exports.getPublicPartners = async (req, res) => {
  try {
    const rows = await getPublicPartnerRows();
    const partners = [];

    rows.forEach(row => {
      const companyName = getValByHeader(row, ['companyname', 'company']).trim();
      if (!companyName) return;
      partners.push({
        companyName,
        logo: getValByHeader(row, ['companylogo', 'logo']).trim(),
        location: getValByHeader(row, ['companylocation', 'location']).trim()
      });
    });

    const total = partners.length;
    const offset = Math.max(0, Number.parseInt(req.query.offset, 10) || 0);
    if (String(req.query.random || '').toLowerCase() === 'true') {
      for (let index = partners.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(Math.random() * (index + 1));
        [partners[index], partners[swap]] = [partners[swap], partners[index]];
      }
    }
    const all = String(req.query.all || '').toLowerCase() === 'true';
    const limit = all ? total : Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || total || 1));
    const items = partners.slice(offset, offset + limit);
    res.json({
      success: true,
      partners: items,
      total,
      nextOffset: !all && offset + items.length < total ? offset + items.length : null
    });
  } catch (err) {
    console.error('Error fetching public partners:', err.message);
    res.status(500).json({ success: false, message: 'Partner directory is temporarily unavailable.' });
  }
};

exports.getPublicPlacementTeam = async (_req, res) => {
  try {
    let rows = getCache()?.contacts;
    if (!Array.isArray(rows) || rows.length === 0) {
      await loadDocInfo();
      const contactSheet = doc.sheetsByTitle['Contact'] || doc.sheetsByIndex.find(sheet => sheet.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('contact'));
      if (!contactSheet) return res.status(503).json({ success: false, team: [], message: 'Placement team details are unavailable.' });
      rows = await contactSheet.getRows();
    }

    const seen = new Set();
    const team = rows.map(row => {
      const name = getValByHeader(row, ['name', 'tponame', 'placementofficer']).trim();
      const role = getValByHeader(row, ['role', 'designation', 'position']).trim() || 'Placement Officer';
      return {
        name,
        role,
        branches: getValByHeader(row, ['assignedbranches', 'assignedbranch', 'sittingbranch', 'branch']).trim(),
        photo: getValByHeader(row, ['profilephotourl', 'profilephoto', 'profileimage', 'photo', 'imageurl']).trim()
      };
    }).filter(member => {
      const key = normalizePlacementText(member.name).replace(/^(mrs|miss|mr|ms|dr)/, '');
      if (!key || seen.has(key) || !/(tpo|placement|career guidance)/i.test(member.role)) return false;
      seen.add(key);
      return true;
    });

    res.json({ success: true, team });
  } catch (err) {
    console.error('Error reading placement team from Contact sheet:', err.message);
    res.status(503).json({ success: false, team: [], message: 'Placement team details are temporarily unavailable.' });
  }
};

exports.getPublicOpenings = async (_req, res) => {
  try {
    let rows = getCache()?.vacancies;
    if (!Array.isArray(rows) || rows.length === 0) {
      await loadDocInfo();
      const vacancySheet = doc.sheetsByTitle['NewsLetter'] || doc.sheetsByIndex.find(sheet => sheet.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('newsletter'));
      if (!vacancySheet) return res.status(503).json({ success: false, openings: [], message: 'Vacancies are temporarily unavailable.' });
      rows = await vacancySheet.getRows();
    }

    const companyLogos = new Map((getCache()?.clients || []).map(row => [
      normalizePlacementText(getValByHeader(row, ['companyname', 'company'])),
      getValByHeader(row, ['companylogo', 'logo']).trim()
    ]).filter(([name, logo]) => name && logo));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const uniqueOpenings = new Map();

    rows.forEach(row => {
      const company = getValByHeader(row, ['companyname', 'company']).trim();
      const position = getValByHeader(row, ['position', 'role', 'jobtitle']).trim();
      const location = getValByHeader(row, ['openingat(location)', 'location', 'city']).trim();
      const sourceStatus = getValByHeader(row, ['status']).trim() || 'Open';
      const lastDate = getValByHeader(row, ['lastdate', 'applicationdeadline']).trim();
      const deadline = safeParseDate(lastDate);
      if (!company || !position || /(inactive|cancelled|canceled|withdrawn|deleted|no longer available)/i.test(sourceStatus)) return;
      const key = [company, position, location].map(normalizePlacementText).join('|');
      const isExpired = /(closed|filled|expired)/i.test(sourceStatus) || Boolean(deadline && deadline < today);
      const status = isExpired ? 'Expired' : 'Open';
      if (status !== 'Open') return;
      const existing = uniqueOpenings.get(key);
      if (existing && (existing.status === 'Open' || status === 'Expired')) return;
      uniqueOpenings.set(key, {
        id: getValByHeader(row, ['jobid', 'id']).trim(),
        company,
        companyLogo: getValByHeader(row, ['companylogo', 'logo']).trim() || companyLogos.get(normalizePlacementText(company)) || '',
        position,
        location,
        mode: getValByHeader(row, ['workmode', 'mode']).trim(),
        lastDate,
        status,
        course: getValByHeader(row, ['course', 'program']).trim(),
        description: getValByHeader(row, ['description', 'jobdescription', 'roleoverview']).trim(),
        qualification: getValByHeader(row, ['qualification', 'eligibility', 'educationalqualification']).trim(),
        experience: getValByHeader(row, ['experience', 'yearsofexperience']).trim(),
        salary: getValByHeader(row, ['salary', 'package', 'ctc', 'compensation']).trim()
      });
    });

    res.json({ success: true, openings: [...uniqueOpenings.values()] });
  } catch (err) {
    console.error('Error reading public openings:', err.message);
    res.status(503).json({ success: false, openings: [], message: 'Vacancies are temporarily unavailable.' });
  }
};

const PUBLIC_MEDIA_FOLDERS = [
  { id: '1YwMEIp5Nyn3Hi9kLlBxHfxE2okK6Tqm4', category: 'posters', label: 'Placement creatives' },
  { id: '1gO0z2GEL9N08WMZnOQkmW3tQ3H7dDtgX', category: 'placement-drive', label: 'Placement drives & activities' },
  { id: '1WeTrsn7oAGOtsq_3LWp_BLNlC-sy5DDk', category: 'testimonials', label: 'Student testimonials' }
];
let placementPosterCache = { expiresAt: 0, posters: [], byId: new Map() };
let placementPosterLoading = null;

async function getPlacementPosterFiles(forceRefresh = false) {
  if (!forceRefresh && placementPosterCache.expiresAt > Date.now()) return placementPosterCache;
  if (placementPosterLoading) return placementPosterLoading;

  placementPosterLoading = (async () => {
  const posters = [];
  const visited = new Set();
  const listFolder = async (folderId, folderPath = '', depth = 0, sourceCategory = 'posters') => {
    if (visited.has(folderId) || depth > 5) return;
    visited.add(folderId);
    let pageToken;
    const children = [];
    do {
      const response = await drive.files.list({
        q: `'${folderId}' in parents and trashed = false`,
        pageSize: 250,
        pageToken,
        orderBy: 'name',
        fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,thumbnailLink)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      });
      children.push(...(response.data.files || []));
      pageToken = response.data.nextPageToken;
    } while (pageToken);

    const folders = [];
    for (const file of children) {
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        folders.push({ id: file.id, path: folderPath ? `${folderPath} / ${file.name}` : file.name, sourceCategory });
      } else if (String(file.mimeType || '').startsWith('image/') || String(file.mimeType || '').startsWith('video/')) {
        posters.push({
          id: file.id,
          name: file.name,
          folder: folderPath || 'Placement creatives',
          mimeType: file.mimeType,
          mediaType: String(file.mimeType || '').startsWith('video/') ? 'video' : 'image',
          sourceCategory,
          thumbnailLink: file.thumbnailLink || '',
          modifiedTime: file.modifiedTime || ''
        });
      }
    }
    for (let index = 0; index < folders.length; index += 4) {
      await Promise.all(folders.slice(index, index + 4).map(folder => listFolder(folder.id, folder.path, depth + 1, folder.sourceCategory)));
    }
  };

  for (const source of PUBLIC_MEDIA_FOLDERS) await listFolder(source.id, source.label, 0, source.category);
  posters.sort((a, b) => (b.modifiedTime || '').localeCompare(a.modifiedTime || '') || a.name.localeCompare(b.name));
  placementPosterCache = {
    expiresAt: Date.now() + 5 * 60 * 1000,
    posters,
    byId: new Map(posters.map(poster => [poster.id, poster]))
  };
  return placementPosterCache;
  })();
  try {
    return await placementPosterLoading;
  } finally {
    placementPosterLoading = null;
  }
}

exports.getPublicPlacementPosters = async (req, res) => {
  try {
    const { posters } = await getPlacementPosterFiles();
    const category = String(req.query.category || 'posters').toLowerCase();
    const keywords = {
      'placement-drive': /placement[\s_-]*drive|drive[\s_-]*placement|activit/i,
      testimonials: /testimonial|student[\s_-]*story|success[\s_-]*story/i,
      talentino: /talentino/i,
      videos: /video|testimonial|talentino|drive|client|partner/i,
      clients: /client|corporate[\s_-]*partner|partner[\s_-]*(story|testimonial|media)/i,
      'client-videos': /client|corporate[\s_-]*partner|partner[\s_-]*(story|testimonial|media)/i
    };
    const matchesCategory = poster => {
      const content = `${poster.folder || ''} ${poster.name || ''}`;
      if (category === 'posters') return poster.sourceCategory === 'posters' && poster.mediaType === 'image';
      if (category === 'videos') return poster.mediaType === 'video';
      if (category === 'placement-drive') return poster.sourceCategory === 'placement-drive';
      if (category === 'testimonials') return poster.sourceCategory === 'testimonials';
      if (category === 'client-videos') return poster.mediaType === 'video' && keywords['client-videos'].test(content);
      const keyword = keywords[category];
      if (!keyword || !keyword.test(content)) return false;
      return true;
    };
    const filtered = posters.filter(matchesCategory);
    if (String(req.query.random || '').toLowerCase() === 'true') {
      for (let index = filtered.length - 1; index > 0; index -= 1) {
        const swap = Math.floor(Math.random() * (index + 1));
        [filtered[index], filtered[swap]] = [filtered[swap], filtered[index]];
      }
    }
    const total = filtered.length;
    const offset = Math.max(0, Number.parseInt(req.query.offset, 10) || 0);
    const all = String(req.query.all || '').toLowerCase() === 'true';
    const limit = all ? total : Math.min(48, Math.max(1, Number.parseInt(req.query.limit, 10) || 8));
    const page = filtered.slice(offset, offset + limit);
    res.json({
      success: true,
      posters: page.map(poster => ({
        ...poster,
        imageUrl: `/api/public/placement-posters/${encodeURIComponent(poster.id)}`
      })),
      total,
      nextOffset: !all && offset + page.length < total ? offset + page.length : null
    });
  } catch (err) {
    console.error('Error reading placement posters from Drive:', err.message);
    res.status(503).json({ success: false, message: 'Placement posters are temporarily unavailable.' });
  }
};

exports.streamPublicPlacementPoster = async (req, res) => {
  try {
    const { byId } = await getPlacementPosterFiles();
    const poster = byId.get(String(req.params.fileId || ''));
    if (!poster) return res.status(404).end();

    const requestedRange = req.get('range');
    const response = await drive.files.get(
      { fileId: poster.id, alt: 'media', supportsAllDrives: true },
      { responseType: 'stream', ...(requestedRange ? { headers: { Range: requestedRange } } : {}) }
    );
    res.status(response.status || 200);
    res.set('Content-Type', poster.mimeType);
    res.set('Cache-Control', 'public, max-age=3600');
    res.set('Accept-Ranges', 'bytes');
    if (response.headers?.['content-range']) res.set('Content-Range', response.headers['content-range']);
    if (response.headers?.['content-length']) res.set('Content-Length', response.headers['content-length']);
    response.data.on('error', error => {
      console.error('Error streaming placement poster:', error.message);
      if (!res.headersSent) res.status(502).end();
      else res.end();
    });
    response.data.pipe(res);
  } catch (err) {
    console.error('Error opening placement poster:', err.message);
    res.status(502).end();
  }
};

const PUBLIC_TEAM_PHOTO_FOLDER_ID = '1tGC8eC38Pe0YJCWnjZbTKEAxJzwosc1C';
const PUBLIC_TEAM_PHOTO_FILE_IDS = new Set([
  '1ndgICIIBSUuND1lG2GWGntFWGXxvd1U_',
  '1Cm1hmst2tQiYYWSOx-OQxiJAAuwXV8e_',
  '1LOdgTK_4zzpXjePAU7F5kNgUiDXDo5wD',
  '1ISdyiVhlMIum-DvsizL5sKQaYpOdDuEz',
  '1JNiMYPK8JQycFaelaGZFMsuZKgLj8Gu0',
  '1EMsipJDZzoWkCDkrXKrDc5Fqw4qjDT8P'
]);
let publicTeamPhotoCache = { expiresAt: 0, photos: [], byId: new Map() };
let publicTeamPhotoLoading = null;

async function getPublicTeamPhotoFiles() {
  if (publicTeamPhotoCache.expiresAt > Date.now()) return publicTeamPhotoCache;
  if (publicTeamPhotoLoading) return publicTeamPhotoLoading;
  publicTeamPhotoLoading = (async () => {
    const photos = [];
    const visited = new Set();
    const listFolder = async (folderId, depth = 0) => {
      if (visited.has(folderId) || depth > 4) return;
      visited.add(folderId);
      let pageToken;
      do {
        const response = await drive.files.list({
          q: `'${folderId}' in parents and trashed = false`,
          pageSize: 250,
          pageToken,
          orderBy: 'name',
          fields: 'nextPageToken,files(id,name,mimeType,modifiedTime)',
          supportsAllDrives: true,
          includeItemsFromAllDrives: true
        });
        for (const file of response.data.files || []) {
          if (file.mimeType === 'application/vnd.google-apps.folder') await listFolder(file.id, depth + 1);
          else if (String(file.mimeType || '').startsWith('image/')) photos.push({ id: file.id, name: file.name, mimeType: file.mimeType, modifiedTime: file.modifiedTime || '' });
        }
        pageToken = response.data.nextPageToken;
      } while (pageToken);
    };
    await listFolder(PUBLIC_TEAM_PHOTO_FOLDER_ID);
    publicTeamPhotoCache = { expiresAt: Date.now() + 5 * 60 * 1000, photos, byId: new Map(photos.map(photo => [photo.id, photo])) };
    return publicTeamPhotoCache;
  })();
  try { return await publicTeamPhotoLoading; }
  finally { publicTeamPhotoLoading = null; }
}

exports.getPublicTeamPhotos = async (_req, res) => {
  try {
    const { photos } = await getPublicTeamPhotoFiles();
    res.json({ success: true, photos: photos.map(photo => ({ ...photo, imageUrl: `/api/public/team-photos/${encodeURIComponent(photo.id)}` })) });
  } catch (err) {
    console.error('Error reading team profile photos from Drive:', err.message);
    res.status(503).json({ success: false, photos: [], message: 'Team profile photos are temporarily unavailable.' });
  }
};

exports.streamPublicTeamPhoto = async (req, res) => {
  try {
    const fileId = String(req.params.fileId || '');
    let photo;
    if (PUBLIC_TEAM_PHOTO_FILE_IDS.has(fileId)) {
      const metadata = await drive.files.get({ fileId, fields: 'id,mimeType', supportsAllDrives: true });
      if (!String(metadata.data.mimeType || '').startsWith('image/')) return res.status(404).end();
      photo = { id: fileId, mimeType: metadata.data.mimeType };
    } else {
      const { byId } = await getPublicTeamPhotoFiles();
      photo = byId.get(fileId);
    }
    if (!photo) return res.status(404).end();
    const response = await drive.files.get({ fileId: photo.id, alt: 'media', supportsAllDrives: true }, { responseType: 'stream' });
    res.set('Content-Type', photo.mimeType);
    res.set('Cache-Control', 'public, max-age=3600');
    response.data.on('error', error => {
      console.error('Error streaming team profile photo:', error.message);
      if (!res.headersSent) res.status(502).end();
      else res.end();
    });
    response.data.pipe(res);
  } catch (err) {
    console.error('Error opening team profile photo:', err.message);
    res.status(502).end();
  }
};

exports.getClientById = (req, res) => {
  const targetRow = parseInt(req.params.id);
  const row = getCache().clients.find(r => r.rowNumber === targetRow);
  if (!row) return res.status(404).json({ success: false, message: "Client not found" });

  res.json({ success: true, client: { 
    rowNumber: row.rowNumber, 
    companyName: getValByHeader(row, ['companyname', 'company']) || 'Unknown', 
    email: getValByHeader(row, ['companymailid', 'companyemail', 'mailid', 'email']) || '', 
    contactPerson: getValByHeader(row, ['companycontactperson', 'contactperson', 'person']) || '', 
    contact: getValByHeader(row, ['companycontact', 'contactnumber', 'phone']) || '', 
    logo: getValByHeader(row, ['companylogo', 'logo']) || '', 
    documentStatus: getValByHeader(row, ['documentstatus', 'docstatus']) || 'Pending' 
  }});
};

const MOU_TOKEN_HASH_HEADER = 'MOU Signing Token Hash';
const hashMouSigningToken = token => createHash('sha256').update(String(token || '')).digest('hex');
const createMouSigningId = () => `MOU-${randomBytes(18).toString('base64url')}`;

const getMouSigningApiOrigin = req => {
  const configuredHosts = new Set([
    'api-talenzo.ipcsglobal.info',
    'api-placement.ipcsglobal.info',
    'placement.ipcsglobal.info',
    'ipcs-tpo-portal-u0l6.onrender.com',
    ...String(process.env.MOU_SIGNING_API_HOSTS || '').split(',')
  ].map(host => String(host || '').trim().toLowerCase()).filter(Boolean));
  const candidateBases = [
    req.body?.mouApiBase,
    process.env.MOU_SIGNING_API_BASE,
    `https://${String(req.hostname || '').trim()}`
  ];
  for (const candidateBase of candidateBases) {
    try {
      const parsed = new URL(String(candidateBase || '').trim());
      if (parsed.protocol === 'https:' && configuredHosts.has(parsed.hostname.toLowerCase())) return parsed.origin;
    } catch { /* Ignore invalid candidates and try the next trusted source. */ }
  }
  return '';
};

const findClientByMouToken = async (sheet, token) => {
  const cleanToken = String(token || '').trim();
  const isLegacyToken = /^[a-f0-9]{64}$/i.test(cleanToken);
  const isMouId = /^MOU-[A-Za-z0-9_-]{24}$/.test(cleanToken);
  if (!isLegacyToken && !isMouId) return null;
  const canonicalToken = isLegacyToken ? cleanToken.toLowerCase() : cleanToken;

  await sheet.loadHeaderRow();
  const tokenHash = Buffer.from(hashMouSigningToken(canonicalToken), 'hex');
  const tokenHeader = (sheet.headerValues || []).find(header =>
    String(header || '').toLowerCase().replace(/[^a-z0-9]/g, '') === 'mousigningtokenhash'
  );
  if (!tokenHeader) return null;

  const rows = await sheet.getRows();
  return rows.find(row => {
    const storedHash = String(row.get(tokenHeader) || '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(storedHash)) return false;
    const storedBuffer = Buffer.from(storedHash, 'hex');
    return storedBuffer.length === tokenHash.length && timingSafeEqual(storedBuffer, tokenHash);
  }) || null;
};

exports.getMouByToken = async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    await loadDocInfo();
    const sheet = doc.sheetsByTitle['Clients'];
    if (!sheet) return res.status(503).json({ success: false, message: 'The agreement register is unavailable.' });
    const row = await findClientByMouToken(sheet, req.params.token);
    if (!row) return res.status(404).json({ success: false, message: 'This signing link is invalid or has been replaced. Please ask IPCS to send a new MOU request.' });

    return res.json({ success: true, client: {
      companyName: getValByHeader(row, ['companyname', 'company']) || 'Unknown',
      email: getValByHeader(row, ['companymailid', 'companyemail', 'mailid', 'email']) || '',
      contactPerson: getValByHeader(row, ['companycontactperson', 'contactperson', 'person']) || '',
      logo: getValByHeader(row, ['companylogo', 'logo']) || '',
      documentStatus: getValByHeader(row, ['documentstatus', 'docstatus']) || 'Pending'
    }});
  } catch (error) {
    console.error('MOU link lookup failed:', error.message);
    return res.status(503).json({ success: false, message: 'Agreement details are temporarily unavailable. Please try again later.' });
  }
};

exports.updateClient = async (req, res) => {
  const { rowNumber, email, phone, location, contactPerson } = req.body;
  const existingLogo = req.body.logo || '';
  try {
    let logoLink = existingLogo;
    if (req.file) { logoLink = await uploadToDrive(req.file, FOLDER_CLIENT_LOGOS); }
    
    await loadDocInfo();
    const sheet = doc.sheetsByTitle["Clients"];
    if (!sheet) return res.status(503).json({ success: false, message: 'Client register is unavailable.' });
    const numericRow = Number(rowNumber);
    if (!Number.isInteger(numericRow) || numericRow < 2) return res.status(400).json({ success: false, message: 'A valid client record is required.' });
    const rows = await sheet.getRows({ offset: numericRow - 2, limit: 1 });
    
    if (rows.length > 0) {
      if (!canManageClientRow(req.portalUser, rows[0])) return res.status(403).json({ success: false, message: 'You cannot edit this client record.' });
      const headers = sheet.headerValues;
      const updateObj = {};
      
      const normalizeHeader = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const getSafeH = (searchStrs) => {
        for (let s of searchStrs) {
          const clean = normalizeHeader(s);
          const exact = headers.find(h => normalizeHeader(h) === clean);
          if (exact) return exact;
        }
        for (let s of searchStrs) {
          const clean = normalizeHeader(s);
          const partial = headers.find(h => normalizeHeader(h).includes(clean));
          if (partial) return partial;
        }
        return null;
      };
      
      const hEmail = getSafeH(['companymailid', 'companyemail', 'mailid', 'email']); if(hEmail && email !== undefined) updateObj[hEmail] = email;
      const hPhone = getSafeH(['companycontact', 'contactnumber', 'contact', 'phone']); if(hPhone && phone !== undefined) updateObj[hPhone] = phone;
      const hLoc = getSafeH(['companylocation', 'location']); if(hLoc && location !== undefined) updateObj[hLoc] = location;
      const hPerson = getSafeH(['companycontactperson', 'contactperson', 'person']); if(hPerson && contactPerson !== undefined) updateObj[hPerson] = contactPerson;
      const hLogo = getSafeH(['companylogo', 'logo']); if(hLogo && logoLink) updateObj[hLogo] = logoLink;

      if (Object.keys(updateObj).length === 0) return res.status(400).json({ success: false, message: 'No editable client columns were found in the Clients sheet.' });
      rows[0].assign(updateObj); 
      await rows[0].save(); 
      refreshCache(); 
      res.json({ success: true, logoLink });
    } else { 
      res.status(404).json({ success: false, message: "Row not found." }); 
    }
  } catch (error) { 
    res.status(500).json({ success: false, message: error.message }); 
  }
};

exports.requestMou = async (req, res) => {
  const rowNumber = Number(req.body?.rowNumber);
  try {
    if (!Number.isInteger(rowNumber) || rowNumber < 2) return res.status(400).json({ success: false, message: 'A valid client record is required.' });
    await loadDocInfo();
    const sheet = doc.sheetsByTitle['Clients'];
    if (!sheet) return res.status(503).json({ success: false, message: 'Client register is unavailable.' });
    await sheet.loadHeaderRow();
    let headers = [...(sheet.headerValues || [])];
    const normalizeHeader = header => String(header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    let tokenHeader = headers.find(header => normalizeHeader(header) === 'mousigningtokenhash');
    let mailStatusHeader = headers.find(header => normalizeHeader(header) === 'mailstatus');
    const missingHeaders = [];
    if (!tokenHeader) missingHeaders.push(MOU_TOKEN_HASH_HEADER);
    if (!mailStatusHeader) missingHeaders.push('Mail Status');
    if (missingHeaders.length) {
      const requiredColumnCount = headers.length + missingHeaders.length;
      const currentColumnCount = Number(sheet.columnCount) || 0;
      if (currentColumnCount < requiredColumnCount) {
        await sheet.resize({ columnCount: requiredColumnCount });
      }
      await sheet.setHeaderRow([...headers, ...missingHeaders]);
      await sheet.loadHeaderRow();
      headers = [...(sheet.headerValues || [])];
      tokenHeader = headers.find(header => normalizeHeader(header) === 'mousigningtokenhash');
      mailStatusHeader = headers.find(header => normalizeHeader(header) === 'mailstatus');
    }
    if (!tokenHeader || !mailStatusHeader) return res.status(500).json({ success: false, message: 'The Clients sheet is missing required MOU tracking columns.' });
    const rows = await sheet.getRows({ offset: rowNumber - 2, limit: 1 });
    if (!rows.length || Number(rows[0].rowNumber) !== rowNumber) return res.status(404).json({ success: false, message: 'Client record was not found.' });
    const clientRow = rows[0];
    if (!canManageClientRow(req.portalUser, clientRow)) return res.status(403).json({ success: false, message: 'You cannot send an MOU for this client.' });
    const companyEmail = getValByHeader(clientRow, ['companymailid', 'companyemail', 'mailid', 'email']);
    const companyName = getValByHeader(clientRow, ['companyname', 'company']);
    if (!companyEmail || !companyName) return res.status(400).json({ success: false, message: 'This client needs a company name and email before an MOU can be sent.' });
    const signingToken = createMouSigningId();
    clientRow.assign({ [tokenHeader]: hashMouSigningToken(signingToken), [mailStatusHeader]: 'Sending' });
    await clientRow.save();
    const signingApiOrigin = getMouSigningApiOrigin(req);
    const signingApiQuery = signingApiOrigin ? `?api=${encodeURIComponent(signingApiOrigin)}` : '';
    const signingLink = `https://talenzo.ipcsglobal.info/sign-certificate/${encodeURIComponent(signingToken)}${signingApiQuery}`;
    const mailOptions = {
      from: `"IPCS Placement Portal" <${process.env.EMAIL_USER}>`, to: companyEmail,
      subject: `Action Required: IPCS Global Hiring Partnership Confirmation With ${companyName} [MOU ID: ${signingToken}]`,
      html: `<div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;"><div style="background-color: #0f1523; padding: 20px; text-align: center; border-bottom: 4px solid #8b5cf6;"><h2 style="color: #ffffff; margin: 0;">IPCS HIRING PARTNERSHIP</h2></div><div style="padding: 30px;"><p>Dear ${companyName} Team,</p><p>We are thrilled to welcome you as a Preferred Hiring Partner with IPCS Global!</p><p>To finalize our association, please review and digitally sign your Confirmation of Hiring Partnership by clicking the secure button below. You will be able to upload your company logo and authorized signature directly on the document.</p><p style="font-size: 13px; color: #64748b;">MOU ID: <strong>${signingToken}</strong></p><div style="text-align: center; margin: 40px 0;"><a href="${signingLink}" style="background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; font-size: 16px;">Review & Sign</a></div><p style="font-size: 13px; color: #64748b;">If the button does not work, open the signing page using <a href="${signingLink}" style="color: #0369a1; font-weight: bold;">MOU ID ${signingToken}</a>.</p></div></div>`
    };
    try {
      await sendMailAndLog(mailOptions, { name: companyName, email: companyEmail, type: 'MOU Request' });
    } catch (mailError) {
      try {
        clientRow.assign({ [mailStatusHeader]: 'Failed' });
        await clientRow.save();
      } catch (statusError) {
        console.error('Could not save failed MOU mail status:', statusError.message);
      }
      throw mailError;
    }

    try {
      clientRow.assign({ [mailStatusHeader]: 'Request Sent' });
      await clientRow.save();
      refreshCache();
      return res.json({ success: true, mailSent: true, statusUpdated: true });
    } catch (statusError) {
      console.error('MOU email was sent, but its sheet status could not be updated:', statusError.message);
      refreshCache();
      return res.json({ success: true, mailSent: true, statusUpdated: false, message: 'The email was sent, but the sheet status could not be updated. Check the client email before resending.' });
    }
  } catch (error) {
    console.error('MOU request failed:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.submitMou = async (req, res) => {
  try {
    const signingToken = String(req.body?.signingToken || '').trim();
    await loadDocInfo();
    const sheet = doc.sheetsByTitle['Clients'];
    if (!sheet) return res.status(503).json({ success: false, message: 'Client register is unavailable.' });
    const clientRow = await findClientByMouToken(sheet, signingToken);
    if (!clientRow) return res.status(404).json({ success: false, message: 'This signing link is invalid or has been replaced. Please ask IPCS to send a new MOU request.' });
    if ((getValByHeader(clientRow, ['documentstatus', 'docstatus']) || '').trim().toLowerCase() === 'completed') {
      return res.status(409).json({ success: false, message: 'This agreement has already been submitted.' });
    }

    const certFile = (req.files || []).find(f => f.fieldname === 'certificatePdf');
    const logoFile = (req.files || []).find(f => f.fieldname === 'logoFile');
    if (!certFile) return res.status(400).json({ success: false, message: "PDF missing" });

    const companyName = getValByHeader(clientRow, ['companyname', 'company']) || 'Hiring Partner';
    const companyEmail = getValByHeader(clientRow, ['companymailid', 'companyemail', 'mailid', 'email']) || '';
    const tpoName = getValByHeader(clientRow, ['placementofficer', 'tponame']);
    const tpoEmail = getTpoEmailByName(tpoName);

    const pdfLink = await uploadToDrive(certFile, FOLDER_MOU_CERTIFICATES);
    let logoLink = null;
    if (logoFile) { logoLink = await uploadToDrive(logoFile, FOLDER_CLIENT_LOGOS); }

    const headers = sheet.headerValues;
    const updateObj = {};
      
    const getSafeH = searchStrs => {
      for (const search of searchStrs) {
        const clean = search.toLowerCase().replace(/\s/g, '');
        const exact = headers.find(header => header.toLowerCase().replace(/\s/g, '') === clean);
        if (exact) return exact;
      }
      for (const search of searchStrs) {
        const clean = search.toLowerCase().replace(/\s/g, '');
        const partial = headers.find(header => header.toLowerCase().replace(/\s/g, '').includes(clean));
        if (partial) return partial;
      }
      return null;
    };

    const hDocStat = getSafeH(['documentstatus', 'docstatus']); if(hDocStat) updateObj[hDocStat] = 'Completed';
    const hMou = getSafeH(['mou', 'moulink']); if(hMou) updateObj[hMou] = pdfLink;
    const hLogo = getSafeH(['companylogo', 'logo']); if(hLogo && logoLink) updateObj[hLogo] = logoLink;
    clientRow.assign(updateObj);
    await clientRow.save();

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
            </div>
          </div>
        </div>
      `,
      attachments: [{ filename: `${companyName.replace(/\s+/g, '_')}_Agreement.pdf`, content: certFile.buffer }]
    };
    let emailSent = true;
    try {
      await sendMailAndLog(mailOptions, { name: companyName, email: companyEmail, type: 'MOU Completion' });
    } catch (mailError) {
      emailSent = false;
      console.error('MOU was saved, but completion email failed:', mailError.message);
    }
    refreshCache();
    res.json({ success: true, pdfLink, emailSent });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// =========================================================
// 🚨 ADMIN USERS & LMS MANAGEMENT
// =========================================================
exports.getAdminUsers = (req, res) => {
  try {
    const cache = getCache();
    let allUsers = [];

    // 1. Process Contact Sheet (TPOs)
    if (cache.contacts) {
      cache.contacts.forEach(row => {
        const email = getValByHeader(row, ['email', 'mailid']) || '';
        const name = getValByHeader(row, ['name', 'tponame', 'placementofficer']) || '';
        
        if (email || name) {
          allUsers.push({
            sheet: 'Contact', 
            rowNumber: row.rowNumber, 
            userName: name,
            contact: getValByHeader(row, ['contactnumber', 'phone', 'contact']) || '',
            email: email, 
            sittingBranch: getValByHeader(row, ['sittingbranch', 'branch']) || '',
            assignedBranches: getValByHeader(row, ['assignedbranches']) || '',
            password: getValByHeader(row, ['password']) || '',
            role: getValByHeader(row, ['role']) || 'TPO',
            course: 'All Courses', 
            access: 'View & Edit',
            profilePhoto: getValByHeader(row, ['profilephoto', 'photo']) || '',
            // 🚨 READ THE NEW FIELDS
            empId: getValByHeader(row, ['empid', 'employeeid']) || '',
            target: getValByHeader(row, ['targetofthemonth', 'target']) || ''
          });
        }
      });
    }

    // 2. Process User Sheet (GMs, Tech Heads, Branch Managers)
    if (cache.users) {
      cache.users.forEach(row => {
        const email = getValByHeader(row, ['email', 'mailid', 'mail']) || '';
        const name = getValByHeader(row, ['name', 'username']) || '';
        
        if (email || name) {
          allUsers.push({
            sheet: 'User', 
            rowNumber: row.rowNumber, 
            userName: name,
            contact: getValByHeader(row, ['contact_number', 'contactnumber', 'phone']) || '',
            email: email, 
            sittingBranch: getValByHeader(row, ['sitting_branch', 'sittingbranch', 'branch']) || '',
            assignedBranches: getValByHeader(row, ['assigned_branches', 'assignedbranches']) || '',
            password: getValByHeader(row, ['password']) || '',
            role: getValByHeader(row, ['role']) || 'Unassigned',
            course: getValByHeader(row, ['assigned_courses', 'assignedcourses', 'course']) || 'All Courses',
            access: getValByHeader(row, ['access_type', 'accesstype', 'access']) || 'View Only',
            profilePhoto: getValByHeader(row, ['profile_photo_url', 'profilephoto']) || '',
            // 🚨 READ THE NEW FIELDS
            empId: getValByHeader(row, ['empid', 'employeeid']) || '',
            target: getValByHeader(row, ['targetofthemonth', 'target']) || ''
          });
        }
      });
    }

    res.json({ success: true, users: allUsers.reverse() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.addAdminUser = async (req, res) => {
  try {
    const { userName, contact, email, sittingBranch, assignedBranches, password, role, course, access, empId, target } = req.body;
    
    const sheetName = role === 'TPO' ? "Contact" : "User";
    const s = doc.sheetsByTitle[sheetName]; 
    const h = s.headerValues;

    // Bulletproof Header Finder
    const getSafeH = (searchStrs) => {
      for (let str of searchStrs) {
        const clean = str.toLowerCase().replace(/\s/g, '');
        const exact = h.find(hd => hd.toLowerCase().replace(/\s/g, '') === clean);
        if (exact) return exact;
      }
      for (let str of searchStrs) {
        const clean = str.toLowerCase().replace(/\s/g, '');
        const partial = h.find(hd => hd.toLowerCase().replace(/\s/g, '').includes(clean));
        if (partial) return partial;
      }
      return null;
    };

    const newRow = {};

    if (role === 'TPO') {
      const hName = getSafeH(['tponame', 'name']); if(hName) newRow[hName] = userName;
      const hPhone = getSafeH(['contactnumber', 'phone']); if(hPhone) newRow[hPhone] = contact;
      const hEmail = getSafeH(['mailid', 'email']); if(hEmail) newRow[hEmail] = email;
      const hSit = getSafeH(['sittingbranch']); if(hSit) newRow[hSit] = sittingBranch;
      const hAss = getSafeH(['assignedbranches']); if(hAss) newRow[hAss] = assignedBranches;
      const hPass = getSafeH(['password']); if(hPass) newRow[hPass] = password;
    } else {
      const hName = getSafeH(['name', 'username']); if(hName) newRow[hName] = userName;
      const hPhone = getSafeH(['contactnumber', 'phone']); if(hPhone) newRow[hPhone] = contact;
      const hEmail = getSafeH(['email', 'mailid']); if(hEmail) newRow[hEmail] = email;
      const hSit = getSafeH(['sittingbranch']); if(hSit) newRow[hSit] = sittingBranch;
      const hAss = getSafeH(['assignedbranches']); if(hAss) newRow[hAss] = assignedBranches;
      const hPass = getSafeH(['password']); if(hPass) newRow[hPass] = password;
      const hRole = getSafeH(['role']); if(hRole) newRow[hRole] = role;
      const hCourse = getSafeH(['assignedcourses', 'course']); if(hCourse) newRow[hCourse] = course;
      const hAccess = getSafeH(['accesstype', 'access']); if(hAccess) newRow[hAccess] = access;
      const hStatus = getSafeH(['status']); if(hStatus) newRow[hStatus] = 'Active';
      const hCreated = getSafeH(['createdat']); if(hCreated) newRow[hCreated] = new Date().toLocaleString('en-GB');
    }

    // 🚨 SAVE THE NEW FIELDS SAFELY
    const hEmp = getSafeH(['empid', 'employeeid']); 
    if(hEmp && empId !== undefined) newRow[hEmp] = empId;
    
    const hTgt = getSafeH(['targetofthemonth', 'target']); 
    if(hTgt && target !== undefined) newRow[hTgt] = target;

    await s.addRow(newRow);

    // 🚨 NEW: Sync to TPO_Stats if Target is updated
    if (target !== undefined && userName) {
      await syncTpoStats(userName, { 'Monthly Target': target });
    }

    refreshCache(); 
    res.json({ success: true, message: "User added" });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

exports.updateAdminUser = async (req, res) => {
  try {
    const { sheet, rowNumber, userName, contact, email, sittingBranch, assignedBranches, password, role, course, access, empId, target } = req.body;
    const s = doc.sheetsByTitle[sheet]; 
    const rows = await s.getRows({ offset: rowNumber - 2, limit: 1 });
    
    if (rows.length > 0) {
      const h = s.headerValues;

      // Bulletproof Header Finder
      const getSafeH = (searchStrs) => {
        for (let str of searchStrs) {
          const clean = str.toLowerCase().replace(/\s/g, '');
          const exact = h.find(hd => hd.toLowerCase().replace(/\s/g, '') === clean);
          if (exact) return exact;
        }
        for (let str of searchStrs) {
          const clean = str.toLowerCase().replace(/\s/g, '');
          const partial = h.find(hd => hd.toLowerCase().replace(/\s/g, '').includes(clean));
          if (partial) return partial;
        }
        return null;
      };

      const updateObj = {};
      
      if (sheet === 'Contact') { 
        const hName = getSafeH(['tponame', 'name']); if(hName) updateObj[hName] = userName;
        const hPhone = getSafeH(['contactnumber', 'phone']); if(hPhone) updateObj[hPhone] = contact;
        const hEmail = getSafeH(['mailid', 'email']); if(hEmail) updateObj[hEmail] = email;
        const hSit = getSafeH(['sittingbranch']); if(hSit) updateObj[hSit] = sittingBranch;
        const hAss = getSafeH(['assignedbranches']); if(hAss) updateObj[hAss] = assignedBranches;
        const hPass = getSafeH(['password']); if(hPass) updateObj[hPass] = password;
      } else { 
        const hName = getSafeH(['name', 'username']); if(hName) updateObj[hName] = userName;
        const hPhone = getSafeH(['contactnumber', 'phone']); if(hPhone) updateObj[hPhone] = contact;
        const hEmail = getSafeH(['email', 'mailid']); if(hEmail) updateObj[hEmail] = email;
        const hSit = getSafeH(['sittingbranch']); if(hSit) updateObj[hSit] = sittingBranch;
        const hAss = getSafeH(['assignedbranches']); if(hAss) updateObj[hAss] = assignedBranches;
        const hPass = getSafeH(['password']); if(hPass) updateObj[hPass] = password;
        const hRole = getSafeH(['role']); if(hRole) updateObj[hRole] = role;
        const hCourse = getSafeH(['assignedcourses', 'course']); if(hCourse) updateObj[hCourse] = course;
        const hAccess = getSafeH(['accesstype', 'access']); if(hAccess) updateObj[hAccess] = access;
        const hUpdated = getSafeH(['updatedat']); if(hUpdated) updateObj[hUpdated] = new Date().toLocaleString('en-GB');
      }

      // 🚨 UPDATE THE NEW FIELDS SAFELY
      const hEmp = getSafeH(['empid', 'employeeid']); 
      if(hEmp && empId !== undefined) updateObj[hEmp] = empId;
      
      const hTgt = getSafeH(['targetofthemonth', 'target']); 
      if(hTgt && target !== undefined) updateObj[hTgt] = target;

      rows[0].assign(updateObj); 
      await rows[0].save(); 

      // 🚨 NEW: Sync to TPO_Stats if Target is updated
      if (target !== undefined && userName) {
        await syncTpoStats(userName, { 'Monthly Target': target });
      }

      refreshCache(); 
      res.json({ success: true, message: "User updated" });
    } else { 
      res.status(404).json({ success: false, message: "User row not found" }); 
    }
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

exports.deleteAdminUser = async (req, res) => {
  try {
    const { sheet, rowNumber } = req.body; 
    const targetSheet = doc.sheetsByTitle[sheet];
    
    if (!targetSheet) {
      return res.status(404).json({ success: false, message: "Sheet not found" });
    }
    
    const rows = await targetSheet.getRows({ offset: rowNumber - 2, limit: 1 });
    
    if (rows.length > 0) { 
      await rows[0].delete(); 
      refreshCache(); 
      res.json({ success: true, message: "User deleted" }); 
    } else { 
      res.status(404).json({ success: false, message: "User not found" }); 
    }
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

exports.updatePassword = async (req, res) => {
  const { email, loginId, newPassword } = req.body;
  try {
    const cache = getCache(); 
    let targetRow = null;
    
    const targetEmail = (email || '').toString().trim().toLowerCase();
    const targetLogin = (loginId || '').toString().trim().toLowerCase();

    // 🚨 Safe lookup function that only checks specific columns
    const findUserRow = (rows) => {
      if (!rows) return null;
      return rows.find(row => {
        const rEmail = getValByHeader(row, ['email', 'mailid', 'mail']).toLowerCase();
        const rLogin = getValByHeader(row, ['userid', 'user_id', 'employeeid', 'loginid']).toLowerCase();
        return (targetEmail && rEmail === targetEmail) || (targetLogin && rLogin === targetLogin);
      });
    };

    // Check Contacts (TPOs) first, then Users (Admins/Managers)
    targetRow = findUserRow(cache.contacts) || findUserRow(cache.users);

    if (targetRow) {
      const h = targetRow._worksheet.headerValues;
      const passHeader = getFuzzyHeader(h, 'password') || getFuzzyHeader(h, 'pass');
      
      targetRow.assign({ [passHeader]: newPassword });
      await targetRow.save(); 
      
      refreshCache(); 
      res.json({ success: true, message: "Password updated successfully" });
    } else { 
      res.status(404).json({ success: false, message: "User account not found in database." }); 
    }
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

exports.updatePhoto = async (req, res) => {
  const { email, loginId } = req.body;
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file provided." });
    
    const photoLink = await uploadToDrive(req.file, FOLDER_CLIENT_LOGOS); 
    const cache = getCache(); 
    let targetRow = null;
    
    const targetEmail = (email || '').toString().trim().toLowerCase();
    const targetLogin = (loginId || '').toString().trim().toLowerCase();

    // 🚨 Safe lookup function
    const findUserRow = (rows) => {
      if (!rows) return null;
      return rows.find(row => {
        const rEmail = getValByHeader(row, ['email', 'mailid', 'mail']).toLowerCase();
        const rLogin = getValByHeader(row, ['userid', 'user_id', 'employeeid', 'loginid']).toLowerCase();
        return (targetEmail && rEmail === targetEmail) || (targetLogin && rLogin === targetLogin);
      });
    };

    targetRow = findUserRow(cache.contacts) || findUserRow(cache.users);

    if (targetRow) {
      const h = targetRow._worksheet.headerValues; 
      let photoHeader = h.find(hd => hd.toLowerCase().includes('photo') || hd.toLowerCase().includes('profile'));
      if (!photoHeader) photoHeader = 'Profile_Photo_URL'; // Fallback

      targetRow.assign({ [photoHeader]: photoLink }); 
      await targetRow.save(); 
      
      refreshCache(); 
      res.json({ success: true, photoUrl: photoLink });
    } else { 
      res.status(404).json({ success: false, message: "User not found." }); 
    }
  } catch (error) { 
    res.status(500).json({ success: false, message: error.message }); 
  }
};

// ---------------------------------------------------------
// 🚨 L M S  -  S T U D Y   M A T E R I A L S
// ---------------------------------------------------------
const isLearningAdmin = user => user?.accessType === 'superadmin' || ['SYSTEM ADMIN', 'GENERAL MANAGER', 'ZONAL PLACEMENT HEAD', 'TECHNICAL HEAD'].includes(String(user?.role || '').toUpperCase());
const canReadMaterial = (user, course) => isLearningAdmin(user) || hasAccess('All', course, user?.role, user?.assignedBranchesArray, user?.assignedCourse, user?.department);
const makeMaterialPreviewUrl = rawLink => {
  try {
    const source = new URL(String(rawLink || '').trim());
    if (source.protocol !== 'https:') return '';
    const host = source.hostname.toLowerCase();
    const driveFile = source.pathname.match(/\/file\/d\/([\w-]+)/) || source.pathname.match(/^\/open$/) && source.searchParams.get('id')?.match(/^([\w-]+)/);
    if (host === 'drive.google.com' && driveFile) return `https://drive.google.com/file/d/${driveFile[1]}/preview`;
    if (host === 'docs.google.com' && /\/(document|presentation|spreadsheets)\/d\//.test(source.pathname)) {
      source.pathname = source.pathname.replace(/\/(edit|view|preview)\/?$/, '/preview');
      source.search = '?rm=minimal';
      return source.toString();
    }
    if (host === '1drv.ms' || host.endsWith('onedrive.live.com') || host.endsWith('.sharepoint.com')) {
      source.searchParams.set('web', '1');
      return source.toString();
    }
    return '';
  } catch {
    return '';
  }
};

exports.getMaterials = (req, res) => {
  try {
    const user = req.portalUser;
    if (!user) return res.status(401).json({ success: false, message: 'Sign in again to view study materials.' });
    const showInactive = isLearningAdmin(user);
    let materials = (getCache().materials || []).map(row => {
      const course = getValByHeader(row, ['course']) || '';
      const status = getValByHeader(row, ['status']) || 'Active';
      if ((!showInactive && status.trim().toLowerCase() !== 'active') || !canReadMaterial(user, course)) return null;
      return { 
        id: getValByHeader(row, ['materialid']) || '', 
        course,
        module: getValByHeader(row, ['moduletopic', 'module', 'topic']) || '', 
        title: getValByHeader(row, ['title']) || '', 
        fileType: getValByHeader(row, ['filetype']) || '', 
        ...(showInactive ? { link: getValByHeader(row, ['onedrivelink', 'link']) || '' } : {}),
        status
      };
    }).filter(Boolean);
    res.json({ success: true, materials: materials.reverse(), access: 'allowed' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getMaterialViewLink = (req, res) => {
  const user = req.portalUser;
  if (!user) return res.status(401).json({ success: false, message: 'Sign in again to view study materials.' });
  const materialId = String(req.params.materialId || '').trim();
  const row = (getCache().materials || []).find(item => getValByHeader(item, ['materialid']).trim() === materialId);
  if (!row || String(getValByHeader(row, ['status']) || 'Active').trim().toLowerCase() !== 'active') {
    return res.status(404).json({ success: false, message: 'This study material is unavailable.' });
  }
  const course = getValByHeader(row, ['course']);
  if (!canReadMaterial(user, course)) return res.status(403).json({ success: false, message: 'Access denied for this course.' });
  const previewUrl = makeMaterialPreviewUrl(getValByHeader(row, ['onedrivelink', 'link']));
  if (!previewUrl) return res.status(422).json({ success: false, message: 'This file provider does not offer an in-app preview link.' });
  res.json({ success: true, previewUrl });
};

exports.addMaterial = async (req, res) => {
  try {
    const { id, course, module, title, fileType, link, status } = req.body;
    
    const sheet = doc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('studymaterials'));
    if (!sheet) return res.status(404).json({ success: false, message: "Study Materials sheet not found" });

    const h = sheet.headerValues;
    await sheet.addRow({
      [getFuzzyHeader(h, 'materialid')]: id,
      [getFuzzyHeader(h, 'course')]: course,
      [getFuzzyHeader(h, 'moduletopic')]: module,
      [getFuzzyHeader(h, 'title')]: title,
      [getFuzzyHeader(h, 'filetype')]: fileType,
      [getFuzzyHeader(h, 'onedrivelink')]: link,
      [getFuzzyHeader(h, 'status')]: status || 'Active'
    });

    refreshCache();
    res.json({ success: true, message: "Material added successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateMaterial = async (req, res) => {
  try {
    const { id, course, module, title, fileType, link, status } = req.body;
    
    const sheet = doc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('studymaterials'));
    if (!sheet) return res.status(404).json({ success: false, message: "Study Materials sheet not found" });

    const rows = await sheet.getRows();
    const h = sheet.headerValues;
    const idHeader = getFuzzyHeader(h, 'materialid');
    
    const row = rows.find(r => (r.get(idHeader) || '').toString().trim() === id.toString().trim());

    if (row) {
      row.assign({
        [getFuzzyHeader(h, 'course')]: course,
        [getFuzzyHeader(h, 'moduletopic')]: module,
        [getFuzzyHeader(h, 'title')]: title,
        [getFuzzyHeader(h, 'filetype')]: fileType,
        [getFuzzyHeader(h, 'onedrivelink')]: link,
        [getFuzzyHeader(h, 'status')]: status
      });
      await row.save();
      refreshCache();
      res.json({ success: true, message: "Updated successfully" });
    } else {
      res.status(404).json({ success: false, message: "Record not found in database." });
    }
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

exports.deleteMaterial = async (req, res) => {
  try {
    const { id } = req.body;
    
    const sheet = doc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('studymaterials'));
    if (!sheet) return res.status(404).json({ success: false, message: "Study Materials sheet not found" });

    const rows = await sheet.getRows();
    const h = sheet.headerValues;
    const idHeader = getFuzzyHeader(h, 'materialid');
    
    const row = rows.find(r => (r.get(idHeader) || '').toString().trim() === id.toString().trim());

    if (row) {
      await row.delete();
      refreshCache();
      res.json({ success: true, message: "Deleted successfully" });
    } else {
      res.status(404).json({ success: false, message: "Record not found in database." });
    }
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

// ---------------------------------------------------------
// 🚨 E X A M   H U B
// ---------------------------------------------------------
exports.getQuestions = (req, res) => {
  try {
    const user = req.portalUser;
    let questions = (getCache().techQuestions || []).filter(row => canReadMaterial(user, getValByHeader(row, ['course']))).map(row => {
      return { id: getValByHeader(row, ['questionid']) || '', course: getValByHeader(row, ['course']) || '', question: getValByHeader(row, ['question']) || '', optA: getValByHeader(row, ['optiona']) || '', optB: getValByHeader(row, ['optionb']) || '', optC: getValByHeader(row, ['optionc']) || '', optD: getValByHeader(row, ['optiond']) || '', correct: getValByHeader(row, ['correctoption']) || '', explanation: getValByHeader(row, ['explanation']) || '', status: getValByHeader(row, ['status']) || 'Active' };
    });
    res.json({ success: true, questions: questions.reverse() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addQuestion = async (req, res) => {
  try {
    const { id, course, question, optA, optB, optC, optD, correct, explanation, status } = req.body;
    const user = req.portalUser;
    if (!hasAccess('All', course, user?.role, user?.assignedBranchesArray, user?.assignedCourse, user?.department)) {
      return res.status(403).json({ success: false, message: 'This course is outside your assignment.' });
    }
    const sheet = doc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('techquestions'));
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    const h = sheet.headerValues;
    
    await sheet.addRow({ 
      [getFuzzyHeader(h, 'questionid')]: id, 
      [getFuzzyHeader(h, 'course')]: course, 
      [getFuzzyHeader(h, 'question')]: question, 
      [getFuzzyHeader(h, 'optiona')]: optA, 
      [getFuzzyHeader(h, 'optionb')]: optB, 
      [getFuzzyHeader(h, 'optionc')]: optC, 
      [getFuzzyHeader(h, 'optiond')]: optD, 
      [getFuzzyHeader(h, 'correctoption')]: correct, 
      [getFuzzyHeader(h, 'explanation')]: explanation, 
      [getFuzzyHeader(h, 'status')]: status || 'Active' 
    });
    
    refreshCache(); res.json({ success: true, message: "Question added successfully!" });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateQuestion = async (req, res) => {
  try {
    const { id, course, question, optA, optB, optC, optD, correct, explanation, status } = req.body;
    const sheet = doc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('techquestions'));
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    const rows = await sheet.getRows();
    const h = sheet.headerValues;
    const idHeader = getFuzzyHeader(h, 'questionid');
    
    const rowToUpdate = rows.find(r => (r.get(idHeader) || '').toString().trim() === id.toString().trim());
    if (rowToUpdate) {
      const user = req.portalUser;
      const storedCourse = getValByHeader(rowToUpdate, ['course']);
      if (!hasAccess('All', storedCourse, user?.role, user?.assignedBranchesArray, user?.assignedCourse, user?.department) || !hasAccess('All', course, user?.role, user?.assignedBranchesArray, user?.assignedCourse, user?.department)) {
        return res.status(403).json({ success: false, message: 'This course is outside your assignment.' });
      }
      rowToUpdate.assign({ 
        [getFuzzyHeader(h, 'questionid')]: id, 
        [getFuzzyHeader(h, 'course')]: course, 
        [getFuzzyHeader(h, 'question')]: question, 
        [getFuzzyHeader(h, 'optiona')]: optA, 
        [getFuzzyHeader(h, 'optionb')]: optB, 
        [getFuzzyHeader(h, 'optionc')]: optC, 
        [getFuzzyHeader(h, 'optiond')]: optD, 
        [getFuzzyHeader(h, 'correctoption')]: correct, 
        [getFuzzyHeader(h, 'explanation')]: explanation, 
        [getFuzzyHeader(h, 'status')]: status || 'Active' 
      });
      await rowToUpdate.save(); refreshCache(); res.json({ success: true, message: "Technical question updated successfully!" });
    } else { res.status(404).json({ success: false, message: "Question ID not found." }); }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const { id } = req.body;
    const sheet = doc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('techquestions'));
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    const rows = await sheet.getRows();
    const h = sheet.headerValues;
    const idHeader = getFuzzyHeader(h, 'questionid');
    
    const rowToDelete = rows.find(r => (r.get(idHeader) || '').toString().trim() === id.toString().trim());
    if (rowToDelete) { 
      const user = req.portalUser;
      const storedCourse = getValByHeader(rowToDelete, ['course']);
      if (!hasAccess('All', storedCourse, user?.role, user?.assignedBranchesArray, user?.assignedCourse, user?.department)) {
        return res.status(403).json({ success: false, message: 'This course is outside your assignment.' });
      }
      await rowToDelete.delete(); refreshCache(); res.json({ success: true, message: "Question deleted" }); 
    } else { res.status(404).json({ success: false, message: "Question not found" }); }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getResults = (req, res) => {
  try {
    const user = req.portalUser;
    let results = (getCache().techResults || []).map(row => {
      return { timestamp: getValByHeader(row, ['timestamp']) || '', rollNo: getValByHeader(row, ['rollno']) || '', name: getValByHeader(row, ['name']) || '', email: getValByHeader(row, ['mailid']) || '', branch: getValByHeader(row, ['branch']) || '', course: getValByHeader(row, ['course']) || '', score: getValByHeader(row, ['score']) || '', total: getValByHeader(row, ['totalquestions']) || '', percentage: getValByHeader(row, ['percentage']) || '', timeTaken: getValByHeader(row, ['timetaken']) || '' };
    }).filter(result => isLearningAdmin(user) || hasAccess(result.branch, result.course, user?.role, user?.assignedBranchesArray, user?.assignedCourse, user?.department));
    res.json({ success: true, results: results.reverse() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getCourses = (req, res) => {
  try { res.json({ success: true, courses: getCache().coursesDict }); } 
  catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addCourse = async (req, res) => {
  try {
    const { mainCourse, subCourse } = req.body;
    const sheet = doc.sheetsByTitle["Courses"];
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    await sheet.addRow([mainCourse, subCourse]);
    refreshCache(); res.json({ success: true, message: "Course saved" });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteCourse = async (req, res) => {
  try {
    const { subCourse } = req.body;
    const sheet = doc.sheetsByTitle["Courses"];
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    const rows = await sheet.getRows();
    const rowToDelete = rows.find(r => r._rawData[1] && r._rawData[1].trim() === subCourse.trim());
    if (rowToDelete) {
      await rowToDelete.delete(); refreshCache(); res.json({ success: true, message: "Course deleted" });
    } else { res.status(404).json({ success: false, message: "Course not found" }); }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getAptQuestions = (req, res) => {
  try {
    let questions = getCache().aptQuestions.map(row => {
      return { id: getValByHeader(row, ['qid']) || '', category: getValByHeader(row, ['category']) || '', question: getValByHeader(row, ['question']) || '', optA: getValByHeader(row, ['optiona']) || '', optB: getValByHeader(row, ['optionb']) || '', optC: getValByHeader(row, ['optionc']) || '', optD: getValByHeader(row, ['optiond']) || '', correct: getValByHeader(row, ['correctoption']) || '', explanation: getValByHeader(row, ['explanation']) || '', status: getValByHeader(row, ['status']) || 'Active', level: getValByHeader(row, ['level']) || 'Easy' };
    });
    res.json({ success: true, questions: questions.reverse() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getAptResults = (req, res) => {
  try {
    const user = req.portalUser;
    let results = (getCache().aptResults || []).map(row => {
      return { timestamp: getValByHeader(row, ['timestamp']) || '', rollNo: getValByHeader(row, ['rollno']) || '', name: getValByHeader(row, ['name']) || '', email: getValByHeader(row, ['email', 'mailid']) || '', branch: getValByHeader(row, ['branch']) || '', score: getValByHeader(row, ['score']) || '', total: getValByHeader(row, ['total', 'totalquestions']) || '', percentage: getValByHeader(row, ['percentage']) || '', timeTaken: getValByHeader(row, ['timetaken']) || '', categoryBreakdown: getValByHeader(row, ['categorybreakdown']) || '' };
    }).filter(result => isLearningAdmin(user) || userHasBranch(user, result.branch));
    res.json({ success: true, results: results.reverse() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addAptQuestion = async (req, res) => {
  try {
    const { id, category, question, optA, optB, optC, optD, correct, explanation, status, level } = req.body;
    const sheet = doc.sheetsByTitle["Aptitude_Questions"];
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    const h = sheet.headerValues;
    await sheet.addRow({ [getFuzzyHeader(h, 'qid')]: id, [getFuzzyHeader(h, 'category')]: category, [getFuzzyHeader(h, 'question')]: question, [getFuzzyHeader(h, 'optiona')]: optA, [getFuzzyHeader(h, 'optionb')]: optB, [getFuzzyHeader(h, 'optionc')]: optC, [getFuzzyHeader(h, 'optiond')]: optD, [getFuzzyHeader(h, 'correctoption')]: correct, [getFuzzyHeader(h, 'explanation')]: explanation, [getFuzzyHeader(h, 'status')]: status || 'Active', [getFuzzyHeader(h, 'level')]: level || 'Medium' });
    refreshCache(); res.json({ success: true, message: "Question added" });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateAptQuestion = async (req, res) => {
  try {
    const { id, category, question, optA, optB, optC, optD, correct, explanation, status, level } = req.body;
    const sheet = doc.sheetsByTitle["Aptitude_Questions"];
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    const rows = await sheet.getRows();
    const h = sheet.headerValues;
    const idHeader = getFuzzyHeader(h, 'qid');
    const rowToUpdate = rows.find(r => (r.get(idHeader) || '').toString().trim() === id.toString().trim());
    
    if (rowToUpdate) {
      rowToUpdate.assign({ [getFuzzyHeader(h, 'qid')]: id, [getFuzzyHeader(h, 'category')]: category, [getFuzzyHeader(h, 'question')]: question, [getFuzzyHeader(h, 'optiona')]: optA, [getFuzzyHeader(h, 'optionb')]: optB, [getFuzzyHeader(h, 'optionc')]: optC, [getFuzzyHeader(h, 'optiond')]: optD, [getFuzzyHeader(h, 'correctoption')]: correct, [getFuzzyHeader(h, 'explanation')]: explanation, [getFuzzyHeader(h, 'status')]: status || 'Active', [getFuzzyHeader(h, 'level')]: level || 'Medium' });
      await rowToUpdate.save(); refreshCache(); res.json({ success: true, message: "Aptitude question updated successfully!" });
    } else { res.status(404).json({ success: false, message: "Question ID not found." }); }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteAptQuestion = async (req, res) => {
  try {
    const { id } = req.body;
    const sheet = doc.sheetsByTitle["Aptitude_Questions"];
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    const rows = await sheet.getRows();
    const h = sheet.headerValues;
    const idHeader = getFuzzyHeader(h, 'qid');
    const rowToDelete = rows.find(r => (r.get(idHeader) || '').toString().trim() === id.toString().trim());
    
    if (rowToDelete) { await rowToDelete.delete(); refreshCache(); res.json({ success: true, message: "Question deleted" }); } 
    else { res.status(404).json({ success: false, message: "Question not found" }); }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getTalExamQuestions = (req, res) => {
  try {
    let questions = getCache().talQuestions.map(row => {
      return { id: getValByHeader(row, ['questionid']) || '', testNumber: getValByHeader(row, ['textnumber', 'testnumber']) || '', question: getValByHeader(row, ['question']) || '', optA: getValByHeader(row, ['optiona']) || '', optB: getValByHeader(row, ['optionb']) || '', optC: getValByHeader(row, ['optionc']) || '', optD: getValByHeader(row, ['optiond']) || '', correct: getValByHeader(row, ['correctoption']) || '', explanation: getValByHeader(row, ['explanation']) || '', status: getValByHeader(row, ['status']) || 'Active' };
    });
    res.json({ success: true, questions: questions.reverse() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getTalExamResults = (req, res) => {
  try {
    const user = req.portalUser;
    let results = (getCache().talResults || []).map(row => {
      return { timestamp: getValByHeader(row, ['timestamp']) || '', rollNo: getValByHeader(row, ['rollno']) || '', name: getValByHeader(row, ['name']) || '', email: getValByHeader(row, ['mailid', 'email']) || '', branch: getValByHeader(row, ['branch']) || '', testNumber: getValByHeader(row, ['testnumbercompleted']) || '', score: getValByHeader(row, ['score']) || '', total: getValByHeader(row, ['totalquestions']) || '', percentage: getValByHeader(row, ['percentage']) || '', timeTaken: getValByHeader(row, ['timetaken']) || '' };
    }).filter(result => isLearningAdmin(user) || userHasBranch(user, result.branch));
    res.json({ success: true, results: results.reverse() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addTalExamQuestion = async (req, res) => {
  try {
    const { id, testNumber, question, optA, optB, optC, optD, correct, explanation, status } = req.body;
    const sheet = doc.sheetsByTitle["Talentino_Questions"];
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    const h = sheet.headerValues;
    await sheet.addRow({ [getFuzzyHeader(h, 'questionid')]: id, [getFuzzyHeader(h, 'testnumber')]: testNumber, [getFuzzyHeader(h, 'question')]: question, [getFuzzyHeader(h, 'optiona')]: optA, [getFuzzyHeader(h, 'optionb')]: optB, [getFuzzyHeader(h, 'optionc')]: optC, [getFuzzyHeader(h, 'optiond')]: optD, [getFuzzyHeader(h, 'correctoption')]: correct, [getFuzzyHeader(h, 'explanation')]: explanation, [getFuzzyHeader(h, 'status')]: status || 'Active' });
    refreshCache(); res.json({ success: true, message: "Question added" });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateTalExamQuestion = async (req, res) => {
  try {
    const { id, testNumber, question, optA, optB, optC, optD, correct, explanation, status } = req.body;
    const sheet = doc.sheetsByTitle["Talentino_Questions"];
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    const rows = await sheet.getRows();
    const h = sheet.headerValues;
    const idHeader = getFuzzyHeader(h, 'questionid');
    const rowToUpdate = rows.find(r => (r.get(idHeader) || '').toString().trim() === id.toString().trim());
    
    if (rowToUpdate) {
      rowToUpdate.assign({ [getFuzzyHeader(h, 'questionid')]: id, [getFuzzyHeader(h, 'testnumber')]: testNumber, [getFuzzyHeader(h, 'question')]: question, [getFuzzyHeader(h, 'optiona')]: optA, [getFuzzyHeader(h, 'optionb')]: optB, [getFuzzyHeader(h, 'optionc')]: optC, [getFuzzyHeader(h, 'optiond')]: optD, [getFuzzyHeader(h, 'correctoption')]: correct, [getFuzzyHeader(h, 'explanation')]: explanation, [getFuzzyHeader(h, 'status')]: status || 'Active' });
      await rowToUpdate.save(); refreshCache(); res.json({ success: true, message: "Talentino question updated successfully!" });
    } else { res.status(404).json({ success: false, message: "Question ID not found." }); }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteTalExamQuestion = async (req, res) => {
  try {
    const { id } = req.body;
    const sheet = doc.sheetsByTitle["Talentino_Questions"];
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    const rows = await sheet.getRows();
    const h = sheet.headerValues;
    const idHeader = getFuzzyHeader(h, 'questionid');
    const rowToDelete = rows.find(r => (r.get(idHeader) || '').toString().trim() === id.toString().trim());
    
    if (rowToDelete) { await rowToDelete.delete(); refreshCache(); res.json({ success: true, message: "Question deleted" }); } 
    else { res.status(404).json({ success: false, message: "Question not found" }); }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getDrives = async (req, res) => {
  try {
    const user = req.portalUser;
    const role = String(user?.role || '').toUpperCase();
    const canSeeAll = canManageEveryDrive(user);
    const isBranchManager = isBranchManagerUser(user);
    const isTpo = role.includes('TPO') || role.includes('PLACEMENT OFFICER');
    if (!canSeeAll && !isTpo && !isBranchManager) return res.status(403).json({ success: false, message: 'Placement drive tracking is not available for this role.' });

    await loadDocInfo();
    const registrationSheet = doc.sheetsByTitle['Drive_Registration'] || doc.sheetsByIndex.find(item => item.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('driveregistration'));
    if (!registrationSheet) return res.status(503).json({ success: false, message: 'The Drive Registration sheet is unavailable.' });
    const registrationRows = await registrationSheet.getRows();
    const signedInName = normalizePlacementText(user?.name);
    const cache = getCache() || {};
    const eventRows = Array.isArray(cache.events) && cache.events.length
      ? cache.events
      : await (doc.sheetsByTitle['Event'] || doc.sheetsByIndex.find(item => item.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('event')))?.getRows() || [];
    const eventsMap = new Map();
    
    // 1. SMART EVENT MAPPING: Grab ALL Placement Drives so even empty ones exist
    eventRows.forEach(row => {
       const type = getValByHeader(row, ['event', 'type', 'event_type']) || '';
       const dId = getValByHeader(row, ['driveid', 'drive id', 'drive_id', 'drivename', 'drive name']) || getValByHeader(row, ['event_id', 'eventid', 'id', 'title']) || '';
       
       if (dId && type.toLowerCase().includes('drive')) {
         eventsMap.set(normalizePlacementText(dId), {
           driveId: dId.trim(),
           tpo: getValByHeader(row, ['tpo', 'tponame', 'placementofficer', 'createdby']) || '',
           date: getValByHeader(row, ['dateoftheevent', 'date']) || '', 
           location: getValByHeader(row, ['eventhappeningin', 'location']) || '',
           branch: getValByHeader(row, ['branch', 'sittingbranch']) || '',
           course: getValByHeader(row, ['course', 'assignedcourse']) || '',
           hasApplicants: false
         });
       }
    });

    // 2. Map actual registrations
    const drivesData = [];
    (registrationRows || []).forEach(row => {
      const dId = getValByHeader(row, ['driveid', 'drive id', 'drive_id', 'drivename', 'drive name']) || getValByHeader(row, ['eventid', 'event_id', 'companyname']) || '';
      const eventInfo = eventsMap.get(normalizePlacementText(dId)) || {};
      const studentName = getValByHeader(row, ['name', 'studentname']);
      const studentRoll = normalizePlacementText(getValByHeader(row, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']));
      const registrationStudent = (cache.students || []).find(student => {
        const sourceRoll = normalizePlacementText(getValByHeader(student, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']));
        const sourceName = normalizePlacementText(getValByHeader(student, ['name', 'studentname']));
        return (studentRoll && sourceRoll === studentRoll) || (studentName && sourceName === normalizePlacementText(studentName));
      });
      const registrationOwner = getValByHeader(row, ['placementofficer', 'tponame', 'createdby', 'tpo']);
      const driveOwner = registrationOwner || eventInfo.tpo || '';
      const rowBranch = getValByHeader(row, ['branch', 'sittingbranch']) || (registrationStudent && getValByHeader(registrationStudent, ['branch', 'sittingbranch'])) || eventInfo.branch || eventInfo.location;
      const rowCourse = getValByHeader(row, ['course']) || (registrationStudent && getValByHeader(registrationStudent, ['course', 'program'])) || eventInfo.course;
      if (isBranchManager && !hasAccess(rowBranch, rowCourse, user.role, user.assignedBranchesArray, user.assignedCourse, user.department)) return;
      if (!canSeeAll && !isBranchManager && driveOwner && normalizePlacementText(driveOwner) !== signedInName) return;
      if (!canSeeAll && !isBranchManager && !driveOwner) {
        if (!userHasBranch(user, rowBranch)) return;
      }
      
      // Mark that this drive has at least one student
      if (eventInfo.hasApplicants !== undefined) eventInfo.hasApplicants = true;

      drivesData.push({
        rowNumber: row.rowNumber,
        driveId: dId,
        name: studentName || '',
        roll: getValByHeader(row, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']) || '',
        phone: getValByHeader(row, ['contact', 'phone']) || '',
        email: getValByHeader(row, ['mailid', 'email']) || '',
        course: rowCourse || '',
        branch: rowBranch || '',
        resume: getValByHeader(row, ['resume']) || '',
        qual: getValByHeader(row, ['qualification']) || '',
        regStatus: getValByHeader(row, ['status']) || '',
        regDate: getValByHeader(row, ['registeddate', 'timestamp', 'date']) || '',
        studentStatus: getValByHeader(row, ['studentstatus']) || '',
        remarks: getValByHeader(row, ['studentremarks', 'remarks', 'remark', 'tpo remarks']) || '',
        driveTpo: driveOwner,
        driveDate: eventInfo.date || getValByHeader(row, ['dateofthedrive', 'drivedate', 'eventdate']) || '',
        driveLocation: eventInfo.location || getValByHeader(row, ['drivelocation', 'eventhappeningin', 'location']) || eventInfo.branch || ''
      });
    });

    // 3. 🚨 INJECT EMPTY DRIVES: If a drive has 0 students, send a "Dummy" row so it still shows up!
    eventsMap.forEach((eventInfo, dId) => {
      if (isBranchManager && !userHasBranch(user, eventInfo.branch || eventInfo.location)) return;
      if (!canSeeAll && !isBranchManager && eventInfo.tpo && normalizePlacementText(eventInfo.tpo) !== signedInName) return;
      if (!canSeeAll && !isBranchManager && !eventInfo.tpo) {
        if (!userHasBranch(user, eventInfo.branch || eventInfo.location)) return;
      }
      if (!eventInfo.hasApplicants) {
        drivesData.push({
          rowNumber: `empty-${dId}`,
          driveId: eventInfo.driveId || dId,
          name: 'NO_APPLICANTS',
          driveTpo: eventInfo.tpo,
          driveDate: eventInfo.date,
          driveLocation: eventInfo.location || eventInfo.branch
        });
      }
    });
    
    res.json({ success: true, drives: drivesData.reverse() });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

exports.updateDriveStatus = async (req, res) => {
  const { rowNumber, studentStatus, remarks } = req.body;
  try {
    const numericRow = Number(rowNumber);
    if (!Number.isInteger(numericRow) || numericRow < 2) return res.status(400).json({ success: false, message: 'A valid registration row is required.' });
    await loadDocInfo();
    const sheet = doc.sheetsByTitle['Drive_Registration'] || doc.sheetsByIndex.find(item => item.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('driveregistration'));
    if (!sheet) return res.status(503).json({ success: false, message: 'The Drive Registration sheet is unavailable.' });
    const rows = await sheet.getRows({ offset: numericRow - 2, limit: 1 });
    if (!rows.length) return res.status(404).json({ success: false, message: 'Registration row was not found.' });

    const user = req.portalUser;
    const role = String(user?.role || '').toUpperCase();
    const canSeeAll = canManageEveryDrive(user);
    const isBranchManager = isBranchManagerUser(user);
    const isTpo = role.includes('TPO') || role.includes('PLACEMENT OFFICER');
    if (!canSeeAll && !isTpo && !isBranchManager) return res.status(403).json({ success: false, message: 'Placement drive tracking is not available for this role.' });
    if (isBranchManager) {
      const driveId = normalizePlacementText(getValByHeader(rows[0], ['driveid', 'drive id', 'drive_id', 'drivename', 'drive name']) || getValByHeader(rows[0], ['eventid', 'event_id', 'companyname']));
      const matchingDrive = (getCache()?.events || []).find(event => {
        const type = getValByHeader(event, ['event', 'type', 'event_type']).toLowerCase();
        const eventDriveId = normalizePlacementText(getValByHeader(event, ['driveid', 'drive id', 'drive_id', 'drivename', 'drive name']) || getValByHeader(event, ['event_id', 'eventid', 'id', 'title']));
        return type.includes('drive') && eventDriveId === driveId;
      });
      const studentName = getValByHeader(rows[0], ['name', 'studentname']);
      const studentRoll = normalizePlacementText(getValByHeader(rows[0], ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']));
      const registrationStudent = (getCache()?.students || []).find(student => {
        const sourceRoll = normalizePlacementText(getValByHeader(student, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']));
        const sourceName = normalizePlacementText(getValByHeader(student, ['name', 'studentname']));
        return (studentRoll && sourceRoll === studentRoll) || (studentName && sourceName === normalizePlacementText(studentName));
      });
      const registrationBranch = getValByHeader(rows[0], ['branch', 'sittingbranch']) || (registrationStudent && getValByHeader(registrationStudent, ['branch', 'sittingbranch'])) || getValByHeader(matchingDrive, ['branch', 'sittingbranch', 'eventhappeningin', 'location']);
      const registrationCourse = getValByHeader(rows[0], ['course']) || (registrationStudent && getValByHeader(registrationStudent, ['course', 'program'])) || getValByHeader(matchingDrive, ['course', 'assignedcourse']);
      if (!hasAccess(registrationBranch, registrationCourse, user.role, user.assignedBranchesArray, user.assignedCourse, user.department)) {
        return res.status(403).json({ success: false, message: 'This registration is outside your assigned branch or course.' });
      }
    } else if (!canSeeAll) {
      const driveId = normalizePlacementText(getValByHeader(rows[0], ['driveid', 'drive id', 'drive_id', 'drivename', 'drive name']) || getValByHeader(rows[0], ['eventid', 'event_id', 'companyname']));
      const registrationOwner = getValByHeader(rows[0], ['placementofficer', 'tponame', 'createdby', 'tpo']);
      if (registrationOwner && normalizePlacementText(registrationOwner) !== normalizePlacementText(user?.name)) {
        return res.status(403).json({ success: false, message: 'You can only update registrations for your own placement drives.' });
      }
      const matchingDrive = (getCache()?.events || []).find(event => {
        const type = getValByHeader(event, ['event', 'type', 'event_type']).toLowerCase();
        const eventDriveId = normalizePlacementText(getValByHeader(event, ['driveid', 'drive id', 'drive_id', 'drivename', 'drive name']) || getValByHeader(event, ['event_id', 'eventid', 'id', 'title']));
        return type.includes('drive') && eventDriveId === driveId;
      });
      const driveOwner = getValByHeader(matchingDrive, ['tpo', 'tponame', 'placementofficer', 'createdby']);
      if (!registrationOwner && driveOwner && normalizePlacementText(driveOwner) !== normalizePlacementText(user?.name)) {
        return res.status(403).json({ success: false, message: 'You can only update registrations for your own placement drives.' });
      }
      if (!registrationOwner && !driveOwner) {
        const registrationBranch = getValByHeader(rows[0], ['branch', 'sittingbranch']);
        const eventBranch = getValByHeader(matchingDrive, ['branch', 'sittingbranch', 'eventhappeningin', 'location']);
        if (!userHasBranch(user, registrationBranch || eventBranch)) {
          return res.status(403).json({ success: false, message: 'You can only update registrations for placement drives assigned to your branch.' });
        }
      }
    }

    let headers = sheet.headerValues || [];
    const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const findHeader = aliases => {
      for (const alias of aliases) {
        const header = headers.find(item => normalize(item) === normalize(alias));
        if (header) return header;
      }
      for (const alias of aliases) {
        const key = normalize(alias);
        const header = headers.find(item => key.length >= 6 && normalize(item).includes(key));
        if (header) return header;
      }
      return null;
    };
    const update = {};
    if (studentStatus !== undefined) {
      let statusHeader = findHeader(['studentstatus', 'student status']);
      if (!statusHeader) {
        statusHeader = 'Student Status';
        await sheet.setHeaderRow([...headers, statusHeader]);
        headers = [...headers, statusHeader];
      }
      update[statusHeader] = studentStatus;
    }
    if (remarks !== undefined) {
      let remarksHeader = findHeader(['studentremarks', 'tpo remarks', 'remarks', 'remark']);
      if (!remarksHeader) {
        remarksHeader = 'Student Remarks';
        await sheet.setHeaderRow([...headers, remarksHeader]);
        headers = [...headers, remarksHeader];
      }
      update[remarksHeader] = remarks;
    }
    if (!Object.keys(update).length) return res.status(400).json({ success: false, message: 'There are no placement drive changes to save.' });

    rows[0].assign(update);
    await rows[0].save();
    refreshCache();
    res.json({ success: true, studentStatus: studentStatus ?? getValByHeader(rows[0], ['studentstatus']), remarks: remarks ?? getValByHeader(rows[0], ['studentremarks', 'remarks', 'remark']) });
  } catch(err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getBranches = (req, res) => {
  try {
    const cache = getCache();
    if (!cache || !cache.branches) return res.json({ success: true, branches: [] });

    const branches = cache.branches.map((row, index) => {
      let branchName = '';
      let regionName = '';
      
      if (typeof row.get === 'function') {
        branchName = row.get('Branch');
        regionName = row.get('Region / State') || row.get('Region');
      } else if (row._rawData && row._rawData.length > 2) {
        branchName = row._rawData[2];
        regionName = row._rawData[1];
      }
      
      return { 
        no: index + 1, 
        region: regionName || '', 
        branch: branchName || '',
        latitude: typeof row.get === 'function' ? (row.get('Latitude') || row.get('Lat') || '') : '',
        longitude: typeof row.get === 'function' ? (row.get('Longitude') || row.get('Lng') || row.get('Lon') || '') : ''
      };
    }).filter(b => b.branch !== '');

    if (branches.length === 0) {
      const fallbackList = [
        "Trivandrum", "Attingal", "Kollam", "Calicut", "Kannur", "Perinthalmanna", 
        "Palakkad", "Kochi", "Kottayam", "Thrissur", "Coimbatore", "Trichy", 
        "Salem", "Madurai", "Tirunelveli", "Tambaram", "Anna Nagar", "Chennai", 
        "Bangalore", "Mysore", "Mangalore", "Pune", "Mumbai", "Ramwadi", 
        "Nagpur", "Kolkata", "Bhopal", "Ranchi", "Global", "Bhubaneswar"
      ];
      fallbackList.forEach((b, i) => branches.push({ no: i + 1, region: 'System', branch: b }));
    }

    res.json({ success: true, branches });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

exports.addBranch = async (req, res) => {
  try {
    const { no, region, branch, latitude, longitude } = req.body;
    if (latitude !== '' && latitude !== undefined && (!Number.isFinite(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90)) return res.status(400).json({ success: false, message: 'Latitude must be between -90 and 90.' });
    if (longitude !== '' && longitude !== undefined && (!Number.isFinite(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180)) return res.status(400).json({ success: false, message: 'Longitude must be between -180 and 180.' });
    const sheet = doc.sheetsByTitle["Branches"];
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    await sheet.loadHeaderRow();
    let headers = sheet.headerValues || [];
    const normalized = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const find = names => headers.find(header => names.includes(normalized(header)));
    if (!find(['latitude', 'lat']) || !find(['longitude', 'long', 'lng', 'lon'])) {
      headers = [...headers];
      if (!find(['latitude', 'lat'])) headers.push('Latitude');
      if (!find(['longitude', 'long', 'lng', 'lon'])) headers.push('Longitude');
      await sheet.setHeaderRow(headers);
    }
    const header = names => headers.find(value => names.includes(normalized(value)));
    const newRow = {
      [header(['no', 'number', 'index']) || headers[0]]: no,
      [header(['regionstate', 'region', 'state']) || headers[1]]: region,
      [header(['branch', 'branchname', 'branchlocation']) || headers[2]]: branch,
      [header(['latitude', 'lat'])]: latitude || '',
      [header(['longitude', 'long', 'lng', 'lon'])]: longitude || ''
    };
    await sheet.addRow(newRow);
    refreshCache(); res.json({ success: true, message: "Branch saved" });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateBranch = async (req, res) => {
  try {
    const { oldBranch, no, region, branch, latitude, longitude } = req.body;
    if (latitude !== '' && latitude !== undefined && (!Number.isFinite(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90)) return res.status(400).json({ success: false, message: 'Latitude must be between -90 and 90.' });
    if (longitude !== '' && longitude !== undefined && (!Number.isFinite(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180)) return res.status(400).json({ success: false, message: 'Longitude must be between -180 and 180.' });
    const sheet = doc.sheetsByTitle["Branches"];
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    await sheet.loadHeaderRow();
    let headers = sheet.headerValues || [];
    const normalized = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const find = names => headers.find(header => names.includes(normalized(header)));
    if (!find(['latitude', 'lat']) || !find(['longitude', 'long', 'lng', 'lon'])) {
      headers = [...headers];
      if (!find(['latitude', 'lat'])) headers.push('Latitude');
      if (!find(['longitude', 'long', 'lng', 'lon'])) headers.push('Longitude');
      await sheet.setHeaderRow(headers);
    }
    const header = names => headers.find(value => names.includes(normalized(value)));
    const rows = await sheet.getRows();
    const branchHeader = header(['branch', 'branchname', 'branchlocation']) || headers[2];
    const rowToUpdate = rows.find(r => String(r.get(branchHeader) || '').trim() === String(oldBranch || '').trim());
    if (rowToUpdate) {
      rowToUpdate.set(header(['no', 'number', 'index']) || headers[0], no);
      rowToUpdate.set(header(['regionstate', 'region', 'state']) || headers[1], region);
      rowToUpdate.set(branchHeader, branch);
      rowToUpdate.set(header(['latitude', 'lat']), latitude || '');
      rowToUpdate.set(header(['longitude', 'long', 'lng', 'lon']), longitude || '');
      await rowToUpdate.save(); refreshCache(); res.json({ success: true, message: "Branch updated" });
    } else { res.status(404).json({ success: false, message: "Branch not found" }); }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteBranch = async (req, res) => {
  try {
    const { branch } = req.body;
    const sheet = doc.sheetsByTitle["Branches"];
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    const rows = await sheet.getRows();
    const rowToDelete = rows.find(r => r._rawData[2] === branch);
    if (rowToDelete) { await rowToDelete.delete(); refreshCache(); res.json({ success: true, message: "Branch deleted" }); } 
    else { res.status(404).json({ success: false, message: "Branch not found" }); }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// =========================================================
// 🚨 TRAINER / TL DAILY LOGS
// =========================================================
exports.getTrainerLogs = (req, res) => {
  try {
    const cache = getCache();
    if (!cache || !cache.trainerLogs) return res.json({ success: true, logs: [] });
    
    let logs = cache.trainerLogs.map(row => {
      return {
        rowNumber: row.rowNumber,
        timestamp: getValByHeader(row, ['timestamp']) || '',
        branch: getValByHeader(row, ['branch']) || '',
        trainerName: getValByHeader(row, ['trainername', 'name']) || '',
        course: getValByHeader(row, ['course']) || '',
        studentCount: getValByHeader(row, ['studentcount']) || '',
        present: getValByHeader(row, ['present', 'currentlypresentinlab']) || '',
        absentees: getValByHeader(row, ['absentees', 'absent']) || '',
        feedbacks: getValByHeader(row, ['feedbacks', 'anyfeedbacks']) || '',
        resignations: getValByHeader(row, ['staffresignations']) || '',
        vacancy: getValByHeader(row, ['trainervacancy']) || '',
        tuv: getValByHeader(row, ['tuvregistration']) || '',
        mockTest: getValByHeader(row, ['mocktestconducted']) || ''
      };
    });
    res.json({ success: true, logs: logs.reverse() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addTrainerLog = async (req, res) => {
  try {
    const { branch, trainerName, course, studentCount, present, absentees, feedbacks } = req.body;
    const sheet = doc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('trainer'));
    if (!sheet) return res.status(404).json({ success: false, message: "Trainer Log sheet missing." });
    const h = sheet.headerValues;
    
    await sheet.addRow({
      [getFuzzyHeader(h, 'timestamp')]: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      [getFuzzyHeader(h, 'branch')]: branch,
      [getFuzzyHeader(h, 'trainername')]: trainerName,
      [getFuzzyHeader(h, 'course')]: course,
      [getFuzzyHeader(h, 'studentcount')]: studentCount,
      [getFuzzyHeader(h, 'currentlypresentinlab')]: present,
      [getFuzzyHeader(h, 'absentees')]: absentees,
      [getFuzzyHeader(h, 'anyfeedbacks')]: feedbacks
    });
    
    refreshCache(); 
    res.json({ success: true, message: "Daily log submitted!" });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateTrainerLog = async (req, res) => {
  const { rowNumber, resignations, vacancy, tuv, mockTest } = req.body;
  try {
    const sheet = doc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('trainer'));
    const rows = await sheet.getRows({ offset: parseInt(rowNumber) - 2, limit: 1 });
    if (rows.length > 0) {
      const h = sheet.headerValues;
      rows[0].assign({
        [getFuzzyHeader(h, 'staffresignations')]: resignations,
        [getFuzzyHeader(h, 'trainervacancy')]: vacancy,
        [getFuzzyHeader(h, 'tuvregistration')]: tuv,
        [getFuzzyHeader(h, 'mocktestconducted')]: mockTest
      });
      await rows[0].save();
      refreshCache();
      res.json({ success: true, message: "TL details updated!" });
    } else {
      res.status(404).json({ success: false, message: "Record not found." });
    }
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// =========================================================
// 🚨 SECURITY ACTIVITY LOGS (SUPER ADMIN ONLY)
// =========================================================
exports.getSecurityLogs = (req, res) => {
  try {
    const cache = getCache();
    if (!cache || !cache.securityLogs) return res.json({ success: true, logs: [] });

    let logs = cache.securityLogs.map(row => {
      return {
        rowNumber: row.rowNumber,
        timestamp: getValByHeader(row, ['timestamp']) || '',
        userName: getValByHeader(row, ['username', 'name']) || '',
        email: getValByHeader(row, ['email', 'mailid']) || '',
        role: getValByHeader(row, ['role']) || '',
        branch: getValByHeader(row, ['branch']) || '',
        ipAddress: getValByHeader(row, ['ipaddress', 'ip']) || '',
        device: getValByHeader(row, ['device']) || 'Desktop',
        os: getValByHeader(row, ['os']) || '',
        browser: getValByHeader(row, ['browser']) || '',
        status: getValByHeader(row, ['status']) || 'Active'
      };
    });

    res.json({ success: true, logs: logs.filter(l => l.email !== '').reverse() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.verifySession = (req, res) => {
  const { email, sessionToken } = req.body;
  if (!email || !sessionToken) {
    return res.json({ valid: false, reason: 'MISSING_PAYLOAD' });
  }

  const cleanEmail = email.toString().trim().toLowerCase();
  const currentActiveToken = activeSessions.get(cleanEmail);

  if (!currentActiveToken) {
    return res.json({ valid: false, reason: 'SESSION_EXPIRED', message: 'Your session expired. Please sign in again.' });
  }

  if (currentActiveToken !== sessionToken) {
    return res.json({ 
      valid: false, 
      reason: 'CONCURRENT_LOGIN', 
      message: 'Your account was logged in from another device or window.' 
    });
  }

  return res.json({ valid: true });
};

exports.getSessionUser = (email, sessionToken) => {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !sessionToken || activeSessions.get(cleanEmail) !== sessionToken) return null;
  return activeAccounts.get(cleanEmail) || null;
};

// =========================================================
// 🚨 SUBMIT TPO ACTIVITY STATS
// =========================================================
exports.updateTpoActivity = async (req, res) => {
  const { tpoName, companiesVisited, branchVideos, branchPosters } = req.body;
  try {
    await syncTpoStats(tpoName, {
      'Companies Visited': companiesVisited,
      'Branch Videos': branchVideos,
      'Branch Posters': branchPosters
    });
    refreshCache();
    res.json({ success: true, message: "Activity stats updated successfully!" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// =========================================================
// 🚨 ADD NEW CLIENT / HIRING PARTNER
// =========================================================
exports.addClient = async (req, res) => {
  try {
    const { companyName, website, location, phone, email, contactPerson } = req.body;
    const tpoName = req.portalUser?.name || '';
    if (!String(companyName || '').trim()) return res.status(400).json({ success: false, message: 'Company name is required.' });
    if (!tpoName) return res.status(401).json({ success: false, message: 'Your session could not be verified. Sign in again and retry.' });
    await loadDocInfo();
    const clientSheet = doc.sheetsByTitle["Clients"];
    if (!clientSheet) return res.status(503).json({ success: false, message: 'Client register is unavailable.' });
    
    let logoUrl = '';
    if (req.file) {
      logoUrl = await uploadToDrive(req.file, FOLDER_CLIENT_LOGOS);
    }

    const headers = clientSheet.headerValues || [];
    const normalizeHeader = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const resolveHeader = aliases => {
      const normalizedAliases = aliases.map(normalizeHeader);
      const exact = headers.find(header => normalizedAliases.includes(normalizeHeader(header)));
      if (exact) return exact;
      return headers.find(header => normalizedAliases.some(alias => alias.length >= 6 && normalizeHeader(header).includes(alias))) || null;
    };
    const ownerHeader = resolveHeader(['placementofficer', 'tponame', 'assignedtpo']);
    const companyHeader = resolveHeader(['companyname', 'company']);
    if (!ownerHeader || !companyHeader) {
      return res.status(500).json({ success: false, message: 'The Clients sheet needs Placement Officer/TPO and Company Name columns before a client can be added.' });
    }

    const values = [
      [['placementofficer', 'tponame', 'assignedtpo'], tpoName],
      [['companyname', 'company'], String(companyName).trim()],
      [['companywebsite', 'website'], website || ''],
      [['companylocation', 'location'], location || ''],
      [['companycontact', 'contactnumber', 'phone'], phone || ''],
      [['companymailid', 'companyemail', 'mailid', 'email'], email || ''],
      [['companycontactperson', 'contactperson', 'person'], contactPerson || ''],
      [['companylogo', 'logo'], logoUrl],
      [['mailstatus'], 'Pending'],
      [['documentstatus', 'docstatus'], 'Pending'],
      [['mou', 'moulink'], '']
    ];
    const rowData = {};
    for (const [aliases, value] of values) {
      const header = resolveHeader(aliases);
      if (header) rowData[header] = value;
    }

    const addedRow = await clientSheet.addRow(rowData);

    refreshCache();
    res.json({ success: true, message: "Client added successfully", client: {
      rowNumber: addedRow.rowNumber,
      companyName: String(companyName).trim(), website: website || '', location: location || '', contact: phone || '',
      email: email || '', contactPerson: contactPerson || '', logo: logoUrl, mailStatus: 'Pending', documentStatus: 'Pending',
      mouLink: '', tpoName
    } });
  } catch (error) {
    console.error("Add Client Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};
