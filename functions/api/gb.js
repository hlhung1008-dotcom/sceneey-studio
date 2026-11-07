// Q&A guestbook — Cloudflare Pages Function backed by D1.
import { J, hex, sha256, isAdmin, adminSecret, hashPw, checkPw, len, clean, sleep, rid, today, wrap } from "../../lib/cf/common.js";

const pub = (m) => m.priv
  ? { id: m.id, name: m.name, date: m.date, ok: true, priv: true, text: null, reply: null, hasReply: !!m.reply }
  : { id: m.id, name: m.name, date: m.date, ok: true, priv: false, text: m.text, reply: m.reply || "", hasReply: !!m.reply };
const adm = (m) => ({ id: m.id, name: m.name, date: m.date, ok: !!m.ok, priv: !!m.priv, text: m.text, reply: m.reply || "", hasPass: !!m.pass });

export const onRequest = wrap(async ({ request: req, env }) => {
  const db = env.DB;
  if (req.method === "GET") {
    const { results } = await db.prepare("SELECT id, name, date, priv, text, reply FROM messages WHERE ok = 1 ORDER BY ts DESC LIMIT 500").all();
    return J({ messages: results.map(pub) });
  }
  if (req.method !== "POST") return J({ error: "不支援的請求" }, 405);
  let b; try { b = await req.json(); } catch { return J({ error: "資料格式錯誤" }, 400); }
  const act = b && b.action;

  if (act === "post") {
    if (clean(b.website)) return J({ ok: true });
    const name = clean(b.name), text = clean(b.text), priv = !!b.priv, pw = String(b.pw ?? "");
    if (!name || !text) return J({ error: "暱稱和留言都要填喔" }, 400);
    if (len(name) > 20) return J({ error: "暱稱最多 20 字" }, 400);
    if (len(text) > 300) return J({ error: "留言最多 300 字" }, 400);
    if (priv && (pw.length < 4 || pw.length > 12)) return J({ error: "悄悄話的密碼要 4–12 個字" }, 400);
    const ip = req.headers.get("cf-connecting-ip") || "0";
    const rk = "gb:" + hex(await sha256(ip)).slice(0, 24), now = Date.now();
    const last = await db.prepare("SELECT t FROM ratelimit WHERE k = ?").bind(rk).first();
    if (last && now - last.t < 30000) return J({ error: "留言太快了，請等 30 秒再試一次" }, 429);
    const pend = await db.prepare("SELECT COUNT(*) AS c FROM messages WHERE ok = 0").first();
    if (pend && pend.c >= 300) return J({ error: "目前待審核的留言太多了，請晚點再來" }, 429);
    await db.batch([
      db.prepare("INSERT OR REPLACE INTO ratelimit (k, t) VALUES (?, ?)").bind(rk, now),
      db.prepare("INSERT INTO messages (id, ts, date, name, text, priv, pass, ok, reply) VALUES (?, ?, ?, ?, ?, ?, ?, 0, '')")
        .bind(rid(), now, today(), name, text, priv ? 1 : 0, priv ? await hashPw(pw) : ""),
    ]);
    return J({ ok: true });
  }

  if (act === "unlock") {
    const m = await db.prepare("SELECT * FROM messages WHERE id = ?").bind(String(b.id || "")).first();
    if (!m || !m.ok || !m.priv || !(await checkPw(String(b.pw ?? ""), m.pass))) { await sleep(600); return J({ error: "密碼不對喔" }, 403); }
    return J({ text: m.text, reply: m.reply || "" });
  }

  if (!["admin_list", "approve", "reply", "delete"].includes(act)) return J({ error: "未知的動作" }, 400);
  if (!adminSecret(env)) return J({ error: "管理密碼還沒設定（admin_sceneey）" }, 503);
  if (!(await isAdmin(req, env))) { await sleep(800); return J({ error: "密碼不對喔" }, 401); }
  if (act === "admin_list") {
    const { results } = await db.prepare("SELECT * FROM messages ORDER BY ts DESC LIMIT 1000").all();
    return J({ messages: results.map(adm) });
  }
  const id = String(b.id || "");
  const m = await db.prepare("SELECT id FROM messages WHERE id = ?").bind(id).first();
  if (!m) return J({ error: "找不到這則留言" }, 404);
  if (act === "delete") await db.prepare("DELETE FROM messages WHERE id = ?").bind(id).run();
  if (act === "approve") await db.prepare("UPDATE messages SET ok = 1 WHERE id = ?").bind(id).run();
  if (act === "reply") {
    const r = clean(b.reply);
    if (len(r) > 500) return J({ error: "回覆最多 500 字" }, 400);
    await db.prepare("UPDATE messages SET reply = ?, ok = 1 WHERE id = ?").bind(r, id).run();
  }
  return J({ ok: true });
});
