// Editable site content (announcement bar, NEWS, GALLERY) + image uploads — D1.
import { J, isAdmin, adminSecret, len, clean, sleep, rid, wrap } from "../../lib/cf/common.js";
import { DEFAULTS } from "../../lib/cf/defaults.js";

const KEYS = ["annc", "news", "gallery", "chars", "stories", "tags", "wall"];
const BLOG_RE = /^(blog|story)_[a-z0-9-]{1,40}$/;
const okKey = (k) => KEYS.includes(k) || BLOG_RE.test(String(k || ""));
const ID_RE = /^[a-z0-9-]{1,40}$/;
const TAGIDS = (v) => Array.isArray(v) ? [...new Set(v.map(String).filter((x) => ID_RE.test(x)))].slice(0, 30) : [];
const URL_RE = /^(https?:\/\/[^\s"'<>]{1,400}|\/[^\s"'<>]{0,300})$/;
const img = (v) => { const s = String(v || ""); if (s && !SRC_RE.test(s)) throw new Error("圖片網址不對"); return s; };
const url = (v, what) => { const s = String(v || "").trim(); if (s && !URL_RE.test(s)) throw new Error(what + "的網址格式不對（要以 https:// 或 / 開頭）"); return s; };

// --- blog HTML sanitizer: only a small set of tags/attributes survives ---
const ALLOW = { p: ["class"], h2: ["class"], h3: ["class"], span: ["class"], strong: [], b: [], em: [], i: [], u: [], s: [], blockquote: [], hr: [], br: [], ul: [], ol: [], li: [], a: ["href"], figure: ["class"], img: ["src", "alt"], figcaption: [], div: ["class"] };
const VOID = new Set(["hr", "br", "img"]);
const CLS_RE = /^(b-(full|center|left|right|row)|fs-(l|s)|lh-(1|3)|c-(rose|ink|mist|sage|gold|lav|wine))$/;
const escT = (t) => t.replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escA = (t) => t.replace(/&(?!(#\d+|#x[0-9a-f]+|[a-z]+);)/gi, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export function sanitize(html) {
  let h = String(html || "").replace(/<(script|style|iframe|object|embed|template|svg|math|noscript|textarea|select|button|form)\b[\s\S]*?<\/\1\s*>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g; let out = "", last = 0, m;
  while ((m = re.exec(h))) {
    out += escT(h.slice(last, m.index)); last = re.lastIndex;
    const tag = m[2].toLowerCase(); if (!(tag in ALLOW)) continue;
    if (m[1]) { if (!VOID.has(tag)) out += "</" + tag + ">"; continue; }
    let attrs = ""; const ar = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)')/g; let a;
    while ((a = ar.exec(m[3]))) {
      const n = a[1].toLowerCase(), v = (a[3] ?? a[4] ?? "").trim();
      if (!ALLOW[tag].includes(n)) continue;
      if (n === "href") { if (!/^(https?:\/\/|\/)[^\s"'<>]*$/.test(v)) continue; attrs += ' href="' + escA(v) + '"' + (v.startsWith("/") ? "" : ' target="_blank" rel="noopener"'); }
      else if (n === "src") { if (!SRC_RE.test(v)) continue; attrs += ' src="' + v + '"'; }
      else if (n === "class") { const c = v.split(/\s+/).filter((x) => CLS_RE.test(x)).join(" "); if (c) attrs += ' class="' + c + '"'; }
      else attrs += " " + n + '="' + escA(v.slice(0, 200)) + '"';
    }
    if (tag === "img" && !/ src=/.test(attrs)) continue;
    out += "<" + tag + attrs + (tag === "img" ? ' loading="lazy"' : "") + ">";
  }
  return out + escT(h.slice(last));
}
const CATS = ["公告", "維修", "圖片", "花絮", "活動"];
const SRC_RE = /^\/(img\/c\/[0-9a-f]{32}\.webp|api\/media\/[a-z0-9]{6,40})$/;
const str = (s, max) => { const v = clean(s); if (len(v) > max) throw new Error("內容太長了（最多 " + max + " 字）"); return v; };

function validate(k, d) {
  if (k === "wall") {
    if (!d || typeof d !== "object" || !Array.isArray(d.items) || d.items.length > 300) throw new Error("資料格式錯誤");
    const items = d.items.map((w) => {
      if (w.kind === "link") {
        const u = String(w.url || "").trim();
        if (!/^https:\/\/[^\s"'<>]{1,500}$/.test(u)) throw new Error("連結網址格式不對（要以 https:// 開頭）");
        return { kind: "link", url: u, embed: !!w.embed, site: str(w.site, 30), title: str(w.title, 120), text: str(w.text, 300), img: img(w.img), name: str(w.name, 30), date: str(w.date, 20) };
      }
      const text = str(w.text, 3000); if (!text) throw new Error("留言內容要填喔"); return { name: str(w.name, 30), text, date: str(w.date, 20) };
    });
    return { on: !!d.on, title: str(d.title, 30), items };
  }
  if (k === "annc") {
    if (!d || typeof d !== "object") throw new Error("資料格式錯誤");
    const link = String(d.link ?? "news").trim();
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
    return d.map((g) => { const src = String(g.src || ""); if (!SRC_RE.test(src)) throw new Error("圖片網址不對");
      const chars = Array.isArray(g.chars) ? [...new Set(g.chars.map(String).filter((x) => ID_RE.test(x)))].slice(0, 20) : [];
      return { src, alt: str(g.alt, 60), kw: str(g.kw, 200), chars, tags: TAGIDS(g.tags), gender: ["m", "f", "n"].includes(g.gender) ? g.gender : "" }; });
  }
  if (k === "tags") {
    if (!Array.isArray(d) || d.length > 100) throw new Error("資料格式錯誤");
    const seen = new Set();
    return d.map((t) => {
      const id = String(t.id || ""); if (!ID_RE.test(id)) throw new Error("標籤代號只能用小寫英文、數字和 -"); if (seen.has(id)) throw new Error("標籤代號重複了：" + id); seen.add(id);
      const label = str(t.label, 20); if (!label) throw new Error("標籤名稱要填喔");
      const color = /^#[0-9a-f]{6}$/i.test(String(t.color || "")) ? String(t.color).toLowerCase() : "#8a7d82";
      const kind = t.kind === "world" ? "world" : "tag";
      const on = kind === "world" ? ["chars", "stories", "gallery"] : (Array.isArray(t.on) ? ["chars", "stories", "gallery"].filter((x) => t.on.includes(x)) : ["chars", "stories", "gallery"]);
      return { id, label, color, kind, on, group: kind === "world" ? "" : str(t.group, 12) };
    });
  }
  if (k === "chars") {
    if (!Array.isArray(d) || d.length > 100) throw new Error("資料格式錯誤");
    const seen = new Set();
    return d.map((c) => {
      const id = String(c.id || ""); if (!ID_RE.test(id)) throw new Error("角色代號只能用小寫英文、數字和 -"); if (seen.has(id)) throw new Error("角色代號重複了：" + id); seen.add(id);
      const name = str(c.name, 40); if (!name) throw new Error("角色名稱要填喔");
      const world = ID_RE.test(String(c.world || "")) ? String(c.world) : "";
      const pos = /^\d{1,3}% \d{1,3}%$/.test(String(c.pos || "")) ? c.pos : "50% 20%";
      const stories = (Array.isArray(c.stories) ? c.stories : []).slice(0, 30).map((t) => { const title = str(t.title, 60); if (!title) throw new Error(name + "：故事標題要填喔"); return { title, url: url(t.url, "故事"), desc: str(t.desc, 200) }; });
      return { id, name, one: str(c.one, 120), era: str(c.era, 30), world, collab: !!c.collab, partner: str(c.partner, 40), award: str(c.award, 40), role: str(c.role, 40),
        img: img(c.img), av: img(c.av), banner: img(c.banner), pos, play: url(c.play, "遊玩連結"), opening: str(c.opening, 60), released: str(c.released, 20), stories, tags: TAGIDS(c.tags), gender: ["m", "f", "n"].includes(c.gender) ? c.gender : "", ctype: c.ctype === "sim" ? "sim" : "char", editor: str(c.editor, 30), avc: /^\d{1,3} \d{1,3} \d{2,3}$/.test(String(c.avc || "")) ? String(c.avc) : "", soon: !!c.soon, hidden: !!c.hidden };
    });
  }
  if (k === "stories") {
    if (!Array.isArray(d) || d.length > 500) throw new Error("資料格式錯誤");
    const seen = new Set();
    return d.map((t) => {
      const id = String(t.id || ""); if (!ID_RE.test(id)) throw new Error("故事代號只能用小寫英文、數字和 -"); if (seen.has(id)) throw new Error("故事代號重複了：" + id); seen.add(id);
      const title = str(t.title, 80); if (!title) throw new Error("故事標題要填喔");
      const chars = Array.isArray(t.chars) ? [...new Set(t.chars.map(String).filter((x) => ID_RE.test(x)))].slice(0, 20) : [];
      return { id, title, chars, tags: TAGIDS(t.tags), cover: img(t.cover), summary: str(t.summary, 200), date: str(t.date, 20), editor: str(t.editor, 30), hidden: !!t.hidden };
    });
  }
  if (BLOG_RE.test(k)) {
    const h = String(d ?? ""); if (h.length > 80000) throw new Error("文章太長了");
    return sanitize(h);
  }
  throw new Error("未知的項目");
}
const getK = async (db, k) => { const r = await db.prepare("SELECT v FROM site WHERE k = ?").bind(k).first(); return r ? JSON.parse(r.v) : null; };

// Full-text search over story bodies and character blogs (public, read-only).
const plain = (h) => String(h || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
async function search(db, q) {
  const terms = String(q || "").toLowerCase().trim().split(/\s+/).filter(Boolean).slice(0, 5).map((t) => t.slice(0, 40));
  if (!terms.length) return [];
  const { results } = await db.prepare("SELECT k, v FROM site WHERE k LIKE 'blog\\_%' ESCAPE '\\' OR k LIKE 'story\\_%' ESCAPE '\\'").all();
  const rows = new Map((results || []).map((r) => [r.k, JSON.parse(r.v)]));
  for (const [id, h] of Object.entries(DEFAULTS.blogs || {})) if (!rows.has("blog_" + id)) rows.set("blog_" + id, h);
  const chars = (await getK(db, "chars")) || DEFAULTS.chars || [];
  const stories = (await getK(db, "stories")) || DEFAULTS.stories || [];
  const okChar = new Set(chars.filter((c) => !c.hidden && !c.soon).map((c) => c.id));
  const okStory = new Set(stories.filter((t) => !t.hidden).map((t) => t.id));
  const out = [];
  for (const [k, h] of rows) {
    const type = k.startsWith("blog_") ? "blog" : "story", id = k.slice(type === "blog" ? 5 : 6);
    if (type === "blog" ? !okChar.has(id) : !okStory.has(id)) continue;
    const txt = plain(h), low = txt.toLowerCase();
    if (!terms.every((t) => low.includes(t))) continue;
    const at = low.indexOf(terms[0]), from = Math.max(0, at - 30);
    out.push({ type, id, snip: (from ? "…" : "") + txt.slice(from, at + 60) + (at + 60 < txt.length ? "…" : "") });
    if (out.length >= 40) break;
  }
  return out;
}

export const onRequest = wrap(async ({ request: req, env }) => {
  const db = env.DB, url = new URL(req.url);
  if (req.method === "GET") {
    const sq = url.searchParams.get("search");
    if (sq != null) return J({ data: await search(db, sq) });
    const k = url.searchParams.get("k");
    if (k === "upd") return J({ data: (await getK(db, "upd")) || { chars: {}, stories: {} } });
    if (!okKey(k)) return J({ error: "未知的項目" }, 400);
    const d = await getK(db, k);
    return J({ data: d ?? (BLOG_RE.test(k) ? (k.startsWith("blog_") ? ((DEFAULTS.blogs || {})[k.slice(5)] || "") : "") : DEFAULTS[k]) });
  }
  if (req.method !== "POST") return J({ error: "不支援的請求" }, 405);
  if (!adminSecret(env)) return J({ error: "管理密碼還沒設定（admin_sceneey）" }, 503);
  if (!(await isAdmin(req, env))) { await sleep(800); return J({ error: "密碼不對喔" }, 401); }
  let b; try { b = await req.json(); } catch { return J({ error: "資料格式錯誤（檔案可能太大）" }, 400); }

  if (b.action === "save") {
    const k = b.k;
    if (!okKey(k)) return J({ error: "未知的項目" }, 400);
    let data; try { data = validate(k, b.data); } catch (e) { return J({ error: e.message }, 400); }
    const stmts = [db.prepare("INSERT OR REPLACE INTO site (k, v) VALUES (?, ?)").bind(k, JSON.stringify(data))];
    // record "last updated" dates (Asia/Taipei) for characters and stories
    try {
      const t = new Date(Date.now() + 8 * 3600e3), day = t.getUTCFullYear() + "." + String(t.getUTCMonth() + 1).padStart(2, "0") + "." + String(t.getUTCDate()).padStart(2, "0");
      const upd = (await getK(db, "upd")) || { chars: {}, stories: {} }; upd.chars = upd.chars || {}; upd.stories = upd.stories || {}; let ch = false;
      const diff = (oldList, group) => { const om = new Map((oldList || []).map((x) => [x.id, JSON.stringify(x)])); for (const x of data) if (om.get(x.id) !== JSON.stringify(x)) { upd[group][x.id] = day; ch = true; } };
      if (k === "chars") diff((await getK(db, "chars")) || DEFAULTS.chars, "chars");
      else if (k === "stories") diff((await getK(db, "stories")) || DEFAULTS.stories, "stories");
      else if (k.startsWith("blog_")) { const prev = await getK(db, k); if (prev !== data) { upd.chars[k.slice(5)] = day; ch = true; } }
      else if (k.startsWith("story_")) { const prev = await getK(db, k); if (prev !== data) { upd.stories[k.slice(6)] = day; ch = true; } }
      if (ch) stmts.push(db.prepare("INSERT OR REPLACE INTO site (k, v) VALUES (?, ?)").bind("upd", JSON.stringify(upd)));
    } catch (e) {}
    if (k === "gallery") {
      const old = (await getK(db, "gallery")) || [];
      const keep = new Set(data.map((g) => g.src));
      for (const g of old) if (g.src.startsWith("/api/media/") && !keep.has(g.src)) stmts.push(db.prepare("DELETE FROM media WHERE id = ?").bind(g.src.slice(11)));
    }
    await db.batch(stmts);
    return J({ ok: true, data });
  }
  if (b.action === "check") return J({ ok: true });
  // fetch an image shared from Google Drive ("anyone with the link") so the admin page can upload it like a local file
  if (b.action === "drive") {
    const m = String(b.link || "").match(/(?:\/d\/|[?&]id=|\/file\/d\/)([A-Za-z0-9_-]{20,})/) || String(b.link || "").match(/^([A-Za-z0-9_-]{25,})$/);
    if (!m) return J({ error: "看不懂這個連結，請貼 Google 雲端硬碟的檔案分享連結" }, 400);
    const id = m[1];
    for (const u of ["https://drive.google.com/thumbnail?id=" + id + "&sz=w2400", "https://drive.google.com/uc?export=download&id=" + id]) {
      try {
        const r = await fetch(u, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0" } });
        const ct = r.headers.get("content-type") || "";
        if (!r.ok || !ct.startsWith("image/")) continue;
        const buf = await r.arrayBuffer();
        if (buf.byteLength > 15 * 1024 * 1024) return J({ error: "圖片太大了（超過 15MB）" }, 413);
        return new Response(buf, { headers: { "content-type": ct, "cache-control": "no-store" } });
      } catch (e) {}
    }
    return J({ error: "讀不到這張圖。請確認雲端硬碟的分享設定是「知道連結的任何人都能檢視」，而且檔案是圖片" }, 400);
  }
  if (b.action === "unfurl") {
    // Link preview for the message wall: read the page's Open Graph tags and keep a copy of its picture
    // (social-site image links expire, so the picture is stored here like an upload).
    const u = String(b.url || "").trim();
    if (!/^https:\/\/[^\s"'<>]{1,500}$/.test(u)) return J({ error: "請貼 https:// 開頭的網址" }, 400);
    let html = "";
    try {
      const r = await fetch(u, { redirect: "follow", headers: { "user-agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", "accept-language": "zh-TW,zh;q=0.9" } });
      if (!r.ok) return J({ error: "對方網站拒絕讀取（" + r.status + "），可以自己填標題和圖片" }, 400);
      html = (await r.text()).slice(0, 400000);
    } catch (e) { return J({ error: "讀不到這個網址，可以自己填標題和圖片" }, 400); }
    const dec = (v) => String(v || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).trim();
    const meta = (...keys) => {
      for (const k of keys) {
        const re1 = new RegExp('<meta[^>]+(?:property|name)=["\']' + k + '["\'][^>]*content=["\']([^"\']*)', "i");
        const re2 = new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]*(?:property|name)=["\']' + k + '["\']', "i");
        const m = html.match(re1) || html.match(re2); if (m && m[1].trim()) return dec(m[1]);
      }
      return "";
    };
    const cut = (v, n) => { const a = Array.from(v); return a.length > n ? a.slice(0, n - 1).join("") + "…" : v; };
    const host = new URL(u).hostname.replace(/^www\./, "");
    const SITES = { "threads.net": "Threads", "threads.com": "Threads", "x.com": "X", "twitter.com": "X", "instagram.com": "Instagram", "facebook.com": "Facebook", "plurk.com": "Plurk", "youtube.com": "YouTube", "caveduck.io": "Caveduck", "dcard.tw": "Dcard" };
    const title = cut(meta("og:title", "twitter:title") || dec((html.match(/<title[^>]*>([^<]*)/i) || [])[1]), 120);
    const text = cut(meta("og:description", "twitter:description", "description"), 300);
    const site = cut(SITES[host] || meta("og:site_name") || host, 30);
    let pic = meta("og:image", "og:image:url", "twitter:image", "twitter:image:src"), src = "";
    if (pic) {
      try {
        const ir = await fetch(new URL(pic, u).href, { headers: { "user-agent": "Mozilla/5.0" } });
        const ct = (ir.headers.get("content-type") || "").split(";")[0];
        if (ir.ok && /^image\/(webp|jpeg|png)$/.test(ct)) {
          const bin = new Uint8Array(await ir.arrayBuffer());
          if (bin.length && bin.length <= 1900000) { const id = rid(); await db.prepare("INSERT INTO media (id, type, data, ts) VALUES (?, ?, ?, ?)").bind(id, ct, bin, Date.now()).run(); src = "/api/media/" + id; }
        }
      } catch (e) {}
    }
    if (!title && !text && !src) return J({ error: "這個網站沒有提供預覽資料（可能要登入才看得到），可以自己填標題和圖片" }, 400);
    return J({ ok: true, data: { kind: "link", url: u, site, title, text, img: src, name: "", date: "" } });
  }
  if (b.action === "upload") {
    const type = String(b.type || "");
    if (!/^image\/(webp|jpeg|png)$/.test(type)) return J({ error: "只能上傳圖片" }, 400);
    const bin = Uint8Array.from(atob(String(b.data || "")), (c) => c.charCodeAt(0));
    if (!bin.length || bin.length > 1900000) return J({ error: "圖片太大了（壓縮後要小於 1.9MB）" }, 400);
    const id = rid();
    await db.prepare("INSERT INTO media (id, type, data, ts) VALUES (?, ?, ?, ?)").bind(id, type, bin, Date.now()).run();
    return J({ ok: true, src: "/api/media/" + id });
  }
  return J({ error: "未知的動作" }, 400);
});
