import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, Target, ChartLineUp, Buildings, ShieldCheck, Briefcase, UsersThree, Plus } from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

export default function Reports() {
  const tpoDataStr = localStorage.getItem('tpoData');
  const tpoData = tpoDataStr ? JSON.parse(tpoDataStr) : null;
  const isSuperAdmin = tpoData?.accessType === 'superadmin';
  const myName = (tpoData?.name || '').toLowerCase().trim();
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(1);

  const currentMonthStr = new Date().toISOString().slice(0, 7); 
  const [monthFilter, setMonthFilter] = useState(currentMonthStr);

  const [students, setStudents] = useState([]);
  const [vacancies, setVacancies] = useState([]); 
  const [events, setEvents] = useState([]);
  const [tpoLogs, setTpoLogs] = useState([]); 
  
  const [tpoList, setTpoList] = useState([]);
  const [allBranchesList, setAllBranchesList] = useState([]);
  // Replaced hardcoded courses with dynamic state (initialized with the 5 defaults)
  const [mainCourses, setMainCourses] = useState(['Industrial Automation', 'BMS AND CCTV', 'Information technology (IT)', 'Digital Marketing', 'Embedded and IoT']);

  // 🚨 NEW STATES FOR TPO ACTIVITY
  const [tpoStatsData, setTpoStatsData] = useState([]);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityForm, setActivityForm] = useState({ companiesVisited: 0, branchVideos: 0, branchPosters: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const [res, uRes, bRes, cRes] = await Promise.all([
          axios.post(`${API_BASE}/api/tpo/reports`, { assignedBranchesArray: ['all'] }),
          axios.get(`${API_BASE}/api/admin/users`),
          axios.get(`${API_BASE}/api/admin/branches`),
          axios.get(`${API_BASE}/api/admin/courses`).catch(() => ({ data: { success: false } })) // Graceful fail if endpoint missing
        ]);
        
        if (res.data.success) {
          setStudents(res.data.students || []);
          setVacancies(res.data.vacancies || []);
          setEvents(res.data.events || []);
          setTpoLogs(res.data.tpoLogs || []); 
          setTpoStatsData(res.data.tpoStats || []); // 🚨 FETCHED STATS
        }

        if (uRes.data.success) {
          const tpos = (uRes.data.users || []).filter(u => u.role === 'TPO');
          if (isSuperAdmin) {
            setTpoList(tpos);
          } else {
            const me = tpos.find(t => (t.userName||'').toLowerCase().trim() === myName);
            setTpoList(me ? [me] : [tpoData]); 
          }
        }

        if (bRes.data.success) {
          const branches = bRes.data.branches.map(b => b.branch).filter(Boolean).sort((a,b)=>a.localeCompare(b));
          setAllBranchesList(branches);
        }

        if (cRes?.data?.success && cRes.data.courses) {
          const fetchedCourses = Object.keys(cRes.data.courses).filter(c => c.trim() !== '' && c !== 'Others');
          if (fetchedCourses.length > 0) setMainCourses(fetchedCourses);
        }

      } catch (error) {
        console.error("Failed to fetch reports", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, [isSuperAdmin, myName, tpoData]); 

  // Course normalizer for matrix alignment
  const getCourse = (c) => {
    if(!c) return 'Others';
    const lower = c.toLowerCase();
    const matched = mainCourses.find(mc => lower.includes(mc.toLowerCase().split(' ')[0]));
    if (matched) return matched;
    
    // Fallback mappings if names are abbreviated in students sheet
    if(lower.includes('auto')) return mainCourses.find(c => c.includes('Automation')) || 'Industrial Automation';
    if(lower.includes('bms') || lower.includes('cctv')) return mainCourses.find(c => c.includes('BMS')) || 'BMS AND CCTV';
    if(lower.includes('it') || lower.includes('software')) return mainCourses.find(c => c.includes('IT') || c.includes('Information')) || 'Information technology (IT)';
    if(lower.includes('dm') || lower.includes('digital')) return mainCourses.find(c => c.includes('Digital')) || 'Digital Marketing';
    if(lower.includes('embed') || lower.includes('iot')) return mainCourses.find(c => c.includes('Embed')) || 'Embedded and IoT';
    
    return 'Others';
  };

  const checkMonth = (dateStr) => {
    if (!monthFilter) return true;
    if (!dateStr) return false;
    let year, month;
    if (dateStr.includes('/')) {
      const parts = dateStr.split(/[/\s,]+/); 
      year = parts[2];
      month = parts[1].padStart(2, '0');
    } else if (dateStr.includes('-')) {
      const parts = dateStr.split(' ')[0].split('-');
      year = parts[0];
      month = parts[1].padStart(2, '0');
    } else {
      const d = new Date(dateStr);
      if (isNaN(d)) return false;
      year = d.getFullYear();
      month = String(d.getMonth() + 1).padStart(2, '0');
    }
    return `${year}-${month}` === monthFilter;
  };

  const getVal = (obj, searchStr) => {
    const key = Object.keys(obj).find(k => k.toLowerCase().replace(/\s/g, '').includes(searchStr.toLowerCase().replace(/\s/g, '')));
    return key ? obj[key] : '';
  };

  const isAssignedBranch = (b) => {
    if (!tpoData || !tpoData.assignedBranchesArray) return false;
    if (tpoData.assignedBranchesArray.includes('all')) return true;
    return tpoData.assignedBranchesArray.some(assigned => (b || '').toLowerCase().includes(assigned.toLowerCase()));
  };

  const displayMonthName = new Date(monthFilter + '-01').toLocaleString('default', { month: 'long', year: 'numeric' });

  // 1. BRANCH ENROLLMENTS
  const assignedBranches = [...new Set(students.filter(s => isAssignedBranch(s.branch)).map(s => s.branch))].filter(Boolean).sort();
  const branchEnrolls = {};
  const enrollTotals = { Others: 0, Total: 0 };
  mainCourses.forEach(c => enrollTotals[c] = 0);

  assignedBranches.forEach(b => {
    branchEnrolls[b] = { Others: 0, Total: 0 };
    mainCourses.forEach(c => branchEnrolls[b][c] = 0);
  });

  students.forEach(s => {
    if (isAssignedBranch(s.branch) && branchEnrolls[s.branch]) {
      const c = getCourse(s.course);
      if (branchEnrolls[s.branch][c] !== undefined) {
        branchEnrolls[s.branch][c]++;
        enrollTotals[c]++;
      } else {
        branchEnrolls[s.branch].Others++;
        enrollTotals.Others++;
      }
      branchEnrolls[s.branch].Total++;
      enrollTotals.Total++;
    }
  });

  // 2. BRANCH PLACEMENT MATRIX
  const branchPlaces = {};
  const placeTotals = { Others: 0, Total: 0 };
  mainCourses.forEach(c => placeTotals[c] = 0);

  allBranchesList.forEach(b => {
    branchPlaces[b] = { Others: 0, Total: 0 };
    mainCourses.forEach(c => branchPlaces[b][c] = 0);
  });

  tpoLogs.forEach(log => {
    const b = getVal(log, 'branch');
    const dStr = getVal(log, 'dateplaced') || getVal(log, 'timestamp');
    const logTpo = getVal(log, 'placementofficer').toLowerCase().trim();
    
    // Admins see all, TPOs see only their own placements
    const hasAccessToLog = isSuperAdmin || (logTpo === myName || logTpo.includes(myName) || myName.includes(logTpo));

    if (branchPlaces[b] && checkMonth(dStr) && hasAccessToLog) {
      const stat = (getVal(log, 'status') || '').toLowerCase();
      if(stat.includes('placed') || stat.includes('join') || stat.includes('offer')) {
        const c = getCourse(getVal(log, 'course'));
        if (branchPlaces[b][c] !== undefined) {
          branchPlaces[b][c]++;
          placeTotals[c]++;
        } else {
          branchPlaces[b].Others++;
          placeTotals.Others++;
        }
        branchPlaces[b].Total++;
        placeTotals.Total++;
      }
    }
  });

  // 3. BRANCH VS TPO STATUS
  const branchTPO = {};
  // Determine which TPOs to show as columns based on access level
  const displayTpos = isSuperAdmin ? tpoList.map(t => t.userName || t.name) : [tpoData.name];
  
  allBranchesList.forEach(b => {
    branchTPO[b] = { Total: 0 };
    displayTpos.forEach(tName => branchTPO[b][tName] = 0);
  });

  tpoLogs.forEach(log => {
    const b = getVal(log, 'branch');
    const dStr = getVal(log, 'dateplaced') || getVal(log, 'timestamp');
    const logTpoRaw = getVal(log, 'placementofficer');
    const logTpo = logTpoRaw.toLowerCase().trim();

    if (branchTPO[b] && checkMonth(dStr)) {
      const stat = (getVal(log, 'status') || '').toLowerCase();
      if(stat.includes('placed') || stat.includes('join') || stat.includes('offer')) {
        
        // Find matching column
        const matchedTpoColumn = displayTpos.find(t => {
           const cleanT = t.toLowerCase().trim();
           return logTpo === cleanT || logTpo.includes(cleanT) || cleanT.includes(logTpo);
        });

        if (matchedTpoColumn && branchTPO[b][matchedTpoColumn] !== undefined) {
          branchTPO[b][matchedTpoColumn]++;
          branchTPO[b].Total++;
        }
      }
    }
  });

  // 4. PIPELINE TRACKER
  const pipeline = {};
  mainCourses.concat(['Others']).forEach(c => pipeline[c] = { placed: 0, joined: 0, notJoined: 0 });

  tpoLogs.forEach(log => {
    const dStr = getVal(log, 'dateplaced') || getVal(log, 'timestamp');
    const logTpo = getVal(log, 'placementofficer').toLowerCase().trim();
    const hasAccessToLog = isSuperAdmin || (logTpo === myName || logTpo.includes(myName) || myName.includes(logTpo));

    if (!checkMonth(dStr) || !hasAccessToLog) return;
    
    const c = getCourse(getVal(log, 'course'));
    if (!pipeline[c]) return;
    const stat = (getVal(log, 'status') || '').toLowerCase();
    
    if (stat.includes('placed') || stat.includes('offer')) pipeline[c].placed++;
    else if (stat.includes('join')) { pipeline[c].placed++; pipeline[c].joined++; }
    else if (stat.includes('reject') || stat.includes('not attend')) pipeline[c].notJoined++;
  });

  // 5. PENDING STUDENTS
  const pendingByCourse = {};
  const pendTotals = { Others: 0, Total: 0 };
  mainCourses.forEach(c => pendTotals[c] = 0);

  assignedBranches.forEach(b => {
    pendingByCourse[b] = { Others: 0, Total: 0 };
    mainCourses.forEach(c => pendingByCourse[b][c] = 0);
  });
  
  students.forEach(s => {
    if (isAssignedBranch(s.branch) && pendingByCourse[s.branch]) {
      const stat = (s.placementStatus || '').toLowerCase();
      if (stat.includes('pending') || stat === '') {
        const c = getCourse(s.course);
        if (pendingByCourse[s.branch][c] !== undefined) {
          pendingByCourse[s.branch][c]++;
          pendTotals[c]++;
        } else {
          pendingByCourse[s.branch].Others++;
          pendTotals.Others++;
        }
        pendingByCourse[s.branch].Total++;
        pendTotals.Total++;
      }
    }
  });

  // TPO ACTIVITY LOGIC
  const tpoActivity = tpoList.map(t => {
    const targetName = (t.userName || t.name || '').toLowerCase().trim();
    
    // 🚨 Find manual stats for this TPO in the selected month
    const currentMonthPrefix = monthFilter; // "YYYY-MM" format
    const manualStats = tpoStatsData.find(stat => {
      const statUser = (stat['USER'] || stat['user'] || '').toLowerCase().trim();
      let statMonth = '';
      const ts = getVal(stat, 'timestamp') || '';
      if (ts) {
        const d = new Date(ts);
        if (!isNaN(d)) statMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
      return statUser === targetName && statMonth === currentMonthPrefix;
    });

    // Total Applications & Joining Status from TPO Logs
    const logs = tpoLogs.filter(log => {
       const logTpo = getVal(log, 'placementofficer').toLowerCase().trim();
       const dStr = getVal(log, 'dateplaced') || getVal(log, 'timestamp');
       return checkMonth(dStr) && (logTpo === targetName || logTpo.includes(targetName) || targetName.includes(logTpo));
    });
    
    const joined = logs.filter(log => (getVal(log, 'status') || '').toLowerCase().includes('join')).length;
    const notJoined = logs.filter(log => (getVal(log, 'status') || '').toLowerCase().includes('reject') || (getVal(log, 'status') || '').toLowerCase().includes('not attend')).length;
    const autoUniqueCompanies = new Set(logs.map(log => getVal(log, 'companyname') || getVal(log, 'company')).filter(Boolean)).size;

    // Drives Conducted from Event Sheet
    const tpoEvents = events.filter(e => checkMonth(e.date) && ((e.tpo || '').toLowerCase().includes(targetName) || targetName.includes((e.tpo || '').toLowerCase())));
    const drivesConducted = tpoEvents.filter(e => (e.type || '').toLowerCase().includes('drive')).length;

    return {
      tpo: t.userName || t.name,
      companiesVisited: manualStats && manualStats['Companies Visited'] ? parseInt(manualStats['Companies Visited']) : autoUniqueCompanies,
      branchVideos: manualStats ? parseInt(manualStats['Branch Videos'] || 0) : 0,
      branchPosters: manualStats ? parseInt(manualStats['Branch Posters'] || 0) : 0,
      drivesConducted: drivesConducted,
      joining: joined,
      notJoining: notJoined,
      totalApps: logs.length
    };
  });

  const submitActivityStats = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/api/tpo/activity`, {
        tpoName: myName || tpoData?.name,
        companiesVisited: activityForm.companiesVisited,
        branchVideos: activityForm.branchVideos,
        branchPosters: activityForm.branchPosters
      });
      if (res.data.success) {
        alert("Stats updated successfully!");
        setShowActivityModal(false);
        window.location.reload(); 
      }
    } catch (err) {
      alert("Failed to update stats.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddActivityClick = () => {
    const currentMyStat = tpoActivity.find(t => t.tpo === (tpoData?.name || tpoData?.userName));
    if (currentMyStat) {
      setActivityForm({
        companiesVisited: currentMyStat.companiesVisited,
        branchVideos: currentMyStat.branchVideos,
        branchPosters: currentMyStat.branchPosters
      });
    }
    setShowActivityModal(true);
  };

  const reportStyles = `
    .rt-tabs { display: flex; gap: 15px; margin-bottom: 30px; overflow-x: auto; padding-bottom: 10px; }
    .rt-tab { background: var(--card-bg); border: 1px solid var(--card-border); color: var(--text-muted); padding: 14px 28px; border-radius: 30px; cursor: pointer; white-space: nowrap; font-weight: bold; font-size: 1.05rem; transition: all 0.2s; display: flex; align-items: center; gap: 10px; }
    .rt-tab:hover { background: #1e293b; color: #fff; }
    .rt-tab.active { background: rgba(56, 189, 248, 0.15); color: #8b5cf6; border-color: #8b5cf6; box-shadow: 0 4px 15px rgba(56, 189, 248, 0.2); }
    
    .hero-card { background: #0f1523; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; margin-bottom: 3rem; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
    .hc-header { background: linear-gradient(90deg, #0284c7, #3b82f6); color: #fff; padding: 22px 30px; font-size: 1.4rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; display: flex; justify-content: space-between; align-items: center; }
    .hc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1px; background: #1e293b; }
    .hc-item { background: #0f1523; padding: 25px 30px; }
    .hc-label { font-size: 0.9rem; color: #94a3b8; text-transform: uppercase; margin-bottom: 10px; font-weight: bold; letter-spacing: 0.5px; }
    .hc-value { font-size: 1.4rem; color: #fff; font-weight: 700; word-break: break-word; }
    .hc-subheader { background: #161e2e; color: #8b5cf6; padding: 18px 30px; font-weight: bold; font-size: 1.2rem; border-top: 1px solid #1e293b; border-bottom: 1px solid #1e293b; display: flex; align-items: center; gap: 10px; }
    
    .data-table-wrap { background: #0f1523; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; margin-bottom: 3rem; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
    .data-table-head { background: #161e2e; padding: 22px 30px; font-weight: bold; font-size: 1.25rem; color: #fff; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center; }
    .dt { width: 100%; border-collapse: collapse; }
    .dt th { background: #0f1523; color: #94a3b8; padding: 18px 25px; text-align: center; font-size: 1rem; text-transform: uppercase; border-bottom: 1px solid #1e293b; white-space: nowrap; font-weight: 800; border-right: 1px solid #1e293b; }
    .dt th:first-child { text-align: left; }
    .dt td { padding: 18px 25px; color: #cbd5e1; border-bottom: 1px solid #1e293b; font-size: 1.15rem; text-align: center; border-right: 1px solid #1e293b; font-weight: 600; }
    .dt td:first-child { text-align: left; color: #fff; }
    .dt tr:hover td { background: #161e2e; }
    .dt .dt-total { color: #8b5cf6; font-weight: 800; background: rgba(56, 189, 248, 0.05); }
    .dt .dt-zero { color: #475569; font-weight: 400; }
    .dt tfoot td { background: rgba(255,255,255,0.05); font-weight: 800; color: #fff; font-size: 1.25rem; border-top: 2px solid #8b5cf6; border-bottom: none; }
  `;

  return (
    <Layout>
      <style>{reportStyles}</style>
      <div className="page-container" style={{ padding: 0 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1 style={{ fontSize: '2.4rem', margin: '0 0 8px 0' }}>Live Analytics Reports</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '1.1rem' }}>Comprehensive tracking, matrices, and placement data.</p>
          </div>
          <div>
            <input type="month" className="sleek-input" style={{ background: '#0f1523', border: '1px solid #8b5cf6', color: '#8b5cf6', fontWeight: 'bold', fontSize: '1.15rem', padding: '12px 20px' }} value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
          </div>
        </div>

        <div className="rt-tabs">
          <button className={`rt-tab ${activeTab === 1 ? 'active' : ''}`} onClick={() => setActiveTab(1)}>
            <Target size={24} weight={activeTab === 1 ? "fill" : "regular"} /> {isSuperAdmin ? 'TPO Target Reports' : 'My Target Report'}
          </button>
          <button className={`rt-tab ${activeTab === 2 ? 'active' : ''}`} onClick={() => setActiveTab(2)}>
            <Buildings size={24} weight={activeTab === 2 ? "fill" : "regular"} /> Branch Matrices
          </button>
          <button className={`rt-tab ${activeTab === 3 ? 'active' : ''}`} onClick={() => setActiveTab(3)}>
            <ChartLineUp size={24} weight={activeTab === 3 ? "fill" : "regular"} /> Placement Tracker
          </button>
          <button className={`rt-tab ${activeTab === 4 ? 'active' : ''}`} onClick={() => setActiveTab(4)}>
            <ShieldCheck size={24} weight={activeTab === 4 ? "fill" : "regular"} /> TPO Activities
          </button>
        </div>

        {/* ========================================================= */}
        {/* TAB 1: DYNAMIC STACKED TPO TARGET REPORTS                 */}
        {/* ========================================================= */}
        {activeTab === 1 && (
          <div className="fade-in">
            {tpoList.map((tpo, idx) => {
              const targetTpoName = (tpo.userName || tpo.name || '').toLowerCase().trim();
              
              const placedStudentsLog = tpoLogs.filter(log => {
                const logTpo = getVal(log, 'placementofficer').toLowerCase().trim();
                const isMatch = logTpo === targetTpoName || logTpo.includes(targetTpoName) || targetTpoName.includes(logTpo);
                if (!isMatch) return false;

                const status = getVal(log, 'status').toLowerCase();
                if (!status.includes('placed')) return false;

                const dateStr = getVal(log, 'dateplaced') || getVal(log, 'timestamp') || '';
                return checkMonth(dateStr);
              });

              const counts = { Others: 0 };
              mainCourses.forEach(c => counts[c] = 0);
              
              placedStudentsLog.forEach(p => {
                 const c = getCourse(getVal(p, 'course'));
                 if (counts[c] !== undefined) counts[c]++;
                 else counts.Others++;
              });

              const totalPlacements = placedStudentsLog.length;
              const targetGoal = parseInt(tpo.target) || 20;
              const progressPercent = Math.min((totalPlacements / targetGoal) * 100, 100);

              return (
                <div key={idx} style={{ marginBottom: '4rem' }}>
                  <div className="hero-card">
                    <div className="hc-header">
                      <span>Placement Report</span>
                      <span style={{ color: '#bae6fd' }}>{displayMonthName.toUpperCase()}</span>
                    </div>
                    
                    <div className="hc-grid">
                      <div className="hc-item"><div className="hc-label">Name of the Employee</div><div className="hc-value">{tpo.userName || tpo.name || 'Officer'}</div></div>
                      <div className="hc-item"><div className="hc-label">Sitting Branch</div><div className="hc-value">{tpo.sittingBranch || 'N/A'}</div></div>
                      <div className="hc-item"><div className="hc-label">Emp ID</div><div className="hc-value">{tpo.empId}</div></div>
                      <div className="hc-item"><div className="hc-label">Assigned Branches</div><div className="hc-value" style={{ fontSize: '1rem' }}>{Array.isArray(tpo.assignedBranchesArray) ? tpo.assignedBranchesArray.join(', ').toUpperCase() : (tpo.assignedBranches || '').toUpperCase()}</div></div>
                      <div className="hc-item" style={{ background: 'rgba(16, 185, 129, 0.05)' }}>
                        <div className="hc-label" style={{ color: '#10b981' }}>Target For The Month</div>
                        <div className="hc-value" style={{ color: '#10b981', fontSize: '2rem' }}>{targetGoal}</div>
                      </div>
                    </div>

                    <div className="hc-subheader"><Briefcase size={24} weight="fill" /> Current Status On Placements</div>
                    
                    <div className="hc-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
                      {mainCourses.concat(['Others']).map(c => (
                        <div key={c} className="hc-item" style={{ textAlign: 'center' }}>
                          <div className="hc-label">{c}</div>
                          <div className="hc-value" style={{ fontSize: '2.4rem', color: counts[c] > 0 ? '#8b5cf6' : '#475569' }}>{counts[c]}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ background: '#0f1523', padding: '25px 30px', borderTop: '1px solid #1e293b' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 'bold', fontSize: '1.1rem' }}>Progress to Target</span>
                        <span style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 'bold' }}>{totalPlacements} / {targetGoal} Hires</span>
                      </div>
                      <div style={{ width: '100%', height: '14px', background: '#1e293b', borderRadius: '10px', overflow: 'hidden' }}>
                        <div style={{ width: `${progressPercent}%`, height: '100%', background: progressPercent >= 100 ? '#10b981' : '#8b5cf6', transition: 'width 1s ease-in-out' }}></div>
                      </div>
                    </div>
                  </div>

                  <div className="data-table-wrap">
                    <div className="data-table-head">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Target size={26} color="#10b981" weight="fill"/> Logged Placements</div>
                      <div style={{ fontSize: '1rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 16px', borderRadius: '20px' }}>By {tpo.userName || tpo.name}</div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="dt" style={{ textAlign: 'left' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', paddingLeft: '30px' }}>Student Details</th>
                            <th style={{ textAlign: 'left' }}>Company & Role</th>
                            <th style={{ textAlign: 'left' }}>Salary Package</th>
                            <th style={{ textAlign: 'left' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {placedStudentsLog.length === 0 ? (
                            <tr>
                              <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '1.1rem' }}>
                                No placements recorded for this month.
                              </td>
                            </tr>
                          ) : (
                            placedStudentsLog.map((log, i) => (
                              <tr key={i}>
                                <td style={{ textAlign: 'left', paddingLeft: '30px' }}>
                                  <strong style={{ display: 'block', color: '#fff', fontSize: '1.2rem', marginBottom: '5px' }}>{getVal(log, 'studentname')}</strong>
                                  <span style={{ fontSize: '0.95rem', color: '#94a3b8' }}>{getVal(log, 'branch')} • {getVal(log, 'course')}</span>
                                </td>
                                <td style={{ textAlign: 'left' }}>
                                  <strong style={{ display: 'block', color: '#8b5cf6', fontSize: '1.2rem', marginBottom: '5px' }}>{getVal(log, 'companyname')}</strong>
                                  <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>{getVal(log, 'position') || 'N/A'}</span>
                                </td>
                                <td style={{ textAlign: 'left', color: '#10b981', fontWeight: 'bold', fontSize: '1.2rem' }}>
                                  {getVal(log, 'package') ? `${getVal(log, 'package')} LPA` : '-'}
                                </td>
                                <td style={{ textAlign: 'left' }}>
                                  <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '6px 14px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                    {(getVal(log, 'status') || 'Placed').toUpperCase()}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: BRANCH MATRICES                                    */}
        {/* ========================================================= */}
        {activeTab === 2 && (
          <div className="fade-in">
            <div className="data-table-wrap">
              <div className="data-table-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><UsersThree size={26} color="#f59e0b" weight="fill"/> Branchwise Student Enrollment</div>
                <div style={{ fontSize: '1rem', color: '#94a3b8' }}>My Assigned Branches</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="dt">
                  <thead>
                    <tr><th>Branch Name</th>{mainCourses.map(c => <th key={c}>{c}</th>)}<th>Others</th><th className="dt-total">Total Students</th></tr>
                  </thead>
                  <tbody>
                    {assignedBranches.length === 0 ? <tr><td colSpan={mainCourses.length + 3} style={{textAlign:'center', padding: '2rem'}}>No students found in assigned branches.</td></tr> : 
                    assignedBranches.map(b => (
                      <tr key={`en-${b}`}>
                        <td>{b}</td>
                        {mainCourses.concat(['Others']).map(c => <td key={c} className={branchEnrolls[b][c] === 0 ? 'dt-zero' : ''}>{branchEnrolls[b][c]}</td>)}
                        <td className="dt-total">{branchEnrolls[b].Total}</td>
                      </tr>
                    ))}
                  </tbody>
                  {assignedBranches.length > 0 && (
                    <tfoot>
                      <tr>
                        <td>TOTAL ENROLLMENT</td>
                        {mainCourses.concat(['Others']).map(c => <td key={`foot-${c}`}>{enrollTotals[c]}</td>)}
                        <td style={{ color: '#8b5cf6' }}>{enrollTotals.Total}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            <div className="data-table-wrap">
              <div className="data-table-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Target size={26} color="#10b981" weight="fill"/> Branchwise Placement Matrix</div>
                <div style={{ fontSize: '1rem', color: '#94a3b8' }}>All Branches • {displayMonthName}</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="dt">
                  <thead>
                    <tr><th>Branch Name</th>{mainCourses.map(c => <th key={c}>{c}</th>)}<th>Others</th><th className="dt-total" style={{ color: '#10b981' }}>Total Placed</th></tr>
                  </thead>
                  <tbody>
                    {allBranchesList.map(b => (
                      <tr key={`pl-${b}`}>
                        <td>{b}</td>
                        {mainCourses.concat(['Others']).map(c => <td key={c} className={branchPlaces[b][c] === 0 ? 'dt-zero' : ''}>{branchPlaces[b][c]}</td>)}
                        <td className="dt-total" style={{ color: '#10b981' }}>{branchPlaces[b].Total}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>TOTAL PLACED</td>
                      {mainCourses.concat(['Others']).map(c => <td key={`pfoot-${c}`}>{placeTotals[c]}</td>)}
                      <td style={{ color: '#10b981' }}>{placeTotals.Total}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="data-table-wrap">
              <div className="data-table-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Buildings size={26} color="#8b5cf6" weight="fill"/> Branch vs TPO Status</div>
                <div style={{ fontSize: '1rem', color: '#94a3b8' }}>All Branches • {displayMonthName}</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="dt">
                  <thead>
                    <tr>
                      <th>Branch Name</th>
                      {displayTpos.map(tName => <th key={tName} style={{ color: '#fff' }}>{tName.toUpperCase()}</th>)}
                      <th className="dt-total" style={{ color: '#8b5cf6' }}>Branch Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allBranchesList.map(b => (
                      <tr key={`tpo-${b}`}>
                        <td>{b}</td>
                        {displayTpos.map(tName => (
                          <td key={tName} className={branchTPO[b][tName] === 0 ? 'dt-zero' : ''} style={{ color: branchTPO[b][tName] > 0 ? '#fff' : '' }}>
                            {branchTPO[b][tName]}
                          </td>
                        ))}
                        <td className="dt-total" style={{ color: '#8b5cf6' }}>{branchTPO[b].Total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: PLACEMENT TRACKER                                  */}
        {/* ========================================================= */}
        {activeTab === 3 && (
          <div className="fade-in">
            <div className="data-table-wrap">
              <div className="data-table-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><ChartLineUp size={26} color="#ec4899" weight="fill"/> Placement Data Tracking</div>
                <div style={{ fontSize: '1rem', color: '#94a3b8' }}>{displayMonthName}</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="dt">
                  <thead>
                    <tr>
                      <th>Course Name</th>
                      <th style={{ color: '#10b981' }}>Total Placed</th>
                      <th>Students Joined</th>
                      <th>Not Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mainCourses.concat(['Others']).map(c => {
                      const d = pipeline[c];
                      return (
                        <tr key={`trk-${c}`}>
                          <td>{c}</td>
                          <td style={{ color: '#10b981', fontWeight: 'bold' }} className={d.placed === 0 ? 'dt-zero' : ''}>{d.placed}</td>
                          <td className={d.joined === 0 ? 'dt-zero' : ''}>{d.joined}</td>
                          <td className={d.notJoined === 0 ? 'dt-zero' : ''}>{d.notJoined}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="data-table-wrap">
              <div className="data-table-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><CircleNotch size={26} color="#f59e0b" weight="fill"/> Placement Pending Students</div>
                <div style={{ fontSize: '1rem', color: '#94a3b8' }}>My Assigned Branches</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="dt">
                  <thead>
                    <tr><th>Branch Name</th>{mainCourses.map(c => <th key={c}>{c}</th>)}<th>Others</th><th className="dt-total" style={{ color: '#f59e0b' }}>Total Pending</th></tr>
                  </thead>
                  <tbody>
                    {assignedBranches.length === 0 ? <tr><td colSpan={mainCourses.length + 3} style={{textAlign:'center', padding: '2rem'}}>No pending students in assigned branches.</td></tr> : 
                    assignedBranches.map(b => (
                      <tr key={`pend-${b}`}>
                        <td>{b}</td>
                        {mainCourses.concat(['Others']).map(c => <td key={c} className={pendingByCourse[b][c] === 0 ? 'dt-zero' : ''}>{pendingByCourse[b][c]}</td>)}
                        <td className="dt-total" style={{ color: '#f59e0b' }}>{pendingByCourse[b].Total}</td>
                      </tr>
                    ))}
                  </tbody>
                  {assignedBranches.length > 0 && (
                    <tfoot>
                      <tr>
                        <td>TOTAL PENDING</td>
                        {mainCourses.concat(['Others']).map(c => <td key={`pdfoot-${c}`}>{pendTotals[c]}</td>)}
                        <td style={{ color: '#f59e0b' }}>{pendTotals.Total}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: TPO ACTIVITIES                                     */}
        {/* ========================================================= */}
        {activeTab === 4 && (
          <div className="fade-in">
            <div className="data-table-wrap">
              <div className="data-table-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ShieldCheck size={26} color="#0ea5e9" weight="fill"/> Placement Officer Activities & Logs
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ fontSize: '1rem', color: '#94a3b8' }}>{displayMonthName}</div>
                  <button 
                    onClick={handleAddActivityClick}
                    style={{ background: '#0284c7', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Plus weight="bold" /> Add Activity Count
                  </button>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="dt">
                  <thead>
                    <tr>
                      <th>Placement Officer</th>
                      <th>Companies Visited</th>
                      <th>Drives Conducted</th>
                      <th>Branch Videos</th>
                      <th>Branch Posters</th>
                      <th style={{ color: '#10b981' }}>Total Joined</th>
                      <th style={{ color: '#ef4444' }}>Not Joining</th>
                      <th className="dt-total">Total Apps Handled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tpoActivity.length === 0 ? <tr><td colSpan="8" style={{textAlign:'center', padding: '2rem'}}>No TPO activities logged this month.</td></tr> : 
                    tpoActivity.map(t => (
                      <tr key={`act-${t.tpo}`}>
                        <td>{t.tpo}</td>
                        <td className={t.companiesVisited === 0 ? 'dt-zero' : ''}>{t.companiesVisited}</td>
                        <td className={t.drivesConducted === 0 ? 'dt-zero' : ''}>{t.drivesConducted}</td>
                        <td className={t.branchVideos === 0 ? 'dt-zero' : ''}>{t.branchVideos}</td>
                        <td className={t.branchPosters === 0 ? 'dt-zero' : ''}>{t.branchPosters}</td>
                        <td style={{ color: '#10b981', fontWeight: 'bold' }} className={t.joining === 0 ? 'dt-zero' : ''}>{t.joining}</td>
                        <td style={{ color: '#ef4444', fontWeight: 'bold' }} className={t.notJoining === 0 ? 'dt-zero' : ''}>{t.notJoining}</td>
                        <td className="dt-total">{t.totalApps}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* 🚨 TPO ACTIVITY MODAL */}
      {showActivityModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#0f1523', padding: '30px', borderRadius: '12px', border: '1px solid #1e293b', width: '400px', maxWidth: '90%' }}>
            <h2 style={{ marginTop: 0, color: '#fff', borderBottom: '1px solid #1e293b', paddingBottom: '15px' }}>Update Monthly Stats</h2>
            <form onSubmit={submitActivityStats}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', color: '#94a3b8', marginBottom: '8px' }}>Companies Visited</label>
                <input type="number" required value={activityForm.companiesVisited} onChange={(e) => setActivityForm({...activityForm, companiesVisited: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#fff' }} />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', color: '#94a3b8', marginBottom: '8px' }}>Branch Videos</label>
                <input type="number" required value={activityForm.branchVideos} onChange={(e) => setActivityForm({...activityForm, branchVideos: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#fff' }} />
              </div>
              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', color: '#94a3b8', marginBottom: '8px' }}>Branch Posters</label>
                <input type="number" required value={activityForm.branchPosters} onChange={(e) => setActivityForm({...activityForm, branchPosters: e.target.value})} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#fff' }} />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowActivityModal(false)} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #334155', background: 'transparent', color: '#fff', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', background: '#8b5cf6', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
                  {isSubmitting ? 'Saving...' : 'Save Stats'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </Layout>
  );
}