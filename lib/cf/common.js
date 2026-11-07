// Shared helpers for the Cloudflare Pages Functions (Web APIs only).
const enc = new TextEncoder();
export const J = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
export const hex = (b) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (h) => new Uint8Array((h.match(/../g) || []).map((x) => parseInt(x, 16)));
export async function sha256(s) { return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(String(s)))); }
export function eq(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a[i] ^ b[i]; return r === 0; }
export const adminSecret = (env) => env.admin_sceneey || env.ADMIN_SCENEEY || "";
export async function isAdmin(req, env) {
  const want = adminSecret(env), got = req.headers.get("x-admin-key") || "";
  if (!want || !got) return false;
  return eq(await sha256(got), await sha256(want));
}
const IT = 20000;
async function derive(pw, salt, it) {
  const k = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: it }, k, 256));
}
export async function hashPw(pw) { const salt = crypto.getRandomValues(new Uint8Array(16)); return "p2:" + IT + ":" + hex(salt) + ":" + hex(await derive(pw, salt, IT)); }
export async function checkPw(pw, stored) {
  if (!pw || !stored) return false;
  const [t, it, s, h] = String(stored).split(":");
  if (t !== "p2" || !s || !h) return false;
  return eq(await derive(pw, unhex(s), +it), unhex(h));
}
export const len = (s) => [...String(s ?? "")].length;
export const clean = (s) => String(s ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const rid = () => Date.now().toString(36) + hex(crypto.getRandomValues(new Uint8Array(4)));
export const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replace(/-/g, "/");
export const wrap = (fn) => async (ctx) => {
  try { return await fn(ctx); } catch (e) { console.error(e && e.stack || e); return J({ error: "伺服器出了點問題，請稍後再試" }, 500); }
};
