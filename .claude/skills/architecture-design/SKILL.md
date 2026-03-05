---
name: architecture-design
description: |
  Tauri 架构设计技能，指导双进程架构下的模块拆分和代码组织。

  触发场景：
  - 需要设计新模块的架构
  - 需要重构现有代码结构
  - 需要决定功能放在 Rust 还是 React 侧
  - 需要设计插件集成方案

  触发词：架构、设计、模块、拆分、重构、组织、结构
---

# Tauri 架构设计

## 核心原则

### 前后端分工原则

| 放在 Rust 侧 | 放在 React 侧 |
|-------------|--------------|
| 文件系统操作 | UI 渲染和交互 |
| 系统 API 调用 | 表单处理 |
| 数据库操作 | 状态管理（UI 状态） |
| 网络请求（安全原因） | 路由导航 |
| 计算密集型任务 | 动画和视觉效果 |
| 安全敏感操作 | 用户输入验证（前置） |
| 后台任务/定时器 | 国际化文本 |

### 关键决策：哪些逻辑该放在哪里？

```
用户点击 → React 处理交互
需要系统资源? → Rust Command
纯 UI 逻辑? → React 组件
需要持久化? → Rust (文件/数据库)
需要安全? → Rust (不暴露给 WebView)
```

---

## 推荐项目结构（扩展后）

```
src/                              # React 前端
├── components/                   # 通用组件
│   ├── Layout.tsx
│   ├── ErrorBoundary.tsx
│   └── Loading.tsx
├── pages/                        # 页面组件
│   ├── Home.tsx
│   └── Settings.tsx
├── hooks/                        # 自定义 Hooks
│   ├── useCommand.ts            # Tauri Command 调用封装
│   └── useEventListener.ts     # Tauri 事件监听封装
├── types/                        # TypeScript 类型
│   └── index.ts
├── utils/                        # 工具函数
│   └── index.ts
├── App.tsx                       # 主组件
├── main.tsx                      # 入口
└── App.css                       # 全局样式

src-tauri/src/                    # Rust 后端
├── commands/                     # Command 模块（按业务拆分）
│   ├── mod.rs                   # 模块导出
│   ├── user.rs                  # 用户相关 Command
│   ├── file.rs                  # 文件操作 Command
│   └── config.rs                # 配置管理 Command
├── models/                       # 数据模型
│   ├── mod.rs
│   └── user.rs
├── state.rs                      # 应用状态定义
├── error.rs                      # 错误类型定义
├── lib.rs                        # 入口：Builder + 注册
└── main.rs                       # 进程入口
```

---

## 模块化 Command 注册

### lib.rs 模块化示例

```rust
mod commands;
mod models;
mod state;
mod error;

use state::AppState;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            // 用户模块
            commands::user::get_users,
            commands::user::create_user,
            // 文件模块
            commands::file::read_file,
            commands::file::write_file,
            // 配置模块
            commands::config::get_config,
            commands::config::save_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

## 状态管理架构

```
全局状态 (Rust tauri::State<T>)
├── 持久化数据（数据库/文件）
├── 应用配置
└── 运行时状态（进程级）

UI 状态 (React)
├── 组件内 useState
├── 跨组件 Context
└── 复杂状态 useReducer/Zustand
```

---

## 常见错误

| 错误做法 | 正确做法 |
|---------|---------|
| 前端直接操作文件/网络 | 通过 Rust Command 代理 |
| 所有代码堆在 lib.rs | 按模块拆分到独立文件 |
| 不考虑跨平台差异 | 路径/API 使用跨平台方案 |
| 过度设计初始架构 | 从简单开始，按需重构 |
