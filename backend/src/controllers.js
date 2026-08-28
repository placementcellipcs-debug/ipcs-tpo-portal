const { doc, getCache, refreshCache, hasAccess, getFuzzyHeader, sendIPCSMail, uploadToDrive } = require('./config');

const FOLDER_OFFER_LETTERS = '1184PpFnRndFM0pwIt1Qob_FHMs8hPjV5';
const FOLDER_CLIENT_LOGOS = '11M8jGi1ISWP2mOpWRZncHhThHLoc7cDi'; 
const FOLDER_MOU_CERTIFICATES = '1Hu1zPs56nFXyJPSl7PVfs-oFW4QrKqiD';

// --- AUTHENTICATION ---
exports.login = async (req, res) => {
  const { email, password } = req.body;
  try {
    await doc.loadInfo();
    const cleanInput = (email || '').toString().trim().toLowerCase();
    const cleanPass = (password || '').toString().trim();
    let foundUser = null; let role = 'TPO'; let course = 'All'; let nameField = 'username';

    const contactSheet = doc.sheetsByTitle["Contact"];
    if (contactSheet) {
      const rows = await contactSheet.getRows();
      for (let row of rows) {
        const rowObj = row.toObject(); const cleanKeys = {};
        for (let key in rowObj) cleanKeys[key.toLowerCase().replace(/\s/g, '')] = rowObj[key];
        const sheetMail = (cleanKeys['mailid'] || cleanKeys['email'] || '').toString().trim().toLowerCase();
        const sheetLoginId = (cleanKeys['loginid'] || cleanKeys['username'] || '').toString().trim().toLowerCase();
        const sheetPass = (cleanKeys['password'] || '').toString().trim();
        if ((sheetMail === cleanInput || sheetLoginId === cleanInput) && sheetPass === cleanPass && cleanInput !== '') {
          foundUser = cleanKeys; role = (cleanKeys['role'] || 'TPO').toString().toUpperCase().trim(); course = (cleanKeys['course'] || 'All').toString().trim(); nameField = 'tponame'; break;
        }
      }
    }

    if (!foundUser) {
      const userSheet = doc.sheetsByTitle["User"];
      if (userSheet) {
        const rows = await userSheet.getRows();
        for (let row of rows) {
          const rowObj = row.toObject(); const cleanKeys = {};
          for (let key in rowObj) cleanKeys[key.toLowerCase().replace(/\s/g, '')] = rowObj[key];
          const sheetUsername = (cleanKeys['username'] || cleanKeys['name'] || '').toString().trim().toLowerCase();
          const sheetMail = (cleanKeys['mailid'] || cleanKeys['email'] || '').toString().trim().toLowerCase();
          const sheetLoginId = (cleanKeys['loginid'] || '').toString().trim().toLowerCase();
          const sheetPass = (cleanKeys['password'] || '').toString().trim();
          if ((sheetUsername === cleanInput || sheetMail === cleanInput || sheetLoginId === cleanInput) && sheetPass === cleanPass && cleanInput !== '') {
            foundUser = cleanKeys; role = (cleanKeys['role'] || 'RTH').toString().toUpperCase().trim(); course = (cleanKeys['course'] || 'All').toString().trim(); nameField = 'username'; break;
          }
        }
      }
    }

    if (!foundUser) return res.status(401).json({ success: false, message: "Invalid Login ID or Password." });

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

    return res.json({ success: true, tpo: { name: foundUser[nameField] || foundUser['name'] || 'User', email: foundUser['mailid'] || foundUser['email'] || cleanInput, loginId: cleanInput, sittingBranch: foundUser['sittingbranch'] || 'N/A', assignedBranchesArray: assignedArray, photo: foundUser['profilephoto'] || foundUser['photo'] || '', phone: foundUser['contactnumber'] || foundUser['contact'] || foundUser['phoneno'] || 'Not Provided', role: role, assignedCourse: course, accessType: accessType } });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// --- DASHBOARD ---
exports.getDashboardStats = (req, res) => {
  const { assignedBranchesArray, role, assignedCourse } = req.body;
  const cache = getCache();
  let studentCount = 0, pendingApps = 0, placedCount = 0, activeVacs = 0;

  cache.students.forEach(row => { 
    const rowData = row.toObject();
    const getHeader = (s) => Object.keys(rowData).find(k => k.toLowerCase().replace(/\s/g, '').includes(s.toLowerCase().replace(/\s/g, '')));
    if (hasAccess(rowData[getHeader('branch')], rowData[getHeader('course')], role, assignedBranchesArray, assignedCourse)) studentCount++; 
  });
  
  // 🚨 FIX: Force backend to strictly read from Opening_Applied
  const appSource = cache.applications || [];
  
  appSource.forEach(row => {
    const rowData = row.toObject();
    const getHeader = (s) => Object.keys(rowData).find(k => k.toLowerCase().replace(/\s/g, '').includes(s.toLowerCase().replace(/\s/g, '')));
    if (hasAccess(rowData[getHeader('branch')], rowData[getHeader('course')], role, assignedBranchesArray, assignedCourse)) {
      const stat = (rowData[getHeader('status')] || '').toString().toLowerCase();
      if (stat === 'applied') pendingApps++;
      if (stat.includes('placed') || stat.includes('joined') || stat.includes('offer')) placedCount++;
    }
  });
  
  cache.vacancies.forEach(row => {
    if ((row.get('Status') || 'Open').toString().toLowerCase().includes('open') || (row.get('Status') || '').toString().toLowerCase().includes('yes')) activeVacs++;
  });

  let eventsList = cache.events.slice(-8).map(row => ({ title: row.get('Title') || 'Event', date: row.get('Date') || '', time: row.get('Time') || '', type: row.get('Type') || 'Placement Drive', location: row.get('Location') || '' }));
  res.json({ success: true, stats: { totalStudents: studentCount, pendingApps, placed: placedCount, activeVacancies: activeVacs }, events: eventsList.reverse() });
};

// --- STUDENTS ---
exports.getStudents = (req, res) => {
  const { assignedBranchesArray, role, assignedCourse } = req.body;
  const cache = getCache();
  let students = []; let stats = { total: 0, pending: 0, notResponding: 0, noNeed: 0, branchCounts: {}, courseCounts: {} };

  cache.students.forEach(row => {
    const rowData = row.toObject();
    const getHeader = (searchString) => Object.keys(rowData).find(k => k.toLowerCase().replace(/\s/g, '').includes(searchString.toLowerCase().replace(/\s/g, '')));
    const branch = rowData[getHeader('branch')] || 'Unknown';
    const course = rowData[getHeader('course')] || 'Unknown';

    if (hasAccess(branch, course, role, assignedBranchesArray, assignedCourse)) {
      stats.total++;
      const pStatKey = getHeader('placementstat');
      const pStatus = (pStatKey && rowData[pStatKey] ? rowData[pStatKey] : 'Pending').toString().trim();
      const pLower = pStatus.toLowerCase();
      
      if (pLower.includes('not responding')) stats.notResponding++;
      else if (pLower.includes('no need')) stats.noNeed++;
      else if (pLower.includes('pending') || pLower === '') stats.pending++;

      stats.branchCounts[branch] = (stats.branchCounts[branch] || 0) + 1;
      stats.courseCounts[course] = (stats.courseCounts[course] || 0) + 1;

      const phone = rowData[getHeader('phone')] || rowData[getHeader('contact')] || 'N/A';
      const statusKey = getHeader('currentlystudying');
      const status = statusKey && rowData[statusKey] ? rowData[statusKey] : 'N/A';
      const vacKey = getHeader('vacancyopen') || getHeader('vaccancyopen');
      const studyKey = getHeader('studymaterialaccess');
      const examKey = getHeader('technialexam');

      students.push({
        rowIdx: row.rowNumber, name: rowData[getHeader('name')] || '', email: rowData[getHeader('mailid')] || rowData[getHeader('email')] || '', 
        phone: phone, roll: rowData[getHeader('ipcsrollnumber')] || rowData[getHeader('rollnumber')] || rowData[getHeader('roll')] || '', 
        branch: branch, course: course, photo: rowData[getHeader('profilephoto')] || rowData[getHeader('photo')] || '', 
        qual: rowData[getHeader('qualification')] || '', stream: rowData[getHeader('stream')] || '', status: status, 
        resume: rowData[getHeader('resume')] || rowData[getHeader('cv')] || '', certificate: rowData[getHeader('certificate')] || '',
        vacOpen: (vacKey && rowData[vacKey] ? rowData[vacKey] : 'Yes'), 
        studyAccess: (studyKey && rowData[studyKey] ? rowData[studyKey] : 'No'), // 🚨 ADDED
        examAccess: (examKey && rowData[examKey] ? rowData[examKey] : 'No'), // 🚨 ADDED
        placementStatus: pStatus, rawData: rowData
      });
    }
  });
  res.json({ success: true, students: students.reverse(), stats });
};

exports.updateStudent = async (req, res) => {
  const { rowNumber, vacOpen, placementStatus, studyAccess, examAccess } = req.body;
  try {
    const stuSheet = doc.sheetsByTitle["Data"];
    const rows = await stuSheet.getRows({ offset: rowNumber - 2, limit: 1 });
    if (rows.length > 0) {
      const headers = stuSheet.headerValues;
      const updateObj = {};
      const vH = getFuzzyHeader(headers, 'vacancyopen'); if(vH) updateObj[vH] = vacOpen;
      const pH = getFuzzyHeader(headers, 'placementstat'); if(pH) updateObj[pH] = placementStatus;
      const sH = getFuzzyHeader(headers, 'studymaterialaccess'); if(sH) updateObj[sH] = studyAccess;
      const eH = getFuzzyHeader(headers, 'technialexam'); if(eH) updateObj[eH] = examAccess;

      rows[0].assign(updateObj); await rows[0].save(); refreshCache(); 
      res.json({ success: true, message: "Student record updated!" });
    } else { res.status(404).json({ success: false, message: "Row not found." }); }
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// --- APPLICATIONS ---
exports.getApplications = (req, res) => {
  const { assignedBranchesArray, role, assignedCourse, tpoName } = req.body;
  let appsList = []; // 🚨 Changed from appsMap to a flat array
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

      // 🚨 Directly push to array to prevent data overwriting
      appsList.push({
        rowNumber: row.rowNumber, name: rowData[getHeader('name')] || '', roll: roll, branch: branch, course: course, qual: qual || 'Not Specified', jobId: jobId, company: rowData[getHeader('company')] || 'Unknown Company', position: rowData[getHeader('position')] || 'Unknown Position', date: rowData[getHeader('time')] || rowData[getHeader('date')] || '', status: rowData[getHeader('status')] || 'Applied', remarks: rowData[getHeader('remarks')] || '', tpoName: rowData[getHeader('placementofficer')] || '', phone: phone, email: email, resume: resume, datePlaced: rowData[getHeader('dateplaced')] || '', packageLpa: rowData[getHeader('package')] || '', offerLetter: rowData[getHeader('offerletter')] || '', joiningStatus: rowData[getHeader('joiningstatus')] || ''
      });
    }
  });
  
  res.json({ success: true, applications: appsList });
};

exports.updateApplication = async (req, res) => {
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
};

exports.addApplication = async (req, res) => {
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
};

// --- VACANCIES & EVENTS ---
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
    refreshCache(); res.json({ success: true, message: "Event added successfully" });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// --- ISSUES, REPORTS, TALENTINO ---
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
  let students = [], applications = [], issues = [], talentino = [];
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
  res.json({ success: true, students, applications, issues, talentino, vacancies, events });
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

// --- CLIENTS ---
exports.getClients = (req, res) => {
  const cleanTpoName = (req.body.tpoName || '').toString().toLowerCase().trim();
  let clients = [];
  getCache().clients.forEach(row => {
    const rowData = row.toObject();
    const officer = (rowData['Placement Officer'] || '').toString().toLowerCase().trim();
    if (cleanTpoName === '' || officer === '' || officer.includes(cleanTpoName) || cleanTpoName.includes(officer)) {
      clients.push({ rowNumber: row.rowNumber, companyName: rowData['Company Name'] || 'Unknown', website: rowData['Company Website'] || '', location: rowData['Company Location'] || '', contact: rowData['Company Contact'] || '', email: rowData['Company Mail ID'] || '', contactPerson: rowData['Company Contact Person'] || '', logo: rowData['Company Logo'] || '', mailStatus: rowData['Mail Status'] || 'Pending', documentStatus: rowData['Document Status'] || 'Pending', mouLink: rowData['MOU'] || '' });
    }
  });
  res.json({ success: true, clients: clients.reverse() });
};

exports.getClientById = (req, res) => {
  const targetRow = parseInt(req.params.id);
  const row = getCache().clients.find(r => r.rowNumber === targetRow);
  if (!row) return res.status(404).json({ success: false, message: "Client not found" });
  const rowData = row.toObject();
  const getHeader = (str) => Object.keys(rowData).find(k => k.toLowerCase().includes(str.toLowerCase()));
  res.json({ success: true, client: { rowNumber: row.rowNumber, companyName: rowData[getHeader('company name') || getHeader('company')] || 'Unknown', email: rowData[getHeader('mail id') || getHeader('email')] || '', contactPerson: rowData[getHeader('contact person') || getHeader('person')] || '', contact: rowData[getHeader('company contact') || getHeader('contact')] || '', logo: rowData[getHeader('logo')] || '', documentStatus: rowData[getHeader('document status') || getHeader('doc status')] || 'Pending' }});
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
      const getHeader = (str) => headers.find(h => h.toLowerCase() === str.toLowerCase() || h.toLowerCase().includes(str.toLowerCase()));
      const updateObj = {};
      if(getHeader('mail id') || getHeader('email')) updateObj[getHeader('mail id') || getHeader('email')] = email;
      if(headers.find(h => h.toLowerCase() === 'company contact' || h.toLowerCase() === 'contact')) updateObj[headers.find(h => h.toLowerCase() === 'company contact' || h.toLowerCase() === 'contact')] = phone;
      if(getHeader('location')) updateObj[getHeader('location')] = location;
      if(getHeader('contact person') || getHeader('person')) updateObj[getHeader('contact person') || getHeader('person')] = contactPerson;
      if(getHeader('logo')) updateObj[getHeader('logo')] = logoLink;
      rows[0].assign(updateObj); await rows[0].save(); refreshCache(); res.json({ success: true, logoLink });
    } else { res.status(404).json({ success: false, message: "Row not found." }); }
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.requestMou = async (req, res) => {
  const { rowNumber, companyEmail, companyName } = req.body;
  try {
    const signingLink = `https://ipcs-tpo-portal.vercel.app/sign-certificate/${rowNumber}`;
    const refId = Math.floor(10000 + Math.random() * 90000); 
    const mailOptions = {
      from: `"IPCS Placement Portal" <${process.env.EMAIL_USER}>`, to: companyEmail,
      subject: `Action Required:  IPCS Global Hiring Partnership Confirmation With ${companyName} [Ref: ${refId}]`, 
      html: `<div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;"><div style="background-color: #0f1523; padding: 20px; text-align: center; border-bottom: 4px solid #38bdf8;"><h2 style="color: #ffffff; margin: 0;">IPCS HIRING PARTNERSHIP</h2></div><div style="padding: 30px;"><p>Dear ${companyName} Team,</p><p>We are thrilled to welcome you as a Preferred Hiring Partner with IPCS Global!</p><p>To finalize our association, please review and digitally sign your Confirmation of Hiring Partnership by clicking the secure button below. You will be able to upload your company logo and authorized signature directly on the document.</p><div style="text-align: center; margin: 40px 0;"><a href="${signingLink}" style="background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; font-size: 16px;">Review & Sign</a></div><p style="font-size: 13px; color: #64748b;">If the button does not work, copy and paste this link into your browser: <br/>${signingLink}</p></div></div>`
    };
    await sendIPCSMail(mailOptions); 
    const sheet = doc.sheetsByTitle["Clients"]; 
    const rows = await sheet.getRows({ offset: parseInt(rowNumber) - 2, limit: 1 });
    if(rows.length > 0) {
      const statusCol = sheet.headerValues.find(h => h.toLowerCase().includes('mail status'));
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
    await sendIPCSMail(mailOptions); refreshCache(); res.json({ success: true, pdfLink });
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.updatePhoto = async (req, res) => {
  const { email } = req.body;
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file provided" });
    const photoLink = await uploadToDrive(req.file, FOLDER_CLIENT_LOGOS); 
    let sheet = doc.sheetsByTitle["Contact"];
    let rows = await sheet.getRows();
    let cleanEmail = email.trim().toLowerCase();

    let targetRow = rows.find(row => {
       const mail = row.get('Mail ID') || row.get('Mail ID ') || '';
       return mail.toString().trim().toLowerCase() === cleanEmail;
    });

    if (!targetRow) {
       sheet = doc.sheetsByTitle["User"];
       if (sheet) {
          rows = await sheet.getRows();
          targetRow = rows.find(row => {
             const login = row.get('USER Name') || row.get('Mail ID') || '';
             return login.toString().trim().toLowerCase() === cleanEmail;
          });
       }
    }

    if (targetRow) {
      const photoHeader = sheet.headerValues.find(h => h.trim() === 'Profile Photo') || 'Profile Photo';
      targetRow.assign({ [photoHeader]: photoLink });
      await targetRow.save(); refreshCache(); res.json({ success: true, photoUrl: photoLink });
    } else { res.status(404).json({ success: false, message: "User not found." }); }
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

// --- ADMIN USERS ---
exports.getAdminUsers = async (req, res) => {
  try {
    await doc.loadInfo();
    let allUsers = [];

    const contactSheet = doc.sheetsByTitle["Contact"];
    if (contactSheet) {
      const cRows = await contactSheet.getRows();
      const headers = contactSheet.headerValues;
      const hName = getFuzzyHeader(headers, 'tponame'); const hMail = getFuzzyHeader(headers, 'mailid'); const hContact = getFuzzyHeader(headers, 'contactnumber'); const hBranch = getFuzzyHeader(headers, 'sittingbranch'); const hAssign = getFuzzyHeader(headers, 'assignedbranches'); const hPass = getFuzzyHeader(headers, 'password'); const hPhoto = getFuzzyHeader(headers, 'profilephoto');

      cRows.forEach(r => {
        const email = r.get(hMail) || ''; const name = r.get(hName) || '';
        if (email.trim() !== '' || name.trim() !== '') {
          allUsers.push({
            sheet: 'Contact', rowNumber: r.rowNumber, userName: name, contact: r.get(hContact) || '', email: email, sittingBranch: r.get(hBranch) || '', assignedBranches: r.get(hAssign) || '', password: r.get(hPass) || '', role: 'TPO', course: 'All Courses', access: 'View & Edit', profilePhoto: r.get(hPhoto) || r.get('Profile Photo') || ''
          });
        }
      });
    }

    const userSheet = doc.sheetsByTitle["User"];
    if (userSheet) {
      const uRows = await userSheet.getRows();
      const headers = userSheet.headerValues;
      const hName = getFuzzyHeader(headers, 'username'); const hMail = getFuzzyHeader(headers, 'mailid'); const hContact = getFuzzyHeader(headers, 'contactnumber'); const hBranch = getFuzzyHeader(headers, 'sittingbranch'); const hAssign = getFuzzyHeader(headers, 'assignedbranches'); const hPass = getFuzzyHeader(headers, 'password'); const hRole = getFuzzyHeader(headers, 'role'); const hCourse = getFuzzyHeader(headers, 'course'); const hAccess = getFuzzyHeader(headers, 'access'); const hPhoto = getFuzzyHeader(headers, 'profilephoto');

      uRows.forEach(r => {
        const email = r.get(hMail) || ''; const name = r.get(hName) || '';
        if (email.trim() !== '' || name.trim() !== '') {
          allUsers.push({
            sheet: 'User', rowNumber: r.rowNumber, userName: name, contact: r.get(hContact) || '', email: email, sittingBranch: r.get(hBranch) || '', assignedBranches: r.get(hAssign) || '', password: r.get(hPass) || '', role: r.get(hRole) || 'Unassigned', course: r.get(hCourse) || 'All Courses', access: r.get(hAccess) || 'View Only', profilePhoto: r.get(hPhoto) || r.get('Profile Photo') || ''
          });
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
    const s = doc.sheetsByTitle[sheet];
    const rows = await s.getRows({ offset: rowNumber - 2, limit: 1 });
    if (rows.length > 0) {
      const h = s.headerValues;
      if (sheet === 'Contact') {
        rows[0].assign({ [getFuzzyHeader(h, 'tponame')]: userName, [getFuzzyHeader(h, 'contactnumber')]: contact, [getFuzzyHeader(h, 'mailid')]: email, [getFuzzyHeader(h, 'sittingbranch')]: sittingBranch, [getFuzzyHeader(h, 'assignedbranches')]: assignedBranches, [getFuzzyHeader(h, 'password')]: password });
      } else {
        rows[0].assign({ [getFuzzyHeader(h, 'username')]: userName, [getFuzzyHeader(h, 'contactnumber')]: contact, [getFuzzyHeader(h, 'mailid')]: email, [getFuzzyHeader(h, 'sittingbranch')]: sittingBranch, [getFuzzyHeader(h, 'assignedbranches')]: assignedBranches, [getFuzzyHeader(h, 'password')]: password, [getFuzzyHeader(h, 'role')]: role, [getFuzzyHeader(h, 'course')]: course, [getFuzzyHeader(h, 'access')]: access });
      }
      await rows[0].save(); refreshCache(); res.json({ success: true, message: "User updated" });
    } else { res.status(404).json({ success: false, message: "User row not found" }); }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteAdminUser = async (req, res) => {
  try {
    const { sheet, rowNumber } = req.body;
    const targetSheet = doc.sheetsByTitle[sheet];
    if (!targetSheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    const rows = await targetSheet.getRows({ offset: rowNumber - 2, limit: 1 });
    if (rows.length > 0) {
      await rows[0].delete(); refreshCache(); res.json({ success: true, message: "User deleted" });
    } else { res.status(404).json({ success: false, message: "User not found" }); }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ==========================================
// 🚨 NEW LMS & EXAM ENGINE LOGIC
// ==========================================

exports.getMaterials = (req, res) => {
  try {
    let materials = getCache().materials.map(row => {
      const rd = row.toObject();
      const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/\s/g, '') === str.toLowerCase().replace(/\s/g, ''));
      return {
        id: rd[getH('materialid')] || '', course: rd[getH('course')] || '', module: rd[getH('module/topic')] || rd[getH('module')] || rd[getH('topic')] || '',
        title: rd[getH('title')] || '', fileType: rd[getH('filetype')] || '', link: rd[getH('onedrivelink')] || rd[getH('link')] || '', status: rd[getH('status')] || 'Active'
      };
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
    await sheet.addRow({
      [getFuzzyHeader(h, 'materialid')]: id, [getFuzzyHeader(h, 'course')]: course, [getFuzzyHeader(h, 'module/topic')]: module,
      [getFuzzyHeader(h, 'title')]: title, [getFuzzyHeader(h, 'filetype')]: fileType, [getFuzzyHeader(h, 'onedrivelink')]: link, [getFuzzyHeader(h, 'status')]: status || 'Active'
    });
    refreshCache(); res.json({ success: true, message: "Material added successfully!" });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getQuestions = (req, res) => {
  try {
    let questions = getCache().techQuestions.map(row => {
      const rd = row.toObject();
      const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/\s/g, '') === str.toLowerCase().replace(/\s/g, ''));
      return {
        id: rd[getH('questionid')] || '', course: rd[getH('course')] || '', question: rd[getH('question')] || '',
        optA: rd[getH('optiona')] || '', optB: rd[getH('optionb')] || '', optC: rd[getH('optionc')] || '', optD: rd[getH('optiond')] || '',
        correct: rd[getH('correctoption')] || '', explanation: rd[getH('explanation')] || '', status: rd[getH('status')] || 'Active'
      };
    });
    res.json({ success: true, questions: questions.reverse() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.addQuestion = async (req, res) => {
  try {
    const { id, course, question, optA, optB, optC, optD, correct, explanation, status } = req.body;
    const sheet = doc.sheetsByTitle["Tech_Questions"];
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    
    // Using exact Google Sheet headers to prevent mapping errors
    await sheet.addRow({
      'Question ID': id,
      'Course': course,
      'Question': question,
      'Option A': optA,
      'Option B': optB,
      'Option C': optC,
      'Option D': optD,
      'Correct Option': correct,
      'Explanation': explanation,
      'Status': status || 'Active'
    });
    
    refreshCache();
    res.json({ success: true, message: "Question added successfully!" });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const { id } = req.body;
    const sheet = doc.sheetsByTitle["Tech_Questions"];
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    
    const rows = await sheet.getRows();
    const rowToDelete = rows.find(r => r.get('Question ID') === id);
    
    if (rowToDelete) {
      await rowToDelete.delete();
      refreshCache();
      res.json({ success: true, message: "Question deleted" });
    } else {
      res.status(404).json({ success: false, message: "Question not found" });
    }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getResults = (req, res) => {
  try {
    let results = getCache().techResults.map(row => {
      const rd = row.toObject();
      const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/\s/g, '') === str.toLowerCase().replace(/\s/g, ''));
      return {
        timestamp: rd[getH('timestamp')] || '', rollNo: rd[getH('rollno')] || '', name: rd[getH('name')] || '', email: rd[getH('mailid')] || '',
        branch: rd[getH('branch')] || '', course: rd[getH('course')] || '', score: rd[getH('score')] || '', total: rd[getH('totalquestions')] || '',
        percentage: rd[getH('percentage')] || '', timeTaken: rd[getH('timetaken')] || ''
      };
    });
    res.json({ success: true, results: results.reverse() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// --- CRON HELPER ---
exports.runDailyCron = async () => {
  const cache = getCache();
  if (!cache) return;
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().split('T')[0]; 
  const expiredJobs = cache.vacancies.filter(v => {
    if (!v.get('Last Date')) return false;
    try { return new Date(v.get('Last Date')).toISOString().split('T')[0] === yStr; } catch(e) { return false; }
  });

  for (let job of expiredJobs) {
    const jobId = job.get('Job ID') || job.get('ID');
    const applicants = cache.applications.filter(app => app.get('Job ID') === jobId);
    if (applicants.length === 0) continue;

    const tpoName = applicants[0].get('Placement Officer');
    const contactRows = await doc.sheetsByTitle["Contact"].getRows();
    const tpoRow = contactRows.find(r => r.get('TPO Name') === tpoName);
    const tpoEmail = tpoRow ? tpoRow.get('Mail ID') : null;
    if (!tpoEmail) continue;

    let tableRows = ''; let attachments = [];
    applicants.forEach((appRow, index) => {
      const rd = appRow.toObject();
      const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().includes(str.toLowerCase()));
      const info = { name: rd[getH('name')] || '', phone: rd[getH('contact')] || rd[getH('phone')] || '', email: rd[getH('mail')] || rd[getH('email')] || '', roll: rd[getH('roll')] || '', course: rd[getH('course')] || '', branch: rd[getH('branch')] || '', qual: rd[getH('qual')] || '', resume: rd[getH('resume')] || rd[getH('cv')] || '' };
      
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
      from: `"IPCS Placement Portal" <${process.env.EMAIL_USER}>`, to: tpoEmail,
      subject: `Applications Received – ${job.get('Company Name') || job.get('Company')} | ${job.get('Position')} | ${jobId}`,
      html: `<div style="font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto;"><h2 style="color: #0f1523;">Applications Received</h2><p>Please find attached the resumes for the applicants to <b>${job.get('Company Name') || job.get('Company')}</b> for the position of ${job.get('Position')}.</p><table style="width: 100%; border-collapse: collapse; margin-top: 20px;"><thead><tr style="background-color: #f1f5f9; text-align: left;"><th style="padding: 10px; border: 1px solid #cbd5e1;">#</th><th style="padding: 10px; border: 1px solid #cbd5e1;">Name</th><th style="padding: 10px; border: 1px solid #cbd5e1;">Phone</th><th style="padding: 10px; border: 1px solid #cbd5e1;">Email</th><th style="padding: 10px; border: 1px solid #cbd5e1;">Roll No</th><th style="padding: 10px; border: 1px solid #cbd5e1;">Course</th><th style="padding: 10px; border: 1px solid #cbd5e1;">Branch</th><th style="padding: 10px; border: 1px solid #cbd5e1;">Qual.</th><th style="padding: 10px; border: 1px solid #cbd5e1;">Resume</th></tr></thead><tbody>${tableRows}</tbody></table><p style="margin-top: 20px; font-size: 12px; color: #64748b;">This is an automated report generated by the IPCS Placement Portal.</p></div>`,
      attachments: attachments
    };
    await sendIPCSMail(mailOptions); 
  }
};

// ==========================================
// 🚨 DYNAMIC COURSES
// ==========================================
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
    // Search column B for the exact subcourse name
    const rowToDelete = rows.find(r => r._rawData[1] && r._rawData[1].trim() === subCourse.trim());
    if (rowToDelete) {
      await rowToDelete.delete();
      refreshCache();
      res.json({ success: true, message: "Course deleted" });
    } else {
      res.status(404).json({ success: false, message: "Course not found" });
    }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ==========================================
// 🚨 APTITUDE EXAMS
// ==========================================
exports.getAptQuestions = (req, res) => {
  try {
    let questions = getCache().aptQuestions.map(row => {
      const rd = row.toObject(); const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/\s/g, '') === str.toLowerCase().replace(/\s/g, ''));
      return {
        id: rd[getH('qid')] || '', category: rd[getH('category')] || '', question: rd[getH('question')] || '',
        optA: rd[getH('optiona')] || '', optB: rd[getH('optionb')] || '', optC: rd[getH('optionc')] || '', optD: rd[getH('optiond')] || '',
        correct: rd[getH('correctoption')] || '', explanation: rd[getH('explanation')] || '', status: rd[getH('status')] || 'Active', level: rd[getH('level')] || 'Easy'
      };
    });
    res.json({ success: true, questions: questions.reverse() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getAptResults = (req, res) => {
  try {
    let results = getCache().aptResults.map(row => {
      const rd = row.toObject(); const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/\s/g, '') === str.toLowerCase().replace(/\s/g, ''));
      return {
        timestamp: rd[getH('timestamp')] || '', rollNo: rd[getH('rollno')] || '', name: rd[getH('name')] || '', email: rd[getH('email')] || rd[getH('mailid')] || '', branch: rd[getH('branch')] || '', score: rd[getH('score')] || '', total: rd[getH('total')] || rd[getH('totalquestions')] || '', percentage: rd[getH('percentage')] || '', timeTaken: rd[getH('timetaken')] || '', categoryBreakdown: rd[getH('categorybreakdown')] || ''
      };
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
    await sheet.addRow({
      [getFuzzyHeader(h, 'qid')]: id,
      [getFuzzyHeader(h, 'category')]: category,
      [getFuzzyHeader(h, 'question')]: question,
      [getFuzzyHeader(h, 'optiona')]: optA,
      [getFuzzyHeader(h, 'optionb')]: optB,
      [getFuzzyHeader(h, 'optionc')]: optC,
      [getFuzzyHeader(h, 'optiond')]: optD,
      [getFuzzyHeader(h, 'correctoption')]: correct,
      [getFuzzyHeader(h, 'explanation')]: explanation,
      [getFuzzyHeader(h, 'status')]: status || 'Active',
      [getFuzzyHeader(h, 'level')]: level || 'Medium'
    });
    
    refreshCache();
    res.json({ success: true, message: "Question added" });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteAptQuestion = async (req, res) => {
  try {
    const { id } = req.body;
    const sheet = doc.sheetsByTitle["Aptitude_Questions"];
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    
    const rows = await sheet.getRows();
    const rowToDelete = rows.find(r => r.get('QID') === id || r.get('qid') === id);
    
    if (rowToDelete) {
      await rowToDelete.delete();
      refreshCache();
      res.json({ success: true, message: "Question deleted" });
    } else {
      res.status(404).json({ success: false, message: "Question not found" });
    }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ==========================================
// 🚨 TALENTINO EXAMS
// ==========================================
exports.getTalExamQuestions = (req, res) => {
  try {
    let questions = getCache().talQuestions.map(row => {
      const rd = row.toObject(); const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/\s/g, '') === str.toLowerCase().replace(/\s/g, ''));
      return {
        id: rd[getH('questionid')] || '', testNumber: rd[getH('textnumber')] || rd[getH('testnumber')] || '', question: rd[getH('question')] || '',
        optA: rd[getH('optiona')] || '', optB: rd[getH('optionb')] || '', optC: rd[getH('optionc')] || '', optD: rd[getH('optiond')] || '',
        correct: rd[getH('correctoption')] || '', explanation: rd[getH('explanation')] || '', status: rd[getH('status')] || 'Active'
      };
    });
    res.json({ success: true, questions: questions.reverse() });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.getTalExamResults = (req, res) => {
  try {
    let results = getCache().talResults.map(row => {
      const rd = row.toObject(); const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/\s/g, '') === str.toLowerCase().replace(/\s/g, ''));
      return {
        timestamp: rd[getH('timestamp')] || '', rollNo: rd[getH('rollno')] || '', name: rd[getH('name')] || '', email: rd[getH('mailid')] || rd[getH('email')] || '', branch: rd[getH('branch')] || '', testNumber: rd[getH('testnumbercompleted')] || '', score: rd[getH('score')] || '', total: rd[getH('totalquestions')] || '', percentage: rd[getH('percentage')] || '', timeTaken: rd[getH('timetaken')] || ''
      };
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
    await sheet.addRow({
      [getFuzzyHeader(h, 'questionid')]: id,
      [getFuzzyHeader(h, 'testnumber')]: testNumber,
      [getFuzzyHeader(h, 'question')]: question,
      [getFuzzyHeader(h, 'optiona')]: optA,
      [getFuzzyHeader(h, 'optionb')]: optB,
      [getFuzzyHeader(h, 'optionc')]: optC,
      [getFuzzyHeader(h, 'optiond')]: optD,
      [getFuzzyHeader(h, 'correctoption')]: correct,
      [getFuzzyHeader(h, 'explanation')]: explanation,
      [getFuzzyHeader(h, 'status')]: status || 'Active'
    });
    
    refreshCache();
    res.json({ success: true, message: "Question added" });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.deleteTalExamQuestion = async (req, res) => {
  try {
    const { id } = req.body;
    const sheet = doc.sheetsByTitle["Talentino_Questions"];
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    
    const rows = await sheet.getRows();
    const rowToDelete = rows.find(r => r.get('Question ID') === id || r.get('questionid') === id);
    
    if (rowToDelete) {
      await rowToDelete.delete();
      refreshCache();
      res.json({ success: true, message: "Question deleted" });
    } else {
      res.status(404).json({ success: false, message: "Question not found" });
    }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ==========================================
// 🚨 PROFILE / SETTINGS API
// ==========================================
exports.updatePassword = async (req, res) => {
  const { email, newPassword } = req.body;
  try {
    let targetRow = null;
    let targetSheet = null;

    // Search in Contact Sheet first
    const cSheet = doc.sheetsByTitle["Contact"];
    if (cSheet) {
      const rows = await cSheet.getRows();
      targetRow = rows.find(r => (r.get('Mail ID') || '').toString().trim().toLowerCase() === email.toLowerCase().trim());
      if (targetRow) targetSheet = cSheet;
    }

    // Search in User Sheet if not found
    if (!targetRow) {
      const uSheet = doc.sheetsByTitle["User"];
      if (uSheet) {
        const rows = await uSheet.getRows();
        targetRow = rows.find(r => (r.get('Mail ID') || '').toString().trim().toLowerCase() === email.toLowerCase().trim());
        if (targetRow) targetSheet = uSheet;
      }
    }

    if (targetRow && targetSheet) {
      const pHead = getFuzzyHeader(targetSheet.headerValues, 'password');
      targetRow.assign({ [pHead]: newPassword });
      await targetRow.save();
      refreshCache();
      res.json({ success: true, message: "Password updated successfully" });
    } else {
      res.status(404).json({ success: false, message: "User account not found in database." });
    }
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

// ==========================================
// 🚨 PLACEMENT DRIVES
// ==========================================
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