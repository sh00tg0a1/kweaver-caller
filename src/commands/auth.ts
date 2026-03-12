import {
  deletePlatform,
  getConfigDir,
  getCurrentPlatform,
  getPlatformAlias,
  hasPlatform,
  listPlatforms,
  resolvePlatformIdentifier,
  setCurrentPlatform,
  setPlatformAlias,
} from "../config/store.js";
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
  isCurrent?: boolean;
}): string[] {
  const lines = [
    `Config directory: ${getConfigDir()}`,
    `Platform: ${input.client.baseUrl}`,
    `Current platform: ${input.isCurrent ? "yes" : "no"}`,
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

  if (target && target !== "status" && target !== "list" && target !== "use" && target !== "delete") {
    try {
      const normalizedTarget = normalizeBaseUrl(target);
      const port = Number(readOption(args, "--port") ?? "9010");
      const clientName = readOption(args, "--client-name") ?? "kweaverc";
      const alias = readOption(args, "--alias");
      const host = readOption(args, "--host");
      const redirectUriOverride = readOption(args, "--redirect-uri");
      const forceRegister = args.includes("--force-register");
      const open = !args.includes("--no-open");
      const lang = readOption(args, "--lang") ?? "zh-cn";
      const product = readOption(args, "--product") ?? "adp";
      const xForwardedPrefix = readOption(args, "--x-forwarded-prefix") ?? "";

      const result = await login({
        baseUrl: normalizedTarget,
        port,
        clientName,
        open,
        forceRegister,
        host,
        redirectUriOverride,
        lang,
        product,
        xForwardedPrefix,
      });

      if (alias) {
        setPlatformAlias(normalizedTarget, alias);
      }

      console.log(`Config directory: ${getConfigDir()}`);
      console.log(getClientProvisioningMessage(result.created));
      console.log(`Client ID: ${result.client.clientId}`);
      if (alias) {
        console.log(`Alias: ${alias.toLowerCase()}`);
      } else {
        const savedAlias = getPlatformAlias(result.client.baseUrl);
        if (savedAlias) {
          console.log(`Alias: ${savedAlias}`);
        }
      }
      console.log(`Authorization URL: ${result.authorizationUrl}`);
      console.log(`Callback received at: ${result.callback.receivedAt}`);
      console.log(`Current platform: ${result.client.baseUrl}`);
      console.log(`Access token saved: yes`);
      return 0;
    } catch (error) {
      console.error(formatHttpError(error));
      return 1;
    }
  }

  if (target === "status") {
    const resolvedTarget = args[1] ? resolvePlatformIdentifier(args[1]) : undefined;
    const statusTarget =
      resolvedTarget && /^https?:\/\//.test(resolvedTarget) ? normalizeBaseUrl(resolvedTarget) : resolvedTarget ?? undefined;
    const { client, token, callback } = getStoredAuthSummary(statusTarget);

    if (!client) {
      console.error(
        statusTarget ? `No saved client config found for ${statusTarget}.` : "No saved client config found."
      );
      return 1;
    }

    const currentPlatform = getCurrentPlatform();
    for (const line of formatAuthStatusSummary({
      client,
      token,
      callback,
      isCurrent: currentPlatform === client.baseUrl,
    })) {
      console.log(line);
    }
    return 0;
  }

  if (target === "list") {
    const currentPlatform = getCurrentPlatform();
    const platforms = listPlatforms();
    if (platforms.length === 0) {
      console.error("No saved platforms found.");
      return 1;
    }

    console.log(`Config directory: ${getConfigDir()}`);
    for (const platform of platforms) {
      const marker = platform.baseUrl === currentPlatform ? "*" : "-";
      const aliasPart = platform.alias ? ` alias=${platform.alias}` : "";
      console.log(`${marker} ${platform.baseUrl}${aliasPart}  token=${platform.hasToken ? "yes" : "no"}`);
    }
    return 0;
  }

  if (target === "use") {
    const resolvedTarget = args[1] ? resolvePlatformIdentifier(args[1]) : "";
    const useTarget =
      resolvedTarget && /^https?:\/\//.test(resolvedTarget) ? normalizeBaseUrl(resolvedTarget) : resolvedTarget;
    if (!useTarget) {
      console.error("Usage: kweaverc auth use <platform-url|alias>");
      return 1;
    }
    if (!hasPlatform(useTarget)) {
      console.error(`No saved client config found for ${useTarget}. Run \`kweaverc auth ${useTarget}\` first.`);
      return 1;
    }
    setCurrentPlatform(useTarget);
    console.log(`Current platform: ${useTarget}`);
    return 0;
  }

  if (target === "delete") {
    const resolvedTarget = args[1] ? resolvePlatformIdentifier(args[1]) : "";
    const deleteTarget =
      resolvedTarget && /^https?:\/\//.test(resolvedTarget) ? normalizeBaseUrl(resolvedTarget) : resolvedTarget;
    if (!deleteTarget) {
      console.error("Usage: kweaverc auth delete <platform-url|alias>");
      return 1;
    }
    if (!hasPlatform(deleteTarget)) {
      console.error(`No saved client config found for ${deleteTarget}.`);
      return 1;
    }

    const wasCurrent = getCurrentPlatform() === deleteTarget;
    deletePlatform(deleteTarget);
    console.log(`Deleted platform: ${deleteTarget}`);
    if (wasCurrent) {
      const nextCurrent = getCurrentPlatform();
      console.log(`Current platform: ${nextCurrent ?? "none"}`);
    }
    return 0;
  }

  console.error("Usage: kweaverc auth <platform-url>");
  console.error("       kweaverc auth <platform-url> [--alias <name>] [--no-open] [--host <host>] [--redirect-uri <uri>]");
  console.error("       kweaverc auth status [platform-url|alias]");
  console.error("       kweaverc auth list");
  console.error("       kweaverc auth use <platform-url|alias>");
  console.error("       kweaverc auth delete <platform-url|alias>");
  return 1;
}

function readOption(args: string[], name: string): string | undefined {
  const index = args.findIndex((arg) => arg === name);
  if (index === -1) {
    return undefined;
  }

  return args[index + 1];
}
