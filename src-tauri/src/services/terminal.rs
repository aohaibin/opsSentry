use std::collections::VecDeque;
use std::io::{ErrorKind, Read, Write};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, Arc};
use std::thread;
use std::time::Duration;

use dashmap::DashMap;
use ssh2::{Channel, Session};
use tauri::{AppHandle, Emitter};

use crate::database::Database;
use crate::error::AppError;
use crate::models::{
    TerminalOpenRequest, TerminalOutputEvent, TerminalSessionInfo, TerminalStatusEvent,
};
use crate::services::server::ServerService;

pub const TERMINAL_OUTPUT_EVENT: &str = "terminal-output";
pub const TERMINAL_STATUS_EVENT: &str = "terminal-status";

enum TerminalControl {
    Input(Vec<u8>),
    Resize { cols: u32, rows: u32 },
    Close,
}

/// 交互式 SSH 会话注册表。注册表只保存控制通道，不保存任何认证凭据。
pub struct TerminalManager {
    sessions: Arc<DashMap<String, mpsc::Sender<TerminalControl>>>,
    sequence: AtomicU64,
}

impl Default for TerminalManager {
    fn default() -> Self {
        Self {
            sessions: Arc::new(DashMap::new()),
            sequence: AtomicU64::new(1),
        }
    }
}

impl TerminalManager {
    pub fn open(
        &self,
        app: AppHandle,
        db: &Database,
        request: TerminalOpenRequest,
    ) -> Result<TerminalSessionInfo, AppError> {
        let (server, session) = ServerService::connect_terminal(db, &request)?;
        let mut channel = session
            .channel_session()
            .map_err(|error| AppError::Custom(format!("创建 SSH 终端通道失败: {error}")))?;
        channel
            .request_pty("xterm-256color", None, Some((120, 32, 0, 0)))
            .map_err(|error| AppError::Custom(format!("申请远程 PTY 失败: {error}")))?;
        channel
            .shell()
            .map_err(|error| AppError::Custom(format!("启动远程 Shell 失败: {error}")))?;
        session.set_blocking(false);

        let sequence = self.sequence.fetch_add(1, Ordering::Relaxed);
        let session_id = format!(
            "term-{}-{}-{}",
            server.id,
            chrono::Utc::now().timestamp_millis(),
            sequence
        );
        let (sender, receiver) = mpsc::channel();
        self.sessions.insert(session_id.clone(), sender);

        let registry = Arc::clone(&self.sessions);
        let worker_id = session_id.clone();
        thread::Builder::new()
            .name(format!("ssh-{worker_id}"))
            .spawn(move || run_terminal(app, registry, worker_id, session, channel, receiver))
            .map_err(|error| {
                self.sessions.remove(&session_id);
                AppError::Custom(format!("启动 SSH 终端线程失败: {error}"))
            })?;

        Ok(TerminalSessionInfo {
            session_id,
            server_id: server.id,
            status: "connected".into(),
            started_at: chrono::Local::now().to_rfc3339(),
        })
    }

    pub fn write(&self, session_id: &str, data: String) -> Result<(), AppError> {
        if data.is_empty() {
            return Ok(());
        }
        self.send(session_id, TerminalControl::Input(data.into_bytes()))
    }

    pub fn resize(&self, session_id: &str, cols: u32, rows: u32) -> Result<(), AppError> {
        if !(2..=500).contains(&cols) || !(1..=300).contains(&rows) {
            return Err(AppError::InvalidInput(format!(
                "终端尺寸无效: {cols}x{rows}"
            )));
        }
        self.send(session_id, TerminalControl::Resize { cols, rows })
    }

    pub fn close(&self, session_id: &str) -> Result<(), AppError> {
        if let Some(sender) = self.sessions.get(session_id) {
            sender
                .send(TerminalControl::Close)
                .map_err(|_| AppError::Custom("终端会话已经结束".into()))?;
        }
        Ok(())
    }

    fn send(&self, session_id: &str, control: TerminalControl) -> Result<(), AppError> {
        let sender = self
            .sessions
            .get(session_id)
            .ok_or_else(|| AppError::NotFound("终端会话不存在或已经结束".into()))?;
        sender
            .send(control)
            .map_err(|_| AppError::Custom("终端会话已经结束".into()))
    }
}

fn run_terminal(
    app: AppHandle,
    registry: Arc<DashMap<String, mpsc::Sender<TerminalControl>>>,
    session_id: String,
    session: Session,
    mut channel: Channel,
    receiver: mpsc::Receiver<TerminalControl>,
) {
    emit_status(&app, &session_id, "connected", "SSH 终端已连接");
    let mut pending = VecDeque::<u8>::new();
    let mut stdout = [0_u8; 8192];
    let mut stderr = [0_u8; 4096];
    let mut stderr_stream = channel.stderr();
    let mut close_requested = false;
    let mut failure_message = None;

    while !close_requested {
        loop {
            match receiver.try_recv() {
                Ok(TerminalControl::Input(data)) => pending.extend(data),
                Ok(TerminalControl::Resize { cols, rows }) => {
                    if let Err(error) = channel.request_pty_size(cols, rows, None, None) {
                        failure_message = Some(format!("调整终端尺寸失败: {error}"));
                        close_requested = true;
                        break;
                    }
                }
                Ok(TerminalControl::Close) | Err(mpsc::TryRecvError::Disconnected) => {
                    close_requested = true;
                    break;
                }
                Err(mpsc::TryRecvError::Empty) => break,
            }
        }

        if !pending.is_empty() {
            let contiguous = pending.make_contiguous();
            match channel.write(contiguous) {
                Ok(written) => {
                    pending.drain(..written);
                    let _ = channel.flush();
                }
                Err(error) if is_would_block(&error) => {}
                Err(error) => {
                    failure_message = Some(format!("写入 SSH 终端失败: {error}"));
                    break;
                }
            }
        }

        let mut received_output = false;
        match channel.read(&mut stdout) {
            Ok(0) => {}
            Ok(size) => {
                received_output = true;
                emit_output(&app, &session_id, &stdout[..size]);
            }
            Err(error) if is_would_block(&error) => {}
            Err(error) => {
                failure_message = Some(format!("读取 SSH 终端输出失败: {error}"));
                break;
            }
        }

        match stderr_stream.read(&mut stderr) {
            Ok(0) => {}
            Ok(size) => {
                received_output = true;
                emit_output(&app, &session_id, &stderr[..size]);
            }
            Err(error) if is_would_block(&error) => {}
            Err(error) => {
                failure_message = Some(format!("读取 SSH 终端错误输出失败: {error}"));
                break;
            }
        }

        if channel.eof() {
            break;
        }
        if !received_output {
            thread::sleep(Duration::from_millis(if pending.is_empty() { 12 } else { 4 }));
        }
    }

    session.set_blocking(true);
    session.set_timeout(1_000);
    let _ = channel.send_eof();
    let _ = channel.close();
    let _ = channel.wait_close();
    registry.remove(&session_id);

    if let Some(message) = failure_message {
        emit_status(&app, &session_id, "error", &message);
    } else {
        emit_status(&app, &session_id, "closed", "SSH 终端已断开");
    }
}

fn is_would_block(error: &std::io::Error) -> bool {
    error.kind() == ErrorKind::WouldBlock
        || error.to_string().contains("would block")
        || error.to_string().contains("EAGAIN")
}

fn emit_output(app: &AppHandle, session_id: &str, bytes: &[u8]) {
    let payload = TerminalOutputEvent {
        session_id: session_id.to_string(),
        data: String::from_utf8_lossy(bytes).into_owned(),
    };
    if let Err(error) = app.emit(TERMINAL_OUTPUT_EVENT, payload) {
        log::warn!("推送终端输出失败 (session={}): {}", session_id, error);
    }
}

fn emit_status(app: &AppHandle, session_id: &str, status: &str, message: &str) {
    let payload = TerminalStatusEvent {
        session_id: session_id.to_string(),
        status: status.to_string(),
        message: message.to_string(),
    };
    if let Err(error) = app.emit(TERMINAL_STATUS_EVENT, payload) {
        log::warn!("推送终端状态失败 (session={}): {}", session_id, error);
    }
}
