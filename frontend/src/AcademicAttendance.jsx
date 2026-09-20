import React from 'react';
import { CalendarCheck, CheckCircle, XCircle, Clock } from '@phosphor-icons/react';
import Layout from './Layout';
import AcademicTopNav from './AcademicTopNav';

export default function AcademicAttendance() {
  const records = [
    { id: 'ATT-1021', student: 'Anjali Sharma', roll: 'IPCS00124', session: 'SES-093', date: '21 Sep 2026', status: 'Present' },
    { id: 'ATT-1022', student: 'Rahul Kumar', roll: 'IPCS00125', session: 'SES-092', date: '21 Sep 2026', status: 'Absent' },
    { id: 'ATT-1023', student: 'Priya M', roll: 'IPCS00126', session: 'SES-092', date: '21 Sep 2026', status: 'Present' }
  ];

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0, maxWidth: '1600px', margin: '0 auto' }}>
        <AcademicTopNav title="Attendance Register" subtitle="View and verify student presence for all sessions." />

        <div className="table-container" style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--card-border)', overflow: 'hidden' }}>
          <table className="modern-table">
            <thead><tr><th>Student</th><th>Session Ref</th><th>Date</th><th style={{ textAlign: 'center' }}>Attendance Status</th><th style={{ textAlign: 'center' }}>Verification</th></tr></thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={i}>
                  <td>
                    <div style={{ color: '#fff', fontWeight: 'bold' }}>{r.student}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{r.roll}</div>
                  </td>
                  <td><span style={{ color: '#3b82f6', fontWeight: 'bold', background: 'rgba(59,130,246,0.1)', padding: '4px 8px', borderRadius: '6px' }}>{r.session}</span></td>
                  <td style={{ color: '#e2e8f0', fontSize: '0.85rem' }}>{r.date}</td>
                  <td style={{ textAlign: 'center' }}>
                    {r.status === 'Present' ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#10b981', fontWeight: 'bold', fontSize: '0.85rem' }}><CheckCircle size={18} weight="fill"/> Present</span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: '#ef4444', fontWeight: 'bold', fontSize: '0.85rem' }}><XCircle size={18} weight="fill"/> Absent</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}><span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', background: 'rgba(255,255,255,0.05)', color: '#cbd5e1' }}>Verified by Trainer</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}