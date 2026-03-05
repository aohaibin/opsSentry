---
name: security-permissions
description: |
  Tauri 安全与权限管理技能,指导 Capabilities 配置和安全最佳实践。

  触发场景:
  - 需要配置 Capabilities 权限
  - 需要理解 Tauri 安全模型
  - 需要处理 CSP(内容安全策略)
  - 功能不可用可能是权限问题

  触发词: 权限、Capabilities、安全、CSP、permission、安全策略、sandbox
---

# Tauri 安全与权限管理

## Tauri 2.x 安全模型

Tauri 2.x 引入了 **Capabilities** 系统,取代了 v1 的 allowlist。每个 API 和插件功能都需要**显式声明权限**。

```
capabilities/
├── default.json          # 主窗口默认权限
├── admin.json            # 管理窗口权限(可选)
└── restricted.json       # 受限窗口权限(可选)
```

---

## Capability 配置

### 基础结构

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "主窗口权限",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default"
  ]
}
```

### 常用权限速查

| 插件 | 权限 ID | 说明 |
|------|---------|------|
| **Core** | `core:default` | 核心默认权限 |
| **Opener** | `opener:default` | 打开 URL/文件 |
| **FS** | `fs:default` | 文件系统基础 |
| | `fs:allow-read-text-file` | 读取文本文件 |
| | `fs:allow-write-text-file` | 写入文本文件 |
| | `fs:allow-exists` | 检查文件存在 |
| | `fs:allow-mkdir` | 创建目录 |
| **Dialog** | `dialog:default` | 文件对话框 |
| | `dialog:allow-open` | 打开文件对话框 |
| | `dialog:allow-save` | 保存文件对话框 |
| **Notification** | `notification:default` | 系统通知 |
| **Shell** | `shell:default` | 执行系统命令 |
| | `shell:allow-open` | 打开 URL |
| **SQL** | `sql:default` | 数据库操作 |
| **Store** | `store:default` | 键值存储 |
| **Clipboard** | `clipboard-manager:default` | 剪贴板 |
| **HTTP** | `http:default` | HTTP 请求 |
| **Updater** | `updater:default` | 应用更新 |
| **Log** | `log:default` | 日志系统 |

### 高级权限: 作用域控制

```json
{
  "identifier": "fs-scoped",
  "permissions": [
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [{ "path": "$APPDATA/**" }]
    },
    {
      "identifier": "fs:allow-write-text-file",
      "allow": [{ "path": "$APPDATA/**" }]
    }
  ]
}
```

### 多窗口差异化权限

```json
// admin-capability.json
{
  "identifier": "admin",
  "windows": ["admin-window"],
  "permissions": [
    "core:default",
    "fs:default",
    "shell:default"
  ]
}

// viewer-capability.json
{
  "identifier": "viewer",
  "windows": ["viewer-window"],
  "permissions": [
    "core:default"
  ]
}
```

---

## CSP(内容安全策略)

```json
// tauri.conf.json
{
  "app": {
    "security": {
      "csp": "default-src 'self'; img-src 'self' asset: https://asset.localhost; style-src 'unsafe-inline' 'self'"
    }
  }
}
```

| 策略 | 说明 |
|------|------|
| `default-src 'self'` | 默认只允许加载本地资源 |
| `img-src 'self' asset:` | 允许本地和 asset 协议图片 |
| `script-src 'self'` | 只允许本地脚本 |
| `connect-src 'self' ipc:` | 允许 IPC 连接 |

---

## 安全最佳实践

1. **最小权限原则**: 只声明实际需要的权限
2. **作用域限制**: 文件操作限制在特定目录
3. **不暴露敏感操作**: 加密/密钥等放在 Rust 侧
4. **CSP 启用**: 生产环境启用 CSP
5. **Command 验证**: 在 Rust Command 中验证输入参数
6. **不信任前端数据**: 前端发来的数据在 Rust 侧重新验证

---

## 常见错误

| 错误做法 | 正确做法 |
|---------|---------|
| CSP 设为 null(禁用) | 生产环境配置合适的 CSP |
| 所有权限都声明 | 只声明需要的权限 |
| 文件权限不限制路径 | 使用 scope 限制为 $APPDATA |
| 密钥放在前端代码中 | 密钥只在 Rust 侧处理 |
| 不区分窗口权限 | 不同窗口给不同权限 |
