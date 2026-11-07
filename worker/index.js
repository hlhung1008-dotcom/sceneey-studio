// Cloudflare Worker entry: /api/* goes to the handlers, everything else is the static site in public/.
import { onRequest as gb } from "../functions/api/gb.js";
import { onRequest as site } from "../functions/api/site.js";
import { onRequestGet as media } from "../functions/api/media/[id].js";

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
    return env.ASSETS.fetch(request);
  },
};
