# BKN 示例

## 列表

```bash
kweaverc bkn list --pretty
kweaverc bkn list --name-pattern incident --tag prod --sort name --direction asc --pretty
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
