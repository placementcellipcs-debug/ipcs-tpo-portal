// 🚨 IN-MEMORY MULTI-DEVICE SESSION REGISTRY
const activeSessions = new Map();

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
  doc, getCache, refreshCache, hasAccess, getFuzzyHeader, 
  sendIPCSMail, uploadToDrive
} = require('./config');

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
    
    // Reads from the raw array, skipping the broken google-spreadsheet row.get() bug
    if (index !== -1 && index < row._rawData.length && row._rawData[index] !== undefined && row._rawData[index] !== null) {
      return row._rawData[index].toString().trim();
    }
  }
  return '';
};

const normalizeBranch = (branch) => (branch || '').toLowerCase().replace(/branch/g, '').trim();

// =========================================================
// 🚨 EXACT CROSS-SHEET EMAIL LOOKUP FUNCTIONS
// =========================================================
const getTpoEmailByName = (tpoName) => {
  const cache = getCache();
  if (!cache || !cache.contacts) return '';
  // 🚨 FIX: Remove all spaces from the search name to prevent "Pranav V S" vs "Pranav VS" failures
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
    
    if (rawRole === 'branchmanager' && (br1.includes(searchBranch) || br2.includes(searchBranch) || searchBranch === 'all')) {
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
    return role === 'branchmanager';
  }).map(r => getValByHeader(r, ['mailid', 'email'])).filter(Boolean);
};

const getSuperAdminEmails = () => {
  const cache = getCache();
  if (!cache || !cache.users) return [];
  return cache.users.filter(r => {
    const role = getValByHeader(r, ['role']).toLowerCase();
    const access = getValByHeader(r, ['access']).toLowerCase();
    return access.includes('admin') || role.includes('general manager') || role.includes('technical head') || role.includes('zonal');
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
  }
};

// ---------------------------------------------------------
// 🚨 MASTER STUDENT EMAIL ENGINE
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

  let ccArray = [];

  if (status === 'interview scheduled') {
    ccArray = [scheduledTpoEmail, assignedTpoEmail];
  } else if (status === 'interview not attended' || status.includes('student rejected') || status.includes('offer rejected')) {
    if ((status === 'interview not attended' && noAttendCount >= 3) || 
        ((status.includes('student rejected') || status.includes('offer rejected')) && rejectCount >= 3)) {
      ccArray = [scheduledTpoEmail, assignedTpoEmail, 'gifty@ipcsglobal.com', bmEmail];
    } else {
      ccArray = [assignedTpoEmail];
    }
  } else {
    ccArray = [currentUserEmail, assignedTpoEmail];
  }

  const ccList = [...new Set(ccArray)].filter(Boolean).join(',');

  let subject = ''; let html = ''; let mailType = '';
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
        <div style="background-color: #0f1523; padding: 35px 20px; text-align: center; border-bottom: 5px solid #38bdf8;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px; text-transform: uppercase;">Interview Invitation</h1>
          <p style="color: #94a3b8; margin: 10px 0 0 0; font-size: 14px;">IPCS Global Placement Cell</p>
        </div>
        <div style="padding: 40px 35px;">
          <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 22px;">Congratulations, ${studentData.name}!</h2>
          <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 30px 0;">
            We are thrilled to inform you that you have been <strong style="color: #0f1523;">selected for an interview</strong> with one of our esteemed partner companies.
          </p>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 5px solid #38bdf8; border-radius: 8px; padding: 25px; margin-bottom: 30px;">
            <h3 style="margin: 0 0 15px 0; color: #0f1523; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;">Event Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tbody>
                <tr><td style="padding: 10px 0; color: #64748b; font-size: 14px; font-weight: 600; width: 35%; border-bottom: 1px solid #e2e8f0;">Company:</td><td style="padding: 10px 0; color: #0f1523; font-size: 16px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${studentData.company}</td></tr>
                <tr><td style="padding: 10px 0; color: #64748b; font-size: 14px; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Position:</td><td style="padding: 10px 0; color: #0f1523; font-size: 15px; border-bottom: 1px solid #e2e8f0;">${studentData.position || 'Professional'}</td></tr>
                <tr><td style="padding: 10px 0; color: #64748b; font-size: 14px; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Date:</td><td style="padding: 10px 0; color: #0f1523; font-size: 15px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${interviewDetails.date || 'TBD'}</td></tr>
                <tr><td style="padding: 10px 0; color: #64748b; font-size: 14px; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Time:</td><td style="padding: 10px 0; color: #0f1523; font-size: 15px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${interviewDetails.time || 'TBD'}</td></tr>
                <tr><td style="padding: 10px 0; color: #64748b; font-size: 14px; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Venue / Link:</td><td style="padding: 10px 0; color: #38bdf8; font-size: 15px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${interviewDetails.venue || 'TBD'}</td></tr>
                <tr><td style="padding: 10px 0; color: #64748b; font-size: 13px; font-weight: 600;">Newsletter ID:</td><td style="padding: 10px 0; color: #64748b; font-size: 13px;">${studentData.jobId || 'N/A'}</td></tr>
              </tbody>
            </table>
          </div>
          <h3 style="margin: 0 0 10px 0; color: #1e293b; font-size: 16px;">Agenda & Expectations</h3>
          <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 25px 0; padding: 18px; background-color: rgba(56, 189, 248, 0.05); border-radius: 8px; font-style: italic; border: 1px solid rgba(56, 189, 248, 0.2);">
            "The interview may consist of multiple rounds, including technical assessments, behavioral interviews, or HR rounds."
          </p>
          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 4px; margin-bottom: 30px;">
            <p style="font-size: 13px; line-height: 1.5; color: #991b1b; margin: 0;">
              <strong>Important Note:</strong> Please make sure to arrive on time for the interview or log in to the online meeting platform a few minutes before the scheduled time.
            </p>
          </div>
          <div style="border-top: 1px solid #e2e8f0; padding-top: 25px;">
            <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 15px 0;">We wish you the very best of luck!</p>
            <p style="font-size: 15px; color: #0f1523; font-weight: bold; margin: 0;">Regards,<br><span style="color: #38bdf8;">IPCS Placement Cell</span></p>
          </div>
        </div>
      </div>
    `;
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
      html: html
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
    
    if (!cache || !cache.contacts || !cache.users) {
       return res.status(503).json({ success: false, message: "System is booting up. Please try again in 5 seconds." });
    }

    const cleanInput = (email || '').toString().trim().toLowerCase();
    const cleanPass = (password || '').toString().trim();
    let foundUser = null; 
    let role = 'TPO'; 
    let course = 'All'; 
    let userName = '';

    for (let row of cache.contacts) {
      const sheetMail = getValByHeader(row, ['mailid', 'email']).toLowerCase();
      const sheetPass = getValByHeader(row, ['password']);
      
      if (sheetMail === cleanInput && sheetPass === cleanPass && cleanInput !== '') {
        foundUser = {
          sittingbranch: getValByHeader(row, ['sittingbranch']),
          assignedbranches: getValByHeader(row, ['assignedbranches']),
          access: getValByHeader(row, ['access']),
          profilephoto: getValByHeader(row, ['profilephoto', 'photo']),
          contactnumber: getValByHeader(row, ['contactnumber', 'contact', 'phoneno'])
        };
        role = 'TPO';
        course = 'All Courses';
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
            sittingbranch: getValByHeader(row, ['sittingbranch']),
            assignedbranches: getValByHeader(row, ['assignedbranches']),
            access: getValByHeader(row, ['access']),
            profilephoto: getValByHeader(row, ['profilephoto', 'photo']),
            contactnumber: getValByHeader(row, ['contactnumber', 'contact', 'phoneno'])
          };
          role = getValByHeader(row, ['role']) || 'RTH';
          course = getValByHeader(row, ['course']) || 'All';
          userName = getValByHeader(row, ['username', 'name']) || 'User';
          break;
        }
      }
    }

    if (!foundUser) {
      return res.status(401).json({ success: false, message: "Invalid Login ID or Password." });
    }

    const assignedRaw = foundUser['assignedbranches'] || foundUser['sittingbranch'] || '';
    let assignedArray = assignedRaw.replace(/[0-9.]/g, '').split(/[\n,]/).map(b => b.trim().toLowerCase()).filter(b => b !== '');
    const upperRole = role.toUpperCase();
    let accessType = 'edit';
    const sheetAccess = (foundUser['access'] || '').toString().toUpperCase();
    
    if (upperRole.includes('ADMIN') || upperRole === 'GENERAL MANAGER' || upperRole === 'TECHNICAL HEAD' || upperRole === 'ZONAL PLACEMENT HEAD' || sheetAccess.includes('SUPER ADMIN')) {
      accessType = 'superadmin';
    } else if (sheetAccess.includes('VIEW ONLY') && !sheetAccess.includes('EDIT')) {
      accessType = 'view';
    } else if (sheetAccess.includes('VIEW & EDIT') || sheetAccess.includes('EDIT')) {
      accessType = 'edit';
    }

    if (accessType === 'superadmin' || upperRole.includes('RTH') || upperRole === 'REGIONAL TECHNICAL HEAD' || assignedArray.length === 0) {
      assignedArray = ['all'];
    }

    const sessionToken = `IPCS_SESS_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    activeSessions.set(cleanInput, sessionToken);

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
          refreshCache();
        }
      } catch (logErr) {}
    })();

    return res.json({ 
      success: true, 
      tpo: { 
        name: userName, 
        email: cleanInput, 
        loginId: cleanInput, 
        sittingBranch: foundUser['sittingbranch'] || 'N/A', 
        assignedBranchesArray: assignedArray, 
        photo: foundUser['profilephoto'] || '', 
        phone: foundUser['contactnumber'] || 'Not Provided', 
        role: role, 
        assignedCourse: course, 
        accessType: accessType,
        sessionToken: sessionToken
      } 
    });
  } catch (error) { 
    res.status(500).json({ success: false, message: error.message }); 
  }
};

exports.getDashboardStats = (req, res) => {
  const { assignedBranchesArray, role, assignedCourse } = req.body;
  const cache = getCache();
  let studentCount = 0, pendingApps = 0, placedCount = 0, activeVacs = 0;

  cache.students.forEach(row => { 
    const branch = getValByHeader(row, ['branch']);
    const course = getValByHeader(row, ['course']);
    if (hasAccess(branch, course, role, assignedBranchesArray, assignedCourse)) studentCount++; 
  });
  
  const logsSource = cache.tpoLogs || [];
  const dedupedLogs = {};
  logsSource.forEach(row => {
    const roll = getValByHeader(row, ['roll', 'rollnumber']);
    const name = getValByHeader(row, ['name', 'studentname']);
    const company = getValByHeader(row, ['company', 'companyname']);
    const key = `${roll || name}_${company}`.toLowerCase();
    dedupedLogs[key] = row;
  });

  Object.values(dedupedLogs).forEach(row => {
    const branch = getValByHeader(row, ['branch']);
    const course = getValByHeader(row, ['course']);
    if (hasAccess(branch, course, role, assignedBranchesArray, assignedCourse)) {
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

  cache.vacancies.forEach(row => {
    const status = getValByHeader(row, ['status']).toLowerCase() || 'open';
    const lastDateStr = getValByHeader(row, ['lastdate']);
    let isExpired = false;

    if (lastDateStr) {
      try {
        let parsedDate;
        if (lastDateStr.includes('/')) {
          const parts = lastDateStr.split(/[/\s,.-]+/);
          if (parts.length >= 3 && parts[2].length === 4) {
            parsedDate = new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
          }
        } else {
          parsedDate = new Date(lastDateStr);
        }
        if (parsedDate && !isNaN(parsedDate)) {
          if (parsedDate < todayStart) isExpired = true;
        }
      } catch(e) {}
    }

    if ((status.includes('open') || status.includes('yes')) && !isExpired) {
      activeVacs++;
    }
  });

  let eventsList = cache.events.slice(-8).map(row => ({ title: getValByHeader(row, ['title']) || 'Event', date: getValByHeader(row, ['date']) || '', time: getValByHeader(row, ['time']) || '', type: getValByHeader(row, ['type', 'event']) || 'Placement Drive', location: getValByHeader(row, ['location', 'eventhappeningin']) || '' }));
  
  res.json({ success: true, stats: { totalStudents: studentCount, pendingApps, placed: placedCount, activeVacancies: activeVacs }, events: eventsList.reverse() });
};

exports.getStudents = (req, res) => {
  const { assignedBranchesArray, role, assignedCourse } = req.body;
  const cache = getCache();
  let students = []; let stats = { total: 0, pending: 0, notResponding: 0, noNeed: 0, branchCounts: {}, courseCounts: {} };

  cache.students.forEach(row => {
    const branch = getValByHeader(row, ['branch']) || 'Unknown';
    const course = getValByHeader(row, ['course']) || 'Unknown';

    if (hasAccess(branch, course, role, assignedBranchesArray, assignedCourse)) {
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
        placementStatus: pStatus
      });
    }
  });
  res.json({ success: true, students: students.reverse(), stats });
};

// 🚨 RULE 7: TRIGGER MAIL IF VACANCY CHANGES TO YES
exports.updateStudent = async (req, res) => {
  const { rowNumber, vacOpen, placementStatus, studyAccess, examAccess, courseStatus, coursePercentage } = req.body;
  try {
    const stuSheet = doc.sheetsByTitle["Data"];
    const rows = await stuSheet.getRows({ offset: rowNumber - 2, limit: 1 });
    if (rows.length > 0) {
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
      if(vH && vacOpen !== undefined) updateObj[vH] = vacOpen;
      
      const pH = getRealHeader(['placementstatus', 'placementstat', 'placementstatsu']); if(pH) updateObj[pH] = placementStatus;
      const sH = getRealHeader(['studymaterialaccess']); if(sH) updateObj[sH] = studyAccess;
      const eH = getRealHeader(['technicalexam', 'technialexam']); if(eH) updateObj[eH] = examAccess;
      
      const cPercH = getRealHeader(['coursepercentage']);
      if (cPercH && coursePercentage !== undefined) updateObj[cPercH] = coursePercentage;

      const cStatusH = getRealHeader(['coursestatus', 'status(currently']); 
      if (cStatusH) {
        if (coursePercentage === '100% completed' || coursePercentage === '100%') {
          updateObj[cStatusH] = 'Completed Course';
        } else if (courseStatus !== undefined) {
          updateObj[cStatusH] = courseStatus;
        }
      }

      rows[0].assign(updateObj); 
      await rows[0].save(); 

      // 🚨 RULE 7: Independent Vacancy Trigger
      if (vacOpen && vacOpen.toString().toLowerCase() === 'yes' && oldVacOpen !== 'yes') {
         let sName = getValByHeader(rows[0], ['name', 'studentname']) || 'Student';
         let sEmail = getValByHeader(rows[0], ['mailid', 'email']);

         if (sEmail) {
            const refId = Math.floor(10000 + Math.random() * 90000); 
            const html = `
              <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #0f1523; padding: 20px; text-align: center; border-bottom: 4px solid #38bdf8;">
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
            sendMailAndLog({ from: `"IPCS Placement Cell" <${process.env.EMAIL_USER}>`, to: sEmail, subject: `Welcome to IPCS Placements! Your Profile is Active [Ref: ${refId}]`, html: html }, { name: sName, email: sEmail, type: 'Course Completion Welcome' });
         }
      }

      refreshCache(); 
      res.json({ success: true, message: "Student record updated!" });
    } else { res.status(404).json({ success: false, message: "Row not found." }); }
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.getApplications = (req, res) => {
  const { assignedBranchesArray, role, assignedCourse, tpoName } = req.body;
  let appsList = []; 
  const cleanTpoName = (tpoName || '').toString().toLowerCase().trim();
  const cache = getCache();
  
  const sourceData = cache.applications || [];

  sourceData.forEach((row) => {
    const branch = getValByHeader(row, ['branch']) || 'Unknown';
    const course = getValByHeader(row, ['course']) || 'Unknown';
    const officerName = (getValByHeader(row, ['placementofficer']) || '').toLowerCase().trim();

    const tpoMatch = (!role || role === 'TPO') && (cleanTpoName !== '' && officerName === cleanTpoName);

    if (hasAccess(branch, course, role, assignedBranchesArray, assignedCourse) || tpoMatch) {
      const roll = getValByHeader(row, ['roll']) || ''; 
      const jobId = getValByHeader(row, ['jobid']) || '';
      let phone = getValByHeader(row, ['contact', 'phone']) || '';
      let email = getValByHeader(row, ['mail', 'email']) || '';
      let resume = getValByHeader(row, ['resume', 'cv']) || '';
      let qual = getValByHeader(row, ['qual']) || '';

      if (!phone || !email) {
        const studentData = cache.students.find(s => {
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
    if (req.file) offerLetterLink = await uploadToDrive(req.file, FOLDER_OFFER_LETTERS);
    
    const appSheet = doc.sheetsByTitle["Opening_Applied"];
    if (!appSheet || isNaN(rowNumber)) return res.status(400).json({ success: false, message: "Invalid payload or sheet missing." });

    const rows = await appSheet.getRows({ offset: rowNumber - 2, limit: 1 });
    
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: "Application record not found in Google Sheets." });
    }
    
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

    const sName = fullApp.name || '';
    const sContact = fullApp.phone || '';
    const sMail = fullApp.email || '';
    const sRoll = fullApp.roll || '';
    const sCourse = fullApp.course || '';
    const sBranch = fullApp.branch || '';
    const sQual = fullApp.qual || '';
    const sResume = fullApp.resume || '';
    const sJobId = fullApp.jobId || '';
    const sCompany = fullApp.company || '';
    const sPosition = fullApp.position || '';
    const sTpo = fullApp.tpoName || '';

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
    if (hVenue && interviewVenue !== undefined) updateObj[hVenue] = interviewVenue;

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

        await logSheet.addRow(logObj);
      }
    } catch(e) {}
    
    if (oldStatus !== (status || '').toLowerCase()) {
       checkAndSendStudentMails({
         name: sName, roll: sRoll, email: sMail, company: sCompany, 
         position: sPosition, tpoName: sTpo, branch: sBranch, jobId: sJobId
       }, status, { date: interviewDate, time: interviewTime, venue: interviewVenue }, currentUserEmail)
       .catch(e => console.error("Background Mail Error")); 
    }

    refreshCache(); 
    res.json({ success: true, message: "Updated!" });
  } catch (error) { 
    console.error(error);
    res.status(500).json({ success: false, message: `Update Failed: ${error.message}` }); 
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
  
  const tpoName = req.body.tpoName;
  try {
    let offerLetterLink = '';
    if (req.file) offerLetterLink = await uploadToDrive(req.file, FOLDER_OFFER_LETTERS);
    
    const appSheet = doc.sheetsByTitle["Opening_Applied"];
    const logSheet = doc.sheetsByTitle["TPO_Log"];

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

    if (appSheet) await appSheet.addRow(newRowObj);
    if (logSheet) await logSheet.addRow({ ...newRowObj, 'Offer Letter Status': offerLetterLink });
    
    checkAndSendStudentMails({ ...appData, tpoName: tpoName }, appData.status || 'Placed', {}, req.body.currentUserEmail);

    refreshCache(); res.json({ success: true, message: "Placement added manually." });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// ---------------------------------------------------------
// 🚨 EVENTS / VACANCIES / ISSUES / REPORTS
// ---------------------------------------------------------

exports.getVacancies = (req, res) => {
  let vacs = getCache().vacancies.map((row, i) => {
    return {
      id: getValByHeader(row, ['jobid', 'id']) || `JOB-${i+1}`, 
      company: getValByHeader(row, ['companyname', 'company']), 
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
      status: getValByHeader(row, ['status']) || 'Open'
    };
  });
  res.json({ success: true, vacancies: vacs.reverse() });
};

exports.getIssues = (req, res) => {
  const { assignedBranchesArray, role, assignedCourse } = req.body;
  let issuesList = getCache().issues.filter(row => {
    const rowBranch = getValByHeader(row, ['branch']);
    const studentName = getValByHeader(row, ['name']) || '';
    const studentData = getCache().students.find(s => (getValByHeader(s, ['name']) || '').toLowerCase().trim() === studentName.toLowerCase().trim());
    const sCourse = studentData ? getValByHeader(studentData, ['course']) : 'Unknown';
    return hasAccess(rowBranch, sCourse, role, assignedBranchesArray, assignedCourse);
  }).map(row => ({ rowNumber: row.rowNumber, name: getValByHeader(row, ['name']) || 'Student', branch: getValByHeader(row, ['branch']), details: getValByHeader(row, ['issuedetails']) || '', status: getValByHeader(row, ['status']) || 'Pending', remarks: getValByHeader(row, ['remarks']) || '' }));
  res.json({ success: true, issues: issuesList.reverse() });
};

exports.updateIssue = async (req, res) => {
  const { rowNumber, status, remarks } = req.body;
  try {
    const issueSheet = doc.sheetsByTitle["Issues"];
    const rows = await issueSheet.getRows({ offset: rowNumber - 2, limit: 1 });
    if (rows.length > 0) { rows[0].assign({ 'Status': status, 'Remarks': remarks }); await rows[0].save(); refreshCache(); res.json({ success: true, message: "Issue updated!" }); } 
    else { res.status(404).json({ success: false, message: "Row not found." }); }
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.getReports = (req, res) => {
  const { assignedBranchesArray, role, assignedCourse } = req.body;
  let students = [], applications = [], issues = [], talentino = [], tpoLogs = [];
  
  getCache().students.forEach(row => {
    if(!hasAccess(getValByHeader(row, ['branch']), getValByHeader(row, ['course']), role, assignedBranchesArray, assignedCourse)) return;
    students.push({ name: getValByHeader(row, ['name']), roll: getValByHeader(row, ['rollnumber', 'roll']), branch: getValByHeader(row, ['branch']), course: getValByHeader(row, ['course']), status: getValByHeader(row, ['status']), placementStatus: getValByHeader(row, ['placementstat', 'placementstatus']) });
  });
  
  getCache().applications.forEach(row => {
    if(!hasAccess(getValByHeader(row, ['branch']), getValByHeader(row, ['course']), role, assignedBranchesArray, assignedCourse)) return;
    applications.push({ name: getValByHeader(row, ['studentname', 'name']), roll: getValByHeader(row, ['rollnumber', 'roll']), jobId: getValByHeader(row, ['jobid']), company: getValByHeader(row, ['companyname', 'company']), date: getValByHeader(row, ['timestamp']), status: getValByHeader(row, ['status']), remarks: getValByHeader(row, ['remarks']), tpoName: getValByHeader(row, ['placementofficer']), branch: getValByHeader(row, ['branch']), course: getValByHeader(row, ['course']) });
  });
  
  getCache().issues.forEach(row => { 
    if (hasAccess(getValByHeader(row, ['branch']), getValByHeader(row, ['course']), role, assignedBranchesArray, assignedCourse)) issues.push({ name: getValByHeader(row, ['name']), branch: getValByHeader(row, ['branch']), details: getValByHeader(row, ['issuedetails']), status: getValByHeader(row, ['status']), remarks: getValByHeader(row, ['remarks']) }); 
  });
  
  getCache().tAtt.forEach(row => { 
    if (hasAccess(getValByHeader(row, ['branch']), getValByHeader(row, ['course']), role, assignedBranchesArray, assignedCourse)) talentino.push({ name: getValByHeader(row, ['name']), branch: getValByHeader(row, ['branch']), date: getValByHeader(row, ['check-in', 'date']), rating: getValByHeader(row, ['rating']), notes: getValByHeader(row, ['notes']) }); 
  });
  
  let vacancies = getCache().vacancies.map(row => ({ id: getValByHeader(row, ['jobid', 'id']) || '', company: getValByHeader(row, ['company']) || '', location: getValByHeader(row, ['location']) || '', mode: getValByHeader(row, ['mode']) || '', status: getValByHeader(row, ['status']) || 'Open', course: getValByHeader(row, ['course']) || '', date: getValByHeader(row, ['lastdate', 'date']) || '' }));
  let events = getCache().events.map(row => ({ date: getValByHeader(row, ['date']) || '' }));

  if (getCache().tpoLogs) {
    getCache().tpoLogs.forEach(row => { 
      try { tpoLogs.push(row.toObject()); } catch(e) {}
    });
  }

  res.json({ success: true, students, applications, issues, talentino, vacancies, events, tpoLogs });
};

exports.getTalentino = (req, res) => {
  const { assignedBranchesArray, role, assignedCourse } = req.body;
  let records = getCache().tAtt.filter(row => {
    const rowBranch = getValByHeader(row, ['branch']);
    const studentName = getValByHeader(row, ['name', 'student']) || '';
    const studentData = getCache().students.find(s => (getValByHeader(s, ['name']) || '').toLowerCase().trim() === studentName.toLowerCase().trim());
    const sCourse = studentData ? getValByHeader(studentData, ['course']) : 'Unknown';
    return hasAccess(rowBranch, sCourse, role, assignedBranchesArray, assignedCourse);
  }).map(row => {
    return { name: getValByHeader(row, ['name', 'student']), branch: getValByHeader(row, ['branch']), date: getValByHeader(row, ['timestamp', 'date', 'time', 'present check-ins date']), rating: getValByHeader(row, ['rating']), notes: getValByHeader(row, ['notes', 'remark']) };
  });
  let dates = new Set();
  records.forEach(r => { const cleanDate = (r.date || '').split(' ')[0].trim(); if (cleanDate && cleanDate !== 'N/A') dates.add(cleanDate); });
  res.json({ success: true, dates: Array.from(dates).sort().reverse(), records: records.reverse() });
};


exports.getEvents = (req, res) => {
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
  res.json({ success: true, events: allEvents.filter(e => e.date && e.title) });
};

// =========================================================
// 🚨 RULES 1 & 2: TALENTINO & PLACEMENT DRIVE EVENTS
// =========================================================
exports.addEvent = async (req, res) => {
  const { date, tpo, branch, type, title, description, time, location } = req.body;
  try {
    const eventSheet = doc.sheetsByTitle["Event"];
    let posterLink = '';
    if (req.file) posterLink = await uploadToDrive(req.file, FOLDER_OFFER_LETTERS); 
    await eventSheet.addRow({ 'Date of the Event': date, 'TPO': tpo, 'Branch': branch, 'Event': type, 'Title': title, 'Descripation': description || '', 'Time of the Event': time || '', 'Event Happening in': location || '', 'Poster Link': posterLink });
    
    const evType = (type || '').toLowerCase();
    const refId = Math.floor(10000 + Math.random() * 90000); 

    const logo1 = "https://lh3.googleusercontent.com/d/1VqmH9-l2lBHErJPW1tCjtCu-SrTEMPtN";
    const logo2 = "https://lh3.googleusercontent.com/d/1bHpUfH_578DmfityB9cOgFNYhbBGdG9J";
    const watermark = "https://lh3.googleusercontent.com/d/1dr27VR3Xu8EwDf4dCAO1ucq441VjpfwB";
    const senderEmail = process.env.EMAIL_USER || 'placementcell.ipcs@gmail.com';
    
    const formattedDesc = String(description || 'N/A').replace(/(?:\r\n|\r|\n)/g, '<br/>');
    
    if (evType.includes('placement drive')) {
      // 🚨 RULE 2: Placement Drive Broadcast
      const allTpos = getAllTpoEmails();
      const allBMs = getAllBranchManagerEmails();
      
      // 🚨 FIX: Never use senderEmail for 'TO' to avoid Google dropping CCs
      const toEmail = 'ajith@ipcsglobal.com'; 
      const ccList = 'rakesh@ipcsglobal.com,gifty@ipcsglobal.com';
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
                <p style="margin: 0; font-weight: bold; color: #38bdf8;">IPCS Global</p>
              </div>
            </div>
          </div>
        </div>
      `;

      await sendMailAndLog({
        from: `"IPCS Placements" <${senderEmail}>`,
        to: toEmail, 
        cc: ccList,
        bcc: bccList,
        subject: `Placement Drive Notification – ${date} | ${time || 'TBD'} [Ref: ${refId}]`,
        html: html
      }, { name: 'All Branches', email: 'Broadcast', type: 'Event Notification' });

    } else if (evType.includes('talentino')) {
  const scheduledTpoEmail = getTpoEmailByName(tpo);
  const bmMail = getBranchManagerEmail(branch);
  const superAdminEmails = getSuperAdminEmails();

  // Primary recipient determination
  let toEmail = bmMail || scheduledTpoEmail || 'gifty@ipcsglobal.com';

  // Construct CC array and filter out duplicates and empty strings
  let rawCc = [scheduledTpoEmail, 'gifty@ipcsglobal.com'];
  let ccList = [...new Set(rawCc)]
    .filter(email => email && email.toLowerCase() !== toEmail.toLowerCase())
    .join(',');

  // Construct BCC array (Super Admins)
  let bccList = [...new Set(superAdminEmails)]
    .filter(email => email && email.toLowerCase() !== toEmail.toLowerCase())
    .join(',');

      const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); background-color: #ffffff;">
          <div style="background-color: #0f1523; padding: 25px 20px; text-align: center; border-bottom: 5px solid #a855f7;">
            <div style="margin-bottom: 12px;">
              <img src="${logo1}" alt="IPCS Logo" style="max-height: 38px; margin: 0 8px; display: inline-block; vertical-align: middle;" />
              <img src="${logo2}" alt="Talenzo Logo" style="max-height: 38px; margin: 0 8px; display: inline-block; vertical-align: middle;" />
            </div>
            <h2 style="color: #ffffff; margin: 0; font-size: 20px; text-transform: uppercase; letter-spacing: 1px;">Talentino Session Notification</h2>
            <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 13px;">IPCS Global Placement Cell</p>
          </div>
          <div style="background-image: url('${watermark}'); background-repeat: no-repeat; background-position: center center; background-size: cover; background-color: #ffffff;">
            <div style="padding: 35px 30px; background-color: rgba(255, 255, 255, 0.94); color: #334155; font-size: 15px; line-height: 1.65;">
              <p style="font-size: 16px; font-weight: bold; color: #0f1523; margin-top: 0;">Dear Team,</p>
              <p>Greetings from the Placement Department, IPCS Global.</p>
              <p>This is to inform you that a Talentino Session has been scheduled at your branch. Kindly find the details below:</p>
              
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

              <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #1e3a8a;">
                  <b>Note:</b> No separate registration is required for the Talentino session. Students can participate directly as instructed by the concerned TPO.
                </p>
              </div>

              <p>The Talentino session is designed to engage students through interactive activities, challenges, and placement-oriented exercises, helping them improve their confidence, communication, aptitude, problem-solving, and overall placement readiness.</p>
              <p>Your support and coordination are essential to ensure the smooth execution of the Talentino session and active student participation.</p>
              <p>For any clarification or coordination, please connect with the Placement Team.<br/>Thank you for your cooperation.</p>

              <div style="margin-top: 35px; padding-top: 20px; border-top: 1px solid #cbd5e1; font-size: 14px; color: #0f1523;">
                <p style="margin: 0 0 3px 0;">Regards,</p>
                <p style="margin: 0 0 2px 0; font-weight: bold;">Placement Team</p>
                <p style="margin: 0; font-weight: bold; color: #38bdf8;">IPCS Global</p>
              </div>
            </div>
          </div>
        </div>
      `;

      await sendMailAndLog({
    from: `"IPCS Talentino" <${senderEmail}>`,
    to: toEmail,
    cc: ccList,
    bcc: bccList, // Added BCC support
    subject: `Talentino Session Notification – ${date} | ${time || 'TBD'} [Ref: ${refId}]`,
    html: html
  }, { name: tpo, email: toEmail, type: 'Event Notification' });
}

    refreshCache(); 
    res.json({ success: true, message: "Event added successfully" });
  } catch (error) { 
    console.error("Event add error:", error);
    res.status(500).json({ success: false, message: error.message }); 
  }
};

// =========================================================
// 🚨 RULE 3: CRON HELPER (RESUME DELIVERY TO COMPANY)
// =========================================================
exports.runDailyCron = async () => {
  console.log("🚨 [CRON] Starting Daily Resume Delivery check...");
  const cache = getCache();
  if (!cache) return;
  
  const yesterday = new Date(); 
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split('T')[0]; 
  
  const expiredJobs = cache.vacancies.filter(v => {
    const lastDateKey = getValByHeader(v, ['lastdate']);
    if (!lastDateKey) return false;
    try { 
      let pd = lastDateKey;
      if (pd.includes('/')) {
        const parts = pd.split(/[/\s,.-]+/);
        if (parts.length >= 3) pd = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      return new Date(pd).toISOString().split('T')[0] === yStr; 
    } catch(e) { return false; }
  });

  console.log(`🚨 [CRON] Found ${expiredJobs.length} expired jobs from yesterday.`);

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
          
          <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">
            <p style="margin: 0 0 5px 0;">If you require further shortlisting or have interview dates finalized, please reply directly to this email.</p>
            <p style="margin: 15px 0 2px 0;">Regards,</p>
            <p style="margin: 0 0 2px 0; font-weight: bold; color: #0f1523; font-size: 14px;">${tpoName}</p>
            <p style="margin: 0;">Placement Officer, IPCS Global</p>
          </div>
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
  }
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
exports.getClients = (req, res) => {
  const cleanTpoName = (req.body.tpoName || '').toString().toLowerCase().trim();
  let clients = [];
  getCache().clients.forEach(row => {
    const officer = getValByHeader(row, ['placementofficer', 'tponame']);
    const officerClean = (officer || '').toLowerCase().trim();
    
    if (cleanTpoName === '' || officerClean === '' || officerClean.includes(cleanTpoName) || cleanTpoName.includes(officerClean)) {
      clients.push({ 
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
        mouLink: getValByHeader(row, ['mou', 'moulink']) || '' 
      });
    }
  });
  res.json({ success: true, clients: clients.reverse() });
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

exports.updateClient = async (req, res) => {
  const { rowNumber, email, phone, location, contactPerson } = req.body;
  const existingLogo = req.body.logo || '';
  try {
    let logoLink = existingLogo;
    if (req.file) { logoLink = await uploadToDrive(req.file, FOLDER_CLIENT_LOGOS); }
    
    const sheet = doc.sheetsByTitle["Clients"]; 
    const rows = await sheet.getRows({ offset: parseInt(rowNumber) - 2, limit: 1 });
    
    if (rows.length > 0) {
      const headers = sheet.headerValues;
      const updateObj = {};
      
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
      
      const hEmail = getSafeH(['companymailid', 'companyemail', 'mailid', 'email']); if(hEmail && email !== undefined) updateObj[hEmail] = email;
      const hPhone = getSafeH(['companycontact', 'contactnumber', 'contact', 'phone']); if(hPhone && phone !== undefined) updateObj[hPhone] = phone;
      const hLoc = getSafeH(['companylocation', 'location']); if(hLoc && location !== undefined) updateObj[hLoc] = location;
      const hPerson = getSafeH(['companycontactperson', 'contactperson', 'person']); if(hPerson && contactPerson !== undefined) updateObj[hPerson] = contactPerson;
      const hLogo = getSafeH(['companylogo', 'logo']); if(hLogo && logoLink) updateObj[hLogo] = logoLink;

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
  const { rowNumber, companyEmail, companyName } = req.body;
  try {
    const signingLink = `https://talenzo.ipcsglobal.info/sign-certificate/${rowNumber}`;
    const refId = Math.floor(10000 + Math.random() * 90000); 
    const mailOptions = {
      from: `"IPCS Placement Portal" <${process.env.EMAIL_USER}>`, to: companyEmail,
      subject: `Action Required: IPCS Global Hiring Partnership Confirmation With ${companyName} [Ref: ${refId}]`, 
      html: `<div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;"><div style="background-color: #0f1523; padding: 20px; text-align: center; border-bottom: 4px solid #38bdf8;"><h2 style="color: #ffffff; margin: 0;">IPCS HIRING PARTNERSHIP</h2></div><div style="padding: 30px;"><p>Dear ${companyName} Team,</p><p>We are thrilled to welcome you as a Preferred Hiring Partner with IPCS Global!</p><p>To finalize our association, please review and digitally sign your Confirmation of Hiring Partnership by clicking the secure button below. You will be able to upload your company logo and authorized signature directly on the document.</p><div style="text-align: center; margin: 40px 0;"><a href="${signingLink}" style="background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; font-size: 16px;">Review & Sign</a></div><p style="font-size: 13px; color: #64748b;">If the button does not work, copy and paste this link into your browser: <br/>${signingLink}</p></div></div>`
    };
    await sendMailAndLog(mailOptions, { name: companyName, email: companyEmail, type: 'MOU Request' }); 
    const sheet = doc.sheetsByTitle["Clients"]; 
    const rows = await sheet.getRows({ offset: parseInt(rowNumber) - 2, limit: 1 });
    if(rows.length > 0) {
      const statusCol = getFuzzyHeader(sheet.headerValues, 'mailstatus') || getFuzzyHeader(sheet.headerValues, 'status');
      if (statusCol) { rows[0].assign({ [statusCol]: 'Request Sent' }); await rows[0].save(); }
    }
    refreshCache(); res.json({ success: true });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.submitMou = async (req, res) => {
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
      const updateObj = {};
      
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

      const hDocStat = getSafeH(['documentstatus', 'docstatus']); if(hDocStat) updateObj[hDocStat] = 'Completed';
      const hMou = getSafeH(['mou', 'moulink']); if(hMou) updateObj[hMou] = pdfLink;
      const hLogo = getSafeH(['companylogo', 'logo']); if(hLogo && logoLink) updateObj[hLogo] = logoLink;

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
            </div>
          </div>
        </div>
      `,
      attachments: [{ filename: `${companyName.replace(/\s+/g, '_')}_Agreement.pdf`, content: certFile.buffer }]
    };
    await sendMailAndLog(mailOptions, { name: companyName, email: companyEmail, type: 'MOU Completion' }); 
    refreshCache(); res.json({ success: true, pdfLink });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// =========================================================
// 🚨 ADMIN USERS & LMS MANAGEMENT
// =========================================================
exports.getAdminUsers = async (req, res) => {
  try {
    await doc.loadInfo();
    let allUsers = [];

    const contactSheet = doc.sheetsByTitle["Contact"];
    if (contactSheet) {
      const cRows = await contactSheet.getRows(); const headers = contactSheet.headerValues;
      const hName = getFuzzyHeader(headers, 'tponame'); const hMail = getFuzzyHeader(headers, 'mailid'); 
      const hContact = getFuzzyHeader(headers, 'contactnumber'); const hBranch = getFuzzyHeader(headers, 'sittingbranch'); 
      const hAssign = getFuzzyHeader(headers, 'assignedbranches'); const hPass = getFuzzyHeader(headers, 'password'); 
      const hPhoto = getFuzzyHeader(headers, 'profilephoto'); const hTarget = getFuzzyHeader(headers, 'target') || getFuzzyHeader(headers, 'targetofthemonth'); const hEmpId = getFuzzyHeader(headers, 'empid');

      cRows.forEach(r => {
        const email = r.get(hMail) || ''; const name = r.get(hName) || '';
        if (email.trim() !== '' || name.trim() !== '') {
          allUsers.push({ sheet: 'Contact', rowNumber: r.rowNumber, userName: name, contact: r.get(hContact) || '', email: email, sittingBranch: r.get(hBranch) || '', assignedBranches: r.get(hAssign) || '', password: r.get(hPass) || '', role: 'TPO', course: 'All Courses', access: 'View & Edit', profilePhoto: r.get(hPhoto) || '', target: r.get(hTarget) || '20', empId: r.get(hEmpId) || `IPCS-EMP-${Math.floor(1000 + Math.random() * 9000)}` });
        }
      });
    }

    const userSheet = doc.sheetsByTitle["User"];
    if (userSheet) {
      const uRows = await userSheet.getRows(); const headers = userSheet.headerValues;
      const hName = getFuzzyHeader(headers, 'username'); const hMail = getFuzzyHeader(headers, 'mailid'); 
      const hContact = getFuzzyHeader(headers, 'contactnumber'); const hBranch = getFuzzyHeader(headers, 'sittingbranch'); 
      const hAssign = getFuzzyHeader(headers, 'assignedbranches'); const hPass = getFuzzyHeader(headers, 'password'); 
      const hRole = getFuzzyHeader(headers, 'role'); const hCourse = getFuzzyHeader(headers, 'course'); 
      const hAccess = getFuzzyHeader(headers, 'access'); const hPhoto = getFuzzyHeader(headers, 'profilephoto');

      uRows.forEach(r => {
        const email = r.get(hMail) || ''; const name = r.get(hName) || '';
        if (email.trim() !== '' || name.trim() !== '') {
          allUsers.push({ sheet: 'User', rowNumber: r.rowNumber, userName: name, contact: r.get(hContact) || '', email: email, sittingBranch: r.get(hBranch) || '', assignedBranches: r.get(hAssign) || '', password: r.get(hPass) || '', role: r.get(hRole) || 'Unassigned', course: r.get(hCourse) || 'All Courses', access: r.get(hAccess) || 'View Only', profilePhoto: r.get(hPhoto) || '', target: 'N/A', empId: `IPCS-EMP-${Math.floor(1000 + Math.random() * 9000)}` });
        }
      });
    }
    res.json({ success: true, users: allUsers.reverse() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addAdminUser = async (req, res) => {
  try {
    const { userName, contact, email, sittingBranch, assignedBranches, password, role, course, access } = req.body;
    if (role === 'TPO') {
      const s = doc.sheetsByTitle["Contact"]; const h = s.headerValues;
      await s.addRow({ [getFuzzyHeader(h, 'tponame')]: userName, [getFuzzyHeader(h, 'contactnumber')]: contact, [getFuzzyHeader(h, 'mailid')]: email, [getFuzzyHeader(h, 'sittingbranch')]: sittingBranch, [getFuzzyHeader(h, 'assignedbranches')]: assignedBranches, [getFuzzyHeader(h, 'password')]: password });
    } else {
      const s = doc.sheetsByTitle["User"]; const h = s.headerValues;
      await s.addRow({ [getFuzzyHeader(h, 'username')]: userName, [getFuzzyHeader(h, 'contactnumber')]: contact, [getFuzzyHeader(h, 'mailid')]: email, [getFuzzyHeader(h, 'sittingbranch')]: sittingBranch, [getFuzzyHeader(h, 'assignedbranches')]: assignedBranches, [getFuzzyHeader(h, 'password')]: password, [getFuzzyHeader(h, 'role')]: role, [getFuzzyHeader(h, 'course')]: course, [getFuzzyHeader(h, 'access')]: access });
    }
    refreshCache(); res.json({ success: true, message: "User added" });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateAdminUser = async (req, res) => {
  try {
    const { sheet, rowNumber, userName, contact, email, sittingBranch, assignedBranches, password, role, course, access } = req.body;
    const s = doc.sheetsByTitle[sheet]; const rows = await s.getRows({ offset: rowNumber - 2, limit: 1 });
    if (rows.length > 0) {
      const h = s.headerValues;
      if (sheet === 'Contact') { rows[0].assign({ [getFuzzyHeader(h, 'tponame')]: userName, [getFuzzyHeader(h, 'contactnumber')]: contact, [getFuzzyHeader(h, 'mailid')]: email, [getFuzzyHeader(h, 'sittingbranch')]: sittingBranch, [getFuzzyHeader(h, 'assignedbranches')]: assignedBranches, [getFuzzyHeader(h, 'password')]: password }); } 
      else { rows[0].assign({ [getFuzzyHeader(h, 'username')]: userName, [getFuzzyHeader(h, 'contactnumber')]: contact, [getFuzzyHeader(h, 'mailid')]: email, [getFuzzyHeader(h, 'sittingbranch')]: sittingBranch, [getFuzzyHeader(h, 'assignedbranches')]: assignedBranches, [getFuzzyHeader(h, 'password')]: password, [getFuzzyHeader(h, 'role')]: role, [getFuzzyHeader(h, 'course')]: course, [getFuzzyHeader(h, 'access')]: access }); }
      await rows[0].save(); refreshCache(); res.json({ success: true, message: "User updated" });
    } else { res.status(404).json({ success: false, message: "User row not found" }); }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteAdminUser = async (req, res) => {
  try {
    const { sheet, rowNumber } = req.body; const targetSheet = doc.sheetsByTitle[sheet];
    if (!targetSheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    const rows = await targetSheet.getRows({ offset: rowNumber - 2, limit: 1 });
    if (rows.length > 0) { await rows[0].delete(); refreshCache(); res.json({ success: true, message: "User deleted" }); } 
    else { res.status(404).json({ success: false, message: "User not found" }); }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updatePassword = async (req, res) => {
  const { email, loginId, newPassword } = req.body;
  try {
    const cache = getCache(); let targetRow = null;
    const identifiers = [(email || '').toString().trim().toLowerCase(), (loginId || '').toString().trim().toLowerCase()].filter(Boolean);
    if (cache.contacts) targetRow = cache.contacts.find(row => identifiers.some(id => row._rawData.map(v => (v || '').toString().trim().toLowerCase()).includes(id)));
    if (!targetRow && cache.users) targetRow = cache.users.find(row => identifiers.some(id => row._rawData.map(v => (v || '').toString().trim().toLowerCase()).includes(id)));

    if (targetRow) {
      targetRow.assign({ [getFuzzyHeader(targetRow._worksheet.headerValues, 'password')]: newPassword });
      await targetRow.save(); refreshCache(); res.json({ success: true, message: "Password updated successfully" });
    } else { res.status(404).json({ success: false, message: "User account not found in database." }); }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updatePhoto = async (req, res) => {
  const { email, loginId } = req.body;
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file provided." });
    const photoLink = await uploadToDrive(req.file, FOLDER_CLIENT_LOGOS); 
    const cache = getCache(); let targetRow = null;
    const identifiers = [(email || '').toString().trim().toLowerCase(), (loginId || '').toString().trim().toLowerCase()].filter(Boolean);

    if (cache.contacts) targetRow = cache.contacts.find(row => identifiers.some(id => row._rawData.map(v => (v || '').toString().trim().toLowerCase()).includes(id)));
    if (!targetRow && cache.users) targetRow = cache.users.find(row => identifiers.some(id => row._rawData.map(v => (v || '').toString().trim().toLowerCase()).includes(id)));

    if (targetRow) {
      const headers = targetRow._worksheet.headerValues; const photoHeader = headers.find(h => h.toLowerCase().includes('photo') || h.toLowerCase().includes('profile')) || 'Profile Photo';
      targetRow.assign({ [photoHeader]: photoLink }); await targetRow.save(); refreshCache(); res.json({ success: true, photoUrl: photoLink });
    } else { res.status(404).json({ success: false, message: "User not found." }); }
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// ---------------------------------------------------------
// 🚨 L M S  -  S T U D Y   M A T E R I A L S
// ---------------------------------------------------------
exports.getMaterials = (req, res) => {
  try {
    let materials = getCache().materials.map(row => {
      return { 
        id: getValByHeader(row, ['materialid']) || '', 
        course: getValByHeader(row, ['course']) || '', 
        module: getValByHeader(row, ['moduletopic', 'module', 'topic']) || '', 
        title: getValByHeader(row, ['title']) || '', 
        fileType: getValByHeader(row, ['filetype']) || '', 
        link: getValByHeader(row, ['onedrivelink', 'link']) || '', 
        status: getValByHeader(row, ['status']) || 'Active' 
      };
    });
    res.json({ success: true, materials: materials.reverse() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
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
    let questions = getCache().techQuestions.map(row => {
      return { id: getValByHeader(row, ['questionid']) || '', course: getValByHeader(row, ['course']) || '', question: getValByHeader(row, ['question']) || '', optA: getValByHeader(row, ['optiona']) || '', optB: getValByHeader(row, ['optionb']) || '', optC: getValByHeader(row, ['optionc']) || '', optD: getValByHeader(row, ['optiond']) || '', correct: getValByHeader(row, ['correctoption']) || '', explanation: getValByHeader(row, ['explanation']) || '', status: getValByHeader(row, ['status']) || 'Active' };
    });
    res.json({ success: true, questions: questions.reverse() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addQuestion = async (req, res) => {
  try {
    const { id, course, question, optA, optB, optC, optD, correct, explanation, status } = req.body;
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
      await rowToDelete.delete(); refreshCache(); res.json({ success: true, message: "Question deleted" }); 
    } else { res.status(404).json({ success: false, message: "Question not found" }); }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getResults = (req, res) => {
  try {
    let results = getCache().techResults.map(row => {
      return { timestamp: getValByHeader(row, ['timestamp']) || '', rollNo: getValByHeader(row, ['rollno']) || '', name: getValByHeader(row, ['name']) || '', email: getValByHeader(row, ['mailid']) || '', branch: getValByHeader(row, ['branch']) || '', course: getValByHeader(row, ['course']) || '', score: getValByHeader(row, ['score']) || '', total: getValByHeader(row, ['totalquestions']) || '', percentage: getValByHeader(row, ['percentage']) || '', timeTaken: getValByHeader(row, ['timetaken']) || '' };
    });
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
    let results = getCache().aptResults.map(row => {
      return { timestamp: getValByHeader(row, ['timestamp']) || '', rollNo: getValByHeader(row, ['rollno']) || '', name: getValByHeader(row, ['name']) || '', email: getValByHeader(row, ['email', 'mailid']) || '', branch: getValByHeader(row, ['branch']) || '', score: getValByHeader(row, ['score']) || '', total: getValByHeader(row, ['total', 'totalquestions']) || '', percentage: getValByHeader(row, ['percentage']) || '', timeTaken: getValByHeader(row, ['timetaken']) || '', categoryBreakdown: getValByHeader(row, ['categorybreakdown']) || '' };
    });
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
    let results = getCache().talResults.map(row => {
      return { timestamp: getValByHeader(row, ['timestamp']) || '', rollNo: getValByHeader(row, ['rollno']) || '', name: getValByHeader(row, ['name']) || '', email: getValByHeader(row, ['mailid', 'email']) || '', branch: getValByHeader(row, ['branch']) || '', testNumber: getValByHeader(row, ['testnumbercompleted']) || '', score: getValByHeader(row, ['score']) || '', total: getValByHeader(row, ['totalquestions']) || '', percentage: getValByHeader(row, ['percentage']) || '', timeTaken: getValByHeader(row, ['timetaken']) || '' };
    });
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

exports.getDrives = (req, res) => {
  try {
    const cache = getCache();
    
    const eventsMap = {};
    (cache.events || []).forEach(row => {
       const dId = getValByHeader(row, ['driveid']) || '';
       const tpo = getValByHeader(row, ['tpo', 'placementofficer']) || '';
       if (dId) eventsMap[dId.toUpperCase().trim()] = tpo;
    });

    const drivesData = (cache.drives || []).map(row => {
      const dId = getValByHeader(row, ['driveid']) || '';
      const driveTpo = eventsMap[dId.toUpperCase().trim()] || '';

      return {
        rowNumber: row.rowNumber, driveId: dId, name: getValByHeader(row, ['name']) || '', phone: getValByHeader(row, ['contact']) || '',
        email: getValByHeader(row, ['mailid', 'email']) || '', course: getValByHeader(row, ['course']) || '', branch: getValByHeader(row, ['branch']) || '',
        resume: getValByHeader(row, ['resume']) || '', qual: getValByHeader(row, ['qualification']) || '', regStatus: getValByHeader(row, ['status']) || '',
        regDate: getValByHeader(row, ['registeddate', 'timestamp']) || '', studentStatus: getValByHeader(row, ['studentstatus']) || '',
        driveTpo: driveTpo
      };
    });
    res.json({ success: true, drives: drivesData.reverse() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateDriveStatus = async (req, res) => {
  const { rowNumber, studentStatus } = req.body;
  try {
    const sheet = doc.sheetsByTitle["Drive_Registration"];
    const rows = await sheet.getRows({ offset: rowNumber - 2, limit: 1 });
    if(rows.length > 0) {
      const statHead = getFuzzyHeader(sheet.headerValues, 'studentstatus');
      rows[0].assign({ [statHead]: studentStatus }); await rows[0].save();
      refreshCache(); res.json({ success: true });
    }
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
        branch: branchName || '' 
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
    const { no, region, branch } = req.body;
    const sheet = doc.sheetsByTitle["Branches"];
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    await sheet.addRow([no, region, branch]);
    refreshCache(); res.json({ success: true, message: "Branch saved" });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateBranch = async (req, res) => {
  try {
    const { oldBranch, no, region, branch } = req.body;
    const sheet = doc.sheetsByTitle["Branches"];
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    const rows = await sheet.getRows();
    const rowToUpdate = rows.find(r => r._rawData[2] === oldBranch);
    if (rowToUpdate) {
      rowToUpdate._rawData[0] = no; rowToUpdate._rawData[1] = region; rowToUpdate._rawData[2] = branch;
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
    activeSessions.set(cleanEmail, sessionToken);
    return res.json({ valid: true });
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