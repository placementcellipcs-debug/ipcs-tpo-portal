import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle, FileText, Handshake, ShieldCheck } from '@phosphor-icons/react';
import ipcsLogo from './ipcs-logo.png';
import './RecruiterMOU.css';

const steps = [
  { title: 'Start the partnership', copy: 'IPCS and the recruiting organization align on hiring needs, candidate profiles, and the engagement.' },
  { title: 'Review the MOU', copy: 'The authorized company representative receives a unique agreement link to review the terms and provide company details.' },
  { title: 'Complete onboarding', copy: 'Once the agreement is signed, the IPCS team coordinates the recruiter and placement workflow.' },
];

export default function RecruiterMOU() {
  return (
    <main className="recruiter-page">
      <header className="recruiter-header">
        <Link to="/" className="recruiter-brand" aria-label="IPCS Global home"><img src={ipcsLogo} alt="IPCS Global" /></Link>
        <nav className="recruiter-nav" aria-label="Recruiter navigation">
          <Link to="/">Home</Link>
          <span className="recruiter-active-tab"><FileText size={17} /> MOU &amp; Partnership</span>
          <Link className="recruiter-login" to="/">Team login <ArrowRight size={16} /></Link>
        </nav>
      </header>

      <section className="recruiter-hero">
        <div className="recruiter-copy">
          <Link className="recruiter-back" to="/"><ArrowLeft size={16} /> Back to IPCS Global</Link>
          <div className="recruiter-eyebrow"><Handshake size={17} /> RECRUITER PARTNERSHIPS</div>
          <h1>Build a stronger<br /><span>talent connection.</span></h1>
          <p>IPCS Global works with recruiting organizations to connect trained, career-ready candidates with meaningful opportunities. Use this MOU space to understand the partnership and signing process.</p>
        </div>
        <div className="mou-card">
          <div className="mou-card-top"><span className="mou-icon"><FileText size={23} weight="duotone" /></span><span className="mou-status"><i /> Partnership overview</span></div>
          <h2>Memorandum of Understanding</h2>
          <p>A clear framework for coordinating candidate referrals, employer communication, and placement activities.</p>
          <div className="mou-divider" />
          <div className="mou-secure-line"><ShieldCheck size={18} /> Agreement signing is handled through a private link issued by IPCS.</div>
          <div className="mou-card-note">Already have an MOU link? Open the unique link provided to your organization to review and sign.</div>
        </div>
      </section>

      <section className="mou-process" aria-labelledby="mou-process-title">
        <div className="mou-section-heading"><span>HOW IT WORKS</span><h2 id="mou-process-title">A simple path to partnership</h2></div>
        <div className="mou-steps">
          {steps.map((step, index) => (
            <article className="mou-step" key={step.title}>
              <div className="mou-step-number"><span>{String(index + 1).padStart(2, '0')}</span><CheckCircle size={16} /></div>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="recruiter-footer"><span>© IPCS Global</span><span>Recruiter MOU &amp; Partnership</span></footer>
    </main>
  );
}
