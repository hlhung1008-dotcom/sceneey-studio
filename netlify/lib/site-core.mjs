// Sceneey's Studio — editable site content (announcement bar, NEWS, GALLERY) + image uploads.
import crypto from "node:crypto";
import { isAdmin, adminSecret } from "./auth.mjs";
import { DEFAULTS } from "./site-defaults.mjs";

const J = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const len = (s) => [...String(s ?? "")].length;
const str = (s, max) => { const v = String(s ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim(); if (len(v) > max) throw new Error("內容太長了（最多 " + max + " 字）"); return v; };
const KEYS = ["annc", "news", "gallery"];
const CATS = ["公告", "維修", "圖片", "花絮"];
const SRC_RE = /^\/(img\/c\/[0-9a-f]{32}\.webp|api\/media\/[a-z0-9]{6,40})$/;

function validate(k, d) {
  if (k === "annc") {
    if (!d || typeof d !== "object") throw new Error("資料格式錯誤");
    let link = String(d.link ?? "news").trim();
    if (!(link === "news" || link === "none" || /^https?:\/\/[^\s"'<>]{1,300}$/.test(link) || /^\/[^\s"'<>]{0,200}$/.test(link))) throw new Error("連結網址格式不對（要以 https:// 或 / 開頭）");
    return { on: !!d.on, tag: str(d.tag, 6) || "公告", text: str(d.text, 60), link, linkText: str(d.linkText, 10) || "看更多" };
  }
  if (k === "news") {
    if (!Array.isArray(d) || d.length > 200) throw new Error("資料格式錯誤");
    return d.map((n) => {
      const date = String(n.date || "");
      if (!/^\d{4}\.\d{2}\.\d{2}$/.test(date)) throw new Error("日期格式不對");
      if (!CATS.includes(n.cat)) throw new Error("分類不對");
      const title = str(n.title, 80); if (!title) throw new Error("標題要填喔");
      return { id: String(n.id || "").replace(/[^\w-]/g, "").slice(0, 40) || "n" + Date.now().toString(36), date, cat: n.cat, pin: !!n.pin, title, body: str(n.body, 3000) };
    });
  }
  if (k === "gallery") {
    if (!Array.isArray(d) || d.length > 300) throw new Error("資料格式錯誤");
    return d.map((g) => {
      const src = String(g.src || "");
      if (!SRC_RE.test(src)) throw new Error("圖片網址不對");
      return { src, alt: str(g.alt, 60) };
    });
  }
  throw new Error("未知的項目");
}

export async function handle(req, site, media) {
  const url = new URL(req.url);
  if (req.method === "GET") {
    const k = url.searchParams.get("k");
    if (!KEYS.includes(k)) return J({ error: "未知的項目" }, 400);
    const d = await site.get(k, { type: "json" });
    return J({ data: d ?? DEFAULTS[k] });
  }
  if (req.method !== "POST") return J({ error: "不支援的請求" }, 405);
  if (!adminSecret()) return J({ error: "管理密碼還沒設定（admin_sceneey）" }, 503);
  if (!isAdmin(req)) { await new Promise((r) => setTimeout(r, 800)); return J({ error: "密碼不對喔" }, 401); }
  let b; try { b = await req.json(); } catch { return J({ error: "資料格式錯誤（檔案可能太大）" }, 400); }

  if (b.action === "save") {
    const k = b.k;
    if (!KEYS.includes(k)) return J({ error: "未知的項目" }, 400);
    let data;
    try { data = validate(k, b.data); } catch (e) { return J({ error: e.message }, 400); }
    if (k === "gallery") {
      // delete uploaded images that are no longer used
      const old = (await site.get("gallery", { type: "json" })) || [];
      const keep = new Set(data.map((g) => g.src));
      for (const g of old) if (g.src.startsWith("/api/media/") && !keep.has(g.src)) await media.delete(g.src.slice(11));
    }
    await site.setJSON(k, data);
    return J({ ok: true, data });
  }
  if (b.action === "upload") {
    const type = String(b.type || "");
    if (!/^image\/(webp|jpeg|png)$/.test(type)) return J({ error: "只能上傳圖片" }, 400);
    const buf = Buffer.from(String(b.data || ""), "base64");
    if (!buf.length || buf.length > 4.5 * 1024 * 1024) return J({ error: "圖片太大了（壓縮後要小於 4.5MB）" }, 400);
    const id = Date.now().toString(36) + crypto.randomBytes(5).toString("hex");
    await media.set(id, buf, { metadata: { type } });
    return J({ ok: true, src: "/api/media/" + id });
  }
  return J({ error: "未知的動作" }, 400);
}

export async function serveMedia(id, media) {
  if (!/^[a-z0-9]{6,40}$/.test(id || "")) return new Response("Not found", { status: 404 });
  const r = await media.getWithMetadata(id, { type: "arrayBuffer" });
  if (!r) return new Response("Not found", { status: 404 });
  return new Response(r.data, { headers: { "content-type": (r.metadata && r.metadata.type) || "image/webp", "cache-control": "public, max-age=31536000, immutable" } });
}
