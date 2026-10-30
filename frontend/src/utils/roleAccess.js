const PORTAL_ADMIN_ROLES = new Set([
  'SYSTEM ADMIN',
  'GENERAL MANAGER',
  'ZONAL PLACEMENT HEAD',
  'TECHNICAL HEAD',
]);

export const isPortalAdminAccount = account => {
  const accessType = String(account?.accessType || '').trim().toLowerCase();
  const role = String(account?.role || '').trim().toUpperCase();
  return accessType === 'superadmin' || PORTAL_ADMIN_ROLES.has(role);
};

export const isAcademicTrainerAccount = account => {
  const role = String(account?.role || '').trim().toUpperCase();
  const department = String(account?.department || '').trim().toUpperCase();
  return role.includes('TRAINER') && (!department || department === 'ACADEMIC');
};
