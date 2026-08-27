import { useNavigate } from 'react-router-dom';
import { FileText, Brain, PencilSimple, FolderOpen } from '@phosphor-icons/react';
import Layout from './Layout';

export default function ExamsHub() {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        <div style={{ marginBottom: '40px', textAlign: 'center', marginTop: '20px' }}>
          <h1 style={{ fontSize: '2.5rem', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px' }}>
            <FolderOpen color="var(--accent-primary)" weight="fill" /> Unified Exams Hub
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '1.1rem' }}>
            Select an assessment module to manage question banks and track student performance.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '30px', padding: '0 20px' }}>
          
          {/* Tile 1: Technical Exams */}
          <div 
            onClick={() => navigate('/exams/technical')}
            style={{ backgroundColor: '#3b82f6', borderRadius: '24px', padding: '40px 20px', cursor: 'pointer', textAlign: 'center', minHeight: '240px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 15px 35px rgba(0,0,0,0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)'; }}
          >
            <FileText size={56} color="#ffffff" weight="fill" style={{ marginBottom: '15px' }} />
            <h2 style={{ color: '#ffffff', fontSize: '2rem', margin: '0 0 10px 0', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>Technical Exams</h2>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.9rem', color: '#fff', fontWeight: 'bold' }}>Domain specific tests</div>
          </div>

          <div style={{ marginBottom: '20px' }}>
          <button 
            onClick={() => window.location.href = '/exams'} 
            style={{ background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--text-muted)', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', transition: '0.2s' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--card-border)'; }}
          >
            <CaretLeft weight="bold" size={16} /> Back to Exams Hub
          </button>
        </div>

          {/* Tile 2: Aptitude Exams */}
          <div 
            onClick={() => navigate('/exams/aptitude')}
            style={{ backgroundColor: '#f59e0b', borderRadius: '24px', padding: '40px 20px', cursor: 'pointer', textAlign: 'center', minHeight: '240px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 15px 35px rgba(0,0,0,0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)'; }}
          >
            <Brain size={56} color="#ffffff" weight="fill" style={{ marginBottom: '15px' }} />
            <h2 style={{ color: '#ffffff', fontSize: '2rem', margin: '0 0 10px 0', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>Aptitude Exams</h2>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.9rem', color: '#fff', fontWeight: 'bold' }}>Quant, Logical, Verbal</div>
          </div>

          <div style={{ marginBottom: '20px' }}>
          <button 
            onClick={() => window.location.href = '/exams'} 
            style={{ background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--text-muted)', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', transition: '0.2s' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--card-border)'; }}
          >
            <CaretLeft weight="bold" size={16} /> Back to Exams Hub
          </button>
        </div>

          {/* Tile 3: Talentino Exams */}
          <div 
            onClick={() => navigate('/exams/talentino')}
            style={{ backgroundColor: '#a855f7', borderRadius: '24px', padding: '40px 20px', cursor: 'pointer', textAlign: 'center', minHeight: '240px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-5px)'; e.currentTarget.style.boxShadow = '0 15px 35px rgba(0,0,0,0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.2)'; }}
          >
            <PencilSimple size={56} color="#ffffff" weight="fill" style={{ marginBottom: '15px' }} />
            <h2 style={{ color: '#ffffff', fontSize: '2rem', margin: '0 0 10px 0', textShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>Talentino Exams</h2>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.9rem', color: '#fff', fontWeight: 'bold' }}>Soft skills & development</div>
          </div>

          <div style={{ marginBottom: '20px' }}>
          <button 
            onClick={() => window.location.href = '/exams'} 
            style={{ background: 'transparent', border: '1px solid var(--card-border)', color: 'var(--text-muted)', padding: '8px 15px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 'bold', transition: '0.2s' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'var(--text-muted)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--card-border)'; }}
          >
            <CaretLeft weight="bold" size={16} /> Back to Exams Hub
          </button>
        </div>

        </div>
      </div>
    </Layout>
  );
}