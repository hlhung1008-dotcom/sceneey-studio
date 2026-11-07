// Serves images uploaded from the admin page (stored in D1), cached at the edge.
import { wrap } from "../../../lib/cf/common.js";
export const onRequestGet = wrap(async ({ request, env, params, waitUntil }) => {
  const id = String(params.id || "");
  if (!/^[a-z0-9]{6,40}$/.test(id)) return new Response("Not found", { status: 404 });
  const cache = caches.default;
  const hit = await cache.match(request);
  if (hit) return hit;
  const row = await env.DB.prepare("SELECT type, data FROM media WHERE id = ?").bind(id).first();
  if (!row) return new Response("Not found", { status: 404 });
  const res = new Response(new Uint8Array(row.data), { headers: { "content-type": row.type, "cache-control": "public, max-age=31536000, immutable" } });
  waitUntil(cache.put(request, res.clone()));
  return res;
});
