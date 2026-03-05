---
name: tauri-commands
description: |
  Tauri Command 高级开发技能，覆盖异步 Command、状态注入、流式传输、事件通知等高级模式。

  触发场景：
  - 需要开发复杂的 Tauri Command
  - 需要 Command 中访问 AppHandle/Window
  - 需要实现进度回报/流式数据
  - 需要 Command 之间共享逻辑

  触发词：Command、tauri::command、invoke、高级Command、async command、进度、stream
---

# Tauri Command 高级开发

## Command 注入参数

Tauri Command 除了接收前端传来的参数，还可以注入框架对象：

```rust
// 注入 AppHandle（应用句柄）
#[tauri::command]
fn with_app(app: tauri::AppHandle) -> Result<String, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(data_dir.to_string_lossy().into())
}

// 注入 Window（当前窗口）
#[tauri::command]
fn with_window(window: tauri::Window) -> Result<(), String> {
    window.set_title("New Title").map_err(|e| e.to_string())?;
    Ok(())
}

// 注入 State（全局状态）
#[tauri::command]
fn with_state(state: tauri::State<'_, AppState>) -> Result<u32, String> {
    state.counter.lock().map(|c| *c).map_err(|e| e.to_string())
}

// 组合注入
#[tauri::command]
async fn complex_cmd(
    app: tauri::AppHandle,
    window: tauri::Window,
    state: tauri::State<'_, AppState>,
    name: String,     // 前端参数
    count: u32,       // 前端参数
) -> Result<String, String> {
    // 使用所有注入对象...
    Ok("done".into())
}
```

---

## 异步 Command

```rust
// 异步 Command（不阻塞主线程）
#[tauri::command]
async fn fetch_url(url: String) -> Result<String, String> {
    reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())
}

// 后台任务 + 进度回报
#[tauri::command]
async fn long_task(window: tauri::Window) -> Result<String, String> {
    for i in 0..100 {
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        window.emit("progress", i).map_err(|e| e.to_string())?;
    }
    Ok("完成".into())
}
```

### 前端监听进度

```typescript
import { listen } from "@tauri-apps/api/event";

async function startLongTask() {
  const unlisten = await listen<number>("progress", (event) => {
    setProgress(event.payload);
  });

  try {
    const result = await invoke<string>("long_task");
    console.log(result);
  } finally {
    unlisten();
  }
}
```

---

## Command 模块化组织

### 按功能拆分

```rust
// src-tauri/src/commands/mod.rs
pub mod user;
pub mod file;
pub mod config;

// src-tauri/src/commands/user.rs
use tauri::State;
use crate::state::AppState;

#[tauri::command]
pub fn get_users(state: State<'_, AppState>) -> Result<Vec<User>, String> {
    // ...
}

#[tauri::command]
pub fn create_user(state: State<'_, AppState>, input: CreateUserInput) -> Result<User, String> {
    // ...
}
```

### lib.rs 统一注册

```rust
mod commands;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::user::get_users,
            commands::user::create_user,
            commands::file::read_file,
            commands::file::write_file,
            commands::config::get_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 错误处理最佳实践

```rust
use serde::Serialize;

// 结构化错误响应
#[derive(Debug, Serialize)]
struct CommandError {
    code: String,
    message: String,
}

impl From<std::io::Error> for CommandError {
    fn from(err: std::io::Error) -> Self {
        CommandError {
            code: "IO_ERROR".into(),
            message: err.to_string(),
        }
    }
}

// 在 Command 中使用
#[tauri::command]
fn safe_read(path: String) -> Result<String, CommandError> {
    Ok(std::fs::read_to_string(&path)?)
}
```

```typescript
// 前端处理结构化错误
try {
  await invoke("safe_read", { path: "/nonexistent" });
} catch (e) {
  const error = e as { code: string; message: string };
  if (error.code === "IO_ERROR") {
    console.error("文件操作失败:", error.message);
  }
}
```

---

## 常见错误

| 错误做法 | 正确做法 |
|---------|---------|
| 同步 Command 做网络请求 | 使用 async Command |
| 不用 emit 通知进度 | 长任务通过事件回报进度 |
| 所有 Command 写在 lib.rs | 按模块拆分到 commands/ 目录 |
| 忘记 pub 导出 Command 函数 | 跨模块 Command 必须 `pub fn` |
