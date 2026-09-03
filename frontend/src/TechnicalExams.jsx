import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  CircleNotch, FileText, Plus, CaretLeft, Question, ChartBar, CheckCircle, 
  WarningCircle, X, FolderOpen, BookBookmark, ListChecks, PencilSimple, Trash, Eye
} from '@phosphor-icons/react';
import Layout from './Layout';

const TILE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

export default function TechnicalExams() {
  const tpoDataStr = localStorage.getItem('tpoData');
  const tpoData = tpoDataStr ? JSON.parse(tpoDataStr) : null;
  
  const isSuperAdmin = tpoData?.accessType === 'superadmin';
  const upperRole = (tpoData?.role || '').toUpperCase();
  const isRth = upperRole.includes('RTH') || upperRole.includes('REGIONAL TECHNICAL HEAD');
  
  const canManage = isSuperAdmin || isRth;
  const rthAssignedCourse = tpoData?.assignedCourse || '';

  const [courseDict, setCourseDict] = useState({});
  const [questions, setQuestions] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [viewLevel, setViewLevel] = useState(isSuperAdmin ? 'main_courses' : 'sub_courses');
  const [selectedMainCourse, setSelectedMainCourse] = useState(isSuperAdmin ? null : rthAssignedCourse);
  const [selectedSubCourse, setSelectedSubCourse] = useState(null);
  const [activeTab, setActiveTab] = useState('questions'); 

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [viewQuestionModal, setViewQuestionModal] = useState(null); 
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    id: '', course: '', question: '', optA: '', optB: '', optC: '', optD: '', correct: 'A', explanation: '', status: 'Active'
  });

  const fetchData = async () => {
    try {
      const [qRes, rRes, courseRes] = await Promise.all([
        axios.get('https://api-talenzo.ipcsglobal.info/api/exams/questions'), 
        axios.get('https://api-talenzo.ipcsglobal.info/api/exams/results'),
        axios.get('https://api-talenzo.ipcsglobal.info/api/admin/courses')
      ]);
      if (qRes.data.success) setQuestions(qRes.data.questions || []);
      if (rRes.data.success) setResults(rRes.data.results || []);
      if (courseRes.data.success) setCourseDict(courseRes.data.courses || {});
    } catch (err) {
      console.error("Failed to load exam data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const MAIN_COURSES = Object.keys(courseDict);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const openAddModal = () => {
    const randomId = `QST${Math.floor(10000 + Math.random() * 90000)}`;
    setFormData({
      id: randomId, 
      course: selectedSubCourse || '', 
      question: '', optA: '', optB: '', optC: '', optD: '', correct: 'A', explanation: '', status: 'Active'
    });
    setIsEditMode(false);
    setError('');
    setIsAddModalOpen(true);
  };

  const openEditModal = (q) => {
    setFormData({
      id: q.id, course: q.course, question: q.question,
      optA: q.optA, optB: q.optB, optC: q.optC, optD: q.optD,
      correct: q.correct || 'A', explanation: q.explanation || '', status: q.status || 'Active'
    });
    setIsEditMode(true);
    setError('');
    setIsAddModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const endpoint = isEditMode 
        ? 'https://api-talenzo.ipcsglobal.info/api/exams/questions/update' 
        : 'https://api-talenzo.ipcsglobal.info/api/exams/questions/add';

      const res = await axios.post(endpoint, formData);
      if (res.data.success) {
        setIsAddModalOpen(false);
        setLoading(true);
        fetchData(); 
      }
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'add'} question.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteQuestion = async (id) => {
    if(!window.confirm("Are you sure you want to delete this question?")) return;
    try {
      const res = await axios.post('https://api-talenzo.ipcsglobal.info/api/exams/questions/delete', { id });
      if (res.data.success) {
        setQuestions(questions.filter(q => q.id !== id));
      }
    } catch (err) { alert("Failed to delete question."); }
  };

  const filteredQuestions = questions.filter(q => {
    const qCourse = (q.course || '').trim();
    const selCourse = (selectedSubCourse || '').trim();
    return qCourse === selCourse && 
           (q.question || '').toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredResults = results.filter(r => {
    const rCourse = (r.course || '').trim();
    const selCourse = (selectedSubCourse || '').trim();
    return rCourse === selCourse && 
           ((r.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
            (r.rollNo || '').toLowerCase().includes(searchQuery.toLowerCase()));
  });

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        <div style={{ marginBottom: '20px' }}>
          <button 
            onClick={() => window.location.href = '/exams'}
            style={{ background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--text-muted)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 'bold' }}
          >
            <CaretLeft weight="bold" size={16} /> Back to Exams Hub
          </button>
        </div>

        {viewLevel === 'main_courses' && isSuperAdmin && (
          <>
            <div style={{ marginBottom: '30px' }}>
              <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FolderOpen color="var(--accent-primary)" weight="fill" /> Examination Engine
              </h1>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>Select a domain fetched from your Courses sheet.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px' }}>
              {MAIN_COURSES.map((course, index) => {
                const color = TILE_COLORS[index % TILE_COLORS.length];
                return (
                  <div 
                    key={course} 
                    onClick={() => { setSelectedMainCourse(course); setViewLevel('sub_courses'); }}
                    style={{ backgroundColor: color, borderRadius: '24px', padding: '40px 20px', cursor: 'pointer', textAlign: 'center', minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}
                  >
                    <h2 style={{ color: '#ffffff', fontSize: '1.6rem', margin: '0 0 15px 0', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>{course}</h2>
                    <div style={{ background: 'rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={20} color="#ffffff" weight="bold" />
                      <span style={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: 'bold' }}>Manage Exams</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

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
                <p style={{ color: 'var(--text-muted)', margin: 0 }}>Select a program to manage exams.</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {(courseDict[selectedMainCourse] || []).map((subCourse) => (
                <div 
                  key={subCourse}
                  onClick={() => { setSelectedSubCourse(subCourse); setViewLevel('exam_dashboard'); }}
                  style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '1.5rem', cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', gap: '15px' }}
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

        {viewLevel === 'exam_dashboard' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <button onClick={() => { setViewLevel('sub_courses'); setSelectedSubCourse(null); }} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: '#fff', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <CaretLeft weight="bold" size={18} /> Programs
                </button>
                <div>
                  <h1 style={{ fontSize: '1.6rem', margin: 0 }}>{selectedSubCourse}</h1>
                  <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.85rem' }}>Assessment question bank and student scores.</p>
                </div>
              </div>
              {activeTab === 'questions' && canManage && (
                <button className="btn-action" onClick={openAddModal} style={{ width: 'auto', padding: '0.8rem 1.5rem' }}>
                  <Plus size={20} weight="bold" /> Add Question
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
              <button onClick={() => setActiveTab('questions')} style={{ background: activeTab === 'questions' ? 'rgba(56, 189, 248, 0.1)' : 'transparent', color: activeTab === 'questions' ? 'var(--accent-primary)' : 'var(--text-muted)', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Question size={20} weight={activeTab === 'questions' ? "fill" : "regular"} /> Question Bank
              </button>
              <button onClick={() => setActiveTab('results')} style={{ background: activeTab === 'results' ? 'rgba(16, 185, 129, 0.1)' : 'transparent', color: activeTab === 'results' ? '#10b981' : 'var(--text-muted)', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ChartBar size={20} weight={activeTab === 'results' ? "fill" : "regular"} /> Student Results
              </button>
            </div>

            <div style={{ marginBottom: '20px', maxWidth: '400px', position: 'relative' }}>
              <input type="text" placeholder={activeTab === 'questions' ? "Search questions..." : "Search student name or roll..."} className="sleek-input" style={{ width: '100%' }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>

            {activeTab === 'questions' && (
              <div className="table-container">
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th style={{ width: '35%' }}>Question Details</th>
                      <th style={{ width: '40%' }}>Options</th>
                      <th style={{ textAlign: 'center', width: '10%' }}>Correct Answer</th>
                      <th style={{ textAlign: 'center', width: '15%' }}>Actions</th>
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
                          <td style={{ verticalAlign: 'top', padding: '16px' }}>
                            <span className="primary-text" style={{ whiteSpace: 'normal', lineHeight: 1.5, display: 'block', marginBottom: '6px' }}>{q.question}</span>
                            <span className="sub-text">ID: {q.id}</span>
                          </td>
                          <td style={{ verticalAlign: 'top', padding: '16px', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.6 }}>
                            <div style={{ marginBottom: '8px' }}><b>A:</b> {q.optA}</div>
                            <div style={{ marginBottom: '8px' }}><b>B:</b> {q.optB}</div>
                            <div style={{ marginBottom: '8px' }}><b>C:</b> {q.optC}</div>
                            <div><b>D:</b> {q.optD}</div>
                          </td>
                          <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 'bold', border: '1px solid #10b981' }}>
                              {q.correct}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button onClick={() => setViewQuestionModal(q)} style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid #0284c7', padding: '8px', borderRadius: '8px', cursor: 'pointer' }} title="View">
                                <Eye size={16} weight="bold" />
                              </button>
                              {canManage && (
                                <>
                                  <button onClick={() => openEditModal(q)} style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid #f59e0b', padding: '8px', borderRadius: '8px', cursor: 'pointer' }} title="Edit">
                                    <PencilSimple size={16} weight="bold" />
                                  </button>
                                  <button onClick={() => handleDeleteQuestion(q.id)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444', padding: '8px', borderRadius: '8px', cursor: 'pointer' }} title="Delete">
                                    <Trash size={16} weight="bold" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'results' && (
              <div className="table-container">
                <table className="modern-table">
                  <thead><tr><th>Student Details</th><th>Completion Date</th><th style={{ textAlign: 'center' }}>Score</th><th style={{ textAlign: 'center' }}>Time Taken</th></tr></thead>
                  <tbody>
                    {filteredResults.map((r, i) => (
                      <tr key={i}>
                        <td><span className="primary-text">{r.name}</span><span className="sub-text">{r.rollNo} • {r.branch}</span></td>
                        <td><span className="primary-text" style={{ fontSize: '0.85rem' }}>{r.timestamp}</span></td>
                        <td style={{ textAlign: 'center' }}><span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#10b981' }}>{r.percentage}</span><span className="sub-text">{r.score} / {r.total}</span></td>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 'bold' }}>{r.timeTaken}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {viewQuestionModal && (
         <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
         <div className="modal-card" style={{ maxWidth: '600px', width: '100%', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
             <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><Eye color="var(--accent-primary)" /> Question Details</h2>
             <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setViewQuestionModal(null)} />
           </div>
           <div style={{ background: '#161e2e', padding: '15px', borderRadius: '8px', border: '1px solid #1e293b', marginBottom: '15px' }}><p style={{ margin: 0, fontSize: '1.1rem', lineHeight: 1.5 }}>{viewQuestionModal.question}</p></div>
           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
             <div style={{ padding: '10px', background: 'var(--bg-dark)', border: '1px solid var(--card-border)', borderRadius: '8px' }}><b>A:</b> {viewQuestionModal.optA}</div>
             <div style={{ padding: '10px', background: 'var(--bg-dark)', border: '1px solid var(--card-border)', borderRadius: '8px' }}><b>B:</b> {viewQuestionModal.optB}</div>
             <div style={{ padding: '10px', background: 'var(--bg-dark)', border: '1px solid var(--card-border)', borderRadius: '8px' }}><b>C:</b> {viewQuestionModal.optC}</div>
             <div style={{ padding: '10px', background: 'var(--bg-dark)', border: '1px solid var(--card-border)', borderRadius: '8px' }}><b>D:</b> {viewQuestionModal.optD}</div>
           </div>
           {viewQuestionModal.explanation && <div style={{ padding: '15px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid #0284c7', borderRadius: '8px', color: '#38bdf8' }}><b>Explanation:</b> {viewQuestionModal.explanation}</div>}
         </div>
       </div>
      )}

      {isAddModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div className="modal-card" style={{ maxWidth: '700px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><ListChecks color="var(--accent-primary)" /> {isEditMode ? 'Edit Exam Question' : 'Add Exam Question'}</h2>
              <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsAddModalOpen(false)} />
            </div>
            {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}><WarningCircle size={20} /> {error}</div>}
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px', marginBottom: '15px' }}>
                <div className="form-group"><label>Question ID</label><input type="text" name="id" value={formData.id} readOnly style={{ background: 'var(--bg-dark)', opacity: 0.7 }} /></div>
                <div className="form-group">
                  <label>Assigned Program</label>
                  <select name="course" value={formData.course} onChange={handleInputChange} className="sleek-select" style={{ width: '100%', background: 'var(--input-bg)' }} required>
                    {(courseDict[selectedMainCourse] || []).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: '15px' }}><label>Question Text</label><textarea name="question" className="sleek-input" style={{ width: '100%', minHeight: '80px' }} value={formData.question} onChange={handleInputChange} required /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div className="form-group"><label>Option A</label><input type="text" name="optA" value={formData.optA} onChange={handleInputChange} required /></div>
                <div className="form-group"><label>Option B</label><input type="text" name="optB" value={formData.optB} onChange={handleInputChange} required /></div>
                <div className="form-group"><label>Option C</label><input type="text" name="optC" value={formData.optC} onChange={handleInputChange} required /></div>
                <div className="form-group"><label>Option D</label><input type="text" name="optD" value={formData.optD} onChange={handleInputChange} required /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px', marginBottom: '20px' }}>
                <div className="form-group">
                  <label>Correct Answer</label>
                  <select name="correct" value={formData.correct} onChange={handleInputChange} className="sleek-select" style={{ width: '100%', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
                    <option value="A">Option A</option><option value="B">Option B</option><option value="C">Option C</option><option value="D">Option D</option>
                  </select>
                </div>
                <div className="form-group"><label>Explanation (Optional)</label><input type="text" name="explanation" value={formData.explanation} onChange={handleInputChange} /></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #1e293b', paddingTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-action" style={{ width: 'auto' }} disabled={isSubmitting}>{isSubmitting ? <CircleNotch size={20} className="ph-spin" /> : (isEditMode ? 'Save Changes' : 'Save Question')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}