# 代码规范 - Tauri

> 分析时间: 2026-03-05

---

## Rust 后端规范

| 项目 | 规范 | 示例 |
|------|------|------|
| 文件命名 | snake_case | `lib.rs`, `main.rs`, `database.rs` |
| 函数命名 | snake_case | `fn greet(name: &str)` |
| 结构体命名 | PascalCase | `struct AppState`, `struct UserData` |
| 枚举命名 | PascalCase + PascalCase 变体 | `enum Status { Active, Inactive }` |
| 常量命名 | SCREAMING_SNAKE_CASE | `const MAX_RETRIES: u32 = 3;` |
| Crate 命名 | snake_case (连字符转下划线) | `tauri_lib`, `tauri_plugin_opener` |
| Command 定义 | `#[tauri::command]` 属性宏 | `#[tauri::command] fn greet(name: &str) -> String` |
| Command 注册 | `generate_handler![]` 宏 | `.invoke_handler(tauri::generate_handler![greet])` |
| 错误处理 | `Result<T, E>` 或 `expect()` | `.expect("error while running")` |
| 序列化 | `#[derive(Serialize, Deserialize)]` | serde derive 宏 |
| 插件注册 | `Builder.plugin()` 链式调用 | `.plugin(tauri_plugin_opener::init())` |
| 入口分离 | `main.rs` 调用 `lib.rs::run()` | 支持桌面和移动端双入口 |
| 条件编译 | `cfg_attr` 属性 | `#[cfg_attr(mobile, tauri::mobile_entry_point)]` |
| Windows 控制台 | release 模式隐藏 | `#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]` |

## TypeScript 前端规范

| 项目 | 规范 | 示例 |
|------|------|------|
| 文件命名 | PascalCase (组件) / camelCase (工具) | `App.tsx`, `main.tsx` |
| 组件定义 | 函数组件 (Function Component) | `function App() { ... }` |
| 导出方式 | default export | `export default App;` |
| 样式文件 | CSS (与组件同名) | `App.css` |
| Tauri IPC 调用 | `invoke("commandName", { args })` | `await invoke("greet", { name })` |
| Tauri API 导入 | `from "@tauri-apps/api/core"` | `import { invoke } from "@tauri-apps/api/core"` |
| 插件 API 导入 | `from "@tauri-apps/plugin-*"` | `import { open } from "@tauri-apps/plugin-opener"` |
| 状态管理 | React Hooks | `const [state, setState] = useState("")` |
| 事件处理 | 内联 + 独立函数 | `async function greet() { ... }` |
| 表单处理 | `onSubmit` + `preventDefault` | `<form onSubmit={(e) => { e.preventDefault(); greet(); }}>` |
| 类型断言 | `as` 关键字 | `document.getElementById("root") as HTMLElement` |
| JSX 语法 | `.tsx` 扩展名 | React JSX 语法 |
| 严格模式 | React.StrictMode 包裹 | `<React.StrictMode><App /></React.StrictMode>` |

## TypeScript 编译配置

| 项目 | 值 | 说明 |
|------|-----|------|
| target | ES2020 | 编译目标 |
| module | ESNext | 模块系统 |
| moduleResolution | bundler | Vite bundler 模式 |
| jsx | react-jsx | React 17+ JSX 转换 |
| strict | true | 严格类型检查 |
| noUnusedLocals | true | 禁止未使用的局部变量 |
| noUnusedParameters | true | 禁止未使用的参数 |
| noFallthroughCasesInSwitch | true | Switch 必须有 break |

## Vite 配置规范

| 项目 | 值 | 说明 |
|------|-----|------|
| 开发端口 | 1420 | Tauri 期望的固定端口 |
| strictPort | true | 端口被占用时直接报错 |
| HMR 端口 | 1421 | 热模块替换端口 |
| 忽略监听 | `**/src-tauri/**` | 不监听 Rust 代码变更（由 cargo watch 处理） |

## Tauri 配置规范 (tauri.conf.json)

| 项目 | 值 | 说明 |
|------|-----|------|
| schema | `https://schema.tauri.app/config/2` | Tauri 2.x 配置 schema |
| identifier | `com.agilefr.tauri` | 应用唯一标识（反向域名） |
| beforeDevCommand | `pnpm dev` | 开发前启动前端 |
| devUrl | `http://localhost:1420` | 开发服务器地址 |
| beforeBuildCommand | `pnpm build` | 构建前编译前端 |
| frontendDist | `../dist` | 前端产物目录（相对 src-tauri） |
| CSP | null | 内容安全策略（当前禁用） |
| bundle.targets | "all" | 打包所有平台 |

## Capabilities 权限规范 (Tauri 2.x)

| 项目 | 规范 | 示例 |
|------|------|------|
| 文件位置 | `src-tauri/capabilities/*.json` | `default.json` |
| identifier | 唯一权限组标识 | `"default"` |
| windows | 适用窗口列表 | `["main"]` |
| permissions | 权限声明列表 | `["core:default", "opener:default"]` |
| 权限格式 | `"插件:权限名"` | `"fs:read"`, `"sql:default"` |

## 禁止项

| 禁止 | 正确做法 | 原因 |
|------|---------|------|
| 在前端直接访问文件系统 | 通过 Tauri FS API + Capabilities 声明 | 安全沙箱限制 |
| 不声明权限就使用插件功能 | 在 capabilities JSON 中声明所需权限 | Tauri 2.x 强制权限控制 |
| 在 Rust Command 中 panic | 使用 `Result<T, String>` 返回错误 | panic 会导致应用崩溃 |
| `unwrap()` 用于可能失败的操作 | 使用 `?` 运算符或 `match` | 生产代码中的 unwrap 是隐患 |
| 前端硬编码系统路径 | 使用 Tauri path API (`appDataDir()` 等) | 跨平台路径不同 |
| 使用 `class` 组件 | 使用函数组件 + Hooks | React 19 推荐模式 |
| `any` 类型 | 定义明确的 TypeScript 类型 | TypeScript strict 模式 |
| HTTP 直接请求外部 API | 通过 Rust 后端代理请求 | 安全性和跨域限制 |

## 目录/文件组织惯例

| 维度 | 惯例 | 说明 |
|------|------|------|
| 前端源码 | `src/` | React 组件、样式、资源 |
| Rust 后端 | `src-tauri/src/` | 所有 Rust 代码 |
| Tauri 配置 | `src-tauri/tauri.conf.json` | 核心配置 |
| 权限声明 | `src-tauri/capabilities/` | Capabilities JSON |
| 图标资源 | `src-tauri/icons/` | 各平台各尺寸图标 |
| 静态资源 | `public/` | 不经 Vite 处理的资源 |
| 构建产物 | `src-tauri/target/` | Rust 编译产物（.gitignore） |
| 前端产物 | `dist/` | Vite 打包产物 |
