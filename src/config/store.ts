import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
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
const PLATFORMS_DIR = join(CONFIG_DIR, "platforms");
const STATE_FILE = join(CONFIG_DIR, "state.json");

const LEGACY_CLIENT_FILE = join(CONFIG_DIR, "client.json");
const LEGACY_TOKEN_FILE = join(CONFIG_DIR, "token.json");
const LEGACY_CALLBACK_FILE = join(CONFIG_DIR, "callback.json");

function ensureDir(path: string): void {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true, mode: 0o700 });
  }
}

function ensureConfigDir(): void {
  ensureDir(CONFIG_DIR);
  ensureDir(PLATFORMS_DIR);
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
  return join(PLATFORMS_DIR, encodePlatformKey(baseUrl));
}

function getPlatformFile(baseUrl: string, filename: string): string {
  return join(getPlatformDir(baseUrl), filename);
}

function ensurePlatformDir(baseUrl: string): void {
  ensureDir(getPlatformDir(baseUrl));
}

function readState(): StoreState {
  return readJsonFile<StoreState>(STATE_FILE) ?? {};
}

function writeState(state: StoreState): void {
  writeJsonFile(STATE_FILE, state);
}

function normalizeAlias(value: string): string {
  return value.trim().toLowerCase();
}

function migrateLegacyFilesIfNeeded(): void {
  const hasLegacy = existsSync(LEGACY_CLIENT_FILE) || existsSync(LEGACY_TOKEN_FILE) || existsSync(LEGACY_CALLBACK_FILE);
  if (!hasLegacy) {
    return;
  }

  const legacyClient = readJsonFile<ClientConfig>(LEGACY_CLIENT_FILE);
  const legacyToken = readJsonFile<TokenConfig>(LEGACY_TOKEN_FILE);
  const legacyCallback = readJsonFile<CallbackSession>(LEGACY_CALLBACK_FILE);
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
  return CONFIG_DIR;
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

export function listPlatforms(): PlatformSummary[] {
  ensureStoreReady();
  const currentPlatform = getCurrentPlatform();
  const items: PlatformSummary[] = [];

  for (const entry of readdirSync(PLATFORMS_DIR)) {
    const dirPath = join(PLATFORMS_DIR, entry);
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
