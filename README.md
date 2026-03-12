# kweaver-caller

A TypeScript CLI tool to call KWeaver.

## Install

Use Node from `.nvmrc`, then install globally or run with `npx`:

```bash
nvm use
npm install -g kweaver-caller
```

```bash
npx kweaverc --help
```

After global install, the command is available directly:

```bash
kweaverc --help
```

## Development

Use `nvm` to keep the Node version consistent:

```bash
nvm use
npm install
```

Common commands:

```bash
npm run dev
npm run build
npm test
```

Run the built CLI locally:

```bash
node dist/cli.js --help
```

## Auth

Use `nvm use` first, then pass only the platform base URL:

```bash
npm run build
kweaverc auth https://dip.aishu.cn
```

The CLI stores auth state per platform under `~/.kweaver/platforms/` and keeps one active platform pointer. If no client is stored for the target platform, it registers one through `/oauth2/clients`, generates the full `/oauth2/auth?...` URL, and opens the browser. You complete login and verification manually in the browser.
The CLI also starts a local callback listener on `http://127.0.0.1:9010/callback`, captures the returned `code`, exchanges it for tokens, and makes that platform the current one.

You can assign a short alias when saving a platform:

```bash
kweaverc auth https://dip.aishu.cn --alias dip
kweaverc auth https://adp.aishu.cn --alias adp
```

Inspect or switch saved platforms:

```bash
kweaverc auth list
kweaverc auth status
kweaverc auth status dip
kweaverc auth use dip
```

## API Call

Use the saved token to call APIs with curl-style flags. The CLI auto-injects both `Authorization: Bearer ...` and `token: ...`.

If the current platform's `access_token` has expired and a `refresh_token` is available, `kweaverc call` automatically requests a new token from `/oauth2/token`, updates that platform's token file, and then continues the original API call. If refresh fails, run `kweaverc auth <platform-url>` again.

Print the current access token directly:

```bash
kweaverc token
```

Example aligned with `ref/test_api.js`:

```bash
kweaverc call 'https://dip.aishu.cn/api/agent-factory/v3/personal-space/agent-list?name=&pagination_marker_str=&publish_status=&publish_to_be=&size=48' -H 'accept: application/json, text/plain, */*' -H 'x-language: zh-CN' -H 'x-requested-with: XMLHttpRequest' -bd bd_public --pretty
```

Add `--verbose` to print the final request method, URL, headers, and whether a body was sent. This is useful when checking whether headers such as `x-business-domain`, `authorization`, and `token` were actually attached.
Both `call` and `agent chat` accept `-bd` or `--biz-domain`. If omitted, the CLI sends `x-business-domain: bd_public`.

## Agent Chat

After `kweaverc auth <platform-url>`, chat with an agent by passing its `agent_id`.
Before sending the chat request, the CLI resolves the agent detail through `/api/agent-factory/v3/agent-market/agent/{agent_id}/version/{version}?is_visit=true`, reads the returned `key`, and then calls `/api/agent-factory/v1/app/{agent_id}/chat/completion`.
If you do not pass `--version`, the CLI uses `v0`.

Interactive mode starts a REPL and reuses the returned `conversation_id` automatically:

```bash
kweaverc agent chat 01KFT0E68A1RES94ZV6DA131X4
kweaverc agent chat 01KFT0E68A1RES94ZV6DA131X4 --version v2
```

Non-interactive mode sends a single message and exits:

```bash
kweaverc agent chat 01KFT0E68A1RES94ZV6DA131X4 -m "你好"
```

Continue an existing conversation by passing `--conversation-id` or the compatibility aliases used in the reference docs:

```bash
kweaverc agent chat 01KFT0E68A1RES94ZV6DA131X4 -m "继续" --conversation-id conv_123
kweaverc agent chat 01KFT0E68A1RES94ZV6DA131X4 -m "继续" -conversation_id conv_123
```

Streaming defaults to on in interactive mode and off in `-m` mode. Override it with `--stream` or `--no-stream`. Use `--verbose` to print the final request target and request body. Use `-bd` or `--biz-domain` to override `x-business-domain` when needed.
