// Keeps the database operator and the business analyst to the okb plugin's tools, Claude in Chrome's tools that
// open and read a page, never at a Supabase address, for the database operator every connector and plugin the person has
// but those REFUSED_SERVERS and SUPABASE_TOOLS name, and the built-in tools in BUILT_IN, beside each agent's disallowedTools. Every other MCP tool is refused,
// the Supabase connector's among them, since it reaches past OKB's grants. Read reads a skill's own files, inside the
// installed plugins' folder, and the files in each folder added to the session. Glob and Grep search those added folders
// alone, and copy_to_agent_folder copies a file from one into the agent folder. For run_code, from any agent or session,
// on any server whose tool is named run_code, it saves those folders for the session's folder, and run_code reads them alone. Reads the tool
// call from stdin, as Claude Code's PreToolUse hooks receive it; any other agent's calls go ahead. The business analyst is
// held in every folder, before, during and after setup, since okb setup --owner does setup's work on the owner's computer.
// one-issue.mjs, agent-folder-edit.mjs and connector-agreed.mjs take their agents from AGENTS here.
//
// A connector's tools go ahead only on its own server, and only once the person has agreed in the session. The first
// call to each connector in a session is put to the person in Claude Code's permission prompt, with
// permissionDecision "ask". connector-agreed.mjs, a PostToolUse hook, which runs only once a call has run, so once the
// person allowed it, records the connector as agreed for the session, and its later calls go ahead.
//
// Claude Code names no added folder in a hook's input. The session's transcript, at transcript_path, holds them in its
// environment attachment, written with the session's first message: {"type": "attachment", "attachment": {"type":
// "environment", "snapshot": {"additionalWorkingDirectories": ["/Users/you/Downloads"]}}}. A folder added later in the
// session is in no attachment, so the agent reads it only in a new session.
import { closeSync, openSync, readFileSync, readSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { argv, env, stdin, stdout } from "node:process";
import { saveSessionFolders } from "../mcp/lib/code.mjs";
import { fileURLToPath } from "node:url";

// The okb server's tools, as Claude Code names a plugin's server: plugin_<plugin>_<server>.
export const SERVER = "plugin_okb_okb";
export const OKB = ["whoami", "rpc", "call_function", "upload_file", "list_files", "download_file", "read_file",
  "draw_graph", "draw_search", "draw_board", "draw_state_machine", "state_machine_payload", "draw_reference", "draw_sop", "report_page", "print_pdf",
  "embed_pictures", "check_text", "update_plugins", "check_plugins", "copy_to_agent_folder", "create_workbook", "edit_workbook", "copy_samples", "run_code",
  "invite_person"];
// The okb tools only the business analyst, the administrators' agent, uses: invite_person, which adds a person through the
// okb-invite hosted function. call_function naming okb-invite is the same call, and is the business analyst's alone too.
export const ADMIN_ONLY = { tools: ["invite_person"], functions: ["okb-invite"], agent: "business-analyst:business-analyst" };

// Claude in Chrome's server, the same in a terminal and in the desktop app, and its tools that open and read a page.
// Its tools that click, type, fill a form, run a script or upload a file are refused.
export const CHROME = "claude-in-chrome";
export const CHROME_READ = ["navigate", "read_page", "get_page_text", "find", "tabs_context_mcp", "tabs_create_mcp", "tabs_close_mcp"];
// The addresses Claude in Chrome may not open: Supabase's dashboard and every project's API, which reach past OKB's grants.
const CHROME_REFUSED = /^([\w-]+\.)*(supabase\.com|supabase\.co|supabase\.in)$/i;

/** Whether Claude in Chrome may open the address: any web address but Supabase's. A trailing dot, as in
 * supabase.com., names the same host, so it is stripped first. */
export function chromeUrlAllowed(url) {
  try {
    const { protocol, hostname } = new URL(String(url));
    return (protocol === "https:" || protocol === "http:") && !CHROME_REFUSED.test(hostname.replace(/\.+$/, ""));
  } catch { return false; }
}

// Every connector and plugin the person has is the database operator's, as decision 2.34 gives it, to ingest from and to
// work in, once the person has agreed in the session. These servers are never its: those that reach the database past
// OKB's grants, and those that drive the computer, a browser or the app. The okb plugin's own server and Claude in Chrome
// are held by their own rules above.
export const REFUSED_SERVERS = [/supabase/i, /postgres|pgadmin|beekeeper/i, /^plugin_okb[-_]/, /^terminal$/, /^computer-use$/,
  /^Claude_Browser$/, /playwright/i, /^Claude_Code_iOS_Simulator$/, /^ccd_/, /^scheduled-tasks$/, /^rea$/];
// Legacy's connector, the one that draws the home card, the Dashboard button, the approval card and the graph reader card, known by its tools'
// names on any server, since in the desktop app its server is an id. Both agents call them with no agreement asked, and a
// call to one records no agreement for the rest of its server.
export const LEGACY = ["show_home", "show_approval", "show_graph_reader"];
// The tools only a card calls, for its page and its own tools. Claude keeps them from the model, and a card's own calls
// never pass this hook (seen in a live session: the hook saw show_home, and none of the card's card_page and card_call).
// So both agents are refused them by name on any server, as a second layer to Claude's, whether a card's tool is
// reached through card_call or called by its own name.
// The list holds every tool the connector registers with appTool, in any file of workers/connector/src, and hook.test.mjs
// checks it against that file.
export const CARD_ONLY = ["card_page", "card_call", "card_state", "save_version", "home_state", "task_list", "task_save", "task_open", "task_state", "run_call", "card_find_records", "card_record", "graph_reader_save", "graph_reader_off"];
// Legacy's connector's record, file and routine tools and the records card, for claude.ai and the phone, which load
// no plugins. This hook is the okb plugin's, so a session it runs in has the plugin's own server. Its rpc, list_files and
// file tools reach the same records and files, and the workflow plugins okb sync installs hold the same routines. Both
// agents are refused these names on any server but the okb plugin's own, so they keep to the plugin's tools in Claude
// Code. Each name starts okb, so another connector's guide, list_files or show_records is never refused.
export const CONNECTOR_RECORDS = ["okb", "okb_list_files", "okb_file_search", "okb_file_link", "okb_file_upload_link", "okb_guide", "okb_help", "okb_routines", "okb_routine", "okb_show_records"];

/** Whether the tool is one of Legacy's connector's record, file or routine tools, on a server other than the okb plugin's. */
export const connectorRecord = (server, tool) => server !== SERVER && CONNECTOR_RECORDS.includes(tool);

/** Whether the tool, exactly mcp__<server>__<tool>, is one of Legacy's connector's, by its tool's name. */
export function legacyTool(toolName) {
  const parts = String(toolName).split("__");
  return parts.length === 3 && parts[0] === "mcp" && parts[1] !== "" && LEGACY.includes(parts[2]);
}

// The Supabase connector's tools, refused on any server, since in the desktop app the connector's server is an id. Each
// call to one also marks its id as Supabase's for the session, and every tool on a marked id is refused. search_docs, its
// one tool that reads only Supabase's own documentation, is left out, since other connectors share the name.
export const SUPABASE_TOOLS = ["execute_sql", "apply_migration", "list_tables", "list_extensions", "list_migrations",
  "get_advisors", "get_logs", "query_logs", "get_project_url", "get_publishable_keys", "get_anon_key", "generate_typescript_types",
  "list_edge_functions", "get_edge_function", "deploy_edge_function", "create_branch", "list_branches", "delete_branch",
  "merge_branch", "reset_branch", "rebase_branch", "list_projects", "get_project", "create_project", "pause_project",
  "restore_project", "list_organizations", "get_organization", "get_cost", "confirm_cost"];

// What the person calls a connector, by its server's name in a terminal session or, for a desktop id, by a tool only it
// has. A plugin's server, plugin_<plugin>_<server>, is called by its plugin. Any other server is called by its name.
const NAMED = [
  { label: "Google Calendar", names: ["claude_ai_Google_Calendar"], own: ["list_calendars", "list_events", "suggest_time", "respond_to_event"] },
  { label: "Google Drive", names: ["claude_ai_Google_Drive"], own: ["list_recent_files", "get_file_permissions", "read_file_content", "download_file_content"] },
  { label: "Google Sheets", names: ["claude_ai_Google_Sheets"], own: ["get_spreadsheet", "get_values", "append_values"] },
  { label: "Gmail", names: ["claude_ai_Gmail"], own: ["search_threads", "get_thread", "list_labels", "list_drafts"] },
  { label: "Slack", names: ["claude_ai_Slack"], own: ["slack_read_channel", "slack_read_thread", "slack_search_public", "slack_send_message"] },
  { label: "Microsoft 365", names: ["claude_ai_Microsoft_365"], own: ["outlook_email_search", "outlook_calendar_search", "sharepoint_search"] },
];

// A connector's server in the desktop app: an id for it in place of its name.
const DESKTOP_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** What the prompt calls the server, from its name or, for a desktop id, the tool called on it. */
export function labelOf(server, tool) {
  const named = NAMED.find(c => c.names.includes(server)) ?? (DESKTOP_ID.test(server) ? NAMED.find(c => c.own.includes(tool)) : null);
  if (named) return `${named.label} connector`;
  const plugin = /^plugin_([^_]+)_/.exec(server);
  if (plugin) return `${plugin[1]} plugin`;
  return DESKTOP_ID.test(server) ? `connector ${server}` : `${server.replace(/^claude_ai_/, "").replace(/_/g, " ")} connector`;
}

/** The connector or plugin server the tool is on, as the key the session agrees to, given the desktop ids the session has
 * marked as Supabase's, or null for the okb server, Claude in Chrome and every server or tool the operator never uses. */
export function connectorOf(server, tool, marked = {}) {
  if (!server || server === SERVER || server === CHROME) return null;
  if (REFUSED_SERVERS.some(r => r.test(server)) || SUPABASE_TOOLS.includes(tool) || (marked.supabase ?? []).includes(server)) return null;
  // Code runs only in the okb plugin's own run_code, which reads only the agent folder and the folders added to the session.
  if (tool === "run_code") return null;
  if (LEGACY.includes(tool)) return null;
  return server;
}

/** The marks this call puts on a desktop id: Supabase's, when the tool is one of its own. */
export function marksFor(server, tool) {
  return DESKTOP_ID.test(server) && SUPABASE_TOOLS.includes(tool) ? ["supabase"] : [];
}

/** The session's connector state, kept in a file named for the session where the agents cannot write: { marked: { calendar:
 * [ids], ... }, agreed: [connector keys] }. */
export function connectorState(session, dir = tmpdir()) {
  const file = join(dir, `okb-connectors-${String(session).replace(/[^\w-]/g, "")}.json`);
  let state = {};
  try { state = JSON.parse(readFileSync(file, "utf8")) ?? {}; } catch {}
  return { marked: state.marked ?? {}, agreed: Array.isArray(state.agreed) ? state.agreed : [], file,
    save(next) { writeFileSync(file, JSON.stringify({ marked: next.marked ?? this.marked, agreed: next.agreed ?? this.agreed }), { mode: 0o600 }); } };
}

// The agent_type Claude Code gives each agent, and what its refusals call it.
// The database operator alone uses the person's connectors and plugins, as decision 2.34 gives it.
export const AGENTS = {
  "legacy:database-operator": { name: "database operator", connectors: true },
  "business-analyst:business-analyst": { name: "business analyst", connectors: false },
};

// The built-in tools both agents use. Any other, such as one a later Claude Code adds, is refused. Read, Glob and Grep
// reach only the folders below.
// Artifact publishes a checked page on the person's own Claude account, private until they share it.
const BUILT_IN = ["Skill", "Write", "Edit", "WebSearch", "WebFetch", "ToolSearch", "ListPlugins", "Read", "Glob", "Grep", "Artifact"];

// The installed plugins' folder: ~/.claude/plugins/cache/legacy, three folders above this hook in
// cache/legacy/okb/<version>/hooks. A skill's own files, such as its references, are there.
export const PLUGINS = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

/** The folders added to the session, from the first environment attachment in its transcript, which Claude Code writes
 * with the first message. The transcript is read a part at a time up to that line. Each line is parsed, so a message's
 * text that quotes one counts for nothing. None when the transcript cannot be read or holds no such line. */
export function addedFolders(transcript) {
  let fd;
  try { fd = openSync(String(transcript), "r"); } catch { return []; }
  try {
    const part = Buffer.alloc(1 << 16);
    let rest = "", read;
    while ((read = readSync(fd, part, 0, part.length, null)) > 0 || rest) {
      const text = rest + (read > 0 ? part.toString("utf8", 0, read) : "\n");
      const lines = text.split("\n");
      rest = read > 0 ? lines.pop() : "";
      for (const line of lines) {
        if (!line.includes('"environment"')) continue;
        let entry;
        try { entry = JSON.parse(line); } catch { continue; }
        if (entry?.type !== "attachment" || entry.attachment?.type !== "environment") continue;
        const added = entry.attachment.snapshot?.additionalWorkingDirectories;
        return Array.isArray(added) ? added.filter(f => typeof f === "string" && isAbsolute(f)) : [];
      }
    }
    return [];
  } finally { closeSync(fd); }
}

/** Whether the path's real path, links followed, is inside one of the folders, or with self, is one. */
export function inside(file, folders, self = false) {
  if (typeof file !== "string" || !file || !isAbsolute(file)) return false;
  let path;
  try { path = realpathSync(file); } catch { return false; }
  return folders.some(folder => {
    let root;
    try { root = realpathSync(folder); } catch { return false; }
    return path.startsWith(root + sep) || (self && path === root);
  });
}

/** Whether Read may open the file: only when its real path, links followed, is inside the plugins' folder or a folder
 * added to the session. */
export function readAllowed(file, plugins = PLUGINS, added = []) {
  return inside(file, [plugins, ...added]);
}

/** Whether Glob or Grep may search: only in a folder added to the session, or a folder inside one, given as a full path,
 * with a pattern that names no other folder. */
export function searchAllowed(tool, input, added = []) {
  const patterns = [tool === "Glob" ? input?.pattern : input?.glob].filter(p => p !== undefined);
  if (patterns.some(p => typeof p !== "string" || isAbsolute(p) || /^~|(^|[\\/])\.\.([\\/]|$)/.test(p))) return false;
  return inside(input?.path, added, true);
}

/** Whether the agent may call the tool, with the call's input: true for any agent but these two; otherwise only their own
 * tools, invite_person and call_function naming okb-invite for the business analyst alone, and a connector's
 * tools on its own server, given the desktop ids the session has marked. A connector's tool still needs the person's
 * agreement in the session, which the hook asks for. */
export function allowed(agentType, toolName, marked = {}, input = {}) {
  if (!AGENTS[agentType]) return true;
  if (!String(toolName).startsWith("mcp__")) return BUILT_IN.includes(String(toolName));
  const [, server = "", ...rest] = String(toolName).split("__");
  const tool = rest.join("__");
  if (rest.length === 1 && server !== "" && CARD_ONLY.includes(tool)) return false;
  if (connectorRecord(server, tool)) return false;
  if (server === SERVER && agentType !== ADMIN_ONLY.agent
    && (ADMIN_ONLY.tools.includes(tool) || (tool === "call_function" && ADMIN_ONLY.functions.includes(String(input?.name ?? "").trim())))) return false;
  // Legacy's connector's tools, on a server that is neither refused nor marked as Supabase's.
  if (legacyTool(toolName) && !REFUSED_SERVERS.some(r => r.test(server)) && !(marked?.supabase ?? []).includes(server)) return true;
  return (server === SERVER && OKB.includes(tool)) || (server === CHROME && CHROME_READ.includes(tool))
    || (AGENTS[agentType].connectors && connectorOf(server, tool, marked) !== null);
}

/** Why the agent is refused one of Legacy's connector's record, file or routine tools, named in full as tool, and what
 * it uses in Claude Code. */
export function connectorRefusal(who, name, tool) {
  if (name === "okb_routines" || name === "okb_routine")
    return `The ${who} follows a routine with its workflow plugin's own skill, which okb sync installs in Claude Code, not ${tool}.`;
  if (name === "okb_help") return `The ${who} answers how-to questions with the legacy:support skill, not ${tool}.`;
  return `The ${who} reaches records and files with the okb plugin's own tools, such as rpc, list_files and read_file, not ${tool}.`;
}

const real = file => { try { return realpathSync(file); } catch { return file; } };
// Any failure here refuses the call, since Claude Code runs a tool whose hook errs.
if (argv[1] && real(fileURLToPath(import.meta.url)) === real(argv[1])) {
  const deny = reason => { stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } })); process.exit(0); };
  const ask = reason => { stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: reason } })); process.exit(0); };
  try {
    let text = "";
    for await (const chunk of stdin) text += chunk;
    let call;
    try { call = JSON.parse(text); } catch { deny("The okb plugin's agent-tools hook could not read the tool call."); }
    const tool = String(call?.tool_name ?? "");
    const who = AGENTS[call?.agent_type]?.name;
    // A skill's own file is read with no look at the transcript.
    if (who && tool === "Read" && readAllowed(call?.tool_input?.file_path)) process.exit(0);
    if (who && (["Read", "Glob", "Grep"].includes(tool) || tool === `mcp__${SERVER}__copy_to_agent_folder`)) {
      const added = addedFolders(call?.transcript_path);
      const folders = added.length ? `the folders added to this session when it started: ${added.join(", ")}` : "no folder, since none was added to this session when it started";
      if (tool === "Read" && !readAllowed(call?.tool_input?.file_path, PLUGINS, added))
        deny(`The ${who} reads with Read only its skills' own files, in ${PLUGINS}, and ${folders}. Read a file in the agent folder with read_file. A folder added during a session is read in a new session.`);
      if ((tool === "Glob" || tool === "Grep") && !searchAllowed(tool, call?.tool_input, added))
        deny(`The ${who} searches with ${tool} only in ${folders}, named in full as path, with a pattern that names no other folder. A folder added during a session is searched in a new session.`);
      if (tool.endsWith("__copy_to_agent_folder") && !inside(call?.tool_input?.source_file, added))
        deny(`The ${who} copies into the agent folder only a file in ${folders}. A folder added during a session is copied from in a new session.`);
    }
    const [, server = "", ...rest] = tool.split("__"), name = rest.join("__");
    // Both agents' calls mark a desktop id as Supabase's, and both are held by the marks. Only the database operator
    // is asked to agree to a connector.
    const marking = AGENTS[call?.agent_type] && tool.startsWith("mcp__") ? connectorState(call?.session_id ?? "none") : null;
    if (marking) {
      const state = marking;
      const marks = marksFor(server, name).filter(key => !(state.marked[key] ?? []).includes(server));
      for (const key of marks) state.marked[key] = [...(state.marked[key] ?? []), server];
      if (marks.length) state.save({ marked: state.marked });
    }
    const state = AGENTS[call?.agent_type]?.connectors ? marking : null;
    if (!allowed(call?.agent_type ?? "", tool, marking?.marked, call?.tool_input)) {
      const adminOnly = server === SERVER && (ADMIN_ONLY.tools.includes(name) || name === "call_function");
      deny(adminOnly ? `The ${who} adds no one: inviting a person is your administrator's, with their business analyst, @business-analyst:business-analyst.`
        : connectorRecord(server, name) ? connectorRefusal(who, name, tool)
        : `The ${who} does not use ${tool}.`);
    }
    if (AGENTS[call?.agent_type] && tool === `mcp__${CHROME}__navigate` && !chromeUrlAllowed(call?.tool_input?.url))
      deny(`The ${AGENTS[call.agent_type].name} opens no Supabase address in Chrome, and only web addresses.`);
    const connector = state ? connectorOf(server, name, state.marked) : null;
    if (connector && !state.agreed.includes(connector))
      ask(`Your ${who} asks to use your ${labelOf(server, name)}, for ${name}. Allow this once to agree for the rest of this session; deny it to keep ${labelOf(server, name).replace(/ (connector|plugin)$/, "")} closed to your ${who}.`);
    // run_code reads the folders the session was started with, from its transcript, saved here for the session's folder
    // just before each call, on any server whose tool is run_code. The server takes none from the call.
    if (tool.startsWith("mcp__") && name === "run_code") {
      const folders = addedFolders(call?.transcript_path);
      for (const folder of new Set([call?.cwd, env.CLAUDE_PROJECT_DIR].filter(f => typeof f === "string" && isAbsolute(f)))) saveSessionFolders(folder, folders);
    }
    process.exit(0);
  } catch (err) {
    deny(`The okb plugin's agent-tools hook failed: ${err instanceof Error ? err.message : err}`);
  }
}
