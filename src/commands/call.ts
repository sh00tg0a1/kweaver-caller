import { ensureValidToken, formatHttpError } from "../auth/oauth.js";
import { HttpError } from "../utils/http.js";

export interface CallInvocation {
  url: string;
  method: string;
  headers: Headers;
  body?: string;
  pretty: boolean;
  verbose: boolean;
}

export function parseCallArgs(args: string[]): CallInvocation {
  const headers = new Headers();
  let method = "GET";
  let body: string | undefined;
  let url: string | undefined;
  let pretty = false;
  let verbose = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "-X" || arg === "--request") {
      method = (args[index + 1] ?? "").toUpperCase();
      index += 1;
      continue;
    }

    if (arg === "-H" || arg === "--header") {
      const header = args[index + 1];
      if (!header) {
        throw new Error("Missing value for header flag");
      }
      const separatorIndex = header.indexOf(":");
      if (separatorIndex === -1) {
        throw new Error(`Invalid header format: ${header}`);
      }
      const name = header.slice(0, separatorIndex).trim();
      const value = header.slice(separatorIndex + 1).trim();
      headers.set(name, value);
      index += 1;
      continue;
    }

    if (arg === "-d" || arg === "--data" || arg === "--data-raw") {
      body = args[index + 1] ?? "";
      if (method === "GET") {
        method = "POST";
      }
      index += 1;
      continue;
    }

    if (arg === "--pretty") {
      pretty = true;
      continue;
    }

    if (arg === "--verbose") {
      verbose = true;
      continue;
    }

    if (arg === "--url") {
      url = args[index + 1];
      index += 1;
      continue;
    }

    if (!arg.startsWith("-") && !url) {
      url = arg;
      continue;
    }

    throw new Error(`Unsupported call argument: ${arg}`);
  }

  if (!url) {
    throw new Error("Missing request URL");
  }

  return { url, method, headers, body, pretty, verbose };
}

function injectAuthHeaders(headers: Headers, accessToken: string): void {
  if (!headers.has("authorization")) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }

  if (!headers.has("token")) {
    headers.set("token", accessToken);
  }
}

export function formatCallOutput(text: string, pretty: boolean): string {
  if (!pretty || !text) {
    return text;
  }

  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function formatVerboseRequest(invocation: CallInvocation): string[] {
  const lines = [
    `Method: ${invocation.method}`,
    `URL: ${invocation.url}`,
    "Headers:",
  ];

  const entries = Array.from(invocation.headers.entries()).sort(([a], [b]) => a.localeCompare(b));
  for (const [name, value] of entries) {
    lines.push(`  ${name}: ${value}`);
  }

  lines.push(`Body: ${invocation.body ? "present" : "empty"}`);
  return lines;
}

export async function runCallCommand(args: string[]): Promise<number> {
  let invocation: CallInvocation;
  try {
    invocation = parseCallArgs(args);
  } catch (error) {
    console.error(formatHttpError(error));
    return 1;
  }

  try {
    const token = await ensureValidToken();
    injectAuthHeaders(invocation.headers, token.accessToken);

    if (invocation.verbose) {
      for (const line of formatVerboseRequest(invocation)) {
        console.error(line);
      }
    }

    const response = await fetch(invocation.url, {
      method: invocation.method,
      headers: invocation.headers,
      body: invocation.body,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new HttpError(response.status, response.statusText, text);
    }

    if (text) {
      console.log(formatCallOutput(text, invocation.pretty));
    }
    return 0;
  } catch (error) {
    console.error(formatHttpError(error));
    return 1;
  }
}
