const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { google } = require('googleapis');
const axios = require('axios');
const { formatIndiaTimestamp } = require('./utils/dateTime');
const { createEmailService } = require('./emailService');

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
  scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive'],
});

const legacySpreadsheetId = String(process.env.SPREADSHEET_ID || '').trim();
const defaultSpreadsheetIds = {
  students: '14WvBO50cY66NLQVQXs1OrR-jcOD6AQSKz9Yya60KG3o',
  placements: '1eSMP6u8G11ErXOYS1XTU0qR4RvyCNcFQtP19dHkNz5c',
  learning: '18alS1bVj33kZ8wX7VcQiwrPzLSfOyQWkc8fRooTD7Nk',
  operations: '1qLS3e0xJX0IVhNoGFGM8uPtet7mxI6QHzpz-AwfoBnI',
};
const configuredLearningSpreadsheetId = String(process.env.LEARNING_SPREADSHEET_ID || defaultSpreadsheetIds.learning).trim();
// The previous academic controller used this workbook directly, so preserve
// that existing setup even when ACADEMIC_SPREADSHEET_ID is not in Render.
const legacyAcademicSpreadsheetId = String(
  process.env.ACADEMIC_SPREADSHEET_ID || '1mhTuK_3dXLKk1DcUCTA7KFWHiCKirwmYP6l7wMLYPlo'
).trim();
const spreadsheetGroupIds = {
  students: String(process.env.STUDENT_DATA_SPREADSHEET_ID || defaultSpreadsheetIds.students).trim(),
  placements: String(process.env.PLACEMENT_SPREADSHEET_ID || defaultSpreadsheetIds.placements).trim(),
  learning: configuredLearningSpreadsheetId || legacySpreadsheetId,
  operations: String(process.env.OPERATIONS_SPREADSHEET_ID || defaultSpreadsheetIds.operations).trim(),
};
const learningUsesLegacySources = Boolean(legacySpreadsheetId) && configuredLearningSpreadsheetId === legacySpreadsheetId;

const normalizeSheetTitle = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const sheetGroups = {
  students: ['Data', 'Student_Diary', 'Leave_Applications'],
  placements: ['NewsLetter', 'Event', 'Drive_Registration', 'Opening_Applied', 'Clients', 'TPO_Log', 'TPO_Stats', 'Corporate Training Inquiries', 'Hiring Inquiries'],
  learning: [
    'Talentino_Schedule', 'Talentino_Attendance', 'Courses', 'Study_Materials', 'StudyMaterials',
    'Tech_Questions', 'Tech_Results', 'Aptitude_Questions', 'Aptitude_Results', 'Talentino_Questions', 'Talentino_Results',
    'Training', 'Batches', 'Topics', 'Sessions', 'Attendance', 'Topic_Progress', 'Diary', 'Trainer_Remarks',
    'Assignments', 'Assessments', 'Assessment_Results', 'Activities', 'Certificate_Requests', 'Certificates',
    'Attendance_Corrections', 'Audit_Log'
  ],
  operations: [
    'Issues', 'Contact', 'User', 'Branches', 'Mail', 'EmailQueue', 'EmailQuotaUsage', 'Mail_Usage_Dashboard', 'Mail_Usage_History', 'Security_Logs',
    'Auth_Sessions', 'Password_Reset_Tokens', 'Trainer/TL_Log'
  ],
};
const sheetGroupByNormalizedTitle = new Map(
  Object.entries(sheetGroups).flatMap(([group, titles]) => titles.map(title => [normalizeSheetTitle(title), group]))
);
const getSheetGroup = title => sheetGroupByNormalizedTitle.get(normalizeSheetTitle(title)) || 'placements';
const documentsById = new Map();
const getDocument = spreadsheetId => {
  if (!spreadsheetId) return null;
  let spreadsheet = documentsById.get(spreadsheetId);
  if (!spreadsheet) {
    spreadsheet = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
    documentsById.set(spreadsheetId, spreadsheet);
  }
  return spreadsheet;
};
const uniqueDocuments = spreadsheetIds => [...new Set(spreadsheetIds.filter(Boolean))].map(getDocument);
const documentsByGroup = {
  students: uniqueDocuments([spreadsheetGroupIds.students]),
  placements: uniqueDocuments([spreadsheetGroupIds.placements]),
  learning: learningUsesLegacySources
    ? uniqueDocuments([legacySpreadsheetId, legacyAcademicSpreadsheetId])
    : uniqueDocuments([configuredLearningSpreadsheetId]),
  operations: uniqueDocuments([spreadsheetGroupIds.operations]),
};
const allDocuments = [...new Set(Object.values(documentsByGroup).flat())];
const legacyAcademicOnlyLearningTabs = new Set([
  'Training', 'Batches', 'Topics', 'Sessions', 'Attendance', 'Topic_Progress', 'Diary', 'Trainer_Remarks',
  'Assignments', 'Assessments', 'Assessment_Results', 'Activities', 'Certificate_Requests', 'Certificates',
  'Attendance_Corrections', 'Audit_Log'
].map(normalizeSheetTitle));
const getPreferredDocumentForSheet = title => {
  const group = getSheetGroup(title);
  if (group === 'learning' && learningUsesLegacySources && legacyAcademicOnlyLearningTabs.has(normalizeSheetTitle(title))) {
    return getDocument(legacyAcademicSpreadsheetId) || documentsByGroup.learning[0];
  }
  return documentsByGroup[group]?.[0] || documentsByGroup.placements?.[0] || allDocuments[0];
};

const doc = {
  get sheetsByTitle() {
    const sheets = {};
    for (const [group, spreadsheets] of Object.entries(documentsByGroup)) {
      for (const spreadsheet of spreadsheets) {
        for (const [title, sheet] of Object.entries(spreadsheet.sheetsByTitle || {})) {
          if (getSheetGroup(title) === group || !sheets[title]) sheets[title] = sheet;
        }
      }
    }
    return sheets;
  },
  get sheetsByIndex() {
    return allDocuments.flatMap(spreadsheet => spreadsheet.sheetsByIndex || []);
  },
  loadInfo: async () => Promise.all(allDocuments.map(spreadsheet => spreadsheet.loadInfo())),
  addSheet: async options => {
    const spreadsheet = getPreferredDocumentForSheet(options?.title);
    if (!spreadsheet) throw new Error('No Google Sheets document is configured. Set the spreadsheet IDs in the backend environment.');
    const sheet = await spreadsheet.addSheet(options);
    docInfoCachedUntil = 0;
    return sheet;
  },
};
const getSpreadsheetIdForSheetName = title => spreadsheetGroupIds[getSheetGroup(title)] || legacySpreadsheetId;
const getActiveSpreadsheetIds = () => [...new Set([
  ...Object.values(spreadsheetGroupIds),
  ...(learningUsesLegacySources ? [legacyAcademicSpreadsheetId] : [])
].filter(Boolean))];
const drive = google.drive({ version: 'v3', auth: serviceAccountAuth });

let globalCache = null;
let isFetching = false;
let cacheRefreshPromise = null;
let cacheRefreshRequested = false;
let scheduledCacheRetryTimer = null;
let consecutiveCacheRefreshFailures = 0;
let docInfoLoading = null;
let docInfoCachedUntil = 0;
const docInfoCacheMs = Math.max(15000, Number(process.env.SHEETS_METADATA_CACHE_MS) || 60000);
let spreadsheetDateFormatPromise = null;

const getCache = () => globalCache;
async function loadDocInfo() {
  if (Date.now() < docInfoCachedUntil) return;
  if (!docInfoLoading) {
    docInfoLoading = Promise.allSettled(allDocuments.map(spreadsheet => spreadsheet.loadInfo())).then(results => {
      const failures = results.filter(result => result.status === 'rejected');
      if (failures.length === results.length && failures.length) throw failures[0].reason;
      failures.forEach(result => console.warn('Could not load one configured spreadsheet:', result.reason?.message || result.reason));
      docInfoCachedUntil = Date.now() + docInfoCacheMs;
    }).catch(error => {
      // Avoid retrying all workbook metadata requests on every API call while
      // Google Sheets is rate limiting this service account.
      docInfoCachedUntil = Date.now() + Math.min(docInfoCacheMs, 15000);
      throw error;
    });
  }
  const pendingLoad = docInfoLoading;
  try {
    return await pendingLoad;
  } finally {
    if (docInfoLoading === pendingLoad) docInfoLoading = null;
  }
}

async function ensureSpreadsheetDateFormats() {
  if (!spreadsheetDateFormatPromise) {
    spreadsheetDateFormatPromise = (async () => {
      // Formatting is a one-time startup operation per process. Allow operators
      // to disable it explicitly, but do not require a Render flag for newly
      // split workbooks to receive consistent formats.
      if (String(process.env.APPLY_SPREADSHEET_DATE_FORMATS || '').toLowerCase() === 'false') return [];

      const sheetsApi = google.sheets({ version: 'v4', auth: serviceAccountAuth });
      const summaries = [];
      for (const spreadsheetId of getActiveSpreadsheetIds()) {
        const metadata = await sheetsApi.spreadsheets.get({ spreadsheetId, fields: 'sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))' });
        const sheets = metadata.data?.sheets || [];
        const ranges = sheets.map(({ properties }) => `'${String(properties?.title || '').replace(/'/g, "''")}'!1:1`);
        const headerResponse = ranges.length
          ? await sheetsApi.spreadsheets.values.batchGet({ spreadsheetId, ranges, valueRenderOption: 'FORMATTED_VALUE' })
          : { data: { valueRanges: [] } };
        const headerRows = headerResponse.data?.valueRanges || [];
        const requests = [{
          updateSpreadsheetProperties: {
            properties: { locale: 'en_GB', timeZone: 'Asia/Kolkata' },
            fields: 'locale,timeZone'
          }
        }];
        let formattedColumns = 0;

        sheets.forEach(({ properties }, sheetIndex) => {
          const headerCells = headerRows[sheetIndex]?.values?.[0] || [];
          headerCells.forEach((header, columnIndex) => {
            const key = String(header || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (!key) return;
            let numberFormat = null;
            const isDateTime = /(timestamp|datetime|dateandtime|createdat|updatedat|submittedat|modifiedat|sentat|assignedat|loggedat|resolvedat|approvedat|rejectedat|publishedat|lastupdated|lastlogin|checkinat|checkoutat|addedat|changedat|notificationat)/.test(key) ||
              (/date/.test(key) && /time/.test(key));
            if (isDateTime) {
              numberFormat = { type: 'DATE_TIME', pattern: 'dd/MM/yyyy HH:mm:ss' };
            } else if (/time/.test(key)) {
              numberFormat = { type: 'TIME', pattern: 'HH:mm:ss' };
            } else if (/(date|birthday|dob|deadline|expiry|warranty|purchasedate|dateplaced|validuntil|duedate)/.test(key)) {
              numberFormat = { type: 'DATE', pattern: 'dd/MM/yyyy' };
            }
            if (!numberFormat) return;
            formattedColumns += 1;
            requests.push({
              repeatCell: {
                range: {
                  sheetId: properties.sheetId,
                  startRowIndex: 1,
                  endRowIndex: Math.max(2, Number(properties.gridProperties?.rowCount) || 1000),
                  startColumnIndex: columnIndex,
                  endColumnIndex: columnIndex + 1
                },
                cell: { userEnteredFormat: { numberFormat } },
                fields: 'userEnteredFormat.numberFormat'
              }
            });
          });
        });

        await sheetsApi.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
        summaries.push({ spreadsheetId, tabCount: sheets.length, formattedColumns });
        console.log(`🗓️ Applied DD/MM/YYYY, HH:MM:SS, and combined timestamp formats across ${formattedColumns} columns in ${sheets.length} spreadsheet tabs.`);
      }
      return summaries;
    })().catch(error => {
      spreadsheetDateFormatPromise = null;
      throw error;
    });
  }
  return spreadsheetDateFormatPromise;
}
async function fetchCacheBatch(sheetsApi, spreadsheetId, ranges) {
  return sheetsApi.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
    valueRenderOption: 'FORMATTED_VALUE',
  });
}

function scheduleCacheRetry() {
  if (scheduledCacheRetryTimer) return;
  consecutiveCacheRefreshFailures += 1;
  const waitMs = consecutiveCacheRefreshFailures === 1 ? 60000 : 120000;
  console.warn(`⚠️ Cache refresh will retry in ${Math.round(waitMs / 1000)} seconds.`);
  scheduledCacheRetryTimer = setTimeout(() => {
    scheduledCacheRetryTimer = null;
    refreshCache();
  }, waitMs);
}

function clearCacheRetry() {
  consecutiveCacheRefreshFailures = 0;
  if (scheduledCacheRetryTimer) clearTimeout(scheduledCacheRetryTimer);
  scheduledCacheRetryTimer = null;
}

function setWorksheetHeaderValues(sheet, values) {
  const headers = (Array.isArray(values) ? values : []).map(value => String(value ?? '').trim());
  // google-spreadsheet only populates headerValues through loadHeaderRow(),
  // which would issue one extra API read per tab. Cache the headers from the
  // batchGet response instead, so worksheet and cached-row consumers share the
  // same headers without making more Google Sheets requests.
  if (sheet) sheet._headerValues = headers;
  return headers;
}

function createCachedRows(sheet, values, headerValues) {
  const headers = Array.isArray(headerValues)
    ? setWorksheetHeaderValues(sheet, headerValues)
    : (sheet.headerValues || []);
  return (values || []).map((rawData, index) => ({
    _worksheet: sheet,
    _rawData: rawData,
    rowNumber: index + 2,
    get(header) {
      const columnIndex = headers.indexOf(header);
      return columnIndex < 0 ? undefined : (rawData[columnIndex] ?? '');
    },
    toObject() {
      return Object.fromEntries(headers
        .map((header, columnIndex) => [header, rawData[columnIndex] ?? ''])
        .filter(([header]) => Boolean(header)));
    },
  }));
}

async function performCacheRefresh() {
  if (isFetching) return false;
  isFetching = true;
  try {
    await loadDocInfo();
    try {
      await ensureSpreadsheetDateFormats();
    } catch (error) {
      // A formatting issue should not keep the portal from serving data.
      console.warn('Could not apply spreadsheet date formats:', error.message);
    }
    
    const getSheetFuzzy = (keyword) => {
      const cleanKeyword = keyword.toLowerCase().replace(/[^a-z0-9]/g, '');
      return doc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanKeyword));
    };

    const sheetsToFetch = [
      getSheetFuzzy("Data"), getSheetFuzzy("OpeningApplied"), getSheetFuzzy("NewsLetter"), getSheetFuzzy("Event"), getSheetFuzzy("Issues"), 
      getSheetFuzzy("TalentinoSchedule"), getSheetFuzzy("TalentinoAttendance"), getSheetFuzzy("Clients"), getSheetFuzzy("TPOLog"), 
      getSheetFuzzy("StudyMaterials"), getSheetFuzzy("TechQuestions"), getSheetFuzzy("TechResults"),
      getSheetFuzzy("AptitudeQuestions"), getSheetFuzzy("AptitudeResults"), getSheetFuzzy("TalentinoQuestions"), getSheetFuzzy("TalentinoResults"),
      getSheetFuzzy("Courses"), getSheetFuzzy("DriveRegistration"), getSheetFuzzy("Contact"), getSheetFuzzy("User"), getSheetFuzzy("Branches"), getSheetFuzzy("Mail"),
      doc.sheetsByTitle['Trainer/TL_Log'] || getSheetFuzzy("TrainerTLLog"), getSheetFuzzy("security"), getSheetFuzzy("TPOStats")
    ];

    const cacheFields = [
      'students', 'applications', 'vacancies', 'events', 'issues', 'tSched', 'tAtt', 'clients', 'tpoLogs',
      'materials', 'techQuestions', 'techResults', 'aptQuestions', 'aptResults', 'talQuestions', 'talResults',
      'coursesRows', 'drives', 'contacts', 'users', 'branches', 'mails', 'trainerLogs', 'securityLogs', 'tpoStats'
    ];
    const emptyCache = {
      students: [], applications: [], vacancies: [], events: [], issues: [], tSched: [], tAtt: [], clients: [],
      tpoLogs: [], materials: [], techQuestions: [], techResults: [], aptQuestions: [], aptResults: [],
      talQuestions: [], talResults: [], coursesRows: [], drives: [], contacts: [], users: [], branches: [],
      mails: [], trainerLogs: [], securityLogs: [], tpoStats: [], coursesDict: {}
    };
    const previousCache = globalCache || {};
    const cacheFailedSheets = [];
    const fetchedData = new Array(sheetsToFetch.length);
    const groupedIndexes = new Map();
    sheetsToFetch.forEach((sheet, index) => {
      if (!sheet) {
        cacheFailedSheets.push(cacheFields[index]);
        fetchedData[index] = previousCache[cacheFields[index]] || emptyCache[cacheFields[index]];
        return;
      }
      const spreadsheetId = getSpreadsheetIdForSheetName(sheet.title);
      if (!groupedIndexes.has(spreadsheetId)) groupedIndexes.set(spreadsheetId, []);
      groupedIndexes.get(spreadsheetId).push(index);
    });

    const sheetsApi = google.sheets({ version: 'v4', auth: serviceAccountAuth });
    const readSpreadsheetGroup = async (spreadsheetId, indexes) => {
      const selectedSheets = new Set(indexes.map(index => sheetsToFetch[index]));
      const additionalHeaderSheets = (documentsById.get(spreadsheetId)?.sheetsByIndex || [])
        .filter(sheet => !selectedSheets.has(sheet) && !Array.isArray(sheet._headerValues));
      const dataRanges = indexes.map(index => {
        const title = String(sheetsToFetch[index].title).replace(/'/g, "''");
        return `'${title}'!A1:ZZ`;
      });
      const headerRanges = additionalHeaderSheets.map(sheet => {
        const title = String(sheet.title).replace(/'/g, "''");
        return `'${title}'!1:1`;
      });
      try {
        // Fetch cached-tab contents and any other tab headers together. This
        // avoids the per-tab loadHeaderRow reads that exhausted Sheets quota
        // after splitting the old workbook into multiple spreadsheets.
        const response = await fetchCacheBatch(sheetsApi, spreadsheetId, [...dataRanges, ...headerRanges]);
        const valueRanges = response.data.valueRanges || [];
        indexes.forEach((index, rangeIndex) => {
          const sheetValues = valueRanges[rangeIndex]?.values || [];
          const headers = setWorksheetHeaderValues(sheetsToFetch[index], sheetValues[0] || []);
          fetchedData[index] = createCachedRows(sheetsToFetch[index], sheetValues.slice(1), headers);
        });
        additionalHeaderSheets.forEach((sheet, index) => {
          setWorksheetHeaderValues(sheet, valueRanges[indexes.length + index]?.values?.[0] || []);
        });
      } catch (error) {
        indexes.forEach(index => {
          const sheet = sheetsToFetch[index];
          const field = cacheFields[index];
          cacheFailedSheets.push(sheet?.title || field);
          fetchedData[index] = Array.isArray(previousCache[field]) ? previousCache[field] : emptyCache[field];
        });
        console.error(`⚠️ Could not refresh workbook group ${spreadsheetId}; keeping its previous cached tabs:`, error.message);
      }
    };

    // Load account records in their own batch so login is ready even if a
    // larger log tab fails to refresh. This is still one API read for both.
    const operationsSpreadsheetId = spreadsheetGroupIds.operations;
    if (groupedIndexes.has(operationsSpreadsheetId)) {
      const operationIndexes = groupedIndexes.get(operationsSpreadsheetId);
      const authIndexes = operationIndexes.filter(index => index === 18 || index === 19);
      await readSpreadsheetGroup(operationsSpreadsheetId, authIndexes);
      groupedIndexes.delete(operationsSpreadsheetId);
      const remainingOperationIndexes = operationIndexes.filter(index => index !== 18 && index !== 19);
      if (remainingOperationIndexes.length) await readSpreadsheetGroup(operationsSpreadsheetId, remainingOperationIndexes);
    }
    const contactRows = fetchedData[18] || previousCache.contacts || [];
    const userRows = fetchedData[19] || previousCache.users || [];
    globalCache = {
      ...emptyCache,
      ...previousCache,
      contacts: contactRows,
      users: userRows,
      authCacheReady: true,
      authSheetsHealthy: {
        contacts: !cacheFailedSheets.includes(sheetsToFetch[18]?.title || 'contacts'),
        users: !cacheFailedSheets.includes(sheetsToFetch[19]?.title || 'users'),
      },
    };

    // One batchGet per workbook replaces a separate Google API read for every
    // cache tab. Requests still use the four workbook-specific tab groups.
    for (const [spreadsheetId, indexes] of groupedIndexes) {
      await readSpreadsheetGroup(spreadsheetId, indexes);
    }

    const [
      stuRows, appRows, vacRows, eventRows, issueRows, tSchedRows, tAttRows, clientRows, tpoLogRows, 
      matRows, tqRows, trRows, aptQRows, aptRRows, talQRows, talRRows,
      courseRows, driveRows
    ] = fetchedData;
    const branchRows = fetchedData[20] || [];
    const mailRows = fetchedData[21] || [];
    const trainerLogRows = fetchedData[22] || [];
    const securityRows = fetchedData[23] || [];
    const tpoStatsRows = fetchedData[24] || [];

    let coursesDict = {};
    const courseSheet = sheetsToFetch[16];
    if (courseSheet) {
      const cRows = courseRows || [];
      let currentMain = "General";
      const headers = courseSheet.headerValues;
      if (headers[0] && headers[0].trim() !== '') { currentMain = headers[0].replace(/^\d+\.\s*/, '').trim(); coursesDict[currentMain] = []; }
      if (headers[1] && headers[1].trim() !== '') coursesDict[currentMain].push(headers[1].trim());

      cRows.forEach(r => {
         const valA = r._rawData[0]; const valB = r._rawData[1];
         if (valA && valA.trim() !== '') { currentMain = valA.replace(/^\d+\.\s*/, '').trim(); if (!coursesDict[currentMain]) coursesDict[currentMain] = []; }
         if (valB && valB.trim() !== '') { if (!coursesDict[currentMain]) coursesDict[currentMain] = []; coursesDict[currentMain].push(valB.trim()); }
      });
    }

    globalCache = { 
      students: stuRows, applications: appRows, vacancies: vacRows, events: eventRows, issues: issueRows, 
      tSched: tSchedRows, tAtt: tAttRows, clients: clientRows, tpoLogs: tpoLogRows, materials: matRows, 
      techQuestions: tqRows, techResults: trRows, aptQuestions: aptQRows, aptResults: aptRRows, 
      talQuestions: talQRows, talResults: talRRows, coursesDict: coursesDict, drives: driveRows,
      contacts: contactRows, users: userRows, branches: branchRows, mails: mailRows,
      trainerLogs: trainerLogRows,
      securityLogs: securityRows,
      tpoStats: tpoStatsRows,
      authCacheReady: true,
      authSheetsHealthy: globalCache.authSheetsHealthy,
      cacheUpdatedAt: new Date().toISOString()
    };
    
    if (cacheFailedSheets.length) {
      console.warn(`⚠️ Cache refresh completed with ${cacheFailedSheets.length} unavailable sheet(s): ${[...new Set(cacheFailedSheets)].join(', ')}`);
      scheduleCacheRetry();
    } else {
      clearCacheRetry();
      console.log("✅ Cache successfully synced with Google Sheets!");
    }
    isFetching = false;
    return cacheFailedSheets.length === 0;
  } catch (err) { 
    console.error("❌ Cache sync failed:", err.message); 
    isFetching = false;
    scheduleCacheRetry();
    return false;
  }
}

function refreshCache() {
  if (cacheRefreshPromise) {
    // If a sheet write happens during a refresh, run one more pass as soon as
    // the current pass finishes so the cache can't remain one write behind.
    cacheRefreshRequested = true;
    return cacheRefreshPromise;
  }
  const currentRefresh = performCacheRefresh();
  cacheRefreshPromise = currentRefresh;
  currentRefresh.then(succeeded => {
    cacheRefreshPromise = null;
    if (cacheRefreshRequested) {
      cacheRefreshRequested = false;
      // A successful pass can immediately catch a write that landed mid-read.
      // Failed passes use the scheduled one- or two-minute retry instead.
      if (succeeded) refreshCache();
    }
  }).catch(error => {
    cacheRefreshPromise = null;
    console.error('Unexpected cache refresh error:', error.message);
  });
  return currentRefresh;
}

refreshCache();
// Pick up manual Google Sheets edits within two minutes. Writes made through
// the portal request an immediate refresh rather than waiting for this poll.
setInterval(refreshCache, 120000);

const getStandardCourse = (c) => {
  if (!c) return 'Others';
  const lower = c.toLowerCase().trim();
  if (lower.includes('bms') || lower.includes('cctv')) return 'BMS AND CCTV';
  if (lower.includes('automation') || lower.includes('plc') || lower.includes('scada')) return 'Industrial Automation';
  if (lower.includes('embed') || lower.includes('iot')) return 'Embedded and IoT';
  if (lower.includes('digital') || lower.includes('dm') || lower.includes('marketing')) return 'Digital Marketing';
  if (lower.includes('information technology') || /(^|[^a-z])it([^a-z]|$)/.test(lower) || lower.includes('python') || lower.includes('software') || lower.includes('data science') || lower.includes('data analytics') || lower.includes('artificial intelligence') || lower.includes('cyber security') || lower.includes('web development') || lower.includes('java') || lower.includes('php')) return 'Information technology (IT)';
  return 'Others';
};

const normalizeAssignmentList = value => {
  const values = Array.isArray(value) ? value : String(value || '').split(/[\n,;]+/);
  return values.map(item => String(item || '').trim().replace(/^\d+\.\s*/, '').toLowerCase()).filter(item => item && !/^(?:[-–—]|n\/a|none)$/i.test(item));
};

function checkBranchMatch(branch, tpoBranchesArray) {
  const branches = normalizeAssignmentList(tpoBranchesArray);
  if (!branch || !branches.length) return false;
  let cleanSB = branch.toString().toLowerCase().trim();
  if (branches.includes("all") || cleanSB === "all") return true;
  return branches.some(b => cleanSB === b || cleanSB.includes(b) || b.includes(cleanSB));
}

function hasAccess(rowBranch, rowCourse, role, assignedBranchesArray, assignedCourse, department = '') {
  if (!role) role = 'TPO'; 
  const upperRole = role.toUpperCase();
  const upperDepartment = String(department || '').trim().toUpperCase();
  const hasRoleToken = (token) => new RegExp(`(^|[^A-Z0-9])${token}([^A-Z0-9]|$)`).test(upperRole);
  if (upperRole.includes('ADMIN') || upperRole === 'GENERAL MANAGER' || upperRole === 'TECHNICAL HEAD' || upperRole === 'ZONAL PLACEMENT HEAD') return true; 

  const stdRowCourse = getStandardCourse(rowCourse);
  const isRth = hasRoleToken('RTH') || upperRole === 'REGIONAL TECHNICAL HEAD';
  const isTth = hasRoleToken('TTH') || upperRole.includes('TERRITORY TECHNICAL HEAD');
  const isTechnicalLead = /TECH(?:NICAL)?\s+LEAD/.test(upperRole) || hasRoleToken('TL');
  const isTrainerRole = upperRole.includes('TRAINER');
  const isTrainer = isTrainerRole && (!upperDepartment || upperDepartment === 'ACADEMIC');
  const matchBranch = checkBranchMatch(rowBranch, assignedBranchesArray);
  if (isTrainerRole && !isTrainer) return false;
  if (!matchBranch) return false;

  // A Technical Lead owns one branch and can review every course in that branch.
  if (isTechnicalLead && !isRth && !isTth) return true;

  // RTH/TTH and trainers must be assigned both dimensions. An empty course
  // assignment must never silently widen access to every course.
  if (isRth || isTth || isTrainer) {
    const courses = normalizeAssignmentList(assignedCourse);
    if (!courses.length || courses.includes('all') || courses.includes('all courses')) return false;
    return courses.some(course => getStandardCourse(course) === stdRowCourse);
  }

  // All other operational roles are constrained to their assigned branch(es).
  return true;
}

const getFuzzyHeader = (headers, target) => {
  const cleanTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '');
  return headers.find(h => h.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget) || target;
};

const getUserEmailById = (userId) => {
  if (!globalCache || !globalCache.users || !userId) return '';
  const cleanId = String(userId).trim().toLowerCase();
  
  const row = globalCache.users.find(r => {
    const rd = r.toObject();
    const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const uid = (rd[getH('userid')] || '').toLowerCase().trim();
    return uid === cleanId;
  });
  
  if (row) {
    const rd = row.toObject();
    const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
    return rd[getH('email')] || rd[getH('mailid')] || '';
  }
  return '';
};

const getTpoEmail = (tpoName) => {
  if (!globalCache || !globalCache.contacts) return '';
  const searchName = (tpoName || '').toLowerCase().replace(/\s/g, '');
  const row = globalCache.contacts.find(r => {
    const rd = r.toObject();
    const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const name = (rd[getH('tponame')] || rd[getH('name')] || '').toLowerCase().replace(/\s/g, '');
    return name === searchName;
  });
  if (row) {
    const rd = row.toObject();
    const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
    return rd[getH('mailid')] || rd[getH('email')] || '';
  }
  return '';
};

const getBranchManagerEmail = (branch) => {
  if (!globalCache || !globalCache.users) return '';
  const searchBranch = (branch || '').toLowerCase().replace(/branch/g, '').trim();
  
  const row = globalCache.users.find(r => {
    const rd = r.toObject();
    const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
    
    const role = (rd[getH('role')] || '').toLowerCase().replace(/\s/g, '');
    const br = (rd[getH('assignedbranches')] || rd[getH('sittingbranch')] || '').toLowerCase();
    const status = (rd[getH('status')] || '').toLowerCase();
    const mailEligible = (rd[getH('maileligible')] || '').toLowerCase();
    
    const isBM = role.includes('branchmanager');
    const isActive = status === 'active' || status === ''; 
    const isEligible = mailEligible === 'yes' || mailEligible === '';
    const matchesBranch = br.includes(searchBranch) || br === 'all';
    
    return isBM && isActive && isEligible && matchesBranch;
  });
  
  if (row) {
    const rd = row.toObject();
    const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
    return rd[getH('email')] || rd[getH('mailid')] || '';
  }
  return '';
};

const getAllTpoEmails = () => {
  if (!globalCache || !globalCache.contacts) return [];
  return globalCache.contacts.map(r => {
    const rd = r.toObject();
    const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
    return rd[getH('mailid')] || rd[getH('email')] || '';
  }).filter(Boolean);
};

const getAllBranchManagerEmails = () => {
  if (!globalCache || !globalCache.users) return [];
  return globalCache.users.filter(r => {
    const rd = r.toObject();
    const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const role = (rd[getH('role')] || '').toLowerCase().replace(/\s/g, '');
    const status = (rd[getH('status')] || '').toLowerCase();
    const mailEligible = (rd[getH('maileligible')] || '').toLowerCase();
    
    return role.includes('branchmanager') && (status === 'active' || status === '') && (mailEligible === 'yes' || mailEligible === '');
  }).map(r => {
    const rd = r.toObject();
    const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
    return rd[getH('email')] || rd[getH('mailid')] || '';
  }).filter(Boolean);
};

const getSuperAdminEmails = () => {
  if (!globalCache || !globalCache.users) return [];
  return globalCache.users.filter(r => {
    const rd = r.toObject();
    const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const role = (rd[getH('role')] || '').toLowerCase();
    const access = (rd[getH('accesstype')] || rd[getH('access')] || '').toLowerCase();
    return access.includes('admin') || role.includes('general manager') || role.includes('technical head') || role.includes('zonal');
  }).map(r => {
    const rd = r.toObject();
    const getH = (str) => Object.keys(rd).find(k => k.toLowerCase().replace(/[^a-z0-9]/g, '') === str.toLowerCase().replace(/[^a-z0-9]/g, ''));
    return rd[getH('email')] || rd[getH('mailid')] || '';
  }).filter(Boolean);
};

const emailService = createEmailService({
  doc,
  drive,
  loadDocInfo,
  refreshCache,
  formatIndiaTimestamp,
  sheetsApi: google.sheets({ version: 'v4', auth: serviceAccountAuth }),
  getSpreadsheetIdForSheetName
});

async function sendIPCSMail(mailOptions, sendDetails) {
  const category = String(sendDetails?.category || 'placement').trim().toLowerCase();
  console.log(`[MAIL DISPATCH] Category: ${category} | Subject: ${mailOptions.subject || '(no subject)'}`);
  return emailService.sendMail(mailOptions, sendDetails || { category });
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

module.exports = { 
  doc, drive, google, serviceAccountAuth, getCache, refreshCache, loadDocInfo, hasAccess, getFuzzyHeader,
  getSpreadsheetIdForSheetName, getActiveSpreadsheetIds, ensureSpreadsheetDateFormats,
  sendIPCSMail, startEmailWorker: emailService.startWorker, processEmailQueue: emailService.processQueue,
  startMailDashboardRefresh: emailService.startMailDashboardRefresh,
  refreshMailDashboard: emailService.refreshMailDashboard,
  sendScheduledMailReport: emailService.sendScheduledMailReport,
  uploadToDrive,
  getTpoEmail, getBranchManagerEmail, getAllTpoEmails, getAllBranchManagerEmails, getSuperAdminEmails,
  getUserEmailById
};
