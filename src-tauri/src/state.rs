use crate::database::Database;
use crate::services::terminal::TerminalManager;

/// 应用全局状态，通过 tauri::State 注入到 Command 中
pub struct AppState {
    pub db: Database,
    pub terminals: TerminalManager,
}

impl AppState {
    pub fn new(db: Database) -> Self {
        Self {
            db,
            terminals: TerminalManager::default(),
        }
    }
}
