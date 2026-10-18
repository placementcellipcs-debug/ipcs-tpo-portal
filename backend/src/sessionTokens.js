const { createHash, createHmac, timingSafeEqual } = require('crypto');

const SESSION_TOKEN_PREFIX = 'IPCS_SESS_V2';
const SESSION_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const getSigningKey = secretValue => {
  const secret = secretValue ?? process.env.AUTH_SESSION_SECRET ?? process.env.GOOGLE_PRIVATE_KEY;
  if (!secret) return null;
  return createHash('sha256').update('IPCS:TPO:SESSION:V2\0').update(String(secret)).digest();
};

const getAccountVersion = (accountState, secretValue) => {
  const key = getSigningKey(secretValue);
  if (!key) throw new Error('Configure AUTH_SESSION_SECRET or GOOGLE_PRIVATE_KEY to sign staff sessions.');
  return createHmac('sha256', key)
    .update('IPCS:TPO:ACCOUNT:V2\0')
    .update(JSON.stringify(accountState || {}))
    .digest('base64url');
};

const createPortalSessionToken = (sessionUser, accountVersion, options = {}) => {
  const key = getSigningKey(options.secret);
  if (!key) throw new Error('Configure AUTH_SESSION_SECRET or GOOGLE_PRIVATE_KEY to sign staff sessions.');
  const issuedAt = options.now ?? Date.now();
  const ttlMs = options.ttlMs ?? SESSION_TOKEN_TTL_MS;
  const encodedClaims = Buffer.from(JSON.stringify({
    version: 2,
    issuedAt,
    expiresAt: issuedAt + ttlMs,
    accountVersion,
    user: sessionUser,
  })).toString('base64url');
  const unsignedToken = `${SESSION_TOKEN_PREFIX}.${encodedClaims}`;
  const signature = createHmac('sha256', key).update(unsignedToken).digest('base64url');
  return `${unsignedToken}.${signature}`;
};

const readPortalSessionToken = (email, token, expectedAccountVersion, options = {}) => {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanToken = String(token || '');
  if (!cleanEmail || !cleanToken || cleanToken.length > 8192 || !expectedAccountVersion) return null;
  const [prefix, encodedClaims, suppliedSignature, extra] = cleanToken.split('.');
  if (prefix !== SESSION_TOKEN_PREFIX || !encodedClaims || !suppliedSignature || extra !== undefined) return null;

  const key = getSigningKey(options.secret);
  if (!key) return null;
  const unsignedToken = `${prefix}.${encodedClaims}`;
  const expectedSignature = Buffer.from(createHmac('sha256', key).update(unsignedToken).digest('base64url'));
  const actualSignature = Buffer.from(suppliedSignature);
  if (actualSignature.length !== expectedSignature.length || !timingSafeEqual(actualSignature, expectedSignature)) return null;

  try {
    const claims = JSON.parse(Buffer.from(encodedClaims, 'base64url').toString('utf8'));
    const now = options.now ?? Date.now();
    const ttlMs = options.ttlMs ?? SESSION_TOKEN_TTL_MS;
    const user = claims?.user;
    const tokenVersion = Buffer.from(String(claims?.accountVersion || ''));
    const currentVersion = Buffer.from(String(expectedAccountVersion));
    if (claims?.version !== 2 || !Number.isFinite(claims.issuedAt) || !Number.isFinite(claims.expiresAt)) return null;
    if (claims.issuedAt > now + 60_000 || claims.expiresAt <= now || claims.expiresAt - claims.issuedAt > ttlMs) return null;
    if (String(user?.email || '').trim().toLowerCase() !== cleanEmail) return null;
    if (tokenVersion.length !== currentVersion.length || !timingSafeEqual(tokenVersion, currentVersion)) return null;
    return user;
  } catch {
    return null;
  }
};

module.exports = {
  SESSION_TOKEN_TTL_MS,
  getAccountVersion,
  createPortalSessionToken,
  readPortalSessionToken,
};
