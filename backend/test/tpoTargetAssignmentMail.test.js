'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTpoTargetAssignmentMail } = require('../src/tpoTargetAssignmentMail');

test('builds a monthly target digest with active TPOs in To and managers in CC', () => {
  const mail = buildTpoTargetAssignmentMail({
    monthLabel: 'April 2026',
    tpos: [
      { name: 'Visakh S', email: 'tvm@ipcsglobal.com', region: 'Kerala', target: 25 },
      { name: 'Bincy Bindhuraj', email: 'talent.ipcs@ipcsglobal.com', region: 'Kerala', target: 25 },
      { name: 'Amarnath S R', email: 'tpo.tn@ipcsglobal.com', region: 'Tamil Nadu', target: 10 }
    ]
  });

  assert.deepEqual(mail.to, ['tvm@ipcsglobal.com', 'talent.ipcs@ipcsglobal.com', 'tpo.tn@ipcsglobal.com']);
  assert.deepEqual(mail.cc, ['gifty@ipcsglobal.com', 'rakesh@ipcsglobal.com']);
  assert.equal(mail.totalTarget, 60);
  assert.equal(mail.tpoCount, 3);
  assert.equal(mail.subject, 'Placement Targets – April 2026');
  assert.match(mail.html, /Kerala total/);
  assert.match(mail.html, /Tamil Nadu total/);
  assert.match(mail.html, /Total target/);
  assert.match(mail.html, /10 company visits/);
  assert.match(mail.text, /Total placement target: 60/);
});

test('escapes Contact-sheet content and excludes invalid TPO rows', () => {
  const mail = buildTpoTargetAssignmentMail({
    monthLabel: 'May 2026',
    tpos: [
      { name: '<Visakh>', email: 'tvm@ipcsglobal.com', region: 'Kerala & South', target: 25 },
      { name: 'Missing Target', email: 'missing@ipcsglobal.com', region: 'Kerala', target: 'n/a' },
      { name: 'Blank Target', email: 'blank@ipcsglobal.com', region: 'Kerala', target: '' },
      { name: 'Missing Email', email: '', region: 'Kerala', target: 10 }
    ]
  });

  assert.equal(mail.totalTarget, 25);
  assert.equal(mail.tpoCount, 1);
  assert.match(mail.html, /&lt;Visakh&gt;/);
  assert.match(mail.html, /Kerala &amp; South/);
  assert.doesNotMatch(mail.html, /Missing Target|Blank Target|Missing Email/);
});
