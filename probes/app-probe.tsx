/**
 * 临时探针（用完即删）：在浏览器里伪造 Tauri IPC，再加载真实的 main 入口，
 * 这样能拿到「完整外壳（顶栏 + 导航轨）+ 真实服务器页」的截图。
 */

import { useAppStore } from "@/store/app";

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
      const fail = args?.port === 54322;
      return fail
        ? { ok: false, latency_ms: null, message: "连接被拒绝：目标端口无服务监听" }
        : { ok: true, latency_ms: args?.port === 22 ? 18 : 45, message: "TCP 握手成功" };
    }
    return null;
  },
  metadata: {
    currentWindow: { label: "main" },
    currentWebview: { label: "main" },
  },
  transformCallback: (cb: unknown) => cb,
};

// 固定暗色，避免 headless Chrome 的 prefers-color-scheme 影响截图
useAppStore.setState({ theme: "dark", skin: "obsidian" });

// 必须先设好 stub 再加载入口（静态 import 会被提升，所以这里用动态 import）
void import("@/main");

// 挂载后自动点一遍连通性探测，让截图同时呈现「稳定在线 / 不可达 / 未探测」三态
setTimeout(() => {
  document
    .querySelectorAll<HTMLElement>('button[title^="点击执行 TCP 连通性探测"]')
    .forEach((el) => el.click());
}, 2500);
