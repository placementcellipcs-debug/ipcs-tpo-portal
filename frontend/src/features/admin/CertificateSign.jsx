import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { CircleNotch, WarningCircle, CheckCircle } from '@phosphor-icons/react';
import { API_BASE } from '../../services/apiConfig';
import { formatPortalDate } from '../../utils/dateFormat';

// 🚨 IMPORTING THE IMAGES DIRECTLY FROM THE SRC FOLDER
import ipcsLogo from '../../assets/brand/ipcs-logo.png';
import ipcsSignature from '../../assets/brand/ipcs-signature.png';

const KNOWN_SIGNING_API_HOSTS = new Set([
  'api-placement.ipcstalenzo.com',
  'api-placement.ipcsglobal.info',
  'api-talenzo.ipcsglobal.info',
  // MOU requests made from the test portal can carry this API in their link.
  // Accept this one fixed Render host in production so the signing page looks
  // up the token in the same backend that issued it.
  'ipcs-tpo-portal-u0l6.onrender.com'
]);

const normalizeTrustedSigningApiBase = value => {
  if (typeof window === 'undefined') return '';
  const rawValue = String(value || '').trim();
  if (!rawValue) return '';
  try {
    const candidate = new URL(rawValue, window.location.origin);
    const host = candidate.hostname.toLowerCase();
    const configuredOrigin = new URL(API_BASE, window.location.origin).origin;
    const isLocalFrontend = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    const isLocalConfiguredApi = candidate.origin === configuredOrigin && isLocalFrontend && ['localhost', '127.0.0.1'].includes(host);
    const isDevelopmentRenderApi = isLocalFrontend && candidate.protocol === 'https:' && host.endsWith('.onrender.com');
    if ((candidate.protocol === 'https:' && (host.endsWith('.ipcsglobal.info') || KNOWN_SIGNING_API_HOSTS.has(host) || isDevelopmentRenderApi)) || isLocalConfiguredApi) return candidate.origin;
  } catch { /* Ignore invalid or untrusted service URLs. */ }
  return '';
};

const getSigningApiCandidates = () => {
  if (typeof window === 'undefined') return [API_BASE];
  const requestedApi = new URLSearchParams(window.location.search).get('api');
  const requestedApiBase = normalizeTrustedSigningApiBase(requestedApi);
  // Links created by the portal carry the API that issued the signing token.
  // Placement and Talenzo APIs can use different sheets and signing keys, so
  // querying another service after a definitive response can mask the real result.
  if (requestedApiBase) return [requestedApiBase];

  const candidates = [
    API_BASE,
    'https://ipcs-tpo-portal-u0l6.onrender.com',
    'https://api-placement.ipcsglobal.info',
    'https://api-talenzo.ipcsglobal.info'
  ].map(normalizeTrustedSigningApiBase).filter(Boolean);
  return [...new Set(candidates)];
};

function MouPdfPage({ pageNumber, isPreparing, children }) {
  return (
    <section
      data-mou-pdf-page
      style={{
        width: isPreparing ? '794px' : 'min(794px, calc(100vw - 40px))',
        minHeight: '1123px',
        boxSizing: 'border-box',
        flex: '0 0 auto',
        padding: '56px 62px 66px',
        background: '#fff',
        color: '#000',
        boxShadow: '0 16px 36px rgba(15, 23, 42, 0.14)',
        position: 'relative',
        fontSize: '15px',
        lineHeight: '1.55',
        fontFamily: 'Georgia, "Times New Roman", serif',
        textAlign: 'left'
      }}
    >
      <img
        src="https://lh3.googleusercontent.com/d/1dr27VR3Xu8EwDf4dCAO1ucq441VjpfwB"
        crossOrigin="anonymous"
        alt=""
        aria-hidden="true"
        style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '70%', opacity: 0.06, zIndex: 0, pointerEvents: 'none' }}
      />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
      <div style={{ position: 'absolute', left: 62, right: 62, bottom: 28, borderTop: '1px solid #e2e8f0', paddingTop: 8, color: '#64748b', fontFamily: 'Arial, sans-serif', fontSize: 10, display: 'flex', justifyContent: 'space-between' }}>
        <span>IPCS Global · Hiring Partnership Confirmation</span>
        <span>Page {pageNumber} of 3</span>
      </div>
    </section>
  );
}

export default function CertificateSign() {
  const { id } = useParams();
  const [signingApiBase, setSigningApiBase] = useState(() => getSigningApiCandidates()[0] || API_BASE);
  const certificateRef = useRef(null);
  
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Editable Form Fields
  const [employerName, setEmployerName] = useState('');
  const [employerDesig, setEmployerDesig] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [gstin, setGstin] = useState('');

  // File states
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [sigPreview, setSigPreview] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [completionEmailSent, setCompletionEmailSent] = useState(true);
  const [completionEmailQueued, setCompletionEmailQueued] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState('');
  const [previewPdfBlob, setPreviewPdfBlob] = useState(null);

  const currentDate = formatPortalDate(new Date());

  useEffect(() => () => {
    if (previewPdfUrl) URL.revokeObjectURL(previewPdfUrl);
  }, [previewPdfUrl]);

  useEffect(() => {
    let isCancelled = false;
    const loadAgreement = async () => {
      let lastError = null;
      let lastErrorMessage = '';
      for (const apiBase of getSigningApiCandidates()) {
        try {
          const response = await axios.get(`${apiBase}/api/public/mou/${encodeURIComponent(id)}`, {
            timeout: 7000
          });
          if (!response.data?.success || !response.data?.client) {
            lastErrorMessage = response.data?.message || 'Agreement details were not found on this service.';
            lastError = new Error(lastErrorMessage);
            continue;
          }
          if (isCancelled) return;
          setSigningApiBase(apiBase);
          setClient(response.data.client);
          setEmployerName(response.data.client.contactPerson || '');

          if (response.data.client.logo && typeof response.data.client.logo === 'string') {
            const match = response.data.client.logo.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
            if (match) setLogoPreview(`https://lh3.googleusercontent.com/d/${match[1]}`);
            else setLogoPreview(response.data.client.logo);
          }
          return;
        } catch (requestError) {
          lastError = requestError;
          lastErrorMessage = requestError.response?.data?.message || requestError.message;
          console.warn(`MOU lookup did not succeed on ${apiBase}:`, lastErrorMessage);
        }
      }
      if (!isCancelled) {
        const isNetworkFailure = !lastError?.response && lastError?.message === 'Network Error';
        setError(isNetworkFailure
          ? 'The signing page could not connect to the service that issued this link. Please refresh once; if it still fails, ask IPCS to resend the MOU link.'
          : lastErrorMessage || lastError?.response?.data?.message || "We couldn't load the agreement details. Please contact IPCS to request a new signing link.");
      }
    };

    loadAgreement().finally(() => { if (!isCancelled) setLoading(false); });
    return () => { isCancelled = true; };
  }, [id]);

  const handleImageUpload = (e, setPreviewFunc, setFileState) => {
    const file = e.target.files[0];
    if (file) {
      if (setFileState) setFileState(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreviewFunc(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const generatePdfPreview = async () => {
    if (!logoPreview || !sigPreview || !employerName || !employerDesig || !companyAddress) {
      return alert("Please complete all required fields (Address, Logo, Signature, Name, and Designation) before submitting.");
    }

    setIsSubmitting(true);
    try {
      const [html2canvasModule, jspdfModule] = await Promise.all([
        import('html2canvas'),
        import('jspdf')
      ]);
      const html2canvas = html2canvasModule.default || html2canvasModule;
      const JsPDF = jspdfModule.jsPDF;
      await new Promise(resolve => setTimeout(resolve, 300));
      await document.fonts?.ready;
      const pageElements = [...(certificateRef.current?.querySelectorAll('[data-mou-pdf-page]') || [])];
      if (pageElements.length !== 3) throw new Error('The agreement pages could not be prepared. Please refresh and try again.');
      await Promise.all([...certificateRef.current.querySelectorAll('img')].map(image => new Promise(resolve => {
        if (image.complete) return resolve();
        const timeout = setTimeout(resolve, 3000);
        const finish = () => { clearTimeout(timeout); resolve(); };
        image.addEventListener('load', finish, { once: true });
        image.addEventListener('error', finish, { once: true });
      })));
      const pdf = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      for (const [index, pageElement] of pageElements.entries()) {
        const canvas = await html2canvas(pageElement, {
          scale: 1.75,
          useCORS: true,
          backgroundColor: '#ffffff',
          allowTaint: false,
          logging: false
        });
        const imageData = canvas.toDataURL('image/jpeg', 0.92);
        if (index > 0) pdf.addPage('a4', 'portrait');
        const maxWidth = pageWidth - margin * 2;
        const maxHeight = pageHeight - margin * 2;
        const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
        const width = canvas.width * scale;
        const height = canvas.height * scale;
        pdf.addImage(imageData, 'JPEG', (pageWidth - width) / 2, margin, width, height, undefined, 'FAST');
      }
      const pdfBlob = pdf.output('blob');
      const objectUrl = URL.createObjectURL(pdfBlob);
      setPreviewPdfUrl(objectUrl);
      setPreviewPdfBlob(pdfBlob);
    } catch (error) {
      console.error('MOU PDF preview failed:', error);
      alert(`Could not prepare the agreement preview: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitPreviewedPDF = async () => {
    if (!previewPdfBlob) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('certificatePdf', previewPdfBlob, `${client.companyName}_Agreement.pdf`);
      if (logoFile) formData.append('logoFile', logoFile); 

      formData.append('signingToken', id);

      const res = await axios.post(`${signingApiBase}/api/tpo/clients/submit-mou`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      if(res.data.success) {
        setCompletionEmailSent(res.data.emailSent !== false);
        setCompletionEmailQueued(res.data.emailQueued === true);
        setPreviewPdfUrl('');
        setPreviewPdfBlob(null);
        setIsSuccess(true);
      }
    } catch (error) {
      console.error(error);
      alert(`Submission Error: ${error.response?.data?.message || error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Dynamic Input Style: The border vanishes completely when isSubmitting is true
  const inputStyle = {
    flex: 1, 
    border: 'none', 
    borderBottom: isSubmitting ? '1px solid transparent' : '1px dashed #94a3b8', 
    outline: 'none', 
    background: 'transparent', 
    fontSize: '15px', 
    fontFamily: 'inherit', 
    color: '#000000', 
    padding: '2px 0',
    transition: 'border-color 0.2s'
  };

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#026fc2' }}>
      <CircleNotch size={50} className="ph-spin" />
      <p style={{ marginTop: '15px', color: '#333', fontWeight: 'bold' }}>Loading Agreement Data...</p>
    </div>
  );
  
  if (error || !client) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#ef4444' }}>
      <WarningCircle size={60} weight="fill" style={{ marginBottom: '20px' }}/>
      <h2>{error || "Client Data Missing"}</h2>
    </div>
  );

  if (client.documentStatus === 'Completed' || isSuccess) return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#333', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', textAlign: 'center' }}>
      <CheckCircle size={80} color="#10b981" weight="fill" style={{ marginBottom: '20px' }} />
      <h1 style={{ color: '#0f172a', marginBottom: '10px' }}>Agreement Successfully Signed</h1>
      <p style={{ color: '#475569', fontSize: '1.1rem' }}>{completionEmailQueued ? 'Thank you for partnering with IPCS Global. Your signed agreement has been saved, and the email notification is queued for delivery.' : isSuccess && !completionEmailSent ? 'Thank you for partnering with IPCS Global. Your signed agreement has been saved, but the email notification could not be sent. Please contact IPCS for your final copy.' : 'Thank you for partnering with IPCS Global. Your agreement has been submitted. Please contact IPCS if you need another copy.'}</p>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#e2e8f0', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px', fontFamily: '"Segoe UI", Arial, sans-serif' }}>
      
      {!isSubmitting && (
        <div style={{ background: '#fff', padding: '15px 30px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '30px', textAlign: 'center', maxWidth: '800px' }}>
          <h3 style={{ margin: '0 0 10px 0', color: '#0f172a' }}>Please complete your details</h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>Fill in your Company Address, GSTIN, and Designation. Then upload your Logo and Signature at the bottom before submitting.</p>
        </div>
      )}

      {/* Three fixed-width pages are rendered as standard A4 sheets in the PDF. */}
      <div ref={certificateRef} style={{ width: '100%', maxWidth: '794px', overflowX: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24 }}>
        <MouPdfPage pageNumber={1} isPreparing={isSubmitting}>
          <div style={{ marginBottom: 24 }}>
            <p style={{ margin: '0 0 12px' }}><strong>Date:</strong> {currentDate}</p>
            <p style={{ margin: '0 0 5px' }}><strong>To,</strong></p>
            <p style={{ margin: '0 0 5px', fontWeight: 'bold', fontSize: 18 }}>{client.companyName}</p>
            {isSubmitting ? (
              <div style={{ width: 350, marginBottom: 8, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', lineHeight: 1.5, padding: '2px 0', color: '#000' }}>{companyAddress}</div>
            ) : (
              <textarea placeholder="[Enter Company Address]" value={companyAddress} onChange={event => setCompanyAddress(event.target.value)} style={{ ...inputStyle, width: 350, display: 'block', marginBottom: 8, resize: 'vertical', minHeight: 65 }} />
            )}
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, width: 350 }}><strong>GSTIN:</strong><input type="text" placeholder={isSubmitting ? '' : '[Enter GSTIN]'} value={gstin} onChange={event => setGstin(event.target.value)} style={{ ...inputStyle, marginLeft: 8 }} /></div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, width: 350 }}><strong>Kind Attn:</strong><input type="text" placeholder={isSubmitting ? '' : '[Authorized Person]'} value={employerName} onChange={event => setEmployerName(event.target.value)} style={{ ...inputStyle, marginLeft: 8 }} /></div>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8, width: 350 }}><strong>Designation:</strong><input type="text" placeholder={isSubmitting ? '' : '[Enter Designation]'} value={employerDesig} onChange={event => setEmployerDesig(event.target.value)} style={{ ...inputStyle, marginLeft: 8 }} /></div>
          </div>

          <h3 style={{ textAlign: 'center', margin: '22px 0', fontSize: 19, fontWeight: 'bold', color: '#000', letterSpacing: '0.5px' }}>Hiring Partnership Confirmation - IPCS Global</h3>
          <p style={{ margin: '0 0 10px' }}>Dear Sir/Madam,</p>
          <p style={{ margin: '0 0 15px' }}>Greetings from IPCS Global.</p>
          <p style={{ margin: '0 0 15px' }}>We are pleased to establish <strong>{client.companyName}</strong> as a Hiring Partner of IPCS Global for sourcing and recruiting skilled and trained candidates from our institution based on your organization's manpower requirements.</p>
          <p style={{ margin: '0 0 22px' }}>As part of this association, IPCS Global will coordinate with your organization and facilitate suitable candidate profiles based on the job roles, eligibility criteria, skills and recruitment requirements communicated by your HR/Recruitment team.</p>
          <h4 style={{ fontSize: 16, margin: '0 0 10px', textDecoration: 'underline', fontWeight: 'bold' }}>Scope of Hiring Partnership</h4>
          <ol style={{ paddingLeft: 25, margin: '0 0 12px' }}>
            <li style={{ marginBottom: 8 }}><strong>Candidate Sourcing:</strong> IPCS Global will share suitable candidate profiles based on the requirements communicated by the employer.</li>
            <li style={{ marginBottom: 8 }}><strong>Recruitment Requirements:</strong> The employer will communicate current and future vacancies, job descriptions, eligibility criteria, salary range and other relevant requirements to IPCS Global.</li>
            <li style={{ marginBottom: 8 }}><strong>Candidate Selection:</strong> Final selection, interview, salary negotiation and appointment of candidates shall remain entirely at the discretion of the employer.</li>
            <li style={{ marginBottom: 8 }}><strong>Placement Assistance:</strong> IPCS Global will provide placement coordination and candidate support; however, placement or employment shall not be considered guaranteed unless specifically confirmed by the employer.</li>
            <li style={{ marginBottom: 8 }}><strong>Candidate Information:</strong> Candidate profiles shared by IPCS Global shall be used solely for recruitment and employment purposes.</li>
          </ol>
        </MouPdfPage>

        <MouPdfPage pageNumber={2} isPreparing={isSubmitting}>
          <h4 style={{ fontSize: 16, margin: '0 0 16px', textDecoration: 'underline', fontWeight: 'bold' }}>Conditions of Hiring Partnership</h4>
          <ol style={{ paddingLeft: 25, margin: 0 }}>
            <li style={{ marginBottom: 10 }}><strong>Direct Communication:</strong> The employer agrees to maintain proper communication with the designated IPCS Global Placement/Corporate Relations representative regarding recruitment requirements and interview schedules.</li>
            <li style={{ marginBottom: 10 }}><strong>Interview &amp; Selection Updates:</strong> The employer is requested to provide timely updates regarding interview results, candidate selection and joining status to enable IPCS Global to maintain accurate placement records.</li>
            <li style={{ marginBottom: 10 }}><strong>Recruitment Information:</strong> The employer shall provide accurate information regarding job role, location, working hours, salary/CTC, eligibility criteria and other relevant employment conditions before commencing recruitment.</li>
            <li style={{ marginBottom: 10 }}><strong>No Candidate Guarantee:</strong> IPCS Global does not guarantee that every recruitment requirement will result in a successful placement. Candidate selection shall be based on the employer's recruitment process and requirements.</li>
            <li style={{ marginBottom: 10 }}><strong>Confidentiality:</strong> Both parties shall maintain confidentiality regarding candidate information, company information and other sensitive recruitment-related information shared during the association.</li>
            <li style={{ marginBottom: 10 }}><strong>Non-Exclusivity:</strong> This hiring partnership is non-exclusive unless otherwise agreed upon in writing by both parties.</li>
            <li style={{ marginBottom: 10 }}><strong>No Charges to Students Without Prior Knowledge of IPCS:</strong> The employer shall not collect any recruitment, hiring, training, or related charges from candidates referred through IPCS Global without the prior knowledge and approval of IPCS Global. Any proposed fee or charge to a student must be communicated to and mutually acknowledged by IPCS Global in advance.</li>
            <li style={{ marginBottom: 10 }}><strong>Offer Acceptance:</strong> After receiving an offer letter, the candidate has the complete freedom to accept or reject the offer. IPCS Global will not be responsible for the candidate's decision.</li>
            <li style={{ marginBottom: 10 }}><strong>Non-Joining:</strong> If a selected candidate does not join the organization after accepting the offer letter, IPCS Global will not be responsible for the same.</li>
            <li style={{ marginBottom: 10 }}><strong>Replacement:</strong> If a candidate joins and leaves the organization after days or months, IPCS Global will not be responsible for providing a replacement. Suitable candidates will be shared if available and interested.</li>
            <li style={{ marginBottom: 10 }}><strong>Mutual Understanding:</strong> This document represents a mutual understanding between IPCS Global and the employer and is not a legal or commercial agreement.</li>
            <li style={{ marginBottom: 10 }}><strong>Future Requirements:</strong> IPCS Global will continue to support the employer's future hiring requirements by sharing suitable candidates whenever available.</li>
          </ol>
        </MouPdfPage>

        <MouPdfPage pageNumber={3} isPreparing={isSubmitting}>
          <h4 style={{ fontSize: 16, margin: '0 0 10px', textDecoration: 'underline', fontWeight: 'bold' }}>Acknowledgement</h4>
          <p style={{ margin: '0 0 36px' }}>We, <strong>{client.companyName}</strong>, hereby acknowledge the above Hiring Partnership terms and express our willingness to collaborate with IPCS Global for our current and future recruitment requirements.</p>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 28, marginTop: 42 }}>
            <div style={{ width: '48%' }}>
              <p style={{ fontWeight: 'bold', margin: '0 0 12px', fontSize: 16 }}>{client.companyName}</p>
              <div style={{ height: 84, marginBottom: 8, display: 'flex', alignItems: 'flex-start' }}>
                {sigPreview ? <img src={sigPreview} style={{ maxHeight: 80, maxWidth: 240, objectFit: 'contain' }} crossOrigin="anonymous" alt="Company signature" /> : (
                  <label style={{ background: '#f8fafc', color: '#334155', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12, border: '1px dashed #cbd5e1', display: isSubmitting ? 'none' : 'inline-block' }}>
                    Upload Signature<input type="file" accept="image/*" onChange={event => handleImageUpload(event, setSigPreview, null)} style={{ display: 'none' }} />
                  </label>
                )}
              </div>
              <p style={{ margin: '0 0 5px' }}><strong>Authorized Signatory:</strong></p>
              <p style={{ margin: '0 0 5px' }}>Name: {employerName || '__________________'}</p>
              <p style={{ margin: '0 0 12px' }}>Designation: {employerDesig || '__________________'}</p>
              <p style={{ margin: '0 0 12px' }}>Email: {client.email}</p>
              <div style={{ height: 78, display: 'flex', alignItems: 'flex-start' }}>
                {logoPreview ? <img src={logoPreview} style={{ maxHeight: 78, maxWidth: 240, objectFit: 'contain' }} crossOrigin="anonymous" alt="Company logo" onError={event => { event.target.style.display = 'none'; setLogoPreview(''); }} /> : (
                  <label style={{ background: '#f8fafc', color: '#334155', padding: '6px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12, border: '1px dashed #cbd5e1', display: isSubmitting ? 'none' : 'inline-block' }}>
                    Upload Company Logo<input type="file" accept="image/*" onChange={event => handleImageUpload(event, setLogoPreview, setLogoFile)} style={{ display: 'none' }} />
                  </label>
                )}
              </div>
            </div>

            <div style={{ width: '48%' }}>
              <p style={{ fontWeight: 'bold', margin: '0 0 12px', fontSize: 16 }}>IPCS Global</p>
              <div style={{ height: 84, marginBottom: 8, display: 'flex', alignItems: 'flex-start' }}><img src={ipcsSignature} alt="IPCS Signature" style={{ maxHeight: 80, maxWidth: 240, objectFit: 'contain' }} /></div>
              <p style={{ margin: '0 0 5px' }}><strong>Authorized Signatory:</strong></p>
              <p style={{ margin: '0 0 5px' }}>Name: Gifty KP</p>
              <p style={{ margin: '0 0 12px' }}>Designation: Zonal Manager - Placements</p>
              <p style={{ margin: '0 0 12px' }}>Email: gifty@ipcsglobal.com</p>
              <div style={{ height: 78, display: 'flex', alignItems: 'flex-start' }}><img src={ipcsLogo} alt="IPCS Logo" style={{ maxHeight: 78, maxWidth: 240, objectFit: 'contain' }} /></div>
            </div>
          </div>
        </MouPdfPage>
      </div>

      {previewPdfUrl ? (
        <div role="dialog" aria-modal="true" aria-labelledby="mou-preview-title" style={{ position: 'fixed', inset: 0, zIndex: 1000, padding: 20, background: 'rgba(15,23,42,.78)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ width: 'min(1100px, 100%)', height: 'min(900px, 100%)', background: '#fff', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <header style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid #e2e8f0', color: '#0f172a' }}>
              <div><h2 id="mou-preview-title" style={{ margin: 0, fontSize: 18 }}>Review your signed agreement</h2><p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>A4 PDF · 3 pages · Check all pages before final submission.</p></div>
              <button type="button" onClick={() => { setPreviewPdfUrl(''); setPreviewPdfBlob(null); }} disabled={isSubmitting} style={{ border: 0, background: 'transparent', color: '#334155', fontSize: 24, cursor: 'pointer' }} aria-label="Close preview">×</button>
            </header>
            <iframe src={previewPdfUrl} title="Signed agreement PDF preview" style={{ flex: 1, width: '100%', border: 0, background: '#e2e8f0' }} />
            <footer style={{ padding: 14, display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #e2e8f0' }}>
              <button type="button" onClick={() => { setPreviewPdfUrl(''); setPreviewPdfBlob(null); }} disabled={isSubmitting} style={{ padding: '10px 16px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#334155', cursor: 'pointer' }}>Back to edit</button>
              <button type="button" onClick={submitPreviewedPDF} disabled={isSubmitting} style={{ padding: '10px 18px', border: 0, borderRadius: 8, background: '#026fc2', color: '#fff', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                {isSubmitting ? <><CircleNotch size={18} className="ph-spin" /> Submitting…</> : 'Confirm & submit signed agreement'}
              </button>
            </footer>
          </div>
        </div>
      ) : (
        <button onClick={generatePdfPreview} disabled={isSubmitting} style={{ marginTop: 24, marginBottom: 20, background: '#026fc2', color: '#fff', padding: '15px 36px', fontSize: '1.05rem', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          {isSubmitting ? <><CircleNotch size={22} className="ph-spin" /> Preparing PDF…</> : 'Preview signed agreement'}
        </button>
      )}

    </div>
  );
}
