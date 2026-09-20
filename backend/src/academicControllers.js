const { JWT } = require('google-auth-library');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { getCache } = require('./config');

// Authenticate for the new Academic Spreadsheet
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const academicDoc = new GoogleSpreadsheet('1mhTuK_3dXLKk1DcUCTA7KFWHiCKirwmYP6l7wMLYPlo', serviceAccountAuth);
let isAcademicDocLoaded = false;

async function loadAcademicDoc() {
  if (!isAcademicDocLoaded) {
    await academicDoc.loadInfo();
    isAcademicDocLoaded = true;
  }
}

const getFuzzyHeader = (headers, target) => {
  const cleanTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '');
  return headers.find(h => h.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanTarget) || target;
};

// 🚨 CORE GETTER: Fetches 01_Training and maps it to the Student Master (Data sheet)
exports.getTrainingData = async (req, res) => {
  try {
    await loadAcademicDoc();
    const tSheet = academicDoc.sheetsByTitle["01_Training"];
    if (!tSheet) return res.json({ success: true, training: [] });

    const rows = await tSheet.getRows();
    const h = tSheet.headerValues;
    const cache = getCache();
    const allStudents = cache.students || [];

    const trainingData = rows.map(r => {
      const studentId = r.get(getFuzzyHeader(h, 'studentid')) || '';
      
      // Relational Lookup: Find the student in the Master "Data" sheet
      let profilePhoto = '';
      let phone = '';
      const matchedStudent = allStudents.find(s => {
        const sHeaders = s._worksheet.headerValues.map(x => x.toLowerCase().replace(/[^a-z0-9]/g, ''));
        const rIndex = sHeaders.indexOf('rollnumber') !== -1 ? sHeaders.indexOf('rollnumber') : sHeaders.findIndex(x => x.includes('roll'));
        return rIndex !== -1 && s._rawData[rIndex] === studentId;
      });

      if (matchedStudent) {
        const pIndex = matchedStudent._worksheet.headerValues.map(x => x.toLowerCase().replace(/[^a-z0-9]/g, '')).findIndex(x => x.includes('photo'));
        const phIndex = matchedStudent._worksheet.headerValues.map(x => x.toLowerCase().replace(/[^a-z0-9]/g, '')).findIndex(x => x.includes('phone') || x.includes('contact'));
        if (pIndex !== -1) profilePhoto = matchedStudent._rawData[pIndex] || '';
        if (phIndex !== -1) phone = matchedStudent._rawData[phIndex] || '';
      }

      return {
        trainingId: r.get(getFuzzyHeader(h, 'trainingid')) || '',
        studentId: studentId,
        studentName: r.get(getFuzzyHeader(h, 'studentname')) || '',
        phone: phone,
        profilePhoto: profilePhoto,
        mainCourse: r.get(getFuzzyHeader(h, 'maincourse')) || '',
        subCourse: r.get(getFuzzyHeader(h, 'subcourse')) || '',
        branch: r.get(getFuzzyHeader(h, 'branch')) || '',
        trainingType: r.get(getFuzzyHeader(h, 'trainingtype')) || 'Individual',
        trainerName: r.get(getFuzzyHeader(h, 'trainername')) || '',
        status: r.get(getFuzzyHeader(h, 'trainingstatus')) || 'Active',
        progress: r.get(getFuzzyHeader(h, 'progress%')) || '0%'
      };
    });

    res.json({ success: true, training: trainingData.reverse() });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};