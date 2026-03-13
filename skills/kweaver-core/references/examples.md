# kweaverc 命令示例

按需阅读本文件：当你需要参考完整命令形态或端到端 JSON 时使用。

---

## 认证

```bash
kweaverc auth https://platform.example.com
kweaverc auth https://platform.example.com --alias primary
kweaverc auth list
kweaverc auth status
kweaverc auth use primary
kweaverc auth logout
kweaverc token
```

---

## Agent 对话

列出 Agent：

```bash
kweaverc agent list --pretty
```

首轮非流式消息：

```bash
kweaverc agent chat <agent_id> -m "帮我总结这个问题" --no-stream
```

续聊（带 conversation_id）：

```bash
kweaverc agent chat <agent_id> -m "继续展开第二点" --conversation-id <conversation_id> --no-stream
kweaverc agent chat <agent_id> -m "继续" -cid <conversation_id> --no-stream
```

调试（加 --verbose）：

```bash
kweaverc agent chat <agent_id> -m "继续" -cid <conversation_id> --no-stream --verbose
```

---

## BKN 管理

列表：

```bash
kweaverc bkn list --pretty
kweaverc bkn list --detail --pretty
kweaverc bkn list --name-pattern incident --tag prod --sort name --direction asc --pretty
kweaverc bkn list --verbose --pretty
```

查看详情：

```bash
kweaverc bkn get <kn-id> --pretty
kweaverc bkn stats <kn-id> --pretty
kweaverc bkn export <kn-id> --pretty
```

创建（flags）：

```bash
kweaverc bkn create \
  --name "DIP系统故障事件网络" \
  --comment "系统故障场景知识网络" \
  --tags incident,system \
  --branch main \
  --base-branch "" \
  --pretty
```

创建（body-file）：

```bash
kweaverc bkn create --body-file ./network.json --import-mode overwrite --validate-dependency false --pretty
```

更新：

```bash
kweaverc bkn update <kn-id> \
  --name "DIP系统故障事件网络" \
  --comment "更新后的备注" \
  --tags incident,system,prod \
  --pretty
```

删除：

```bash
kweaverc bkn delete <kn-id>
```

---

## BKN 查询（ontology-query）

对象实例查询：

```bash
kweaverc bkn object-type query <kn-id> <ot-id> --limit 10 --pretty
```

带条件查询：

```bash
kweaverc bkn object-type query <kn-id> <ot-id> '{"condition":{"operation":"and","sub_conditions":[]}}' --limit 10 --pretty
```

下一页：

```bash
kweaverc bkn object-type query <kn-id> <ot-id> '{"condition":{"operation":"and","sub_conditions":[]}}' --limit 10 --search-after '["cursor-1","cursor-2"]' --pretty
```

对象属性查询：

```bash
kweaverc bkn object-type properties <kn-id> <ot-id> '{"_instance_identities":[{"pod_ip":"192.168.1.1"}],"properties":["pod_name","pod_status"]}' --pretty
```

子图查询：

```bash
kweaverc bkn subgraph <kn-id> '{"relation_type_paths":[{"object_types":[{"id":"comment","condition":{"operation":"and","sub_conditions":[]},"limit":10}],"relation_types":[]}]}' --pretty
```

行动查询：

```bash
kweaverc bkn action-type query <kn-id> <at-id> '{"_instance_identities":[{"pod_ip":"192.168.1.1"}]}' --pretty
```

## BKN Action（有副作用）

```bash
kweaverc bkn action-type execute <kn-id> <at-id> '{"_instance_identities":[{"pod_ip":"192.168.1.1"}]}' --pretty
kweaverc bkn action-execution get <kn-id> <execution-id> --pretty
kweaverc bkn action-log list <kn-id> --limit 20 --need-total true --pretty
kweaverc bkn action-log get <kn-id> <log-id> --pretty
kweaverc bkn action-log cancel <kn-id> <log-id> --pretty
```

---

## Context Loader

配置：

```bash
kweaverc context-loader config set --kn-id <kn-id>
kweaverc context-loader config set --kn-id <kn-id> --name project-a
kweaverc context-loader config use project-a
kweaverc context-loader config list
kweaverc context-loader tools --pretty
```

### 端到端示例

| 步骤 | CLI 命令 |
|------|----------|
| Step 0 | `kweaverc bkn list --pretty` |
| Step 1 | `kweaverc context-loader kn-search "高血压 治疗 药品" --only-schema --pretty` |
| Step 2 | `kweaverc context-loader query-object-instance '{"ot_id":"disease","limit":5,"condition":{"operation":"and","sub_conditions":[{"field":"name","operation":"like","value_from":"const","value":"高血压"}]}}' --pretty` |
| Step 3 | `kweaverc context-loader query-instance-subgraph '<json>' --pretty` |
| Step 4 | `kweaverc context-loader get-logic-properties '<json>' --pretty` |
| Step 5 | `kweaverc context-loader get-action-info '<json>' --pretty` |

### Step 1：kn_search

```bash
kweaverc context-loader kn-search "高血压 治疗 药品" --only-schema --pretty
```

返回（精简）：

```json
{
  "object_types": [
    { "concept_id": "disease", "data_properties": ["name", "severity"], "logic_properties": ["patient_count"] },
    { "concept_id": "drug", "data_properties": ["name", "dosage_form"], "logic_properties": ["monthly_sales"] }
  ],
  "relation_types": [
    { "concept_id": "treats", "source_object_type_id": "drug", "target_object_type_id": "disease" }
  ],
  "action_types": [
    { "id": "prescribe", "name": "开具处方", "object_type_id": "drug" }
  ]
}
```

### Step 2：query_object_instance

```bash
kweaverc context-loader query-object-instance '{"ot_id":"disease","limit":5,"condition":{"operation":"and","sub_conditions":[{"field":"name","operation":"like","value_from":"const","value":"高血压"}]}}' --pretty
```

> ⬆️ `ot_id: "disease"` ← Step 1 的 `object_types[0].concept_id`

### Step 3：query_instance_subgraph

```bash
kweaverc context-loader query-instance-subgraph '{"relation_type_paths":[{"object_types":[{"id":"disease","condition":{"operation":"and","sub_conditions":[{"field":"name","operation":"like","value_from":"const","value":"高血压"}]},"limit":1},{"id":"drug","condition":{"operation":"and","sub_conditions":[]},"limit":10}],"relation_types":[{"relation_type_id":"treats","source_object_type_id":"drug","target_object_type_id":"disease"}]}]}' --pretty
```

> ⬆️ `relation_type_id`、`source/target` ← Step 1 的 `relation_types`（不可调换方向）
> 路径长度：1 跳 → `object_types` 长度 2，`relation_types` 长度 1

### Step 4：get_logic_properties

```bash
kweaverc context-loader get-logic-properties '{"ot_id":"drug","query":"药品月销量","_instance_identities":[{"drug_id":"DRUG_001"}],"properties":["monthly_sales"]}' --pretty
```

> ⬆️ `ot_id`、`properties` ← Step 1；`_instance_identities` ← Step 3 返回的 `_instance_identity`

### Step 5：get_action_info

```bash
kweaverc context-loader get-action-info '{"at_id":"prescribe","_instance_identity":{"drug_id":"DRUG_001"}}' --pretty
```

> ⬆️ `at_id` ← Step 1；`_instance_identity` ← Step 3

---

## Condition 语法速查

```json
// 单条件
{ "field": "name", "operation": "like", "value_from": "const", "value": "高血压" }

// 组合条件
{
  "operation": "and",
  "sub_conditions": [
    { "field": "name", "operation": "like", "value_from": "const", "value": "高血压" },
    { "field": "severity", "operation": "==", "value_from": "const", "value": "重度" }
  ]
}

// 无条件（必须写，不可省略）
{ "operation": "and", "sub_conditions": [] }
```

操作符：`==`、`!=`、`>`、`>=`、`<`、`<=`、`in`、`not_in`、`like`、`not_like`、`exist`、`not_exist`、`match`。
`value_from` 仅支持 `"const"`，必须与 `value` 同时出现。
