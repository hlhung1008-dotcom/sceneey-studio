import { getStore } from "@netlify/blobs";
import { serveMedia } from "../lib/site-core.mjs";
export default async (req, context) => serveMedia(context.params && context.params.id, getStore({ name: "media", consistency: "strong" }));
export const config = { path: "/api/media/:id" };
