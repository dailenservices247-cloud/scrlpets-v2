import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * The second factor, end to end.
 *
 * Every test owns a throwaway @example.com member, created and deleted here. A
 * verified factor on a shared fixture account would put every other spec — and
 * every other worktree's suite on the same dev database — behind the challenge.
 */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NO_SESSION = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
};

test.skip(!SERVICE_KEY, "needs SUPABASE_SERVICE_ROLE_KEY to create throwaway members");

type Member = { id: string; email: string; password: string };
type Enrolment = { factorId: string; secret: string; codes: string[] };

const created: string[] = [];
const admin = () => createClient(SUPABASE_URL, SERVICE_KEY!, NO_SESSION);
const client = () => createClient(SUPABASE_URL, ANON_KEY, NO_SESSION);

test.afterAll(async () => {
  for (const id of created) {
    const { error } = await admin().auth.admin.deleteUser(id);
    // Not swallowed: a member that outlives its test leaves a verified factor on dev.
    if (error) console.warn(`two-factor.spec: could not delete ${id}: ${error.message}`);
  }
});

async function createMember(): Promise<Member> {
  const email = `e2e-2fa-${crypto.randomBytes(5).toString("hex")}@example.com`;
  const password = crypto.randomBytes(18).toString("base64url");
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  created.push(data.user.id);
  return { id: data.user.id, email, password };
}

/**
 * RFC 6238 — the arithmetic every authenticator app runs. Supabase accepts a
 * code for any fresh challenge within ±30s and keeps no replay list
 * (supabase/auth internal/api/mfa.go), so tests never wait for a new window.
 */
function totp(secret: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.replace(/=+$/, "").toUpperCase()) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  }
  const key = Buffer.from(bits.match(/.{8}/g)!.map((byte) => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const hmac = crypto.createHmac("sha1", key).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

function wrongCode(secret: string): string {
  return totp(secret) === "000000" ? "111111" : "000000";
}

/** Enrols the way the account page does: enroll → verify (aal2) → mint codes. */
async function enrol(member: Member): Promise<Enrolment> {
  const db = client();
  const signIn = await db.auth.signInWithPassword({ email: member.email, password: member.password });
  if (signIn.error) throw signIn.error;
  const enrolled = await db.auth.mfa.enroll({ factorType: "totp" });
  if (enrolled.error) throw enrolled.error;
  const verified = await db.auth.mfa.challengeAndVerify({
    factorId: enrolled.data.id,
    code: totp(enrolled.data.totp.secret),
  });
  if (verified.error) throw verified.error;
  const minted = await db.rpc("generate_mfa_recovery_codes");
  if (minted.error) throw minted.error;
  return {
    factorId: enrolled.data.id,
    secret: enrolled.data.totp.secret,
    codes: (minted.data as { code: string }[]).map((row) => row.code),
  };
}

async function verifiedFactors(member: Member): Promise<number> {
  const { data, error } = await admin().auth.admin.mfa.listFactors({ userId: member.id });
  if (error) throw error;
  return data.factors.filter((factor) => factor.status === "verified").length;
}

async function signInWithPassword(page: Page, member: Member) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(member.email);
  await page.getByLabel("Password").fill(member.password);
  await page.getByTestId("auth-submit").click();
}

test("a member with two-factor on is asked for the code before anything else", async ({ page }) => {
  const member = await createMember();

  // Enrol through the account page itself. This also proves codes are still
  // issued now that minting needs aal2: the browser challenge has just upgraded
  // the session the server action reads.
  await signInWithPassword(page, member);
  await page.waitForURL((url) => url.pathname !== "/login");
  await page.goto("/settings/account");
  await page.getByTestId("mfa-start").click();
  const secret = (await page.getByTestId("mfa-secret").textContent())!.trim();
  await page.getByTestId("mfa-code-input").fill(totp(secret));
  await page.getByTestId("mfa-verify").click();
  await expect(page.getByTestId("mfa-code")).toHaveCount(10);
  await page.getByTestId("mfa-codes-confirm").click();

  // A fresh sign-in has proved one factor.
  await page.context().clearCookies();
  await signInWithPassword(page, member);
  await expect(page).toHaveURL("/two-factor?next=%2F");

  // Every page, not just the one the sign-in was headed for.
  await page.goto("/settings/account");
  await expect(page).toHaveURL("/two-factor?next=%2Fsettings%2Faccount");

  await page.getByTestId("two-factor-code-input").fill(wrongCode(secret));
  await page.getByTestId("two-factor-submit").click();
  await expect(page.getByTestId("two-factor-error")).toHaveAttribute("data-error", "code");
  await expect(page).toHaveURL("/two-factor?next=%2Fsettings%2Faccount");

  await page.getByTestId("two-factor-code-input").fill(totp(secret));
  await page.getByTestId("two-factor-submit").click();
  await expect(page).toHaveURL("/settings/account");
  await expect(page.getByTestId("mfa-enrolled")).toBeVisible();

  // Having passed, the challenge steps aside.
  await page.goto("/two-factor?next=%2Fsaved");
  await expect(page).toHaveURL("/saved");
});

test("a password-reset link is challenged too, and the new password saves after the code", async ({ page }) => {
  const problems: string[] = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text()}`);
  });

  const member = await createMember();
  const { secret } = await enrol(member);
  const { data, error } = await admin().auth.admin.generateLink({
    type: "recovery",
    email: member.email,
  });
  if (error) throw error;

  await page.goto(`/auth/callback?token_hash=${data.properties.hashed_token}&type=recovery`);
  await expect(page).toHaveURL("/two-factor?next=%2Freset-password");

  await page.getByTestId("two-factor-code-input").fill(totp(secret));
  await page.getByTestId("two-factor-submit").click();
  await expect(page).toHaveURL("/reset-password");

  // Checked here, on the pages this feature owns. What follows the save is the
  // pre-existing /login → / hop, whose RSC fetch trips upgrade-insecure-requests
  // on http://localhost, and whatever the feed loads — neither is this change.
  expect(problems).toEqual([]);

  const newPassword = crypto.randomBytes(18).toString("base64url");
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm new password", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Save new password" }).click();
  // ResetPasswordForm heads for /login?notice=password_updated, and the existing
  // signed-in rule in proxy.ts forwards a signed-in member to / — so assert that
  // the form moved on and that the new password is the one that now works.
  await page.waitForURL((url) => url.pathname !== "/reset-password");
  const withNewPassword = await client().auth.signInWithPassword({
    email: member.email,
    password: newPassword,
  });
  expect(withNewPassword.error).toBeNull();
});

test("the challenge can be left by signing out, and is closed to signed-out visitors", async ({ page }) => {
  await page.goto("/two-factor?next=%2Fsaved");
  await expect(page).toHaveURL("/login?next=%2Fsaved");

  const member = await createMember();
  await enrol(member);
  await signInWithPassword(page, member);
  await expect(page).toHaveURL("/two-factor?next=%2F");
  await page.getByTestId("two-factor-signout").click();
  await expect(page).toHaveURL("/login");

  await page.goto("/settings/account");
  await expect(page).toHaveURL("/login?next=%2Fsettings%2Faccount");
});

test("a member without two-factor is never challenged", async ({ page }) => {
  const member = await createMember();
  await signInWithPassword(page, member);
  await page.waitForURL((url) => url.pathname !== "/login");
  await page.goto("/settings/account");
  await expect(page).toHaveURL("/settings/account");
  await expect(page.getByTestId("mfa-start")).toBeVisible();
});
