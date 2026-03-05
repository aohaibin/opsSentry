# 技术栈分析 - Tauri

> 分析时间: 2026-03-05
> 源码路径: D:\desktop\my\framework\ruoyi-plus-uniapp\定制skills\frameworks\tauri

---

## 后端（Rust / Tauri Core）

| 类别 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 语言 | Rust | 2021 edition | 系统级编程语言，内存安全 |
| 桌面框架 | Tauri | 2.x | 轻量桌面应用框架，基于系统 WebView |
| 序列化 | serde | 1.x | Rust 标准序列化/反序列化框架 |
| JSON 处理 | serde_json | 1.x | JSON 序列化/反序列化 |
| 构建工具 | Cargo | 随 Rust 发布 | Rust 包管理器和构建系统 |
| 构建脚本 | tauri-build | 2.x | Tauri 构建辅助 |
| 插件 | tauri-plugin-opener | 2.x | 打开 URL/文件的插件 |

## 前端（React + TypeScript）

| 类别 | 技术 | 版本 | 说明 |
|------|------|------|------|
| 框架 | React | 19.1.0 | UI 框架（最新版本） |
| 语言 | TypeScript | 5.8.3 | 类型安全的 JavaScript 超集 |
| 构建工具 | Vite | 7.0.4 | 下一代前端构建工具 |
| Vite 插件 | @vitejs/plugin-react | 4.6.0 | React Fast Refresh 支持 |
| Tauri API | @tauri-apps/api | 2.x | 前端调用 Tauri 后端的 API |
| Tauri CLI | @tauri-apps/cli | 2.x | Tauri 命令行工具（dev/build） |

## 桌面平台

| 类别 | 技术 | 说明 |
|------|------|------|
| 渲染引擎 | 系统 WebView | Windows: WebView2, macOS: WKWebView, Linux: webkit2gtk |
| 打包格式 | MSI/NSIS (Win), DMG (Mac), DEB/AppImage (Linux) | Tauri 内置打包支持 |
| IPC 机制 | Tauri Commands (`invoke`) | 前端 ↔ Rust 后端通信 |
| 安全模型 | Capabilities + Permissions | Tauri 2.x 新增的细粒度权限控制 |

## 开发工具

| 类别 | 技术 | 说明 |
|------|------|------|
| IDE | VS Code | 推荐 + Tauri 扩展 + rust-analyzer |
| 包管理 | pnpm | 前端依赖管理（tauri.conf.json 中配置） |
| 热重载 | Vite HMR + Cargo Watch | 前端即时刷新，Rust 自动重编译 |
| 调试 | Chrome DevTools + rust-analyzer | 前端 DevTools，后端 Rust 调试器 |

## 中间件/数据库

| 类别 | 技术 | 说明 |
|------|------|------|
| 数据库 | 无（初始模板） | 可通过 tauri-plugin-sql 添加 SQLite/MySQL/PostgreSQL |
| 缓存 | 无 | 可使用内存缓存或本地存储 |
| 消息队列 | 无 | 桌面应用通常不需要 |
| 文件系统 | Tauri FS API | 通过 capabilities 控制访问范围 |

---

## 与源框架技术栈对比

| 维度 | 源框架 (ruoyi-plus-uniapp) | Tauri |
|------|--------------------------|-------|
| **应用类型** | Web + 移动端 | 桌面应用 |
| **后端语言** | Java (Spring Boot) | Rust |
| **前端框架** | Vue 3 | React 19 |
| **UI 库** | Element Plus + WD UI | 无（初始模板） |
| **ORM** | MyBatis-Plus | 无（可选 SQLx/Diesel） |
| **认证** | Sa-Token | 无需（桌面应用本地运行） |
| **部署** | 服务器部署 | 打包为桌面安装程序 |
| **通信** | HTTP REST API | Tauri IPC (invoke) |
| **状态管理** | Pinia | React Hooks (useState/useReducer) |

---

## 关键技术特征

1. **双语言架构**: Rust (系统层) + TypeScript (UI 层)，通过 IPC 桥接
2. **安全优先**: Tauri 2.x 的 Capabilities 系统，细粒度权限控制
3. **轻量打包**: 利用系统 WebView，打包体积仅 3-8 MB
4. **跨平台**: Windows / macOS / Linux 全平台支持
5. **初始模板状态**: 当前仅有基础 greet 示例，框架结构需要扩展
