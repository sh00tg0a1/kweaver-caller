import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { URL } from "node:url";

import { openBrowser } from "../utils/browser.js";
import { fetchTextOrThrow, HttpError, NetworkRequestError } from "../utils/http.js";
import {
  type CallbackSession,
  type ClientConfig,
  type TokenConfig,
  loadCallbackSession,
  loadClientConfig,
  loadTokenConfig,
  saveCallbackSession,
  saveClientConfig,
  saveTokenConfig,
} from "../config/store.js";

interface RegisterClientOptions {
  baseUrl: string;
  clientName: string;
  redirectUri: string;
  logoutRedirectUri: string;
  lang?: string;
  product?: string;
  xForwardedPrefix?: string;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in?: number;
  refresh_token?: string;
  id_token?: string;
}

export function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "");
}

function randomValue(size = 24): string {
  return randomBytes(size).toString("hex");
}

export function getAuthorizationSuccessMessage(): string {
  return "Authorization succeeded. You can close this page and return to the terminal.";
}

function toBasicAuth(clientId: string, clientSecret: string): string {
  const user = encodeURIComponent(clientId);
  const password = encodeURIComponent(clientSecret);
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

function buildTokenConfig(baseUrl: string, token: TokenResponse): TokenConfig {
  const obtainedAt = new Date().toISOString();
  const expiresAt =
    token.expires_in === undefined
      ? undefined
      : new Date(Date.now() + token.expires_in * 1000).toISOString();

  return {
    baseUrl,
    accessToken: token.access_token,
    tokenType: token.token_type,
    scope: token.scope,
    expiresIn: token.expires_in,
    expiresAt,
    refreshToken: token.refresh_token,
    idToken: token.id_token,
    obtainedAt,
  };
}

export async function registerClient(options: RegisterClientOptions): Promise<ClientConfig> {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const payload = {
    client_name: options.clientName,
    grant_types: ["authorization_code", "implicit", "refresh_token"],
    response_types: ["token id_token", "code", "token"],
    scope: "openid offline all",
    redirect_uris: [options.redirectUri],
    post_logout_redirect_uris: [options.logoutRedirectUri],
    metadata: {
      device: {
        name: options.clientName,
        client_type: "web",
        description: "kweaverc CLI",
      },
    },
  };

  const { body } = await fetchTextOrThrow(`${baseUrl}/oauth2/clients`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = JSON.parse(body) as { client_id: string; client_secret: string };
  const clientConfig: ClientConfig = {
    baseUrl,
    clientId: data.client_id,
    clientSecret: data.client_secret,
    redirectUri: options.redirectUri,
    logoutRedirectUri: options.logoutRedirectUri,
    scope: payload.scope,
    lang: options.lang,
    product: options.product,
    xForwardedPrefix: options.xForwardedPrefix,
  };

  saveClientConfig(clientConfig);
  return clientConfig;
}

export interface EnsureClientOptions {
  baseUrl: string;
  port: number;
  clientName: string;
  forceRegister: boolean;
  lang?: string;
  product?: string;
  xForwardedPrefix?: string;
}

export interface EnsuredClientConfig {
  client: ClientConfig;
  created: boolean;
}

export async function ensureClientConfig(options: EnsureClientOptions): Promise<EnsuredClientConfig> {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const redirectUri = `http://127.0.0.1:${options.port}/callback`;
  const logoutRedirectUri = `http://127.0.0.1:${options.port}/successful-logout`;

  const client = loadClientConfig();
  if (
    client &&
    !options.forceRegister &&
    client.baseUrl === baseUrl &&
    client.redirectUri === redirectUri &&
    client.clientId &&
    client.clientSecret
  ) {
    return { client, created: false };
  }

  const createdClient = await registerClient({
    baseUrl,
    clientName: options.clientName,
    redirectUri,
    logoutRedirectUri,
    lang: options.lang,
    product: options.product,
    xForwardedPrefix: options.xForwardedPrefix,
  });

  return {
    client: createdClient,
    created: true,
  };
}

export function buildAuthorizationUrl(client: ClientConfig, state = randomValue(12)): string {
  const authorizationUrl = new URL(`${client.baseUrl}/oauth2/auth`);
  authorizationUrl.searchParams.set("redirect_uri", client.redirectUri);
  authorizationUrl.searchParams.set("x-forwarded-prefix", client.xForwardedPrefix ?? "");
  authorizationUrl.searchParams.set("client_id", client.clientId);
  authorizationUrl.searchParams.set("scope", client.scope);
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("lang", client.lang ?? "zh-cn");
  if (client.product) {
    authorizationUrl.searchParams.set("product", client.product);
  }

  return authorizationUrl.toString();
}

function waitForAuthorizationCode(
  redirectUri: string,
  expectedState: string
): Promise<{ code: string; state: string; scope?: string }> {
  const redirect = new URL(redirectUri);
  const hostname = redirect.hostname;
  const port = Number(redirect.port || 80);
  const pathname = redirect.pathname;

  return new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      if (!request.url) {
        response.statusCode = 400;
        response.end("Missing request URL");
        return;
      }

      const callbackUrl = new URL(request.url, `${redirect.protocol}//${request.headers.host}`);
      if (callbackUrl.pathname !== pathname) {
        response.statusCode = 404;
        response.end("Not Found");
        return;
      }

      const error = callbackUrl.searchParams.get("error");
      if (error) {
        response.statusCode = 400;
        response.end(`Authorization failed: ${error}`);
        server.close();
        reject(new Error(`Authorization failed: ${error}`));
        return;
      }

      const state = callbackUrl.searchParams.get("state");
      if (state !== expectedState) {
        response.statusCode = 400;
        response.end("State mismatch");
        server.close();
        reject(new Error("State mismatch in OAuth callback"));
        return;
      }

      const code = callbackUrl.searchParams.get("code");
      if (!code) {
        response.statusCode = 400;
        response.end("Missing authorization code");
        server.close();
        reject(new Error("Missing authorization code"));
        return;
      }

      response.statusCode = 200;
      response.setHeader("content-type", "text/plain; charset=utf-8");
      response.end(getAuthorizationSuccessMessage());
      server.close();
      resolve({
        code,
        state,
        scope: callbackUrl.searchParams.get("scope") ?? undefined,
      });
    });

    server.on("error", (error) => reject(error));
    server.listen(port, hostname);
  });
}

async function exchangeAuthorizationCode(client: ClientConfig, code: string): Promise<TokenConfig> {
  const payload = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: client.redirectUri,
  });

  const { body } = await fetchTextOrThrow(`${client.baseUrl}/oauth2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
      authorization: toBasicAuth(client.clientId, client.clientSecret),
    },
    body: payload.toString(),
  });

  const tokenConfig = buildTokenConfig(client.baseUrl, JSON.parse(body) as TokenResponse);
  saveTokenConfig(tokenConfig);
  return tokenConfig;
}

export async function refreshAccessToken(client: ClientConfig, refreshToken: string): Promise<TokenConfig> {
  const payload = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const { body } = await fetchTextOrThrow(`${client.baseUrl}/oauth2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/json",
      authorization: toBasicAuth(client.clientId, client.clientSecret),
    },
    body: payload.toString(),
  });

  const parsed = JSON.parse(body) as TokenResponse;
  const tokenConfig = buildTokenConfig(client.baseUrl, {
    ...parsed,
    refresh_token: parsed.refresh_token ?? refreshToken,
  });
  saveTokenConfig(tokenConfig);
  return tokenConfig;
}

export async function ensureValidToken(): Promise<TokenConfig> {
  const client = loadClientConfig();
  const token = loadTokenConfig();

  if (!client || !token) {
    throw new Error("Missing saved credentials. Run `kweaverc auth <platform-url>` first.");
  }

  if (!token.expiresAt) {
    return token;
  }

  const expiresAtMs = Date.parse(token.expiresAt);
  if (Number.isNaN(expiresAtMs) || expiresAtMs - 60_000 > Date.now()) {
    return token;
  }

  if (!token.refreshToken) {
    throw new Error("Access token expired and no refresh token is available. Run auth login again.");
  }

  return refreshAccessToken(client, token.refreshToken);
}

export interface AuthLoginOptions {
  baseUrl: string;
  port: number;
  clientName: string;
  open: boolean;
  forceRegister: boolean;
  lang?: string;
  product?: string;
  xForwardedPrefix?: string;
}

export async function login(options: AuthLoginOptions): Promise<{
  client: ClientConfig;
  token: TokenConfig;
  authorizationUrl: string;
  callback: CallbackSession;
  created: boolean;
}> {
  const { client, created } = await ensureClientConfig({
    baseUrl: options.baseUrl,
    port: options.port,
    clientName: options.clientName,
    forceRegister: options.forceRegister,
    lang: options.lang,
    product: options.product,
    xForwardedPrefix: options.xForwardedPrefix,
  });
  const state = randomValue(12);
  const authorizationUrl = buildAuthorizationUrl(client, state);

  const waitForCode = waitForAuthorizationCode(client.redirectUri, state);
  console.log(`Waiting for OAuth callback on ${client.redirectUri}`);

  if (options.open) {
    console.log(`Opening browser for authorization: ${authorizationUrl}`);
    const opened = await openBrowser(authorizationUrl);
    if (!opened) {
      console.error("Failed to open a browser automatically. Open this URL manually:");
      console.error(authorizationUrl);
    }
  } else {
    console.log(`Open this URL to continue: ${authorizationUrl}`);
  }

  const callbackResult = await waitForCode;
  const callback: CallbackSession = {
    baseUrl: client.baseUrl,
    redirectUri: client.redirectUri,
    code: callbackResult.code,
    state: callbackResult.state,
    scope: callbackResult.scope,
    receivedAt: new Date().toISOString(),
  };
  saveCallbackSession(callback);

  const token = await exchangeAuthorizationCode(client, callbackResult.code);

  return { client, token, authorizationUrl, callback, created };
}

export function getStoredAuthSummary(): {
  client: ClientConfig | null;
  token: TokenConfig | null;
  callback: CallbackSession | null;
} {
  return {
    client: loadClientConfig(),
    token: loadTokenConfig(),
    callback: loadCallbackSession(),
  };
}

export function formatHttpError(error: unknown): string {
  if (error instanceof HttpError) {
    return `${error.message}\n${error.body}`.trim();
  }

  if (error instanceof NetworkRequestError) {
    return [
      error.message,
      `Method: ${error.method}`,
      `URL: ${error.url}`,
      `Cause: ${error.causeMessage}`,
      `Hint: ${error.hint}`,
    ].join("\n").trim();
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
