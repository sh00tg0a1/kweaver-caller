---
name: agent
description: 通过 kweaverc 与 Agent 对话，默认非流式、非交互，使用 conversation_id 续聊。当用户要和某个 Agent 持续多轮对话时使用。
---

# Agent 对话

用于通过 `kweaverc` 与 Agent 进行非交互式多轮对话。对外统一叫「Agent 对话」，参数术语为 `agent_id`、`conversation_id`，行为分为「首轮」和「续聊」。

默认只依赖本文件即可完成调用。仅当你需要完整命令示例时，再阅读 [examples.md](examples.md)。

## 适用范围

本 skill 只覆盖：

- `kweaverc agent list`：查看可用 Agent 列表，用于选择目标 Agent
- `kweaverc agent chat <agent_id> -m "..."`：发起单轮消息（非交互）
- `kweaverc agent chat <agent_id> -m "..." --conversation-id <id>`：使用 `conversation_id` 继续多轮对话

不覆盖：

- TUI / 交互式聊天
- 流式输出
- Agent 开发或配置

## 使用前提

- 先登录：`kweaverc auth <platform-url>`
- 默认使用当前已登录平台的 token 与 base URL
- 若请求失败，优先检查当前平台是否正确、token 是否过期

## 推荐默认策略

1. **如用户还不知道可用 Agent**：先用 `kweaverc agent list --pretty` 或默认简化输出查看列表
2. **发起首轮**：固定使用 `kweaverc agent chat <agent_id> -m "..." --no-stream`
3. **收到返回后**：从 CLI 输出中内部记录 `conversation_id`，用于后续续聊，但默认不向用户展示该值
4. **后续继续对话**：固定使用 `kweaverc agent chat <agent_id> -m "..." --conversation-id <id> --no-stream`
5. **除非用户明确要求**：不进入交互模式，不启用 `--stream`

## 关键约束

- **不要**只运行 `kweaverc agent chat <agent_id>`，因为这会进入交互模式
- **不要**传 `--stream`
- **要**始终用 `-m` / `--message` 指定消息内容
- **首轮**没有 `conversation_id` 时不传该参数
- **续聊**必须传 `--conversation-id` 或 `-cid`
- `conversation_id` 仅作为内部续聊状态使用，默认不需要展示给用户
- 若需要更完整调试信息，可加 `--verbose`，但默认不用

## 命令总览

| 命令 | 说明 |
| --- | --- |
| `kweaverc agent list [options]` | 列出已发布 Agent |
| `kweaverc agent chat <agent_id> -m "message" [options]` | 发送单轮消息（非交互） |

常用 chat 选项：

- `--no-stream`：关闭流式输出（推荐显式指定）
- `--conversation-id <id>` / `-cid <id>`：续聊时传入
- `--verbose` / `-v`：打印请求详情到 stderr

## 输出与术语

- 对外说「Agent 对话」
- 对参数说 `agent_id`、`conversation_id`
- 对行为说「首轮」和「续聊」
- 默认不向用户回显 `conversation_id`，只在内部保存并用于下一轮命令

## 相关文件

- 主命令实现：`src/commands/agent.ts`
- 对话实现：`src/commands/agent-chat.ts`
- 示例：`examples.md`
