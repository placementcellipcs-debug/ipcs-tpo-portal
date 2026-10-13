/**
 * IPCS mail sender endpoint.
 * Copy this project once per Gmail account and deploy each copy as that account.
 * The backend authenticates requests with the MAIL_API_SECRET Script Property.
 */
function doPost(e) {
  var request;
  try {
    request = JSON.parse(e && e.postData && e.postData.contents || '{}');
  } catch (error) {
    return json_({ success: false, code: 'INVALID_JSON', error: 'Request body must be JSON.' });
  }

  var configuredSecret = PropertiesService.getScriptProperties().getProperty('MAIL_API_SECRET') || '';
  if (!configuredSecret || !request.secret || request.secret !== configuredSecret) {
    return json_({ success: false, code: 'UNAUTHORIZED', error: 'Invalid Apps Script secret.' });
  }

  var action = String(request.action || 'send').toLowerCase();
  if (action === 'quota') {
    return json_({
      success: true,
      sender: Session.getEffectiveUser().getEmail() || '',
      remainingRecipients: MailApp.getRemainingDailyQuota()
    });
  }
  if (action !== 'send') {
    return json_({ success: false, code: 'INVALID_ACTION', error: 'Action must be send or quota.' });
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return json_({ success: false, code: 'BUSY', retryable: true, error: 'Another message is being sent by this account.' });
  }

  try {
    var to = addressList_(request.to);
    var cc = addressList_(request.cc);
    var bcc = addressList_(request.bcc);
    var recipientCount = uniqueRecipientCount_(to, cc, bcc);
    var subject = String(request.subject || '').trim();
    if (!to.length || !subject) {
      return json_({ success: false, code: 'INVALID_MESSAGE', error: 'A To address and subject are required.' });
    }

    var remaining = MailApp.getRemainingDailyQuota();
    if (remaining < recipientCount) {
      return json_({
        success: false,
        code: 'QUOTA_EXCEEDED',
        remainingRecipients: remaining,
        requestedRecipients: recipientCount,
        error: 'This sender has insufficient Apps Script recipient quota for this message.'
      });
    }

    var attachments = (request.attachments || []).map(attachmentBlob_);
    var options = {
      htmlBody: String(request.html || ''),
      name: String(request.fromName || 'IPCS Global'),
      attachments: attachments
    };
    if (cc.length) options.cc = cc.join(',');
    if (bcc.length) options.bcc = bcc.join(',');
    if (request.replyTo) options.replyTo = String(request.replyTo);

    var textBody = String(request.text || '').trim() || stripHtml_(request.html || '');
    MailApp.sendEmail(to.join(','), subject, textBody, options);

    return json_({
      success: true,
      sender: Session.getEffectiveUser().getEmail() || '',
      recipientCount: recipientCount,
      remainingRecipients: MailApp.getRemainingDailyQuota()
    });
  } catch (error) {
    var message = String(error && error.message || error || 'Apps Script mail send failed.');
    var quota = /quota|too many times|daily.*limit|sending limit|5\.4\.5/i.test(message);
    return json_({
      success: false,
      code: quota ? 'QUOTA_EXCEEDED' : 'SEND_FAILED',
      retryable: quota,
      remainingRecipients: MailApp.getRemainingDailyQuota(),
      error: message
    });
  } finally {
    lock.releaseLock();
  }
}

function addressList_(value) {
  var values = Array.isArray(value) ? value : String(value || '').split(',');
  return values.map(function (item) { return String(item || '').trim(); })
    .filter(function (address) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address); });
}

function uniqueRecipientCount_(to, cc, bcc) {
  var all = to.concat(cc, bcc).map(function (address) { return address.toLowerCase(); });
  return Object.keys(all.reduce(function (unique, address) {
    unique[address] = true;
    return unique;
  }, {})).length;
}

function attachmentBlob_(attachment) {
  var filename = String(attachment.filename || 'attachment');
  var mimeType = String(attachment.mimeType || 'application/octet-stream');
  if (attachment.contentBytes) {
    return Utilities.newBlob(Utilities.base64Decode(String(attachment.contentBytes)), mimeType, filename);
  }
  if (attachment.href && /^https?:\/\//i.test(String(attachment.href))) {
    var response = UrlFetchApp.fetch(String(attachment.href), { followRedirects: true, muteHttpExceptions: false });
    return response.getBlob().setName(filename);
  }
  throw new Error('Attachment ' + filename + ' is missing contentBytes or a downloadable HTTPS/HTTP href.');
}

function stripHtml_(html) {
  return String(html || '').replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
