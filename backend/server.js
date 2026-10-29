require('dotenv').config();
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');
const { randomUUID, timingSafeEqual } = require('crypto');

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const cron = require('node-cron');
const { getRole, hasRoleToken, isPortalAdmin, getPolicyDenial } = require('./src/rolePolicy');
const { readPortalSessionIdentity } = require('./src/sessionTokens');

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
  sendScheduledMailReport,
  logPortalAuditEvent,
  flushPortalAuditEvents
} = require('./src/config');
const { isAssetCacheReady } = require('./src/assetConfig');

const app = express();
const backendInstanceId = String(process.env.RENDER_INSTANCE_ID || process.env.HOSTNAME || `pid-${process.pid}`).slice(0, 120);
const getAuditIdentity = req => {
  const headerEmail = String(req.get('x-ipcs-email') || '').trim().toLowerCase();
  const headerToken = String(req.get('x-ipcs-session-token') || '');
  const verifySessionBody = String(req.originalUrl || '').split('?')[0] === '/api/auth/verify-session';
  let user = req.portalUser || req.auditActor || null;
  if (!user && headerEmail && headerToken) {
    try { user = controllers.getSessionUser(headerEmail, headerToken); } catch { user = null; }
  }
  if (user?.email) return { actor: user, actorType: 'Human', identityBasis: 'Active portal session' };

  const identityEmail = headerEmail || (verifySessionBody ? String(req.body?.email || '').trim().toLowerCase() : '');
  const identityToken = headerToken || (verifySessionBody ? String(req.body?.sessionToken || '') : '');
  if (identityEmail && identityToken) {
    const signedIdentity = readPortalSessionIdentity(identityEmail, identityToken);
    if (signedIdentity?.email) return { actor: signedIdentity, actorType: 'Signed session (not revalidated)', identityBasis: 'Valid signed token; live account status was not confirmed' };
  }

  if (req.auditAttempt?.identifier) {
    return {
      actor: { name: `${req.auditAttempt.kind === 'login' ? 'Login ID attempt' : 'Session identity claim'}: ${req.auditAttempt.identifier}` },
      actorType: req.auditAttempt.kind === 'login' ? 'Login attempt (not authenticated)' : 'Session claim (not validated)',
      identityBasis: req.auditAttempt.kind === 'login' ? 'Identifier submitted before authentication' : 'Account identifier submitted; session validation failed'
    };
  }
  if (headerEmail) {
    return { actor: { name: `Unverified session claim: ${headerEmail}` }, actorType: 'Session claim (not validated)', identityBasis: 'Email header did not match an active session' };
  }

  const visitorId = String(req.get('x-portal-visitor-id') || '').trim();
  if (/^[a-z0-9-]{8,80}$/i.test(visitorId)) {
    return { actor: { name: `Visitor ${visitorId.slice(0, 12)}` }, actorType: 'Public visitor', identityBasis: 'Persistent browser visitor ID; person not signed in' };
  }
  return { actor: { name: 'Visitor (browser ID unavailable)' }, actorType: 'Public visitor', identityBasis: 'No portal account identity was available' };
};
const portalServiceRole = String(process.env.PORTAL_SERVICE_ROLE || 'all').trim().toLowerCase();
if (!['all', 'api', 'worker'].includes(portalServiceRole)) {
  throw new Error(`Invalid PORTAL_SERVICE_ROLE "${portalServiceRole}". Use all, api, or worker.`);
}
const runsBackgroundJobs = portalServiceRole === 'all' || portalServiceRole === 'worker';
if (runsBackgroundJobs && process.env.NODE_ENV === 'production') {
  console.warn(`[BACKGROUND JOBS] PORTAL_SERVICE_ROLE=${portalServiceRole} starts a mail worker in this process. No distributed worker lease is configured; keep worker-enabled backend replicas at one.`);
}
if (portalServiceRole === 'worker') {
  app.get('/health', (_req, res) => res.json({ success: true, service: 'worker' }));
  app.use((_req, res) => res.status(404).json({ success: false, message: 'This instance runs background jobs only.' }));
}
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
    req.auditReason = 'Repeated sign-in attempts hit the per-address and login-ID rate limit before credential verification.';
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
    const configuredOrigins = String(process.env.CORS_ALLOWED_ORIGINS || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);
    if ([...allowedOrigins, ...configuredOrigins].includes(origin)) {
      return callback(null, true);
    } else {
      const rejectedOrigin = String(origin || '(missing)')
        .replace(/[\r\n\t]/g, ' ')
        .slice(0, 300);
      console.warn(`[CORS] Rejected origin: ${rejectedOrigin}`);
      return callback(new Error('Blocked by CORS'));
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'Range', 'x-ipcs-email', 'x-ipcs-session-token', 'x-portal-visitor-id'],
  exposedHeaders: ['Accept-Ranges', 'Content-Range', 'Content-Length']
}));

app.use(express.json({ limit: '1mb' }));

const auditRouteForRequest = req => {
  if (req.route?.path) {
    const mount = String(req.baseUrl || '').replace(/\/$/, '');
    const route = String(req.route.path || '');
    return (mount && route.startsWith(`${mount}/`) ? route : `${mount}${route}`).slice(0, 500);
  }
  return String(req.originalUrl || req.path || '').split('?')[0]
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, ':email')
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, ':id')
    .replace(/\/(?:\d{4,}|[A-Za-z0-9_-]{28,})(?=\/|$)/g, '/:id')
    .slice(0, 500);
};

// Record every API request and its outcome without storing request bodies,
// query strings, passwords, session tokens, student fields, or uploaded files.
app.use('/api', (req, res, next) => {
  if (req.method === 'OPTIONS' || (req.method === 'POST' && req.path === '/audit/interactions')) return next();
  const startedAt = Date.now();
  const requestId = randomUUID();
  req.portalAuditRequestId = requestId;
  res.set('X-Request-ID', requestId);
  res.on('finish', () => {
    const identity = getAuditIdentity(req);
    const actor = identity.actor || {};
    const status = Number(res.statusCode) || 0;
    const requestFields = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? Object.keys(req.body).filter(field => !/(password|token|secret|base64|signature|file)/i.test(field)).slice(0, 40)
      : [];
    const details = {
      backendInstanceId,
      identityBasis: identity.identityBasis,
      ...(/^[a-z0-9-]{8,80}$/i.test(String(req.get('x-portal-visitor-id') || '')) ? { browserVisitorId: String(req.get('x-portal-visitor-id')).slice(0, 80) } : {}),
      requestFields,
      ...(req.auditDetails && typeof req.auditDetails === 'object' ? req.auditDetails : {}),
      ...(req.auditAttempt?.identifier ? { submittedLoginId: req.auditAttempt.identifier } : {}),
      ...(req.auditReason ? { reason: req.auditReason } : {}),
      ...(status === 503 && !getCache()?.cacheUpdatedAt ? { reason: req.auditReason || 'Portal data cache was not ready; request could not be served.' } : {}),
      ...(status >= 500 && !req.auditReason && status !== 503 ? { reason: 'Request completed with a server error.' } : {})
    };
    logPortalAuditEvent({
      requestId,
      actor,
      actorType: actor.email ? identity.actorType : ['Automation', 'Apps Script'].includes(req.auditSource) ? 'Bot' : identity.actorType,
      source: req.auditSource || 'API',
      action: `${String(req.method || '').toUpperCase()} ${auditRouteForRequest(req)}`,
      resource: auditRouteForRequest(req),
      method: req.method,
      route: auditRouteForRequest(req),
      result: req.auditResult || (status === 503 ? 'Unavailable' : status >= 500 ? 'Error' : status >= 400 ? 'Rejected' : 'Success'),
      httpStatus: status,
      durationMs: Date.now() - startedAt,
      details
    });
  });
  next();
});

const memoryStorage = multer.memoryStorage();
const upload = multer({ storage: memoryStorage, limits: {
  fileSize: 50 * 1024 * 1024,
  files: 5,
  fields: 40,
  parts: 45,
  fieldNameSize: 100,
  fieldSize: 256 * 1024,
  fieldNestingDepth: 5
} });
const vacancyLogoUpload = multer({ storage: memoryStorage, limits: {
  fileSize: 10 * 1024 * 1024,
  files: 1,
  fields: 30,
  parts: 31,
  fieldNameSize: 100,
  fieldSize: 256 * 1024,
  fieldNestingDepth: 5
} }).single('companyLogo');
const mouUpload = multer({ storage: memoryStorage, limits: {
  fileSize: 10 * 1024 * 1024,
  files: 2,
  fields: 12,
  parts: 14,
  fieldNameSize: 80,
  fieldSize: 16 * 1024,
  fieldNestingDepth: 3
} }).fields([{ name: 'certificatePdf', maxCount: 1 }, { name: 'logoFile', maxCount: 1 }]);
const parseVacancyLogo = (req, res, next) => vacancyLogoUpload(req, res, error => {
  if (error) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ success: false, message: status === 413 ? 'The company logo must be 10 MB or smaller.' : error.message });
  }
  next();
});
const parseMouUploads = (req, res, next) => mouUpload(req, res, error => {
  if (error) {
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ success: false, message: status === 413 ? 'Each MOU file must be 10 MB or smaller.' : 'The MOU upload has an invalid file or field count.' });
  }
  next();
});

const createIpRateLimiter = ({ windowMs, max, message }) => {
  const entries = new Map();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of entries) if (entry.resetAt <= now) entries.delete(key);
  }, Math.min(windowMs, 5 * 60 * 1000));
  cleanup.unref?.();
  return (req, res, next) => {
    const now = Date.now();
    const key = String(req.ip || req.socket?.remoteAddress || 'unknown').slice(0, 100);
    let entry = entries.get(key);
    if (!entry || entry.resetAt <= now) {
      if (entries.size >= 10000) {
        for (const [candidate, value] of entries) if (value.resetAt <= now) entries.delete(candidate);
        if (entries.size >= 10000) entries.delete(entries.keys().next().value);
      }
      entry = { count: 0, resetAt: now + windowMs };
      entries.set(key, entry);
    }
    if (entry.count >= max) {
      req.auditReason = message;
      res.set('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      return res.status(429).json({ success: false, message });
    }
    entry.count += 1;
    next();
  };
};
const publicInquiryRateLimit = createIpRateLimiter({ windowMs: 15 * 60 * 1000, max: 5, message: 'Too many inquiry submissions. Please wait and try again.' });
const mouSubmitRateLimit = createIpRateLimiter({ windowMs: 60 * 60 * 1000, max: 10, message: 'Too many signing attempts. Please wait and try again.' });
const loginAddressRateLimit = createIpRateLimiter({ windowMs: LOGIN_WINDOW_MS, max: 30, message: 'Too many sign-in attempts from this network. Wait and try again.' });
const interactionRateLimit = createIpRateLimiter({ windowMs: 60 * 1000, max: 120, message: 'Too many activity log batches. Please wait a moment.' });
const publicInteractionRateLimit = createIpRateLimiter({ windowMs: 60 * 1000, max: 30, message: 'Too many activity log batches. Please wait a moment.' });
const automationAuditRateLimit = createIpRateLimiter({ windowMs: 60 * 1000, max: 120, message: 'Too many automation audit batches. Please wait a moment.' });

// ---------------------------------------------------------
// AUTHENTICATION ROUTES
// ---------------------------------------------------------
const captureLoginAttempt = (req, _res, next) => {
  const identifier = String(req.body?.email || '').trim().toLowerCase().slice(0, 254);
  req.auditAttempt = identifier ? { kind: 'login', identifier } : null;
  next();
};
app.post('/api/auth/login', captureLoginAttempt, loginAddressRateLimit, loginRateLimit, controllers.login);
app.post('/api/auth/verify-session', controllers.verifySession);

// 🚨 GLOBAL CACHE MIDDLEWARE
app.use('/api', async (req, res, next) => {
  // Public site data has its own Drive/Sheets readiness checks. Keep it available
  // while the larger staff data cache is warming up after a server restart.
  const requestPath = req.originalUrl.split('?')[0];
  if (requestPath.startsWith('/api/public/') || requestPath === '/api/audit/interactions' || requestPath === '/api/audit/automation-events') return next();
  let cache = getCache();
  if (!cache?.cacheUpdatedAt) {
    await waitForCacheReady();
    cache = getCache();
  }
  if (!cache?.cacheUpdatedAt) {
    req.auditReason = 'The primary Google Sheets cache was not ready; the request stopped before its route handler.';
    req.auditDetails = { cacheUpdatedAt: cache?.cacheUpdatedAt || '', cacheRefreshStatus: cache?.cacheRefreshStatus || 'not-ready', cacheFailedSheets: cache?.cacheFailedSheets || [] };
    res.set('Retry-After', '5');
    return res.status(503).json({ success: false, message: 'Portal data is still syncing from Google Sheets. Please try again shortly.' });
  }
  if (req.path.startsWith('/v1/assets') && !isAssetCacheReady()) {
    req.auditReason = 'The asset cache was not ready; the request stopped before its route handler.';
    req.auditDetails = { assetCacheReady: false };
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
    if (String(req.originalUrl || '').split('?')[0].startsWith('/api/v1/assets/')) {
      req.body = { ...req.body, userName: user.name, actorName: user.name, userEmail: user.email };
    }
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

const cleanAuditRoute = value => String(value || '').split('?')[0]
  .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, ':email')
  .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, ':id')
  .replace(/\/(?:\d{4,}|[A-Za-z0-9_-]{28,})(?=\/|$)/g, '/:id')
  .slice(0, 300);

app.post('/api/audit/interactions', (req, res, next) => {
  const user = controllers.getSessionUser(req.get('x-ipcs-email'), req.get('x-ipcs-session-token'));
  req.auditInteractionActor = user || {};
  return (user ? interactionRateLimit : publicInteractionRateLimit)(req, res, next);
}, (req, res) => {
  const identity = req.auditInteractionActor?.email
    ? { actor: req.auditInteractionActor, actorType: 'Human' }
    : getAuditIdentity(req);
  const actor = identity.actor || {};
  const interactionRequestId = randomUUID();
  res.set('X-Request-ID', interactionRequestId);
  const events = Array.isArray(req.body?.events) ? req.body.events.slice(0, 100) : [];
  for (const item of events) {
    const interactionType = ['click', 'touch', 'change', 'input', 'submit', 'navigate', 'keyboard', 'scroll'].includes(String(item?.type || '').toLowerCase())
      ? String(item.type).toLowerCase()
      : 'interaction';
    const page = cleanAuditRoute(item?.page || '');
    const control = ['button', 'link', 'input', 'select', 'textarea', 'form', 'navigation', 'document', 'contenteditable'].includes(String(item?.control || '').toLowerCase())
      ? String(item.control).toLowerCase()
      : 'control';
    const field = /^[a-z0-9_.:-]{1,80}$/i.test(String(item?.field || '')) ? String(item.field) : '';
    const controlId = /^[a-z][a-z0-9_.:-]{0,79}$/i.test(String(item?.controlId || '')) ? String(item.controlId) : '';
    logPortalAuditEvent({
      actor,
      actorType: actor.email ? identity.actorType : identity.actorType,
      source: 'UI',
      action: `UI ${interactionType}`,
      resource: page,
      route: page,
      result: 'Observed',
      requestId: interactionRequestId,
      timestamp: Number.isFinite(Date.parse(item?.timestamp)) ? new Date(item.timestamp).toISOString() : undefined,
      details: { control, field, controlId, identityBasis: identity.identityBasis, browserVisitorId: req.get('x-portal-visitor-id') || '' }
    });
  }
  return res.json({ success: true, recorded: events.length });
});

app.post('/api/audit/automation-events', automationAuditRateLimit, (req, res) => {
  const expectedToken = Buffer.from(String(process.env.PORTAL_AUDIT_INGEST_TOKEN || ''));
  const suppliedToken = Buffer.from(String(req.get('x-portal-audit-token') || ''));
  if (!expectedToken.length) return res.status(503).json({ success: false, message: 'Automation audit ingestion is not configured.' });
  if (expectedToken.length !== suppliedToken.length || !timingSafeEqual(expectedToken, suppliedToken)) {
    return res.status(401).json({ success: false, message: 'Invalid audit integration credentials.' });
  }
  req.auditSource = 'Apps Script';
  req.auditActor = { name: 'Google Apps Script', role: 'Automation' };

  const allowedDetailKeys = new Set(['spreadsheetId', 'sheet', 'range', 'changeType', 'operation', 'recordId', 'triggerUid', 'rowCount', 'columnCount', 'job', 'summary']);
  const events = Array.isArray(req.body?.events) ? req.body.events.slice(0, 100) : [];
  for (const item of events) {
    const rawDetails = item?.details && typeof item.details === 'object' && !Array.isArray(item.details) ? item.details : {};
    const details = Object.fromEntries(Object.entries(rawDetails)
      .filter(([key, value]) => allowedDetailKeys.has(key) && ['string', 'number', 'boolean'].includes(typeof value))
      .map(([key, value]) => [key, String(value).slice(0, 500)]));
    logPortalAuditEvent({
      eventId: /^[a-z0-9-]{12,80}$/i.test(String(item?.eventId || '')) ? String(item.eventId) : undefined,
      requestId: req.portalAuditRequestId,
      actorType: String(item?.actorType || '').toLowerCase() === 'human' ? 'Human' : 'Bot',
      actorName: String(item?.actorName || 'Apps Script').slice(0, 180),
      actorEmail: String(item?.actorEmail || '').slice(0, 254),
      actorRole: String(item?.actorRole || 'Apps Script').slice(0, 100),
      source: 'Apps Script',
      action: String(item?.action || 'Apps Script action').replace(/[\r\n\u0000-\u001f]/g, ' ').slice(0, 180),
      resource: String(item?.resource || 'Google Sheets').replace(/[\r\n\u0000-\u001f]/g, ' ').slice(0, 180),
      result: ['Success', 'Error', 'Started', 'Completed', 'Observed'].includes(String(item?.result || '')) ? String(item.result) : 'Observed',
      details
    });
  }
  return res.status(202).json({ success: true, accepted: events.length });
});

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
app.use('/api/tpo/placed-students', requireSession('portal'));
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
app.post('/api/tpo/applications/update-placed', upload.single('offerLetterFile'), controllers.updatePlacedStudent);
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
app.post('/api/tpo/placed-students', controllers.getPlacedStudents);
app.post('/api/tpo/placed-students/delete', controllers.deletePlacedStudent);
app.post('/api/tpo/talentino', controllers.getTalentino);
app.post('/api/tpo/clients', controllers.getClients);
app.get('/api/public/partners', controllers.getPublicPartners);
app.get('/api/public/placement-team', controllers.getPublicPlacementTeam);
app.get('/api/public/openings', controllers.getPublicOpenings);
app.post('/api/public/corporate-training-inquiries', publicInquiryRateLimit, controllers.submitCorporateTrainingInquiry);
app.post('/api/public/hiring-inquiries', publicInquiryRateLimit, controllers.submitHiringInquiry);
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
app.post('/api/tpo/clients/submit-mou', mouSubmitRateLimit, parseMouUploads, controllers.submitMou);
app.post('/api/tpo/clients/add', upload.single('logoFile'), controllers.addClient);
app.post('/api/tpo/profile/update-photo', requireSession('portal'), upload.single('photo'), controllers.updatePhoto);
app.get('/api/tpo/drives', requireSession('placement-drive'), controllers.getDrives);
app.post('/api/tpo/drives/update', requireSession('placement-drive'), controllers.updateDriveStatus);
app.get('/api/tpo/trigger-resumes', requireSession('portal-admin'), controllers.triggerDailyCron);

// 🚨 INSTANT TEST ROUTE: Trigger both daily tasks manually anytime
app.get('/api/tpo/test-daily-mail', requireSession('portal-admin'), controllers.triggerDailyCron);

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
app.get('/api/admin/placement-reconciliation', controllers.getPlacementReconciliation);
app.post('/api/admin/placement-reconciliation/refresh', controllers.refreshPlacementReconciliation);
app.post('/api/admin/placement-reconciliation/repair-manual-saves', controllers.repairManualPlacementSaves);
app.post('/api/admin/placement-reconciliation/rebuild', controllers.rebuildPlacedStudentProjection);
app.get('/api/admin/placement-audit', controllers.getPlacementAudit);
app.post('/api/admin/trigger-resume-delivery', controllers.triggerDailyCron);
app.post('/api/admin/company-opening-report', controllers.triggerCompanyOpeningReport);
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
app.post('/api/v1/assets/add', requireSession('asset-operations'), upload.single('photo'), assetControllers.addAsset);
app.get('/api/v1/assets', assetControllers.getAssets);
app.get('/api/v1/assets/:assetId/details', assetControllers.getAssetDetails);
app.post('/api/v1/assets/:assetId/qr-label', assetControllers.registerAssetQrLabel);
app.post('/api/v1/assets/assign', requireSession('asset-operations'), upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'returnPhoto', maxCount: 1 }]), assetControllers.assignAsset);
app.post('/api/v1/assets/return', requireSession('asset-operations'), upload.single('photo'), assetControllers.returnAsset);
app.get('/api/v1/assets/dashboard', assetControllers.getAssetDashboardStats);
app.get('/api/v1/assets/activity', assetControllers.getAssetActivity);
app.get('/api/v1/assets/notifications', assetControllers.getAssetNotifications);

// 🚨 INVENTORY, TRANSFERS, AND MAINTENANCE ROUTES
app.get('/api/v1/assets/inventory', assetControllers.getInventory);
app.post('/api/v1/assets/inventory/add', requireSession('asset-operations'), assetControllers.addInventory);
app.post('/api/v1/assets/inventory/stock', requireSession('asset-operations'), assetControllers.updateStock);

app.get('/api/v1/assets/transfers', assetControllers.getTransfers);
app.post('/api/v1/assets/transfers/request', requireSession('asset-operations'), assetControllers.requestTransfer);
app.post('/api/v1/assets/transfers/approve', requireSession('asset-operations'), assetControllers.approveTransfer);
app.post('/api/v1/assets/transfers/reject', requireSession('asset-operations'), assetControllers.rejectTransfer);
app.post('/api/v1/assets/transfers/receive', requireSession('asset-operations'), assetControllers.receiveTransfer);
app.post('/api/v1/assets/notifications/summary', assetControllers.sendAssetSummaryEmail);

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
app.post('/api/v1/assets/dispose', requireSession('asset-operations'), assetControllers.disposeAsset);

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

if (runsBackgroundJobs) {
  // ⏰ AUTOMATED CRON: Triggers every day at 8:00 AM IST
  cron.schedule('00 08 * * *', async () => {
    console.log("⏰ [08:00 AM IST] Executing Daily Automated Tasks...");
    const requestId = randomUUID();
    logPortalAuditEvent({ requestId, actorType: 'Bot', source: 'Automation', action: 'Daily scheduled tasks started', resource: 'Daily job', result: 'Started', details: { schedule: '08:00 Asia/Kolkata' } });
    try {
      const result = await controllers.runDailyCron();
      logPortalAuditEvent({ requestId, actorType: 'Bot', source: 'Automation', action: 'Daily scheduled tasks completed', resource: 'Daily job', result: 'Success', details: { completed: true, summary: result?.summary || '' } });
    } catch (error) {
      logPortalAuditEvent({ requestId, actorType: 'Bot', source: 'Automation', action: 'Daily scheduled tasks failed', resource: 'Daily job', result: 'Error', details: { error: String(error.message || error).slice(0, 500) } });
      throw error;
    }
  }, {
    scheduled: true,
    timezone: "Asia/Kolkata"
  });

  // Mail dashboards refresh independently of outgoing mail.
  startMailDashboardRefresh();
} else {
  console.log(`[BACKGROUND JOBS] Disabled for PORTAL_SERVICE_ROLE=${portalServiceRole}; this instance serves portal requests only.`);
}

const reportRecipients = String(process.env.MAIL_REPORT_RECIPIENTS ?? 'giftyipcsglobal@gmail.com').trim();
const mailReportsEnabled = String(process.env.MAIL_REPORTS_ENABLED ?? 'true').toLowerCase() !== 'false';
if (runsBackgroundJobs && mailReportsEnabled && reportRecipients) {
  const scheduleMailReport = (envKey, fallbackCron, period) => {
    const expression = String(process.env[envKey] || fallbackCron).trim();
    if (!cron.validate(expression)) {
      console.error(`[MAIL REPORT] Invalid ${envKey} cron expression; ${period} report schedule was not registered.`);
      return;
    }
    cron.schedule(expression, async () => {
      const requestId = randomUUID();
      logPortalAuditEvent({ requestId, actorType: 'Bot', source: 'Automation', action: 'Scheduled mail report started', resource: 'Mail report', result: 'Started', details: { period, schedule: expression } });
      try {
        await sendScheduledMailReport(period);
        logPortalAuditEvent({ requestId, actorType: 'Bot', source: 'Automation', action: 'Scheduled mail report completed', resource: 'Mail report', result: 'Success', details: { period } });
      } catch (error) {
        console.error(`[MAIL REPORT] ${period} report could not be sent:`, error.message);
        logPortalAuditEvent({ requestId, actorType: 'Bot', source: 'Automation', action: 'Scheduled mail report failed', resource: 'Mail report', result: 'Error', details: { period, error: String(error.message || error).slice(0, 500) } });
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
const httpServer = app.listen(PORT, () => {
  console.log(`🚀 IPCS Backend is running on http://localhost:${PORT}`);
  logPortalAuditEvent({ actorType: 'Bot', source: 'Automation', action: 'Portal backend started', resource: 'Portal backend', result: 'Success', details: { serviceRole: portalServiceRole, backendInstanceId, processId: process.pid, environment: process.env.NODE_ENV || 'development' } });
  if (runsBackgroundJobs) {
    startEmailWorker();
    // Recover only yesterday's resume deliveries after deploys/restarts that
    // missed the scheduled run; the resume-only mode does not send the company report.
    setTimeout(() => {
      const requestId = randomUUID();
      logPortalAuditEvent({ requestId, actorType: 'Bot', source: 'Automation', action: 'Resume delivery startup catch-up started', resource: 'Resume delivery', result: 'Started' });
      controllers.runDailyCron({ resumeOnly: true })
        .then(result => {
          console.log('[RESUME DELIVERY] Startup catch-up complete:', JSON.stringify(result?.resumes || {}));
          logPortalAuditEvent({ requestId, actorType: 'Bot', source: 'Automation', action: 'Resume delivery startup catch-up completed', resource: 'Resume delivery', result: 'Success', details: { completed: true } });
        })
        .catch(error => {
          console.error('[RESUME DELIVERY] Startup catch-up could not run:', error.message);
          logPortalAuditEvent({ requestId, actorType: 'Bot', source: 'Automation', action: 'Resume delivery startup catch-up failed', resource: 'Resume delivery', result: 'Error', details: { error: String(error.message || error).slice(0, 500) } });
        });
    }, 60_000);
  }
});

let auditShutdownStarted = false;
const shutdownPortal = signal => {
  if (auditShutdownStarted) return;
  auditShutdownStarted = true;
  logPortalAuditEvent({ actorType: 'Bot', source: 'Automation', action: 'Portal backend shutting down', resource: 'Portal backend', result: 'Started', details: { signal } });
  const forceExit = setTimeout(() => {
    console.error('[PORTAL AUDIT] Shutdown timed out before the audit queue could be flushed.');
    process.exit(1);
  }, 10000);
  httpServer.close(async () => {
    const flushed = await flushPortalAuditEvents();
    clearTimeout(forceExit);
    if (!flushed) console.error('[PORTAL AUDIT] Some queued audit events could not be flushed before shutdown.');
    process.exit(flushed ? 0 : 1);
  });
};
process.on('SIGTERM', () => shutdownPortal('SIGTERM'));
process.on('SIGINT', () => shutdownPortal('SIGINT'));
