// Big Puffin's system connectors, from Claude Code. They run in Big Puffin's connector, never on this computer and never
// in the business's own project, so each tool here posts to it with the person's saved sign-in.
//
// system takes what the connector's own system tool takes: connector, account, action, input, record_id,
// idempotency_key and preview. It runs a read, or a write's preview alone. A write runs only from the approval card's
// Yes, which the connector's show_approval shows.
//
// connect takes no key and opens nothing: it sends the administrator to Big Puffin's connector setup card,
// show_connector_setup, which is the one place an account's keys are typed, so a key never passes through the model,
// the chat or a tool's arguments.

/** Big Puffin's connector. OKB_CONNECTOR_URL may name another, on this computer alone, for a test. */
export function connectorOrigin(env = process.env) {
  const given = env.OKB_CONNECTOR_URL;
  if (given && /^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}$/.test(given)) return given;
  return "https://mcp.bigpuffin.dev";
}

/** One request to Big Puffin's connector as the person: its JSON answer, or { ok: false, problem }. */
async function post(origin, token, path, body, method = "POST") {
  let res;
  try {
    res = await fetch(`${origin}${path}`, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(120_000) });
  } catch (err) {
    return { ok: false, problem: `Big Puffin's connector did not answer: ${err instanceof Error ? err.message : String(err)}` };
  }
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  if (json && typeof json === "object" && !Array.isArray(json)) return res.ok ? json : { ok: false, ...json, problem: json.problem ?? `Big Puffin's connector answered ${res.status}.` };
  return { ok: false, problem: `Big Puffin's connector answered ${res.status}.` };
}

export const SYSTEM_TOOL = {
  name: "system",
  description: "Call one of Big Puffin's system connectors, shopify, mintsoft, vls, farfill or slack, in one of the business's connected accounts, as the signed-in person, through Big Puffin's connector. " +
    "Give connector, account, action and the action's own inputs as input, each value from the routine in force, through the workflow plugin's section. " +
    "A read runs as it is. A write runs here only as its preview, with preview true, record_id and idempotency_key: it gives the payload and sends the system nothing that changes it. " +
    "To make the write, show it with the Big Puffin connector's show_approval as { call: { function: \"system\", args } }, args as here without preview; the card's Yes runs it once. " +
    "An account no administrator has connected is refused: the connector setup card, show_connector_setup, is where an administrator connects one. Never ask for a key in the chat.",
  inputSchema: {
    type: "object",
    properties: {
      connector: { type: "string", enum: ["shopify", "mintsoft", "vls", "farfill", "slack"], description: "The system." },
      account: { type: "string", description: "The account's name, as the business named it when an administrator connected it." },
      action: { type: "string", description: "The connector's action, as its guide names it." },
      input: { type: "object", additionalProperties: true, description: "The action's own inputs, as the connector's guide gives them." },
      record_id: { type: "string", description: "The record the call is for: required for a write, which is logged against it." },
      idempotency_key: { type: "string", description: "A write's key: a repeat with the same key gives the first answer and changes nothing." },
      preview: { type: "boolean", description: "true for a write's preview, which sends the system nothing that changes it." },
    },
    required: ["connector", "account", "action"],
    additionalProperties: false,
  },
};

export const CONNECT_TOOL = {
  name: "connect",
  description: "Say how an administrator connects one account of one of Big Puffin's system connectors: on Big Puffin's connector setup card, show_connector_setup, " +
    "where they choose the system, name the account and type its keys. This tool takes no key and opens nothing. Never ask for a key in the chat. Administrators only.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
};

/** The system tool: the connector's answer. */
export async function callSystem(access, args, origin = connectorOrigin()) {
  const session = await access();
  if (!session.ok) return session;
  const keys = ["connector", "account", "action", "input", "record_id", "idempotency_key", "preview"];
  const extra = Object.keys(args ?? {}).filter((k) => !keys.includes(k));
  if (extra.length) return { ok: false, problem: `system does not take ${extra.join(", ")}. It takes ${keys.join(", ")}.` };
  return await post(origin, session.token, "/api/system", args ?? {});
}

/** The connect tool: it takes no key and opens no page. It names the connector setup card, which Big Puffin's connector
 * shows in Claude Code as in claude.ai, and where alone an account's keys are typed. */
export async function openConnect(access) {
  const session = await access();
  if (!session.ok) return session;
  return { ok: true, card: "show_connector_setup",
    said: "Connect the account on Big Puffin's connector setup card: call Big Puffin's connector's show_connector_setup, with the system and account if they are known. The administrator types the keys on the card, which checks them with the system. End the turn once the card is shown. Never ask for a key in the chat." };
}
