/**
 * The signup password rule lives here so the form can STATE it before someone
 * types and the server action can ENFORCE it on submit — one definition, two
 * consumers, no chance of the promise and the check disagreeing.
 *
 * Length first, plus one letter and one digit. No symbol/mixed-case theatre:
 * it pushes people into "Password1!" without buying real entropy, and NIST
 * stopped recommending it years ago.
 *
 * ponytail: no common-password blocklist. Add one (and the ~10k-word list it
 * needs) when signup abuse shows people are picking "password1".
 */
export const PASSWORD_MIN_LENGTH = 8;

export type PasswordRuleKey = "length" | "letter" | "digit";

/** Rules this password FAILS. Empty array means acceptable. */
export function passwordProblems(password: string): PasswordRuleKey[] {
  const problems: PasswordRuleKey[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) problems.push("length");
  if (!/\p{L}/u.test(password)) problems.push("letter");
  if (!/\d/u.test(password)) problems.push("digit");
  return problems;
}
