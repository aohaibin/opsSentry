---
name: error-handler
description: |
  Tauri 异常处理技能，覆盖 Rust 错误处理和 React 错误边界。

  触发场景：
  - 需要设计错误处理策略
  - 需要处理 Rust Command 中的错误
  - 需要处理前端 invoke 调用失败
  - 需要实现全局错误处理

  触发词：异常、错误处理、Error、Result、try-catch、panic、崩溃、错误边界
---

# Tauri 异常处理

## 分层错误处理策略

```
前端 (React)                    后端 (Rust)
┌─────────────────┐          ┌─────────────────┐
│ try-catch        │          │ Result<T, E>     │
│ ErrorBoundary    │ ◄─IPC─► │ thiserror        │
│ 用户友好提示      │          │ 类型安全错误      │
└─────────────────┘          └─────────────────┘
```

---

## Rust 错误处理

### 1. 自定义错误类型

```rust
use thiserror::Error;
use serde::Serialize;

#[derive(Debug, Error)]
enum AppError {
    #[error("文件操作失败: {0}")]
    Io(#[from] std::io::Error),

    #[error("数据未找到: {0}")]
    NotFound(String),

    #[error("参数无效: {0}")]
    InvalidInput(String),

    #[error("数据库错误: {0}")]
    Database(String),

    #[error("权限不足: {0}")]
    Permission(String),
}

// 转换为 Tauri Command 可返回的 String
impl From<AppError> for String {
    fn from(err: AppError) -> String {
        err.to_string()
    }
}
```

### 2. Command 错误处理

```rust
// ✅ 正确：使用 Result + ?
#[tauri::command]
fn read_config(path: String) -> Result<String, AppError> {
    let content = std::fs::read_to_string(&path)?;  // IoError 自动转换
    if content.is_empty() {
        return Err(AppError::InvalidInput("配置文件为空".into()));
    }
    Ok(content)
}

// ❌ 错误：使用 unwrap
#[tauri::command]
fn bad_read(path: String) -> String {
    std::fs::read_to_string(&path).unwrap()  // panic!
}
```

### 3. Mutex 安全处理

```rust
#[tauri::command]
fn get_data(state: tauri::State<'_, AppState>) -> Result<Vec<String>, String> {
    state.data.lock()
        .map(|data| data.clone())
        .map_err(|e| format!("状态锁定失败: {}", e))
}
```

---

## React 错误处理

### 1. invoke 错误处理

```tsx
// ✅ 标准模式
async function loadData() {
  try {
    const result = await invoke<DataType>("get_data");
    setData(result);
  } catch (error) {
    setError(String(error));
    // 错误来自 Rust 的 Err(String)
  }
}
```

### 2. ErrorBoundary 组件

```tsx
import { Component, ReactNode } from "react";

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <div>出错了: {this.state.error?.message}</div>;
    }
    return this.props.children;
  }
}
```

### 3. 全局错误处理 Hook

```tsx
function useErrorHandler() {
  const [error, setError] = useState<string | null>(null);

  async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
    try {
      setError(null);
      return await invoke<T>(cmd, args);
    } catch (e) {
      const msg = String(e);
      setError(msg);
      console.error(`Command "${cmd}" failed:`, msg);
      return null;
    }
  }

  return { error, safeInvoke, clearError: () => setError(null) };
}
```

---

## 常见错误

| 错误做法 | 正确做法 |
|---------|---------|
| Rust 中 `unwrap()` 处理可能失败的操作 | 使用 `?` 运算符 + `Result` |
| 不定义错误类型 | 使用 `thiserror` 定义 `AppError` 枚举 |
| 前端不 catch invoke 错误 | 所有 `invoke` 调用都用 `try-catch` |
| 错误信息不可读 | 提供用户友好的中文错误提示 |
