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
└── default.json          # 主窗口默认权限
```

---

## 当前项目权限配置

### 基础结构

```json
// src-tauri/capabilities/default.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "主窗口默认权限",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    "store:default",
    "log:default"
  ]
}
```

### 当前已启用的权限

| 插件 | 权限 ID | 说明 | 用途 |
|------|---------|------|------|
| **Core** | `core:default` | 核心默认权限 | 基础应用功能 |
| **Opener** | `opener:default` | 打开 URL/文件 | 在浏览器中打开链接 |
| **Store** | `store:default` | 键值存储 | 持久化应用配置 |
| **Log** | `log:default` | 日志系统 | 应用日志记录 |

---

## 常用权限速查（按需添加）

### 文件系统

| 权限 | 说明 |
|------|------|
| `fs:default` | 文件系统基础 |
| `fs:allow-read-text-file` | 读取文本文件 |
| `fs:allow-write-text-file` | 写入文本文件 |
| `fs:allow-exists` | 检查文件存在 |
| `fs:allow-mkdir` | 创建目录 |

### 对话框

| 权限 | 说明 |
|------|------|
| `dialog:default` | 文件对话框 |
| `dialog:allow-open` | 打开文件对话框 |
| `dialog:allow-save` | 保存文件对话框 |

### 系统交互

| 权限 | 说明 |
|------|------|
| `notification:default` | 系统通知 |
| `shell:default` | 执行系统命令 |
| `shell:allow-open` | 打开 URL |
| `clipboard-manager:default` | 剪贴板 |

### 网络与更新

| 权限 | 说明 |
|------|------|
| `http:default` | HTTP 请求 |
| `updater:default` | 应用更新 |

---

## 项目权限添加指南

当需要新功能时，按以下步骤添加权限：

### 1. 安装对应插件

```toml
# src-tauri/Cargo.toml
[dependencies]
tauri-plugin-fs = "2"
```

```bash
pnpm add @tauri-apps/plugin-fs
```

### 2. 注册插件

```rust
// src-tauri/src/lib.rs
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())    // 添加这行
        .invoke_handler(tauri::generate_handler![...])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### 3. 声明权限

```json
// src-tauri/capabilities/default.json
{
  "permissions": [
    "core:default",
    "opener:default",
    "store:default",
    "log:default",
    "fs:default",              // 新增
    "fs:allow-read-text-file"  // 新增
  ]
}
```

---

## 高级权限: 作用域控制

当需要限制文件访问范围时：

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

### 路径变量

| 变量 | 说明 |
|------|------|
| `$APPDATA` | 应用数据目录 |
| `$APPCONFIG` | 应用配置目录 |
| `$APPLOG` | 应用日志目录 |
| `$HOME` | 用户主目录 |
| `$TEMP` | 临时目录 |

---

## 多窗口差异化权限

如果应用有多个窗口，可以为不同窗口配置不同权限：

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

### 1. 最小权限原则
只声明实际需要的权限，不要添加"可能用到"的权限。

```json
// ❌ 不好：添加所有权限
{
  "permissions": [
    "core:default",
    "fs:default",
    "dialog:default",
    "shell:default",
    "notification:default"
  ]
}

// ✅ 好：只添加当前需要的权限
{
  "permissions": [
    "core:default",
    "opener:default",
    "store:default",
    "log:default"
  ]
}
```

### 2. 作用域限制
文件操作限制在特定目录：

```json
{
  "identifier": "fs:allow-read-text-file",
  "allow": [{ "path": "$APPDATA/**" }]
}
```

### 3. 不暴露敏感操作
加密/密钥等放在 Rust 侧，不要通过 Command 暴露给前端。

### 4. Command 验证
在 Rust Command 中验证输入参数：

```rust
#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    // 验证路径安全性
    if path.contains("..") {
        return Err("不允许访问父目录".into());
    }
    // ...
}
```

### 5. 不信任前端数据
前端发来的数据在 Rust 侧重新验证：

```rust
#[tauri::command]
pub fn delete_user(id: i64) -> Result<(), String> {
    // 验证 ID 有效性
    if id <= 0 {
        return Err("无效的用户 ID".into());
    }
    // 检查权限
    // ...
}
```

---

## 排查权限问题

| 症状 | 可能原因 | 解决方法 |
|------|---------|---------|
| "Permission denied" | Capabilities 未声明 | 添加权限到 capabilities/default.json |
| API 调用无响应 | 插件未注册 | 检查 lib.rs 中的 .plugin() |
| 编译错误 | 插件版本不兼容 | Cargo.toml 和 package.json 版本对齐 |
| 运行时报错 | CSP 阻止资源加载 | 检查 tauri.conf.json 中的 CSP 配置 |

---

## 常见错误

| 错误做法 | 正确做法 |
|---------|---------|
| CSP 设为 null(禁用) | 生产环境配置合适的 CSP |
| 所有权限都声明 | 只声明需要的权限 |
| 文件权限不限制路径 | 使用 scope 限制为 $APPDATA |
| 密钥放在前端代码中 | 密钥只在 Rust 侧处理 |
| 不区分窗口权限 | 不同窗口给不同权限 |
| 添加权限不测试 | 添加权限后验证功能是否正常 |
