---
name: bkn
description: 通过 kweaverc CLI 管理业务知识网络（BKN），涵盖 list/get/create/update/delete/export/stats，以及 ontology-query 的对象查询、子图、属性、行动查询与执行。Use when the user wants to查询、创建、修改、删除业务知识网络，或直接调用 ontology-query 接口。
---

# BKN

用于通过 `kweaverc` 管理业务知识网络。对外命令统一叫 `bkn`，底层接口术语是 ontology / knowledge-network / ontology-query。

默认只依赖本文件即可完成调用。仅当你需要完整示例命令时，再阅读 [examples.md](examples.md)。

## 适用范围

本 skill 覆盖三层能力：

**BKN 管理**（ontology-manager）：

- `bkn list`
- `bkn get`
- `bkn create`
- `bkn update`
- `bkn delete`
- `bkn export`
- `bkn stats`

**BKN 查询**（ontology-query 只读）：

- `bkn object-type query <kn-id> <ot-id> '<json>'`
- `bkn object-type properties <kn-id> <ot-id> '<json>'`
- `bkn subgraph <kn-id> '<json>'`
- `bkn action-type query <kn-id> <at-id> '<json>'`

**BKN Action**（ontology-query 有副作用）：

- `bkn action-type execute <kn-id> <at-id> '<json>'`
- `bkn action-execution get <kn-id> <execution-id>`
- `bkn action-log list <kn-id> [options]`
- `bkn action-log get <kn-id> <log-id>`
- `bkn action-log cancel <kn-id> <log-id>`

不覆盖：

- `bkn relation-type ...`
- context-loader MCP 检索流程（schema 分层检索用 context-loader）

## 使用前提

- 先登录：`kweaverc auth <platform-url>`
- 默认使用当前已登录平台的 token 与 base URL
- 若请求失败，优先检查当前平台是否正确、token 是否过期

## 命令总览

| 命令 | 说明 |
| --- | --- |
| `kweaverc bkn list [options]` | 列出业务知识网络 |
| `kweaverc bkn get <kn-id> [options]` | 查看网络详情 |
| `kweaverc bkn create [options]` | 创建网络 |
| `kweaverc bkn update <kn-id> [options]` | 更新网络 |
| `kweaverc bkn delete <kn-id>` | 删除网络 |
| `kweaverc bkn export <kn-id> [options]` | 导出网络定义 |
| `kweaverc bkn stats <kn-id> [options]` | 查看网络统计 |
| `kweaverc bkn object-type query <kn-id> <ot-id> '<json>'` | 对象实例查询 |
| `kweaverc bkn object-type properties <kn-id> <ot-id> '<json>'` | 对象属性查询 |
| `kweaverc bkn subgraph <kn-id> '<json>'` | 子图查询 |
| `kweaverc bkn action-type query <kn-id> <at-id> '<json>'` | 行动信息查询 |
| `kweaverc bkn action-type execute <kn-id> <at-id> '<json>'` | 执行行动（有副作用） |
| `kweaverc bkn action-execution get <kn-id> <execution-id>` | 获取执行状态 |
| `kweaverc bkn action-log list <kn-id> [options]` | 列出执行日志 |
| `kweaverc bkn action-log get <kn-id> <log-id>` | 获取单条日志 |
| `kweaverc bkn action-log cancel <kn-id> <log-id>` | 取消执行（有副作用） |

## 接口映射

| CLI 命令 | 接口 |
| --- | --- |
| `bkn list` | `GET /api/ontology-manager/v1/knowledge-networks` |
| `bkn get` | `GET /api/ontology-manager/v1/knowledge-networks/{kn_id}` |
| `bkn create` | `POST /api/ontology-manager/v1/knowledge-networks` |
| `bkn update` | `PUT /api/ontology-manager/v1/knowledge-networks/{kn_id}` |
| `bkn delete` | `DELETE /api/ontology-manager/v1/knowledge-networks/{kn_id}` |
| `bkn export` | `GET /api/ontology-manager/v1/knowledge-networks/{kn_id}?mode=export` |
| `bkn stats` | `GET /api/ontology-manager/v1/knowledge-networks/{kn_id}?include_statistics=true` |
| `bkn object-type query` | `POST /api/ontology-query/v1/knowledge-networks/{kn_id}/object-types/{ot_id}` |
| `bkn object-type properties` | `POST /api/ontology-query/v1/knowledge-networks/{kn_id}/object-types/{ot_id}/properties` |
| `bkn subgraph` | `POST /api/ontology-query/v1/knowledge-networks/{kn_id}/subgraph` |
| `bkn action-type query` | `POST /api/ontology-query/v1/knowledge-networks/{kn_id}/action-types/{at_id}/` |
| `bkn action-type execute` | `POST /api/ontology-query/v1/knowledge-networks/{kn_id}/action-types/{at_id}/execute` |
| `bkn action-execution get` | `GET /api/ontology-query/v1/knowledge-networks/{kn_id}/action-executions/{execution_id}` |
| `bkn action-log list` | `GET /api/ontology-query/v1/knowledge-networks/{kn_id}/action-logs` |
| `bkn action-log get` | `GET /api/ontology-query/v1/knowledge-networks/{kn_id}/action-logs/{log_id}` |
| `bkn action-log cancel` | `POST /api/ontology-query/v1/knowledge-networks/{kn_id}/action-logs/{log_id}/cancel` |

## 推荐工作流

### 1. 查找目标 BKN

先列出网络，再决定后续操作：

```bash
kweaverc bkn list --pretty
```

默认返回简化列表，只包含 `name`、`id`、`description`。如果还想在简化结果里一起看 `detail` 字段，使用：

```bash
kweaverc bkn list --detail --pretty
```

常用筛选参数：

- `--offset`
- `--limit`
- `--sort update_time|name`
- `--direction asc|desc`
- `--name-pattern <text>`
- `--tag <text>`
- `--detail`
- `--verbose` / `-v`
- `-bd, --biz-domain <value>`
- `--pretty`

### 2. 确认详情

当用户提到“先看下这个网络是什么”或“确认统计/导出”时：

```bash
kweaverc bkn get <kn-id> --pretty
kweaverc bkn stats <kn-id> --pretty
kweaverc bkn export <kn-id> --pretty
```

规则：

- `stats` 是 `get --stats` 的别名
- `export` 是 `get --export` 的别名

### 3. 创建或更新

优先级建议：

1. 字段少且简单时，直接用 flags
2. body 复杂时，改用 `--body-file <json>`

常用 flags：

- `--name`
- `--comment`
- `--tags tag1,tag2`
- `--icon`
- `--color`
- `--branch`
- `--base-branch`
- `--import-mode normal|ignore|overwrite`（仅 create）
- `--validate-dependency true|false`（仅 create）
- `--body-file <path>`
- `--pretty`

约束：

- `create` 和 `update` 在不用 `--body-file` 时都要求 `--name`
- `--body-file` 不能和 `--name`、`--comment`、`--tags` 等字段 flags 混用
- `branch` 当前实现默认是 `main`
- `base_branch` 当前实现默认是空字符串

### 4. 删除

删除是 destructive 操作，执行前要明确用户已经确认目标 `kn-id`。

```bash
kweaverc bkn delete <kn-id>
```

删除语义：

- 会删除该知识网络及其下对象类、关系类、行动类和概念分组

### 5. BKN 查询（ontology-query 只读）

当用户需要直接调用 ontology-query 接口查询对象、子图、属性或行动信息时：

```bash
kweaverc bkn object-type query <kn-id> <ot-id> '{"condition":{"operation":"and","sub_conditions":[]},"limit":10}' --pretty
kweaverc bkn object-type properties <kn-id> <ot-id> '{"_instance_identities":[],"properties":["name"]}' --pretty
kweaverc bkn subgraph <kn-id> '{"relation_type_paths":[]}' --pretty
kweaverc bkn action-type query <kn-id> <at-id> '{"_instance_identities":[{"id":"1"}]}' --pretty
```

JSON 格式详见 `ref/ontology/ontology-query.yaml`。

### 6. BKN Action（有副作用）

`action-type execute` 和 `action-log cancel` 会触发真实执行或取消，**仅在用户明确请求时使用**：

```bash
kweaverc bkn action-type execute <kn-id> <at-id> '{"_instance_identities":[{"id":"1"}]}' --pretty
kweaverc bkn action-execution get <kn-id> <execution-id> --pretty
kweaverc bkn action-log list <kn-id> --limit 20 --pretty
kweaverc bkn action-log get <kn-id> <log-id> --pretty
kweaverc bkn action-log cancel <kn-id> <log-id> --pretty
```

## 与 context-loader 的边界

- **bkn**：直接调用 ontology-query 原生接口，适合已知 `kn_id`、`ot_id`、`at_id` 且需透传 JSON 的场景
- **context-loader**：schema → 实例 → 逻辑属性/行动信息 的分层检索工作流，适合 Agent 化检索（需先 `kn-search` 发现 schema，再逐层调用）

## 处理用户请求时的默认策略

- 用户说“看看有哪些 BKN”：
  - 用 `bkn list --pretty`
- 用户说“看看某个 BKN 的定义/统计”：
  - 用 `bkn get` / `bkn stats` / `bkn export`
- 用户说“创建一个 BKN”：
  - 若字段很少，直接用 flags
  - 若用户给了完整 JSON，优先建议或使用 `--body-file`
- 用户说“修改一个 BKN”：
  - 先确认 `kn-id`
  - 再用 `bkn update`
- 用户说“删除一个 BKN”：
  - 先确认这是明确请求
  - 再执行 `bkn delete`
- 用户说“查对象实例/子图/属性/行动信息”且已知 `kn_id`、`ot_id` 等：
  - 用 `bkn object-type query` / `bkn subgraph` / `bkn action-type query` 等
- 用户说“执行某个行动”或“取消执行”：
  - 仅在明确请求时执行 `bkn action-type execute` 或 `bkn action-log cancel`

## 输出与术语

- 对用户说“BKN”即可
- 提到接口或代码时，用“ontology-manager knowledge-network 接口”
- `bkn list` 默认返回简化字段：`name`、`id`、`description`
- `bkn list --detail` 会在简化输出中额外包含 `detail`
- `bkn list --verbose` / `-v` 返回完整 JSON
- 默认建议加 `--pretty`，便于阅读 JSON

## 相关文件

- 主命令实现：`src/commands/bkn.ts`
- API 封装：`src/api/knowledge-networks.ts`、`src/api/ontology-query.ts`
- 参考文档：`ref/ontology/ontology-manager-network.yaml`、`ref/ontology/ontology-query.yaml`
- 示例：`examples.md`
