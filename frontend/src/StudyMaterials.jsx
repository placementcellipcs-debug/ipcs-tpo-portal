import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  CircleNotch, BookOpenText, Plus, CaretLeft, Link as LinkIcon, 
  FilePdf, FileImage, FileText, FileVideo, CheckCircle, WarningCircle, X,
  FolderOpen, PencilSimple, Trash
} from '@phosphor-icons/react';
import Layout from './Layout';

const TILE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];

const getStandardCourse = (c) => {
  if (!c) return 'Others';
  const lower = c.toLowerCase().trim();
  if (lower.includes('bms') || lower.includes('cctv')) return 'BMS AND CCTV';
  if (lower.includes('automation') || lower.includes('plc') || lower.includes('scada')) return 'Industrial Automation';
  if (lower.includes('embed') || lower.includes('iot')) return 'Embedded and IoT';
  if (lower.includes('digital') || lower.includes('dm') || lower.includes('marketing')) return 'Digital Marketing';
  if (lower.includes('it') || lower.includes('python') || lower.includes('software') || lower.includes('data')) return 'Information technology (IT)';
  return 'Others';
};

export default function StudyMaterials() {
  const tpoDataStr = localStorage.getItem('tpoData');
  const tpoData = tpoDataStr ? JSON.parse(tpoDataStr) : null;
  
  const upperRole = (tpoData?.role || '').toUpperCase();
  const isSuperAdmin = tpoData?.accessType === 'superadmin' || upperRole.includes('GENERAL MANAGER') || upperRole.includes('ZONAL PLACEMENT HEAD') || upperRole === 'TECHNICAL HEAD';
  const isRth = upperRole.includes('RTH') || upperRole.includes('REGIONAL TECHNICAL HEAD');
  
  // 🚨 RTH & ADMIN CAN ADD MATERIALS
  const canManage = isSuperAdmin || isRth;

  const [courseDict, setCourseDict] = useState({});
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // 🚨 FIXED: We bypass the broken sub-courses view completely.
  const [viewLevel, setViewLevel] = useState(isSuperAdmin ? 'main_courses' : 'materials');
  const [selectedMainCourse, setSelectedMainCourse] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    id: '', course: '', module: '', title: '', fileType: 'pdf', link: '', status: 'Active'
  });

  const fetchData = async () => {
    try {
      const [matRes, courseRes] = await Promise.all([
        axios.get('https://ipcs-tpo-portal-u0l6.onrender.com/api/lms/materials'),
        axios.get('https://ipcs-tpo-portal-u0l6.onrender.com/api/admin/courses')
      ]);
      if (matRes.data.success) setMaterials(matRes.data.materials || []);
      if (courseRes.data.success) {
        const cDict = courseRes.data.courses || {};
        setCourseDict(cDict);
        
        // Exact Matching for RTH
        if (!isSuperAdmin && tpoData) {
          const stdAssigned = getStandardCourse(tpoData.assignedCourse);
          const matchKey = Object.keys(cDict).find(k => getStandardCourse(k) === stdAssigned);
          setSelectedMainCourse(matchKey || stdAssigned || 'Others');
          setViewLevel('materials');
        }
      }
    } catch (err) {
      console.error("Failed to load data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const MAIN_COURSES = Object.keys(courseDict).length > 0 ? Object.keys(courseDict) : [
    'Industrial Automation', 'BMS AND CCTV', 'Embedded and IoT', 'Digital Marketing', 'Information technology (IT)'
  ];

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const openAddModal = () => {
    const randomId = `MAT${Math.floor(1000 + Math.random() * 9000)}`;
    setFormData({
      id: randomId, 
      course: '', // Let the user type it or select from datalist
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
        ? 'https://ipcs-tpo-portal-u0l6.onrender.com/api/lms/materials/update' 
        : 'https://ipcs-tpo-portal-u0l6.onrender.com/api/lms/materials/add';

      const res = await axios.post(endpoint, formData);
      if (res.data.success) {
        setIsModalOpen(false);
        setLoading(true);
        fetchData(); 
      }
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${isEditMode ? 'update' : 'add'} material.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMaterial = async (id) => {
    if (!window.confirm("Are you sure you want to permanently delete this study material?")) return;
    try {
      const res = await axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/lms/materials/delete', { id });
      if (res.data.success) {
        setMaterials(materials.filter(m => m.id !== id));
      }
    } catch (err) { alert("Failed to delete study material."); }
  };

  const getFileIcon = (type) => {
    const t = String(type).toLowerCase();
    if (t.includes('pdf')) return <FilePdf size={24} color="#ef4444" weight="fill" />;
    if (t.includes('pptx') || t.includes('ppt')) return <FileText size={24} color="#f59e0b" weight="fill" />;
    if (t.includes('mp4') || t.includes('video')) return <FileVideo size={24} color="#3b82f6" weight="fill" />;
    return <FileImage size={24} color="#10b981" weight="fill" />;
  };

  // 🚨 FIXED: Filter strictly by Domain instantly, skipping the empty subcourse view
  const filteredMaterials = materials.filter(m => {
    const matchDomain = getStandardCourse(m.course) === getStandardCourse(selectedMainCourse);
    const matchSearch = (m.title || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                        (m.module || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (m.course || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchDomain && matchSearch;
  });

  // Suggest sub-courses for the Add Modal based on what already exists
  const suggestedCourses = Array.from(new Set([
    ...(courseDict[selectedMainCourse] || []),
    ...materials.filter(m => getStandardCourse(m.course) === getStandardCourse(selectedMainCourse)).map(m => m.course)
  ])).filter(Boolean);

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        {/* DOMAINS VIEW (SUPER ADMIN ONLY) */}
        {viewLevel === 'main_courses' && isSuperAdmin && (
          <>
            <div style={{ marginBottom: '30px' }}>
              <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FolderOpen color="var(--accent-primary)" weight="fill" /> Study Materials Management
              </h1>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>Select a domain to manage all materials within it.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '30px' }}>
              {MAIN_COURSES.map((course, index) => {
                const color = TILE_COLORS[index % TILE_COLORS.length];
                return (
                  <div 
                    key={course} 
                    onClick={() => { setSelectedMainCourse(course); setViewLevel('materials'); }}
                    style={{ backgroundColor: color, borderRadius: '24px', padding: '40px 20px', cursor: 'pointer', textAlign: 'center', minHeight: '200px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}
                  >
                    <h2 style={{ color: '#ffffff', fontSize: '1.6rem', margin: '0 0 15px 0', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>{course}</h2>
                    <div style={{ background: 'rgba(255,255,255,0.2)', padding: '8px 16px', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <BookOpenText size={20} color="#ffffff" weight="bold" />
                      <span style={{ color: '#ffffff', fontSize: '0.9rem', fontWeight: 'bold' }}>View Materials</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* MATERIALS LIST VIEW */}
        {viewLevel === 'materials' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                {isSuperAdmin && (
                  <button onClick={() => { setViewLevel('main_courses'); setSelectedMainCourse(null); }} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: '#fff', padding: '10px 15px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <CaretLeft weight="bold" size={18} /> Domains
                  </button>
                )}
                <div>
                  <h1 style={{ fontSize: '1.6rem', margin: 0 }}>{selectedMainCourse} Materials</h1>
                  <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.85rem' }}>Upload presentations, PDFs, and notes for student access.</p>
                </div>
              </div>
              
              {canManage && (
                <button className="btn-action" onClick={openAddModal} style={{ width: 'auto', padding: '0.8rem 1.5rem' }}>
                  <Plus size={20} weight="bold" /> Upload Material
                </button>
              )}
            </div>

            <div style={{ marginBottom: '20px', maxWidth: '400px', position: 'relative' }}>
              <input 
                type="text" 
                placeholder="Search by topic, program, or title..." 
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
                    <th>Module / Topic</th>
                    <th>Program (Course)</th>
                    <th>Document Title</th>
                    <th>Format</th>
                    <th>Drive Link</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    {canManage && <th style={{ textAlign: 'center' }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={canManage ? 7 : 6} style={{ textAlign: 'center', padding: '3rem' }}><CircleNotch size={32} className="ph-spin" color="var(--accent-primary)" /></td></tr>
                  ) : filteredMaterials.length === 0 ? (
                    <tr><td colSpan={canManage ? 7 : 6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No study materials uploaded for this domain yet.</td></tr>
                  ) : (
                    filteredMaterials.map((mat, i) => (
                      <tr key={i}>
                        <td>
                          <span className="primary-text">{mat.module || 'General'}</span>
                          <span className="sub-text">ID: {mat.id}</span>
                        </td>
                        <td>
                          <span style={{ color: '#cbd5e1', fontSize: '0.85rem' }}>{mat.course}</span>
                        </td>
                        <td><strong style={{ color: 'var(--text-main)' }}>{mat.title}</strong></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>
                            {getFileIcon(mat.fileType)} {mat.fileType}
                          </div>
                        </td>
                        <td>
                          <a href={mat.link} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '6px 12px', borderRadius: '6px', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            <LinkIcon size={16} /> Open Resource
                          </a>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: mat.status.toLowerCase() === 'active' ? '#10b981' : '#ef4444', fontWeight: 'bold', fontSize: '0.8rem' }}>
                            {mat.status.toLowerCase() === 'active' ? <CheckCircle size={16} weight="fill" /> : <WarningCircle size={16} weight="fill" />} 
                            {mat.status}
                          </span>
                        </td>
                        {canManage && (
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              <button onClick={() => openEditModal(mat)} style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid #0284c7', padding: '8px', borderRadius: '8px', cursor: 'pointer' }} title="Edit">
                                <PencilSimple size={18} weight="bold" />
                              </button>
                              <button onClick={() => handleDeleteMaterial(mat.id)} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444', padding: '8px', borderRadius: '8px', cursor: 'pointer' }} title="Delete">
                                <Trash size={18} weight="bold" />
                              </button>
                            </div>
                          </td>
                        )}
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
          <div className="modal-card" style={{ maxWidth: '600px', width: '100%', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><BookOpenText color="var(--accent-primary)" /> {isEditMode ? 'Edit Study Material' : 'Upload Study Material'}</h2>
              <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsModalOpen(false)} />
            </div>

            {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}><WarningCircle size={20} /> {error}</div>}

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px', marginBottom: '15px' }}>
                <div className="form-group"><label>Material ID</label><input type="text" name="id" value={formData.id} readOnly style={{ background: 'var(--bg-dark)', opacity: 0.7 }} /></div>
                
                {/* 🚨 FIXED: Allow free text typing OR selecting from suggestions */}
                <div className="form-group">
                  <label>Assigned Program (Course Name)</label>
                  <input 
                    type="text" 
                    name="course" 
                    value={formData.course} 
                    onChange={handleInputChange} 
                    className="sleek-input" 
                    list="course-suggestions"
                    placeholder="e.g. Java Full Stack" 
                    required 
                  />
                  <datalist id="course-suggestions">
                    {suggestedCourses.map(c => <option key={c} value={c} />)}
                  </datalist>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px', marginBottom: '15px' }}>
                <div className="form-group"><label>Module / Topic</label><input type="text" name="module" placeholder="Module 01" value={formData.module} onChange={handleInputChange} required /></div>
                <div className="form-group"><label>Document Title</label><input type="text" name="title" placeholder="Title" value={formData.title} onChange={handleInputChange} required /></div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px', marginBottom: '20px' }}>
                <div className="form-group">
                  <label>File Type</label>
                  <select name="fileType" value={formData.fileType} onChange={handleInputChange} className="sleek-select" style={{ width: '100%', background: 'var(--input-bg)' }}>
                    <option value="pdf">PDF</option><option value="pptx">PowerPoint (PPTX)</option><option value="docx">Word (DOCX)</option><option value="mp4">Video (MP4)</option><option value="link">External Link</option>
                  </select>
                </div>
                <div className="form-group"><label>SharePoint / OneDrive Link</label><input type="url" name="link" placeholder="https://..." value={formData.link} onChange={handleInputChange} required /></div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #1e293b', paddingTop: '1.5rem' }}>
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn-action" style={{ width: 'auto' }} disabled={isSubmitting}>
                  {isSubmitting ? <CircleNotch size={20} className="ph-spin" /> : (isEditMode ? 'Save Changes' : 'Publish Material')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}