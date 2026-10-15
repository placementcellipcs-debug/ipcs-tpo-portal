require('dotenv').config({ path: require('node:path').resolve(__dirname, '.env') });

const { google } = require('googleapis');
const { JWT } = require('google-auth-library');

const defaultSpreadsheetIds = {
  students: '14WvBO50cY66NLQVQXs1OrR-jcOD6AQSKz9Yya60KG3o',
  placements: '1eSMP6u8G11ErXOYS1XTU0qR4RvyCNcFQtP19dHkNz5c',
  learning: '18alS1bVj33kZ8wX7VcQiwrPzLSfOyQWkc8fRooTD7Nk',
  operations: '1qLS3e0xJX0IVhNoGFGM8uPtet7mxI6QHzpz-AwfoBnI',
};

const spreadsheetIds = {
  students: process.env.STUDENT_DATA_SPREADSHEET_ID || defaultSpreadsheetIds.students,
  placements: process.env.PLACEMENT_SPREADSHEET_ID || defaultSpreadsheetIds.placements,
  learning: process.env.LEARNING_SPREADSHEET_ID || defaultSpreadsheetIds.learning,
  operations: process.env.OPERATIONS_SPREADSHEET_ID || defaultSpreadsheetIds.operations,
};
const verifyOnly = process.argv.includes('--verify-only');
const requestedGroup = process.argv.find(value => value.startsWith('--group='))?.split('=')[1];
const requestedTab = process.argv.find(value => value.startsWith('--tab='))?.split('=')[1];
const normalizeHeader = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const getNumberFormat = header => {
  const key = normalizeHeader(header);
  if (!key) return null;

  const isTimestamp = /(timestamp|datetime|dateandtime|createdat|updatedat|submittedat|modifiedat|sentat|assignedat|loggedat|resolvedat|approvedat|rejectedat|publishedat|lastupdated|lastlogin|checkinat|checkoutat|addedat|changedat|notificationat)/.test(key) ||
    (/date/.test(key) && /time/.test(key));
  if (isTimestamp) return { type: 'DATE_TIME', pattern: 'dd/MM/yyyy HH:mm:ss' };
  if (/time/.test(key)) return { type: 'TIME', pattern: 'HH:mm:ss' };
  if (/(date|birthday|dob|deadline|expiry|warranty|purchasedate|dateplaced|validuntil|duedate)/.test(key)) {
    return { type: 'DATE', pattern: 'dd/MM/yyyy' };
  }
  return null;
};
const quoteSheetTitle = title => `'${String(title).replace(/'/g, "''")}'`;
const toColumnName = index => {
  let result = '';
  let column = index + 1;
  while (column > 0) {
    const remainder = (column - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    column = Math.floor((column - 1) / 26);
  }
  return result;
};

async function main() {
  const email = String(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim();
  const key = String(process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY must be set in backend/.env.');

  const auth = new JWT({ email, key, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
  const api = google.sheets({ version: 'v4', auth });
  let totalTabs = 0;
  let totalColumns = 0;
  let totalVerified = 0;
  const mismatches = [];

  for (const [group, spreadsheetId] of Object.entries(spreadsheetIds)) {
    if (requestedGroup && requestedGroup !== group) continue;
    const metadata = await api.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))',
    });
    const sheets = (metadata.data?.sheets || []).filter(({ properties }) => !requestedTab || properties.title === requestedTab);
    const headerRanges = sheets.map(({ properties }) => `${quoteSheetTitle(properties.title)}!1:1`);
    const headerResult = headerRanges.length
      ? await api.spreadsheets.values.batchGet({ spreadsheetId, ranges: headerRanges, valueRenderOption: 'FORMATTED_VALUE' })
      : { data: { valueRanges: [] } };
    const targetsBySheet = [];
    const requests = [{
      updateSpreadsheetProperties: {
        properties: { locale: 'en_GB', timeZone: 'Asia/Kolkata' },
        fields: 'locale,timeZone',
      },
    }];

    sheets.forEach(({ properties }, sheetIndex) => {
      const headers = headerResult.data?.valueRanges?.[sheetIndex]?.values?.[0] || [];
      const targets = [];
      headers.forEach((header, columnIndex) => {
        const numberFormat = getNumberFormat(header);
        if (!numberFormat) return;
        targets.push({ header: String(header), columnIndex, numberFormat });
        requests.push({
          repeatCell: {
            range: {
              sheetId: properties.sheetId,
              startRowIndex: 1,
              endRowIndex: Math.max(2, Number(properties.gridProperties?.rowCount) || 1000),
              startColumnIndex: columnIndex,
              endColumnIndex: columnIndex + 1,
            },
            cell: { userEnteredFormat: { numberFormat } },
            fields: 'userEnteredFormat.numberFormat',
          },
        });
      });
      if (targets.length) targetsBySheet.push({ title: properties.title, targets });
    });

    if (!verifyOnly) await api.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
    totalTabs += sheets.length;
    totalColumns += targetsBySheet.reduce((sum, sheet) => sum + sheet.targets.length, 0);

    // Read back only cell formatting (no student or company values) for row 2
    // of each affected tab to confirm the API accepted the requested patterns.
    if (targetsBySheet.length) {
      const ranges = targetsBySheet.map(({ title }) => `${quoteSheetTitle(title)}!A2:ZZ2`);
      const verification = await api.spreadsheets.get({
        spreadsheetId,
        ranges,
        includeGridData: true,
        fields: 'sheets(properties(title),data(startColumn,rowData(values(userEnteredFormat(numberFormat)))))',
      });
      const verifiedSheets = verification.data?.sheets || [];
      const targetsByTitle = new Map(targetsBySheet.map(item => [item.title, item.targets]));
      for (const sheet of verifiedSheets) {
        const title = sheet.properties?.title;
        const targets = targetsByTitle.get(title) || [];
        const data = sheet.data?.[0];
        const firstColumn = data?.startColumn || 0;
        const cells = data?.rowData?.[0]?.values || [];
        for (const target of targets) {
          const actualFormat = cells[target.columnIndex - firstColumn]?.userEnteredFormat?.numberFormat || null;
          const actual = actualFormat?.pattern || '';
          const canonical = value => String(value || '').replace(/"/g, '').toLowerCase();
          if (canonical(actual) === canonical(target.numberFormat.pattern)) totalVerified += 1;
          else {
            const columnName = toColumnName(target.columnIndex);
            const columnValues = await api.spreadsheets.values.get({
              spreadsheetId,
              range: `${quoteSheetTitle(title)}!${columnName}2:${columnName}`,
              valueRenderOption: 'UNFORMATTED_VALUE',
            });
            const firstDataIndex = (columnValues.data?.values || []).findIndex(row => row[0] !== '' && row[0] !== null && row[0] !== undefined);
            const rowNumber = firstDataIndex >= 0 ? firstDataIndex + 2 : 2;
            const diagnostic = await api.spreadsheets.get({
              spreadsheetId,
              ranges: [`${quoteSheetTitle(title)}!${columnName}${rowNumber}:${columnName}${rowNumber}`],
              includeGridData: true,
              fields: 'sheets(properties(title),data(startRow,startColumn,rowData(values(userEnteredFormat(numberFormat)))))',
            });
            const exactCellFormat = diagnostic.data?.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values?.[0]?.userEnteredFormat?.numberFormat || null;
            const exactPattern = exactCellFormat?.pattern || '';
            if (canonical(exactPattern) === canonical(target.numberFormat.pattern)) totalVerified += 1;
            else mismatches.push(`${group}/${title}/${target.header} (column ${columnName}, checked row ${rowNumber}): expected ${target.numberFormat.pattern}, got ${JSON.stringify(exactCellFormat)}`);
          }
        }
      }
    }
    console.log(`${verifyOnly ? 'Checked' : 'Formatted'} ${group}: ${sheets.length} tabs, ${targetsBySheet.reduce((sum, sheet) => sum + sheet.targets.length, 0)} date/time columns.`);
  }

  console.log(`Verified ${totalVerified}/${totalColumns} formatted columns across ${totalTabs} tabs.`);
  if (mismatches.length) {
    mismatches.forEach(item => console.error(`FORMAT MISMATCH: ${item}`));
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error('Could not format the configured Google Sheets workbooks:', error.message);
  process.exitCode = 1;
});
