import { runAuthCommand } from "./commands/auth.js";
import { runCallCommand } from "./commands/call.js";

function printHelp(): void {
  console.log(`kweaverc

Usage:
  kweaverc auth <platform-url>
  kweaverc auth status
  kweaverc call <url> [-X METHOD] [-H "Name: value"] [-d BODY] [--pretty] [--verbose]
  kweaverc --help

Commands:
  auth      Register a client if needed, start the local callback listener, and complete OAuth login
  call      Call an API with curl-style flags and auto-injected token headers
  help      Show this message`);
}

export async function run(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;

  if (!command || command === "--help" || command === "-h" || command === "help") {
    printHelp();
    return 0;
  }

  if (command === "auth") {
    return runAuthCommand(rest);
  }

  if (command === "call" || command === "curl") {
    return runCallCommand(rest);
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
