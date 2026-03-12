import { readFileSync } from "node:fs";
import { ensureValidToken, formatHttpError } from "../auth/oauth.js";
import {
  listKnowledgeNetworks,
  getKnowledgeNetwork,
  createKnowledgeNetwork,
  updateKnowledgeNetwork,
  deleteKnowledgeNetwork,
} from "../api/knowledge-networks.js";
import { formatCallOutput } from "./call.js";

export interface BknListOptions {
  offset: number;
  limit: number;
  sort: string;
  direction: "asc" | "desc";
  businessDomain: string;
  pretty: boolean;
  verbose: boolean;
  name_pattern?: string;
  tag?: string;
}

interface SimpleListItem {
  name: string;
  id: string;
  description: string;
}

export function formatSimpleBknList(text: string, pretty: boolean): string {
  const parsed = JSON.parse(text) as { entries?: Array<Record<string, unknown>> };
  const entries = Array.isArray(parsed.entries) ? parsed.entries : [];
  const simplified: SimpleListItem[] = entries.map((entry) => ({
    name: typeof entry.name === "string" ? entry.name : "",
    id: typeof entry.id === "string" ? entry.id : "",
    description: typeof entry.comment === "string" ? entry.comment : "",
  }));
  return JSON.stringify(simplified, null, pretty ? 2 : 0);
}

export function parseBknListArgs(args: string[]): BknListOptions {
  let offset = 0;
  let limit = 50;
  let sort = "update_time";
  let direction: "asc" | "desc" = "desc";
  let businessDomain = "bd_public";
  let pretty = false;
  let verbose = false;
  let name_pattern: string | undefined;
  let tag: string | undefined;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      throw new Error("help");
    }

    if (arg === "--offset") {
      offset = parseInt(args[i + 1] ?? "0", 10);
      if (Number.isNaN(offset) || offset < 0) offset = 0;
      i += 1;
      continue;
    }

    if (arg === "--limit") {
      limit = parseInt(args[i + 1] ?? "50", 10);
      if (Number.isNaN(limit) || limit < 1) limit = 50;
      i += 1;
      continue;
    }

    if (arg === "--sort") {
      sort = args[i + 1] ?? "update_time";
      i += 1;
      continue;
    }

    if (arg === "--direction") {
      const d = (args[i + 1] ?? "desc").toLowerCase();
      direction = d === "asc" ? "asc" : "desc";
      i += 1;
      continue;
    }

    if (arg === "--name-pattern") {
      name_pattern = args[i + 1] ?? "";
      i += 1;
      continue;
    }

    if (arg === "--tag") {
      tag = args[i + 1] ?? "";
      i += 1;
      continue;
    }

    if (arg === "-bd" || arg === "--biz-domain") {
      businessDomain = args[i + 1] ?? "bd_public";
      if (!businessDomain || businessDomain.startsWith("-")) {
        throw new Error("Missing value for biz-domain flag");
      }
      i += 1;
      continue;
    }

    if (arg === "--pretty") {
      pretty = true;
      continue;
    }

    if (arg === "--verbose" || arg === "-v") {
      verbose = true;
      continue;
    }

    if (arg === "--simple") {
      continue;
    }

    throw new Error(`Unsupported bkn list argument: ${arg}`);
  }

  return { offset, limit, sort, direction, businessDomain, pretty, verbose, name_pattern, tag };
}

export interface BknGetOptions {
  knId: string;
  stats: boolean;
  export: boolean;
  businessDomain: string;
  pretty: boolean;
}

export function parseBknGetArgs(args: string[]): BknGetOptions {
  let knId = "";
  let stats = false;
  let exportMode = false;
  let businessDomain = "bd_public";
  let pretty = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      throw new Error("help");
    }

    if (arg === "--stats") {
      stats = true;
      continue;
    }

    if (arg === "--export") {
      exportMode = true;
      continue;
    }

    if (arg === "-bd" || arg === "--biz-domain") {
      businessDomain = args[i + 1] ?? "bd_public";
      if (!businessDomain || businessDomain.startsWith("-")) {
        throw new Error("Missing value for biz-domain flag");
      }
      i += 1;
      continue;
    }

    if (arg === "--pretty") {
      pretty = true;
      continue;
    }

    if (!arg.startsWith("-") && !knId) {
      knId = arg;
      continue;
    }

    throw new Error(`Unsupported bkn get argument: ${arg}`);
  }

  if (!knId) {
    throw new Error("Missing kn-id. Usage: kweaverc bkn get <kn-id> [options]");
  }

  return { knId, stats, export: exportMode, businessDomain, pretty };
}

export interface BknCreateOptions {
  body: string;
  import_mode?: "normal" | "ignore" | "overwrite";
  validate_dependency?: boolean;
  businessDomain: string;
  pretty: boolean;
}

const BODY_FILE_FLAGS = [
  "--name",
  "--comment",
  "--tags",
  "--icon",
  "--color",
  "--branch",
  "--base-branch",
];

export function parseBknCreateArgs(args: string[]): BknCreateOptions {
  let bodyFile: string | undefined;
  let import_mode: "normal" | "ignore" | "overwrite" | undefined;
  let validate_dependency: boolean | undefined;
  let businessDomain = "bd_public";
  let pretty = false;

  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      throw new Error("help");
    }

    if (arg === "--body-file") {
      bodyFile = args[i + 1];
      if (!bodyFile || bodyFile.startsWith("-")) {
        throw new Error("Missing value for --body-file");
      }
      i += 1;
      continue;
    }

    if (arg === "--import-mode") {
      const m = (args[i + 1] ?? "normal").toLowerCase();
      if (m !== "normal" && m !== "ignore" && m !== "overwrite") {
        throw new Error("--import-mode must be normal, ignore, or overwrite");
      }
      import_mode = m;
      i += 1;
      continue;
    }

    if (arg === "--validate-dependency") {
      const v = (args[i + 1] ?? "true").toLowerCase();
      validate_dependency = v === "true" || v === "1";
      i += 1;
      continue;
    }

    if (arg === "-bd" || arg === "--biz-domain") {
      businessDomain = args[i + 1] ?? "bd_public";
      if (!businessDomain || businessDomain.startsWith("-")) {
        throw new Error("Missing value for biz-domain flag");
      }
      i += 1;
      continue;
    }

    if (arg === "--pretty") {
      pretty = true;
      continue;
    }

    if (BODY_FILE_FLAGS.includes(arg)) {
      const key = arg.replace(/^--/, "").replace(/-/g, "_");
      flags[key] = args[i + 1] ?? "";
      i += 1;
      continue;
    }

    throw new Error(`Unsupported bkn create argument: ${arg}`);
  }

  let body: string;
  if (bodyFile) {
    if (Object.keys(flags).length > 0) {
      throw new Error("Cannot use --body-file together with --name, --comment, --tags, etc.");
    }
    body = readFileSync(bodyFile, "utf8");
  } else {
    const name = flags.name;
    if (!name) {
      throw new Error("--name is required when not using --body-file");
    }
    const payload: Record<string, unknown> = {
      name: flags.name,
      branch: flags.branch || "main",
      base_branch: flags.base_branch ?? "",
    };
    if (flags.comment) payload.comment = flags.comment;
    if (flags.tags) payload.tags = flags.tags.split(",").map((s) => s.trim()).filter(Boolean);
    if (flags.icon) payload.icon = flags.icon;
    if (flags.color) payload.color = flags.color;
    body = JSON.stringify(payload);
  }

  return { body, import_mode, validate_dependency, businessDomain, pretty };
}

export interface BknUpdateOptions {
  knId: string;
  body: string;
  businessDomain: string;
  pretty: boolean;
}

export function parseBknUpdateArgs(args: string[]): BknUpdateOptions {
  let knId = "";
  let bodyFile: string | undefined;
  let businessDomain = "bd_public";
  let pretty = false;

  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      throw new Error("help");
    }

    if (arg === "--body-file") {
      bodyFile = args[i + 1];
      if (!bodyFile || bodyFile.startsWith("-")) {
        throw new Error("Missing value for --body-file");
      }
      i += 1;
      continue;
    }

    if (arg === "-bd" || arg === "--biz-domain") {
      businessDomain = args[i + 1] ?? "bd_public";
      if (!businessDomain || businessDomain.startsWith("-")) {
        throw new Error("Missing value for biz-domain flag");
      }
      i += 1;
      continue;
    }

    if (arg === "--pretty") {
      pretty = true;
      continue;
    }

    if (BODY_FILE_FLAGS.includes(arg)) {
      const key = arg.replace(/^--/, "").replace(/-/g, "_");
      flags[key] = args[i + 1] ?? "";
      i += 1;
      continue;
    }

    if (!arg.startsWith("-") && !knId) {
      knId = arg;
      continue;
    }

    throw new Error(`Unsupported bkn update argument: ${arg}`);
  }

  if (!knId) {
    throw new Error("Missing kn-id. Usage: kweaverc bkn update <kn-id> [options]");
  }

  let body: string;
  if (bodyFile) {
    if (Object.keys(flags).length > 0) {
      throw new Error("Cannot use --body-file together with --name, --comment, --tags, etc.");
    }
    body = readFileSync(bodyFile, "utf8");
  } else {
    const name = flags.name;
    if (!name) {
      throw new Error("--name is required when not using --body-file");
    }
    const payload: Record<string, unknown> = {
      name: flags.name,
      branch: flags.branch || "main",
      base_branch: flags.base_branch ?? "",
    };
    if (flags.comment) payload.comment = flags.comment;
    if (flags.tags) payload.tags = flags.tags.split(",").map((s) => s.trim()).filter(Boolean);
    if (flags.icon) payload.icon = flags.icon;
    if (flags.color) payload.color = flags.color;
    body = JSON.stringify(payload);
  }

  return { knId, body, businessDomain, pretty };
}

export interface BknDeleteOptions {
  knId: string;
  businessDomain: string;
}

export function parseBknDeleteArgs(args: string[]): BknDeleteOptions {
  let knId = "";
  let businessDomain = "bd_public";

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      throw new Error("help");
    }

    if (arg === "-bd" || arg === "--biz-domain") {
      businessDomain = args[i + 1] ?? "bd_public";
      if (!businessDomain || businessDomain.startsWith("-")) {
        throw new Error("Missing value for biz-domain flag");
      }
      i += 1;
      continue;
    }

    if (!arg.startsWith("-") && !knId) {
      knId = arg;
      continue;
    }

    throw new Error(`Unsupported bkn delete argument: ${arg}`);
  }

  if (!knId) {
    throw new Error("Missing kn-id. Usage: kweaverc bkn delete <kn-id>");
  }

  return { knId, businessDomain };
}

const BKN_HELP = `kweaverc bkn

Subcommands:
  list [options]       List business knowledge networks
  get <kn-id> [options]   Get knowledge network detail (use --stats or --export)
  create [options]     Create a knowledge network
  update <kn-id> [options]  Update a knowledge network
  delete <kn-id>       Delete a knowledge network
  export <kn-id>       Export knowledge network (alias for get --export)
  stats <kn-id>        Get statistics (alias for get --stats)

Use 'kweaverc bkn <subcommand> --help' for subcommand options.`;

export async function runBknCommand(args: string[]): Promise<number> {
  const [subcommand, ...rest] = args;

  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    console.log(BKN_HELP);
    return 0;
  }

  if (subcommand === "list") {
    return runBknListCommand(rest);
  }

  if (subcommand === "get") {
    return runBknGetCommand(rest);
  }

  if (subcommand === "create") {
    return runBknCreateCommand(rest);
  }

  if (subcommand === "update") {
    return runBknUpdateCommand(rest);
  }

  if (subcommand === "delete") {
    return runBknDeleteCommand(rest);
  }

  if (subcommand === "export") {
    return runBknGetCommand([...(rest[0] ? [rest[0]] : []), "--export", ...rest.slice(1)]);
  }

  if (subcommand === "stats") {
    return runBknGetCommand([...(rest[0] ? [rest[0]] : []), "--stats", ...rest.slice(1)]);
  }

  console.error(`Unknown bkn subcommand: ${subcommand}`);
  return 1;
}

async function runBknListCommand(args: string[]): Promise<number> {
  let options: BknListOptions;
  try {
    options = parseBknListArgs(args);
  } catch (error) {
    if (error instanceof Error && error.message === "help") {
      console.log(BKN_LIST_HELP);
      return 0;
    }
    console.error(formatHttpError(error));
    return 1;
  }

  try {
    const token = await ensureValidToken();
    const body = await listKnowledgeNetworks({
      baseUrl: token.baseUrl,
      accessToken: token.accessToken,
      businessDomain: options.businessDomain,
      offset: options.offset,
      limit: options.limit,
      sort: options.sort,
      direction: options.direction,
      name_pattern: options.name_pattern,
      tag: options.tag,
    });

    if (body) {
      console.log(options.verbose ? formatCallOutput(body, options.pretty) : formatSimpleBknList(body, options.pretty));
    }
    return 0;
  } catch (error) {
    console.error(formatHttpError(error));
    return 1;
  }
}

const BKN_LIST_HELP = `kweaverc bkn list [options]

List business knowledge networks from the ontology-manager API.

Options:
  --offset <n>       Offset (default: 0)
  --limit <n>        Limit (default: 50)
  --sort <key>       Sort field (default: update_time)
  --direction <asc|desc>  Sort direction (default: desc)
  --name-pattern <s> Filter by name pattern
  --tag <s>          Filter by tag
  --verbose, -v      Show full JSON response
  -bd, --biz-domain <value>  Business domain (default: bd_public)
  --pretty           Pretty-print JSON output (applies to both modes)`;

const BKN_GET_HELP = `kweaverc bkn get <kn-id> [options]

Get knowledge network detail.

Options:
  --stats            Include statistics
  --export           Export mode (include sub-types)
  -bd, --biz-domain <value>  Business domain (default: bd_public)
  --pretty           Pretty-print JSON output`;

const BKN_CREATE_HELP = `kweaverc bkn create [options]

Create a knowledge network.

Options:
  --name <s>         Name (required unless --body-file)
  --comment <s>      Comment
  --tags <t1,t2>     Comma-separated tags
  --icon <s>         Icon
  --color <s>        Color
  --branch <s>       Branch (default: main)
  --base-branch <s>  Base branch (default: empty for main)
  --body-file <path> Read full JSON body from file (cannot combine with flags above)
  --import-mode <normal|ignore|overwrite>  Import mode (default: normal)
  --validate-dependency <true|false>  Validate dependency (default: true)
  -bd, --biz-domain <value>  Business domain (default: bd_public)
  --pretty           Pretty-print JSON output`;

const BKN_UPDATE_HELP = `kweaverc bkn update <kn-id> [options]

Update a knowledge network.

Options:
  --name <s>         Name (required unless --body-file)
  --comment <s>      Comment
  --tags <t1,t2>     Comma-separated tags
  --icon <s>         Icon
  --color <s>        Color
  --branch <s>       Branch (default: main)
  --base-branch <s>  Base branch (default: empty for main)
  --body-file <path> Read full JSON body from file (cannot combine with flags above)
  -bd, --biz-domain <value>  Business domain (default: bd_public)
  --pretty           Pretty-print JSON output`;

const BKN_DELETE_HELP = `kweaverc bkn delete <kn-id>

Delete a knowledge network and its object types, relation types, action types, and concept groups.

Options:
  -bd, --biz-domain <value>  Business domain (default: bd_public)`;

async function runBknGetCommand(args: string[]): Promise<number> {
  let options: BknGetOptions;
  try {
    options = parseBknGetArgs(args);
  } catch (error) {
    if (error instanceof Error && error.message === "help") {
      console.log(BKN_GET_HELP);
      return 0;
    }
    console.error(formatHttpError(error));
    return 1;
  }

  try {
    const token = await ensureValidToken();
    const body = await getKnowledgeNetwork({
      baseUrl: token.baseUrl,
      accessToken: token.accessToken,
      knId: options.knId,
      businessDomain: options.businessDomain,
      mode: options.export ? "export" : undefined,
      include_statistics: options.stats ? true : undefined,
    });

    if (body) {
      console.log(formatCallOutput(body, options.pretty));
    }
    return 0;
  } catch (error) {
    console.error(formatHttpError(error));
    return 1;
  }
}

async function runBknCreateCommand(args: string[]): Promise<number> {
  let options: BknCreateOptions;
  try {
    options = parseBknCreateArgs(args);
  } catch (error) {
    if (error instanceof Error && error.message === "help") {
      console.log(BKN_CREATE_HELP);
      return 0;
    }
    console.error(formatHttpError(error));
    return 1;
  }

  try {
    const token = await ensureValidToken();
    const body = await createKnowledgeNetwork({
      baseUrl: token.baseUrl,
      accessToken: token.accessToken,
      body: options.body,
      businessDomain: options.businessDomain,
      import_mode: options.import_mode,
      validate_dependency: options.validate_dependency,
    });

    if (body) {
      console.log(formatCallOutput(body, options.pretty));
    }
    return 0;
  } catch (error) {
    console.error(formatHttpError(error));
    return 1;
  }
}

async function runBknUpdateCommand(args: string[]): Promise<number> {
  let options: BknUpdateOptions;
  try {
    options = parseBknUpdateArgs(args);
  } catch (error) {
    if (error instanceof Error && error.message === "help") {
      console.log(BKN_UPDATE_HELP);
      return 0;
    }
    console.error(formatHttpError(error));
    return 1;
  }

  try {
    const token = await ensureValidToken();
    const body = await updateKnowledgeNetwork({
      baseUrl: token.baseUrl,
      accessToken: token.accessToken,
      knId: options.knId,
      body: options.body,
      businessDomain: options.businessDomain,
    });

    if (body) {
      console.log(formatCallOutput(body, options.pretty));
    }
    return 0;
  } catch (error) {
    console.error(formatHttpError(error));
    return 1;
  }
}

async function runBknDeleteCommand(args: string[]): Promise<number> {
  let options: BknDeleteOptions;
  try {
    options = parseBknDeleteArgs(args);
  } catch (error) {
    if (error instanceof Error && error.message === "help") {
      console.log(BKN_DELETE_HELP);
      return 0;
    }
    console.error(formatHttpError(error));
    return 1;
  }

  try {
    const token = await ensureValidToken();
    await deleteKnowledgeNetwork({
      baseUrl: token.baseUrl,
      accessToken: token.accessToken,
      knId: options.knId,
      businessDomain: options.businessDomain,
    });
    return 0;
  } catch (error) {
    console.error(formatHttpError(error));
    return 1;
  }
}
