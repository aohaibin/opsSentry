---
name: tauri-capabilities
description: |
  Tauri Capabilities 深度配置技能，指导高级权限管理、作用域控制和多窗口权限差异化。

  触发场景：
  - 需要精确控制 API 访问权限
  - 需要限制文件访问作用域
  - 需要为不同窗口配置不同权限
  - 需要自定义 Capability 权限组

  触发词：Capabilities、权限配置、作用域、scope、精细权限、安全配置
---

# Tauri Capabilities 深度配置

## 概念

Capabilities 是 Tauri 2.x 的核心安全机制：

```
Capability = {
  identifier: 唯一标识,
  windows: [适用的窗口列表],
  permissions: [权限声明列表]
}
```

每个 **窗口** 可以有不同的 Capability，每个 **权限** 可以有作用域限制。

---

## 权限声明格式

### 简单声明

```json
{
  "permissions": ["core:default", "fs:default"]
}
```

### 带作用域的声明

```json
{
  "permissions": [
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [
        { "path": "$APPDATA/**" },
        { "path": "$HOME/Documents/**" }
      ],
      "deny": [
        { "path": "$HOME/.ssh/**" }
      ]
    }
  ]
}
```

### 路径变量

| 变量 | 说明 | 示例路径 (Windows) |
|------|------|-------------------|
| `$APPDATA` | 应用数据目录 | `C:\Users\xxx\AppData\Roaming\com.app` |
| `$APPCONFIG` | 应用配置目录 | `C:\Users\xxx\AppData\Roaming\com.app` |
| `$APPLOCALDATA` | 应用本地数据 | `C:\Users\xxx\AppData\Local\com.app` |
| `$HOME` | 用户主目录 | `C:\Users\xxx` |
| `$DESKTOP` | 桌面目录 | `C:\Users\xxx\Desktop` |
| `$DOCUMENT` | 文档目录 | `C:\Users\xxx\Documents` |
| `$DOWNLOAD` | 下载目录 | `C:\Users\xxx\Downloads` |
| `$TEMP` | 临时目录 | `C:\Users\xxx\AppData\Local\Temp` |

---

## 多 Capability 文件

```
src-tauri/capabilities/
├── default.json        # 主窗口：基础权限
├── editor.json         # 编辑器窗口：文件读写权限
└── settings.json       # 设置窗口：最小权限
```

### default.json

```json
{
  "identifier": "default",
  "windows": ["main"],
  "permissions": ["core:default", "opener:default"]
}
```

### editor.json

```json
{
  "identifier": "editor",
  "windows": ["editor"],
  "permissions": [
    "core:default",
    "dialog:default",
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [{ "path": "$HOME/**" }],
      "deny": [{ "path": "$HOME/.ssh/**" }, { "path": "$HOME/.gnupg/**" }]
    },
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [{ "path": "$DOCUMENT/**" }, { "path": "$DESKTOP/**" }]
    }
  ]
}
```

---

## 查看可用权限

每个 Tauri 插件安装后会在 `src-tauri/gen/schemas/` 生成权限 schema。

```bash
# 运行 tauri dev 后查看生成的 schema
ls src-tauri/gen/schemas/
```

---

## 调试权限问题

```
症状: "Permission denied" 或功能无响应
排查:
1. 检查 capabilities/*.json 是否声明了权限
2. 检查窗口 label 是否匹配
3. 检查作用域是否覆盖目标路径
4. 运行 tauri dev 查看控制台权限错误
```

---

## 常见错误

| 错误做法 | 正确做法 |
|---------|---------|
| 给所有窗口相同权限 | 最小权限原则，按窗口配置 |
| `fs:default` 不加 scope | 使用 allow/deny 限制路径范围 |
| 忘记 deny 敏感路径 | 显式 deny `.ssh`、`.gnupg` 等 |
| 不测试权限是否生效 | 开发时刻意触发权限错误验证 |
| 修改权限后不重启 | Capabilities 变更需重启 dev server |
