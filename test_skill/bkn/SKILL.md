---
name: bkn
description: 通过 kweaverc CLI 管理业务知识网络（BKN），涵盖 list/get/create/update/delete/export/stats。Use when the user wants to查询、创建、修改、删除业务知识网络，或提到 ontology-manager 的 knowledge-network 接口。
---

# BKN

用于通过 `kweaverc` 管理业务知识网络。对外命令统一叫 `bkn`，底层接口术语是 ontology / knowledge-network。

默认只依赖本文件即可完成调用。仅当你需要完整示例命令时，再阅读 [examples.md](examples.md)。

## 适用范围

本 skill 只覆盖知识网络本身的 P0 管理能力：

- `bkn list`
- `bkn get`
- `bkn create`
- `bkn update`
- `bkn delete`
- `bkn export`
- `bkn stats`

不覆盖：

- `bkn object-type ...`
- `bkn relation-type ...`
- `bkn action-type ...`
- context-loader MCP 检索流程

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

## 接口映射

| CLI 命令 | Ontology 接口 |
| --- | --- |
| `bkn list` | `GET /api/ontology-manager/v1/knowledge-networks` |
| `bkn get` | `GET /api/ontology-manager/v1/knowledge-networks/{kn_id}` |
| `bkn create` | `POST /api/ontology-manager/v1/knowledge-networks` |
| `bkn update` | `PUT /api/ontology-manager/v1/knowledge-networks/{kn_id}` |
| `bkn delete` | `DELETE /api/ontology-manager/v1/knowledge-networks/{kn_id}` |
| `bkn export` | `GET /api/ontology-manager/v1/knowledge-networks/{kn_id}?mode=export` |
| `bkn stats` | `GET /api/ontology-manager/v1/knowledge-networks/{kn_id}?include_statistics=true` |

## 推荐工作流

### 1. 查找目标 BKN

先列出网络，再决定后续操作：

```bash
kweaverc bkn list --pretty
```

常用筛选参数：

- `--offset`
- `--limit`
- `--sort update_time|name`
- `--direction asc|desc`
- `--name-pattern <text>`
- `--tag <text>`
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

## 输出与术语

- 对用户说“BKN”即可
- 提到接口或代码时，用“ontology-manager knowledge-network 接口”
- 默认建议加 `--pretty`，便于阅读 JSON

## 相关文件

- 主命令实现：`src/commands/bkn.ts`
- API 封装：`src/api/knowledge-networks.ts`
- 参考文档：`ref/ontology/ontology-manager-network.yaml`
- 示例：`examples.md`
