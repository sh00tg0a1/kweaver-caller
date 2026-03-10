import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

const CONFIG_DIR = join(homedir(), ".kweaver");
const CLIENT_FILE = join(CONFIG_DIR, "client.json");
const TOKEN_FILE = join(CONFIG_DIR, "token.json");
const CALLBACK_FILE = join(CONFIG_DIR, "callback.json");

function ensureConfigDir(): void {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
  }
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

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function loadClientConfig(): ClientConfig | null {
  return readJsonFile<ClientConfig>(CLIENT_FILE);
}

export function saveClientConfig(config: ClientConfig): void {
  writeJsonFile(CLIENT_FILE, config);
}

export function loadTokenConfig(): TokenConfig | null {
  return readJsonFile<TokenConfig>(TOKEN_FILE);
}

export function saveTokenConfig(config: TokenConfig): void {
  writeJsonFile(TOKEN_FILE, config);
}

export function loadCallbackSession(): CallbackSession | null {
  return readJsonFile<CallbackSession>(CALLBACK_FILE);
}

export function saveCallbackSession(session: CallbackSession): void {
  writeJsonFile(CALLBACK_FILE, session);
}
