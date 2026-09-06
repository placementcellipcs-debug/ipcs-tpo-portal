const { 
  doc, getCache, refreshCache, hasAccess, getFuzzyHeader, 
  sendIPCSMail, uploadToDrive
} = require('./config');

const FOLDER_OFFER_LETTERS = '1184PpFnRndFM0pwIt1Qob_FHMs8hPjV5';
const FOLDER_CLIENT_LOGOS = '11M8jGi1ISWP2mOpWRZncHhThHLoc7cDi'; 
const FOLDER_MOU_CERTIFICATES = '1Hu1zPs56nFXyJPSl7PVfs-oFW4QrKqiD';

// =========================================================
// 🚨 EMAIL HELPERS & LOGGING SYSTEM
// =========================================================
const getTpoEmailByBranch = (branch) => {
  const cache = getCache();
  if (!cache || !cache.contacts) return '';
  const searchBranch = (branch || '').toLowerCase().trim();
  
  const row = cache.contacts.find(r => {
    const assigned = (r.get('Assigned Branches') || '').toLowerCase();
    const sitting = (r.get('Sitting Branch') || '').toLowerCase();
    if (assigned.includes('all') || sitting.includes('all')) return false; 
    return assigned.includes(searchBranch) || searchBranch.includes(assigned) || sitting.includes(searchBranch);
  });
  return row ? row.get('Mail ID') : '';
};

const getTpoEmail = (tpoName) => {
  const cache = getCache();
  if (!cache || !cache.contacts) return '';
  const row = cache.contacts.find(r => {
    const name = r.get('TPO Name') || r.get('Name') || '';
    return name.toLowerCase().includes((tpoName || '').toLowerCase());
  });
  return row ? row.get('Mail ID') : '';
};

const getBranchManagerEmail = (branch) => {
  const cache = getCache();
  if (!cache || !cache.users) return '';
  const searchBranch = (branch || '').toLowerCase().replace('branch', '').trim();
  
  const row = cache.users.find(r => {
    const role = (r.get('Role') || '').toLowerCase().trim();
    const br = (r.get('Sitting Branch') || r.get('Assigned Branches') || '').toLowerCase();
    return role === 'branch manager' && br.includes(searchBranch);
  });
  return row ? row.get('Mail ID') : '';
};

const getAllTpoEmails = () => {
  const cache = getCache();
  if (!cache || !cache.contacts) return [];
  return cache.contacts.map(r => r.get('Mail ID')).filter(Boolean);
};

const getAllBranchManagerEmails = () => {
  const cache = getCache();
  if (!cache || !cache.users) return [];
  return cache.users
    .filter(r => (r.get('Role') || '').toLowerCase().trim() === 'branch manager')
    .map(r => r.get('Mail ID')).filter(Boolean);
};

const getSuperAdminEmails = () => {
  const cache = getCache();
  if (!cache || !cache.users) return [];
  return cache.users.filter(r => {
    const role = (r.get('Role') || '').toLowerCase().trim();
    const access = (r.get('Access') || '').toLowerCase().trim();
    return access.includes('super admin') || role === 'general manager' || role === 'technical head' || role === 'zonal placement head';
  }).map(r => r.get('Mail ID')).filter(Boolean);
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
    (r.get('Roll Number') === studentData.roll || r.get('Student Name') === studentData.name)
  );

  const noAttendJobs = new Set();
  const rejectedJobs = new Set();

  // 🚨 UNIQUE JOB ID FIX: Prevents blank Job IDs from grouping together
  logs.forEach(r => {
    const s = (r.get('Status') || '').toLowerCase();
    const jId = r.get('Job ID') || 'NO_ID';
    const cName = r.get('Company Name') || r.get('Company') || 'NO_COMP';
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

  const assignedTpoEmail = getTpoEmail(studentData.tpoName);
  let ccArray = [currentUserEmail, assignedTpoEmail];

  if ((status === 'interview not attended' && noAttendCount >= 3) || 
      ((status.includes('student rejected') || status.includes('offer rejected')) && rejectCount >= 3)) {
    ccArray.push('gifty@ipcsglobal.com');
  }

  const ccList = [...new Set(ccArray)].filter(Boolean).join(',');

  let subject = ''; let html = ''; let mailType = '';
  const refId = Math.floor(10000 + Math.random() * 90000); 

  const logo1 = "https://lh3.googleusercontent.com/d/1VqmH9-l2lBHErJPW1tCjtCu-SrTEMPtN";
  const logo2 = "https://lh3.googleusercontent.com/d/1bHpUfH_578DmfityB9cOgFNYhbBGdG9J";
  const watermark = "https://lh3.googleusercontent.com/d/1dr27VR3Xu8EwDf4dCAO1ucq441VjpfwB";

  // 🚨 THE BEAUTIFUL WATERMARK TEMPLATE WRAPPER
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
    
    // 🚨 BRAND NEW BEAUTIFUL HTML DESIGN
    html = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
        
        <!-- Header Section -->
        <div style="background-color: #0f1523; padding: 35px 20px; text-align: center; border-bottom: 5px solid #38bdf8;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 1px; text-transform: uppercase;">Interview Invitation</h1>
          <p style="color: #94a3b8; margin: 10px 0 0 0; font-size: 14px;">IPCS Global Placement Cell</p>
        </div>

        <!-- Main Content -->
        <div style="padding: 40px 35px;">
          <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 22px;">Congratulations, ${studentData.name}!</h2>
          <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 30px 0;">
            We are thrilled to inform you that you have been <strong style="color: #0f1523;">selected for an interview</strong> with one of our esteemed partner companies. This is a fantastic step towards achieving your career goals, and we are excited to see your hard work and dedication paying off.
          </p>

          <!-- Highlighted Details Card -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 5px solid #38bdf8; border-radius: 8px; padding: 25px; margin-bottom: 30px;">
            <h3 style="margin: 0 0 15px 0; color: #0f1523; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;">Event Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tbody>
                <tr>
                  <td style="padding: 10px 0; color: #64748b; font-size: 14px; font-weight: 600; width: 35%; border-bottom: 1px solid #e2e8f0;">Company:</td>
                  <td style="padding: 10px 0; color: #0f1523; font-size: 16px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${studentData.company}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #64748b; font-size: 14px; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Position:</td>
                  <td style="padding: 10px 0; color: #0f1523; font-size: 15px; border-bottom: 1px solid #e2e8f0;">${studentData.position || 'Professional'}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #64748b; font-size: 14px; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Date:</td>
                  <td style="padding: 10px 0; color: #0f1523; font-size: 15px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${interviewDetails.date || 'TBD'}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #64748b; font-size: 14px; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Time:</td>
                  <td style="padding: 10px 0; color: #0f1523; font-size: 15px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${interviewDetails.time || 'TBD'}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #64748b; font-size: 14px; font-weight: 600; border-bottom: 1px solid #e2e8f0;">Venue / Link:</td>
                  <td style="padding: 10px 0; color: #38bdf8; font-size: 15px; font-weight: bold; border-bottom: 1px solid #e2e8f0;">${interviewDetails.venue || 'TBD'}</td>
                </tr>
                <tr>
                  <td style="padding: 10px 0; color: #64748b; font-size: 13px; font-weight: 600;">Newsletter ID:</td>
                  <td style="padding: 10px 0; color: #64748b; font-size: 13px;">${studentData.jobId || 'N/A'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 style="margin: 0 0 10px 0; color: #1e293b; font-size: 16px;">Agenda & Expectations</h3>
          <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 25px 0; padding: 18px; background-color: rgba(56, 189, 248, 0.05); border-radius: 8px; font-style: italic; border: 1px solid rgba(56, 189, 248, 0.2);">
            "The interview may consist of multiple rounds, including technical assessments, behavioral interviews, or HR rounds. You may also be required to provide specific documents or complete certain tasks, so please be prepared accordingly."
          </p>

          <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 4px; margin-bottom: 30px;">
            <p style="font-size: 13px; line-height: 1.5; color: #991b1b; margin: 0;">
              <strong>Important Note:</strong> Please make sure to arrive on time for the interview or log in to the online meeting platform a few minutes before the scheduled time. If, for any reason, you are unable to attend, please inform us at your earliest convenience so we can make alternative arrangements.
            </p>
          </div>

          <!-- Footer divider -->
          <div style="border-top: 1px solid #e2e8f0; padding-top: 25px;">
            <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 15px 0;">
              If you have any questions or need further information about the interview, please do not hesitate to contact the placement department. We wish you the very best of luck!
            </p>
            <p style="font-size: 15px; color: #0f1523; font-weight: bold; margin: 0;">
              Regards,<br>
              <span style="color: #38bdf8;">IPCS Placement Cell</span>
            </p>
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
        <p>Please consider this email as an <b>official warning</b>. Attending interviews scheduled through the Placement Team is an important responsibility of every student registered for placement assistance.</p>
        <p>You are hereby instructed to ensure your attendance for all future interviews and recruitment processes scheduled for you.</p>
        <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #92400e; font-weight: bold;">
            Please note that if you fail to attend a scheduled interview for the third time, your placement assistance will be put on hold, and you may not be considered for further placement opportunities until further review by the Placement Team.
          </p>
        </div>
        <p>We strongly advise you to take this matter seriously and maintain proper communication with the Placement Team in case of any genuine difficulty or unavoidable circumstance.</p>
        <p>We expect your full cooperation and commitment towards the placement process.</p>
      `);
    } else if (noAttendCount >= 3) {
      subject = `❗Final Warning – Placement Assistance Put on Hold [Ref: ${refId}]`;
      mailType = 'Hold Mail';
      html = buildBrandedEmail('Placement Assistance Put on Hold', '#ef4444', `
        <p style="font-size: 16px; margin-top: 0;">Dear <b>${studentData.name}</b>,</p>
        <p>Greetings from the Placement Team.</p>
        <p>This is to formally inform you that you have <b>failed to attend the interview scheduled for you for the third time.</b></p>
        <p>Despite the previous warning regarding non-attendance, you have again failed to participate in the scheduled interview without prior intimation to the Placement Team.</p>
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #991b1b; font-weight: bold; font-size: 15px;">
            This is considered a serious violation of the placement process. Therefore, your placement assistance is hereby put on hold with immediate effect.
          </p>
        </div>
        <p>You will not be considered for further interview opportunities or placement drives until your case is reviewed by the Placement Team and further instructions are communicated to you.</p>
        <p>We expect students to take the placement opportunities provided to them seriously and maintain proper communication with the Placement Team regarding any genuine or unavoidable circumstances.</p>
        <p>If you have a valid reason for your repeated non-attendance, you may submit a written explanation to the Placement Team for review.</p>
        <p><b>Please treat this matter as serious and final.</b></p>
      `);
    }
  }

  // 3. REJECTED OFFER (2nd & 3rd Occurrences)
  else if (status.includes('student rejected') || status.includes('offer rejected')) {
    if (rejectCount === 2) {
      subject = `❗Warning – Rejection of Job Offer for the Second Time [Ref: ${refId}]`;
      mailType = 'Warning Mail';
      html = buildBrandedEmail('Official Warning', '#f59e0b', `
        <p style="font-size: 16px; margin-top: 0;">Dear <b>${studentData.name}</b>,</p>
        <p>Greetings from the Placement Team.</p>
        <p>This is to formally inform you that you have <b>rejected a job offer for the second time</b> after being selected through the IPCS Global placement process.</p>
        <p>As per the <b>IPCS Placement Policy</b>, students are expected to seriously consider and accept suitable employment opportunities provided through the Placement Team. Repeated rejection of offers after selection affects the placement process and the opportunities provided to other students.</p>
        <p>Please consider this email as an <b>official warning.</b></p>
        <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #92400e; font-weight: bold;">
            You are hereby advised that if you reject a job offer for the third time, your placement assistance will be put on hold, as per the IPCS Placement Policy. In such a situation, you may not be considered for further placement opportunities until further review by the Placement Team.
          </p>
        </div>
        <p>We strongly advise you to carefully evaluate the opportunities shared with you before participating in the recruitment process and to communicate with the Placement Team in advance if you have any genuine concerns regarding an offer.</p>
        <p>Please take this warning seriously and ensure strict adherence to the IPCS Placement Policy going forward.</p>
      `);
    } else if (rejectCount >= 3) {
      subject = `❗Final Warning – Placement Assistance Put on Hold [Ref: ${refId}]`;
      mailType = 'Hold Mail';
      html = buildBrandedEmail('Placement Assistance Put on Hold', '#ef4444', `
        <p style="font-size: 16px; margin-top: 0;">Dear <b>${studentData.name}</b>,</p>
        <p>Greetings from the Placement Team.</p>
        <p>This is to formally inform you that you have <b>rejected a job offer for the third time</b> after being selected through the IPCS Global placement process.</p>
        <p>You were previously informed about the consequences of repeated offer rejections. However, despite the warnings, you have again declined the opportunity provided to you.</p>
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; color: #991b1b; font-weight: bold; font-size: 15px;">
            As per the IPCS Placement Policy, repeated rejection of job offers after selection may result in the withdrawal of placement assistance. Accordingly, your placement assistance is hereby put on hold with immediate effect.
          </p>
        </div>
        <p>During this period, you will not be considered for further placement opportunities or interview processes through IPCS Global unless your case is reviewed and the Placement Team communicates otherwise.</p>
        <p>If you have any genuine or unavoidable reason for rejecting the offer, you may submit a written explanation to the Placement Team for review.</p>
        <p>Please treat this communication as an <b>official warning and confirmation of the placement assistance hold.</b></p>
        <p>We expect you to take future career opportunities and the placement process seriously.</p>
      `);
    }
  }

  // 4. PLACEMENT CONFIRMED
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
      const rowObj = row.toObject();
      const cleanKeys = {};
      for (let key in rowObj) cleanKeys[key.toLowerCase().replace(/\s/g, '')] = rowObj[key];
      
      const sheetMail = (cleanKeys['mailid'] || cleanKeys['email'] || '').toString().trim().toLowerCase();
      const sheetPass = (cleanKeys['password'] || '').toString().trim();
      
      if (sheetMail === cleanInput && sheetPass === cleanPass && cleanInput !== '') {
        foundUser = cleanKeys;
        role = 'TPO';
        course = 'All Courses';
        userName = cleanKeys['tponame'] || cleanKeys['name'] || 'TPO User';
        break;
      }
    }

    if (!foundUser) {
      for (let row of cache.users) {
        const rowObj = row.toObject();
        const cleanKeys = {};
        for (let key in rowObj) cleanKeys[key.toLowerCase().replace(/\s/g, '')] = rowObj[key];
        
        const sheetUsername = (cleanKeys['username'] || cleanKeys['name'] || '').toString().trim().toLowerCase();
        const sheetMail = (cleanKeys['mailid'] || cleanKeys['email'] || '').toString().trim().toLowerCase();
        const sheetLoginId = (cleanKeys['loginid'] || '').toString().trim().toLowerCase();
        const sheetPass = (cleanKeys['password'] || '').toString().trim();
        
        if ((sheetUsername === cleanInput || sheetMail === cleanInput || sheetLoginId === cleanInput) && sheetPass === cleanPass && cleanInput !== '') {
          foundUser = cleanKeys;
          role = (cleanKeys['role'] || 'RTH').toString().trim();
          course = (cleanKeys['course'] || 'All').toString().trim();
          userName = cleanKeys['username'] || cleanKeys['name'] || 'User';
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

    return res.json({ 
      success: true, 
      tpo: { 
        name: userName, 
        email: foundUser['mailid'] || foundUser['email'] || cleanInput, 
        loginId: cleanInput, 
        sittingBranch: foundUser['sittingbranch'] || 'N/A', 
        assignedBranchesArray: assignedArray, 
        photo: foundUser['profilephoto'] || foundUser['photo'] || '', 
        phone: foundUser['contactnumber'] || foundUser['contact'] || foundUser['phoneno'] || 'Not Provided', 
        role: role, 
        assignedCourse: course, 
        accessType: accessType 
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
    const rowData = row.toObject();
    const getHeader = (s) => Object.keys(rowData).find(k => k.toLowerCase().replace(/\s/g, '').includes(s.toLowerCase().replace(/\s/g, '')));
    if (hasAccess(rowData[getHeader('branch')], rowData[getHeader('course')], role, assignedBranchesArray, assignedCourse)) studentCount++; 
  });
  
  const logsSource = cache.tpoLogs || [];
  const dedupedLogs = {};
  logsSource.forEach(row => {
    const rowData = row.toObject();
    const getHeader = (s) => Object.keys(rowData).find(k => k.toLowerCase().replace(/\s/g, '').includes(s.toLowerCase().replace(/\s/g, '')));
    const roll = rowData[getHeader('roll')] || rowData[getHeader('rollnumber')] || '';
    const name = rowData[getHeader('name')] || rowData[getHeader('studentname')] || '';
    const company = rowData[getHeader('company')] || rowData[getHeader('companyname')] || '';
    const key = `${roll || name}_${company}`.toLowerCase();
    dedupedLogs[key] = rowData;
  });

  Object.values(dedupedLogs).forEach(rowData => {
    const getHeader = (s) => Object.keys(rowData).find(k => k.toLowerCase().replace(/\s/g, '').includes(s.toLowerCase().replace(/\s/g, '')));
    if (hasAccess(rowData[getHeader('branch')], rowData[getHeader('course')], role, assignedBranchesArray, assignedCourse)) {
      const stat = (rowData[getHeader('status')] || '').toString().toLowerCase();
      const joinStat = (rowData[getHeader('joiningstatus')] || '').toString().toLowerCase();
      const placeStat = (rowData[getHeader('placementstatus')] || '').toString().toLowerCase();

      if (stat === 'applied') pendingApps++;
      if (stat.includes('placed') || stat.includes('got offer') || stat.includes('offer') || joinStat.includes('join') || placeStat.includes('placed')) {
        placedCount++;
      }
    }
  });
  
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);

  cache.vacancies.forEach(row => {
    const status = (row.get('Status') || 'Open').toString().toLowerCase();
    const lastDateStr = row.get('Last Date');
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

  let eventsList = cache.events.slice(-8).map(row => ({ title: row.get('Title') || 'Event', date: row.get('Date') || '', time: row.get('Time') || '', type: row.get('Type') || 'Placement Drive', location: row.get('Location') || '' }));
  
  res.json({ success: true, stats: { totalStudents: studentCount, pendingApps, placed: placedCount, activeVacancies: activeVacs }, events: eventsList.reverse() });
};

exports.getStudents = (req, res) => {
  const { assignedBranchesArray, role, assignedCourse } = req.body;
  const cache = getCache();
  let students = []; let stats = { total: 0, pending: 0, notResponding: 0, noNeed: 0, branchCounts: {}, courseCounts: {} };

  cache.students.forEach(row => {
    const rowData = row.toObject();
    const keys = Object.keys(rowData);
    
    const getSafeH = (searchStrs) => {
      for (let s of searchStrs) {
        const clean = s.toLowerCase().replace(/\s/g, '');
        const exact = keys.find(k => k.toLowerCase().replace(/\s/g, '') === clean);
        if (exact) return exact;
      }
      for (let s of searchStrs) {
        const clean = s.toLowerCase().replace(/\s/g, '');
        const partial = keys.find(k => k.toLowerCase().replace(/\s/g, '').includes(clean));
        if (partial) return partial;
      }
      return null;
    };

    const branchH = getSafeH(['branch']);
    const courseH = getSafeH(['course']);
    const branch = branchH ? rowData[branchH] : 'Unknown';
    const course = courseH ? rowData[courseH] : 'Unknown';

    if (hasAccess(branch, course, role, assignedBranchesArray, assignedCourse)) {
      stats.total++;
      
      const pStatKey = getSafeH(['placementstat', 'placementstatus']);
      const pStatus = (pStatKey && rowData[pStatKey] ? rowData[pStatKey] : 'Pending').toString().trim();
      const pLower = pStatus.toLowerCase();
      
      if (pLower.includes('not responding')) stats.notResponding++;
      else if (pLower.includes('no need')) stats.noNeed++;
      else if (pLower.includes('pending') || pLower === '') stats.pending++;

      stats.branchCounts[branch] = (stats.branchCounts[branch] || 0) + 1;
      stats.courseCounts[course] = (stats.courseCounts[course] || 0) + 1;

      const phoneH = getSafeH(['phone', 'contact']);
      const nameH = getSafeH(['name', 'studentname']);
      const emailH = getSafeH(['mailid', 'email']);
      const rollH = getSafeH(['ipcsrollnumber', 'rollnumber', 'roll']);
      const photoH = getSafeH(['profilephoto', 'photo']);
      const qualH = getSafeH(['qualification', 'qual']);
      const streamH = getSafeH(['stream']);
      const resumeH = getSafeH(['resume', 'cv']);
      const certH = getSafeH(['certificate']);
      
      const statusKey = getSafeH(['coursestatus', 'status(currently']);
      const vacKey = getSafeH(['vacancyopen', 'vaccancyopen']);
      const studyKey = getSafeH(['studymaterialaccess']);
      const examKey = getSafeH(['technialexam', 'technicalexam']);

      students.push({
        rowIdx: row.rowNumber, 
        name: nameH ? rowData[nameH] : '', 
        email: emailH ? rowData[emailH] : '', 
        phone: phoneH ? rowData[phoneH] : 'N/A', 
        roll: rollH ? rowData[rollH] : '', 
        branch: branch, 
        course: course, 
        photo: photoH ? rowData[photoH] : '', 
        qual: qualH ? rowData[qualH] : '', 
        stream: streamH ? rowData[streamH] : '', 
        status: statusKey && rowData[statusKey] ? rowData[statusKey] : 'N/A', 
        resume: resumeH ? rowData[resumeH] : '', 
        certificate: certH ? rowData[certH] : '',
        vacOpen: vacKey && rowData[vacKey] ? rowData[vacKey] : 'Yes', 
        studyAccess: studyKey && rowData[studyKey] ? rowData[studyKey] : 'No', 
        examAccess: examKey && rowData[examKey] ? rowData[examKey] : 'No', 
        placementStatus: pStatus, 
        rawData: rowData
      });
    }
  });
  res.json({ success: true, students: students.reverse(), stats });
};

exports.updateStudent = async (req, res) => {
  const { rowNumber, vacOpen, placementStatus, studyAccess, examAccess, courseStatus, coursePercentage } = req.body;
  try {
    const stuSheet = doc.sheetsByTitle["Data"];
    const rows = await stuSheet.getRows({ offset: rowNumber - 2, limit: 1 });
    if (rows.length > 0) {
      const headers = stuSheet.headerValues;
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

      const vH = getSafeH(['vacancyopen', 'vaccancyopen']); if(vH) updateObj[vH] = vacOpen;
      const pH = getSafeH(['placementstatus', 'placementstat', 'placementstatsu']); if(pH) updateObj[pH] = placementStatus;
      const sH = getSafeH(['studymaterialaccess']); if(sH) updateObj[sH] = studyAccess;
      const eH = getSafeH(['technicalexam', 'technialexam']); if(eH) updateObj[eH] = examAccess;
      
      const cPercH = getSafeH(['coursepercentage']);
      if (cPercH && coursePercentage !== undefined) {
        updateObj[cPercH] = coursePercentage;
      }

      const cStatusH = getSafeH(['coursestatus', 'status(currently']); 
      
      if (cStatusH) {
        let oldStatus = rows[0].get ? (rows[0].get(cStatusH) || '').toString().toLowerCase() : (rows[0][cStatusH] || '').toString().toLowerCase();
        
        if (coursePercentage === '100% completed' || coursePercentage === '100%') {
          updateObj[cStatusH] = 'Completed Course';
          
          if (!oldStatus.includes('completed') && !oldStatus.includes('90%')) {
             let sName = rows[0].get ? (rows[0].get('Name') || 'Student') : (rows[0]['Name'] || 'Student');
             let sEmail = rows[0].get ? (rows[0].get('Mail ID') || rows[0].get('Email') || '') : (rows[0]['Mail ID'] || rows[0]['Email'] || '');
             
             if (sEmail) {
                const refId = Math.floor(10000 + Math.random() * 90000); 
                // 🚨 FIXED URL TO placement.ipcsglobal.info
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
        } else if (courseStatus !== undefined) {
          updateObj[cStatusH] = courseStatus;
        }
      }

      rows[0].assign(updateObj); 
      await rows[0].save(); 
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
    const rowData = row.toObject();
    const getHeader = (searchString) => {
      const cleanSearch = searchString.toLowerCase().replace(/\s/g, '');
      const keys = Object.keys(rowData);
      const exact = keys.find(k => k.toLowerCase().replace(/\s/g, '') === cleanSearch);
      return exact || keys.find(k => k.toLowerCase().replace(/\s/g, '').includes(cleanSearch));
    };
    const branch = rowData[getHeader('branch')] || 'Unknown';
    const course = rowData[getHeader('course')] || 'Unknown';
    const officerKey = getHeader('placementofficer');
    const officerName = officerKey && rowData[officerKey] ? rowData[officerKey].toString().toLowerCase().trim() : '';

    const tpoMatch = (!role || role === 'TPO') && (cleanTpoName !== '' && officerName === cleanTpoName);

    if (hasAccess(branch, course, role, assignedBranchesArray, assignedCourse) || tpoMatch) {
      const roll = rowData[getHeader('roll')] || ''; 
      const jobId = rowData[getHeader('jobid')] || '';
      let phone = rowData[getHeader('contact')] || rowData[getHeader('phone')] || '';
      let email = rowData[getHeader('mail')] || rowData[getHeader('email')] || '';
      let resume = rowData[getHeader('resume')] || rowData[getHeader('cv')] || '';
      let qual = rowData[getHeader('qual')] || '';

      if (!phone || !email) {
        const studentData = cache.students.find(s => {
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

      appsList.push({
        rowNumber: row.rowNumber, name: rowData[getHeader('name')] || '', roll: roll, branch: branch, course: course, qual: qual || 'Not Specified', jobId: jobId, company: rowData[getHeader('company')] || 'Unknown Company', position: rowData[getHeader('position')] || 'Unknown Position', date: rowData[getHeader('time')] || rowData[getHeader('date')] || '', status: rowData[getHeader('status')] || 'Applied', remarks: rowData[getHeader('remarks')] || '', tpoName: rowData[getHeader('placementofficer')] || '', phone: phone, email: email, resume: resume, datePlaced: rowData[getHeader('dateplaced')] || '', packageLpa: rowData[getHeader('package')] || '', offerLetter: rowData[getHeader('offerletter')] || '', joiningStatus: rowData[getHeader('joiningstatus')] || ''
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
    
    if (rows.length > 0) {
      const headers = appSheet.headerValues;
      const currentRowData = rows[0].toObject();
      const getHeader = (s) => Object.keys(currentRowData).find(k => k.toLowerCase().replace(/\s/g, '').includes(s.toLowerCase().replace(/\s/g, '')));
      
      const oldStatus = (currentRowData[getHeader('status')] || '').toString().toLowerCase();

      const sName = currentRowData[getHeader('name')] || currentRowData[getHeader('studentname')] || fullApp.name || '';
      const sContact = currentRowData[getHeader('contact')] || currentRowData[getHeader('phone')] || fullApp.phone || '';
      const sMail = currentRowData[getHeader('mail')] || currentRowData[getHeader('email')] || fullApp.email || '';
      const sRoll = currentRowData[getHeader('roll')] || fullApp.roll || '';
      const sCourse = currentRowData[getHeader('course')] || fullApp.course || '';
      const sBranch = currentRowData[getHeader('branch')] || fullApp.branch || '';
      const sQual = currentRowData[getHeader('qual')] || fullApp.qual || '';
      const sResume = currentRowData[getHeader('resume')] || currentRowData[getHeader('cv')] || fullApp.resume || '';
      const sJobId = currentRowData[getHeader('jobid')] || fullApp.jobId || '';
      const sCompany = currentRowData[getHeader('company')] || fullApp.company || '';
      const sPosition = currentRowData[getHeader('position')] || fullApp.position || '';
      const sTpo = currentRowData[getHeader('placementofficer')] || fullApp.tpoName || '';

      const updateObj = { 'Status': status };
      
      const getSafeH = (sheetHeaders, searchStr) => {
        const cleanStr = searchStr.toLowerCase().replace(/\s/g, '');
        return sheetHeaders.find(h => h.toLowerCase().replace(/\s/g, '') === cleanStr) || 
               sheetHeaders.find(h => h.toLowerCase().replace(/\s/g, '').includes(cleanStr));
      };

      const hRemarks = getSafeH(headers, 'remarks'); if (hRemarks && remarks !== undefined) updateObj[hRemarks] = remarks;
      const hDatePlaced = getSafeH(headers, 'dateplaced'); if (hDatePlaced && datePlaced !== undefined) updateObj[hDatePlaced] = datePlaced;
      const hPackage = getSafeH(headers, 'package'); if (hPackage && packageLpa !== undefined) updateObj[hPackage] = packageLpa;
      const hOffer = getSafeH(headers, 'offerletter'); if (hOffer && offerLetterLink) updateObj[hOffer] = offerLetterLink;
      const hJoining = getSafeH(headers, 'joiningstatus'); if (hJoining && joiningStatus !== undefined) updateObj[hJoining] = joiningStatus;
      
      const hDate = getSafeH(headers, 'interviewdate');
      const hTime = getSafeH(headers, 'interviewtime') || getSafeH(headers, 'intervewtime');
      const hVenue = getSafeH(headers, 'interviewvenue');
      
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
          setLogH('remarks', remarks !== undefined ? remarks : (currentRowData[getHeader('remarks')] || ''));
          setLogH('dateplaced', datePlaced !== undefined ? datePlaced : (currentRowData[getHeader('dateplaced')] || ''));
          setLogH('package', packageLpa !== undefined ? packageLpa : (currentRowData[getHeader('package')] || ''));
          setLogH('offerletterstatus', offerLetterLink || currentRowData[getHeader('offerletter')] || '');
          setLogH('joiningstatus', joiningStatus !== undefined ? joiningStatus : (currentRowData[getHeader('joiningstatus')] || ''));
          setLogH('interviewdate', interviewDate || '');
          setLogH('interviewtime', interviewTime || '');
          setLogH('intervewtime', interviewTime || ''); 
          setLogH('interviewvenue', interviewVenue || '');

          await logSheet.addRow(logObj);
        }
      } catch(e) { console.error("TPO Log skipped due to column mismatch"); }
      
      if (oldStatus !== (status || '').toLowerCase()) {
         checkAndSendStudentMails({
           name: sName, roll: sRoll, email: sMail, company: sCompany, 
           position: sPosition, tpoName: sTpo, branch: sBranch, jobId: sJobId
         }, status, { date: interviewDate, time: interviewTime, venue: interviewVenue }, currentUserEmail)
         .catch(e => console.error("Background Mail Error")); 
      }

      refreshCache(); 
      res.json({ success: true, message: "Updated!" });
    } else { 
      res.status(404).json({ success: false, message: "Row not found." }); 
    }
  } catch (error) { 
    console.error(error);
    res.status(500).json({ success: false, message: error.message }); 
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
    const rowData = row.toObject();
    const getVal = (possibleKeys) => { for(let key of Object.keys(rowData)) { if (possibleKeys.includes(key.trim())) return rowData[key]; } return ''; };
    return {
      id: getVal(['JOBID', 'Job ID', 'ID']) || `JOB-${i+1}`, company: getVal(['Company Name', 'Company']), position: getVal(['Position', 'Role']), location: getVal(['Opening AT ( Location )', 'Opening AT( Location )', 'Location']), state: getVal(['State']), mode: getVal(['Work Mode', 'Mode']), lastDate: getVal(['Last Date']), course: getVal(['Course']), qualification: getVal(['Qualification']), description: getVal(['Job Description']), experience: getVal(['Experience']), salary: getVal(['Salary']), gender: getVal(['Gender Preference']), status: getVal(['Status']) || 'Open'
    };
  });
  res.json({ success: true, vacancies: vacs.reverse() });
};

exports.getIssues = (req, res) => {
  const { assignedBranchesArray, role, assignedCourse } = req.body;
  let issuesList = getCache().issues.filter(row => {
    const rowBranch = row.get('Branch');
    const studentName = row.get('Name') || '';
    const studentData = getCache().students.find(s => (s.get('Name') || '').toLowerCase().trim() === studentName.toLowerCase().trim());
    const sCourse = studentData ? studentData.get('Course') : 'Unknown';
    return hasAccess(rowBranch, sCourse, role, assignedBranchesArray, assignedCourse);
  }).map(row => ({ rowNumber: row.rowNumber, name: row.get('Name') || 'Student', branch: row.get('Branch'), details: row.get('Issue Details') || '', status: row.get('Status') || 'Pending', remarks: row.get('Remarks') || '' }));
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
    if(!hasAccess(row.get('Branch'), row.get('Course'), role, assignedBranchesArray, assignedCourse)) return;
    students.push({ name: row.get('Name'), roll: row.get('Roll Number'), branch: row.get('Branch'), course: row.get('Course'), status: row.get('Status'), placementStatus: row.get('Placement Stat') || row.get('Placement Status') });
  });
  
  getCache().applications.forEach(row => {
    if(!hasAccess(row.get('Branch'), row.get('Course'), role, assignedBranchesArray, assignedCourse)) return;
    applications.push({ name: row.get('Student Name'), roll: row.get('Roll Number'), jobId: row.get('Job ID'), company: row.get('Company Name'), date: row.get('TimeStamp'), status: row.get('Status'), remarks: row.get('Remarks'), tpoName: row.get('Placement Officer'), branch: row.get('Branch'), course: row.get('Course') });
  });
  
  getCache().issues.forEach(row => { 
    if (hasAccess(row.get('Branch'), row.get('Course'), role, assignedBranchesArray, assignedCourse)) issues.push({ name: row.get('Name'), branch: row.get('Branch'), details: row.get('Issue Details'), status: row.get('Status'), remarks: row.get('Remarks') }); 
  });
  
  getCache().tAtt.forEach(row => { 
    if (hasAccess(row.get('Branch'), row.get('Course'), role, assignedBranchesArray, assignedCourse)) talentino.push({ name: row.get('Name'), branch: row.get('Branch'), date: row.get('Check-in') || row.get('Date'), rating: row.get('Rating'), notes: row.get('Notes') }); 
  });
  
  let vacancies = getCache().vacancies.map(row => ({ id: row.get('Job ID') || row.get('ID') || '', company: row.get('Company') || '', location: row.get('Location') || '', mode: row.get('Mode') || '', status: row.get('Status') || 'Open', course: row.get('Course') || '', date: row.get('Last Date') || row.get('Date') || '' }));
  let events = getCache().events.map(row => ({ date: row.get('Date') || '' }));

  if (getCache().tpoLogs) {
    getCache().tpoLogs.forEach(row => { tpoLogs.push(row.toObject()); });
  }

  res.json({ success: true, students, applications, issues, talentino, vacancies, events, tpoLogs });
};

exports.getTalentino = (req, res) => {
  const { assignedBranchesArray, role, assignedCourse } = req.body;
  let records = getCache().tAtt.filter(row => {
    const rowBranch = row.get('Branch');
    const studentName = row.get('Name') || row.get('Student') || '';
    const studentData = getCache().students.find(s => (s.get('Name') || '').toLowerCase().trim() === studentName.toLowerCase().trim());
    const sCourse = studentData ? studentData.get('Course') : 'Unknown';
    return hasAccess(rowBranch, sCourse, role, assignedBranchesArray, assignedCourse);
  }).map(row => {
    const rowData = row.toObject();
    const getVal = (searchStrings) => { for (let key of Object.keys(rowData)) { for (let str of searchStrings) { if (key.toLowerCase().includes(str.toLowerCase())) return rowData[key]; } } return ''; };
    return { name: getVal(['name', 'student']), branch: getVal(['branch']), date: getVal(['present check-ins date', 'timestamp', 'date', 'time']), rating: getVal(['rating']), notes: getVal(['notes', 'remark']) };
  });
  let dates = new Set();
  records.forEach(r => { const cleanDate = (r.date || '').split(' ')[0].trim(); if (cleanDate && cleanDate !== 'N/A') dates.add(cleanDate); });
  res.json({ success: true, dates: Array.from(dates).sort().reverse(), records: records.reverse() });
};


exports.getEvents = (req, res) => {
  let allEvents = getCache().events.map(row => {
    const rowData = row.toObject();
    const getVal = (possibleKeys) => { for(let key of Object.keys(rowData)) { if (possibleKeys.includes(key.trim())) return rowData[key]; } return ''; };
    return {
      date: getVal(['Date of the Event', 'Date']), tpo: getVal(['TPO', 'Placement Officer']), branch: getVal(['Branch']), type: getVal(['Event', 'Type']), title: getVal(['Title']), description: getVal(['Descripation', 'Description']), time: getVal(['Time of the Event', 'Time']), location: getVal(['Event Happening in', 'Location']), poster: getVal(['Poster Link', 'Poster'])
    };
  });
  res.json({ success: true, events: allEvents.filter(e => e.date && e.title) });
};

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
    
    if (evType.includes('placement drive')) {
      const allTpos = getAllTpoEmails();
      const allBMs = getAllBranchManagerEmails();
      const superAdmins = getSuperAdminEmails();
      
      const bccList = [...new Set(allBMs)].filter(Boolean).join(',');
      const ccList = [...new Set([...superAdmins, ...allTpos])].filter(Boolean).join(',');

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
                  <tr><td style="padding: 6px 0; color: #64748b;">Description:</td><td style="padding: 6px 0; color: #334155;">${description || 'N/A'}</td></tr>
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

      // 🚨 CRITICAL FIX: Await prevents the request from ending before the email is sent
      await sendMailAndLog({
        from: `"IPCS Placements" <${senderEmail}>`,
        to: senderEmail, 
        bcc: bccList, 
        cc: ccList,
        subject: `Placement Drive Notification – ${date} | ${time || 'TBD'} [Ref: ${refId}]`,
        html: html
      }, { name: 'All Branches', email: 'Broadcast', type: 'Event Notification' });

    } else if (evType.includes('talentino')) {
      const tpoMail = getTpoEmail(tpo);
      const bmMail = getBranchManagerEmail(branch);
      const ccList = [bmMail, 'gifty@ipcsglobal.com'].filter(Boolean).join(',');
      const sendTo = tpoMail || bmMail || 'gifty@ipcsglobal.com';
      
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
                  <tr><td style="padding: 6px 0; color: #64748b;">Description:</td><td style="padding: 6px 0; color: #334155;">${description || 'N/A'}</td></tr>
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

      // 🚨 CRITICAL FIX: Await prevents the request from ending before the email is sent
      await sendMailAndLog({
        from: `"IPCS Talentino" <${senderEmail}>`,
        to: sendTo,
        cc: ccList,
        subject: `Talentino Session Notification – ${date} | ${time || 'TBD'} [Ref: ${refId}]`,
        html: html
      }, { name: tpo, email: sendTo, type: 'Event Notification' });
    }

    refreshCache(); res.json({ success: true, message: "Event added successfully" });
  } catch (error) { 
    console.error("Event add error:", error);
    res.status(500).json({ success: false, message: error.message }); 
  }
};

// --- CRON HELPER (RESUME DELIVERY) ---
exports.runDailyCron = async () => {
  const cache = getCache();
  if (!cache) return;
  
  const yesterday = new Date(); 
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split('T')[0]; 
  
  const expiredJobs = cache.vacancies.filter(v => {
    const rowData = v.toObject();
    const getH = (str) => Object.keys(rowData).find(k => k.toLowerCase().replace(/\s/g, '') === str.toLowerCase().replace(/\s/g, ''));
    const lastDateKey = getH('lastdate');
    
    if (!lastDateKey || !rowData[lastDateKey]) return false;
    try { 
      let pd = rowData[lastDateKey];
      if (pd.includes('/')) {
        const parts = pd.split(/[/\s,.-]+/);
        if (parts.length >= 3) pd = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      return new Date(pd).toISOString().split('T')[0] === yStr; 
    } catch(e) { return false; }
  });

  for (let job of expiredJobs) {
    const jobData = job.toObject();
    const getJobH = (str) => Object.keys(jobData).find(k => k.toLowerCase().replace(/\s/g, '') === str.toLowerCase().replace(/\s/g, ''));
    
    const jobId = jobData[getJobH('jobid')] || jobData[getJobH('id')] || '';
    const companyEmail = jobData[getJobH('companymailid')] || jobData[getJobH('companyemail')] || ''; 
    const companyName = jobData[getJobH('companyname')] || jobData[getJobH('company')] || '';
    const position = jobData[getJobH('position')] || jobData[getJobH('role')] || '';

    if (!companyEmail) continue;

    const cleanTargetJobId = jobId.toString().toLowerCase().replace(/\s/g, '');

    const applicants = cache.applications.filter(app => {
      const appData = app.toObject();
      const getAppH = (str) => Object.keys(appData).find(k => k.toLowerCase().replace(/\s/g, '') === str.toLowerCase().replace(/\s/g, ''));
      const appJobId = (appData[getAppH('jobid')] || '').toString().toLowerCase().replace(/\s/g, '');
      return appJobId === cleanTargetJobId && cleanTargetJobId !== '';
    });

    if (applicants.length === 0) continue;

    const firstApp = applicants[0].toObject();
    const getFirstAppH = (str) => Object.keys(firstApp).find(k => k.toLowerCase().replace(/\s/g, '') === str.toLowerCase().replace(/\s/g, ''));
    const tpoName = firstApp[getFirstAppH('placementofficer')];
    const tpoEmail = getTpoEmail(tpoName);

    let tableRows = ''; let attachments = [];
    applicants.forEach((appRow, index) => {
      const rd = appRow.toObject();
      const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/\s/g, '') === str.toLowerCase().replace(/\s/g, ''));
      const info = { 
        name: rd[getH('name')] || rd[getH('studentname')] || '', 
        phone: rd[getH('contact')] || rd[getH('phone')] || '', 
        email: rd[getH('mail')] || rd[getH('email')] || rd[getH('mailid')] || '', 
        qual: rd[getH('qual')] || rd[getH('qualification')] || '', 
        resume: rd[getH('resume')] || rd[getH('cv')] || '' 
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

// =========================================================
// 🚨 SAFER STRICT MATCHING FOR CLIENTS SHEET
// =========================================================
const getSafeClientHeader = (keys, searchStrs) => {
  for (let s of searchStrs) {
    const cleanSearch = s.toLowerCase().replace(/\s/g, '');
    const exact = keys.find(k => k.toLowerCase().replace(/\s/g, '') === cleanSearch);
    if (exact) return exact;
  }
  for (let s of searchStrs) {
    const cleanSearch = s.toLowerCase().replace(/\s/g, '');
    const partial = keys.find(k => k.toLowerCase().replace(/\s/g, '').includes(cleanSearch));
    if (partial) return partial;
  }
  return null;
};

exports.getClients = (req, res) => {
  const cleanTpoName = (req.body.tpoName || '').toString().toLowerCase().trim();
  let clients = [];
  getCache().clients.forEach(row => {
    const rowData = row.toObject();
    const keys = Object.keys(rowData);
    
    const hOfficer = getSafeClientHeader(keys, ['placementofficer', 'tponame']);
    const hComp = getSafeClientHeader(keys, ['companyname', 'company']);
    const hWeb = getSafeClientHeader(keys, ['companywebsite', 'website']);
    const hLoc = getSafeClientHeader(keys, ['companylocation', 'location']);
    const hContact = getSafeClientHeader(keys, ['companycontact', 'contactnumber', 'phone']);
    const hEmail = getSafeClientHeader(keys, ['companymailid', 'companyemail', 'mailid', 'email']);
    const hPerson = getSafeClientHeader(keys, ['companycontactperson', 'contactperson', 'person']);
    const hLogo = getSafeClientHeader(keys, ['companylogo', 'logo']);
    const hMailStat = getSafeClientHeader(keys, ['mailstatus']);
    const hDocStat = getSafeClientHeader(keys, ['documentstatus', 'docstatus']);
    const hMou = getSafeClientHeader(keys, ['mou', 'moulink']);

    const officer = hOfficer && rowData[hOfficer] ? rowData[hOfficer].toString().toLowerCase().trim() : '';
    
    if (cleanTpoName === '' || officer === '' || officer.includes(cleanTpoName) || cleanTpoName.includes(officer)) {
      clients.push({ 
        rowNumber: row.rowNumber, 
        companyName: (hComp && rowData[hComp]) || 'Unknown', 
        website: (hWeb && rowData[hWeb]) || '', 
        location: (hLoc && rowData[hLoc]) || '', 
        contact: (hContact && rowData[hContact]) || '', 
        email: (hEmail && rowData[hEmail]) || '', 
        contactPerson: (hPerson && rowData[hPerson]) || '', 
        logo: (hLogo && rowData[hLogo]) || '', 
        mailStatus: (hMailStat && rowData[hMailStat]) || 'Pending', 
        documentStatus: (hDocStat && rowData[hDocStat]) || 'Pending', 
        mouLink: (hMou && rowData[hMou]) || '' 
      });
    }
  });
  res.json({ success: true, clients: clients.reverse() });
};

exports.getClientById = (req, res) => {
  const targetRow = parseInt(req.params.id);
  const row = getCache().clients.find(r => r.rowNumber === targetRow);
  if (!row) return res.status(404).json({ success: false, message: "Client not found" });
  
  const rowData = row.toObject();
  const keys = Object.keys(rowData);
  
  const hComp = getSafeClientHeader(keys, ['companyname', 'company']);
  const hEmail = getSafeClientHeader(keys, ['companymailid', 'companyemail', 'mailid', 'email']);
  const hPerson = getSafeClientHeader(keys, ['companycontactperson', 'contactperson', 'person']);
  const hContact = getSafeClientHeader(keys, ['companycontact', 'contactnumber', 'phone']);
  const hLogo = getSafeClientHeader(keys, ['companylogo', 'logo']);
  const hDocStat = getSafeClientHeader(keys, ['documentstatus', 'docstatus']);

  res.json({ success: true, client: { 
    rowNumber: row.rowNumber, 
    companyName: (hComp && rowData[hComp]) || 'Unknown', 
    email: (hEmail && rowData[hEmail]) || '', 
    contactPerson: (hPerson && rowData[hPerson]) || '', 
    contact: (hContact && rowData[hContact]) || '', 
    logo: (hLogo && rowData[hLogo]) || '', 
    documentStatus: (hDocStat && rowData[hDocStat]) || 'Pending' 
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
      
      const hEmail = getSafeClientHeader(headers, ['companymailid', 'companyemail', 'mailid', 'email']);
      if(hEmail && email !== undefined) updateObj[hEmail] = email;
      
      const hPhone = getSafeClientHeader(headers, ['companycontact', 'contactnumber', 'contact', 'phone']);
      if(hPhone && phone !== undefined) updateObj[hPhone] = phone;
      
      const hLoc = getSafeClientHeader(headers, ['companylocation', 'location']);
      if(hLoc && location !== undefined) updateObj[hLoc] = location;
      
      const hPerson = getSafeClientHeader(headers, ['companycontactperson', 'contactperson', 'person']);
      if(hPerson && contactPerson !== undefined) updateObj[hPerson] = contactPerson;
      
      const hLogo = getSafeClientHeader(headers, ['companylogo', 'logo']);
      if(hLogo && logoLink) updateObj[hLogo] = logoLink;

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
    // 🚨 FIXED: Now explicitly uses talenzo.ipcsglobal.info
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
      const statusCol = getSafeClientHeader(sheet.headerValues, ['mailstatus', 'status']);
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
      
      const hDocStat = getSafeClientHeader(headers, ['documentstatus', 'docstatus']);
      if(hDocStat) updateObj[hDocStat] = 'Completed';
      
      const hMou = getSafeClientHeader(headers, ['mou', 'moulink']);
      if(hMou) updateObj[hMou] = pdfLink;
      
      const hLogo = getSafeClientHeader(headers, ['companylogo', 'logo']);
      if(hLogo && logoLink) updateObj[hLogo] = logoLink;

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

exports.getMaterials = (req, res) => {
  try {
    let materials = getCache().materials.map(row => {
      const rd = row.toObject(); const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/\s/g, '') === str.toLowerCase().replace(/\s/g, ''));
      return { id: rd[getH('materialid')] || '', course: rd[getH('course')] || '', module: rd[getH('module/topic')] || rd[getH('module')] || rd[getH('topic')] || '', title: rd[getH('title')] || '', fileType: rd[getH('filetype')] || '', link: rd[getH('onedrivelink')] || rd[getH('link')] || '', status: rd[getH('status')] || 'Active' };
    });
    res.json({ success: true, materials: materials.reverse() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addMaterial = async (req, res) => {
  try {
    const { id, course, module, title, fileType, link, status } = req.body;
    const sheet = doc.sheetsByTitle["Study_Materials"];
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    const h = sheet.headerValues;
    await sheet.addRow({ [getFuzzyHeader(h, 'materialid')]: id, [getFuzzyHeader(h, 'course')]: course, [getFuzzyHeader(h, 'module/topic')]: module, [getFuzzyHeader(h, 'title')]: title, [getFuzzyHeader(h, 'filetype')]: fileType, [getFuzzyHeader(h, 'onedrivelink')]: link, [getFuzzyHeader(h, 'status')]: status || 'Active' });
    refreshCache(); res.json({ success: true, message: "Material added successfully!" });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateMaterial = async (req, res) => {
  try {
    const { id, course, module, title, fileType, link, status } = req.body;
    const sheet = doc.sheetsByTitle["Study_Materials"];
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    const rows = await sheet.getRows();
    const rowToUpdate = rows.find(r => (r.get('Material ID') || r.get('materialid') || '').toString().trim() === id.toString().trim());
    if (rowToUpdate) {
      const h = sheet.headerValues;
      rowToUpdate.assign({ [getFuzzyHeader(h, 'materialid')]: id, [getFuzzyHeader(h, 'course')]: course, [getFuzzyHeader(h, 'module/topic')]: module, [getFuzzyHeader(h, 'title')]: title, [getFuzzyHeader(h, 'filetype')]: fileType, [getFuzzyHeader(h, 'onedrivelink')]: link, [getFuzzyHeader(h, 'status')]: status || 'Active' });
      await rowToUpdate.save(); refreshCache(); res.json({ success: true, message: "Material updated successfully!" });
    } else { res.status(404).json({ success: false, message: "Material ID not found." }); }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteMaterial = async (req, res) => {
  try {
    const { id } = req.body;
    const sheet = doc.sheetsByTitle["Study_Materials"];
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    const rows = await sheet.getRows();
    const rowToDelete = rows.find(r => (r.get('Material ID') || r.get('materialid') || '').toString().trim() === id.toString().trim());
    if (rowToDelete) { await rowToDelete.delete(); refreshCache(); res.json({ success: true, message: "Material deleted successfully!" }); } 
    else { res.status(404).json({ success: false, message: "Material ID not found." }); }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getQuestions = (req, res) => {
  try {
    let questions = getCache().techQuestions.map(row => {
      const rd = row.toObject(); const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/\s/g, '') === str.toLowerCase().replace(/\s/g, ''));
      return { id: rd[getH('questionid')] || '', course: rd[getH('course')] || '', question: rd[getH('question')] || '', optA: rd[getH('optiona')] || '', optB: rd[getH('optionb')] || '', optC: rd[getH('optionc')] || '', optD: rd[getH('optiond')] || '', correct: rd[getH('correctoption')] || '', explanation: rd[getH('explanation')] || '', status: rd[getH('status')] || 'Active' };
    });
    res.json({ success: true, questions: questions.reverse() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addQuestion = async (req, res) => {
  try {
    const { id, course, question, optA, optB, optC, optD, correct, explanation, status } = req.body;
    const sheet = doc.sheetsByTitle["Tech_Questions"];
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    await sheet.addRow({ 'Question ID': id, 'Course': course, 'Question': question, 'Option A': optA, 'Option B': optB, 'Option C': optC, 'Option D': optD, 'Correct Option': correct, 'Explanation': explanation, 'Status': status || 'Active' });
    refreshCache(); res.json({ success: true, message: "Question added successfully!" });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateQuestion = async (req, res) => {
  try {
    const { id, course, question, optA, optB, optC, optD, correct, explanation, status } = req.body;
    const sheet = doc.sheetsByTitle["Tech_Questions"];
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    const rows = await sheet.getRows();
    const rowToUpdate = rows.find(r => (r.get('Question ID') || '').toString().trim() === id.toString().trim());
    if (rowToUpdate) {
      rowToUpdate.assign({ 'Question ID': id, 'Course': course, 'Question': question, 'Option A': optA, 'Option B': optB, 'Option C': optC, 'Option D': optD, 'Correct Option': correct, 'Explanation': explanation, 'Status': status || 'Active' });
      await rowToUpdate.save(); refreshCache(); res.json({ success: true, message: "Technical question updated successfully!" });
    } else { res.status(404).json({ success: false, message: "Question ID not found." }); }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const { id } = req.body;
    const sheet = doc.sheetsByTitle["Tech_Questions"];
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    const rows = await sheet.getRows();
    const rowToDelete = rows.find(r => r.get('Question ID') === id);
    if (rowToDelete) { await rowToDelete.delete(); refreshCache(); res.json({ success: true, message: "Question deleted" }); } 
    else { res.status(404).json({ success: false, message: "Question not found" }); }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getResults = (req, res) => {
  try {
    let results = getCache().techResults.map(row => {
      const rd = row.toObject(); const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/\s/g, '') === str.toLowerCase().replace(/\s/g, ''));
      return { timestamp: rd[getH('timestamp')] || '', rollNo: rd[getH('rollno')] || '', name: rd[getH('name')] || '', email: rd[getH('mailid')] || '', branch: rd[getH('branch')] || '', course: rd[getH('course')] || '', score: rd[getH('score')] || '', total: rd[getH('totalquestions')] || '', percentage: rd[getH('percentage')] || '', timeTaken: rd[getH('timetaken')] || '' };
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
      const rd = row.toObject(); const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/\s/g, '') === str.toLowerCase().replace(/\s/g, ''));
      return { id: rd[getH('qid')] || '', category: rd[getH('category')] || '', question: rd[getH('question')] || '', optA: rd[getH('optiona')] || '', optB: rd[getH('optionb')] || '', optC: rd[getH('optionc')] || '', optD: rd[getH('optiond')] || '', correct: rd[getH('correctoption')] || '', explanation: rd[getH('explanation')] || '', status: rd[getH('status')] || 'Active', level: rd[getH('level')] || 'Easy' };
    });
    res.json({ success: true, questions: questions.reverse() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getAptResults = (req, res) => {
  try {
    let results = getCache().aptResults.map(row => {
      const rd = row.toObject(); const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/\s/g, '') === str.toLowerCase().replace(/\s/g, ''));
      return { timestamp: rd[getH('timestamp')] || '', rollNo: rd[getH('rollno')] || '', name: rd[getH('name')] || '', email: rd[getH('email')] || rd[getH('mailid')] || '', branch: rd[getH('branch')] || '', score: rd[getH('score')] || '', total: rd[getH('total')] || rd[getH('totalquestions')] || '', percentage: rd[getH('percentage')] || '', timeTaken: rd[getH('timetaken')] || '', categoryBreakdown: rd[getH('categorybreakdown')] || '' };
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
    const rowToUpdate = rows.find(r => (r.get('QID') || r.get('qid') || '').toString().trim() === id.toString().trim());
    if (rowToUpdate) {
      const h = sheet.headerValues;
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
    const rowToDelete = rows.find(r => r.get('QID') === id || r.get('qid') === id);
    if (rowToDelete) { await rowToDelete.delete(); refreshCache(); res.json({ success: true, message: "Question deleted" }); } 
    else { res.status(404).json({ success: false, message: "Question not found" }); }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getTalExamQuestions = (req, res) => {
  try {
    let questions = getCache().talQuestions.map(row => {
      const rd = row.toObject(); const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/\s/g, '') === str.toLowerCase().replace(/\s/g, ''));
      return { id: rd[getH('questionid')] || '', testNumber: rd[getH('textnumber')] || rd[getH('testnumber')] || '', question: rd[getH('question')] || '', optA: rd[getH('optiona')] || '', optB: rd[getH('optionb')] || '', optC: rd[getH('optionc')] || '', optD: rd[getH('optiond')] || '', correct: rd[getH('correctoption')] || '', explanation: rd[getH('explanation')] || '', status: rd[getH('status')] || 'Active' };
    });
    res.json({ success: true, questions: questions.reverse() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getTalExamResults = (req, res) => {
  try {
    let results = getCache().talResults.map(row => {
      const rd = row.toObject(); const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/\s/g, '') === str.toLowerCase().replace(/\s/g, ''));
      return { timestamp: rd[getH('timestamp')] || '', rollNo: rd[getH('rollno')] || '', name: rd[getH('name')] || '', email: rd[getH('mailid')] || rd[getH('email')] || '', branch: rd[getH('branch')] || '', testNumber: rd[getH('testnumbercompleted')] || '', score: rd[getH('score')] || '', total: rd[getH('totalquestions')] || '', percentage: rd[getH('percentage')] || '', timeTaken: rd[getH('timetaken')] || '' };
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
    const rowToUpdate = rows.find(r => (r.get('Question ID') || r.get('questionid') || '').toString().trim() === id.toString().trim());
    if (rowToUpdate) {
      const h = sheet.headerValues;
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
    const rowToDelete = rows.find(r => r.get('Question ID') === id || r.get('questionid') === id);
    if (rowToDelete) { await rowToDelete.delete(); refreshCache(); res.json({ success: true, message: "Question deleted" }); } 
    else { res.status(404).json({ success: false, message: "Question not found" }); }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getDrives = (req, res) => {
  try {
    const drivesData = (getCache().drives || []).map(row => {
      const rd = row.toObject();
      const getH = (str) => {
        const c = str.toLowerCase().replace(/\s/g, ''); const keys = Object.keys(rd);
        return keys.find(k => k.toLowerCase().replace(/\s/g, '') === c) || keys.find(k => k.toLowerCase().replace(/\s/g, '').includes(c));
      };
      return {
        rowNumber: row.rowNumber, driveId: rd[getH('driveid')] || '', name: rd[getH('name')] || '', phone: rd[getH('contact')] || '',
        email: rd[getH('mailid')] || rd[getH('email')] || '', course: rd[getH('course')] || '', branch: rd[getH('branch')] || '',
        resume: rd[getH('resume')] || '', qual: rd[getH('qualification')] || '', regStatus: rd[getH('status')] || '',
        regDate: rd[getH('registeddate')] || rd[getH('timestamp')] || '', studentStatus: rd[getH('studentstatus')] || ''
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
    const branches = getCache().branches.map(row => {
      const rd = row._rawData; 
      return { no: rd[0] || '', region: rd[1] || '', branch: rd[2] || '' };
    });
    res.json({ success: true, branches });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
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