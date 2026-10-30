import { ArrowUpRight, Sparkle } from '@phosphor-icons/react';
import './AcademicTopNav.css';

export default function AcademicTopNav({ title, subtitle, statLabel, statValue }) {
  return (
    <header className="academic-portal-header">
      <div className="academic-page-heading-copy">
        <span className="academic-page-eyebrow"><Sparkle size={13} weight="fill" /> TRAINER WORKSPACE <i /> CURRENT VIEW</span>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {statLabel && <div className="academic-page-stat"><span>{statLabel}</span><b>{statValue}</b><small>WITHIN YOUR ASSIGNMENT</small><ArrowUpRight size={16} /></div>}
    </header>
  );
}
