import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { run } from "../src/cli.js";
import {
  formatAuthStatusSummary,
  getClientProvisioningMessage,
} from "../src/commands/auth.js";
import {
  formatCallOutput,
  formatVerboseRequest,
  parseCallArgs,
  stripSseDoneMarker,
} from "../src/commands/call.js";
import { parseTokenArgs } from "../src/commands/token.js";
import {
  buildAuthorizationUrl,
  buildAuthRedirectConfig,
  formatHttpError,
  getAuthorizationSuccessMessage,
} from "../src/auth/oauth.js";
import { HttpError, NetworkRequestError } from "../src/utils/http.js";

function createConfigDir(): string {
  return mkdtempSync(join(tmpdir(), "kweaverc-cli-"));
}

async function importCliModule(configDir: string) {
  process.env.KWEAVERC_CONFIG_DIR = configDir;
  const moduleUrl = pathToFileURL(join(process.cwd(), "src/cli.ts")).href;
  return import(`${moduleUrl}?t=${Date.now()}-${Math.random()}`);
}

async function importAuthModule(configDir: string) {
  process.env.KWEAVERC_CONFIG_DIR = configDir;
  const moduleUrl = pathToFileURL(join(process.cwd(), "src/commands/auth.ts")).href;
  return import(`${moduleUrl}?t=${Date.now()}-${Math.random()}`);
}

async function importStoreModule(configDir: string) {
  process.env.KWEAVERC_CONFIG_DIR = configDir;
  const moduleUrl = pathToFileURL(join(process.cwd(), "src/config/store.ts")).href;
  return import(`${moduleUrl}?t=${Date.now()}-${Math.random()}`);
}

async function listen(server: ReturnType<typeof createServer>): Promise<number> {
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  return (server.address() as AddressInfo).port;
}

async function reservePort(): Promise<number> {
  const server = createServer();
  const port = await listen(server);
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
  return port;
}

test("parseCallArgs parses curl-style request flags", () => {
  const parsed = parseCallArgs([
    "https://dip.aishu.cn/api/demo",
    "-X",
    "POST",
    "-H",
    "accept: application/json",
    "-d",
    "{\"ping\":true}",
  ]);

  assert.equal(parsed.url, "https://dip.aishu.cn/api/demo");
  assert.equal(parsed.method, "POST");
  assert.equal(parsed.headers.get("accept"), "application/json");
  assert.equal(parsed.body, "{\"ping\":true}");
  assert.equal(parsed.pretty, false);
  assert.equal(parsed.verbose, false);
  assert.equal(parsed.businessDomain, "bd_public");
});

test("parseCallArgs defaults to POST when data is present", () => {
  const parsed = parseCallArgs(["https://dip.aishu.cn/api/demo", "-d", "x=1"]);
  assert.equal(parsed.method, "POST");
});

test("parseCallArgs supports pretty output", () => {
  const parsed = parseCallArgs(["https://dip.aishu.cn/api/demo", "--pretty"]);
  assert.equal(parsed.pretty, true);
});

test("parseCallArgs supports verbose output", () => {
  const parsed = parseCallArgs(["https://dip.aishu.cn/api/demo", "--verbose"]);
  assert.equal(parsed.verbose, true);
});

test("parseCallArgs supports custom business domain", () => {
  const parsed = parseCallArgs(["https://dip.aishu.cn/api/demo", "-bd", "bd_enterprise"]);
  assert.equal(parsed.businessDomain, "bd_enterprise");
});

test("parseTokenArgs accepts no flags", () => {
  assert.doesNotThrow(() => parseTokenArgs([]));
  assert.throws(() => parseTokenArgs(["--verbose"]), /Usage: kweaverc token/);
});

test("run succeeds for help", async () => {
  assert.equal(await run(["--help"]), 0);
});

test("run fails for unknown commands", async () => {
  assert.equal(await run(["missing-command"]), 1);
});

test("run agent shows subcommand help", async () => {
  assert.equal(await run(["agent"]), 0);
});

test("run agent --help shows subcommand help", async () => {
  assert.equal(await run(["agent", "--help"]), 0);
});

test("buildAuthorizationUrl generates a complete oauth url from client config", () => {
  const authorizationUrl = buildAuthorizationUrl(
    {
      baseUrl: "https://dip.aishu.cn",
      clientId: "client-123",
      clientSecret: "secret-123",
      redirectUri: "http://127.0.0.1:9010/callback",
      logoutRedirectUri: "http://127.0.0.1:9010/successful-logout",
      scope: "openid offline all",
      lang: "zh-cn",
      product: "adp",
      xForwardedPrefix: "",
    },
    "state-123"
  );

  const url = new URL(authorizationUrl);
  assert.equal(url.origin, "https://dip.aishu.cn");
  assert.equal(url.pathname, "/oauth2/auth");
  assert.equal(url.searchParams.get("client_id"), "client-123");
  assert.equal(url.searchParams.get("redirect_uri"), "http://127.0.0.1:9010/callback");
  assert.equal(url.searchParams.get("scope"), "openid offline all");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("state"), "state-123");
  assert.equal(url.searchParams.get("lang"), "zh-cn");
  assert.equal(url.searchParams.get("product"), "adp");
});

test("buildAuthRedirectConfig uses localhost callback by default", () => {
  const config = buildAuthRedirectConfig({ port: 9010 });

  assert.equal(config.redirectUri, "http://127.0.0.1:9010/callback");
  assert.equal(config.logoutRedirectUri, "http://127.0.0.1:9010/successful-logout");
  assert.equal(config.listenHost, "127.0.0.1");
  assert.equal(config.listenPort, 9010);
  assert.equal(config.callbackPath, "/callback");
});

test("buildAuthRedirectConfig supports host and redirect override", () => {
  const config = buildAuthRedirectConfig({
    port: 9010,
    host: "0.0.0.0",
    redirectUriOverride: "https://auth.example.com/kweaver/callback",
  });

  assert.equal(config.redirectUri, "https://auth.example.com/kweaver/callback");
  assert.equal(config.logoutRedirectUri, "https://auth.example.com/kweaver/successful-logout");
  assert.equal(config.listenHost, "0.0.0.0");
  assert.equal(config.listenPort, 9010);
  assert.equal(config.callbackPath, "/kweaver/callback");
});

test("login with --no-open prints headless instructions and accepts callback", async () => {
  const configDir = createConfigDir();
  process.env.KWEAVERC_CONFIG_DIR = configDir;

  const oauthServer = createServer((request, response) => {
    if (request.method === "POST" && request.url === "/oauth2/clients") {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ client_id: "client-headless", client_secret: "secret-headless" }));
      return;
    }

    if (request.method === "POST" && request.url === "/oauth2/token") {
      response.setHeader("content-type", "application/json");
      response.end(
        JSON.stringify({
          access_token: "token-headless",
          token_type: "bearer",
          scope: "openid offline all",
          refresh_token: "refresh-headless",
        })
      );
      return;
    }

    response.statusCode = 404;
    response.end("not found");
  });

  const platformPort = await listen(oauthServer);
  const callbackPort = await reservePort();
  const output: string[] = [];
  const originalConsoleLog = console.log;

  try {
    console.log = (...args: unknown[]) => {
      output.push(args.map(String).join(" "));
    };

    const loginPromise = import("../src/auth/oauth.js").then(({ login }) =>
      login({
        baseUrl: `http://127.0.0.1:${platformPort}`,
        port: callbackPort,
        clientName: "kweaverc-test",
        open: false,
        forceRegister: true,
        host: "127.0.0.1",
        redirectUriOverride: "https://auth.example.com/kweaver/callback",
      })
    );

    let authorizationUrl = "";
    for (let attempt = 0; attempt < 50; attempt += 1) {
      authorizationUrl = output.find((line) => line.includes("/oauth2/auth?")) ?? "";
      if (authorizationUrl) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    assert.ok(authorizationUrl, "expected auth URL to be printed in headless mode");
    const state = new URL(authorizationUrl).searchParams.get("state");
    assert.ok(state, "expected auth URL to include state");

    const callbackResponse = await fetch(
      `http://127.0.0.1:${callbackPort}/kweaver/callback?code=code-headless&state=${state}`
    );
    assert.equal(callbackResponse.status, 200);
    assert.equal(await callbackResponse.text(), getAuthorizationSuccessMessage());

    const result = await loginPromise;
    assert.equal(result.client.redirectUri, "https://auth.example.com/kweaver/callback");
    assert.equal(result.callback.code, "code-headless");
    assert.equal(result.token.accessToken, "token-headless");

    assert.ok(output.includes("Authorization URL:"));
    assert.ok(output.includes("Redirect URI: https://auth.example.com/kweaver/callback"));
    assert.ok(output.includes(`Waiting for OAuth callback on http://127.0.0.1:${callbackPort}/kweaver/callback`));
    assert.ok(output.includes("If your browser is on another machine, use SSH port forwarding first:"));
    assert.ok(output.includes(`ssh -L ${callbackPort}:127.0.0.1:${callbackPort} user@server`));
  } finally {
    console.log = originalConsoleLog;
    await new Promise<void>((resolve, reject) => {
      oauthServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }
});

test("getClientProvisioningMessage describes whether a client was reused or created", () => {
  assert.equal(getClientProvisioningMessage(true), "Registered a new OAuth client.");
  assert.equal(getClientProvisioningMessage(false), "Reusing existing OAuth client.");
});

test("help text exposes auth as completing oauth login through local callback", async () => {
  assert.equal(await run(["help"]), 0);
});

test("run auth delete removes a saved platform by alias", async () => {
  const configDir = createConfigDir();
  const store = await importStoreModule(configDir);
  const auth = await importAuthModule(configDir);

  store.saveClientConfig({
    baseUrl: "https://dip.aishu.cn",
    clientId: "client-a",
    clientSecret: "secret-a",
    redirectUri: "http://127.0.0.1:9010/callback",
    logoutRedirectUri: "http://127.0.0.1:9010/successful-logout",
    scope: "openid offline all",
  });
  store.saveTokenConfig({
    baseUrl: "https://dip.aishu.cn",
    accessToken: "token-a",
    tokenType: "bearer",
    scope: "openid offline all",
    obtainedAt: "2026-03-11T00:00:00.000Z",
  });
  store.setPlatformAlias("https://dip.aishu.cn", "dip");
  store.setCurrentPlatform("https://dip.aishu.cn");

  store.saveClientConfig({
    baseUrl: "https://adp.aishu.cn",
    clientId: "client-b",
    clientSecret: "secret-b",
    redirectUri: "http://127.0.0.1:9010/callback",
    logoutRedirectUri: "http://127.0.0.1:9010/successful-logout",
    scope: "openid offline all",
  });

  assert.equal(await auth.runAuthCommand(["delete", "dip"]), 0);
  assert.equal(store.hasPlatform("https://dip.aishu.cn"), false);
  assert.equal(store.getCurrentPlatform(), "https://adp.aishu.cn");
});

test("run auth logout clears token and callback but keeps client config", async () => {
  const configDir = createConfigDir();
  const store = await importStoreModule(configDir);
  const auth = await importAuthModule(configDir);

  store.saveClientConfig({
    baseUrl: "https://dip.aishu.cn",
    clientId: "client-a",
    clientSecret: "secret-a",
    redirectUri: "http://127.0.0.1:9010/callback",
    logoutRedirectUri: "http://127.0.0.1:9010/successful-logout",
    scope: "openid offline all",
  });
  store.saveTokenConfig({
    baseUrl: "https://dip.aishu.cn",
    accessToken: "token-a",
    tokenType: "bearer",
    scope: "openid offline all",
    obtainedAt: "2026-03-11T00:00:00.000Z",
  });
  store.saveCallbackSession({
    baseUrl: "https://dip.aishu.cn",
    redirectUri: "http://127.0.0.1:9010/callback",
    code: "code-1",
    state: "state-1",
    receivedAt: "2026-03-11T00:00:00.000Z",
  });
  store.setCurrentPlatform("https://dip.aishu.cn");

  assert.equal(store.loadTokenConfig("https://dip.aishu.cn")?.accessToken, "token-a");
  assert.equal(store.loadCallbackSession("https://dip.aishu.cn")?.code, "code-1");

  assert.equal(await auth.runAuthCommand(["logout"]), 0);

  assert.equal(store.hasPlatform("https://dip.aishu.cn"), true);
  assert.equal(store.loadClientConfig("https://dip.aishu.cn")?.clientId, "client-a");
  assert.equal(store.loadTokenConfig("https://dip.aishu.cn"), null);
  assert.equal(store.loadCallbackSession("https://dip.aishu.cn"), null);
  assert.equal(store.getCurrentPlatform(), "https://dip.aishu.cn");
});

test("formatAuthStatusSummary includes platform token and callback details", () => {
  const lines = formatAuthStatusSummary({
    client: {
      baseUrl: "https://dip.aishu.cn",
      clientId: "client-123",
      clientSecret: "secret-123",
      redirectUri: "http://127.0.0.1:9010/callback",
      logoutRedirectUri: "http://127.0.0.1:9010/successful-logout",
      scope: "openid offline all",
      lang: "zh-cn",
      product: "adp",
      xForwardedPrefix: "",
    },
    token: {
      baseUrl: "https://dip.aishu.cn",
      accessToken: "token-123",
      tokenType: "bearer",
      scope: "openid offline all",
      expiresAt: "2026-03-10T12:00:00.000Z",
      obtainedAt: "2026-03-10T11:00:00.000Z",
    },
    callback: {
      baseUrl: "https://dip.aishu.cn",
      redirectUri: "http://127.0.0.1:9010/callback",
      code: "code-123",
      state: "state-123",
      scope: "openid offline all",
      receivedAt: "2026-03-10T11:05:00.000Z",
    },
    isCurrent: true,
  });

  assert.ok(lines.includes("Platform: https://dip.aishu.cn"));
  assert.ok(lines.includes("Current platform: yes"));
  assert.ok(lines.includes("Token present: yes"));
  assert.ok(lines.includes("Callback recorded: yes"));
  assert.ok(lines.includes("Last callback at: 2026-03-10T11:05:00.000Z"));
  assert.ok(lines.includes("Last callback scope: openid offline all"));
});

test("formatHttpError expands network request failures with url and cause", () => {
  const message = formatHttpError(
    new NetworkRequestError(
      "POST",
      "https://adp.aishu.cn/oauth2/clients",
      "getaddrinfo ENOTFOUND adp.aishu.cn",
      "DNS lookup failed. Check whether the domain is correct and reachable from your network."
    )
  );

  assert.equal(
    message,
    "Network request failed\nMethod: POST\nURL: https://adp.aishu.cn/oauth2/clients\nCause: getaddrinfo ENOTFOUND adp.aishu.cn\nHint: DNS lookup failed. Check whether the domain is correct and reachable from your network."
  );
});

test("formatHttpError formats OAuth invalid_grant with readable hint", () => {
  const body = JSON.stringify({
    error: "invalid_grant",
    error_description:
      "The provided authorization grant (e.g., authorization code, resource owner credentials) or refresh token is invalid, expired, revoked, does not match the redirection URI used in the authorization request, or was issued to another client. The OAuth 2.0 Client ID from this request does not match the ID during the initial token issuance.",
  });
  const message = formatHttpError(new HttpError(400, "Bad Request", body));

  assert.ok(message.startsWith("HTTP 400 Bad Request"));
  assert.ok(message.includes("OAuth error: invalid_grant"));
  assert.ok(message.includes("Run `kweaverc auth <platform-url>` again to log in"));
});

test("getAuthorizationSuccessMessage tells the user to close the page", () => {
  assert.equal(
    getAuthorizationSuccessMessage(),
    "Authorization succeeded. You can close this page and return to the terminal."
  );
});

test("formatCallOutput pretty prints json when requested", () => {
  assert.equal(formatCallOutput("{\"ok\":true}", true), '{\n  "ok": true\n}');
  assert.equal(formatCallOutput("plain text", true), "plain text");
  assert.equal(formatCallOutput("{\"ok\":true}", false), "{\"ok\":true}");
});

test("stripSseDoneMarker removes terminal done event from event streams", () => {
  const text = 'data: {"ok":true}\n\ndata: [DONE]\n';
  assert.equal(stripSseDoneMarker(text, "text/event-stream"), 'data: {"ok":true}');
  assert.equal(stripSseDoneMarker(text, "application/json"), text);
});

test("formatVerboseRequest prints method url headers and body state", () => {
  const lines = formatVerboseRequest({
    url: "https://dip.aishu.cn/api/demo",
    method: "GET",
    headers: new Headers({
      accept: "application/json",
      "x-business-domain": "bd_public",
    }),
    pretty: false,
    verbose: true,
    businessDomain: "bd_public",
  });

  assert.ok(lines.includes("Method: GET"));
  assert.ok(lines.includes("URL: https://dip.aishu.cn/api/demo"));
  assert.ok(lines.includes("Headers:"));
  assert.ok(lines.includes("  accept: application/json"));
  assert.ok(lines.includes("  x-business-domain: bd_public"));
  assert.ok(lines.includes("Body: empty"));
});
