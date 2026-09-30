import { useNavigate } from 'react-router-dom';
import { FileText, Brain, FolderOpen, UserCheck } from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';

export default function ExamsHub() {
  const navigate = useNavigate();
  
  const tpoDataStr = localStorage.getItem('tpoData');
  const tpoData = tpoDataStr ? JSON.parse(tpoDataStr) : null;
  
  const role = (tpoData?.role || '').toUpperCase();
  const isTechnicalLead = /TECH(?:NICAL)?\s+LEAD/.test(role) || /(^|[^A-Z0-9])TL([^A-Z0-9]|$)/.test(role);
  const isRth = /(^|[^A-Z0-9])RTH([^A-Z0-9]|$)/.test(role) || role.includes('REGIONAL TECHNICAL HEAD');

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        <div style={{ marginBottom: '40px', textAlign: 'center', marginTop: '20px' }}>
          <h1 style={{ fontSize: '2.5rem', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
            <FolderOpen color="var(--accent-primary)" weight="fill" /> Unified Exams Hub
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '1.1rem' }}>
            Select an assessment module to view student performance results.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: isTechnicalLead ? 'minmax(300px, 680px)' : 'repeat(auto-fit, minmax(280px, 1fr))', justifyContent: 'center', gap: '30px', padding: '0 20px' }}>
          
          <div 
            onClick={() => navigate(isTechnicalLead ? '/exams/technical?view=results' : '/exams/technical')}
            style={{ backgroundColor: '#3b82f6', borderRadius: '24px', padding: '40px 20px', cursor: 'pointer', textAlign: 'center', minHeight: '240px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 15px 35px rgba(0,0,0,0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)'; }}
          >
            <FileText size={56} color="#ffffff" weight="fill" style={{ marginBottom: '15px' }} />
            <h2 style={{ color: '#ffffff', fontSize: '2rem', margin: '0 0 10px 0', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>Technical Exams</h2>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.9rem', color: '#fff', fontWeight: 'bold' }}>{isTechnicalLead ? 'View branch technical exam results' : 'Domain specific tests'}</div>
          </div>

          {!isTechnicalLead && <div
            onClick={() => navigate('/exams/aptitude')}
            style={{ backgroundColor: '#f59e0b', borderRadius: '24px', padding: '40px 20px', cursor: 'pointer', textAlign: 'center', minHeight: '240px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 15px 35px rgba(0,0,0,0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)'; }}
          >
            <Brain size={56} color="#ffffff" weight="fill" style={{ marginBottom: '15px' }} />
            <h2 style={{ color: '#ffffff', fontSize: '2rem', margin: '0 0 10px 0', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>Aptitude Exams</h2>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.9rem', color: '#fff', fontWeight: 'bold' }}>Quant, Logical, Verbal</div>
          </div>}

          {!isTechnicalLead && !isRth && <div
            onClick={() => navigate('/exams/talentino')}
            style={{ backgroundColor: '#8b5cf6', borderRadius: '24px', padding: '40px 20px', cursor: 'pointer', textAlign: 'center', minHeight: '240px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 15px 35px rgba(0,0,0,0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)'; }}
          >
            <UserCheck size={56} color="#ffffff" weight="fill" style={{ marginBottom: '15px' }} />
            <h2 style={{ color: '#ffffff', fontSize: '2rem', margin: '0 0 10px 0' }}>Talentino Assessments</h2>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.9rem', color: '#fff', fontWeight: 'bold' }}>Career readiness assessments</div>
          </div>}

        </div>
      </div>
    </Layout>
  );
}
