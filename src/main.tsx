import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow, type Window } from "@tauri-apps/api/window";
import App from "./App";
import "./styles/global.css";

// ─── 窗口显示兜底机制 ────────────────────────
// WebView2 初始化可能阻塞事件循环，导致窗口不可见
// 使用多层兜底确保窗口最终可见（参考 tauri-cc 经验）
//
// 注意：这一句必须在 try/catch 里。getCurrentWindow() 会读取
// window.__TAURI_INTERNALS__.metadata，在 Tauri webview 之外（例如用 vite dev
// 直接在浏览器里看界面）该对象不存在，会抛 TypeError。而这里是模块顶层，
// 一旦抛出整个入口模块就不会执行，表现为「页面全白、React 完全不挂载」，
// 排查起来非常费劲。捕获后降级为 null，浏览器里照样能正常渲染界面。
function getAppWindow(): Window | null {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

const appWindow = getAppWindow();

// 立即尝试显示
appWindow?.show().catch(() => {});

// 500ms 重试
setTimeout(() => {
  appWindow?.show().catch(() => {});
}, 500);

// 5s 最终兜底
setTimeout(() => {
  appWindow?.show().catch(() => {});
}, 5000);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
