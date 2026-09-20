import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tooltip,
  message,
  type TableProps,
} from "antd";
import {
  Blocks,
  FileCode,
  Monitor,
  MonitorUp,
  Plus,
  ShieldCheck,
  Server as ServerIcon,
  Star,
} from "lucide-react";
import type {
  AIPolicy,
  AuthType,
  ConnectivityResult,
  OsType,
  Server,
  ServerPayload,
  SshCredentials,
} from "@/types";
import { serverApi } from "@/lib/api/server";
import { getErrorMessage } from "@/lib/api/client";
import { SshConnectModal } from "@/components/server/SshConnectModal";
import { useAppStore } from "@/store/app";
import { modulePath, requireModule } from "@/navigation/modules";
import { ServerGroupPanel } from "./components/ServerGroupPanel";
import { ServerToolbar, type OsFilter } from "./components/ServerToolbar";
import { ServerFormModal } from "./components/ServerFormModal";
import { BatchActionBar } from "./components/BatchActionBar";
import { WindowsGuideModal } from "./components/WindowsGuideModal";
import { ImportSSHConfigModal } from "./components/ImportSSHConfigModal";
import { AiPolicyBadge } from "./components/AiPolicyBadge";
import { ServerRowActions } from "./components/ServerRowActions";
import {
  AI_POLICY_META,
  AI_POLICY_ORDER,
  AUTH_TYPE_LABEL,
  OS_TYPE_LABEL,
  VIRTUAL_GROUP_ALL,
  VIRTUAL_GROUP_RECENT,
  VIRTUAL_GROUP_STARRED,
  collectTagStats,
  formatRelativeTime,
  matchServer,
  parseTags,
} from "./lib/serverMeta";

/** 模块元信息（标题 / 副标题 / 定位说明）取自注册表，避免与导航、占位页三处各写一份 */
const MODULE = requireModule("servers");

/** 每行的探测状态：探测中、已出结果、或尚未探测 */
type ProbeState = Record<number, ConnectivityResult | "testing">;

/** 行内标签胶囊，对齐原型（px-1.5 rounded text-[10px] bg-slate-800 border-slate-700） */
const TAG_PILL: CSSProperties = {
  padding: "1px 6px",
  borderRadius: 4,
  fontSize: 10,
  lineHeight: "16px",
  background: "var(--bg-secondary)",
  border: "1px solid var(--border)",
  color: "var(--text-secondary)",
};

/**
 * SSH 身份认证状态。
 *
 * 原型没有独立的 SSH 状态列，但「主机指纹是否已核验」是这套产品的核心安全态。
 * 直接抹掉会让这张表失去最关键的一条信息，所以压成「认证方式」胶囊右侧的一颗 5px 状态点，
 * 完整结论仍走悬停提示——视觉上基本不增加体量。
 */
const SSH_STATUS_META: Record<string, { label: string; tone: string }> = {
  unknown: { label: "未验证", tone: "var(--text-muted)" },
  verified: { label: "已认证", tone: "var(--success)" },
  failed: { label: "验证失败", tone: "var(--danger)" },
  host_key_changed: { label: "指纹变化", tone: "var(--warning)" },
};

export default function ServersPage() {
  const [servers, setServers] = useState<Server[]>([]);
  const [loading, setLoading] = useState(false);
  const [probeStates, setProbeStates] = useState<ProbeState>({});

  const [keyword, setKeyword] = useState("");
  const [osFilter, setOsFilter] = useState<OsFilter>("all");
  const [activeGroup, setActiveGroup] = useState<string>(VIRTUAL_GROUP_ALL);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [batchPinging, setBatchPinging] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [presetGroup, setPresetGroup] = useState<string | undefined>(undefined);

  const [windowsGuideOpen, setWindowsGuideOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [sshServer, setSshServer] = useState<Server | null>(null);
  const [sshInitialCredentials, setSshInitialCredentials] = useState<SshCredentials>();

  const [groupNameOpen, setGroupNameOpen] = useState(false);
  const [pendingGroupName, setPendingGroupName] = useState("");

  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [policyInput, setPolicyInput] = useState<AIPolicy>("approval");

  const navigate = useNavigate();
  const setActiveServerId = useAppStore((s) => s.setActiveServerId);

  const loadServers = useCallback(async (): Promise<Server[]> => {
    setLoading(true);
    try {
      const data = await serverApi.list();
      setServers(data);
      // 记录可能已被批量删除，同步清掉失效的选中项，否则批量条会显示幽灵计数
      setSelectedIds((prev) => prev.filter((id) => data.some((s) => s.id === id)));
      return data;
    } catch (e) {
      message.error(getErrorMessage(e));
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadServers();
  }, [loadServers]);

  const tagStats = useMemo(() => collectTagStats(servers), [servers]);

  /** 应用分组 / 搜索 / 标签三重过滤，但不含系统筛选——系统计数要基于这一层统计 */
  const baseList = useMemo(() => {
    return servers.filter((server) => {
      if (activeGroup === VIRTUAL_GROUP_STARRED && !server.favorite) return false;
      if (activeGroup === VIRTUAL_GROUP_RECENT && !server.last_used_at) return false;
      if (
        activeGroup !== VIRTUAL_GROUP_ALL &&
        activeGroup !== VIRTUAL_GROUP_STARRED &&
        activeGroup !== VIRTUAL_GROUP_RECENT &&
        server.group !== activeGroup
      ) {
        return false;
      }

      if (selectedTags.length > 0) {
        const tags = parseTags(server.tags);
        if (!selectedTags.every((tag) => tags.includes(tag))) return false;
      }

      return matchServer(server, keyword);
    });
  }, [servers, activeGroup, selectedTags, keyword]);

  const osCounts = useMemo<Record<OsFilter, number>>(
    () => ({
      all: baseList.length,
      linux: baseList.filter((s) => s.os_type === "linux").length,
      windows: baseList.filter((s) => s.os_type === "windows").length,
    }),
    [baseList]
  );

  const visibleServers = useMemo(() => {
    const list =
      osFilter === "all"
        ? baseList
        : baseList.filter((s) => s.os_type === osFilter);

    // 「最近用过」按最后探活时间倒序，否则这个分组看不出「最近」的含义
    if (activeGroup === VIRTUAL_GROUP_RECENT) {
      return [...list].sort((a, b) =>
        (b.last_used_at ?? "").localeCompare(a.last_used_at ?? "")
      );
    }
    return list;
  }, [baseList, osFilter, activeGroup]);

  const handleToggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const resetAllFilters = () => {
    setKeyword("");
    setOsFilter("all");
    setSelectedTags([]);
    setActiveGroup(VIRTUAL_GROUP_ALL);
  };

  /**
   * 跳到目标模块，并把该主机写进顶栏的「当前会话」。
   * 原型是 switchHost() + switchTab()，这里对应 setActiveServerId() + 路由跳转——
   * 不同步会话的话，切过去看到的会是上一次选中的机器，在多机运维里属于危险误导。
   */
  const goModule = useCallback(
    (moduleKey: string, server: Server) => {
      setActiveServerId(server.id);
      navigate(modulePath(moduleKey));
    },
    [navigate, setActiveServerId]
  );

  const handleSave = async (payload: ServerPayload, credentials?: SshCredentials) => {
    try {
      let savedServerId: number;
      if (editingServer) {
        await serverApi.update(editingServer.id, payload);
        savedServerId = editingServer.id;
        message.success("服务器已更新");
      } else {
        savedServerId = await serverApi.add(payload);
        message.success("服务器已纳管");
      }
      setFormOpen(false);
      setEditingServer(null);
      setPresetGroup(undefined);
      const nextServers = await loadServers();
      const savedServer = nextServers.find((item) => item.id === savedServerId);
      if (credentials && savedServer) {
        setSshInitialCredentials(credentials);
        setSshServer(savedServer);
      }
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  };

  const handleDelete = (server: Server) => {
    Modal.confirm({
      title: "移除服务器",
      content: `确定将「${server.alias}」从资产清单中移除吗？该操作不可撤销。`,
      okText: "移除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        try {
          await serverApi.delete(server.id);
          message.success("已移除");
          await loadServers();
        } catch (e) {
          message.error(getErrorMessage(e));
        }
      },
    });
  };

  const handleToggleFavorite = async (server: Server) => {
    try {
      await serverApi.setFavorite(server.id, !server.favorite);
      // 本地先改，避免整表刷新导致的闪烁；失败时 loadServers 会把状态拉回真实值
      setServers((prev) =>
        prev.map((item) =>
          item.id === server.id ? { ...item, favorite: !item.favorite } : item
        )
      );
    } catch (e) {
      message.error(getErrorMessage(e));
      await loadServers();
    }
  };

  const probeOne = useCallback(async (server: Server): Promise<boolean> => {
    setProbeStates((prev) => ({ ...prev, [server.id]: "testing" }));
    try {
      const result = await serverApi.testConnectivity(
        server.hostname,
        server.port,
        server.id
      );
      setProbeStates((prev) => ({ ...prev, [server.id]: result }));
      return result.ok;
    } catch (e) {
      setProbeStates((prev) => ({
        ...prev,
        [server.id]: { ok: false, latency_ms: null, message: getErrorMessage(e) },
      }));
      return false;
    }
  }, []);

  const handleProbe = async (server: Server) => {
    const ok = await probeOne(server);
    // 探活成功会在后端刷新「最近用过」，重新拉一次列表让左栏计数同步，
    // 比在前端手工拼时间戳更可靠（本地时钟与数据库时钟可能不一致）
    if (ok) {
      await loadServers();
    }
  };

  const handleBatchPing = async () => {
    const targets = servers.filter((s) => selectedIds.includes(s.id));
    if (targets.length === 0) return;

    setBatchPinging(true);
    // 并发探测：单台最长阻塞 3 秒，串行探测 20 台要等一分钟，体验无法接受
    const results = await Promise.all(targets.map((server) => probeOne(server)));
    setBatchPinging(false);

    const okCount = results.filter(Boolean).length;
    const failCount = results.length - okCount;
    if (failCount === 0) {
      message.success(`${okCount} 台主机全部连通`);
    } else {
      message.warning(`${okCount} 台连通，${failCount} 台不可达，详见各行状态`);
    }

    if (okCount > 0) {
      await loadServers();
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) return;
    const aliases = servers
      .filter((s) => selectedIds.includes(s.id))
      .map((s) => s.alias);

    Modal.confirm({
      title: "批量移除服务器",
      width: 520,
      content: (
        <div className="text-xs space-y-2">
          <p>以下 {aliases.length} 台服务器将从资产清单中移除，该操作不可撤销：</p>
          <div
            className="max-h-40 overflow-y-auto custom-scrollbar p-2 rounded"
            style={{ background: "var(--bg-secondary)" }}
          >
            {aliases.map((alias) => (
              <div key={alias} style={{ fontFamily: "var(--font-mono)" }}>
                {alias}
              </div>
            ))}
          </div>
        </div>
      ),
      okText: "全部移除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        try {
          const removed = await serverApi.batchDelete(selectedIds);
          message.success(`已移除 ${removed} 台`);
          setSelectedIds([]);
          await loadServers();
        } catch (e) {
          message.error(getErrorMessage(e));
        }
      },
    });
  };

  const handleBatchTag = async () => {
    const tags = tagInput
      .split(/[,，、]/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length === 0) {
      message.warning("请填写至少一个标签");
      return;
    }

    try {
      const handled = await serverApi.batchAddTags(selectedIds, tags);
      message.success(`已为 ${handled} 台主机追加标签`);
      setTagModalOpen(false);
      setTagInput("");
      setSelectedIds([]);
      await loadServers();
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  };

  const handleBatchPolicy = async () => {
    try {
      const handled = await serverApi.batchUpdatePolicy(selectedIds, policyInput);
      message.success(`已将 ${handled} 台主机的 AI 策略调整为「${AI_POLICY_META[policyInput].label}」`);
      setPolicyModalOpen(false);
      setSelectedIds([]);
      await loadServers();
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  };

  /** 行内调整单台 AI 策略：复用批量接口只传一个 id，避免为单条再开一个命令 */
  const handleInlinePolicyChange = async (server: Server, policy: AIPolicy) => {
    try {
      await serverApi.batchUpdatePolicy([server.id], policy);
      setServers((prev) =>
        prev.map((item) =>
          item.id === server.id ? { ...item, ai_policy: policy } : item
        )
      );
      message.success(`「${server.alias}」策略已调整为 ${AI_POLICY_META[policy].label}`);
    } catch (e) {
      message.error(getErrorMessage(e));
      await loadServers();
    }
  };

  const handleCreateGroup = () => {
    setPendingGroupName("");
    setGroupNameOpen(true);
  };

  const confirmCreateGroup = () => {
    const name = pendingGroupName.trim();
    if (!name) {
      message.warning("请填写分组名称");
      return;
    }
    setGroupNameOpen(false);
    // 分组随主机存在：直接带进新增表单，避免留下一个点进去空无一物的分组
    setEditingServer(null);
    setPresetGroup(name);
    setFormOpen(true);
  };

  /**
   * 六列，与原型 renderServerTable() 的 thead 严格一一对应：
   * 服务器名称/标签 · 连接地址 · 系统/架构 · 认证方式 · AI 策略档位 · 操作。
   *
   * 原先多出来的「连通状态」「SSH 状态」两列已按原型收掉：
   * 延迟并入「连接地址」第二行，SSH 核验结果压成「认证方式」胶囊上的状态点。
   */
  const columns: TableProps<Server>["columns"] = [
    {
      title: "服务器名称 / 标签",
      key: "alias",
      width: 228,
      render: (_: unknown, server: Server) => {
        const state = probeStates[server.id];
        const probing = state === "testing";
        const result = state !== undefined && state !== "testing" ? state : null;
        const dotTone = probing
          ? "var(--warning)"
          : result === null
            ? "var(--text-muted)"
            : result.ok
              ? "var(--success)"
              : "var(--danger)";
        const dotTitle = probing
          ? "正在探测连通性"
          : result === null
            ? "尚未探测连通性"
            : result.ok
              ? `在线延迟 ${result.latency_ms} ms`
              : "不可达";
        const tags = parseTags(server.tags);

        return (
          <div className="flex items-center gap-2">
            <span
              className="rounded-full shrink-0"
              style={{ width: 8, height: 8, background: dotTone }}
              title={dotTitle}
            />
            <div className="min-w-0">
              <div
                className="flex items-center gap-1.5 font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                <span className="truncate">{server.alias}</span>
                {server.os_type === "windows" ? (
                  <Monitor size={13} style={{ color: "var(--info)", flexShrink: 0 }} />
                ) : (
                  <ServerIcon size={13} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
                )}
                <button
                  type="button"
                  onClick={() => handleToggleFavorite(server)}
                  title={server.favorite ? "取消收藏" : "加入收藏"}
                  style={{
                    display: "flex",
                    flexShrink: 0,
                    color: server.favorite ? "#fbbf24" : "var(--text-muted)",
                  }}
                >
                  <Star size={12} fill={server.favorite ? "#fbbf24" : "none"} />
                </button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {tags.map((tag) => (
                    <span key={tag} style={TAG_PILL}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: "连接地址 (IP & 端口)",
      key: "address",
      width: 182,
      render: (_: unknown, server: Server) => {
        const state = probeStates[server.id];
        const probing = state === "testing";
        const result = state !== undefined && state !== "testing" ? state : null;
        const tone = probing
          ? "var(--warning)"
          : result === null
            ? "var(--text-muted)"
            : result.ok
              ? "var(--success)"
              : "var(--danger)";
        const label = probing
          ? "探测中…"
          : result === null
            ? "未探测"
            : result.ok
              ? `${result.latency_ms} ms · 稳定在线`
              : "不可达";

        return (
          <div style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)" }}>
            <div>
              {server.username}@{server.hostname}:{server.port}
            </div>
            {/* 原型这一行点击会弹出握手诊断报告；本项目没有那份报告，就直接触发 TCP 探测 */}
            <button
              type="button"
              onClick={() => handleProbe(server)}
              disabled={probing}
              title="点击执行 TCP 连通性探测（仅三次握手，不校验凭据）"
              className="flex items-center gap-1 hover:underline"
              style={{ marginTop: 2, fontSize: 10, color: tone }}
            >
              <span
                className="rounded-full inline-block"
                style={{ width: 6, height: 6, background: tone }}
              />
              {label}
            </button>
          </div>
        );
      },
    },
    {
      title: "系统 / 架构",
      key: "os",
      width: 112,
      render: (_: unknown, server: Server) => (
        <div>
          <div style={{ color: "var(--text-primary)" }}>
            {OS_TYPE_LABEL[server.os_type as OsType] ?? server.os_type}
          </div>
          <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
            {server.arch || "架构待探测"}
          </div>
        </div>
      ),
    },
    {
      title: "认证方式",
      key: "auth_type",
      width: 104,
      render: (_: unknown, server: Server) => {
        const meta = SSH_STATUS_META[server.last_connection_status] ?? SSH_STATUS_META.unknown;
        return (
          <Tooltip
            title={
              <span>
                SSH 身份认证：{meta.label}
                {server.last_connected_at
                  ? ` · ${formatRelativeTime(server.last_connected_at)}`
                  : ""}
                <br />
                点击执行认证与主机指纹核验
              </span>
            }
          >
            <button
              type="button"
              onClick={() => setSshServer(server)}
              className="inline-flex items-center gap-1.5"
              style={{
                padding: "1px 8px",
                borderRadius: 4,
                fontSize: 10,
                fontFamily: "var(--font-mono)",
                background: "var(--bg-secondary)",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
              }}
            >
              {AUTH_TYPE_LABEL[server.auth_type as AuthType] ?? server.auth_type}
              {/* 原型没有 SSH 状态列，这里压成一颗状态点，保住这条核心安全信息 */}
              <span
                className="rounded-full"
                style={{ width: 5, height: 5, background: meta.tone }}
              />
            </button>
          </Tooltip>
        );
      },
    },
    {
      title: "AI 策略档位",
      key: "ai_policy",
      width: 106,
      render: (_: unknown, server: Server) => (
        <AiPolicyBadge
          policy={server.ai_policy as AIPolicy}
          onChange={(policy) => handleInlinePolicyChange(server, policy)}
        />
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 302,
      fixed: "right",
      render: (_: unknown, server: Server) => (
        <ServerRowActions
          server={server}
          probing={probeStates[server.id] === "testing"}
          onOpenWorkbench={(item) => goModule("workbench", item)}
          onOpenModule={goModule}
          onProbe={handleProbe}
          onEdit={(item) => {
            setEditingServer(item);
            setPresetGroup(undefined);
            setFormOpen(true);
          }}
          onDelete={handleDelete}
        />
      ),
    },
  ];

  return (
    <div className="ops-page space-y-4">
      <div className="ops-page-head">
        <div style={{ minWidth: 0 }}>
          {/* 标题与说明取自模块注册表，保证与左侧导航的 tooltip、占位页文案三处一致 */}
          <h1 className="ops-page-title">
            <span>{MODULE.title}</span>
            <span className="ops-page-subtitle">（{MODULE.subtitle}）</span>
          </h1>
          <p className="ops-page-desc">{MODULE.desc}</p>
        </div>

        <Space size={8}>
          {/* 三个按钮与原型头部严格一致。原型头部没有「刷新」——
              列表在进入页面、增删改、切换分组后都会自动重载，手动刷新属于冗余入口。 */}
          <Button
            icon={<Monitor size={14} />}
            onClick={() => setWindowsGuideOpen(true)}
            style={{
              background: "color-mix(in srgb, var(--info) 20%, transparent)",
              color: "var(--info)",
              borderColor: "color-mix(in srgb, var(--info) 40%, transparent)",
            }}
          >
            Windows 接入
          </Button>
          <Button
            icon={<FileCode size={14} />}
            onClick={() => setImportOpen(true)}
          >
            导入 ~/.ssh/config
          </Button>
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => {
              setEditingServer(null);
              setPresetGroup(undefined);
              setFormOpen(true);
            }}
          >
            新增服务器
          </Button>
        </Space>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-1">
          <ServerGroupPanel
            servers={servers}
            activeGroup={activeGroup}
            onSelectGroup={setActiveGroup}
            onCreateGroup={handleCreateGroup}
            tagStats={tagStats}
            selectedTags={selectedTags}
            onToggleTag={handleToggleTag}
            onClearTags={() => setSelectedTags([])}
          />
        </div>

        <div className="lg:col-span-4 ops-panel overflow-hidden relative flex flex-col">
          <ServerToolbar
            keyword={keyword}
            onKeywordChange={setKeyword}
            osFilter={osFilter}
            onOsFilterChange={setOsFilter}
            osCounts={osCounts}
            tagStats={tagStats}
            selectedTags={selectedTags}
            onToggleTag={handleToggleTag}
            onResetTags={() => setSelectedTags([])}
          />

          <Table<Server>
            className="ops-table"
            columns={columns}
            dataSource={visibleServers}
            rowKey="id"
            loading={loading}
            size="middle"
            pagination={{ pageSize: 20, showSizeChanger: false }}
            scroll={{ x: 1080 }}
            rowSelection={{
              selectedRowKeys: selectedIds,
              onChange: (keys) => setSelectedIds(keys as number[]),
            }}
            locale={{
              emptyText:
                servers.length === 0
                  ? "还没有纳管任何服务器，点击右上角「新增服务器」开始"
                  : (
                    <div className="py-6 space-y-2">
                      <p style={{ color: "var(--text-muted)" }}>
                        没有匹配当前过滤条件的服务器
                      </p>
                      <Button type="link" size="small" onClick={resetAllFilters}>
                        重置所有过滤条件
                      </Button>
                    </div>
                  ),
            }}
          />

          <BatchActionBar
            count={selectedIds.length}
            pinging={batchPinging}
            onBatchPing={handleBatchPing}
            onOpenTagModal={() => {
              setTagInput("");
              setTagModalOpen(true);
            }}
            onOpenPolicyModal={() => {
              setPolicyInput("approval");
              setPolicyModalOpen(true);
            }}
            onBatchDelete={handleBatchDelete}
            onClear={() => setSelectedIds([])}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="glass-card rounded-xl p-3.5 space-y-1.5">
          <div
            className="flex items-center gap-2 text-xs font-medium"
            style={{ color: "#818cf8" }}
          >
            <Blocks size={15} />
            <span>MCP Server 协议集成</span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            支持将受控服务器能力作为 <strong>MCP Tool</strong> 导出，
            可直接接入 Claude Desktop、Cursor 或 Antigravity。
          </p>
        </div>

        <div className="glass-card rounded-xl p-3.5 space-y-1.5">
          <div
            className="flex items-center gap-2 text-xs font-medium"
            style={{ color: "#fbbf24" }}
          >
            <ShieldCheck size={15} />
            <span>AI 执行安全分级说明</span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            采用<strong>只读分析 / 建议确认 / 自动修复</strong>三阶防护梯次，
            敏感写操作必须由工程师审批放行。
          </p>
        </div>

        <div className="glass-card rounded-xl p-3.5 space-y-1.5">
          <div
            className="flex items-center gap-2 text-xs font-medium"
            style={{ color: "#60a5fa" }}
          >
            <MonitorUp size={15} />
            <span>Windows 原生免代理纳管</span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            全面兼容原生 <strong>OpenSSH for Windows</strong> 与 <strong>PowerShell Remoting</strong>，
            零第三方守护进程侵入。
          </p>
        </div>
      </div>

      <ServerFormModal
        open={formOpen}
        server={editingServer}
        presetGroup={presetGroup}
        onCancel={() => {
          setFormOpen(false);
          setEditingServer(null);
          setPresetGroup(undefined);
        }}
        onSubmit={handleSave}
      />

      <WindowsGuideModal
        open={windowsGuideOpen}
        onCancel={() => setWindowsGuideOpen(false)}
      />

      <ImportSSHConfigModal
        open={importOpen}
        existingAliases={servers.map((s) => s.alias)}
        onCancel={() => setImportOpen(false)}
        onImported={() => void loadServers()}
      />

      <SshConnectModal
        open={sshServer !== null}
        server={sshServer}
        initialCredentials={sshInitialCredentials}
        onCancel={() => {
          setSshServer(null);
          setSshInitialCredentials(undefined);
        }}
        onVerified={async () => {
          await loadServers();
        }}
        onStatusChanged={async () => {
          await loadServers();
        }}
      />

      <Modal
        open={groupNameOpen}
        title="新建分组"
        onCancel={() => setGroupNameOpen(false)}
        onOk={confirmCreateGroup}
        okText="下一步"
        cancelText="取消"
        width={420}
      >
        <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
          分组随主机一起创建。填好名称后会直接打开新增服务器表单，保存后分组即出现在左侧列表。
        </p>
        <Input
          value={pendingGroupName}
          onChange={(e) => setPendingGroupName(e.target.value)}
          onPressEnter={confirmCreateGroup}
          placeholder="如：生产集群"
        />
      </Modal>

      <Modal
        open={tagModalOpen}
        title={`批量为 ${selectedIds.length} 台主机追加标签`}
        onCancel={() => setTagModalOpen(false)}
        onOk={handleBatchTag}
        okText="追加"
        cancelText="取消"
        width={460}
      >
        <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
          标签与已有标签取并集，不会覆盖原有标签。多个标签用逗号分隔。
        </p>
        <Input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onPressEnter={handleBatchTag}
          placeholder="如：生产环境, 华东一区"
        />
      </Modal>

      <Modal
        open={policyModalOpen}
        title={`批量调整 ${selectedIds.length} 台主机的 AI 策略`}
        onCancel={() => setPolicyModalOpen(false)}
        onOk={handleBatchPolicy}
        okText="应用"
        cancelText="取消"
        width={460}
      >
        <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
          策略决定 AI 在这些主机上的执行权限，会直接影响审批闸门的放行判定。
        </p>
        <Select
          value={policyInput}
          onChange={(value) => setPolicyInput(value as AIPolicy)}
          style={{ width: "100%" }}
          options={AI_POLICY_ORDER.map((policy) => ({
            value: policy,
            label: `${AI_POLICY_META[policy].label} — ${AI_POLICY_META[policy].hint}`,
          }))}
        />
      </Modal>
    </div>
  );
}
