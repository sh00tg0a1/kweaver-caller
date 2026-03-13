# Agent 对话

与 Agent 进行非交互式多轮对话。

## 命令表

| 命令 | 说明 |
| --- | --- |
| `kweaverc agent list [options]` | 列出已发布 Agent |
| `kweaverc agent chat <agent_id> -m "message" [options]` | 发送单轮消息（非交互） |

常用 chat 选项：`--no-stream`、`--conversation-id <id>` / `-cid <id>`、`--verbose`

## 默认策略

1. 先用 `kweaverc agent list --pretty` 查看可用 Agent
2. 首轮：`kweaverc agent chat <agent_id> -m "..." --no-stream`
3. 从返回中内部记录 `conversation_id`，默认不向用户展示
4. 续聊：`kweaverc agent chat <agent_id> -m "..." --conversation-id <id> --no-stream`

## 关键约束

- **不要**只运行 `kweaverc agent chat <agent_id>`（会进入交互模式）
- **不要**传 `--stream`
- **要**始终用 `-m` 指定消息
- 首轮不传 `--conversation-id`；续聊必须传

## 完整示例

见 [examples.md](examples.md) 的 Agent 对话部分。
