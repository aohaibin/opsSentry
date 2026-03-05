---
name: api-development
description: |
  Tauri Command (IPC API) 开发技能，指导如何设计和实现 Rust Command 供前端调用。

  触发场景：
  - 需要创建新的 Tauri Command
  - 需要设计前后端通信接口
  - 需要处理 Command 的参数和返回值
  - 需要实现异步 Command

  触发词：Command、API、invoke、IPC、接口、通信、前后端
---

# Tauri Command (IPC API) 开发

## 核心概念

在 Tauri 中，前后端通信通过 **Command** 实现，替代传统 Web 应用的 HTTP REST API。

```
传统 Web:  GET /api/users  →  Controller  →  Service  →  DAO
Tauri:     invoke("get_users")  →  #[tauri::command] fn get_users()
```

---

## Command 开发流程

### 完整步骤

```
1. 定义数据结构 (struct + derive Serialize/Deserialize)
2. 实现 Command 函数 (#[tauri::command])
3. 注册到 Builder (generate_handler![])
4. 定义 TypeScript 接口
5. 前端调用 (invoke)
6. 声明权限 (如使用插件 API)
```

### 示例：用户管理 API

#### Rust 侧

```rust
use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Mutex;

// 1. 数据结构
#[derive(Debug, Clone, Serialize, Deserialize)]
struct User {
    id: u32,
    name: String,
    email: String,
}

#[derive(Debug, Deserialize)]
struct CreateUserInput {
    name: String,
    email: String,
}

// 2. 应用状态
struct UserState {
    users: Mutex<Vec<User>>,
    next_id: Mutex<u32>,
}

// 3. Command 实现
#[tauri::command]
fn get_users(state: State<'_, UserState>) -> Result<Vec<User>, String> {
    state.users.lock()
        .map(|users| users.clone())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn get_user(state: State<'_, UserState>, id: u32) -> Result<User, String> {
    let users = state.users.lock().map_err(|e| e.to_string())?;
    users.iter()
        .find(|u| u.id == id)
        .cloned()
        .ok_or_else(|| format!("用户 {} 不存在", id))
}

#[tauri::command]
fn create_user(state: State<'_, UserState>, input: CreateUserInput) -> Result<User, String> {
    let mut next_id = state.next_id.lock().map_err(|e| e.to_string())?;
    let mut users = state.users.lock().map_err(|e| e.to_string())?;

    let user = User {
        id: *next_id,
        name: input.name,
        email: input.email,
    };
    *next_id += 1;
    users.push(user.clone());
    Ok(user)
}

#[tauri::command]
fn delete_user(state: State<'_, UserState>, id: u32) -> Result<(), String> {
    let mut users = state.users.lock().map_err(|e| e.to_string())?;
    let pos = users.iter().position(|u| u.id == id)
        .ok_or_else(|| format!("用户 {} 不存在", id))?;
    users.remove(pos);
    Ok(())
}

// 4. 注册
pub fn run() {
    tauri::Builder::default()
        .manage(UserState {
            users: Mutex::new(Vec::new()),
            next_id: Mutex::new(1),
        })
        .invoke_handler(tauri::generate_handler![
            get_users,
            get_user,
            create_user,
            delete_user,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

#### TypeScript 侧

```typescript
import { invoke } from "@tauri-apps/api/core";

// 类型定义
interface User {
  id: number;
  name: string;
  email: string;
}

interface CreateUserInput {
  name: string;
  email: string;
}

// API 调用封装
const userApi = {
  getAll: () => invoke<User[]>("get_users"),
  getById: (id: number) => invoke<User>("get_user", { id }),
  create: (input: CreateUserInput) => invoke<User>("create_user", { input }),
  delete: (id: number) => invoke<void>("delete_user", { id }),
};

// 使用
const users = await userApi.getAll();
const newUser = await userApi.create({ name: "Alice", email: "alice@example.com" });
```

---

## Command 设计规范

### 命名规范

| 操作 | Rust 函数名 | invoke 调用 |
|------|-----------|------------|
| 查询列表 | `get_users` | `invoke("get_users")` |
| 查询单个 | `get_user` | `invoke("get_user", { id })` |
| 创建 | `create_user` | `invoke("create_user", { input })` |
| 更新 | `update_user` | `invoke("update_user", { id, input })` |
| 删除 | `delete_user` | `invoke("delete_user", { id })` |

### 参数传递规则

- Rust 参数名用 `snake_case`
- TypeScript 参数名用 `camelCase`
- Tauri 自动处理 camelCase ↔ snake_case 转换

### 返回值规范

```rust
// ✅ 无返回值
fn do_action() -> Result<(), String>

// ✅ 返回单个对象
fn get_item(id: u32) -> Result<Item, String>

// ✅ 返回列表
fn list_items() -> Result<Vec<Item>, String>

// ✅ 返回简单值
fn get_count() -> Result<u32, String>
```

---

## 常见错误

| 错误做法 | 正确做法 |
|---------|---------|
| 把所有 Command 放在 lib.rs | 按模块拆分到独立 .rs 文件 |
| Command 不返回 Result | 始终返回 `Result<T, String>` |
| 忘记注册新 Command | 添加到 `generate_handler![]` |
| 前端不处理 invoke 错误 | 每次 invoke 都 try-catch |
| struct 忘记 derive Serialize | 添加 `#[derive(Serialize, Deserialize)]` |
