# Context Loader 端到端调用示例

按需阅读本文件：当你需要参考完整 JSON、复杂路径构造、或确认字段来源时，再看下面的端到端示例。每一步用 **⬆️ 来源** 标注参数取自上一步的哪个字段。

---

## Step 1：kn_search（Layer 1 - 探索发现）

**调用**：

```json
{ "query": "高血压 治疗 药品", "only_schema": true }
```

**返回**（精简）：

```json
{
  "object_types": [
    {
      "concept_id": "disease",
      "concept_name": "疾病",
      "data_properties": ["name", "icd_code", "description", "severity"],
      "logic_properties": ["patient_count", "annual_incidence"]
    },
    {
      "concept_id": "drug",
      "concept_name": "药品",
      "data_properties": ["name", "generic_name", "dosage_form", "manufacturer"],
      "logic_properties": ["monthly_sales"]
    }
  ],
  "relation_types": [
    {
      "concept_id": "treats",
      "concept_name": "治疗",
      "source_object_type_id": "drug",
      "target_object_type_id": "disease"
    }
  ],
  "action_types": [
    {
      "id": "prescribe",
      "name": "开具处方",
      "object_type_id": "drug"
    }
  ]
}
```

**从这个返回中，后续步骤需要提取的信息**：

| 提取什么 | 从哪里取 | 给谁用 |
|----------|---------|--------|
| `"disease"` | `object_types[0].concept_id` | Step 2 的 `ot_id` |
| `"drug"` | `object_types[1].concept_id` | Step 3 的 `object_types[].id` |
| `["name","severity",...]` | `object_types[0].data_properties` | Step 2 的 condition 中可用的 field |
| `["monthly_sales"]` | `object_types[1].logic_properties` | Step 4 的 `properties` |
| `"treats"` | `relation_types[0].concept_id` | Step 3 的 `relation_type_id` |
| `"drug"→"disease"` | `relation_types[0].source/target` | Step 3 的 `source/target_object_type_id` |
| `"prescribe"` | `action_types[0].id` | Step 5 的 `at_id` |

---

## Step 2：query_object_instance（Layer 2 - 精确查询）

**调用**：

```json
{
  "ot_id": "disease",
  "limit": 5,
  "condition": {
    "operation": "and",
    "sub_conditions": [
      {
        "field": "name",
        "operation": "like",
        "value_from": "const",
        "value": "高血压"
      }
    ]
  }
}
```

> **⬆️ 来源**：`ot_id: "disease"` ← Step 1 的 `object_types[0].concept_id`
> **⬆️ 来源**：`field: "name"` ← Step 1 的 `object_types[0].data_properties` 中的属性名

**返回**（精简）：

```json
{
  "datas": [
    {
      "name": "原发性高血压",
      "icd_code": "I10",
      "_instance_identity": { "disease_id": "D_HBP_001" }
    },
    {
      "name": "高血压性心脏病",
      "icd_code": "I11",
      "_instance_identity": { "disease_id": "D_HBP_002" }
    }
  ]
}
```

**注意**：`_instance_identity` 的结构由数据决定，不可猜测，必须原样使用。

---

## Step 2.5：如果第一步用的是 kn_schema_search

`kn_schema_search` 返回的是 `concepts`，适合做候选概念发现，但不适合直接进入 `query_*` / `get_*`，因为后续工具需要的是结构化字段：

- `ot_id`
- `relation_type_id`
- `source_object_type_id`
- `target_object_type_id`
- `logic_properties`
- `action_types[].id`

因此，如果第一步用了 `kn_schema_search`，正确做法是：

1. 用 `kn_schema_search` 看有哪些候选概念
2. 确认方向后，再补做一次 `kn_search`
3. 从 `kn_search` 的 `object_types` / `relation_types` / `action_types` 中提取后续真正要用的字段

**示例**：

```json
// 仅做候选概念发现
{ "query": "高血压 治疗 药品", "max_concepts": 10 }
```

```json
// 确认方向后，再做结构化 schema 检索
{ "query": "高血压 治疗 药品", "only_schema": true }
```

后续 Step 3 / Step 4 / Step 5 的参数，仍然全部从第二次 `kn_search` 的返回中提取。

---

## Step 3：query_instance_subgraph（Layer 2 - 关联查询）

沿 `drug --treats--> disease` 关系查询关联药品。

**调用**：

```json
{
  "relation_type_paths": [
    {
      "object_types": [
        {
          "id": "disease",
          "condition": {
            "operation": "and",
            "sub_conditions": [
              { "field": "name", "operation": "like", "value_from": "const", "value": "高血压" }
            ]
          },
          "limit": 1
        },
        {
          "id": "drug",
          "condition": { "operation": "and", "sub_conditions": [] },
          "limit": 10
        }
      ],
      "relation_types": [
        {
          "relation_type_id": "treats",
          "source_object_type_id": "drug",
          "target_object_type_id": "disease"
        }
      ]
    }
  ]
}
```

> **⬆️ 来源**：`id: "disease"` / `id: "drug"` ← Step 1 的 `object_types[].concept_id`
> **⬆️ 来源**：`relation_type_id: "treats"` ← Step 1 的 `relation_types[0].concept_id`
> **⬆️ 来源**：`source/target_object_type_id` ← Step 1 的 `relation_types[0]` 的 source/target（**必须原样复制，不可调换方向**）

**路径长度规则**：这是 1 跳路径，所以 `object_types` 长度 = 2，`relation_types` 长度 = 1。

**无条件的节点**也必须填 condition：`{"operation":"and","sub_conditions":[]}`。

**返回**（精简）：

```json
{
  "entries": [
    {
      "objects": {
        "disease": [{ "name": "原发性高血压", "_instance_identity": { "disease_id": "D_HBP_001" } }],
        "drug": [
          { "name": "氨氯地平", "_instance_identity": { "drug_id": "DRUG_001" } },
          { "name": "缬沙坦", "_instance_identity": { "drug_id": "DRUG_002" } }
        ]
      }
    }
  ]
}
```

---

## Step 4：get_logic_properties_values（Layer 3 - 逻辑属性）

需要同时用到 **Layer 1**（ot_id、logic_properties）和 **Layer 2**（_instance_identity）的输出。

**调用**：

```json
{
  "ot_id": "drug",
  "query": "高血压治疗药品的月销量",
  "_instance_identities": [
    { "drug_id": "DRUG_001" },
    { "drug_id": "DRUG_002" }
  ],
  "properties": ["monthly_sales"],
  "additional_context": "{\"timezone\":\"Asia/Shanghai\",\"period\":\"2026-01\"}"
}
```

> **⬆️ 来源**：`ot_id: "drug"` ← Step 1 的 `object_types[1].concept_id`（**Layer 1**）
> **⬆️ 来源**：`properties: ["monthly_sales"]` ← Step 1 的 `object_types[1].logic_properties`（**Layer 1**）
> **⬆️ 来源**：`_instance_identities` ← Step 3 返回的 `drug` 数组中每项的 `_instance_identity`（**Layer 2**）

**正常返回**：

```json
{
  "datas": [
    { "_instance_identity": { "drug_id": "DRUG_001" }, "monthly_sales": 158000 },
    { "_instance_identity": { "drug_id": "DRUG_002" }, "monthly_sales": 92000 }
  ]
}
```

**缺参返回**（需要重试）：

```json
{
  "error_code": "MISSING_INPUT_PARAMS",
  "message": "dynamic_params 缺少必需的 input 参数",
  "missing": [
    {
      "property": "monthly_sales",
      "params": [
        { "name": "start", "type": "INTEGER", "hint": "在 additional_context 中补充时间范围" }
      ]
    }
  ]
}
```

→ **处理方式**：根据 `hint` 补充 `additional_context`（如加入时间范围），然后**重新调用**。

---

## Step 5：get_action_info（Layer 3 - 行动召回）

需要同时用到 **Layer 1**（at_id）和 **Layer 2**（_instance_identity）的输出。

**调用**：

```json
{
  "at_id": "prescribe",
  "_instance_identity": { "drug_id": "DRUG_001" }
}
```

> **⬆️ 来源**：`at_id: "prescribe"` ← Step 1 的 `action_types[0].id`（**Layer 1**）
> **⬆️ 来源**：`_instance_identity` ← Step 3 返回的某条药品的 `_instance_identity`（**Layer 2**）

**返回**：

```json
{
  "_dynamic_tools": [
    {
      "name": "create_prescription",
      "description": "为指定药品创建处方",
      "parameters": {
        "type": "object",
        "properties": {
          "patient_id": { "type": "string" },
          "dosage": { "type": "string" }
        },
        "required": ["patient_id"]
      },
      "api_url": "http://...",
      "fixed_params": { "drug_id": "DRUG_001" }
    }
  ]
}
```

`_dynamic_tools` 中的每个工具可直接作为新的 Function Call 工具使用。

---

## Condition 语法速查

```json
// 单条件
{ "field": "name", "operation": "like", "value_from": "const", "value": "高血压" }

// 组合条件（and/or）
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
`value_from` 仅支持 `"const"`，**必须**与 `value` 同时出现。
