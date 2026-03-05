---
name: json-serialization
description: |
  Tauri 项目中 JSON 序列化/反序列化技能，覆盖 Rust serde 和 TypeScript 类型系统。

  触发场景：
  - 需要定义 Rust 和 TypeScript 之间的数据传输类型
  - 需要处理 JSON 序列化/反序列化
  - 需要处理复杂嵌套数据结构
  - serde 配置和自定义序列化

  触发词：JSON、序列化、serde、类型转换、数据传输、Serialize、Deserialize
---

# JSON 序列化与类型映射

## 核心概念

Tauri IPC 通信基于 JSON：Rust 数据 ←→ JSON ←→ TypeScript 数据。

`serde` 是 Rust 的标准序列化框架，负责 Rust struct ↔ JSON 的自动转换。

---

## Rust ↔ TypeScript 类型映射

| Rust 类型 | JSON 类型 | TypeScript 类型 |
|-----------|----------|----------------|
| `String` | `string` | `string` |
| `&str` | `string` | `string` |
| `i32` / `i64` / `u32` / `u64` | `number` | `number` |
| `f32` / `f64` | `number` | `number` |
| `bool` | `boolean` | `boolean` |
| `Vec<T>` | `array` | `T[]` |
| `Option<T>` | `T \| null` | `T \| null` |
| `HashMap<String, T>` | `object` | `Record<string, T>` |
| `()` | `null` | `void` |
| `(A, B)` | `[A, B]` | `[A, B]` |
| enum (unit variants) | `string` | `string literal union` |
| enum (data variants) | `object` | `discriminated union` |

---

## 基础用法

### Rust struct 定义

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
struct User {
    id: u32,
    name: String,
    email: Option<String>,   // 可选字段 → TS 中为 string | null
    tags: Vec<String>,       // 数组 → TS 中为 string[]
}
```

### 对应的 TypeScript 接口

```typescript
interface User {
  id: number;
  name: string;
  email: string | null;
  tags: string[];
}
```

---

## 高级用法

### 字段重命名

```rust
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]  // 全部字段转 camelCase
struct Config {
    max_retries: u32,       // JSON: "maxRetries"
    timeout_ms: u64,        // JSON: "timeoutMs"
}

#[derive(Serialize, Deserialize)]
struct Item {
    #[serde(rename = "type")]  // Rust 保留字
    item_type: String,
}
```

### 默认值

```rust
#[derive(Serialize, Deserialize)]
struct Settings {
    #[serde(default)]
    dark_mode: bool,            // 缺失时默认 false

    #[serde(default = "default_port")]
    port: u16,                  // 缺失时使用自定义默认值
}

fn default_port() -> u16 { 8080 }
```

### 跳过序列化

```rust
#[derive(Serialize, Deserialize)]
struct Internal {
    name: String,

    #[serde(skip)]
    cache: Vec<u8>,             // 不参与序列化/反序列化

    #[serde(skip_serializing_if = "Option::is_none")]
    description: Option<String>, // None 时不输出字段
}
```

### 枚举序列化

```rust
// 简单枚举 → 字符串
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum Status {
    Active,      // "active"
    Inactive,    // "inactive"
    Pending,     // "pending"
}

// 带数据的枚举 → tagged union
#[derive(Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
enum Message {
    Text(String),                    // {"type":"Text","data":"hello"}
    Image { url: String, width: u32 }, // {"type":"Image","data":{"url":"...","width":100}}
}
```

### 对应 TypeScript

```typescript
type Status = "active" | "inactive" | "pending";

type Message =
  | { type: "Text"; data: string }
  | { type: "Image"; data: { url: string; width: number } };
```

---

## 在 Command 中使用

```rust
#[tauri::command]
fn process_data(input: UserInput) -> Result<UserOutput, String> {
    // serde 自动将 JSON 反序列化为 UserInput
    // 返回值自动序列化为 JSON
    Ok(UserOutput { /* ... */ })
}
```

```typescript
// TypeScript 侧获得类型安全的结果
const output = await invoke<UserOutput>("process_data", { input: myInput });
```

---

## 常见错误

| 错误做法 | 正确做法 |
|---------|---------|
| 忘记 derive Serialize/Deserialize | Command 参数和返回值都需要 derive |
| Rust snake_case 不加 rename_all | 添加 `#[serde(rename_all = "camelCase")]` 或让 Tauri 自动转换 |
| Option 字段在 TS 中标记为 T | 正确标记为 `T \| null` |
| 不处理枚举的序列化格式 | 使用 `#[serde(tag, content)]` 控制格式 |
