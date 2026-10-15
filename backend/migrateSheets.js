const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const { google } = require('googleapis');
const { JWT } = require('google-auth-library');

const SOURCE_PRIMARY_ID = process.env.SPREADSHEET_ID || '1Dyz7hu53KyOV5rC9YU4y7t0GDGUtkfIqrMH1mTZtLFk';
const SOURCE_ACADEMIC_ID = process.env.ACADEMIC_SPREADSHEET_ID || '1mhTuK_3dXLKk1DcUCTA7KFWHiCKirwmYP6l7wMLYPlo';
const DESTINATIONS = {
  students: { id: '14WvBO50cY66NLQVQXs1OrR-jcOD6AQSKz9Yya60KG3o', title: 'IPCS Students' },
  placements: { id: '1eSMP6u8G11ErXOYS1XTU0qR4RvyCNcFQtP19dHkNz5c', title: 'IPCS Placements & Recruitment' },
  learning: { id: '18alS1bVj33kZ8wX7VcQiwrPzLSfOyQWkc8fRooTD7Nk', title: 'IPCS Learning & Academics' },
  operations: { id: '1qLS3e0xJX0IVhNoGFGM8uPtet7mxI6QHzpz-AwfoBnI', title: 'IPCS Operations & System Logs' },
};

const GROUPS = {
  students: [
    ['Data', 'primary'],
    ['Student_Diary', 'primary'],
    ['Leave_Applications', 'primary'],
  ],
  placements: [
    ['NewsLetter', 'primary'],
    ['Event', 'primary'],
    ['Drive_Registration', 'primary'],
    ['Opening_Applied', 'primary'],
    ['Clients', 'primary'],
    ['TPO_Log', 'primary'],
    ['TPO_Stats', 'primary'],
    ['Corporate Training Inquiries', 'primary'],
  ],
  learning: [
    ['Courses', 'primary'],
    ['Study_Materials', 'primary'],
    ['Talentino_Schedule', 'primary'],
    ['Talentino_Attendance', 'primary'],
    ['Tech_Questions', 'primary'],
    ['Tech_Results', 'primary'],
    ['Aptitude_Questions', 'primary'],
    ['Aptitude_Results', 'primary'],
    ['Talentino_Questions', 'primary'],
    ['Talentino_Results', 'primary'],
    ['Training', 'academic'],
    ['Batches', 'academic'],
    ['Topics', 'academic'],
    ['Sessions', 'academic'],
    ['Attendance', 'academic'],
    ['Topic_Progress', 'academic'],
    ['Diary', 'academic'],
    ['Trainer_Remarks', 'academic'],
    ['Assignments', 'academic'],
    ['Assessments', 'academic'],
    ['Assessment_Results', 'academic'],
    ['Activities', 'academic'],
    ['Certificate_Requests', 'academic'],
    ['Certificates', 'academic'],
    ['Attendance_Corrections', 'academic'],
    ['Audit_Log', 'academic'],
  ],
  operations: [
    ['Contact', 'primary'],
    ['User', 'primary'],
    ['Branches', 'primary'],
    ['Issues', 'primary'],
    ['Security_Logs', 'primary'],
    ['Auth_Sessions', 'primary'],
    ['Password_Reset_Tokens', 'primary'],
    ['Mail', 'primary'],
    ['EmailQueue', 'primary'],
    ['EmailQuotaUsage', 'primary'],
    ['Trainer/TL_Log', 'primary'],
  ],
};

const HIRING_INQUIRY_HEADERS = [
  'Inquiry ID', 'Submitted At', 'Company', 'Website', 'Contact Person', 'Email', 'Phone', 'Location',
  'Position', 'Course / Skills', 'Opening Count', 'Work Mode', 'Last Date', 'Qualification', 'Experience',
  'Salary', 'Gender Preference', 'Job Description', 'Notes', 'Status', 'Assigned TPO', 'Assigned TPO Email',
  'Assigned At', 'Assigned By', 'Notification Status', 'Notification Sent At', 'Internal Email Status',
];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const quoteTitle = title => `'${String(title).replace(/'/g, "''")}'`;
const isQuotaError = error => error?.response?.status === 429 || /quota exceeded|rate limit/i.test(String(error?.message || ''));

async function withRetry(label, operation) {
  const delays = [60_000, 120_000, 240_000];
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isQuotaError(error) || attempt >= delays.length) throw error;
      console.warn(`${label}: Google Sheets quota is busy. Retrying in ${Math.round(delays[attempt] / 1000)} seconds.`);
      await sleep(delays[attempt]);
    }
  }
}

async function readSpreadsheetMeta(api, spreadsheetId) {
  const result = await withRetry(`Read spreadsheet ${spreadsheetId}`, () => api.spreadsheets.get({
    spreadsheetId,
    fields: 'spreadsheetId,properties(title),sheets(properties(sheetId,title,index,gridProperties(rowCount,columnCount)))',
  }));
  return result.data;
}

async function isSheetEmpty(api, spreadsheetId, title) {
  const result = await withRetry(`Check empty tab ${title}`, () => api.spreadsheets.values.get({
    spreadsheetId,
    range: `${quoteTitle(title)}!A:ZZ`,
    valueRenderOption: 'FORMULA',
  }));
  return !(result.data.values || []).some(row => row.some(value => value !== '' && value !== null && value !== undefined));
}

async function copyTab(api, sourceSpreadsheetId, sourceSheetId, destinationSpreadsheetId) {
  return withRetry(`Copy source tab ${sourceSheetId}`, () => api.spreadsheets.sheets.copyTo({
    spreadsheetId: sourceSpreadsheetId,
    sheetId: sourceSheetId,
    requestBody: { destinationSpreadsheetId },
  }));
}

async function main() {
  const serviceAccountEmail = String(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim();
  const privateKey = String(process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!serviceAccountEmail || !privateKey) throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY must be set in backend/.env.');

  const auth = new JWT({
    email: serviceAccountEmail,
    key: privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const api = google.sheets({ version: 'v4', auth });
  const sourceIds = { primary: SOURCE_PRIMARY_ID, academic: SOURCE_ACADEMIC_ID };
  const sourceMetadata = {};
  for (const [key, id] of Object.entries(sourceIds)) sourceMetadata[key] = await readSpreadsheetMeta(api, id);

  const sourceSheets = Object.fromEntries(Object.entries(sourceMetadata).map(([key, metadata]) => [
    key,
    new Map((metadata.sheets || []).map(sheet => [sheet.properties.title, sheet.properties])),
  ]));

  const destinations = {};
  for (const [key, destination] of Object.entries(DESTINATIONS)) {
    const metadata = await readSpreadsheetMeta(api, destination.id);
    if (metadata.properties?.title !== destination.title) {
      throw new Error(`Destination ${key} has the unexpected title "${metadata.properties?.title || '(untitled)'}".`);
    }
    destinations[key] = {
      ...destination,
      sheets: new Map((metadata.sheets || []).map(sheet => [sheet.properties.title, sheet.properties])),
      blankStarterTitles: [],
    };
  }

  const missingSources = [];
  for (const [group, tabs] of Object.entries(GROUPS)) {
    for (const [title, sourceKey] of tabs) {
      if (!sourceSheets[sourceKey].has(title)) missingSources.push(`${sourceKey}:${title}`);
    }
  }
  if (missingSources.length) throw new Error(`Preflight stopped; source tabs missing: ${missingSources.join(', ')}`);

  // A clean starter tab can be removed after copies. Preserve and rename it if it contains any data.
  for (const [key, destination] of Object.entries(destinations)) {
    const starter = [...destination.sheets.keys()].filter(title => /^Sheet\d+$/i.test(title));
    for (const title of starter) {
      if (await isSheetEmpty(api, destination.id, title)) destination.blankStarterTitles.push(title);
    }
    console.log(`Preflight ${key}: ${destination.sheets.size} existing tab(s), ${destination.blankStarterTitles.length} blank starter tab(s).`);
  }

  const totalSourceTabs = Object.values(GROUPS).reduce((sum, tabs) => sum + tabs.length, 0);
  console.log(`Copying ${totalSourceTabs} source tabs. Original workbooks will not be changed.`);
  let copied = 0;
  let skipped = 0;

  for (const [group, tabs] of Object.entries(GROUPS)) {
    const destination = destinations[group];
    const renameById = new Map();
    for (const [index, [title, sourceKey]] of tabs.entries()) {
      const sourceProperties = sourceSheets[sourceKey].get(title);
      if (destination.sheets.has(title)) {
        renameById.set(destination.sheets.get(title).sheetId, { title, index });
        skipped += 1;
        continue;
      }

      const partialCopyName = `Copy of ${title}`;
      if (destination.sheets.has(partialCopyName)) {
        renameById.set(destination.sheets.get(partialCopyName).sheetId, { title, index });
        destination.sheets.set(title, destination.sheets.get(partialCopyName));
        copied += 1;
        console.log(`Recovered previously copied tab: ${group}/${title}`);
        continue;
      }

      const response = await copyTab(api, sourceMetadata[sourceKey].spreadsheetId, sourceProperties.sheetId, destination.id);
      const copiedSheetId = response.data.sheetId;
      renameById.set(copiedSheetId, { title, index });
      destination.sheets.set(`Copy of ${title}`, { sheetId: copiedSheetId, title: `Copy of ${title}` });
      copied += 1;
      console.log(`Copied ${group}/${title} (${copied}/${totalSourceTabs})`);
      await sleep(1200);
    }

    const requests = [];
    for (const [sheetId, target] of renameById) {
      requests.push({ updateSheetProperties: { properties: { sheetId, title: target.title }, fields: 'title' } });
    }
    for (const title of destination.blankStarterTitles) {
      const sheet = destination.sheets.get(title);
      if (sheet) requests.push({ deleteSheet: { sheetId: sheet.sheetId } });
    }

    let hiringSheetId = null;
    if (group === 'placements' && !destination.sheets.has('Hiring Inquiries')) {
      hiringSheetId = Math.max(0, ...[...destination.sheets.values()].map(sheet => Number(sheet.sheetId) || 0)) + 1;
      const position = tabs.length;
      requests.push({ addSheet: { properties: { sheetId: hiringSheetId, title: 'Hiring Inquiries', index: position, gridProperties: { frozenRowCount: 1, columnCount: HIRING_INQUIRY_HEADERS.length } } } });
      requests.push({
        updateCells: {
          start: { sheetId: hiringSheetId, rowIndex: 0, columnIndex: 0 },
          rows: [{ values: HIRING_INQUIRY_HEADERS.map(value => ({ userEnteredValue: { stringValue: value } })) }],
          fields: 'userEnteredValue',
        },
      });
      requests.push({
        repeatCell: {
          range: { sheetId: hiringSheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: { userEnteredFormat: { backgroundColor: { red: 0.15, green: 0.24, blue: 0.4 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true }, wrapStrategy: 'WRAP' } },
          fields: 'userEnteredFormat(backgroundColor,textFormat,wrapStrategy)',
        },
      });
    }

    // Place tabs in a predictable order matching the app's main workflow.
    const orderedSheetIds = tabs.map(([title]) => {
      const exact = destination.sheets.get(title);
      if (exact) return exact.sheetId;
      const copy = destination.sheets.get(`Copy of ${title}`);
      return copy?.sheetId;
    }).filter(Boolean);
    if (hiringSheetId) orderedSheetIds.push(hiringSheetId);
    orderedSheetIds.forEach((sheetId, index) => {
      requests.push({ updateSheetProperties: { properties: { sheetId, index }, fields: 'index' } });
    });

    if (requests.length) {
      await withRetry(`Finalize ${group}`, () => api.spreadsheets.batchUpdate({
        spreadsheetId: destination.id,
        requestBody: { requests },
      }));
    }
  }

  const verification = {};
  for (const [group, destination] of Object.entries(DESTINATIONS)) {
    const metadata = await readSpreadsheetMeta(api, destination.id);
    const expected = [...GROUPS[group].map(([title]) => title), ...(group === 'placements' ? ['Hiring Inquiries'] : [])];
    const actual = new Map((metadata.sheets || []).map(sheet => [sheet.properties.title, sheet.properties]));
    const missing = expected.filter(title => !actual.has(title));
    if (missing.length) throw new Error(`Verification failed for ${group}; missing tabs: ${missing.join(', ')}`);
    const unexpected = [...actual.keys()].filter(title => !expected.includes(title));
    if (unexpected.length) throw new Error(`Verification found unexpected tabs in ${group}: ${unexpected.join(', ')}`);
    for (const [title, sourceKey] of GROUPS[group]) {
      const sourceProperties = sourceSheets[sourceKey].get(title);
      const destinationProperties = actual.get(title);
      if (sourceProperties.gridProperties?.rowCount !== destinationProperties.gridProperties?.rowCount ||
          sourceProperties.gridProperties?.columnCount !== destinationProperties.gridProperties?.columnCount) {
        throw new Error(`Verification failed for ${group}/${title}; source and destination grid sizes differ.`);
      }
    }
    verification[group] = { url: `https://docs.google.com/spreadsheets/d/${destination.id}/edit`, tabs: actual.size };
  }

  // Compare the header and first data row of a representative table in each file.
  // The cell contents stay in memory; only pass/fail status is printed.
  const primarySamples = [
    ['students', 'Data'], ['placements', 'NewsLetter'], ['learning', 'Courses'], ['operations', 'Contact'],
  ];
  const primarySourceSamples = await withRetry('Verify primary source samples', () => api.spreadsheets.values.batchGet({
    spreadsheetId: sourceIds.primary,
    ranges: primarySamples.map(([, title]) => `${quoteTitle(title)}!A1:AZ2`),
    valueRenderOption: 'FORMULA',
  }));
  const learningSourceSample = await withRetry('Verify academic source sample', () => api.spreadsheets.values.get({
    spreadsheetId: sourceIds.academic,
    range: `${quoteTitle('Training')}!A1:AZ2`,
    valueRenderOption: 'FORMULA',
  }));
  const sampleResults = [];
  for (const [index, [group, title]] of primarySamples.entries()) {
    const destinationSample = await withRetry(`Verify ${group} sample`, () => api.spreadsheets.values.get({
      spreadsheetId: DESTINATIONS[group].id,
      range: `${quoteTitle(title)}!A1:AZ2`,
      valueRenderOption: 'FORMULA',
    }));
    const sourceRows = primarySourceSamples.data.valueRanges?.[index]?.values || [];
    const destinationRows = destinationSample.data.values || [];
    const matches = JSON.stringify(sourceRows) === JSON.stringify(destinationRows);
    sampleResults.push({ group, tab: title, sampleMatches: matches });
    if (!matches) throw new Error(`Verification failed for ${group}/${title}; header/data sample differs from source.`);
  }
  const academicDestinationSample = await withRetry('Verify learning academic sample', () => api.spreadsheets.values.get({
    spreadsheetId: DESTINATIONS.learning.id,
    range: `${quoteTitle('Training')}!A1:AZ2`,
    valueRenderOption: 'FORMULA',
  }));
  const academicMatches = JSON.stringify(learningSourceSample.data.values || []) === JSON.stringify(academicDestinationSample.data.values || []);
  sampleResults.push({ group: 'learning', tab: 'Training', sampleMatches: academicMatches });
  if (!academicMatches) throw new Error('Verification failed for learning/Training; header/data sample differs from source.');

  console.log(JSON.stringify({ success: true, copied, skipped, verification, sampleResults }, null, 2));
}

main().catch(error => {
  console.error('Sheet migration stopped:', error.response?.data?.error?.message || error.message);
  process.exitCode = 1;
});
