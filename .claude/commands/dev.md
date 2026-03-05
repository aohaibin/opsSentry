# /dev - 开发新功能（全栈代码生成）

作为新功能开发助手，引导完成 Tauri 桌面应用的全栈功能开发。

## 核心优势

- 全栈自动生成（Rust Command + React UI + Capabilities 权限声明）
- 遵循 Tauri 双进程架构（WebView 进程 + Rust Core 进程）
- 类型安全（Rust serde 序列化 + TypeScript 类型对齐）
- 自动处理 Capabilities 权限声明（Tauri 2.x 强制权限模型）
- 错误处理规范（Rust `Result<T, String>` + 前端 `try-catch`）

---

## 执行流程

### 第一步：询问需求

使用 AskUserQuestion 工具询问：

**问题1：功能信息**
```
请告诉我要开发的功能：
1. **功能名称**？（如：文件管理器、设置页面、数据导入、系统监控）
2. **需要哪些系统能力**？（选择适用项）
   - 文件读写（fs 插件）
   - 网络请求（Rust reqwest / http 插件）
   - 本地数据库（sql 插件 / sled / SQLite）
   - 系统通知（notification 插件）
   - 剪贴板（clipboard 插件）
   - 对话框（dialog 插件 — 文件选择/保存/确认框）
   - 系统托盘（tray 插件）
   - 全局快捷键（global-shortcut 插件）
   - 窗口操作（多窗口/窗口控制）
   - Shell 命令执行（shell 插件）
   - 自动更新（updater 插件）
   - 无特殊系统能力（纯前端 UI + 基础 Command）
3. **是否需要持久化状态**？（Rust 侧 State 管理 / 本地存储 / 数据库）
```

**自动推断配置**：
- 文件操作 → 需要 `fs` 插件 + `dialog` 插件 + 对应 Capabilities
- 网络请求 → 通过 Rust Command 代理（禁止前端直接 fetch 外部 API）
- 数据库 → `tauri-plugin-sql` 或 Rust 原生 SQLite 绑定
- 系统通知 → `tauri-plugin-notification` + Capabilities 声明
- 持久状态 → `tauri::State<T>` + `Mutex`/`RwLock` 包裹

---

### 第二步：检查功能是否已存在（强制执行）

```bash
# 检查 Rust Command 是否已有相关功能
Grep pattern: "fn {功能相关关键词}" path: src-tauri/src/ output_mode: files_with_matches

# 检查前端组件是否已有相关功能
Grep pattern: "{功能名相关关键词}" path: src/ output_mode: files_with_matches

# 检查是否已有相关 invoke 调用
Grep pattern: "invoke.*{功能相关}" path: src/ output_mode: content
```

**如果功能已存在** → 停止全栈生成流程，建议增强现有代码（列出现有文件和扩展建议）
**如果功能未实现** → 继续

---

### 第三步：读取参考代码（强制执行）

```bash
# Rust 后端参考 — 了解现有 Command 定义模式和 Builder 配置
Read src-tauri/src/lib.rs

# 前端参考 — 了解现有组件结构和 invoke 调用方式
Read src/App.tsx

# 权限声明参考 — 了解已声明的 Capabilities
Read src-tauri/capabilities/default.json

# Tauri 配置参考 — 了解应用配置（窗口/安全/构建）
Read src-tauri/tauri.conf.json

# Rust 依赖参考 — 了解已安装的 crate
Read src-tauri/Cargo.toml
```

**如果项目已有模块化结构**（如 `src-tauri/src/commands/` 或 `src/components/`），还需读取对应目录结构。

---

### 第四步：设计数据结构

定义 Rust 结构体和对应的 TypeScript 类型，确保两端类型对齐：

**Rust 侧（serde 自动序列化/反序列化）**：
```rust
use serde::{Deserialize, Serialize};

/// 功能数据结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct XxxData {
    pub id: String,
    pub name: String,
    pub status: bool,
    pub created_at: String,
}

/// 功能配置/请求结构（如需独立入参类型）
#[derive(Debug, Deserialize)]
pub struct XxxRequest {
    pub keyword: Option<String>,
    pub page: Option<u32>,
    pub page_size: Option<u32>,
}

/// 功能响应结构（如需分页等封装）
#[derive(Debug, Serialize)]
pub struct XxxResponse {
    pub items: Vec<XxxData>,
    pub total: usize,
}
```

**TypeScript 侧（与 Rust 类型一一对应）**：
```typescript
// 功能数据类型
interface XxxData {
  id: string;
  name: string;
  status: boolean;
  createdAt: string;  // Tauri 自动 snake_case → camelCase
}

// 功能请求类型
interface XxxRequest {
  keyword?: string;
  page?: number;
  pageSize?: number;
}

// 功能响应类型
interface XxxResponse {
  items: XxxData[];
  total: number;
}
```

**类型对齐规则**：
| Rust 类型 | TypeScript 类型 | 说明 |
|-----------|----------------|------|
| `String` / `&str` | `string` | 字符串 |
| `u32` / `i32` / `u64` / `i64` | `number` | 数字 |
| `f64` / `f32` | `number` | 浮点数 |
| `bool` | `boolean` | 布尔 |
| `Vec<T>` | `T[]` | 数组 |
| `Option<T>` | `T \| null` 或 `T?` | 可选值 |
| `HashMap<K, V>` | `Record<K, V>` | 映射 |
| `()` | `void` / `null` | 空返回 |

---

### 第五步：输出生成方案并确认

```markdown
## 代码生成方案

### 功能概述
- **功能名称**：{功能名}
- **系统能力**：{需要的插件/API 列表}
- **持久化方案**：{State / Store / SQL / 无}

### 文件清单

**Rust 后端**：
1. `src-tauri/src/models/xxx.rs` — 数据结构定义（Serialize/Deserialize）
2. `src-tauri/src/commands/xxx.rs` — Command 函数定义
3. `src-tauri/src/lib.rs` — 在 generate_handler![] 中注册新 Command
4. `src-tauri/src/mod.rs` — 模块声明（如新建了子目录）

**React 前端**：
5. `src/types/xxx.ts` — TypeScript 类型定义
6. `src/hooks/useXxx.ts` — 自定义 Hook（封装 invoke 调用）
7. `src/components/Xxx.tsx` 或 `src/pages/Xxx.tsx` — React 组件
8. `src/components/Xxx.css` — 组件样式（如需）

**权限配置**：
9. `src-tauri/capabilities/default.json` — 添加所需插件权限

**依赖更新（如需新插件）**：
10. `src-tauri/Cargo.toml` — 添加 Rust 依赖
11. `package.json` — 添加 @tauri-apps/plugin-* 前端绑定

确认开始生成？
```

> **注意**：如果功能简单（仅 1-2 个 Command + 1 个组件），可以省略独立的 models/commands 子目录，直接写在 `lib.rs` 和组件文件中。文件组织根据项目现有结构决定。

---

### 第六步：自动生成代码

#### 6.1 Rust 后端代码

**1. 数据结构定义**

如果项目已有 `src-tauri/src/models/` 目录，新建 `models/xxx.rs`；否则直接写在 `lib.rs` 中。

```rust
// src-tauri/src/models/xxx.rs（或 lib.rs 内）
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct XxxData {
    pub id: String,
    pub name: String,
    // ... 业务字段
}
```

**2. Command 定义**

如果项目已有 `src-tauri/src/commands/` 目录，新建 `commands/xxx.rs`；否则直接写在 `lib.rs` 中。

```rust
// Command 必须遵循的规则：
// - 返回 Result<T, String>（允许错误传递到前端）
// - 禁止 unwrap()（用 ? 运算符或 map_err）
// - 禁止 panic!()
// - 需要状态时用 tauri::State<'_, T> 注入
// - 长时间操作用 async Command

#[tauri::command]
fn get_xxx_list(state: tauri::State<'_, XxxState>) -> Result<Vec<XxxData>, String> {
    let data = state.items.lock().map_err(|e| e.to_string())?;
    Ok(data.clone())
}

#[tauri::command]
fn create_xxx(state: tauri::State<'_, XxxState>, item: XxxData) -> Result<(), String> {
    let mut data = state.items.lock().map_err(|e| e.to_string())?;
    data.push(item);
    Ok(())
}

#[tauri::command]
fn delete_xxx(state: tauri::State<'_, XxxState>, id: String) -> Result<(), String> {
    let mut data = state.items.lock().map_err(|e| e.to_string())?;
    data.retain(|item| item.id != id);
    Ok(())
}

// 异步 Command 示例（网络请求/文件IO等耗时操作）
#[tauri::command]
async fn fetch_xxx_remote(url: String) -> Result<String, String> {
    reqwest::get(&url)
        .await
        .map_err(|e| format!("Request failed: {}", e))?
        .text()
        .await
        .map_err(|e| format!("Read body failed: {}", e))
}
```

**3. 在 generate_handler![] 中注册新 Command**

```rust
// lib.rs — Builder 配置
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // 如需新插件，在此注册
        .manage(XxxState::default())  // 注册状态（如需）
        .invoke_handler(tauri::generate_handler![
            greet,               // 已有 Command
            get_xxx_list,        // ← 新增
            create_xxx,          // ← 新增
            delete_xxx,          // ← 新增
            fetch_xxx_remote,    // ← 新增（如需）
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**4. 状态管理（如需持久化）**

```rust
use std::sync::Mutex;

pub struct XxxState {
    pub items: Mutex<Vec<XxxData>>,
}

impl Default for XxxState {
    fn default() -> Self {
        Self {
            items: Mutex::new(Vec::new()),
        }
    }
}
```

#### 6.2 React 前端代码

**5. TypeScript 类型定义** → `src/types/xxx.ts`

```typescript
export interface XxxData {
  id: string;
  name: string;
  // ... 与 Rust 结构体对齐
}
```

**6. 自定义 Hook（封装 invoke 调用）** → `src/hooks/useXxx.ts`

```typescript
import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { XxxData } from "../types/xxx";

export function useXxx() {
  const [items, setItems] = useState<XxxData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoke<XxxData[]>("get_xxx_list");
      setItems(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const createItem = useCallback(async (item: XxxData) => {
    try {
      await invoke("create_xxx", { item });
      await fetchList(); // 刷新列表
    } catch (err) {
      setError(String(err));
    }
  }, [fetchList]);

  const deleteItem = useCallback(async (id: string) => {
    try {
      await invoke("delete_xxx", { id });
      await fetchList();
    } catch (err) {
      setError(String(err));
    }
  }, [fetchList]);

  return { items, loading, error, fetchList, createItem, deleteItem };
}
```

**7. React 页面组件** → `src/components/Xxx.tsx` 或 `src/pages/Xxx.tsx`

```tsx
import { useEffect } from "react";
import { useXxx } from "../hooks/useXxx";
import "./Xxx.css";

function XxxPage() {
  const { items, loading, error, fetchList, createItem, deleteItem } = useXxx();

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="xxx-container">
      <h2>Xxx Management</h2>
      {/* 列表/表单/操作按钮 */}
    </div>
  );
}

export default XxxPage;
```

**8. 如需事件监听**（Rust → 前端推送）

```tsx
import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

function XxxPage() {
  useEffect(() => {
    // 监听 Rust 侧发送的事件
    const setupListener = async () => {
      const unlisten = await listen<string>("xxx-updated", (event) => {
        console.log("Received update:", event.payload);
        // 更新状态...
      });
      return unlisten;
    };

    const unlistenPromise = setupListener();

    // 组件卸载时取消监听（必须！）
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // ...
}
```

#### 6.3 权限配置

**9. 更新 Capabilities（如使用了新插件 API）**

```json
// src-tauri/capabilities/default.json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    // ← 按需添加新权限
    "fs:default",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "dialog:default",
    "notification:default"
  ]
}
```

#### 6.4 依赖更新（如需新插件）

**10. Rust 侧添加依赖**

```bash
# 进入 src-tauri 目录添加 Tauri 插件
cd src-tauri && cargo add tauri-plugin-fs tauri-plugin-dialog

# 添加其他 crate（如 reqwest）
cd src-tauri && cargo add reqwest --features json
```

**11. 前端侧添加插件绑定**

```bash
pnpm add @tauri-apps/plugin-fs @tauri-apps/plugin-dialog
```

**12. 在 Builder 中注册插件**

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_fs::init())       // ← 新增
    .plugin(tauri_plugin_dialog::init())   // ← 新增
    // ...
```

---

### 第七步：完成报告

```markdown
## 代码生成完成

### 已完成
- Rust 数据结构定义（Serialize/Deserialize）
- Rust Command 实现（已注册到 generate_handler![]）
- Rust 状态管理（如有）
- TypeScript 类型定义（与 Rust 对齐）
- React 自定义 Hook（封装 invoke 调用 + 错误处理）
- React 页面组件
- Capabilities 权限声明更新

### 生成的文件
**Rust 后端**：
- src-tauri/src/models/xxx.rs — 数据结构
- src-tauri/src/commands/xxx.rs — Command 定义（或写在 lib.rs 中）
- src-tauri/src/lib.rs — Builder 注册更新

**React 前端**：
- src/types/xxx.ts — TypeScript 类型
- src/hooks/useXxx.ts — 自定义 Hook
- src/components/Xxx.tsx — 页面组件

**配置**：
- src-tauri/capabilities/default.json — 权限声明更新

### 后续操作
- **重新运行** `pnpm tauri dev` 使 Rust 代码变更生效
- **如添加了新插件**，需确认 `cargo add` 和 `pnpm add` 已执行
- **如添加了新窗口**，需在 `tauri.conf.json` 的 `app.windows` 中配置
- 推荐运行 `/check` 检查代码规范
- 推荐运行 `cd src-tauri && cargo clippy` 检查 Rust 代码质量
```

---

## AI 强制执行规则

### 流程控制
1. **仅在第五步确认一次，其他步骤自动执行**
2. **第二步必须检查功能是否存在**（Grep 搜索 Rust 和前端代码）
3. **第三步必须读参考代码**（lib.rs / App.tsx / default.json / tauri.conf.json / Cargo.toml）
4. **禁止多次询问用户确认**（确认后直接生成全部代码）

### Rust 后端规范
5. **Command 必须返回 `Result<T, String>`**（让错误传递到前端，不吞掉异常）
6. **Rust 结构体必须 `#[derive(Debug, Serialize, Deserialize)]`**（serde 序列化必备）
7. **新 Command 必须在 `generate_handler![]` 中注册**（否则前端 invoke 找不到）
8. **禁止 `unwrap()` 处理可能失败的操作**（用 `?` 运算符或 `map_err`）
9. **禁止在 Command 中 `panic!()`**（会导致应用崩溃）
10. **禁止在 Command 中做长时间同步阻塞**（用 async Command 或 `tokio::spawn`）
11. **禁止使用 `std::thread::sleep` 阻塞主线程**（用 `tokio::time::sleep`）
12. **状态管理必须使用 `Mutex`/`RwLock` 包裹**（Tauri Command 多线程调用）
13. **使用的插件必须在 Builder 中通过 `.plugin()` 注册**

### TypeScript 前端规范
14. **前端 invoke 必须 try-catch 错误处理**（Command 可能返回 Err）
15. **使用函数组件 + Hooks**（React 19 推荐模式，禁止 class 组件）
16. **禁止在前端直接访问文件系统**（通过 Tauri FS API 或 Rust Command）
17. **禁止前端直接 fetch 外部 API**（通过 Rust Command 代理请求）
18. **禁止使用 `any` 类型**（TypeScript strict 模式，定义明确接口）
19. **事件监听必须在组件卸载时清理**（useEffect 返回 unlisten 函数）
20. **invoke 命令名使用 snake_case**（与 Rust 函数名一致）
21. **invoke 参数使用 camelCase**（Tauri 自动转换为 Rust 的 snake_case）

### 权限配置规范
22. **使用的插件 API 必须在 Capabilities 中声明权限**（Tauri 2.x 运行时强制检查）
23. **新插件既要 Rust 侧 `cargo add` 也要前端侧 `pnpm add`**（双端绑定）
24. **禁止在 Capabilities 中声明未使用的权限**（最小权限原则）

### 桌面应用特有规范
25. **禁止涉及 REST API 路由注册**（Tauri 是桌面应用，不是 Web 服务器）
26. **禁止涉及数据库迁移脚本**（桌面应用数据库随应用管理，不用迁移工具）
27. **禁止涉及多租户设计**（桌面应用是单用户本地应用）
28. **禁止涉及菜单 SQL 初始化**（桌面应用无后台管理菜单系统）
29. **禁止涉及 RESTful 路径设计**（通信走 IPC invoke，不是 HTTP）
30. **跨平台路径必须使用 Tauri path API**（禁止硬编码 `C:\\` 或 `/home/`）
