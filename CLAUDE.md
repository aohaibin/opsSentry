# CLAUDE.md - Tauri Desktop App

## 语言设置
**必须使用中文**与用户对话。

## 术语约定
| 术语 | 含义 | 对应目录 |
|------|------|---------|
| **后端** | Rust Core（Tauri 后端进程） | `src-tauri/src/` |
| **前端** | React UI（WebView 进程） | `src/` |
| **配置** | Tauri 核心配置 | `src-tauri/tauri.conf.json` |
| **权限** | Capabilities 安全声明 | `src-tauri/capabilities/` |
| **Command** | Rust 侧可被前端调用的函数 | `#[tauri::command]` |
| **IPC** | 进程间通信（前端 ↔ Rust） | `invoke()` / `listen()` |

---

## 核心架构（必须牢记）

| 项目 | 规范 |
|------|------|
| **应用类型** | Tauri 2.x 桌面应用（双进程架构） |
| **后端语言** | Rust 2021 edition |
| **前端框架** | React 19 + TypeScript 5.8 |
| **构建工具** | Vite 7 (前端) + Cargo (后端) |
| **通信机制** | Tauri IPC（`invoke` 调用 Rust Commands） |
| **序列化** | serde + serde_json（Rust ↔ JSON ↔ TypeScript） |
| **安全模型** | Capabilities 细粒度权限声明 |
| **应用标识** | `com.agilefr.tauri` |

### 双进程架构

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

### 分层职责

| 层级 | 职责 | 关键技术 |
|------|------|---------|
| **WebView 层** | UI 渲染、用户交互、前端状态 | React 19 + TypeScript |
| **IPC 桥接层** | 前后端通信 | `invoke()` 调用 Commands，`listen()` 监听事件 |
| **Rust Core 层** | 业务逻辑、系统 API | `#[tauri::command]`、`tauri::State<T>` |
| **Plugin 层** | 功能扩展 | `tauri::Builder.plugin()` 注册 |
| **Capabilities 层** | 安全权限控制 | JSON 声明式权限 |

---

## 目录结构

```
tauri/
├── index.html                    # HTML 入口（SPA 挂载点）
├── package.json                  # Node.js 依赖和脚本
├── tsconfig.json                 # TypeScript 配置
├── vite.config.ts                # Vite 构建配置
│
├── src/                          # ★ 前端源码（React + TypeScript）
│   ├── main.tsx                  # 前端入口（ReactDOM.createRoot）
│   ├── App.tsx                   # 主组件
│   ├── App.css                   # 全局样式
│   ├── vite-env.d.ts            # Vite 类型声明
│   └── assets/                   # 前端资源
│
├── src-tauri/                    # ★ Rust 后端（Tauri Core）
│   ├── Cargo.toml                # Rust 依赖配置
│   ├── build.rs                  # Tauri 构建脚本
│   ├── tauri.conf.json           # ★ Tauri 核心配置
│   ├── capabilities/             # ★ 权限声明
│   │   └── default.json
│   ├── icons/                    # 应用图标
│   └── src/
│       ├── main.rs               # Rust 入口
│       └── lib.rs                # ★ 核心逻辑（Commands + Builder）
│
├── public/                       # 静态资源
└── docs/                         # 项目文档
```

---

## 🔴 Skills 强制评估（必须遵守）

> **每次用户提问时，Hook 会注入技能评估提示。必须严格遵循！**

**流程**：
1. **评估**：根据注入的技能列表，列出匹配的技能及理由
2. **激活**：对每个匹配的技能调用 `Skill(技能名)`
3. **实现**：激活完成后开始实现

---

## ⚠️ 开发强制要求

**开发前必须：先读参考代码 → 了解现有模式 → 按相同风格编写**

### 参考代码位置

| 开发类型 | 参考代码 |
|---------|---------|
| **Rust Command** | `src-tauri/src/lib.rs` |
| **前端组件** | `src/App.tsx` |
| **Tauri 配置** | `src-tauri/tauri.conf.json` |
| **权限声明** | `src-tauri/capabilities/default.json` |

---

## 🔴 绝对禁止的写法

### Rust 后端

| 错误做法 | 正确做法 | 原因 |
|---------|---------|------|
| `unwrap()` 处理可能失败的操作 | `Result<T, String>` + `?` 运算符 | `unwrap` 会导致 panic 崩溃 |
| Command 中 `panic!()` | 返回 `Err(String)` | panic 会崩溃整个应用 |
| 不加 `#[tauri::command]` 就期望前端调用 | 必须标记 `#[tauri::command]` 并在 `generate_handler!` 注册 | 否则前端 invoke 找不到 |
| 直接在 Command 中做长时间阻塞操作 | 使用 `async` Command 或 `tokio::spawn` | 阻塞会冻结 IPC 响应 |
| 不声明 Capabilities 就使用插件 API | 在 `capabilities/*.json` 中显式声明权限 | Tauri 2.x 强制权限检查 |
| 使用 `std::thread::sleep` 阻塞主线程 | 使用 `tokio::time::sleep` 异步等待 | 阻塞主线程冻结应用 |

### TypeScript 前端

| 错误做法 | 正确做法 | 原因 |
|---------|---------|------|
| `fetch("http://...")` 直接请求外部 API | 通过 Rust Command 代理请求 | 安全限制 + 跨域问题 |
| 硬编码文件系统路径 `"C:\\Users\\..."` | 使用 Tauri path API（`appDataDir()` 等） | 跨平台路径不同 |
| 使用 `class` 组件 | 使用函数组件 + Hooks | React 19 推荐模式 |
| `any` 类型 | 定义明确的 TypeScript 接口 | strict 模式要求 |
| `invoke` 不处理错误 | `try-catch` 包裹 `invoke` 调用 | Command 可能返回错误 |
| 直接 `import` Node.js 模块 | 使用 `@tauri-apps/api/*` 或 Rust Command | WebView 中无 Node.js |

---

## Tauri Command 开发规范

### Rust 侧定义 Command

```rust
use serde::{Deserialize, Serialize};

// 1. 定义数据结构（自动序列化/反序列化）
#[derive(Debug, Serialize, Deserialize)]
struct UserData {
    name: String,
    age: u32,
}

// 2. 定义 Command（同步）
#[tauri::command]
fn get_user(id: u32) -> Result<UserData, String> {
    // 业务逻辑...
    Ok(UserData { name: "Alice".into(), age: 30 })
}

// 3. 定义 Command（异步）
#[tauri::command]
async fn fetch_data(url: String) -> Result<String, String> {
    // 异步操作...
    Ok("data".into())
}

// 4. 注入应用状态
#[tauri::command]
fn get_count(state: tauri::State<'_, AppState>) -> u32 {
    *state.count.lock().unwrap()
}

// 5. 在 Builder 中注册
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())  // 注册状态
        .invoke_handler(tauri::generate_handler![
            get_user,
            fetch_data,
            get_count,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### TypeScript 侧调用 Command

```typescript
import { invoke } from "@tauri-apps/api/core";

// 定义返回类型
interface UserData {
  name: string;
  age: number;
}

// 调用 Rust Command（推荐 try-catch）
async function getUser(id: number): Promise<UserData> {
  try {
    return await invoke<UserData>("get_user", { id });
  } catch (error) {
    console.error("Command failed:", error);
    throw error;
  }
}
```

### Command 命名规范

| 维度 | 规范 | 示例 |
|------|------|------|
| Rust 函数名 | snake_case | `fn get_user_list()` |
| invoke 调用名 | 与 Rust 函数名一致（snake_case 字符串） | `invoke("get_user_list")` |
| 参数名 | Rust: snake_case, TS: camelCase | Rust: `user_id`, TS: `userId`（Tauri 自动转换） |
| 返回类型 | `Result<T, String>` 或直接类型 | `-> Result<Vec<User>, String>` |

---

## 前端核心规范 (src/)

### React 组件规范

```tsx
// 函数组件 + TypeScript 类型
interface Props {
  title: string;
  onSave: (data: FormData) => void;
}

function MyComponent({ title, onSave }: Props) {
  const [loading, setLoading] = useState(false);

  // Tauri Command 调用
  async function handleSave() {
    setLoading(true);
    try {
      const result = await invoke<string>("save_data", { title });
      onSave(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>{title}</h1>
      <button onClick={handleSave} disabled={loading}>
        {loading ? "Saving..." : "Save"}
      </button>
    </div>
  );
}

export default MyComponent;
```

### 状态管理

| 场景 | 方案 | 示例 |
|------|------|------|
| 组件内状态 | `useState` | `const [count, setCount] = useState(0)` |
| 复杂状态逻辑 | `useReducer` | `const [state, dispatch] = useReducer(reducer, init)` |
| 跨组件共享 | React Context | `const AppContext = createContext(...)` |
| 全局应用状态（如需） | Zustand / Jotai | 按需引入轻量状态库 |
| 后端持久状态 | `tauri::State<T>` | Rust 侧管理，通过 Command 读写 |

### IPC 调用模式

```typescript
import { invoke } from "@tauri-apps/api/core";

// ✅ 标准调用模式
const result = await invoke<ReturnType>("command_name", { arg1, arg2 });

// ✅ 错误处理模式
try {
  const data = await invoke<UserData>("get_user", { id: 1 });
  setUser(data);
} catch (error) {
  setError(String(error));
}

// ✅ 事件监听模式
import { listen } from "@tauri-apps/api/event";

const unlisten = await listen<string>("event-name", (event) => {
  console.log("Received:", event.payload);
});
// 组件卸载时取消监听
// unlisten();
```

---

## Capabilities 权限配置

### 权限声明（src-tauri/capabilities/）

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    "fs:default",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "dialog:default",
    "notification:default"
  ]
}
```

### 常用权限列表

| 插件 | 权限 | 说明 |
|------|------|------|
| core | `core:default` | 核心默认权限 |
| opener | `opener:default` | 打开 URL/文件 |
| fs | `fs:default` | 文件系统基础 |
| fs | `fs:allow-read-text-file` | 读取文本文件 |
| fs | `fs:allow-write-text-file` | 写入文本文件 |
| dialog | `dialog:default` | 文件选择对话框 |
| notification | `notification:default` | 系统通知 |
| sql | `sql:default` | 数据库操作 |
| store | `store:default` | 键值存储 |

> **重要**: 每个使用的插件 API 都必须在 capabilities 中声明权限，否则运行时会报错。

---

## Tauri 配置规范 (tauri.conf.json)

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "tauri",
  "version": "0.1.0",
  "identifier": "com.agilefr.tauri",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "pnpm build",
    "frontendDist": "../dist"
  },
  "app": {
    "windows": [
      {
        "title": "应用标题",
        "width": 800,
        "height": 600
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.icns", "icons/icon.ico"]
  }
}
```

---

## Rust 编码规范

### 命名约定

| 项目 | 规范 | 示例 |
|------|------|------|
| 文件名 | snake_case | `user_service.rs`, `database.rs` |
| 函数名 | snake_case | `fn get_user_list()` |
| 结构体 | PascalCase | `struct UserData`, `struct AppState` |
| 枚举 | PascalCase + PascalCase 变体 | `enum Status { Active, Inactive }` |
| 常量 | SCREAMING_SNAKE_CASE | `const MAX_RETRIES: u32 = 3;` |
| Crate 名 | snake_case | `tauri_lib` |
| trait | PascalCase | `trait DataProvider` |

### 错误处理

```rust
// ✅ 推荐：Command 返回 Result
#[tauri::command]
fn read_config(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read {}: {}", path, e))
}

// ✅ 推荐：使用 thiserror 定义错误类型
use thiserror::Error;

#[derive(Debug, Error)]
enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Not found: {0}")]
    NotFound(String),
}

// 实现 Into<String> 以便 Tauri Command 使用
impl From<AppError> for String {
    fn from(err: AppError) -> String {
        err.to_string()
    }
}

// ❌ 禁止：在 Command 中 panic
#[tauri::command]
fn bad_command() -> String {
    panic!("This will crash the app!"); // 永远不要这样做
}
```

### 状态管理

```rust
use std::sync::Mutex;

// 定义应用状态
struct AppState {
    db: Mutex<Vec<String>>,
    config: Mutex<AppConfig>,
}

// 在 Builder 中注册
tauri::Builder::default()
    .manage(AppState {
        db: Mutex::new(Vec::new()),
        config: Mutex::new(AppConfig::default()),
    })

// 在 Command 中使用
#[tauri::command]
fn add_item(state: tauri::State<'_, AppState>, item: String) -> Result<(), String> {
    state.db.lock()
        .map_err(|e| e.to_string())?
        .push(item);
    Ok(())
}
```

---

## 常见错误速查

### Rust 后端常见错误

| 错误写法 | 正确写法 |
|---------|---------|
| `fn cmd() -> String` 返回 `Err` | `fn cmd() -> Result<String, String>` |
| 忘记在 `generate_handler![]` 注册新 Command | 每个新 Command 必须加入 `generate_handler![..., new_cmd]` |
| `state.lock().unwrap()` | `state.lock().map_err(\|e\| e.to_string())?` |
| Command 参数用 `camelCase` | Rust 侧用 `snake_case`（Tauri 自动转换 camelCase → snake_case） |
| `String` 参数按值传递大数据 | 考虑使用 `&str` 借用或流式传输 |
| 同步 Command 中执行网络请求 | 使用 `async` Command + `reqwest` |

### TypeScript 前端常见错误

| 错误写法 | 正确写法 |
|---------|---------|
| `invoke("getUser")` (camelCase 命令名) | `invoke("get_user")` (snake_case，与 Rust 一致) |
| `invoke("cmd", { userId: 1 })` | `invoke("cmd", { userId: 1 })` (TS 用 camelCase，Tauri 自动转) |
| 不 `await` invoke 调用 | `const result = await invoke(...)` |
| 不处理 invoke 错误 | `try { await invoke(...) } catch(e) { ... }` |
| 组件中不清理事件监听 | `useEffect` 中返回 `unlisten` 函数 |
| 直接使用 `window.open()` | 使用 `@tauri-apps/plugin-opener` 的 `open()` |

---

## 构建与运行

### 常用命令

```bash
# 开发模式（前端 HMR + Rust 热编译）
pnpm tauri dev

# 生产构建（生成安装包）
pnpm tauri build

# 仅构建前端
pnpm build

# Rust 代码检查
cd src-tauri && cargo clippy

# Rust 测试
cd src-tauri && cargo test

# 清理 Rust 构建缓存
cd src-tauri && cargo clean

# 更新依赖
cargo update          # Rust 依赖
pnpm update           # Node.js 依赖
```

### 打包产物

| 平台 | 格式 | 位置 |
|------|------|------|
| Windows | `.msi` / `.exe` (NSIS) | `src-tauri/target/release/bundle/` |
| macOS | `.dmg` / `.app` | `src-tauri/target/release/bundle/` |
| Linux | `.deb` / `.AppImage` | `src-tauri/target/release/bundle/` |

---

## Tauri 核心类型速查

| 类型 | 用途 | 使用场景 |
|------|------|---------|
| `tauri::Builder` | 应用构建器 | 注册插件、Commands、状态、事件 |
| `tauri::AppHandle` | 应用句柄 | 在 Command 中访问应用实例 |
| `tauri::Window` | 窗口句柄 | 操作窗口（大小/位置/标题） |
| `tauri::State<T>` | 全局状态 | Command 中注入共享状态 |
| `tauri::Manager` | 管理 trait | 获取窗口、发送事件 |
| `tauri::Emitter` | 事件发送 trait | 向前端发送事件 |
| `tauri::Listener` | 事件监听 trait | 监听前端事件 |

---

## 快速命令

| 命令 | 用途 |
|------|------|
| `/dev` | 开发新功能（Rust Command + React UI + Capabilities） |
| `/command` | 快速创建 Tauri Command |
| `/check` | 代码规范检查（Rust + TypeScript） |
| `/start` | 项目快速了解 |
| `/progress` | 项目进度报告 |
| `/next` | 下一步建议 |

---

## 🔴 开发前检查清单

- [ ] **已读参考代码** — `src-tauri/src/lib.rs` 和 `src/App.tsx`
- [ ] **已了解双进程架构** — 前端（WebView）和后端（Rust）通过 IPC 通信
- [ ] **已了解 Command 模式** — `#[tauri::command]` + `invoke()` 调用链
- [ ] **已确认 Capabilities** — 使用的插件 API 都已在 capabilities 中声明
- [ ] **错误处理正确** — Rust 用 `Result<T, String>`，前端用 `try-catch`
- [ ] **不违反禁止项** — 检查上方禁止表格
- [ ] **代码风格一致** — Rust snake_case，TypeScript camelCase，React 函数组件
