// Suspensions for the event manager area. Login (Netlify Identity, role "admin") required.
// GET    -> { items: [...] }
// POST   { id?, name, allPlayers, team, start, end } -> saves (adds or updates) one suspension, returns { item }
// DELETE ?id=... -> removes one suspension, returns { id }
import { connectLambda } from "@netlify/blobs";
import { openStore } from "../lib/shared.mjs";

const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || "") && !isNaN(new Date(s + "T00:00:00Z"));
const clean = (s, max) => String(s ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const json = (statusCode, body) => ({ statusCode, headers: { "content-type": "application/json", "cache-control": "no-store" }, body: JSON.stringify(body) });

export function validate(input) {
  const allPlayers = !!input.allPlayers;
  const item = {
    id: clean(input.id, 40) || Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: allPlayers ? "All players" : clean(input.name, 80),
    allPlayers, team: clean(input.team, 80),
    start: clean(input.start, 10), end: clean(input.end, 10)
  };
  if (!allPlayers && !item.name) return { error: "Enter the player's name, or tick Whole team." };
  if (!item.team) return { error: "Enter the team." };
  if (!isDate(item.start) || !isDate(item.end)) return { error: "Enter a start and an end date." };
  if (item.end < item.start) return { error: "The end date is before the start date." };
  return { item };
}

// One record per suspension, so two saves close together can never overwrite each other.
export async function handle({ method, query, body, user, store }) {
  const roles = user?.app_metadata?.roles || [];
  if (!user) return json(401, { error: "Please log in." });
  if (!roles.includes("admin")) return json(403, { error: "This login has not been given event manager access." });
  if (method === "GET") {
    const { blobs } = await store.list({ prefix: "s/" });
    const items = (await Promise.all(blobs.map(b => store.get(b.key, { type: "json" })))).filter(Boolean);
    return json(200, { items });
  }
  if (method === "POST") {
    let input; try { input = JSON.parse(body || "{}"); } catch { return json(400, { error: "Bad request." }); }
    const { item, error } = validate(input);
    if (error) return json(400, { error });
    item.updatedBy = user.email || ""; item.updatedAt = new Date().toISOString();
    await store.setJSON("s/" + item.id, item);
    return json(200, { item });
  }
  if (method === "DELETE") {
    const id = clean(query?.id, 40);
    if (!id) return json(400, { error: "Bad request." });
    await store.delete("s/" + id);
    return json(200, { id });
  }
  return json(405, { error: "Method not allowed." });
}

export const handler = async (event, context) => {
  connectLambda(event);
  return handle({
    method: event.httpMethod, query: event.queryStringParameters, body: event.body,
    user: context.clientContext && context.clientContext.user,
    store: openStore("suspensions")
  });
};
