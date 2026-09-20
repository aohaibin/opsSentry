use crate::error::CommandError;
use crate::models::AuditLog;
use crate::services::audit::AuditService;
use crate::state::AppState;

/// 获取审核日志
#[tauri::command]
pub fn get_audit_logs(
    state: tauri::State<'_, AppState>,
    limit: i32,
) -> Result<Vec<AuditLog>, CommandError> {
    AuditService::get_logs(&state.db, limit).map_err(|e| e.into())
}

/// 添加审核日志
#[tauri::command]
pub fn add_audit_log(
    state: tauri::State<'_, AppState>,
    server_alias: String,
    command: String,
    user: String,
    result: String,
) -> Result<i64, CommandError> {
    AuditService::add_log(&state.db, &server_alias, &command, &user, &result).map_err(|e| e.into())
}
