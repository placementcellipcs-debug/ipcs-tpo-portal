import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, GraduationCap, ChartBar, Briefcase, CalendarCheck, TrendUp, WarningCircle, DownloadSimple } from '@phosphor-icons/react';
import Layout from './Layout';

export default function Reports() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tpoData) return;
    const fetchReportsData = async () => {
      try {
        const response = await axios.post('http://localhost:5000/api/tpo/reports', {
          assignedBranchesArray: tpoData.assignedBranchesArray
        });
        if (response.data.success) {
          setData(response.data);
        }
      } catch (error) { console.error("Failed", error); } finally { setLoading(false); }
    };
    fetchReportsData();
  }, []);

  const downloadCSV = (filename, rows) => {
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `IPCS_${filename}_Report.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = (type) => {
    if (!data) return;
    let csv = [];

    if (type === 'placement') {
      csv.push(["Name", "Roll No", "Branch", "Course", "Status"]);
      data.students.forEach(s => csv.push([s.name, s.roll, s.branch, s.course, s.status]));
    } else if (type === 'application') {
      csv.push(["Student Name", "Roll No", "Job ID", "Company", "Date Applied", "Status", "Remarks"]);
      data.applications.forEach(a => csv.push([a.name, a.roll, a.jobId, a.company, a.date, a.status, a.remarks]));
    } else if (type === 'issue') {
      csv.push(["Student Name", "Branch", "Issue", "Status", "Remarks"]);
      data.issues.forEach(i => csv.push([i.name, i.branch, i.details, i.status, i.remarks]));
    } else if (type === 'attendance') {
      csv.push(["Student Name", "Branch", "Date", "Rating", "Notes"]);
      data.talentino.forEach(r => csv.push([r.name, r.branch, r.date, r.rating, r.notes]));
    } else if (type === 'recruiter') {
      csv.push(["Job ID", "Company", "Location", "Mode", "Status", "Total Applications"]);
      data.vacancies.forEach(v => {
        let appCount = data.applications.filter(a => a.jobId === v.id).length;
        csv.push([v.id, v.company, v.location, v.mode, v.status, appCount]);
      });
    } else if (type === 'branch') {
      csv.push(["Branch", "Total Students", "Placed", "Placement Rate"]);
      const branchCounts = {}; const placedCounts = {};
      data.students.forEach(s => { branchCounts[s.branch] = (branchCounts[s.branch] || 0) + 1; });
      data.applications.forEach(a => {
        if (a.status.toLowerCase().includes('placed') || a.status.toLowerCase().includes('join')) {
          let b = data.students.find(s => s.name === a.name)?.branch || 'Unknown';
          placedCounts[b] = (placedCounts[b] || 0) + 1;
        }
      });
      Object.keys(branchCounts).forEach(b => {
        let p = placedCounts[b] || 0;
        let rate = Math.round((p / branchCounts[b]) * 100) + '%';
        csv.push([b, branchCounts[b], p, rate]);
      });
    }

    downloadCSV(type, csv);
  };

  if (loading || !data) {
    return <Layout><div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--accent-primary)' }}><CircleNotch size={40} className="ph-spin" /><p>Calculating reports...</p></div></Layout>;
  }

  // --- STAT CALCULATIONS ---
  const totStudents = data.students.length;
  const placed = data.applications.filter(a => a.status.toLowerCase().includes('placed') || a.status.toLowerCase().includes('join')).length;
  const placeRate = totStudents > 0 ? Math.round((placed / totStudents) * 100) : 0;
  
  const branchCounts = {}; data.students.forEach(s => { branchCounts[s.branch] = (branchCounts[s.branch] || 0) + 1; });
  const bestBranch = Object.keys(branchCounts).sort((a,b) => branchCounts[b] - branchCounts[a])[0] || '-';
  
  const comps = new Set(); data.applications.forEach(a => comps.add(a.company));
  const upcEvents = data.events.filter(e => new Date(e.date) >= new Date()).length;
  const rejApps = data.applications.filter(a => a.status.toLowerCase().includes('reject') || a.status.toLowerCase().includes('not attended')).length;
  const openIss = data.issues.filter(i => i.status !== 'Resolved').length;

  return (
    <Layout>
      <div className="page-container">
        <h1 style={{ fontSize: '1.8rem', marginBottom: '5px' }}>Reports</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Generate and export comprehensive reports</p>

        <div className="reports-grid">
          
          <div className="report-card">
            <div className="report-header"><div className="report-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}><GraduationCap weight="fill"/></div><div><div className="report-title">Placement Report</div><div className="report-desc">Placement summary with branch-wise breakdown</div></div></div>
            <div className="report-stats"><div className="rs-box"><div className="rs-num">{totStudents}</div><div className="rs-label">Total Students</div></div><div className="rs-box"><div className="rs-num">{placed}</div><div className="rs-label">Placed</div></div><div className="rs-box" style={{ gridColumn: 'span 2' }}><div className="rs-num">{placeRate}%</div><div className="rs-label">Placement Rate</div></div></div>
            <div className="report-actions"><button onClick={() => handleExport('placement')}><DownloadSimple weight="bold"/> CSV</button></div>
          </div>

          <div className="report-card">
            <div className="report-header"><div className="report-icon" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}><ChartBar weight="fill"/></div><div><div className="report-title">Branch Report</div><div className="report-desc">Branch-wise performance and statistics</div></div></div>
            <div className="report-stats" style={{ gridTemplateColumns: '1fr 1fr' }}><div className="rs-box"><div className="rs-num">{Object.keys(branchCounts).length}</div><div className="rs-label">Branches</div></div><div className="rs-box"><div className="rs-num" style={{ fontSize: '1.1rem' }}>{bestBranch}</div><div className="rs-label">Best Branch</div></div></div>
            <div className="report-actions" style={{ marginTop: 'auto' }}><button onClick={() => handleExport('branch')}><DownloadSimple weight="bold"/> CSV</button></div>
          </div>

          <div className="report-card">
            <div className="report-header"><div className="report-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}><Briefcase weight="fill"/></div><div><div className="report-title">Recruiter Report</div><div className="report-desc">Company-wise hiring statistics and data</div></div></div>
            <div className="report-stats"><div className="rs-box"><div className="rs-num">{comps.size}</div><div className="rs-label">Companies</div></div><div className="rs-box"><div className="rs-num">{data.vacancies.length}</div><div className="rs-label">Vacancies</div></div><div className="rs-box" style={{ gridColumn: 'span 2' }}><div className="rs-num">{data.applications.length}</div><div className="rs-label">Applications</div></div></div>
            <div className="report-actions"><button onClick={() => handleExport('recruiter')}><DownloadSimple weight="bold"/> CSV</button></div>
          </div>

          <div className="report-card">
            <div className="report-header"><div className="report-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}><CalendarCheck weight="fill"/></div><div><div className="report-title">Attendance Report</div><div className="report-desc">Event attendance and participation statistics</div></div></div>
            <div className="report-stats" style={{ gridTemplateColumns: '1fr 1fr' }}><div className="rs-box"><div className="rs-num">{data.events.length}</div><div className="rs-label">Events</div></div><div className="rs-box"><div className="rs-num">{upcEvents}</div><div className="rs-label">Upcoming</div></div></div>
            <div className="report-actions" style={{ marginTop: 'auto' }}><button onClick={() => handleExport('attendance')}><DownloadSimple weight="bold"/> CSV</button></div>
          </div>

          <div className="report-card">
            <div className="report-header"><div className="report-icon" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}><TrendUp weight="fill"/></div><div><div className="report-title">Application Report</div><div className="report-desc">Detailed application pipeline and tracking</div></div></div>
            <div className="report-stats"><div className="rs-box"><div className="rs-num">{data.applications.length}</div><div className="rs-label">Total Apps</div></div><div className="rs-box"><div className="rs-num">{data.applications.length - placed - rejApps}</div><div className="rs-label">In Process</div></div><div className="rs-box"><div className="rs-num">{placed}</div><div className="rs-label">Joined</div></div><div className="rs-box"><div className="rs-num">{rejApps}</div><div className="rs-label">Rejected</div></div></div>
            <div className="report-actions"><button onClick={() => handleExport('application')}><DownloadSimple weight="bold"/> CSV</button></div>
          </div>

          <div className="report-card">
            <div className="report-header"><div className="report-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}><WarningCircle weight="fill"/></div><div><div className="report-title">Issue Report</div><div className="report-desc">All tracked issues with resolution status</div></div></div>
            <div className="report-stats" style={{ gridTemplateColumns: '1fr 1fr' }}><div className="rs-box"><div className="rs-num">{data.issues.length}</div><div className="rs-label">Total Issues</div></div><div className="rs-box"><div className="rs-num">{openIss}</div><div className="rs-label">Open</div></div></div>
            <div className="report-actions" style={{ marginTop: 'auto' }}><button onClick={() => handleExport('issue')}><DownloadSimple weight="bold"/> CSV</button></div>
          </div>

        </div>
      </div>
    </Layout>
  );
}