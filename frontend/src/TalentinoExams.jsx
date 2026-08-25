import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  CircleNotch, PenNib, Plus, Question, ChartBar, CheckCircle, 
  WarningCircle, X, Trash, Eye
} from '@phosphor-icons/react';
import Layout from './Layout';

export default function TalentinoExams() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));

  const [questions, setQuestions] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('questions'); 

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [viewQuestionModal, setViewQuestionModal] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    id: '', testNumber: '1', question: '', optA: '', optB: '', optC: '', optD: '', correct: 'A', explanation: '', status: 'Active'
  });

  const fetchData = async () => {
    try {
      const [qRes, rRes] = await Promise.all([
        axios.get('https://ipcs-tpo-portal-u0l6.onrender.com/api/talentino-exams/questions'),
        axios.get('https://ipcs-tpo-portal-u0l6.onrender.com/api/talentino-exams/results')
      ]);
      if (qRes.data.success) setQuestions(qRes.data.questions || []);
      if (rRes.data.success) setResults(rRes.data.results || []);
    } catch (err) {
      console.error("Failed to load talentino data", err);
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
    const randomId = `TQ${Math.floor(100 + Math.random() * 900)}`;
    setFormData({
      id: randomId, testNumber: '1', question: '', optA: '', optB: '', optC: '', optD: '', correct: 'A', explanation: '', status: 'Active'
    });
    setError('');
    setIsAddModalOpen(true);
  };

  const handleAddQuestion = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const res = await axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/talentino-exams/questions/add', formData);
      if (res.data.success) {
        setIsAddModalOpen(false);
        setLoading(true);
        fetchData(); 
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add question.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteQuestion = async (id) => {
    if(!window.confirm("Are you sure you want to permanently delete this question?")) return;
    try {
      const res = await axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/talentino-exams/questions/delete', { id });
      if (res.data.success) setQuestions(questions.filter(q => q.id !== id));
    } catch (err) {
      alert("Failed to delete question.");
    }
  };

  const filteredQuestions = questions.filter(q => 
    (q.question || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (q.testNumber || '').toString().toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredResults = results.filter(r => 
    (r.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
    (r.branch || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <PenNib color="var(--accent-primary)" weight="fill" /> Talentino Exams
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Manage specialized soft skills and talent assessment exams.</p>
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
            placeholder={activeTab === 'questions' ? "Search questions or test number..." : "Search student or branch..."} 
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
                  <th style={{ textAlign: 'center' }}>Answer</th>
                  <th style={{ textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '3rem' }}><CircleNotch size={32} className="ph-spin" color="var(--accent-primary)" /></td></tr>
                ) : filteredQuestions.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No Talentino questions found.</td></tr>
                ) : (
                  filteredQuestions.map((q, i) => (
                    <tr key={i}>
                      <td style={{ maxWidth: '350px' }}>
                        <span className="primary-text" style={{ whiteSpace: 'normal', lineHeight: 1.4 }}>{q.question}</span>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                          <span style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold' }}>Test: {q.testNumber}</span>
                          <span style={{ background: 'var(--bg-dark)', color: 'var(--text-muted)', border: '1px solid var(--card-border)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem' }}>{q.id}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                        <div><b>A:</b> {q.optA}</div>
                        <div><b>B:</b> {q.optB}</div>
                        <div><b>C:</b> {q.optC}</div>
                        <div><b>D:</b> {q.optD}</div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', fontWeight: 'bold', border: '1px solid #10b981', marginBottom: '6px' }}>
                          {q.correct}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', color: q.status.toLowerCase() === 'active' ? '#10b981' : '#ef4444', fontWeight: 'bold', fontSize: '0.7rem' }}>
                          {q.status.toLowerCase() === 'active' ? <CheckCircle size={14} weight="fill" /> : <WarningCircle size={14} weight="fill" />} 
                          {q.status}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button 
                            onClick={() => setViewQuestionModal(q)}
                            style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid #0284c7', padding: '8px', borderRadius: '8px', cursor: 'pointer', transition: '0.2s' }}
                            title="View Details"
                          >
                            <Eye size={18} weight="bold" />
                          </button>
                          <button 
                            onClick={() => handleDeleteQuestion(q.id)}
                            style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444', padding: '8px', borderRadius: '8px', cursor: 'pointer', transition: '0.2s' }}
                            title="Delete"
                          >
                            <Trash size={18} weight="bold" />
                          </button>
                        </div>
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
                  <th>Test Name/Number</th>
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
                    const perc = parseFloat((r.percentage || '0%').replace('%', ''));
                    const isPass = perc >= 50; 
                    return (
                      <tr key={i}>
                        <td>
                          <span className="primary-text">{r.name}</span>
                          <span className="sub-text">{r.rollNo} • {r.branch}</span>
                        </td>
                        <td>
                          <span className="primary-text" style={{ fontSize: '0.9rem' }}>{r.testNumber}</span>
                          <span className="sub-text">{r.timestamp}</span>
                        </td>
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

      </div>

      {/* ========================================== */}
      {/* VIEW FULL QUESTION MODAL */}
      {/* ========================================== */}
      {viewQuestionModal && (
         <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
         <div className="modal-card" style={{ maxWidth: '600px', width: '100%', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
             <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><Eye color="var(--accent-primary)" /> Question Details</h2>
             <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setViewQuestionModal(null)} />
           </div>
           
           <div style={{ background: '#161e2e', padding: '15px', borderRadius: '8px', border: '1px solid #1e293b', marginBottom: '15px' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
               <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold', fontSize: '0.8rem' }}>Test: {viewQuestionModal.testNumber}</span>
             </div>
             <p style={{ margin: 0, fontSize: '1.1rem', lineHeight: 1.5 }}>{viewQuestionModal.question}</p>
           </div>
           
           <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
             <div style={{ padding: '10px', background: viewQuestionModal.correct === 'A' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-dark)', border: viewQuestionModal.correct === 'A' ? '1px solid #10b981' : '1px solid var(--card-border)', borderRadius: '8px' }}><b>A:</b> {viewQuestionModal.optA}</div>
             <div style={{ padding: '10px', background: viewQuestionModal.correct === 'B' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-dark)', border: viewQuestionModal.correct === 'B' ? '1px solid #10b981' : '1px solid var(--card-border)', borderRadius: '8px' }}><b>B:</b> {viewQuestionModal.optB}</div>
             <div style={{ padding: '10px', background: viewQuestionModal.correct === 'C' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-dark)', border: viewQuestionModal.correct === 'C' ? '1px solid #10b981' : '1px solid var(--card-border)', borderRadius: '8px' }}><b>C:</b> {viewQuestionModal.optC}</div>
             <div style={{ padding: '10px', background: viewQuestionModal.correct === 'D' ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-dark)', border: viewQuestionModal.correct === 'D' ? '1px solid #10b981' : '1px solid var(--card-border)', borderRadius: '8px' }}><b>D:</b> {viewQuestionModal.optD}</div>
           </div>

           {viewQuestionModal.explanation && (
             <div style={{ padding: '15px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid #0284c7', borderRadius: '8px', color: '#38bdf8', fontSize: '0.9rem' }}>
               <b style={{ color: '#fff' }}>Explanation:</b> {viewQuestionModal.explanation}
             </div>
           )}
         </div>
       </div>
      )}

      {/* ========================================== */}
      {/* ADD QUESTION MODAL */}
      {/* ========================================== */}
      {isAddModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div className="modal-card" style={{ maxWidth: '700px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><PenNib color="var(--accent-primary)" /> Add Talentino Question</h2>
              <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsAddModalOpen(false)} />
            </div>

            {error && (
              <div className="alert alert-error" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <WarningCircle size={20} /> {error}
              </div>
            )}

            <form onSubmit={handleAddQuestion}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div className="form-group">
                  <label>Question ID</label>
                  <input type="text" name="id" value={formData.id} readOnly style={{ background: 'var(--bg-dark)', opacity: 0.7 }} />
                </div>
                <div className="form-group">
                  <label>Test Number / Name</label>
                  <input type="text" name="testNumber" value={formData.testNumber} onChange={handleInputChange} placeholder="e.g. 1 or Test 1" required />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>Question Text</label>
                <textarea 
                  name="question" 
                  className="sleek-input" 
                  placeholder="Enter the question here..." 
                  style={{ width: '100%', minHeight: '80px', resize: 'vertical' }} 
                  value={formData.question} 
                  onChange={handleInputChange} 
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div className="form-group"><label>Option A</label><input type="text" name="optA" value={formData.optA} onChange={handleInputChange} required /></div>
                <div className="form-group"><label>Option B</label><input type="text" name="optB" value={formData.optB} onChange={handleInputChange} required /></div>
                <div className="form-group"><label>Option C</label><input type="text" name="optC" value={formData.optC} onChange={handleInputChange} required /></div>
                <div className="form-group"><label>Option D</label><input type="text" name="optD" value={formData.optD} onChange={handleInputChange} required /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px', marginBottom: '20px' }}>
                <div className="form-group">
                  <label>Correct Answer</label>
                  <select name="correct" value={formData.correct} onChange={handleInputChange} className="sleek-select" style={{ width: '100%', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid #10b981', fontWeight: 'bold' }}>
                    <option value="A">Option A</option><option value="B">Option B</option><option value="C">Option C</option><option value="D">Option D</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Explanation (Optional)</label>
                  <input type="text" name="explanation" placeholder="Step-by-step logic..." value={formData.explanation} onChange={handleInputChange} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #1e293b', paddingTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
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