---
name: collaborating-with-codex
description: |
  与 OpenAI Codex 协作开发技能，规范多 AI 协作时的任务分工和代码交接。

  触发场景：
  - 用户需要将任务分配给 Codex 执行
  - 用户需要审查 Codex 生成的代码
  - 用户需要与 Codex 协作完成复杂功能

  触发词：Codex、OpenAI、协作、AI分工、代码审查
---

# 与 Codex 协作开发

## 概述

Tauri Desktop App 的 Codex 协作开发技能，定义与 OpenAI Codex 协作时的任务分工、Prompt 编写规范和代码交接流程。

---

## 任务分工原则

### Claude 擅长（保留给 Claude）
- 架构设计和技术决策
- 复杂的 Rust 所有权/生命周期问题
- Tauri IPC 通信设计
- Capabilities 权限配置
- 跨文件重构

### 适合分配给 Codex
- 独立的 React 组件开发
- 简单的 Rust Command 实现
- 单文件代码修改
- 样式编写
- 测试用例编写

---

## Prompt 模板

### 给 Codex 的 Prompt 模板

```markdown
## 项目上下文
- 技术栈: Tauri 2.x + Rust + React 19 + TypeScript
- 前端目录: src/
- 后端目录: src-tauri/src/
- 通信方式: Tauri IPC (invoke)

## 编码规范
- Rust: snake_case 函数名，Result<T, String> 返回值
- TypeScript: 函数组件，严格类型
- Command 需要 #[tauri::command] 宏和 generate_handler! 注册

## 任务
[具体任务描述]

## 参考代码
[附带 lib.rs 或 App.tsx 的相关片段]
```

---

## 代码审查清单

接收 Codex 代码时检查：

- [ ] Rust Command 是否使用了 `#[tauri::command]` 宏
- [ ] Rust 错误处理是否使用 `Result`（而非 `unwrap/panic`）
- [ ] TypeScript 是否定义了接口类型
- [ ] invoke 调用是否使用 snake_case 命令名
- [ ] 是否需要添加 Capabilities 权限
- [ ] 代码风格是否与项目一致

---

## 常见错误

| 错误做法 | 正确做法 |
|---------|---------|
| 不提供项目上下文直接让 Codex 生成 | 附带项目规范和参考代码 |
| 直接使用 Codex 输出不审查 | 按项目规范审查并修正代码 |
| 让 Codex 做跨文件架构变更 | 复杂架构变更由 Claude 处理 |
