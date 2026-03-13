# kweaver-caller

调用 KWeaver 的 TypeScript CLI 工具。

## 安装

需 Node.js 22+。全局安装或使用 `npx` 运行：

```bash
npm install -g kweaver-caller
```

```bash
npx kweaverc --help
```

全局安装后可直接使用：

```bash
kweaverc --help
```

## Skill

本仓库提供 Agent Skill `kweaver-core`，适用于 Cursor、Claude Code、Codex 等 AI 编程助手。安装：

```bash
npx skills add sh00tg0a1/kweaver-caller --skill kweaver-core
```

全局安装加 `-g`。详见 [skills.sh](https://skills.sh/sh00tg0a1/kweaver-caller/kweaver-core)。

## 开发

需 Node.js 22+。若使用 `nvm`，先执行 `nvm use` 以使用 `.nvmrc` 中的版本。

```bash
npm install
```

常用命令：

```bash
npm run dev
npm run build
npm test
```

本地运行编译后的 CLI：

```bash
node dist/cli.js --help
```

## 认证

所有命令均需先认证。使用其他命令前请先执行 `kweaverc auth <platform-url>`。若未认证，CLI 会提示你完成认证。

只需传入平台 base URL：

```bash
kweaverc auth https://platform.example.com
```

CLI 将认证状态按平台保存在 `~/.kweaver/platforms/`，并维护一个当前激活平台。若目标平台尚未存储客户端，会通过 `/oauth2/clients` 注册，生成完整 `/oauth2/auth?...` URL 并打开浏览器。你在浏览器中完成登录与验证。
CLI 同时在 `http://127.0.0.1:9010/callback` 启动本地回调监听，捕获返回的 `code`，换取 token，并将该平台设为当前平台。

保存平台时可指定简短别名：

```bash
kweaverc auth https://platform.example.com --alias primary
kweaverc auth https://platform2.example.com --alias secondary
```

查看或切换已保存平台：

```bash
kweaverc auth list
kweaverc auth status
kweaverc auth status primary
kweaverc auth use primary
```

## API 调用

使用已保存的 token 以 curl 风格参数调用 API。CLI 会自动注入 `Authorization: Bearer ...` 和 `token: ...`。

若当前平台的 `access_token` 已过期且存在 `refresh_token`，`kweaverc call` 会自动向 `/oauth2/token` 请求新 token，更新该平台的 token 文件，然后继续原 API 调用。若刷新失败，请再次执行 `kweaverc auth <platform-url>`。

直接打印当前 access token：

```bash
kweaverc token
```

与 `ref/test_api.js` 对齐的示例：

```bash
kweaverc call 'https://platform.example.com/api/agent-factory/v3/personal-space/agent-list?name=&pagination_marker_str=&publish_status=&publish_to_be=&size=48' -H 'accept: application/json, text/plain, */*' -H 'x-language: zh-CN' -H 'x-requested-with: XMLHttpRequest' -bd bd_public --pretty
```

加 `--verbose` 可打印最终请求方法、URL、请求头及是否发送 body。便于检查 `x-business-domain`、`authorization`、`token` 等 header 是否已正确附加。
`call` 和 `agent chat` 均支持 `-bd` 或 `--biz-domain`。若未指定，CLI 发送 `x-business-domain: bd_public`。

## Agent 对话

执行 `kweaverc auth <platform-url>` 后，传入 `agent_id` 即可与 Agent 对话。
发送对话请求前，CLI 会通过 `/api/agent-factory/v3/agent-market/agent/{agent_id}/version/{version}?is_visit=true` 解析 Agent 详情，读取返回的 `key`，再调用 `/api/agent-factory/v1/app/{agent_id}/chat/completion`。
若不传 `--version`，CLI 使用 `v0`。

交互模式会启动 REPL 并自动复用返回的 `conversation_id`：

```bash
kweaverc agent chat 01KFT0E68A1RES94ZV6DA131X4
kweaverc agent chat 01KFT0E68A1RES94ZV6DA131X4 --version v2
```

非交互模式发送单条消息后退出：

```bash
kweaverc agent chat 01KFT0E68A1RES94ZV6DA131X4 -m "你好"
```

续聊时传入 `--conversation-id` 或参考文档中的兼容别名：

```bash
kweaverc agent chat 01KFT0E68A1RES94ZV6DA131X4 -m "继续" --conversation-id conv_123
kweaverc agent chat 01KFT0E68A1RES94ZV6DA131X4 -m "继续" -conversation_id conv_123
```

流式输出在交互模式下默认开启，在 `-m` 模式下默认关闭。可用 `--stream` 或 `--no-stream` 覆盖。使用 `--verbose` 打印最终请求目标和请求体。使用 `-bd` 或 `--biz-domain` 覆盖 `x-business-domain`。
