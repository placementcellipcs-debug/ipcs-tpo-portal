const getRole = user => String(user?.role || '').toUpperCase();
const hasRoleToken = (role, token) => new RegExp(`(^|[^A-Z0-9])${token}([^A-Z0-9]|$)`).test(role);
const isPortalAdmin = user => user?.accessType === 'superadmin' || ['SYSTEM ADMIN', 'GENERAL MANAGER', 'ZONAL PLACEMENT HEAD', 'TECHNICAL HEAD'].includes(getRole(user));
const isBranchManager = role => role === 'BM' || role.includes('BRANCH MANAGER');

const isTechnicalScoped = user => {
  const role = getRole(user);
  const technicalRole = hasRoleToken(role, 'RTH') || role.includes('REGIONAL TECHNICAL HEAD') || hasRoleToken(role, 'TTH') || role.includes('TERRITORY TECHNICAL HEAD') || /TECH(?:NICAL)?\s+LEAD/.test(role) || hasRoleToken(role, 'TL');
  const academicTrainer = role.includes('TRAINER') && (!String(user?.department || '').trim() || String(user.department).trim().toUpperCase() === 'ACADEMIC');
  return technicalRole || academicTrainer;
};

const getPolicyDenial = (user, { policy = 'portal', method = '', path = '', baseUrl = '' } = {}) => {
  const role = getRole(user);
  const admin = isPortalAdmin(user);
  const hasAssetAccess = role.includes('ASSET') || String(user?.accessType || '').toLowerCase().includes('asset');
  const isTl = /TECH(?:NICAL)?\s+LEAD/.test(role) || hasRoleToken(role, 'TL');
  const deny = message => ({ status: 403, message });

  if (policy === 'assets' && !admin && !isBranchManager(role) && !hasAssetAccess) return deny('Asset Management is not available for this role.');
  if (policy === 'asset-admin' && !admin && !hasAssetAccess) return deny('Asset manager access is required for this action.');
  if (policy === 'asset-operations' && !admin && !isBranchManager(role) && !hasAssetAccess) return deny('Asset manager or branch manager access is required for this action.');
  if (policy === 'portal-admin' && !admin) return deny('System administrator access is required for this action.');
  if (policy === 'hiring-inquiries' && String(user?.email || '').trim().toLowerCase() !== 'gifty@ipcsglobal.com') return deny('Only Gifty can view and assign company hiring inquiries.');
  if (policy === 'placement-drive' && !admin && !role.includes('ADMIN') && !isBranchManager(role) && !role.includes('TPO') && !role.includes('PLACEMENT OFFICER')) return deny('Placement Drives are available only to Placement Officers, administrators, and Branch Managers.');
  if (policy === 'design' && !admin && !['DESIGN', 'MEDIA', 'CREATIVE'].some(part => role.includes(part))) return deny('Media & Design Studio is not available for this role.');
  if (policy === 'events-write' && !admin && !role.includes('TPO') && !role.includes('PLACEMENT OFFICER')) return deny('Event management is not available for this role.');
  if (policy === 'vacancies-write' && (admin || (!role.includes('TPO') && !role.includes('PLACEMENT OFFICER')))) return deny('Only placement officers can add vacancies.');
  if (policy === 'academic') return { status: 404, message: 'Training & Academics is temporarily unavailable.' };
  if (policy === 'clients' && (hasRoleToken(role, 'RTH') || role.includes('REGIONAL TECHNICAL HEAD') || /TECH(?:NICAL)?\s+LEAD/.test(role) || hasRoleToken(role, 'TL') || role.includes('TRAINER') || hasRoleToken(role, 'TTH'))) return deny('Clients & Partners is not available for this role.');
  if (policy === 'learning' && !admin && !isTechnicalScoped(user)) return deny('Study materials are not available for this role.');
  if (policy === 'learning-write' && !admin) return deny('Administrator access is required to manage study materials.');
  if (policy === 'exam-manager' && !admin && !(hasRoleToken(role, 'RTH') || role.includes('REGIONAL TECHNICAL HEAD'))) return deny('Regional Technical Head or administrator access is required to manage technical questions.');
  if (policy === 'exams' && !admin && isTl && !(method === 'GET' && path === '/results' && baseUrl === '/api/exams')) return deny('Technical Leads can view technical exam results only.');
  if (policy === 'exams' && !admin && !isTechnicalScoped(user) && !role.includes('TPO') && !role.includes('PLACEMENT OFFICER')) return deny('Exam access is not available for this role.');
  return null;
};

module.exports = { getRole, hasRoleToken, isPortalAdmin, isBranchManager, isTechnicalScoped, getPolicyDenial };
