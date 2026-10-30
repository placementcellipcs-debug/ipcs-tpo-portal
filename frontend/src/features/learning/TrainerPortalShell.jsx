import { useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Buildings, Brain, CalendarCheck, CaretLeft, CaretRight, ChalkboardTeacher, ClipboardText, GraduationCap, Notebook, SignOut, SquaresFour, UsersFour } from '@phosphor-icons/react';
import { getTrainerAssignments } from './academicScope';
import './TrainerPortalShell.css';

const tabs = [
  { name: 'Overview', path: '/academic', icon: SquaresFour, group: 'YOUR TRAINING STUDIO' },
  { name: 'Branches', path: '/academic/branches', icon: Buildings },
  { name: 'Leave approvals', path: '/academic/leaves', icon: ClipboardText },
  { name: 'Student training', path: '/academic/training', icon: GraduationCap },
  { name: 'Batches', path: '/academic/batches', icon: UsersFour },
  { name: 'Daily sessions', path: '/academic/sessions', icon: ChalkboardTeacher },
  { name: 'Attendance', path: '/academic/attendance', icon: CalendarCheck },
  { name: 'Syllabus & topics', path: '/academic/topics', icon: BookOpen },
  { name: 'Digital diary', path: '/academic/diary', icon: Notebook },
  { name: 'Mind Gym', path: '/academic/brain-gym', icon: Brain },
];

const initials = value => String(value || 'Trainer').trim().split(/\s+/).map(word => word[0]).join('').slice(0, 2).toUpperCase();
const photoUrl = value => {
  const url = String(value || '').trim();
  if (!url || /^n\/?a$/i.test(url)) return '';
  const match = url.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
  return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
};

export default function TrainerPortalShell({ user, children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const sliderRef = useRef(null);
  const { branches, courses } = useMemo(() => getTrainerAssignments(user), [user]);
  const activeTab = tabs.find(tab => location.pathname === tab.path || (tab.path !== '/academic' && location.pathname.startsWith(`${tab.path}/`)))
    || (location.pathname.startsWith('/academic') ? tabs[0] : null);
  const photo = photoUrl(user?.photo);
  const localDate = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' }).format(new Date());

  const logout = () => {
    localStorage.removeItem('tpoData');
    navigate('/', { replace: true });
  };

  return (
    <div className="trainer-portal-shell">
      <aside className="trainer-portal-sidebar">
        <div className="trainer-brand-lockup"><span className="trainer-brand-mark"><GraduationCap size={23} weight="duotone" /></span><span><b>IPCS</b><small>LEARNING STUDIO</small></span></div>
        <div className="trainer-side-kicker">TRAINER PORTAL</div>
        <section className="trainer-profile-card"><div className="trainer-profile-avatar">{photo ? <img src={photo} alt="" /> : initials(user?.name)}</div><div className="trainer-profile-copy"><span>WELCOME BACK</span><b>{user?.name || 'Trainer'}</b><small>{user?.role || 'Academic trainer'}</small></div><i title="Signed in" /></section>

        <section className="trainer-assignment-card"><div className="trainer-sidebar-section-title"><span>YOUR ASSIGNMENT</span><span className="trainer-scope-live"><i /> LIVE</span></div><div className="trainer-assignment-group"><span>COURSES</span><div>{courses.length ? courses.map(course => <i key={course}><BookOpen size={13} />{course}</i>) : <small>Awaiting course assignment</small>}</div></div><div className="trainer-assignment-group branch-assignment"><span>BRANCHES</span><div>{branches.length ? branches.map(branch => <i key={branch}><Buildings size={13} />{branch}</i>) : <small>Awaiting branch assignment</small>}</div></div></section>

        <div className="trainer-sidebar-note"><span className="trainer-note-icon"><SparkleMark /></span><div><b>Every learner has a next step.</b><small>Your workspace is ready for today’s teaching.</small></div></div>
        <div className="trainer-sidebar-spacer" />
        <div className="trainer-sidebar-date"><span>TODAY</span><b>{localDate}</b></div>
        <button type="button" className="trainer-logout-button" onClick={logout}><SignOut size={17} /> Sign out <ArrowRight size={15} /></button>
        <div className="trainer-sidebar-footnote">IPCS · SECURE LEARNING WORKSPACE</div>
      </aside>

      <div className="trainer-portal-main">
        <header className="trainer-portal-topbar"><div className="trainer-breadcrumb"><span className="trainer-topbar-mark"><GraduationCap size={17} /></span><span>IPCS LEARNING</span><i>/</i><b>{activeTab?.name || 'Workspace'}</b></div><div className="trainer-topbar-user"><span><i /> ONLINE</span><b>{initials(user?.name)}</b></div></header>

        <div className="trainer-tools-heading"><div><span>YOUR TEACHING DESK</span><h2>One space for every learner.</h2></div><div className="trainer-slider-controls"><button type="button" aria-label="Scroll tools left" onClick={() => sliderRef.current?.scrollBy({ left: -360, behavior: 'smooth' })}><CaretLeft size={17} /></button><button type="button" aria-label="Scroll tools right" onClick={() => sliderRef.current?.scrollBy({ left: 360, behavior: 'smooth' })}><CaretRight size={17} /></button></div></div>
        <nav className="trainer-tools-slider" ref={sliderRef} aria-label="Trainer portal tools">
          {tabs.map((tab, index) => {
            const Icon = tab.icon;
            const active = location.pathname === tab.path || (tab.path === '/academic' && (location.pathname === '/academic' || location.pathname === '/academic/')) || (tab.path !== '/academic' && location.pathname.startsWith(`${tab.path}/`));
            return <div className="trainer-tool-item" key={tab.path}>
              {tab.group && <span className="trainer-tool-group-label">{tab.group}</span>}
              <button type="button" className={`trainer-tool-tab trainer-tool-tone-${index % 8}${active ? ' active' : ''}`} aria-current={active ? 'page' : undefined} onClick={() => navigate(tab.path)}><span className="trainer-tool-icon"><Icon size={18} weight="duotone" /></span><span>{tab.name}</span><small>{String(index + 1).padStart(2, '0')}</small></button>
            </div>;
          })}
        </nav>

        <div className="trainer-portal-content">{children}</div>
      </div>
    </div>
  );
}

function SparkleMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.7 14.1 9.9 21.3 12l-7.2 2.1L12 21.3l-2.1-7.2L2.7 12l7.2-2.1L12 2.7Z" fill="currentColor" /></svg>;
}
