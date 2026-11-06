// Sceneey's Studio guestbook — core logic (store is injected so it can be tested).
import crypto from "node:crypto";

const J = (o, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const sha = (x) => crypto.createHash("sha256").update(String(x)).digest();

function hashPw(pw) {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 32);
  return salt.toString("hex") + ":" + h.toString("hex");
}
function checkPw(pw, stored) {
  if (!stored || !pw) return false;
  const [s, h] = stored.split(":");
  const got = crypto.scryptSync(pw, Buffer.from(s, "hex"), 32);
  const want = Buffer.from(h, "hex");
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
function isAdmin(req) {
  const want = process.env.admin_sceneey || process.env.ADMIN_SCENEEY || process.env.ADMIN_PASSWORD || "";
  const got = req.headers.get("x-admin-key") || "";
  if (!want || !got) return false;
  return crypto.timingSafeEqual(sha(got), sha(want));
}
const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date())
    .replace(/-/g, "/");
const clean = (s) => String(s ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function all(store) {
  const { blobs } = await store.list({ prefix: "m/" });
  const out = [];
  for (const b of blobs) {
    const m = await store.get(b.key, { type: "json" });
    if (m) out.push(m);
  }
  return out.sort((a, b) => (a.ts < b.ts ? 1 : -1));
}
const pub = (m) =>
  m.priv
    ? { id: m.id, name: m.name, date: m.date, ok: true, priv: true, text: null, reply: null, hasReply: !!m.reply }
    : { id: m.id, name: m.name, date: m.date, ok: true, priv: false, text: m.text, reply: m.reply || "", hasReply: !!m.reply };
const adm = (m) => ({ id: m.id, name: m.name, date: m.date, ok: !!m.ok, priv: !!m.priv, text: m.text, reply: m.reply || "", hasPass: !!m.pass });

export async function handle(req, context, store) {
  const ip = (context && context.ip) || req.headers.get("x-nf-client-connection-ip") || "0";
  if (req.method === "GET") {
    const list = (await all(store)).filter((m) => m.ok).map(pub);
    return J({ messages: list });
  }
  if (req.method !== "POST") return J({ error: "不支援的請求" }, 405);
  let b;
  try { b = await req.json(); } catch { return J({ error: "資料格式錯誤" }, 400); }
  const act = b && b.action;

  if (act === "post") {
    if (clean(b.website)) return J({ ok: true }); // honeypot: pretend success
    const name = clean(b.name), text = clean(b.text), priv = !!b.priv, pw = String(b.pw ?? "");
    if (!name || !text) return J({ error: "暱稱和留言都要填喔" }, 400);
    if ([...name].length > 20) return J({ error: "暱稱最多 20 字" }, 400);
    if ([...text].length > 300) return J({ error: "留言最多 300 字" }, 400);
    if (priv && (pw.length < 4 || pw.length > 12)) return J({ error: "悄悄話的密碼要 4–12 個字" }, 400);
    const rk = "rl/" + sha(ip).toString("hex").slice(0, 24);
    const last = await store.get(rk, { type: "json" });
    const now = Date.now();
    if (last && now - last.t < 30000) return J({ error: "留言太快了，請等 30 秒再試一次" }, 429);
    const pending = (await all(store)).filter((m) => !m.ok).length;
    if (pending >= 300) return J({ error: "目前待審核的留言太多了，請晚點再來" }, 429);
    await store.setJSON(rk, { t: now });
    const id = now.toString(36) + crypto.randomBytes(3).toString("hex");
    const m = { id, ts: now, date: today(), name, text, priv, pass: priv ? hashPw(pw) : "", ok: false, reply: "" };
    await store.setJSON("m/" + id, m);
    return J({ ok: true });
  }

  if (act === "unlock") {
    const m = await store.get("m/" + String(b.id || ""), { type: "json" });
    if (!m || !m.ok || !m.priv || !checkPw(String(b.pw ?? ""), m.pass)) {
      await sleep(600);
      return J({ error: "密碼不對喔" }, 403);
    }
    return J({ text: m.text, reply: m.reply || "" });
  }

  // ---- admin ----
  if (!["admin_list", "approve", "reply", "delete"].includes(act)) return J({ error: "未知的動作" }, 400);
  if (!(process.env.admin_sceneey || process.env.ADMIN_SCENEEY || process.env.ADMIN_PASSWORD)) return J({ error: "管理密碼還沒設定（admin_sceneey）" }, 503);
  if (!isAdmin(req)) { await sleep(800); return J({ error: "密碼不對喔" }, 401); }
  if (act === "admin_list") return J({ messages: (await all(store)).map(adm) });
  const key = "m/" + String(b.id || "");
  const m = await store.get(key, { type: "json" });
  if (!m) return J({ error: "找不到這則留言" }, 404);
  if (act === "delete") { await store.delete(key); return J({ ok: true }); }
  if (act === "approve") { m.ok = true; await store.setJSON(key, m); return J({ ok: true }); }
  if (act === "reply") {
    const r = clean(b.reply);
    if ([...r].length > 500) return J({ error: "回覆最多 500 字" }, 400);
    m.reply = r; m.ok = true;
    await store.setJSON(key, m);
    return J({ ok: true });
  }
}
