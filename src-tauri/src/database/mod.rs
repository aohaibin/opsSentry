pub mod schema;

use std::sync::Mutex;

use rusqlite::Connection;

use crate::error::AppError;
use crate::models::{AppConfig, AuditLog, Server};

/// 数据库封装，线程安全
pub struct Database {
    conn: Mutex<Connection>,
}

/// servers 表的完整列清单
///
/// 集中定义的原因：Server 有 15 个字段，若每个 SELECT 各写一遍列清单，
/// 一旦新增列就容易漏改某处，导致 row.get 索引静默错位（编译期不报错、运行期取错值）。
/// 注意 `group` 是 SQLite 关键字，必须用反引号包裹。
const SERVER_COLUMNS: &str =
    "id, alias, hostname, port, username, auth_type, tags, `group`, ai_policy, os_type, \
     favorite, arch, last_used_at, host_key_fingerprint, last_connection_status, \
     last_connection_message, last_connected_at, created_at, updated_at";

/// 将一行查询结果映射为 Server
///
/// 列顺序必须与 `SERVER_COLUMNS` 严格一一对应，改动列清单时两处必须同步。
fn map_server_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Server> {
    Ok(Server {
        id: row.get(0)?,
        alias: row.get(1)?,
        hostname: row.get(2)?,
        port: row.get(3)?,
        username: row.get(4)?,
        auth_type: row.get(5)?,
        tags: row.get(6)?,
        group: row.get(7)?,
        ai_policy: row.get(8)?,
        os_type: row.get(9)?,
        favorite: row.get(10)?,
        arch: row.get(11)?,
        last_used_at: row.get(12)?,
        host_key_fingerprint: row.get(13)?,
        last_connection_status: row.get(14)?,
        last_connection_message: row.get(15)?,
        last_connected_at: row.get(16)?,
        created_at: row.get(17)?,
        updated_at: row.get(18)?,
    })
}

/// 把历史遗留的 tags 文本还原成标签数组
///
/// 早期版本存在两种写法：`[]`（JSON 数组）与 `a,b`（逗号分隔），
/// 因此读取时必须容错，否则老数据会在前端解析时报错。
fn parse_tags(raw: &str) -> Vec<String> {
    if let Ok(list) = serde_json::from_str::<Vec<String>>(raw) {
        return list;
    }
    raw.split(&[',', '，'][..])
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

/// 生成 n 个占位符，起始编号可指定（用于把新增值放在参数列表最前）
fn placeholders(count: usize, start: usize) -> String {
    (start..start + count)
        .map(|i| format!("?{}", i))
        .collect::<Vec<_>>()
        .join(", ")
}

impl Database {
    /// 初始化数据库（创建或打开 + 自动迁移）
    pub fn init(db_path: &str) -> Result<Self, AppError> {
        let conn = Connection::open(db_path)?;

        // 启用 WAL 模式提升并发性能
        conn.pragma_update(None, "journal_mode", "WAL")?;

        // 设置忙等待超时，防止并发写入死锁
        conn.busy_timeout(std::time::Duration::from_secs(5))?;

        // 执行 Schema 迁移
        schema::migrate(&conn)?;

        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    // ─── 配置 DAO ────────────────────────────────────

    /// 获取所有配置（排除已软删除的）
    pub fn get_all_config(&self) -> Result<Vec<AppConfig>, AppError> {
        let conn = self.conn.lock().map_err(|e| AppError::Custom(e.to_string()))?;
        let mut stmt = conn.prepare(
            "SELECT key, value FROM app_config WHERE deleted_at IS NULL ORDER BY key",
        )?;
        let configs = stmt
            .query_map([], |row| {
                Ok(AppConfig {
                    key: row.get(0)?,
                    value: row.get(1)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(configs)
    }

    /// 获取单个配置（排除已软删除的）
    pub fn get_config(&self, key: &str) -> Result<Option<String>, AppError> {
        let conn = self.conn.lock().map_err(|e| AppError::Custom(e.to_string()))?;
        let mut stmt = conn.prepare(
            "SELECT value FROM app_config WHERE key = ?1 AND deleted_at IS NULL",
        )?;
        let result = stmt
            .query_row([key], |row| row.get::<_, String>(0))
            .ok();
        Ok(result)
    }

    /// 设置配置（upsert）
    pub fn set_config(&self, key: &str, value: &str) -> Result<(), AppError> {
        let conn = self.conn.lock().map_err(|e| AppError::Custom(e.to_string()))?;
        conn.execute(
            "INSERT INTO app_config (key, value, updated_at)
             VALUES (?1, ?2, datetime('now', 'localtime'))
             ON CONFLICT(key) DO UPDATE SET
               value = excluded.value,
               updated_at = excluded.updated_at",
            [key, value],
        )?;
        Ok(())
    }

    /// 软删除配置（设置 deleted_at 而非物理删除）
    pub fn delete_config(&self, key: &str) -> Result<bool, AppError> {
        let conn = self.conn.lock().map_err(|e| AppError::Custom(e.to_string()))?;
        let affected = conn.execute(
            "UPDATE app_config SET deleted_at = datetime('now', 'localtime') WHERE key = ?1 AND deleted_at IS NULL",
            [key],
        )?;
        Ok(affected > 0)
    }

    /// 物理删除配置（永久删除，不可恢复）
    #[allow(dead_code)]
    pub fn hard_delete_config(&self, key: &str) -> Result<bool, AppError> {
        let conn = self.conn.lock().map_err(|e| AppError::Custom(e.to_string()))?;
        let affected = conn.execute("DELETE FROM app_config WHERE key = ?1", [key])?;
        Ok(affected > 0)
    }

    /// 恢复已软删除的配置
    #[allow(dead_code)]
    pub fn restore_config(&self, key: &str) -> Result<bool, AppError> {
        let conn = self.conn.lock().map_err(|e| AppError::Custom(e.to_string()))?;
        let affected = conn.execute(
            "UPDATE app_config SET deleted_at = NULL WHERE key = ?1 AND deleted_at IS NOT NULL",
            [key],
        )?;
        Ok(affected > 0)
    }

    // ─── 服务器 DAO ──────────────────────────────────

    /// 获取所有服务器
    pub fn get_all_servers(&self) -> Result<Vec<Server>, AppError> {
        let conn = self.conn.lock().map_err(|e| AppError::Custom(e.to_string()))?;
        let mut stmt = conn.prepare(&format!(
            "SELECT {} FROM servers ORDER BY alias",
            SERVER_COLUMNS
        ))?;
        let servers = stmt
            .query_map([], map_server_row)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(servers)
    }

    /// 按 ID 获取单台服务器
    pub fn get_server_by_id(&self, id: i64) -> Result<Option<Server>, AppError> {
        let conn = self.conn.lock().map_err(|e| AppError::Custom(e.to_string()))?;
        let mut stmt = conn.prepare(&format!(
            "SELECT {} FROM servers WHERE id = ?1",
            SERVER_COLUMNS
        ))?;
        let mut rows = stmt.query_map([id], map_server_row)?;
        rows.next().transpose().map_err(AppError::from)
    }

    /// 添加服务器
    pub fn add_server(
        &self,
        alias: &str,
        hostname: &str,
        port: i32,
        username: &str,
        auth_type: &str,
        tags: &str,
        group: &str,
        ai_policy: &str,
        os_type: &str,
        arch: &str,
    ) -> Result<i64, AppError> {
        let conn = self.conn.lock().map_err(|e| AppError::Custom(e.to_string()))?;
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        conn.execute(
            "INSERT INTO servers (alias, hostname, port, username, auth_type, tags, `group`, ai_policy, os_type, arch, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            rusqlite::params![alias, hostname, port, username, auth_type, tags, group, ai_policy, os_type, arch, now, now],
        )?;
        Ok(conn.last_insert_rowid())
    }

    /// 更新服务器
    pub fn update_server(
        &self,
        id: i64,
        alias: &str,
        hostname: &str,
        port: i32,
        username: &str,
        auth_type: &str,
        tags: &str,
        group: &str,
        ai_policy: &str,
        os_type: &str,
        arch: &str,
    ) -> Result<(), AppError> {
        let conn = self.conn.lock().map_err(|e| AppError::Custom(e.to_string()))?;
        conn.execute(
            "UPDATE servers SET alias=?1, hostname=?2, port=?3, username=?4, auth_type=?5, tags=?6, `group`=?7, ai_policy=?8, os_type=?9, arch=?10, updated_at=datetime('now','localtime')
             WHERE id=?11",
            rusqlite::params![alias, hostname, port, username, auth_type, tags, group, ai_policy, os_type, arch, id],
        )?;
        Ok(())
    }

    /// 删除服务器
    pub fn delete_server(&self, id: i64) -> Result<bool, AppError> {
        let conn = self.conn.lock().map_err(|e| AppError::Custom(e.to_string()))?;
        let affected = conn.execute("DELETE FROM servers WHERE id = ?1", [id])?;
        Ok(affected > 0)
    }

    /// 批量删除服务器，返回实际删除行数
    pub fn batch_delete_servers(&self, ids: &[i64]) -> Result<usize, AppError> {
        if ids.is_empty() {
            return Ok(0);
        }
        let conn = self.conn.lock().map_err(|e| AppError::Custom(e.to_string()))?;
        let sql = format!(
            "DELETE FROM servers WHERE id IN ({})",
            placeholders(ids.len(), 1)
        );
        let affected = conn.execute(&sql, rusqlite::params_from_iter(ids.iter()))?;
        Ok(affected)
    }

    /// 批量设置 AI 策略档位，返回实际更新行数
    pub fn batch_update_policy(&self, ids: &[i64], ai_policy: &str) -> Result<usize, AppError> {
        if ids.is_empty() {
            return Ok(0);
        }
        let conn = self.conn.lock().map_err(|e| AppError::Custom(e.to_string()))?;
        // 新增值固定占 ?1，id 列表从 ?2 开始，避免在参数迭代里混入不同类型
        let sql = format!(
            "UPDATE servers SET ai_policy = ?1, updated_at = datetime('now','localtime') \
             WHERE id IN ({})",
            placeholders(ids.len(), 2)
        );
        let mut params: Vec<&dyn rusqlite::ToSql> = Vec::with_capacity(ids.len() + 1);
        params.push(&ai_policy);
        for id in ids {
            params.push(id);
        }
        let affected = conn.execute(&sql, params.as_slice())?;
        Ok(affected)
    }

    /// 批量追加标签（与已有标签取并集，不覆盖），返回实际处理行数
    ///
    /// 用事务包住整个循环：标签是读-改-写，中途失败若只写了一半，
    /// 会出现「部分机器贴上了标签、部分没贴」的不一致状态，很难排查。
    pub fn batch_add_tags(&self, ids: &[i64], new_tags: &[String]) -> Result<usize, AppError> {
        if ids.is_empty() || new_tags.is_empty() {
            return Ok(0);
        }
        let mut conn = self.conn.lock().map_err(|e| AppError::Custom(e.to_string()))?;
        let tx = conn.transaction()?;
        let mut handled = 0usize;

        for id in ids {
            let existing: Option<String> = tx
                .query_row("SELECT tags FROM servers WHERE id = ?1", [id], |row| {
                    row.get(0)
                })
                .ok();

            // 机器可能已被他人删除，跳过而不是报错中断整批
            let Some(existing) = existing else {
                continue;
            };

            let mut merged = parse_tags(&existing);
            for tag in new_tags {
                if !merged.contains(tag) {
                    merged.push(tag.clone());
                }
            }

            tx.execute(
                "UPDATE servers SET tags = ?1, updated_at = datetime('now','localtime') WHERE id = ?2",
                rusqlite::params![serde_json::to_string(&merged)?, id],
            )?;
            handled += 1;
        }

        tx.commit()?;
        Ok(handled)
    }

    /// 切换收藏状态
    pub fn set_favorite(&self, id: i64, favorite: bool) -> Result<bool, AppError> {
        let conn = self.conn.lock().map_err(|e| AppError::Custom(e.to_string()))?;
        let affected = conn.execute(
            "UPDATE servers SET favorite = ?1, updated_at = datetime('now','localtime') WHERE id = ?2",
            rusqlite::params![favorite, id],
        )?;
        Ok(affected > 0)
    }

    /// 刷新「最近探活」时间（成功连通后调用），供「最近用过」分组排序
    pub fn touch_last_used(&self, id: i64) -> Result<(), AppError> {
        let conn = self.conn.lock().map_err(|e| AppError::Custom(e.to_string()))?;
        conn.execute(
            "UPDATE servers SET last_used_at = datetime('now','localtime') WHERE id = ?1",
            [id],
        )?;
        Ok(())
    }

    /// 记录 SSH 验证结果。
    ///
    /// fingerprint 与 arch 传空串时保留旧值，避免一次失败覆盖已确认的主机身份。
    pub fn record_ssh_result(
        &self,
        id: i64,
        status: &str,
        message: &str,
        fingerprint: &str,
        arch: &str,
    ) -> Result<(), AppError> {
        let conn = self.conn.lock().map_err(|e| AppError::Custom(e.to_string()))?;
        conn.execute(
            "UPDATE servers SET
                last_connection_status = ?1,
                last_connection_message = ?2,
                host_key_fingerprint = CASE WHEN ?3 = '' THEN host_key_fingerprint ELSE ?3 END,
                arch = CASE WHEN ?4 = '' THEN arch ELSE ?4 END,
                last_connected_at = CASE WHEN ?1 = 'verified' THEN datetime('now','localtime') ELSE last_connected_at END,
                last_used_at = CASE WHEN ?1 = 'verified' THEN datetime('now','localtime') ELSE last_used_at END,
                updated_at = datetime('now','localtime')
             WHERE id = ?5",
            rusqlite::params![status, message, fingerprint, arch, id],
        )?;
        Ok(())
    }

    // ─── 审核日志 DAO ────────────────────────────────

    /// 添加审核日志
    pub fn add_audit_log(
        &self,
        server_alias: &str,
        command: &str,
        user: &str,
        result: &str,
    ) -> Result<i64, AppError> {
        let conn = self.conn.lock().map_err(|e| AppError::Custom(e.to_string()))?;
        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        conn.execute(
            "INSERT INTO audit_logs (server_alias, command, user, result, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![server_alias, command, user, result, now],
        )?;
        Ok(conn.last_insert_rowid())
    }

    /// 获取审核日志（最近 N 条）
    pub fn get_audit_logs(&self, limit: i32) -> Result<Vec<AuditLog>, AppError> {
        let conn = self.conn.lock().map_err(|e| AppError::Custom(e.to_string()))?;
        let mut stmt = conn.prepare(
            "SELECT id, server_alias, command, user, result, created_at
             FROM audit_logs ORDER BY created_at DESC LIMIT ?1",
        )?;
        let logs = stmt
            .query_map(rusqlite::params![limit], |row| Ok(AuditLog {
                id: row.get(0)?,
                server_alias: row.get(1)?,
                command: row.get(2)?,
                user: row.get(3)?,
                result: row.get(4)?,
                created_at: row.get(5)?,
            }))?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(logs)
    }
}
