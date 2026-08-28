# Agile Tauri 框架开发指南

> 本文档是 Agile Tauri 框架的完整开发指南，涵盖从项目创建到版本发布的全流程。
> 框架内置了 34 个 AI 技能和 7 个快捷命令，配合 Claude Code 实现 AI 驱动的桌面应用开发。

---

## 目录

- [一、快速开始](#一快速开始)
- [二、项目结构总览](#二项目结构总览)
- [三、开发工作流](#三开发工作流)
- [四、技能系统详解](#四技能系统详解)
- [五、快捷命令参考](#五快捷命令参考)
- [六、常见开发场景](#六常见开发场景)
- [七、最佳实践](#七最佳实践)

---

## 一、快速开始

### 1.1 创建新项目

使用 `project-init` 技能，只需一句话即可创建新项目：

```
你: 我要开发一个新项目，叫做 TodoApp
```

Claude 会自动执行以下流程：

1. **模板检测** — 检查框架模板是否有更新
2. **信息收集** — 询问项目名称、标识符、描述、目标目录
3. **目录创建** — 复制模板到新目录
4. **标识替换** — 自动替换 `com.agilefr.tauri` 为你的标识符
5. **端口分配** — 自动分配唯一的开发端口（避免多项目冲突）
6. **Git 初始化** — 创建 Git 仓库并推送初始代码
7. **签名密钥** — 生成 Tauri 更新签名密钥对
8. **启动引导** — 给出后续开发步骤

### 1.2 了解现有项目

如果你接手一个已有项目，使用 `/start` 命令快速了解：

```
你: /start
```

Claude 会分析项目结构、技术栈、已有功能模块，输出一份完整的项目概览报告。

### 1.3 运行项目

```bash
# 安装依赖
pnpm install

# 启动开发模式（前端 HMR + Rust 热编译）
pnpm tauri dev
```

---

## 二、项目结构总览

### 2.1 双进程架构

```
┌─────────────────────────────────────────────────────┐
│                   Tauri 桌面应用                      │
│                                                     │
│  ┌────────────────┐   IPC (invoke)   ┌────────────────┐
│  │  WebView 进程   │ ◄═════════════► │  Rust Core 进程 │
│  │                │                  │                │
│  │  React 19      │   Commands       │  commands/     │
│  │  Ant Design    │   Events         │  services/     │
│  │  TailwindCSS   │   ──────────►    │  database/     │
│  │  Zustand       │                  │  models/       │
│  │                │  ◄──────────     │  error.rs      │
│  │  UI 渲染       │   返回值          │  state.rs      │
│  │  用户交互       │                  │  系统 API      │
│  └────────────────┘                  └────────────────┘
│                                                     │
│  src/                                src-tauri/src/  │
└─────────────────────────────────────────────────────┘
```

### 2.2 后端三层架构

```
前端 invoke("get_config", { key })
  → commands/config.rs::get_config()      // Layer 1: IPC 入口
    → services/config.rs::get()           // Layer 2: 业务逻辑
      → database/mod.rs::get_config()     // Layer 3: SQL 执行
```

| 层级 | 目录 | 职责 |
|------|------|------|
| Commands | `src-tauri/src/commands/` | IPC 接口定义，参数校验 |
| Services | `src-tauri/src/services/` | 业务逻辑，事务编排 |
| Database | `src-tauri/src/database/` | 数据访问，SQL 操作 |

### 2.3 前端结构

| 目录 | 内容 |
|------|------|
| `src/pages/` | 页面组件 |
| `src/components/` | 通用组件（layout / ui） |
| `src/store/` | Zustand 全局状态 |
| `src/lib/api/` | API 调用封装 |
| `src/types/` | TypeScript 类型定义 |
| `src/hooks/` | 自定义 Hooks |
| `src/styles/` | TailwindCSS 全局样式 |

---

## 三、开发工作流

下面是一个完整功能从规划到发布的标准流程，每个阶段都有对应的技能和命令支持。

### 阶段 1：规划与设计

#### 需求分析与头脑风暴

```
你: 我想给应用添加一个文件管理功能，有什么好的方案？
```

**自动激活技能**：`brainstorm`、`architecture-design`

Claude 会：
- 提出多种实现方案并进行对比评估
- 使用评估矩阵（复用度/可行性/开发量/跨平台/安全性/UI 一致性）打分
- 推荐最优方案

#### 技术决策记录

```
你: 我们决定使用 rusqlite 而不是 tauri-plugin-sql，记录一下这个决策
```

**自动激活技能**：`tech-decision`

Claude 会创建 ADR（Architecture Decision Record），记录决策背景、方案对比和最终选择。

#### 任务分解

```
你: 帮我把文件管理功能拆分成开发任务
```

**自动激活技能**：`task-tracker`

Claude 会按三层架构拆分为子任务：
- 后端：models → database → services → commands
- 前端：types → api → pages → store
- 配置：capabilities、路由

### 阶段 2：全栈开发

#### 方式一：使用 `/dev` 命令（推荐）

```
你: /dev
```

这是最强大的开发命令，Claude 会：

1. **需求对齐** — 与你确认功能范围和验收标准
2. **架构评审** — 设计完整的技术方案（前后端分工、数据模型、API 设计）
3. **生成代码** — 按三层架构逐层实现：
   - Rust：models → database（Schema 迁移）→ services → commands → lib.rs 注册
   - TypeScript：types → api 封装 → 页面组件 → 路由 → 导航
4. **编译验证** — 运行 `cargo check` 和 `npx tsc --noEmit`
5. **输出总结** — 列出所有变更文件和后续步骤

#### 方式二：使用 `/command` 命令（快速创建单个 Command）

```
你: /command
```

适合只需要添加一个 Tauri Command 的场景，Claude 会：

1. 询问 Command 名称、参数、返回值
2. 生成完整的三层代码（Command + Service + Database）
3. 注册到 `generate_handler![]`
4. 生成对应的 TypeScript 类型和 API 封装
5. 运行编译检查

#### 方式三：自然语言描述

```
你: 帮我添加一个用户管理功能，需要增删改查
```

Claude 会根据描述自动匹配并激活相关技能：
- `api-development` — Command 接口设计
- `database-ops` — 数据库表和 CRUD
- `ui-frontend` — 页面组件开发
- `code-patterns` — 按项目编码规范实现
- `error-handler` — 错误处理

### 阶段 3：调试与优化

#### 问题排查

```
你: invoke 调用 get_config 时返回空，但数据库里有数据
```

**自动激活技能**：`bug-detective`

Claude 会按方法论排查：复现 → 缩小范围（前端/IPC/后端）→ 定位根因 → 修复验证。

#### 性能优化

```
你: 应用启动变慢了，怎么优化？
```

**自动激活技能**：`performance-doctor`

Claude 会从多维度诊断：Rust 编译时间、应用启动速度、前端渲染、内存使用、安装包体积。

### 阶段 4：代码检查

```
你: /check
```

Claude 会执行全栈代码审查：

- **Rust 后端**：三层架构合规性、错误处理、SQL 注入防护、Mutex 安全
- **TypeScript 前端**：类型安全、API 封装规范、Ant Design 使用、TailwindCSS
- **Tauri 配置**：Capabilities 权限、窗口配置、版本号一致性
- **前后端一致性**：Rust struct 与 TypeScript interface 对齐

### 阶段 5：版本发布

```
你: /release
```

Claude 会执行完整的发布流程：

1. 询问新版本号和更新说明
2. 同步更新三处版本号（`tauri.conf.json` / `Cargo.toml` / `package.json`）
3. 更新 release 仓库 README（下载链接 + 版本历史）
4. 提交代码并推送到 GitHub
5. 打 Git Tag 触发 CI 自动构建
6. CI 完成后，下载产物并推送到 release 仓库

> CI 负责构建三平台安装包（Windows/macOS/Linux），本地不需要执行 `pnpm tauri build`。

---

## 四、技能系统详解

框架内置 34 个 AI 技能，按功能分为 7 大类。技能会根据你的对话内容**自动激活**，无需手动调用。

### 4.1 项目管理类

| 技能 | 触发词 | 用途 |
|------|--------|------|
| `project-init` | 新项目、创建项目、初始化项目 | 基于框架模板创建新项目 |
| `project-navigator` | 项目结构、在哪里、怎么找 | 快速定位代码位置 |
| `task-tracker` | 任务、进度、待办 | 任务分解和进度管理 |
| `brainstorm` | 方案、怎么设计、有什么办法 | 头脑风暴和方案探索 |
| `tech-decision` | 技术选型、架构决策、方案对比 | 技术决策记录（ADR） |

### 4.2 架构与设计类

| 技能 | 触发词 | 用途 |
|------|--------|------|
| `architecture-design` | 架构、设计、模块、拆分 | 双进程架构设计指导 |
| `code-patterns` | 设计模式、编码规范、最佳实践 | 代码模式和编码规范 |

### 4.3 后端开发类（Rust）

| 技能 | 触发词 | 用途 |
|------|--------|------|
| `api-development` | Command、API、invoke、IPC | Tauri Command 开发 |
| `tauri-commands` | 高级 Command、async command、进度 | Command 高级模式（流式/异步） |
| `database-ops` | 数据库、SQLite、SQL、CRUD | rusqlite 数据库操作 |
| `rust-fundamentals` | 所有权、借用、生命周期、编译错误 | Rust 语言基础 |
| `json-serialization` | JSON、序列化、serde、类型转换 | serde 序列化/反序列化 |
| `error-handler` | 异常、错误处理、Result、panic | 前后端错误处理策略 |

### 4.4 前端开发类（React）

| 技能 | 触发词 | 用途 |
|------|--------|------|
| `ui-frontend` | UI、组件、页面、前端、表单 | React + Ant Design 页面开发 |
| `store-management` | 状态管理、Zustand、持久化 | 前后端状态管理 |
| `i18n-development` | 国际化、多语言、翻译 | react-i18next 多语言 |

### 4.5 Tauri 平台类

| 技能 | 触发词 | 用途 |
|------|--------|------|
| `tauri-plugins` | 插件、plugin、集成 | 官方插件集成和自定义插件 |
| `tauri-events` | 事件、emit、listen、推送 | 前后端双向事件通信 |
| `tauri-window-management` | 窗口、多窗口、无边框、托盘 | 窗口管理和系统托盘 |
| `tauri-capabilities` | Capabilities、权限配置、作用域 | 高级权限管理 |
| `security-permissions` | 安全、CSP、permission | 安全模型和权限配置 |
| `tauri-updater` | 自动更新、版本更新、OTA | 应用自动更新 |
| `tauri-packaging` | 打包、构建、安装包、签名 | 跨平台打包和分发 |
| `file-storage` | 文件、读写、保存、目录 | 文件系统操作 |
| `notification-system` | 通知、提醒、桌面通知 | 系统原生通知 |
| `utils-toolkit` | 工具函数、crate、日期处理 | Rust/TS 工具函数集 |

### 4.6 质量保障类

| 技能 | 触发词 | 用途 |
|------|--------|------|
| `bug-detective` | Bug、报错、调试、排查 | 问题定位和修复 |
| `test-development` | 测试、单元测试、TDD | Rust 和 React 测试 |
| `performance-doctor` | 性能、优化、慢、体积 | 性能诊断和优化 |

### 4.7 工程化类

| 技能 | 触发词 | 用途 |
|------|--------|------|
| `git-workflow` | Git、分支、提交、版本 | Git 工作流规范 |
| `release-publish` | 发布、release、打 Tag | 版本发布执行 |
| `add-skill` | 添加技能、修改技能 | 扩展技能系统 |
| `collaborating-with-antigravity` | Antigravity、反重力、agy（仅限点名） | 与 Google Antigravity CLI 协同；唯一支持 `--json-schema` 强制结构化，一个入口可调 Gemini / Claude / GPT-OSS 三家模型 |
| `collaborating-with-codex` | Codex、codex协同（仅限点名） | 与 OpenAI Codex CLI 协同 |
| `collaborating-with-gemini` | Gemini、gemini协同（仅限点名） | 与 Google Gemini CLI 协同 |

---

## 五、快捷命令参考

快捷命令以 `/` 开头，是对常见开发场景的一键封装。

| 命令 | 用途 | 适用场景 |
|------|------|---------|
| `/start` | 项目快速了解 | 新接手项目、新打开会话 |
| `/dev` | 全栈功能开发 | 开发完整的新功能 |
| `/command` | 快速创建 Command | 只需添加单个 Tauri Command |
| `/check` | 全栈代码检查 | 提交前代码审查 |
| `/next` | 下一步建议 | 不确定接下来做什么 |
| `/progress` | 项目进度报告 | 了解项目当前状态 |
| `/release` | 版本发布 | 准备发布新版本 |

### 命令使用示例

```
你: /start
→ 输出项目概览报告（技术栈、功能模块、文件统计）

你: /dev
→ 进入交互式全栈开发流程

你: /check
→ 执行 Rust + TypeScript + Tauri 配置全面检查

你: /next
→ 分析项目现状，推荐下一步开发方向

你: /progress
→ 生成项目进度报告（已完成/进行中/待开发）

你: /release
→ 执行版本号更新 → 推送 → 打 Tag → 触发 CI
```

---

## 六、常见开发场景

### 场景 1：添加一个新的 CRUD 功能

**推荐方式**：使用 `/dev` 命令

```
你: /dev
Claude: 你想开发什么功能？
你: 添加一个笔记管理功能，支持创建、编辑、删除、列表展示
```

Claude 会自动生成：

```
后端（Rust）:
  ├── models/mod.rs        → Note struct
  ├── database/schema.rs   → CREATE TABLE notes (迁移)
  ├── database/mod.rs      → CRUD DAO 方法
  ├── services/note.rs     → 业务逻辑
  ├── commands/note.rs     → 4 个 Command
  └── lib.rs               → generate_handler! 注册

前端（React）:
  ├── types/note.ts        → Note interface
  ├── lib/api/note.ts      → noteApi 封装
  ├── pages/notes/index.tsx → 笔记列表页
  ├── Router.tsx            → 添加路由
  └── components/layout/Sidebar.tsx → 添加导航项
```

### 场景 2：集成一个 Tauri 插件

```
你: 我想添加文件选择对话框功能
```

**自动激活技能**：`tauri-plugins`、`tauri-capabilities`

Claude 会完成：
1. `Cargo.toml` 添加 `tauri-plugin-dialog`
2. `package.json` 添加 `@tauri-apps/plugin-dialog`
3. `lib.rs` 注册 `.plugin(tauri_plugin_dialog::init())`
4. `capabilities/default.json` 添加 `"dialog:default"` 权限
5. 前端示例代码

### 场景 3：排查运行时错误

```
你: 调用 set_config 时报错 "database is locked"
```

**自动激活技能**：`bug-detective`、`database-ops`

Claude 会分析：
- 检查 Mutex 加锁模式
- 检查 WAL 模式配置
- 检查是否有长事务阻塞
- 给出修复方案

### 场景 4：优化打包体积

```
你: 安装包太大了，怎么缩小？
```

**自动激活技能**：`performance-doctor`、`tauri-packaging`

Claude 会检查并优化：
- Cargo.toml `[profile.release]` 配置（LTO/strip/opt-level）
- Vite 构建分包策略
- 前端依赖 tree-shaking
- UPX 压缩方案

### 场景 5：多 AI 协同开发

```
你: 用 Codex 帮我分析一下这个算法的复杂度
```

**自动激活技能**：`collaborating-with-codex`

Claude 会将任务委托给 Codex CLI 执行，并整合结果。

```
你: 用 Gemini 帮我设计一个设置页的 UI
```

**自动激活技能**：`collaborating-with-gemini`

Claude 会将该任务委托给 Gemini CLI。

```
你: 用 agy 让三家模型都评一遍这个 Command 的并发安全
```

**自动激活技能**：`collaborating-with-antigravity`

Claude 会用 `agy` 分别调 Gemini 3.1 Pro、Claude Opus 4.6、GPT-OSS 120B 各答一遍再汇总分歧。
需要严格 JSON 结果时可加 `--json-schema`（三个协同技能里只有它支持）。

> **注意**：协同类技能**只在你点名某个 CLI 时才激活**。没点名的"设计几套 UI 原型""帮我审一下代码"
> 不会触发协同，会走 `ui-frontend` / `bug-detective` 等本地技能，或你指定的外部工具。

---

## 七、最佳实践

### 7.1 开发前必做

1. **先读参考代码** — 查看 `src-tauri/src/commands/*.rs` 和 `src/pages/*/index.tsx`
2. **遵循三层架构** — Command → Service → Database，不要跳层
3. **使用 `/start` 了解项目** — 新会话先用此命令
4. **使用 `/check` 提交前检查** — 确保代码质量

### 7.2 后端开发规范

| 规则 | 说明 |
|------|------|
| 永远不要 `unwrap()` | 使用 `Result<T, String>` + `?` 运算符 |
| Command 返回 `Result` | `-> Result<T, String>` |
| SQL 使用参数化查询 | `?1` 占位符，防止注入 |
| Mutex 用 `map_err` | 不要 `lock().unwrap()` |
| 新 Command 必须注册 | 添加到 `generate_handler![]` |

### 7.3 前端开发规范

| 规则 | 说明 |
|------|------|
| UI 优先用 Ant Design | Button/Table/Card/Form/Modal 等 |
| 布局用 TailwindCSS | `className="flex items-center gap-2"` |
| API 统一封装 | 不要裸写 `invoke()`，封装到 `src/lib/api/` |
| 使用 `@/` 别名 | `import { X } from "@/types"` |
| 全局状态用 Zustand | `useAppStore((s) => s.theme)` |
| 错误用 `getErrorMessage` | 不要 `` `错误: ${error}` `` 模板拼接 |

### 7.4 Git 提交规范

```
<type>(<scope>): <description>

# 示例
feat(rust): 添加笔记管理 Command
fix(react): 修复暗色模式背景色不匹配
refactor(rust): 重构配置服务为三层架构
docs: 更新开发指南文档
```

| Type | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 Bug |
| `refactor` | 重构 |
| `docs` | 文档 |
| `style` | 格式化 |
| `test` | 测试 |
| `chore` | 杂务 |
| `build` | 构建 |

### 7.5 技能扩展

框架的技能系统本身可以扩展。当你发现缺少某类技能时：

```
你: 帮我添加一个"拖拽排序"的技能
```

**自动激活技能**：`add-skill`

Claude 会创建技能文件并注册到技能系统中。

---

## 附录

### A. 技术栈速查

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | Tauri | 2.x |
| 后端 | Rust | 2021 edition |
| 前端框架 | React | 19 |
| 类型系统 | TypeScript | 5.8 |
| UI 组件 | Ant Design | 5+ |
| 样式 | TailwindCSS | 4 |
| 状态管理 | Zustand | 5+ |
| 路由 | React Router | 7 |
| 构建 | Vite | 7 |
| 数据库 | rusqlite (SQLite) | 0.31 |
| 错误处理 | thiserror | 2 |

### B. 常用命令

```bash
pnpm tauri dev          # 开发模式
pnpm tauri build        # 生产构建
pnpm build              # 仅构建前端
npx tsc --noEmit        # TypeScript 类型检查
cd src-tauri && cargo check   # Rust 编译检查
cd src-tauri && cargo clippy  # Rust 代码检查
cd src-tauri && cargo test    # Rust 测试
```

### C. 关键文件速查

| 你想做什么 | 查看/修改哪个文件 |
|-----------|-----------------|
| 添加新 Command | `src-tauri/src/commands/` + `lib.rs` |
| 添加数据库表 | `src-tauri/src/database/schema.rs` |
| 添加页面路由 | `src/Router.tsx` |
| 添加侧边栏导航 | `src/components/layout/Sidebar.tsx` |
| 修改窗口配置 | `src-tauri/tauri.conf.json` |
| 添加插件权限 | `src-tauri/capabilities/default.json` |
| 修改全局状态 | `src/store/app.ts` |
| 修改主题配置 | `src/App.tsx` |
| 添加 API 封装 | `src/lib/api/` |
| 定义数据类型 | `src/types/` + `src-tauri/src/models/mod.rs` |
