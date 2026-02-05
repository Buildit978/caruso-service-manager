/**
 * Password validation for change-password flow (must match backend rules).
 * - Minimum length: 12
 * - Denylist of common passwords
 * - If length < 16: require at least 3 of 4 (lowercase, uppercase, number, symbol)
 * - If length >= 16: complexity optional (passphrases allowed)
 */

const MIN_LENGTH = 12;
const COMPLEXITY_THRESHOLD = 16;

const COMMON_PASSWORDS = new Set(
  [
    "12345678",
    "123456789",
    "password",
    "qwerty",
    "letmein",
    "admin",
    "iloveyou",
    "00000000",
  ].map((s) => s.toLowerCase())
);

/**
 * Returns an array of user-friendly error messages. Empty array means valid.
 */
export function validateNewPassword(password: string): string[] {
  const errors: string[] = [];
  const p = password;

  if (!p || p.length < MIN_LENGTH) {
    errors.push(`Password must be at least ${MIN_LENGTH} characters`);
    return errors;
  }

  if (COMMON_PASSWORDS.has(p.toLowerCase().trim())) {
    errors.push("This password is too common. Choose something more unique.");
  }

  if (p.length < COMPLEXITY_THRESHOLD) {
    const hasLower = /[a-z]/.test(p);
    const hasUpper = /[A-Z]/.test(p);
    const hasNumber = /[0-9]/.test(p);
    const hasSymbol = /[^a-zA-Z0-9]/.test(p);
    const count = [hasLower, hasUpper, hasNumber, hasSymbol].filter(Boolean).length;
    if (count < 3) {
      errors.push(
        "Use at least 3 of: lowercase letter, uppercase letter, number, or symbol (e.g. !@#$)"
      );
    }
  }

  return errors;
}
