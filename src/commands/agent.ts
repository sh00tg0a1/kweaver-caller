import { formatHttpError } from "../auth/oauth.js";
import { runAgentChatCommand } from "./agent-chat.js";

export function runAgentCommand(args: string[]): Promise<number> {
  const [subcommand, ...rest] = args;

  if (!subcommand || subcommand === "--help" || subcommand === "-h") {
    console.log(`kweaverc agent

Subcommands:
  chat <agent_id>                    Start interactive chat with an agent
  chat <agent_id> -m "message"       Send a single message (non-interactive)
       [--conversation-id id]         Continue an existing conversation
       [--session-id id]             Alias for --conversation-id
       [-conversation_id id]         Compatibility alias for reference examples
       [--version value]             Resolve agent key from a specific version (default: v0)
       [--stream] [--no-stream]      Enable or disable streaming (default: stream in interactive, no-stream in -m mode)
       [--verbose]                   Print request details to stderr
       [-bd|--biz-domain value]      Override x-business-domain (default: bd_public)`);
    return Promise.resolve(0);
  }

  if (subcommand === "chat") {
    if (rest.length === 1 && (rest[0] === "--help" || rest[0] === "-h")) {
      console.log(`kweaverc agent chat <agent_id> [-m "message"] [options]

Interactive mode (default when -m is omitted):
  kweaverc agent chat <agent_id>
  Type your message and press Enter. Type 'exit', 'quit', or 'q' to quit.

Non-interactive mode:
  kweaverc agent chat <agent_id> -m "your message"
  kweaverc agent chat <agent_id> -m "continue" --conversation-id <id>

Options:
  -m, --message <text>       Single message (non-interactive)
  --conversation-id <id>     Continue existing conversation
  --session-id <id>          Alias for --conversation-id
  -conversation_id <id>      Compatibility alias for reference examples
  --version <value>          Agent version used to resolve the agent key (default: v0)
  --stream                   Enable streaming (default in interactive)
  --no-stream                Disable streaming (default with -m)
  --verbose, -v              Print request details to stderr
  -bd, --biz-domain <value>  Override x-business-domain (default: bd_public)`);
      return Promise.resolve(0);
    }
    return runAgentChatCommand(rest);
  }

  console.error(`Unknown agent subcommand: ${subcommand}`);
  return Promise.resolve(1);
}
