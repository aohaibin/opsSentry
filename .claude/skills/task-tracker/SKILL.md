---
name: task-tracker
description: |
  任务跟踪与进度管理技能，管理开发任务的创建、分解、状态更新和归档。

  触发场景：
  - 用户需要创建或查看开发任务
  - 用户需要更新任务进度或状态
  - 用户需要归档已完成的任务

  触发词：任务、进度、待办、TODO、跟踪
---

# 任务跟踪与进度管理

## 概述

Tauri Desktop App 的任务跟踪与进度管理技能，提供任务创建、分解、状态流转和归档的完整工作流。

---

## 任务生命周期

```
创建 → 分解 → 开发中 → 测试 → 完成 → 归档
```

### 状态定义

| 状态 | 说明 | 触发条件 |
|------|------|---------|
| `pending` | 待处理 | 任务创建时 |
| `in_progress` | 开发中 | 开始实现时 |
| `testing` | 测试中 | 代码完成、开始测试 |
| `completed` | 已完成 | 测试通过 |
| `archived` | 已归档 | 长期完成的任务 |

---

## 任务分解原则

### Tauri 项目任务分解

一个典型功能涉及多个层面：

1. **Rust Command 层**: 后端业务逻辑
2. **TypeScript 类型层**: 接口类型定义
3. **React 组件层**: UI 实现
4. **Capabilities 层**: 权限声明
5. **测试层**: Rust tests + React tests

### 任务模板

```markdown
## [功能名称]

### 子任务
- [ ] 定义 Rust 数据结构 (struct + derive)
- [ ] 实现 Rust Command (#[tauri::command])
- [ ] 在 Builder 中注册 Command
- [ ] 定义 TypeScript 接口类型
- [ ] 实现 React 组件
- [ ] 添加 Capabilities 权限声明（如需）
- [ ] 编写 Rust 单元测试
- [ ] 验证跨平台兼容性
```

---

## 常见错误

| 错误做法 | 正确做法 |
|---------|---------|
| 不记录任务直接开发 | 先创建任务文档再开发 |
| 任务粒度过大不分解 | 按 Rust/React/Capabilities 层拆分子任务 |
| 不验证跨平台 | Windows/macOS/Linux 都要验证 |
