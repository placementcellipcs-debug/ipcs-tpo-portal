require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const cron = require('node-cron');
const { getRole, hasRoleToken, isPortalAdmin, getPolicyDenial } = require('./src/rolePolicy');

// 🚨 IMPORT CONTROLLERS EXACTLY ONCE
const controllers = require('./src/controllers');
const assetControllers = require('./src/assetControllers');
const careerHubControllers = require('./src/careerHubControllers');

// 🚨 IMPORT CACHES EXACTLY ONCE
const {
  getCache,
  waitForCacheReady,
  startEmailWorker,
  startMailDashboardRefresh,
  sendScheduledMailReport
} = require('./src/config');
const { isAssetCacheReady } = require('./src/assetConfig');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

const loginAttempts = new Map();
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const loginRateLimit = (req, res, next) => {
  const now = Date.now();
  const identity = String(req.body?.email || '').trim().toLowerCase().slice(0, 254);
  const address = String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 100);
  const key = `${address}:${identity}`;
  const previous = loginAttempts.get(key);
  if (!previous || previous.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    res.on('finish', () => { if (res.statusCode >= 200 && res.statusCode < 300) loginAttempts.delete(key); });
    return next();
  }
  if (previous.count >= LOGIN_MAX_ATTEMPTS) {
    res.set('Retry-After', String(Math.max(1, Math.ceil((previous.resetAt - now) / 1000))));
    return res.status(429).json({ success: false, message: 'Too many sign-in attempts. Wait a little and try again.' });
  }
  previous.count += 1;
  res.on('finish', () => { if (res.statusCode >= 200 && res.statusCode < 300) loginAttempts.delete(key); });
  next();
};
const loginRateLimitCleanup = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of loginAttempts) if (entry.resetAt <= now) loginAttempts.delete(key);
}, 5 * 60 * 1000);
loginRateLimitCleanup.unref?.();

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (req.secure) res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  next();
});

// 🚨 DYNAMIC CORS CONFIGURATION
const allowedOrigins = [
  'https://placement.ipcstalenzo.com',
  'https://talenzo.ipcsglobal.info',
  'https://api-talenzo.ipcsglobal.info',
  'https://ipcs-tpo-portal.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'capacitor://localhost'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    } else {
      return callback(new Error('Blocked by CORS'));
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'Range', 'x-ipcs-email', 'x-ipcs-session-token'],
  exposedHeaders: ['Accept-Ranges', 'Content-Range', 'Content-Length']
}));

app.use(express.json());
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });
const vacancyLogoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }).single('companyLogo');
const parseVacancyLogo = (req, res, next) => vacancyLogoUpload(req, res, error => {
  if (error) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ success: false, message: status === 413 ? 'The company logo must be 10 MB or smaller.' : error.message });
  }
  next();
});

// ---------------------------------------------------------
// AUTHENTICATION ROUTES
// ---------------------------------------------------------
app.post('/api/auth/login', loginRateLimit, controllers.login);
app.post('/api/auth/verify-session', controllers.verifySession);

// 🚨 GLOBAL CACHE MIDDLEWARE
app.use('/api', async (req, res, next) => {
  // Public site data has its own Drive/Sheets readiness checks. Keep it available
  // while the larger staff data cache is warming up after a server restart.
  if (req.originalUrl.split('?')[0].startsWith('/api/public/')) return next();
  let cache = getCache();
  if (!cache?.cacheUpdatedAt) {
    await waitForCacheReady();
    cache = getCache();
  }
  if (!cache?.cacheUpdatedAt) {
    res.set('Retry-After', '5');
    return res.status(503).json({ success: false, message: 'Portal data is still syncing from Google Sheets. Please try again shortly.' });
  }
  if (req.path.startsWith('/v1/assets') && !isAssetCacheReady()) {
    return res.status(503).json({ success: false, message: "Asset data is still loading from Google Sheets. Please try again shortly." });
  }
  next();
});

const requireSession = (policy = 'portal') => (req, res, next) => {
  const user = controllers.getSessionUser(req.get('x-ipcs-email'), req.get('x-ipcs-session-token'));
  if (!user) return res.status(401).json({ success: false, message: 'Sign in again to continue.' });
  const denial = getPolicyDenial(user, { policy, method: req.method, path: req.path, baseUrl: req.baseUrl });
  if (denial) return res.status(denial.status).json({ success: false, message: denial.message });
  const role = getRole(user);
  const isAdmin = isPortalAdmin(user);
  req.portalUser = user;
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    req.body = { ...req.body, actorName: user.name, userEmail: user.email, currentUserEmail: user.email };
    if (req.baseUrl.startsWith('/api/tpo/')) {
      req.body = { ...req.body, userName: user.name, assignedBranchesArray: user.assignedBranchesArray, role: user.role, assignedCourse: user.assignedCourse, department: user.department };
    }
    if (req.baseUrl === '/api/tpo/clients') {
      const canSeeAll = isAdmin || role.includes('MANAGER') || role === 'BM' || role.includes('BRANCH MANAGER');
      req.body = { ...req.body, tpoName: canSeeAll ? '' : user.name };
    }
  }
  next();
};

// Designer accounts have a restricted workspace. Enforce it at the API layer as
// well as in navigation so hidden modules cannot be reached through direct requests.
app.use('/api', (req, res, next) => {
  const user = controllers.getSessionUser(req.get('x-ipcs-email'), req.get('x-ipcs-session-token'));
  if (!user) return next(); // Preserve public endpoints and their existing auth behavior.
  const role = getRole(user);
  const isDesigner = ['DESIGN', 'MEDIA', 'CREATIVE'].some(part => role.includes(part));
  if (!isDesigner || isPortalAdmin(user)) return next();

  const path = String(req.originalUrl || '').split('?')[0].toLowerCase();
  const allowedPublicRead = req.method === 'GET' && path.startsWith('/api/public/');
  const allowedCareerFeed = req.method === 'GET' && path === '/api/career-hub';
  const allowedEvents = req.method === 'GET' && path === '/api/tpo/events';
  const allowedDesignStudio = path === '/api/design' || path.startsWith('/api/design/');
  if (allowedPublicRead || allowedCareerFeed || allowedEvents || allowedDesignStudio) return next();
  return res.status(403).json({ success: false, message: 'This module is not available for the Designer workspace.' });
});

app.get('/api/career-hub', requireSession('portal'), careerHubControllers.getCareerFeed);
app.get('/api/courses', requireSession('portal'), controllers.getCourses);
app.use('/api/v1/assets', requireSession('assets'));
app.use('/api/design', requireSession('design'));
app.use('/api/academic', requireSession('academic'));
app.use('/api/tpo/students', requireSession('portal'));
app.use('/api/tpo/dashboard-stats', requireSession('portal'));
app.use('/api/tpo/applications', requireSession('portal'));
app.use('/api/tpo/reports', requireSession('portal'));
app.use('/api/tpo/talentino', requireSession('portal'));
app.use('/api/tpo/issues', requireSession('portal'));
app.use('/api/tpo/vacancies', requireSession('portal'));
app.use('/api/tpo/clients', (req, res, next) => {
  if (req.method === 'GET' && /^\/\d+$/.test(req.path)) return requireSession('clients')(req, res, next);
  if (req.method === 'POST' && req.path === '/submit-mou') return next();
  return requireSession('clients')(req, res, next);
});

// ---------------------------------------------------------
// TPO & PLACEMENT ROUTES
// ---------------------------------------------------------
app.post('/api/tpo/dashboard-stats', controllers.getDashboardStats);
app.post('/api/tpo/students', controllers.getStudents);
app.post('/api/tpo/students/update-student', controllers.updateStudent);
app.post('/api/tpo/applications', controllers.getApplications);
app.post('/api/tpo/applications/update', upload.single('offerLetterFile'), controllers.updateApplication);
app.post('/api/tpo/applications/update-log', upload.single('offerLetterFile'), controllers.updatePlacementLog);
app.post('/api/tpo/applications/add', upload.single('offerLetterFile'), controllers.addApplication);
app.post('/api/tpo/applications/direct-interview', controllers.addDirectInterview);
app.post('/api/tpo/applications/email-student', controllers.emailStudent);
app.get('/api/tpo/vacancies', controllers.getVacancies);
app.get('/api/tpo/vacancies/form-options', requireSession('vacancies-write'), controllers.getVacancyFormOptions);
app.post('/api/tpo/vacancies/add', requireSession('vacancies-write'), parseVacancyLogo, controllers.addVacancy);
app.put('/api/tpo/vacancies/:jobId', requireSession('vacancies-write'), parseVacancyLogo, controllers.updateVacancy);
app.delete('/api/tpo/vacancies/:jobId', requireSession('vacancies-write'), controllers.deleteVacancy);
app.get('/api/tpo/events', requireSession('portal'), controllers.getEvents);
app.get('/api/tpo/branches', requireSession('events-write'), controllers.getBranches);
app.post('/api/tpo/events/add', requireSession('events-write'), upload.single('posterFile'), controllers.addEvent);
app.post('/api/tpo/events/:eventKey/cancel', requireSession('events-write'), controllers.cancelEvent);
app.post('/api/tpo/events/:eventKey/reschedule', requireSession('events-write'), controllers.rescheduleEvent);
app.post('/api/tpo/issues', controllers.getIssues);
app.post('/api/tpo/issues/update', controllers.updateIssue);
app.post('/api/tpo/reports', controllers.getReports);
app.post('/api/tpo/talentino', controllers.getTalentino);
app.post('/api/tpo/clients', controllers.getClients);
app.get('/api/public/partners', controllers.getPublicPartners);
app.get('/api/public/placement-team', controllers.getPublicPlacementTeam);
app.get('/api/public/openings', controllers.getPublicOpenings);
app.post('/api/public/corporate-training-inquiries', controllers.submitCorporateTrainingInquiry);
app.post('/api/public/hiring-inquiries', controllers.submitHiringInquiry);
app.get('/api/placement/hiring-inquiries', requireSession('hiring-inquiries'), controllers.getHiringInquiries);
app.get('/api/placement/hiring-inquiries/tpos', requireSession('hiring-inquiries'), controllers.getHiringInquiryTpos);
app.post('/api/placement/hiring-inquiries/assign', requireSession('hiring-inquiries'), controllers.assignHiringInquiry);
app.get('/api/public/mou/:token', controllers.getMouByToken);
app.get('/api/public/placement-posters', controllers.getPublicPlacementPosters);
app.get('/api/public/placement-posters/:fileId', controllers.streamPublicPlacementPoster);
app.get('/api/public/team-photos', controllers.getPublicTeamPhotos);
app.get('/api/public/team-photos/:fileId', controllers.streamPublicTeamPhoto);
app.get('/api/public/magazines', controllers.getPublicMagazines);
app.get('/api/tpo/clients/:id', controllers.getClientById);
app.post('/api/tpo/clients/update', upload.single('logoFile'), controllers.updateClient);
app.post('/api/tpo/clients/request-mou', controllers.requestMou);
app.post('/api/tpo/clients/submit-mou', upload.any(), controllers.submitMou);
app.post('/api/tpo/clients/add', upload.single('logoFile'), controllers.addClient);
app.post('/api/tpo/profile/update-photo', requireSession('portal'), upload.single('photo'), controllers.updatePhoto);
app.get('/api/tpo/drives', requireSession('placement-drive'), controllers.getDrives);
app.post('/api/tpo/drives/update', requireSession('placement-drive'), controllers.updateDriveStatus);
app.get('/api/tpo/trigger-resumes', requireSession('portal'), controllers.triggerDailyCron);

// 🚨 INSTANT TEST ROUTE: Trigger both daily tasks manually anytime
app.get('/api/tpo/test-daily-mail', requireSession('portal'), controllers.triggerDailyCron);

// ---------------------------------------------------------
// ADMIN ROUTES
// ---------------------------------------------------------
app.use('/api/admin', requireSession('portal-admin'));
app.get('/api/admin/users', controllers.getAdminUsers);
app.post('/api/admin/users/add', controllers.addAdminUser);
app.post('/api/admin/users/update', controllers.updateAdminUser);
app.post('/api/admin/users/delete', controllers.deleteAdminUser);
app.get('/api/admin/courses', controllers.getCourses);
app.post('/api/admin/courses/add', controllers.addCourse);
app.post('/api/admin/courses/delete', controllers.deleteCourse); 
app.get('/api/admin/security-logs', controllers.getSecurityLogs);
app.get('/api/admin/corporate-training-inquiries', controllers.getCorporateTrainingInquiries);
app.post('/api/admin/corporate-training-inquiries/assign', controllers.assignCorporateTrainingInquiry);
app.get('/api/admin/branches', controllers.getBranches);
app.post('/api/admin/branches/add', controllers.addBranch);
app.post('/api/admin/branches/update', controllers.updateBranch); 
app.post('/api/admin/branches/delete', controllers.deleteBranch);
app.get('/api/admin/trainer-logs', controllers.getTrainerLogs);
app.post('/api/admin/trainer-logs/add', controllers.addTrainerLog);
app.post('/api/admin/trainer-logs/update', controllers.updateTrainerLog);

// ---------------------------------------------------------
// STUDY MATERIAL & EXAMS ROUTES
// ---------------------------------------------------------
app.use('/api/lms/materials', requireSession('learning'));
app.get('/api/lms/materials', controllers.getMaterials);
app.get('/api/lms/materials/:materialId/view', controllers.getMaterialViewLink);
app.post('/api/lms/materials/add', requireSession('learning-write'), controllers.addMaterial);
app.post('/api/lms/materials/update', requireSession('learning-write'), controllers.updateMaterial);
app.post('/api/lms/materials/delete', requireSession('learning-write'), controllers.deleteMaterial);
app.use('/api/exams', requireSession('exams'));
app.use('/api/aptitude', requireSession('exams'));
app.get('/api/exams/questions', controllers.getQuestions);
app.post('/api/exams/questions/add', requireSession('exam-manager'), controllers.addQuestion);
app.post('/api/exams/questions/update', requireSession('exam-manager'), controllers.updateQuestion);
app.post('/api/exams/questions/delete', requireSession('exam-manager'), controllers.deleteQuestion);
app.get('/api/exams/results', controllers.getResults);
app.get('/api/aptitude/questions', controllers.getAptQuestions);
app.get('/api/aptitude/results', controllers.getAptResults);
app.post('/api/aptitude/questions/add', requireSession('portal-admin'), controllers.addAptQuestion);
app.post('/api/aptitude/questions/update', requireSession('portal-admin'), controllers.updateAptQuestion);
app.post('/api/aptitude/questions/delete', requireSession('portal-admin'), controllers.deleteAptQuestion);
app.use('/api/talentino-exams', (req, res, next) => requireSession('exams')(req, res, () => {
  if (hasRoleToken(getRole(req.portalUser), 'RTH') || getRole(req.portalUser).includes('REGIONAL TECHNICAL HEAD')) {
    return res.status(403).json({ success: false, message: 'Talentino assessments are not available in the Regional Technical Head Exams Hub.' });
  }
  next();
}));
app.get('/api/talentino-exams/questions', controllers.getTalExamQuestions);
app.get('/api/talentino-exams/results', controllers.getTalExamResults);
app.post('/api/talentino-exams/questions/add', requireSession('portal-admin'), controllers.addTalExamQuestion);
app.post('/api/talentino-exams/questions/update', requireSession('portal-admin'), controllers.updateTalExamQuestion);
app.post('/api/talentino-exams/questions/delete', requireSession('portal-admin'), controllers.deleteTalExamQuestion);
app.post('/api/tpo/activity', requireSession('portal'), controllers.updateTpoActivity);

// ---------------------------------------------------------
// 🚨 ASSET MANAGEMENT (ERP) ROUTES
// ---------------------------------------------------------
app.get('/api/v1/assets/form-data', assetControllers.getRegistrationData);
app.post('/api/v1/assets/add', requireSession('asset-admin'), upload.single('photo'), assetControllers.addAsset);
app.get('/api/v1/assets', assetControllers.getAssets);
app.get('/api/v1/assets/:assetId/details', assetControllers.getAssetDetails);
app.post('/api/v1/assets/assign', requireSession('asset-admin'), upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'returnPhoto', maxCount: 1 }]), assetControllers.assignAsset);
app.post('/api/v1/assets/return', requireSession('asset-admin'), upload.single('photo'), assetControllers.returnAsset);
app.get('/api/v1/assets/dashboard', assetControllers.getAssetDashboardStats);

// 🚨 INVENTORY, TRANSFERS, AND MAINTENANCE ROUTES
app.get('/api/v1/assets/inventory', assetControllers.getInventory);
app.post('/api/v1/assets/inventory/add', assetControllers.addInventory);
app.post('/api/v1/assets/inventory/stock', assetControllers.updateStock);

app.get('/api/v1/assets/transfers', assetControllers.getTransfers);
app.post('/api/v1/assets/transfers/request', assetControllers.requestTransfer);
app.post('/api/v1/assets/transfers/approve', requireSession('portal-admin'), assetControllers.approveTransfer);
app.post('/api/v1/assets/transfers/receive', assetControllers.receiveTransfer);

app.get('/api/v1/assets/maintenance', assetControllers.getMaintenance);
app.post('/api/v1/assets/maintenance/report', assetControllers.reportMaintenance);
app.post('/api/v1/assets/maintenance/resolve', assetControllers.resolveMaintenance);

// 🚨 SYSTEM CONFIGURATION ROUTES (CATEGORIES, LOCATIONS, VENDORS)
app.post('/api/v1/assets/config/category', requireSession('asset-admin'), assetControllers.addCategory);
app.post('/api/v1/assets/config/subcategory', requireSession('asset-admin'), assetControllers.addSubcategory);
app.post('/api/v1/assets/config/location', requireSession('asset-admin'), assetControllers.addLocation);
app.post('/api/v1/assets/config/vendor', requireSession('asset-admin'), assetControllers.addVendor);

// 🚨 ASSET DOCUMENTS & DISPOSAL
app.post('/api/v1/assets/documents/upload', upload.single('file'), assetControllers.uploadAssetDocument);
app.post('/api/v1/assets/dispose', requireSession('asset-admin'), assetControllers.disposeAsset);

// ---------------------------------------------------------
// CREATIVE & DESIGN MANAGEMENT 
// ---------------------------------------------------------

const designControllers = require('./src/designControllers');

app.get('/api/design/tasks', designControllers.getDesignDashboardData);
app.post('/api/design/upload', upload.single('file'), designControllers.uploadDesignFile);
app.post('/api/design/social', designControllers.trackSocialMedia);
app.post('/api/design/sync-existing', designControllers.syncExistingPlacements);
// 🚨 ADD THESE TWO NEW ROUTES:
app.post('/api/design/category', designControllers.addDesignCategory);
app.post('/api/design/task', designControllers.createManualTask);

// ---------------------------------------------------------
// ACADEMIC & TRAINING ROUTES 
// ---------------------------------------------------------

const academicControllers = require('./src/academicControllers');

app.get('/api/academic/training', academicControllers.getTrainingData);
app.get('/api/academic/data', academicControllers.getAcademicData);
app.post('/api/academic/training/add', academicControllers.addTraining);
app.post('/api/academic/training/update', academicControllers.updateTraining);
app.post('/api/academic/batches/add', academicControllers.addBatch);
app.post('/api/academic/batches/update', academicControllers.updateBatch);
app.post('/api/academic/sessions/add', academicControllers.addSession);
app.post('/api/academic/attendance/update', academicControllers.updateAttendance);
app.post('/api/academic/leaves/review', academicControllers.reviewLeaveRequest);
app.post('/api/academic/diary/add', academicControllers.addDiaryEntry);

// ---------------------------------------------------------
// SERVER INITIALIZATION & SCHEDULED AUTOMATIONS
// ---------------------------------------------------------

// ⏰ AUTOMATED CRON: Triggers every day at 8:00 AM IST
cron.schedule('00 08 * * *', async () => {
  console.log("⏰ [08:00 AM IST] Executing Daily Automated Tasks...");
  await controllers.runDailyCron();
}, {
  scheduled: true,
  timezone: "Asia/Kolkata"
});

// Mail dashboards refresh independently of outgoing mail. The reports include
// the previous complete day/month/year and use the same sender failover path.
startMailDashboardRefresh();

const reportRecipients = String(process.env.MAIL_REPORT_RECIPIENTS ?? 'giftyipcsglobal@gmail.com').trim();
const mailReportsEnabled = String(process.env.MAIL_REPORTS_ENABLED ?? 'true').toLowerCase() !== 'false';
if (mailReportsEnabled && reportRecipients) {
  const scheduleMailReport = (envKey, fallbackCron, period) => {
    const expression = String(process.env[envKey] || fallbackCron).trim();
    if (!cron.validate(expression)) {
      console.error(`[MAIL REPORT] Invalid ${envKey} cron expression; ${period} report schedule was not registered.`);
      return;
    }
    cron.schedule(expression, async () => {
      try {
        await sendScheduledMailReport(period);
      } catch (error) {
        console.error(`[MAIL REPORT] ${period} report could not be sent:`, error.message);
      }
    }, { scheduled: true, timezone: 'Asia/Kolkata' });
    console.log(`[MAIL REPORT] ${period} report scheduled with ${envKey} (${expression}, Asia/Kolkata).`);
  };
  scheduleMailReport('MAIL_REPORT_DAILY_CRON', '15 8 * * *', 'daily');
  scheduleMailReport('MAIL_REPORT_MONTHLY_CRON', '30 8 1 * *', 'monthly');
  scheduleMailReport('MAIL_REPORT_YEARLY_CRON', '0 9 1 1 *', 'yearly');
} else {
  console.log('[MAIL REPORT] Scheduled report emails are disabled or no recipient is configured.');
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 IPCS Backend is running on http://localhost:${PORT}`);
  startEmailWorker();
  // Recover only yesterday's resume deliveries after deploys/restarts that
  // missed the 08:00 IST cron tick; older deadlines are never backfilled.
  setTimeout(() => {
    controllers.runDailyCron({ resumeOnly: true })
      .then(result => console.log('[RESUME DELIVERY] Startup catch-up complete:', JSON.stringify(result?.resumes || {})))
      .catch(error => console.error('[RESUME DELIVERY] Startup catch-up could not run:', error.message));
  }, 60_000);
});
