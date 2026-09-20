import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Empty, Input, Spin, message } from "antd";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ChevronDown,
  Clock3,
  Circle,
  Code2,
  Columns2,
  Copy,
  Download,
  Eraser,
  Folder,
  Grid2X2,
  LayoutGrid,
  List,
  Maximize2,
  PanelRight,
  Plus,
  Radio,
  Rows2,
  Search,
  Send,
  Server as ServerIcon,
  Settings2,
  Sparkles,
  Square,
  Terminal as TerminalIcon,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { SshConnectModal } from "@/components/server/SshConnectModal";
import { getErrorMessage } from "@/lib/api/client";
import { serverApi } from "@/lib/api/server";
import { useAppStore } from "@/store/app";
import type { Server, SshProbeResult } from "@/types";
import { AI_POLICY_META, OS_TYPE_LABEL } from "@/pages/servers/lib/serverMeta";

type SplitMode = "single" | "dual-h" | "dual-v" | "quad";
type DrawerTab = "monitor" | "commands" | "sftp" | "ai" | "settings" | "history" | "snippets";

const SPLIT_META: { id: SplitMode; label: string; icon: ReactNode }[] = [
  { id: "single", label: "单屏显示", icon: <Square size={14} /> },
  { id: "dual-h", label: "左右双分屏", icon: <Columns2 size={14} /> },
  { id: "dual-v", label: "上下双分屏", icon: <Rows2 size={14} /> },
  { id: "quad", label: "田字四分屏", icon: <Grid2X2 size={14} /> },
];

export default function TerminalPage() {
  const navigate = useNavigate();
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [splitMode, setSplitMode] = useState<SplitMode>("single");
  const [syncInput, setSyncInput] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sessions, setSessions] = useState<number[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  const [sshServer, setSshServer] = useState<Server | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("ai");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [command, setCommand] = useState("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const setActiveServerId = useAppStore((state) => state.setActiveServerId);

  const loadServers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await serverApi.list();
      setServers(data);
      const current = useAppStore.getState().activeServerId;
      if (current === null || !data.some((server) => server.id === current)) {
        setActiveServerId(data[0]?.id ?? null);
      }
    } catch (error) {
      message.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [setActiveServerId]);

  useEffect(() => {
    void loadServers();
  }, [loadServers]);

  const filteredServers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return servers;
    return servers.filter((server) =>
      [server.alias, server.hostname, server.username, server.group, server.tags]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [search, servers]);

  const activeServer = servers.find((server) => server.id === activeSessionId) ?? null;
  const visibleSessionIds = useMemo(() => {
    if (splitMode === "single") return activeSessionId ? [activeSessionId] : [];
    const count = splitMode === "quad" ? 4 : 2;
    return sessions.slice(0, count);
  }, [activeSessionId, sessions, splitMode]);

  const openConnection = (server: Server) => {
    setDropdownOpen(false);
    setActiveServerId(server.id);
    setSshServer(server);
  };

  const openSession = (server: Server) => {
    setActiveServerId(server.id);
    setSessions((current) => (current.includes(server.id) ? current : [...current, server.id]));
    setActiveSessionId(server.id);
  };

  const handleVerified = async (_result: SshProbeResult) => {
    if (sshServer) openSession(sshServer);
    setSshServer(null);
    await loadServers();
  };

  const closeSession = (id: number) => {
    setSessions((current) => current.filter((sessionId) => sessionId !== id));
    if (activeSessionId === id) {
      const next = sessions.find((sessionId) => sessionId !== id) ?? null;
      setActiveSessionId(next);
      setActiveServerId(next);
    }
  };

  const runCommand = () => {
    const value = command.trim();
    if (!value) return;
    setCommandHistory((current) => [...current, value]);
    setCommand("");
    message.info("终端通道尚未接入命令执行，已记录本次命令");
  };

  return (
    <div className="ops-terminal-page">
      <section className="ops-terminal-shell">
        <div className="ops-terminal-toolbar">
          <div className="flex items-center gap-2">
            <div className="ops-terminal-split-buttons">
              {SPLIT_META.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={splitMode === item.id ? "active" : ""}
                  title={item.label}
                  onClick={() => setSplitMode(item.id)}
                >
                  {item.icon}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`ops-terminal-sync ${syncInput ? "active" : ""}`}
              onClick={() => setSyncInput((current) => !current)}
              title="开启或关闭多屏实时广播输入"
            >
              <Radio size={14} />
              <span>同步输入</span>
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              className="ops-terminal-open-button"
              onClick={() => setDropdownOpen((current) => !current)}
            >
              <Plus size={14} />
              打开终端...
              <ChevronDown size={14} />
            </button>
            {dropdownOpen && (
              <div className="ops-terminal-dropdown">
                <div className="ops-terminal-dropdown-title">选择已有服务器连接</div>
                {servers.map((server) => (
                  <button key={server.id} type="button" onClick={() => openConnection(server)}>
                    <span className="flex min-w-0 items-center gap-2">
                      <Circle size={8} fill="var(--success)" color="var(--success)" />
                      <span className="truncate">{server.alias}</span>
                    </span>
                    <span>{server.hostname}</span>
                  </button>
                ))}
                {servers.length === 0 && <div className="ops-terminal-empty">暂无纳管服务器</div>}
                <button className="create" type="button" onClick={() => message.info("请先在服务器菜单新增连接") }>
                  <Plus size={14} /> 新建服务器连接...
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="ops-terminal-tabs">
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto custom-scrollbar">
            {sessions.map((id) => {
              const server = servers.find((item) => item.id === id);
              if (!server) return null;
              return (
                <button
                  key={id}
                  type="button"
                  className={`ops-terminal-tab ${activeSessionId === id ? "active" : ""}`}
                  onClick={() => {
                    setActiveSessionId(id);
                    setActiveServerId(id);
                  }}
                >
                  <Circle size={8} fill="var(--success)" color="var(--success)" />
                  <span>{server.alias}</span>
                  <X size={12} onClick={(event) => { event.stopPropagation(); closeSession(id); }} />
                </button>
              );
            })}
            <button
              type="button"
              className={`ops-terminal-tab ops-terminal-quick-tab ${activeSessionId === null ? "active" : ""}`}
              onClick={() => setActiveSessionId(null)}
            >
              <Zap size={13} />
              <span>快速连接</span>
            </button>
            <button type="button" className="ops-terminal-new-tab" title="新建终端连接" onClick={() => setActiveSessionId(null)}>
              <Plus size={14} />
            </button>
          </div>
          <div className="ops-terminal-pane-actions">
            <button type="button" title="左右双分屏" onClick={() => setSplitMode("dual-h")}><Columns2 size={14} /></button>
            <button type="button" title="最大化当前窗格" onClick={() => setSplitMode("single")}><Maximize2 size={14} /></button>
            <button type="button" title="清空终端显示" onClick={() => setCommandHistory([])}><Eraser size={14} /></button>
          </div>
        </div>

        {syncInput && (
          <div className="ops-terminal-notice">
            <Zap size={14} />
            <span><strong>同步输入已激活：</strong>键盘命令将广播到所有可见终端窗格。</span>
            <span className="ops-terminal-badge">BROADCAST_ACTIVE</span>
          </div>
        )}

        <div className="ops-terminal-workspace">
          <main className="ops-terminal-main">
            {activeSessionId === null ? (
              <QuickConnectView
                servers={filteredServers}
                loading={loading}
                search={search}
                layout={layout}
                onSearch={setSearch}
                onLayout={setLayout}
                onOpen={openConnection}
                onCreate={() => navigate("/servers")}
              />
            ) : (
              <SessionView
                servers={servers}
                visibleSessionIds={visibleSessionIds}
                activeServer={activeServer}
                command={command}
                commandHistory={commandHistory}
                onCommandChange={setCommand}
                onRunCommand={runCommand}
                splitMode={splitMode}
              />
            )}
          </main>

          {drawerOpen && (
            <TerminalDrawer
              tab={drawerTab}
              commandHistory={commandHistory}
              onClose={() => setDrawerOpen(false)}
              onInsertCommand={setCommand}
            />
          )}
          <TerminalToolRail
            active={drawerOpen ? drawerTab : null}
            onSelect={(tab) => {
              setDrawerTab(tab);
              setDrawerOpen(true);
            }}
            onToggle={() => setDrawerOpen((current) => !current)}
          />
        </div>
      </section>

      <SshConnectModal
        open={sshServer !== null}
        server={sshServer}
        onCancel={() => setSshServer(null)}
        onVerified={handleVerified}
        onStatusChanged={loadServers}
      />
    </div>
  );
}

function QuickConnectView({
  servers,
  loading,
  search,
  layout,
  onSearch,
  onLayout,
  onOpen,
  onCreate,
}: {
  servers: Server[];
  loading: boolean;
  search: string;
  layout: "grid" | "list";
  onSearch: (value: string) => void;
  onLayout: (value: "grid" | "list") => void;
  onOpen: (server: Server) => void;
  onCreate: () => void;
}) {
  return (
    <div className="ops-terminal-quick custom-scrollbar">
      <div className="ops-terminal-quick-head">
        <div className="flex min-w-0 items-center gap-2.5">
          <Zap size={19} style={{ color: "var(--nav-active-icon)" }} />
          <h2>快速连接</h2>
          <span>选一台服务器连接终端</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            prefix={<Search size={14} />}
            placeholder="搜索别名 / IP / 标签..."
            className="ops-terminal-search"
            allowClear
          />
          <div className="ops-terminal-view-toggle">
            <button type="button" className={layout === "grid" ? "active" : ""} title="网格卡片视图" onClick={() => onLayout("grid")}><LayoutGrid size={14} /></button>
            <button type="button" className={layout === "list" ? "active" : ""} title="列表精简视图" onClick={() => onLayout("list")}><List size={14} /></button>
          </div>
          <button type="button" className="ops-terminal-create-button" onClick={onCreate}>
            <Plus size={14} />
            <span>新建服务器</span>
          </button>
        </div>
      </div>

      <div className="ops-terminal-server-heading">
        <span><Circle size={8} fill="var(--success)" color="var(--success)" /> 我的服务器</span>
        <span>{servers.length} 台</span>
      </div>

      {loading && servers.length === 0 ? <Spin /> : servers.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无匹配的服务器" />
      ) : (
        <div className={layout === "grid" ? "ops-terminal-server-grid" : "ops-terminal-server-list"}>
          {servers.map((server) => <ServerCard key={server.id} server={server} compact={layout === "list"} onOpen={onOpen} />)}
        </div>
      )}

      <div className="ops-terminal-hints">
        <span>↑↓ 选择 · 回车连接 · 直接输入即搜索</span>
        <span>双击卡片开启终端 · OpsSentry PTY Engine</span>
      </div>
    </div>
  );
}

function ServerCard({ server, compact, onOpen }: { server: Server; compact: boolean; onOpen: (server: Server) => void }) {
  const policy = AI_POLICY_META[server.ai_policy as keyof typeof AI_POLICY_META];
  return (
    <button
      type="button"
      className={`ops-terminal-server-card ${compact ? "compact" : ""}`}
      onClick={() => onOpen(server)}
      onDoubleClick={() => onOpen(server)}
    >
      <span className="ops-terminal-server-icon">
        <ServerIcon size={compact ? 17 : 20} />
        <span />
      </span>
      <span className="ops-terminal-server-info">
        <span className="ops-terminal-server-title">
          <strong>{server.alias}</strong>
          <em>{policy?.label ?? server.ai_policy}</em>
        </span>
        <span className="ops-terminal-server-address">{server.username}@{server.hostname}:{server.port}</span>
        <span className="ops-terminal-server-meta">
          {OS_TYPE_LABEL[server.os_type as keyof typeof OS_TYPE_LABEL] ?? server.os_type}
          {server.group ? ` · ${server.group}` : ""}
        </span>
      </span>
      <span className="ops-terminal-server-latency">{server.last_connection_status === "verified" ? "已认证" : "待验证"}</span>
    </button>
  );
}

function SessionView({
  servers,
  visibleSessionIds,
  activeServer,
  command,
  commandHistory,
  onCommandChange,
  onRunCommand,
  splitMode,
}: {
  servers: Server[];
  visibleSessionIds: number[];
  activeServer: Server | null;
  command: string;
  commandHistory: string[];
  onCommandChange: (value: string) => void;
  onRunCommand: () => void;
  splitMode: SplitMode;
}) {
  if (!activeServer) return <Empty description="请选择终端会话" />;
  return (
    <div
      className="ops-terminal-session-grid"
      data-split-count={visibleSessionIds.length}
      data-split-mode={splitMode}
    >
      {visibleSessionIds.map((id) => {
        const server = servers.find((item) => item.id === id) ?? activeServer;
        return (
          <div className="ops-terminal-pane" key={id}>
            <div className="ops-terminal-pane-head">
              <span><span className="ops-terminal-online-dot" />{server.username}@{server.alias} ({server.hostname}:{server.port})</span>
              <span>SSH 会话 · UTF-8</span>
            </div>
            <div className="ops-terminal-output">
              <p className="muted">Connected to {server.hostname}</p>
              <p className="muted">Last login: interactive session</p>
              <p><span className="cyan">{server.username}@{server.alias}</span>:<span className="indigo">~</span>$ {commandHistory.length > 0 ? commandHistory[commandHistory.length - 1] : ""}</p>
              {commandHistory.length > 0 && <p className="green">Command queued for the active SSH channel.</p>}
              <p><span className="cyan">{server.username}@{server.alias}</span>:<span className="indigo">~</span>$ <span className="cursor" /></p>
            </div>
            <div className="ops-terminal-commandbar">
              <span className="cyan">$</span>
              <input value={command} onChange={(event) => onCommandChange(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") onRunCommand(); }} placeholder="输入命令..." aria-label="终端命令" />
              <button type="button" title="发送命令" onClick={onRunCommand}><Send size={13} /></button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TerminalToolRail({
  active,
  onSelect,
  onToggle,
}: {
  active: DrawerTab | null;
  onSelect: (tab: DrawerTab) => void;
  onToggle: () => void;
}) {
  const tools: { id: DrawerTab; label: string; icon: ReactNode }[] = [
    { id: "monitor", label: "主机实时探针监控", icon: <Activity size={16} /> },
    { id: "commands", label: "常用快捷命令库", icon: <TerminalIcon size={16} /> },
    { id: "sftp", label: "SFTP 实时文件树", icon: <Folder size={16} /> },
    { id: "ai", label: "AI 智能排障协同", icon: <Sparkles size={16} /> },
    { id: "settings", label: "终端外观与连接配置", icon: <Settings2 size={16} /> },
    { id: "history", label: "命令历史记录", icon: <Clock3 size={16} /> },
    { id: "snippets", label: "常用脚本片段库", icon: <Code2 size={16} /> },
  ];

  return (
    <aside className="ops-terminal-rail">
      {tools.slice(0, 3).map((tool) => (
        <button key={tool.id} type="button" className={active === tool.id ? "active" : ""} title={tool.label} onClick={() => onSelect(tool.id)}>
          {tool.icon}
        </button>
      ))}
      <button type="button" title="上传本地文件到当前终端" onClick={() => message.info("请在 SFTP 模块选择本地文件上传")}><Upload size={16} /></button>
      <button type="button" title="从当前终端下载文件" onClick={() => message.info("请在 SFTP 模块选择远程文件下载")}><Download size={16} /></button>
      {tools.slice(3).map((tool) => (
        <button key={tool.id} type="button" className={active === tool.id ? "active" : ""} title={tool.label} onClick={() => onSelect(tool.id)}>
          {tool.icon}
        </button>
      ))}
      <button type="button" className="mt-auto" title="展开或收起辅助工具抽屉" onClick={onToggle}><PanelRight size={16} /></button>
    </aside>
  );
}

function TerminalDrawer({
  tab,
  commandHistory,
  onClose,
  onInsertCommand,
}: {
  tab: DrawerTab;
  commandHistory: string[];
  onClose: () => void;
  onInsertCommand: (command: string) => void;
}) {
  const titles: Record<DrawerTab, string> = {
    monitor: "主机实时探针",
    commands: "常用快捷命令",
    sftp: "SFTP 实时文件树",
    ai: "AI 智能排障协同",
    settings: "终端显示设置",
    history: "终端会话历史",
    snippets: "常用脚本片段",
  };
  const commands = [
    "systemctl status nginx",
    "docker ps --format table",
    "ss -tulwn | grep LISTEN",
    "tail -f -n 100 /var/log/nginx/error.log",
  ];

  return (
    <aside className="ops-terminal-drawer">
      <div className="ops-terminal-drawer-head">
        <span><Sparkles size={15} />{titles[tab]}</span>
        <button type="button" title="关闭辅助工具" onClick={onClose}><X size={14} /></button>
      </div>
      <div className="ops-terminal-drawer-body custom-scrollbar">
        {tab === "ai" && (
          <>
            <div className="ops-terminal-drawer-note">
              <Sparkles size={14} />
              <span>选中终端中的报错信息后，可在这里继续诊断。</span>
            </div>
            <div className="ops-terminal-drawer-card">
              <strong>诊断建议</strong>
              <p>先检查服务状态、端口监听和最近错误日志，再决定是否执行变更操作。</p>
            </div>
            <div className="ops-terminal-ai-input">
              <Input placeholder="输入排障指令或追问..." />
              <button type="button" title="发送给 AI"><Send size={14} /></button>
            </div>
          </>
        )}
        {tab === "commands" && (
          <div className="space-y-2">
            {commands.map((item) => (
              <button key={item} type="button" className="ops-terminal-command-item" onClick={() => onInsertCommand(item)}>
                <span>{item}</span><Copy size={13} />
              </button>
            ))}
          </div>
        )}
        {tab === "monitor" && (
          <div className="ops-terminal-metrics">
            <Metric label="CPU 使用率" value="--" />
            <Metric label="内存占用" value="--" />
            <Metric label="根磁盘" value="--" />
            <Metric label="系统负载" value="--" />
          </div>
        )}
        {tab === "sftp" && <DrawerEmpty icon={<Folder size={18} />} text="选择终端会话后加载远程目录" />}
        {tab === "settings" && (
          <div className="ops-terminal-settings-list">
            <div><span>终端字体</span><strong>Cascadia Code</strong></div>
            <div><span>字符编码</span><strong>UTF-8</strong></div>
            <div><span>颜色方案</span><strong>跟随主题</strong></div>
          </div>
        )}
        {tab === "history" && (
          commandHistory.length > 0
            ? commandHistory.map((item, index) => <button key={`${item}-${index}`} type="button" className="ops-terminal-history-item" onClick={() => onInsertCommand(item)}>{item}</button>)
            : <DrawerEmpty icon={<Clock3 size={18} />} text="暂无命令记录" />
        )}
        {tab === "snippets" && <DrawerEmpty icon={<Code2 size={18} />} text="暂无已保存的脚本片段" />}
      </div>
    </aside>
  );
}

function DrawerEmpty({ icon, text }: { icon: ReactNode; text: string }) {
  return <div className="ops-terminal-drawer-empty">{icon}<span>{text}</span></div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}
