// Big Puffin's hosted functions, fetched from Big Puffin's connector at deploy time: okb setup --owner fetches them with
// the one-time setup key Big Puffin gave the owner, and okb redeploy with the administrator's own sign-in. The functions'
// source is kept in Big Puffin's own repository, not in this plugin. The connector answers JSON: bundle, the SHA-256 of the
// functions' JSON, and functions, each with its name, verify_jwt, entrypoint_path and files, each file with its name and
// text. The answer is checked whole before anything is deployed from it. The key and the token are sent to the connector
// alone, and never printed, saved or logged.
import { createHash } from "node:crypto";

/** The address a business's setup, and a redeploy, fetches the functions from, on Big Puffin's connector. */
export const functionsUrl = site => `${site}/api/functions`;

/** A Stop for a fetch that failed, with the line the person reads. */
export class Unfetched extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

/**
 * The functions from the connector's answer, each as { name, verify_jwt, entrypoint_path, files: [{ name, text }] }, once
 * the answer's hash holds and every function the list names is there with its verify_jwt. Throws Unfetched otherwise.
 */
export function checkBundle(body, expected) {
  const list = body?.functions;
  if (!Array.isArray(list) || typeof body.bundle !== "string") throw new Unfetched("Big Puffin's connector's answer is not the hosted functions.");
  const hash = createHash("sha256").update(JSON.stringify(list), "utf8").digest("hex");
  if (hash !== body.bundle) throw new Unfetched("The hosted functions from Big Puffin's connector did not arrive whole.");
  const ok = f => f && typeof f.name === "string" && typeof f.verify_jwt === "boolean" && typeof f.entrypoint_path === "string"
    && Array.isArray(f.files) && f.files.length > 0 && f.files.every(x => typeof x?.name === "string" && typeof x?.text === "string");
  if (!list.every(ok)) throw new Unfetched("Big Puffin's connector's answer is not the hosted functions.");
  const missing = expected.filter(e => !list.some(f => f.name === e.name && f.verify_jwt === e.verify_jwt)).map(e => e.name);
  if (missing.length) throw new Unfetched(`Big Puffin's connector's hosted functions lack ${missing.join(", ")}, or give them another JWT setting.`);
  return { bundle: body.bundle, functions: list };
}

/**
 * Fetches the functions: with { projectUrl, publishableKey, setupKey } as a setup does, or with { token } as a signed-in administrator does.
 * Returns { bundle, functions }, or throws Unfetched with its status: 403 when the connector refused, 0 when it could not be
 * reached, and its HTTP status otherwise.
 */
export async function fetchFunctions(site, { projectUrl, publishableKey, setupKey, token }, expected, { fetcher = fetch } = {}) {
  const init = token
    ? { method: "POST", headers: { authorization: `Bearer ${token}` } }
    : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project_url: projectUrl, publishable_key: publishableKey, setup_key: setupKey }) };
  let res;
  try { res = await fetcher(functionsUrl(site), init); }
  catch (err) { throw new Unfetched(`Big Puffin's connector could not be reached: ${err?.cause?.code ?? err?.message ?? err}.`, 0); }
  if (res.status === 403) {
    const said = (await res.text().catch(() => "")).trim();
    throw new Unfetched(said || "Big Puffin's connector refused.", 403);
  }
  if (res.status !== 200) { await res.arrayBuffer().catch(() => null); throw new Unfetched(`Big Puffin's connector answered HTTP ${res.status}.`, res.status); }
  let body;
  try { body = await res.json(); } catch { throw new Unfetched("Big Puffin's connector's answer is not the hosted functions.", 200); }
  return checkBundle(body, expected);
}
