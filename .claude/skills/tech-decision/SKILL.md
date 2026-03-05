---
name: tech-decision
description: |
  技术决策记录技能，记录和管理项目中的技术选型与架构决策。

  触发场景：
  - 用户需要进行技术选型评估
  - 用户需要记录架构决策及其原因
  - 用户需要回顾历史技术决策

  触发词：技术选型、架构决策、ADR、方案对比、技术评估
---

# 技术决策记录

## 概述

Tauri Desktop App 的技术决策记录技能，使用 ADR（Architecture Decision Record）模式管理技术选型和架构决策。

---

## ADR 模板

```markdown
# ADR-{编号}: {决策标题}

## 状态
[提议中 / 已采纳 / 已废弃 / 已取代]

## 背景
[描述决策的背景和约束条件]

## 技术约束
- 后端: Rust + Tauri 2.x
- 前端: React 19 + TypeScript
- 平台: Windows / macOS / Linux

## 方案对比

| 方案 | 优点 | 缺点 | Rust 生态兼容 | 跨平台 |
|------|------|------|-------------|--------|
| A    |      |      |             |        |
| B    |      |      |             |        |

## 决策
[选择方案 X，理由...]

## 影响
- Rust 侧: ...
- React 侧: ...
- Capabilities: ...
```

---

## 常见决策场景

### Tauri 项目典型技术选型

| 决策领域 | 常见选项 | 推荐 |
|---------|---------|------|
| UI 组件库 | Ant Design / MUI / Shadcn/ui / Headless UI | 按需选择 |
| 状态管理 | useState / Zustand / Jotai / Redux | Zustand（轻量） |
| 路由 | React Router / TanStack Router | React Router |
| 本地数据库 | SQLite (tauri-plugin-sql) / IndexedDB | SQLite |
| HTTP 客户端 | reqwest (Rust) / fetch (前端) | reqwest (通过 Command) |
| 日志 | log + env_logger / tracing | tracing |
| 错误处理 | thiserror / anyhow | thiserror (Command 错误) |
| 样式方案 | CSS Modules / Tailwind / styled-components | Tailwind |
| 测试 | cargo test + Vitest / Jest | cargo test + Vitest |
| CI/CD | GitHub Actions / GitLab CI | GitHub Actions |

---

## 常见错误

| 错误做法 | 正确做法 |
|---------|---------|
| 技术选型不记录原因 | 使用 ADR 记录决策背景和理由 |
| 选择不支持跨平台的方案 | 评估 Windows/macOS/Linux 兼容性 |
| 选 Rust crate 不考虑编译时间 | 权衡功能 vs 编译时间 |
| 决策后不追踪效果 | 定期回顾决策结果并更新状态 |
