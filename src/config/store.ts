import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ClientConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  logoutRedirectUri: string;
  scope: string;
  lang?: string;
  product?: string;
  xForwardedPrefix?: string;
}

export interface TokenConfig {
  baseUrl: string;
  accessToken: string;
  tokenType: string;
  scope: string;
  expiresIn?: number;
  expiresAt?: string;
  refreshToken?: string;
  idToken?: string;
  obtainedAt: string;
}

export interface CallbackSession {
  baseUrl: string;
  redirectUri: string;
  code: string;
  state: string;
  scope?: string;
  receivedAt: string;
}

interface StoreState {
  currentPlatform?: string;
  aliases?: Record<string, string>;
}

export interface PlatformSummary {
  baseUrl: string;
  hasToken: boolean;
  isCurrent: boolean;
  alias?: string;
}

const CONFIG_DIR = process.env.KWEAVERC_CONFIG_DIR || join(homedir(), ".kweaver");
function getConfigDirPath(): string {
  return process.env.KWEAVERC_CONFIG_DIR || join(homedir(), ".kweaver");
}

function getPlatformsDirPath(): string {
  return join(getConfigDirPath(), "platforms");
}

function getStateFilePath(): string {
  return join(getConfigDirPath(), "state.json");
}

function getLegacyClientFilePath(): string {
  return join(getConfigDirPath(), "client.json");
}

function getLegacyTokenFilePath(): string {
  return join(getConfigDirPath(), "token.json");
}

function getLegacyCallbackFilePath(): string {
  return join(getConfigDirPath(), "callback.json");
}

function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true, mode: 0o700 });
  }
}

function ensureConfigDir(): void {
  ensureDir(getConfigDirPath());
  ensureDir(getPlatformsDirPath());
}

function readJsonFile<T>(filePath: string): T | null {
  if (!existsSync(filePath)) {
    return null;
  }

  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

function writeJsonFile(filePath: string, value: unknown): void {
  ensureConfigDir();
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  chmodSync(filePath, 0o600);
}

function encodePlatformKey(baseUrl: string): string {
  return Buffer.from(baseUrl, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getPlatformDir(baseUrl: string): string {
  return join(getPlatformsDirPath(), encodePlatformKey(baseUrl));
}

function getPlatformFile(baseUrl: string, filename: string): string {
  return join(getPlatformDir(baseUrl), filename);
}

function ensurePlatformDir(baseUrl: string): void {
  ensureDir(getPlatformDir(baseUrl));
}

function readState(): StoreState {
  return readJsonFile<StoreState>(getStateFilePath()) ?? {};
}

function writeState(state: StoreState): void {
  writeJsonFile(getStateFilePath(), state);
}

function normalizeAlias(value: string): string {
  return value.trim().toLowerCase();
}

function migrateLegacyFilesIfNeeded(): void {
  const legacyClientFile = getLegacyClientFilePath();
  const legacyTokenFile = getLegacyTokenFilePath();
  const legacyCallbackFile = getLegacyCallbackFilePath();
  const hasLegacy =
    existsSync(legacyClientFile) || existsSync(legacyTokenFile) || existsSync(legacyCallbackFile);
  if (!hasLegacy) {
    return;
  }

  const legacyClient = readJsonFile<ClientConfig>(legacyClientFile);
  const legacyToken = readJsonFile<TokenConfig>(legacyTokenFile);
  const legacyCallback = readJsonFile<CallbackSession>(legacyCallbackFile);
  const baseUrl = legacyClient?.baseUrl ?? legacyToken?.baseUrl ?? legacyCallback?.baseUrl;

  if (!baseUrl) {
    return;
  }

  const platformClientFile = getPlatformFile(baseUrl, "client.json");
  const platformTokenFile = getPlatformFile(baseUrl, "token.json");
  const platformCallbackFile = getPlatformFile(baseUrl, "callback.json");
  ensurePlatformDir(baseUrl);

  if (legacyClient && !existsSync(platformClientFile)) {
    writeJsonFile(platformClientFile, legacyClient);
  }
  if (legacyToken && !existsSync(platformTokenFile)) {
    writeJsonFile(platformTokenFile, legacyToken);
  }
  if (legacyCallback && !existsSync(platformCallbackFile)) {
    writeJsonFile(platformCallbackFile, legacyCallback);
  }

  const state = readState();
  if (!state.currentPlatform) {
    writeState({ ...state, currentPlatform: baseUrl });
  }
}

function ensureStoreReady(): void {
  ensureConfigDir();
  migrateLegacyFilesIfNeeded();
}

export function getConfigDir(): string {
  return getConfigDirPath();
}

export function getCurrentPlatform(): string | null {
  ensureStoreReady();
  return readState().currentPlatform ?? null;
}

export function setCurrentPlatform(baseUrl: string): void {
  ensureStoreReady();
  const state = readState();
  writeState({ ...state, currentPlatform: baseUrl });
}

export function setPlatformAlias(baseUrl: string, alias: string): void {
  ensureStoreReady();
  const normalizedAlias = normalizeAlias(alias);
  if (!normalizedAlias) {
    throw new Error("Alias cannot be empty.");
  }

  const state = readState();
  const aliases = { ...(state.aliases ?? {}) };
  const existing = aliases[normalizedAlias];
  if (existing && existing !== baseUrl) {
    throw new Error(`Alias '${normalizedAlias}' is already assigned to ${existing}.`);
  }

  aliases[normalizedAlias] = baseUrl;
  writeState({ ...state, aliases });
}

export function deletePlatformAlias(baseUrl: string): void {
  ensureStoreReady();
  const state = readState();
  const aliases = { ...(state.aliases ?? {}) };
  let changed = false;

  for (const [alias, targetBaseUrl] of Object.entries(aliases)) {
    if (targetBaseUrl === baseUrl) {
      delete aliases[alias];
      changed = true;
    }
  }

  if (!changed) {
    return;
  }

  writeState({
    ...state,
    aliases: Object.keys(aliases).length > 0 ? aliases : undefined,
  });
}

export function getPlatformAlias(baseUrl: string): string | null {
  ensureStoreReady();
  const aliases = readState().aliases ?? {};
  for (const [alias, targetBaseUrl] of Object.entries(aliases)) {
    if (targetBaseUrl === baseUrl) {
      return alias;
    }
  }
  return null;
}

export function resolvePlatformIdentifier(value: string): string | null {
  ensureStoreReady();
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const aliases = readState().aliases ?? {};
  const aliasTarget = aliases[normalizeAlias(normalized)];
  if (aliasTarget) {
    return aliasTarget;
  }

  return normalized;
}

export function loadClientConfig(baseUrl?: string): ClientConfig | null {
  ensureStoreReady();
  const targetBaseUrl = baseUrl ?? getCurrentPlatform();
  if (!targetBaseUrl) {
    return null;
  }
  return readJsonFile<ClientConfig>(getPlatformFile(targetBaseUrl, "client.json"));
}

export function saveClientConfig(config: ClientConfig): void {
  ensureStoreReady();
  ensurePlatformDir(config.baseUrl);
  writeJsonFile(getPlatformFile(config.baseUrl, "client.json"), config);
}

export function loadTokenConfig(baseUrl?: string): TokenConfig | null {
  ensureStoreReady();
  const targetBaseUrl = baseUrl ?? getCurrentPlatform();
  if (!targetBaseUrl) {
    return null;
  }
  return readJsonFile<TokenConfig>(getPlatformFile(targetBaseUrl, "token.json"));
}

export function saveTokenConfig(config: TokenConfig): void {
  ensureStoreReady();
  ensurePlatformDir(config.baseUrl);
  writeJsonFile(getPlatformFile(config.baseUrl, "token.json"), config);
}

export function loadCallbackSession(baseUrl?: string): CallbackSession | null {
  ensureStoreReady();
  const targetBaseUrl = baseUrl ?? getCurrentPlatform();
  if (!targetBaseUrl) {
    return null;
  }
  return readJsonFile<CallbackSession>(getPlatformFile(targetBaseUrl, "callback.json"));
}

export function saveCallbackSession(session: CallbackSession): void {
  ensureStoreReady();
  ensurePlatformDir(session.baseUrl);
  writeJsonFile(getPlatformFile(session.baseUrl, "callback.json"), session);
}

export function hasPlatform(baseUrl: string): boolean {
  ensureStoreReady();
  return existsSync(getPlatformFile(baseUrl, "client.json"));
}

/**
 * Remove token and callback for a platform so the next auth will do a full login.
 * Keeps client config so the same app registration can be reused.
 */
export function clearPlatformSession(baseUrl: string): void {
  ensureStoreReady();
  const tokenFile = getPlatformFile(baseUrl, "token.json");
  const callbackFile = getPlatformFile(baseUrl, "callback.json");
  if (existsSync(tokenFile)) {
    rmSync(tokenFile, { force: true });
  }
  if (existsSync(callbackFile)) {
    rmSync(callbackFile, { force: true });
  }
}

export function deletePlatform(baseUrl: string): void {
  ensureStoreReady();
  const platformDir = getPlatformDir(baseUrl);
  if (!existsSync(platformDir)) {
    return;
  }

  deletePlatformAlias(baseUrl);
  rmSync(platformDir, { recursive: true, force: true });

  const state = readState();
  if (state.currentPlatform !== baseUrl) {
    return;
  }

  const remainingPlatforms = listPlatforms();
  writeState({
    ...readState(),
    currentPlatform: remainingPlatforms[0]?.baseUrl,
  });
}

export function listPlatforms(): PlatformSummary[] {
  ensureStoreReady();
  const currentPlatform = getCurrentPlatform();
  const items: PlatformSummary[] = [];

  for (const entry of readdirSync(getPlatformsDirPath())) {
    const dirPath = join(getPlatformsDirPath(), entry);
    if (!statSync(dirPath).isDirectory()) {
      continue;
    }

    const client = readJsonFile<ClientConfig>(join(dirPath, "client.json"));
    if (!client?.baseUrl) {
      continue;
    }

    items.push({
      baseUrl: client.baseUrl,
      hasToken: existsSync(join(dirPath, "token.json")),
      isCurrent: client.baseUrl === currentPlatform,
      alias: getPlatformAlias(client.baseUrl) ?? undefined,
    });
  }

  items.sort((a, b) => a.baseUrl.localeCompare(b.baseUrl));
  return items;
}
