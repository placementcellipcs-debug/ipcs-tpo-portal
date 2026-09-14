const nodemailer = require('nodemailer');

// 1. CONFIGURE YOUR EMAIL CONNECTION
// Note: You must put your actual email and App Password in your backend's .env file!
const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: process.env.EMAIL_USER, // e.g., 'your-email@ipcsglobal.com'
    pass: process.env.EMAIL_PASS  // Your Gmail 16-character App Password
  }
});

// 2. THE MAIN EMAIL SENDING FUNCTION
const sendStatusUpdateEmail = async (updateData) => {
  // Extract all the data sent from the frontend Job Tracker
  const { status, fullApp, interviewDate, interviewTime, interviewVenue } = updateData;
  
  const studentEmail = fullApp.email;
  const studentName = fullApp.name || 'Student';
  const companyName = fullApp.company || 'our corporate partner';
  const positionName = fullApp.position || 'the requested role';

  // Security check: Don't try to send an email if the student has no email address
  if (!studentEmail || studentEmail === 'N/A' || studentEmail.trim() === '') {
    return;
  }

  let emailSubject = '';
  let emailHtml = '';
  let attachments = [];

  // ========================================================
  // 📧 SCENARIO 1: INTERVIEW SCHEDULED (WITH CALENDAR ATTACHMENT)
  // ========================================================
  if (status === 'Interview Scheduled') {
    emailSubject = `Interview Scheduled: ${companyName}`;
    emailHtml = `
      <div style="font-family: 'Inter', Arial, sans-serif; padding: 30px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #0284c7; margin-bottom: 5px;">Interview Invitation</h2>
        <p style="color: #64748b; margin-top: 0; font-size: 0.9rem;">IPCS Global Placement Cell</p>
        
        <p style="color: #334155; font-size: 1.05rem;">Dear <b>${studentName}</b>,</p>
        <p style="color: #334155; line-height: 1.6;">Congratulations! Your application for the <b>${positionName}</b> position at <b>${companyName}</b> has been shortlisted by our corporate relations team.</p>
        
        <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; border-left: 4px solid #0284c7; margin: 25px 0;">
          <h3 style="margin-top: 0; color: #0f172a;">Interview Details:</h3>
          <p style="margin: 5px 0; color: #334155;">📅 <strong>Date:</strong> ${interviewDate || 'Not Specified'}</p>
          <p style="margin: 5px 0; color: #334155;">⏰ <strong>Time:</strong> ${interviewTime || 'Not Specified'}</p>
          <p style="margin: 5px 0; color: #334155;">📍 <strong>Venue/Link:</strong> ${interviewVenue || 'Not Specified'}</p>
        </div>

        <p style="color: #334155; line-height: 1.6;">Please find the calendar invite attached to this email. You can click it to add this event directly to your phone. Ensure you report on time with a copy of your updated resume.</p>
        
        <br/>
        <p style="color: #64748b; font-size: 0.9rem;">Best Regards,<br/><b>Placement Cell, IPCS Global</b></p>
      </div>
    `;

    // 🚨 CALENDAR GENERATOR (.ICS)
    if (interviewDate && interviewTime) {
      const formattedDate = interviewDate.replace(/-/g, '');
      const formattedTime = interviewTime.replace(/:/g, '') + '00';
      const dtStart = `${formattedDate}T${formattedTime}`;
      
      const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Talenzo//IPCS//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
SUMMARY:Interview at ${companyName}
DTSTART;TZID=Asia/Kolkata:${dtStart}
LOCATION:${interviewVenue}
DESCRIPTION:You have an interview scheduled for the ${positionName} role. Please be on time.
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

      attachments.push({
        filename: 'interview-invite.ics',
        content: icsContent,
        contentType: 'text/calendar'
      });
    }
  } 
  
  // ========================================================
  // 📧 SCENARIO 2: PLACEMENT CONFIRMED
  // ========================================================
  else if (status === 'Placed' || status === 'Got Offer') {
    emailSubject = `Congratulations on your Placement at ${companyName}! 🎉`;
    emailHtml = `
      <div style="font-family: 'Inter', Arial, sans-serif; padding: 30px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981; margin-bottom: 5px;">Placement Confirmed! 🎉</h2>
        <p style="color: #64748b; margin-top: 0; font-size: 0.9rem;">IPCS Global Placement Cell</p>
        
        <p style="color: #334155; font-size: 1.05rem;">Dear <b>${studentName}</b>,</p>
        <p style="color: #334155; line-height: 1.6;">We are absolutely thrilled to inform you that you have been successfully placed at <b>${companyName}</b>!</p>
        <p style="color: #334155; line-height: 1.6;">Your hard work has paid off. Further onboarding details and offer letter documents will be shared with you shortly by the company HR or your Placement Officer.</p>
        
        <br/>
        <p style="color: #64748b; font-size: 0.9rem;">Best Regards,<br/><b>Placement Cell, IPCS Global</b></p>
      </div>
    `;
  } 
  
  // If the status is "Applied", "Rejected", etc., we do not send an email right now.
  else {
    return;
  }

  // 3. COMPILE AND SEND THE EMAIL
  const mailOptions = {
    from: `"IPCS Placement Cell" <${process.env.EMAIL_USER}>`,
    to: studentEmail,
    subject: emailSubject,
    html: emailHtml,
    attachments: attachments
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Success: Automated Email sent to ${studentEmail} for status: ${status}`);
  } catch (error) {
    console.error(`❌ Failed: Could not send email to ${studentEmail}. Error:`, error);
  }
};

module.exports = { sendStatusUpdateEmail };