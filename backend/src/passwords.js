const { randomBytes, scrypt, timingSafeEqual } = require('crypto');
const { promisify } = require('util');

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = Object.freeze({ N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const HASH_PREFIX = 'scrypt';
const MIN_PASSWORD_LENGTH = 12;
const MAX_PASSWORD_BYTES = 1024;

const isPasswordHash = value => /^scrypt\$16384\$8\$1\$[A-Za-z0-9_-]{20,30}\$[A-Za-z0-9_-]{80,100}$/.test(String(value || ''));

const validatePassword = value => {
  if (typeof value !== 'string') return 'Password is required.';
  const length = Array.from(value).length;
  if (length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters for a password.`;
  if (Buffer.byteLength(value, 'utf8') > MAX_PASSWORD_BYTES) return 'Password is too long.';
  return null;
};

const hashPassword = async (password, { allowShortLegacy = false } = {}) => {
  const validationError = allowShortLegacy
    ? (typeof password !== 'string' || !password ? 'Password is required.' : Buffer.byteLength(password, 'utf8') > MAX_PASSWORD_BYTES ? 'Password is too long.' : null)
    : validatePassword(password);
  if (validationError) throw new Error(validationError);
  const salt = randomBytes(16);
  const derivedKey = await scryptAsync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return `${HASH_PREFIX}$${SCRYPT_OPTIONS.N}$${SCRYPT_OPTIONS.r}$${SCRYPT_OPTIONS.p}$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
};

const constantTimeTextEquals = (left, right) => {
  const leftBuffer = Buffer.from(String(left), 'utf8');
  const rightBuffer = Buffer.from(String(right), 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
};

const verifyPassword = async (password, storedValue) => {
  const supplied = String(password ?? '');
  const stored = String(storedValue ?? '');
  if (!stored) return false;

  if (isPasswordHash(stored)) {
    const [, , , , saltText, expectedText] = stored.split('$');
    try {
      const salt = Buffer.from(saltText, 'base64url');
      const expected = Buffer.from(expectedText, 'base64url');
      const actual = await scryptAsync(supplied, salt, expected.length, SCRYPT_OPTIONS);
      return actual.length === expected.length && timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }

  // Existing staff rows are migrated to a scrypt hash after their next login.
  // A malformed value that claims to be a scrypt hash must never be treated as
  // a legacy plaintext password.
  if (stored.startsWith(`${HASH_PREFIX}$`)) return false;
  return constantTimeTextEquals(supplied, stored);
};

module.exports = {
  hashPassword,
  verifyPassword,
  isPasswordHash,
  validatePassword,
  MIN_PASSWORD_LENGTH,
};
