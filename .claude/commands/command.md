# /command - 快速创建 Tauri Command

作为 Tauri Command 生成助手，快速创建完整的 Rust Command + 前端调用代码。

## 适用场景

### 适合使用 /command

- 需要创建一个新的 Rust Command（`#[tauri::command]` 函数）
- 前后端 IPC 通信功能（前端 `invoke()` 调用 Rust 函数）
- 系统 API 调用封装（文件操作、进程管理、硬件访问等）
- 数据处理和转换（JSON 解析、加解密、文本处理等）
- 需要注入 `AppHandle`、`Window`、`State` 等框架对象

### 不适合使用 /command

- 复杂业务功能（多个 Command + 完整 UI 页面） --> 使用 /dev
- 纯前端 UI 开发（不涉及 Rust 侧逻辑） --> 直接编码
- 插件集成（使用官方或第三方插件的功能） --> 参考 tauri-plugins 技能
- 窗口管理操作（创建/控制窗口） --> 参考 tauri-window-management 技能
- 事件系统（Rust 向前端推送事件） --> 参考 tauri-events 技能

### 支持的 Command 类型

| 类型 | 适用场景 | 特点 |
|------|---------|------|
| **同步 Command** | 纯计算、内存操作、简单转换 | 立即返回结果 |
| **异步 Command** | 文件 IO、网络请求、数据库操作 | 不阻塞 IPC 线程 |
| **带状态 Command** | 需要访问全局状态（计数器、缓存等） | 注入 `tauri::State<T>` |
| **带窗口 Command** | 需要操作当前窗口（标题、大小等） | 注入 `tauri::Window` |
| **带 AppHandle Command** | 需要访问应用路径、配置等 | 注入 `tauri::AppHandle` |
| **进度回报 Command** | 长时间任务（下载、处理） | 异步 + `window.emit()` |

---

## 执行流程

### 第一步：确认 Command 信息

使用 AskUserQuestion 向用户询问：

```
请提供 Command 的基本信息：

1. 功能描述？（如：读取配置文件、保存用户设置、调用系统命令）
2. 输入参数？（参数名 + 类型，如：path: String, content: String）
3. 返回值类型？（String / 自定义结构体 / Vec<T> / 无返回值）
4. 是否需要异步？（文件IO / 网络请求 / 数据库 --> 需要异步）
5. 是否需要注入框架对象？（AppHandle / Window / State）
```

#### Command 类型自动判断

根据用户描述自动判断 Command 类型：

| 关键词 | 判断为 | 原因 |
|--------|--------|------|
| 文件、读取、写入、保存 | 异步 Command | 涉及文件 IO |
| 网络、HTTP、下载、上传 | 异步 Command | 涉及网络请求 |
| 数据库、查询、SQL | 异步 Command | 涉及数据库操作 |
| 计算、转换、格式化 | 同步 Command | 纯内存操作 |
| 配置、设置、状态 | 带 State 的 Command | 需要持久状态 |
| 窗口、标题、大小 | 带 Window 的 Command | 需要窗口操作 |
| 进度、下载、批量处理 | 异步 + 进度回报 | 长时间任务 |

---

### 第二步：读取现有代码（强制执行）

```bash
# 了解已有 Command 和 generate_handler 注册列表
Read src-tauri/src/lib.rs

# 了解已有 Rust 依赖
Read src-tauri/Cargo.toml

# 如果项目使用 commands/ 模块化组织
Glob src-tauri/src/commands/**/*.rs
# 读取 mod.rs 了解模块结构
Read src-tauri/src/commands/mod.rs
```

**强制检查清单**:
- [ ] 确认 Command 名称不与已有 Command 冲突
- [ ] 确认所需的 Cargo 依赖是否已存在
- [ ] 确认代码组织方式（单文件 lib.rs 还是 commands/ 模块化）

---

### 第三步：自动生成代码

#### 3.1 Rust 侧代码

##### 数据结构定义（如需自定义返回类型）

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct CommandResult {
    pub field_name: String,
    pub field_value: i64,
}
```

##### 同步 Command

```rust
#[tauri::command]
fn command_name(param: String) -> Result<ReturnType, String> {
    // 参数校验
    if param.is_empty() {
        return Err("参数不能为空".into());
    }

    // 业务逻辑
    let result = process(&param).map_err(|e| e.to_string())?;

    Ok(result)
}
```

##### 异步 Command

```rust
#[tauri::command]
async fn command_name(param: String) -> Result<ReturnType, String> {
    // 异步操作（文件IO/网络请求/数据库等）
    let result = tokio::fs::read_to_string(&param)
        .await
        .map_err(|e| format!("读取失败: {}", e))?;

    Ok(result)
}
```

##### 带状态注入的 Command

```rust
#[tauri::command]
fn command_name(
    state: tauri::State<'_, AppState>,
    param: String,
) -> Result<ReturnType, String> {
    let data = state.inner_data.lock().map_err(|e| e.to_string())?;
    // 使用 state 中的数据...
    Ok(result)
}
```

##### 带 AppHandle 的 Command

```rust
#[tauri::command]
fn command_name(
    app: tauri::AppHandle,
    param: String,
) -> Result<ReturnType, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    // 使用应用路径...
    Ok(result)
}
```

##### 带进度回报的异步 Command

```rust
#[tauri::command]
async fn command_name(
    window: tauri::Window,
    param: String,
) -> Result<String, String> {
    let total = 100;
    for i in 0..total {
        // 执行分步操作...
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;

        // 向前端回报进度
        window.emit("command_name_progress", i)
            .map_err(|e| e.to_string())?;
    }
    Ok("完成".into())
}
```

##### 注册到 generate_handler![]

```rust
// 在 lib.rs 的 Builder 中注册新 Command
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        // ... 已有的 commands ...
        command_name,  // <-- 新增
    ])
```

如果项目使用 commands/ 模块化组织：

```rust
// 1. 在 commands/mod.rs 中导出模块
pub mod new_module;

// 2. 在 lib.rs 中注册
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        commands::new_module::command_name,
    ])
```

#### 3.2 TypeScript 侧代码

##### 类型定义

```typescript
// 如有自定义返回类型，定义对应的 TypeScript 接口
interface CommandResult {
  fieldName: string;   // Rust snake_case --> TS camelCase（serde 自动转换）
  fieldValue: number;
}
```

##### 调用函数封装

```typescript
import { invoke } from "@tauri-apps/api/core";

/**
 * [Command 功能描述]
 * @param param [参数说明]
 * @returns [返回值说明]
 */
async function commandName(param: string): Promise<CommandResult> {
  try {
    return await invoke<CommandResult>("command_name", { param });
  } catch (error) {
    console.error("Command failed:", error);
    throw error;
  }
}
```

##### 带进度监听的调用

```typescript
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

async function commandNameWithProgress(
  param: string,
  onProgress: (progress: number) => void,
): Promise<string> {
  // 先注册进度监听
  const unlisten = await listen<number>("command_name_progress", (event) => {
    onProgress(event.payload);
  });

  try {
    return await invoke<string>("command_name", { param });
  } finally {
    // 无论成功失败，都取消监听
    unlisten();
  }
}
```

##### React 组件中使用示例

```tsx
import { useState } from "react";

function MyComponent() {
  const [result, setResult] = useState<CommandResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const data = await commandName("参数值");
      setResult(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={handleClick} disabled={loading}>
        {loading ? "执行中..." : "执行"}
      </button>
      {error && <p style={{ color: "red" }}>{error}</p>}
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
```

#### 3.3 新增 Cargo 依赖（如需要）

根据 Command 功能自动判断是否需要新增依赖：

| 功能 | 需要的 Cargo 依赖 | 添加方式 |
|------|-------------------|---------|
| HTTP 请求 | `reqwest = { version = "0.12", features = ["json"] }` | Cargo.toml [dependencies] |
| JSON 处理 | `serde_json = "1"` | 通常已存在 |
| 文件路径 | `dirs = "5"` | Cargo.toml [dependencies] |
| 日期时间 | `chrono = { version = "0.4", features = ["serde"] }` | Cargo.toml [dependencies] |
| UUID 生成 | `uuid = { version = "1", features = ["v4"] }` | Cargo.toml [dependencies] |
| 正则表达式 | `regex = "1"` | Cargo.toml [dependencies] |
| 加密/哈希 | `sha2 = "0.10"` 或 `bcrypt = "0.15"` | Cargo.toml [dependencies] |
| 数据库 SQLite | `rusqlite = { version = "0.31", features = ["bundled"] }` | Cargo.toml [dependencies] |
| 命令执行 | `std::process::Command` | 标准库，无需额外依赖 |

#### 3.4 Capabilities 权限更新（如需要）

如果新 Command 使用了 Tauri 插件 API，需要更新权限声明：

```json
// src-tauri/capabilities/default.json
{
  "permissions": [
    "core:default",
    // ... 已有权限 ...
    "new-permission:here"  // <-- 新增
  ]
}
```

---

### 第四步：输出文件清单

```markdown
## Command 生成完成！

### 已修改/创建的文件

| 文件 | 操作 | 说明 |
|------|------|------|
| `src-tauri/src/lib.rs` | 修改 | 新增 Command 函数 + 注册到 generate_handler |
| `src-tauri/Cargo.toml` | 修改（如需） | 新增依赖 |
| `src/commands/commandName.ts` | 创建 | TypeScript 调用封装 |
| `src-tauri/capabilities/default.json` | 修改（如需） | 新增权限声明 |

### 验证步骤

1. **编译检查**: `cd src-tauri && cargo check`
2. **启动开发**: `pnpm tauri dev`
3. **在前端调用**: 导入并调用 `commandName()` 函数
4. **检查控制台**: 确认无 "Command not found" 错误

### 后续操作建议

- 如需添加更多 Command，再次使用 `/command`
- 如需完整功能页面（UI + 多个 Command），使用 `/dev`
- 如需单元测试，参考 test-development 技能
```

---

## 与 /dev 的区别

| 对比项 | /command | /dev |
|--------|----------|------|
| **适用场景** | 单个 Command（1 个 Rust 函数 + 1 个 TS 调用封装） | 完整功能（多个 Command + UI 页面 + 状态管理） |
| **UI 生成** | 仅生成 TS 调用封装和使用示例 | 完整 React 页面组件 |
| **权限配置** | 按需提示 | 完整检查并配置 |
| **状态管理** | 按需（注入 State 或不注入） | 完整设计（Rust State + React State） |
| **代码组织** | 可直接加入 lib.rs 或现有模块 | 规划模块结构 |
| **执行速度** | 快速（1-2 分钟） | 较完整（5-10 分钟） |

**选择建议**:
- 快速添加一个 IPC 功能 --> `/command`
- 开发一个完整的功能模块 --> `/dev`
- 先用 `/command` 验证可行性，再用 `/dev` 补全 --> 渐进式开发

---

## AI 强制规则

### Rust 侧规则

1. **Command 必须返回 `Result<T, String>`** -- 不允许 `panic!` 或 `unwrap()` 可能失败的操作
2. **必须在 `generate_handler![]` 注册** -- 否则前端 `invoke()` 会报 "Command not found"
3. **异步操作必须用 `async` Command** -- 文件IO、网络请求、数据库等绝不能用同步 Command
4. **Rust 参数使用 `snake_case`** -- Tauri 自动将前端的 `camelCase` 转为 `snake_case`
5. **禁止 `unwrap()`** -- 使用 `?` 运算符 + `.map_err(|e| e.to_string())`
6. **禁止 `std::thread::sleep`** -- 使用 `tokio::time::sleep` 异步等待
7. **大数据传输考虑性能** -- 超过 1MB 的数据考虑分块传输或流式传输

### TypeScript 侧规则

1. **必须生成对应的 TypeScript 调用封装** -- 不允许在组件中直接裸写 `invoke()`
2. **TypeScript 参数使用 `camelCase`** -- Tauri 自动转换为 Rust 的 `snake_case`
3. **`invoke` 调用必须 `try-catch` 包裹** -- Command 可能返回错误
4. **命令名使用 `snake_case` 字符串** -- `invoke("command_name")`，与 Rust 函数名一致
5. **定义明确的 TypeScript 接口** -- 禁止使用 `any` 类型
6. **React 组件中使用函数组件 + Hooks** -- 不使用 class 组件

### 通用规则

1. **生成前必须读取 `lib.rs` 和 `Cargo.toml`** -- 了解现有代码结构和依赖
2. **Command 名称不得与已有 Command 冲突** -- 检查 `generate_handler![]` 列表
3. **新增 Cargo 依赖必须告知用户** -- 说明为什么需要以及版本号
4. **如使用插件 API 必须检查 Capabilities** -- 缺少权限声明会导致运行时报错

---

## 示例对话

### 用户输入

```
/command
```

### AI 响应

```
好的！我将帮您快速创建一个 Tauri Command。

请提供 Command 的基本信息：

1. 功能描述？（如：读取配置文件、保存用户设置、调用系统命令）
2. 输入参数？（参数名 + 类型，如：path: String, content: String）
3. 返回值类型？（String / 自定义结构体 / Vec<T> / 无返回值）
4. 是否需要异步？（文件IO / 网络请求 / 数据库 --> 需要异步）
5. 是否需要注入框架对象？（AppHandle / Window / State）
```

### 用户输入

```
读取指定路径的配置文件（JSON），参数是文件路径 path: String，返回解析后的 JSON 对象
```

### AI 响应

```
好的！根据您的描述，我将创建一个异步 Command 来读取 JSON 配置文件。

让我先读取现有代码...

[AI 内部：Read src-tauri/src/lib.rs，Read src-tauri/Cargo.toml]

## Command 生成方案

- 名称: read_json_config
- 类型: 异步 Command（涉及文件 IO）
- 参数: path: String
- 返回: serde_json::Value（通用 JSON 对象）

[生成 Rust Command + TypeScript 封装 + 注册代码]
```
