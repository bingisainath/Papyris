// src/utils/password.ts
// Same rules as web/src/utils/passwordPolicy.ts
export function passwordProblem(password: string): string | null {
  if (password.length < 8) return 'Use at least 8 characters';
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) return 'Use upper and lower case letters';
  if (!/\d/.test(password)) return 'Include a number';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Include a symbol, like ! or #';
  return null;
}
