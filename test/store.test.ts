import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

function createStoreDir(): string {
  return mkdtempSync(join(tmpdir(), "kweaverc-store-"));
}

async function importStoreModule(configDir: string) {
  process.env.KWEAVERC_CONFIG_DIR = configDir;
  const moduleUrl = pathToFileURL(join(process.cwd(), "src/config/store.ts")).href;
  return import(`${moduleUrl}?t=${Date.now()}-${Math.random()}`);
}

test("store saves multiple platforms and switches current platform", async () => {
  const configDir = createStoreDir();
  const store = await importStoreModule(configDir);

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
  store.setCurrentPlatform("https://dip.aishu.cn");

  store.saveClientConfig({
    baseUrl: "https://adp.aishu.cn",
    clientId: "client-b",
    clientSecret: "secret-b",
    redirectUri: "http://127.0.0.1:9010/callback",
    logoutRedirectUri: "http://127.0.0.1:9010/successful-logout",
    scope: "openid offline all",
  });

  assert.equal(store.getCurrentPlatform(), "https://dip.aishu.cn");
  assert.equal(store.loadClientConfig("https://dip.aishu.cn")?.clientId, "client-a");
  assert.equal(store.loadClientConfig("https://adp.aishu.cn")?.clientId, "client-b");

  store.setCurrentPlatform("https://adp.aishu.cn");

  assert.equal(store.getCurrentPlatform(), "https://adp.aishu.cn");
  assert.equal(store.loadClientConfig()?.baseUrl, "https://adp.aishu.cn");

  const platforms = store.listPlatforms();
  assert.equal(platforms.length, 2);
  assert.deepEqual(
    platforms.map((item: { baseUrl: string; hasToken: boolean; isCurrent: boolean }) => ({
      baseUrl: item.baseUrl,
      hasToken: item.hasToken,
      isCurrent: item.isCurrent,
    })),
    [
      { baseUrl: "https://adp.aishu.cn", hasToken: false, isCurrent: true },
      { baseUrl: "https://dip.aishu.cn", hasToken: true, isCurrent: false },
    ]
  );
});

test("store supports aliases and resolves them to platform urls", async () => {
  const configDir = createStoreDir();
  const store = await importStoreModule(configDir);

  store.saveClientConfig({
    baseUrl: "https://dip.aishu.cn",
    clientId: "client-a",
    clientSecret: "secret-a",
    redirectUri: "http://127.0.0.1:9010/callback",
    logoutRedirectUri: "http://127.0.0.1:9010/successful-logout",
    scope: "openid offline all",
  });
  store.setPlatformAlias("https://dip.aishu.cn", "dip");

  assert.equal(store.getPlatformAlias("https://dip.aishu.cn"), "dip");
  assert.equal(store.resolvePlatformIdentifier("dip"), "https://dip.aishu.cn");
  assert.equal(store.resolvePlatformIdentifier("https://dip.aishu.cn"), "https://dip.aishu.cn");

  store.saveClientConfig({
    baseUrl: "https://adp.aishu.cn",
    clientId: "client-b",
    clientSecret: "secret-b",
    redirectUri: "http://127.0.0.1:9010/callback",
    logoutRedirectUri: "http://127.0.0.1:9010/successful-logout",
    scope: "openid offline all",
  });

  assert.throws(
    () => store.setPlatformAlias("https://adp.aishu.cn", "dip"),
    /already assigned/
  );
});

test("store migrates legacy single-platform files automatically", async () => {
  const configDir = createStoreDir();
  mkdirSync(configDir, { recursive: true });

  writeFileSync(
    join(configDir, "client.json"),
    JSON.stringify({
      baseUrl: "https://dip.aishu.cn",
      clientId: "legacy-client",
      clientSecret: "legacy-secret",
      redirectUri: "http://127.0.0.1:9010/callback",
      logoutRedirectUri: "http://127.0.0.1:9010/successful-logout",
      scope: "openid offline all",
    })
  );
  writeFileSync(
    join(configDir, "token.json"),
    JSON.stringify({
      baseUrl: "https://dip.aishu.cn",
      accessToken: "legacy-token",
      tokenType: "bearer",
      scope: "openid offline all",
      refreshToken: "legacy-refresh",
      obtainedAt: "2026-03-11T00:00:00.000Z",
    })
  );
  writeFileSync(
    join(configDir, "callback.json"),
    JSON.stringify({
      baseUrl: "https://dip.aishu.cn",
      redirectUri: "http://127.0.0.1:9010/callback",
      code: "legacy-code",
      state: "legacy-state",
      receivedAt: "2026-03-11T00:00:00.000Z",
    })
  );

  const store = await importStoreModule(configDir);

  assert.equal(store.getCurrentPlatform(), "https://dip.aishu.cn");
  assert.equal(store.loadClientConfig()?.clientId, "legacy-client");
  assert.equal(store.loadTokenConfig()?.accessToken, "legacy-token");
  assert.equal(store.loadCallbackSession()?.code, "legacy-code");
  assert.deepEqual(
    store.listPlatforms().map(
      (item: { baseUrl: string; hasToken: boolean; isCurrent: boolean; alias?: string }) => ({
        baseUrl: item.baseUrl,
        hasToken: item.hasToken,
        isCurrent: item.isCurrent,
        alias: item.alias,
      })
    ),
    [{ baseUrl: "https://dip.aishu.cn", hasToken: true, isCurrent: true, alias: undefined }]
  );
});
