import test from "node:test";
import assert from "node:assert/strict";

import { run } from "../src/cli.js";
import {
  formatAuthStatusSummary,
  getClientProvisioningMessage,
} from "../src/commands/auth.js";
import {
  formatCallOutput,
  formatVerboseRequest,
  parseCallArgs,
} from "../src/commands/call.js";
import {
  buildAuthorizationUrl,
  formatHttpError,
  getAuthorizationSuccessMessage,
} from "../src/auth/oauth.js";
import { NetworkRequestError } from "../src/utils/http.js";

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

test("run succeeds for help", async () => {
  assert.equal(await run(["--help"]), 0);
});

test("run fails for unknown commands", async () => {
  assert.equal(await run(["missing-command"]), 1);
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

test("getClientProvisioningMessage describes whether a client was reused or created", () => {
  assert.equal(getClientProvisioningMessage(true), "Registered a new OAuth client.");
  assert.equal(getClientProvisioningMessage(false), "Reusing existing OAuth client.");
});

test("help text exposes auth as completing oauth login through local callback", async () => {
  assert.equal(await run(["help"]), 0);
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
  });

  assert.ok(lines.includes("Platform: https://dip.aishu.cn"));
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
  });

  assert.ok(lines.includes("Method: GET"));
  assert.ok(lines.includes("URL: https://dip.aishu.cn/api/demo"));
  assert.ok(lines.includes("Headers:"));
  assert.ok(lines.includes("  accept: application/json"));
  assert.ok(lines.includes("  x-business-domain: bd_public"));
  assert.ok(lines.includes("Body: empty"));
});
