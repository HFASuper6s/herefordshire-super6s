// News posts written by the event manager.
// GET -> { posts:[...] } (public, newest first)      GET ?img=<id> -> the post's picture (public)
// POST { id?, title, date, body, link, linkLabel, image? (data:image/jpeg;base64) } -> saves one post (event manager only)
// DELETE ?id=... -> removes a post and its picture (event manager only)
import { connectLambda } from "@netlify/blobs";
import { json, adminError, openStore, cleanSlug, withoutBy } from "../lib/shared.mjs";
const str = (v, n) => String(v ?? "").trim().slice(0, n);
export async function handle({ method, query, body, user, store }) {
  if (method === "GET") {
    if (query?.img) {
      const data = await store.get("img/" + cleanSlug(query.img), { type: "arrayBuffer" });
      if (!data) return { statusCode: 404, body: "" };
      return { statusCode: 200, isBase64Encoded: true, headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=300" }, body: Buffer.from(data).toString("base64") };
    }
    const { blobs } = await store.list({ prefix: "post/" });
    const posts = (await Promise.all(blobs.map(b => store.get(b.key, { type: "json" })))).filter(Boolean).map(withoutBy).sort((a, b) => b.date.localeCompare(a.date));
    return json(200, { posts }, { "cache-control": "public, max-age=60" });
  }
  const err = adminError(user); if (err) return err;
  if (method === "POST") {
    let i; try { i = JSON.parse(body || "{}"); } catch { return json(400, { error: "Bad request." }); }
    const post = { id: cleanSlug(i.id) || Date.now().toString(36), title: str(i.title, 120), date: str(i.date, 10), body: str(i.body, 4000),
      link: /^https?:\/\//.test(i.link || "") ? str(i.link, 500) : "", linkLabel: str(i.linkLabel, 40), hasImage: !!i.keepImage, by: user.email || "" };
    if (!post.title) return json(400, { error: "Add a title." });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(post.date)) return json(400, { error: "Add a date." });
    if (i.image) {
      const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(i.image); if (!m) return json(400, { error: "That picture could not be read." });
      const buf = Buffer.from(m[1], "base64"); if (buf.length > 1_500_000) return json(413, { error: "That picture is too large." });
      await store.set("img/" + post.id, buf); post.hasImage = true;
    } else if (i.removeImage) { await store.delete("img/" + post.id); post.hasImage = false; }
    await store.setJSON("post/" + post.id, post);
    return json(200, { post });
  }
  if (method === "DELETE") {
    const id = cleanSlug(query?.id); if (!id) return json(400, { error: "Bad request." });
    await store.delete("post/" + id); await store.delete("img/" + id); return json(200, { id });
  }
  return json(405, { error: "Method not allowed." });
}
export const handler = async (event, context) => { connectLambda(event);
  return handle({ method: event.httpMethod, query: event.queryStringParameters, body: event.body, user: context.clientContext && context.clientContext.user, store: openStore("news") }); };
