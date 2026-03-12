import { runAgentCommand } from "./commands/agent.js";
import { runAuthCommand } from "./commands/auth.js";
import { runCallCommand } from "./commands/call.js";
import { runContextLoaderCommand } from "./commands/context-loader.js";
import { runTokenCommand } from "./commands/token.js";

function printHelp(): void {
  console.log(`kweaverc

Usage:
  kweaverc auth <platform-url>
  kweaverc auth <platform-url> [--alias name] [--no-open] [--host host] [--redirect-uri uri]
  kweaverc auth status [platform-url]
  kweaverc auth list
  kweaverc auth use <platform-url>
  kweaverc auth logout [platform-url]
  kweaverc auth delete <platform-url>
  kweaverc token
  kweaverc call <url> [-X METHOD] [-H "Name: value"] [-d BODY] [--pretty] [--verbose] [-bd value]
  kweaverc agent chat <agent_id> [-m "message"] [--version value] [--conversation-id id] [--stream] [--no-stream] [--verbose] [-bd value]
  kweaverc context-loader [config|kn-search|...]
  kweaverc --help

Commands:
  auth           Login, list, inspect, and switch saved platform auth profiles
  token          Print the current access token, refreshing it first if needed
  call           Call an API with curl-style flags and auto-injected token headers
  agent          Chat with a KWeaver agent (use 'agent chat <agent_id>' for interactive mode)
  context-loader Call context-loader MCP tools (kn-search, query-object-instance, etc.)
  help           Show this message`);
}

export async function run(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;

  if (argv.length === 0 || !command || command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return 0;
  }

  if (command === "auth") {
    return runAuthCommand(rest);
  }

  if (command === "call" || command === "curl") {
    return runCallCommand(rest);
  }

  if (command === "token") {
    return runTokenCommand(rest);
  }

  if (command === "agent") {
    return runAgentCommand(rest);
  }

  if (command === "context-loader" || command === "context") {
    return runContextLoaderCommand(rest);
  }

  console.error(`Unknown command: ${command}`);
  printHelp();
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2))
    .then((code) => {
      process.exit(code);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(message);
      process.exit(1);
    });
}
