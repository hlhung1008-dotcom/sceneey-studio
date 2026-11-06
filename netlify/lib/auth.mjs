import crypto from "node:crypto";
const sha = (x) => crypto.createHash("sha256").update(String(x)).digest();
export const adminSecret = () => process.env.admin_sceneey || process.env.ADMIN_SCENEEY || process.env.ADMIN_PASSWORD || "";
export function isAdmin(req) {
  const want = adminSecret();
  const got = req.headers.get("x-admin-key") || "";
  if (!want || !got) return false;
  return crypto.timingSafeEqual(sha(got), sha(want));
}
