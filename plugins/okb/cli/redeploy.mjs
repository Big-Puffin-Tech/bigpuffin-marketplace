// okb redeploy: deploys named Big Puffin hosted functions again in the business's Supabase project, from Big Puffin's
// connector, as an upgrade that changes a function asks. An administrator runs it in their own folder, signed in.
//
//   node okb.mjs redeploy <function> [<function> ...] [--folder <folder>]
//
// It fetches the functions from Big Puffin's connector, POST /api/functions, with the person's saved sign-in, which the
// connector takes only from an administrator of a business it has confirmed, with its subscription on. Only then does it
// ask for a Supabase access token at a hidden prompt, used for this run alone. It deploys each named function through
// Supabase's Management API, with its files and verify_jwt as the connector gives them, then lists the project's
// functions and checks each one is there with that verify_jwt. It prints one line per function, and exits 0 when each
// is deployed and checked, 2 for bad arguments, and 1 otherwise.
//
// A system connector's name, such as shopify, is refused: the connectors run in Big Puffin's connector alone.
//
// The token and the sign-in go on no command line, into no environment variable, file or log, and are never printed.
// OKB_TEST_MANAGEMENT_API and OKB_TEST_BIGPUFFIN_SITE name loopback stand-ins, as for okb setup --owner.
import process, { stdout } from "node:process";
import { resolve } from "node:path";
import { statSync } from "node:fs";
import { API, apiBase, askHidden as terminalHidden, deployFunction, functionsList, managementClient, Refused } from "./management.mjs";
import { TOKEN_OPTIONS, TOKEN_PAGE } from "./connector-settings.mjs";
import { siteBase } from "./owner-setup.mjs";
import { fetchFunctions, Unfetched } from "./hosted-functions.mjs";
import { readActor } from "../mcp/lib/actor-file.mjs";
import { sessionAccess } from "../mcp/lib/session.mjs";

export const REDEPLOY_USAGE = `Usage: node okb.mjs redeploy <function> [<function> ...] [--folder <folder>]

redeploy deploys Big Puffin's hosted functions you name again in your business's Supabase project, from Big Puffin's
connector, as an upgrade asks. You run it as an administrator, in your own signed-in folder, or name it with --folder.
It then asks for a Supabase access token, which you make at ${TOKEN_PAGE}. ${TOKEN_OPTIONS}
Delete it on that page once every line says done.`;

/** Big Puffin's system connectors, which run in Big Puffin's connector alone and are never deployed to a business's project. */
export const SYSTEM_CONNECTORS = ["shopify", "mintsoft", "vls", "vls-webhook", "farfill", "slack"];

const said = err => (err instanceof Error ? err.message : String(err)).replace(/\s+/g, " ").trim().replace(/([^.!?…])$/, "$1.");

/** The function names and --folder, checked. Throws a plain sentence for anything else. */
export function options(argv, cwd = process.cwd()) {
  const names = [];
  let folder = cwd;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--folder") {
      if (argv[i + 1] === undefined) throw new Error("--folder needs a value.");
      folder = argv[++i];
    } else if (argv[i].startsWith("-")) throw new Error(`${argv[i]} is not an option of redeploy.`);
    else names.push(argv[i]);
  }
  if (!names.length) throw new Error("redeploy needs the name of at least one function, such as okb-upgrade.");
  if (!names.every(n => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(n))) throw new Error(`${names.find(n => !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(n))} is not a function's name.`);
  const connector = names.find(n => SYSTEM_CONNECTORS.includes(n));
  if (connector) throw new Error(`${connector} is one of Big Puffin's system connectors, which Big Puffin's connector hosts and runs. Nothing is deployed to your business's project for it: an administrator connects an account with show_connector_setup.`);
  let isFolder = false;
  try { isFolder = statSync(folder).isDirectory(); } catch { isFolder = false; }
  if (!isFolder) throw new Error(`${folder} is not a folder.`);
  return { names: [...new Set(names)], folder: resolve(folder) };
}

/** Deploys the named functions again. Returns the exit code. */
export async function redeploy(argv, {
  askHidden = terminalHidden, say = line => stdout.write(`${line}\n`), base = apiBase(), site, env = process.env, cwd = process.cwd(),
} = {}) {
  site = base === API ? siteBase(API, env) : site ?? siteBase(base, env);
  let o;
  try { o = options(argv, cwd); } catch (err) { say(`${err.message}\n${REDEPLOY_USAGE}`); return 2; }
  if (base !== API) say(`This run talks to a test stand-in at ${base}, not to Supabase. Paste no real token.`);
  if (site !== siteBase(API, env)) say(`This run talks to a test stand-in at ${site}, not to Big Puffin's connector.`);
  const actor = readActor(o.folder);
  if (!actor?.ok) { say(`${o.folder} is not signed in to a business. Run node okb.mjs sign-in --folder "${o.folder}" first.`); return 1; }
  const { project_ref: ref, auth_email: email } = actor.value;
  const access = await sessionAccess(ref, email);
  if (!access.ok) { say(`Your sign-in could not be used: ${said(access.problem)} Run node okb.mjs sign-in --folder "${o.folder}", then run this again.`); return 1; }

  let bundle;
  try { bundle = await fetchFunctions(site, { token: access.token }, []); }
  catch (err) {
    if (!(err instanceof Unfetched)) throw err;
    say(err.status === 403 ? `Big Puffin's connector refused: ${said(err)}` : `Fetching Big Puffin's hosted functions: failed. ${said(err)} Run this again later.`);
    return 1;
  }
  const unknown = o.names.filter(n => !bundle.functions.some(f => f.name === n));
  if (unknown.length) { say(`Big Puffin has no hosted function called ${unknown.join(", ")}. It has ${bundle.functions.map(f => f.name).join(", ")}.`); return 2; }
  say("Fetching Big Puffin's hosted functions: done.");

  say(`Make a Supabase access token at ${TOKEN_PAGE}. ${TOKEN_OPTIONS} Paste it here, and delete it on that page once this is done.`);
  let token;
  try { token = await askHidden("Supabase access token: "); }
  catch (err) { say(`Stopped: ${said(err)}`); return 1; }
  if (!token) { say("No token was pasted. Run this again, and paste the token at the prompt."); return 1; }
  const c = managementClient(token, base);
  token = undefined;
  let failed = false;
  try {
    for (const name of o.names) {
      const f = bundle.functions.find(x => x.name === name);
      try {
        await deployFunction(c, ref, { name: f.name, entrypoint: f.entrypoint_path, verifyJwt: f.verify_jwt, files: f.files.map(x => ({ name: x.name, text: x.text })) });
      } catch (err) {
        if (err instanceof Refused && (err.status === 401 || err.status === 403)) throw err;
        failed = true;
        say(`Deploying ${name}: failed. Supabase said: ${said(err)}`);
      }
    }
    const listed = await functionsList(c, ref);
    for (const name of o.names) {
      const f = bundle.functions.find(x => x.name === name);
      const there = listed.find(d => d.slug === name);
      if (there && there.verify_jwt === f.verify_jwt) say(`${name}, with JWT verification ${f.verify_jwt ? "on" : "off"}: done.`);
      else { failed = true; say(`${name}: not deployed as it should be. The project's list shows it ${there ? `with JWT verification ${there.verify_jwt ? "on" : "off"}` : "missing"}.`); }
    }
  } catch (err) {
    if (err instanceof Refused && (err.status === 401 || err.status === 403)) say(`Supabase refused the token: ${said(err)} Make a new one at ${TOKEN_PAGE}, and run this again.`);
    else say(`Redeploying: failed. ${said(err)}`);
    return 1;
  }
  return failed ? 1 : 0;
}
