# BKN 管理与查询

管理业务知识网络，以及通过 ontology-query 查询对象、子图、属性和行动。

## 命令总览

### 管理（ontology-manager）

| 命令 | 说明 |
| --- | --- |
| `kweaverc bkn list [options]` | 列出业务知识网络 |
| `kweaverc bkn get <kn-id> [options]` | 查看网络详情 |
| `kweaverc bkn create [options]` | 创建网络 |
| `kweaverc bkn update <kn-id> [options]` | 更新网络 |
| `kweaverc bkn delete <kn-id>` | 删除网络 |
| `kweaverc bkn export <kn-id> [options]` | 导出网络定义 |
| `kweaverc bkn stats <kn-id> [options]` | 查看网络统计 |

### 查询（ontology-query 只读）

| 命令 | 说明 |
| --- | --- |
| `kweaverc bkn object-type query <kn-id> <ot-id> ['<json>'] [--limit <n>] [--search-after '<json-array>']` | 对象实例查询 |
| `kweaverc bkn object-type properties <kn-id> <ot-id> '<json>'` | 对象属性查询 |
| `kweaverc bkn subgraph <kn-id> '<json>'` | 子图查询 |
| `kweaverc bkn action-type query <kn-id> <at-id> '<json>'` | 行动信息查询 |

### Action（有副作用，仅在用户明确请求时使用）

| 命令 | 说明 |
| --- | --- |
| `kweaverc bkn action-type execute <kn-id> <at-id> '<json>'` | 执行行动 |
| `kweaverc bkn action-execution get <kn-id> <execution-id>` | 获取执行状态 |
| `kweaverc bkn action-log list <kn-id> [options]` | 列出执行日志 |
| `kweaverc bkn action-log get <kn-id> <log-id>` | 获取单条日志 |
| `kweaverc bkn action-log cancel <kn-id> <log-id>` | 取消执行 |

## 参数说明

### bkn list 常用参数

`--offset`、`--limit`、`--sort update_time|name`、`--direction asc|desc`、`--name-pattern <text>`、`--tag <text>`、`--detail`、`--verbose`、`--pretty`

### bkn create/update 常用参数

`--name`、`--comment`、`--tags tag1,tag2`、`--icon`、`--color`、`--branch`、`--base-branch`、`--body-file <path>`、`--import-mode`（仅 create）、`--validate-dependency`（仅 create）

### object-type query 分页

- `--limit <n>`：写入请求 body 的 `limit`
- `--search-after '<json-array>'`：写入请求 body 的 `search_after`
- flags 会覆盖 body 中同名字段
- 分页方式是 search_after 游标，没有 skip/offset

## 默认策略

- 用户说"看看有哪些 BKN"：`bkn list --pretty`
- 用户说"看某个 BKN 的定义/统计"：`bkn get` / `bkn stats` / `bkn export`
- 用户说"查对象实例"且已知 kn_id、ot_id：`bkn object-type query`，分页优先用 `--limit` 和 `--search-after`
- 用户说"执行行动"或"取消执行"：仅在明确请求时执行

## 输出与术语

- 对用户说"BKN"
- `bkn list` 默认返回简化字段：`name`、`id`、`description`
- `bkn list --detail` 额外包含 `detail`
- `bkn list --verbose` 返回完整 JSON
- 默认建议加 `--pretty`

## 完整示例

见 [examples.md](examples.md) 的 BKN 部分。
