---
name: test-development
description: |
  Tauri 项目测试开发技能，覆盖 Rust 单元测试和 React 组件测试。

  触发场景：
  - 需要为 Rust Command 编写测试
  - 需要为 React 组件编写测试
  - 需要设计测试策略
  - 需要运行和调试测试

  触发词：测试、test、单元测试、集成测试、TDD、测试用例
---

# Tauri 测试开发

## 测试策略

```
               ┌──────────────────┐
               │   E2E 测试        │  (可选: Playwright/WebdriverIO)
               │  完整应用流程      │
              ┌┴──────────────────┴┐
              │   集成测试          │  (Rust: Command + State)
              │  模块间交互         │
             ┌┴────────────────────┴┐
             │   单元测试            │  (Rust: cargo test / TS: Vitest)
             │  函数/组件级别        │
             └──────────────────────┘
```

---

## Rust 测试

### 单元测试

```rust
// 在同一文件中编写测试
#[tauri::command]
fn add(a: i32, b: i32) -> i32 {
    a + b
}

#[tauri::command]
fn validate_email(email: &str) -> Result<bool, String> {
    if email.contains('@') && email.contains('.') {
        Ok(true)
    } else {
        Err("无效的邮箱格式".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add() {
        assert_eq!(add(1, 2), 3);
        assert_eq!(add(-1, 1), 0);
    }

    #[test]
    fn test_validate_email() {
        assert!(validate_email("test@example.com").unwrap());
        assert!(validate_email("invalid").is_err());
    }
}
```

### 运行测试

```bash
# 运行所有 Rust 测试
cd src-tauri && cargo test

# 运行特定测试
cd src-tauri && cargo test test_add

# 显示输出
cd src-tauri && cargo test -- --nocapture

# 运行特定模块的测试
cd src-tauri && cargo test commands::user::tests
```

---

## React 测试 (Vitest)

### 安装

```bash
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

### vitest.config.ts

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
  },
});
```

### 组件测试

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import MyComponent from "./MyComponent";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("MyComponent", () => {
  it("renders correctly", () => {
    render(<MyComponent title="Test" />);
    expect(screen.getByText("Test")).toBeInTheDocument();
  });

  it("calls invoke on button click", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    (invoke as ReturnType<typeof vi.fn>).mockResolvedValue("Hello");

    render(<MyComponent title="Test" />);
    fireEvent.click(screen.getByText("Submit"));

    expect(invoke).toHaveBeenCalledWith("my_command", expect.any(Object));
  });
});
```

### 运行前端测试

```bash
# 运行测试
pnpm vitest

# 运行一次
pnpm vitest run

# 覆盖率
pnpm vitest run --coverage
```

---

## 常见错误

| 错误做法 | 正确做法 |
|---------|---------|
| 不写测试直接提交 | 至少为核心 Command 编写单元测试 |
| 前端测试中真实调用 invoke | Mock `@tauri-apps/api/core` |
| 只测试正常路径 | 同时测试错误路径 (Err/异常) |
| 测试中硬编码文件路径 | 使用临时目录 `tempfile::tempdir()` |
