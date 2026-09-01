---
name: admin-backend-client
description: |
  当桌面应用需要对接远程后台管理系统（若依 RuoYi-Plus / Sa-Token 类 Java 后台）时自动使用此 Skill。

  触发场景：
  - 需要让 Tauri 桌面端登录远程后台并维持会话（Token / 租户 / 401 过期）
  - 需要解包后端统一响应 R<T> 与分页 TableDataInfo 并对接 Ant Design Table
  - 需要实现按钮级权限（permissions）与数据字典（dict）本地缓存
  - 需要在 Rust 侧发起带鉴权头的 HTTP 请求（而非前端 fetch）
  - 需要设计"远程为主 / 本地为辅"的数据源形态与离线降级

  触发词：后台管理、admin后台、若依、RuoYi、Sa-Token、远程后端、接口对接、Token鉴权、多租户、字典缓存、按钮权限、分页对接、TableDataInfo、baseUrl
---

# 后台管理系统对接（桌面端作客户端）

## 概述

本框架默认形态是**本地优先**：数据存本机 SQLite，前端通过 IPC 调 Rust，全程不联网。
但相当一部分衍生项目需要接一个**已存在的远程后台管理系统**（典型是若依 RuoYi-Vue-Plus 系：
Spring Boot + Sa-Token + MyBatis-Plus，配套一个 Vue3 管理端）。

这时桌面端的角色从"独立应用"变成"后台管理系统的桌面客户端"，会同时冲击框架的四条既有约定：
数据源不再是本地 SQLite、错误不再只来自本地、状态多出服务端派生态（登录态/权限/字典）、
安全边界从 Capabilities 扩展到 Token 与传输加密。

本技能给出这条路线的**完整落地骨架**：Rust 侧 HTTP 客户端分层、统一响应解包、认证与 401 处理、
权限与字典、分页适配、上传下载、离线降级。附录给出若依 RuoYi-Plus 的接口速查与加密实现要点。

> 本技能是**文档 + 可复制代码**，框架模板**不预置** `reqwest` 依赖 —— 不对接后台的项目不该背上
> 约 2–3 MB 体积与冷编译时长。用到时按第四节自行加依赖。

---

## 一、边界：本技能 vs 相邻技能

对接后台管理牵扯面广，务必先分清该看哪个技能，避免重复实现：

| 技能 | 它管的 | 本技能管的 |
|------|--------|-----------|
| `api-development` / `tauri-commands` | **IPC 层**：前端 invoke ↔ Rust Command | Rust Command **再往外**发 HTTP 到远程后台 |
| `remote-gateway` | 桌面端**当服务端**（axum 对外暴露给手机） | 桌面端**当客户端**（连远程后台）——方向相反 |
| `database-ops` | 本地 SQLite 作唯一数据源 | 本地 SQLite 降级为**缓存 / 离线队列** |
| `store-management` | Zustand 管 UI 状态 | Zustand 管**服务端派生态**（登录/权限/字典） |
| `security-permissions` | Tauri **Capabilities**（进程能力边界） | 后端 **RBAC**（Sa-Token 的角色/权限标识）——两套东西，别混 |
| `error-handler` | `AppError` / `CommandError` 本地错误 | 在其上**扩展远程业务错误**（见 5.3） |
| `file-storage` | 本地文件读写与对话框 | 文件**上传到远程 OSS / 从远程下载** |

**一句话判据**：数据来自本机 → 走 `database-ops`；数据来自远程 HTTP 后台 → 走本技能。

---

## 二、第一步永远是选型：三种数据源形态

对接前必须先和用户确认属于哪种，**它决定 SQLite 的角色**，选错后期返工代价极大：

```
桌面端的数据从哪来？
├─ 全部来自远程后台，离线就用不了
│   └─ 形态 A：纯客户端
│       SQLite 只存"本机偏好"（主题/窗口/上次登录账号）
│       业务数据一律实时拉取，不落盘
│
├─ 本机产生为主，偶尔同步到后台
│   └─ 形态 B：本地优先 + 云同步
│       SQLite 是权威数据源，后台是备份/协作通道
│       重点在冲突解决与同步游标，不在本技能（见 database-ops）
│
└─ 远程为主，但断网要能看能填
    └─ 形态 C：远程 + 本地缓存（最常见，也最贵）
        SQLite 存只读缓存（字典/列表快照）+ 写操作离线队列
        必须实现第九节的重放与冲突处理
```

| 形态 | SQLite 角色 | 离线可用 | 复杂度 | 适合 |
|------|------------|---------|--------|------|
| A 纯客户端 | 仅本机偏好 | 否 | 低 | 内网办公端、管理后台桌面壳 |
| B 本地优先 + 云同步 | 权威数据源 | 是 | 中 | 创作类、工具类 |
| C 远程 + 缓存 | 缓存 + 离线队列 | 部分 | 高 | 外勤、门店、弱网场景 |

> **默认建议形态 A**。C 的成本经常被低估：离线写队列一旦上线，重放顺序、幂等、
> 冲突提示、脏数据回滚全都要处理。除非用户明确提出断网诉求，否则先做 A，把 C 留到二期。

---

## 三、铁律：HTTP 一律在 Rust 侧发

**前端不得出现 `fetch` / `axios` 直连后台**（这也是 CLAUDE.md 的既有禁令）。

| 维度 | 前端直连（❌） | Rust 侧 reqwest（✅） |
|------|--------------|---------------------|
| Token 存放 | localStorage，任何注入脚本可读 | Rust 进程内存 + 加密落盘，WebView 拿不到 |
| 请求加密密钥 | AES/RSA 逻辑暴露在可读的 JS 里 | 编译进二进制 |
| CSP | 必须放开 `connect-src` 到后端域名 | CSP 保持收紧 |
| CORS | 后端得为桌面端额外放行 | 无 CORS 概念，不用改后端 |
| 重试 / 缓存 / 离线队列 | 每个页面各写各的 | 客户端层统一实现 |
| 上传大文件 | WebView 内存压力 + 进度难控 | 流式 multipart + 事件回报进度 |

**唯一例外**：纯展示型的第三方公开资源（如后端返回的图片直链）可由 `<img src>` 直接加载，
不算业务请求 —— 但只要带鉴权头，就必须回到 Rust 侧。

---

## 四、依赖与目录骨架

### 4.1 Cargo.toml 增补

```toml
# ─── 后台管理对接（admin-backend-client 技能） ─────────────
# rustls 而非 openssl：避免 Windows/交叉编译时的 openssl 依赖地狱
reqwest = { version = "0.12", default-features = false, features = [
  "json",          # .json() 解析
  "multipart",     # 文件上传
  "rustls-tls",    # 纯 Rust TLS
  "gzip",          # 后端普遍开 gzip
] }
tokio = { version = "1", features = ["full"] }   # 框架已有则复用，勿重复添加
```

> `tokio` 框架里已因 `remote-gateway` 引入，**不要重复添加**，先看 Cargo.toml 现状。

### 4.2 目录结构

```
src-tauri/src/
├── services/
│   └── admin/                    # ★ 新增：远程后台客户端
│       ├── mod.rs                # 模块入口 + AdminClient 定义
│       ├── config.rs             # baseUrl / 租户 / 超时等运行时配置
│       ├── response.rs           # R<T> / TableDataInfo 解包
│       ├── auth.rs               # 登录 / 登出 / Token / 401 处理
│       ├── dict.rs               # 字典拉取 + SQLite 缓存
│       └── upload.rs             # multipart 上传 / 下载
├── commands/
│   └── admin.rs                  # ★ 新增：透传 Command + 认证 Command
└── database/
    └── mod.rs                    # 增补 dict 缓存表 / outbox 表的 DAO

src/
├── lib/api/
│   └── admin/                    # ★ 新增：与后台管理端对齐的 API 层
│       ├── client.ts             # adminGet/adminPost/... 透传封装
│       ├── auth.ts               # 登录 / 用户信息
│       ├── system.ts             # 用户 / 角色 / 菜单等系统模块
│       └── index.ts              # Re-export Hub
├── store/
│   ├── auth.ts                   # ★ 登录态 + 用户信息 + permissions
│   └── dict.ts                   # ★ 字典缓存（内存层）
└── hooks/
    ├── usePermission.ts          # ★ 按钮级权限
    └── useDict.ts                # ★ 字典 Hook
```

---

## 五、Rust 侧实现

### 5.1 AdminClient 与 AppState 接入

```rust
// src-tauri/src/services/admin/mod.rs
pub mod auth;
pub mod config;
pub mod dict;
pub mod response;
pub mod upload;

use std::sync::Arc;
use tokio::sync::RwLock;

use crate::error::AppError;
use config::AdminConfig;

/// 一次登录会话（只存在于 Rust 侧，永不下发给 WebView）
#[derive(Debug, Clone)]
pub struct AuthSession {
    /// Sa-Token 的 access token（裸值，不带 Bearer 前缀）
    pub token: String,
    /// 绝对过期时间戳（毫秒）。后端只给相对秒数时在登录处换算
    pub expire_at_ms: i64,
    /// 可选：部分后端提供刷新令牌，没有则为 None（Sa-Token 默认无）
    pub refresh_token: Option<String>,
}

/// 远程后台客户端：全局单例，通过 AppState 注入 Command
pub struct AdminClient {
    http: reqwest::Client,
    pub config: RwLock<AdminConfig>,
    session: Arc<RwLock<Option<AuthSession>>>,
    /// 刷新/重登的单飞锁：避免 N 个并发请求同时触发 N 次重登
    refresh_lock: tokio::sync::Mutex<()>,
}

impl AdminClient {
    pub fn new(config: AdminConfig) -> Result<Self, AppError> {
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(config.timeout_secs))
            // 桌面端常见于内网自签证书场景，是否放开由配置决定，默认不放开
            .danger_accept_invalid_certs(config.accept_invalid_certs)
            .build()
            .map_err(|e| AppError::Custom(format!("HTTP 客户端初始化失败: {e}")))?;

        Ok(Self {
            http,
            config: RwLock::new(config),
            session: Arc::new(RwLock::new(None)),
            refresh_lock: tokio::sync::Mutex::new(()),
        })
    }

    pub async fn current_token(&self) -> Option<String> {
        self.session.read().await.as_ref().map(|s| s.token.clone())
    }

    pub async fn set_session(&self, session: Option<AuthSession>) {
        *self.session.write().await = session;
    }

    pub async fn is_logged_in(&self) -> bool {
        self.session.read().await.is_some()
    }
}
```

```rust
// src-tauri/src/state.rs —— 在既有 AppState 上增补一个字段
use crate::database::Database;
use crate::services::admin::AdminClient;

pub struct AppState {
    pub db: Database,
    /// 远程后台客户端（未对接后台的项目可不加此字段）
    pub admin: AdminClient,
}

impl AppState {
    pub fn new(db: Database, admin: AdminClient) -> Self {
        Self { db, admin }
    }
}
```

### 5.2 统一响应解包（最容易踩的坑）

后端有**两种**响应形态，桌面端必须都兼容：

```jsonc
// 形态一：普通接口 R<T>，业务数据在 data 里
{ "code": 200, "msg": "操作成功", "data": { "userId": 1 } }

// 形态二：分页接口 TableDataInfo，rows/total 可能在顶层，也可能被包进 data
{ "code": 200, "msg": "查询成功", "rows": [], "total": 0 }
{ "code": 200, "msg": "查询成功", "data": { "rows": [], "total": 0 } }
```

> 🔴 **对接前先用一次真实请求确认你的后端是哪种**。若依原版分页在顶层，
> 但很多改造版（含参考项目 `plus-ui`）统一收进了 `data`。写死一种必翻车。

```rust
// src-tauri/src/services/admin/response.rs
use serde_json::Value;
use crate::error::AppError;

/// 后端约定的状态码（与 plus-ui useHttp.ts 的 HttpCode 对齐）
pub const CODE_SUCCESS: i64 = 200;
pub const CODE_UNAUTHORIZED: i64 = 401;
pub const CODE_SERVER_ERROR: i64 = 500;
/// 601 是若依系特有的"业务警告"：请求成功但业务不通过，UI 应以 warning 呈现
pub const CODE_WARN: i64 = 601;

/// 解包后端响应体：成功返回业务数据，失败转成 AppError
///
/// 为什么返回 Value 而不是泛型 T：
/// 通用透传 Command 在编译期不知道具体类型，类型收敛交给 TypeScript 侧完成。
/// 需要 Rust 侧强类型时（缓存/离线队列），再对返回的 Value 做 serde_json::from_value。
pub fn unwrap_body(body: Value) -> Result<Value, AppError> {
    // 没有 code 字段：非包装响应（如直接返回数组、或网关直出），原样放行
    let Some(code) = body.get("code").and_then(Value::as_i64) else {
        return Ok(body);
    };

    let msg = body
        .get("msg")
        .and_then(Value::as_str)
        .unwrap_or("未知错误")
        .to_string();

    match code {
        CODE_SUCCESS => Ok(extract_payload(body)),
        CODE_UNAUTHORIZED => Err(AppError::Unauthorized(msg)),
        // 500 与 601 都是业务侧失败，靠 code 让前端区分 error / warning 呈现
        _ => Err(AppError::Business { code, message: msg }),
    }
}

/// 抽出业务负载：优先 data；顶层直挂 rows/total 的分页形态则回传整个对象
fn extract_payload(body: Value) -> Value {
    if body.get("rows").is_some() && body.get("data").is_none() {
        // 顶层分页：剥掉 code/msg，只留 rows/total，前端拿到的结构与另一形态一致
        let mut page = serde_json::Map::new();
        if let Some(rows) = body.get("rows") {
            page.insert("rows".into(), rows.clone());
        }
        page.insert(
            "total".into(),
            body.get("total").cloned().unwrap_or(Value::from(0)),
        );
        return Value::Object(page);
    }
    body.get("data").cloned().unwrap_or(Value::Null)
}
```

对需要 Rust 侧强类型的场景（缓存、离线队列），配一组类型定义：

```rust
// src-tauri/src/models/admin.rs
use serde::{Deserialize, Serialize};

/// 分页结果（与后端 TableDataInfo 对齐）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PageResult<T> {
    pub total: i64,
    #[serde(default = "Vec::new")]
    pub rows: Vec<T>,
}

/// 分页查询参数（与后端 PageQuery 对齐，注意是 camelCase）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageQuery {
    pub page_num: u32,
    pub page_size: u32,
    /// 排序字段名（后端要求的是数据库列名或实体字段名，不是前端 dataIndex）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order_by_column: Option<String>,
    /// "asc" | "desc"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_asc: Option<String>,
}
```

### 5.3 扩展错误类型

在框架既有 `AppError` 上加三个变体，并补齐 `CommandError` 的 code 映射：

```rust
// src-tauri/src/error.rs —— 在既有 enum 上增补
#[derive(Debug, Error)]
pub enum AppError {
    // ... 保留既有变体 ...

    #[error("网络请求失败: {0}")]
    Http(#[from] reqwest::Error),

    #[error("登录已失效: {0}")]
    Unauthorized(String),

    /// 后端返回的业务错误（code 非 200），保留原始 code 供前端分流
    #[error("{message}")]
    Business { code: i64, message: String },
}

impl From<AppError> for CommandError {
    fn from(err: AppError) -> Self {
        let code = match &err {
            // ... 保留既有映射 ...
            AppError::Http(_) => "NETWORK_ERROR",
            AppError::Unauthorized(_) => "UNAUTHORIZED",
            // 业务错误把后端 code 带出去：前端可判 "BIZ_601" 做 warning 呈现
            AppError::Business { code, .. } => return CommandError {
                code: format!("BIZ_{code}"),
                message: err.to_string(),
            },
        };
        CommandError { code: code.to_string(), message: err.to_string() }
    }
}
```

前端即可按 code 分流（沿用框架既有的 `getErrorCode`）：

```typescript
import { getErrorCode, getErrorMessage } from "@/lib/api";

try {
  await adminApi.system.updateUser(payload);
} catch (e) {
  const code = getErrorCode(e);
  if (code === "UNAUTHORIZED") return void useAuthStore.getState().handleExpired();
  if (code === "BIZ_601") return void message.warning(getErrorMessage(e)); // 业务警告
  message.error(getErrorMessage(e));
}
```

### 5.4 核心请求方法（鉴权头 + 401 单飞处理）

```rust
// src-tauri/src/services/admin/mod.rs（续）
use reqwest::Method;
use serde_json::Value;
use super::response::unwrap_body;

/// 一次请求的描述（由 Command 层从前端参数构造）
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestSpec {
    /// 相对后端 baseUrl 的路径，如 "/system/user/list"
    pub url: String,
    /// GET / POST / PUT / DELETE，大小写不敏感
    pub method: String,
    /// query 参数
    #[serde(default)]
    pub params: Option<Value>,
    /// 请求体
    #[serde(default)]
    pub data: Option<Value>,
    /// 是否附带鉴权头，默认 true（登录/验证码类接口传 false）
    #[serde(default = "default_true")]
    pub auth: bool,
}

fn default_true() -> bool { true }

impl AdminClient {
    pub async fn request(&self, spec: RequestSpec) -> Result<Value, AppError> {
        match self.send_once(&spec).await {
            // 401 且这次带了鉴权头 → 尝试续期一次再重放，仍失败则上抛
            Err(AppError::Unauthorized(msg)) if spec.auth => {
                if self.try_renew().await? {
                    self.send_once(&spec).await
                } else {
                    Err(AppError::Unauthorized(msg))
                }
            }
            other => other,
        }
    }

    async fn send_once(&self, spec: &RequestSpec) -> Result<Value, AppError> {
        let cfg = self.config.read().await.clone();
        let method = Method::from_bytes(spec.method.to_uppercase().as_bytes())
            .map_err(|_| AppError::InvalidInput(format!("非法 HTTP 方法: {}", spec.method)))?;

        let mut req = self
            .http
            .request(method, format!("{}{}", cfg.base_url, spec.url))
            // 多语言：后端按此头返回国际化文案
            .header("Content-Language", &cfg.language);

        // 多租户：后端开启租户模式时必传，否则查不到数据且不报错（最难排查的坑之一）
        if let Some(tenant_id) = &cfg.tenant_id {
            req = req.header("X-Tenant-Id", tenant_id);
        }

        if spec.auth {
            if let Some(token) = self.current_token().await {
                req = req.header("Authorization", format!("Bearer {token}"));
            }
        }

        if let Some(params) = &spec.params {
            req = req.query(params);
        }
        if let Some(data) = &spec.data {
            req = req.json(data);
        }

        let resp = req.send().await?;
        let status = resp.status();
        let body: Value = resp.json().await.unwrap_or(Value::Null);

        // HTTP 层 401（Sa-Token 过滤器直接拦截时会走这里，而不是业务 code）
        if status == reqwest::StatusCode::UNAUTHORIZED {
            return Err(AppError::Unauthorized("登录状态已过期".into()));
        }
        if !status.is_success() && body.is_null() {
            return Err(AppError::Custom(format!("接口异常: HTTP {status}")));
        }

        unwrap_body(body)
    }

    /// 续期：拿到锁后先复查 token 是否已被其他并发请求换掉（单飞模式）
    ///
    /// 返回 Ok(true) 表示已换到新 token 可以重放；Ok(false) 表示需要用户重新登录。
    async fn try_renew(&self) -> Result<bool, AppError> {
        let before = self.current_token().await;
        let _guard = self.refresh_lock.lock().await;
        // 排队期间别人已经换好了 → 直接重放，不再打一次刷新接口
        if self.current_token().await != before {
            return Ok(true);
        }

        let refresh_token = {
            let session = self.session.read().await;
            session.as_ref().and_then(|s| s.refresh_token.clone())
        };

        // 🔴 Sa-Token 默认没有 refresh token（靠活动超时自动续签），此时只能要求重新登录。
        // 仅当后端确实提供了刷新接口时才走下面的分支。
        let Some(refresh_token) = refresh_token else {
            self.set_session(None).await;
            return Ok(false);
        };

        let spec = RequestSpec {
            url: "/auth/refresh".into(),
            method: "POST".into(),
            params: None,
            data: Some(serde_json::json!({ "refreshToken": refresh_token })),
            auth: false,
        };
        match self.send_once(&spec).await {
            Ok(value) => {
                self.set_session(Some(auth::parse_session(value)?)).await;
                Ok(true)
            }
            Err(_) => {
                self.set_session(None).await;
                Ok(false)
            }
        }
    }
}
```

### 5.5 Command 层：透传 + 认证

**为什么用透传 Command**：后台管理系统动辄上百个接口，若每个都写
Command → Service → Database 三层，样板代码会淹没业务。折中方案是：

- **透传 Command**（`admin_request`）负责绝大多数 CRUD，类型在 TypeScript 侧收敛；
- **强类型 Command** 只留给三类接口：① 登录等涉密流程；② 需要本地缓存的（字典）；
  ③ 需要 Rust 侧加工的（上传、离线队列、批量导出）。

```rust
// src-tauri/src/commands/admin.rs
use serde_json::Value;
use tauri::State;

use crate::error::CommandError;
use crate::services::admin::{auth, RequestSpec};
use crate::state::AppState;

/// 通用透传：前端所有后台接口调用最终都走这里
#[tauri::command]
pub async fn admin_request(
    state: State<'_, AppState>,
    spec: RequestSpec,
) -> Result<Value, CommandError> {
    state.admin.request(spec).await.map_err(Into::into)
}

/// 登录（涉密流程，强类型）
#[tauri::command]
pub async fn admin_login(
    state: State<'_, AppState>,
    username: String,
    password: String,
    code: Option<String>,
    uuid: Option<String>,
) -> Result<Value, CommandError> {
    auth::login(&state.admin, &username, &password, code, uuid)
        .await
        .map_err(Into::into)
}

#[tauri::command]
pub async fn admin_logout(state: State<'_, AppState>) -> Result<(), CommandError> {
    auth::logout(&state.admin).await.map_err(Into::into)
}

/// 登录态查询：前端只拿布尔值，永远拿不到 token 本身
#[tauri::command]
pub async fn admin_is_logged_in(state: State<'_, AppState>) -> Result<bool, CommandError> {
    Ok(state.admin.is_logged_in().await)
}
```

```rust
// src-tauri/src/lib.rs —— generate_handler! 增补
.invoke_handler(tauri::generate_handler![
    // ... 既有 Command ...
    commands::admin::admin_request,
    commands::admin::admin_login,
    commands::admin::admin_logout,
    commands::admin::admin_is_logged_in,
])
```

### 5.6 认证服务

```rust
// src-tauri/src/services/admin/auth.rs
use serde_json::Value;

use super::{AdminClient, AuthSession, RequestSpec};
use crate::error::AppError;

/// 登录：成功后把会话留在 Rust 侧，只把用户可见信息返回给前端
pub async fn login(
    client: &AdminClient,
    username: &str,
    password: &str,
    code: Option<String>,
    uuid: Option<String>,
) -> Result<Value, AppError> {
    let cfg = client.config.read().await.clone();
    let spec = RequestSpec {
        url: cfg.login_path.clone(),
        method: "POST".into(),
        params: None,
        data: Some(serde_json::json!({
            "username": username,
            "password": password,
            "code": code,
            "uuid": uuid,
            // 若依系登录必带：客户端标识与授权类型，值取自后端 sys_client 表
            "clientId": cfg.client_id,
            "grantType": cfg.grant_type,
            "tenantId": cfg.tenant_id,
        })),
        auth: false,
    };

    let value = client.request(spec).await?;
    client.set_session(Some(parse_session(value)?)).await;

    // 登录成功后立刻拉一次用户信息（含 roles / permissions），前端一次拿全
    get_user_info(client).await
}

/// 从登录响应中解析会话。字段名各版本略有差异，按需增补候选键。
pub fn parse_session(value: Value) -> Result<AuthSession, AppError> {
    let token = value
        .get("access_token")
        .or_else(|| value.get("token"))
        .and_then(Value::as_str)
        .ok_or_else(|| AppError::Custom("登录响应缺少 token 字段".into()))?
        .to_string();

    // 后端给的是相对秒数，换算成绝对时间戳存储，避免跨休眠后判断失准
    let expire_in = value
        .get("expire_in")
        .and_then(Value::as_i64)
        .unwrap_or(60 * 60 * 12);

    Ok(AuthSession {
        token,
        expire_at_ms: chrono::Utc::now().timestamp_millis() + expire_in * 1000,
        refresh_token: value
            .get("refresh_token")
            .and_then(Value::as_str)
            .map(str::to_string),
    })
}

pub async fn get_user_info(client: &AdminClient) -> Result<Value, AppError> {
    client
        .request(RequestSpec {
            url: "/system/user/getInfo".into(),
            method: "GET".into(),
            params: None,
            data: None,
            auth: true,
        })
        .await
}

/// 登出：无论后端是否成功都清本地会话，避免"点了退出但还带着旧 token"
pub async fn logout(client: &AdminClient) -> Result<(), AppError> {
    let _ = client
        .request(RequestSpec {
            url: "/auth/logout".into(),
            method: "POST".into(),
            params: None,
            data: Some(serde_json::json!({})),
            auth: true,
        })
        .await;
    client.set_session(None).await;
    Ok(())
}
```

---

## 六、前端实现

### 6.1 adminApi 客户端

```typescript
// src/lib/api/admin/client.ts
import { invoke } from "@/lib/api";

/** 与 Rust RequestSpec 对齐 */
interface RequestSpec {
  url: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  params?: Record<string, unknown>;
  data?: unknown;
  auth?: boolean;
}

/** 分页结果（与 Rust PageResult / 后端 TableDataInfo 对齐） */
export interface PageResult<T> {
  total: number;
  rows: T[];
}

/** 所有后台接口的唯一出口：前端不存在第二条访问后端的路径 */
async function request<T>(spec: RequestSpec): Promise<T> {
  return invoke<T>("admin_request", { spec });
}

export const adminHttp = {
  get: <T>(url: string, params?: Record<string, unknown>, auth = true) =>
    request<T>({ url, method: "GET", params, auth }),
  post: <T>(url: string, data?: unknown, auth = true) =>
    request<T>({ url, method: "POST", data, auth }),
  put: <T>(url: string, data?: unknown, auth = true) =>
    request<T>({ url, method: "PUT", data, auth }),
  del: <T>(url: string, params?: Record<string, unknown>, auth = true) =>
    request<T>({ url, method: "DELETE", params, auth }),
};
```

### 6.2 业务 API 模块（按后端模块划分，与管理端目录对齐）

```typescript
// src/lib/api/admin/system.ts
import { adminHttp, type PageResult } from "./client";
import type { SysUser, SysUserQuery } from "@/types/admin";

export const systemApi = {
  listUsers: (query: SysUserQuery) =>
    adminHttp.get<PageResult<SysUser>>("/system/user/list", query),
  getUser: (userId: number) => adminHttp.get<SysUser>(`/system/user/${userId}`),
  createUser: (data: Partial<SysUser>) => adminHttp.post<void>("/system/user", data),
  updateUser: (data: Partial<SysUser>) => adminHttp.put<void>("/system/user", data),
  deleteUsers: (ids: number[]) => adminHttp.del<void>(`/system/user/${ids.join(",")}`),
};
```

```typescript
// src/lib/api/admin/index.ts —— Re-export Hub（与框架既有 api/index.ts 风格一致）
export { adminHttp } from "./client";
export type { PageResult } from "./client";
export { authApi } from "./auth";
export { systemApi } from "./system";
```

### 6.3 登录态 store

```typescript
// src/store/auth.ts
import { create } from "zustand";
import { authApi } from "@/lib/api/admin";

export interface AdminUserInfo {
  user: { userId: number; userName: string; nickName: string; avatar?: string };
  roles: string[];
  permissions: string[];
}

interface AuthStore {
  loggedIn: boolean;
  info: AdminUserInfo | null;
  login: (username: string, password: string, code?: string, uuid?: string) => Promise<void>;
  logout: () => Promise<void>;
  /** 401 时由 API 层调用：清态并跳登录页 */
  handleExpired: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  loggedIn: false,
  info: null,

  login: async (username, password, code, uuid) => {
    const info = await authApi.login(username, password, code, uuid);
    set({ loggedIn: true, info });
  },

  logout: async () => {
    await authApi.logout();
    set({ loggedIn: false, info: null });
  },

  // setter 保持纯粹：只清状态，跳转由调用处的路由层负责（见 store-management 技能的告诫）
  handleExpired: () => set({ loggedIn: false, info: null }),
}));
```

### 6.4 按钮级权限

对应管理端的 `v-hasPermi`，桌面端用 Hook + 组件两种形态：

```typescript
// src/hooks/usePermission.ts
import { useAuthStore } from "@/store";

/** 超级管理员通配符（与后端 SysUserServiceImpl 的约定一致） */
const ALL_PERMISSION = "*:*:*";

export function usePermission() {
  const permissions = useAuthStore((s) => s.info?.permissions ?? []);
  const roles = useAuthStore((s) => s.info?.roles ?? []);

  /** 是否拥有任一权限标识，如 "system:user:add" */
  const hasPermi = (perms: string | string[]): boolean => {
    if (permissions.includes(ALL_PERMISSION)) return true;
    const list = Array.isArray(perms) ? perms : [perms];
    return list.some((p) => permissions.includes(p));
  };

  const hasRole = (needs: string | string[]): boolean => {
    if (roles.includes("superadmin")) return true;
    const list = Array.isArray(needs) ? needs : [needs];
    return list.some((r) => roles.includes(r));
  };

  return { hasPermi, hasRole };
}
```

```tsx
// src/components/ui/HasPermi.tsx
import type { ReactNode } from "react";
import { usePermission } from "@/hooks/usePermission";

/** 无权限时整块不渲染（而非置灰）—— 与管理端 v-hasPermi 行为保持一致 */
export function HasPermi({ perms, children }: { perms: string | string[]; children: ReactNode }) {
  const { hasPermi } = usePermission();
  return hasPermi(perms) ? <>{children}</> : null;
}
```

### 6.5 分页适配器 + Table 实战

后端分页参数与 Ant Design Table 的形状不同，**必须集中适配一次**，禁止每个页面各写各的：

```typescript
// src/lib/api/admin/page.ts
import type { TablePaginationConfig } from "antd";
import type { SorterResult } from "antd/es/table/interface";

export interface PageQuery {
  pageNum: number;
  pageSize: number;
  orderByColumn?: string;
  isAsc?: "asc" | "desc";
}

/**
 * antd 的 onChange 参数 → 后端 PageQuery
 * 注意：orderByColumn 要的是后端实体字段名，若列的 dataIndex 与之不同，
 * 在列定义里用 sorter + 自定义 key 映射，别指望两边天然一致。
 */
export function toPageQuery(
  pagination: TablePaginationConfig,
  sorter?: SorterResult<unknown> | SorterResult<unknown>[],
): PageQuery {
  const s = Array.isArray(sorter) ? sorter[0] : sorter;
  return {
    pageNum: pagination.current ?? 1,
    pageSize: pagination.pageSize ?? 10,
    orderByColumn: s?.order ? String(s.field) : undefined,
    isAsc: s?.order === "ascend" ? "asc" : s?.order === "descend" ? "desc" : undefined,
  };
}
```

```tsx
// src/pages/admin/users/index.tsx
import { useEffect, useState } from "react";
import { Card, Table, Button, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { systemApi, toPageQuery, type PageQuery } from "@/lib/api/admin";
import { getErrorCode, getErrorMessage } from "@/lib/api";
import { HasPermi } from "@/components/ui/HasPermi";
import { useAuthStore } from "@/store";
import type { SysUser } from "@/types/admin";

export default function AdminUsersPage() {
  const [rows, setRows] = useState<SysUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState<PageQuery>({ pageNum: 1, pageSize: 10 });

  async function load(q: PageQuery) {
    setLoading(true);
    try {
      const page = await systemApi.listUsers(q);
      setRows(page.rows);
      setTotal(page.total);
    } catch (e) {
      // 登录过期统一由 store 处置，其余按 code 分流呈现
      if (getErrorCode(e) === "UNAUTHORIZED") {
        useAuthStore.getState().handleExpired();
        return;
      }
      message.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(query); }, [query]);

  return (
    <div className="p-4">
      <Card
        title="用户管理"
        extra={
          <HasPermi perms="system:user:add">
            <Button type="primary" icon={<PlusOutlined />}>新增</Button>
          </HasPermi>
        }
      >
        <Table<SysUser>
          rowKey="userId"
          dataSource={rows}
          loading={loading}
          pagination={{ current: query.pageNum, pageSize: query.pageSize, total, showSizeChanger: true }}
          onChange={(pagination, _filters, sorter) => setQuery(toPageQuery(pagination, sorter))}
          columns={[
            { title: "账号", dataIndex: "userName" },
            { title: "昵称", dataIndex: "nickName" },
            { title: "部门", dataIndex: ["dept", "deptName"] },
            { title: "状态", dataIndex: "status", render: (v: string) => (v === "0" ? "正常" : "停用") },
          ]}
        />
      </Card>
    </div>
  );
}
```

---

## 七、数据字典与本地缓存

字典（`sys_dict_data`）在管理端到处都要用来把 `status: "0"` 翻成"正常"。
每个组件各拉一次会打爆后端，必须做**内存 + SQLite 两级缓存**。

```rust
// src-tauri/src/database/schema.rs —— 新增迁移版本
// 字典缓存：payload 存整个字典项数组的 JSON，fetched_at 用于 TTL 判断
if version < 2 {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS admin_dict_cache (
            dict_type  TEXT PRIMARY KEY,
            payload    TEXT NOT NULL,
            fetched_at INTEGER NOT NULL
        );",
    )?;
    conn.pragma_update(None, "user_version", 2)?;
}
```

```rust
// src-tauri/src/services/admin/dict.rs
use serde_json::Value;

use super::{AdminClient, RequestSpec};
use crate::database::Database;
use crate::error::AppError;

/// 字典缓存有效期：1 小时。后台改字典的频率远低于此，命中率高。
const DICT_TTL_SECS: i64 = 3600;

/// 取字典：命中未过期缓存直接返回；否则拉远程并回写。
/// 远程失败时**降级用过期缓存**——断网时界面能显示"正常/停用"，好过显示原始码值。
pub async fn get_dict(
    client: &AdminClient,
    db: &Database,
    dict_type: &str,
) -> Result<Value, AppError> {
    let now = chrono::Utc::now().timestamp();
    let cached = db.get_dict_cache(dict_type)?;

    if let Some((payload, fetched_at)) = &cached {
        if now - fetched_at < DICT_TTL_SECS {
            return Ok(serde_json::from_str(payload)?);
        }
    }

    match client
        .request(RequestSpec {
            url: format!("/system/dict/data/type/{dict_type}"),
            method: "GET".into(),
            params: None,
            data: None,
            auth: true,
        })
        .await
    {
        Ok(value) => {
            db.set_dict_cache(dict_type, &serde_json::to_string(&value)?, now)?;
            Ok(value)
        }
        Err(e) => match cached {
            // 过期兜底：记一条 warn 便于排查"为什么字典没更新"
            Some((payload, _)) => {
                log::warn!("字典 {dict_type} 远程拉取失败，降级使用过期缓存: {e}");
                Ok(serde_json::from_str(&payload)?)
            }
            None => Err(e),
        },
    }
}
```

```typescript
// src/hooks/useDict.ts
import { useEffect, useState } from "react";
import { adminHttp } from "@/lib/api/admin";
import { useDictStore } from "@/store";

export interface DictItem {
  dictLabel: string;
  dictValue: string;
  /** 标签配色：default / primary / success / warning / danger */
  listClass?: string;
}

/** 批量取字典：同一 dictType 在一次会话内只会请求一次（内存层去重） */
export function useDict(...types: string[]) {
  const cache = useDictStore((s) => s.cache);
  const setDict = useDictStore((s) => s.setDict);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const missing = types.filter((t) => !cache[t]);
    if (missing.length === 0) { setReady(true); return; }
    Promise.all(
      missing.map(async (t) => setDict(t, await adminHttp.get<DictItem[]>(`/dict/${t}`))),
    ).finally(() => setReady(true));
  }, [types.join(",")]);

  /** 码值 → 文案，查不到时原样回显，绝不显示 undefined */
  const label = (type: string, value: string) =>
    cache[type]?.find((d) => d.dictValue === value)?.dictLabel ?? value;

  return { dict: cache, label, ready };
}
```

---

## 八、文件上传与下载

WebView 上传会遇到 CORS、进度不可控、大文件占内存三个问题，一律走 Rust：

```rust
// src-tauri/src/services/admin/upload.rs
use std::path::Path;

use serde_json::Value;
use tauri::{AppHandle, Emitter};

use super::AdminClient;
use crate::error::AppError;
use crate::services::admin::response::unwrap_body;

/// 上传本地文件到后端 OSS 接口。
/// 用 file_path 而非前端传字节：避免大文件在 IPC 通道里做一次 base64 膨胀。
pub async fn upload_file(
    client: &AdminClient,
    app: &AppHandle,
    file_path: &str,
) -> Result<Value, AppError> {
    let path = Path::new(file_path);
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| AppError::InvalidInput("非法文件路径".into()))?
        .to_string();

    let bytes = tokio::fs::read(path).await?;
    let cfg = client.config.read().await.clone();
    let token = client
        .current_token()
        .await
        .ok_or_else(|| AppError::Unauthorized("未登录".into()))?;

    let part = reqwest::multipart::Part::bytes(bytes).file_name(file_name.clone());
    let form = reqwest::multipart::Form::new().part("file", part);

    // 上传通常较慢，先发一个事件让 UI 立刻进入 loading（前端 listen("admin://upload")）
    let _ = app.emit("admin://upload", serde_json::json!({ "file": file_name, "status": "start" }));

    let resp = reqwest::Client::new()
        .post(format!("{}{}", cfg.base_url, cfg.upload_path))
        .header("Authorization", format!("Bearer {token}"))
        .multipart(form)
        .send()
        .await?;

    let result = unwrap_body(resp.json().await.unwrap_or(Value::Null));
    let _ = app.emit(
        "admin://upload",
        serde_json::json!({ "file": file_name, "status": if result.is_ok() { "done" } else { "fail" } }),
    );
    result
}
```

> 进度条要精确到百分比时，用 `reqwest` 的 `wrap_stream` 包一层计数器再 `emit`；
> 事件收发规范见 `tauri-events` 技能，文件选择对话框见 `file-storage` 技能。

---

## 九、离线降级与重放队列（仅形态 C 需要）

```rust
// 表结构：写操作离线暂存
// CREATE TABLE admin_outbox (
//   id INTEGER PRIMARY KEY AUTOINCREMENT,
//   method TEXT NOT NULL, url TEXT NOT NULL, body TEXT,
//   idempotency_key TEXT,              -- 业务幂等键，重放去重用
//   created_at INTEGER NOT NULL,
//   retry_count INTEGER NOT NULL DEFAULT 0,
//   last_error TEXT
// );
```

**四条硬约束，任缺一条都会造成数据事故：**

1. **只有幂等操作能进队列**。"新增订单"这类非幂等写入必须带业务幂等键，
   由后端保证重复提交只生效一次；后端不支持就**别让它离线可用**，直接禁用按钮。
2. **重放必须串行且按 id 升序**。并行重放会让"先改后删"变成"先删后改"。
3. **重放失败要分类**：网络失败 → 保留重试并退避；业务失败（4xx/业务 code）→ 出队并
   **明确告知用户哪条没成功**，不许静默丢弃。
4. **队列有上限**（如 500 条 / 7 天），超限提示用户联网同步，避免无限堆积后一次性冲垮后端。

```typescript
// 网络状态变化时触发重放，别用定时轮询
window.addEventListener("online", () => { void adminHttp.post("/__replay__"); });
```

---

## 十、多环境 baseUrl 与租户切换

```rust
// src-tauri/src/services/admin/config.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdminConfig {
    pub base_url: String,
    pub tenant_id: Option<String>,
    pub client_id: String,
    pub grant_type: String,
    pub login_path: String,
    pub upload_path: String,
    pub language: String,
    pub timeout_secs: u64,
    pub accept_invalid_certs: bool,
}

impl Default for AdminConfig {
    fn default() -> Self {
        Self {
            // dev 指向本机后端，prod 由用户在设置页填写或随安装包配置下发
            base_url: if cfg!(debug_assertions) {
                "http://localhost:8080".into()
            } else {
                String::new()
            },
            tenant_id: None,
            client_id: String::new(),
            grant_type: "password".into(),
            login_path: "/auth/login".into(),
            upload_path: "/resource/oss/upload".into(),
            language: "zh_CN".into(),
            timeout_secs: 30,
            accept_invalid_certs: false,
        }
    }
}
```

要点：

- **baseUrl 必须可配置**，写死在代码里的项目一到客户现场就返工。
  存 `app_config` 表，设置页可改，改完即时生效（`config` 是 `RwLock`，写锁更新即可）。
- **dev / prod 分流**用 `cfg!(debug_assertions)`，与 `env-isolation` 技能的策略保持一致。
- **切租户等价于重新登录**：`tenant_id` 变更后必须清会话并重新登录，
  否则旧 token 带新租户头会拿到诡异的空数据。

---

## 十一、附录 A：若依 RuoYi-Plus 接口速查

> 下表整理自参考实现 `plus-ui`（Vue3 管理端）。**各版本/改造版有差异，接入首日先用真实请求逐条核对。**

| 用途 | 方法 | 路径 | 备注 |
|------|------|------|------|
| 登录 | POST | `/auth/login`（改造版可能是 `/auth/userLogin`） | 带 `clientId` / `grantType`；常强制请求加密 |
| 登出 | POST | `/auth/logout` | 失败也要清本地会话 |
| 图形验证码 | GET | `/auth/imgCode` | 返回 base64 图片 + `uuid`，登录时回传 |
| 短信/邮箱验证码 | GET | `/auth/smsCode` / `/auth/emailCode` | 后端限流 60s 一次 |
| 租户开关与列表 | GET | `/auth/getTenantConfig` | 决定登录页是否显示租户选择 |
| 用户信息 | GET | `/system/user/getInfo` | 返回 `user` / `roles` / `permissions` |
| 字典数据 | GET | `/system/dict/data/type/{dictType}` | 强烈建议缓存 |
| 文件上传 | POST | `/resource/oss/upload` | multipart，字段名 `file` |
| SSE 关闭 | GET | `/resource/sse/close` | 登出前调用，否则连接泄漏 |

**请求头约定：**

| 头 | 何时带 | 说明 |
|----|-------|------|
| `Authorization: Bearer <token>` | 除登录/验证码外全部 | Sa-Token 校验 |
| `X-Tenant-Id` | 后端开启多租户时 | **漏带不会报错，只会查不到数据** |
| `Content-Language` | 全部 | 后端国际化文案 |
| `encrypt-key` | 开启接口加密时 | RSA 加密后的 AES 密钥，见附录 B |

**响应 code 语义：**

| code | 含义 | 桌面端处置 |
|------|------|-----------|
| 200 | 成功 | 取业务数据 |
| 401 | 未登录/过期 | 清会话 → 跳登录页（**不要弹重复的过期提示**，见常见错误） |
| 500 | 服务端/业务异常 | `message.error` |
| 601 | 业务警告 | `message.warning`（若依系特有，别当错误处理） |

---

## 十二、附录 B：接口加密（AES + RSA）

若依系开启 `apiEncrypt` 后，登录等接口要求：客户端**随机生成 AES 密钥**加密请求体，
再用**后端公钥 RSA 加密该 AES 密钥**放进 `encrypt-key` 请求头；响应同理反向解密。

```toml
# Cargo.toml
aes = "0.8"
cbc = "0.1"            # 或 ecb，取决于后端 Cipher 模式
rsa = "0.9"
base64 = "0.22"
rand = "0.8"
```

🔴 **务必逐位对齐后端实现，不要凭直觉选参数。** 关键三处极易错配：

1. **AES 模式与填充**：若依常见为 `AES/ECB/PKCS5Padding`（部分版本为 CBC 带 IV）。
2. **RSA 填充**：`RSA/ECB/PKCS1Padding` 对应 rust 的 `Pkcs1v15`，
   若后端用 OAEP 则完全不通用。
3. **Base64 时机**：AES 密钥先 Base64 再 RSA 加密，密文再 Base64 —— 顺序错了解不出来。

**接入方法**：以管理端的 `utils/crypto.ts` 与 `utils/rsa.ts` 为准，先写一个联调用例
（固定明文 + 固定密钥 → 比对两端密文完全一致），通过后再接入正式流程。
在这一步"差不多能跑"等于埋雷，加密一旦不一致后端只会回一个笼统的解密失败。

> 若项目允许，**优先建议后端为桌面端关闭接口加密**，改用 HTTPS + 短时效 Token。
> 桌面端不像浏览器需要防中间人脚本注入，这层加密的收益远低于它的对齐成本。

---

## 十三、常见错误对比

| 错误做法 | 正确做法 | 后果 |
|---------|---------|------|
| 前端 `axios.create({baseURL})` 直连后台 | 一律走 `admin_request` 透传 Command | Token 落 localStorage、CSP 被迫放开、CORS 要改后端 |
| 把 token 返回给前端存 Zustand | token 只留 Rust 侧，前端只拿 `loggedIn` 与用户信息 | WebView 侧任意脚本可读取凭证 |
| 分页写死取 `data.rows` | 用 `unwrap_body` 兼容顶层与嵌套两种形态 | 换个后端版本整个列表页全白 |
| 把 601 当错误弹红色 toast | 601 是业务警告，用 `message.warning` | 用户以为系统故障，实为校验提示 |
| 每个组件各自拉字典 | `useDict` + SQLite 两级缓存 | 一个列表页打出几十个字典请求 |
| 401 时每个并发请求各弹一次过期框 | 单飞续期 + store 统一 `handleExpired` | 屏幕上叠十个"登录已过期"弹窗 |
| 多租户系统漏传 `X-Tenant-Id` | 请求层统一注入 | **不报错**，只是永远查不到数据，极难排查 |
| 用 `unwrap()` 处理 reqwest 结果 | `?` + `AppError::Http` | 网络一抖整个应用 panic 退出 |
| 把所有写操作塞进离线队列 | 仅幂等操作入队，其余断网时禁用 | 重放产生重复订单/重复扣款 |
| 后端 `orderByColumn` 直接用 antd 的 dataIndex | 显式维护字段映射 | 排序静默失效或后端 500 |

---

## 十四、接入检查清单

**接入前**
- [ ] 已确认数据源形态（A/B/C），并与用户就"是否要离线可用"达成一致
- [ ] 已拿到后端 baseUrl、是否多租户、是否开接口加密、`clientId`/`grantType` 取值
- [ ] 已用真实请求确认分页响应形态（顶层 rows 还是 data.rows）

**Rust 侧**
- [ ] `reqwest` 已加入 Cargo.toml（rustls，非 openssl）
- [ ] `AdminClient` 已挂进 `AppState`，`AppError` 已增补三个变体与 code 映射
- [ ] 请求层统一注入 `Authorization` / `X-Tenant-Id` / `Content-Language`
- [ ] 401 走单飞续期，续期失败清会话
- [ ] 新增 Command 已在 `generate_handler![]` 注册

**前端**
- [ ] 无任何 `fetch` / `axios` 直连后端的代码
- [ ] API 层按后端模块拆分并有 Re-export Hub
- [ ] 分页统一走 `toPageQuery`，未在页面内手拼参数
- [ ] 按钮级权限用 `HasPermi` / `usePermission`，未硬编码角色判断
- [ ] 错误按 `getErrorCode` 分流（UNAUTHORIZED / BIZ_601 / 其他）

**验证**
- [ ] 断网状态下界面有明确提示，不是白屏或无限 loading
- [ ] Token 过期后能自动跳登录页且只提示一次
- [ ] 切换租户后旧数据已清、需重新登录
- [ ] `cargo clippy` 与 `npx tsc --noEmit` 均无告警
