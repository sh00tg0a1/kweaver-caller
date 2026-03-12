# BKN 示例

## 列表

```bash
kweaverc bkn list --pretty
kweaverc bkn list --detail --pretty
kweaverc bkn list --name-pattern incident --tag prod --sort name --direction asc --pretty
kweaverc bkn list --verbose --pretty
```

## 查看详情

```bash
kweaverc bkn get kn_system_incident_event_network --pretty
kweaverc bkn stats kn_system_incident_event_network --pretty
kweaverc bkn export kn_system_incident_event_network --pretty
```

## 创建

使用 flags：

```bash
kweaverc bkn create \
  --name "DIP系统故障事件网络" \
  --comment "系统故障场景知识网络" \
  --tags incident,system \
  --branch main \
  --base-branch "" \
  --pretty
```

使用 `--body-file`：

```bash
kweaverc bkn create --body-file ./network.json --import-mode overwrite --validate-dependency false --pretty
```

`network.json` 示例：

```json
{
  "name": "DIP系统故障事件网络",
  "comment": "系统故障场景知识网络",
  "tags": ["incident", "system"],
  "branch": "main",
  "base_branch": ""
}
```

## 更新

使用 flags：

```bash
kweaverc bkn update kn_system_incident_event_network \
  --name "DIP系统故障事件网络" \
  --comment "更新后的备注" \
  --tags incident,system,prod \
  --branch main \
  --base-branch "" \
  --pretty
```

使用 `--body-file`：

```bash
kweaverc bkn update kn_system_incident_event_network --body-file ./network-update.json --pretty
```

## 删除

```bash
kweaverc bkn delete kn_system_incident_event_network
```

## BKN 查询（ontology-query）

对象实例查询：

```bash
kweaverc bkn object-type query kn_xxx pod '{"condition":{"operation":"and","sub_conditions":[]}}' --limit 10 --pretty
```

对象实例查询下一页：

```bash
kweaverc bkn object-type query kn_xxx pod '{"condition":{"operation":"and","sub_conditions":[]}}' --limit 10 --search-after '["20250922_020907_00027_qe7sf","xdb6f0e5f5ba7449ab94822da9f008386","1"]' --pretty
```

对象属性查询：

```bash
kweaverc bkn object-type properties kn_xxx pod '{"_instance_identities":[{"pod_ip":"192.168.1.1"}],"properties":["pod_name","pod_status"]}' --pretty
```

子图查询：

```bash
kweaverc bkn subgraph kn_xxx '{"relation_type_paths":[{"object_types":[{"id":"comment","condition":{"operation":"and","sub_conditions":[]},"limit":10}],"relation_types":[]}]}' --pretty
```

行动查询：

```bash
kweaverc bkn action-type query kn_xxx restart_pod '{"_instance_identities":[{"pod_ip":"192.168.1.1"}]}' --pretty
```

## BKN Action（有副作用）

执行行动：

```bash
kweaverc bkn action-type execute kn_xxx restart_pod '{"_instance_identities":[{"pod_ip":"192.168.1.1"}]}' --pretty
```

获取执行状态：

```bash
kweaverc bkn action-execution get kn_xxx ex_abc123 --pretty
```

列出执行日志：

```bash
kweaverc bkn action-log list kn_xxx --limit 20 --need-total true --pretty
```

获取单条日志：

```bash
kweaverc bkn action-log get kn_xxx log_456 --pretty
```

取消执行：

```bash
kweaverc bkn action-log cancel kn_xxx log_789 --pretty
```
