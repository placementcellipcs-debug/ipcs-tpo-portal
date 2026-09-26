import { useEffect, useState } from 'react';
import axios from 'axios';
import { ArrowRight, ArrowUpRight, BookOpenText, Briefcase, Buildings, CheckCircle, Compass, FilePdf, GlobeHemisphereWest, GraduationCap, Handshake, Lightbulb, Megaphone, PlayCircle, Star, Target, UsersThree } from '@phosphor-icons/react';
import { API_BASE } from './apiConfig';
import './PublicSiteSections.css';

const team = [
  {
    name: 'Mr. Ajith Surendran',
    role: 'General Manager',
    bio: 'Mr. Ajith Surendran is a Post Graduate Diploma holder in Marketing Management, with skills in digital marketing, WordPress website development, and design software. He brings a decade of experience in education management and working knowledge across sales, marketing, business development, franchise acquisition, human resources, institutional and corporate alliances, training, and placements. Ajith brings valuable skills to his role and meets challenges with professionalism and a calm, positive approach.'
  },
  {
    name: 'Mr. Rakesh K C',
    role: 'Technical Head',
    bio: 'Mr. Rakesh has been a driving force at IPCS Global since 2014. With a B.Tech degree and PG Diploma from MG University, he brings deep technical knowledge and experience. His path from Project Engineer to Academic Head, Project Manager, Operations Manager, and Technical Head reflects his dedication and practical expertise. He previously worked at NIELIT, Kozhikode, and now oversees critical technical projects and operations.'
  },
  {
    name: 'Mr. Nair Vijin Rajan',
    role: 'Finance Manager',
    bio: 'Mr. Vijin brings more than 13 years of experience in accounts management, financial reporting, client relationships, and operational coordination. He has worked across diagnostics, manufacturing, and project management. His expertise includes receivables and payables, payroll, compliance, and multi-branch finance. He is multilingual and brings a thoughtful, professional approach to the team.'
  },
  {
    name: 'Ms. Rekha P',
    role: 'Human Resource Manager · South Zone',
    bio: 'Ms. Rekha P is an HR and MSW professional with over seven years of experience and a passion for developing people and organizations. As Zonal HR Manager, she leads talent acquisition, employee engagement, leadership development, and performance management across multiple regions. She works with cross-functional teams to align HR initiatives with business goals and build a collaborative culture of continuous learning and innovation.'
  },
  {
    name: 'Ms. Gifty KP',
    role: 'Zonal Placement Manager',
    bio: 'Ms. Gifty has over nine years of experience in the EdTech industry. She began as a Java Trainer, developed expertise in technical instruction and learning methodologies, and later specialized in training excellence and learning management systems. As Zonal Placement Manager, she connects aspiring professionals with career opportunities and helps shape future-ready talent.'
  },
  {
    name: 'Mr. Nowfal Ibrahim',
    role: 'Technical Operations Manager',
    bio: 'Mr. Nowfal Ibrahim holds a Bachelor of Engineering in Electronics and Instrumentation Engineering from Anna University, Chennai, and brings over ten years of experience in smart home automation and technical training. His journey from Project Engineer to Technical Operations Manager reflects a commitment to innovation, leadership, and operational excellence. He is known for his strategic thinking and ability to deliver successful technical projects.'
  }
];

const milestones = [
  { value: '1.5M+', label: 'Trained professionals' },
  { value: '25K+', label: 'Placed professionals' },
  { value: '1,200+', label: 'Industrial projects' },
  { value: '50+', label: 'Presence across countries' },
  { value: '120+', label: 'Corporate partners' }
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

const magazines = [48, 47, 46, 45, 44, 43, 36, 35, 34];

const logoSource = value => {
  if (!value || typeof value !== 'string') return '';
  const match = value.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
  return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : value;
};

function SectionHeading({ eyebrow, title, description, align = 'left' }) {
  return (
    <div className={`public-section-heading align-${align}`}>
      <span className="public-section-eyebrow">{eyebrow}</span>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}

export default function PublicSiteSections({ onLogin }) {
  const [partners, setPartners] = useState([]);
  const [partnersLoading, setPartnersLoading] = useState(true);
  const [partnersError, setPartnersError] = useState(false);

  useEffect(() => {
    let active = true;
    axios.get(`${API_BASE}/api/public/partners`)
      .then(response => {
        if (!active) return;
        if (!response.data?.success) throw new Error('Partner directory unavailable');
        setPartners(Array.isArray(response.data.partners) ? response.data.partners : []);
      })
      .catch(() => { if (active) setPartnersError(true); })
      .finally(() => { if (active) setPartnersLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <div className="public-story">
      <section className="public-about-section" id="about">
        <div className="public-story-shell">
          <SectionHeading
            eyebrow="Who we are"
            title="Technical learning with real-world purpose."
            description="IPCS Global began with industrial automation projects and grew into a technical training and industry solutions organization focused on making practical skills more accessible."
          />
          <div className="public-about-grid">
            <article className="public-about-card public-about-main">
              <div className="public-card-icon"><Compass size={23} weight="duotone" /></div>
              <span className="public-card-kicker">WHY IPCS GLOBAL</span>
              <h3>Training shaped by industry.</h3>
              <p>Established in Kochi in 2008, IPCS expanded from automation projects to technical training, opening its first training centre in Kozhikode in 2009. Today, IPCS serves learners and industries across India, the UAE, and KSA.</p>
              <p>Our work spans process, factory, and machine automation; CNC solutions; building management; energy; IoT; robotics; industrial calibration; and testing. Training programs bring together technical foundations and practical applications.</p>
            </article>
            <div className="public-about-facts">
              <article className="public-fact-card"><span className="public-fact-number">2008</span><span>IPCS Global established in Kochi</span></article>
              <article className="public-fact-card"><span className="public-fact-number">2009</span><span>First training centre opened in Kozhikode</span></article>
              <article className="public-fact-card"><span className="public-fact-number">2014</span><span>ISO certification milestone</span></article>
            </div>
          </div>
          <div className="public-values-row">
            <div><span className="public-value-icon"><Star size={17} weight="fill" /></span><span><b>Our values</b><small>Professional ethics, mutual respect, and team spirit.</small></span></div>
            <div><span className="public-value-icon"><Target size={17} weight="fill" /></span><span><b>Our goal</b><small>Deliver excellent automation solutions and practical learning.</small></span></div>
            <div><span className="public-value-icon"><GlobeHemisphereWest size={17} weight="fill" /></span><span><b>Our reach</b><small>Learning and industry relationships across regions.</small></span></div>
          </div>
        </div>
      </section>

      <section className="public-milestones-section" id="milestones" aria-label="IPCS Global milestones">
        <div className="public-story-shell">
          <div className="public-milestones-intro"><span>IPCS GLOBAL IN NUMBERS</span><h2>Progress built together.</h2></div>
          <div className="public-milestone-grid">
            {milestones.map(item => <article className="public-milestone" key={item.label}><strong>{item.value}</strong><span>{item.label}</span></article>)}
          </div>
        </div>
      </section>

      <section className="public-team-section">
        <div className="public-story-shell">
          <SectionHeading eyebrow="The people behind IPCS" title="Team IPCS" description="Meet the leaders bringing together technical expertise, education, operations, people, and career development." align="center" />
          <div className="public-team-grid">
            {team.map((person, index) => (
              <article className="public-team-card" key={person.name}>
                <div className={`public-team-avatar avatar-${index + 1}`} aria-hidden="true">{person.name.split(' ').filter(part => /^[A-Z]/.test(part) && !['Mr.', 'Ms.'].includes(part)).slice(0, 2).map(part => part[0]).join('')}</div>
                <span className="public-team-role">{person.role}</span>
                <h3>{person.name}</h3>
                <p>{person.bio}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

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
          <div className="public-talentino-card">
            <div className="public-talentino-icon"><Lightbulb size={26} weight="duotone" /></div>
            <div><span className="public-card-kicker">CAREER DEVELOPMENT PROGRAM</span><h3>Talentino</h3><p>A practical program for all students, with personality development, communication skills, group discussions, mock interviews, industry and internship orientation, and interactive activities that build confidence.</p><div className="public-career-program-list">{careerPrograms.map(program => <span key={program}>{program}</span>)}</div></div>
            <button type="button" className="public-inline-link" onClick={onLogin}>Explore the portal <ArrowRight size={17} /></button>
          </div>
          <div className="public-placement-updates">
            <div className="public-subheading"><span>PLACEMENT UPDATES</span><h3>Stories, activities, and opportunities.</h3></div>
            <div className="public-placement-grid">
              {placementHighlights.map(item => {
                const Icon = item.icon;
                return <article className="public-placement-tile" key={item.title}><span className="public-tile-icon"><Icon size={22} weight="duotone" /></span><h4>{item.title}</h4><p>{item.copy}</p><button type="button" onClick={onLogin}>Explore <ArrowUpRight size={15} /></button></article>;
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="public-partners-section" id="partners">
        <div className="public-story-shell">
          <div className="public-partners-heading">
            <SectionHeading eyebrow="Corporate relationships" title="Partners who move opportunity forward." description="Our corporate relationships help connect technical learning with real workplace needs." />
            <a className="public-partner-cta" href="/recruiter?section=mou" target="_blank" rel="noreferrer">Become a partner <ArrowUpRight size={17} /></a>
          </div>
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
                  <span className="public-partner-status"><CheckCircle size={14} weight="fill" /> Signed MOU</span>
                  {partner.mouLink && <a className="public-mou-link" href={partner.mouLink} target="_blank" rel="noopener noreferrer"><FilePdf size={16} weight="fill" /> View signed MOU <ArrowUpRight size={14} /></a>}
                </article>
              ))}
            </div>
          )}
          <p className="public-partners-footnote">Signed MOU PDFs linked here are publicly available. Pending agreements remain in the staff portal.</p>
        </div>
      </section>

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
              <div className="public-magazine-grid">
                {magazines.map((edition, index) => <article className={`public-magazine-card magazine-${index % 4}`} key={edition}><span className="public-magazine-mark">IPCS <i>×</i> IZIAR</span><span className="public-magazine-title">IZIAR</span><span className="public-magazine-edition">E-MAGAZINE <b>EDITION {edition}</b></span></article>)}
              </div>
              <div className="public-news-note"><Buildings size={18} /><span>IPCS Global news and magazine editions</span><ArrowUpRight size={15} /></div>
            </div>
          </div>
        </div>
      </section>

      <section className="public-bottom-cta">
        <div className="public-story-shell"><span>YOUR NEXT STEP STARTS HERE</span><h2>Learn. Connect. Grow.</h2><p>Sign in to continue to the IPCS Global placement and learning portal.</p><button type="button" className="portal-primary-button" onClick={onLogin}>Enter the portal <ArrowRight size={18} /></button></div>
      </section>
    </div>
  );
}
