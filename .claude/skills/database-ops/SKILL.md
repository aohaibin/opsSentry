---
name: database-ops
description: |
  Tauri 本地数据库操作技能，使用 SQLite 通过 tauri-plugin-sql 或 Rust SQLx。

  触发场景：
  - 需要在桌面应用中持久化数据
  - 需要使用 SQLite 数据库
  - 需要设计本地数据表结构
  - 需要执行 CRUD 数据库操作

  触发词：数据库、SQLite、SQL、持久化、存储、表、查询、CRUD、数据
---

# Tauri 本地数据库操作

## 方案选择

| 方案 | 技术 | 适用场景 | 复杂度 |
|------|------|---------|--------|
| **tauri-plugin-store** | 键值存储 | 简单配置/设置 | 低 |
| **tauri-plugin-sql** | SQLite (前端调用) | 中等数据量 | 中 |
| **Rust SQLx** | SQLite (Rust 调用) | 复杂查询/大数据量 | 高 |

---

## 方案 1: tauri-plugin-sql (推荐入门)

### 安装

```toml
# Cargo.toml
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
```

```bash
pnpm add @tauri-apps/plugin-sql
```

### Capabilities

```json
{ "permissions": ["sql:default"] }
```

### Rust 注册

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_sql::Builder::new()
        .add_migrations("sqlite:app.db", migrations)
        .build())
```

### TypeScript 使用

```typescript
import Database from "@tauri-apps/plugin-sql";

// 连接数据库
const db = await Database.load("sqlite:app.db");

// 建表
await db.execute(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// 插入
await db.execute("INSERT INTO todos (title) VALUES (?)", ["买牛奶"]);

// 查询
const todos = await db.select<Todo[]>("SELECT * FROM todos WHERE completed = ?", [false]);

// 更新
await db.execute("UPDATE todos SET completed = ? WHERE id = ?", [true, 1]);

// 删除
await db.execute("DELETE FROM todos WHERE id = ?", [1]);
```

---

## 方案 2: Rust SQLx (高级)

### 安装

```toml
# Cargo.toml
sqlx = { version = "0.7", features = ["runtime-tokio", "sqlite"] }
tokio = { version = "1", features = ["full"] }
```

### Rust 使用

```rust
use sqlx::SqlitePool;
use std::sync::Mutex;

struct DbState {
    pool: SqlitePool,
}

#[tauri::command]
async fn get_todos(state: tauri::State<'_, DbState>) -> Result<Vec<Todo>, String> {
    sqlx::query_as::<_, Todo>("SELECT * FROM todos")
        .fetch_all(&state.pool)
        .await
        .map_err(|e| e.to_string())
}

pub async fn setup_db() -> SqlitePool {
    let pool = SqlitePool::connect("sqlite:app.db?mode=rwc")
        .await
        .expect("Failed to connect to database");

    sqlx::query("CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        completed BOOLEAN DEFAULT FALSE
    )")
    .execute(&pool)
    .await
    .expect("Failed to create table");

    pool
}
```

---

## 数据库设计规范

### 建表模板

```sql
CREATE TABLE IF NOT EXISTS {table_name} (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,

    -- 业务字段
    name        TEXT NOT NULL,
    status      INTEGER DEFAULT 1,  -- 0: 禁用, 1: 正常

    -- 审计字段
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### SQLite 类型映射

| SQLite 类型 | Rust 类型 | TypeScript 类型 |
|------------|-----------|----------------|
| INTEGER | `i32` / `i64` | `number` |
| TEXT | `String` | `string` |
| REAL | `f64` | `number` |
| BOOLEAN | `bool` | `boolean` |
| DATETIME | `String` / `chrono::NaiveDateTime` | `string` |
| BLOB | `Vec<u8>` | `Uint8Array` |

---

## 常见错误

| 错误做法 | 正确做法 |
|---------|---------|
| 数据库文件用绝对路径 | 使用 app_data_dir 相对路径 |
| 不用参数化查询 | 始终使用 `?` 占位符防注入 |
| 不处理数据库初始化 | 应用启动时自动建表 |
| 不做数据库迁移 | 使用 migrations 管理表结构变更 |
