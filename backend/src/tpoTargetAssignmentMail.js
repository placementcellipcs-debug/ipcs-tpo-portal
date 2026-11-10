'use strict';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[character]));

const uniqueEmails = values => [...new Map((values || [])
  .map(value => String(value || '').trim())
  .filter(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
  .map(value => [value.toLowerCase(), value])).values()];

const formatCount = value => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);

const buildTpoTargetAssignmentMail = ({ monthLabel, tpos, giftyEmail = 'gifty@ipcsglobal.com', rakeshEmail = 'rakesh@ipcsglobal.com' }) => {
  const cleanTpos = (Array.isArray(tpos) ? tpos : []).map(tpo => {
    const targetText = String(tpo?.target ?? '').trim();
    return {
      name: String(tpo?.name || '').trim(),
      email: String(tpo?.email || '').trim(),
      region: String(tpo?.region || '').trim() || 'Region not specified',
      target: /^\d+$/.test(targetText) && Number.isSafeInteger(Number(targetText)) ? Number(targetText) : null
    };
  }).filter(tpo => tpo.name && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tpo.email) && Number.isSafeInteger(tpo.target) && tpo.target >= 0);

  const cc = uniqueEmails([giftyEmail, rakeshEmail]);
  const ccSet = new Set(cc.map(email => email.toLowerCase()));
  const to = uniqueEmails(cleanTpos.map(tpo => tpo.email)).filter(email => !ccSet.has(email.toLowerCase()));
  const totalTarget = cleanTpos.reduce((sum, tpo) => sum + tpo.target, 0);
  const regionGroups = new Map();
  cleanTpos.forEach(tpo => {
    if (!regionGroups.has(tpo.region)) regionGroups.set(tpo.region, []);
    regionGroups.get(tpo.region).push(tpo);
  });

  const headerCell = 'padding:11px 13px;background:#173650;color:#eaf6ff;text-align:left;font-size:12px;letter-spacing:.04em;text-transform:uppercase';
  const bodyCell = 'padding:11px 13px;border-bottom:1px solid #e5edf3;color:#26394a;font-size:14px';
  const regionSections = [...regionGroups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([region, members]) => {
    const regionalTotal = members.reduce((sum, tpo) => sum + tpo.target, 0);
    const rows = members.map(tpo => `<tr><td style="${bodyCell}">${escapeHtml(tpo.name)}</td><td style="${bodyCell};text-align:right;font-weight:750">${formatCount(tpo.target)}</td></tr>`).join('');
    return `<section style="margin:22px 0 0"><h2 style="margin:0 0 9px;color:#173650;font-size:17px">${escapeHtml(region)}</h2><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #dce6ed"><thead><tr><th style="${headerCell}">TPO</th><th style="${headerCell};text-align:right">Monthly target</th></tr></thead><tbody>${rows}<tr><td style="${bodyCell};font-weight:750;background:#f3f8fb">${escapeHtml(region)} total</td><td style="${bodyCell};text-align:right;font-weight:800;background:#f3f8fb">${formatCount(regionalTotal)}</td></tr></tbody></table></section>`;
  }).join('');

  const safeMonth = escapeHtml(monthLabel || 'the selected month');
  const subject = `Placement Targets – ${monthLabel || 'Monthly'}`;
  const text = [
    'Hi Team,',
    '',
    'Greetings of the day.',
    '',
    `Please find below the placement targets assigned for ${monthLabel || 'the selected month'}:`,
    ...[...regionGroups.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([region, members]) => [
      '', `${region}:`, ...members.map(tpo => `  ${tpo.name} — ${formatCount(tpo.target)}`),
      `  ${region} Total — ${formatCount(members.reduce((sum, tpo) => sum + tpo.target, 0))}`
    ]),
    '',
    `Total placement target: ${formatCount(totalTarget)}`,
    '',
    'In addition, each TPO is requested to complete 10 company visits within the month.',
    '',
    'Please work toward achieving 100% of the assigned targets.',
    '',
    'Wishing you all the best for the month.',
    '',
    'Regards,',
    'IPCS Global · Placement Team'
  ].join('\n');

  const html = `<div style="margin:0;padding:30px 12px;background:#edf3f7;font-family:Arial,Helvetica,sans-serif;color:#203246;line-height:1.55"><table role="presentation" align="center" cellpadding="0" cellspacing="0" width="760" style="width:100%;max-width:760px;margin:0 auto;background-color:#ffffff;border:1px solid #dce6ed;border-radius:18px;overflow:hidden"><tr><td bgcolor="#10283b" style="padding:29px 32px;background-color:#10283b;background:#10283b;border-bottom:4px solid #21b6a6;mso-line-height-rule:exactly"><div style="color:#8de7db;font-size:11px;font-weight:800;letter-spacing:2px">IPCS GLOBAL · PLACEMENT OPERATIONS</div><h1 style="margin:9px 0 3px;color:#ffffff;font-size:27px;line-height:1.25;font-weight:700;mso-line-height-rule:exactly">Monthly placement targets</h1><div style="color:#d5e6ef;font-size:15px">${safeMonth}</div></td></tr><tr><td style="padding:26px 32px 8px"><p style="margin:0 0 7px;font-size:16px;font-weight:700;color:#173650">Hi Team,</p><p style="margin:0 0 18px;color:#536779">Greetings of the day. Please find below the placement targets assigned for <strong>${safeMonth}</strong>.</p><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:separate;border-spacing:8px 0"><tr><td style="padding:16px 18px;border:1px solid #dce9ee;border-radius:12px;background:#f5fafb"><div style="color:#668091;font-size:11px;font-weight:750;letter-spacing:.08em;text-transform:uppercase">Active TPOs</div><strong style="display:block;margin-top:5px;color:#173650;font-size:24px">${formatCount(cleanTpos.length)}</strong></td><td style="padding:16px 18px;border:1px solid #ccece5;border-radius:12px;background:#effaf7"><div style="color:#4c7a70;font-size:11px;font-weight:750;letter-spacing:.08em;text-transform:uppercase">Total target</div><strong style="display:block;margin-top:5px;color:#087c70;font-size:24px">${formatCount(totalTarget)}</strong></td></tr></table>${regionSections}<div style="margin-top:24px;padding:18px 20px;border:1px solid #bde7df;border-radius:13px;background:#f0faf7"><div style="color:#087c70;font-size:12px;font-weight:850;letter-spacing:.08em;text-transform:uppercase">Monthly focus</div><p style="margin:8px 0 0;color:#26394a"><strong>10 company visits</strong> should be completed by each TPO within the month. All are requested to work toward <strong>100% achievement</strong> of their assigned placement targets.</p></div><p style="margin:23px 0 0;color:#536779">Wishing you all the best for the month. Let’s continue working together and reach greater heights!</p><p style="margin:23px 0 0;padding-top:17px;border-top:1px solid #e5edf3;color:#536779">Regards,<br><strong style="color:#173650">IPCS Global Placement Team</strong></p></td></tr><tr><td style="padding:14px 32px;background:#f7fafc;color:#8494a1;font-size:11px">This message was prepared from the active TPO roster and the monthly targets saved in the portal.</td></tr></table></div>`;

  return { to, cc, subject, text, html, totalTarget, tpoCount: cleanTpos.length };
};

module.exports = { buildTpoTargetAssignmentMail };
