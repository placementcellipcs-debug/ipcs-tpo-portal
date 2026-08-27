// backend/server.js
require('dotenv').config();

// 🚨 FORCES IPV4 FOR RENDER NETWORKS
const dns = require('dns');
dns.setDefaultResultOrder('ipv4first');

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const cron = require('node-cron');
const controllers = require('./src/controllers');
const { getCache } = require('./src/config');

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// ==========================================
// MIDDLEWARE
// ==========================================
app.use('/api', (req, res, next) => {
  if (!getCache()) return res.status(503).json({ success: false, message: "Server is warming up, please try again in 5 seconds." });
  next();
});

// ==========================================
// API ROUTES
// ==========================================
app.post('/api/auth/login', controllers.login);
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
app.get('/api/tpo/clients/:id', controllers.getClientById);
app.post('/api/tpo/clients/update', upload.single('logoFile'), controllers.updateClient);
app.post('/api/tpo/clients/request-mou', controllers.requestMou);
app.post('/api/tpo/clients/submit-mou', upload.any(), controllers.submitMou);

app.post('/api/tpo/profile/update-photo', upload.single('photo'), controllers.updatePhoto);

app.get('/api/admin/users', controllers.getAdminUsers);
app.post('/api/admin/users/add', controllers.addAdminUser);
app.post('/api/admin/users/update', controllers.updateAdminUser);
app.post('/api/admin/users/delete', controllers.deleteAdminUser);

// 🚨 NEW LMS & EXAM ENGINE ROUTES
app.get('/api/lms/materials', controllers.getMaterials);
app.post('/api/lms/materials/add', controllers.addMaterial);

app.get('/api/exams/questions', controllers.getQuestions);
app.post('/api/exams/questions/add', controllers.addQuestion);
app.post('/api/exams/questions/delete', controllers.deleteQuestion); // 🚨 ADD THIS LINE
app.get('/api/exams/results', controllers.getResults);

// 🚨 NEW COURSES API
app.get('/api/admin/courses', controllers.getCourses);
app.post('/api/admin/courses/add', controllers.addCourse);
app.post('/api/admin/courses/delete', controllers.deleteCourse); // 🚨 ADD THIS LINE

// 🚨 APTITUDE EXAMS API
app.get('/api/aptitude/questions', controllers.getAptQuestions);
app.get('/api/aptitude/results', controllers.getAptResults);
app.post('/api/aptitude/questions/add', controllers.addAptQuestion); // 🚨 ADDED
app.post('/api/aptitude/questions/delete', controllers.deleteAptQuestion); // 🚨 ADDED

// 🚨 TALENTINO EXAMS API
app.get('/api/talentino-exams/questions', controllers.getTalExamQuestions);
app.get('/api/talentino-exams/results', controllers.getTalExamResults);
app.post('/api/talentino-exams/questions/add', controllers.addTalExamQuestion); // 🚨 ADDED
app.post('/api/talentino-exams/questions/delete', controllers.deleteTalExamQuestion); // 🚨 ADDED

app.post('/api/tpo/profile/update-password', controllers.updatePassword);

app.get('/api/tpo/drives', controllers.getDrives);
app.post('/api/tpo/drives/update', controllers.updateDriveStatus);

// ==========================================
// SCHEDULED JOBS
// ==========================================
cron.schedule('0 8 * * *', controllers.runDailyCron);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 IPCS Backend is running on http://localhost:${PORT}`));