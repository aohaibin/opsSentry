import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
  type TableProps,
} from "antd";
import {
  Blocks,
  FileCode,
  Loader2,
  Monitor,
  MonitorUp,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Star,
  Terminal,
  Trash2,
  Zap,
} from "lucide-react";
import type {
  AIPolicy,
  ConnectivityResult,
  OsType,
  Server,
  ServerPayload,
  SshCredentials,
} from "@/types";
import { serverApi } from "@/lib/api/server";
import { getErrorMessage } from "@/lib/api/client";
import { SshConnectModal } from "@/components/server/SshConnectModal";
import { ServerGroupPanel } from "./components/ServerGroupPanel";
import { ServerToolbar, type OsFilter } from "./components/ServerToolbar";
import { ServerFormModal } from "./components/ServerFormModal";
import { BatchActionBar } from "./components/BatchActionBar";
import { WindowsGuideModal } from "./components/WindowsGuideModal";
import { ImportSSHConfigModal } from "./components/ImportSSHConfigModal";
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
import { requireModule } from "@/navigation/modules";

/** 模块元信息（标题 / 副标题 / 定位说明）取自注册表，避免与导航、占位页三处各写一份 */
const MODULE = requireModule("servers");

/** 每行的探测状态：探测中、已出结果、或尚未探测 */
type ProbeState = Record<number, ConnectivityResult | "testing">;

const SSH_STATUS_META: Record<string, { label: string; color: string }> = {
  unknown: { label: "未验证", color: "default" },
  verified: { label: "已认证", color: "success" },
  failed: { label: "验证失败", color: "error" },
  host_key_changed: { label: "指纹变化", color: "warning" },
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

  const columns: TableProps<Server>["columns"] = [
    {
      title: "服务器名称 / 标签",
      key: "alias",
      width: 260,
      render: (_: unknown, server: Server) => {
        const tags = parseTags(server.tags);
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleToggleFavorite(server)}
                title={server.favorite ? "取消收藏" : "加入收藏"}
                style={{
                  color: server.favorite ? "#fbbf24" : "var(--text-muted)",
                  display: "flex",
                }}
              >
                <Star
                  size={13}
                  fill={server.favorite ? "#fbbf24" : "none"}
                />
              </button>
              <span className="font-medium" style={{ color: "var(--text-primary)" }}>
                {server.alias}
              </span>
            </div>
            <div className="flex items-center gap-1 flex-wrap pl-[18px]">
              <Tag color="default" className="text-[10px] m-0">
                {server.group || "未分组"}
              </Tag>
              {tags.map((tag) => (
                <Tag key={tag} color="purple" className="text-[10px] m-0">
                  {tag}
                </Tag>
              ))}
            </div>
          </div>
        );
      },
    },
    {
      title: "连接地址",
      key: "address",
      width: 190,
      render: (_: unknown, server: Server) => (
        <div className="space-y-0.5">
          <div
            className="text-xs"
            style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}
          >
            {server.hostname}:{server.port}
          </div>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {server.username} · 最近 {formatRelativeTime(server.last_used_at)}
          </div>
        </div>
      ),
    },
    {
      title: "系统 / 架构",
      key: "os",
      width: 130,
      render: (_: unknown, server: Server) => (
        <div className="space-y-0.5">
          <Tag
            color={server.os_type === "windows" ? "blue" : "cyan"}
            className="text-[10px] m-0"
          >
            {OS_TYPE_LABEL[server.os_type as OsType] ?? server.os_type}
          </Tag>
          <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            {server.arch || "架构待探测"}
          </div>
        </div>
      ),
    },
    {
      title: "认证方式",
      dataIndex: "auth_type",
      key: "auth_type",
      width: 90,
      render: (value: string) => (
        <Tag color={value === "key" ? "geekblue" : "orange"} className="text-[10px]">
          {AUTH_TYPE_LABEL[value as "password" | "key"] ?? value}
        </Tag>
      ),
    },
    {
      title: "AI 策略档位",
      key: "ai_policy",
      width: 130,
      render: (_: unknown, server: Server) => (
        <Tooltip title={AI_POLICY_META[server.ai_policy as AIPolicy]?.hint}>
          <Select
            size="small"
            value={server.ai_policy}
            style={{ width: 108 }}
            onChange={(value) => handleInlinePolicyChange(server, value as AIPolicy)}
            options={AI_POLICY_ORDER.map((policy) => ({
              value: policy,
              label: AI_POLICY_META[policy].label,
            }))}
          />
        </Tooltip>
      ),
    },
    {
      title: "连通状态",
      key: "probe",
      width: 130,
      render: (_: unknown, server: Server) => {
        const state = probeStates[server.id];
        if (!state) {
          return (
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              未探测
            </span>
          );
        }
        if (state === "testing") {
          return (
            <span
              className="text-[11px] flex items-center gap-1"
              style={{ color: "var(--text-muted)" }}
            >
              <Loader2 size={11} className="animate-spin" />
              探测中
            </span>
          );
        }
        return (
          <Tooltip title={state.message}>
            <span
              className="text-[11px] font-mono flex items-center gap-1"
              style={{ color: state.ok ? "var(--success)" : "var(--danger)" }}
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: state.ok ? "var(--success)" : "var(--danger)" }}
              />
              {state.ok ? `${state.latency_ms} ms` : "不可达"}
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: "SSH 状态",
      key: "ssh_status",
      width: 120,
      render: (_: unknown, server: Server) => {
        const meta = SSH_STATUS_META[server.last_connection_status] ?? SSH_STATUS_META.unknown;
        return (
          <Tooltip title={server.last_connection_message || "尚未执行 SSH 身份认证"}>
            <div className="space-y-0.5">
              <Tag color={meta.color} className="text-[10px] m-0">
                {meta.label}
              </Tag>
              <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                {server.last_connected_at
                  ? formatRelativeTime(server.last_connected_at)
                  : "从未认证"}
              </div>
            </div>
          </Tooltip>
        );
      },
    },
    {
      title: "操作",
      key: "action",
      width: 160,
      fixed: "right",
      render: (_: unknown, server: Server) => (
        <Space size={2}>
          <Tooltip title="SSH 身份认证">
            <Button
              type="text"
              size="small"
              icon={<Terminal size={14} />}
              onClick={() => setSshServer(server)}
            />
          </Tooltip>
          <Tooltip title="连通性测试（TCP 握手）">
            <Button
              type="text"
              size="small"
              icon={<Zap size={14} />}
              disabled={probeStates[server.id] === "testing"}
              onClick={() => handleProbe(server)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<Pencil size={14} />}
              onClick={() => {
                setEditingServer(server);
                setPresetGroup(undefined);
                setFormOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="移除">
            <Button
              type="text"
              size="small"
              danger
              icon={<Trash2 size={14} />}
              onClick={() => handleDelete(server)}
            />
          </Tooltip>
        </Space>
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
          <Button icon={<RefreshCw size={14} />} onClick={() => void loadServers()}>
            刷新
          </Button>
          <Button
            icon={<Monitor size={14} />}
            onClick={() => setWindowsGuideOpen(true)}
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
            size="small"
            pagination={{ pageSize: 20, showSizeChanger: false }}
            scroll={{ x: 1140 }}
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
            支持将受控服务器能力作为 MCP Tool 导出，可直接接入 Claude Code、Cursor 等外部 AI 客户端。
          </p>
        </div>

        <div className="glass-card rounded-xl p-3.5 space-y-1.5">
          <div
            className="flex items-center gap-2 text-xs font-medium"
            style={{ color: "#fbbf24" }}
          >
            <ShieldCheck size={15} />
            <span>AI 执行安全分级</span>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            每台主机可独立设置 <strong>放行 / 白名单 / 需审批 / 已锁定</strong> 四档，
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
            兼容 Windows 自带 <strong>OpenSSH Server</strong>，
            无需在被控机安装任何第三方守护进程。
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
