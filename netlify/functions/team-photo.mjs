// Team photos taken by the event manager.
// GET ?l=thursday&t=team-slug -> the JPEG (public)     GET ?l=thursday&list=1 -> { teams:[slugs] }
// POST { league, team, image: "data:image/jpeg;base64,..." }   DELETE ?l=..&t=..   (event manager only)
import { connectLambda } from "@netlify/blobs";
import { json, adminError, openStore, isLeague, cleanSlug } from "../lib/shared.mjs";
const MAX = 1_500_000; // bytes after decoding (the page shrinks photos to well under this)

export async function handle({ method, query, body, user, store }) {
  if (method === "GET") {
    const l = query?.l; if (!isLeague(l)) return json(400, { error: "Unknown league." });
    if (query.list) { const { blobs } = await store.list({ prefix: l + "/" }); return json(200, { teams: blobs.map(b => b.key.split("/")[1]) }, { "cache-control": "public, max-age=60" }); }
    const t = cleanSlug(query.t); if (!t) return json(400, { error: "Unknown team." });
    const data = await store.get(`${l}/${t}`, { type: "arrayBuffer" });
    if (!data) return { statusCode: 404, headers: { "cache-control": "public, max-age=60" }, body: "" };
    return { statusCode: 200, isBase64Encoded: true, headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=300" }, body: Buffer.from(data).toString("base64") };
  }
  const err = adminError(user); if (err) return err;
  if (method === "POST") {
    let input; try { input = JSON.parse(body || "{}"); } catch { return json(400, { error: "Bad request." }); }
    const l = input.league, t = cleanSlug(input.team);
    if (!isLeague(l) || !t) return json(400, { error: "Pick a league and team." });
    const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(input.image || "");
    if (!m) return json(400, { error: "That photo could not be read. Please try again." });
    const buf = Buffer.from(m[1], "base64");
    if (buf.length > MAX) return json(413, { error: "That photo is too large." });
    if (buf[0] !== 0xff || buf[1] !== 0xd8) return json(400, { error: "That photo could not be read. Please try again." });
    await store.set(`${l}/${t}`, buf, { metadata: { by: user.email || "", at: new Date().toISOString() } });
    return json(200, { ok: true, bytes: buf.length });
  }
  if (method === "DELETE") {
    const l = query?.l, t = cleanSlug(query?.t);
    if (!isLeague(l) || !t) return json(400, { error: "Bad request." });
    await store.delete(`${l}/${t}`); return json(200, { ok: true });
  }
  return json(405, { error: "Method not allowed." });
}
export const handler = async (event, context) => {
  connectLambda(event);
  return handle({ method: event.httpMethod, query: event.queryStringParameters, body: event.body,
    user: context.clientContext && context.clientContext.user, store: openStore("team-photos") });
};
