---
name: code-patterns
description: |
  代码模式与最佳实践技能，提供 Tauri 项目中常用的设计模式和编码规范。

  触发场景：
  - 用户需要了解项目的编码规范
  - 用户需要应用设计模式解决问题
  - 用户需要重构代码以符合最佳实践

  触发词：设计模式、编码规范、最佳实践、代码风格、重构
---

# 代码模式与最佳实践

## 概述

Tauri Desktop App 的代码模式与最佳实践技能，涵盖 Rust 后端和 React 前端的编码规范和设计模式。

---

## Rust 后端模式

### Command 模式（核心）

```rust
use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Mutex;

// 1. 数据结构定义
#[derive(Debug, Clone, Serialize, Deserialize)]
struct Item {
    id: u32,
    name: String,
    completed: bool,
}

// 2. 应用状态
struct AppState {
    items: Mutex<Vec<Item>>,
}

// 3. Command 定义（CRUD 模式）
#[tauri::command]
fn list_items(state: State<'_, AppState>) -> Result<Vec<Item>, String> {
    state.items.lock()
        .map(|items| items.clone())
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn add_item(state: State<'_, AppState>, item: Item) -> Result<(), String> {
    state.items.lock()
        .map(|mut items| items.push(item))
        .map_err(|e| e.to_string())
}

// 4. Builder 注册
tauri::Builder::default()
    .manage(AppState { items: Mutex::new(Vec::new()) })
    .invoke_handler(tauri::generate_handler![list_items, add_item])
```

### 错误处理模式

```rust
use thiserror::Error;

#[derive(Debug, Error)]
enum AppError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Not found: {0}")]
    NotFound(String),
    #[error("Invalid input: {0}")]
    InvalidInput(String),
}

impl From<AppError> for String {
    fn from(err: AppError) -> String {
        err.to_string()
    }
}

#[tauri::command]
fn read_file(path: String) -> Result<String, AppError> {
    std::fs::read_to_string(&path)
        .map_err(AppError::from)
}
```

### 异步 Command 模式

```rust
#[tauri::command]
async fn fetch_data(url: String) -> Result<String, String> {
    reqwest::get(&url)
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())
}
```

---

## React 前端模式

### 组件模式

```tsx
// 函数组件 + TypeScript
interface Props {
  title: string;
  onAction: (id: number) => void;
}

function MyComponent({ title, onAction }: Props) {
  const [data, setData] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const items = await invoke<Item[]>("list_items");
      setData(items);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h2>{title}</h2>
      {loading ? <p>Loading...</p> : (
        <ul>
          {data.map(item => (
            <li key={item.id} onClick={() => onAction(item.id)}>
              {item.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

### 自定义 Hook 模式

```tsx
// 封装 Tauri Command 调用
function useCommand<T>(commandName: string, args?: Record<string, unknown>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function execute() {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<T>(commandName, args);
      setData(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return { data, error, loading, execute };
}
```

---

## 命名约定

| 项目 | Rust | TypeScript |
|------|------|-----------|
| 文件名 | `snake_case.rs` | `PascalCase.tsx` (组件) / `camelCase.ts` (工具) |
| 函数名 | `snake_case` | `camelCase` |
| 类型名 | `PascalCase` | `PascalCase` |
| 常量 | `SCREAMING_SNAKE_CASE` | `SCREAMING_SNAKE_CASE` |
| Command 名 | `snake_case` (invoke 调用时用字符串) | `invoke("snake_case")` |

---

## 常见错误

| 错误做法 | 正确做法 |
|---------|---------|
| 不遵循项目已有模式 | 先阅读参考代码再编写 |
| Rust 中过度使用 `clone()` | 合理使用引用和借用 |
| React 中不拆分大组件 | 按功能拆分为小组件 |
| 不定义 TypeScript 接口 | 为每个 Command 返回值定义接口 |
