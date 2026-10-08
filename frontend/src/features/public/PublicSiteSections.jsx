import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { ArrowRight, ArrowUpRight, BookOpenText, Briefcase, Buildings, CheckCircle, Compass, EnvelopeSimple, GlobeHemisphereWest, GraduationCap, Handshake, Lightbulb, LinkedinLogo, Megaphone, Phone, PlayCircle, Star, Target, UsersThree, VideoCamera, WhatsappLogo, X } from '@phosphor-icons/react';
import { API_BASE } from '../../services/apiConfig';
import { formatPortalDate } from '../../utils/dateFormat';
import './PublicSiteSections.css';
import giftyPhoto from '../../assets/Team IPCS/Ms. Gifty KP.png';

const placementTeamLead = {
  name: 'Ms. Gifty KP',
  role: 'Zonal Manager - Placements',
  image: giftyPhoto,
  bio: 'Ms. Gifty KP serves as the Zonal Manager of Placements at IPCS Global, overseeing end-to-end placement operations across 23 branches in the South Zone, including Kerala, Karnataka, and Tamil Nadu. Backed by 10 years of experience in the EdTech and IT industries, she is a dynamic training leader dedicated to fostering talent and propelling teams toward excellence. Holding a BCA in Computer Science, Gifty excels in organizing on-campus and virtual placement drives, building strategic hiring pipelines, and executing MOUs with industry partners. She is also highly adept at designing skill enhancement sessions to boost student employability, making her instrumental in bridging the gap between student capabilities and corporate requirements.'
};

const milestones = [
  { value: 30, suffix: '+', label: 'Branches across India' },
  { value: 3, suffix: '', label: 'International locations' },
  { value: 400, suffix: '+', label: 'Automation clients worldwide' },
  { value: 100, suffix: '+', label: 'IPCS Technologies clients' }
];

const aboutBrands = [
  {
    name: 'IPCS Automation',
    focus: 'INDUSTRIAL SOLUTIONS',
    copy: 'End-to-end automation solutions designed around each organization’s needs. From PLC and SCADA integration to IoT-enabled systems, teams focus on efficiency, accuracy, and reliable operations.',
    stat: '400+',
    statLabel: 'clients worldwide',
    tags: ['PLC & SCADA', 'Industrial automation', 'IoT systems']
  },
  {
    name: 'IPCS Technologies',
    focus: 'DIGITAL SERVICES',
    copy: 'Web and mobile development, AI-integrated digital marketing, custom software, and branding—combining technology and creativity to turn ideas into scalable digital experiences.',
    stat: '100+',
    statLabel: 'satisfied clients',
    tags: ['Web & mobile', 'Custom software', 'AI digital marketing', 'Branding']
  },
  {
    name: 'IPCS Global',
    focus: 'TRAINING & CAREER PATHWAYS',
    copy: 'Industry-aligned learning and digital solutions that prepare people for real work, with programs spanning automation, Embedded and IoT, BMS, Python and Data Science, AI, and software testing.',
    stat: '30+',
    statLabel: 'branches across India',
    tags: ['Practical training', 'Industry partnerships', 'Career development']
  }
];

const companyAwards = [
  { title: 'ISO 9001:2015', detail: 'Certified quality management' },
  { title: 'Certificate of Excellence', detail: 'In Education' },
  { title: 'Best Training Institute', detail: 'Award · 2014' },
  { title: 'TÜV SÜD Corporation Partner', detail: 'Recognition · 2020, 2022 & 2025' }
];

const placementTeamProfiles = [
  { name: 'Mr. Amarnath SR', aliases: ['Amarnath SR', 'Amarnath S R'], role: 'Corporate Relation Officer', bio: 'Mr. Amarnath SR is a dedicated Corporate Relation Officer at IPCS Global with a strong foundation in technology. He holds a Master’s degree in Information Technology and a Bachelor of Science in Computer Technology. As a multifaceted Placement and Training professional, he brings extensive experience in student coordination, career development, and institutional engagement. Amarnath combines business operations knowledge with technology expertise, excelling in client handling, digital marketing, Python development, and cybersecurity. Passionate about automation and creating effective digital solutions, his diverse skill set makes him highly effective in guiding students toward successful technical careers.' },
  { name: 'Ms. Bincy Bindhuraj', aliases: ['Bincy Bindhuraj'], role: 'Senior Corporate Relationship Officer', bio: 'Ms. Bincy Bindhuraj is an accomplished Senior Corporate Relationship Officer at IPCS Global. She is currently pursuing a Master of Business Administration in Human Resources Management and Services. With a robust background in talent acquisition and HR coordination, Bincy excels in developing strategic partnerships with corporate clients and overseeing the end-to-end recruitment lifecycle. She is highly skilled in career counseling, utilizing life coaching techniques to support candidates through resume optimization and interview preparation. Her dedication to streamlining recruitment processes, mentoring junior team members, and aligning customized recruitment solutions with business objectives drives both client engagement and student placement success.' },
  { name: 'Ms. Gifty KP', aliases: ['Gifty KP'], role: placementTeamLead.role, bio: placementTeamLead.bio, image: giftyPhoto },
  { name: 'Mr. Pranav V S', aliases: ['Pranav V S', 'Pranav V.S.'], role: 'Corporate Relations Officer', bio: 'Mr. Pranav V S is a driven Corporate Relations Officer at IPCS Global, specializing in building industry partnerships and managing placement operations. He holds a Bachelor of Computer Application degree with a focus on Cloud Computing and Cyber Security. Passionate about connecting candidates with real career opportunities, Pranav has successfully contributed to over 500 placements. He excels in coordinating campus hiring activities, conducting candidate screening, and providing comprehensive job readiness support, including resume building and interview preparation. His dedication ensures that students are well-prepared to get hired while helping companies find the right talent efficiently.' },
  { name: 'Ms. Thana Anjana', aliases: ['Thana Anjana'], role: 'Placement Officer', bio: 'Ms. Thana Anjana is a proactive Placement Officer at IPCS Global. Holding a Master of Business Administration in HR and Finance, she specializes in Placement and Corporate Coordination. Thana consistently connects skilled candidates with the right job opportunities across technical domains like IT, Digital Marketing, Data Science, and AI. She is highly adept at identifying companies with active job openings, building comprehensive HR contact databases, and reaching out to organizations for placement tie-ups. Her strong networking and communication skills ensure a seamless hiring process, coordinating interviews and guiding candidates successfully through their hiring journeys.' },
  { name: 'Ms. Fathima Rinsa', aliases: ['Fathima Rinsa', 'Fathima Rinsa P'], role: 'Senior Corporate Relations Officer', bio: 'Ms. Fathima Rinsa is a highly experienced Senior Corporate Relations Officer at IPCS Global, specializing in Human Resource Management and Corporate Recruitment. With a robust background in developing HR frameworks and leading end-to-end recruitment operations, she excels at bridging the gap between academic institutions and corporate organizations. Based in Kochi, Fathima actively builds strategic partnerships, collaborates with industry leaders, and organizes placement drives, workshops, and corporate training programs to enhance candidate employability. Holding a Bachelor of Arts in Economics, she leverages her extensive expertise in full-lifecycle employee management and corporate tie-ups to align skilled talent with business success, driving both organizational growth and meaningful career development for candidates.' },
  { name: 'Mr. Visakh S', aliases: ['Visakh S'], role: 'Senior Corporate Relation Officer', bio: 'Mr. Visakh S is a highly skilled Senior Corporate Relation Officer at IPCS Global, dedicated to connecting the dots between talent, business, and success. Bringing valuable experience from his previous roles as a Talent Acquisition Specialist and a Documentation Specialist, he possesses deep expertise in global talent acquisition, technical recruiting, and people management. Visakh leverages his strong professional background to bridge the gap between skilled candidates and corporate hiring needs, facilitating successful placements and fostering long-term industry connections.' },
  { name: 'Ms. Yashi Gupta', aliases: ['Yashi Gupta'], role: 'Placement Officer', bio: 'Ms. Yashi Gupta is a dedicated professional serving as a Placement Officer at IPCS Global. Based in Mumbai, Maharashtra, she operates within the organization’s placement division to connect job seekers with industry opportunities. Her role is essential in supporting the broader corporate relations team and contributing to the successful career development of candidates.' }
];

const placementHighlights = [
  { icon: Megaphone, title: 'Posters & announcements', copy: 'Placement notices, career-drive announcements, and highlights prepared for students.' },
  { icon: PlayCircle, title: 'Videos & student stories', copy: 'Video highlights that bring placement activities, learning, and student milestones to life.' },
  { icon: UsersThree, title: 'Placement activities', copy: 'Mock interviews, group discussions, communication workshops, and interactive sessions.' },
  { icon: Briefcase, title: 'Placement drives', copy: 'Company visits and recruitment drives that connect student preparation with employer needs.' },
  { icon: GraduationCap, title: 'Talentino', copy: 'A recurring career-development program that helps students communicate their skills with confidence.' }
];

const objectives = [
  'Develop students’ technical skills and presentation so they are ready for industry recruitment.',
  'Encourage technical learning, soft skills, and thoughtful career planning.',
  'Connect students with direct company interviews, internships, and placement drives.'
];

const careerPrograms = [
  'Personality development',
  'Communication skills',
  'Group discussions',
  'Mock interview sessions',
  'Industry and internship orientation',
  'Interactive communication activities'
];

const corporateTrainingFeatures = [
  { icon: Target, title: 'Built around your goals', copy: 'Customized modules shaped around your operational priorities, whether you are automating a process, integrating IoT, or upgrading PLC and SCADA skills.' },
  { icon: Lightbulb, title: 'Learn by doing', copy: 'Practical sessions on live industrial setups give participants real exposure to the tools and systems they use at work.' },
  { icon: UsersThree, title: 'Trainers with field experience', copy: 'Industry professionals connect technical concepts to real projects, with practical guidance drawn from hands-on work.' },
  { icon: GlobeHemisphereWest, title: 'Onsite or remote', copy: 'Choose a delivery format that fits your team, locations, and operations while keeping disruption to a minimum.' },
  { icon: Briefcase, title: 'Progress that supports performance', copy: 'Programs build technical capability, productivity, leadership, and problem-solving for individuals and organizations.' },
  { icon: CheckCircle, title: 'Measured learning', copy: 'Practical tasks and progress reviews show what participants can apply, with internationally recognized certification on successful completion.' }
];

const corporateTrainingTopics = [
  'Industrial Automation', 'PLC & SCADA', 'Robotics', 'Building Management Systems',
  'Embedded Systems', 'Internet of Things', 'Digital Marketing with AI', 'Emerging technologies'
];

const corporateTrainingAudiences = [
  { title: 'Engineers & technicians', copy: 'Build practical skills, work confidently with modern systems, and keep technical knowledge current.' },
  { title: 'Mid-level professionals', copy: 'Prepare for specialist and managerial responsibilities with focused, job-relevant learning.' },
  { title: 'Organizations', copy: 'Upskill teams, improve operational capability, and adopt new technologies with a reliable training partner.' },
  { title: 'HR & L&D teams', copy: 'Plan scalable learning that supports workforce development and organizational goals.' }
];

const corporateTrainingVideos = [
  { key: 'military-review', title: 'IPCS × Military BMS Training · Combined review, Bangalore', id: 'c196c580-025f-4568-92cd-87ff9217aaf4' },
  { key: 'military-event', title: 'IPCS × Military BMS Training · Event, Bangalore', id: '1d74f572-1d6c-49f7-b216-05798763aee7' },
  { key: 'bhutan-police', title: 'Bhutan Police BMS Training Programme · Kochi', id: '4ac39f15-4d0f-4ba3-b752-13f26a83d995' },
  { key: 'cial-visit', title: 'CIAL Engineers Visit', id: '1e897965-a95f-4616-b000-1b24d52e1f8c' },
  { key: 'cial-certification-part-2', title: 'CIAL Engineers Training & Certification · Part 2', id: 'a1473c98-29de-409a-84dd-6569ba0aa883' },
  { key: 'cial-certification-part-1', title: 'CIAL Engineers Training & Certification · Part 1', id: '13699e3e-1df7-42ec-9142-59eb30e0257a' }
];

const bhutanPolicePhotoNames = [
  'STUDENT 11.jpg', 'STUDENT 12.jpg', 'STUDENT 9.jpg', 'STUDENT 6.jpg', 'STUDENT 10.jpg',
  'STUDENT 5.jpg', 'STUDENT 7.jpg', 'STUDENT 8.jpg', 'STUDENT 3 A.jpg', 'STUDENT 3.jpg',
  'STUDENT 4 A.jpg', 'STUDENT 4.jpg', 'STUDENT 2.jpg', 'STUDENT 1.jpg', 'STUDENT 1 A.jpg'
];
const militaryPhotoNames = [
  'IMG_20260716_151908431.jpg', 'IMG_20260716_151842350.jpg', 'IMG_20260716_151852323.jpg', 'IMG_20260716_151827854.jpg', 'IMG_20260716_151808839.jpg',
  'IMG_20260716_151751963.jpg', 'IMG_20260716_151642537.jpg', 'IMG_20260716_151717384.jpg', 'IMG_20260716_151709947.jpg', 'IMG_20260716_151733057.jpg',
  'IMG_20260716_151537637.jpg', 'IMG_20260716_151602810.jpg', 'IMG_20260716_151627369.jpg', 'IMG_20260716_151616144.jpg', 'IMG_20260716_151507041.jpg',
  'IMG_20260716_151545728.jpg', 'IMG_20260716_151529640.jpg', 'IMG_20260716_151518205.jpg', 'IMG_20260716_151350491.jpg', 'IMG_20260716_151401294.jpg',
  'IMG_20260716_151454539.jpg', 'IMG_20260716_151214361.jpg', 'IMG_20260716_151231817.jpg', 'IMG_20260716_151255072.jpg', 'IMG_20260716_151309988.jpg',
  'IMG_20260716_151341262.jpg', 'IMG_20260716_151331681.jpg', 'IMG_20260716_151159968.jpg', 'IMG_20260716_151144688.jpg', 'IMG_20260716_151105299.jpg',
  'IMG_20260716_151053462.jpg', 'IMG_20260716_151132825.jpg', 'IMG_20260716_151032523.jpg', 'IMG_20260716_101001478.jpg', 'IMG_20260716_151040456.jpg',
  'IMG_20260716_100705450.jpg'
];
const corporateTrainingPhotos = [
  ...bhutanPolicePhotoNames.map((name, index) => ({ name, index, group: 'Bhutan Police', label: 'BHUTAN POLICE · BMS TRAINING', folder: 'bhutan-police' })),
  ...militaryPhotoNames.map((name, index) => ({ name, index, group: 'Military', label: 'MILITARY · BMS TRAINING', folder: 'military' }))
].map(photo => ({
  ...photo,
  src: `/event-gallery/${photo.folder}/${encodeURIComponent(photo.name.replace(/\.[^.]+$/i, '.webp'))}`
}));
const corporateTrainingPhotoRows = [
  corporateTrainingPhotos.filter((_, index) => index % 2 === 0),
  corporateTrainingPhotos.filter((_, index) => index % 2 === 1)
];
const magazineFolderUrl = 'https://drive.google.com/drive/folders/151HVXrNa_lBwY9sLzA_j3pca4Otdw-5R?usp=sharing';

const companyRoadmap = [
  { date: '2008', phase: 'The first step', title: 'A first office in Calicut, Kerala', copy: 'IPCS began its journey with the inauguration of its first office in Calicut, building a foundation in technology and industrial solutions.' },
  { date: '2009', phase: 'Learning by doing', title: 'Training and project operations in Cochin', copy: 'IPCS launched its first training institute and project operations in Cochin, bringing practical, industry-focused learning closer to aspiring professionals.' },
  { date: '2016', phase: 'International growth', title: 'A new branch in the UAE', copy: 'The opening of a UAE branch extended IPCS services and training beyond India.' },
  { date: '2017', phase: 'A wider learning network', title: 'More institutes across South India', copy: 'IPCS expanded by launching additional institutes across regions of South India.' },
  { date: '2025', phase: 'A global footprint', title: '30+ branches and three international locations', copy: 'IPCS reports operating more than 30 branches across India and three international locations.' },
  { date: '2026', phase: 'The next milestone · goal', title: 'Building toward 50+ branches', copy: 'The stated expansion goal for 2026 is to reach more than 50 branches across India and add two international locations.' }
];

const blogs = [
  'Digital Marketing Strategies for E-commerce',
  'Content Writing in Digital Marketing',
  'How IPCS Global Became Popular in Digital Marketing Institutes, Trivandrum',
  'Boost Your Job Search: LinkedIn Profile Optimization for Recruiters',
  'Automating the Warehouse to a New Level – IPCS Global',
  'Operation Of Call Centre Today – Call Center Automation',
  'Get Trained in the World’s Fast-Growing Technology: Industrial Automation with IPCS Salem',
  'Steps to Rank Your YouTube Videos',
  'Importance of SEO in E-commerce Stores',
  'Get Trained in the Latest Digital Trends with IPCS Salem',
  'How to Become a Perfect Digital Marketer?'
];

const magazineEditionTitle = name => String(name || '')
  .replace(/\.pdf$/i, '')
  .replace(/^Izair\s+E(?:\s*-\s*|\s*)Magazine\s*/i, '')
  .replace(/_/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const logoSource = value => {
  if (!value || typeof value !== 'string') return '';
  const match = value.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
  return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : value;
};
const videoThumbnail = item => item.thumbnailLink || `https://drive.google.com/thumbnail?id=${encodeURIComponent(item.id)}&sz=w640`;
const normalizeTeamName = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/^(mrs|miss|mr|ms|dr)/, '');
const teamPhoneHref = value => {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return `tel:${String(value).trim().startsWith('+') ? '+' : digits.length === 10 ? '+91' : ''}${digits}`;
};
const teamWhatsappHref = value => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10) digits = `91${digits}`;
  return digits ? `https://wa.me/${digits}` : '';
};
const publicGet = async (url) => {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await axios.get(url);
    } catch (error) {
      lastError = error;
      if (attempt === 2 || (error.response && error.response.status < 500)) throw error;
      await new Promise(resolve => window.setTimeout(resolve, 800 * (attempt + 1)));
    }
  }
  throw lastError;
};

function CorporateTrainingInquiryModal({ onClose }) {
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', location: '', trainingArea: '', teamSize: '', message: '', website: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = event => { if (event.key === 'Escape' && !submitting) onClose(); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, submitting]);

  const updateField = event => setForm(current => ({ ...current, [event.target.name]: event.target.value }));
  const submitInquiry = async event => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await axios.post(`${API_BASE}/api/public/corporate-training-inquiries`, form);
      if (!response.data?.success) throw new Error(response.data?.message || 'We could not send your request. Please try again.');
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'We could not send your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(<div className="public-corporate-inquiry-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !submitting) onClose(); }}>
    <section className="public-corporate-inquiry-dialog" role="dialog" aria-modal="true" aria-labelledby="corporate-inquiry-title">
      <header className="public-corporate-inquiry-header"><div><span>IPCS GLOBAL · CORPORATE TRAINING</span><h2 id="corporate-inquiry-title">Let’s plan your team’s training.</h2><p>Tell us a little about your organization and what your team wants to learn.</p></div><button type="button" onClick={onClose} disabled={submitting} aria-label="Close inquiry form"><X size={21} /></button></header>
      {submitted ? <div className="public-corporate-inquiry-success" role="status"><span><CheckCircle size={28} weight="fill" /></span><h3>Thank you for reaching out.</h3><p>Your corporate training inquiry has been received by the IPCS Global team. We’ll follow up using the contact details you provided.</p><button type="button" className="public-corporate-primary" onClick={onClose}>Done</button></div> : <form className="public-corporate-inquiry-form" onSubmit={submitInquiry}>
        <div className="public-corporate-inquiry-grid">
          <label>Full name *<input name="name" value={form.name} onChange={updateField} autoComplete="name" maxLength={120} required /></label>
          <label>Company / organization *<input name="company" value={form.company} onChange={updateField} autoComplete="organization" maxLength={160} required /></label>
          <label>Work email *<input name="email" type="email" value={form.email} onChange={updateField} autoComplete="email" maxLength={254} required /></label>
          <label>Phone / WhatsApp<input name="phone" type="tel" value={form.phone} onChange={updateField} autoComplete="tel" maxLength={40} /></label>
          <label>Location<input name="location" value={form.location} onChange={updateField} autoComplete="address-level2" maxLength={120} /></label>
          <label>Training area *<select name="trainingArea" value={form.trainingArea} onChange={updateField} required><option value="">Choose a topic</option>{['Industrial Automation', 'PLC & SCADA', 'Robotics', 'Building Management Systems', 'Embedded Systems & IoT', 'Digital Marketing with AI', 'Customized programme', 'Other'].map(topic => <option key={topic} value={topic}>{topic}</option>)}</select></label>
          <label>Approximate team size<input name="teamSize" value={form.teamSize} onChange={updateField} maxLength={40} placeholder="e.g. 15 participants" /></label>
          <label className="public-corporate-inquiry-message">What would you like your team to learn?<textarea name="message" value={form.message} onChange={updateField} rows={4} maxLength={2000} placeholder="Share your goals, preferred format, or timeframe." /></label>
        </div>
        <label className="public-corporate-inquiry-trap" aria-hidden="true">Website<input name="website" value={form.website} onChange={updateField} tabIndex={-1} autoComplete="off" /></label>
        {error && <p className="public-corporate-inquiry-error" role="alert">{error}</p>}
        <footer><span>We’ll use these details only to respond to your training inquiry.</span><button type="submit" className="public-corporate-primary" disabled={submitting}>{submitting ? 'Sending…' : 'Send inquiry'} <ArrowRight size={17} /></button></footer>
      </form>}
    </section>
  </div>, document.body);
}

function SectionHeading({ eyebrow, title, description, align = 'left' }) {
  return (
    <div className={`public-section-heading align-${align}`}>
      <span className="public-section-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}

function TeamProfileCard({ person, featured = false, index = 0 }) {
  const initials = String(person.name || '?').split(' ')
    .filter(part => /^[A-Z]/i.test(part) && !['Mr.', 'Ms.', 'Mrs.'].includes(part))
    .slice(0, 2).map(part => part[0].toUpperCase()).join('');
  const profilePhotoUrl = person.image || logoSource(person.photo);
  const bio = person.bio || (person.branches
    ? `Supporting student placements and employer connections across ${person.branches}.`
    : 'Supporting students with placement preparation and connections to career opportunities.');

  return <article className={`public-team-card${featured ? ' public-team-lead' : ''}`}>
    <div className={`public-team-photo-wrap avatar-${index + 1}`}>
      <span className="public-team-photo-fallback" aria-hidden="true">{initials}</span>
      {profilePhotoUrl && <img src={profilePhotoUrl} alt={`${person.name} profile`} loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} />}
    </div>
    <div className="public-team-copy">
      {featured && <span className="public-team-lead-label">Placement team lead</span>}
      <span className="public-team-role">{person.role || 'Placement Officer'}</span>
      <h3>{person.name}</h3>
      {person.branches && <span className="public-team-branches">{person.branches}</span>}
      <p>{bio}</p>
      <nav className="public-team-actions" aria-label={`Contact ${person.name}`}>
        {person.linkedin && <a href={person.linkedin.startsWith('http') ? person.linkedin : `https://${person.linkedin}`} target="_blank" rel="noreferrer"><LinkedinLogo size={15} weight="fill" /> Connect</a>}
        {person.phone && <a href={teamPhoneHref(person.phone)}><Phone size={15} weight="fill" /> Call</a>}
        {person.email && <a href={`mailto:${person.email}`}><EnvelopeSimple size={15} weight="fill" /> Email</a>}
        {person.phone && <a href={teamWhatsappHref(person.phone)} target="_blank" rel="noreferrer"><WhatsappLogo size={15} weight="fill" /> WhatsApp</a>}
      </nav>
    </div>
  </article>;
}

function AnimatedMilestone({ value, suffix, label }) {
  const node = useRef(null);
  const [started, setStarted] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!node.current) return undefined;
    if (!('IntersectionObserver' in window)) {
      setStarted(true);
      return undefined;
    }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        setStarted(true);
        observer.disconnect();
      }
    }, { threshold: 0.35 });
    observer.observe(node.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return undefined;
    const startTime = performance.now();
    const duration = 1500;
    let frame;
    const update = now => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(value * eased);
      if (progress < 1) frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [started, value]);

  const displayValue = value < 10 ? count.toFixed(1).replace(/\.0$/, '') : Math.round(count).toLocaleString('en-US');
  return <article className="public-milestone" ref={node}><strong>{displayValue}{suffix}</strong><span>{label}</span></article>;
}

export default function PublicSiteSections({ page = 'all' }) {
  const location = useLocation();
  const [corporateInquiryOpen, setCorporateInquiryOpen] = useState(false);
  const [partners, setPartners] = useState([]);
  const [placementOfficers, setPlacementOfficers] = useState([]);
  const [placementTeamLoading, setPlacementTeamLoading] = useState(false);
  const [placementTeamError, setPlacementTeamError] = useState(false);
  const [vacancies, setVacancies] = useState([]);
  const [vacanciesLoading, setVacanciesLoading] = useState(false);
  const [vacanciesError, setVacanciesError] = useState(false);
  const [partnersLoaded, setPartnersLoaded] = useState(false);
  const [partnersError, setPartnersError] = useState(false);
  const [partnerTotal, setPartnerTotal] = useState(0);
  const [partnerNextOffset, setPartnerNextOffset] = useState(null);
  const [posters, setPosters] = useState([]);
  const [postersLoaded, setPostersLoaded] = useState(false);
  const [postersError, setPostersError] = useState(false);
  const [posterTotal, setPosterTotal] = useState(0);
  const [posterNextOffset, setPosterNextOffset] = useState(null);
  const [mediaTab, setMediaTab] = useState('placement-drive');
  const [mediaItems, setMediaItems] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [videoPlaybackError, setVideoPlaybackError] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(true);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [mediaError, setMediaError] = useState(false);
  const [mediaNextOffset, setMediaNextOffset] = useState(null);
  const [mediaTotal, setMediaTotal] = useState(0);
  const [magazines, setMagazines] = useState([]);
  const [magazinesLoading, setMagazinesLoading] = useState(false);
  const [magazinesError, setMagazinesError] = useState(false);
  const [activeCorporateVideoKey, setActiveCorporateVideoKey] = useState(null);
  const [corporatePhotoGalleryOpen, setCorporatePhotoGalleryOpen] = useState(false);
  const [activeCorporatePhotoIndex, setActiveCorporatePhotoIndex] = useState(null);
  const partnerListPage = page === 'partners-all';
  const partnerDirectoryPage = ['partners-all', 'hiring'].includes(page);
  const posterGalleryPage = page === 'placement-gallery';
  const partnerMediaPage = page === 'partners-media';
  const openVideo = item => { setVideoPlaybackError(false); setSelectedVideo(item); };
  const mediaPage = ['placement-media', 'partners-media'].includes(page);
  const placementPage = ['placement', 'placement-gallery', 'placement-media', 'all'].includes(page);
  const placementCategory = mediaPage
    ? (partnerMediaPage
      ? (['clients', 'client-videos'].includes(new URLSearchParams(location.search).get('category')) ? new URLSearchParams(location.search).get('category') : 'clients')
      : (['placement-drive', 'testimonials', 'talentino', 'videos'].includes(new URLSearchParams(location.search).get('category')) ? new URLSearchParams(location.search).get('category') : 'placement-drive'))
    : mediaTab;
  const mediaTabs = partnerMediaPage
    ? [['clients', 'Client stories'], ['client-videos', 'Client videos']]
    : [['placement-drive', 'Placement drives'], ['testimonials', 'Student testimonials'], ['talentino', 'Talentino videos'], ['videos', 'All videos']];
  const mediaBasePath = partnerMediaPage ? '/partners/media' : '/placements/media';
  const partnersLoading = ['partners', 'partners-all', 'hiring', 'all'].includes(page) && !partnersLoaded;
  const postersLoading = ['placement', 'placement-gallery', 'all'].includes(page) && !postersLoaded;
  const hasGiftyProfile = placementOfficers.some(member => normalizeTeamName(member.name) === normalizeTeamName(placementTeamLead.name));
  const placementTeamSource = hasGiftyProfile ? placementOfficers : [
    {
      name: placementTeamLead.name,
      role: placementTeamLead.role,
      branches: 'Kerala, Karnataka, Tamil Nadu',
      linkedin: 'https://www.linkedin.com/in/gifty-kp/'
    },
    ...placementOfficers
  ];
  const placementTeam = placementTeamSource.map(member => {
    const profile = placementTeamProfiles.find(candidate => candidate.aliases.some(alias => normalizeTeamName(alias) === normalizeTeamName(member.name)));
    const isGifty = normalizeTeamName(member.name) === normalizeTeamName(placementTeamLead.name);
    return {
      ...profile,
      ...member,
      name: member.name,
      role: member.role || profile?.role || 'Placement Officer',
      bio: profile?.bio || member.bio || `Supporting student placements and employer partnerships${member.branches ? ` across ${member.branches}` : ''} at IPCS Global.`,
      image: member.photo ? '' : (profile?.image || ''),
      linkedin: member.linkedin || (isGifty ? 'https://www.linkedin.com/in/gifty-kp/' : '')
    };
  });
  const placementTeamLeadProfile = placementTeam.find(person => normalizeTeamName(person.name) === normalizeTeamName(placementTeamLead.name));
  const placementTeamMembers = placementTeam.filter(person => person !== placementTeamLeadProfile);
  const visibleVacancies = vacancies.filter(vacancy => !/(expired|closed|filled|cancelled|canceled|withdrawn)/i.test(String(vacancy.status || '')));

  useEffect(() => {
    if (!['partners', 'partners-all', 'hiring', 'all'].includes(page)) return undefined;
    let active = true;
    const limit = partnerDirectoryPage ? 500 : 8;
    const query = partnerDirectoryPage ? '&all=true' : '&random=true';
    publicGet(`${API_BASE}/api/public/partners?limit=${limit}&offset=0${query}`)
      .then(response => {
        if (!active) return;
        if (!response.data?.success) throw new Error('Partner directory unavailable');
        setPartnersError(false);
        setPartners(Array.isArray(response.data.partners) ? response.data.partners : []);
        setPartnerTotal(Number(response.data.total) || 0);
        setPartnerNextOffset(response.data.nextOffset ?? null);
      })
      .catch(() => { if (active) setPartnersError(true); })
      .finally(() => { if (active) setPartnersLoaded(true); });
    return () => { active = false; };
  }, [page, partnerDirectoryPage]);

  useEffect(() => {
    if (!['about', 'all'].includes(page)) return undefined;
    let active = true;
    setPlacementTeamLoading(true);
    publicGet(`${API_BASE}/api/public/placement-team`)
      .then(response => {
        if (!active) return;
        if (!response.data?.success) throw new Error('Placement team unavailable');
        setPlacementOfficers(Array.isArray(response.data.team) ? response.data.team : []);
        setPlacementTeamError(false);
      })
      .catch(() => { if (active) setPlacementTeamError(true); })
      .finally(() => { if (active) setPlacementTeamLoading(false); });
    return () => { active = false; };
  }, [page]);

  useEffect(() => {
    if (!['vacancies', 'hiring'].includes(page)) return undefined;
    let active = true;
    setVacanciesLoading(true);
    publicGet(`${API_BASE}/api/public/openings`)
      .then(response => {
        if (!active) return;
        if (!response.data?.success) throw new Error('Vacancies unavailable');
        setVacancies(Array.isArray(response.data.openings) ? response.data.openings : []);
        setVacanciesError(false);
      })
      .catch(() => { if (active) setVacanciesError(true); })
      .finally(() => { if (active) setVacanciesLoading(false); });
    return () => { active = false; };
  }, [page]);

  useEffect(() => {
    if (!['updates', 'all'].includes(page)) return undefined;
    let active = true;
    setMagazinesLoading(true);
    publicGet(`${API_BASE}/api/public/magazines`)
      .then(response => {
        if (!active) return;
        if (!response.data?.success) throw new Error('Magazine library unavailable');
        setMagazines(Array.isArray(response.data.magazines) ? response.data.magazines : []);
        setMagazinesError(false);
      })
      .catch(() => { if (active) setMagazinesError(true); })
      .finally(() => { if (active) setMagazinesLoading(false); });
    return () => { active = false; };
  }, [page]);

  useEffect(() => {
    if (!['placement', 'placement-gallery', 'all'].includes(page)) return undefined;
    let active = true;
    const limit = posterGalleryPage ? 500 : 6;
    const query = posterGalleryPage ? '&all=true' : '&random=true';
    publicGet(`${API_BASE}/api/public/placement-posters?category=posters&limit=${limit}&offset=0${query}`)
      .then(response => {
        if (!active) return;
        if (!response.data?.success) throw new Error('Placement poster gallery unavailable');
        setPostersError(false);
        setPosters(Array.isArray(response.data.posters) ? response.data.posters : []);
        setPosterTotal(Number(response.data.total) || 0);
        setPosterNextOffset(response.data.nextOffset ?? null);
      })
      .catch(() => { if (active) setPostersError(true); })
      .finally(() => { if (active) setPostersLoaded(true); });
    return () => { active = false; };
  }, [page, posterGalleryPage]);

  useEffect(() => {
    if ((!placementPage && !partnerMediaPage) || (page === 'placement' && !mediaOpen)) return undefined;
    let active = true;
    const mediaQuery = mediaPage ? '&all=true' : '&random=true';
    publicGet(`${API_BASE}/api/public/placement-posters?category=${encodeURIComponent(placementCategory)}&limit=${mediaPage ? 500 : 6}&offset=0${mediaQuery}`)
      .then(response => {
        if (!active) return;
        if (!response.data?.success) throw new Error('Placement media unavailable');
        setMediaError(false);
        setMediaItems(response.data.posters || []);
        setMediaNextOffset(response.data.nextOffset ?? null);
        setMediaTotal(Number(response.data.total) || 0);
      })
      .catch(() => { if (active) setMediaError(true); })
      .finally(() => { if (active) { setMediaLoaded(true); setMediaLoading(false); } });
    return () => { active = false; };
  }, [page, placementCategory, placementPage, partnerMediaPage, mediaPage, mediaOpen]);

  useEffect(() => {
    if (!selectedVideo) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = event => { if (event.key === 'Escape') setSelectedVideo(null); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [selectedVideo]);

  useEffect(() => {
    if (!corporatePhotoGalleryOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = event => {
      if (event.key === 'Escape') setCorporatePhotoGalleryOpen(false);
      if (activeCorporatePhotoIndex === null) return;
      if (event.key === 'ArrowRight') setActiveCorporatePhotoIndex(index => (index + 1) % corporateTrainingPhotos.length);
      if (event.key === 'ArrowLeft') setActiveCorporatePhotoIndex(index => (index + corporateTrainingPhotos.length - 1) % corporateTrainingPhotos.length);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [corporatePhotoGalleryOpen, activeCorporatePhotoIndex]);

  const loadMore = async (kind) => {
    const isPartner = kind === 'partners';
    const isPoster = kind === 'posters';
    const offset = isPartner ? partnerNextOffset : isPoster ? posterNextOffset : mediaNextOffset;
    if (offset === null) return;
    try {
      const category = isPoster ? 'posters' : placementCategory;
      const response = await publicGet(isPartner
        ? `${API_BASE}/api/public/partners?limit=100&offset=${offset}`
        : `${API_BASE}/api/public/placement-posters?category=${encodeURIComponent(category)}&limit=24&offset=${offset}`);
      if (isPartner) {
        setPartners(current => [...current, ...(response.data?.partners || [])]);
        setPartnerNextOffset(response.data?.nextOffset ?? null);
        return;
      }
      const newItems = response.data?.posters || [];
      if (isPoster) {
        setPosters(current => [...current, ...newItems]);
        setPosterNextOffset(response.data.nextOffset ?? null);
      } else {
        setMediaItems(current => [...current, ...newItems]);
        setMediaNextOffset(response.data.nextOffset ?? null);
      }
    } catch {
      if (isPartner) setPartnersError(true);
      else if (isPoster) setPostersError(true);
      else setMediaError(true);
    }
  };

  return (
    <div className="public-story">
      {page === 'corporate-training' && <>
        <section className="public-corporate-hero">
          <div className="public-story-shell public-corporate-hero-grid">
            <div className="public-corporate-hero-copy">
              <span className="public-corporate-kicker"><span /> IPCS GLOBAL · CORPORATE TRAINING</span>
              <h1>Enhancing professionalism with <em>proven standards.</em></h1>
              <p>Build a skilled, adaptive, and forward-thinking workforce. IPCS Global brings more than 17 years of experience in automation and industrial solutions to customized, practical training for working professionals and organizations.</p>
              <div className="public-corporate-hero-actions"><button type="button" className="public-corporate-primary" onClick={() => setCorporateInquiryOpen(true)}>Talk with our team <ArrowRight size={17} /></button><a className="public-corporate-secondary" href="#training-programs">Explore programs</a></div>
              <div className="public-corporate-trust"><span><CheckCircle size={16} weight="fill" /> Industry-informed</span><span><CheckCircle size={16} weight="fill" /> Practical learning</span><span><CheckCircle size={16} weight="fill" /> Flexible delivery</span></div>
            </div>
            <aside className="public-corporate-hero-panel" aria-label="Corporate training highlights">
              <div className="public-corporate-orbit" aria-hidden="true"><span /><span /><span /></div>
              <div className="public-corporate-panel-icon"><GraduationCap size={31} weight="duotone" /></div>
              <span className="public-corporate-panel-label">LEARNING THAT WORKS IN THE REAL WORLD</span>
              <h2>People. Practice. Progress.</h2>
              <p>Technology training designed around the systems, teams, and outcomes that matter to your organization.</p>
              <div className="public-corporate-panel-stats"><div><strong>17+</strong><span>years of experience</span></div><div><strong>Onsite</strong><span>or remote delivery</span></div></div>
            </aside>
          </div>
        </section>

        <section className="public-corporate-intro">
          <div className="public-story-shell public-corporate-intro-grid">
            <div><span className="public-corporate-eyebrow">TRAINING BENEFICIARIES</span><h2>Upskill your people.<br /><em>Move your business forward.</em></h2></div>
            <p>Success in a fast-evolving industrial landscape depends on a capable, adaptable workforce. Our corporate programs help working professionals grow their skills and help organizations build the technological edge to flourish. Each program is customized, scalable, and results-driven, aligned with your team’s objectives.</p>
          </div>
        </section>

        <section className="public-corporate-features" id="training-programs">
          <div className="public-story-shell">
            <SectionHeading eyebrow="The IPCS approach" title="Training designed for the way your team works." description="From planning through assessment, every part of the program is shaped to make learning useful on the job." align="center" />
            <div className="public-corporate-feature-grid">{corporateTrainingFeatures.map((item, index) => { const Icon = item.icon; return <article className="public-corporate-feature-card" key={item.title}><span className="public-corporate-feature-number">{String(index + 1).padStart(2, '0')}</span><span className="public-corporate-feature-icon"><Icon size={22} weight="duotone" /></span><h3>{item.title}</h3><p>{item.copy}</p></article>; })}</div>
          </div>
        </section>

        <section className="public-corporate-topics">
          <div className="public-story-shell public-corporate-topics-grid">
            <div className="public-corporate-topics-copy"><span className="public-corporate-eyebrow">CURRENT, ADVANCED TOPICS</span><h2>Technical learning for a changing workplace.</h2><p>Keep your teams moving with programs that span foundational systems and emerging technology. We work with you to select the right topics and depth for your people.</p><Link to="/about" className="public-corporate-text-link">Discover IPCS Global <ArrowRight size={16} /></Link></div>
            <div className="public-corporate-topic-list">{corporateTrainingTopics.map((topic, index) => <div key={topic}><span>{String(index + 1).padStart(2, '0')}</span><b>{topic}</b><CheckCircle size={17} weight="fill" /></div>)}</div>
          </div>
        </section>

        <section className="public-corporate-video-section" id="corporate-training-videos">
          <div className="public-story-shell">
            <SectionHeading eyebrow="Watch &amp; learn" title="Corporate training in action." description="Preview and play IPCS Global corporate training videos here." align="center" />
            <div className="public-corporate-video-grid">{corporateTrainingVideos.map((video, index) => <article className={`public-corporate-video-card corporate-video-${index + 1}`} key={video.key}>
              <div className="public-corporate-video-frame">{activeCorporateVideoKey === video.key
                ? <iframe src={`https://ipcsglobalsolutions-my.sharepoint.com/personal/ipcsdesigners_ipcsglobal_com/_layouts/15/embed.aspx?autoplay=true&muted=true&UniqueId=${video.id}&embed=%7B%22af%22%3Atrue%2C%22ust%22%3Atrue%7D&referrer=StreamWebApp&referrerScenario=EmbedDialog.Create`} title={video.title} loading="eager" allow="autoplay; encrypted-media; picture-in-picture; web-share" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
                : <button type="button" className="public-corporate-video-launch" onClick={() => setActiveCorporateVideoKey(video.key)} aria-label={`Play video: ${video.title}`}><PlayCircle size={46} weight="fill" /><span>Play video</span></button>}</div>
              <h3>{video.title}</h3>
              <span>VIDEO {String(index + 1).padStart(2, '0')}</span>
            </article>)}</div>
          </div>
        </section>

        <section className="public-corporate-photo-section" id="corporate-training-photos">
          <div className="public-story-shell">
            <SectionHeading eyebrow="Event gallery" title="Training moments from the field." description="A moving photo reel from IPCS Global’s Bhutan Police and Military BMS training programmes." align="center" />
            <div className="public-corporate-photo-reel" role="region" aria-label="Bhutan Police and Military BMS training event photos">
              {corporateTrainingPhotoRows.map((photos, rowIndex) => <div className="public-corporate-photo-marquee" role="group" aria-label={rowIndex === 0 ? 'Photo row moving left' : 'Photo row moving right'} key={`photo-row-${rowIndex}`}>
                <div className={`public-corporate-photo-track${rowIndex === 1 ? ' is-right' : ''}`}>
                  {[...photos, ...photos].map((photo, index) => <button type="button" className="public-corporate-photo-card" onClick={() => { setActiveCorporateVideoKey(null); setActiveCorporatePhotoIndex(corporateTrainingPhotos.indexOf(photo)); setCorporatePhotoGalleryOpen(true); }} key={`${photo.group}-${photo.name}-${index}`} aria-label={`View ${photo.group} training photo ${photo.index + 1}`}>
                    <img src={photo.src} alt={`IPCS Global ${photo.group} BMS training event, photo ${photo.index + 1}`} loading={index < 5 ? 'eager' : 'lazy'} onError={event => { event.currentTarget.closest('.public-corporate-photo-card')?.classList.add('is-unavailable'); }} />
                    <span>{photo.label}</span>
                  </button>)}
                </div>
              </div>)}
            </div>
            <div className="public-corporate-photo-actions"><span>Showing {corporateTrainingPhotos.length} event photos</span><button type="button" onClick={() => { setActiveCorporateVideoKey(null); setActiveCorporatePhotoIndex(null); setCorporatePhotoGalleryOpen(true); }}>See all photos <ArrowRight size={16} /></button></div>
          </div>
        </section>

        <section className="public-corporate-audience">
          <div className="public-story-shell">
            <SectionHeading eyebrow="Who benefits" title="One learning partner. Different paths to grow." description="Programs can support individuals, specialist teams, and organization-wide capability building." />
            <div className="public-corporate-audience-grid">{corporateTrainingAudiences.map((item, index) => <article key={item.title}><span className="public-corporate-audience-icon">{index === 0 ? <Compass size={20} /> : index === 1 ? <Star size={20} /> : index === 2 ? <Buildings size={20} /> : <UsersThree size={20} />}</span><span className="public-corporate-eyebrow">0{index + 1}</span><h3>{item.title}</h3><p>{item.copy}</p></article>)}</div>
          </div>
        </section>

        <section className="public-corporate-results">
          <div className="public-story-shell public-corporate-results-inner"><div><span className="public-corporate-kicker"><span /> PEOPLE ARE YOUR ADVANTAGE</span><h2>Invest in people.<br /><em>Accelerate growth.</em></h2><p>Our corporate clients have seen tangible gains in process efficiency, innovation, and employee retention. Our wider experience includes work with Fortune 500 companies, government projects, and reputed academic institutions. Let’s build smarter teams, better systems, and stronger futures—together.</p></div><button type="button" className="public-corporate-primary" onClick={() => setCorporateInquiryOpen(true)}>Connect with our team <ArrowRight size={17} /></button><div className="public-corporate-results-mark" aria-hidden="true"><Handshake size={150} weight="thin" /></div></div>
        </section>
      </>}

      {['about', 'all'].includes(page) && <>
      <section className="public-about-section" id="about">
        <div className="public-story-shell">
          <article className="public-about-story">
            <SectionHeading
              eyebrow="THE JOURNEY · IPCS GLOBAL SOLUTIONS PVT. LTD."
              title="The world’s trusted industry-based training institution."
              description="What makes IPCS different is one word: improvisation. We aspire to be a one-stop technology partner for job aspirants and recruiters, closing the technical skills gap through practical training and on-project experience."
            />
            <div className="public-about-grid">
              <article className="public-about-card public-about-main">
                <div className="public-card-icon"><Compass size={23} weight="duotone" /></div>
                <span className="public-card-kicker">Who We Are</span>
                <h3>Practical learning. Constant improvement. Real opportunity.</h3>
                <p>IPCS Global Solutions began in Kerala with a belief that technical education should prepare people for the work they will actually do. Practical training and on-project experience help students build confidence, develop their potential, and move toward meaningful careers.</p>
                <p>Our work brings together technical training, industrial automation, digital services, and corporate partnerships. By connecting job aspirants with recruiters and industry, we work to make the technical skills gap smaller and opportunity more accessible.</p>
                <a className="public-about-team-link" href="#team">Learn more about our Team <ArrowRight size={17} weight="bold" /></a>
              </article>
              <div className="public-about-facts">
                <article className="public-fact-card"><span className="public-fact-number">2008</span><span>Our first office opened in Calicut, Kerala</span></article>
                <article className="public-fact-card"><span className="public-fact-number">30+</span><span>Branches across India, with three international locations</span></article>
                <article className="public-fact-card"><span className="public-fact-number">50+</span><span>India branches is our 2026 expansion goal</span></article>
              </div>
            </div>
            <section className="public-brand-portfolio" aria-labelledby="public-brand-title">
              <div className="public-brand-heading"><span>BRANDS UNDER IPCS</span><h3 id="public-brand-title">Three teams. One shared drive to improve.</h3><p>Automation, digital technology, and industry-focused learning work together to help organizations and people move forward.</p></div>
              <div className="public-brand-grid">{aboutBrands.map((brand, index) => <article className={`public-brand-card public-brand-card-${index + 1}`} key={brand.name}>
                <span className="public-brand-focus">{brand.focus}</span><h4>{brand.name}</h4><p>{brand.copy}</p>
                <div className="public-brand-stat"><strong>{brand.stat}</strong><span>{brand.statLabel}</span></div>
                <div className="public-brand-tags">{brand.tags.map(tag => <span key={tag}>{tag}</span>)}</div>
              </article>)}</div>
            </section>
            <div className="public-roadmap" aria-label="IPCS Global company history">
              <div className="public-roadmap-heading"><span>OUR JOURNEY</span><h3>From our first Calicut office to a growing global network.</h3><p>Milestones shared by IPCS Global—and the next goals we are working toward.</p></div>
              <ol className="public-roadmap-list">
                {companyRoadmap.map((item, index) => <li className="public-roadmap-item" key={item.date}>
                  <div className="public-roadmap-marker"><span>{String(index + 1).padStart(2, '0')}</span></div>
                  <div className="public-roadmap-card"><div className="public-roadmap-meta"><span>{item.date}</span><span>{item.phase}</span></div><h4>{item.title}</h4><p>{item.copy}</p></div>
                </li>)}
              </ol>
            </div>
          </article>
          <div className="public-capability-grid">
            <article><span>INDUSTRY SOLUTIONS</span><h3>Automation, from design through commissioning.</h3><p>We propose, supply, install, and commission systems to industry standards across software, marine, construction, and manufacturing. Our work includes process, factory, and machine automation; CNC; building and energy management; IoT and robotics; and industrial calibration and testing.</p><div>{['PLCs', 'SCADA', 'DCS', 'HMI', 'CNC', 'IoT', 'Robotics', 'Drives', 'Sensors'].map(item => <b key={item}>{item}</b>)}</div></article>
            <article><span>PROFESSIONAL &amp; CORPORATE TRAINING</span><h3>Skills built around real systems and industry needs.</h3><p>Hands-on training for professionals and companies builds practical skills for modern technical work, automation, controls, IT, and emerging technologies.</p><div>{['PLC & SCADA', 'DCS & HMI', 'Panel Design', 'Process & Electrical Controls', 'Embedded Systems', 'Robotics', 'Industrial Networking', 'IoT', 'Python & Data Science', 'Digital Marketing'].map(item => <b key={item}>{item}</b>)}</div></article>
          </div>
          <section className="public-awards-section" aria-labelledby="public-awards-title">
            <div className="public-brand-heading"><span>AWARDED FOR EXCELLENCE</span><h3 id="public-awards-title">Standards and recognition.</h3></div>
            <div className="public-awards-grid">{companyAwards.map((award, index) => <article key={award.title}><span className="public-award-index">0{index + 1}</span><span className="public-award-star"><Star size={19} weight="fill" /></span><h4>{award.title}</h4><p>{award.detail}</p></article>)}</div>
          </section>
          <div className="public-values-row">
            <div><span className="public-value-icon"><Compass size={17} weight="fill" /></span><span><b>Our Mission</b><small>Help job aspirants and recruiters meet through practical learning and technology solutions that build real capability.</small></span></div>
            <div><span className="public-value-icon"><Target size={17} weight="fill" /></span><span><b>Our Vision</b><small>Become a one-stop technological solution for learners, employers, and organizations.</small></span></div>
            <div><span className="public-value-icon"><Star size={17} weight="fill" /></span><span><b>Our Values</b><small>Keep improving, work with integrity, learn by doing, and help people reach their potential.</small></span></div>
          </div>
          <section className="public-milestones-section" id="milestones" aria-label="IPCS Global milestones">
            <div className="public-milestones-intro"><span>IPCS GLOBAL IN NUMBERS</span><h2>Skills, solutions, and reach.</h2></div>
            <div className="public-milestone-grid">
              {milestones.map(item => <AnimatedMilestone key={item.label} {...item} />)}
            </div>
          </section>
        </div>
      </section>

      <section className="public-team-section" id="team">
        <div className="public-story-shell">
          <SectionHeading eyebrow="Career guidance & placement" title="IPCS Placement Team" description="Meet the people helping students prepare for careers and connect with employers." align="center" />
          {placementTeamError && <div className="public-team-status" role="status">Placement team details are temporarily unavailable. Please check back soon.</div>}
          {placementTeamLoading ? <>
            <div className="public-team-skeleton public-team-lead-skeleton" aria-label="Loading placement team lead" />
            <div className="public-team-grid" aria-label="Loading placement team">{[1, 2, 3].map(item => <div className="public-team-skeleton" key={item} />)}</div>
          </> : <>
            {placementTeamLeadProfile && <TeamProfileCard person={placementTeamLeadProfile} featured />}
            <div className="public-team-grid">
              {placementTeamMembers.map((person, index) => <TeamProfileCard person={person} index={index} key={person.name} />)}
            </div>
          </>}
        </div>
      </section>
      </>}

      {['placement', 'placement-gallery', 'placement-media', 'all'].includes(page) && <>
      <section className="public-placement-section" id="placement">
        <div className="public-story-shell">
          <SectionHeading
            eyebrow="Career guidance & placement"
            title="Skills meet opportunity."
            description="Today’s industries look for people who bring both skills and qualifications. The IPCS Career Guidance and Placement Unit connects student aspirations with recruiter needs and supports students throughout their career preparation."
          />
          <div className="public-placement-copy-grid">
            <article className="public-placement-copy">
              <p>Established in 2012, the placement unit works throughout the year to build relationships with reputed firms and industrial establishments, arrange interviews and drives, and prepare students for the changing job market.</p>
              <p>Through Talentino, students across our branches take part in career development sessions twice a month. They practise expressing their technical knowledge with confidence through mock interviews, group discussions, communication workshops, trial technical exams, and interactive sessions with industry professionals.</p>
              <div className="public-placement-note"><Handshake size={20} weight="duotone" /><span><b>One goal: career readiness</b><small>Training, guidance, internships, and recruiter connections support each student’s next step.</small></span></div>
            </article>
            <article className="public-objectives-card">
              <span className="public-card-kicker">PLACEMENT CELL OBJECTIVES</span>
              <h3>Prepare. Connect. Progress.</h3>
              <ul>{objectives.map(item => <li key={item}><CheckCircle size={18} weight="fill" />{item}</li>)}</ul>
            </article>
          </div>
          {page === 'placement' && <section className="public-recruiter-panel" id="recruiter-partnerships">
            <div className="public-recruiter-intro"><span className="public-card-kicker">RECRUITER PARTNERSHIPS · OPEN ACCESS</span><h3>Work with IPCS to meet career-ready talent.</h3><p>Explore the placement program and partnership process here. Recruiters can review public information without creating an account; private MOU signing links are issued directly by IPCS.</p><Link className="public-recruiter-link" to="/partners">Meet our hiring partners <ArrowRight size={16} /></Link></div>
            <div className="public-recruiter-steps">{[
              ['01', 'Align on hiring needs', 'Discuss candidate profiles, roles, and the recruitment plan.'],
              ['02', 'Review the agreement', 'IPCS sends an authorized representative a private MOU link.'],
              ['03', 'Start the partnership', 'After signing, the placement team coordinates candidate introductions and drives.']
            ].map(([number, title, copy]) => <article key={number}><span>{number}</span><div><b>{title}</b><p>{copy}</p></div></article>)}</div>
          </section>}
          <div className="public-talentino-card">
            <div className="public-talentino-icon"><Lightbulb size={26} weight="duotone" /></div>
            <div><span className="public-card-kicker">CAREER DEVELOPMENT PROGRAM</span><h3>Talentino</h3><p>A practical program for all students, with personality development, communication skills, group discussions, mock interviews, industry and internship orientation, and interactive activities that build confidence.</p><div className="public-career-program-list">{careerPrograms.map(program => <span key={program}>{program}</span>)}</div></div>
            <Link className="public-inline-link" to="/placements/media?category=talentino">Explore Talentino media <ArrowRight size={17} /></Link>
          </div>
          <div className="public-placement-updates">
            <div className="public-subheading"><span>PLACEMENT UPDATES</span><h3>Stories, activities, and opportunities.</h3></div>
            <div className="public-placement-grid">
              {placementHighlights.map(item => {
                const Icon = item.icon;
                const title = item.title.toLowerCase();
                const target = title.includes('poster') ? '/placements/posters' : title.includes('video') ? '/placements/media?category=testimonials' : title.includes('drive') ? '/placements/media?category=placement-drive' : '/placements/media?category=talentino';
                return <article className="public-placement-tile" key={item.title}><span className="public-tile-icon"><Icon size={22} weight="duotone" /></span><h4>{item.title}</h4><p>{item.copy}</p><Link to={target}>Explore <ArrowUpRight size={15} /></Link></article>;
              })}
            </div>
          </div>
          {page !== 'placement-media' && <div className="public-poster-gallery">
            <div className="public-subheading"><span>PLACEMENT POSTERS</span><h3>{posterGalleryPage ? 'Every poster in the placement gallery.' : 'Career moments, shared across IPCS.'}</h3>{posterGalleryPage && <p>Browse placement announcements and career-drive creatives from IPCS Global.</p>}</div>
            {posterGalleryPage && <Link className="public-gallery-back" to="/placements">← Back to placements</Link>}
            {postersLoading ? (
              <div className="public-poster-grid" aria-label="Loading placement posters">{[1, 2, 3, 4].map(item => <div className="public-poster-skeleton" key={item} />)}</div>
            ) : postersError ? (
              <div className="public-poster-empty" role="status">The poster gallery is temporarily unavailable. Please check the Drive folder sharing with the portal’s Drive account.</div>
            ) : posters.length === 0 ? (
              <div className="public-poster-empty">No poster images were found in the shared placement creatives folder.</div>
            ) : page === 'placement' ? (
              <div className="public-poster-marquee" aria-label="Recent placement posters">
                <div className="public-poster-marquee-track">
                  {[...posters, ...posters].map((poster, index) => (
                    <a className="public-poster-card public-poster-marquee-card" key={`${poster.id}-${index}`} href={`${API_BASE}${poster.imageUrl}`} target="_blank" rel="noreferrer" aria-label={poster.name} aria-hidden={index >= posters.length || undefined} tabIndex={index >= posters.length ? -1 : undefined}>
                      <div className="public-poster-image"><img src={`${API_BASE}${poster.imageUrl}`} alt={poster.name} loading="lazy" decoding="async" /></div>
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <div className="public-poster-grid">
                {posters.map(poster => (
                  <a className="public-poster-card" key={poster.id} href={`${API_BASE}${poster.imageUrl}`} target="_blank" rel="noreferrer" aria-label={poster.name}>
                    <div className="public-poster-image"><img src={`${API_BASE}${poster.imageUrl}`} alt={poster.name} loading="lazy" decoding="async" /></div>
                  </a>
                ))}
              </div>
            )}
            {!postersLoading && !postersError && posterTotal > 6 && page === 'placement' && <div className="public-gallery-more"><span>Showing {posters.length} of {posterTotal} posters</span><Link to="/placements/posters">See all posters <ArrowRight size={16} /></Link></div>}
            {!postersLoading && posterGalleryPage && posterNextOffset !== null && <div className="public-gallery-more"><span>Showing {posters.length} of {posterTotal} posters</span><button type="button" onClick={() => loadMore('posters')}>Load more posters <ArrowRight size={16} /></button></div>}
          </div>}
          <div className="public-placement-media" id="placement-media">
            <div className="public-subheading"><span>PLACEMENT MEDIA</span><h3>{mediaPage ? 'Placement drives, stories, and Talentino.' : 'More than a poster: meet the people and moments.'}</h3><p>Drive media from the shared IPCS creatives folder appears here by album. Add images or videos in folders named for placement drives, testimonials, or Talentino.</p></div>
            <div className="public-media-tabs" role="tablist" aria-label="Placement media albums">
              {mediaTabs.map(([key, label]) => mediaPage
                ? <Link key={key} role="tab" aria-selected={placementCategory === key} className={`public-media-tab${placementCategory === key ? ' active' : ''}`} to={`${mediaBasePath}?category=${key}`}><VideoCamera size={16} />{label}</Link>
                : <button key={key} type="button" role="tab" aria-selected={mediaTab === key} className={`public-media-tab${mediaTab === key ? ' active' : ''}`} onClick={() => { setMediaTab(key); setMediaOpen(true); setMediaItems([]); setMediaLoaded(false); setMediaLoading(true); setMediaError(false); }}><VideoCamera size={16} />{label}</button>)}
            </div>
            {mediaLoading || ((mediaPage || mediaOpen) && !mediaLoaded) ? <div className="public-poster-grid">{[1, 2, 3].map(item => <div className="public-poster-skeleton" key={item} />)}</div>
              : mediaError ? <div className="public-poster-empty" role="status">Placement media could not be loaded. Check the shared Drive folder connection and try again.</div>
                : !mediaLoaded && !mediaPage ? <div className="public-poster-empty">Choose an album to load its placement media.</div>
                  : mediaLoaded && !mediaItems.length ? <div className="public-poster-empty">No media has been added to this album yet. Add files to a Drive folder named “{placementCategory === 'placement-drive' ? 'Placement Drive' : placementCategory === 'testimonials' ? 'Testimonials' : placementCategory === 'talentino' ? 'Talentino' : placementCategory === 'clients' ? 'Clients' : placementCategory === 'client-videos' ? 'Client Videos' : 'Videos'}” and it will appear here.</div>
                    : page === 'placement' ? <div className="public-poster-marquee public-media-marquee" aria-label="Placement videos and activities">
                      <div className="public-poster-marquee-track">{[...mediaItems, ...mediaItems].map((item, index) => {
                        const duplicate = index >= mediaItems.length;
                        const preview = <><div className="public-poster-image public-video-preview-thumb">
                          {item.mediaType === 'video'
                            ? <img src={videoThumbnail(item)} alt="" loading="lazy" decoding="async" onError={event => {
                              const fallback = `https://drive.google.com/thumbnail?id=${encodeURIComponent(item.id)}&sz=w640`;
                              if (event.currentTarget.src !== fallback) event.currentTarget.src = fallback;
                              else event.currentTarget.style.display = 'none';
                            }} />
                            : <img src={`${API_BASE}${item.imageUrl}`} alt="" loading="lazy" decoding="async" />}
                          {item.mediaType === 'video' && <span className="public-video-play-badge"><PlayCircle size={39} weight="fill" /></span>}
                        </div><div className="public-poster-meta"><span>{item.folder}</span><h4>{item.name}</h4></div></>;
                        return item.mediaType === 'video'
                          ? <article className="public-poster-card public-poster-marquee-card public-media-preview-card" key={`${item.id}-${index}`} aria-hidden={duplicate || undefined}><button type="button" className="public-media-preview-button" onClick={() => !duplicate && openVideo(item)} aria-label={`Play ${item.name}`} tabIndex={duplicate ? -1 : undefined}>{preview}</button></article>
                          : <Link className="public-poster-card public-poster-marquee-card public-media-preview-card" key={`${item.id}-${index}`} to={`${mediaBasePath}?category=${placementCategory}`} aria-hidden={duplicate || undefined} tabIndex={duplicate ? -1 : undefined}>{preview}</Link>;
                      })}</div>
                    </div> : <div className="public-poster-grid">{mediaItems.map(item => <article className="public-poster-card public-media-card" key={item.id}>
                      {item.mediaType === 'video' ? <button type="button" className="public-poster-image public-video-open" onClick={() => openVideo(item)} aria-label={`Play ${item.name}`}><img src={videoThumbnail(item)} alt="" loading="lazy" /><span className="public-video-play-badge"><PlayCircle size={46} weight="fill" /></span></button> : <a className="public-poster-image" href={`${API_BASE}${item.imageUrl}`} target="_blank" rel="noreferrer"><img src={`${API_BASE}${item.imageUrl}`} alt={item.name} loading="lazy" decoding="async" /><span className="public-poster-open"><ArrowUpRight size={17} /></span></a>}
                      <div className="public-poster-meta"><span>{item.folder}</span><h4>{item.name}</h4></div>
                    </article>)}</div>}
            {mediaLoaded && mediaItems.length > 0 && !mediaPage && <div className="public-gallery-more"><span>Random preview · {mediaTotal} available</span><Link to={`${mediaBasePath}?category=${placementCategory}`}>See all {mediaItems.some(item => item.mediaType === 'video') ? 'videos' : 'media'} <ArrowRight size={16} /></Link></div>}
            {mediaPage && mediaLoaded && mediaItems.length > 0 && <div className="public-gallery-more"><span>Showing {mediaItems.length} of {mediaTotal} items</span>{mediaNextOffset !== null && <button type="button" onClick={() => loadMore('media')}>Load more <ArrowRight size={16} /></button>}</div>}
          </div>
        </div>
      </section>
      </>}

      {['partners', 'partners-all', 'hiring', 'all'].includes(page) && <>
      <section className="public-partners-section" id="partners">
        <div className="public-story-shell">
          <div className="public-partners-heading">
            <SectionHeading eyebrow={page === 'hiring' ? 'Employers & opportunities' : 'Hiring Partners'} title={partnerListPage ? 'All hiring partners.' : page === 'hiring' ? 'Meet our hiring partners.' : 'Hiring partners who move opportunity forward.'} description={page === 'hiring' ? 'Explore the employers connected to IPCS Global, then browse their current openings below.' : 'Our corporate relationships help connect technical learning with real workplace needs.'} />
            <div className="public-partner-actions"><Link className="public-partner-cta" to="/partners/media?category=clients">Client stories <VideoCamera size={16} /></Link><Link className="public-partner-cta" to="/placements#recruiter-partnerships">Become a partner <ArrowUpRight size={17} /></Link></div>
          </div>
          {partnerListPage && <Link className="public-gallery-back" to="/partners">← Back to partners</Link>}
          {partnersLoading ? (
            <div className="public-partner-grid" aria-label="Loading partners">{[1, 2, 3, 4].map(item => <div className="public-partner-skeleton" key={item} />)}</div>
          ) : partnersError ? (
            <div className="public-partners-empty" role="status">The partner directory is temporarily unavailable. Please check back soon.</div>
          ) : partners.length === 0 ? (
            <div className="public-partners-empty">Our corporate partner directory is being updated. Please check back soon.</div>
          ) : (
            <div className="public-partner-grid">
              {partners.map((partner, index) => (
                <article className="public-partner-card" key={`${partner.companyName}-${index}`}>
                  <div className="public-partner-logo-wrap">
                    <span>{partner.companyName.slice(0, 2).toUpperCase()}</span>
                    {logoSource(partner.logo) && <img src={logoSource(partner.logo)} alt={`${partner.companyName} logo`} loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} />}
                  </div>
                  <h3>{partner.companyName}</h3>
                  {partner.location && <p>{partner.location}</p>}
                </article>
              ))}
            </div>
          )}
          {!partnerDirectoryPage && partnerTotal > partners.length && <div className="public-gallery-more"><span>Showing {partners.length} of {partnerTotal} hiring partners</span><Link to="/partners/all">See all hiring partners <ArrowRight size={16} /></Link></div>}
          {partnerDirectoryPage && partnerNextOffset !== null && <div className="public-gallery-more"><span>Showing {partners.length} of {partnerTotal} hiring partners</span><button type="button" onClick={() => loadMore('partners')}>Load more partners <ArrowRight size={16} /></button></div>}
        </div>
      </section>
      </>}

      {partnerMediaPage && <section className="public-partners-section public-client-media-section">
        <div className="public-story-shell">
          <SectionHeading eyebrow="Clients &amp; partners" title="People and projects behind the partnership." description="Client stories, testimonials, and videos shared from the IPCS creatives Drive folder." />
          <Link className="public-gallery-back" to="/partners">← Back to hiring partners</Link>
          <div className="public-media-tabs" role="tablist" aria-label="Client media albums">
            {mediaTabs.map(([key, label]) => <Link key={key} role="tab" aria-selected={placementCategory === key} className={`public-media-tab${placementCategory === key ? ' active' : ''}`} to={`/partners/media?category=${key}`}><VideoCamera size={16} />{label}</Link>)}
          </div>
          {mediaLoading || !mediaLoaded ? <div className="public-poster-grid">{[1, 2, 3].map(item => <div className="public-poster-skeleton" key={item} />)}</div>
            : mediaError ? <div className="public-poster-empty" role="status">Client media could not be loaded. Check the shared Drive folder connection and try again.</div>
              : !mediaItems.length ? <div className="public-poster-empty">No client media has been added yet. Add files to a folder named “{placementCategory === 'client-videos' ? 'Client Videos' : 'Clients'}” inside the shared IPCS creatives folder.</div>
                : <div className="public-poster-grid">{mediaItems.map(item => <article className="public-poster-card public-media-card" key={item.id}>
                  {item.mediaType === 'video' ? <button type="button" className="public-poster-image public-video-open" onClick={() => setSelectedVideo(item)} aria-label={`Play ${item.name}`}><img src={videoThumbnail(item)} alt="" loading="lazy" /><span className="public-video-play-badge"><PlayCircle size={46} weight="fill" /></span></button> : <a className="public-poster-image" href={`${API_BASE}${item.imageUrl}`} target="_blank" rel="noreferrer"><img src={`${API_BASE}${item.imageUrl}`} alt={item.name} loading="lazy" decoding="async" /><span className="public-poster-open"><ArrowUpRight size={17} /></span></a>}
                  <div className="public-poster-meta"><span>{item.folder}</span><h4>{item.name}</h4></div>
                </article>)}</div>}
          {mediaLoaded && mediaItems.length > 0 && <div className="public-gallery-more"><span>Showing {mediaItems.length} of {mediaTotal} items</span>{mediaNextOffset !== null && <button type="button" onClick={() => loadMore('media')}>Load more <ArrowRight size={16} /></button>}</div>}
        </div>
      </section>}

      {['updates', 'all'].includes(page) && <>
      <section className="public-updates-section" id="updates">
        <div className="public-story-shell">
          <SectionHeading eyebrow="From IPCS Global" title="Ideas, updates, and learning." description="Read about digital marketing, automation, career growth, and the people shaping our learning community." />
          <div className="public-updates-columns">
            <div className="public-update-column">
              <div className="public-subheading"><span>IPCS GLOBAL BLOG</span><h3>Recent articles</h3></div>
              <div className="public-blog-list">
                {blogs.map((title, index) => <article className="public-blog-card" key={title}><span className="public-blog-number">{String(index + 1).padStart(2, '0')}</span><div><h4>{title}</h4><span>IPCS Global · Knowledge &amp; careers</span></div><BookOpenText size={19} /></article>)}
              </div>
            </div>
            <div className="public-update-column">
              <div className="public-subheading"><span>IZIAR E-MAGAZINE</span><h3>News &amp; stories</h3></div>
              {magazinesLoading ? <div className="public-magazine-grid" aria-label="Loading magazine editions">{[1, 2, 3, 4, 5, 6].map(item => <div className="public-magazine-skeleton" key={item} />)}</div>
                : magazinesError ? <div className="public-magazine-empty" role="status">Magazine editions could not be loaded. You can still browse the shared IZIAR library in Drive.</div>
                  : magazines.length ? <div className="public-magazine-grid">
                    {magazines.map((magazine, index) => <a className={`public-magazine-card magazine-${index % 4}`} href={magazine.webViewUrl || `https://drive.google.com/file/d/${encodeURIComponent(magazine.id)}/view?usp=sharing`} target="_blank" rel="noreferrer" key={magazine.id} aria-label={`Open IZIAR e-magazine ${magazineEditionTitle(magazine.name)}`}>
                      <img src={magazine.thumbnailUrl || `https://drive.google.com/thumbnail?id=${encodeURIComponent(magazine.id)}&sz=w640`} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} />
                      <span className="public-magazine-mark">IPCS <i>×</i> IZIAR</span><span className="public-magazine-title">IZIAR</span><span className="public-magazine-edition">E-MAGAZINE <b>{magazineEditionTitle(magazine.name)}</b></span>
                    </a>)}
                  </div> : <div className="public-magazine-empty">No PDF editions are available in the shared folder right now.</div>}
              <a className="public-news-note" href={magazineFolderUrl} target="_blank" rel="noreferrer"><Buildings size={18} /><span>Browse all IZIAR editions in Drive</span><ArrowUpRight size={15} /></a>
            </div>
          </div>
        </div>
      </section>

      <section className="public-bottom-cta">
        <div className="public-story-shell"><span>YOUR NEXT STEP STARTS HERE</span><h2>Learn. Connect. Grow.</h2><p>Explore career programs, placement updates, and IPCS industry partnerships.</p><Link className="portal-primary-button" to="/placements">Explore placements <ArrowRight size={18} /></Link></div>
      </section>
      </>}

      {['vacancies', 'hiring'].includes(page) && <section className="public-vacancies-section" id="vacancies">
        <div className="public-story-shell">
          <SectionHeading eyebrow="Career opportunities" title="Current Vacancies" description="Browse current open opportunities shared with IPCS Global, with each role’s company and location in one place." />
          {vacanciesLoading ? <div className="public-vacancy-grid" aria-label="Loading vacancies">{[1, 2, 3, 4].map(item => <div className="public-vacancy-skeleton" key={item} />)}</div>
            : vacanciesError ? <div className="public-vacancy-empty" role="status">Current vacancies are temporarily unavailable. Please check back soon.</div>
              : visibleVacancies.length === 0 ? <div className="public-vacancy-empty">There are no active openings at the moment. New opportunities will appear here as they are shared.</div>
                : <div className="public-vacancy-grid">{visibleVacancies.map((vacancy, index) => {
                  const logo = logoSource(vacancy.companyLogo);
                  const companyInitials = String(vacancy.company || 'IP').trim().split(/\s+/).slice(0, 2).map(word => word[0]?.toUpperCase()).join('');
                  const isExpired = String(vacancy.status || '').toLowerCase() === 'expired';
                  return <article className="public-vacancy-card" key={`${vacancy.id || 'opening'}-${index}`}>
                    <div className="public-vacancy-company">
                      <div className="public-vacancy-logo"><span>{companyInitials || 'IP'}</span>{logo && <img src={logo} alt={`${vacancy.company} logo`} loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} />}</div>
                      <div className="public-vacancy-company-copy"><span className="public-vacancy-label">Hiring Company</span><h3 title={vacancy.company}>{vacancy.company}</h3></div>
                      <span className={`public-vacancy-status ${isExpired ? 'expired' : 'open'}`}>{isExpired ? 'Expired' : 'Open'}</span>
                    </div>
                    <h4>{vacancy.position}</h4>
                    <div className="public-vacancy-details">
                      {vacancy.location && <span><Buildings size={16} /><span>{vacancy.location}</span></span>}
                      {vacancy.mode && <span><Briefcase size={16} /><span>{vacancy.mode}</span></span>}
                    </div>
                    {vacancy.lastDate && <div className="public-vacancy-deadline">{isExpired ? 'Closed on' : 'Apply by'} <strong>{formatPortalDate(vacancy.lastDate, vacancy.lastDate)}</strong></div>}
                  </article>;
                })}</div>}
        </div>
      </section>}
      {corporateInquiryOpen && <CorporateTrainingInquiryModal onClose={() => setCorporateInquiryOpen(false)} />}
      {selectedVideo && createPortal(<div className="public-video-modal" role="presentation" onClick={event => { if (event.target === event.currentTarget) setSelectedVideo(null); }}>
        <section className="public-video-dialog" role="dialog" aria-modal="true" aria-label={selectedVideo.name}>
          <header><div><span>{selectedVideo.folder || 'IPCS MEDIA'}</span><h2>{selectedVideo.name}</h2></div><button type="button" onClick={() => setSelectedVideo(null)} aria-label="Close video"><X size={21} /></button></header>
          {videoPlaybackError ? <iframe src={`https://drive.google.com/file/d/${encodeURIComponent(selectedVideo.id)}/preview`} title={selectedVideo.name} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen /> : <video src={`${API_BASE}${selectedVideo.imageUrl}`} poster={videoThumbnail(selectedVideo)} controls playsInline preload="metadata" aria-label={selectedVideo.name} onError={() => setVideoPlaybackError(true)} />}
        </section>
      </div>, document.body)}
      {corporatePhotoGalleryOpen && createPortal(<div className="public-corporate-gallery-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setCorporatePhotoGalleryOpen(false); }}>
        <section className="public-corporate-gallery-dialog" role="dialog" aria-modal="true" aria-label="Corporate training photo gallery">
          <header><div><span>BHUTAN POLICE &amp; MILITARY</span><h2>{activeCorporatePhotoIndex === null ? 'Training photo gallery' : corporateTrainingPhotos[activeCorporatePhotoIndex].group}</h2><p>{activeCorporatePhotoIndex === null ? `${corporateTrainingPhotos.length} event photos` : `Photo ${activeCorporatePhotoIndex + 1} of ${corporateTrainingPhotos.length}`}</p></div><button type="button" onClick={() => setCorporatePhotoGalleryOpen(false)} aria-label="Close photo gallery"><X size={21} /></button></header>
          {activeCorporatePhotoIndex === null
            ? <div className="public-corporate-gallery-grid">{corporateTrainingPhotos.map((photo, index) => <button type="button" className="public-corporate-gallery-thumb" onClick={() => setActiveCorporatePhotoIndex(index)} key={`${photo.group}-${photo.name}`} aria-label={`Open ${photo.group} photo ${photo.index + 1}`}><img src={photo.src} alt={`IPCS Global ${photo.group} BMS training event`} loading="lazy" onError={event => { event.currentTarget.closest('.public-corporate-gallery-thumb')?.classList.add('is-unavailable'); }} /><span>{photo.label}</span></button>)}</div>
            : <div className="public-corporate-gallery-viewer"><button type="button" className="public-corporate-gallery-nav" onClick={() => setActiveCorporatePhotoIndex((activeCorporatePhotoIndex + corporateTrainingPhotos.length - 1) % corporateTrainingPhotos.length)} aria-label="Previous photo"><ArrowRight size={20} /></button><figure><img src={corporateTrainingPhotos[activeCorporatePhotoIndex].src} alt={`IPCS Global ${corporateTrainingPhotos[activeCorporatePhotoIndex].group} BMS training event`} /><figcaption>{corporateTrainingPhotos[activeCorporatePhotoIndex].label}</figcaption></figure><button type="button" className="public-corporate-gallery-nav next" onClick={() => setActiveCorporatePhotoIndex((activeCorporatePhotoIndex + 1) % corporateTrainingPhotos.length)} aria-label="Next photo"><ArrowRight size={20} /></button><button type="button" className="public-corporate-gallery-back" onClick={() => setActiveCorporatePhotoIndex(null)}>All photos</button></div>}
        </section>
      </div>, document.body)}
    </div>
  );
}
