import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { ArrowRight, ArrowUpRight, BookOpenText, Briefcase, Buildings, CheckCircle, Compass, FilePdf, GlobeHemisphereWest, GraduationCap, Handshake, Lightbulb, Megaphone, PlayCircle, Star, Target, UsersThree, VideoCamera } from '@phosphor-icons/react';
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

export default function PublicSiteSections({ page = 'all' }) {
  const location = useLocation();
  const [partners, setPartners] = useState([]);
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
  const [mediaOpen, setMediaOpen] = useState(true);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [mediaNextOffset, setMediaNextOffset] = useState(null);
  const [mediaTotal, setMediaTotal] = useState(0);
  const partnerListPage = page === 'partners-all';
  const posterGalleryPage = page === 'placement-gallery';
  const partnerMediaPage = page === 'partners-media';
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
  const partnersLoading = ['partners', 'partners-all', 'all'].includes(page) && !partnersLoaded;
  const postersLoading = ['placement', 'placement-gallery', 'all'].includes(page) && !postersLoaded;

  useEffect(() => {
    if (!['partners', 'partners-all', 'all'].includes(page)) return undefined;
    let active = true;
    const limit = partnerListPage ? 100 : 8;
    axios.get(`${API_BASE}/api/public/partners?limit=${limit}&offset=0`)
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
  }, [page, partnerListPage]);

  useEffect(() => {
    if (!['placement', 'placement-gallery', 'all'].includes(page)) return undefined;
    let active = true;
    const limit = posterGalleryPage ? 24 : 6;
    axios.get(`${API_BASE}/api/public/placement-posters?category=posters&limit=${limit}&offset=0`)
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
    axios.get(`${API_BASE}/api/public/placement-posters?category=${encodeURIComponent(placementCategory)}&limit=${mediaPage ? 24 : 6}&offset=0`)
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

  const loadMore = async (kind) => {
    const isPartner = kind === 'partners';
    const isPoster = kind === 'posters';
    const offset = isPartner ? partnerNextOffset : isPoster ? posterNextOffset : mediaNextOffset;
    if (offset === null) return;
    try {
      const category = isPoster ? 'posters' : placementCategory;
      const response = await axios.get(isPartner
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
      {['about', 'all'].includes(page) && <>
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
            <div className="public-recruiter-intro"><span className="public-card-kicker">RECRUITER PARTNERSHIPS · OPEN ACCESS</span><h3>Work with IPCS to meet career-ready talent.</h3><p>Explore the placement program and partnership process here. Recruiters can review public information without creating an account; private MOU signing links are issued directly by IPCS.</p><Link className="public-recruiter-link" to="/partners">Meet our signed partners <ArrowRight size={16} /></Link></div>
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
                    <a className="public-poster-card public-poster-marquee-card" key={`${poster.id}-${index}`} href={`${API_BASE}${poster.imageUrl}`} target="_blank" rel="noreferrer" aria-hidden={index >= posters.length || undefined} tabIndex={index >= posters.length ? -1 : undefined}>
                      <div className="public-poster-image"><img src={`${API_BASE}${poster.imageUrl}`} alt={poster.name} loading="lazy" decoding="async" /><span className="public-poster-open"><ArrowUpRight size={17} /></span></div>
                      <div className="public-poster-meta"><span>{poster.folder}</span><h4>{poster.name}</h4></div>
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <div className="public-poster-grid">
                {posters.map(poster => (
                  <a className="public-poster-card" key={poster.id} href={`${API_BASE}${poster.imageUrl}`} target="_blank" rel="noreferrer">
                    <div className="public-poster-image"><img src={`${API_BASE}${poster.imageUrl}`} alt={poster.name} loading="lazy" decoding="async" /><span className="public-poster-open"><ArrowUpRight size={17} /></span></div>
                    <div className="public-poster-meta"><span>{poster.folder}</span><h4>{poster.name}</h4></div>
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
                    : <div className="public-poster-grid">{mediaItems.map(item => <article className="public-poster-card public-media-card" key={item.id}>
                      {item.mediaType === 'video' ? <div className="public-poster-video"><video src={`${API_BASE}${item.imageUrl}`} controls preload="metadata" playsInline aria-label={item.name} /></div> : <a className="public-poster-image" href={`${API_BASE}${item.imageUrl}`} target="_blank" rel="noreferrer"><img src={`${API_BASE}${item.imageUrl}`} alt={item.name} loading="lazy" decoding="async" /><span className="public-poster-open"><ArrowUpRight size={17} /></span></a>}
                      <div className="public-poster-meta"><span>{item.folder}</span><h4>{item.name}</h4></div>
                    </article>)}</div>}
            {mediaLoaded && mediaItems.length > 0 && !mediaPage && <div className="public-gallery-more"><span>Showing {mediaItems.length} of {mediaTotal} items</span><Link to={`${mediaBasePath}?category=${placementCategory}`}>See all {placementCategory === 'videos' ? 'videos' : 'media'} <ArrowRight size={16} /></Link></div>}
            {mediaPage && mediaLoaded && mediaItems.length > 0 && <div className="public-gallery-more"><span>Showing {mediaItems.length} of {mediaTotal} items</span>{mediaNextOffset !== null && <button type="button" onClick={() => loadMore('media')}>Load more <ArrowRight size={16} /></button>}</div>}
          </div>
        </div>
      </section>
      </>}

      {['partners', 'partners-all', 'all'].includes(page) && <>
      <section className="public-partners-section" id="partners">
        <div className="public-story-shell">
          <div className="public-partners-heading">
            <SectionHeading eyebrow="Corporate relationships" title={partnerListPage ? 'Our complete signed partner directory.' : 'Partners who move opportunity forward.'} description="Our corporate relationships help connect technical learning with real workplace needs." />
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
                  <span className="public-partner-status"><CheckCircle size={14} weight="fill" /> Signed MOU</span>
                  {partner.mouLink && <a className="public-mou-link" href={partner.mouLink} target="_blank" rel="noopener noreferrer"><FilePdf size={16} weight="fill" /> View signed MOU <ArrowUpRight size={14} /></a>}
                </article>
              ))}
            </div>
          )}
          <p className="public-partners-footnote">Signed MOU PDFs linked here are publicly available. Pending agreements remain in the staff portal.</p>
          {!partnerListPage && partnerTotal > partners.length && <div className="public-gallery-more"><span>Showing {partners.length} of {partnerTotal} signed partners</span><Link to="/partners/all">See all partners <ArrowRight size={16} /></Link></div>}
          {partnerListPage && partnerNextOffset !== null && <div className="public-gallery-more"><span>Showing {partners.length} of {partnerTotal} signed partners</span><button type="button" onClick={() => loadMore('partners')}>Load more partners <ArrowRight size={16} /></button></div>}
        </div>
      </section>
      </>}

      {partnerMediaPage && <section className="public-partners-section public-client-media-section">
        <div className="public-story-shell">
          <SectionHeading eyebrow="Clients &amp; partners" title="People and projects behind the partnership." description="Client stories, testimonials, and videos shared from the IPCS creatives Drive folder." />
          <Link className="public-gallery-back" to="/partners">← Back to signed partners</Link>
          <div className="public-media-tabs" role="tablist" aria-label="Client media albums">
            {mediaTabs.map(([key, label]) => <Link key={key} role="tab" aria-selected={placementCategory === key} className={`public-media-tab${placementCategory === key ? ' active' : ''}`} to={`/partners/media?category=${key}`}><VideoCamera size={16} />{label}</Link>)}
          </div>
          {mediaLoading || !mediaLoaded ? <div className="public-poster-grid">{[1, 2, 3].map(item => <div className="public-poster-skeleton" key={item} />)}</div>
            : mediaError ? <div className="public-poster-empty" role="status">Client media could not be loaded. Check the shared Drive folder connection and try again.</div>
              : !mediaItems.length ? <div className="public-poster-empty">No client media has been added yet. Add files to a folder named “{placementCategory === 'client-videos' ? 'Client Videos' : 'Clients'}” inside the shared IPCS creatives folder.</div>
                : <div className="public-poster-grid">{mediaItems.map(item => <article className="public-poster-card public-media-card" key={item.id}>
                  {item.mediaType === 'video' ? <div className="public-poster-video"><video src={`${API_BASE}${item.imageUrl}`} controls preload="metadata" playsInline aria-label={item.name} /></div> : <a className="public-poster-image" href={`${API_BASE}${item.imageUrl}`} target="_blank" rel="noreferrer"><img src={`${API_BASE}${item.imageUrl}`} alt={item.name} loading="lazy" decoding="async" /><span className="public-poster-open"><ArrowUpRight size={17} /></span></a>}
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
              <div className="public-magazine-grid">
                {magazines.map((edition, index) => <article className={`public-magazine-card magazine-${index % 4}`} key={edition}><span className="public-magazine-mark">IPCS <i>×</i> IZIAR</span><span className="public-magazine-title">IZIAR</span><span className="public-magazine-edition">E-MAGAZINE <b>EDITION {edition}</b></span></article>)}
              </div>
              <div className="public-news-note"><Buildings size={18} /><span>IPCS Global news and magazine editions</span><ArrowUpRight size={15} /></div>
            </div>
          </div>
        </div>
      </section>

      <section className="public-bottom-cta">
        <div className="public-story-shell"><span>YOUR NEXT STEP STARTS HERE</span><h2>Learn. Connect. Grow.</h2><p>Explore career programs, placement updates, and IPCS industry partnerships.</p><Link className="portal-primary-button" to="/placements">Explore placements <ArrowRight size={18} /></Link></div>
      </section>
      </>}
    </div>
  );
}
