require('dotenv').config();
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const assetDoc = new GoogleSpreadsheet(process.env.ASSET_SPREADSHEET_ID, serviceAccountAuth);

let assetCache = {};
let isFetching = false;

const getAssetCache = () => assetCache;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchSheetWithRetry(sheet, retries = 3) {
  if (!sheet) return [];
  const backoffs = [10000, 30000, 60000]; // 🚨 10s, 30s, 60s delays for 429 limits
  for (let i = 0; i < retries; i++) {
    try {
      return await sheet.getRows();
    } catch (error) {
      // 🚨 SAFELY CATCH EMPTY SHEETS INSTEAD OF CRASHING
      if (error.message && error.message.includes('No values in the header row')) {
        console.warn(`⚠️ Sheet "${sheet.title}" is empty. Skipping.`);
        return [];
      }
      if (error.response && error.response.status === 429) {
        const waitTime = backoffs[i] || 60000;
        console.warn(`⚠️ Google API Rate Limit Hit (429) on Asset DB "${sheet.title}". Retrying in ${waitTime}ms...`);
        await delay(waitTime);
      } else {
        throw error;
      }
    }
  }
  return [];
}

async function refreshAssetCache() {
  if (isFetching) return;
  isFetching = true;
  try {
    await assetDoc.loadInfo();
    
    const getSheetFuzzy = (keyword) => {
      const cleanKeyword = keyword.toLowerCase().replace(/[^a-z0-9]/g, '');
      return assetDoc.sheetsByIndex.find(s => s.title.toLowerCase().replace(/[^a-z0-9]/g, '').includes(cleanKeyword));
    };

    const sheetKeys = [
      'branches', 'users', 'employees', 'categories', 'subcategories', 
      'locations', 'assets', 'assetcustomdata', 'assignments', 'transfers', 
      'transferitems', 'maintenance', 'inventory', 'inventorytransactions', 
      'vendors', 'documents', 'history', 'audits', 'audititems', 'disposals'
    ];

    const fetchedData = {};
    for (const key of sheetKeys) {
      const sheet = getSheetFuzzy(key);
      if (sheet) {
        fetchedData[key] = await fetchSheetWithRetry(sheet);
      } else {
        fetchedData[key] = [];
      }
      await delay(3000); // 🚨 Increased to 3 seconds to safely pace below 60 req/min
    }

    assetCache = fetchedData;
    console.log("📦 Asset Management Cache successfully synced with Google Sheets!");
    isFetching = false;
  } catch (err) { 
    console.error("❌ Asset Management Cache sync failed:", err.message); 
    isFetching = false;
    setTimeout(refreshAssetCache, 15000);
  }
}

// 🚨 Stagger the startup by 30 seconds so it doesn't run at the exact same time as config.js
setTimeout(refreshAssetCache, 30000);
// 🚨 Run every 6 minutes instead of 5 to further reduce overlap
setInterval(refreshAssetCache, 360000); 

module.exports = { assetDoc, getAssetCache, refreshAssetCache };