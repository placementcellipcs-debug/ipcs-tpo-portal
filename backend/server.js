require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const cron = require('node-cron');

// 🚨 IMPORT CONTROLLERS EXACTLY ONCE
const controllers = require('./src/controllers');
const assetControllers = require('./src/assetControllers');

// 🚨 IMPORT CACHES EXACTLY ONCE
const { getCache } = require('./src/config');
const { isAssetCacheReady } = require('./src/assetConfig');

const app = express();

// 🚨 DYNAMIC CORS CONFIGURATION
const allowedOrigins = [
  'https://talenzo.ipcsglobal.info',
  'https://api-talenzo.ipcsglobal.info',
  'https://ipcs-tpo-portal.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
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
  allowedHeaders: ['Content-Type', 'Authorization', 'x-ipcs-email', 'x-ipcs-session-token']
}));

app.use(express.json());
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// ---------------------------------------------------------
// AUTHENTICATION ROUTES
// ---------------------------------------------------------
app.post('/api/auth/login', controllers.login);
app.post('/api/auth/verify-session', controllers.verifySession);

// 🚨 GLOBAL CACHE MIDDLEWARE
app.use('/api', (req, res, next) => {
  if (!getCache()) {
    return res.status(503).json({ success: false, message: "Server is syncing data from Google Sheets... Please wait 5 seconds and refresh." });
  }
  if (req.path.startsWith('/v1/assets') && !isAssetCacheReady()) {
    return res.status(503).json({ success: false, message: "Asset data is still loading from Google Sheets. Please try again shortly." });
  }
  next();
});

const getRole = user => String(user?.role || '').toUpperCase();
const hasRoleToken = (role, token) => new RegExp(`(^|[^A-Z0-9])${token}([^A-Z0-9]|$)`).test(role);
const isPortalAdmin = user => user?.accessType === 'superadmin' || ['SYSTEM ADMIN', 'GENERAL MANAGER', 'ZONAL PLACEMENT HEAD', 'TECHNICAL HEAD'].includes(getRole(user));
const requireSession = (policy = 'portal') => (req, res, next) => {
  const user = controllers.getSessionUser(req.get('x-ipcs-email'), req.get('x-ipcs-session-token'));
  if (!user) return res.status(401).json({ success: false, message: 'Sign in again to continue.' });
  const role = getRole(user);
  const isAdmin = isPortalAdmin(user);

  if (policy === 'assets' && !isAdmin && !role.includes('MANAGER') && !role.includes('ASSET')) {
    return res.status(403).json({ success: false, message: 'Asset Management is not available for this role.' });
  }
  if (policy === 'asset-admin' && !isAdmin && !role.includes('ASSET')) {
    return res.status(403).json({ success: false, message: 'Asset manager access is required for this action.' });
  }
  if (policy === 'portal-admin' && !isAdmin) {
    return res.status(403).json({ success: false, message: 'System administrator access is required for this action.' });
  }
  if (policy === 'design' && !isAdmin && !['DESIGN', 'MEDIA', 'CREATIVE'].some(part => role.includes(part))) {
    return res.status(403).json({ success: false, message: 'Media & Design Studio is not available for this role.' });
  }
  if (policy === 'academic' && (role.includes('ASSET') || role.includes('DESIGN') || role.includes('MEDIA') || role.includes('CREATIVE'))) {
    return res.status(403).json({ success: false, message: 'Training & Academics is not available for this role.' });
  }
  if (policy === 'clients' && (hasRoleToken(role, 'RTH') || role.includes('REGIONAL TECHNICAL HEAD') || role.includes('TECHNICAL LEAD') || role.includes('TRAINER') || hasRoleToken(role, 'TTH'))) {
    return res.status(403).json({ success: false, message: 'Clients & Partners is not available for this role.' });
  }
  req.portalUser = user;
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    req.body = { ...req.body, userName: user.name, userEmail: user.email, currentUserEmail: user.email };
    if (req.baseUrl === '/api/tpo/students' || req.baseUrl === '/api/tpo/dashboard-stats') {
      req.body = { ...req.body, assignedBranchesArray: user.assignedBranchesArray, role: user.role, assignedCourse: user.assignedCourse };
    }
    if (req.baseUrl === '/api/tpo/clients') {
      const canSeeAll = isAdmin || role.includes('MANAGER') || role === 'BM' || role.includes('BRANCH MANAGER');
      req.body = { ...req.body, tpoName: canSeeAll ? '' : user.name };
    }
  }
  next();
};

app.use('/api/v1/assets', requireSession('assets'));
app.use('/api/design', requireSession('design'));
app.use('/api/academic', requireSession('academic'));
app.use('/api/tpo/students', requireSession('portal'));
app.use('/api/tpo/dashboard-stats', requireSession('portal'));
app.use('/api/tpo/clients', (req, res, next) => {
  if ((req.method === 'GET' && /^\/\d+$/.test(req.path)) || (req.method === 'POST' && req.path === '/submit-mou')) return next();
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
app.post('/api/tpo/applications/add', upload.single('offerLetterFile'), controllers.addApplication);
app.get('/api/tpo/vacancies', controllers.getVacancies);
app.get('/api/tpo/events', controllers.getEvents);
app.post('/api/tpo/events/add', upload.single('posterFile'), controllers.addEvent);
app.post('/api/tpo/issues', controllers.getIssues);
app.post('/api/tpo/issues/update', controllers.updateIssue);
app.post('/api/tpo/reports', controllers.getReports);
app.post('/api/tpo/talentino', controllers.getTalentino);
app.post('/api/tpo/clients', controllers.getClients);
app.get('/api/public/partners', controllers.getPublicPartners);
app.get('/api/tpo/clients/:id', controllers.getClientById);
app.post('/api/tpo/clients/update', upload.single('logoFile'), controllers.updateClient);
app.post('/api/tpo/clients/request-mou', controllers.requestMou);
app.post('/api/tpo/clients/submit-mou', upload.any(), controllers.submitMou);
app.post('/api/tpo/clients/add', upload.single('logoFile'), controllers.addClient);
app.post('/api/tpo/profile/update-photo', upload.single('photo'), controllers.updatePhoto);
app.post('/api/tpo/profile/update-password', controllers.updatePassword);
app.get('/api/tpo/drives', controllers.getDrives);
app.post('/api/tpo/drives/update', controllers.updateDriveStatus);
app.get('/api/tpo/trigger-resumes', controllers.triggerDailyCron);

// 🚨 INSTANT TEST ROUTE: Trigger both daily tasks manually anytime
app.get('/api/tpo/test-daily-mail', async (req, res) => {
  try {
    console.log("⚡ Manual trigger requested via browser...");
    await controllers.runDailyCron();
    res.json({ success: true, message: "Daily Cron execution triggered! Check your terminal and inbox." });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ---------------------------------------------------------
// ADMIN ROUTES
// ---------------------------------------------------------
app.get('/api/admin/users', controllers.getAdminUsers);
app.post('/api/admin/users/add', controllers.addAdminUser);
app.post('/api/admin/users/update', controllers.updateAdminUser);
app.post('/api/admin/users/delete', controllers.deleteAdminUser);
app.get('/api/admin/courses', controllers.getCourses);
app.post('/api/admin/courses/add', controllers.addCourse);
app.post('/api/admin/courses/delete', controllers.deleteCourse); 
app.get('/api/admin/security-logs', controllers.getSecurityLogs);
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
app.get('/api/lms/materials', controllers.getMaterials);
app.post('/api/lms/materials/add', controllers.addMaterial);
app.post('/api/lms/materials/update', controllers.updateMaterial);
app.post('/api/lms/materials/delete', controllers.deleteMaterial);
app.get('/api/exams/questions', controllers.getQuestions);
app.post('/api/exams/questions/add', controllers.addQuestion);
app.post('/api/exams/questions/update', controllers.updateQuestion);
app.post('/api/exams/questions/delete', controllers.deleteQuestion); 
app.get('/api/exams/results', controllers.getResults);
app.get('/api/aptitude/questions', controllers.getAptQuestions);
app.get('/api/aptitude/results', controllers.getAptResults);
app.post('/api/aptitude/questions/add', controllers.addAptQuestion); 
app.post('/api/aptitude/questions/update', controllers.updateAptQuestion);
app.post('/api/aptitude/questions/delete', controllers.deleteAptQuestion); 
app.get('/api/talentino-exams/questions', controllers.getTalExamQuestions);
app.get('/api/talentino-exams/results', controllers.getTalExamResults);
app.post('/api/talentino-exams/questions/add', controllers.addTalExamQuestion); 
app.post('/api/talentino-exams/questions/update', controllers.updateTalExamQuestion);
app.post('/api/talentino-exams/questions/delete', controllers.deleteTalExamQuestion); 
app.post('/api/tpo/activity', controllers.updateTpoActivity);

// ---------------------------------------------------------
// 🚨 ASSET MANAGEMENT (ERP) ROUTES
// ---------------------------------------------------------
app.get('/api/v1/assets/form-data', assetControllers.getRegistrationData);
app.post('/api/v1/assets/add', requireSession('asset-admin'), assetControllers.addAsset);
app.get('/api/v1/assets', assetControllers.getAssets);
app.get('/api/v1/assets/:assetId/details', assetControllers.getAssetDetails);
app.post('/api/v1/assets/assign', assetControllers.assignAsset);
app.post('/api/v1/assets/return', assetControllers.returnAsset);
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 IPCS Backend is running on http://localhost:${PORT}`));
