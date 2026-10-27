const { createHash, createHmac, randomBytes, timingSafeEqual } = require('crypto');
const { hashPassword, verifyPassword, isPasswordHash, validatePassword } = require('./passwords');
const { SESSION_TOKEN_TTL_MS, getAccountVersion, createPortalSessionToken, readPortalSessionToken } = require('./sessionTokens');

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
  doc, drive, google, serviceAccountAuth, getCache, refreshCache, loadDocInfo, getSpreadsheetIdForSheetName, hasAccess, getFuzzyHeader,
  sendIPCSMail, uploadToDrive, syncPlacedStudent, rebuildPlacedStudentsFromTpoLogs
} = require('./config');

const { autoCreateDesignTask } = require('./designControllers');
const { normalizePlacementText, placementIdentity, latestPlacementRows } = require('./placementRecords');
const { calculateDashboardPlacementCounts } = require('./dashboardStats');
const { buildPlacementReconciliation } = require('./placementReconciliation');
const { PLACEMENT_AUDIT_SHEET, PLACEMENT_AUDIT_HEADERS, createPlacementAuditEvent } = require('./placementAudit');
const { createTalentinoSessionResolver } = require('./talentinoSessionMatch');
const { formatIndiaTimestamp, formatIndiaDate, formatIndiaTime } = require('./utils/dateTime');

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

const accountAuthState = (row, passwordOverride) => ({
  email: getValByHeader(row, ['email', 'mailid', 'mail']).toLowerCase(),
  loginId: getValByHeader(row, ['loginid', 'userid', 'user_id', 'employeeid', 'username']).toLowerCase(),
  password: passwordOverride === undefined ? getValByHeader(row, ['password']) : String(passwordOverride),
  role: getValByHeader(row, ['role', 'portalrole']).toUpperCase(),
  access: getValByHeader(row, ['access', 'accesstype']).toUpperCase(),
  status: getValByHeader(row, ['status']).toUpperCase(),
  sittingBranch: getValByHeader(row, ['sittingbranch', 'branch']).toLowerCase(),
  assignedBranches: getValByHeader(row, ['assignedbranches']).toLowerCase(),
  assignedCourses: getValByHeader(row, ['assignedcourses', 'assignedcourse', 'course']).toLowerCase(),
  department: getValByHeader(row, ['department']).toUpperCase(),
});

const isAccountEnabled = row => !['INACTIVE', 'DISABLED', 'LEFT', 'TERMINATED', 'SUSPENDED', 'REVOKED'].includes(
  getValByHeader(row, ['status']).toUpperCase()
);

const getCurrentAccountRow = (email, cache = getCache()) => {
  const identity = String(email || '').trim().toLowerCase();
  if (!identity || !cache?.authCacheReady) return null;
  const rows = [...(cache.contacts || []), ...(cache.users || [])];
  return rows.find(row => {
    const state = accountAuthState(row);
    return (state.email || state.loginId) === identity;
  }) || null;
};

const migrateLegacyPassword = async (cachedRow, legacyPassword, suppliedPassword) => {
  const worksheet = cachedRow?._worksheet;
  const rowNumber = Number(cachedRow?.rowNumber);
  if (!worksheet || !Number.isInteger(rowNumber) || rowNumber < 2 || typeof worksheet.getRows !== 'function') {
    return { password: legacyPassword };
  }

  const headers = worksheet.headerValues || [];
  const passwordHeader = headers.find(header => String(header || '').toLowerCase().replace(/[^a-z0-9]/g, '') === 'password');
  if (!passwordHeader) return { password: legacyPassword };

  let saved = false;
  try {
    const liveRows = await worksheet.getRows({ offset: rowNumber - 2, limit: 1 });
    const liveRow = liveRows[0];
    if (!liveRow) return { changed: true };
    const currentPassword = getValByHeader(liveRow, ['password']);
    if (currentPassword !== legacyPassword) {
      // Another login may have migrated this same legacy password while this
      // request was waiting. Accept that concurrent migration if it matches.
      if (isPasswordHash(currentPassword) && await verifyPassword(suppliedPassword, currentPassword)) {
        cachedRow.assign({ [passwordHeader]: currentPassword });
        return { password: currentPassword, migrated: true };
      }
      return { changed: true };
    }

    const hashedPassword = await hashPassword(suppliedPassword, { allowShortLegacy: true });
    liveRow.assign({ [passwordHeader]: hashedPassword });
    await liveRow.save();
    saved = true;
    cachedRow.assign({ [passwordHeader]: hashedPassword });
    return { password: hashedPassword, migrated: true };
  } catch (error) {
    if (saved) return { cacheStale: true };
    console.warn('[AUTH] Could not migrate a legacy password on login:', error.message);
    return { password: legacyPassword };
  }
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
       'TimeStamp': formatIndiaTimestamp(),
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

const getDailyReportTpoRecipients = () => {
  const cache = getCache();
  const seen = new Set();
  return (cache?.contacts || []).map(row => ({
    name: getValByHeader(row, ['tponame', 'name', 'placementofficer']).trim(),
    email: getValByHeader(row, ['mailid', 'email']).trim(),
    status: getValByHeader(row, ['status', 'tpostatus']).trim().toLowerCase()
  })).filter(item => {
    const emailKey = item.email.toLowerCase();
    if (!item.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email)
      || /^(inactive|disabled|removed|terminated|left|resigned)$/.test(item.status)
      || emailKey === 'gifty@ipcsglobal.com' || seen.has(emailKey)) return false;
    seen.add(emailKey);
    return true;
  }).map(item => item.email);
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
        'TimeStamp': formatIndiaTimestamp(),
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

const resumeDeliveryMemory = new Map();
const companyOpeningReportMemory = new Map();
const RESUME_CACHE_RETRY_DELAY_MS = 75_000;
const MAX_RESUME_CACHE_RETRIES = 8;
const RESUME_CACHE_MAX_AGE_MS = 3 * 60 * 1000;
let resumeMailCacheRetry = { reportDate: '', attempts: 0, timer: null };
const getResumeDeliveryReference = jobId => String(jobId || '').trim().toLowerCase();
const getUnavailableResumeMailSheets = cache => {
  const unavailable = ['vacancies', 'applications', 'mails', 'contacts']
    .filter(field => cache?.cacheSheetHealth?.[field] !== true);
  const cacheUpdatedAt = Date.parse(cache?.cacheUpdatedAt || '');
  if (!Number.isFinite(cacheUpdatedAt) || Date.now() - cacheUpdatedAt > RESUME_CACHE_MAX_AGE_MS) {
    unavailable.push('fresh cache snapshot');
  }
  return unavailable;
};
const clearResumeMailCacheRetry = reportDate => {
  if (resumeMailCacheRetry.reportDate !== reportDate) return;
  if (resumeMailCacheRetry.timer) clearTimeout(resumeMailCacheRetry.timer);
  resumeMailCacheRetry = { reportDate, attempts: 0, timer: null };
};
const scheduleResumeMailCacheRetry = reportDate => {
  if (resumeMailCacheRetry.reportDate !== reportDate) {
    if (resumeMailCacheRetry.timer) clearTimeout(resumeMailCacheRetry.timer);
    resumeMailCacheRetry = { reportDate, attempts: 0, timer: null };
  }
  if (resumeMailCacheRetry.timer) return true;
  if (resumeMailCacheRetry.attempts >= MAX_RESUME_CACHE_RETRIES) return false;

  resumeMailCacheRetry.attempts += 1;
  const attempt = resumeMailCacheRetry.attempts;
  const timer = setTimeout(() => {
    if (resumeMailCacheRetry.timer === timer) resumeMailCacheRetry.timer = null;
    const dateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const currentReportDate = dateFormatter.format(new Date(Date.now() - 24 * 60 * 60 * 1000));
    if (currentReportDate !== reportDate) return;

    const unavailableSheets = getUnavailableResumeMailSheets(getCache());
    if (unavailableSheets.length) {
      console.warn(`[RESUME DELIVERY] Mail safety cache still unavailable (${unavailableSheets.join(', ')}); retry ${attempt}/${MAX_RESUME_CACHE_RETRIES} will wait another ${Math.round(RESUME_CACHE_RETRY_DELAY_MS / 1000)} seconds.`);
      if (!scheduleResumeMailCacheRetry(reportDate)) {
        console.error(`[RESUME DELIVERY] Automatic retry limit reached for ${reportDate}; no company mail was sent without Mail history.`);
      }
      return;
    }

    console.log(`[RESUME DELIVERY] Mail history recovered; resuming ${reportDate} company-mail catch-up.`);
    exports.runDailyCron({ resumeOnly: true })
      .then(result => console.log('[RESUME DELIVERY] Cache-recovery retry complete:', JSON.stringify(result?.resumes || {})))
      .catch(error => console.error('[RESUME DELIVERY] Cache-recovery retry failed:', error.message));
  }, RESUME_CACHE_RETRY_DELAY_MS);
  resumeMailCacheRetry.timer = timer;
  if (typeof timer.unref === 'function') timer.unref();
  return true;
};
const isMailDeliveryUncertain = error => Boolean(error?.ambiguousDelivery)
  || /delivery outcome is uncertain/i.test(String(error?.message || error));
const mailErrorStatus = error => isMailDeliveryUncertain(error) ? 'Review' : 'Failed';
const wasResumeDeliveryHandled = (jobId, cache) => {
  const key = getResumeDeliveryReference(jobId);
  if (!key) return false;
  const local = resumeDeliveryMemory.get(key);
  if (local?.status === 'sent' || local?.status === 'review') return true;
  if (local?.status === 'queued') {
    if (Date.now() - local.at < 24 * 60 * 60 * 1000) return true;
    resumeDeliveryMemory.delete(key);
  }
  const reference = `[Ref: ${String(jobId).trim()}]`.toLowerCase();
  const logged = (cache?.mails || []).filter(row =>
    String(getValByHeader(row, ['mailtype', 'type']) || '').toLowerCase().includes('resume delivery') &&
    String(getValByHeader(row, ['subject']) || '').toLowerCase().includes(reference)
  ).sort((left, right) => Number(right.rowNumber || 0) - Number(left.rowNumber || 0));
  const latestStatus = String(getValByHeader(logged[0], ['status']) || '').toLowerCase();
  return Boolean(latestStatus && (/uncertain|check its sent folder/.test(latestStatus) || (!latestStatus.startsWith('failed:') && /success|sent|queued/.test(latestStatus))));
};

const wasCompanyOpeningReportHandled = (reportDate, cache) => {
  const local = companyOpeningReportMemory.get(reportDate);
  if (local) return true;
  const reportType = 'company resume delivery daily report';
  const hasLoggedReport = rows => (rows || []).some(row =>
    String(getValByHeader(row, ['mailtype', 'type']) || '').toLowerCase().includes(reportType)
    && String(getValByHeader(row, ['subject']) || '').includes(reportDate)
  );
  if (hasLoggedReport(cache?.mails)) {
    companyOpeningReportMemory.set(reportDate, { status: 'already handled', at: Date.now() });
    return true;
  }
  return false;
};

const claimCompanyOpeningDailyReport = async reportDate => {
  if (companyOpeningReportMemory.has(reportDate)) return { claimed: false, status: 'already handled' };
  // Set this synchronously before the first await so same-process cron and
  // startup catch-up calls cannot both proceed to the provider.
  companyOpeningReportMemory.set(reportDate, { status: 'claiming', at: Date.now() });

  const reportType = 'Company Resume Delivery Daily Report';
  const subject = `[IPCS COMPANY OPENING REPORT] ${reportDate}`;
  const sheet = doc.sheetsByTitle['Mail'];
  if (!sheet) throw new Error('Mail history sheet is unavailable; the daily company report was not sent.');

  const matchesReport = row =>
    String(getValByHeader(row, ['mailtype', 'type']) || '').toLowerCase().includes(reportType.toLowerCase())
    && String(getValByHeader(row, ['subject']) || '').includes(reportDate);
  const rows = await sheet.getRows();
  const existing = rows.filter(matchesReport);
  if (existing.length) {
    companyOpeningReportMemory.set(reportDate, {
      status: String(getValByHeader(existing[existing.length - 1], ['status']) || 'already handled'),
      at: Date.now()
    });
    return { claimed: false, status: 'already handled' };
  }

  const reservation = await sheet.addRow({
    'TimeStamp': formatIndiaTimestamp(),
    'Reciver Name': 'Gifty',
    'Reciver Mail': 'gifty@ipcsglobal.com',
    'Mail Type': reportType,
    'Subject': subject,
    'Status': 'Sending'
  });

  // Verify the persisted reservation and choose the earliest row if two
  // server instances tried to claim the same report at nearly the same time.
  const verifiedRows = (await sheet.getRows()).filter(matchesReport)
    .sort((left, right) => Number(left.rowNumber || 0) - Number(right.rowNumber || 0));
  if (!verifiedRows.length || Number(verifiedRows[0].rowNumber) !== Number(reservation.rowNumber)) {
    companyOpeningReportMemory.set(reportDate, { status: 'already handled', at: Date.now() });
    return { claimed: false, status: 'already handled' };
  }

  companyOpeningReportMemory.set(reportDate, { status: 'sending', at: Date.now() });
  return { claimed: true, row: reservation };
};

const sendCompanyOpeningDailyReport = async ({ reportDate, openingRows, cache }) => {
  if (wasCompanyOpeningReportHandled(reportDate, cache)) {
    const local = companyOpeningReportMemory.get(reportDate);
    return { status: local?.status || 'already handled', skipped: true };
  }

  let reservation;
  try {
    const claim = await claimCompanyOpeningDailyReport(reportDate);
    if (!claim.claimed) return { status: claim.status, skipped: true };
    reservation = claim.row;
  } catch (error) {
    companyOpeningReportMemory.set(reportDate, { status: 'review', at: Date.now() });
    console.error(`[COMPANY OPENING REPORT] ${reportDate} could not reserve its one-time send:`, error.message);
    return { status: 'review', error: String(error.message || error).slice(0, 500) };
  }

  const giftyEmail = 'gifty@ipcsglobal.com';
  const tpoEmails = getDailyReportTpoRecipients();
  const ccEmails = [...new Map([...tpoEmails, 'rakesh@ipcsglobal.com']
    .map(email => String(email || '').trim())
    .filter(Boolean)
    .map(email => [email.toLowerCase(), email])).values()];
  const reportRecipients = [giftyEmail, ...ccEmails];
  const subject = `[IPCS COMPANY OPENING REPORT] ${reportDate}`;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const cellStyle = 'border:1px solid #d7dce5;padding:9px;text-align:left;vertical-align:top';
  const headerStyle = `${cellStyle};background:#edf2f8;font-weight:700`;
  const countByStatus = status => openingRows.filter(row => row.deliveryStatus === status).length;
  const sentCount = countByStatus('Sent');
  const queuedCount = countByStatus('Queued');
  const failedCount = openingRows.filter(row => ['Failed', 'Review'].includes(row.deliveryStatus)).length;
  const rowsHtml = openingRows.length ? openingRows.map(row => `
    <tr>
      <td style="${cellStyle}">${escape(row.company || 'Unknown company')}</td>
      <td style="${cellStyle}">${escape(row.position || 'Unknown position')}</td>
      <td style="${cellStyle}">${escape(row.lastDate || '—')}</td>
      <td style="${cellStyle};text-align:center">${Number(row.applicantCount) || 0}</td>
      <td style="${cellStyle}">${escape(row.tpoName || 'Not assigned')}</td>
      <td style="${cellStyle}">${escape(row.deliveryStatus || 'Not sent')}</td>
    </tr>`).join('') : `<tr><td colspan="6" style="${cellStyle};text-align:center">No openings had a deadline yesterday.</td></tr>`;
  const html = `<div style="font-family:Arial,sans-serif;color:#172033;max-width:1000px;margin:0 auto">
    <h2>Company resume delivery report</h2>
    <p>Openings with an application deadline of <strong>${escape(reportDate)}</strong>.</p>
    <p><strong>${openingRows.length}</strong> opening(s) · <strong>${sentCount}</strong> sent · <strong>${queuedCount}</strong> queued · <strong>${failedCount}</strong> failed or under review.</p>
    <table style="border-collapse:collapse;width:100%;font-size:13px">
      <thead><tr>${['Company', 'Position', 'Last date', 'Applied', 'Opening owner (TPO)', 'Company email status'].map(label => `<th style="${headerStyle}">${label}</th>`).join('')}</tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>`;

  try {
    const delivery = await sendIPCSMail({
      from: `"IPCS Global Placement Team" <${process.env.EMAIL_USER}>`,
      to: giftyEmail,
      cc: ccEmails.join(','),
      subject,
      text: `Company resume delivery report for openings whose deadline was ${reportDate}. ${openingRows.length} opening(s), ${sentCount} sent, ${queuedCount} queued, ${failedCount} failed or under review.`,
      html
    }, {
      category: 'placement',
      logDetails: {
        name: 'Gifty',
        email: reportRecipients.join(','),
        type: 'Company Resume Delivery Daily Report'
      }
    });
    const status = delivery?.queued ? 'queued' : 'sent';
    reservation.set('Status', delivery?.queued ? `Queued: ${delivery.queueId || 'pending delivery'}` : 'Success');
    try {
      await reservation.save();
    } catch (logError) {
      console.error(`[COMPANY OPENING REPORT] ${reportDate} was accepted by the mail service but its Mail status update failed; the reservation remains in place:`, logError.message);
    }
    companyOpeningReportMemory.set(reportDate, { status, at: Date.now() });
    console.log(`[COMPANY OPENING REPORT] ${reportDate} report ${status}; ${tpoEmails.length} TPO(s) copied.`);
    return { status, queued: Boolean(delivery?.queued) };
  } catch (error) {
    const status = isMailDeliveryUncertain(error) ? 'review' : 'failed';
    reservation.set('Status', `${status === 'review' ? 'Review' : 'Failed'}: ${String(error.message || error).slice(0, 500)}`);
    try {
      await reservation.save();
    } catch (logError) {
      console.error(`[COMPANY OPENING REPORT] ${reportDate} failure status could not be saved; its reservation remains in place:`, logError.message);
    }
    companyOpeningReportMemory.set(reportDate, { status, at: Date.now() });
    console.error(`[COMPANY OPENING REPORT] ${reportDate} report ${status}:`, error.message);
    return { status, error: String(error.message || error).slice(0, 500) };
  }
};

const sendMailAndLog = async (mailOptions, logDetails) => {
  try {
    const result = await sendIPCSMail(mailOptions, {
      category: logDetails?.category || 'placement',
      queueContext: logDetails?.queueContext,
      logDetails
    });
    await logMailToSheet(logDetails?.name, logDetails?.email, logDetails?.type, mailOptions.subject, result?.queued ? `Queued: ${result.queueId}` : 'Success');
    return result || { queued: false };
  } catch (err) {
    await logMailToSheet(logDetails?.name, logDetails?.email, logDetails?.type, mailOptions.subject, `${mailErrorStatus(err)}: ${err.message}`);
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
    return sendMailAndLog({
      from: `"IPCS Placement Cell" <${process.env.EMAIL_USER}>`,
      to: studentData.email,
      cc: ccList,
      subject: subject,
      html: html,
      attachments: attachments 
    }, { name: studentData.name, email: studentData.email, type: mailType, category: 'recruitment' });
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
    const cleanPass = password === undefined || password === null ? '' : String(password);
    let foundUser = null; 
    let accountRow = null;
    let storedPassword = '';
    let role = 'TPO'; 
    let course = 'All'; 
    let userName = '';
    let department = '';

    for (let row of cache.contacts) {
      const sheetMail = getValByHeader(row, ['mailid', 'email']).toLowerCase();
      const sheetPass = getValByHeader(row, ['password']);
      
      if (sheetMail === cleanInput && cleanInput !== '' && cleanPass !== '' && isAccountEnabled(row) && await verifyPassword(cleanPass, sheetPass)) {
        accountRow = row;
        storedPassword = sheetPass;
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
        role = getValByHeader(row, ['role', 'portalrole']) || 'TPO';
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
        
        if ((sheetUsername === cleanInput || sheetMail === cleanInput || sheetLoginId === cleanInput) && cleanInput !== '' && cleanPass !== '' && isAccountEnabled(row) && await verifyPassword(cleanPass, sheetPass)) {
          accountRow = row;
          storedPassword = sheetPass;
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

    if (!isPasswordHash(storedPassword)) {
      const migration = await migrateLegacyPassword(accountRow, storedPassword, cleanPass);
      if (migration.changed) return res.status(401).json({ success: false, message: 'This account password changed. Sign in with the latest password.' });
      if (migration.cacheStale) return res.status(503).json({ success: false, message: 'Your account is being secured. Please retry in a moment.' });
      storedPassword = migration.password || storedPassword;
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
    const accountVersion = getAccountVersion(accountAuthState(accountRow, storedPassword));
    if (invalidatedAccountVersions.has(sessionKey)) {
      const invalidatedVersion = invalidatedAccountVersions.get(sessionKey);
      if (!invalidatedVersion || invalidatedVersion !== accountVersion) {
        return res.status(503).json({ success: false, message: 'This account was just updated. Please retry after account details finish syncing.' });
      }
    }
    const sessionToken = createPortalSessionToken(sessionUser, accountVersion);

    (async () => {
      try {
        const sheet = doc.sheetsByIndex.find(s => s.title.replace(/\s/g, '').toLowerCase().includes('security_logs'));
        if (sheet) {
          const rawIp = req.ip || req.socket?.remoteAddress || 'Unknown IP';
          const cleanIp = rawIp.replace('::ffff:', '').trim();
          const uaInfo = parseUserAgent(req.headers['user-agent'] || '');

          await sheet.addRow({
            'TimeStamp': formatIndiaTimestamp(),
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

// The central Placement Team works across branch boundaries. Keep this
// exception local to placement workflows; other portal modules remain scoped.
const isCentralPlacementTeam = user => /\bPLACEMENT\s+TEAM\b/i.test(String(user?.role || ''));
const hasPlacementAccess = (branch, course, user) => isCentralPlacementTeam(user) || hasAccess(
  branch, course, user?.role, user?.assignedBranchesArray, user?.assignedCourse, user?.department
);
// Branch-scoped placement workflows use assigned branches only; course
// assignments do not hide records in a branch the user can access.
const hasPlacementBranchAccess = (branch, user) => {
  if (isCentralPlacementTeam(user)) return true;
  const role = String(user?.role || '').toUpperCase();
  if (role.includes('ADMIN') || role === 'GENERAL MANAGER' || role === 'TECHNICAL HEAD' || role === 'ZONAL PLACEMENT HEAD') return true;
  return userHasBranch(user, branch);
};
const isPlacementTrackerAdmin = user => {
  const role = String(user?.role || '').toUpperCase();
  return user?.accessType === 'superadmin' || isCentralPlacementTeam(user) || role.includes('ADMIN') ||
    role === 'GENERAL MANAGER' || role === 'TECHNICAL HEAD' || role === 'ZONAL PLACEMENT HEAD';
};
const isPlacementTrackerTpo = user => /(^|\b)(TPO|PLACEMENT OFFICER)(\b|$)/i.test(String(user?.role || ''));
const placementOwnerMatchesUser = (owner, user) => {
  const normalizedOwner = normalizePlacementText(owner);
  if (!normalizedOwner) return false;
  return [user?.name, user?.email, user?.username, user?.loginId, user?.employeeId]
    .some(identity => normalizePlacementText(identity) === normalizedOwner);
};
const placementDriveIdentityHeaders = ['driveid', 'drivename', 'eventid', 'title', 'companyname', 'company'];
const getPlacementDriveIdentifiers = row => [...new Set(placementDriveIdentityHeaders
  .map(header => normalizePlacementText(getValByHeader(row, [header])))
  .filter(Boolean))];
const findPlacementDriveEvent = (events, reference) => {
  const referenceIds = typeof reference === 'object' && reference
    ? getPlacementDriveIdentifiers(reference)
    : [normalizePlacementText(reference)].filter(Boolean);
  if (!referenceIds.length) return null;
  return (events || []).find(event =>
    getValByHeader(event, ['event', 'type', 'event_type']).toLowerCase().includes('drive') &&
    getPlacementDriveIdentifiers(event).some(id => referenceIds.includes(id))
  ) || null;
};
const getPlacementDriveOwner = row => getValByHeader(row, ['createdby']) || getValByHeader(row, ['tpo', 'tponame', 'placementofficer']);
const placementDriveOwnedByUser = (row, user) => [
  getValByHeader(row, ['createdby']),
  getValByHeader(row, ['tpo', 'tponame']),
  getValByHeader(row, ['placementofficer'])
].some(owner => placementOwnerMatchesUser(owner, user));
const getOwnedPlacementJobIds = (user, vacancyRows = getCache()?.vacancies || []) => {
  return new Set((vacancyRows || [])
    .filter(row => placementOwnerMatchesUser(getValByHeader(row, ['placementofficer', 'tpo', 'tponame', 'createdby', 'owner', 'postedby']), user))
    .map(row => normalizePlacementText(getValByHeader(row, ['jobid', 'job id', 'id'])))
    .filter(Boolean));
};
const getPlacementJobOwner = (jobId, vacancyRows = getCache()?.vacancies || []) => {
  const normalizedJobId = normalizePlacementText(jobId);
  if (!normalizedJobId) return '';
  const vacancy = (vacancyRows || []).find(row => normalizePlacementText(getValByHeader(row, ['jobid', 'job id', 'id'])) === normalizedJobId);
  return vacancy ? getValByHeader(vacancy, ['placementofficer', 'tpo', 'tponame', 'createdby', 'owner', 'postedby']) : '';
};
const isOwnedPlacementApplication = (row, user, ownedJobIds = getOwnedPlacementJobIds(user)) => {
  if (!row) return false;
  const jobId = normalizePlacementText(getValByHeader(row, ['jobid', 'job id', 'job_id']));
  if (jobId && ownedJobIds.has(jobId)) return true;
  const source = normalizePlacementText(getValByHeader(row, ['entrysource', 'recordorigin', 'origin', 'source']));
  const isManualEntry = /manual|direct|referral/.test(source) || /^(manualadd|directreferral)$/.test(jobId);
  const ownedBySignedInOfficer = ['placementofficer', 'tpo', 'tponame', 'createdby']
    .some(header => placementOwnerMatchesUser(getValByHeader(row, [header]), user));
  return isManualEntry && ownedBySignedInOfficer;
};
const canAccessTrackerApplication = (row, user, linkedStudent = null) => {
  if (isPlacementTrackerAdmin(user)) return true;
  if (isPlacementTrackerTpo(user)) return isOwnedPlacementApplication(row, user);
  const branch = getValByHeader(row, ['branch', 'sittingbranch']) || getValByHeader(linkedStudent, ['branch', 'sittingbranch']);
  return hasPlacementBranchAccess(branch, user);
};

exports.getDashboardStats = async (req, res) => {
  const { assignedBranchesArray, role, assignedCourse, department } = req.body;
  const placementUser = req.portalUser || { role, assignedBranchesArray, assignedCourse, department };
  const checkAccess = (rBranch, rCourse) => isPlacementTrackerAdmin(placementUser) || isPlacementTrackerTpo(placementUser)
    ? hasPlacementBranchAccess(rBranch, placementUser)
    : hasPlacementAccess(rBranch, rCourse, placementUser);

  let cache = getCache();
  if (!cache) {
    await refreshCache();
    cache = getCache();
  }
  if (!cache) return res.status(503).json({ success: false, message: 'Dashboard data is still syncing. Please retry shortly.' });
  let pendingApps = 0, activeVacs = 0;
  const clientRows = cache.clients || [];
  const totalCompanies = clientRows.reduce((count, row) => {
    const companyName = getValByHeader(row, ['companyname', 'company']).trim();
    return count + (companyName ? 1 : 0);
  }, 0);

  const placementCounts = calculateDashboardPlacementCounts(
    cache.students || [],
    cache.tpoLogs || [],
    getValByHeader,
    // These headline KPIs are global for every signed-in dashboard. The API
    // returns only totals here; detailed student records remain role-scoped.
    () => true,
    () => true
  );

  const studentByRoll = new Map();
  const studentsByName = new Map();
  (cache.students || []).forEach(student => {
    const roll = normalizePlacementText(getValByHeader(student, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']));
    const name = normalizePlacementText(getValByHeader(student, ['studentname', 'name']));
    if (roll && !studentByRoll.has(roll)) studentByRoll.set(roll, student);
    if (name) studentsByName.set(name, [...(studentsByName.get(name) || []), student]);
  });
  (cache.applications || []).forEach(row => {
    const name = getValByHeader(row, ['studentname', 'name', 'candidate']);
    const roll = getValByHeader(row, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']);
    const jobId = getValByHeader(row, ['jobid', 'job id']);
    const company = getValByHeader(row, ['companyname', 'company']);
    if (!name && !roll && !jobId && !company) return;

    const rollKey = normalizePlacementText(roll);
    const nameKey = normalizePlacementText(name);
    const nameMatches = nameKey ? studentsByName.get(nameKey) || [] : [];
    const student = (rollKey && studentByRoll.get(rollKey)) || (nameMatches.length === 1 ? nameMatches[0] : null);
    const branch = getValByHeader(row, ['branch', 'sittingbranch']) || getValByHeader(student, ['branch', 'sittingbranch']);
    const course = getValByHeader(row, ['course', 'program']) || getValByHeader(student, ['course', 'program']);
    if (!checkAccess(branch, course)) return;

    const status = normalizePlacementText(getValByHeader(row, ['status'])) || 'applied';
    if (status === 'applied' || status === 'pending') pendingApps++;
  });
  
  const todayStart = safeParseDate(formatIndiaDate(new Date()));

  (cache.vacancies || []).forEach(row => {
    const status = getValByHeader(row, ['status']).toLowerCase() || 'open';
    const lastDateStr = getValByHeader(row, ['lastdate']);
    let isExpired = false;

    if (lastDateStr) {
      const parsedDate = safeParseDate(lastDateStr);
      if (parsedDate && parsedDate < todayStart) isExpired = true;
    }

    if ((status.includes('open') || status.includes('yes')) && !isExpired && (isPlacementTrackerTpo(placementUser) || checkAccess('All', getValByHeader(row, ['course', 'program'])))) {
      activeVacs++;
    }
  });

  let eventsList = cache.events.filter(row => checkAccess(getValByHeader(row, ['branch', 'sittingbranch']), getValByHeader(row, ['course', 'assignedcourse'])))
    .slice(-8)
    .map(row => ({ title: getValByHeader(row, ['title']) || 'Event', date: formatIndiaDate(getValByHeader(row, ['date'])) || '', time: formatIndiaTime(getValByHeader(row, ['time'])) || '', type: getValByHeader(row, ['type', 'event']) || 'Placement Drive', location: getValByHeader(row, ['location', 'eventhappeningin']) || '' }));
  
  res.json({ 
    success: true, 
    stats: { 
      totalStudents: placementCounts.totalStudents,
      pendingApps, 
      // Count every TPO_Log row whose Status is exactly Placed, matching the
      // source-of-truth rule used by the monthly placement report.
      placed: placementCounts.placed,
      activeVacancies: activeVacs,
      totalCompanies
    }, 
    events: eventsList.reverse() 
  });
};

exports.getStudents = async (req, res) => {
  const { assignedBranchesArray, role, assignedCourse } = req.body;
  const placementUser = req.portalUser || { role, assignedBranchesArray, assignedCourse };
  let cache = getCache();
  if (!cache) {
    await refreshCache();
    cache = getCache();
  }
  if (!cache) return res.status(503).json({ success: false, message: 'Student data is still syncing. Please retry shortly.' });
  let students = []; let stats = { total: 0, pending: 0, notResponding: 0, noNeed: 0, branchCounts: {}, courseCounts: {} };

  (cache.students || []).forEach(row => {
    const branch = getValByHeader(row, ['branch']) || 'Unknown';
    const course = getValByHeader(row, ['course']) || 'Unknown';

    if (hasPlacementBranchAccess(branch, placementUser)) {
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
  res.json({
    success: true,
    students: students.reverse(),
    stats,
    dataMeta: {
      sourceSheet: 'Data',
      sourceHealthy: cache.cacheSheetHealth?.students === true,
      lastRefreshAttemptAt: cache.cacheUpdatedAt || '',
      lastSuccessfulSyncAt: cache.cacheSheetUpdatedAt?.students || ''
    }
  });
};

exports.updateStudent = async (req, res) => {
  const { rowNumber, vacOpen, placementStatus, studyAccess, examAccess, courseStatus, coursePercentage } = req.body || {};
  const rowIndex = Number(rowNumber);
  const user = req.portalUser;
  const role = String(user?.role || '').toUpperCase();
  const isAdmin = user?.accessType === 'superadmin' || ['SYSTEM ADMIN', 'GENERAL MANAGER', 'ZONAL PLACEMENT HEAD', 'TECHNICAL HEAD'].includes(role);
  const isPlacementEditor = isAdmin || role === 'TPO' || role.includes('PLACEMENT OFFICER') || isCentralPlacementTeam(user);
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
      const canEditBranchStudent = isPlacementTrackerTpo(user) || isPlacementTrackerAdmin(user)
        ? hasPlacementBranchAccess(studentBranch, user)
        : hasPlacementAccess(studentBranch, studentCourse, user);
      if (!canEditBranchStudent) {
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

      let placedSheetWarning = '';
      if (isPlacementEditor && placementStatus !== undefined) {
        placedSheetWarning = await syncPositivePlacement({
          name: getValByHeader(rows[0], ['name', 'studentname']),
          phone: getValByHeader(rows[0], ['phone', 'contact', 'mobilenumber']),
          email: getValByHeader(rows[0], ['mailid', 'email', 'studentemail']),
          roll: getValByHeader(rows[0], ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']),
          course: studentCourse,
          branch: studentBranch,
          qual: getValByHeader(rows[0], ['qualification', 'qual']),
          resume: getValByHeader(rows[0], ['resume', 'cv']),
          jobId: getValByHeader(rows[0], ['jobid']),
          company: getValByHeader(rows[0], ['companyname', 'company']),
          position: getValByHeader(rows[0], ['position', 'role']),
          placementOfficer: isPlacementTrackerTpo(user)
            ? user?.name || user?.email || ''
            : getValByHeader(rows[0], ['placementofficer', 'tpo', 'tponame']) || '',
          status: placementStatus,
          joiningStatus: getValByHeader(rows[0], ['joiningstatus']),
          remarks: getValByHeader(rows[0], ['remarks']),
          datePlaced: getValByHeader(rows[0], ['dateplaced']),
          packageLpa: getValByHeader(rows[0], ['package', 'packagelpa']),
          sourceSheet: 'Data',
          sourceRow: rows[0].rowNumber
        });
      }

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
                    <a href="https://placement.ipcstalenzo.com" style="background-color: #0284c7; color: white; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; font-size: 16px; display: inline-block;">Access Placement Portal</a>
                  </div>
                  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">
                    <p style="margin: 0 0 5px 0;">Regards,</p>
                    <p style="margin: 0 0 2px 0; font-weight: bold; color: #0f1523; font-size: 14px;">IPCS Placement Cell</p>
                  </div>
                </div>
              </div>
            `;
            sendMailAndLog({ from: `"IPCS Placement Cell" <${process.env.EMAIL_USER}>`, to: sEmail, subject: `Welcome to IPCS Placements! Your Profile is Active [Ref: ${refId}]`, html: html }, { name: sName, email: sEmail, type: 'Course Completion Welcome', category: 'portal' })
              .catch(error => console.error('Student welcome email failed:', error.message));
         }
      }

      refreshCache(); 
      res.json({ success: true, message: "Student record updated!", warning: placedSheetWarning });
    } else { res.status(404).json({ success: false, message: "Row not found." }); }
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

const normalizePlacementHeader = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const ensurePlacementHeaders = async (sheet, titles) => {
  if (!Array.isArray(sheet._headerValues) || !sheet._headerValues.length) await sheet.loadHeaderRow();
  let headers = [...(sheet.headerValues || [])];
  const missing = titles.filter(title => !headers.some(header => normalizePlacementHeader(header) === normalizePlacementHeader(title)));
  if (missing.length) {
    const requiredColumns = headers.length + missing.length;
    if ((Number(sheet.columnCount) || 0) < requiredColumns) await sheet.resize({ columnCount: requiredColumns });
    headers = [...headers, ...missing];
    await sheet.setHeaderRow(headers);
    sheet._headerValues = headers;
  }
  return [...(sheet.headerValues || [])];
};

const findPlacementHeader = (headers, aliases) => {
  const normalized = (headers || []).map(header => ({ header, key: normalizePlacementHeader(header) }));
  for (const alias of aliases) {
    const key = normalizePlacementHeader(alias);
    const exact = normalized.find(item => item.key === key);
    if (exact) return exact.header;
  }
  for (const alias of aliases) {
    const key = normalizePlacementHeader(alias);
    const partial = normalized.find(item => key.length >= 6 && item.key.includes(key));
    if (partial) return partial.header;
  }
  return '';
};

const mapPlacementRowData = (sheet, values) => Object.fromEntries(Object.entries(values).map(([key, value]) => [findPlacementHeader(sheet.headerValues || [], [key]) || key, value]));

const appendPlacementAudit = async event => {
  await loadDocInfo();
  let sheet = doc.sheetsByTitle[PLACEMENT_AUDIT_SHEET];
  if (!sheet) sheet = await doc.addSheet({ title: PLACEMENT_AUDIT_SHEET, headerValues: PLACEMENT_AUDIT_HEADERS });
  await ensurePlacementHeaders(sheet, PLACEMENT_AUDIT_HEADERS);
  return sheet.addRow(event);
};
const placementAuditChanges = fields => (fields || [])
  .filter(([, before, after]) => String(before ?? '').trim() !== String(after ?? '').trim())
  .map(([label, before, after]) => `${label}: ${String(before || '—').trim()} → ${String(after || '—').trim()}`);

const placementColumnName = value => {
  let column = Number(value) + 1;
  let name = '';
  while (column > 0) {
    const remainder = (column - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    column = Math.floor((column - 1) / 26);
  }
  return name;
};

const updateCachedSheetRow = async (sheet, row, updates) => {
  const rowNumber = Number(row?.rowNumber);
  const headers = sheet.headerValues || [];
  if (!Number.isInteger(rowNumber) || rowNumber < 2 || !headers.length) throw new Error('The cached sheet row is not ready for an update. Refresh the portal and try again.');
  const data = Object.entries(updates).flatMap(([key, value]) => {
    const index = headers.findIndex(header => normalizePlacementHeader(header) === normalizePlacementHeader(key));
    return index < 0 ? [] : [{
      range: `'${String(sheet.title).replace(/'/g, "''")}'!${placementColumnName(index)}${rowNumber}`,
      values: [[value ?? '']]
    }];
  });
  if (!data.length) throw new Error(`No matching columns were found to update in ${sheet.title}.`);
  await google.sheets({ version: 'v4', auth: serviceAccountAuth }).spreadsheets.values.batchUpdate({
    spreadsheetId: getSpreadsheetIdForSheetName(sheet.title),
    requestBody: { valueInputOption: 'USER_ENTERED', data }
  });
  if (Array.isArray(row._rawData)) {
    Object.entries(updates).forEach(([key, value]) => {
      const index = headers.findIndex(header => normalizePlacementHeader(header) === normalizePlacementHeader(key));
      if (index >= 0) row._rawData[index] = String(value ?? '');
    });
  }
  return row;
};

const addRowToCache = (field, row) => {
  const cache = getCache();
  if (cache && row && Number.isInteger(Number(row.rowNumber))) {
    const rows = cache[field] || [];
    if (!rows.some(existing => Number(existing.rowNumber) === Number(row.rowNumber))) cache[field] = [...rows, row];
  }
};

const parsePlacementHistory = value => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed.filter(entry => entry && typeof entry === 'object') : [];
  } catch {
    return [];
  }
};

const placementHistoryEntry = ({ status, remarks, interviewDate, interviewTime, interviewVenue, changedBy, changedAt, event }) => ({
  status: String(status || ''),
  remarks: String(remarks || ''),
  interviewDate: String(interviewDate || ''),
  interviewTime: String(interviewTime || ''),
  interviewVenue: String(interviewVenue || ''),
  changedBy: String(changedBy || 'Placement team'),
  changedAt: String(changedAt || formatIndiaTimestamp()),
  event: String(event || 'Record updated')
});

const appendPlacementHistory = ({ row, oldStatus, status, oldRemarks, remarks, oldInterviewDate, interviewDate, oldInterviewTime, interviewTime, oldInterviewVenue, interviewVenue, changedBy, changedAt }) => {
  let history = parsePlacementHistory(getValByHeader(row, ['statushistory']));
  if (!history.length && (oldStatus || oldRemarks || oldInterviewDate || oldInterviewTime || oldInterviewVenue)) {
    history.push(placementHistoryEntry({
      status: oldStatus, remarks: oldRemarks, interviewDate: oldInterviewDate,
      interviewTime: oldInterviewTime, interviewVenue: oldInterviewVenue,
      changedBy: getValByHeader(row, ['placementofficer', 'tpo', 'tponame']) || 'Placement team',
      changedAt: getValByHeader(row, ['timestamp', 'date', 'time']) || changedAt,
      event: 'Existing record'
    }));
  }
  const statusChanged = String(oldStatus || '').trim() !== String(status || '').trim();
  const remarksChanged = String(oldRemarks || '').trim() !== String(remarks || '').trim();
  const dateChanged = String(oldInterviewDate || '').trim() !== String(interviewDate || '').trim();
  const timeChanged = String(oldInterviewTime || '').trim() !== String(interviewTime || '').trim();
  const venueChanged = String(oldInterviewVenue || '').trim() !== String(interviewVenue || '').trim();
  if (statusChanged || remarksChanged || dateChanged || timeChanged || venueChanged || !history.length) {
    const event = statusChanged ? `Status changed to ${status || 'Updated'}`
      : (dateChanged || timeChanged || venueChanged) ? 'Interview details updated'
        : remarksChanged ? 'Remarks updated' : 'Record created';
    history.push(placementHistoryEntry({ status, remarks, interviewDate, interviewTime, interviewVenue, changedBy, changedAt, event }));
  }
  return history.slice(-60);
};

const placementTrackingHeaders = ['Interview Date', 'Interview Time', 'Interview Venue', 'Status History'];
const placementActionHeaders = ['TPO Action Log', 'Action Type', 'Action Details'];

const appendTpoActionLog = async ({ changedAt, changedBy, studentName, studentContact, studentEmail, studentRoll, course, branch, qualification, resume, jobId, company, position, status, remarks, interviewDate, interviewTime, interviewVenue, datePlaced, packageLpa, joiningStatus, entrySource, actionType, actionDetails, historyEntry }) => {
  await loadDocInfo();
  const logSheet = doc.sheetsByTitle['TPO_Log'];
  if (!logSheet) throw new Error('The TPO_Log sheet is unavailable.');
  await ensurePlacementHeaders(logSheet, [...placementTrackingHeaders, ...placementActionHeaders]);
  const actionRow = {
    TimeStamp: changedAt || formatIndiaTimestamp(),
    'Student Name': studentName || '',
    Contact: studentContact || '',
    'Mail ID': studentEmail || '',
    'Roll Number': studentRoll || '',
    Course: course || '',
    Branch: branch || '',
    Qualification: qualification || '',
    Resume: resume || '',
    'Job ID': jobId || '',
    'Company Name': company || '',
    Position: position || '',
    'Placement Officer': changedBy || '',
    Status: status || '',
    Remarks: remarks || '',
    'DATE PLACED': datePlaced || '',
    'PACKAGE (LPA)': packageLpa || '',
    'Joining Status': joiningStatus || '',
    'Interview Date': interviewDate || '',
    'Interview Time': interviewTime || '',
    'Interview Venue': interviewVenue || '',
    'Entry Source': entrySource || 'Job Tracker',
    'Status History': JSON.stringify(historyEntry ? [historyEntry] : []),
    'TPO Action Log': 'YES',
    'Action Type': actionType || 'Record updated',
    'Action Details': actionDetails || ''
  };
  return logSheet.addRow(mapPlacementRowData(logSheet, actionRow), { insert: true });
};

const placementLogRecordKey = record => {
  const student = normalizePlacementText(record.roll || record.rollNumber || record.ipcsRollNumber || record.name || record.studentName);
  if (!student) return '';
  const jobId = normalizePlacementText(record.jobId || '');
  const company = normalizePlacementText(record.company || record.companyName || '');
  const position = normalizePlacementText(record.position || '');
  return `${student}|${jobId || (company || position ? `${company}|${position}` : 'general')}`;
};
const getPlacementLogRowKey = row => placementLogRecordKey({
  roll: getValByHeader(row, ['rollnumber', 'rollno', 'ipcsrollnumber', 'roll']),
  name: getValByHeader(row, ['studentname', 'name', 'candidate']),
  jobId: getValByHeader(row, ['jobid', 'job id']),
  company: getValByHeader(row, ['companyname', 'company']),
  position: getValByHeader(row, ['position', 'role'])
});
const findLatestCanonicalPlacementLog = (rows, targetKey) => (rows || [])
  .filter(row => !/^(yes|true|1)$/i.test(getValByHeader(row, ['tpoactionlog'])) && getPlacementLogRowKey(row) === targetKey)
  .sort((left, right) => Number(right.rowNumber || 0) - Number(left.rowNumber || 0))[0] || null;

const upsertPlacementTpoLog = async record => {
  await loadDocInfo();
  const logSheet = doc.sheetsByTitle['TPO_Log'];
  if (!logSheet) throw new Error('The TPO_Log sheet is unavailable.');
  await ensurePlacementHeaders(logSheet, [
    ...placementTrackingHeaders, ...placementActionHeaders, 'Entry Source', 'Offer Letter Status'
  ]);
  const targetKey = placementLogRecordKey(record);
  if (!targetKey) throw new Error('A student roll number or name is required to record a placement in TPO_Log.');
  const cachedRows = getCache()?.tpoLogs || [];
  const existing = record.tpoLogRow || (Number(record.sourceRow) >= 2
    ? cachedRows.find(row => Number(row.rowNumber) === Number(record.sourceRow))
    : null) || findLatestCanonicalPlacementLog(cachedRows, targetKey);
  const value = (key, aliases, fallback = '') => {
    const supplied = record[key];
    if (supplied !== undefined && supplied !== null && String(supplied).trim() !== '') return supplied;
    return existing ? getValByHeader(existing, aliases) || fallback : fallback;
  };
  const logData = {
    TimeStamp: formatIndiaTimestamp(),
    'Student Name': value('name', ['studentname', 'name', 'candidate']),
    Contact: value('phone', ['contact', 'phone', 'mobilenumber']),
    'Mail ID': value('email', ['mailid', 'email', 'studentemail', 'mail']),
    'Roll Number': value('roll', ['rollnumber', 'rollno', 'ipcsrollnumber', 'roll']),
    Course: value('course', ['course', 'program']),
    Branch: value('branch', ['branch', 'sittingbranch']),
    Qualification: value('qual', ['qualification', 'qual']),
    Resume: value('resume', ['resume', 'cv']),
    'Job ID': value('jobId', ['jobid', 'job id']),
    'Company Name': value('company', ['companyname', 'company']),
    Position: value('position', ['position', 'role']),
    'Placement Officer': value('placementOfficer', ['placementofficer', 'tpo', 'tponame', 'createdby']) || value('tpoName', ['placementofficer', 'tpo', 'tponame', 'createdby']),
    Status: record.status !== undefined ? record.status : (existing ? getValByHeader(existing, ['status']) : ''),
    Remarks: record.remarks !== undefined ? record.remarks : (existing ? getValByHeader(existing, ['remarks']) : ''),
    'DATE PLACED': record.datePlaced !== undefined ? record.datePlaced : (existing ? getValByHeader(existing, ['dateplaced']) : ''),
    'PACKAGE (LPA)': record.packageLpa !== undefined ? record.packageLpa : (existing ? getValByHeader(existing, ['package', 'packagelpa']) : ''),
    'Offer Letter Status': value('offerLetter', ['offerletterstatus', 'offerletter']),
    'Joining Status': record.joiningStatus !== undefined ? record.joiningStatus : (existing ? getValByHeader(existing, ['joiningstatus']) : ''),
    'Interview Date': record.interviewDate !== undefined ? record.interviewDate : (existing ? getValByHeader(existing, ['interviewdate']) : ''),
    'Interview Time': record.interviewTime !== undefined ? record.interviewTime : (existing ? getValByHeader(existing, ['interviewtime', 'intervewtime']) : ''),
    'Interview Venue': record.interviewVenue !== undefined ? record.interviewVenue : (existing ? getValByHeader(existing, ['interviewvenue']) : ''),
    'Entry Source': record.entrySource || (existing ? getValByHeader(existing, ['entrysource']) : '') || 'Placement status update',
    'Status History': record.statusHistory || (existing ? getValByHeader(existing, ['statushistory']) : ''),
    'TPO Action Log': '', 'Action Type': '', 'Action Details': ''
  };
  await ensurePlacementHeaders(logSheet, Object.keys(logData));
  const rowData = mapPlacementRowData(logSheet, logData);
  let savedRow = existing || null;
  if (savedRow) {
    await updateCachedSheetRow(logSheet, savedRow, rowData);
  } else {
    savedRow = await logSheet.addRow(rowData);
    addRowToCache('tpoLogs', savedRow);
  }
  return savedRow;
};

const syncPositivePlacement = async record => {
  try {
    const { tpoLogRow, ...placementRecord } = record;
    const logRow = tpoLogRow || await upsertPlacementTpoLog(placementRecord);
    await syncPlacedStudent({
      name: getValByHeader(logRow, ['studentname', 'name']),
      phone: getValByHeader(logRow, ['contact', 'phone']),
      email: getValByHeader(logRow, ['mailid', 'email', 'studentemail']),
      roll: getValByHeader(logRow, ['rollnumber', 'rollno', 'ipcsrollnumber', 'roll']),
      course: getValByHeader(logRow, ['course', 'program']),
      branch: getValByHeader(logRow, ['branch', 'sittingbranch']),
      qual: getValByHeader(logRow, ['qualification', 'qual']),
      resume: getValByHeader(logRow, ['resume', 'cv']),
      jobId: getValByHeader(logRow, ['jobid', 'job id']),
      company: getValByHeader(logRow, ['companyname', 'company']),
      position: getValByHeader(logRow, ['position', 'role']),
      placementOfficer: getValByHeader(logRow, ['placementofficer', 'tpo', 'tponame', 'createdby']),
      status: getValByHeader(logRow, ['status']),
      remarks: getValByHeader(logRow, ['remarks']),
      datePlaced: getValByHeader(logRow, ['dateplaced']),
      packageLpa: getValByHeader(logRow, ['package', 'packagelpa']),
      joiningStatus: getValByHeader(logRow, ['joiningstatus']),
      offerLetter: getValByHeader(logRow, ['offerletterstatus', 'offerletter']),
      sourceSheet: 'TPO_Log', sourceRow: logRow.rowNumber
    });
    return '';
  } catch (error) {
    console.error('Placement was saved but the Placed_Students sheet could not be updated:', error.message);
    return `The placement was saved, but the Placed_Students sheet could not be updated: ${error.message}`;
  }
};

exports.getApplications = async (req, res) => {
  if (!getCache()) await refreshCache();
  if (!getCache()) return res.status(503).json({ success: false, message: 'Placement data is still syncing. Please refresh shortly.' });
  let appsList = []; 
  const cache = getCache();
  const portalUser = req.portalUser || {};
  const scope = String(req.body?.scope || '').toLowerCase();
  const showBranchRecords = scope === 'branch';
  
  const sourceData = cache.applications || [];
  const studentByRoll = new Map();
  const studentsByName = new Map();
  (cache.students || []).forEach(student => {
    const rollKey = normalizePlacementText(getValByHeader(student, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']));
    const nameKey = normalizePlacementText(getValByHeader(student, ['studentname', 'name']));
    if (rollKey && !studentByRoll.has(rollKey)) studentByRoll.set(rollKey, student);
    if (nameKey) studentsByName.set(nameKey, [...(studentsByName.get(nameKey) || []), student]);
  });
  const studentForApplication = row => {
    const rollKey = normalizePlacementText(getValByHeader(row, ['rollnumber', 'rollno', 'ipcsrollnumber', 'roll']));
    if (rollKey && studentByRoll.has(rollKey)) return studentByRoll.get(rollKey);
    const nameKey = normalizePlacementText(getValByHeader(row, ['studentname', 'name']));
    const matches = nameKey ? studentsByName.get(nameKey) || [] : [];
    return matches.length === 1 ? matches[0] : null;
  };
  const historyKeyFor = row => [
    getValByHeader(row, ['rollnumber', 'rollno', 'ipcsrollnumber', 'roll']) || getValByHeader(row, ['studentname', 'name']),
    getValByHeader(row, ['companyname', 'company']),
    getValByHeader(row, ['jobid']) || getValByHeader(row, ['position', 'role'])
  ].map(normalizePlacementText).join('|');
  const historyByIdentity = new Map();
  (cache.tpoLogs || []).forEach(log => {
    const key = historyKeyFor(log);
    if (!key.replace(/\|/g, '')) return;
    let history = parsePlacementHistory(getValByHeader(log, ['statushistory']));
    if (!history.length) {
      const status = getValByHeader(log, ['status']);
      if (status) history = [placementHistoryEntry({
        status, remarks: getValByHeader(log, ['remarks']), interviewDate: getValByHeader(log, ['interviewdate']),
        interviewTime: getValByHeader(log, ['interviewtime', 'intervewtime']), interviewVenue: getValByHeader(log, ['interviewvenue']),
        changedBy: getValByHeader(log, ['placementofficer', 'tponame']) || 'Placement team',
        changedAt: getValByHeader(log, ['timestamp', 'dateplaced', 'date']), event: 'Existing placement log'
      })];
    }
    if (history.length) historyByIdentity.set(key, [...(historyByIdentity.get(key) || []), ...history]);
  });

  sourceData.forEach((row) => {
      const studentData = studentForApplication(row);
      const roll = getValByHeader(row, ['rollnumber', 'rollno', 'ipcsrollnumber', 'roll']) || (studentData && getValByHeader(studentData, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll'])) || '';
      const sourceBranch = getValByHeader(row, ['branch']) || (studentData && getValByHeader(studentData, ['branch', 'sittingbranch'])) || '';
      const branch = sourceBranch || 'Unknown';
      const course = getValByHeader(row, ['course']) || (studentData && getValByHeader(studentData, ['course', 'program'])) || 'Unknown';
      const jobId = getValByHeader(row, ['jobid', 'job id']) || '';
      const withinAssignedScope = hasPlacementBranchAccess(branch, portalUser);
      const allowedForTracker = isPlacementTrackerAdmin(portalUser)
        || (isPlacementTrackerTpo(portalUser)
          ? (showBranchRecords ? withinAssignedScope : isOwnedPlacementApplication(row, portalUser))
          : withinAssignedScope);
      if (allowedForTracker) {
      const phone = getValByHeader(row, ['contact', 'phone', 'mobilenumber']) || (studentData && getValByHeader(studentData, ['phone', 'contact', 'mobilenumber'])) || '';
      const email = getValByHeader(row, ['mailid', 'studentemail', 'email', 'mail']) || (studentData && getValByHeader(studentData, ['mailid', 'email', 'mail'])) || '';
      const resume = getValByHeader(row, ['resume', 'cv']) || (studentData && getValByHeader(studentData, ['resume', 'cv'])) || '';
      const qual = getValByHeader(row, ['qualification', 'qual']) || (studentData && getValByHeader(studentData, ['qualification', 'qual'])) || '';

      const status = getValByHeader(row, ['status']) || 'Applied';
      const remarks = getValByHeader(row, ['remarks']) || '';
      const tpoName = getValByHeader(row, ['placementofficer', 'tpo', 'tponame', 'createdby']) || getPlacementJobOwner(jobId) || '';
      const interviewDate = getValByHeader(row, ['interviewdate']) || '';
      const interviewTime = getValByHeader(row, ['interviewtime', 'intervewtime']) || '';
      const interviewVenue = getValByHeader(row, ['interviewvenue']) || '';
      let statusHistory = parsePlacementHistory(getValByHeader(row, ['statushistory']));
      const relatedHistory = historyByIdentity.get(historyKeyFor(row)) || [];
      if (relatedHistory.length) {
        const seenHistory = new Set();
        statusHistory = [...statusHistory, ...relatedHistory].filter(entry => {
          const key = [entry.status, entry.changedAt, entry.remarks, entry.interviewDate, entry.interviewTime, entry.interviewVenue].map(value => String(value || '').trim()).join('|');
          if (seenHistory.has(key)) return false;
          seenHistory.add(key);
          return true;
        }).sort((left, right) => (safeParseDate(left.changedAt)?.getTime() || 0) - (safeParseDate(right.changedAt)?.getTime() || 0));
      }
      if (!statusHistory.length && (status || remarks || interviewDate || interviewTime || interviewVenue)) {
        statusHistory = [placementHistoryEntry({ status, remarks, interviewDate, interviewTime, interviewVenue, changedBy: tpoName || 'Placement team', changedAt: getValByHeader(row, ['timestamp', 'date', 'time']), event: 'Current record' })];
      }
      appsList.push({
        rowNumber: row.rowNumber, recordType: 'application', origin: getValByHeader(row, ['entrysource', 'recordorigin', 'origin', 'source']), name: getValByHeader(row, ['studentname', 'name', 'candidate']) || (studentData && getValByHeader(studentData, ['studentname', 'name'])) || '', roll, branch, course, qual: qual || 'Not Specified', jobId, company: getValByHeader(row, ['companyname', 'company']) || 'Unknown Company', position: getValByHeader(row, ['position', 'role']) || 'Unknown Position', date: getValByHeader(row, ['timestamp', 'date', 'time']) || '', status, remarks, statusHistory, interviewDate, interviewTime, interviewVenue, tpoName, phone, email, resume, datePlaced: getValByHeader(row, ['dateplaced']) || '', packageLpa: getValByHeader(row, ['package']) || '', offerLetter: getValByHeader(row, ['offerletter']) || '', joiningStatus: getValByHeader(row, ['joiningstatus']) || ''
      });
    }
  });
  
  res.json({ success: true, applications: appsList, lastSyncedAt: cache.cacheUpdatedAt || '' });
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
    const requestedRoll = normalizePlacementText(fullApp.roll);
    const requestedName = normalizePlacementText(fullApp.name);
    const requestedJobId = normalizePlacementText(fullApp.jobId);
    const requestedCompany = normalizePlacementText(fullApp.company);
    const requestedPosition = normalizePlacementText(fullApp.position);
    const hasRecordIdentity = Boolean(requestedRoll || requestedName) && Boolean(requestedJobId || requestedCompany || requestedPosition);
    if (!appSheet || (!Number.isInteger(rowNumber) && !hasRecordIdentity)) return res.status(400).json({ success: false, message: "Invalid payload or sheet missing." });
    await ensurePlacementHeaders(appSheet, placementTrackingHeaders);

    let sourceRow = null;
    const cachedApplications = getCache()?.applications || [];
    if (hasRecordIdentity) {
      const matches = cachedApplications.filter(row => {
        const roll = normalizePlacementText(getValByHeader(row, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']));
        const name = normalizePlacementText(getValByHeader(row, ['studentname', 'name']));
        const jobId = normalizePlacementText(getValByHeader(row, ['jobid', 'job id']));
        const company = normalizePlacementText(getValByHeader(row, ['companyname', 'company']));
        const position = normalizePlacementText(getValByHeader(row, ['position', 'role']));
        const studentMatches = requestedRoll ? roll === requestedRoll : name === requestedName;
        return studentMatches
          && (!requestedJobId || jobId === requestedJobId)
          && (!requestedCompany || company === requestedCompany)
          && (!requestedPosition || position === requestedPosition);
      });
      sourceRow = matches.length === 1
        ? matches[0]
        : matches.find(row => Number(row.rowNumber) === rowNumber) || null;
      if (matches.length > 1 && !sourceRow) return res.status(409).json({ success: false, message: 'This application matches multiple rows. Refresh the tracker and try again.' });
    } else if (Number.isInteger(rowNumber) && rowNumber >= 2) {
      sourceRow = cachedApplications.find(row => Number(row.rowNumber) === rowNumber) || null;
    }

    if (!sourceRow) {
      return res.status(404).json({ success: false, message: "Application record not found in Google Sheets." });
    }

    const user = req.portalUser;
    const sourceBranch = getValByHeader(sourceRow, ['branch']);
    const sourceCourse = getValByHeader(sourceRow, ['course']);
    const rowRoll = normalizePlacementText(getValByHeader(sourceRow, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']));
    const rowName = normalizePlacementText(getValByHeader(sourceRow, ['studentname', 'name']));
    const linkedStudent = (getCache()?.students || []).find(student => {
      const studentRoll = normalizePlacementText(getValByHeader(student, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']));
      return rowRoll && studentRoll === rowRoll;
    }) || ((getCache()?.students || []).filter(student => rowName && normalizePlacementText(getValByHeader(student, ['studentname', 'name'])) === rowName).length === 1
      ? (getCache()?.students || []).find(student => normalizePlacementText(getValByHeader(student, ['studentname', 'name'])) === rowName)
      : null);
    if (!canAccessTrackerApplication(sourceRow, user, linkedStudent)) {
      return res.status(403).json({ success: false, message: 'This application does not belong to one of your openings.' });
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
    const oldStatus = oldStatusH ? getValByHeader(sourceRow, ['status']) : '';
    const oldRemarks = getValByHeader(sourceRow, ['remarks']);
    const oldInterviewDate = getValByHeader(sourceRow, ['interviewdate']);
    const oldInterviewTime = getValByHeader(sourceRow, ['interviewtime', 'intervewtime']);
    const oldInterviewVenue = getValByHeader(sourceRow, ['interviewvenue']);
    const oldDatePlaced = getValByHeader(sourceRow, ['dateplaced']);
    const oldPackage = getValByHeader(sourceRow, ['package', 'packagelpa']);
    const oldJoiningStatus = getValByHeader(sourceRow, ['joiningstatus']);
    const oldOfferLetter = getValByHeader(sourceRow, ['offerletter', 'offerletterstatus']);

    // Treat the selected sheet row as the source of placement identity; the
    // browser's fullApp payload is only presentation data and is not trusted.
    const sName = getValByHeader(sourceRow, ['studentname', 'name']) || fullApp.name || '';
    const sContact = getValByHeader(sourceRow, ['contact', 'phone']) || fullApp.phone || '';
    const sMail = getValByHeader(sourceRow, ['mailid', 'email']) || fullApp.email || '';
    const sRoll = getValByHeader(sourceRow, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']) || fullApp.roll || '';
    const sCourse = sourceCourse || fullApp.course || '';
    const sBranch = sourceBranch || fullApp.branch || '';
    const sQual = getValByHeader(sourceRow, ['qualification', 'qual']) || fullApp.qual || '';
    const sResume = getValByHeader(sourceRow, ['resume', 'cv']) || fullApp.resume || '';
    const sJobId = getValByHeader(sourceRow, ['jobid']) || fullApp.jobId || '';
    const sCompany = getValByHeader(sourceRow, ['companyname', 'company']) || fullApp.company || '';
    const sPosition = getValByHeader(sourceRow, ['position', 'role']) || fullApp.position || '';
    const sTpo = getValByHeader(sourceRow, ['placementofficer', 'tpo', 'tponame', 'createdby']) || getPlacementJobOwner(sJobId) || user?.name || '';

    const updateObj = {};
    if (oldStatusH && status !== undefined) updateObj[oldStatusH] = status;
    
    const hRemarks = getSafeH(['remarks']); if (hRemarks && remarks !== undefined) updateObj[hRemarks] = remarks;
    const hDatePlaced = getSafeH(['dateplaced']); if (hDatePlaced && datePlaced !== undefined) updateObj[hDatePlaced] = formatIndiaDate(datePlaced);
    const hPackage = getSafeH(['package']); if (hPackage && packageLpa !== undefined) updateObj[hPackage] = packageLpa;
    const hOffer = getSafeH(['offerletter']); if (hOffer && offerLetterLink) updateObj[hOffer] = offerLetterLink;
    const hJoining = getSafeH(['joiningstatus']); if (hJoining && joiningStatus !== undefined) updateObj[hJoining] = joiningStatus;
    
    const hDate = getSafeH(['interviewdate']);
    const hTime = getSafeH(['interviewtime', 'intervewtime']);
    const hVenue = getSafeH(['interviewvenue']);
    
    const cleanInterviewDate = interviewDate !== undefined ? formatIndiaDate(interviewDate) : undefined;
    const cleanInterviewTime = interviewTime !== undefined ? formatIndiaTime(interviewTime) : undefined;
    if (hDate && interviewDate !== undefined) updateObj[hDate] = cleanInterviewDate;
    if (hTime && interviewTime !== undefined) updateObj[hTime] = cleanInterviewTime;
    if (hVenue && interviewVenue !== undefined) updateObj[hVenue] = interviewVenue;

    const nextStatus = status !== undefined ? status : oldStatus;
    const nextRemarks = remarks !== undefined ? remarks : oldRemarks;
    const nextInterviewDate = interviewDate !== undefined ? cleanInterviewDate : oldInterviewDate;
    const nextInterviewTime = interviewTime !== undefined ? cleanInterviewTime : oldInterviewTime;
    const nextInterviewVenue = interviewVenue !== undefined ? interviewVenue : oldInterviewVenue;
    const nextDatePlaced = datePlaced !== undefined ? formatIndiaDate(datePlaced) : oldDatePlaced;
    const nextPackage = packageLpa !== undefined ? packageLpa : oldPackage;
    const nextJoiningStatus = joiningStatus !== undefined ? joiningStatus : oldJoiningStatus;
    const nextOfferLetter = offerLetterLink || oldOfferLetter;
    const actionChanges = [];
    const recordActionChange = (label, before, after, wasProvided = true) => {
      if (!wasProvided || String(before ?? '').trim() === String(after ?? '').trim()) return;
      actionChanges.push(`${label}: ${String(before || '—').trim()} → ${String(after || '—').trim()}`);
    };
    recordActionChange('Status', oldStatus, nextStatus, status !== undefined);
    recordActionChange('Remarks', oldRemarks, nextRemarks, remarks !== undefined);
    recordActionChange('Interview date', oldInterviewDate, nextInterviewDate, interviewDate !== undefined);
    recordActionChange('Interview time', oldInterviewTime, nextInterviewTime, interviewTime !== undefined);
    recordActionChange('Interview venue', oldInterviewVenue, nextInterviewVenue, interviewVenue !== undefined);
    recordActionChange('Date placed', oldDatePlaced, nextDatePlaced, datePlaced !== undefined);
    recordActionChange('Package', oldPackage, nextPackage, packageLpa !== undefined);
    recordActionChange('Joining status', oldJoiningStatus, nextJoiningStatus, joiningStatus !== undefined);
    recordActionChange('Offer letter', oldOfferLetter, nextOfferLetter, Boolean(offerLetterLink));
    const changedAt = formatIndiaTimestamp();
    const nextHistory = appendPlacementHistory({
      row: sourceRow, oldStatus, status: nextStatus, oldRemarks, remarks: nextRemarks,
      oldInterviewDate, interviewDate: nextInterviewDate, oldInterviewTime, interviewTime: nextInterviewTime,
      oldInterviewVenue, interviewVenue: nextInterviewVenue, changedBy: user?.name || 'Placement team', changedAt
    });
    const historyHeader = getSafeH(['statushistory']);
    if (historyHeader) updateObj[historyHeader] = JSON.stringify(nextHistory);

    await updateCachedSheetRow(appSheet, sourceRow, updateObj);
    
    let updatedLogRow = null;
    let tpoLogSyncWarning = '';
    try {
      const logSheet = doc.sheetsByTitle["TPO_Log"];
      if (logSheet) {
        const logHeaders = await ensurePlacementHeaders(logSheet, placementTrackingHeaders);
        const logObj = {};
        
        const setLogH = (key, val) => {
           const cleanKey = key.toLowerCase().replace(/\s/g, '');
           const foundHeader = logHeaders.find(h => h.toLowerCase().replace(/\s/g, '') === cleanKey);
           if (foundHeader) logObj[foundHeader] = val;
        };

        setLogH('timestamp', changedAt);
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
        setLogH('status', nextStatus || '');
        setLogH('remarks', nextRemarks || '');
        setLogH('dateplaced', nextDatePlaced || '');
        setLogH('package', nextPackage || '');
        setLogH('offerletterstatus', nextOfferLetter || '');
        setLogH('joiningstatus', nextJoiningStatus || '');
        setLogH('interviewdate', nextInterviewDate || '');
        setLogH('interviewtime', nextInterviewTime || '');
        setLogH('intervewtime', nextInterviewTime || '');
        setLogH('interviewvenue', nextInterviewVenue || '');
        setLogH('statushistory', JSON.stringify(nextHistory));

        const logKey = placementLogRecordKey({ roll: sRoll, name: sName, jobId: sJobId, company: sCompany, position: sPosition });
        const existingLog = logKey ? findLatestCanonicalPlacementLog(getCache()?.tpoLogs || [], logKey) : null;
        if (existingLog) {
          updatedLogRow = await updateCachedSheetRow(logSheet, existingLog, logObj);
        } else {
          updatedLogRow = await logSheet.addRow(logObj);
          addRowToCache('tpoLogs', updatedLogRow);
        }
      } else {
        tpoLogSyncWarning = 'The application was saved, but TPO_Log is unavailable. Retry this status update after the placement log is restored.';
      }
    } catch(e) {
      console.error('Placement log sync failed:', e.message);
      tpoLogSyncWarning = `The application was saved, but its TPO_Log update failed: ${e.message}. Retry the same status update to complete it.`;
    }

    let actionLogWarning = '';
    if (actionChanges.length) {
      try {
        const nextHistoryEntry = nextHistory[nextHistory.length - 1];
        await appendTpoActionLog({
          changedAt, changedBy: sTpo, studentName: sName, studentContact: sContact, studentEmail: sMail,
          studentRoll: sRoll, course: sCourse, branch: sBranch, qualification: sQual, resume: sResume,
          jobId: sJobId, company: sCompany, position: sPosition, status: nextStatus, remarks: nextRemarks,
          interviewDate: nextInterviewDate, interviewTime: nextInterviewTime, interviewVenue: nextInterviewVenue,
          datePlaced: nextDatePlaced, packageLpa: nextPackage, joiningStatus: nextJoiningStatus,
          entrySource: getValByHeader(sourceRow, ['entrysource', 'recordorigin', 'origin']) || 'Job Application',
          actionType: actionChanges.map(change => change.split(':')[0]).join(', '),
          actionDetails: actionChanges.join('\n'), historyEntry: nextHistoryEntry
        });
      } catch (error) {
        console.error('Placement action audit failed:', error.message);
        actionLogWarning = `The update was saved, but its action could not be appended to TPO_Log: ${error.message}`;
      }
    }
    
    const interviewDetailsChanged = String(oldInterviewDate || '') !== String(nextInterviewDate || '') || String(oldInterviewTime || '') !== String(nextInterviewTime || '') || String(oldInterviewVenue || '') !== String(nextInterviewVenue || '');
    let emailWarning = '';
    if (oldStatus.toLowerCase() !== String(nextStatus || '').toLowerCase() || (String(nextStatus || '').toLowerCase() === 'interview scheduled' && interviewDetailsChanged)) {
      if (String(nextStatus || '').toLowerCase() === 'interview scheduled' && !sMail) {
        emailWarning = 'The placement update was saved, but the student has no email address on this application.';
      } else {
        try {
          await checkAndSendStudentMails({
            name: sName, roll: sRoll, email: sMail, company: sCompany,
            position: sPosition, tpoName: sTpo, branch: sBranch, jobId: sJobId
          }, nextStatus, { date: nextInterviewDate, time: nextInterviewTime, venue: nextInterviewVenue }, currentUserEmail);
        } catch (error) {
          emailWarning = `The placement update was saved, but the student email could not be sent: ${error.message}`;
        }
      }
    }

    // 🚨 DESIGN PORTAL AUTO-TRIGGER: Sends the student to Media Team if Placed/Joined
    let designTaskWarning = '';
    try {
      await autoCreateDesignTask({ ...fullApp, name: sName, roll: sRoll, email: sMail, course: sCourse, branch: sBranch, company: sCompany, position: sPosition, status });
    } catch (error) {
      console.error('Placement saved, but the Design Portal task could not be created:', error.message);
      designTaskWarning = `The placement was saved, but its Design Portal task could not be created: ${error.message}`;
    }

    const placedSheetWarning = await syncPositivePlacement({
      name: sName, phone: sContact, email: sMail, roll: sRoll, course: sCourse, branch: sBranch,
      qual: sQual, resume: sResume, jobId: sJobId, company: sCompany, position: sPosition,
      placementOfficer: sTpo, status: nextStatus, remarks: nextRemarks, datePlaced: nextDatePlaced,
      packageLpa: nextPackage, joiningStatus: nextJoiningStatus, offerLetter: nextOfferLetter,
      sourceSheet: 'TPO_Log', sourceRow: updatedLogRow?.rowNumber,
      tpoLogRow: updatedLogRow || undefined
    });
    if (!placedSheetWarning) tpoLogSyncWarning = '';
    else if (tpoLogSyncWarning) tpoLogSyncWarning = 'The initial TPO_Log write failed and the retry did not complete all placement sync steps. Check Placement Reconciliation before retrying.';

    let placementAuditWarning = '';
    if (actionChanges.length) {
      try {
        await appendPlacementAudit(createPlacementAuditEvent({
          actor: req.portalUser,
          action: actionChanges.map(change => change.split(':')[0]).join(', '),
          previousStatus: oldStatus,
          newStatus: nextStatus,
          record: { name: sName, roll: sRoll, jobId: sJobId, company: sCompany, position: sPosition, entrySource: getValByHeader(sourceRow, ['entrysource', 'recordorigin', 'origin']) || 'Job Application' },
          details: actionChanges.join('\n'),
          changedAt
        }));
      } catch (error) {
        console.error('Placement audit history could not be saved:', error.message);
        placementAuditWarning = `The placement update was saved, but its change history could not be recorded: ${error.message}`;
      }
    }

    refreshCache();
    res.json({ success: true, message: "Updated!", statusHistory: nextHistory, warning: [emailWarning, tpoLogSyncWarning, actionLogWarning, designTaskWarning, placedSheetWarning, placementAuditWarning].filter(Boolean).join(' ') });
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
    const previousStatus = getValByHeader(row, ['status']);
    const previousRemarks = getValByHeader(row, ['remarks']);
    const previousDatePlaced = getValByHeader(row, ['dateplaced']);
    const previousPackage = getValByHeader(row, ['package', 'packagelpa']);
    const previousJoiningStatus = getValByHeader(row, ['joiningstatus']);
    const previousOfferLetter = getValByHeader(row, ['offerletterstatus', 'offerletter']);
    const owner = getValByHeader(row, ['placementofficer', 'tpo', 'tponame', 'createdby']);
    const branch = getValByHeader(row, ['branch']);
    const course = getValByHeader(row, ['course']);
    const canEditPlacementLog = isPlacementTrackerTpo(user)
      ? placementOwnerMatchesUser(owner, user) || (!owner && hasPlacementBranchAccess(branch, user))
      : hasPlacementAccess(branch, course, user);
    if (!isPlacementTrackerAdmin(user) && !canEditPlacementLog) {
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
    setValue(['dateplaced'], formatIndiaDate(req.body.datePlaced || ''));
    setValue(['package', 'package(lpa)'], req.body.packageLpa || '');
    setValue(['joiningstatus'], req.body.joiningStatus || '');
    if (offerLetterLink) setValue(['offerletterstatus', 'offerletter'], offerLetterLink);
    if (!Object.keys(update).length) return res.status(422).json({ success: false, message: 'No editable placement fields were found in the log sheet.' });

    row.assign(update);
    await row.save();
    const newStatus = req.body.status || 'Placed';
    const newRemarks = req.body.remarks || '';
    const newDatePlaced = formatIndiaDate(req.body.datePlaced || '');
    const newPackage = req.body.packageLpa || '';
    const newJoiningStatus = req.body.joiningStatus || '';
    const changedFields = placementAuditChanges([
      ['Status', previousStatus, newStatus], ['Remarks', previousRemarks, newRemarks],
      ['Date placed', previousDatePlaced, newDatePlaced], ['Package', previousPackage, newPackage],
      ['Joining status', previousJoiningStatus, newJoiningStatus], ['Offer letter', previousOfferLetter, offerLetterLink]
    ]);
    const placedSheetWarning = await syncPositivePlacement({
      name: getValByHeader(row, ['studentname', 'name']), phone: getValByHeader(row, ['contact', 'phone']),
      email: getValByHeader(row, ['mailid', 'email']), roll: getValByHeader(row, ['rollnumber', 'rollno', 'ipcsrollnumber', 'roll']),
      course: getValByHeader(row, ['course']), branch: getValByHeader(row, ['branch']),
      qual: getValByHeader(row, ['qualification', 'qual']), resume: getValByHeader(row, ['resume', 'cv']),
      jobId: getValByHeader(row, ['jobid']), company: getValByHeader(row, ['companyname', 'company']),
      position: getValByHeader(row, ['position', 'role']), placementOfficer: getValByHeader(row, ['placementofficer', 'tpo', 'tponame']) || user?.name || user?.email || '',
      status: req.body.status || 'Placed', remarks: req.body.remarks || '', datePlaced: formatIndiaDate(req.body.datePlaced || ''),
      packageLpa: req.body.packageLpa || '', joiningStatus: req.body.joiningStatus || '',
      offerLetter: offerLetterLink, sourceSheet: 'TPO_Log', sourceRow: row.rowNumber, tpoLogRow: row
    });
    let auditWarning = '';
    try {
      await appendPlacementAudit(createPlacementAuditEvent({
        actor: user,
        action: 'Placement log updated',
        previousStatus,
        newStatus: req.body.status || 'Placed',
        record: { name: getValByHeader(row, ['studentname', 'name']), roll: getValByHeader(row, ['rollnumber', 'rollno', 'roll']), jobId: getValByHeader(row, ['jobid']), company: getValByHeader(row, ['companyname', 'company']), position: getValByHeader(row, ['position', 'role']), entrySource: getValByHeader(row, ['entrysource']) },
        details: changedFields.join('\n') || 'No tracked placement fields changed.',
        changedAt: formatIndiaTimestamp()
      }));
    } catch (error) {
      console.error('Placement audit history could not be saved:', error.message);
      auditWarning = `The placement was updated, but its change history could not be recorded: ${error.message}`;
    }
    refreshCache();
    return res.json({ success: true, message: 'Placement log updated.', warning: [placedSheetWarning, auditWarning].filter(Boolean).join(' ') });
  } catch (error) {
    console.error('Placement log update failed:', error);
    return res.status(500).json({ success: false, message: `Update failed: ${error.message}` });
  }
};

exports.updatePlacedStudent = async (req, res) => {
  const rowNumber = Number.parseInt(req.body?.rowNumber, 10);
  const user = req.portalUser || {};
  if (!Number.isInteger(rowNumber) || rowNumber < 2) return res.status(400).json({ success: false, message: 'A valid placed-student row is required.' });
  try {
    await loadDocInfo();
    const sheet = doc.sheetsByTitle['Placed_Students'];
    if (!sheet) return res.status(503).json({ success: false, message: 'The Placed_Students sheet is unavailable.' });
    await sheet.loadHeaderRow();
    const row = (await sheet.getRows({ offset: rowNumber - 2, limit: 1 }))[0];
    if (!row || Number(row.rowNumber) !== rowNumber) return res.status(404).json({ success: false, message: 'Placed-student row was not found.' });
    const owner = getValByHeader(row, ['placementofficer', 'tpo', 'tponame']);
    const branch = getValByHeader(row, ['branch']);
    const course = getValByHeader(row, ['course']);
    const isTpo = isPlacementTrackerTpo(user);
    const canEditAsTpo = placementOwnerMatchesUser(owner, user) || (!owner && hasPlacementBranchAccess(branch, user));
    const canEditByRole = isTpo ? canEditAsTpo : hasPlacementAccess(branch, course, user);
    if (!isPlacementTrackerAdmin(user) && !canEditByRole) {
      return res.status(403).json({ success: false, message: 'This placement is outside your assigned branches and is not assigned to you.' });
    }
    const status = req.body.status ?? getValByHeader(row, ['status']);
    const previousStatus = getValByHeader(row, ['status']);
    const previousJoiningStatus = getValByHeader(row, ['joiningstatus']);
    const previousRemarks = getValByHeader(row, ['remarks']);
    const previousDatePlaced = getValByHeader(row, ['dateplaced']);
    const previousPackage = getValByHeader(row, ['package', 'packagelpa']);
    const previousOfferLetter = getValByHeader(row, ['offerletter', 'offerletterstatus']);
    const joiningStatus = req.body.joiningStatus ?? getValByHeader(row, ['joiningstatus']);
    const remarks = req.body.remarks ?? getValByHeader(row, ['remarks']);
    const datePlaced = formatIndiaDate(req.body.datePlaced ?? getValByHeader(row, ['dateplaced']));
    const packageLpa = req.body.packageLpa ?? getValByHeader(row, ['package', 'packagelpa']);
    let offerLetter = getValByHeader(row, ['offerletter', 'offerletterstatus']);
    if (req.file) offerLetter = await uploadToDrive(req.file, FOLDER_OFFER_LETTERS);
    const warning = await syncPositivePlacement({
      name: getValByHeader(row, ['studentname', 'name']), phone: getValByHeader(row, ['contact', 'phone']),
      email: getValByHeader(row, ['mailid', 'email']), roll: getValByHeader(row, ['rollnumber', 'rollno', 'ipcsrollnumber', 'roll']),
      course, branch, qual: getValByHeader(row, ['qualification', 'qual']), resume: getValByHeader(row, ['resume', 'cv']),
      jobId: getValByHeader(row, ['jobid']), company: getValByHeader(row, ['companyname', 'company']),
      position: getValByHeader(row, ['position', 'role']), placementOfficer: (isTpo ? user?.name || user?.email : owner) || owner,
      status, joiningStatus, remarks, datePlaced, packageLpa, offerLetter,
      entrySource: 'Placed Students edit',
      statusHistory: getValByHeader(row, ['statushistory'])
    });
    if (warning) return res.status(503).json({ success: false, message: warning });
    const changedFields = placementAuditChanges([
      ['Status', previousStatus, status], ['Joining status', previousJoiningStatus, joiningStatus],
      ['Remarks', previousRemarks, remarks], ['Date placed', previousDatePlaced, datePlaced],
      ['Package', previousPackage, packageLpa], ['Offer letter', previousOfferLetter, offerLetter]
    ]);
    let auditWarning = '';
    try {
      await appendPlacementAudit(createPlacementAuditEvent({
        actor: user,
        action: 'Placed-student record updated',
        previousStatus,
        newStatus: status,
        record: { name: getValByHeader(row, ['studentname', 'name']), roll: getValByHeader(row, ['rollnumber', 'rollno', 'roll']), jobId: getValByHeader(row, ['jobid']), company: getValByHeader(row, ['companyname', 'company']), position: getValByHeader(row, ['position', 'role']), entrySource: getValByHeader(row, ['entrysource']) },
        details: changedFields.join('\n') || 'No tracked placement fields changed.',
        changedAt: formatIndiaTimestamp()
      }));
    } catch (error) {
      console.error('Placement audit history could not be saved:', error.message);
      auditWarning = `The placement was updated, but its change history could not be recorded: ${error.message}`;
    }
    await refreshCache();
    return res.json({ success: true, message: 'Placed-student record updated.', warning: auditWarning });
  } catch (error) {
    console.error('Placed-student update failed:', error);
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
  const saveProgress = [];
  let failedAt = 'Preparing placement';
  if (!isPlacementTrackerTpo(user) && !hasPlacementAccess(appData.branch, appData.course, user)) {
    return res.status(403).json({ success: false, message: 'This student is outside your branch or course assignment.' });
  }
  try {
    await loadDocInfo();
    let cache = getCache();
    if (!cache) {
      await refreshCache();
      cache = getCache();
    }
    if (!cache) return res.status(503).json({ success: false, message: 'Placement data is still syncing. Please retry shortly.' });
    let offerLetterLink = '';
    if (req.file) offerLetterLink = await uploadToDrive(req.file, FOLDER_OFFER_LETTERS);
    
    const appSheet = doc.sheetsByTitle["Opening_Applied"];
    const logSheet = doc.sheetsByTitle["TPO_Log"];

    if (!appSheet) return res.status(503).json({ success: false, message: 'The applications sheet is unavailable.' });
    if (!logSheet) return res.status(503).json({ success: false, message: 'The TPO_Log sheet is unavailable.' });

    const addedAt = formatIndiaTimestamp();
    const initialHistory = [placementHistoryEntry({ status: appData.status || 'Placed', remarks: appData.remarks || '', changedBy: tpoName || 'Placement team', changedAt: addedAt, event: 'Record created' })];

    const newRowObj = {
      'TimeStamp': addedAt,
      'Student Name': appData.name || '', 'Contact': appData.phone || '', 'Mail ID': appData.email || '', 
      'Roll Number': appData.roll || '', 'Course': appData.course || '', 'Branch': appData.branch || '', 
      'Qualification': appData.qual || '', 'Resume': appData.resume || '', 'Job ID': 'MANUAL-ADD', 
      'Company Name': appData.company || '', 'Position': appData.position || '', 
      'Placement Officer': tpoName || '', 'Status': appData.status || 'Placed', 
      'Entry Source': 'Manual Add',
      'Remarks': appData.remarks || '', 'DATE PLACED': formatIndiaDate(appData.datePlaced || ''),
      'PACKAGE (LPA)': appData.packageLpa || '', 'Offer Letter': offerLetterLink, 
      'Joining Status': appData.joiningStatus || '',
      'Interview Date': '', 'Interview Time': '', 'Interview Venue': '', 'Status History': JSON.stringify(initialHistory)
    };

    const manualPlacementKey = placementLogRecordKey({ roll: appData.roll, name: appData.name, jobId: 'MANUAL-ADD', company: appData.company, position: appData.position });
    await ensurePlacementHeaders(appSheet, Object.keys(newRowObj));
    const applicationRows = cache.applications || [];
    const existingApplication = manualPlacementKey
      ? applicationRows.filter(row => getPlacementLogRowKey(row) === manualPlacementKey).sort((left, right) => Number(right.rowNumber || 0) - Number(left.rowNumber || 0))[0] || null
      : null;
    const previousManualStatus = existingApplication ? getValByHeader(existingApplication, ['status']) : '';
    let savedApplicationRow = existingApplication;
    failedAt = 'Opening_Applied';
    if (existingApplication) {
      await updateCachedSheetRow(appSheet, existingApplication, mapPlacementRowData(appSheet, newRowObj));
    } else {
      savedApplicationRow = await appSheet.addRow(mapPlacementRowData(appSheet, newRowObj));
      addRowToCache('applications', savedApplicationRow);
    }
    saveProgress.push('Opening_Applied');

    failedAt = 'TPO_Log';
    await ensurePlacementHeaders(logSheet, [...Object.keys(newRowObj).filter(key => key !== 'Offer Letter'), 'Offer Letter Status']);
    const logRow = await upsertPlacementTpoLog({
      ...appData,
      jobId: 'MANUAL-ADD',
      placementOfficer: tpoName,
      status: appData.status || 'Placed',
      datePlaced: formatIndiaDate(appData.datePlaced || ''),
      offerLetter: offerLetterLink,
      entrySource: 'Manual Add',
      statusHistory: JSON.stringify(initialHistory)
    });
    saveProgress.push('TPO_Log');

    failedAt = 'Placed_Students';
    const placedSheetWarning = await syncPositivePlacement({
      ...appData,
      jobId: 'MANUAL-ADD',
      placementOfficer: tpoName,
      status: appData.status || 'Placed',
      datePlaced: formatIndiaDate(appData.datePlaced || ''),
      offerLetter: offerLetterLink,
      sourceSheet: 'TPO_Log',
      sourceRow: logRow.rowNumber,
      tpoLogRow: logRow
    });
    if (!placedSheetWarning) saveProgress.push('Placed_Students');

    let placementAuditWarning = '';
    try {
      await appendPlacementAudit(createPlacementAuditEvent({
        actor: user,
        action: existingApplication ? 'Manual placement updated' : 'Manual placement added',
        previousStatus: previousManualStatus,
        newStatus: appData.status || 'Placed',
        record: { name: appData.name, roll: appData.roll, jobId: 'MANUAL-ADD', company: appData.company, position: appData.position, entrySource: 'Manual Add' },
        details: 'Manual placement written to Opening_Applied, TPO_Log, and Placed_Students.',
        changedAt: addedAt
      }));
    } catch (error) {
      console.error('Placement audit history could not be saved:', error.message);
      placementAuditWarning = `The placement was saved, but its change history could not be recorded: ${error.message}`;
    }
    
    checkAndSendStudentMails({ ...appData, tpoName: tpoName }, appData.status || 'Placed', {}, req.body.currentUserEmail)
      .catch(error => console.error('Manual placement email failed:', error.message));

    // 🚨 DESIGN PORTAL AUTO-TRIGGER: Sends the manual addition to the Media Team
    let designTaskWarning = '';
    try {
      await autoCreateDesignTask({ ...appData, status: appData.status || 'Placed' });
    } catch (error) {
      console.error('Placement saved, but the Design Portal task could not be created:', error.message);
      designTaskWarning = `The placement was saved, but its Design Portal task could not be created: ${error.message}`;
    }

    refreshCache(); res.json({
      success: true,
      updated: Boolean(existingApplication),
      rowNumber: savedApplicationRow?.rowNumber || null,
      message: existingApplication ? 'Existing placement updated in Opening_Applied, TPO_Log, and Placed_Students.' : 'Placement added to Opening_Applied, TPO_Log, and Placed_Students.',
      savedSheets: saveProgress,
      pendingSheets: placedSheetWarning ? ['Placed_Students'] : [],
      recoveryAvailable: Boolean(placedSheetWarning),
      warning: [designTaskWarning, placedSheetWarning, placementAuditWarning].filter(Boolean).join(' ')
    });
  } catch (error) {
    console.error(`Manual placement save failed during ${failedAt}:`, error);
    res.status(500).json({
      success: false,
      message: `${error.message} Progress: ${saveProgress.length ? saveProgress.join(', ') : 'no sheet save was confirmed'}. Failed during ${failedAt}.`,
      savedSheets: saveProgress,
      failedAt,
      recoveryAvailable: saveProgress.includes('Opening_Applied')
    });
  }
};

const isPlacementOfficer = user => /(^|\b)(TPO|PLACEMENT OFFICER)(\b|$)/i.test(String(user?.role || ''));
const escapePlacementMailHtml = value => String(value || '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

exports.addDirectInterview = async (req, res) => {
  const user = req.portalUser;
  const { candidateName, candidateEmail, candidatePhone, candidateRoll, candidateBranch, candidateCourse, candidateResume, company, position, interviewDate, interviewTime, interviewVenue, remarks } = req.body || {};
  if (!isPlacementOfficer(user)) return res.status(403).json({ success: false, message: 'Only a placement officer can create a direct interview referral.' });
  if (!String(candidateName || '').trim() || !String(candidateEmail || '').trim() || !String(company || '').trim() || !String(position || '').trim() || !interviewDate || !interviewTime || !String(interviewVenue || '').trim()) {
    return res.status(400).json({ success: false, message: 'Enter the candidate name and email, then complete the company, position, interview date, time, and venue.' });
  }
  const cleanInterviewDate = formatIndiaDate(interviewDate);
  const cleanInterviewTime = formatIndiaTime(interviewTime);
  const normalizedEmail = String(candidateEmail || '').trim();
  if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return res.status(422).json({ success: false, message: 'Enter a valid candidate email address.' });
  const resumeLink = String(candidateResume || '').trim();
  if (resumeLink) {
    try { if (!['http:', 'https:'].includes(new URL(resumeLink).protocol)) throw new Error('protocol'); }
    catch { return res.status(422).json({ success: false, message: 'The resume link must be a valid http or https URL.' }); }
  }
  const saveProgress = [];
  let failedAt = 'Preparing interview';
  try {
    await loadDocInfo();
    const userBranches = [...(Array.isArray(user?.assignedBranchesArray) ? user.assignedBranchesArray : []), ...String(user?.assignedBranches || '').split(/[\n,;]+/)].map(value => String(value || '').trim()).filter(Boolean);
    const defaultBranch = user?.sittingBranch && !/^n\/?a$/i.test(String(user.sittingBranch).trim())
      ? String(user.sittingBranch).trim()
      : userBranches.find(value => !/^all(?: branches)?$/i.test(value)) || userBranches[0] || 'Unknown';
    const studentBranch = String(candidateBranch || '').trim() || defaultBranch;
    const studentCourse = String(candidateCourse || '').trim() || String(user?.assignedCourse || '').trim() || 'Unknown';
    const appSheet = doc.sheetsByTitle['Opening_Applied'];
    const logSheet = doc.sheetsByTitle['TPO_Log'];
    if (!appSheet) return res.status(503).json({ success: false, message: 'The applications sheet is unavailable.' });
    if (!logSheet) return res.status(503).json({ success: false, message: 'The TPO_Log sheet is unavailable. No interview was added.' });
    await ensurePlacementHeaders(logSheet, placementTrackingHeaders);

    const tpoName = user?.name || getValByHeader(user, ['name']) || 'Placement Officer';
    const cleanName = String(candidateName).trim();
    const cleanRoll = String(candidateRoll || '').trim();
    const studentData = {
      name: cleanName,
      roll: cleanRoll,
      email: normalizedEmail,
      phone: String(candidatePhone || '').trim(),
      course: studentCourse, branch: studentBranch,
      qual: '',
      resume: resumeLink
    };
    const resolvedJobId = 'MANUAL-ADD';
    const normalizedCompany = normalizePlacementText(company);
    const normalizedPosition = normalizePlacementText(position);
    const directLogKey = placementLogRecordKey({ roll: studentData.roll, name: studentData.name, jobId: resolvedJobId, company: String(company).trim(), position: String(position).trim() });
    const [applicationRows, logRows] = await Promise.all([appSheet.getRows(), logSheet.getRows()]);
    const existingApplication = applicationRows.find(row =>
      (cleanRoll
        ? normalizePlacementText(getValByHeader(row, ['rollnumber', 'rollno', 'roll'])) === normalizePlacementText(cleanRoll)
        : normalizePlacementText(getValByHeader(row, ['studentname', 'name'])) === normalizePlacementText(cleanName)) &&
      normalizePlacementText(getValByHeader(row, ['companyname', 'company'])) === normalizedCompany &&
      normalizePlacementText(getValByHeader(row, ['position', 'role'])) === normalizedPosition &&
      normalizePlacementText(getValByHeader(row, ['jobid'])) === normalizePlacementText(resolvedJobId)
    );
    const existingLog = directLogKey ? findLatestCanonicalPlacementLog(logRows, directLogKey) : null;
    if (existingApplication && existingLog) return res.status(409).json({ success: false, message: 'This student already has a record for that company, position, and opening. Open the existing record to update or reschedule it.' });

    const createdAt = formatIndiaTimestamp();
    const history = [placementHistoryEntry({ status: 'Interview Scheduled', remarks, interviewDate: cleanInterviewDate, interviewTime: cleanInterviewTime, interviewVenue, changedBy: tpoName, changedAt: createdAt, event: 'Direct interview referral created' })];
    const rowData = {
      TimeStamp: createdAt, 'Student Name': studentData.name, Contact: studentData.phone,
      'Mail ID': studentData.email, 'Roll Number': studentData.roll, Course: studentData.course,
      Branch: studentData.branch, Qualification: studentData.qual, Resume: studentData.resume,
      'Job ID': resolvedJobId, 'Company Name': String(company).trim(), Position: String(position).trim(),
      'Placement Officer': tpoName, 'Entry Source': 'Manual Add', Status: 'Interview Scheduled', Remarks: String(remarks || '').trim(),
      'Interview Date': cleanInterviewDate, 'Interview Time': cleanInterviewTime, 'Interview Venue': String(interviewVenue).trim(),
      'Status History': JSON.stringify(history)
    };
    await ensurePlacementHeaders(appSheet, Object.keys(rowData));
    failedAt = 'Opening_Applied';
    if (existingApplication) {
      existingApplication.assign(mapPlacementRowData(appSheet, rowData));
      await existingApplication.save();
    } else {
      await appSheet.addRow(mapPlacementRowData(appSheet, rowData));
    }
    saveProgress.push('Opening_Applied');

    const logData = { ...rowData, 'Offer Letter Status': '' };
    delete logData['Offer Letter'];
    failedAt = 'TPO_Log';
    await ensurePlacementHeaders(logSheet, Object.keys(logData));
    if (existingLog) {
      const logHistory = appendPlacementHistory({ row: existingLog, oldStatus: getValByHeader(existingLog, ['status']), status: 'Interview Scheduled', oldRemarks: getValByHeader(existingLog, ['remarks']), remarks, oldInterviewDate: getValByHeader(existingLog, ['interviewdate']), interviewDate: cleanInterviewDate, oldInterviewTime: getValByHeader(existingLog, ['interviewtime', 'intervewtime']), interviewTime: cleanInterviewTime, oldInterviewVenue: getValByHeader(existingLog, ['interviewvenue']), interviewVenue, changedBy: tpoName, changedAt: createdAt });
      logData['Status History'] = JSON.stringify(logHistory);
      existingLog.assign(mapPlacementRowData(logSheet, logData));
      await existingLog.save();
    } else {
      await logSheet.addRow(mapPlacementRowData(logSheet, logData));
    }
    saveProgress.push('TPO_Log');

    let placementAuditWarning = '';
    try {
      await appendPlacementAudit(createPlacementAuditEvent({
        actor: user,
        action: 'Manual interview referral added',
        previousStatus: '',
        newStatus: 'Interview Scheduled',
        record: { name: studentData.name, roll: studentData.roll, jobId: resolvedJobId, company: String(company).trim(), position: String(position).trim(), entrySource: 'Manual Add' },
        details: `Interview scheduled for ${cleanInterviewDate} at ${cleanInterviewTime}.`,
        changedAt: createdAt
      }));
    } catch (error) {
      console.error('Placement audit history could not be saved:', error.message);
      placementAuditWarning = `The interview was recorded, but its change history could not be saved: ${error.message}`;
    }

    let emailSent = false;
    let emailQueued = false;
    let emailWarning = '';
    if (studentData.email) {
      try {
        const mailResult = await checkAndSendStudentMails({ ...studentData, company: String(company).trim(), position: String(position).trim(), jobId: resolvedJobId, tpoName }, 'Interview Scheduled', { date: cleanInterviewDate, time: cleanInterviewTime, venue: interviewVenue }, user?.email || '');
        emailQueued = Boolean(mailResult?.queued);
        emailSent = !emailQueued;
        if (emailQueued) emailWarning = 'Interview recorded; the invitation email is queued for delivery.';
      } catch (error) {
        emailWarning = isMailDeliveryUncertain(error)
          ? `The interview was recorded, but email delivery is uncertain. Check the interview sender's Sent folder and the recipient before retrying.`
          : `The interview was recorded, but the email could not be sent: ${error.message}`;
      }
    } else {
      emailWarning = 'The interview was recorded, but no candidate email was entered, so the invitation was not sent.';
    }

    await refreshCache();
    const warning = [emailWarning, placementAuditWarning].filter(Boolean).join(' ');
    return res.json({ success: true, emailSent, emailQueued, savedSheets: saveProgress, warning, message: warning || 'Interview added to Opening_Applied and TPO_Log; invitation sent.' });
  } catch (error) {
    console.error(`Direct interview creation failed during ${failedAt}:`, error);
    return res.status(500).json({
      success: false,
      message: `Could not create the interview referral: ${error.message} Progress: ${saveProgress.length ? saveProgress.join(', ') : 'no sheet save was confirmed'}. Failed during ${failedAt}.`,
      savedSheets: saveProgress,
      failedAt,
      recoveryAvailable: saveProgress.includes('Opening_Applied')
    });
  }
};

exports.emailStudent = async (req, res) => {
  const user = req.portalUser;
  const { roll, rowNumber, sourceType, subject, message } = req.body || {};
  if (!isPlacementOfficer(user)) return res.status(403).json({ success: false, message: 'Only a placement officer can send a student email from this workspace.' });
  const requestedRow = Number(rowNumber);
  const hasRecordRow = Number.isInteger(requestedRow) && requestedRow >= 2;
  if ((!String(roll || '').trim() && !hasRecordRow) || !String(subject || '').trim() || !String(message || '').trim()) {
    return res.status(400).json({ success: false, message: 'Choose a placement record and enter an email subject and message.' });
  }
  try {
    await loadDocInfo();
    let cache = getCache();
    if (!cache?.students) cache = await refreshCache();
    let name = '';
    let email = '';
    let studentRoll = String(roll || '').trim();
    const numericRow = requestedRow;
    if (Number.isInteger(numericRow) && numericRow >= 2 && sourceType === 'drive') {
      const sheet = doc.sheetsByTitle['Drive_Registration'] || doc.sheetsByIndex.find(item => item.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('driveregistration'));
      const row = sheet && (await sheet.getRows({ offset: numericRow - 2, limit: 1 }))[0];
      if (!row) return res.status(404).json({ success: false, message: 'The drive registration was not found.' });
      name = getValByHeader(row, ['name', 'studentname']) || '';
      email = getValByHeader(row, ['mailid', 'email']) || '';
      studentRoll = getValByHeader(row, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']) || studentRoll;
      const matchingDrive = findPlacementDriveEvent(cache?.events || [], row);
      const driveOwner = getPlacementDriveOwner(matchingDrive) || getPlacementDriveOwner(row);
      if (!placementDriveOwnedByUser(matchingDrive, user) && !placementDriveOwnedByUser(row, user) && !placementOwnerMatchesUser(driveOwner, user)) {
        return res.status(403).json({ success: false, message: 'This placement drive was not created by your account.' });
      }
    } else if (Number.isInteger(numericRow) && numericRow >= 2) {
      const sheet = doc.sheetsByTitle['Opening_Applied'];
      const row = sheet && (await sheet.getRows({ offset: numericRow - 2, limit: 1 }))[0];
      if (!row) return res.status(404).json({ success: false, message: 'The application record was not found.' });
      if (!canAccessTrackerApplication(row, user)) return res.status(403).json({ success: false, message: 'This application does not belong to one of your openings.' });
      name = getValByHeader(row, ['studentname', 'name']) || '';
      email = getValByHeader(row, ['mailid', 'email']) || '';
      studentRoll = getValByHeader(row, ['rollnumber', 'rollno', 'roll']) || studentRoll;
    }
    const normalizedRoll = normalizePlacementText(studentRoll);
    const student = (cache?.students || []).find(row => normalizedRoll && normalizePlacementText(getValByHeader(row, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll'])) === normalizedRoll);
    if (student) {
      name ||= getValByHeader(student, ['name', 'studentname']);
      email ||= getValByHeader(student, ['mailid', 'email']);
    }
    if (!name && !studentRoll) return res.status(404).json({ success: false, message: 'Student not found in the placement record or student register.' });
    name ||= 'Student';
    if (!hasRecordRow) {
      const normalizedRollForAccess = normalizePlacementText(studentRoll);
      const hasOwnedApplication = (cache?.applications || []).some(row =>
        normalizePlacementText(getValByHeader(row, ['rollnumber', 'rollno', 'ipcsrollnumber', 'roll'])) === normalizedRollForAccess &&
        isOwnedPlacementApplication(row, user)
      );
      if (!hasOwnedApplication) return res.status(403).json({ success: false, message: 'This student has no application for one of your openings.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(422).json({ success: false, message: 'A valid candidate email address is not available on this record.' });
    const safeMessage = escapePlacementMailHtml(message).replace(/\r?\n/g, '<br>');
    const html = `<div style="margin:0 auto;max-width:640px;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#334155;background:#fff"><div style="padding:22px 28px;background:#0f172a;border-bottom:4px solid #7c3aed"><div style="font-size:12px;letter-spacing:.16em;color:#93c5fd;font-weight:700">IPCS GLOBAL • PLACEMENT CELL</div><h1 style="margin:10px 0 0;color:#fff;font-size:21px">Placement update</h1></div><div style="padding:26px 28px;font-size:15px;line-height:1.7"><p>Dear ${escapePlacementMailHtml(name)},</p><p>${safeMessage}</p><div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;color:#475569">Regards,<br><strong style="color:#0f172a">${escapePlacementMailHtml(user?.name || 'Placement Officer')}</strong><br>IPCS Global Placement Cell</div></div></div>`;
    const mailResult = await sendMailAndLog({ from: `"IPCS Placement Cell" <${process.env.EMAIL_USER}>`, to: email, subject: String(subject).trim(), html }, { name, email, type: 'TPO Student Email', category: 'placement' });
    return res.json({ success: true, queued: Boolean(mailResult?.queued), message: mailResult?.queued ? `Email to ${name} was queued for delivery.` : `Email sent to ${name}.` });
  } catch (error) {
    console.error('TPO student email failed:', error);
    return res.status(500).json({ success: false, message: `Email could not be sent: ${error.message}` });
  }
};

// ---------------------------------------------------------
// 🚨 EVENTS / VACANCIES / ISSUES / REPORTS
// ---------------------------------------------------------

let vacancySheetReadPromise = null;
const readCurrentVacancyRows = async () => {
  if (!vacancySheetReadPromise) {
    vacancySheetReadPromise = (async () => {
      await loadDocInfo();
      const sheet = getNewsletterSheet();
      if (!sheet) throw new Error('The NewsLetter sheet is unavailable.');
      await sheet.loadHeaderRow();
      return sheet.getRows();
    })();
  }
  try {
    return await vacancySheetReadPromise;
  } finally {
    vacancySheetReadPromise = null;
  }
};

exports.getVacancies = async (req, res) => {
  try {
    const cache = getCache();
    // Read NewsLetter directly here so additions made by another API instance
    // appear immediately instead of waiting for the shared five-minute cache.
    let vacancyRows = Array.isArray(cache?.vacancies) ? cache.vacancies : [];
    let vacancyReadWarning = '';
    try {
      vacancyRows = await readCurrentVacancyRows();
      if (Array.isArray(cache?.vacancies)) cache.vacancies = vacancyRows;
    } catch (refreshError) {
      console.warn('Using cached vacancy rows because NewsLetter could not be refreshed:', refreshError.message);
      vacancyReadWarning = 'Could not refresh the NewsLetter sheet. This list is cached and may not include recent openings.';
    }

    const companyLogos = new Map((cache?.clients || []).map(row => {
      const name = getValByHeader(row, ['companyname', 'company']).trim().toLowerCase();
      const logo = getValByHeader(row, ['companylogo', 'logo']).trim();
      return [name, logo];
    }).filter(([name, logo]) => name && logo));
    const user = req.portalUser;
    const canSeeVacancyEditFields = /(TPO|PLACEMENT OFFICER)/i.test(String(user?.role || '')) && String(user?.accessType || '').toLowerCase() !== 'superadmin';

    let vacs = vacancyRows.map(row => {
      const company = getValByHeader(row, ['companyname', 'company']);
      const actualJobId = getValByHeader(row, ['jobid', 'id']).trim();
      const rowTpoName = getValByHeader(row, ['placementofficer', 'tpo', 'tponame']);
      const canEditThisVacancy = canSeeVacancyEditFields && normalizePlacementText(rowTpoName) === normalizePlacementText(user?.name);
      return {
        id: actualJobId || getLegacyVacancyId(row),
        hasJobId: Boolean(actualJobId),
        rowNumber: row.rowNumber,
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
        ...(canEditThisVacancy ? {
          companyContact: getValByHeader(row, ['companycontact', 'contactnumber', 'phone', 'contact']),
          companyMailId: getValByHeader(row, ['companymailid', 'companyemail', 'mailid', 'email']),
          companyContactPerson: getValByHeader(row, ['companycontactperson', 'contactperson', 'person']),
          companyWebsite: getValByHeader(row, ['companywebsite', 'website', 'url']),
          openings: getValByHeader(row, ['noofopenings', 'numberofopenings', 'openings']),
          interviewDate: getValByHeader(row, ['interviewdate'])
        } : {}),
        status: getValByHeader(row, ['status']) || 'Open',
        tpoName: rowTpoName || 'Unknown',
        timestamp: getValByHeader(row, ['timestamp']) || '',
        datePosted: getValByHeader(row, ['date', 'posteddate']) || ''
      };
    }).filter(vacancy => {
      // Google Sheets can return formatted but otherwise empty grid rows.
      // They are not vacancies and must not be exposed as blank cards.
      if (!vacancy.company && !vacancy.position && !vacancy.hasJobId) return false;
      if (!user) return false;
      return isPlacementTrackerTpo(user)
        || hasAccess('All', vacancy.course, user.role, user.assignedBranchesArray, user.assignedCourse, user.department);
    });
    res.json({ success: true, vacancies: vacs.reverse(), warning: vacancyReadWarning });
  } catch (err) {
    console.error("Get Vacancies Error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

const vacancyOfficerRolePattern = /\b(?:tpo|placement|career\s+guidance|corporate\s+relation(?:ship)?s?|client\s+relation(?:ship)?s?)\b/i;
const normalizeVacancyOfficerName = value => normalizePlacementText(value).replace(/^(?:mrs|miss|ms|mr|dr|prof)+/, '');

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
    if (!name || (role && !vacancyOfficerRolePattern.test(role))) return;
    const key = normalizeVacancyOfficerName(name);
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
  { key: 'timestamp', title: 'Timestamp', aliases: ['timestamp', 'submittedat', 'createdat'] },
  { key: 'date', title: 'Date', aliases: ['date', 'posteddate'] },
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

const vacancyClientSyncLocks = new Map();
const withVacancyClientSyncLock = async (companyKey, operation) => {
  const previous = vacancyClientSyncLocks.get(companyKey) || Promise.resolve();
  let release;
  const current = new Promise(resolve => { release = resolve; });
  vacancyClientSyncLocks.set(companyKey, current);
  await previous;
  try {
    return await operation();
  } finally {
    release();
    if (vacancyClientSyncLocks.get(companyKey) === current) vacancyClientSyncLocks.delete(companyKey);
  }
};

// Keep this company-register sync behind one helper so its persistence can be
// replaced with a database upsert when the portal moves from Sheets to MySQL.
const ensureVacancyClientRecord = async vacancy => {
  const companyKey = normalizePlacementText(vacancy.companyName);
  if (!companyKey) throw new Error('A company name is required to sync the client register.');

  return withVacancyClientSyncLock(companyKey, async () => {
    const clientsSheet = doc.sheetsByTitle['Clients'];
    if (!clientsSheet) throw new Error('The Clients sheet is unavailable.');
    await clientsSheet.loadHeaderRow();
    const headers = [...(clientsSheet.headerValues || [])];
    const companyHeader = findVacancyHeader(headers, ['companyname', 'company']);
    if (!companyHeader) throw new Error('The Clients sheet is missing its Company Name column.');

    const clients = await clientsSheet.getRows();
    const alreadyExists = clients.some(row => normalizePlacementText(getValByHeader(row, ['companyname', 'company'])) === companyKey);
    if (alreadyExists) return { added: false, duplicate: true, rowNumber: null };

    const fieldSpecs = [
      { value: vacancy.placementOfficer, aliases: ['placementofficer', 'tpo', 'tponame'] },
      { value: vacancy.companyName, aliases: ['companyname', 'company'] },
      { value: vacancy.companyWebsite, aliases: ['companywebsite', 'website'] },
      { value: vacancy.state || vacancy.location, aliases: ['companylocation', 'state', 'location'] },
      { value: vacancy.companyContact, aliases: ['companycontact', 'contactnumber', 'phone', 'contact'] },
      { value: vacancy.companyMailId, aliases: ['companymailid', 'companyemail', 'mailid', 'email'] },
      { value: vacancy.companyContactPerson, aliases: ['companycontactperson', 'contactperson', 'person'] },
      { value: vacancy.companyLogo, aliases: ['companylogo', 'logo'] }
    ];
    const clientRow = {};
    fieldSpecs.forEach(field => {
      const header = findVacancyHeader(headers, field.aliases);
      if (header) clientRow[header] = field.value || '';
    });

    const savedClient = await clientsSheet.addRow(clientRow);
    const cache = getCache();
    if (Array.isArray(cache?.clients)) cache.clients.push(savedClient);
    return { added: true, duplicate: false, rowNumber: savedClient?.rowNumber || null };
  });
};

const formatTodayForVacancy = () => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric'
}).format(new Date());
const formatVacancyTimestamp = () => formatIndiaTimestamp();

let vacancyJobSequence = null;
let vacancyJobSequenceReady = null;
let vacancyAppendQueue = Promise.resolve();

const withVacancyAppendLock = async operation => {
  const previous = vacancyAppendQueue;
  let release;
  vacancyAppendQueue = new Promise(resolve => { release = resolve; });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
};

const highestSequentialVacancyNumber = rows => (rows || []).reduce((highest, row) => {
  const match = String(getValByHeader(row, ['jobid', 'id']) || '').trim().match(/^JOB\s*-\s*(\d+)$/i);
  return match ? Math.max(highest, Number(match[1])) : highest;
}, 10296);

const nextSequentialVacancyJobId = async (sheet, rows = null) => {
  if (vacancyJobSequence === null) {
    if (!vacancyJobSequenceReady) {
      vacancyJobSequenceReady = (async () => {
        let sourceRows = rows;
        if (!Array.isArray(sourceRows)) sourceRows = getCache()?.vacancies;
        if (!Array.isArray(sourceRows)) sourceRows = await sheet.getRows();
        vacancyJobSequence = highestSequentialVacancyNumber(sourceRows);
      })();
    }
    await vacancyJobSequenceReady;
  }

  vacancyJobSequence = Math.max(vacancyJobSequence, highestSequentialVacancyNumber(rows || [])) + 1;
  return `JOB - ${vacancyJobSequence}`;
};

exports.addVacancy = async (req, res) => {
  try {
    const input = req.body || {};
    const requiredFields = [
      'companyName', 'companyContact', 'companyMailId', 'companyContactPerson', 'companyWebsite',
      'course', 'position', 'state', 'location', 'workMode', 'openings', 'qualification',
      'jobDescription', 'experience', 'salary', 'genderPreference', 'interviewPlan', 'lastDate'
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
    const signedInOfficer = String(req.portalUser?.name || '').trim();
    const selectedOfficer = placementOfficers.find(name => normalizeVacancyOfficerName(name) === normalizeVacancyOfficerName(signedInOfficer));
    if (!selectedOfficer) return res.status(403).json({ success: false, message: 'Your signed-in account does not match a placement officer in the Contact sheet. Check the TPO Name and Position columns.' });

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
    const { jobId, rowData, savedRow } = await withVacancyAppendLock(async () => {
      // Re-read before allocating the sequential ID, then explicitly ask Sheets
      // to insert a row. INSERT_ROWS prevents appending over existing records.
      const latestRows = await sheet.getRows();
      const jobId = await nextSequentialVacancyJobId(sheet, latestRows);
      const rowData = {
        timestamp: formatVacancyTimestamp(),
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
        interviewDate: input.interviewPlan === 'Interview Scheduled' ? formatIndiaDate(input.interviewDate) : 'Will inform once scheduled',
        lastDate: formatIndiaDate(input.lastDate),
        placementOfficer: selectedOfficer,
        jobId,
        status: 'Open'
      };
      const rowValues = Object.fromEntries(Object.entries(rowData).map(([key, value]) => [headerMap.get(key), value]));
      const savedRow = await sheet.addRow(rowValues, { insert: true });
      return { jobId, rowData, savedRow };
    });
    let clientSync = null;
    try {
      clientSync = await ensureVacancyClientRecord(rowData);
    } catch (syncError) {
      console.error('Vacancy saved but Clients register sync failed:', syncError.message);
      clientSync = { added: false, duplicate: false, warning: syncError.message };
    }
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
      timestamp: rowData.timestamp,
      datePosted: rowData.date
    };
    const clientSyncMessage = clientSync?.warning
      ? ` The opening was saved, but its company could not be synced to Clients: ${clientSync.warning}`
      : clientSync?.added
        ? ' The new company was also added to Clients.'
        : ' The company was already listed in Clients, so no duplicate was added.';
    return res.status(201).json({
      success: true,
      vacancy,
      clientSync,
      sheet: sheet.title,
      rowNumber: savedRow?.rowNumber || null,
      message: `Vacancy added to ${sheet.title}${savedRow?.rowNumber ? ` at row ${savedRow.rowNumber}` : ''}.${clientSyncMessage}`
    });
  } catch (error) {
    console.error('Vacancy creation failed:', error.message);
    return res.status(500).json({ success: false, message: error.message || 'The vacancy could not be saved.' });
  }
};

const getNewsletterSheet = () => doc.sheetsByTitle['NewsLetter'] || doc.sheetsByIndex.find(item =>
  item.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('newsletter')
);

const toA1Column = columnNumber => {
  let value = Number(columnNumber);
  let label = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
};

const getVacancyInterviewCellValue = input => input.interviewPlan === 'Interview Scheduled'
  ? formatIndiaDate(input.interviewDate)
  : 'Will inform once scheduled';

const getEditableVacancyValues = (input, logoUrl) => {
  const experience = input.experience === 'Other'
    ? String(input.experienceOther || '').trim()
    : String(input.experience || '').trim();
  return {
    companyLogo: logoUrl,
    companyName: String(input.companyName || '').trim(),
    companyContact: String(input.companyContact || '').trim(),
    companyMailId: String(input.companyMailId || '').trim(),
    companyContactPerson: String(input.companyContactPerson || '').trim(),
    companyWebsite: String(input.companyWebsite || '').trim(),
    course: String(input.course || '').trim(),
    position: String(input.position || '').trim(),
    state: String(input.state || '').trim(),
    location: String(input.location || '').trim(),
    workMode: String(input.workMode || '').trim(),
    openings: String(input.openings || '').trim(),
    qualification: String(input.qualification || '').trim(),
    jobDescription: String(input.jobDescription || '').trim(),
    experience,
    salary: String(input.salary || '').trim(),
    genderPreference: String(input.genderPreference || '').trim(),
    interviewDate: getVacancyInterviewCellValue(input),
    lastDate: formatIndiaDate(input.lastDate)
  };
};

const validateVacancyEditInput = input => {
  const requiredFields = [
    'companyName', 'companyContact', 'companyMailId', 'companyContactPerson', 'companyWebsite',
    'course', 'position', 'state', 'location', 'workMode', 'openings', 'qualification',
    'jobDescription', 'experience', 'salary', 'genderPreference', 'interviewPlan', 'lastDate'
  ];
  const missingFields = requiredFields.filter(field => !String(input[field] || '').trim());
  if (missingFields.length) return `Please complete all required fields: ${missingFields.join(', ')}.`;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(input.companyMailId).trim())) return 'Enter a valid company email address.';
  if (!['Will Inform Once Scheduled', 'Interview Scheduled'].includes(String(input.interviewPlan || ''))) return 'Select an interview scheduling option.';
  if (input.interviewPlan === 'Interview Scheduled' && !/^\d{4}-\d{2}-\d{2}$/.test(String(input.interviewDate || ''))) return 'Select the scheduled interview date.';
  if (input.experience === 'Other' && !String(input.experienceOther || '').trim()) return 'Enter the custom experience requirement.';
  return '';
};

const getLegacyVacancyId = row => {
  const headers = row?._worksheet?.headerValues || [];
  const values = headers
    .map((header, index) => ({
      header: String(header || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
      value: String(row?._rawData?.[index] ?? '').trim()
    }))
    .filter(cell => !['jobid', 'id'].includes(cell.header))
    .map(cell => cell.value);
  return `LEGACY-${createHash('sha256').update(JSON.stringify(values)).digest('hex').slice(0, 24)}`;
};

const getVacancyActorName = req => String(req.portalUser?.name || '').trim();

const canManageVacancyRow = (user, row) => Boolean(
  user?.name && normalizeVacancyOfficerName(user.name) === normalizeVacancyOfficerName(
    getValByHeader(row, ['placementofficer', 'tpo', 'tponame'])
  )
);

const writeVacancyCellChanges = async (sheet, row, headers, changes, actorName) => {
  if (!changes.length) return;
  const spreadsheetId = getSpreadsheetIdForSheetName('NewsLetter');
  const rowNumber = Number(row.rowNumber);
  const sheetId = Number(sheet.sheetId);
  if (!spreadsheetId || !Number.isSafeInteger(rowNumber) || rowNumber < 2 || !Number.isSafeInteger(sheetId)) {
    throw new Error('Could not identify the NewsLetter spreadsheet row for the edit history.');
  }

  const endColumn = toA1Column(headers.length);
  const quotedSheetName = `'${String(sheet.title).replace(/'/g, "''")}'`;
  const sheetsApi = google.sheets({ version: 'v4', auth: serviceAccountAuth });
  const currentNotesResponse = await sheetsApi.spreadsheets.get({
    spreadsheetId,
    ranges: [`${quotedSheetName}!A${rowNumber}:${endColumn}${rowNumber}`],
    includeGridData: true,
    fields: 'sheets(data(rowData(values(note))))'
  });
  const currentNotes = currentNotesResponse.data?.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values || [];
  const timestamp = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).format(new Date());

  const requests = changes.map(change => {
    const columnIndex = headers.findIndex(header => header === change.header);
    if (columnIndex < 0) throw new Error(`Could not locate the ${change.header} column in NewsLetter.`);
    const oldValue = String(change.oldValue ?? '').trim();
    const newValue = String(change.newValue ?? '').trim();
    const priorNote = String(currentNotes[columnIndex]?.note || '').trim();
    const historyEntry = `${timestamp} IST — ${actorName} changed ${change.header}: “${oldValue.slice(0, 350)}” → “${newValue.slice(0, 350)}”.`;
    const combinedNote = [priorNote, historyEntry].filter(Boolean).join('\n');
    const boundedNote = combinedNote.length > 45000 ? combinedNote.slice(-45000) : combinedNote;
    const isoDate = ['lastDate', 'interviewDate'].includes(change.key) && newValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const dateAsSheetSerial = isoDate
      ? Date.UTC(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3])) / 86400000 + 25569
      : null;
    return {
      updateCells: {
        range: {
          sheetId,
          startRowIndex: rowNumber - 1,
          endRowIndex: rowNumber,
          startColumnIndex: columnIndex,
          endColumnIndex: columnIndex + 1
        },
        rows: [{ values: [{ userEnteredValue: dateAsSheetSerial === null ? { stringValue: newValue } : { numberValue: dateAsSheetSerial }, note: boundedNote }] }],
        fields: 'userEnteredValue,note'
      }
    };
  });

  await sheetsApi.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
};

exports.updateVacancy = async (req, res) => {
  try {
    const jobId = String(req.params.jobId || '').trim();
    const input = req.body || {};
    const validationError = validateVacancyEditInput(input);
    if (validationError) return res.status(400).json({ success: false, message: validationError });
    if (req.file && (!String(req.file.mimetype || '').startsWith('image/') || req.file.size > 10 * 1024 * 1024)) {
      return res.status(req.file.size > 10 * 1024 * 1024 ? 413 : 400).json({ success: false, message: 'The company logo must be an image no larger than 10 MB.' });
    }

    await loadDocInfo();
    const sheet = getNewsletterSheet();
    if (!sheet) return res.status(503).json({ success: false, message: 'The NewsLetter sheet is unavailable.' });
    await sheet.loadHeaderRow();
    const headers = [...(sheet.headerValues || [])];
    const jobIdHeader = findVacancyHeader(headers, ['jobid', 'id']);
    if (!jobIdHeader) return res.status(503).json({ success: false, message: 'The NewsLetter sheet has no JobID column.' });
    const rows = await sheet.getRows();
    let row = rows.find(item => String(item.get(jobIdHeader) || '').trim() === jobId);
    if (!row && /^LEGACY-[a-f0-9]{24}$/i.test(jobId)) {
      const legacyMatches = rows.filter(item => !String(item.get(jobIdHeader) || '').trim() && getLegacyVacancyId(item) === jobId);
      if (legacyMatches.length > 1) return res.status(409).json({ success: false, message: 'More than one legacy vacancy matches this row. Add a JobID to the correct sheet row before editing.' });
      row = legacyMatches[0] || null;
    }
    if (!row) return res.status(404).json({ success: false, message: 'This vacancy no longer exists.' });
    if (!canManageVacancyRow(req.portalUser, row)) return res.status(403).json({ success: false, message: 'You can edit only vacancies created by your placement account.' });

    const logoHeader = findVacancyHeader(headers, ['companylogo', 'logo']);
    let logoUrl = logoHeader ? String(row.get(logoHeader) || '').trim() : '';
    if (req.file) logoUrl = await uploadToDrive(req.file, FOLDER_CLIENT_LOGOS);
    const values = getEditableVacancyValues(input, logoUrl);
    const changes = [];
    const unavailableFields = [];
    Object.entries(values).forEach(([key, newValue]) => {
      const spec = vacancyHeaderSpecs.find(item => item.key === key);
      const header = spec && findVacancyHeader(headers, spec.aliases);
      if (!header) {
        unavailableFields.push(spec?.title || key);
        return;
      }
      const oldValue = row.get(header);
      if (String(oldValue ?? '').trim() !== String(newValue ?? '').trim()) {
        changes.push({ key, header, oldValue, newValue });
      }
    });
    if (unavailableFields.length) {
      return res.status(503).json({ success: false, message: `The NewsLetter sheet is missing columns: ${unavailableFields.join(', ')}.` });
    }

    const existingJobId = String(row.get(jobIdHeader) || '').trim();
    const persistedJobId = existingJobId || await nextSequentialVacancyJobId(sheet, rows);
    if (!existingJobId) changes.push({ key: 'jobId', header: jobIdHeader, oldValue: '', newValue: persistedJobId });

    await writeVacancyCellChanges(sheet, row, headers, changes, getVacancyActorName(req));
    refreshCache();
    const updated = {
      id: persistedJobId,
      hasJobId: true,
      company: values.companyName,
      companyLogo: logoUrl,
      position: values.position,
      location: values.location,
      state: values.state,
      mode: values.workMode,
      lastDate: values.lastDate,
      course: values.course,
      qualification: values.qualification,
      description: values.jobDescription,
      experience: values.experience,
      salary: values.salary,
      gender: values.genderPreference,
      companyContact: values.companyContact,
      companyMailId: values.companyMailId,
      companyContactPerson: values.companyContactPerson,
      companyWebsite: values.companyWebsite,
      openings: values.openings,
      interviewDate: values.interviewDate,
      status: getValByHeader(row, ['status']) || 'Open',
      tpoName: getValByHeader(row, ['placementofficer', 'tpo', 'tponame']) || getVacancyActorName(req),
      timestamp: getValByHeader(row, ['timestamp']) || '',
      datePosted: getValByHeader(row, ['date', 'posteddate']) || ''
    };
    return res.json({
      success: true,
      vacancy: updated,
      changedCells: changes.length,
      message: changes.length ? 'Vacancy updated. Each changed cell now has a timestamped edit note.' : 'No vacancy details changed.'
    });
  } catch (error) {
    console.error('Vacancy update failed:', error.message);
    return res.status(500).json({ success: false, message: error.message || 'The vacancy could not be updated.' });
  }
};

exports.deleteVacancy = async (req, res) => {
  try {
    const jobId = String(req.params.jobId || '').trim();
    if (!jobId) return res.status(400).json({ success: false, message: 'A vacancy Job ID is required.' });
    await loadDocInfo();
    const sheet = getNewsletterSheet();
    if (!sheet) return res.status(503).json({ success: false, message: 'The NewsLetter sheet is unavailable.' });
    await sheet.loadHeaderRow();
    const jobIdHeader = findVacancyHeader(sheet.headerValues || [], ['jobid', 'id']);
    if (!jobIdHeader) return res.status(503).json({ success: false, message: 'The NewsLetter sheet has no JobID column.' });
    const rows = await sheet.getRows();
    let row = rows.find(item => String(item.get(jobIdHeader) || '').trim() === jobId);
    if (!row && /^LEGACY-[a-f0-9]{24}$/i.test(jobId)) {
      const legacyMatches = rows.filter(item => !String(item.get(jobIdHeader) || '').trim() && getLegacyVacancyId(item) === jobId);
      if (legacyMatches.length > 1) return res.status(409).json({ success: false, message: 'More than one legacy vacancy matches this row. The row was not deleted.' });
      row = legacyMatches[0] || null;
    }
    if (!row) return res.status(404).json({ success: false, message: 'This vacancy no longer exists.' });
    if (!canManageVacancyRow(req.portalUser, row)) return res.status(403).json({ success: false, message: 'You can delete only vacancies created by your placement account.' });

    const linkedApplications = (getCache()?.applications || []).filter(application =>
      String(getValByHeader(application, ['jobid', 'job id', 'job_id']) || '').trim() === jobId
    );
    if (linkedApplications.length) {
      return res.status(409).json({
        success: false,
        message: `This vacancy has ${linkedApplications.length} linked application${linkedApplications.length === 1 ? '' : 's'}. Keep the row so those applications remain traceable.`
      });
    }

    await row.delete();
    refreshCache();
    return res.json({ success: true, message: 'Vacancy deleted from the NewsLetter sheet.' });
  } catch (error) {
    console.error('Vacancy deletion failed:', error.message);
    return res.status(500).json({ success: false, message: error.message || 'The vacancy could not be deleted.' });
  }
};

exports.getIssues = async (req, res) => {
  try {
    let cache = getCache();
    if (!cache) {
      await refreshCache();
      cache = getCache();
    }
    const user = req.portalUser || {};
    
    if (!cache) return res.status(503).json({ success: false, message: 'Issue data is still syncing. Please refresh shortly.' });
    if (cache.cacheSheetHealth && !cache.cacheSheetHealth.issues) {
      return res.status(503).json({ success: false, message: 'The Issues sheet could not be loaded. Please retry after the data sync completes.' });
    }

    let issuesList = (cache.issues || []).filter(row => {
      const rowBranch = getValByHeader(row, ['branch']);
      const studentName = getValByHeader(row, ['studentname', 'name', 'student']) || '';
      const studentRoll = normalizePlacementText(getValByHeader(row, ['rollnumber', 'rollno', 'ipcsrollnumber', 'roll']));
      const studentData = (cache.students || []).find(student => {
        const roll = normalizePlacementText(getValByHeader(student, ['rollnumber', 'rollno', 'ipcsrollnumber', 'roll']));
        return (studentRoll && roll === studentRoll) || (studentName && normalizePlacementText(getValByHeader(student, ['studentname', 'name'])) === normalizePlacementText(studentName));
      });
      const course = getValByHeader(row, ['course', 'program']) || (studentData ? getValByHeader(studentData, ['course', 'program']) : 'Unknown');
      return isPlacementTrackerAdmin(user) || isPlacementTrackerTpo(user)
        ? hasPlacementBranchAccess(rowBranch, user)
        : hasAccess(rowBranch, course, user.role, user.assignedBranchesArray, user.assignedCourse, user.department);
    }).map(row => ({ 
      rowNumber: row.rowNumber, 
      name: getValByHeader(row, ['studentname', 'name', 'student']) || 'Student',
      branch: getValByHeader(row, ['branch']), 
      details: getValByHeader(row, ['issuedetails', 'issue', 'details', 'description']) || '',
      status: getValByHeader(row, ['status']) || 'Pending', 
      remarks: getValByHeader(row, ['remarks']) || '' 
    }));
    
    res.json({
      success: true,
      issues: issuesList.reverse(),
      dataMeta: {
        sourceSheet: 'Issues',
        sourceHealthy: cache.cacheSheetHealth?.issues === true,
        lastRefreshAttemptAt: cache.cacheUpdatedAt || '',
        lastSuccessfulSyncAt: cache.cacheSheetUpdatedAt?.issues || ''
      }
    });
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
      const hasIssueAccess = isPlacementTrackerAdmin(user) || isPlacementTrackerTpo(user)
        ? hasPlacementBranchAccess(issueBranch, user)
        : hasAccess(issueBranch, issueCourse, user?.role, user?.assignedBranchesArray, user?.assignedCourse, user?.department);
      if (!hasIssueAccess) {
        return res.status(403).json({ success: false, message: 'This issue is outside your branch or course assignment.' });
      }
      rows[0].assign({ 'Status': status, 'Remarks': remarks }); await rows[0].save(); refreshCache(); res.json({ success: true, message: "Issue updated!" });
    }
    else { res.status(404).json({ success: false, message: "Row not found." }); }
  } catch (error) { res.status(500).json({ success: false, message: error.message }); }
};

exports.getReports = async (req, res) => {
  const { assignedBranchesArray, role, assignedCourse, department } = req.body;
  const reportUser = req.portalUser || {};
  const checkAccess = (rBranch, rCourse) => hasAccess(
    rBranch,
    rCourse,
    reportUser.role || role,
    Array.isArray(reportUser.assignedBranchesArray) ? reportUser.assignedBranchesArray : assignedBranchesArray,
    reportUser.assignedCourse ?? assignedCourse,
    reportUser.department ?? department
  );
  const checkPlacementReportAccess = (rBranch, rCourse) => isPlacementTrackerAdmin(reportUser) || isPlacementTrackerTpo(reportUser)
    ? hasPlacementBranchAccess(rBranch, reportUser)
    : hasPlacementAccess(rBranch, rCourse, reportUser);
  const checkAssignedBranchAccess = (rBranch, rCourse) => isPlacementTrackerAdmin(reportUser) || isPlacementTrackerTpo(reportUser)
    ? hasPlacementBranchAccess(rBranch, reportUser)
    : checkAccess(rBranch, rCourse);
  const reportRole = String(reportUser.role || role || '').toUpperCase();
  const isCentralTeamReportUser = isCentralPlacementTeam(reportUser);
  const isAdminReportUser = reportUser.accessType === 'superadmin' || reportRole.includes('ADMIN') || ['GENERAL MANAGER', 'ZONAL PLACEMENT HEAD', 'TECHNICAL HEAD'].includes(reportRole);

  if (!getCache()) await refreshCache();
  if (!getCache()) return res.status(503).json({ success: false, message: 'Report data is still syncing. Please refresh shortly.' });
  let students = [], applications = [], issues = [], talentino = [], tpoLogs = [], placementReportLogs = [];
  const cache = getCache();
  
  (cache.students || []).forEach(row => {
    if(!checkPlacementReportAccess(getValByHeader(row, ['branch']), getValByHeader(row, ['course']))) return;
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
  
  const studentsByRoll = new Map();
  const studentsByName = new Map();
  (cache.students || []).forEach(student => {
    const roll = normalizePlacementText(getValByHeader(student, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']));
    const name = normalizePlacementText(getValByHeader(student, ['studentname', 'name']));
    if (roll && !studentsByRoll.has(roll)) studentsByRoll.set(roll, student);
    if (name) studentsByName.set(name, [...(studentsByName.get(name) || []), student]);
  });
  const studentForApplication = row => {
    const roll = normalizePlacementText(getValByHeader(row, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']));
    if (roll && studentsByRoll.has(roll)) return studentsByRoll.get(roll);
    const name = normalizePlacementText(getValByHeader(row, ['studentname', 'name']));
    const matches = name ? studentsByName.get(name) || [] : [];
    return matches.length === 1 ? matches[0] : null;
  };
  const vacancyOwnerByJobId = new Map((cache.vacancies || []).map(row => [
    normalizePlacementText(getValByHeader(row, ['jobid', 'job id', 'id'])),
    getValByHeader(row, ['placementofficer', 'tpo', 'tponame', 'createdby', 'owner', 'postedby'])
  ]).filter(([jobId, owner]) => jobId && owner));

  (cache.applications || []).forEach(row => {
    const name = getValByHeader(row, ['studentname', 'name', 'candidate']);
    const roll = getValByHeader(row, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']);
    const jobId = getValByHeader(row, ['jobid', 'job id']);
    const company = getValByHeader(row, ['companyname', 'company']);
    const position = getValByHeader(row, ['position', 'role']);
    // Ignore empty padding rows returned by Google Sheets.
    if (!name && !roll && !jobId && !company && !position) return;

    const student = studentForApplication(row);
    const branch = getValByHeader(row, ['branch', 'sittingbranch']) || getValByHeader(student, ['branch', 'sittingbranch']);
    const course = getValByHeader(row, ['course', 'program']) || getValByHeader(student, ['course', 'program']);
    const normalizedJobId = normalizePlacementText(jobId);
    const isTpoOpeningReport = isPlacementTrackerTpo(reportUser);
    if (isTpoOpeningReport && !isOwnedPlacementApplication(row, reportUser)) return;
    if (!isTpoOpeningReport && !checkPlacementReportAccess(branch, course)) return;
    applications.push({
      rowNumber: row.rowNumber,
      name: name || getValByHeader(student, ['studentname', 'name']),
      roll: roll || getValByHeader(student, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']),
      jobId,
      company,
      position,
      date: getValByHeader(row, ['timestamp', 'dateapplied', 'applicationdate', 'date', 'time', 'createdat']),
      status: getValByHeader(row, ['status']),
      remarks: getValByHeader(row, ['remarks']),
      tpoName: getValByHeader(row, ['placementofficer', 'tpo', 'tponame']) || vacancyOwnerByJobId.get(normalizedJobId) || '',
      branch,
      course
    });
  });
  
  (cache.issues || []).forEach(row => {
    if (checkAssignedBranchAccess(getValByHeader(row, ['branch']), getValByHeader(row, ['course']))) issues.push({ name: getValByHeader(row, ['name']), branch: getValByHeader(row, ['branch']), details: getValByHeader(row, ['issuedetails']), status: getValByHeader(row, ['status']), remarks: getValByHeader(row, ['remarks']) });
  });
  
  (cache.tAtt || []).forEach(row => {
    if (checkAssignedBranchAccess(getValByHeader(row, ['branch']), getValByHeader(row, ['course']))) talentino.push({ name: getValByHeader(row, ['name']), branch: getValByHeader(row, ['branch']), date: getValByHeader(row, ['check-in', 'date']), rating: getValByHeader(row, ['rating']), notes: getValByHeader(row, ['notes']) });
  });
  
  let vacancies = (cache.vacancies || []).map(row => ({ id: getValByHeader(row, ['jobid', 'id']) || '', company: getValByHeader(row, ['company']) || '', location: getValByHeader(row, ['location']) || '', mode: getValByHeader(row, ['mode']) || '', status: getValByHeader(row, ['status']) || 'Open', course: getValByHeader(row, ['course']) || '', date: getValByHeader(row, ['lastdate', 'date']) || '' }));
  let events = (cache.events || []).map(row => ({
    date: getValByHeader(row, ['dateoftheevent', 'date']) || '',
    tpo: getValByHeader(row, ['createdby', 'tpo', 'placementofficer']) || '',
    type: getValByHeader(row, ['event', 'type']) || '',
    title: getValByHeader(row, ['title']) || '',
    branch: getValByHeader(row, ['branch']) || ''
  }));

  if (cache.tpoLogs) {
    cache.tpoLogs.forEach(row => { 
      try { 
        const rowData = row.toObject();
        // Strict mapping to ensure global view processes properly
        if(checkPlacementReportAccess(getValByHeader(row, ['branch']), getValByHeader(row, ['course']))) {
          tpoLogs.push({ ...rowData, rowNumber: row.rowNumber, sourceSheet: 'TPO_Log' });
        }
      } catch(e) {}
    });

  }

  // The monthly target report must use the same source and rule as the
  // placement register: every TPO_Log row whose Status column says "Placed".
  // Do not depend on the derived Placed_Students cache here; it can be behind
  // the source sheet during a partial Sheets sync.
  (cache.tpoLogs || []).forEach(row => {
    if (normalizePlacementText(getValByHeader(row, ['status'])) !== 'placed') return;
    const owner = getValByHeader(row, ['placementofficer', 'tpo', 'tponame']);
    const belongsToUser = isPlacementTrackerTpo(reportUser)
      ? (placementOwnerMatchesUser(owner, reportUser)
        || (!owner && hasPlacementBranchAccess(getValByHeader(row, ['branch']), reportUser)))
      : isCentralTeamReportUser || isAdminReportUser || checkPlacementReportAccess(getValByHeader(row, ['branch']), getValByHeader(row, ['course']));
    if (!belongsToUser) return;
    try { placementReportLogs.push({ ...row.toObject(), rowNumber: row.rowNumber, sourceSheet: 'TPO_Log' }); }
    catch (error) {}
  });
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

  res.json({
    success: true,
    students,
    applications,
    issues,
    talentino,
    vacancies,
    events,
    tpoLogs,
    placementReportLogs,
    tpoStats: tpoStatsList,
    dataMeta: {
      lastRefreshAttemptAt: cache.cacheUpdatedAt || '',
      sheetLastSuccessfulSyncAt: cache.cacheSheetUpdatedAt || {},
      sheetHealth: cache.cacheSheetHealth || {},
      failedSheets: cache.cacheFailedSheets || []
    }
  });
};

exports.getPlacedStudents = async (req, res) => {
  const user = req.portalUser || {};
  let cache = getCache();
  if (!cache) {
    await refreshCache();
    cache = getCache();
  }
  if (!cache) return res.status(503).json({ success: false, message: 'Placement data is still syncing. Please retry shortly.' });
  const records = [];

  for (const row of cache.tpoLogs || []) {
    // TPO_Log is the source of truth. Read it directly so a delayed or failed
    // Placed_Students projection cannot make this page incomplete.
    if (normalizePlacementText(getValByHeader(row, ['status'])) !== 'placed') continue;

    const owner = getValByHeader(row, ['placementofficer', 'tpo', 'tponame', 'createdby']);
    const branch = getValByHeader(row, ['branch', 'sittingbranch']);
    const course = getValByHeader(row, ['course', 'program']);
    const allowed = isPlacementTrackerAdmin(user)
      || (isPlacementTrackerTpo(user)
        ? placementOwnerMatchesUser(owner, user) || (!owner && hasPlacementBranchAccess(branch, user))
        : hasPlacementAccess(branch, course, user));
    if (!allowed) continue;

    try { records.push({ ...row.toObject(), rowNumber: row.rowNumber, sourceSheet: 'TPO_Log' }); }
    catch (error) { console.warn('Could not serialize a placed-student TPO_Log row:', error.message); }
  }

  res.json({
    success: true,
    records,
    dataMeta: {
      sourceSheet: 'TPO_Log',
      sourceStatusColumn: 'Status (column N)',
      sourceHealthy: cache.cacheSheetHealth?.tpoLogs === true,
      lastRefreshAttemptAt: cache.cacheUpdatedAt || '',
      lastSuccessfulSyncAt: cache.cacheSheetUpdatedAt?.tpoLogs || ''
    }
  });
};

exports.getPlacementReconciliation = async (req, res) => {
  try {
    let cache = getCache();
    if (!cache) {
      await refreshCache();
      cache = getCache();
    }
    if (!cache) return res.status(503).json({ success: false, message: 'Placement data is still syncing. Please retry shortly.' });
    const reconciliation = buildPlacementReconciliation({
      tpoLogs: cache.tpoLogs,
      placedStudents: cache.placedStudents,
      applications: cache.applications,
      getValue: getValByHeader
    });
    return res.json({
      success: true,
      reconciliation,
      dataMeta: {
        sourceSheet: 'TPO_Log',
        projectionSheet: 'Placed_Students',
        sourceHealthy: cache.cacheSheetHealth?.tpoLogs === true,
        projectionHealthy: cache.cacheSheetHealth?.placedStudents === true,
        sourceLastSuccessfulSyncAt: cache.cacheSheetUpdatedAt?.tpoLogs || '',
        projectionLastSuccessfulSyncAt: cache.cacheSheetUpdatedAt?.placedStudents || '',
        lastRefreshAttemptAt: cache.cacheUpdatedAt || '',
        refreshStatus: cache.cacheRefreshStatus || 'unknown',
        failedSheets: cache.cacheFailedSheets || []
      }
    });
  } catch (error) {
    console.error('Placement reconciliation failed:', error);
    return res.status(500).json({ success: false, message: `Could not reconcile placement records: ${error.message}` });
  }
};

exports.refreshPlacementReconciliation = async (_req, res) => {
  try {
    await refreshCache();
    const cache = getCache();
    const sourceHealthy = cache?.cacheSheetHealth?.tpoLogs === true;
    if (!cache || !sourceHealthy) {
      return res.status(503).json({
        success: false,
        message: 'A fresh read of the authoritative TPO_Log could not be confirmed. No reconciliation repair was run.',
        failedSheets: cache?.cacheFailedSheets || []
      });
    }
    return res.json({
      success: true,
      message: cache.cacheFailedSheets?.length
        ? `TPO_Log refreshed. Some supporting sheets could not refresh: ${cache.cacheFailedSheets.join(', ')}.`
        : 'TPO_Log and supporting placement sheets refreshed successfully.',
      refreshedAt: cache.cacheUpdatedAt || '',
      failedSheets: cache.cacheFailedSheets || []
    });
  } catch (error) {
    console.error('Placement reconciliation refresh failed:', error);
    return res.status(503).json({ success: false, message: `Could not refresh placement sheets: ${error.message}` });
  }
};

exports.repairManualPlacementSaves = async (req, res) => {
  try {
    await refreshCache();
    const cache = getCache();
    if (!cache || cache.cacheSheetHealth?.applications !== true || cache.cacheSheetHealth?.tpoLogs !== true) {
      return res.status(503).json({ success: false, message: 'Opening_Applied and TPO_Log must both sync successfully before retrying partial manual saves.' });
    }
    const missing = buildPlacementReconciliation({
      tpoLogs: cache.tpoLogs,
      placedStudents: cache.placedStudents,
      applications: cache.applications,
      getValue: getValByHeader
    }).missingManualLogRows;
    if (!missing.length) return res.json({ success: true, repaired: 0, message: 'No incomplete manual placement saves were found.' });

    let repaired = 0;
    for (const missingRow of missing) {
      const row = (cache.applications || []).find(item => Number(item.rowNumber) === Number(missingRow.rowNumber));
      if (!row) continue;
      const logRow = await upsertPlacementTpoLog({
        name: getValByHeader(row, ['studentname', 'name']),
        phone: getValByHeader(row, ['contact', 'phone']),
        email: getValByHeader(row, ['mailid', 'email']),
        roll: getValByHeader(row, ['rollnumber', 'rollno', 'ipcsrollnumber', 'roll']),
        course: getValByHeader(row, ['course', 'program']),
        branch: getValByHeader(row, ['branch', 'sittingbranch']),
        qual: getValByHeader(row, ['qualification', 'qual']),
        resume: getValByHeader(row, ['resume', 'cv']),
        jobId: getValByHeader(row, ['jobid', 'job id']) || 'MANUAL-ADD',
        company: getValByHeader(row, ['companyname', 'company']),
        position: getValByHeader(row, ['position', 'role']),
        placementOfficer: getValByHeader(row, ['placementofficer', 'tpo', 'tponame']),
        status: getValByHeader(row, ['status']),
        remarks: getValByHeader(row, ['remarks']),
        datePlaced: getValByHeader(row, ['dateplaced']),
        packageLpa: getValByHeader(row, ['package', 'packagelpa']),
        joiningStatus: getValByHeader(row, ['joiningstatus']),
        offerLetter: getValByHeader(row, ['offerletterstatus', 'offerletter']),
        entrySource: 'Manual Add',
        statusHistory: getValByHeader(row, ['statushistory'])
      });
      await syncPositivePlacement({ sourceSheet: 'TPO_Log', sourceRow: logRow.rowNumber, tpoLogRow: logRow });
      repaired += 1;
    }
    await refreshCache();
    return res.json({ success: true, repaired, message: `Retried ${repaired} incomplete manual placement save(s).` });
  } catch (error) {
    console.error('Partial manual placement recovery failed:', error);
    return res.status(500).json({ success: false, message: `Manual placement recovery stopped: ${error.message}` });
  }
};

exports.rebuildPlacedStudentProjection = async (req, res) => {
  try {
    await refreshCache();
    const result = await rebuildPlacedStudentsFromTpoLogs();
    await refreshCache();
    return res.json({
      success: true,
      result,
      message: `Verified Placed_Students against ${result.sourceCount} current TPO_Log rows. The normal source refresh backs up and rebuilds the projection if it detects a mismatch.`
    });
  } catch (error) {
    console.error('Placed_Students rebuild request failed:', error);
    return res.status(503).json({ success: false, message: error.message || 'Could not rebuild Placed_Students.' });
  }
};

exports.getPlacementAudit = async (req, res) => {
  try {
    await loadDocInfo();
    const sheet = doc.sheetsByTitle[PLACEMENT_AUDIT_SHEET];
    if (!sheet) return res.json({ success: true, available: false, logs: [] });
    const rows = await sheet.getRows();
    const logs = rows.slice(-200).reverse().map(row => ({
      eventId: getValByHeader(row, ['eventid']),
      timestamp: getValByHeader(row, ['timestamp']),
      actorName: getValByHeader(row, ['actorname']),
      actorEmail: getValByHeader(row, ['actoremail']),
      actorRole: getValByHeader(row, ['actorrole']),
      action: getValByHeader(row, ['action']),
      previousStatus: getValByHeader(row, ['previousstatus']),
      newStatus: getValByHeader(row, ['newstatus']),
      studentName: getValByHeader(row, ['studentname']),
      roll: getValByHeader(row, ['rollnumber']),
      jobId: getValByHeader(row, ['jobid']),
      company: getValByHeader(row, ['company']),
      position: getValByHeader(row, ['position']),
      entrySource: getValByHeader(row, ['entrysource']),
      details: getValByHeader(row, ['details'])
    }));
    return res.json({ success: true, available: true, logs });
  } catch (error) {
    console.error('Placement audit history could not be read:', error);
    return res.status(500).json({ success: false, message: `Could not load placement change history: ${error.message}` });
  }
};

exports.getTalentino = async (req, res) => {
  const actor = req.portalUser || {};
  const { assignedBranchesArray: requestedBranches, role: requestedRole, assignedCourse: requestedCourse } = req.body;
  const assignedBranchesArray = Array.isArray(actor.assignedBranchesArray) ? actor.assignedBranchesArray : requestedBranches;
  const role = actor.role || requestedRole;
  const assignedCourse = actor.assignedCourse || requestedCourse;
  let cache = getCache();
  if (!cache) {
    await refreshCache();
    cache = getCache();
  }
  if (!cache) return res.status(503).json({ success: false, message: 'Talentino data is still syncing. Please retry shortly.' });
  const attendanceRows = Array.isArray(cache.tAtt) ? cache.tAtt : [];
  const studentRows = Array.isArray(cache.students) ? cache.students : [];
  const scheduleRows = Array.isArray(cache.tSched) ? cache.tSched : [];
  const studentsByRoll = new Map();
  const studentsByName = new Map();
  const normalizeKey = value => normalizePlacementText(value);

  studentRows.forEach(student => {
    const roll = normalizeKey(getValByHeader(student, ['roll', 'rollno', 'rollnumber', 'ipcsrollnumber']));
    const name = normalizeKey(getValByHeader(student, ['name', 'studentname']));
    if (roll && !studentsByRoll.has(roll)) studentsByRoll.set(roll, student);
    if (name && !studentsByName.has(name)) studentsByName.set(name, student);
  });

  const resolveSession = createTalentinoSessionResolver(scheduleRows, getValByHeader, safeParseDate);

  const records = attendanceRows.filter(row => {
    const rowBranch = getValByHeader(row, ['branch']);
    const studentName = getValByHeader(row, ['name', 'student']) || '';
    const studentRoll = normalizeKey(getValByHeader(row, ['roll', 'rollno', 'rollnumber', 'ipcsrollnumber']));
    const studentData = (studentRoll && studentsByRoll.get(studentRoll)) || studentsByName.get(normalizeKey(studentName));
    const sCourse = getValByHeader(row, ['course', 'program']) || (studentData ? getValByHeader(studentData, ['course']) : 'Unknown');
    return isPlacementTrackerAdmin(actor) || isPlacementTrackerTpo(actor)
      ? hasPlacementBranchAccess(rowBranch, actor)
      : hasAccess(rowBranch, sCourse, role, assignedBranchesArray, assignedCourse, actor.department);
  }).map(row => {
    const date = getValByHeader(row, ['timestamp', 'date', 'time', 'present check-ins date']);
    const branch = getValByHeader(row, ['branch']);
    const match = resolveSession(row);
    const schedule = match.session;
    return { name: getValByHeader(row, ['name', 'student']), branch, date, rating: getValByHeader(row, ['rating']), notes: getValByHeader(row, ['notes', 'remark']), tpo: getValByHeader(row, ['tpo', 'placementofficer', 'conductedby', 'createdby']) || getValByHeader(schedule, ['tpo', 'placementofficer', 'conductedby', 'createdby']), sessionId: getValByHeader(row, ['sessionid', 'eventid', 'event id']) || getValByHeader(schedule, ['sessionid', 'eventid', 'event id']), sessionMatchType: match.matchType };
  });
  const upperRole = String(role || '').toUpperCase();
  const isRth = /(^|[^A-Z0-9])RTH([^A-Z0-9]|$)/.test(upperRole) || upperRole.includes('REGIONAL TECHNICAL HEAD');
  const sessions = scheduleRows.map(row => {
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
  res.json({
    success: true,
    dates: Array.from(dates).sort().reverse(),
    records: records.reverse(),
    sessions: sessions.reverse(),
    dataMeta: {
      attendanceHealthy: cache.cacheSheetHealth?.tAtt === true,
      scheduleHealthy: cache.cacheSheetHealth?.tSched === true,
      studentDirectoryHealthy: cache.cacheSheetHealth?.students === true,
      lastRefreshAttemptAt: cache.cacheUpdatedAt || '',
      attendanceLastSuccessfulSyncAt: cache.cacheSheetUpdatedAt?.tAtt || '',
      scheduleLastSuccessfulSyncAt: cache.cacheSheetUpdatedAt?.tSched || '',
      visibleAttendanceRows: records.length,
      visibleScheduledSessions: sessions.length
    }
  });
};

const MAIN_PLACEMENT_COURSES = [
  'Information technology (IT)',
  'BMS AND CCTV',
  'Embedded and IoT',
  'Industrial Automation',
  'Digital Marketing'
];

const normalizeEventHeader = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const findEventHeader = (headers, aliases) => {
  const normalized = (headers || []).map(header => ({ header, key: normalizeEventHeader(header) }));
  for (const alias of aliases) {
    const key = normalizeEventHeader(alias);
    const found = normalized.find(item => item.key === key);
    if (found) return found.header;
  }
  return '';
};

const getExactEventValue = (row, aliases) => {
  const headers = row?._worksheet?.headerValues || [];
  const header = findEventHeader(headers, aliases);
  const index = headers.indexOf(header);
  return index >= 0 ? String(row?._rawData?.[index] ?? '').trim() : '';
};

const ensureEventHeaders = async (sheet, titles) => {
  await sheet.loadHeaderRow();
  let headers = [...(sheet.headerValues || [])];
  const missing = titles.filter(title => !findEventHeader(headers, [title]));
  if (!missing.length) return headers;
  const requiredColumns = headers.length + missing.length;
  if ((Number(sheet.columnCount) || 0) < requiredColumns) await sheet.resize({ columnCount: requiredColumns });
  headers = [...headers, ...missing];
  await sheet.setHeaderRow(headers);
  await sheet.loadHeaderRow();
  return [...(sheet.headerValues || [])];
};

const serializeEvent = row => ({
  eventKey: getValByHeader(row, ['eventid']) || `row-${row?.rowNumber || ''}`,
  eventId: getValByHeader(row, ['eventid']),
  rowNumber: row?.rowNumber || null,
  date: formatIndiaDate(getValByHeader(row, ['dateoftheevent', 'date'])),
  tpo: getValByHeader(row, ['tpo', 'placementofficer']),
  branch: getValByHeader(row, ['branch']),
  course: getValByHeader(row, ['course', 'eligiblecourse']),
  type: getValByHeader(row, ['event', 'type']),
  title: getValByHeader(row, ['title']),
  description: getValByHeader(row, ['descripation', 'description']),
  time: formatIndiaTime(getValByHeader(row, ['timeoftheevent', 'time'])),
  location: getValByHeader(row, ['eventhappeningin', 'location']),
  poster: getValByHeader(row, ['posterlink', 'poster']),
  status: getExactEventValue(row, ['status']) || 'Scheduled',
  mailStatus: getExactEventValue(row, ['mailstatus']) || 'PENDING',
  mailError: getExactEventValue(row, ['mailerror']),
  statusUpdatedAt: getExactEventValue(row, ['statusupdatedat']),
  statusUpdatedBy: getExactEventValue(row, ['statusupdatedby']),
  statusReason: getExactEventValue(row, ['statusreason'])
});

const eventNotificationRecipients = event => {
  const senderEmail = process.env.EMAIL_USER || 'placementcell.ipcs@gmail.com';
  const giftyEmail = getUserEmailById('U003') || 'gifty@ipcsglobal.com';
  const ajithEmail = getUserEmailById('U001') || 'ajith@ipcsglobal.com';
  const rakeshEmail = getUserEmailById('U002') || 'rakesh@ipcsglobal.com';
  const eventType = String(event.type || '').toLowerCase();
  let to = [];
  let cc = [];
  let bcc = [];

  // Match the original event-creation audience: placement drives go to the
  // placement leads, TPOs, and branch managers; Talentino goes to its branch BM.
  if (eventType.includes('talentino')) {
    const branchContact = getBranchManagerEmail(event.branch) || getAssignedTpoEmail(event.branch);
    to = [branchContact];
    cc = [giftyEmail, getTpoEmailByName(event.tpo)];
  } else {
    to = [giftyEmail || senderEmail];
    cc = [ajithEmail, rakeshEmail];
    bcc = [...getAllBranchManagerEmails(), ...getAllTpoEmails()];
  }

  const valid = values => [...new Set(values.map(value => String(value || '').trim()).filter(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)))];
  const toList = valid(to);
  const toKeys = new Set(toList.map(value => value.toLowerCase()));
  const ccList = valid(cc).filter(value => !toKeys.has(value.toLowerCase()));
  const ccKeys = new Set([...toKeys, ...ccList.map(value => value.toLowerCase())]);
  const bccList = valid(bcc).filter(value => !ccKeys.has(value.toLowerCase()));
  return { to: toList.join(','), cc: ccList.join(','), bcc: bccList.join(',') };
};

const escapeEventHtml = value => String(value || '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

const buildEventStatusEmail = (event, status, details) => {
  const cancelled = status === 'Cancelled';
  const accent = cancelled ? '#dc2626' : '#7c3aed';
  const heading = cancelled ? 'Event Cancelled' : 'Event Rescheduled';
  const intro = cancelled
    ? 'Please note that the event below has been cancelled. Kindly share this update with the concerned students and staff.'
    : 'Please note the updated schedule below. Kindly share the revised details with the concerned students and staff.';
  const oldSchedule = `${escapeEventHtml(details.previousDate || event.date || 'TBD')} • ${escapeEventHtml(details.previousTime || event.time || 'Time to be confirmed')}`;
  const scheduleRows = cancelled
    ? `<tr><td style="padding:8px 0;color:#64748b;width:34%">Scheduled for</td><td style="padding:8px 0;color:#0f172a;font-weight:700">${oldSchedule}</td></tr>`
    : `<tr><td style="padding:8px 0;color:#64748b;width:34%">Previous schedule</td><td style="padding:8px 0;color:#64748b;text-decoration:line-through">${oldSchedule}</td></tr><tr><td style="padding:8px 0;color:#64748b">New schedule</td><td style="padding:8px 0;color:#0f172a;font-weight:700">${escapeEventHtml(event.date || 'TBD')} • ${escapeEventHtml(event.time || 'Time to be confirmed')}</td></tr>`;
  const courseRow = event.course ? `<tr><td style="padding:8px 0;color:#64748b">Eligible course</td><td style="padding:8px 0;color:#0f172a">${escapeEventHtml(event.course)}</td></tr>` : '';
  const reason = String(details.reason || '').trim();
  const reasonBlock = reason ? `<div style="margin:18px 0;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px"><div style="font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#64748b;font-weight:700;margin-bottom:5px">${cancelled ? 'Reason for cancellation' : 'Update note'}</div><div style="color:#334155;white-space:pre-line">${escapeEventHtml(reason)}</div></div>` : '';
  const html = `<div style="margin:0 auto;max-width:640px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:#334155"><div style="padding:24px 28px;background:#0f172a;border-bottom:5px solid ${accent};text-align:center"><div style="font-size:12px;letter-spacing:.18em;color:#93c5fd;font-weight:700">IPCS GLOBAL • PLACEMENT CELL</div><h1 style="margin:12px 0 4px;color:#fff;font-size:24px">${heading}</h1><div style="color:#cbd5e1;font-size:13px">Event reference: ${escapeEventHtml(event.eventId || event.eventKey || 'IPCS Event')}</div></div><div style="padding:28px;line-height:1.65;font-size:15px"><p style="margin:0 0 14px;color:#0f172a;font-weight:700">Dear Team,</p><p style="margin:0 0 20px">${intro}</p><div style="padding:18px 20px;background:#f8fafc;border:1px solid #e2e8f0;border-left:4px solid ${accent};border-radius:10px"><div style="font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#64748b;font-weight:700;margin-bottom:8px">${escapeEventHtml(event.type || 'Event')}</div><div style="font-size:20px;line-height:1.3;font-weight:700;color:#0f172a;margin-bottom:10px">${escapeEventHtml(event.title || 'IPCS event')}</div><table style="width:100%;border-collapse:collapse;font-size:14px">${scheduleRows}${courseRow}<tr><td style="padding:8px 0;color:#64748b">Branch</td><td style="padding:8px 0;color:#0f172a">${escapeEventHtml(event.branch || 'All Branches')}</td></tr><tr><td style="padding:8px 0;color:#64748b">Location</td><td style="padding:8px 0;color:#0f172a">${escapeEventHtml(event.location || 'To be confirmed')}</td></tr><tr><td style="padding:8px 0;color:#64748b">Coordinator</td><td style="padding:8px 0;color:#0f172a">${escapeEventHtml(event.tpo || 'Placement Team')}</td></tr></table></div>${reasonBlock}<p style="margin:22px 0 0">Please contact the Placement Cell if any coordination is required.</p><div style="margin-top:24px;padding-top:16px;border-top:1px solid #e2e8f0;color:#475569;font-size:14px">Regards,<br><strong style="color:#0f172a">Placement Team</strong><br><strong style="color:#7c3aed">IPCS Global</strong></div></div></div>`;
  const subjectPrefix = cancelled ? 'EVENT CANCELLED' : 'EVENT RESCHEDULED';
  return {
    subject: `[${subjectPrefix}] ${event.title || 'IPCS Event'} | ${event.eventId || event.eventKey || 'Event update'}`,
    html
  };
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
  const allEvents = (getCache()?.events || []).map(serializeEvent);
  res.json({ success: true, events: allEvents.filter(e => e.date && e.title && (canSeePlacementDrives || !String(e.type || '').toLowerCase().includes('placement drive'))) });
};

// =========================================================
// 🚨 RULES 1 & 2: TALENTINO & PLACEMENT DRIVE EVENTS (NEW ARCHITECTURE)
// =========================================================
exports.addEvent = async (req, res) => {
  const { date: rawDate, tpo, branch: rawBranch, type, title, description, time: rawTime, location, userName } = req.body;
  const authenticatedUser = req.portalUser || {};
  const eventTpo = isPlacementTrackerTpo(authenticatedUser) ? authenticatedUser.name || tpo : tpo;
  const eventCreator = authenticatedUser.name || authenticatedUser.email || userName || tpo;
  const rawCourse = String(req.body?.course || '').trim();
  const course = MAIN_PLACEMENT_COURSES.find(item => item.toLowerCase() === rawCourse.toLowerCase()) || '';
  if (String(type || '').toLowerCase().includes('placement drive') && !course) {
    return res.status(400).json({ success: false, message: 'Choose one of the five main courses for this placement drive.' });
  }
  const branchText = String(rawBranch || '').trim();
  const branch = /^all(?:\s+branches)?$/i.test(branchText)
    ? 'All Branches'
    : branchText || (String(type || '').toLowerCase().includes('placement drive') ? 'All Branches' : '');
  const date = formatIndiaDate(rawDate);
  const time = formatIndiaTime(rawTime);
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
    const timestamp = formatIndiaTimestamp(dateObj);

    // Prepare row data including new system columns
    const rowData = { 
      'Date of the Event': date, 
      'TPO': eventTpo,
      'Branch': branch, 
      'Course': course,
      'Event': type, 
      'Title': title, 
      'Descripation': description || '', 
      'Time of the Event': time,
      'Event Happening in': location || '', 
      'Poster Link': posterLink,
      'Event_ID': eventId,
      'Created_At': timestamp,
      'Created_By': eventCreator,
      'Mail_Status': 'PENDING',
      'Mail_Sent_At': '',
      'Mail_Error': '',
      'Status': 'Scheduled'
    };

    // Add to sheet
    await ensureEventHeaders(eventSheet, Object.keys(rowData));
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
                  <tr><td style="padding: 6px 0; color: #64748b;">Eligible Course:</td><td style="padding: 6px 0; color: #0f1523;">${escapeEventHtml(course)}</td></tr>
                  <tr><td style="padding: 6px 0; color: #64748b; vertical-align: top;">Description:</td><td style="padding: 6px 0; color: #334155; white-space: pre-line;">${formattedDesc}</td></tr>
                </table>
              </div>
              <h3 style="color: #ef4444; margin: 20px 0 10px 0; font-size: 16px;">&#9888;&#65039; Action Required</h3>
              <p>All concerned branches are requested to immediately inform all eligible students about this placement opportunity and encourage maximum participation.</p>
              <p>Please ensure that the interested and eligible students strictly register for the drive through the IPCS Global Student Portal:</p>
              
              <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
                <p style="margin: 0; font-size: 15px; color: #1e3a8a;">
                  &#127760; <b>Student Portal:</b> <a href="https://placement.ipcstalenzo.com" target="_blank" style="color: #0284c7; font-weight: bold; text-decoration: underline;">placement.ipcstalenzo.com</a>
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

    const eventCache = getCache();
    if (eventCache) eventCache.events = [...(eventCache.events || []).filter(row => String(getValByHeader(row, ['eventid'])) !== String(eventId)), newRow];
    void refreshCache().catch(error => console.error('Event cache refresh failed:', error));

    if (mailOptions) {
      // Keep email provider timeouts out of the event-save request. The event is
      // already persisted, so delivery status is updated on the saved row later.
      void (async () => {
        let deliveryError = null;
        let mailResult = null;
        try {
          mailResult = await sendMailAndLog(mailOptions, {
            name: branch,
            email: mailOptions.to,
            type: 'Event Notification',
            category: evType.includes('talentino') ? 'portal' : 'placement',
            queueContext: { eventId, statusPrefix: '' }
          });
          if (mailResult?.queued) deliveryError = null;
        } catch (mailErr) {
          deliveryError = mailErr;
        }

        const normalizeHeader = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const headerFor = name => newRow._worksheet.headerValues.find(header => normalizeHeader(header) === normalizeHeader(name));
        const updateData = {};
        const mailStatusH = headerFor('mailstatus');
        const mailSentAtH = headerFor('mailsentat');
        const mailErrorH = headerFor('mailerror');

        if (mailStatusH) updateData[mailStatusH] = deliveryError ? 'FAILED' : mailResult?.queued ? 'QUEUED' : 'SENT';
        if (mailSentAtH && !deliveryError && !mailResult?.queued) updateData[mailSentAtH] = formatIndiaTimestamp();
        if (mailErrorH) updateData[mailErrorH] = deliveryError ? deliveryError.message : '';

        if (Object.keys(updateData).length) {
          try {
            newRow.assign(updateData);
            await newRow.save();
          } catch (statusErr) {
            console.error('Could not update event mail status:', statusErr);
          }
        }

        const latestCache = getCache();
        if (latestCache) {
          latestCache.events = [...(latestCache.events || []).filter(row => String(getValByHeader(row, ['eventid'])) !== String(eventId)), newRow];
        }

        if (deliveryError) console.error(`Event ${eventId} was saved, but notification delivery failed:`, deliveryError);
      })().catch(error => console.error(`Unexpected event notification error for ${eventId}:`, error));
    }

    return res.json({
      success: true,
      message: mailOptions
        ? 'Event saved. Email notification is being attempted in the background.'
        : 'Event saved.',
      mailStatus: mailOptions ? 'PENDING' : 'NOT_REQUIRED',
      eventId
    });
  } catch (error) { 
    console.error("Event add error:", error);
    res.status(500).json({ success: false, message: error.message }); 
  }
};

const updateEventStatus = async (req, res, nextStatus) => {
  const eventKey = String(req.params?.eventKey || '').trim();
  const reason = String(req.body?.reason || '').trim().slice(0, 1000);
  const requestedDate = String(req.body?.date || '').trim();
  const requestedTime = String(req.body?.time || '').trim();
  if (!eventKey) return res.status(400).json({ success: false, message: 'A valid event reference is required.' });
  if (nextStatus === 'Rescheduled') {
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? new Date(`${requestedDate}T00:00:00Z`) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== requestedDate) {
      return res.status(400).json({ success: false, message: 'Choose a valid new event date.' });
    }
    if (requestedTime && !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(requestedTime)) {
      return res.status(400).json({ success: false, message: 'Choose a valid event time.' });
    }
  }
  const nextEventDate = nextStatus === 'Rescheduled' ? formatIndiaDate(requestedDate) : '';
  const nextEventTime = nextStatus === 'Rescheduled' ? formatIndiaTime(requestedTime) : '';

  try {
    await loadDocInfo();
    const eventSheet = doc.sheetsByTitle.Event;
    if (!eventSheet) return res.status(503).json({ success: false, message: 'The Event sheet is unavailable.' });
    await ensureEventHeaders(eventSheet, ['Status', 'Status_Updated_At', 'Status_Updated_By', 'Status_Reason', 'Mail_Status', 'Mail_Error']);
    const rows = await eventSheet.getRows();
    const eventRow = rows.find(row => {
      const id = String(getValByHeader(row, ['eventid']) || '').trim();
      if (id && id.toLowerCase() === eventKey.toLowerCase()) return true;
      const rowKey = eventKey.match(/^row-(\d+)$/i);
      return Boolean(rowKey && Number(row.rowNumber) === Number(rowKey[1]));
    });
    if (!eventRow) return res.status(404).json({ success: false, message: 'This event could not be found in the Event sheet. Refresh the calendar and try again.' });

    const user = req.portalUser || {};
    const eventOwner = getValByHeader(eventRow, ['createdby']) || getValByHeader(eventRow, ['tpo', 'tponame', 'placementofficer']);
    if (isPlacementTrackerTpo(user) && !placementOwnerMatchesUser(eventOwner, user)) {
      return res.status(403).json({ success: false, message: 'You can cancel or reschedule only events created by your account.' });
    }

    const event = serializeEvent(eventRow);
    const currentStatus = String(event.status || 'Scheduled').trim().toLowerCase();
    if (currentStatus === 'cancelled') {
      return res.status(409).json({ success: false, message: 'This event is already cancelled and cannot be changed.' });
    }
    const recipients = eventNotificationRecipients(event);
    if (!recipients.to) {
      return res.status(400).json({ success: false, message: `No valid email recipient is configured for this ${event.type || 'event'} and branch. The event was not changed.` });
    }

    const headers = eventSheet.headerValues || [];
    const updatedAt = formatIndiaTimestamp();
    const actor = String(req.portalUser?.name || req.portalUser?.email || 'Placement Team').trim();
    const updateData = {};
    const assignByAliases = (aliases, value) => {
      const header = findEventHeader(headers, aliases);
      if (header) updateData[header] = value;
    };
    assignByAliases(['status'], nextStatus);
    assignByAliases(['statusupdatedat'], updatedAt);
    assignByAliases(['statusupdatedby'], actor);
    assignByAliases(['statusreason'], reason);
    assignByAliases(['mailstatus'], `${nextStatus.toUpperCase()} NOTICE PENDING`);
    assignByAliases(['mailerror'], '');

    const previousDate = event.date;
    const previousTime = event.time;
    if (nextStatus === 'Rescheduled') {
      assignByAliases(['dateoftheevent', 'date'], nextEventDate);
      assignByAliases(['timeoftheevent', 'time'], nextEventTime);
    }
    eventRow.assign(updateData);
    await eventRow.save();

    let emailSent = false;
    let emailQueued = false;
    let emailError = '';
    let emailReview = false;
    try {
      const mailContent = buildEventStatusEmail(serializeEvent(eventRow), nextStatus, { reason, previousDate, previousTime });
      const mailResult = await sendMailAndLog({
        from: `"IPCS Global Placement Cell" <${process.env.EMAIL_USER || 'placementcell.ipcs@gmail.com'}>`,
        to: recipients.to,
        cc: recipients.cc,
        bcc: recipients.bcc,
        subject: mailContent.subject,
        html: mailContent.html
      }, {
        name: event.branch || event.title,
        email: [recipients.to, recipients.cc, recipients.bcc].filter(Boolean).join(','),
        type: `${nextStatus} Event Notification`,
        category: String(event.type || '').toLowerCase().includes('talentino') ? 'portal' : 'placement',
        queueContext: { eventId: event.eventId || event.eventKey, statusPrefix: `${nextStatus.toUpperCase()} NOTICE` }
      });
      emailQueued = Boolean(mailResult?.queued);
      emailSent = !emailQueued;
    } catch (mailError) {
      emailError = String(mailError?.message || 'The email service did not accept the notification.');
      emailReview = isMailDeliveryUncertain(mailError);
      console.error(`[EVENT] ${nextStatus} notification failed for ${event.eventId || event.eventKey}:`, mailError);
    }

    const mailStatusHeader = findEventHeader(headers, ['mailstatus']);
    const mailErrorHeader = findEventHeader(headers, ['mailerror']);
    const mailUpdates = {};
    if (mailStatusHeader) mailUpdates[mailStatusHeader] = `${nextStatus.toUpperCase()} NOTICE ${emailQueued ? 'QUEUED' : emailSent ? 'SENT' : emailReview ? 'REVIEW' : 'FAILED'}`;
    if (mailErrorHeader) mailUpdates[mailErrorHeader] = emailError;
    if (Object.keys(mailUpdates).length) {
      eventRow.assign(mailUpdates);
      await eventRow.save();
    }

    const eventCache = getCache();
    if (eventCache) eventCache.events = rows;
    refreshCache();
    const updatedEvent = serializeEvent(eventRow);
    return res.json({
      success: true,
      emailSent,
      emailQueued,
      event: updatedEvent,
      message: emailSent
        ? `Event ${nextStatus.toLowerCase()} and notification email sent.`
        : emailQueued
          ? `Event ${nextStatus.toLowerCase()}; notification email queued for retry.`
          : emailReview
            ? `Event ${nextStatus.toLowerCase()}, but email delivery is uncertain. Check the sender's Sent folder and recipient before retrying.`
            : `Event ${nextStatus.toLowerCase()}, but the notification email could not be sent: ${emailError}`
    });
  } catch (error) {
    console.error(`Event ${nextStatus.toLowerCase()} error:`, error);
    return res.status(500).json({ success: false, message: error?.message || `Could not ${nextStatus.toLowerCase()} the event.` });
  }
};

exports.cancelEvent = (req, res) => updateEventStatus(req, res, 'Cancelled');
exports.rescheduleEvent = (req, res) => updateEventStatus(req, res, 'Rescheduled');

// =========================================================
// 🚨 RULE 3: CRON HELPER (RESUME DELIVERY & DRIVE SUMMARY)
// =========================================================
let dailyCronPromise = null;
const runDailyCronTasks = async ({ resumeOnly = false, companyReportOnly = false } = {}) => {
  console.log("🚨 [CRON] Starting Daily Automated Tasks...");
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  const today = new Date();
  const todayStr = formatter.format(today);
  const yStr = formatter.format(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const resumeSummary = { dueJobs: 0, sent: 0, queued: 0, alreadyHandled: 0, skipped: [], failed: [] };
  const blockedResumeMailRun = cacheSnapshot => {
    const unavailableSheets = getUnavailableResumeMailSheets(cacheSnapshot);
    if (!unavailableSheets.length) unavailableSheets.push('placement cache');
    const retryScheduled = scheduleResumeMailCacheRetry(yStr);
    resumeSummary.blocked = true;
    resumeSummary.unavailableSheets = unavailableSheets;
    resumeSummary.retryScheduled = retryScheduled;
    resumeSummary.message = `Company resume emails were paused because ${unavailableSheets.join(', ')} could not be confirmed. No resume mail was sent without current delivery history. ${retryScheduled ? 'A cache-recovery retry is scheduled.' : 'The automatic retry limit has been reached; the next scheduled run will try again.'}`;
    console.error(`[RESUME DELIVERY] ${resumeSummary.message}`);
    return { resumes: resumeSummary };
  };

  let cache = getCache();
  if (!cache?.cacheUpdatedAt || !Array.isArray(cache?.vacancies)) {
      await refreshCache();
      cache = getCache();
      if (!cache?.cacheUpdatedAt || !Array.isArray(cache?.vacancies)) return blockedResumeMailRun(cache);
  }
  const cacheAgeMs = Date.now() - Date.parse(cache.cacheUpdatedAt);
  if (!Number.isFinite(cacheAgeMs) || cacheAgeMs > RESUME_CACHE_MAX_AGE_MS) {
    await refreshCache();
    cache = getCache();
  }
  if (!cache?.cacheUpdatedAt || !Array.isArray(cache?.vacancies)) return blockedResumeMailRun(cache);
  const unavailableResumeMailSheets = getUnavailableResumeMailSheets(cache);
  const resumeMailCacheReady = unavailableResumeMailSheets.length === 0;
  if (resumeMailCacheReady) {
    clearResumeMailCacheRetry(yStr);
  } else {
    blockedResumeMailRun(cache);
    if (resumeOnly || companyReportOnly) return { resumes: resumeSummary };
  }

  // ==================================================================
  // 📌 TASK 1: SEND RESUMES ONLY FOR OPENINGS WHOSE DEADLINE WAS YESTERDAY
  // ==================================================================
  if (resumeMailCacheReady) {
  console.log(`🚨 [CRON-TASK 1] Sending resume summaries for openings with a deadline of yesterday only (today ${todayStr}; yesterday ${yStr}).`);

  const yesterdayJobs = cache.vacancies.filter(v => {
    const lastDateKey = getValByHeader(v, ['lastdate', 'last date', 'column17', 'interviewdate', 'interview date']);
    if (!lastDateKey) return false;

    try {
      const parsedDate = safeParseDate(lastDateKey);
      if (parsedDate && !isNaN(parsedDate.getTime())) { return formatter.format(parsedDate) === yStr; }
      return false;
    } catch(e) { return false; }
  });

  resumeSummary.dueJobs = yesterdayJobs.length;
  console.log(`🚨 [CRON-TASK 1] Found ${yesterdayJobs.length} opening(s) with yesterday's deadline.`);

  const resumeStudentByRoll = new Map();
  const resumeStudentsByName = new Map();
  (cache.students || []).forEach(student => {
    const roll = normalizePlacementText(getValByHeader(student, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']));
    const name = normalizePlacementText(getValByHeader(student, ['studentname', 'name']));
    if (roll && !resumeStudentByRoll.has(roll)) resumeStudentByRoll.set(roll, student);
    if (name) resumeStudentsByName.set(name, [...(resumeStudentsByName.get(name) || []), student]);
  });
  const escapeMailHtml = value => String(value || '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const companyOpeningReportRows = [];

  for (let job of yesterdayJobs) {
    const jobId = getValByHeader(job, ['jobid', 'id']) || '';
    const companyEmail = getValByHeader(job, ['companymailid', 'companyemail']) || ''; 
    const companyName = getValByHeader(job, ['companyname', 'company']) || '';
    const position = getValByHeader(job, ['position', 'role']) || '';
    const lastDate = getValByHeader(job, ['lastdate', 'applicationdeadline']) || '';
    const tpoName = getValByHeader(job, ['placementofficer', 'tpo', 'tponame']) || 'Not assigned';
    const cleanTargetJobId = jobId.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
    const applicants = (cache.applications || []).filter(app => {
      const appJobId = (getValByHeader(app, ['jobid']) || '').toString().toLowerCase().replace(/[^a-z0-9]/g, '');
      return appJobId === cleanTargetJobId && cleanTargetJobId !== '';
    });
    const reportRow = {
      company: companyName,
      position,
      lastDate,
      applicantCount: applicants.length,
      tpoName,
      deliveryStatus: 'Not sent'
    };
    companyOpeningReportRows.push(reportRow);

    if (!jobId) {
      reportRow.deliveryStatus = 'Skipped — missing Job ID';
      resumeSummary.skipped.push({ company: companyName || 'Unknown company', reason: 'Opening has no Job ID.' });
      continue;
    }
    if (wasResumeDeliveryHandled(jobId, cache)) {
      reportRow.deliveryStatus = 'Already handled';
      resumeSummary.alreadyHandled += 1;
      continue;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmail)) {
      reportRow.deliveryStatus = 'Skipped — missing or invalid company email';
      resumeSummary.skipped.push({ jobId, company: companyName || 'Unknown company', reason: 'Company email is missing or invalid.' });
      continue;
    }

    if (applicants.length === 0) {
      reportRow.deliveryStatus = 'Skipped — no applicants';
      resumeSummary.skipped.push({ jobId, company: companyName || 'Unknown company', reason: 'No applications match this Job ID.' });
      continue;
    }

    if (companyReportOnly) {
      reportRow.deliveryStatus = wasResumeDeliveryHandled(jobId, cache) ? 'Already handled' : 'Not sent — report-only run';
      continue;
    }

    const tpoEmail = getTpoEmailByName(tpoName);

    let tableRows = ''; let attachments = [];
    applicants.forEach((appRow, index) => {
      const appRoll = normalizePlacementText(getValByHeader(appRow, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']));
      const appName = normalizePlacementText(getValByHeader(appRow, ['studentname', 'name']));
      const sameNameStudents = resumeStudentsByName.get(appName) || [];
      const student = (appRoll && resumeStudentByRoll.get(appRoll)) || (sameNameStudents.length === 1 ? sameNameStudents[0] : null);
      const info = {
        name: getValByHeader(appRow, ['studentname', 'name']) || (student && getValByHeader(student, ['studentname', 'name'])) || 'Student',
        phone: getValByHeader(appRow, ['contact', 'phone', 'mobilenumber']) || (student && getValByHeader(student, ['phone', 'contact', 'mobilenumber'])) || '',
        email: getValByHeader(appRow, ['mailid', 'studentemail', 'email', 'mail']) || (student && getValByHeader(student, ['mailid', 'email', 'mail'])) || '',
        qual: getValByHeader(appRow, ['qualification', 'qual']) || (student && getValByHeader(student, ['qualification', 'qual'])) || '',
        resume: getValByHeader(appRow, ['resume', 'cv']) || (student && getValByHeader(student, ['resume', 'cv'])) || ''
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
      tableRows += `<tr><td style="padding:10px;border:1px solid #cbd5e1;text-align:center;">${index+1}</td><td style="padding:10px;border:1px solid #cbd5e1;"><b>${escapeMailHtml(info.name)}</b></td><td style="padding:10px;border:1px solid #cbd5e1;">${escapeMailHtml(info.phone)}</td><td style="padding:10px;border:1px solid #cbd5e1;">${escapeMailHtml(info.email)}</td><td style="padding:10px;border:1px solid #cbd5e1;">${escapeMailHtml(info.qual)}</td><td style="padding:10px;border:1px solid #cbd5e1;text-align:center;">${resumeBtn}</td></tr>`;
    });

    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #0f1523; padding: 20px; text-align: center; border-bottom: 4px solid #10b981;">
          <h2 style="color: #ffffff; margin: 0; letter-spacing: 1px;">APPLICANT RESUMES</h2>
        </div>
        <div style="padding: 30px; background-color: #ffffff;">
          <p style="font-size: 16px; margin-top: 0;">Dear <b>${escapeMailHtml(companyName)}</b> Hiring Team,</p>
          <p style="font-size: 15px; line-height: 1.6; color: #475569;">Greetings from IPCS Global Placement Cell.</p>
          <p style="font-size: 15px; line-height: 1.6; color: #475569;">Please find the consolidated list of applicants and their resumes for the <b>${escapeMailHtml(position)}</b> opening (Ref: ${escapeMailHtml(jobId)}).</p>
          
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

    try {
      const delivery = await sendMailAndLog({
        from: `"IPCS Corporate Relations" <${process.env.EMAIL_USER}>`,
        to: companyEmail,
        cc: tpoEmail || '',
        subject: `Applicant Resumes: ${position} Opening [Ref: ${jobId}]`,
        html,
        attachments
      }, { name: companyName, email: companyEmail, type: 'Resume Delivery', category: 'company' });
      if (delivery?.queued) {
        reportRow.deliveryStatus = 'Queued';
        resumeSummary.queued += 1;
        resumeDeliveryMemory.set(getResumeDeliveryReference(jobId), { status: 'queued', at: Date.now() });
        console.log(`📥 Resume email for ${jobId} was queued for retry.`);
      } else {
        reportRow.deliveryStatus = 'Sent';
        resumeSummary.sent += 1;
        resumeDeliveryMemory.set(getResumeDeliveryReference(jobId), { status: 'sent', at: Date.now() });
        console.log(`✅ Resume email sent to ${companyName} (${jobId}).`);
      }
    } catch (error) {
      const reason = String(error.message || error);
      if (isMailDeliveryUncertain(error)) {
        reportRow.deliveryStatus = 'Review';
        resumeDeliveryMemory.set(getResumeDeliveryReference(jobId), { status: 'review', at: Date.now() });
      } else {
        reportRow.deliveryStatus = 'Failed';
      }
      resumeSummary.failed.push({ jobId, company: companyName || 'Unknown company', reason });
      console.error(`❌ Resume email failed for ${jobId} (${companyName}):`, error.message);
    }
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  if (!resumeOnly) {
    resumeSummary.dailyReport = await sendCompanyOpeningDailyReport({
      reportDate: yStr,
      openingRows: companyOpeningReportRows,
      cache
    });
  }

  if (resumeOnly || companyReportOnly) {
    console.log('[RESUME DELIVERY] Run summary:', JSON.stringify(resumeSummary));
    return { resumes: resumeSummary };
  }
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
      const parsedDate = safeParseDate(evDateStr);
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
    }, { name: tpoName, email: toEmail, type: 'Drive Registrations Summary', category: 'recruitment' });
    
    console.log(`✅ Sent Drive Summary to ${tpoName}. Pausing 5 seconds...`);
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  console.log('[RESUME DELIVERY] Run summary:', JSON.stringify(resumeSummary));
  console.log("🎉 All Cron automated tasks completed successfully!");
  return { resumes: resumeSummary };
};

exports.runDailyCron = options => {
  if (dailyCronPromise) return dailyCronPromise;
  dailyCronPromise = runDailyCronTasks(options).finally(() => { dailyCronPromise = null; });
  return dailyCronPromise;
};

exports.triggerDailyCron = async (req, res) => {
  try {
    const role = String(req.portalUser?.role || '').toUpperCase();
    const isAdmin = req.portalUser?.accessType === 'superadmin' || ['SYSTEM ADMIN', 'GENERAL MANAGER', 'ZONAL PLACEMENT HEAD', 'TECHNICAL HEAD'].includes(role);
    if (!req.portalUser || !isAdmin) {
      return res.status(req.portalUser ? 403 : 401).json({ success: false, message: 'Only a portal administrator can trigger resume delivery.' });
    }
    const result = await exports.runDailyCron({ resumeOnly: true });
    const report = result?.resumes || { dueJobs: 0, sent: 0, queued: 0, alreadyHandled: 0, skipped: [], failed: [] };
    res.json({
      success: true,
      message: report.sent || report.queued
        ? `Resume delivery checked: ${report.sent} sent, ${report.queued} queued, ${report.alreadyHandled} already handled.`
        : report.blocked
          ? report.message
          : `Resume delivery checked: no new email sent. ${report.dueJobs} opening(s) with yesterday's deadline were examined.`,
      report
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.triggerCompanyOpeningReport = async (req, res) => {
  try {
    const role = String(req.portalUser?.role || '').toUpperCase();
    const isAdmin = req.portalUser?.accessType === 'superadmin' || ['SYSTEM ADMIN', 'GENERAL MANAGER', 'ZONAL PLACEMENT HEAD', 'TECHNICAL HEAD'].includes(role);
    if (!req.portalUser || !isAdmin) return res.status(req.portalUser ? 403 : 401).json({ success: false, message: 'Only a portal administrator can send the company opening report.' });
    const result = await exports.runDailyCron({ companyReportOnly: true });
    const report = result?.resumes || {};
    const status = report.dailyReport?.status || (report.blocked ? 'blocked' : 'not sent');
    return res.json({
      success: !report.blocked,
      status,
      message: report.blocked ? report.message : `Company report status: ${status}. Resume delivery was not triggered.`
    });
  } catch (error) {
    console.error('Administrator company report trigger failed:', error);
    return res.status(500).json({ success: false, message: error.message || 'Could not send the company report.' });
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
  const assignedTo = getValByHeader(row, ['placementofficer', 'tponame', 'assignedtpo']);
  return placementOwnerMatchesUser(assignedTo, user);
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
      const logo = getValByHeader(row, ['companylogo', 'logo']).trim();
      if (!companyName || !logo || /^(?:n\/?a|none|no logo|not available)$/i.test(logo)) return;
      partners.push({
        companyName,
        logo,
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
      const role = getValByHeader(row, ['position', 'role', 'designation']).trim();
      return {
        name,
        role,
        branches: getValByHeader(row, ['assignedbranches', 'assignedbranch', 'sittingbranch', 'branch']).trim(),
        photo: getValByHeader(row, ['profilephotourl', 'profilephoto', 'profileimage', 'photo', 'imageurl']).trim(),
        phone: getValByHeader(row, ['contactnumber', 'phonenumber', 'phone', 'contact']).trim(),
        email: getValByHeader(row, ['mailid', 'email', 'workemail']).trim(),
        linkedin: getValByHeader(row, ['linkedin', 'linkedinurl', 'linkedinprofile']).trim()
      };
    }).filter(member => {
      const key = normalizePlacementText(member.name).replace(/^(mrs|miss|mr|ms|dr)/, '');
      if (!key || seen.has(key) || !/(tpo|placement|career guidance|corporate relations?(?:hip)?|client relations?(?:hip)?)/i.test(member.role)) return false;
      seen.add(key);
      return true;
    });

    res.json({ success: true, team });
  } catch (err) {
    console.error('Error reading placement team from Contact sheet:', err.message);
    res.status(503).json({ success: false, team: [], message: 'Placement team details are temporarily unavailable.' });
  }
};

const escapeCorporateInquiryHtml = value => String(value || '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

exports.submitCorporateTrainingInquiry = async (req, res) => {
  const input = req.body || {};
  // A hidden honeypot field catches basic automated form submissions.
  if (String(input.website || '').trim()) return res.status(201).json({ success: true });

  const name = String(input.name || '').trim().slice(0, 120);
  const company = String(input.company || '').trim().slice(0, 160);
  const email = String(input.email || '').trim().slice(0, 254);
  const phone = String(input.phone || '').trim().slice(0, 40);
  const location = String(input.location || '').trim().slice(0, 120);
  const trainingArea = String(input.trainingArea || '').trim().slice(0, 120);
  const teamSize = String(input.teamSize || '').trim().slice(0, 40);
  const message = String(input.message || '').trim().slice(0, 2000);

  if (!name || !company || !trainingArea || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Enter your name, organization, a valid work email, and a training area.' });
  }

  const safe = escapeCorporateInquiryHtml;
  const senderEmail = process.env.EMAIL_USER || 'placementcell.ipcs@gmail.com';
  const recipient = process.env.CORPORATE_TRAINING_EMAIL || senderEmail;
  const safeCompanySubject = company.replace(/[\r\n]+/g, ' ').slice(0, 100);
  const messageHtml = safe(message).replace(/\r?\n/g, '<br>') || '<span style="color:#64748b">No additional message was provided.</span>';
  const html = `
    <div style="max-width:680px;margin:24px auto;border:1px solid #dce6ef;border-radius:18px;overflow:hidden;font-family:Arial,sans-serif;color:#18314d;background:#fff">
      <div style="padding:24px 28px;background:#102b4a;color:#fff;border-bottom:4px solid #39c8bd">
        <div style="font-size:11px;font-weight:bold;letter-spacing:2px;color:#9fdedb">IPCS GLOBAL · CORPORATE TRAINING</div>
        <h1 style="margin:10px 0 0;font-size:22px">New training inquiry</h1>
      </div>
      <div style="padding:26px 28px">
        <p style="margin:0 0 18px;color:#53677d;line-height:1.65">A visitor has asked the IPCS Global team to discuss a corporate training program.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          ${[['Name', name], ['Organization', company], ['Work email', email], ['Phone / WhatsApp', phone], ['Location', location], ['Training area', trainingArea], ['Approximate team size', teamSize]].filter(([, value]) => value).map(([label, value]) => `<tr><th style="width:190px;padding:11px 12px;border:1px solid #e1e8ef;background:#f5f8fb;text-align:left;color:#52667c">${safe(label)}</th><td style="padding:11px 12px;border:1px solid #e1e8ef;color:#18314d">${safe(value)}</td></tr>`).join('')}
        </table>
        <h2 style="margin:23px 0 8px;font-size:15px;color:#173955">Training goals or notes</h2>
        <div style="padding:14px;border:1px solid #e1e8ef;border-radius:10px;background:#fafcfe;font-size:14px;line-height:1.7">${messageHtml}</div>
        <p style="margin:22px 0 0;color:#718197;font-size:12px">Reply to this email to contact ${safe(name)} directly.</p>
      </div>
    </div>`;

  try {
    const sheet = await getCorporateTrainingInquirySheet();
    const inquiryId = `CT-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const submittedAt = formatIndiaTimestamp();
    await sheet.addRow({
      'Inquiry ID': inquiryId,
      'Submitted At': submittedAt,
      Name: name,
      Company: company,
      Email: email,
      Phone: phone,
      Location: location,
      'Training Area': trainingArea,
      'Team Size': teamSize,
      Message: message,
      Status: 'New',
      'Assigned Branch': '',
      'Assigned Branch Email': '',
      'Assigned At': '',
      'Assigned By': '',
      'Notification Status': 'Not sent',
      'Notification Sent At': '',
      'Internal Email Status': 'Pending'
    });

    let internalEmailStatus = 'Sent';
    try {
      const mailResult = await sendMailAndLog({
        from: `"IPCS Global Corporate Training" <${senderEmail}>`,
        to: recipient,
        replyTo: email,
        subject: `Corporate Training Inquiry · ${safeCompanySubject}`,
        html
      }, {
        name: `${name} · ${company}`,
        email,
        type: 'Corporate Training Inquiry',
        category: 'company',
        queueContext: {
          sheetName: 'Corporate Training Inquiries', idHeader: 'Inquiry ID', idValue: inquiryId,
          statusHeader: 'Internal Email Status', failedValuePrefix: 'Failed: ',
          statusValues: { SENT: 'Sent' }
        }
      });
      if (mailResult?.queued) internalEmailStatus = 'Queued';
    } catch (mailError) {
      internalEmailStatus = `${mailErrorStatus(mailError)}: ${mailError.message}`.slice(0, 500);
      console.error('Corporate training inquiry was stored, but its internal alert failed:', mailError.message);
    }
    try {
      const storedRow = (await sheet.getRows()).find(item => getValByHeader(item, ['inquiryid']) === inquiryId);
      if (storedRow) { storedRow.set('Internal Email Status', internalEmailStatus); await storedRow.save(); }
    } catch (statusError) {
      console.error('Could not update internal email status for corporate training inquiry:', statusError.message);
    }
    return res.status(201).json({ success: true, message: 'Your inquiry has been received by the IPCS Global team.' });
  } catch (err) {
    console.error('Corporate training inquiry could not be stored:', err.message);
    return res.status(503).json({ success: false, message: 'We could not save your inquiry right now. Please try again later.' });
  }
};

const CORPORATE_TRAINING_INQUIRY_HEADERS = [
  'Inquiry ID', 'Submitted At', 'Name', 'Company', 'Email', 'Phone', 'Location', 'Training Area',
  'Team Size', 'Message', 'Status', 'Assigned Branch', 'Assigned Branch Email', 'Assigned At',
  'Assigned By', 'Notification Status', 'Notification Sent At', 'Internal Email Status'
];

const getCorporateTrainingInquirySheet = async () => {
  await loadDocInfo();
  let sheet = doc.sheetsByTitle['Corporate Training Inquiries'];
  if (!sheet) {
    try {
      sheet = await doc.addSheet({ title: 'Corporate Training Inquiries', headerValues: CORPORATE_TRAINING_INQUIRY_HEADERS });
    } catch (error) {
      // Two first submissions can arrive together; re-read sheet metadata if another request created it.
      await loadDocInfo();
      sheet = doc.sheetsByTitle['Corporate Training Inquiries'];
      if (!sheet) throw error;
    }
  }

  await sheet.loadHeaderRow();
  const normalizedHeaders = new Set((sheet.headerValues || []).map(value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')));
  const missingHeaders = CORPORATE_TRAINING_INQUIRY_HEADERS.filter(value => !normalizedHeaders.has(value.toLowerCase().replace(/[^a-z0-9]/g, '')));
  if (missingHeaders.length) await sheet.setHeaderRow([...(sheet.headerValues || []), ...missingHeaders]);
  return sheet;
};

const toCorporateTrainingInquiry = row => ({
  inquiryId: getValByHeader(row, ['inquiryid']),
  submittedAt: getValByHeader(row, ['submittedat']),
  name: getValByHeader(row, ['name']),
  company: getValByHeader(row, ['company', 'organization']),
  email: getValByHeader(row, ['email']),
  phone: getValByHeader(row, ['phone']),
  location: getValByHeader(row, ['location']),
  trainingArea: getValByHeader(row, ['trainingarea']),
  teamSize: getValByHeader(row, ['teamsize']),
  message: getValByHeader(row, ['message']),
  status: getValByHeader(row, ['status']) || 'New',
  assignedBranch: getValByHeader(row, ['assignedbranch']),
  assignedBranchEmail: getValByHeader(row, ['assignedbranchemail']),
  assignedAt: getValByHeader(row, ['assignedat']),
  assignedBy: getValByHeader(row, ['assignedby']),
  notificationStatus: getValByHeader(row, ['notificationstatus']) || 'Not sent',
  notificationSentAt: getValByHeader(row, ['notificationsentat']),
  internalEmailStatus: getValByHeader(row, ['internalemailstatus']) || 'Unknown'
});

exports.getCorporateTrainingInquiries = async (_req, res) => {
  try {
    const sheet = await getCorporateTrainingInquirySheet();
    const rows = await sheet.getRows();
    const inquiries = rows.map(toCorporateTrainingInquiry).filter(inquiry => inquiry.inquiryId).reverse();
    res.json({ success: true, inquiries });
  } catch (error) {
    console.error('Could not load corporate training inquiries:', error.message);
    res.status(503).json({ success: false, inquiries: [], message: 'Corporate training inquiries are temporarily unavailable.' });
  }
};

const buildCorporateTrainingAssignmentEmail = (inquiry, branch) => {
  const safe = escapeCorporateInquiryHtml;
  const details = [
    ['Organization', inquiry.company], ['Contact person', inquiry.name], ['Work email', inquiry.email],
    ['Phone / WhatsApp', inquiry.phone], ['Location', inquiry.location], ['Training area', inquiry.trainingArea],
    ['Approximate team size', inquiry.teamSize]
  ].filter(([, value]) => value);
  const notes = safe(inquiry.message).replace(/\r?\n/g, '<br>') || '<span style="color:#64748b">No additional notes were provided.</span>';
  return `
    <div style="max-width:680px;margin:24px auto;border:1px solid #dce6ef;border-radius:18px;overflow:hidden;font-family:Arial,sans-serif;color:#18314d;background:#fff">
      <div style="padding:25px 30px;background:#102b4a;color:#fff;border-bottom:4px solid #39c8bd">
        <div style="font-size:11px;font-weight:bold;letter-spacing:2px;color:#9fdedb">IPCS GLOBAL · CORPORATE TRAINING</div>
        <h1 style="margin:10px 0 0;font-size:23px">A new training opportunity for ${safe(branch)}</h1>
      </div>
      <div style="padding:28px 30px">
        <p style="margin:0 0 16px;line-height:1.7">Hello ${safe(branch)} Team,</p>
        <p style="margin:0 0 20px;color:#53677d;line-height:1.7">A corporate training inquiry has been assigned to your branch. Please connect with the organization and coordinate the next steps.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          ${details.map(([label, value]) => `<tr><th style="width:190px;padding:11px 12px;border:1px solid #e1e8ef;background:#f5f8fb;text-align:left;color:#52667c">${safe(label)}</th><td style="padding:11px 12px;border:1px solid #e1e8ef;color:#18314d">${safe(value)}</td></tr>`).join('')}
        </table>
        <h2 style="margin:24px 0 8px;font-size:15px;color:#173955">Training goals or notes</h2>
        <div style="padding:14px;border:1px solid #e1e8ef;border-radius:10px;background:#fafcfe;font-size:14px;line-height:1.7">${notes}</div>
        <p style="margin:22px 0 0;color:#718197;font-size:12px">Please reply to the contact above and keep the IPCS Global team informed of progress.</p>
      </div>
      <div style="padding:14px 30px;background:#f5f8fb;color:#718197;font-size:12px">IPCS Global · Learn · Connect · Grow</div>
    </div>`;
};

exports.assignCorporateTrainingInquiry = async (req, res) => {
  const inquiryId = String(req.body?.inquiryId || '').trim();
  const branchName = String(req.body?.branch || '').trim();
  if (!inquiryId || !branchName) return res.status(400).json({ success: false, message: 'Choose a branch for this inquiry.' });

  try {
    const cache = getCache();
    await loadDocInfo();
    const branchSheet = doc.sheetsByTitle['Branches'];
    const branchRows = branchSheet ? await branchSheet.getRows() : (cache?.branches || []);
    const branchRow = branchRows.find(row => normalizePlacementText(getValByHeader(row, ['branch', 'branchname', 'branchlocation'])) === normalizePlacementText(branchName));
    if (!branchRow) return res.status(400).json({ success: false, message: 'Choose a branch from the active branch list.' });

    const branchEmail = getValByHeader(branchRow, ['email', 'branchemail', 'mailid']) || getBranchManagerEmail(branchName) || getAssignedTpoEmail(branchName);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(branchEmail)) {
      return res.status(400).json({ success: false, message: `No email is configured for ${branchName}. Add a branch email in Manage Branches or assign an active branch manager/TPO first.` });
    }

    const sheet = await getCorporateTrainingInquirySheet();
    const rows = await sheet.getRows();
    const row = rows.find(item => getValByHeader(item, ['inquiryid']) === inquiryId);
    if (!row) return res.status(404).json({ success: false, message: 'This corporate training inquiry could not be found.' });
    const inquiry = toCorporateTrainingInquiry(row);
    const sameBranch = normalizePlacementText(inquiry.assignedBranch) === normalizePlacementText(branchName);
    if (sameBranch && inquiry.notificationStatus === 'Sent' && String(inquiry.assignedBranchEmail).toLowerCase() === branchEmail.toLowerCase()) {
      return res.json({ success: true, alreadyAssigned: true, inquiry, message: 'This inquiry is already assigned and the branch has been notified.' });
    }
    if (sameBranch && String(inquiry.notificationStatus || '').toLowerCase() === 'sending') {
      const timestamp = String(inquiry.assignedAt || '').match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
      const assignedAtMs = timestamp ? Date.UTC(Number(timestamp[3]), Number(timestamp[2]) - 1, Number(timestamp[1]), Number(timestamp[4]), Number(timestamp[5]), Number(timestamp[6])) - 5.5 * 60 * 60 * 1000 : 0;
      if (assignedAtMs && Date.now() - assignedAtMs < 5 * 60 * 1000) {
        return res.status(409).json({ success: false, message: 'The branch notification is already being processed. Refresh this inquiry before retrying.' });
      }
    }

    const assignedAt = formatIndiaTimestamp();
    row.set('Status', 'Assigned');
    row.set('Assigned Branch', branchName);
    row.set('Assigned Branch Email', branchEmail);
    row.set('Assigned At', assignedAt);
    row.set('Assigned By', String(req.portalUser?.name || req.portalUser?.email || 'IPCS Admin').slice(0, 120));
    row.set('Notification Status', 'Sending');
    await row.save();

    const subjectBranch = branchName.replace(/[\r\n]+/g, ' ').slice(0, 100);
    try {
      const mailResult = await sendMailAndLog({
        from: `"IPCS Global Corporate Training" <${process.env.EMAIL_USER || 'placementcell.ipcs@gmail.com'}>`,
        to: branchEmail,
        cc: ['ajith@ipcsglobal.com', 'rakesh@ipcsglobal.com', 'gifty@ipcsglobal.com'],
        replyTo: inquiry.email,
        subject: `Corporate Training Inquiry Assigned · ${subjectBranch}`,
        html: buildCorporateTrainingAssignmentEmail(inquiry, branchName)
      }, {
        name: `${branchName} · ${inquiry.company}`,
        email: branchEmail,
        type: 'Corporate Training Assignment',
        category: 'company',
        queueContext: {
          sheetName: 'Corporate Training Inquiries', idHeader: 'Inquiry ID', idValue: inquiryId,
          statusHeader: 'Notification Status', sentAtHeader: 'Notification Sent At', failedValuePrefix: 'Failed: ',
          statusValues: { SENT: 'Sent' }
        }
      });
      if (mailResult?.queued) {
        row.set('Notification Status', 'Queued');
        await row.save();
        return res.json({ success: true, inquiry: toCorporateTrainingInquiry(row), queued: true, message: `Assigned to ${branchName}; the branch notification is queued for delivery.` });
      }
    } catch (mailError) {
      row.set('Notification Status', `${mailErrorStatus(mailError)}: ${mailError.message}`.slice(0, 500));
      try { await row.save(); }
      catch (statusError) { console.error('Could not record failed branch notification status:', statusError.message); }
      return res.json({ success: true, inquiry: toCorporateTrainingInquiry(row), warning: `The inquiry was assigned, but the branch email could not be sent: ${mailError.message}` });
    }
    row.set('Notification Status', 'Sent');
    row.set('Notification Sent At', formatIndiaTimestamp());
    try {
      await row.save();
      return res.json({ success: true, inquiry: toCorporateTrainingInquiry(row), message: `Assigned to ${branchName}; the branch notification was sent.` });
    } catch (statusError) {
      console.error('The branch email was sent, but notification status could not be saved:', statusError.message);
      return res.json({ success: true, inquiry: toCorporateTrainingInquiry(row), warning: 'The branch email was sent, but its status could not be saved. Refresh before retrying.' });
    }
  } catch (error) {
    console.error('Could not assign corporate training inquiry:', error.message);
    res.status(500).json({ success: false, message: 'The corporate training inquiry could not be assigned.' });
  }
};

const HIRING_INQUIRY_HEADERS = [
  'Inquiry ID', 'Submitted At', 'Company', 'Website', 'Contact Person', 'Email', 'Phone', 'Location',
  'Position', 'Course / Skills', 'Opening Count', 'Work Mode', 'Last Date', 'Qualification', 'Experience',
  'Salary', 'Gender Preference', 'Job Description', 'Notes', 'Status', 'Assigned TPO', 'Assigned TPO Email',
  'Assigned At', 'Assigned By', 'Notification Status', 'Notification Sent At', 'Internal Email Status'
];

const getHiringInquirySheet = async () => {
  await loadDocInfo();
  let sheet = doc.sheetsByTitle['Hiring Inquiries'];
  if (!sheet) {
    try {
      sheet = await doc.addSheet({ title: 'Hiring Inquiries', headerValues: HIRING_INQUIRY_HEADERS });
    } catch (error) {
      await loadDocInfo();
      sheet = doc.sheetsByTitle['Hiring Inquiries'];
      if (!sheet) throw error;
    }
  }
  await sheet.loadHeaderRow();
  const normalized = new Set((sheet.headerValues || []).map(value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')));
  const missing = HIRING_INQUIRY_HEADERS.filter(value => !normalized.has(value.toLowerCase().replace(/[^a-z0-9]/g, '')));
  if (missing.length) await sheet.setHeaderRow([...(sheet.headerValues || []), ...missing]);
  return sheet;
};

const toHiringInquiry = row => Object.fromEntries([
  ['inquiryId', ['inquiryid']], ['submittedAt', ['submittedat']], ['company', ['company']], ['website', ['website']],
  ['contactPerson', ['contactperson', 'name']], ['email', ['email']], ['phone', ['phone']], ['location', ['location']],
  ['position', ['position', 'role']], ['courseSkills', ['courseskills']], ['openingCount', ['openingcount']],
  ['workMode', ['workmode']], ['lastDate', ['lastdate', 'deadline']], ['qualification', ['qualification']],
  ['experience', ['experience']], ['salary', ['salary']], ['genderPreference', ['genderpreference']],
  ['jobDescription', ['jobdescription', 'requirements']], ['notes', ['notes']], ['status', ['status']],
  ['assignedTpo', ['assignedtpo']], ['assignedTpoEmail', ['assignedtpoemail']], ['assignedAt', ['assignedat']],
  ['assignedBy', ['assignedby']], ['notificationStatus', ['notificationstatus']],
  ['notificationSentAt', ['notificationsentat']], ['internalEmailStatus', ['internalemailstatus']]
].map(([key, aliases]) => [key, getValByHeader(row, aliases)]));

const cleanHiringSubjectPart = value => String(value || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 120);
const sanitizeHiringWebsite = value => {
  const raw = String(value || '').trim().slice(0, 240);
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
  } catch {
    return '';
  }
};

const getHiringTpoOptions = () => {
  const contacts = getCache()?.contacts || [];
  const seen = new Set();
  return contacts.map(row => ({
    name: getValByHeader(row, ['tponame', 'name', 'placementofficer']).trim(),
    email: getValByHeader(row, ['mailid', 'email']).trim(),
    branches: getValByHeader(row, ['assignedbranches', 'sittingbranch']).trim(),
    status: getValByHeader(row, ['status', 'tpostatus']).trim().toLowerCase()
  })).filter(item => {
    const key = item.email.toLowerCase();
    if (!item.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email) || seen.has(key) || /^(inactive|disabled|removed|terminated|left)$/.test(item.status)) return false;
    seen.add(key);
    return true;
  });
};

exports.submitHiringInquiry = async (req, res) => {
  const input = req.body || {};
  if (String(input.websiteTrap || '').trim()) return res.status(201).json({ success: true });

  const fields = {
    company: String(input.company || '').trim().slice(0, 160),
    website: sanitizeHiringWebsite(input.companyWebsite),
    contactPerson: String(input.contactPerson || '').trim().slice(0, 120),
    email: String(input.email || '').trim().slice(0, 254),
    phone: String(input.phone || '').trim().slice(0, 40),
    location: String(input.location || '').trim().slice(0, 160),
    position: String(input.position || '').trim().slice(0, 160),
    courseSkills: String(input.courseSkills || '').trim().slice(0, 240),
    openingCount: String(input.openingCount || '').trim().slice(0, 40),
    workMode: String(input.workMode || '').trim().slice(0, 80),
    lastDate: String(input.lastDate || '').trim().slice(0, 40),
    qualification: String(input.qualification || '').trim().slice(0, 240),
    experience: String(input.experience || '').trim().slice(0, 160),
    salary: String(input.salary || '').trim().slice(0, 120),
    genderPreference: String(input.genderPreference || '').trim().slice(0, 100),
    jobDescription: String(input.jobDescription || '').trim().slice(0, 4000),
    notes: String(input.notes || '').trim().slice(0, 2000)
  };
  if (!fields.company || !fields.contactPerson || !fields.position || !fields.courseSkills || !fields.openingCount ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email) || !fields.phone) {
    return res.status(400).json({ success: false, message: 'Enter the company, contact details, role, course or skills, and number of openings.' });
  }

  const escape = escapeCorporateInquiryHtml;
  const inquiryId = `HI-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;
  const submittedAt = formatIndiaTimestamp();
  const safeCompany = cleanHiringSubjectPart(fields.company).slice(0, 100);
  const detailRows = [
    ['Company', fields.company], ['Website', fields.website], ['Contact person', fields.contactPerson],
    ['Email', fields.email], ['Phone / WhatsApp', fields.phone], ['Location', fields.location],
    ['Role', fields.position], ['Course / skills', fields.courseSkills], ['Openings', fields.openingCount],
    ['Work mode', fields.workMode], ['Last date', fields.lastDate], ['Qualification', fields.qualification],
    ['Experience', fields.experience], ['Salary', fields.salary], ['Gender preference', fields.genderPreference]
  ].filter(([, value]) => value);
  const description = escape(fields.jobDescription).replace(/\r?\n/g, '<br>') || 'No job description provided.';
  const notes = escape(fields.notes).replace(/\r?\n/g, '<br>') || 'No additional notes provided.';
  const emailHtml = `
    <div style="max-width:700px;margin:24px auto;border:1px solid #dce6ef;border-radius:18px;overflow:hidden;font-family:Arial,sans-serif;color:#18314d;background:#fff">
      <div style="padding:24px 28px;background:#102b4a;color:#fff;border-bottom:4px solid #39c8bd"><div style="font-size:11px;font-weight:bold;letter-spacing:2px;color:#9fdedb">IPCS GLOBAL · PLACEMENTS</div><h1 style="margin:10px 0 0;font-size:22px">New hiring inquiry</h1></div>
      <div style="padding:26px 28px"><p style="margin:0 0 18px;color:#53677d;line-height:1.65">A company submitted a hiring request. Reference: ${escape(inquiryId)}</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${detailRows.map(([label, value]) => `<tr><th style="width:190px;padding:11px 12px;border:1px solid #e1e8ef;background:#f5f8fb;text-align:left;color:#52667c">${escape(label)}</th><td style="padding:11px 12px;border:1px solid #e1e8ef;color:#18314d">${escape(value)}</td></tr>`).join('')}</table>
      <h2 style="margin:23px 0 8px;font-size:15px;color:#173955">Role details</h2><div style="padding:14px;border:1px solid #e1e8ef;border-radius:10px;background:#fafcfe;font-size:14px;line-height:1.7">${description}</div>
      <h2 style="margin:20px 0 8px;font-size:15px;color:#173955">Additional notes</h2><div style="padding:14px;border:1px solid #e1e8ef;border-radius:10px;background:#fafcfe;font-size:14px;line-height:1.7">${notes}</div>
      <p style="margin:22px 0 0;color:#718197;font-size:12px">Reply to this email to contact ${escape(fields.contactPerson)} directly.</p></div></div>`;

  try {
    const sheet = await getHiringInquirySheet();
    await sheet.addRow({
      'Inquiry ID': inquiryId, 'Submitted At': submittedAt, Company: fields.company, Website: fields.website,
      'Contact Person': fields.contactPerson, Email: fields.email, Phone: fields.phone, Location: fields.location,
      Position: fields.position, 'Course / Skills': fields.courseSkills, 'Opening Count': fields.openingCount,
      'Work Mode': fields.workMode, 'Last Date': fields.lastDate, Qualification: fields.qualification,
      Experience: fields.experience, Salary: fields.salary, 'Gender Preference': fields.genderPreference,
      'Job Description': fields.jobDescription, Notes: fields.notes, Status: 'New', 'Assigned TPO': '',
      'Assigned TPO Email': '', 'Assigned At': '', 'Assigned By': '', 'Notification Status': 'Not assigned',
      'Notification Sent At': '', 'Internal Email Status': 'Pending'
    });

    let internalEmailStatus = 'Sent';
    try {
      const mailResult = await sendMailAndLog({
        to: 'gifty@ipcsglobal.com', replyTo: fields.email,
        subject: `New hiring inquiry · ${safeCompany} · ${cleanHiringSubjectPart(fields.position)}`,
        html: emailHtml
      }, {
        name: `${fields.company} · ${fields.contactPerson}`, email: 'gifty@ipcsglobal.com',
        type: 'Hiring Inquiry', category: 'placement',
        queueContext: { sheetName: 'Hiring Inquiries', idHeader: 'Inquiry ID', idValue: inquiryId,
          statusHeader: 'Internal Email Status', failedValuePrefix: 'Failed: ', statusValues: { SENT: 'Sent' } }
      });
      if (mailResult?.queued) internalEmailStatus = 'Queued';
    } catch (mailError) {
      internalEmailStatus = `${mailErrorStatus(mailError)}: ${mailError.message}`.slice(0, 500);
      console.error('Hiring inquiry was stored, but its Gifty notification failed:', mailError.message);
    }
    try {
      const storedRow = (await sheet.getRows()).find(row => getValByHeader(row, ['inquiryid']) === inquiryId);
      if (storedRow) { storedRow.set('Internal Email Status', internalEmailStatus); await storedRow.save(); }
    } catch (statusError) {
      console.error('Could not update hiring inquiry email status:', statusError.message);
    }
    return res.status(201).json({ success: true, message: 'Your hiring request has been received by the IPCS Global placement team.' });
  } catch (error) {
    console.error('Hiring inquiry could not be stored:', error.message);
    return res.status(503).json({ success: false, message: 'We could not save your hiring request right now. Please try again later.' });
  }
};

exports.getHiringInquiryTpos = (_req, res) => {
  res.json({ success: true, tpos: getHiringTpoOptions() });
};

exports.getHiringInquiries = async (_req, res) => {
  try {
    const sheet = await getHiringInquirySheet();
    const inquiries = (await sheet.getRows()).map(toHiringInquiry).filter(item => item.inquiryId).reverse();
    res.json({ success: true, inquiries });
  } catch (error) {
    console.error('Could not load hiring inquiries:', error.message);
    res.status(503).json({ success: false, inquiries: [], message: 'Hiring inquiries are temporarily unavailable.' });
  }
};

const buildHiringAssignmentEmail = inquiry => {
  const escape = escapeCorporateInquiryHtml;
  const details = [
    ['Company', inquiry.company], ['Website', inquiry.website], ['Contact person', inquiry.contactPerson],
    ['Email', inquiry.email], ['Phone / WhatsApp', inquiry.phone], ['Location', inquiry.location],
    ['Role', inquiry.position], ['Course / skills', inquiry.courseSkills], ['Openings', inquiry.openingCount],
    ['Work mode', inquiry.workMode], ['Last date', inquiry.lastDate], ['Qualification', inquiry.qualification],
    ['Experience', inquiry.experience], ['Salary', inquiry.salary], ['Gender preference', inquiry.genderPreference]
  ].filter(([, value]) => value);
  const description = escape(inquiry.jobDescription).replace(/\r?\n/g, '<br>') || 'No job description provided.';
  const notes = escape(inquiry.notes).replace(/\r?\n/g, '<br>') || 'No additional notes provided.';
  return `<div style="max-width:700px;margin:24px auto;border:1px solid #dce6ef;border-radius:18px;overflow:hidden;font-family:Arial,sans-serif;color:#18314d;background:#fff"><div style="padding:24px 28px;background:#102b4a;color:#fff;border-bottom:4px solid #39c8bd"><div style="font-size:11px;font-weight:bold;letter-spacing:2px;color:#9fdedb">IPCS GLOBAL · PLACEMENTS</div><h1 style="margin:10px 0 0;font-size:22px">Hiring request assigned to you</h1></div><div style="padding:26px 28px"><p style="margin:0 0 18px;color:#53677d;line-height:1.65">Please contact the company and coordinate candidates for this opening. Reference: ${escape(inquiry.inquiryId)}</p><table style="width:100%;border-collapse:collapse;font-size:14px">${details.map(([label, value]) => `<tr><th style="width:190px;padding:11px 12px;border:1px solid #e1e8ef;background:#f5f8fb;text-align:left;color:#52667c">${escape(label)}</th><td style="padding:11px 12px;border:1px solid #e1e8ef;color:#18314d">${escape(value)}</td></tr>`).join('')}</table><h2 style="margin:23px 0 8px;font-size:15px;color:#173955">Role details</h2><div style="padding:14px;border:1px solid #e1e8ef;border-radius:10px;background:#fafcfe;font-size:14px;line-height:1.7">${description}</div><h2 style="margin:20px 0 8px;font-size:15px;color:#173955">Additional notes</h2><div style="padding:14px;border:1px solid #e1e8ef;border-radius:10px;background:#fafcfe;font-size:14px;line-height:1.7">${notes}</div></div></div>`;
};

exports.assignHiringInquiry = async (req, res) => {
  const inquiryId = String(req.body?.inquiryId || '').trim();
  const tpoName = String(req.body?.tpoName || '').trim();
  if (!inquiryId || !tpoName) return res.status(400).json({ success: false, message: 'Choose a placement officer.' });
  try {
    const tpo = getHiringTpoOptions().find(item => item.name.toLowerCase() === tpoName.toLowerCase());
    if (!tpo) return res.status(400).json({ success: false, message: 'Choose a TPO from the active placement contact list.' });
    const sheet = await getHiringInquirySheet();
    const row = (await sheet.getRows()).find(item => getValByHeader(item, ['inquiryid']) === inquiryId);
    if (!row) return res.status(404).json({ success: false, message: 'This hiring inquiry could not be found.' });
    const inquiry = toHiringInquiry(row);
    if (inquiry.assignedTpo === tpo.name && inquiry.notificationStatus === 'Sent' && inquiry.assignedTpoEmail.toLowerCase() === tpo.email.toLowerCase()) {
      return res.json({ success: true, alreadyAssigned: true, inquiry, message: `This inquiry is already assigned to ${tpo.name}.` });
    }
    if (inquiry.assignedTpo === tpo.name && String(inquiry.notificationStatus).toLowerCase() === 'sending') {
      return res.status(409).json({ success: false, message: 'The assignment email is already being processed. Refresh before retrying.' });
    }

    row.set('Status', 'Assigned');
    row.set('Assigned TPO', tpo.name);
    row.set('Assigned TPO Email', tpo.email);
    row.set('Assigned At', formatIndiaTimestamp());
    row.set('Assigned By', String(req.portalUser?.name || req.portalUser?.email || 'Gifty').slice(0, 120));
    row.set('Notification Status', 'Sending');
    await row.save();

    try {
      const mailResult = await sendMailAndLog({
        to: tpo.email, cc: 'gifty@ipcsglobal.com', replyTo: inquiry.email,
        subject: `Hiring request assigned · ${cleanHiringSubjectPart(inquiry.company)} · ${cleanHiringSubjectPart(inquiry.position)}`,
        html: buildHiringAssignmentEmail(inquiry)
      }, {
        name: `${tpo.name} · ${inquiry.company}`, email: tpo.email,
        type: 'Hiring Inquiry Assignment', category: 'company',
        queueContext: { sheetName: 'Hiring Inquiries', idHeader: 'Inquiry ID', idValue: inquiryId,
          statusHeader: 'Notification Status', sentAtHeader: 'Notification Sent At', failedValuePrefix: 'Failed: ',
          statusValues: { SENT: 'Sent' } }
      });
      if (mailResult?.queued) {
        row.set('Notification Status', 'Queued');
        await row.save();
        return res.json({ success: true, inquiry: toHiringInquiry(row), queued: true, message: `Assigned to ${tpo.name}; the email is queued for delivery.` });
      }
      row.set('Notification Status', 'Sent');
      row.set('Notification Sent At', formatIndiaTimestamp());
      await row.save();
      return res.json({ success: true, inquiry: toHiringInquiry(row), message: `Assigned to ${tpo.name}; the company and opening details were emailed.` });
    } catch (mailError) {
      row.set('Notification Status', `${mailErrorStatus(mailError)}: ${mailError.message}`.slice(0, 500));
      try { await row.save(); } catch (statusError) { console.error('Could not record hiring assignment email failure:', statusError.message); }
      return res.json({ success: true, inquiry: toHiringInquiry(row), warning: `The inquiry was assigned, but the email could not be sent: ${mailError.message}` });
    }
  } catch (error) {
    console.error('Could not assign hiring inquiry:', error.message);
    res.status(500).json({ success: false, message: 'The hiring inquiry could not be assigned.' });
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
    const openings = [];

    rows.forEach((row, index) => {
      const company = getValByHeader(row, ['companyname', 'company']).trim();
      const position = getValByHeader(row, ['position', 'role', 'jobtitle']).trim();
      const location = getValByHeader(row, ['openingat(location)', 'location', 'city']).trim();
      const lastDate = getValByHeader(row, ['lastdate', 'applicationdeadline']).trim();
      if (!company || !position) return;
      openings.push({
        id: getValByHeader(row, ['jobid', 'id']).trim() || `newsletter-${index + 1}`,
        company,
        companyLogo: getValByHeader(row, ['companylogo', 'logo']).trim() || companyLogos.get(normalizePlacementText(company)) || '',
        position,
        location,
        mode: getValByHeader(row, ['workmode', 'mode']).trim(),
        lastDate,
        course: getValByHeader(row, ['course', 'program']).trim(),
        description: getValByHeader(row, ['description', 'jobdescription', 'roleoverview']).trim(),
        qualification: getValByHeader(row, ['qualification', 'eligibility', 'educationalqualification']).trim(),
        experience: getValByHeader(row, ['experience', 'yearsofexperience']).trim(),
        salary: getValByHeader(row, ['salary', 'package', 'ctc', 'compensation']).trim()
      });
    });

    res.json({ success: true, openings });
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

const PUBLIC_MAGAZINE_FOLDER_ID = '151HVXrNa_lBwY9sLzA_j3pca4Otdw-5R';
let publicMagazineCache = { expiresAt: 0, magazines: [] };
let publicMagazineLoading = null;

async function getPublicMagazineFiles() {
  if (publicMagazineCache.expiresAt > Date.now()) return publicMagazineCache.magazines;
  if (publicMagazineLoading) return publicMagazineLoading;

  publicMagazineLoading = (async () => {
    const magazines = [];
    let pageToken;
    do {
      const response = await drive.files.list({
        q: `'${PUBLIC_MAGAZINE_FOLDER_ID}' in parents and trashed = false`,
        pageSize: 250,
        pageToken,
        orderBy: 'modifiedTime desc',
        fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink)',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true
      });
      for (const file of response.data.files || []) {
        if (file.mimeType === 'application/pdf' || /\.pdf$/i.test(file.name || '')) magazines.push(file);
      }
      pageToken = response.data.nextPageToken;
    } while (pageToken);

    publicMagazineCache = { expiresAt: Date.now() + 5 * 60 * 1000, magazines };
    return magazines;
  })();

  try {
    return await publicMagazineLoading;
  } finally {
    publicMagazineLoading = null;
  }
}

exports.getPublicMagazines = async (_req, res) => {
  try {
    const magazines = await getPublicMagazineFiles();
    res.json({
      success: true,
      magazines: magazines.map(file => ({
        id: file.id,
        name: file.name,
        modifiedTime: file.modifiedTime || '',
        thumbnailUrl: `https://drive.google.com/thumbnail?id=${encodeURIComponent(file.id)}&sz=w640`,
        webViewUrl: file.webViewLink || `https://drive.google.com/file/d/${encodeURIComponent(file.id)}/view?usp=sharing`
      }))
    });
  } catch (err) {
    console.error('Error reading IZIAR magazine PDFs from Drive:', err.message);
    res.status(503).json({ success: false, magazines: [], message: 'IZIAR magazine editions are temporarily unavailable.' });
  }
};

exports.getClientById = (req, res) => {
  const targetRow = Number(req.params.id);
  if (!Number.isSafeInteger(targetRow) || targetRow < 2) return res.status(404).json({ success: false, message: 'Client not found' });
  const clients = getCache()?.clients;
  if (!Array.isArray(clients)) return res.status(503).json({ success: false, message: 'Client records are still loading. Please retry shortly.' });
  const row = clients.find(r => Number(r.rowNumber) === targetRow);
  if (!row) return res.status(404).json({ success: false, message: "Client not found" });
  if (!canManageClientRow(req.portalUser, row)) return res.status(404).json({ success: false, message: 'Client not found' });

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

const LEGACY_MOU_TOKEN_HASH_HEADER = 'MOU Signing Token Hash';
const MOU_TOKEN_EXPIRY_HEADER = 'MOU Signing Expires At';
const MOU_SIGNING_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const hashLegacyMouSigningToken = token => createHash('sha256').update(String(token || '')).digest('hex');
const deriveMouSigningKey = secret => createHash('sha256').update('IPCS:MOU:LINK:V2\0').update(String(secret)).digest();
const getMouSigningKeys = () => {
  const privateKey = String(process.env.GOOGLE_PRIVATE_KEY || '');
  const secretVariants = [
    process.env.MOU_SIGNING_SECRET,
    process.env.MOU_SIGNING_SECRET_PREVIOUS,
    privateKey.replace(/\\n/g, '\n'),
    privateKey
  ].map(value => String(value || '')).filter(Boolean);
  if (!secretVariants.length) throw new Error('Configure MOU_SIGNING_SECRET to sign MOU links.');
  const uniqueSecrets = [...new Set(secretVariants)];
  return uniqueSecrets.map(deriveMouSigningKey);
};
const getMouSigningKey = () => getMouSigningKeys()[0];
const createMouSigningId = rowNumber => {
  const nonce = randomBytes(16).toString('base64url');
  const payload = `${Number(rowNumber)}.${nonce}`;
  const signature = createHmac('sha256', getMouSigningKey()).update(payload).digest('base64url');
  // New company-facing links use a neutral token prefix; the validator below
  // continues accepting previously issued MOU-prefixed links.
  return `IPCS-${Number(rowNumber)}-${nonce}-${signature}`;
};

const getMouSigningApiOrigin = req => {
  const configuredHosts = new Set([
    'api-talenzo.ipcsglobal.info',
    'api-placement.ipcsglobal.info',
    'api-placement.ipcstalenzo.com',
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

const getMouSigningFrontendOrigin = () => {
  const allowedHosts = new Set(['ipcs-tpo-portal.vercel.app', 'talenzo.ipcsglobal.info']);
  const candidate = String(process.env.MOU_SIGNING_FRONTEND_BASE || 'https://ipcs-tpo-portal.vercel.app').trim();
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === 'https:' && allowedHosts.has(parsed.hostname.toLowerCase())) return parsed.origin;
  } catch { /* Use the known Vercel portal when the optional origin is invalid. */ }
  return 'https://ipcs-tpo-portal.vercel.app';
};

const findClientByMouToken = async (sheet, token) => {
  const cleanToken = String(token || '').trim();
  const isLegacyToken = /^[a-f0-9]{64}$/i.test(cleanToken);
  const signedMatch = cleanToken.match(/^(?:IPCS|MOU)-(\d+)-([A-Za-z0-9_-]{22})-([A-Za-z0-9_-]{43})$/);

  if (signedMatch) {
    const rowNumber = Number(signedMatch[1]);
    if (!Number.isSafeInteger(rowNumber) || rowNumber < 2) return null;
    const payload = `${rowNumber}.${signedMatch[2]}`;
    const suppliedSignature = Buffer.from(signedMatch[3]);
    const signatureIsValid = getMouSigningKeys().some(signingKey => {
      const expectedSignature = Buffer.from(createHmac('sha256', signingKey).update(payload).digest('base64url'));
      return suppliedSignature.length === expectedSignature.length && timingSafeEqual(suppliedSignature, expectedSignature);
    });
    if (!signatureIsValid) {
      console.warn(`[MOU] Rejected signing token signature for Clients row ${rowNumber}; check that the issuing API and this API use the same stable MOU_SIGNING_SECRET.`);
      return null;
    }

    await sheet.loadHeaderRow();
    const rows = await sheet.getRows({ offset: rowNumber - 2, limit: 1 });
    const row = rows.find(item => Number(item.rowNumber) === rowNumber) || null;
    if (!row) console.warn(`[MOU] Valid signing token points to missing Clients row ${rowNumber}.`);
    if (row) {
      const normalized = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const tokenHashHeader = (sheet.headerValues || []).find(header => normalized(header) === normalized(LEGACY_MOU_TOKEN_HASH_HEADER));
      const expiryHeader = (sheet.headerValues || []).find(header => normalized(header) === normalized(MOU_TOKEN_EXPIRY_HEADER));
      const storedHash = String(tokenHashHeader ? row.get(tokenHashHeader) || '' : '').trim().toLowerCase();
      if (storedHash) {
        if (!/^[a-f0-9]{64}$/.test(storedHash)) return null;
        const actualHash = Buffer.from(storedHash, 'hex');
        const suppliedHash = Buffer.from(hashLegacyMouSigningToken(cleanToken), 'hex');
        if (actualHash.length !== suppliedHash.length || !timingSafeEqual(actualHash, suppliedHash)) return null;
      }
      const expiresAt = String(expiryHeader ? row.get(expiryHeader) || '' : '').trim();
      if (expiresAt && (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= Date.now())) return null;
    }
    return row;
  }

  // Keep already emailed links working while new requests use signed row IDs.
  // This read-only legacy path can be removed after all old pending links expire.
  const isLegacyMouId = /^MOU-[A-Za-z0-9_-]{24}$/.test(cleanToken);
  if (!isLegacyToken && !isLegacyMouId) return null;
  const canonicalToken = isLegacyToken ? cleanToken.toLowerCase() : cleanToken;

  await sheet.loadHeaderRow();
  const tokenHash = Buffer.from(hashLegacyMouSigningToken(canonicalToken), 'hex');
  const tokenHeader = (sheet.headerValues || []).find(header =>
    String(header || '').toLowerCase().replace(/[^a-z0-9]/g, '') === LEGACY_MOU_TOKEN_HASH_HEADER.toLowerCase().replace(/[^a-z0-9]/g, '')
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
  const { rowNumber, companyName, website, email, phone, location, contactPerson } = req.body;
  const existingLogo = req.body.logo || '';
  try {
    if (companyName !== undefined && !String(companyName).trim()) return res.status(400).json({ success: false, message: 'Company name cannot be empty.' });
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
      
      const hCompanyName = getSafeH(['companyname', 'company']); if(hCompanyName && companyName !== undefined) updateObj[hCompanyName] = String(companyName).trim();
      const hWebsite = getSafeH(['companywebsite', 'website']); if(hWebsite && website !== undefined) updateObj[hWebsite] = String(website).trim();
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
    let mailStatusHeader = headers.find(header => normalizeHeader(header) === 'mailstatus');
    const normalizedNames = headers.map(normalizeHeader);
    const missingHeaders = [
      ...(!mailStatusHeader ? ['Mail Status'] : []),
      ...(!normalizedNames.includes(normalizeHeader(LEGACY_MOU_TOKEN_HASH_HEADER)) ? [LEGACY_MOU_TOKEN_HASH_HEADER] : []),
      ...(!normalizedNames.includes(normalizeHeader(MOU_TOKEN_EXPIRY_HEADER)) ? [MOU_TOKEN_EXPIRY_HEADER] : [])
    ];
    if (missingHeaders.length) {
      const requiredColumnCount = headers.length + missingHeaders.length;
      const currentColumnCount = Number(sheet.columnCount) || 0;
      if (currentColumnCount < requiredColumnCount) {
        await sheet.resize({ columnCount: requiredColumnCount });
      }
      await sheet.setHeaderRow([...headers, ...missingHeaders]);
      await sheet.loadHeaderRow();
      headers = [...(sheet.headerValues || [])];
      mailStatusHeader = headers.find(header => normalizeHeader(header) === 'mailstatus');
    }
    if (!mailStatusHeader) return res.status(500).json({ success: false, message: 'The Clients sheet is missing the Mail Status column.' });
    const tokenHashHeader = headers.find(header => normalizeHeader(header) === normalizeHeader(LEGACY_MOU_TOKEN_HASH_HEADER));
    const tokenExpiryHeader = headers.find(header => normalizeHeader(header) === normalizeHeader(MOU_TOKEN_EXPIRY_HEADER));
    if (!tokenHashHeader || !tokenExpiryHeader) return res.status(500).json({ success: false, message: 'The Clients sheet is missing MOU signing security columns.' });
    const rows = await sheet.getRows({ offset: rowNumber - 2, limit: 1 });
    if (!rows.length || Number(rows[0].rowNumber) !== rowNumber) return res.status(404).json({ success: false, message: 'Client record was not found.' });
    const clientRow = rows[0];
    if (!canManageClientRow(req.portalUser, clientRow)) return res.status(403).json({ success: false, message: 'You cannot send an MOU for this client.' });
    const companyEmail = getValByHeader(clientRow, ['companymailid', 'companyemail', 'mailid', 'email']);
    const companyName = getValByHeader(clientRow, ['companyname', 'company']);
    if (!companyEmail || !companyName) return res.status(400).json({ success: false, message: 'This client needs a company name and email before an MOU can be sent.' });
    const signingToken = createMouSigningId(rowNumber);
    const signingExpiresAt = new Date(Date.now() + MOU_SIGNING_TTL_MS).toISOString();
    const signingReference = `IPCS-${rowNumber}`;
    clientRow.assign({
      [mailStatusHeader]: 'Sending',
      [tokenHashHeader]: hashLegacyMouSigningToken(signingToken),
      [tokenExpiryHeader]: signingExpiresAt
    });
    await clientRow.save();
    const signingApiOrigin = getMouSigningApiOrigin(req);
    const signingApiQuery = signingApiOrigin ? `?api=${encodeURIComponent(signingApiOrigin)}` : '';
    const signingLink = `${getMouSigningFrontendOrigin()}/sign-certificate/${encodeURIComponent(signingToken)}${signingApiQuery}`;
    console.info(`[MOU] Issued signing link for Clients row ${rowNumber}; lookup API: ${signingApiOrigin || 'portal default API'}.`);
    const safeCompanyName = escapeCorporateInquiryHtml(companyName);
    const mailOptions = {
      from: `"IPCS Placement Portal" <${process.env.EMAIL_USER}>`, to: companyEmail,
      subject: `Action Required: IPCS Global Hiring Partnership Confirmation With ${companyName.replace(/[\r\n]+/g, ' ').slice(0, 100)} [Ref: ${signingReference}]`,
      html: `<div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;"><div style="background-color: #0f1523; padding: 20px; text-align: center; border-bottom: 4px solid #8b5cf6;"><h2 style="color: #ffffff; margin: 0;">IPCS HIRING PARTNERSHIP</h2></div><div style="padding: 30px;"><p>Dear ${safeCompanyName} Team,</p><p>We are thrilled to welcome you as a Preferred Hiring Partner with IPCS Global!</p><p>To finalize our association, please review and digitally sign your Confirmation of Hiring Partnership by clicking the secure button below. You will be able to upload your company logo and authorized signature directly on the document.</p><p style="font-size: 13px; color: #64748b;">Reference: <strong>${signingReference}</strong></p><div style="text-align: center; margin: 40px 0;"><a href="${signingLink}" style="background-color: #10b981; color: white; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; font-size: 16px;">Review &amp; Sign</a></div><p style="font-size: 13px; color: #64748b;">If the button does not work, <a href="${signingLink}" style="color: #0369a1; font-weight: bold;">open your secure signing page</a>.</p></div></div>`
    };
    try {
      const mailResult = await sendMailAndLog(mailOptions, {
        name: companyName,
        email: companyEmail,
        type: 'MOU Request',
        category: 'company',
        queueContext: {
          sheetName: 'Clients', rowNumber: clientRow.rowNumber,
          statusHeader: mailStatusHeader,
          statusValues: { SENT: 'Request Sent', FAILED: 'Failed' }
        }
      });
      if (mailResult?.queued) {
        clientRow.assign({ [mailStatusHeader]: 'Request Queued' });
        await clientRow.save();
        refreshCache();
        return res.json({ success: true, mailSent: false, mailQueued: true, statusUpdated: true, queueId: mailResult.queueId });
      }
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

    const uploadedFiles = Object.values(req.files || {}).flat();
    const certFile = uploadedFiles.find(f => f.fieldname === 'certificatePdf');
    const logoFile = uploadedFiles.find(f => f.fieldname === 'logoFile');
    if (!certFile) return res.status(400).json({ success: false, message: "PDF missing" });
    if (!certFile.buffer?.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
      return res.status(415).json({ success: false, message: 'The agreement file must be a valid PDF.' });
    }
    if (logoFile && !(
      logoFile.buffer?.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      || logoFile.buffer?.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
      || logoFile.buffer?.subarray(0, 4).toString('ascii') === 'RIFF' && logoFile.buffer?.subarray(8, 12).toString('ascii') === 'WEBP'
    )) return res.status(415).json({ success: false, message: 'The company logo must be a valid PNG, JPEG, or WebP image.' });

    const companyName = getValByHeader(clientRow, ['companyname', 'company']) || 'Hiring Partner';
    const companyEmail = getValByHeader(clientRow, ['companymailid', 'companyemail', 'mailid', 'email']) || '';
    const tpoName = getValByHeader(clientRow, ['placementofficer', 'tponame']);
    const tpoEmail = getTpoEmailByName(tpoName);

    const pdfLink = await uploadToDrive(certFile, FOLDER_MOU_CERTIFICATES);
    let parsedPdfUrl;
    try { parsedPdfUrl = new URL(pdfLink); } catch { return res.status(502).json({ success: false, message: 'The agreement upload returned an invalid file link.' }); }
    if (parsedPdfUrl.protocol !== 'https:' || !['drive.google.com', 'docs.google.com'].includes(parsedPdfUrl.hostname.toLowerCase())) {
      return res.status(502).json({ success: false, message: 'The agreement upload returned an untrusted file link.' });
    }
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
    const hMailStatus = getSafeH(['mailstatus']); if(hMailStatus) updateObj[hMailStatus] = 'Completion Email Pending';
    const hTokenHash = getSafeH([LEGACY_MOU_TOKEN_HASH_HEADER]); if(hTokenHash) updateObj[hTokenHash] = '';
    const hTokenExpiry = getSafeH([MOU_TOKEN_EXPIRY_HEADER]); if(hTokenExpiry) updateObj[hTokenExpiry] = '';
    clientRow.assign(updateObj);
    await clientRow.save();

    const zonalManagerEmail = 'giftyipcsglobal@gmail.com';
    const refId = Math.floor(10000 + Math.random() * 90000); 
    const safeCompanyName = escapeCorporateInquiryHtml(companyName);
    const safePdfLink = escapeCorporateInquiryHtml(pdfLink);
    const safeAttachmentName = `${companyName.replace(/[\\/:*?"<>|\r\n]+/g, '_').slice(0, 120) || 'Hiring_Partner'}_Agreement.pdf`;
    const mailOptions = {
      from: `"IPCS Placement Portal" <${process.env.EMAIL_USER}>`,
      to: [companyEmail, zonalManagerEmail, tpoEmail].filter(Boolean).join(','),
      subject: `Hiring Partnership Confirmation Completed – ${companyName.replace(/[\r\n]+/g, ' ').slice(0, 100)} [Ref: ${refId}]`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #0f1523; padding: 20px; text-align: center; border-bottom: 4px solid #10b981;">
            <h2 style="color: #ffffff; margin: 0; font-size: 22px; letter-spacing: 1px;">PARTNERSHIP CONFIRMED</h2>
          </div>
          <div style="padding: 30px; background-color: #ffffff;">
            <p style="font-size: 16px; margin-top: 0;">Dear <b>${safeCompanyName}</b> Team,</p>
            <p style="font-size: 15px; line-height: 1.6; color: #475569;">The Hiring Partnership Confirmation has been digitally signed and successfully processed. We are incredibly excited to officially partner with you!</p>
            <p style="font-size: 15px; line-height: 1.6; color: #475569;">You can securely view and download your official, countersigned partnership agreement below:</p>
            <div style="text-align: center; margin: 35px 0;">
              <a href="${safePdfLink}" style="background-color: #0284c7; color: white; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; font-size: 16px; display: inline-block;">View Official Agreement</a>
            </div>
            <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">
              <p style="margin: 0 0 5px 0;">Regards,</p>
              <p style="margin: 0 0 2px 0; font-weight: bold; color: #0f1523; font-size: 14px;">IPCS Placement Portal</p>
            </div>
          </div>
        </div>
      `,
      attachments: [{ filename: safeAttachmentName, content: certFile.buffer }]
    };
    let emailSent = true;
    let emailQueued = false;
    try {
      const mailResult = await sendMailAndLog(mailOptions, {
        name: companyName,
        email: companyEmail,
        type: 'MOU Completion',
        category: 'company',
        queueContext: {
          sheetName: 'Clients', rowNumber: clientRow.rowNumber,
          statusHeader: hMailStatus || 'Mail Status',
          statusValues: { SENT: 'Completion Email Sent', FAILED: 'Completion Email Failed', REVIEW: 'Completion Email Review' }
        }
      });
      emailQueued = Boolean(mailResult?.queued);
      emailSent = !emailQueued;
      if (hMailStatus) {
        clientRow.set(hMailStatus, emailQueued ? 'Completion Email Queued' : 'Completion Email Sent');
        await clientRow.save();
      }
    } catch (mailError) {
      emailSent = false;
      if (hMailStatus) {
        clientRow.set(hMailStatus, `Completion Email ${mailErrorStatus(mailError)}`);
        await clientRow.save().catch(statusError => console.error('Could not save MOU completion email status:', statusError.message));
      }
      console.error('MOU was saved, but completion email failed:', mailError.message);
    }
    refreshCache();
    res.json({ success: true, pdfLink, emailSent, emailQueued });
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

const invalidatedAccountVersions = new Map();
const invalidateStaffAccountSessions = (email, row = null) => {
  const identity = String(email || '').trim().toLowerCase();
  if (!identity) return;
  invalidatedAccountVersions.set(identity, row ? getAccountVersion(accountAuthState(row)) : null);
};

exports.addAdminUser = async (req, res) => {
  try {
    const { userName, contact, email, sittingBranch, assignedBranches, role, course, access, empId, target } = req.body;
    const password = typeof req.body.newPassword === 'string' ? req.body.newPassword : req.body.password;
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!String(userName || '').trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Enter the employee name and a valid login email.' });
    }
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ success: false, message: passwordError });
    const cache = getCache();
    if ([...(cache?.contacts || []), ...(cache?.users || [])].some(row => getValByHeader(row, ['email', 'mailid', 'mail']).toLowerCase() === cleanEmail)) {
      return res.status(409).json({ success: false, message: 'An account already uses this email address.' });
    }

    await loadDocInfo();
    const sheetName = role === 'TPO' ? "Contact" : "User";
    const s = doc.sheetsByTitle[sheetName]; 
    if (!s) return res.status(503).json({ success: false, message: `The ${sheetName} account sheet is unavailable.` });
    const h = s.headerValues || [];
    const hashedPassword = await hashPassword(password);

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
      const hPass = getSafeH(['password']); if(hPass) newRow[hPass] = hashedPassword;
    } else {
      const hName = getSafeH(['name', 'username']); if(hName) newRow[hName] = userName;
      const hPhone = getSafeH(['contactnumber', 'phone']); if(hPhone) newRow[hPhone] = contact;
      const hEmail = getSafeH(['email', 'mailid']); if(hEmail) newRow[hEmail] = email;
      const hSit = getSafeH(['sittingbranch']); if(hSit) newRow[hSit] = sittingBranch;
      const hAss = getSafeH(['assignedbranches']); if(hAss) newRow[hAss] = assignedBranches;
      const hPass = getSafeH(['password']); if(hPass) newRow[hPass] = hashedPassword;
      const hRole = getSafeH(['role']); if(hRole) newRow[hRole] = role;
      const hCourse = getSafeH(['assignedcourses', 'course']); if(hCourse) newRow[hCourse] = course;
      const hAccess = getSafeH(['accesstype', 'access']); if(hAccess) newRow[hAccess] = access;
      const hStatus = getSafeH(['status']); if(hStatus) newRow[hStatus] = 'Active';
      const hCreated = getSafeH(['createdat']); if(hCreated) newRow[hCreated] = formatIndiaTimestamp();
    }

    // 🚨 SAVE THE NEW FIELDS SAFELY
    const hEmp = getSafeH(['empid', 'employeeid']); 
    if(hEmp && empId !== undefined) newRow[hEmp] = empId;
    
    const hTgt = getSafeH(['targetofthemonth', 'target']); 
    if(hTgt && target !== undefined) newRow[hTgt] = target;

    if (!getSafeH(['password'])) return res.status(500).json({ success: false, message: `The ${sheetName} sheet needs a Password column.` });
    await s.addRow(newRow);

    // 🚨 NEW: Sync to TPO_Stats if Target is updated
    if (target !== undefined && userName) {
      await syncTpoStats(userName, { 'Monthly Target': target });
    }

    await refreshCache();
    res.json({ success: true, message: "User added" });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

exports.updateAdminUser = async (req, res) => {
  try {
    const { sheet, rowNumber, userName, contact, email, sittingBranch, assignedBranches, role, course, access, empId, target } = req.body;
    const passwordToSet = typeof req.body.newPassword === 'string' ? req.body.newPassword : (typeof req.body.password === 'string' ? req.body.password : '');
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanSheet = String(sheet || '');
    const numericRowNumber = Number(rowNumber);
    if (!['Contact', 'User'].includes(cleanSheet) || !Number.isInteger(numericRowNumber) || numericRowNumber < 2) {
      return res.status(400).json({ success: false, message: 'Choose a valid employee account to update.' });
    }
    if (!String(userName || '').trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Enter the employee name and a valid login email.' });
    }
    if (passwordToSet) {
      const passwordError = validatePassword(passwordToSet);
      if (passwordError) return res.status(400).json({ success: false, message: passwordError });
    }
    const cache = getCache();
    const duplicateEmail = [...(cache?.contacts || []), ...(cache?.users || [])].some(row => {
      const rowSheet = row._worksheet?.title;
      return !(rowSheet === cleanSheet && Number(row.rowNumber) === numericRowNumber)
        && getValByHeader(row, ['email', 'mailid', 'mail']).toLowerCase() === cleanEmail;
    });
    if (duplicateEmail) return res.status(409).json({ success: false, message: 'Another account already uses this email address.' });

    await loadDocInfo();
    const s = doc.sheetsByTitle[cleanSheet];
    if (!s) return res.status(503).json({ success: false, message: `The ${cleanSheet} account sheet is unavailable.` });
    const rows = await s.getRows({ offset: numericRowNumber - 2, limit: 1 });
    
    if (rows.length > 0) {
      const h = s.headerValues || [];

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
      } else { 
        const hName = getSafeH(['name', 'username']); if(hName) updateObj[hName] = userName;
        const hPhone = getSafeH(['contactnumber', 'phone']); if(hPhone) updateObj[hPhone] = contact;
        const hEmail = getSafeH(['email', 'mailid']); if(hEmail) updateObj[hEmail] = email;
        const hSit = getSafeH(['sittingbranch']); if(hSit) updateObj[hSit] = sittingBranch;
        const hAss = getSafeH(['assignedbranches']); if(hAss) updateObj[hAss] = assignedBranches;
        const hRole = getSafeH(['role']); if(hRole) updateObj[hRole] = role;
        const hCourse = getSafeH(['assignedcourses', 'course']); if(hCourse) updateObj[hCourse] = course;
        const hAccess = getSafeH(['accesstype', 'access']); if(hAccess) updateObj[hAccess] = access;
        const hUpdated = getSafeH(['updatedat']); if(hUpdated) updateObj[hUpdated] = formatIndiaTimestamp();
      }

      // 🚨 UPDATE THE NEW FIELDS SAFELY
      const hEmp = getSafeH(['empid', 'employeeid']); 
      if(hEmp && empId !== undefined) updateObj[hEmp] = empId;
      
      const hTgt = getSafeH(['targetofthemonth', 'target']); 
      if(hTgt && target !== undefined) updateObj[hTgt] = target;

      if (passwordToSet) {
        const passwordHeader = getSafeH(['password']);
        if (!passwordHeader) return res.status(500).json({ success: false, message: `The ${cleanSheet} sheet needs a Password column.` });
        updateObj[passwordHeader] = await hashPassword(passwordToSet);
      }

      const previousEmail = getValByHeader(rows[0], ['email', 'mailid', 'mail']).toLowerCase();
      rows[0].assign(updateObj); 
      await rows[0].save(); 
      invalidateStaffAccountSessions(previousEmail);
      invalidateStaffAccountSessions(cleanEmail, rows[0]);

      // 🚨 NEW: Sync to TPO_Stats if Target is updated
      if (target !== undefined && userName) {
        await syncTpoStats(userName, { 'Monthly Target': target });
      }

      await refreshCache();
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
    const cleanSheet = String(sheet || '');
    const numericRowNumber = Number(rowNumber);
    if (!['Contact', 'User'].includes(cleanSheet) || !Number.isInteger(numericRowNumber) || numericRowNumber < 2) {
      return res.status(400).json({ success: false, message: 'Choose a valid employee account to remove.' });
    }
    await loadDocInfo();
    const targetSheet = doc.sheetsByTitle[cleanSheet];
    
    if (!targetSheet) {
      return res.status(404).json({ success: false, message: "Sheet not found" });
    }
    
    const rows = await targetSheet.getRows({ offset: numericRowNumber - 2, limit: 1 });
    
    if (rows.length > 0) { 
      invalidateStaffAccountSessions(getValByHeader(rows[0], ['email', 'mailid', 'mail']));
      await rows[0].delete(); 
      await refreshCache();
      res.json({ success: true, message: "User deleted" }); 
    } else { 
      res.status(404).json({ success: false, message: "User not found" }); 
    }
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

exports.updatePhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file provided." });
    const identity = String(req.portalUser?.email || '').trim().toLowerCase();
    if (!identity) return res.status(401).json({ success: false, message: 'Sign in again before updating your profile photo.' });
    const cache = getCache(); 
    const targetRow = getCurrentAccountRow(identity, cache);
    if (!targetRow) return res.status(404).json({ success: false, message: 'Your account could not be found.' });
    const photoLink = await uploadToDrive(req.file, FOLDER_CLIENT_LOGOS);

    const h = targetRow._worksheet.headerValues;
    let photoHeader = h.find(hd => hd.toLowerCase().includes('photo') || hd.toLowerCase().includes('profile'));
    if (!photoHeader) photoHeader = 'Profile_Photo_URL';

    targetRow.assign({ [photoHeader]: photoLink });
    await targetRow.save();
      
    await refreshCache();
    res.json({ success: true, photoUrl: photoLink });
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
    const canSeeAll = canManageEveryDrive(user);
    const isTpo = isPlacementTrackerTpo(user);
    const isBranchManager = isBranchManagerUser(user);
    const scope = String(req.query?.scope || '').toLowerCase();
    const branchScope = scope === 'branch';
    if (!canSeeAll && !isTpo && !isBranchManager) return res.status(403).json({ success: false, message: 'Placement drive tracking is not available for this role.' });

    let cache = getCache();
    if (!cache || !Array.isArray(cache.drives)) {
      await refreshCache();
      cache = getCache();
    }
    if (!cache || !Array.isArray(cache.drives)) return res.status(503).json({ success: false, message: 'Placement drive records are still syncing. Please retry shortly.' });
    const registrationRows = cache.drives;
    const eventRows = Array.isArray(cache.events) ? cache.events : [];
    const studentByRoll = new Map();
    const studentsByName = new Map();
    (cache.students || []).forEach(student => {
      const roll = normalizePlacementText(getValByHeader(student, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']));
      const name = normalizePlacementText(getValByHeader(student, ['studentname', 'name']));
      if (roll && !studentByRoll.has(roll)) studentByRoll.set(roll, student);
      if (name) studentsByName.set(name, [...(studentsByName.get(name) || []), student]);
    });
    const eventsMap = new Map();
    const eventInfos = [];
    
    // 1. SMART EVENT MAPPING: Grab ALL Placement Drives so even empty ones exist
    eventRows.forEach(row => {
       const type = getValByHeader(row, ['event', 'type', 'event_type']) || '';
       const identifiers = getPlacementDriveIdentifiers(row);
       if (identifiers.length && type.toLowerCase().includes('drive')) {
         const eventInfo = {
           driveId: getValByHeader(row, ['driveid', 'drivename']) || getValByHeader(row, ['title']) || getValByHeader(row, ['eventid']) || identifiers[0],
           tpo: getValByHeader(row, ['tpo', 'tponame', 'placementofficer']) || '',
           owner: getPlacementDriveOwner(row),
           ownedByUser: placementDriveOwnedByUser(row, user),
           date: getValByHeader(row, ['dateoftheevent', 'date']) || '', 
           location: getValByHeader(row, ['eventhappeningin', 'location']) || '',
           branch: getValByHeader(row, ['branch', 'sittingbranch']) || '',
           course: getValByHeader(row, ['course', 'assignedcourse']) || '',
           hasApplicants: false
         };
         eventInfos.push(eventInfo);
         identifiers.forEach(identifier => eventsMap.set(identifier, eventInfo));
       }
    });

    // 2. Map actual registrations
    const drivesData = [];
    (registrationRows || []).forEach(row => {
      const dId = getValByHeader(row, ['driveid', 'drivename', 'eventid']) || getValByHeader(row, ['companyname']) || '';
      const eventInfo = getPlacementDriveIdentifiers(row).map(identifier => eventsMap.get(identifier)).find(Boolean) || {};
      const studentName = getValByHeader(row, ['name', 'studentname']);
      const studentRoll = normalizePlacementText(getValByHeader(row, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']));
      const registrationStudent = (studentRoll && studentByRoll.get(studentRoll)) || (() => {
        const matches = studentsByName.get(normalizePlacementText(studentName)) || [];
        return matches.length === 1 ? matches[0] : null;
      })();
      const registrationOwner = getValByHeader(row, ['placementofficer', 'tponame', 'createdby', 'tpo']);
      const driveOwner = eventInfo.owner || eventInfo.tpo || registrationOwner || '';
      const rowBranch = getValByHeader(row, ['branch', 'sittingbranch']) || (registrationStudent && getValByHeader(registrationStudent, ['branch', 'sittingbranch'])) || eventInfo.branch;
      const rowCourse = getValByHeader(row, ['course']) || (registrationStudent && getValByHeader(registrationStudent, ['course', 'program'])) || eventInfo.course;
      const withinAssignedScope = hasPlacementBranchAccess(rowBranch, user);
      const belongsToOfficer = placementOwnerMatchesUser(driveOwner, user);
      if (!canSeeAll && (isTpo
        ? (branchScope ? !withinAssignedScope : !belongsToOfficer)
        : !withinAssignedScope)) return;
      // Mark that this drive has at least one student
      if (eventInfo.hasApplicants !== undefined) eventInfo.hasApplicants = true;

      drivesData.push({
        rowNumber: row.rowNumber,
        driveId: dId,
        name: studentName || (registrationStudent && getValByHeader(registrationStudent, ['studentname', 'name'])) || '',
        roll: getValByHeader(row, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']) || (registrationStudent && getValByHeader(registrationStudent, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll'])) || '',
        phone: getValByHeader(row, ['contact', 'phone', 'mobilenumber']) || (registrationStudent && getValByHeader(registrationStudent, ['contact', 'phone', 'mobilenumber'])) || '',
        email: getValByHeader(row, ['mailid', 'studentemail', 'email', 'mail']) || (registrationStudent && getValByHeader(registrationStudent, ['mailid', 'email', 'mail'])) || '',
        course: rowCourse || '',
        branch: rowBranch || '',
        resume: getValByHeader(row, ['resume', 'cv']) || (registrationStudent && getValByHeader(registrationStudent, ['resume', 'cv'])) || '',
        qual: getValByHeader(row, ['qualification', 'qual']) || (registrationStudent && getValByHeader(registrationStudent, ['qualification', 'qual'])) || '',
        regStatus: getValByHeader(row, ['status']) || '',
        regDate: getValByHeader(row, ['registeddate', 'timestamp', 'date']) || '',
        studentStatus: getValByHeader(row, ['studentstatus']) || '',
        remarks: getValByHeader(row, ['studentremarks', 'remarks', 'remark', 'tpo remarks']) || '',
        interviewDate: getValByHeader(row, ['interviewdate']) || '',
        interviewTime: getValByHeader(row, ['interviewtime', 'intervewtime']) || '',
        interviewVenue: getValByHeader(row, ['interviewvenue']) || '',
        statusHistory: (() => {
          const history = parsePlacementHistory(getValByHeader(row, ['statushistory']));
          if (history.length) return history;
          const status = getValByHeader(row, ['studentstatus']) || '';
          const remarks = getValByHeader(row, ['studentremarks', 'remarks', 'remark', 'tpo remarks']) || '';
          const interviewDate = getValByHeader(row, ['interviewdate']) || '';
          const interviewTime = getValByHeader(row, ['interviewtime', 'intervewtime']) || '';
          const interviewVenue = getValByHeader(row, ['interviewvenue']) || '';
          return status || remarks || interviewDate || interviewTime || interviewVenue
            ? [placementHistoryEntry({ status, remarks, interviewDate, interviewTime, interviewVenue, changedBy: driveOwner || 'Placement team', changedAt: getValByHeader(row, ['timestamp', 'registeddate', 'date']), event: 'Current record' })]
            : [];
        })(),
        driveTpo: driveOwner,
        driveDate: eventInfo.date || getValByHeader(row, ['dateofthedrive', 'drivedate', 'eventdate']) || '',
        driveLocation: eventInfo.location || getValByHeader(row, ['drivelocation', 'eventhappeningin', 'location']) || eventInfo.branch || ''
      });
    });

    // 3. 🚨 INJECT EMPTY DRIVES: If a drive has 0 students, send a "Dummy" row so it still shows up!
    eventInfos.forEach(eventInfo => {
      const withinAssignedScope = hasPlacementBranchAccess(eventInfo.branch, user);
      const ownedDrive = eventInfo.ownedByUser;
      if (branchScope) return;
      if (!canSeeAll && (isTpo ? !ownedDrive : !withinAssignedScope)) return;
      if (!eventInfo.hasApplicants) {
        drivesData.push({
          rowNumber: `empty-${normalizePlacementText(eventInfo.driveId)}`,
          driveId: eventInfo.driveId || '',
          name: 'NO_APPLICANTS',
          driveTpo: eventInfo.owner || eventInfo.tpo,
          driveDate: eventInfo.date,
          driveLocation: eventInfo.location || eventInfo.branch
        });
      }
    });
    
    res.json({ success: true, drives: drivesData.reverse(), lastSyncedAt: cache.cacheUpdatedAt || '' });
  } catch (err) { 
    res.status(500).json({ success: false, message: err.message }); 
  }
};

exports.updateDriveStatus = async (req, res) => {
  const { rowNumber, studentStatus, remarks, interviewDate, interviewTime, interviewVenue } = req.body;
  try {
    const numericRow = Number(rowNumber);
    const requestedDriveId = normalizePlacementText(req.body.driveId);
    const requestedRoll = normalizePlacementText(req.body.roll);
    const requestedName = normalizePlacementText(req.body.name);
    const requestedRegDate = normalizePlacementText(req.body.regDate);
    const hasRecordIdentity = Boolean(requestedDriveId && (requestedRoll || requestedName));
    if ((!Number.isInteger(numericRow) || numericRow < 2) && !hasRecordIdentity) return res.status(400).json({ success: false, message: 'A valid registration record is required.' });
    await loadDocInfo();
    const sheet = doc.sheetsByTitle['Drive_Registration'] || doc.sheetsByIndex.find(item => item.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes('driveregistration'));
    if (!sheet) return res.status(503).json({ success: false, message: 'The Drive Registration sheet is unavailable.' });
    await ensurePlacementHeaders(sheet, ['Student Status', 'Student Remarks', ...placementTrackingHeaders]);
    let rows;
    if (hasRecordIdentity) {
      const sheetRows = await sheet.getRows();
      const matchingRows = sheetRows.filter(row => {
        const driveId = normalizePlacementText(getValByHeader(row, ['driveid', 'drive id', 'drive_id', 'drivename', 'drive name']) || getValByHeader(row, ['eventid', 'event_id', 'companyname']));
        const roll = normalizePlacementText(getValByHeader(row, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']));
        const name = normalizePlacementText(getValByHeader(row, ['studentname', 'name']));
        return driveId === requestedDriveId
          && (requestedRoll ? roll === requestedRoll : name === requestedName);
      });
      const dateMatchedRows = requestedRegDate ? matchingRows.filter(row => normalizePlacementText(getValByHeader(row, ['registeddate', 'timestamp', 'date'])) === requestedRegDate) : [];
      const identityMatches = dateMatchedRows.length ? dateMatchedRows : matchingRows;
      const matchedRow = identityMatches.length === 1
        ? identityMatches[0]
        : identityMatches.find(row => Number(row.rowNumber) === numericRow) || null;
      if (identityMatches.length > 1 && !matchedRow) return res.status(409).json({ success: false, message: 'This drive registration matches multiple rows. Refresh the tracker and try again.' });
      rows = matchedRow ? [matchedRow] : [];
    } else {
      rows = await sheet.getRows({ offset: numericRow - 2, limit: 1 });
    }
    if (!rows.length) return res.status(404).json({ success: false, message: 'Registration row was not found.' });

    const user = req.portalUser;
    const canSeeAll = canManageEveryDrive(user);
    const isBranchManager = isBranchManagerUser(user);
    const isTpo = isPlacementTrackerTpo(user);
    if (!canSeeAll && !isTpo && !isBranchManager) return res.status(403).json({ success: false, message: 'Placement drive tracking is not available for this role.' });
    if (isTpo && !canSeeAll) {
      const matchingDrive = findPlacementDriveEvent(getCache()?.events || [], rows[0]);
      const registrationOwner = getValByHeader(rows[0], ['placementofficer', 'tponame', 'createdby', 'tpo']);
      const driveOwner = getPlacementDriveOwner(matchingDrive) || registrationOwner;
      if (!placementOwnerMatchesUser(driveOwner, user) && !placementOwnerMatchesUser(registrationOwner, user)) {
        return res.status(403).json({ success: false, message: 'You can update only registrations for your placement drives.' });
      }
    } else if (isBranchManager) {
      const matchingDrive = findPlacementDriveEvent(getCache()?.events || [], rows[0]);
      const studentName = getValByHeader(rows[0], ['name', 'studentname']);
      const studentRoll = normalizePlacementText(getValByHeader(rows[0], ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']));
      const registrationStudent = (getCache()?.students || []).find(student => {
        const sourceRoll = normalizePlacementText(getValByHeader(student, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']));
        const sourceName = normalizePlacementText(getValByHeader(student, ['name', 'studentname']));
        return (studentRoll && sourceRoll === studentRoll) || (studentName && sourceName === normalizePlacementText(studentName));
      });
      const registrationBranch = getValByHeader(rows[0], ['branch', 'sittingbranch']) || (registrationStudent && getValByHeader(registrationStudent, ['branch', 'sittingbranch'])) || getValByHeader(matchingDrive, ['branch', 'sittingbranch', 'eventhappeningin', 'location']);
      if (!hasPlacementBranchAccess(registrationBranch, user)) {
        return res.status(403).json({ success: false, message: 'This registration is outside your assigned branches.' });
      }
    } else if (!canSeeAll && !isTpo) {
      const registrationOwner = getValByHeader(rows[0], ['placementofficer', 'tponame', 'createdby', 'tpo']);
      if (registrationOwner && normalizePlacementText(registrationOwner) !== normalizePlacementText(user?.name)) {
        return res.status(403).json({ success: false, message: 'You can only update registrations for your own placement drives.' });
      }
      const matchingDrive = findPlacementDriveEvent(getCache()?.events || [], rows[0]);
      const driveOwner = getPlacementDriveOwner(matchingDrive);
      if (!registrationOwner && driveOwner && !placementOwnerMatchesUser(driveOwner, user)) {
        return res.status(403).json({ success: false, message: 'You can only update registrations for your own placement drives.' });
      }
      if (!isTpo && !registrationOwner && !driveOwner) {
        const registrationBranch = getValByHeader(rows[0], ['branch', 'sittingbranch']);
        const eventBranch = getValByHeader(matchingDrive, ['branch', 'sittingbranch', 'eventhappeningin', 'location']);
        if (!userHasBranch(user, registrationBranch || eventBranch)) {
          return res.status(403).json({ success: false, message: 'You can only update registrations for placement drives assigned to your branch.' });
        }
      }
    }

    const current = rows[0];
    const oldStatus = getValByHeader(current, ['studentstatus']);
    const oldRemarks = getValByHeader(current, ['studentremarks', 'remarks', 'remark', 'tpo remarks']);
    const oldInterviewDate = getValByHeader(current, ['interviewdate']);
    const oldInterviewTime = getValByHeader(current, ['interviewtime', 'intervewtime']);
    const oldInterviewVenue = getValByHeader(current, ['interviewvenue']);
    const cleanInterviewDate = interviewDate !== undefined ? formatIndiaDate(interviewDate) : undefined;
    const cleanInterviewTime = interviewTime !== undefined ? formatIndiaTime(interviewTime) : undefined;
    const nextStatus = studentStatus !== undefined ? studentStatus : oldStatus;
    const nextRemarks = remarks !== undefined ? remarks : oldRemarks;
    const nextInterviewDate = interviewDate !== undefined ? cleanInterviewDate : oldInterviewDate;
    const nextInterviewTime = interviewTime !== undefined ? cleanInterviewTime : oldInterviewTime;
    const nextInterviewVenue = interviewVenue !== undefined ? interviewVenue : oldInterviewVenue;
    const headers = sheet.headerValues || [];
    const findHeader = aliases => findPlacementHeader(headers, aliases);
    const update = {};
    if (studentStatus !== undefined) update[findHeader(['studentstatus'])] = studentStatus;
    if (remarks !== undefined) update[findHeader(['studentremarks', 'tpo remarks', 'remarks', 'remark'])] = remarks;
    if (interviewDate !== undefined) update[findHeader(['interviewdate'])] = cleanInterviewDate;
    if (interviewTime !== undefined) update[findHeader(['interviewtime'])] = cleanInterviewTime;
    if (interviewVenue !== undefined) update[findHeader(['interviewvenue'])] = interviewVenue;
    if (!Object.keys(update).length) return res.status(400).json({ success: false, message: 'There are no placement drive changes to save.' });

    const changedAt = formatIndiaTimestamp();
    const nextHistory = appendPlacementHistory({ row: current, oldStatus, status: nextStatus, oldRemarks, remarks: nextRemarks, oldInterviewDate, interviewDate: nextInterviewDate, oldInterviewTime, interviewTime: nextInterviewTime, oldInterviewVenue, interviewVenue: nextInterviewVenue, changedBy: user?.name || 'Placement team', changedAt });
    update[findHeader(['statushistory'])] = JSON.stringify(nextHistory);

    current.assign(update);
    await current.save();

    const studentRoll = getValByHeader(current, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']);
    const studentName = getValByHeader(current, ['name', 'studentname']);
    const student = (getCache()?.students || []).find(row => {
      const rowRoll = normalizePlacementText(getValByHeader(row, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']));
      return studentRoll ? rowRoll === normalizePlacementText(studentRoll) : normalizePlacementText(getValByHeader(row, ['name', 'studentname'])) === normalizePlacementText(studentName);
    });
    const placedSheetWarning = await syncPositivePlacement({
      name: studentName || getValByHeader(student, ['studentname', 'name']),
      phone: getValByHeader(current, ['contact', 'phone']) || getValByHeader(student, ['contact', 'phone']),
      email: getValByHeader(current, ['mailid', 'email']) || getValByHeader(student, ['mailid', 'email']),
      roll: studentRoll || getValByHeader(student, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']),
      course: getValByHeader(current, ['course']) || getValByHeader(student, ['course']),
      branch: getValByHeader(current, ['branch', 'sittingbranch']) || getValByHeader(student, ['branch', 'sittingbranch']),
      qual: getValByHeader(current, ['qualification', 'qual']) || getValByHeader(student, ['qualification', 'qual']),
      resume: getValByHeader(current, ['resume', 'cv']) || getValByHeader(student, ['resume', 'cv']),
      jobId: `DRIVE - ${getValByHeader(current, ['driveid', 'drivename', 'eventid', 'companyname'])}`,
      company: getValByHeader(current, ['companyname', 'company', 'driveid', 'drivename']),
      position: getValByHeader(current, ['position', 'role']) || 'Placement drive participant',
      placementOfficer: getValByHeader(current, ['placementofficer', 'tpo', 'tponame']) || getPlacementDriveOwner(findPlacementDriveEvent(getCache()?.events || [], current)) || user?.name || user?.email || '',
      status: nextStatus, joiningStatus: getValByHeader(current, ['joiningstatus']), remarks: nextRemarks,
      datePlaced: getValByHeader(current, ['dateplaced']), packageLpa: getValByHeader(current, ['package']),
      interviewDate: nextInterviewDate, interviewTime: nextInterviewTime, interviewVenue: nextInterviewVenue,
      statusHistory: JSON.stringify(nextHistory), entrySource: 'Placement Drive'
    });

    const actionChanges = [];
    const recordActionChange = (label, before, after, wasProvided = true) => {
      if (!wasProvided || String(before ?? '').trim() === String(after ?? '').trim()) return;
      actionChanges.push(`${label}: ${String(before || '—').trim()} → ${String(after || '—').trim()}`);
    };
    recordActionChange('Status', oldStatus, nextStatus, studentStatus !== undefined);
    recordActionChange('Remarks', oldRemarks, nextRemarks, remarks !== undefined);
    recordActionChange('Interview date', oldInterviewDate, nextInterviewDate, interviewDate !== undefined);
    recordActionChange('Interview time', oldInterviewTime, nextInterviewTime, interviewTime !== undefined);
    recordActionChange('Interview venue', oldInterviewVenue, nextInterviewVenue, interviewVenue !== undefined);
    let actionLogWarning = '';
    if (actionChanges.length) {
      try {
        const studentRoll = getValByHeader(current, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']);
        const studentName = getValByHeader(current, ['name', 'studentname']);
        const student = (getCache()?.students || []).find(row => {
          const rowRoll = normalizePlacementText(getValByHeader(row, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']));
          const rowName = normalizePlacementText(getValByHeader(row, ['name', 'studentname']));
          return (studentRoll && rowRoll === normalizePlacementText(studentRoll)) || (studentName && rowName === normalizePlacementText(studentName));
        });
        const driveName = getValByHeader(current, ['driveid', 'drive id', 'eventid', 'event_id', 'companyname']) || 'Placement Drive';
        const actionHistory = nextHistory[nextHistory.length - 1];
        await appendTpoActionLog({
          changedAt, changedBy: user?.name || getValByHeader(current, ['placementofficer', 'tpo', 'tponame']),
          studentName, studentContact: getValByHeader(current, ['contact', 'phone']) || getValByHeader(student, ['contact', 'phone']),
          studentEmail: getValByHeader(current, ['mailid', 'email']) || getValByHeader(student, ['mailid', 'email']),
          studentRoll, course: getValByHeader(current, ['course']) || getValByHeader(student, ['course']),
          branch: getValByHeader(current, ['branch', 'sittingbranch']) || getValByHeader(student, ['branch', 'sittingbranch']),
          qualification: getValByHeader(current, ['qualification', 'qual']) || getValByHeader(student, ['qualification', 'qual']),
          resume: getValByHeader(current, ['resume', 'cv']) || getValByHeader(student, ['resume', 'cv']),
          jobId: `DRIVE - ${driveName}`, company: driveName,
          position: getValByHeader(current, ['position', 'role']) || 'Placement drive participant',
          status: nextStatus, remarks: nextRemarks, interviewDate: nextInterviewDate,
          interviewTime: nextInterviewTime, interviewVenue: nextInterviewVenue,
          entrySource: 'Placement Drive', actionType: actionChanges.map(change => change.split(':')[0]).join(', '),
          actionDetails: actionChanges.join('\n'), historyEntry: actionHistory
        });
      } catch (error) {
        console.error('Placement drive action audit failed:', error.message);
        actionLogWarning = `The update was saved, but its action could not be appended to TPO_Log: ${error.message}`;
      }
    }

    const interviewDetailsChanged = String(oldInterviewDate || '') !== String(nextInterviewDate || '') || String(oldInterviewTime || '') !== String(nextInterviewTime || '') || String(oldInterviewVenue || '') !== String(nextInterviewVenue || '');
    let emailWarning = '';
    if (String(nextStatus || '').toLowerCase() !== String(oldStatus || '').toLowerCase() || (String(nextStatus || '').toLowerCase() === 'interview scheduled' && interviewDetailsChanged)) {
      const studentRoll = getValByHeader(current, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']) || '';
      const studentName = getValByHeader(current, ['name', 'studentname']) || '';
      const student = (getCache()?.students || []).find(row => {
        const rowRoll = normalizePlacementText(getValByHeader(row, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']));
        const rowName = normalizePlacementText(getValByHeader(row, ['name', 'studentname']));
        return (studentRoll && rowRoll === normalizePlacementText(studentRoll)) || (studentName && rowName === normalizePlacementText(studentName));
      });
      const studentEmail = getValByHeader(current, ['mailid', 'email']) || getValByHeader(student, ['mailid', 'email']) || '';
      if (studentEmail) {
        try {
          await checkAndSendStudentMails({ name: studentName || getValByHeader(student, ['name', 'studentname']), roll: studentRoll, email: studentEmail, company: getValByHeader(current, ['companyname', 'company', 'driveid']) || 'Placement Drive', position: getValByHeader(current, ['position', 'role']) || 'Placement Drive', jobId: getValByHeader(current, ['jobid', 'driveid']), branch: getValByHeader(current, ['branch', 'sittingbranch']), tpoName: getValByHeader(current, ['placementofficer', 'tpo']) || user?.name }, nextStatus, { date: nextInterviewDate, time: nextInterviewTime, venue: nextInterviewVenue }, user?.email || '');
        } catch (error) { emailWarning = `Saved, but the student email could not be sent: ${error.message}`; }
      } else if (String(nextStatus || '').toLowerCase() === 'interview scheduled') emailWarning = 'Interview details were saved, but this student has no email address on file.';
    }
    refreshCache();
    res.json({ success: true, studentStatus: nextStatus, remarks: nextRemarks, interviewDate: nextInterviewDate, interviewTime: nextInterviewTime, interviewVenue: nextInterviewVenue, statusHistory: nextHistory, warning: [emailWarning, actionLogWarning, placedSheetWarning].filter(Boolean).join(' ') });
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
        email: getValByHeader(row, ['email', 'branchemail', 'mailid']) || '',
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
    const { no, region, branch, email, latitude, longitude } = req.body;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) return res.status(400).json({ success: false, message: 'Enter a valid branch email address.' });
    if (latitude !== '' && latitude !== undefined && (!Number.isFinite(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90)) return res.status(400).json({ success: false, message: 'Latitude must be between -90 and 90.' });
    if (longitude !== '' && longitude !== undefined && (!Number.isFinite(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180)) return res.status(400).json({ success: false, message: 'Longitude must be between -180 and 180.' });
    const sheet = doc.sheetsByTitle["Branches"];
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    await sheet.loadHeaderRow();
    let headers = sheet.headerValues || [];
    const normalized = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const find = names => headers.find(header => names.includes(normalized(header)));
    if (!find(['latitude', 'lat']) || !find(['longitude', 'long', 'lng', 'lon']) || !find(['email', 'branchemail', 'mailid'])) {
      headers = [...headers];
      if (!find(['latitude', 'lat'])) headers.push('Latitude');
      if (!find(['longitude', 'long', 'lng', 'lon'])) headers.push('Longitude');
      if (!find(['email', 'branchemail', 'mailid'])) headers.push('Email');
      await sheet.setHeaderRow(headers);
      await sheet.loadHeaderRow();
      headers = [...(sheet.headerValues || [])];
    }
    const header = names => headers.find(value => names.includes(normalized(value)));
    const newRow = {
      [header(['no', 'number', 'index']) || headers[0]]: no,
      [header(['regionstate', 'region', 'state']) || headers[1]]: region,
      [header(['branch', 'branchname', 'branchlocation']) || headers[2]]: branch,
      [header(['latitude', 'lat'])]: latitude || '',
      [header(['longitude', 'long', 'lng', 'lon'])]: longitude || '',
      [header(['email', 'branchemail', 'mailid'])]: email || ''
    };
    await sheet.addRow(newRow);
    refreshCache(); res.json({ success: true, message: "Branch saved" });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
};

exports.updateBranch = async (req, res) => {
  try {
    const { oldBranch, no, region, branch, email, latitude, longitude } = req.body;
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) return res.status(400).json({ success: false, message: 'Enter a valid branch email address.' });
    if (latitude !== '' && latitude !== undefined && (!Number.isFinite(Number(latitude)) || Number(latitude) < -90 || Number(latitude) > 90)) return res.status(400).json({ success: false, message: 'Latitude must be between -90 and 90.' });
    if (longitude !== '' && longitude !== undefined && (!Number.isFinite(Number(longitude)) || Number(longitude) < -180 || Number(longitude) > 180)) return res.status(400).json({ success: false, message: 'Longitude must be between -180 and 180.' });
    const sheet = doc.sheetsByTitle["Branches"];
    if (!sheet) return res.status(404).json({ success: false, message: "Sheet not found" });
    await sheet.loadHeaderRow();
    let headers = sheet.headerValues || [];
    const normalized = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const find = names => headers.find(header => names.includes(normalized(header)));
    if (!find(['latitude', 'lat']) || !find(['longitude', 'long', 'lng', 'lon']) || !find(['email', 'branchemail', 'mailid'])) {
      headers = [...headers];
      if (!find(['latitude', 'lat'])) headers.push('Latitude');
      if (!find(['longitude', 'long', 'lng', 'lon'])) headers.push('Longitude');
      if (!find(['email', 'branchemail', 'mailid'])) headers.push('Email');
      await sheet.setHeaderRow(headers);
      await sheet.loadHeaderRow();
      headers = [...(sheet.headerValues || [])];
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
      rowToUpdate.set(header(['email', 'branchemail', 'mailid']), email || '');
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
    const sheet = doc.sheetsByTitle['Trainer/TL_Log'] || doc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '') === 'trainertllog');
    if (!sheet) return res.status(404).json({ success: false, message: "Trainer Log sheet missing." });
    const h = sheet.headerValues;
    
    await sheet.addRow({
      [getFuzzyHeader(h, 'timestamp')]: formatIndiaTimestamp(),
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
    const sheet = doc.sheetsByTitle['Trainer/TL_Log'] || doc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '') === 'trainertllog');
    if (!sheet) return res.status(404).json({ success: false, message: 'Trainer Log sheet missing.' });
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

  const user = exports.getSessionUser(email, sessionToken);
  if (!user) return res.json({ valid: false, reason: 'SESSION_EXPIRED', message: 'Your session expired. Please sign in again.' });
  return res.json({ valid: true, expiresIn: SESSION_TOKEN_TTL_MS });
};

exports.getSessionUser = (email, sessionToken) => {
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !sessionToken) return null;

  const row = getCurrentAccountRow(cleanEmail);
  if (!row || !isAccountEnabled(row)) return null;
  const currentVersion = getAccountVersion(accountAuthState(row));
  const expectedVersion = invalidatedAccountVersions.has(cleanEmail)
    ? invalidatedAccountVersions.get(cleanEmail)
    : currentVersion;
  if (!expectedVersion || expectedVersion !== currentVersion) return null;
  return readPortalSessionToken(cleanEmail, sessionToken, expectedVersion);
};

// =========================================================
// 🚨 SUBMIT TPO ACTIVITY STATS
// =========================================================
exports.updateTpoActivity = async (req, res) => {
  const { companiesVisited, branchVideos, branchPosters } = req.body;
  const tpoName = String(req.portalUser?.name || '').trim();
  if (!tpoName) return res.status(401).json({ success: false, message: 'Sign in again before submitting activity.' });
  const values = [companiesVisited, branchVideos, branchPosters];
  if (values.some(value => value === undefined || value === null || value === '' || !Number.isFinite(Number(value)) || Number(value) < 0)) {
    return res.status(400).json({ success: false, message: 'Enter a zero or positive number for each activity count.' });
  }
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
