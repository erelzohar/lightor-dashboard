/**
 * The password rules a new password must meet (LT-315) — the same ones the
 * register form (lightor-register `passwordSchema`) and the API's
 * registration schema enforce: at least 6 characters, printable ASCII, with
 * both a letter and a digit. The API's reset route checks only the length,
 * so without this a reset could set a password registration would refuse.
 */
export const PASSWORD_MIN_LENGTH = 6;

export type PasswordProblem = 'min' | 'ascii' | 'complex';

export const passwordProblem = (password: string): PasswordProblem | null => {
  if (password.length < PASSWORD_MIN_LENGTH) return 'min';
  if (!/^[\x20-\x7E]*$/.test(password)) return 'ascii';
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return 'complex';
  return null;
};
