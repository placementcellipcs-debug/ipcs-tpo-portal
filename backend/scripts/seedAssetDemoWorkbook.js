require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { JWT } = require('google-auth-library');
const { google } = require('googleapis');
const { sheets: demoSheets } = require('../src/assetDemoWorkbook');

const normalizeTitle = value => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
const escapeSheetTitle = value => `'${String(value).replace(/'/g, "''")}'`;

async function seed() {
  if (process.env.NODE_ENV === 'production') throw new Error('Demo seeding is disabled in production.');
  if (String(process.env.ASSET_DEMO_SEED || '').toLowerCase() !== 'true') throw new Error('Set ASSET_DEMO_SEED=true to authorize the one-time demo seed.');
  const testSpreadsheetId = String(process.env.ASSET_TEST_SPREADSHEET_ID || '').trim();
  const productionSpreadsheetId = String(process.env.ASSET_SPREADSHEET_ID || '17tEo324Xyfc3ku98hmsnKZDry4OgCt_hnUlK8hGtVXA').trim();
  if (!testSpreadsheetId) throw new Error('Set ASSET_TEST_SPREADSHEET_ID to a separate test workbook.');
  if (testSpreadsheetId === productionSpreadsheetId) throw new Error('The demo workbook ID matches the configured live asset workbook. Refusing to write.');

  const serviceEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = String(process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!serviceEmail || !privateKey) throw new Error('Google service account credentials are required.');
  const auth = new JWT({ email: serviceEmail, key: privateKey, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const api = google.sheets({ version: 'v4', auth });
  const info = await api.spreadsheets.get({ spreadsheetId: testSpreadsheetId, fields: 'properties.title,sheets.properties(sheetId,title)' });
  const title = info.data.properties?.title || '';
  if (!/(demo|test|staging)/i.test(title)) throw new Error('The target workbook title must include DEMO, TEST, or STAGING.');
  const currentSheets = info.data.sheets || [];
  const byTitle = new Map(currentSheets.map(item => [normalizeTitle(item.properties?.title), item.properties]));
  const configuredTitles = Object.keys(demoSheets);

  // Refuse to overwrite sample or production records already in the test file.
  for (const sheetTitle of configuredTitles) {
    const existing = byTitle.get(normalizeTitle(sheetTitle));
    if (!existing) continue;
    const values = await api.spreadsheets.values.get({ spreadsheetId: testSpreadsheetId, range: `${escapeSheetTitle(sheetTitle)}!A1:ZZ` });
    const rows = values.data.values || [];
    if (rows.slice(1).some(row => row.some(cell => String(cell || '').trim()))) {
      throw new Error(`The test tab “${sheetTitle}” already contains records. No demo data was written.`);
    }
  }

  const missingTitles = configuredTitles.filter(sheetTitle => !byTitle.has(normalizeTitle(sheetTitle)));
  if (missingTitles.length) {
    await api.spreadsheets.batchUpdate({
      spreadsheetId: testSpreadsheetId,
      requestBody: { requests: missingTitles.map(title => ({ addSheet: { properties: { title } } })) }
    });
  }

  const data = configuredTitles.map(sheetTitle => {
    const { headers, rows } = demoSheets[sheetTitle];
    return { range: `${escapeSheetTitle(sheetTitle)}!A1`, majorDimension: 'ROWS', values: [headers, ...rows] };
  });
  await api.spreadsheets.values.batchUpdate({
    spreadsheetId: testSpreadsheetId,
    requestBody: { valueInputOption: 'RAW', data }
  });
  console.log(`Seeded ${configuredTitles.length} tabs with fictional demonstration data in a test workbook.`);
}

seed().catch(error => {
  console.error(`Asset demo seed stopped safely: ${error.message}`);
  process.exitCode = 1;
});
