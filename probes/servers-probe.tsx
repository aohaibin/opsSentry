/**
 * 临时视觉验证探针（用完即删，不属于产品代码）。
 *
 * 浏览器里没有 Tauri 后端，列表永远是空的，没法验证表格行。
 * 这里伪造 window.__TAURI_INTERNALS__.invoke，喂一批假资产，
 * 让真实的 ServersPage 在真样式下渲染出来，用于截图核对与原型的一致性。
 */

import { createRoot } from "react-dom/client";
import { ConfigProvider } from "antd";
import { StyleProvider } from "@ant-design/cssinjs";
import { HashRouter } from "react-router-dom";
import zhCN from "antd/locale/zh_CN";
import "@/styles/global.css";
import { getAntdTheme } from "@/theme/antdTheme";
import ServersPage from "@/pages/servers";

const SERVERS = [
  {
    id: 1,
    alias: "prod-api-01 (我的腾讯云0209)",
    hostname: "192.168.1.102",
    port: 22,
    username: "root",
    auth_type: "key",
    tags: '["生产环境","Node/Nginx","腾讯云"]',
    group: "生产集群",
    ai_policy: "approval",
    os_type: "linux",
    favorite: true,
    arch: "x86_64",
    last_used_at: "2026-09-20 07:50:00",
    host_key_fingerprint: "SHA256:9f2c1b7d4e8a",
    last_connection_status: "verified",
    last_connection_message: "SSH 握手成功，主机指纹已核验",
    last_connected_at: "2026-09-20 07:50:00",
    created_at: "2026-09-01 10:00:00",
    updated_at: "2026-09-20 07:50:00",
  },
  {
    id: 2,
    alias: "prod-db-master",
    hostname: "10.0.0.88",
    port: 54322,
    username: "admin",
    auth_type: "password",
    tags: '["核心库","PostgreSQL 15"]',
    group: "生产集群",
    ai_policy: "allowlist",
    os_type: "linux",
    favorite: false,
    arch: "x86_64",
    last_used_at: "2026-09-19 22:10:00",
    host_key_fingerprint: "",
    last_connection_status: "unknown",
    last_connection_message: "",
    last_connected_at: null,
    created_at: "2026-09-02 10:00:00",
    updated_at: "2026-09-19 22:10:00",
  },
  {
    id: 3,
    alias: "test-gateway-hk",
    hostname: "47.242.8.19",
    port: 22,
    username: "ubuntu",
    auth_type: "key",
    tags: '["开发测试","Kong / Redis"]',
    group: "开发测试",
    ai_policy: "trusted",
    os_type: "linux",
    favorite: false,
    arch: "x86_64",
    last_used_at: "2026-09-18 09:30:00",
    host_key_fingerprint: "SHA256:1a2b3c4d5e6f",
    last_connection_status: "host_key_changed",
    last_connection_message: "远端主机指纹与已保存值不一致，已拒绝连接",
    last_connected_at: "2026-09-18 09:30:00",
    created_at: "2026-09-03 10:00:00",
    updated_at: "2026-09-18 09:30:00",
  },
  {
    id: 4,
    alias: "win-build-01",
    hostname: "10.0.2.15",
    port: 22,
    username: "builder",
    auth_type: "password",
    tags: '["WinServer","OpenSSH/PowerShell"]',
    group: "开发测试",
    ai_policy: "denied",
    os_type: "windows",
    favorite: false,
    arch: "x86_64",
    last_used_at: null,
    host_key_fingerprint: "",
    last_connection_status: "failed",
    last_connection_message: "认证失败：用户名或口令不正确",
    last_connected_at: "2026-09-17 15:02:00",
    created_at: "2026-09-04 10:00:00",
    updated_at: "2026-09-17 15:02:00",
  },
];

(window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
  invoke: async (cmd: string, args: Record<string, unknown>) => {
    if (cmd === "list_servers") return SERVERS;
    if (cmd === "test_server_connectivity") {
      // 让 54322 那一台失败，好同时看到「不可达」与「稳定在线」两种态
      const fail = args?.port === 54322;
      return fail
        ? { ok: false, latency_ms: null, message: "连接被拒绝：目标端口无服务监听" }
        : { ok: true, latency_ms: args?.port === 22 ? 18 : 45, message: "TCP 握手成功" };
    }
    return null;
  },
};

// antd 主题必须跟着页面上的 data-theme 走：
// 探针里写死 dark 会让 antd 的容器底色（固定列、表头）与亮色皮肤错配，
// 表现为「亮色主题下操作列是一块深色」——那是探针的假象，不是产品问题。
const resolvedTheme: "light" | "dark" =
  document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";

createRoot(document.getElementById("root")!).render(
  <StyleProvider layer>
    <ConfigProvider locale={zhCN} theme={getAntdTheme(resolvedTheme)}>
      <HashRouter>
        <div style={{ minHeight: "100vh", background: "var(--bg-primary)", padding: 16 }}>
          <ServersPage />
        </div>
      </HashRouter>
    </ConfigProvider>
  </StyleProvider>
);

// 挂载后自动点一遍「连通性探测」，让截图能同时看到在线 / 不可达 / 未探测三种状态
setTimeout(() => {
  document
    .querySelectorAll<HTMLElement>('button[title^="点击执行 TCP 连通性探测"]')
    .forEach((el) => el.click());
}, 2000);
