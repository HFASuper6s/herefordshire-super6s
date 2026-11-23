// Shared helpers for the site's functions: login check and Netlify Blobs store.
import { getStore } from "@netlify/blobs";
export const json = (statusCode, body, extra = {}) => ({ statusCode, headers: { "content-type": "application/json", "cache-control": "no-store", ...extra }, body: JSON.stringify(body) });
export function adminError(user) {
  if (!user) return json(401, { error: "Please log in." });
  if (!(user.app_metadata?.roles || []).includes("admin")) return json(403, { error: "This login has not been given event manager access." });
  return null;
}
// Strong consistency where the platform offers it, so a save shows straight away
export function openStore(name) {
  const plain = getStore(name);
  let strong; try { strong = getStore({ name, consistency: "strong" }); } catch { return plain; }
  const wrap = fn => async (...a) => { try { return await strong[fn](...a); } catch (e) { if (/consistency/i.test(e.message)) return plain[fn](...a); throw e; } };
  return { list: wrap("list"), get: wrap("get"), getWithMetadata: wrap("getWithMetadata"), set: wrap("set"), setJSON: wrap("setJSON"), delete: wrap("delete") };
}
// League ids come from each county's settings; any short lower-case id is accepted
export const isLeague = l => /^[a-z0-9-]{1,30}$/.test(String(l || ""));
export const cleanSlug = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
