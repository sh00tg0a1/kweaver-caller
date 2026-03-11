import * as readline from "node:readline";

import { ensureValidToken, formatHttpError } from "../auth/oauth.js";
import { fetchAgentInfo, sendChatRequest } from "../api/agent-chat.js";

const EXIT_WORDS = ["exit", "quit", "q"];

export interface ChatArgs {
  agentId: string;
  version: string;
  message?: string;
  conversationId?: string;
  stream?: boolean;
  verbose: boolean;
  businessDomain: string;
}

export function parseChatArgs(args: string[]): ChatArgs {
  let agentId: string | undefined;
  let version = "v0";
  let message: string | undefined;
  let conversationId: string | undefined;
  let stream: boolean | undefined;
  let verbose = false;
  let businessDomain = "bd_public";

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];

    if (arg === "-m" || arg === "--message") {
      message = args[i + 1];
      if (!message || message.startsWith("-")) {
        throw new Error("Missing value for message flag");
      }
      i += 1;
      continue;
    }

    if (
      arg === "--version" ||
      arg === "-version"
    ) {
      version = args[i + 1] ?? "";
      if (!version || version.startsWith("-")) {
        throw new Error("Missing value for version flag");
      }
      i += 1;
      continue;
    }

    if (
      arg === "--conversation-id" ||
      arg === "--conversation_id" ||
      arg === "-conversation-id" ||
      arg === "-conversation_id" ||
      arg === "--session-id"
    ) {
      conversationId = args[i + 1];
      if (!conversationId || conversationId.startsWith("-")) {
        throw new Error("Missing value for conversation-id flag");
      }
      i += 1;
      continue;
    }

    if (arg === "--stream") {
      stream = true;
      continue;
    }

    if (arg === "--no-stream") {
      stream = false;
      continue;
    }

    if (arg === "--verbose" || arg === "-v") {
      verbose = true;
      continue;
    }

    if (arg === "-bd" || arg === "--biz-domain") {
      businessDomain = args[i + 1] ?? "";
      if (!businessDomain || businessDomain.startsWith("-")) {
        throw new Error("Missing value for biz-domain flag");
      }
      i += 1;
      continue;
    }

    if (!arg.startsWith("-") && !agentId) {
      agentId = arg;
      continue;
    }

    throw new Error(`Unsupported argument: ${arg}`);
  }

  if (!agentId) {
    throw new Error("Missing agent_id. Usage: kweaverc agent chat <agent_id> [-m \"message\"]");
  }

  return { agentId, version, message, conversationId, stream, verbose, businessDomain };
}

export async function runAgentChatCommand(args: string[]): Promise<number> {
  let chatArgs: ChatArgs;
  try {
    chatArgs = parseChatArgs(args);
  } catch (error) {
    console.error(formatHttpError(error));
    return 1;
  }

  let token;
  try {
    token = await ensureValidToken();
  } catch (error) {
    console.error(formatHttpError(error));
    return 1;
  }

  const isInteractive = chatArgs.message === undefined;
  const stream = chatArgs.stream ?? (isInteractive ? true : false);
  let agentInfo;

  try {
    agentInfo = await fetchAgentInfo({
      baseUrl: token.baseUrl,
      accessToken: token.accessToken,
      agentId: chatArgs.agentId,
      version: chatArgs.version,
      businessDomain: chatArgs.businessDomain,
    });
  } catch (error) {
    console.error(formatHttpError(error));
    return 1;
  }

  if (isInteractive) {
    return runInteractiveChat(chatArgs, stream, agentInfo);
  }

  try {
    const result = await sendChatRequest({
      baseUrl: token.baseUrl,
      accessToken: token.accessToken,
      agentId: agentInfo.id,
      agentKey: agentInfo.key,
      agentVersion: agentInfo.version,
      query: chatArgs.message ?? "",
      conversationId: chatArgs.conversationId,
      stream,
      verbose: chatArgs.verbose,
      businessDomain: chatArgs.businessDomain,
    });

    if (result.text && !stream) {
      console.log(result.text);
    }
    if (result.conversationId && chatArgs.verbose) {
      console.error(`conversation_id: ${result.conversationId}`);
    }
    return 0;
  } catch (error) {
    console.error(formatHttpError(error));
    return 1;
  }
}

async function runInteractiveChat(
  chatArgs: ChatArgs,
  stream: boolean,
  agentInfo: { id: string; key: string; version: string }
): Promise<number> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let conversationId = chatArgs.conversationId;

  const prompt = (): void => {
    rl.question("> ", async (line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        prompt();
        return;
      }
      if (EXIT_WORDS.includes(trimmed.toLowerCase())) {
        rl.close();
        return;
      }

      try {
        const tokenValid = await ensureValidToken();
        const result = await sendChatRequest({
          baseUrl: tokenValid.baseUrl,
          accessToken: tokenValid.accessToken,
          agentId: agentInfo.id,
          agentKey: agentInfo.key,
          agentVersion: agentInfo.version,
          query: trimmed,
          conversationId,
          stream,
          verbose: chatArgs.verbose,
          businessDomain: chatArgs.businessDomain,
        });

        if (result.conversationId) {
          conversationId = result.conversationId;
        }
        if (result.text && !stream) {
          console.log(result.text);
        }
      } catch (error) {
        console.error(formatHttpError(error));
      }
      prompt();
    });
  };

  prompt();
  return new Promise((resolve) => {
    rl.on("close", () => resolve(0));
  });
}
