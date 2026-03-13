# Agent 对话示例

按需阅读本文件：当你需要参考完整命令形态时，再看下面的示例。

## 列出 Agent

```bash
kweaverc agent list --pretty
```

## 首轮非流式消息

```bash
kweaverc agent chat <agent_id> -m "帮我总结这个问题" --no-stream
```

执行后，CLI 会在 stderr 打印续聊命令，其中包含 `conversation_id`。

## 续聊（带 conversation_id）

```bash
kweaverc agent chat <agent_id> -m "继续展开第二点" --conversation-id <conversation_id> --no-stream
```

使用短别名 `-cid`：

```bash
kweaverc agent chat <agent_id> -m "继续" -cid <conversation_id> --no-stream
```

## 调试示例（加 --verbose）

```bash
kweaverc agent chat <agent_id> -m "继续" -cid <conversation_id> --no-stream --verbose
```

`--verbose` 会在 stderr 额外打印 `conversation_id` 等请求详情。
