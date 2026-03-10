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

## Publish

Before publishing:

```bash
nvm use
npm install
npm test
npm publish --access public
```

`prepublishOnly` runs the TypeScript build automatically before publish.

## Auth

Use `nvm use` first, then pass only the platform base URL:

```bash
npm run build
kweaverc auth https://dip.aishu.cn
```

The CLI checks `~/.kweaver/client.json`. If no client is stored for that platform, it registers one through `/oauth2/clients`, generates the full `/oauth2/auth?...` URL, and opens the browser. You complete login and verification manually in the browser.
The CLI also starts a local callback listener on `http://127.0.0.1:9010/callback`, captures the returned `code`, and exchanges it for tokens.

## API Call

Use the saved token to call APIs with curl-style flags. The CLI auto-injects both `Authorization: Bearer ...` and `token: ...`.

If the saved `access_token` has expired and a `refresh_token` is available, `kweaverc call` automatically requests a new token from `/oauth2/token`, updates `~/.kweaver/token.json`, and then continues the original API call. If refresh fails, run `kweaverc auth <platform-url>` again.

Example aligned with `ref/test_api.js`:

```bash
kweaverc call 'https://dip.aishu.cn/api/agent-factory/v3/personal-space/agent-list?name=&pagination_marker_str=&publish_status=&publish_to_be=&size=48' -H 'accept: application/json, text/plain, */*' -H 'x-business-domain: bd_public' -H 'x-language: zh-CN' -H 'x-requested-with: XMLHttpRequest' --pretty

Add `--verbose` to print the final request method, URL, headers, and whether a body was sent. This is useful when checking whether headers such as `x-business-domain`, `authorization`, and `token` were actually attached.
```
