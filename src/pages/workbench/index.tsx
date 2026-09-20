import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Empty, Spin, Tag, Tooltip, message } from "antd";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Fingerprint,
  Info,
  MonitorCog,
  Network,
  RefreshCw,
  Server as ServerIcon,
  ShieldCheck,
  Terminal,
  UserRound,
} from "lucide-react";
import { SshConnectModal } from "@/components/server/SshConnectModal";
import { getErrorMessage } from "@/lib/api/client";
import { serverApi } from "@/lib/api/server";
import { requireModule } from "@/navigation/modules";
import type { AIPolicy, OsType, Server } from "@/types";
import {
  AI_POLICY_META,
  OS_TYPE_LABEL,
  formatRelativeTime,
} from "@/pages/servers/lib/serverMeta";

/** 模块元信息取自注册表，与导航 tooltip、占位页共用一份文案 */
const MODULE = requireModule("workbench");

const SSH_STATUS_META: Record<
  string,
  { label: string; color: string; tone: string }
> = {
  unknown: { label: "未验证", color: "default", tone: "var(--text-muted)" },
  verified: { label: "已认证", color: "success", tone: "var(--success)" },
  failed: { label: "验证失败", color: "error", tone: "var(--danger)" },
  host_key_changed: { label: "指纹变化", color: "warning", tone: "var(--warning)" },
};

export default function WorkbenchPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [sshServer, setSshServer] = useState<Server | null>(null);

  const loadServers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await serverApi.list();
      setServers(data);
      setSelectedId((current) => {
        if (current !== null && data.some((server) => server.id === current)) {
          return current;
        }
        return data[0]?.id ?? null;
      });
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadServers();
  }, [loadServers]);

  const selectedServer = useMemo(
    () => servers.find((server) => server.id === selectedId) ?? null,
    [servers, selectedId]
  );

  const stats = useMemo(() => {
    const verified = servers.filter(
      (server) => server.last_connection_status === "verified"
    ).length;
    return {
      total: servers.length,
      verified,
      attention: servers.length - verified,
      linux: servers.filter((server) => server.os_type === "linux").length,
      windows: servers.filter((server) => server.os_type === "windows").length,
    };
  }, [servers]);

  const statusMeta = selectedServer
    ? SSH_STATUS_META[selectedServer.last_connection_status] ?? SSH_STATUS_META.unknown
    : SSH_STATUS_META.unknown;

  return (
    <div className="ops-page space-y-4">
      <div className="ops-page-head">
        <div style={{ minWidth: 0 }}>
          {/* 标题与说明同样取自模块注册表 */}
          <h1 className="ops-page-title">
            <MODULE.icon size={18} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
            <span>{MODULE.title}</span>
            <span className="ops-page-subtitle">（{MODULE.subtitle}）</span>
          </h1>
          <p className="ops-page-desc">{MODULE.desc}</p>
        </div>
        <Tooltip title="刷新服务器状态">
          <Button
            icon={<RefreshCw size={14} />}
            loading={loading}
            onClick={() => void loadServers()}
          />
        </Tooltip>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Metric label="服务器总数" value={stats.total} suffix="台" icon={<ServerIcon size={16} />} />
        <Metric
          label="SSH 已认证"
          value={stats.verified}
          suffix="台"
          tone="var(--success)"
          icon={<CheckCircle2 size={16} />}
        />
        <Metric
          label="待处理"
          value={stats.attention}
          suffix="台"
          tone={stats.attention > 0 ? "var(--warning)" : "var(--text-primary)"}
          icon={<AlertTriangle size={16} />}
        />
        <Metric
          label="Linux / Windows"
          value={`${stats.linux} / ${stats.windows}`}
          icon={<Network size={16} />}
        />
      </div>

      {/*
        原型 VIEW 2 的「主机工作台全景」是一屏实时探针（CPU / 内存 / Load / 根磁盘 环形图
        + 公网内网 IP + 运行时长 + 快捷操作条）。那套画面依赖后端持续采集主机指标，
        指标通道未落地前先不做——画一屏不动的假环形图比空着更糟。
        这里保留的是已经能跑通的部分：资产连接状态与 SSH 主机身份核验。
      */}
      <div
        className="flex items-start"
        style={{
          gap: 8,
          padding: "10px 12px",
          borderRadius: 10,
          border: "1px solid var(--border)",
          borderLeft: "2px solid var(--warning)",
          background: "var(--bg-secondary)",
        }}
      >
        <Info size={13} style={{ color: "var(--warning)", marginTop: 2, flexShrink: 0 }} />
        <p style={{ fontSize: 11, lineHeight: 1.8, color: "var(--text-secondary)" }}>
          原型的实时探针（CPU / 内存 / Load / 磁盘）与快捷操作条需要后端主机指标采集能力，
          尚未实现。本页当前提供资产连接总览与 SSH 指纹核验。
        </p>
      </div>

      <Spin spinning={loading && servers.length === 0}>
        {servers.length === 0 && !loading ? (
          <div className="py-16" style={{ borderTop: "1px solid var(--border)" }}>
            <Empty description="暂无服务器，请先到服务器资产页添加" />
          </div>
        ) : (
          <div
            className="ops-panel grid grid-cols-1 lg:grid-cols-[minmax(260px,340px)_minmax(0,1fr)] min-h-[480px] overflow-hidden"
            style={{ borderRadius: 8 }}
          >
            <aside
              className="overflow-y-auto custom-scrollbar"
              style={{ borderRight: "1px solid var(--border)", background: "var(--bg-secondary)" }}
            >
              <div
                className="px-3 py-2 text-xs font-medium"
                style={{ color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}
              >
                服务器（{servers.length}）
              </div>
              <div className="p-2 space-y-1">
                {servers.map((server) => {
                  const meta =
                    SSH_STATUS_META[server.last_connection_status] ?? SSH_STATUS_META.unknown;
                  const active = server.id === selectedId;
                  return (
                    <button
                      key={server.id}
                      type="button"
                      className="w-full text-left px-3 py-2.5 transition-colors"
                      style={{
                        borderRadius: 6,
                        border: `1px solid ${active ? "var(--primary)" : "transparent"}`,
                        background: active ? "var(--bg-elevated)" : "transparent",
                      }}
                      onClick={() => setSelectedId(server.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="text-xs font-medium truncate"
                          style={{ color: "var(--text-primary)" }}
                        >
                          {server.alias}
                        </span>
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: meta.tone }}
                          title={meta.label}
                        />
                      </div>
                      <div
                        className="text-[11px] mt-1 truncate"
                        style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
                      >
                        {server.username}@{server.hostname}:{server.port}
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <main className="min-w-0 p-4 lg:p-5">
              {selectedServer ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-medium" style={{ color: "var(--text-primary)" }}>
                          {selectedServer.alias}
                        </h2>
                        <Tag color={statusMeta.color} className="m-0">
                          {statusMeta.label}
                        </Tag>
                      </div>
                      <p
                        className="text-xs mt-1"
                        style={{ color: "var(--text-secondary)", fontFamily: "var(--font-mono)" }}
                      >
                        {selectedServer.hostname}:{selectedServer.port}
                      </p>
                    </div>
                    <Button
                      type="primary"
                      icon={<Terminal size={14} />}
                      onClick={() => setSshServer(selectedServer)}
                    >
                      SSH 验证
                    </Button>
                  </div>

                  <section>
                    <h3 className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                      连接信息
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
                      <Detail icon={<UserRound size={14} />} label="登录用户" value={selectedServer.username} />
                      <Detail
                        icon={<ShieldCheck size={14} />}
                        label="认证方式"
                        value={selectedServer.auth_type === "key" ? "SSH 私钥" : "密码"}
                      />
                      <Detail
                        icon={<MonitorCog size={14} />}
                        label="操作系统"
                        value={`${OS_TYPE_LABEL[selectedServer.os_type as OsType] ?? selectedServer.os_type}${
                          selectedServer.arch ? ` · ${selectedServer.arch}` : ""
                        }`}
                      />
                      <Detail
                        icon={<ShieldCheck size={14} />}
                        label="AI 策略"
                        value={AI_POLICY_META[selectedServer.ai_policy as AIPolicy]?.label ?? selectedServer.ai_policy}
                      />
                    </div>
                  </section>

                  <section style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                    <h3 className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                      SSH 主机身份
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                      <Detail
                        icon={<Clock3 size={14} />}
                        label="最近认证"
                        value={
                          selectedServer.last_connected_at
                            ? `${formatRelativeTime(selectedServer.last_connected_at)} · ${selectedServer.last_connected_at}`
                            : "从未认证"
                        }
                      />
                      <Detail
                        icon={<Fingerprint size={14} />}
                        label="主机指纹"
                        value={selectedServer.host_key_fingerprint || "尚未确认"}
                        mono
                        wrap
                      />
                    </div>
                  </section>

                  <section style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                    <h3 className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>
                      最近结果
                    </h3>
                    <div
                      className="text-xs leading-6 px-3 py-2"
                      style={{
                        color: statusMeta.tone,
                        background: "var(--bg-secondary)",
                        borderRadius: 6,
                      }}
                    >
                      {selectedServer.last_connection_message || "尚未执行 SSH 验证"}
                    </div>
                  </section>
                </div>
              ) : (
                <Empty description="请选择服务器" />
              )}
            </main>
          </div>
        )}
      </Spin>

      <SshConnectModal
        open={sshServer !== null}
        server={sshServer}
        onCancel={() => setSshServer(null)}
        onVerified={async () => {
          await loadServers();
        }}
        onStatusChanged={loadServers}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  suffix,
  tone = "var(--text-primary)",
  icon,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  tone?: string;
  icon: ReactNode;
}) {
  return (
    // 卡片形态对齐原型 VIEW 2 的探针卡：glass-card + rounded-xl + 等宽大数字
    <div
      className="glass-card"
      style={{ padding: 14, borderRadius: 12, border: "1px solid var(--border)" }}
    >
      <div
        className="flex items-center"
        style={{ gap: 6, fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}
      >
        {icon}
        {label}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 20,
          fontWeight: 900,
          fontFamily: "var(--font-mono)",
          color: tone,
        }}
      >
        {value}
        {suffix && (
          <span style={{ marginLeft: 4, fontSize: 12, fontWeight: 400, color: "var(--text-muted)" }}>
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}

function Detail({
  icon,
  label,
  value,
  mono = false,
  wrap = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  wrap?: boolean;
}) {
  return (
    <div className="grid grid-cols-[112px_minmax(0,1fr)] items-start gap-3 text-xs">
      <div className="flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
        {icon}
        {label}
      </div>
      <div
        className={wrap ? "break-all" : "truncate"}
        style={{ color: "var(--text-primary)", fontFamily: mono ? "var(--font-mono)" : undefined }}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}
