import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  CircleNotch, BookBookmark, Plus, CaretLeft, Trash, 
  WarningCircle, X, FolderOpen, GraduationCap
} from '@phosphor-icons/react';
import Layout from './Layout';

const TILE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#0ea5e9'];

const DEFAULT_COURSES = {
  'BMS AND CCTV': ['Diploma In Building Management System', 'Certified BMS Engineer', 'CCTV & Security Systems', 'CCTV Training'],
  'Industrial Automation': ['Automation System Engineer', 'Professional Diploma in Industrial Automation', 'Advanced Automation System Professional', 'Advanced PLC Program Professional', 'DCS Engineering & Maintenance', 'Electrical Control & Panel Designing', 'Industrial Networking', 'Diploma in Marine Automation Systems', 'VFD Installation Professional', 'Customize programming PLC SCADA'],
  'Embedded and IoT': ['Certified Embedded Engineer', 'Embedded System Design (Crash)', 'Certified Raspberry Pi Programmer', 'Certified Embedded System Engineer', 'Certified IoT Professional', 'LabView Course', 'Certified IIoT Professional'],
  'Digital Marketing': ['Professional Diploma in Digital Marketing', 'Advanced Course in Online Entrepreneurship', 'Advanced Certificate Course in Digital Marketing', 'Search Engine Optimization Certification Course', 'Certificate Course in Digital Marketing', 'Search Engine Marketing Certification Course', 'Social Media Marketing Certification Course', 'Online Money Making Courses', 'Digital Marketing Corporate Training', 'Affiliate Marketing Certification Course', 'Certificate Course in Email Marketing', 'Video Blogging', 'Google Analytics Fundamentals Course', 'International Web Professional', 'Inbound Marketing Certification Course', 'AI Digital Marketing'],
  'Information technology (IT)': ['PHP AND MYSQL', 'JAVA Full Stack', 'Web Designing and Development', 'Python & Data Science', 'Python Programming', 'Data Science & Analytics', 'Android App Development', 'Python Full Stack Development', 'Artificial Intelligence', 'Diploma in Artificial Intelligence', 'AI & Machine Learning with Python', 'Software Testing', 'Basics of Software Testing', 'Advanced QA Automation Testing', 'Cyber Security', 'Cyber Security & Network Security Essentials', 'MERN Stack', 'Data Analytics']
};

export default function Courses() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  const isSuperAdmin = tpoData?.accessType === 'superadmin';

  const [coursesDict, setCoursesDict] = useState(DEFAULT_COURSES); // 🚨 Fallback explicitly loaded
  const [loading, setLoading] = useState(true);
  
  const [viewLevel, setViewLevel] = useState('main_courses');
  const [selectedMainCourse, setSelectedMainCourse] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ mainCourse: '', subCourse: '' });

  const fetchCourses = async () => {
    try {
      const res = await axios.get('https://api-talenzo.ipcsglobal.info/api/admin/courses');
      if (res.data.success && res.data.courses) {
        // 🚨 Validate if backend parsed the sheet properly
        let hasPrograms = false;
        Object.values(res.data.courses).forEach(arr => { if(arr.length > 0) hasPrograms = true; });
        
        if (hasPrograms) {
          setCoursesDict(res.data.courses);
        } else {
          console.warn("Backend returned empty arrays. Falling back to default dictionary.");
        }
      }
    } catch (err) {
      console.error("Failed to load courses", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, []);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const openAddModal = () => {
    setFormData({ mainCourse: selectedMainCourse || Object.keys(coursesDict)[0] || '', subCourse: '' });
    setError('');
    setIsModalOpen(true);
  };

  const handleAddCourse = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const res = await axios.post('https://api-talenzo.ipcsglobal.info/api/admin/courses/add', formData);
      if (res.data.success) {
        setIsModalOpen(false);
        setLoading(true);
        fetchCourses(); 
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add course.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCourse = async (subCourse) => {
    if(!window.confirm(`Are you sure you want to permanently delete the program: ${subCourse}?`)) return;
    
    try {
      const res = await axios.post('https://api-talenzo.ipcsglobal.info/api/admin/courses/delete', { subCourse });
      if (res.data.success) {
        setLoading(true);
        fetchCourses();
      }
    } catch (err) {
      alert("Failed to delete course.");
    }
  };

  if (!isSuperAdmin) {
    return (
      <Layout>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-muted)', textAlign: 'center' }}>
          <WarningCircle size={64} color="#ef4444" weight="fill" style={{ marginBottom: '20px' }} />
          <h2>Access Denied</h2>
          <p>You do not have Super Admin privileges to view the Domain Manager.</p>
        </div>
      </Layout>
    );
  }

  const MAIN_COURSES = Object.keys(coursesDict);
  const activeSubCourses = (coursesDict[selectedMainCourse] || []).filter(c => 
    c.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        {viewLevel === 'main_courses' && (
          <>
            <div style={{ marginBottom: '30px' }}>
              <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FolderOpen color="var(--accent-primary)" weight="fill" /> Domain & Course Manager
              </h1>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>Manage the global dictionary of academic domains and sub-courses used across the portal.</p>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--accent-primary)' }}><CircleNotch size={40} className="ph-spin" /><p>Fetching domains...</p></div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px' }}>
                {MAIN_COURSES.map((course, index) => {
                  const color = TILE_COLORS[index % TILE_COLORS.length];
                  const subCount = coursesDict[course] ? coursesDict[course].length : 0;
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
                        <GraduationCap size={20} color="#ffffff" weight="bold" />
                        <span style={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: 'bold' }}>{subCount} Programs</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {viewLevel === 'sub_courses' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <button onClick={() => { setViewLevel('main_courses'); setSelectedMainCourse(null); }} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: '#fff', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <CaretLeft weight="bold" size={18} /> Domains
                </button>
                <div>
                  <h1 style={{ fontSize: '1.8rem', margin: '0 0 5px 0' }}>{selectedMainCourse}</h1>
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>Add or remove programs within this academic domain.</p>
                </div>
              </div>
              <button className="btn-action" onClick={openAddModal} style={{ width: 'auto', padding: '0.8rem 1.5rem' }}>
                <Plus size={20} weight="bold" /> Add Program
              </button>
            </div>

            <div style={{ marginBottom: '20px', maxWidth: '400px', position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Search programs..." 
                className="sleek-input" 
                style={{ width: '100%' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="table-container">
              <table className="modern-table">
                <thead>
                  <tr>
                    <th>Program / Sub-Course Title</th>
                    <th style={{ textAlign: 'center' }}>Academic Domain</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSubCourses.length === 0 ? (
                    <tr><td colSpan="3" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No programs found in this domain.</td></tr>
                  ) : (
                    activeSubCourses.map((sub, i) => (
                      <tr key={i}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ width: '35px', height: '35px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <BookBookmark size={20} weight="fill" />
                            </div>
                            <span className="primary-text" style={{ fontSize: '1.05rem' }}>{sub}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ display: 'inline-block', background: 'var(--bg-dark)', border: '1px solid var(--card-border)', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>
                            {selectedMainCourse}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            onClick={() => handleDeleteCourse(sub)}
                            style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', transition: '0.2s', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                            title="Delete Course"
                          >
                            <Trash size={16} weight="bold" /> Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div className="modal-card" style={{ maxWidth: '500px', width: '100%', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><GraduationCap color="var(--accent-primary)" /> Add New Program</h2>
              <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsModalOpen(false)} />
            </div>

            {error && (
              <div className="alert alert-error" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <WarningCircle size={20} /> {error}
              </div>
            )}

            <form onSubmit={handleAddCourse}>
              <div className="form-group" style={{ marginBottom: '15px' }}>
                <label>Select Parent Domain</label>
                <select name="mainCourse" value={formData.mainCourse} onChange={handleInputChange} className="sleek-select" style={{ width: '100%', background: 'var(--input-bg)' }} required>
                  {MAIN_COURSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '25px' }}>
                <label>Program / Sub-Course Title</label>
                <input 
                  type="text" 
                  name="subCourse" 
                  placeholder="e.g. Certified Data Analyst" 
                  className="sleek-input" 
                  style={{ width: '100%' }} 
                  value={formData.subCourse} 
                  onChange={handleInputChange} 
                  required 
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #1e293b', paddingTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-action" style={{ width: 'auto' }} disabled={isSubmitting}>
                  {isSubmitting ? <CircleNotch size={20} className="ph-spin" /> : 'Save Program'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </Layout>
  );
}