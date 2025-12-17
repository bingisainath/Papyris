export const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export function validatePassword(pwd: string): string | null {
  if (pwd.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-z]/.test(pwd)) return "Password must include at least 1 lowercase letter.";
  if (!/[A-Z]/.test(pwd)) return "Password must include at least 1 uppercase letter.";
  if (!/\d/.test(pwd)) return "Password must include at least 1 number.";
  if (!/[^A-Za-z0-9]/.test(pwd)) return "Password must include at least 1 special character.";
  return null;
}
