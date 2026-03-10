import { getConfigDir } from "../config/store.js";
import type { CallbackSession, ClientConfig, TokenConfig } from "../config/store.js";
import {
  formatHttpError,
  getStoredAuthSummary,
  login,
  normalizeBaseUrl,
} from "../auth/oauth.js";

export function getClientProvisioningMessage(created: boolean): string {
  return created ? "Registered a new OAuth client." : "Reusing existing OAuth client.";
}

export function formatAuthStatusSummary(input: {
  client: ClientConfig;
  token: TokenConfig | null;
  callback: CallbackSession | null;
}): string[] {
  const lines = [
    `Config directory: ${getConfigDir()}`,
    `Platform: ${input.client.baseUrl}`,
    `Client ID: ${input.client.clientId}`,
    `Redirect URI: ${input.client.redirectUri}`,
    `Token present: ${input.token ? "yes" : "no"}`,
    `Callback recorded: ${input.callback ? "yes" : "no"}`,
  ];

  if (input.client.product) {
    lines.push(`Product: ${input.client.product}`);
  }

  if (input.client.lang) {
    lines.push(`Lang: ${input.client.lang}`);
  }

  if (input.token?.expiresAt) {
    lines.push(`Token expires at: ${input.token.expiresAt}`);
  }

  if (input.callback?.receivedAt) {
    lines.push(`Last callback at: ${input.callback.receivedAt}`);
  }

  if (input.callback?.scope) {
    lines.push(`Last callback scope: ${input.callback.scope}`);
  }

  return lines;
}

export async function runAuthCommand(args: string[]): Promise<number> {
  const target = args[0];

  if (target && target !== "status") {
    try {
      const port = Number(readOption(args, "--port") ?? "9010");
      const clientName = readOption(args, "--client-name") ?? "kweaverc";
      const forceRegister = args.includes("--force-register");
      const lang = readOption(args, "--lang") ?? "zh-cn";
      const product = readOption(args, "--product") ?? "adp";
      const xForwardedPrefix = readOption(args, "--x-forwarded-prefix") ?? "";

      const result = await login({
        baseUrl: normalizeBaseUrl(target),
        port,
        clientName,
        open: true,
        forceRegister,
        lang,
        product,
        xForwardedPrefix,
      });

      console.log(`Config directory: ${getConfigDir()}`);
      console.log(getClientProvisioningMessage(result.created));
      console.log(`Client ID: ${result.client.clientId}`);
      console.log(`Authorization URL: ${result.authorizationUrl}`);
      console.log(`Callback received at: ${result.callback.receivedAt}`);
      console.log(`Access token saved: yes`);
      return 0;
    } catch (error) {
      console.error(formatHttpError(error));
      return 1;
    }
  }

  if (target === "status") {
    const { client, token, callback } = getStoredAuthSummary();

    if (!client) {
      console.error("No saved client config found.");
      return 1;
    }

    for (const line of formatAuthStatusSummary({ client, token, callback })) {
      console.log(line);
    }
    return 0;
  }

  console.error("Usage: kweaverc auth <platform-url>");
  console.error("       kweaverc auth status");
  return 1;
}

function readOption(args: string[], name: string): string | undefined {
  const index = args.findIndex((arg) => arg === name);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}
