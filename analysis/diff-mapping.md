# 差异映射表 - Tauri

> 分析时间: 2026-03-05
> **这是定制工作的核心字典，记录源框架到目标框架的所有概念映射。**

---

## ★ 范式差异总览

源框架 (ruoyi-plus-uniapp) 是一个 **Java Web + UniApp 移动端** 的管理后台系统。
目标框架 (Tauri) 是一个 **Rust + React 桌面应用**。

**这是所有已适配框架中与源框架差异最大的一个**，几乎所有概念都需要范式转换。

| 维度 | 源框架 | Tauri | 影响 |
|------|-------|-------|------|
| 应用类型 | B/S 架构 (Browser/Server) | 桌面应用 (单机/双进程) | 完全不同的部署和通信模型 |
| 后端语言 | Java | Rust | 编程范式完全不同 |
| 前端框架 | Vue 3 | React 19 | 组件模型和状态管理不同 |
| 通信方式 | HTTP REST API | Tauri IPC (invoke) | 无网络开销，无需 HTTP 服务器 |
| 数据库 | MySQL (服务端) | SQLite (本地嵌入) 或无 | 从 C/S 到本地存储 |
| 认证 | Sa-Token (服务端 Session/Token) | 无需认证（桌面应用本地运行） | 完全不适用 |
| 部署 | 服务器部署 + CDN | 打包为 .exe/.dmg/.deb 安装程序 | 完全不同 |
| 多用户 | 多租户/多用户 | 单用户桌面 | 不适用 |

---

## 后端差异

| 维度 | 源框架 (ruoyi-plus-uniapp) | Tauri | 适配策略 |
|------|--------------------------|-------|---------|
| **语言** | Java 17+ | Rust 2021 edition | 完全重写，范式不同 |
| **框架** | Spring Boot 3.x | Tauri 2.x | 完全不同的框架模型 |
| **包名/模块** | `plus.ruoyi.*` (Java 包) | `tauri_lib` (Rust crate) | 概念替换：包 → crate/module |
| **Entity 基类** | `TenantEntity extends BaseEntity` | Rust struct + `#[derive(Serialize)]` | 无继承，用 derive 宏 |
| **Service 模式** | 接口 + 实现类 | 独立函数 + `#[tauri::command]` | 无 OOP 接口模式，用函数 |
| **DAO 层** | MyBatis-Plus Mapper | 无独立 DAO（可选 SQLx/Diesel） | 桌面应用通常直接操作 |
| **ORM** | MyBatis-Plus | 无（可选 SQLx, Diesel, SeaORM） | 如需持久化，用 Rust ORM |
| **查询构建** | `PlusLambdaQueryWrapper` | SQLx raw query / Diesel DSL | 完全不同的查询方式 |
| **对象转换** | `MapstructUtils` | serde `#[derive(Serialize, Deserialize)]` | Rust 用 serde 处理 |
| **认证框架** | Sa-Token | 不适用 | 桌面应用无需服务端认证 |
| **主键策略** | 雪花ID (Long) | 自增/UUID（本地数据库） | 本地存储方式不同 |
| **多租户** | TenantEntity + 自动过滤 | 不适用 | 单用户桌面应用 |
| **异常处理** | `throw new ServiceException()` | `Result<T, String>` / `thiserror` | Rust 用 Result 类型 |
| **日志** | SLF4J + Logback | `log` crate + `env_logger` | Rust 日志生态 |
| **逻辑删除** | `is_deleted` 字段 + 自动过滤 | 可选（看是否有数据库） | 桌面应用可直接删除 |
| **日期工具** | `DateUtils.getNowDate()` | `chrono::Local::now()` | Rust chrono crate |
| **配置管理** | `application.yml` | `tauri.conf.json` + Rust config | JSON 配置为主 |
| **依赖注入** | Spring IoC (`@Autowired`) | `tauri::State<T>` 管理状态 | 手动注入 vs 框架注入 |
| **定时任务** | Quartz / xxl-job | 无（可用 tokio 定时器） | 桌面应用场景不同 |
| **缓存** | Redis | 内存缓存 / 本地文件 | 无需分布式缓存 |
| **消息队列** | RabbitMQ / Kafka | 不适用 | 单进程桌面应用 |

## 前端差异

| 维度 | 源框架 | Tauri | 适配策略 |
|------|-------|-------|---------|
| **框架** | Vue 3 (Composition API) | React 19 (Hooks) | 组件模型不同 |
| **UI 组件库** | Element Plus (A* 封装) | 无（初始模板）| 需选定 UI 库 |
| **组件前缀** | `A` (AFormInput, ATable) | 无前缀或库前缀 | 取决于选用的 UI 库 |
| **状态管理** | Pinia stores | React useState/useReducer/Context | React 内置 Hooks |
| **路由** | Vue Router | 无（初始模板，可选 React Router） | SPA 路由 |
| **API 调用** | `[err, data] = await api()` | `await invoke("cmd", { args })` | Tauri IPC 调用 |
| **API 路径风格** | HTTP URL `/pageXxxs` | Tauri Command 名称 `"greet"` | 无 URL，直接函数名 |
| **消息提示** | 项目封装 msg 组件 | 无（可选 react-toastify / antd message） | 取决于 UI 库 |
| **模板语法** | Vue SFC (template/script/style) | JSX/TSX | 根本不同的模板机制 |
| **响应式** | `ref()` / `reactive()` | `useState()` / `useReducer()` | React Hooks 模式 |
| **计算属性** | `computed()` | `useMemo()` | React 对应 API |
| **监听器** | `watch()` / `watchEffect()` | `useEffect()` | React 副作用 Hook |
| **表单绑定** | `v-model` | `value` + `onChange` | 受控组件模式 |
| **条件渲染** | `v-if` / `v-show` | `{condition && <Element>}` / 三元表达式 | JSX 条件渲染 |
| **列表渲染** | `v-for` | `array.map()` | JSX 列表渲染 |
| **样式方案** | Scoped CSS / SCSS | CSS Modules / CSS-in-JS / Tailwind | 多种可选方案 |

## 移动端差异

| 维度 | 源框架 | Tauri | 适配策略 |
|------|-------|-------|---------|
| **移动端方案** | UniApp (Vue2 + uView2) | Tauri Mobile (实验性) | Tauri 2.x 支持移动端但仍早期 |
| **移动端 UI** | WD UI (wd-*) | 不适用（桌面优先） | 当前不考虑移动端 |
| **跨端框架** | UniApp 编译到多端 | 桌面 WebView（跨 Win/Mac/Linux） | 跨桌面平台 |

---

## 通信模式差异（核心差异）

这是 Tauri 与源框架最根本的区别：

### 源框架通信模式（HTTP REST）
```
前端 (Vue3)  ──HTTP Request──►  后端 (Spring Boot)
     │                               │
     │  GET /api/user/list           │  @GetMapping
     │  POST /api/user/add           │  @PostMapping
     │  PUT /api/user/update         │  @PutMapping
     │  DELETE /api/user/123         │  @DeleteMapping
     │                               │
     ◄──HTTP Response (JSON)─────────┘
```

### Tauri 通信模式（IPC invoke）
```
前端 (React)  ──IPC invoke──►  后端 (Rust)
     │                              │
     │  invoke("greet", {name})     │  #[tauri::command]
     │  invoke("save_data", {..})   │  fn save_data(..) -> Result<>
     │  invoke("read_file", {..})   │  fn read_file(..) -> Result<>
     │                              │
     ◄──Return Value (JSON)─────────┘
```

**关键差异**:
- 无 HTTP 开销，直接进程间通信
- 无需定义 REST 路由，直接调用函数名
- 类型安全：Rust 的 serde 自动序列化/反序列化
- 单向注册：Command 在 Rust 侧定义，前端通过 invoke 调用

---

## 安全模型差异

| 维度 | 源框架 | Tauri |
|------|-------|-------|
| **认证** | Token/Session 验证每个请求 | 无需认证（本地应用） |
| **授权** | RBAC 角色权限 | Capabilities 权限声明（限制 API 访问范围） |
| **数据隔离** | 多租户自动过滤 | 单用户，无需隔离 |
| **CSRF/XSS** | 服务端防护 | CSP 策略 + Capabilities 限制 |
| **SQL 注入** | MyBatis 参数化 | 不适用（本地 SQLite 或无 DB） |

---

## 模板变量映射

基于以上差异，确定模板变量的值。

> **注意**: 由于 Tauri (Rust + React) 不属于 Java/Python/UniCloud，大多数后端模板变量**不适用**。
> 使用**非模板路径**，L2 降级为 L3。

### 项目变量

| 变量 | 值 |
|------|-----|
| `{{PROJECT_NAME}}` | `Tauri Desktop App` |
| `{{PROJECT_DESC}}` | `Tauri 2.x + React 19 + TypeScript + Rust 桌面应用` |
| `{{BACKEND_DIR}}` | `src-tauri/src/` |
| `{{FRONTEND_DIR}}` | `src/` |
| `{{MOBILE_DIR}}` | 不适用 |
| `{{MODULE_STRUCTURE}}` | 双进程架构：WebView (前端) + Rust Core (后端) |
| `{{TABLE_PREFIX_RULES}}` | 不适用（无数据库表前缀概念） |
| `{{LAYER_ARCHITECTURE}}` | WebView 层 → IPC 桥接层 → Rust Core 层 → Plugin 层 |
| `{{REF_CODE_BACKEND}}` | `src-tauri/src/lib.rs` |
| `{{REF_CODE_FRONTEND}}` | `src/App.tsx` |
| `{{REF_CODE_MOBILE}}` | 不适用 |

### 后端变量（Rust 适配）

| 变量 | 值 | 说明 |
|------|-----|------|
| `{{PACKAGE_BASE}}` | `tauri_lib` (crate name) | Rust 无包名概念，用 crate 名 |
| `{{ENTITY_BASE_CLASS}}` | `#[derive(Serialize, Deserialize)]` struct | Rust 用 derive 宏 |
| `{{SERVICE_PATTERN}}` | `#[tauri::command] fn name() -> Result<T, String>` | Rust 函数即服务 |
| `{{HAS_DAO_LAYER}}` | `false` | 初始模板无数据库层 |
| `{{ORM_FRAMEWORK}}` | 无（可选 SQLx/Diesel/SeaORM） | 按需添加 |
| `{{AUTH_FRAMEWORK}}` | 不适用 | 桌面应用无需服务端认证 |
| `{{QUERY_BUILDER}}` | 不适用 | 无 ORM 即无查询构建器 |
| `{{OBJECT_CONVERTER}}` | `serde` (Serialize/Deserialize) | Rust 标准序列化 |
| `{{ID_STRATEGY}}` | 不适用 | 无数据库即无主键 |
| `{{MULTI_TENANT}}` | 不适用 | 桌面单用户 |
| `{{SOFT_DELETE_FIELD}}` | 不适用 | 无数据库即无逻辑删除 |
| `{{DATE_UTIL}}` | `chrono::Local::now()` | Rust chrono crate |
| `{{EXCEPTION_CLASS}}` | `Result<T, String>` 或 `thiserror::Error` | Rust 错误处理 |

### 前端变量

| 变量 | 值 | 说明 |
|------|-----|------|
| `{{PC_UI_FRAMEWORK}}` | 无（初始模板） | 可选 Ant Design / MUI / Shadcn |
| `{{PC_COMPONENT_PREFIX}}` | 无 | 取决于 UI 库选择 |
| `{{MOBILE_UI_FRAMEWORK}}` | 不适用 | 桌面应用 |
| `{{STATE_MANAGEMENT}}` | React Hooks (useState/useReducer) | React 内置 |
| `{{API_CALL_PATTERN}}` | `await invoke("cmd", { args })` | Tauri IPC |
| `{{API_PATH_STYLE}}` | Tauri Command 函数名 (snake_case) | 如 `"greet"`, `"save_data"` |
| `{{MSG_COMPONENT}}` | 无（待选定 UI 库） | 取决于 UI 库 |
| `{{MOBILE_IMPORT}}` | 不适用 | 桌面应用 |

### Tauri 专属变量（新增）

| 变量 | 值 | 说明 |
|------|-----|------|
| `{{TAURI_VERSION}}` | `2.x` | Tauri 主版本 |
| `{{TAURI_CONF_PATH}}` | `src-tauri/tauri.conf.json` | 核心配置路径 |
| `{{CAPABILITIES_DIR}}` | `src-tauri/capabilities/` | 权限声明目录 |
| `{{APP_IDENTIFIER}}` | `com.agilefr.tauri` | 应用唯一标识 |
| `{{RUST_ENTRY}}` | `src-tauri/src/lib.rs` | Rust 入口文件 |
| `{{FRONTEND_ENTRY}}` | `src/main.tsx` | 前端入口文件 |
| `{{DEV_URL}}` | `http://localhost:1420` | 开发服务器地址 |
| `{{DEV_COMMAND}}` | `pnpm dev` | 开发启动命令 |
| `{{BUILD_COMMAND}}` | `pnpm build` | 构建命令 |
| `{{IPC_PATTERN}}` | `invoke("command_name", { args })` | IPC 调用模式 |
| `{{COMMAND_MACRO}}` | `#[tauri::command]` | Rust 命令宏 |
| `{{STATE_INJECT}}` | `tauri::State<T>` | Rust 状态注入 |
| `{{PLUGIN_REGISTER}}` | `.plugin(plugin_name::init())` | 插件注册模式 |

---

## 技能复用评估

### L1 直接复用（~8 个）
完全通用，与框架无关：

1. `brainstorm` - 头脑风暴
2. `task-tracker` - 任务跟踪
3. `git-workflow` - Git 工作流
4. `tech-decision` - 技术选型
5. `bug-detective` - Bug 排查
6. `code-patterns` - 编码规范
7. `collaborating-with-codex` - Codex 协作
8. `collaborating-with-gemini` - Gemini 协作

### L2 降级为 L3（原模板适配 → 深度定制）
由于 Rust + React 无现成模板，以下技能需参考骨架重写：

9. `project-navigator` - 项目导航（Tauri 双进程结构）
10. `error-handler` - 异常处理（Rust Result + React ErrorBoundary）
11. `performance-doctor` - 性能诊断（Rust 编译优化 + 前端 Profiling）
12. `json-serialization` - JSON 处理（serde 生态）
13. `test-development` - 测试开发（Rust tests + React Testing Library）

### L3 深度定制（~10 个）
保留骨架，重写内容：

14. `ui-frontend` - React 组件开发（选定 UI 库后）
15. `store-management` - 状态管理（React Hooks + Context/Zustand）
16. `architecture-design` - 架构设计（Tauri 双进程架构）
17. `file-storage` - 文件操作（Tauri FS API + Rust std::fs）
18. `security-permissions` - 安全权限（Capabilities 配置）
19. `database-ops` - 数据库操作（SQLite via tauri-plugin-sql / SQLx）
20. `api-development` - Command 开发（Rust → 前端 IPC）
21. `i18n-development` - 国际化（react-i18next）
22. `notification-system` - 系统通知（tauri-plugin-notification）
23. `utils-toolkit` - 工具类（Rust crates + TS 工具函数）

### L4 框架专属（~8 个）
Tauri 独有特性，完全新写：

24. `tauri-commands` - Tauri Command 开发（IPC 通信核心）
25. `tauri-plugins` - 插件开发与集成
26. `tauri-window-management` - 窗口管理（多窗口/无边框/系统托盘）
27. `tauri-capabilities` - 权限与安全配置
28. `tauri-packaging` - 打包与分发（跨平台安装包）
29. `rust-fundamentals` - Rust 基础（所有权/借用/生命周期/并发）
30. `tauri-events` - 事件系统（前后端双向事件）
31. `tauri-updater` - 应用自动更新

### 总计：~31 个技能

| 类别 | 数量 | 工作量 |
|------|------|--------|
| L1 直接复用 | 8 | 极低 |
| L3 深度定制（含降级 L2） | 15 | 较高 |
| L4 框架专属 | 8 | 高 |
| **合计** | **31** | |

---

## 命令规划

| # | 命令 | 说明 | 对应源框架 |
|---|------|------|-----------|
| 1 | `/dev` | 开发新功能（Rust Command + React UI） | 同名 |
| 2 | `/command` | 快速创建 Tauri Command（类似 CRUD） | `/crud` 的变体 |
| 3 | `/check` | 代码规范检查（Rust clippy + TS lint） | 同名 |
| 4 | `/progress` | 项目进度报告 | 同名 |
| 5 | `/next` | 下一步建议 | 同名 |
| 6 | `/start` | 项目快速启动（dev 环境） | 同名 |

---

## 关键注意事项

1. **不要强加 Web 概念到桌面应用**：无需 HTTP 路由、REST API、多租户、服务端认证
2. **Rust 所有权模型**：这是 Tauri 开发的最大学习曲线，技能中必须体现
3. **Capabilities 安全**：Tauri 2.x 的核心安全机制，每个插件/API 都需要声明权限
4. **双进程思维**：前端和后端在不同进程中运行，通过 IPC 通信
5. **初始模板状态**：项目目前只有基础 greet 示例，技能应覆盖从零扩展的场景
