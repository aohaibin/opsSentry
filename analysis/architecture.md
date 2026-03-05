# 架构分析 - Tauri

> 分析时间: 2026-03-05

---

## 项目结构

```
tauri/
├── index.html                    # HTML 入口（SPA 挂载点）
├── package.json                  # Node.js 依赖和脚本
├── tsconfig.json                 # TypeScript 配置（前端）
├── tsconfig.node.json            # TypeScript 配置（Node/Vite）
├── vite.config.ts                # Vite 构建配置
├── cc.bat                        # Claude Code 启动脚本
│
├── public/                       # 静态资源
│   ├── tauri.svg
│   └── vite.svg
│
├── src/                          # ★ 前端源码（React + TypeScript）
│   ├── main.tsx                  # 前端入口（ReactDOM.createRoot）
│   ├── App.tsx                   # 主组件（含 Tauri invoke 示例）
│   ├── App.css                   # 全局样式
│   ├── vite-env.d.ts            # Vite 类型声明
│   └── assets/                   # 前端资源
│       └── react.svg
│
├── src-tauri/                    # ★ Rust 后端（Tauri Core）
│   ├── Cargo.toml                # Rust 依赖配置
│   ├── build.rs                  # Tauri 构建脚本
│   ├── tauri.conf.json           # ★ Tauri 核心配置（窗口/安全/打包）
│   ├── .gitignore                # Rust 构建产物忽略
│   ├── capabilities/             # ★ Tauri 2.x 权限配置
│   │   └── default.json          # 默认窗口权限
│   ├── icons/                    # 应用图标（各平台各尺寸）
│   └── src/
│       ├── main.rs               # Rust 入口（Windows 控制台隐藏）
│       └── lib.rs                # ★ 核心逻辑（Commands + Builder）
│
├── docs/                         # 项目文档
│   └── tauri-rust-setup-guide.md # 环境搭建指南
│
├── tauri/                        # 空目录（待清理？）
│
├── .claude/                      # Claude Code 定制配置（新建）
│   ├── settings.json
│   ├── hooks/
│   ├── commands/
│   ├── skills/
│   ├── agents/
│   └── docs/
│
├── analysis/                     # 框架分析文档（新建）
│   ├── architecture.md           # 本文件
│   ├── conventions.md
│   ├── tech-stack.md
│   └── diff-mapping.md
│
└── status.json                   # 定制进度跟踪
```

## 分层架构

Tauri 采用**双进程架构**，与传统 Web 应用的 C/S 模式完全不同：

```
┌─────────────────────────────────────────┐
│              Tauri 应用                  │
│                                         │
│  ┌──────────────┐  IPC (invoke)  ┌──────────────┐
│  │   WebView    │ ◄════════════► │   Rust Core  │
│  │   进程       │                │   进程        │
│  │              │                │              │
│  │  React 19    │  Commands      │  lib.rs      │
│  │  TypeScript  │  Events        │  main.rs     │
│  │  Vite 7      │  ────────►     │  Cargo.toml  │
│  │              │                │              │
│  │  UI 渲染     │  ◄────────     │  系统API     │
│  │  用户交互    │  返回值         │  文件操作     │
│  │              │                │  网络请求     │
│  └──────────────┘                │  数据库      │
│                                  └──────────────┘
└─────────────────────────────────────────┘
```

| 层级 | 职责 | 关键特征 |
|------|------|---------|
| **WebView 层 (前端)** | UI 渲染、用户交互、状态管理 | React 19 + TypeScript，运行在系统 WebView 中 |
| **IPC 桥接层** | 前后端通信 | `invoke()` 调用 Rust Commands，`listen()` 监听事件 |
| **Rust Core 层 (后端)** | 业务逻辑、系统 API、插件管理 | `#[tauri::command]` 宏定义可调用函数 |
| **Capabilities 层** | 安全权限控制 | JSON 声明式权限，控制插件和 API 访问范围 |
| **Plugin 层** | 功能扩展 | Tauri 官方/第三方插件（FS、SQL、通知等） |

## 核心入口分析

### Rust 入口 (`src-tauri/src/lib.rs`)

```rust
// Command 定义（前端可调用的函数）
#[tauri::command]
fn greet(name: &str) -> String { ... }

// 应用构建器
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())     // 注册插件
        .invoke_handler(tauri::generate_handler![greet])  // 注册 Commands
        .run(tauri::generate_context!())         // 启动应用
        .expect("error while running tauri application");
}
```

### 前端入口 (`src/App.tsx`)

```tsx
import { invoke } from "@tauri-apps/api/core";

// 调用 Rust Command
setGreetMsg(await invoke("greet", { name }));
```

## 基类体系

由于是初始模板，目前没有自定义基类。但 Tauri 有内置的关键类型：

| 类型 | 用途 | 来源 |
|------|------|------|
| `tauri::Builder` | 应用构建器，注册插件/命令/事件 | tauri crate |
| `tauri::AppHandle` | 应用句柄，可在 Command 中注入 | tauri crate |
| `tauri::Window` | 窗口句柄 | tauri crate |
| `tauri::State<T>` | 全局状态管理（DI 注入） | tauri crate |
| `tauri::Manager` trait | 窗口/资源管理 trait | tauri crate |

## 模块清单

| 模块/目录 | 用途 | 技术栈 |
|-----------|------|--------|
| `src/` | 前端 UI | React 19 + TypeScript + Vite |
| `src-tauri/src/` | Rust 后端逻辑 | Rust + Tauri 2.x |
| `src-tauri/capabilities/` | 权限声明 | JSON 配置 |
| `src-tauri/icons/` | 应用图标 | PNG/ICO/ICNS |
| `public/` | 静态资源 | SVG |
| `docs/` | 开发文档 | Markdown |

## 构建流程

```
开发模式:  pnpm dev (Vite HMR) + cargo watch (Rust 热编译)
           └─ tauri.conf.json: beforeDevCommand = "pnpm dev"
           └─ devUrl = "http://localhost:1420"

生产构建:  pnpm build (Vite 打包) → cargo build --release → Tauri 打包
           └─ tauri.conf.json: beforeBuildCommand = "pnpm build"
           └─ frontendDist = "../dist"
           └─ bundle.targets = "all"
```

## 安全模型

Tauri 2.x 引入了 **Capabilities** 安全系统：

```
capabilities/default.json:
  identifier: "default"         → 权限组标识
  windows: ["main"]             → 适用窗口
  permissions:
    - "core:default"            → 核心默认权限
    - "opener:default"          → opener 插件默认权限
```

每个插件和 API 需要**显式声明权限**才能使用，这是 Tauri 与 Electron 的核心安全差异。

## 关键架构特征

1. **无服务器后端**: 后端是 Rust 代码，编译进桌面应用，不需要服务器部署
2. **安全沙箱**: WebView 中的前端代码受限于 Capabilities 声明的权限
3. **原生性能**: Rust 后端提供接近原生的性能，适合计算密集型任务
4. **插件化扩展**: 通过 `tauri::Builder.plugin()` 注册功能插件
5. **跨平台一致**: 同一套代码在 Windows/macOS/Linux 上运行
