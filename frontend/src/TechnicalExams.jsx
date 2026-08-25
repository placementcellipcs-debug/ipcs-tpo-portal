import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  CircleNotch, Exam, Plus, CaretLeft, Question, ChartBar, CheckCircle, 
  WarningCircle, X, FolderOpen, BookBookmark, ListChecks
} from '@phosphor-icons/react';
import Layout from './Layout';

// Master Dictionary of IPCS Courses
const COURSE_DICTIONARY = {
  'BMS AND CCTV': [
    'Diploma In Building Management System', 'Certified BMS Engineer', 'CCTV & Security Systems', 'CCTV Training'
  ],
  'Industrial Automation': [
    'Automation System Engineer', 'Professional Diploma in Industrial Automation', 'Advanced Automation System Professional', 
    'Advanced PLC Program Professional', 'DCS Engineering & Maintenance', 'Electrical Control & Panel Designing', 
    'Industrial Networking', 'Diploma in Marine Automation Systems', 'VFD Installation Professional', 'Customize programming PLC SCADA'
  ],
  'Embedded and IoT': [
    'Certified Embedded Engineer', 'Embedded System Design (Crash)', 'Certified Raspberry Pi Programmer', 
    'Certified Embedded System Engineer', 'Certified IoT Professional', 'LabView Course', 'Certified IIoT Professional'
  ],
  'Digital Marketing': [
    'Professional Diploma in Digital Marketing', 'Advanced Course in Online Entrepreneurship', 'Advanced Certificate Course in Digital Marketing', 
    'Search Engine Optimization Certification Course', 'Certificate Course in Digital Marketing', 'Search Engine Marketing Certification Course', 
    'Social Media Marketing Certification Course', 'Online Money Making Courses', 'Digital Marketing Corporate Training', 
    'Affiliate Marketing Certification Course', 'Certificate Course in Email Marketing', 'Video Blogging', 
    'Google Analytics Fundamentals Course', 'International Web Professional', 'Inbound Marketing Certification Course', 'AI Digital Marketing'
  ],
  'Information technology (IT)': [
    'PHP AND MYSQL', 'JAVA Full Stack', 'Web Designing and Development', 'Python & Data Science', 'Python Programming', 
    'Data Science & Analytics', 'Android App Development', 'Python Full Stack Development', 'Artificial Intelligence', 
    'Diploma in Artificial Intelligence', 'AI & Machine Learning with Python', 'Software Testing', 'Basics of Software Testing', 
    'Advanced QA Automation Testing', 'Cyber Security', 'Cyber Security & Network Security Essentials', 'MERN Stack', 'Data Analytics'
  ]
};

const MAIN_COURSES = Object.keys(COURSE_DICTIONARY);
const TILE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

export default function TechnicalExams() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  const isSuperAdmin = tpoData?.accessType === 'superadmin';
  const rthAssignedCourse = tpoData?.assignedCourse || '';

  const [questions, setQuestions] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Navigation State
  const [viewLevel, setViewLevel] = useState(isSuperAdmin ? 'main_courses' : 'sub_courses');
  const [selectedMainCourse, setSelectedMainCourse] = useState(isSuperAdmin ? null : rthAssignedCourse);
  const [selectedSubCourse, setSelectedSubCourse] = useState(null);
  const [activeTab, setActiveTab] = useState('questions'); // 'questions' or 'results'

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    id: '', course: '', question: '', optA: '', optB: '', optC: '', optD: '', correct: 'A', explanation: '', status: 'Active'
  });

  const fetchData = async () => {
    try {
      const [qRes, rRes] = await Promise.all([
        axios.get('https://ipcs-tpo-portal-u0l6.onrender.com/api/exams/questions'),
        axios.get('https://ipcs-tpo-portal-u0l6.onrender.com/api/exams/results')
      ]);
      if (qRes.data.success) setQuestions(qRes.data.questions || []);
      if (rRes.data.success) setResults(rRes.data.results || []);
    } catch (err) {
      console.error("Failed to load exam data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const openAddModal = () => {
    const randomId = `QST${Math.floor(10000 + Math.random() * 90000)}`;
    setFormData({
      id: randomId, 
      course: selectedSubCourse || (COURSE_DICTIONARY[selectedMainCourse] ? COURSE_DICTIONARY[selectedMainCourse][0] : ''), 
      question: '', optA: '', optB: '', optC: '', optD: '', correct: 'A', explanation: '', status: 'Active'
    });
    setError('');
    setIsModalOpen(true);
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const res = await axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/exams/questions/add', formData);
      if (res.data.success) {
        setIsModalOpen(false);
        setLoading(true);
        fetchData(); 
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add question.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredQuestions = questions.filter(q => {
    return q.course === selectedSubCourse && 
           (q.question || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredResults = results.filter(r => {
    return r.course === selectedSubCourse && 
           ((r.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
            (r.rollNo || '').toLowerCase().includes(searchQuery.toLowerCase()));
  });

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        {/* ========================================== */}
        {/* VIEW 1: SUPER ADMIN MAIN COURSES */}
        {/* ========================================== */}
        {viewLevel === 'main_courses' && isSuperAdmin && (
          <>
            <div style={{ marginBottom: '30px' }}>
              <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FolderOpen color="var(--accent-primary)" weight="fill" /> Examination Engine
              </h1>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>Select an engineering domain to manage technical exams and view student scores.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px' }}>
              {MAIN_COURSES.map((course, index) => {
                const color = TILE_COLORS[index % TILE_COLORS.length];
                return (
                  <div 
                    key={course} 
                    onClick={() => { setSelectedMainCourse(course); setViewLevel('sub_courses'); }}
                    style={{ backgroundColor: color, borderRadius: '24px', padding: '40px 20px', cursor: 'pointer', textAlign: 'center', minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 15px 35px rgba(0,0,0,0.3)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)'; }}
                  >
                    <h2 style={{ color: '#ffffff', fontSize: '1.6rem', margin: '0 0 15px 0', textShadow: '0 2px 4px rgba(0,0,0,0.2)', lineHeight: 1.3 }}>{course}</h2>
                    <div style={{ background: 'rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Exam size={20} color="#ffffff" weight="bold" />
                      <span style={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: 'bold' }}>Manage Exams</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ========================================== */}
        {/* VIEW 2: SUB-COURSES GRID */}
        {/* ========================================== */}
        {viewLevel === 'sub_courses' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '30px', gap: '15px', flexWrap: 'wrap' }}>
              {isSuperAdmin && (
                <button onClick={() => { setViewLevel('main_courses'); setSelectedMainCourse(null); }} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: '#fff', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <CaretLeft weight="bold" size={18} /> Domains
                </button>
              )}
              <div>
                <h1 style={{ fontSize: '1.8rem', margin: '0 0 5px 0' }}>{selectedMainCourse}</h1>
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Select a program to manage its question bank and student results.</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {(COURSE_DICTIONARY[selectedMainCourse] || []).map((subCourse) => (
                <div 
                  key={subCourse}
                  onClick={() => { setSelectedSubCourse(subCourse); setViewLevel('exam_dashboard'); }}
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '1.5rem', cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', gap: '15px' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-primary)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--card-border)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <div style={{ width: '45px', height: '45px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <BookBookmark size={24} weight="fill" />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)', lineHeight: 1.4 }}>{subCourse}</h3>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ========================================== */}
        {/* VIEW 3: EXAM DASHBOARD (QUESTIONS / RESULTS) */}
        {/* ========================================== */}
        {viewLevel === 'exam_dashboard' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <button onClick={() => { setViewLevel('sub_courses'); setSelectedSubCourse(null); }} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: '#fff', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <CaretLeft weight="bold" size={18} /> Programs
                </button>
                <div>
                  <h1 style={{ fontSize: '1.6rem', margin: 0 }}>{selectedSubCourse}</h1>
                  <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.85rem' }}>Manage the assessment question bank and track student performance.</p>
                </div>
              </div>
              {activeTab === 'questions' && (
                <button className="btn-action" onClick={openAddModal} style={{ width: 'auto', padding: '0.8rem 1.5rem' }}>
                  <Plus size={20} weight="bold" /> Add Question
                </button>
              )}
            </div>

            {/* TAB CONTROLS */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
              <button 
                onClick={() => setActiveTab('questions')}
                style={{ background: activeTab === 'questions' ? 'rgba(56, 189, 248, 0.1)' : 'transparent', color: activeTab === 'questions' ? 'var(--accent-primary)' : 'var(--text-muted)', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s' }}
              >
                <Question size={20} weight={activeTab === 'questions' ? "fill" : "regular"} /> Question Bank
              </button>
              <button 
                onClick={() => setActiveTab('results')}
                style={{ background: activeTab === 'results' ? 'rgba(16, 185, 129, 0.1)' : 'transparent', color: activeTab === 'results' ? '#10b981' : 'var(--text-muted)', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s' }}
              >
                <ChartBar size={20} weight={activeTab === 'results' ? "fill" : "regular"} /> Student Results
              </button>
            </div>

            <div style={{ marginBottom: '20px', maxWidth: '400px', position: 'relative' }}>
              <input 
                type="text" 
                placeholder={activeTab === 'questions' ? "Search questions..." : "Search student name or roll..."} 
                className="sleek-input" 
                style={{ width: '100%' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* QUESTIONS TAB */}
            {activeTab === 'questions' && (
              <div className="table-container">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Question Details</th>
                      <th>Options</th>
                      <th style={{ textAlign: 'center' }}>Correct Answer</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan="4" style={{ textAlign: 'center', padding: '3rem' }}><CircleNotch size={32} className="ph-spin" color="var(--accent-primary)" /></td></tr>
                    ) : filteredQuestions.length === 0 ? (
                      <tr><td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No questions added for this course yet.</td></tr>
                    ) : (
                      filteredQuestions.map((q, i) => (
                        <tr key={i}>
                          <td style={{ maxWidth: '300px' }}>
                            <span className="primary-text" style={{ whiteSpace: 'normal', lineHeight: 1.4 }}>{q.question}</span>
                            <span className="sub-text">ID: {q.id}</span>
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            <div>A: {q.optA}</div>
                            <div>B: {q.optB}</div>
                            <div>C: {q.optC}</div>
                            <div>D: {q.optD}</div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 'bold', border: '1px solid #10b981' }}>
                              {q.correct}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: q.status.toLowerCase() === 'active' ? '#10b981' : '#ef4444', fontWeight: 'bold', fontSize: '0.8rem' }}>
                              {q.status.toLowerCase() === 'active' ? <CheckCircle size={16} weight="fill" /> : <WarningCircle size={16} weight="fill" />} 
                              {q.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* RESULTS TAB */}
            {activeTab === 'results' && (
              <div className="table-container">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Student Details</th>
                      <th>Completion Date</th>
                      <th style={{ textAlign: 'center' }}>Score</th>
                      <th style={{ textAlign: 'center' }}>Time Taken</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan="4" style={{ textAlign: 'center', padding: '3rem' }}><CircleNotch size={32} className="ph-spin" color="#10b981" /></td></tr>
                    ) : filteredResults.length === 0 ? (
                      <tr><td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No exam attempts recorded yet.</td></tr>
                    ) : (
                      filteredResults.map((r, i) => {
                        const perc = parseFloat(r.percentage.replace('%', ''));
                        const isPass = perc >= 50; // Simple logic: >= 50% is green
                        return (
                          <tr key={i}>
                            <td>
                              <span className="primary-text">{r.name}</span>
                              <span className="sub-text">{r.rollNo} • {r.branch}</span>
                            </td>
                            <td><span className="primary-text" style={{ fontSize: '0.85rem' }}>{r.timestamp}</span></td>
                            <td style={{ textAlign: 'center' }}>
                              <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: isPass ? '#10b981' : '#ef4444' }}>{r.percentage}</span>
                              <span className="sub-text">{r.score} / {r.total}</span>
                            </td>
                            <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 'bold' }}>{r.timeTaken}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

      </div>

      {/* ========================================== */}
      {/* ADD QUESTION MODAL */}
      {/* ========================================== */}
      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div className="modal-card" style={{ maxWidth: '700px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><ListChecks color="var(--accent-primary)" /> Add Exam Question</h2>
              <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsModalOpen(false)} />
            </div>

            {error && (
              <div className="alert alert-error" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <WarningCircle size={20} /> {error}
              </div>
            )}

            <form onSubmit={handleAddQuestion}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px', marginBottom: '15px' }}>
                <div className="form-group">
                  <label>Question ID</label>
                  <input type="text" name="id" value={formData.id} readOnly style={{ background: 'var(--bg-dark)', opacity: 0.7 }} />
                </div>
                <div className="form-group">
                  <label>Assigned Program</label>
                  <select name="course" value={formData.course} onChange={handleInputChange} className="sleek-select" style={{ width: '100%', background: 'var(--input-bg)' }} required>
                    {(COURSE_DICTIONARY[selectedMainCourse] || []).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>Question Text</label>
                <textarea 
                  name="question" 
                  className="sleek-input" 
                  placeholder="Enter the technical question here..." 
                  style={{ width: '100%', minHeight: '80px', resize: 'vertical' }} 
                  value={formData.question} 
                  onChange={handleInputChange} 
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div className="form-group">
                  <label>Option A</label>
                  <input type="text" name="optA" value={formData.optA} onChange={handleInputChange} required />
                </div>
                <div className="form-group">
                  <label>Option B</label>
                  <input type="text" name="optB" value={formData.optB} onChange={handleInputChange} required />
                </div>
                <div className="form-group">
                  <label>Option C</label>
                  <input type="text" name="optC" value={formData.optC} onChange={handleInputChange} required />
                </div>
                <div className="form-group">
                  <label>Option D</label>
                  <input type="text" name="optD" value={formData.optD} onChange={handleInputChange} required />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px', marginBottom: '20px' }}>
                <div className="form-group">
                  <label>Correct Answer</label>
                  <select name="correct" value={formData.correct} onChange={handleInputChange} className="sleek-select" style={{ width: '100%', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid #10b981', fontWeight: 'bold' }}>
                    <option value="A">Option A</option>
                    <option value="B">Option B</option>
                    <option value="C">Option C</option>
                    <option value="D">Option D</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Explanation (Optional)</label>
                  <input type="text" name="explanation" placeholder="Why is this the correct answer?" value={formData.explanation} onChange={handleInputChange} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #1e293b', paddingTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-action" style={{ width: 'auto' }} disabled={isSubmitting}>
                  {isSubmitting ? <CircleNotch size={20} className="ph-spin" /> : 'Save Question'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </Layout>
  );
}