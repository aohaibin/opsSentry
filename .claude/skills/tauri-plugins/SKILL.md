---
name: tauri-plugins
description: |
  Tauri 插件开发与集成技能，指导如何使用官方插件和开发自定义插件。

  触发场景：
  - 需要集成 Tauri 官方插件
  - 需要开发自定义 Tauri 插件
  - 需要理解插件的安装和配置流程
  - 需要排查插件不可用的问题

  触发词：插件、plugin、tauri-plugin、集成、扩展、第三方
---

# Tauri 插件开发与集成

## 官方插件清单

### 核心功能插件

| 插件 | Cargo 依赖 | npm 包 | 用途 |
|------|-----------|--------|------|
| **opener** | `tauri-plugin-opener` | `@tauri-apps/plugin-opener` | 打开 URL/文件 |
| **fs** | `tauri-plugin-fs` | `@tauri-apps/plugin-fs` | 文件系统操作 |
| **dialog** | `tauri-plugin-dialog` | `@tauri-apps/plugin-dialog` | 文件选择对话框 |
| **shell** | `tauri-plugin-shell` | `@tauri-apps/plugin-shell` | 执行系统命令 |
| **clipboard** | `tauri-plugin-clipboard-manager` | `@tauri-apps/plugin-clipboard-manager` | 剪贴板 |
| **process** | `tauri-plugin-process` | `@tauri-apps/plugin-process` | 进程管理 |

### 数据存储插件

| 插件 | 用途 | 数据库支持 |
|------|------|-----------|
| **sql** | SQL 数据库 | SQLite / MySQL / PostgreSQL |
| **store** | 键值存储 | JSON 文件持久化 |

### 系统交互插件

| 插件 | 用途 |
|------|------|
| **notification** | 系统通知 |
| **global-shortcut** | 全局快捷键 |
| **os** | 操作系统信息 |
| **updater** | 应用自动更新 |
| **log** | 日志系统 |
| **http** | HTTP 请求 |
| **websocket** | WebSocket 连接 |

---

## 插件集成 3 步法

### 步骤 1: 安装依赖

```toml
# src-tauri/Cargo.toml
[dependencies]
tauri-plugin-fs = "2"
```

```bash
pnpm add @tauri-apps/plugin-fs
```

### 步骤 2: 注册插件

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

### 步骤 3: 声明权限

```json
// src-tauri/capabilities/default.json
{
  "permissions": [
    "core:default",
    "fs:default",
    "fs:allow-read-text-file"
  ]
}
```

---

## 自定义 Tauri 插件

### 插件结构

```rust
use tauri::plugin::{Builder, TauriPlugin};
use tauri::Runtime;

// 定义插件命令
#[tauri::command]
fn my_plugin_command() -> String {
    "Hello from plugin!".into()
}

// 构建插件
pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("my-plugin")
        .invoke_handler(tauri::generate_handler![my_plugin_command])
        .build()
}
```

### 注册自定义插件

```rust
tauri::Builder::default()
    .plugin(my_plugin::init())
```

### 前端调用

```typescript
// 自定义插件的命令通过 invoke 调用
const result = await invoke("plugin:my-plugin|my_plugin_command");
```

---

## 排查插件问题

| 症状 | 可能原因 | 解决方法 |
|------|---------|---------|
| "Command not found" | 插件未注册 | 检查 Builder.plugin() |
| "Permission denied" | Capabilities 未声明 | 添加权限到 capabilities JSON |
| 编译错误 | 版本不兼容 | Cargo + npm 版本对齐 |
| 运行时无效 | 缺少 JS 绑定 | 安装对应的 npm 包 |

---

## 常见错误

| 错误做法 | 正确做法 |
|---------|---------|
| 只装 Cargo 不装 npm | Rust 和 npm 包都要安装 |
| 注册插件但不声明权限 | 每个插件都要配 Capabilities |
| 不看插件文档直接用 | 先查看插件 README 了解 API |
| Tauri v1 API 用于 v2 | v1 和 v2 API 不同，检查版本 |
