// Cloudflare Worker entry: /api/* goes to the handlers, everything else is the static site in public/.
import { onRequest as gb } from "../functions/api/gb.js";
import { onRequest as site } from "../functions/api/site.js";
import { onRequestGet as media } from "../functions/api/media/[id].js";
import { DEFAULTS } from "../lib/cf/defaults.js";

// Link previews (Open Graph): every public page gets title / description / image;
// /c/<id> and /story/<id> use that character's or story's own name, one-liner and picture.
const SITE = "Sceneey's Studio";
const DESC = "Sceneey 的 AIRP 創作小站：在鴨答 Caveduck 創作角色。世界觀、角色、故事與藝廊都在這裡。";
const TITLES = { "/": SITE, "/news": "NEWS", "/world": "WORLD", "/characters": "CHARACTERS", "/story": "STORY", "/gallery": "GALLERY", "/qa": "Q&A", "/armentary": "ARMENTARY 神器與契約", "/maroplis": "MAROPLIS 烏托邦", "/wujie": "WUJIE 五界" };
const esc = (v) => String(v || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const getK = async (env, k) => { try { const r = await env.DB.prepare("SELECT v FROM site WHERE k = ?").bind(k).first(); return r ? JSON.parse(r.v) : null; } catch { return null; } };
async function ogFor(url, env) {
  const p = url.pathname.replace(/^\/m(?=\/|$)/, "").replace(/\/$/, "").replace(/\.html$/, "") || "/";
  if (p === "/admin" || p.startsWith("/admin-")) return null;
  let title = TITLES[p] ? (p === "/" ? SITE : TITLES[p] + "・" + SITE) : SITE, desc = DESC, image = "/og.jpg";
  const cm = p.match(/^\/c\/([a-z0-9-]{1,40})$/), sm = p.match(/^\/story\/([a-z0-9-]{1,40})$/);
  if (cm) {
    const c = ((await getK(env, "chars")) || DEFAULTS.chars || []).find((x) => x.id === cm[1] && !x.hidden && !x.soon);
    if (c) { title = c.name + "・" + SITE; desc = c.one || desc; image = c.banner || c.img || image; }
  } else if (sm) {
    const t = ((await getK(env, "stories")) || DEFAULTS.stories || []).find((x) => x.id === sm[1] && !x.hidden);
    if (t) { title = t.title + "・" + SITE; desc = t.summary || desc; image = t.cover || image; }
  }
  const canon = url.origin + (url.pathname.replace(/^\/m(?=\/|$)/, "") || "/");
  return { title, desc, image: url.origin + image, url: canon || url.origin + "/" };
}
async function withOg(res, url, env) {
  if (!(res.headers.get("content-type") || "").includes("text/html")) return res;
  const og = await ogFor(url, env);
  if (!og) return res;
  const tags = [
    ["property", "og:type", "website"], ["property", "og:site_name", SITE], ["property", "og:title", og.title], ["property", "og:description", og.desc],
    ["property", "og:image", og.image], ["property", "og:url", og.url], ["property", "og:locale", "zh_TW"],
    ["name", "twitter:card", "summary_large_image"], ["name", "twitter:title", og.title], ["name", "twitter:description", og.desc], ["name", "twitter:image", og.image],
    ["name", "description", og.desc],
  ].map(([a, k, v]) => `<meta ${a}="${k}" content="${esc(v)}">`).join("\n");
  return new HTMLRewriter()
    .on('meta[name="description"]', { element: (e) => e.remove() })
    .on("head", { element: (e) => e.append("\n" + tags + "\n", { html: true }) })
    .transform(res);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const base = { request, env, waitUntil: (p) => ctx.waitUntil(p), params: {} };
    if (url.pathname === "/api/gb") return gb(base);
    if (url.pathname === "/api/site") return site(base);
    const m = url.pathname.match(/^\/api\/media\/([^/]+)$/);
    if (m) {
      if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
      return media({ ...base, params: { id: m[1] } });
    }
    if (url.pathname === "/zl7893" || url.pathname === "/zl7893.html") return Response.redirect(url.origin + "/c/zl", 301);
    const cm = url.pathname.match(/^(\/m)?\/c\/[a-z0-9-]{1,40}\/?$/);
    if (cm) return withOg(await env.ASSETS.fetch(new Request(url.origin + (cm[1] || "") + "/c", request)), url, env);
    const sm = url.pathname.match(/^(\/m)?\/story\/[a-z0-9-]{1,40}\/?$/);
    if (sm) return withOg(await env.ASSETS.fetch(new Request(url.origin + (sm[1] || "") + "/story-page", request)), url, env);
    return withOg(await env.ASSETS.fetch(request), url, env);
  },
};
