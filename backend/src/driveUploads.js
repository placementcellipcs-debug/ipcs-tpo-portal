const axios = require('axios');

const APPS_SCRIPT_WEB_APP_URL = String(process.env.DRIVE_UPLOAD_WEB_APP_URL
  || 'https://script.google.com/macros/s/AKfycbyAJWuQlO7Ie3e-hsWkr965tZD3vfTBG5E9oBxFMleXBNi5ocSTnilPmFYzDXgQ-cOcbw/exec').trim();

async function uploadToDrive(file, folderId) {
  try {
    const base64Data = file.buffer.toString('base64');
    const payload = { folderId, filename: `${Date.now()}_${file.originalname}`, mimeType: file.mimetype, data: base64Data };
    const response = await axios.post(APPS_SCRIPT_WEB_APP_URL, payload);
    if (response.data?.success) return response.data.link;
    throw new Error(response.data?.error || 'The Drive upload service rejected the file.');
  } catch (error) {
    throw new Error(`Drive upload failed: ${error.message}`);
  }
}

module.exports = { uploadToDrive };
