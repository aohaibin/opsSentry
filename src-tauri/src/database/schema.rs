use rusqlite::Connection;

use crate::error::AppError;

/// 当前 Schema 版本
pub const SCHEMA_VERSION: i32 = 6;

/// 获取数据库版本
pub fn get_version(conn: &Connection) -> Result<i32, AppError> {
    let version: i32 = conn.pragma_query_value(None, "user_version", |row| row.get(0))?;
    Ok(version)
}

/// 设置数据库版本
pub fn set_version(conn: &Connection, version: i32) -> Result<(), AppError> {
    conn.pragma_update(None, "user_version", version)?;
    Ok(())
}

/// 执行数据库迁移
pub fn migrate(conn: &Connection) -> Result<(), AppError> {
    let mut version = get_version(conn)?;

    if version > SCHEMA_VERSION {
        return Err(AppError::Custom(format!(
            "数据库版本({})高于应用支持的版本({}), 请升级应用",
            version, SCHEMA_VERSION
        )));
    }

    while version < SCHEMA_VERSION {
        match version {
            0 => migrate_v0_to_v1(conn)?,
            1 => migrate_v1_to_v2(conn)?,
            2 => migrate_v2_to_v3(conn)?,
            3 => migrate_v3_to_v4(conn)?,
            4 => migrate_v4_to_v5(conn)?,
            5 => migrate_v5_to_v6(conn)?,
            _ => {
                return Err(AppError::Custom(format!(
                    "未知的数据库版本: {}",
                    version
                )));
            }
        }
        version = get_version(conn)?;
    }

    log::info!("数据库迁移完成, 当前版本: {}", version);
    Ok(())
}

/// v0 -> v1: 初始化表结构
fn migrate_v0_to_v1(conn: &Connection) -> Result<(), AppError> {
    log::info!("数据库迁移: v0 -> v1");

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS app_config (
            key         TEXT PRIMARY KEY,
            value       TEXT NOT NULL,
            created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            updated_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );

        INSERT OR IGNORE INTO app_config (key, value) VALUES ('theme', 'dark');
        INSERT OR IGNORE INTO app_config (key, value) VALUES ('language', 'zh-CN');
        INSERT OR IGNORE INTO app_config (key, value) VALUES ('sidebar_collapsed', 'false');
        ",
    )?;

    set_version(conn, 1)?;
    Ok(())
}

/// v1 -> v2: 添加软删除支持
fn migrate_v1_to_v2(conn: &Connection) -> Result<(), AppError> {
    log::info!("数据库迁移: v1 -> v2（软删除支持）");

    conn.execute_batch(
        "
        ALTER TABLE app_config ADD COLUMN deleted_at TEXT DEFAULT NULL;
        ",
    )?;

    set_version(conn, 2)?;
    Ok(())
}

/// v2 -> v3: 添加服务器资产表
fn migrate_v2_to_v3(conn: &Connection) -> Result<(), AppError> {
    log::info!("数据库迁移: v2 -> v3（服务器资产）");

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS servers (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            alias        TEXT NOT NULL UNIQUE,
            hostname     TEXT NOT NULL,
            port         INTEGER NOT NULL DEFAULT 22,
            username     TEXT NOT NULL DEFAULT 'root',
            auth_type    TEXT NOT NULL DEFAULT 'password',
            tags         TEXT NOT NULL DEFAULT '[]',
            `group`      TEXT NOT NULL DEFAULT '默认',
            ai_policy    TEXT NOT NULL DEFAULT 'trusted',
            os_type      TEXT NOT NULL DEFAULT 'linux',
            created_at   TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
            updated_at   TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );

        CREATE INDEX IF NOT EXISTS idx_servers_alias ON servers(alias);
        CREATE INDEX IF NOT EXISTS idx_servers_group ON servers(`group`);
        CREATE INDEX IF NOT EXISTS idx_servers_policy ON servers(ai_policy);
        ",
    )?;

    set_version(conn, 3)?;
    Ok(())
}

/// v3 -> v4: 添加审核日志表和告警规则表
fn migrate_v3_to_v4(conn: &Connection) -> Result<(), AppError> {
    log::info!("数据库迁移: v3 -> v4（审核日志 + 告警规则）");

    conn.execute_batch(
        "
        CREATE TABLE IF NOT EXISTS audit_logs (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            server_alias   TEXT NOT NULL,
            command        TEXT NOT NULL,
            user           TEXT NOT NULL DEFAULT 'system',
            result         TEXT NOT NULL DEFAULT 'success',
            created_at     TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );

        CREATE INDEX IF NOT EXISTS idx_audit_logs_server ON audit_logs(server_alias);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON audit_logs(created_at);

        CREATE TABLE IF NOT EXISTS alert_rules (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT NOT NULL,
            metric      TEXT NOT NULL,
            threshold   TEXT NOT NULL,
            severity    TEXT NOT NULL DEFAULT 'warning',
            enabled     INTEGER NOT NULL DEFAULT 1,
            created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );
        ",
    )?;

    set_version(conn, 4)?;
    Ok(())
}

/// v4 -> v5: 服务器资产增强（收藏 / 系统架构 / 最近探活时间）
///
/// 字段语义（避免前端误判，特此注明）：
/// - `favorite`：左侧分组树「我的收藏」的数据来源，SQLite 无布尔类型，用 0/1 存储。
/// - `arch`：目标机 CPU 架构，由首次成功连通后写回。默认空串表示「尚未探测」，
///   前端应显示占位符，而不能把空串当成 linux/amd64。
/// - `last_used_at`：每次成功探活后刷新，供「最近用过」排序。NULL 表示从未使用过，
///   刻意不与 created_at 混用，否则新纳管但没连过的机器会错误地排在「最近用过」顶部。
fn migrate_v4_to_v5(conn: &Connection) -> Result<(), AppError> {
    log::info!("数据库迁移: v4 -> v5（服务器资产增强）");

    conn.execute_batch(
        "
        ALTER TABLE servers ADD COLUMN favorite INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE servers ADD COLUMN arch TEXT NOT NULL DEFAULT '';
        ALTER TABLE servers ADD COLUMN last_used_at TEXT DEFAULT NULL;

        CREATE INDEX IF NOT EXISTS idx_servers_favorite ON servers(favorite);
        ",
    )?;

    set_version(conn, 5)?;
    Ok(())
}

/// v5 -> v6: 持久化 SSH 主机身份与最近认证状态。
///
/// 这里只保存公开的主机指纹和非敏感结果摘要；密码、私钥内容及口令绝不落库。
fn migrate_v5_to_v6(conn: &Connection) -> Result<(), AppError> {
    log::info!("数据库迁移: v5 -> v6（SSH 验证状态）");

    conn.execute_batch(
        "
        ALTER TABLE servers ADD COLUMN host_key_fingerprint TEXT NOT NULL DEFAULT '';
        ALTER TABLE servers ADD COLUMN last_connection_status TEXT NOT NULL DEFAULT 'unknown';
        ALTER TABLE servers ADD COLUMN last_connection_message TEXT NOT NULL DEFAULT '';
        ALTER TABLE servers ADD COLUMN last_connected_at TEXT DEFAULT NULL;

        CREATE INDEX IF NOT EXISTS idx_servers_connection_status
            ON servers(last_connection_status);
        ",
    )?;

    set_version(conn, 6)?;
    Ok(())
}
