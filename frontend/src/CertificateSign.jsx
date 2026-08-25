import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { CircleNotch, WarningCircle, CheckCircle } from '@phosphor-icons/react';

// 🚨 IMPORTING THE IMAGES DIRECTLY FROM THE SRC FOLDER
import ipcsLogo from './ipcs-logo.png';
import ipcsSignature from './ipcs-signature.png';

export default function CertificateSign() {
  const { id } = useParams();
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

  const currentDate = new Date().toLocaleDateString('en-GB'); // DD/MM/YYYY

  useEffect(() => {
    axios.get(`https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/clients/${id}`)
      .then(res => {
        if (res.data.success) {
          setClient(res.data.client);
          setEmployerName(res.data.client.contactPerson || '');
          
          if (res.data.client.logo && typeof res.data.client.logo === 'string') {
            const match = res.data.client.logo.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
            if (match) setLogoPreview(`https://drive.google.com/thumbnail?id=${match[1]}&sz=w400`);
          }
        }
      })
      .catch(err => {
        console.error(err);
        setError("We couldn't find the agreement details for this link.");
      })
      .finally(() => setLoading(false));
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

  const generateAndSubmitPDF = async () => {
    if (!logoPreview || !sigPreview || !employerName || !employerDesig || !companyAddress) {
      return alert("Please complete all required fields (Address, Logo, Signature, Name, and Designation) before submitting.");
    }
    
    // 🚨 Trigger state to hide all dotted lines BEFORE taking the picture
    setIsSubmitting(true);

    try {
      // Wait 300 milliseconds for React to erase the borders from the screen
      await new Promise(resolve => setTimeout(resolve, 300));

      const canvas = await html2canvas(certificateRef.current, { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: '#ffffff',
        allowTaint: true 
      });
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      
      pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
      const pdfBlob = pdf.output('blob');

      const formData = new FormData();
      formData.append('certificatePdf', pdfBlob, `${client.companyName}_Agreement.pdf`);
      if (logoFile) formData.append('logoFile', logoFile); 

      formData.append('rowNumber', client.rowNumber);
      formData.append('companyName', client.companyName);
      formData.append('companyEmail', client.email);

      const res = await axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/clients/submit-mou', formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      if(res.data.success) setIsSuccess(true);
    } catch (error) {
      console.error(error);
      alert(`Submission Error: ${error.response?.data?.message || error.message}`);
      setIsSubmitting(false); // Only reset if it fails, otherwise keep lines hidden
    }
  };

  // 🚨 Dynamic Input Style: The border vanishes completely when isSubmitting is true
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
      <p style={{ color: '#475569', fontSize: '1.1rem' }}>Thank you for partnering with IPCS Global. A final copy of your agreement has been emailed to you and the file is now securely locked.</p>
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

      {/* 🚨 PROFESSIONAL CONTRACT CONTAINER */}
      <div 
        ref={certificateRef} 
        style={{ 
          width: '850px', 
          background: '#ffffff', 
          padding: '80px', 
          color: '#000000', 
          boxShadow: '0 20px 40px rgba(0,0,0,0.1)', 
          position: 'relative', 
          fontSize: '15px', 
          lineHeight: '1.8', 
          fontFamily: '"Georgia", "Times New Roman", serif', 
          textAlign: 'justify',
          overflow: 'hidden'
        }}
      >
        
        {/* 🚨 THE WATERMARK FIX: Rendered as a true image for html2canvas */}
        <img 
          src="https://lh3.googleusercontent.com/d/1dr27VR3Xu8EwDf4dCAO1ucq441VjpfwB" 
          crossOrigin="anonymous" 
          alt="Watermark"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '70%',
            opacity: 0.08,
            zIndex: 0,
            pointerEvents: 'none'
          }} 
        />

        {/* CONTENT LAYER (Sits on top of the watermark) */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ marginBottom: '35px' }}>
            <p style={{ margin: '0 0 15px 0' }}><strong>Date:</strong> {currentDate}</p>
            <p style={{ margin: '0 0 5px 0' }}><strong>To,</strong></p>
            <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', fontSize: '18px' }}>{client.companyName}</p>
            
            <input type="text" placeholder={isSubmitting ? "" : "[Enter Company Address]"} value={companyAddress} onChange={e => setCompanyAddress(e.target.value)} style={{ ...inputStyle, width: '350px', display: 'block', marginBottom: '8px' }} />
            
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', width: '350px' }}>
              <strong>GSTIN:</strong> 
              <input type="text" placeholder={isSubmitting ? "" : "[Enter GSTIN]"} value={gstin} onChange={e => setGstin(e.target.value)} style={{ ...inputStyle, marginLeft: '8px' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', width: '350px' }}>
              <strong>Kind Attn:</strong> 
              <input type="text" placeholder={isSubmitting ? "" : "[Authorized Person]"} value={employerName} onChange={e => setEmployerName(e.target.value)} style={{ ...inputStyle, marginLeft: '8px' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', width: '350px' }}>
              <strong>Designation:</strong> 
              <input type="text" placeholder={isSubmitting ? "" : "[Enter Designation]"} value={employerDesig} onChange={e => setEmployerDesig(e.target.value)} style={{ ...inputStyle, marginLeft: '8px' }} />
            </div>
          </div>

          <h3 style={{ textAlign: 'center', marginBottom: '35px', fontSize: '19px', fontWeight: 'bold', color: '#000000', letterSpacing: '0.5px' }}>
            Hiring Partnership Confirmation - IPCS Global
          </h3>

          <p style={{ marginBottom: '10px' }}>Dear Sir/Madam,</p>
          <p style={{ marginBottom: '15px' }}>Greetings from IPCS Global.</p>
          <p style={{ marginBottom: '15px' }}>We are pleased to establish <strong>{client.companyName}</strong> as a Hiring Partner of IPCS Global for sourcing and recruiting skilled and trained candidates from our institution based on your organization's manpower requirements.</p>
          <p style={{ marginBottom: '25px' }}>As part of this association, IPCS Global will coordinate with your organization and facilitate suitable candidate profiles based on the job roles, eligibility criteria, skills and recruitment requirements communicated by your HR/Recruitment team.</p>

          <h4 style={{ fontSize: '16px', marginBottom: '10px', textDecoration: 'underline', fontWeight: 'bold' }}>Scope of Hiring Partnership</h4>
          <ol style={{ paddingLeft: '25px', marginBottom: '25px' }}>
            <li style={{ marginBottom: '8px' }}><strong>Candidate Sourcing:</strong> IPCS Global will share suitable candidate profiles based on the requirements communicated by the employer.</li>
            <li style={{ marginBottom: '8px' }}><strong>Recruitment Requirements:</strong> The employer will communicate current and future vacancies, job descriptions, eligibility criteria, salary range and other relevant requirements to IPCS Global.</li>
            <li style={{ marginBottom: '8px' }}><strong>Candidate Selection:</strong> Final selection, interview, salary negotiation and appointment of candidates shall remain entirely at the discretion of the employer.</li>
            <li style={{ marginBottom: '8px' }}><strong>Placement Assistance:</strong> IPCS Global will provide placement coordination and candidate support; however, placement or employment shall not be considered guaranteed unless specifically confirmed by the employer.</li>
            <li style={{ marginBottom: '8px' }}><strong>Candidate Information:</strong> Candidate profiles shared by IPCS Global shall be used solely for recruitment and employment purposes.</li>
          </ol>

          <h4 style={{ fontSize: '16px', marginBottom: '10px', textDecoration: 'underline', fontWeight: 'bold' }}>Conditions of Hiring Partnership</h4>
          <ol style={{ paddingLeft: '25px', marginBottom: '25px' }}>
            <li style={{ marginBottom: '8px' }}><strong>Direct Communication:</strong> The employer agrees to maintain proper communication with the designated IPCS Global Placement/Corporate Relations representative regarding recruitment requirements and interview schedules.</li>
            <li style={{ marginBottom: '8px' }}><strong>Interview & Selection Updates:</strong> The employer is requested to provide timely updates regarding interview results, candidate selection and joining status to enable IPCS Global to maintain accurate placement records.</li>
            <li style={{ marginBottom: '8px' }}><strong>Recruitment Information:</strong> The employer shall provide accurate information regarding job role, location, working hours, salary/CTC, eligibility criteria and other relevant employment conditions before commencing recruitment.</li>
            <li style={{ marginBottom: '8px' }}><strong>No Candidate Guarantee:</strong> IPCS Global does not guarantee that every recruitment requirement will result in a successful placement. Candidate selection shall be based on the employer's recruitment process and requirements.</li>
            <li style={{ marginBottom: '8px' }}><strong>Confidentiality:</strong> Both parties shall maintain confidentiality regarding candidate information, company information and other sensitive recruitment-related information shared during the association.</li>
            <li style={{ marginBottom: '8px' }}><strong>Non-Exclusivity:</strong> This hiring partnership is non-exclusive unless otherwise agreed upon in writing by both parties.</li>
            <li style={{ marginBottom: '8px' }}><strong>No Recruitment Fee / Recruitment Charges:</strong> No recruitment fee shall be charged to the employer for candidates sourced through IPCS Global, unless otherwise mutually agreed in writing.</li>
          </ol>

          <h4 style={{ fontSize: '16px', marginBottom: '10px', textDecoration: 'underline', fontWeight: 'bold' }}>Acknowledgement</h4>
          <p style={{ marginBottom: '40px' }}>We, <strong>{client.companyName}</strong>, hereby acknowledge the above Hiring Partnership terms and express our willingness to collaborate with IPCS Global for our current and future recruitment requirements.</p>

          {/* 🚨 ENLARGED & ALIGNED SIGNATURE SECTION */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '50px' }}>
            
            <div style={{ width: '45%' }}>
              <p style={{ fontWeight: 'bold', marginBottom: '15px', fontSize: '16px' }}>{client.companyName}</p>
              
              <div style={{ height: '90px', marginBottom: '10px', display: 'flex', alignItems: 'flex-start' }}>
                {sigPreview ? (
                  <img src={sigPreview} style={{ maxHeight: '85px', maxWidth: '250px', objectFit: 'contain' }} crossOrigin="anonymous" alt="Signature" />
                ) : (
                  <label style={{ background: '#f8fafc', color: '#334155', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', border: '1px dashed #cbd5e1', display: isSubmitting ? 'none' : 'inline-block' }}>
                    Upload Signature
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, setSigPreview, null)} style={{ display: 'none' }} />
                  </label>
                )}
              </div>
              
              <p style={{ margin: '0 0 5px 0' }}><strong>Authorized Signatory:</strong></p>
              <p style={{ margin: '0 0 5px 0' }}>Name: {employerName || '__________________'}</p>
              <p style={{ margin: '0 0 15px 0' }}>Designation: {employerDesig || '__________________'}</p>
              <p style={{ margin: '0 0 15px 0' }}>Email: {client.email}</p>

              {/* 🚨 COMPANY LOGO - Perfect Alignment */}
              <div style={{ height: '85px', display: 'flex', alignItems: 'flex-start' }}>
                {logoPreview ? (
                  <img src={logoPreview} style={{ maxHeight: '85px', maxWidth: '250px', objectFit: 'contain' }} crossOrigin="anonymous" alt="Logo" />
                ) : (
                  <label style={{ background: '#f8fafc', color: '#334155', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', border: '1px dashed #cbd5e1', display: isSubmitting ? 'none' : 'inline-block' }}>
                    Upload Company Logo
                    <input type="file" accept="image/*" onChange={(e) => handleImageUpload(e, setLogoPreview, setLogoFile)} style={{ display: 'none' }} />
                  </label>
                )}
              </div>
            </div>

            <div style={{ width: '45%' }}>
              <p style={{ fontWeight: 'bold', marginBottom: '15px', fontSize: '16px' }}>IPCS Global</p>
              
              <div style={{ height: '90px', marginBottom: '10px', display: 'flex', alignItems: 'flex-start' }}>
                <img src={ipcsSignature} alt="IPCS Signature" style={{ maxHeight: '85px', maxWidth: '250px', objectFit: 'contain' }} /> 
              </div>

              <p style={{ margin: '0 0 5px 0' }}><strong>Authorized Signatory:</strong></p>
              <p style={{ margin: '0 0 5px 0' }}>Name: Gifty KP</p>
              <p style={{ margin: '0 0 15px 0' }}>Designation: Zonal Manager - Placements</p>
              <p style={{ margin: '0 0 15px 0' }}>Email: gifty@ipcsglobal.com</p>

              {/* 🚨 IPCS LOGO - Perfect Alignment */}
              <div style={{ height: '85px', display: 'flex', alignItems: 'flex-start' }}>
                <img src={ipcsLogo} alt="IPCS Logo" style={{ maxHeight: '85px', maxWidth: '250px', objectFit: 'contain' }} />
              </div>
            </div>

          </div>
        </div>
      </div>

      <button onClick={generateAndSubmitPDF} disabled={isSubmitting} style={{ marginTop: '40px', background: '#026fc2', color: '#fff', padding: '15px 50px', fontSize: '1.2rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        {isSubmitting ? <CircleNotch size={24} className="ph-spin" /> : "Submit Partnership Agreement"}
      </button>

    </div>
  );
}