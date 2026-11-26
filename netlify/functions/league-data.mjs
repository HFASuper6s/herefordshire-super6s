// Fixtures and results for each league, uploaded weekly by the event manager from the Full-Time export.
// GET ?l=thursday -> { fixtures:[...], updated }   (public)
// POST { league, fixtures:[...] }                  (event manager only)
import { connectLambda } from "@netlify/blobs";
import { json, adminError, openStore, isLeague, withoutBy } from "../lib/shared.mjs";

const str = (v, n) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
const score = v => (Number.isInteger(v) && v >= 0 && v < 100 ? v : null);
export function cleanFixtures(list) {
  if (!Array.isArray(list) || list.length > 2000) return null;
  const out = list.map(f => ({
    ymd: /^\d{4}-\d{2}-\d{2}$/.test(f.ymd) ? f.ymd : "", time: str(f.time, 5), division: str(f.division, 60),
    home: str(f.home, 80), away: str(f.away, 80), pitch: str(f.pitch, 40), hs: score(f.hs), as: score(f.as),
    ...(f.ft === true ? { ft: true } : {})   // filled in from Full-Time's snippets rather than an upload
  })).filter(f => f.home && f.away);
  return out.length ? out : null;
}
export async function handle({ method, query, body, user, store }) {
  if (method === "GET") {
    const l = query?.l; if (!isLeague(l)) return json(400, { error: "Unknown league." });
    const data = await store.get("league/" + l, { type: "json" });
    return json(200, withoutBy(data) || { fixtures: [] }, { "cache-control": "public, max-age=60" });
  }
  const err = adminError(user); if (err) return err;
  if (method === "POST") {
    let input; try { input = JSON.parse(body || "{}"); } catch { return json(400, { error: "Bad request." }); }
    if (!isLeague(input.league)) return json(400, { error: "Unknown league." });
    const fixtures = cleanFixtures(input.fixtures);
    if (!fixtures) return json(400, { error: "No fixtures found in that file." });
    // An upload replaces everything (so uploaded scores always win). A Full-Time sync keeps the upload date.
    const now = new Date().toISOString(), prev = input.sync ? await store.get("league/" + input.league, { type: "json" }) : null;
    const data = input.sync && prev ? { ...prev, fixtures, synced: now } : { fixtures, updated: now, by: user.email || "" };
    await store.setJSON("league/" + input.league, data);
    return json(200, { count: fixtures.length, played: fixtures.filter(f => f.hs != null).length, updated: data.updated, synced: data.synced });
  }
  return json(405, { error: "Method not allowed." });
}
export const handler = async (event, context) => {
  connectLambda(event);
  return handle({ method: event.httpMethod, query: event.queryStringParameters, body: event.body,
    user: context.clientContext && context.clientContext.user, store: openStore("league-data") });
};
