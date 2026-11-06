import { getStore } from "@netlify/blobs";
import { handle } from "../lib/gb-core.mjs";

export default async (req, context) => {
  try {
    return await handle(req, context, getStore({ name: "guestbook", consistency: "strong" }));
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: "伺服器出了點問題，請稍後再試" }), {
      status: 500, headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
};

export const config = { path: "/api/gb" };
