---
name: project-navigator
description: |
  Tauri 项目导航技能，快速定位代码、理解项目结构、找到关键文件。

  触发场景：
  - 需要了解项目整体结构
  - 需要快速找到某个功能的代码位置
  - 需要理解 Rust 和 React 代码的关系
  - 新加入项目需要熟悉代码

  触发词：项目结构、在哪里、怎么找、代码位置、目录、文件、导航、定位
---

# Tauri 项目导航

## 项目结构速查

### 关键入口文件

| 文件 | 用途 | 何时修改 |
|------|------|---------|
| `src-tauri/src/lib.rs` | Rust 核心入口，Command 注册 | 添加新 Command/插件/状态 |
| `src-tauri/src/main.rs` | Rust 进程入口 | 极少修改 |
| `src/main.tsx` | React 入口 | 添加全局 Provider |
| `src/App.tsx` | 主组件 | 添加路由/布局 |
| `src-tauri/tauri.conf.json` | Tauri 核心配置 | 修改窗口/打包/安全 |
| `src-tauri/Cargo.toml` | Rust 依赖 | 添加 Rust crate |
| `package.json` | 前端依赖 | 添加 npm 包 |

### 关键目录

| 目录 | 内容 | 文件类型 |
|------|------|---------|
| `src/` | React 前端源码 | `.tsx`, `.ts`, `.css` |
| `src-tauri/src/` | Rust 后端源码 | `.rs` |
| `src-tauri/capabilities/` | Tauri 权限声明 | `.json` |
| `src-tauri/icons/` | 应用图标 | `.png`, `.ico`, `.icns` |
| `public/` | 静态资源 | `.svg`, `.png` 等 |
| `docs/` | 项目文档 | `.md` |

---

## 功能定位指南

### "我想添加一个新功能"

```
1. 定义 Rust 数据结构 → src-tauri/src/ (新建或修改 .rs 文件)
2. 实现 Rust Command → src-tauri/src/lib.rs (或独立模块)
3. 注册 Command → src-tauri/src/lib.rs 的 generate_handler![]
4. 声明权限 → src-tauri/capabilities/default.json (如使用插件)
5. 定义 TS 接口 → src/ 下的类型文件
6. 实现 React 组件 → src/ 下的组件文件
7. 调用 Command → invoke("command_name", { args })
```

### "我想添加一个 Tauri 插件"

```
1. Cargo.toml 添加依赖 → src-tauri/Cargo.toml
2. package.json 添加 JS 绑定 → package.json (如有)
3. 注册插件 → src-tauri/src/lib.rs 的 Builder.plugin()
4. 声明权限 → src-tauri/capabilities/default.json
5. 前端调用 → import from "@tauri-apps/plugin-xxx"
```

### "我想修改窗口配置"

```
→ src-tauri/tauri.conf.json 的 app.windows 部分
```

### "我想修改打包配置"

```
→ src-tauri/tauri.conf.json 的 bundle 部分
```

---

## 代码搜索技巧

| 想找什么 | 搜索方法 |
|---------|---------|
| 某个 Command 的定义 | Grep `#\[tauri::command\]` 后找函数名 |
| 某个 Command 的调用 | Grep `invoke\("command_name"` |
| 所有注册的 Command | 查看 `generate_handler![]` 列表 |
| 所有插件 | Grep `.plugin(` in lib.rs |
| 所有权限声明 | 读取 `capabilities/*.json` |
| Rust 依赖 | 读取 `src-tauri/Cargo.toml` |
| 前端依赖 | 读取 `package.json` |

---

## 常见错误

| 错误做法 | 正确做法 |
|---------|---------|
| 不知道代码在哪就开始写 | 先用导航指南定位相关文件 |
| 只改前端忘记后端 | Tauri 功能通常涉及前后端两侧 |
| 忘记注册新 Command | 添加到 `generate_handler![]` |
| 忘记声明权限 | 使用插件 API 前检查 Capabilities |
