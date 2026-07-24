---
name: env-isolation
description: |
  Tauri 开发/生产环境数据隔离技能，指导如何让 dev 模式与 prod 模式使用互不干扰的本地数据、日志级别和窗口标题。

  触发场景：
  - 开发调试时不想污染生产环境的真实数据（DB/配置/锁文件）
  - 需要区分 dev / prod 的日志详细程度
  - 需要在窗口标题标识当前运行的是开发版还是正式版
  - 需要为新 Tauri 项目规划环境隔离策略

  触发词：环境隔离、dev/prod、开发环境、生产环境、debug_assertions、数据隔离、dev-app.db、窗口标题、[DEV]、日志级别
---

# Tauri 开发/生产环境数据隔离

## 两层隔离策略

Tauri 的 `app_data_dir()` 由 `identifier` 决定。本框架用**两层**做 dev/prod 隔离：

| 层 | 手段 | 作用 |
|----|------|------|
| **① 构建期身份 overlay** | `src-tauri/tauri.conf.dev.json`（仅 `tauri dev` 经 `--config` 加载）给 dev 一个 `.dev` 后缀 identifier | dev 与正式装的应用**目录/单例锁天然分离**，可同机各开一个 |
| **② 运行期文件名前缀** | `cfg!(debug_assertions)` 下 DB 用 `dev-app.db`、日志降级、标题加 `[DEV]` | 兜底：即使身份没分流（`tauri:dev:prod-id`），也不污染正式 `app.db` |

> 腰带 + 背带：第 ① 层把整个数据目录分开；第 ② 层在同目录场景下再按文件名兜底。

### 关于 identifier：发布物不分流，dev 运行态可分流

| 方案 | 结论 |
|------|------|
| **发布产物**（`tauri build`）dev/prod 用不同 identifier | ❌ 禁止——打包/签名/卸载/注册表不一致、卸载残留 |
| dev 运行态经 `tauri.conf.dev.json` overlay 分流 identifier（**仅** `tauri dev` 加载） | ✅ 推荐——`tauri build` 走主配置发布身份干净；dev 与正式版可同机共存 |

关键：反对的是"**发布产物**分流 identifier"。只在 `tauri dev` 用 overlay 分流是安全的——`tauri build` 根本不加载 `tauri.conf.dev.json`。

---

## 第 ① 层：构建期身份 overlay（identifier / 包名 / 标题）

`src-tauri/tauri.conf.dev.json` —— dev 专属覆盖配置，只覆盖要变的字段，其余继承主配置：

```jsonc
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Agile Tauri (Dev)",
  "identifier": "com.agilefr.tauri.dev"
}
```

`package.json` 脚本分流：

```jsonc
"tauri:dev":         "tauri dev --config src-tauri/tauri.conf.dev.json",  // dev 身份
"tauri:dev:prod-id": "tauri dev"                                          // prod 身份调试（靠第 ② 层兜底）
```

**要点**：
- **不写 `app.windows` 块** —— 窗口标题交给第 ② 层运行期的 `[DEV]` 追加即可，省掉窗口对象全量重复（Tauri 合并时数组是整体替换、非逐字段合并；写了就得把 width/height 等全抄一遍，还易与主配置漂移）。
- **默认装 `tauri-plugin-single-instance`**（首个注册的插件）：锁键 = identifier，dev(`.dev`)/prod 各占一个锁 → **可同机各开一个**；重复启动唤回已有窗口。确需多开的项目再自行移除。
- 子项目由 `project-init` 创建时，`tauri.conf.dev.json` 里的 `com.agilefr.tauri.dev` **必须**换成 `{新标识符}.dev`，否则所有子项目 dev 实例撞同一目录/锁（详见 `project-init` 技能的"dev 身份分流约定"）。

---

## 第 ② 层：运行期三处隔离（文件名 / 日志 / 标题）

### 1. 数据库文件名（必做）

```rust
// src-tauri/src/lib.rs 的 .setup()
let db_filename = if cfg!(debug_assertions) {
    "dev-app.db"   // 开发模式
} else {
    "app.db"       // 生产模式
};
let db_path = data_dir.join(db_filename);
```

**效果**：
- dev：`%APPDATA%/com.agilefr.tauri/dev-app.db`
- prod：`%APPDATA%/com.agilefr.tauri/app.db`

两份 DB 各有独立的 schema_version、各自的表数据，互不覆盖。

### 2. 日志级别（推荐）

```rust
.plugin(
    tauri_plugin_log::Builder::default()
        .level(if cfg!(debug_assertions) {
            log::LevelFilter::Info   // 开发：详细日志
        } else {
            log::LevelFilter::Warn   // 生产：只记警告及错误
        })
        .build(),
)
```

**效果**：生产版用户日志文件不会被海量 Info 日志刷爆。

### 3. 窗口标题前缀（推荐）

```rust
#[cfg(debug_assertions)]
if let Some(window) = app.get_webview_window("main") {
    if let Ok(current_title) = window.title() {
        let _ = window.set_title(&format!("{} [DEV]", current_title));
    }
}
```

**效果**：
- dev：`Agile Tauri [DEV]`
- prod：`Agile Tauri`（沿用 `tauri.conf.json` 的值）

> 肉眼一眼看出当前跑的是哪个版本，避免误把 dev 当正式版给别人演示。

---

## 扩展：多开实例 × 环境（进阶）

如果后续要做**多开实例**（同一台机器同时跑多个实例），要让 `实例 ID` 与 `环境` 两个维度正交：

```rust
// 锁文件前缀同样加上 dev-，避免开发实例 1 占用了生产实例 1 的锁
let lock_prefix = if cfg!(debug_assertions) { "dev-" } else { "" };
let lock_file = data_dir.join(format!("{}instance-{}.lock", lock_prefix, instance_id));

// 数据库按实例目录路由
let db_dir = if let Some(id) = instance_id {
    data_dir.join(format!("instance-{}", id))
} else {
    data_dir.clone()
};
```

这样 `dev-1`、`dev-2`、`1`、`2` 四个实例完全独立。

> 参考实现：`tauri-cc` 项目的 `src-tauri/src/lib.rs`（自研 `acquire_instance_lock` 文件锁体系）。
> 注意：需要多开的项目用这套方案**替代** `tauri-plugin-single-instance`（两者互斥，别同时用）。

---

## 哪些数据不做隔离？

**共享的**（刻意设计，不要隔离）：
- 操作系统级凭证（如 `~/.claude`、`~/.codex` 这类 CLI 工具配置） — 让 dev 调试也能复用用户已有登录态
- `tauri-plugin-store` 的默认 store 文件（会和生产共用）— 如果这会造成污染，需要在 store 路径上也加 `dev-` 前缀

**必须隔离的**（本技能范围）：
- 应用自有 SQLite 数据库
- 应用自有锁文件、缓存文件
- 日志级别和输出量
- 窗口标题（非数据，但是避免误操作的关键）

---

## 检查清单

实现环境隔离时对照：

- [ ] 有 `src-tauri/tauri.conf.dev.json`（dev identifier = 主标识符 + `.dev`）？
- [ ] `package.json` 的 `tauri:dev` 挂了 `--config src-tauri/tauri.conf.dev.json`？
- [ ] 装了 `tauri-plugin-single-instance` 且为首个注册插件（除非项目要多开）？
- [ ] DB 文件名加了 `dev-` 前缀？
- [ ] 日志级别按 `cfg!(debug_assertions)` 切换？
- [ ] 窗口标题在 dev 下加了 `[DEV]` 标识？
- [ ] 若使用 `tauri-plugin-store` 且会写敏感数据，store 文件名也已隔离？
- [ ] 多实例锁文件（如有）前缀与 DB 同步？

---

## 常见错误

| 错误做法 | 正确做法 |
|---------|---------|
| 给**发布产物**（`tauri build`）分流 identifier | 只在 `tauri.conf.dev.json`（仅 `tauri dev` 加载）分流 dev identifier；发布走主配置 |
| 只隔离 DB、忘了锁文件 | 所有"同名互斥资源"都要加前缀 |
| 窗口标题写死在 conf.json 后又在 setup 里 `set_title` 覆盖 | 正确：prod 沿用 conf.json，dev 读当前 title 拼接 `[DEV]` |
| 生产日志级别留 `Info` | 生产应至少是 `Warn`，减少日志文件增长速度 |
| 把 dev/prod 判断散落在各 Service 中 | 集中在 `lib.rs::setup()` 里决定路径，下游 Service 只拿最终路径 |
