# Context Loader

为 Agent 提供来自 BKN 的上下文检索工具链，支持 kweaverc CLI 和 MCP 两种调用方式。

## 调用方式

- **kweaverc CLI**：需先登录并 `kweaverc context-loader config set --kn-id <kn-id>` 配置当前知识网络
- **MCP 客户端**：按 snake_case 工具名调用

## CLI 与 MCP 对应表

| CLI 子命令 | MCP 工具名 | 说明 |
|-------------|-----------|------|
| `tools` | tools/list | 列出可用工具 |
| `kn-search <query> [--only-schema]` | kn_search | Layer 1：检索 schema |
| `kn-schema-search <query> [--max N]` | kn_schema_search | Layer 1：发现候选概念 |
| `query-object-instance <json>` | query_object_instance | Layer 2：按条件查实例 |
| `query-instance-subgraph <json>` | query_instance_subgraph | Layer 2：子图查询 |
| `get-logic-properties <json>` | get_logic_properties_values | Layer 3：逻辑属性取值 |
| `get-action-info <json>` | get_action_info | Layer 3：行动召回 |

## 工具链数据流

6 个工具分三层，**不可跳层调用**：

```
Layer 1 - 探索发现（获取 Schema）
  kn_search / kn_schema_search
      │
      │ 输出: object_types, relation_types, action_types
      ▼
Layer 2 - 精确查询（获取实例）    ← 参数来自 Layer 1
  query_object_instance / query_instance_subgraph
      │
      │ 输出: datas / entries（含 _instance_identity）
      ▼
Layer 3 - 深度能力               ← 参数来自 Layer 1 + Layer 2
  get_logic_properties_values / get_action_info
```

## 参数来源速查

| kn_search 输出字段 | → 下游参数 |
|---|---|
| `object_types[].concept_id` | → `ot_id`、子图 `object_types[].id` |
| `object_types[].data_properties` | → condition 中可用的 `field` 名 |
| `object_types[].logic_properties` | → `get_logic_properties_values` 的 `properties` |
| `relation_types[].concept_id` | → 子图 `relation_type_id` |
| `relation_types[].source/target_object_type_id` | → 子图 `source/target_object_type_id` |
| `action_types[].id` | → `get_action_info` 的 `at_id` |

| Layer 2 输出字段 | → Layer 3 参数 |
|---|---|
| `datas[]._instance_identity` | → `_instance_identities`（数组）或 `_instance_identity`（单个） |
| `entries[*].objects[*][*]._instance_identity` | → 同上 |

## 关键约束

1. `_instance_identity` 不可臆造，必须原样从 Layer 2 提取
2. Condition 中 `value_from` 仅支持 `"const"`，必须与 `value` 同时出现；无条件时用 `{"operation":"and","sub_conditions":[]}`
3. 逻辑属性名必须来自 Schema 的 `logic_properties`
4. 子图路径方向必须与 Schema 一致，`source/target_object_type_id` 不可调换
5. 子图路径长度：n 跳 → `object_types` 长度 n+1，`relation_types` 长度 n
6. 逻辑属性缺参需重试：返回 `MISSING_INPUT_PARAMS` 时，按 `missing[].hint` 补充 `additional_context` 后重试
7. `kn_schema_search` 只用于发现候选概念，如需进入 Layer 2/3，须补做一次 `kn_search`

## MCP 服务配置示例

使用 kweaverc 时无需手写配置，只需 `config set --kn-id <kn-id>`。MCP 客户端需如下配置：

```json
{
  "mcpServers": {
    "context-loader": {
      "url": "https://<platform>/api/agent-retrieval/v1/mcp",
      "headers": {
        "Authorization": "Bearer <token>",
        "X-Kn-ID": "<kn-id>"
      }
    }
  }
}
```

## 完整示例

见 [examples.md](examples.md) 的 Context Loader 部分。
