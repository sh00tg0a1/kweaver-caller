---
name: context-loader
description: 通过 MCP 调用 Context Loader 从业务知识网络检索概念、查询实例、解析逻辑属性、召回可执行行动。当需要查询知识网络数据时使用。
---

# Context Loader

为 Agent 提供来自业务知识网络（BKN）的上下文检索工具链。

默认只依赖本文件即可完成调用。仅当你需要参考完整 JSON、复杂 `query_instance_subgraph` 路径、或不确定字段该从上一步哪里提取时，再阅读 [examples.md](examples.md)。

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

## 使用前提

- 本 skill 默认 `context-loader` MCP 已可用
- 若 MCP 不可用，明确告知用户当前无法调用 `context-loader`，并提示先完成 MCP 接入；不要跳过此问题继续调用工具
- 接入 MCP 需要用户提供 `url`、token 和 `kn_id`
- 若连接已配置 `X-Kn-ID`，调用时通常无需再传 `kn_id`

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
