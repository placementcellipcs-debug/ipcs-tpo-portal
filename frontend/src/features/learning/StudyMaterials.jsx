import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  CircleNotch, BookOpenText, Plus, CaretLeft,
  FilePdf, FileImage, FileText, FileVideo, WarningCircle, X, Eye,
  FolderOpen, BookBookmark, PencilSimple, Trash
} from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import { API_BASE } from '../../services/apiConfig';

const TILE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', 'var(--accent-primary)'];

const DEFAULT_COURSES = {
  'BMS AND CCTV': ['Diploma In Building Management System', 'Certified BMS Engineer', 'CCTV & Security Systems', 'CCTV Training'],
  'Industrial Automation': ['Automation System Engineer', 'Professional Diploma in Industrial Automation', 'Advanced Automation System Professional', 'Advanced PLC Program Professional', 'DCS Engineering & Maintenance', 'Electrical Control & Panel Designing', 'Industrial Networking', 'Diploma in Marine Automation Systems', 'VFD Installation Professional', 'Customize programming PLC SCADA'],
  'Embedded and IoT': ['Certified Embedded Engineer', 'Embedded System Design (Crash)', 'Certified Raspberry Pi Programmer', 'Certified Embedded System Engineer', 'Certified IoT Professional', 'LabView Course', 'Certified IIoT Professional'],
  'Digital Marketing': ['Professional Diploma in Digital Marketing', 'Advanced Course in Online Entrepreneurship', 'Advanced Certificate Course in Digital Marketing', 'Search Engine Optimization Certification Course', 'Certificate Course in Digital Marketing', 'Search Engine Marketing Certification Course', 'Social Media Marketing Certification Course', 'Online Money Making Courses', 'Digital Marketing Corporate Training', 'Affiliate Marketing Certification Course', 'Certificate Course in Email Marketing', 'Video Blogging', 'Google Analytics Fundamentals Course', 'International Web Professional', 'Inbound Marketing Certification Course', 'AI Digital Marketing'],
  'Information technology (IT)': ['PHP AND MYSQL', 'JAVA Full Stack', 'Web Designing and Development', 'Python & Data Science', 'Python Programming', 'Data Science & Analytics', 'Android App Development', 'Python Full Stack Development', 'Artificial Intelligence', 'Diploma in Artificial Intelligence', 'AI & Machine Learning with Python', 'Software Testing', 'Basics of Software Testing', 'Advanced QA Automation Testing', 'Cyber Security', 'Cyber Security & Network Security Essentials', 'MERN Stack', 'Data Analytics']
};

const getStandardCourse = value => {
  const text = String(value || '').toLowerCase().trim();
  if (text.includes('bms') || text.includes('cctv')) return 'BMS AND CCTV';
  if (text.includes('automation') || text.includes('plc') || text.includes('scada')) return 'Industrial Automation';
  if (text.includes('embed') || text.includes('iot')) return 'Embedded and IoT';
  if (text.includes('digital') || text.includes('dm') || text.includes('marketing')) return 'Digital Marketing';
  if (text.includes('information technology') || /(^|[^a-z])it([^a-z]|$)/.test(text) || ['python', 'software', 'data science', 'data analytics', 'artificial intelligence', 'cyber security', 'web development', 'java', 'php'].some(term => text.includes(term))) return 'Information technology (IT)';
  return 'Others';
};

export default function StudyMaterials() {
  const tpoDataStr = localStorage.getItem('tpoData');
  const tpoData = tpoDataStr ? JSON.parse(tpoDataStr) : null;
  
  const upperRole = (tpoData?.role || '').toUpperCase();
  const isSuperAdmin = tpoData?.accessType === 'superadmin' || ['SYSTEM ADMIN', 'GENERAL MANAGER', 'ZONAL PLACEMENT HEAD', 'TECHNICAL HEAD'].includes(upperRole);
  const canManage = isSuperAdmin;
  const rawCourse = tpoData?.assignedCourse || 'All';
  const courseValues = (Array.isArray(rawCourse) ? rawCourse : String(rawCourse).split(/[\n,;]+/)).map(course => String(course).trim()).filter(Boolean);
  const assignedCoursesArray = courseValues.some(course => /^all( courses)?$/i.test(course)) ? ['All'] : [...new Set(courseValues.map(getStandardCourse))];

  const [courseDict, setCourseDict] = useState(DEFAULT_COURSES);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [viewLevel, setViewLevel] = useState('main_courses');
  const [selectedMainCourse, setSelectedMainCourse] = useState(null);
  const [selectedSubCourse, setSelectedSubCourse] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  
  const [formData, setFormData] = useState({
    id: '', course: '', module: '', title: '', fileType: 'pdf', link: '', status: 'Active'
  });

  useEffect(() => {
    if (!isModalOpen && !selectedMaterial) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = event => {
      if (event.key !== 'Escape') return;
      setIsModalOpen(false);
      setSelectedMaterial(null);
      setPreviewUrl('');
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isModalOpen, selectedMaterial]);

  const fetchData = async () => {
    try {
      const [matRes, courseRes] = await Promise.all([
        axios.get(`${API_BASE}/api/lms/materials`),
        axios.get(`${API_BASE}/api/courses`)
      ]);
      
      if (matRes.data.success) {
        setMaterials(matRes.data.materials || []);
      }
      
      let cDict = { ...DEFAULT_COURSES };
      if (courseRes.data.success && Object.keys(courseRes.data.courses || {}).length > 0) {
        for (const key in courseRes.data.courses) {
           if (courseRes.data.courses[key] && courseRes.data.courses[key].length > 0) {
              cDict[key] = courseRes.data.courses[key];
           }
        }
      }
      setCourseDict(cDict);

      let allowedDomains = Object.keys(cDict);
      if (!isSuperAdmin && !assignedCoursesArray.includes('All')) allowedDomains = allowedDomains.filter(domain => assignedCoursesArray.includes(getStandardCourse(domain)));

      if (allowedDomains.length === 1) {
        setSelectedMainCourse(allowedDomains[0]);
        setViewLevel('sub_courses'); 
      } else {
        setViewLevel('main_courses');
      }

    } catch (err) {
      console.error("Failed to load data", err);
      setAccessDenied(err.response?.status === 403);
      setLoadError(err.response?.status === 403 ? 'Your account is not assigned to study materials.' : (err.response?.data?.message || 'Study materials could not be loaded.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- Load the signed-in user's initial catalog once per page mount.

  let MAIN_COURSES = Object.keys(courseDict);
  if (!isSuperAdmin && !assignedCoursesArray.includes('All')) {
    MAIN_COURSES = MAIN_COURSES.filter(domain => assignedCoursesArray.includes(getStandardCourse(domain)));
  }

  const subCoursesList = courseDict[selectedMainCourse] || [selectedMainCourse] || [];

  const filteredMaterials = materials.filter(m => {
    const matchSubCourse = (m.course || '').trim() === (selectedSubCourse || '').trim();
    const matchSearch = (m.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                        (m.module || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchSubCourse && matchSearch;
  });

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const openAddModal = () => {
    const randomId = `MAT${Math.floor(10000 + Math.random() * 90000)}`;
    setFormData({
      id: randomId, 
      course: selectedSubCourse, 
      module: '', title: '', fileType: 'pdf', link: '', status: 'Active'
    });
    setIsEditMode(false);
    setError('');
    setIsModalOpen(true);
  };

  const openEditModal = (mat) => {
    setFormData({
      id: mat.id, course: mat.course, module: mat.module,
      title: mat.title, fileType: mat.fileType, link: mat.link, status: mat.status || 'Active'
    });
    setIsEditMode(true);
    setError('');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const endpoint = isEditMode 
        ? `${API_BASE}/api/lms/materials/update` 
        : `${API_BASE}/api/lms/materials/add`;

      const res = await axios.post(endpoint, formData);
      if (res.data.success) {
        setIsModalOpen(false);
        fetchData(); 
      }
    } catch (err) {
      setError(err.response?.data?.message || `Failed to save material.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMaterial = async (id) => {
    if (!window.confirm("Are you sure you want to permanently delete this study material?")) return;
    setMaterials(prev => prev.filter(m => m.id !== id));
    try {
      await axios.post(`${API_BASE}/api/lms/materials/delete`, { id });
      fetchData(); 
    } catch { 
      alert("Failed to delete study material."); 
      fetchData(); 
    }
  };

  const getFileIcon = (type) => {
    const t = String(type).toLowerCase();
    if (t.includes('pdf')) return <FilePdf size={24} color="#ef4444" weight="fill" />;
    if (t.includes('pptx') || t.includes('ppt')) return <FileText size={24} color="#f59e0b" weight="fill" />;
    if (t.includes('mp4') || t.includes('video')) return <FileVideo size={24} color="#3b82f6" weight="fill" />;
    return <FileImage size={24} color="#10b981" weight="fill" />;
  };

  const openMaterialPreview = async material => {
    setSelectedMaterial(material);
    setPreviewUrl('');
    setPreviewError('');
    setPreviewLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/api/lms/materials/${encodeURIComponent(material.id)}/view`);
      if (!response.data?.success || !response.data.previewUrl) throw new Error('An in-app preview is unavailable for this file.');
      setPreviewUrl(response.data.previewUrl);
    } catch (err) {
      setPreviewError(err.response?.data?.message || err.message || 'This file could not be opened in the preview.');
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        {loading && <div style={{ minHeight: '40vh', display: 'grid', placeItems: 'center', color: 'var(--accent-primary)' }}><div style={{ textAlign: 'center' }}><CircleNotch size={42} className="ph-spin" /><p style={{ color: 'var(--text-muted)' }}>Loading assigned study materials…</p></div></div>}
        {!loading && loadError && <div role="alert" style={{ padding: '22px', borderRadius: '14px', border: '1px solid rgba(239,68,68,.45)', background: 'rgba(127,29,29,.16)', color: '#fca5a5' }}><strong>{accessDenied ? 'Access Denied' : 'Study Materials Unavailable'}</strong><p style={{ margin: '8px 0 0' }}>{loadError}</p></div>}
        {!loading && !loadError && viewLevel === 'main_courses' && (
          <>
            <div style={{ marginBottom: '30px' }}>
              <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FolderOpen color="var(--accent-primary)" weight="fill" /> Study Materials
              </h1>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>{isSuperAdmin ? 'Select a course to view or manage its learning resources.' : 'Select an assigned course to explore its programs and materials.'}</p>
            </div>
            
            {MAIN_COURSES.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                No domains assigned. Please contact the administrator.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px' }}>
                {MAIN_COURSES.map((course, index) => {
                  const color = TILE_COLORS[index % TILE_COLORS.length];
                  return (
                    <div key={course} onClick={() => { setSelectedMainCourse(course); setViewLevel('sub_courses'); }} style={{ backgroundColor: color, borderRadius: '24px', padding: '40px 20px', cursor: 'pointer', textAlign: 'center', minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                      <h2 style={{ color: '#ffffff', fontSize: '1.6rem', margin: '0 0 15px 0', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>{course}</h2>
                      <div style={{ background: 'rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '8px' }}><BookOpenText size={20} color="#ffffff" weight="bold" /><span style={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: 'bold' }}>View Programs</span></div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {!loading && !loadError && viewLevel === 'sub_courses' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '30px', gap: '15px', flexWrap: 'wrap' }}>
              {/* 🚨 ALLOW RTH WITH MULTIPLE DOMAINS TO GO BACK */}
              {MAIN_COURSES.length > 1 && (
                <button onClick={() => { setViewLevel('main_courses'); setSelectedMainCourse(null); }} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: '#fff', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <CaretLeft weight="bold" size={18} /> Back to Domains
                </button>
              )}
              <div><h1 style={{ fontSize: '1.8rem', margin: '0 0 5px 0' }}>{selectedMainCourse} Programs</h1><p style={{ color: 'var(--text-muted)', margin: 0 }}>Choose a program to view its study materials.</p></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
              {subCoursesList.map((subCourse) => (
                <div key={subCourse} onClick={() => { setSelectedSubCourse(subCourse); setViewLevel('materials'); }} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '1.5rem', cursor: 'pointer', transition: '0.2s', display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ width: '45px', height: '45px', borderRadius: '10px', background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><BookBookmark size={24} weight="fill" /></div>
                  <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-main)', lineHeight: 1.4 }}>{subCourse}</h3>
                </div>
              ))}
            </div>
          </>
        )}

        {!loading && !loadError && viewLevel === 'materials' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <button onClick={() => { setViewLevel('sub_courses'); setSelectedSubCourse(null); }} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: '#fff', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <CaretLeft weight="bold" size={18} /> Programs
                </button>
                <div><h1 style={{ fontSize: '1.6rem', margin: 0 }}>{selectedSubCourse} Materials</h1><p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.85rem' }}>{canManage ? 'Review and manage the materials available to assigned learners.' : 'Materials open in the secure preview in this workspace.'}</p></div>
              </div>
              {canManage && <button className="btn-action" onClick={openAddModal} style={{ width: 'auto', padding: '0.8rem 1.5rem' }}><Plus size={20} weight="bold" /> Upload Material</button>}
            </div>

            <div style={{ marginBottom: '20px', maxWidth: '400px', position: 'relative' }}>
              <input type="text" placeholder="Search by topic or title..." className="sleek-input" style={{ width: '100%' }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>

            {filteredMaterials.length === 0 ? <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--card-border)' }}>No study materials have been uploaded for this program yet.</div> : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                {filteredMaterials.map(mat => <article key={mat.id} style={{ minWidth: 0, padding: '20px', borderRadius: '16px', border: '1px solid var(--card-border)', background: 'linear-gradient(145deg, rgba(30,41,59,.72), rgba(15,23,42,.82))', boxShadow: '0 12px 30px rgba(0,0,0,.18)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}><span>{getFileIcon(mat.fileType)}</span><span style={{ color: 'var(--text-muted)', fontSize: '.72rem', textTransform: 'uppercase', fontWeight: 800 }}>{mat.fileType || 'File'}</span></div>
                  <span style={{ color: 'var(--accent-primary)', fontSize: '.75rem', fontWeight: 800 }}>{mat.module || 'General'}</span>
                  <h3 style={{ margin: '7px 0 16px', color: 'var(--text-main)', fontSize: '1rem', lineHeight: 1.45, overflowWrap: 'anywhere' }}>{mat.title || 'Study Material'}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <button type="button" onClick={() => openMaterialPreview(mat)} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', border: '1px solid rgba(56,189,248,.45)', borderRadius: '9px', padding: '8px 12px', color: 'var(--accent-primary)', background: 'rgba(56,189,248,.1)', fontWeight: 800, cursor: 'pointer' }}><Eye size={17} /> View</button>
                    {canManage && <div style={{ display: 'flex', gap: '7px' }}><button onClick={() => openEditModal(mat)} style={{ background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-primary)', border: '1px solid #0284c7', padding: '8px', borderRadius: '8px', cursor: 'pointer' }} title="Edit"><PencilSimple size={17} /></button><button onClick={() => handleDeleteMaterial(mat.id)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444', padding: '8px', borderRadius: '8px', cursor: 'pointer' }} title="Delete"><Trash size={17} /></button></div>}
                  </div>
                </article>)}
              </div>
            )}
          </>
        )}
      </div>

      {selectedMaterial && (
        <div role="presentation" onContextMenu={event => event.preventDefault()} onClick={event => { if (event.target === event.currentTarget) { setSelectedMaterial(null); setPreviewUrl(''); } }} style={{ position: 'fixed', inset: 0, zIndex: 100000, display: 'grid', placeItems: 'center', padding: 'clamp(8px, 2vw, 24px)', background: 'rgba(2,6,23,.78)', backdropFilter: 'blur(18px) saturate(145%)' }}>
          <section role="dialog" aria-modal="true" aria-label={selectedMaterial.title} style={{ width: 'min(1200px, 100%)', height: 'min(820px, 92dvh)', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '22px', border: '1px solid rgba(255,255,255,.18)', background: 'rgba(15,23,42,.88)', boxShadow: '0 30px 90px rgba(0,0,0,.55)', backdropFilter: 'blur(28px) saturate(155%)', userSelect: 'none', WebkitUserSelect: 'none' }}>
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '16px 20px', borderBottom: '1px solid rgba(148,163,184,.18)' }}><div style={{ minWidth: 0 }}><span style={{ color: 'var(--accent-primary)', fontSize: '.72rem', fontWeight: 800 }}>{selectedMaterial.module || 'Study Material'}</span><h2 style={{ margin: '3px 0 0', fontSize: '1rem', overflowWrap: 'anywhere' }}>{selectedMaterial.title}</h2></div><button type="button" aria-label="Close preview" onClick={() => { setSelectedMaterial(null); setPreviewUrl(''); }} style={{ flex: '0 0 auto', border: 0, borderRadius: '50%', width: '38px', height: '38px', color: '#cbd5e1', background: 'rgba(148,163,184,.14)', cursor: 'pointer' }}><X size={19} /></button></header>
            <div style={{ flex: 1, minHeight: 0, position: 'relative', background: '#080d18' }} onContextMenu={event => event.preventDefault()}>
              {previewLoading && <div style={{ position: 'absolute', inset: 0, zIndex: 1, display: 'grid', placeItems: 'center', color: 'var(--accent-primary)' }}><div style={{ textAlign: 'center' }}><CircleNotch size={38} className="ph-spin" /><p style={{ color: '#cbd5e1' }}>Preparing preview…</p></div></div>}
              {previewError && <div role="alert" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: '24px', textAlign: 'center', color: '#fca5a5' }}>{previewError}</div>}
              {previewUrl && <iframe src={previewUrl} title={`${selectedMaterial.title} preview`} referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-forms allow-presentation" onContextMenu={event => event.preventDefault()} style={{ width: '100%', height: '100%', border: 0, userSelect: 'none' }} />}
            </div>
          </section>
        </div>
      )}

      {isModalOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(2,6,23,.78)', backdropFilter: 'blur(18px) saturate(145%)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 'clamp(8px, 2vw, 24px)' }} onClick={event => { if (event.target === event.currentTarget) setIsModalOpen(false); }}>
          <div className="modal-card" style={{ maxWidth: '600px', maxHeight: '92dvh', overflowY: 'auto', width: '100%', background: 'rgba(15,23,42,.94)', border: '1px solid rgba(255,255,255,.18)', borderRadius: '20px', padding: 'clamp(16px, 3vw, 30px)', backdropFilter: 'blur(26px) saturate(155%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><BookOpenText color="var(--accent-primary)" /> {isEditMode ? 'Edit Study Material' : 'Upload Study Material'}</h2>
              <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsModalOpen(false)} />
            </div>
            {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}><WarningCircle size={20} /> {error}</div>}
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px', marginBottom: '15px' }}>
                <div className="form-group"><label>Material ID</label><input type="text" name="id" value={formData.id} readOnly style={{ background: 'var(--bg-dark)', opacity: 0.7 }} /></div>
                <div className="form-group"><label>Assigned Program</label><input type="text" name="course" value={formData.course} readOnly className="sleek-input" style={{ background: 'var(--bg-dark)', opacity: 0.7, color: 'var(--text-muted)' }} /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px', marginBottom: '15px' }}>
                <div className="form-group"><label>Module / Topic</label><input type="text" name="module" placeholder="Module 01" value={formData.module} onChange={handleInputChange} required /></div>
                <div className="form-group"><label>Document Title</label><input type="text" name="title" placeholder="Title" value={formData.title} onChange={handleInputChange} required /></div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px', marginBottom: '20px' }}>
                <div className="form-group"><label>File Type</label><select name="fileType" value={formData.fileType} onChange={handleInputChange} className="sleek-select" style={{ width: '100%', background: 'var(--input-bg)' }}><option value="pdf">PDF</option><option value="pptx">PowerPoint (PPTX)</option><option value="docx">Word (DOCX)</option><option value="mp4">Video (MP4)</option><option value="link">External Link</option></select></div>
                <div className="form-group"><label>SharePoint / OneDrive Link</label><input type="url" name="link" placeholder="https://..." value={formData.link} onChange={handleInputChange} required /></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #1e293b', paddingTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-action" style={{ width: 'auto' }} disabled={isSubmitting}>{isSubmitting ? <CircleNotch size={20} className="ph-spin" /> : (isEditMode ? 'Save Changes' : 'Publish Material')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
