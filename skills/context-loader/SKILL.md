---
name: context-loader
description: 通过 kweaverc CLI 或 MCP 调用 Context Loader，从业务知识网络检索概念、查询实例、解析逻辑属性、召回可执行行动。当需要查询知识网络数据时使用。
---

# Context Loader

为 Agent 提供来自业务知识网络（BKN）的上下文检索工具链。

默认只依赖本文件即可完成调用。仅当你需要参考完整 JSON、复杂 `query_instance_subgraph` 路径、或不确定字段该从上一步哪里提取时，再阅读 [examples.md](examples.md)。

## 如何调用

- **kweaverc CLI**（终端执行）：需先 `kweaverc auth <platform-url>` 登录，再 `kweaverc context-loader config set --kn-id <kn-id>` 配置当前知识网络；MCP URL 由当前平台自动推导，无需单独配置。若你还不知道 `kn-id`，先用 `kweaverc bkn list --pretty` 查知识网络，再视需要用 `kweaverc bkn get <kn-id> --stats --pretty` 或 `--export` 看详情。示例：`kweaverc context-loader kn-search "高血压 治疗 药品" --only-schema --pretty`。
- **MCP 客户端**：在已接入 context-loader MCP 的环境中，直接按工具名（snake_case）调用，参数结构见下文及 [examples.md](examples.md)。

本技能仅覆盖：**tools**（列出可用工具）与下述 6 个 BKN 工具；不涉及 resources、prompts 等。

### 使用 kweaverc 查询业务知识网络

在终端配置好登录与 `config set --kn-id` 后，可直接用 kweaverc 命令查询业务知识网络（BKN）：

- **先确认 BKN**：`kweaverc bkn list --pretty` 列出知识网络；若要确认详情或统计，使用 `kweaverc bkn get <kn-id> --pretty`、`kweaverc bkn get <kn-id> --stats --pretty` 或 `kweaverc bkn export <kn-id> --pretty`。
- **列出能力**：`kweaverc context-loader tools --pretty` 查看当前可用的工具列表。
- **Layer 1（探索 Schema）**：`kweaverc context-loader kn-search "<自然语言查询>" --only-schema --pretty` 检索对象类型、关系类型、行动类型；或 `kn-schema-search "<查询>" [--max N]` 做候选概念发现。
- **Layer 2（查实例）**：`kweaverc context-loader query-object-instance '<JSON>'`、`query-instance-subgraph '<JSON>'`，参数须从 Layer 1 的返回中提取（见下文参数来源速查）。
- **Layer 3（逻辑属性与行动）**：`kweaverc context-loader get-logic-properties '<JSON>'`、`get-action-info '<JSON>'`，参数依赖 Layer 1 的 schema 与 Layer 2 的 `_instance_identity`。

具体子命令与 MCP 方法对应关系见下表；完整 JSON 示例见 [examples.md](examples.md)。

## CLI 与 MCP 对应表

| CLI 子命令 | MCP 方法/工具名 | 说明 |
|-------------|-----------------|------|
| `tools` | tools/list | 列出可用工具 |
| `kn-search <query> [--only-schema]` | kn_search | Layer 1：检索 schema |
| `kn-schema-search <query> [--max N]` | kn_schema_search | Layer 1：发现候选概念 |
| `query-object-instance <json>` | query_object_instance | Layer 2：按条件查实例，参数为 JSON |
| `query-instance-subgraph <json>` | query_instance_subgraph | Layer 2：子图查询，参数为 JSON |
| `get-logic-properties <json>` | get_logic_properties_values | Layer 3：逻辑属性取值，参数为 JSON |
| `get-action-info <json>` | get_action_info | Layer 3：行动召回，参数为 JSON |

Layer 2/3 的 CLI 需将整段参数以 JSON 传入，例如：`kweaverc context-loader query-object-instance '{"ot_id":"disease","limit":5,"condition":{...}}' --pretty`。MCP 侧使用 snake_case 工具名（如 `kn_search`），CLI 使用上表中的子命令（如 `kn-search`）。

## MCP 服务配置示例（仅在使用 MCP 客户端时参考）

下面是 mcp 服务的示例

```json
{
  "mcpServers": {
    "context-loader": {
      "url": "https://dip.aishu.cn/api/agent-retrieval/v1/mcp",
      "headers": {
        "Authorization": "Bearer ory_at_wFkbe48zTRt4qxS_DisvC9Cij4SzmZW3U8Dqpczv8Yw.dJA43CvvrwC8vDAILOa53JIwewu3zy9vX7lugd_3ca4",
        "X-Kn-ID": "d5iv6c9818p72mpje8pg"
      }
    }
  }
}
```

使用 kweaverc 时无需手写上述配置，只需 `config set --kn-id <kn-id>`，URL 由当前平台自动推导。

## 使用前提

- **若使用 kweaverc**：需已登录（`kweaverc auth <platform-url>`）并配置 context-loader（`kweaverc context-loader config set --kn-id <kn-id>`）；若用户还未确定 `kn-id`，先建议执行 `kweaverc bkn list --pretty`。若未配置 context-loader，提示用户先执行上述命令。
- **若使用 MCP 客户端**：本 skill 默认 `context-loader` MCP 已可用；若不可用，明确告知用户并提示先完成 MCP 接入（需 `url`、token、`kn_id`）；若连接已配置 `X-Kn-ID`，调用时通常无需再传 `kn_id`。

## 工具链数据流

6 个工具分三层，**不可跳层调用**：

```
Layer 1 - 探索发现（获取 Schema）
  kn_search / kn_schema_search
      │
      │ 输出:
      │   kn_search -> object_types, relation_types, action_types
      │   kn_schema_search -> concepts（仅用于发现候选概念）
      ▼
Layer 2 - 精确查询（获取实例）    ← 参数来自 kn_search
  query_object_instance / query_instance_subgraph
      │
      │ 输出:
      │   query_object_instance -> datas（含 _instance_identity）
      │   query_instance_subgraph -> entries（嵌套对象中含 _instance_identity）
      ▼
Layer 3 - 深度能力               ← 参数来自 kn_search + Layer 2
  get_logic_properties_values / get_action_info
```

## 参数来源速查

### Layer 1 选择规则

- 默认优先使用 `kn_search`
- `kn_schema_search` 只用于发现候选概念，不要直接把 `concepts` 结果喂给 `query_*` 或 `get_*`
- 如果用了 `kn_schema_search` 且下一步要进入 `query_*` / `get_*`，先补做一次 `kn_search`，拿到结构化的 `object_types`、`relation_types`、`action_types`

### kn_search 输出 → 下游参数映射

| kn_search 输出字段 | → 下游工具的哪个参数 |
|---|---|
| `object_types[].concept_id` | → query_object_instance 的 `ot_id`<br>→ query_instance_subgraph 的 `object_types[].id`<br>→ get_logic_properties_values 的 `ot_id` |
| `object_types[].data_properties` | → Layer 2 condition 中可用的 `field` 名 |
| `object_types[].logic_properties` | → get_logic_properties_values 的 `properties` |
| `relation_types[].concept_id` | → query_instance_subgraph 的 `relation_type_id` |
| `relation_types[].source_object_type_id` | → query_instance_subgraph 的 `source_object_type_id` |
| `relation_types[].target_object_type_id` | → query_instance_subgraph 的 `target_object_type_id` |
| `action_types[].id` | → get_action_info 的 `at_id` |

### Layer 2 输出 → Layer 3 参数映射

| query 工具输出字段 | → 下游工具的哪个参数 |
|---|---|
| `query_object_instance.datas[]._instance_identity` | → get_logic_properties_values 的 `_instance_identities`（**数组**）<br>→ get_action_info 的 `_instance_identity`（**单个**） |
| `query_instance_subgraph.entries[*].objects[*][*]._instance_identity` | → get_logic_properties_values 的 `_instance_identities`（**数组**）<br>→ get_action_info 的 `_instance_identity`（**单个**） |

## 关键约束

1. **`_instance_identity` 不可臆造**：必须原样从 Layer 2 查询结果中提取
2. **Condition 中 `value_from` 仅支持 `"const"`**，必须与 `value` 同时出现；无条件时用 `{"operation":"and","sub_conditions":[]}`
3. **逻辑属性名必须来自 Schema**：`properties` 只能填 `logic_properties` 中出现的名称
4. **子图路径方向必须与 Schema 一致**：`source/target_object_type_id` 必须与 kn_search 返回的关系类定义完全一致
5. **子图路径长度**：n 跳 → `object_types` 长度 n+1，`relation_types` 长度 n
6. **逻辑属性缺参需重试**：返回 `MISSING_INPUT_PARAMS` 时，按 `missing[].hint` 补充 `additional_context` 后重试

以上工具在 MCP 侧使用 snake_case 名称（如 `kn_search`），在 kweaverc 侧使用对应子命令（如 `kn-search`），见上文「CLI 与 MCP 对应表」。
