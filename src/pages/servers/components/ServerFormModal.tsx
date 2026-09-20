import { useEffect, useState } from "react";
import { Button, Form, Input, Modal, Select, Tag, message } from "antd";
import {
  Check,
  GitBranch,
  KeyRound,
  Loader2,
  Monitor,
  Server as ServerIcon,
  Terminal,
  Zap,
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
import { getErrorMessage } from "@/lib/api/client";
import { serverApi } from "@/lib/api/server";
import {
  AI_POLICY_META,
  AI_POLICY_ORDER,
  AUTH_TYPE_LABEL,
  parseTags,
  serializeTags,
  splitTagInput,
} from "../lib/serverMeta";

interface FormValues extends SshCredentials {
  alias: string;
  hostname: string;
  port: number;
  username: string;
  auth_type: AuthType;
  os_type: OsType;
  arch: string;
  group: string;
  ai_policy: AIPolicy;
  tags: string;
}

interface ServerFormModalProps {
  open: boolean;
  /** null 表示新增 */
  server: Server | null;
  /** 新增时预填的分组（由左侧「新建分组」入口带过来） */
  presetGroup?: string;
  onCancel: () => void;
  onSubmit: (payload: ServerPayload, credentials?: SshCredentials) => Promise<void>;
}

type Protocol = "linux" | "windows" | "bastion";

const DEFAULT_VALUES: FormValues = {
  alias: "",
  hostname: "",
  port: 22,
  username: "root",
  auth_type: "password",
  os_type: "linux",
  arch: "",
  group: "默认",
  ai_policy: "trusted",
  tags: "",
};

export function ServerFormModal({
  open,
  server,
  presetGroup,
  onCancel,
  onSubmit,
}: ServerFormModalProps) {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [pingResult, setPingResult] = useState<ConnectivityResult | null>(null);
  const [protocol, setProtocol] = useState<Protocol>("linux");
  const authType = Form.useWatch("auth_type", form) ?? DEFAULT_VALUES.auth_type;

  useEffect(() => {
    if (!open) return;

    setPingResult(null);
    // Modal 实例会复用；先清掉上一次输入，避免敏感凭据串到下一台服务器。
    form.resetFields();
    const nextProtocol: Protocol = server?.os_type === "windows" ? "windows" : "linux";
    setProtocol(nextProtocol);

    if (server) {
      form.setFieldsValue({
        alias: server.alias,
        hostname: server.hostname,
        port: server.port,
        username: server.username,
        auth_type: server.auth_type as AuthType,
        os_type: server.os_type as OsType,
        arch: server.arch,
        group: server.group,
        ai_policy: server.ai_policy as AIPolicy,
        tags: parseTags(server.tags).join(", "),
      });
    } else {
      form.setFieldsValue({
        ...DEFAULT_VALUES,
        group: presetGroup?.trim() || DEFAULT_VALUES.group,
      });
    }
  }, [open, server, presetGroup, form]);

  const selectProtocol = (next: Protocol) => {
    if (next === "bastion") return;
    setProtocol(next);
    form.setFieldValue("os_type", next);
    if (next === "windows") {
      form.setFieldValue("port", 22);
    }
  };

  const handleTest = async () => {
    const hostname = (form.getFieldValue("hostname") as string | undefined)?.trim();
    const port = form.getFieldValue("port") as number | undefined;

    if (!hostname) {
      message.warning("请先填写连接地址");
      return;
    }

    setTesting(true);
    setPingResult(null);
    try {
      const result = await serverApi.testConnectivity(
        hostname,
        Number(port) || 22,
        server?.id
      );
      setPingResult(result);
    } catch (error) {
      setPingResult({
        ok: false,
        latency_ms: null,
        message: getErrorMessage(error),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleOk = async () => {
    let values: FormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    // 操作系统类型由上方协议卡片决定，不取表单值：os_type 没有对应的 Form.Item，
    // 而 validateFields() 只返回已注册字段（getFieldEntities）的值，未注册字段拿到的是
    // undefined —— 直接传给 IPC 会让整个键在序列化时消失，后端报
    // `command add_server missing required key osType`。
    const resolvedOsType: OsType = protocol === "windows" ? "windows" : "linux";

    setSaving(true);
    try {
      await onSubmit(
        {
          alias: values.alias.trim(),
          hostname: values.hostname.trim(),
          port: Number(values.port) || 22,
          username: values.username.trim(),
          auth_type: values.auth_type,
          os_type: resolvedOsType,
          arch: (values.arch ?? "").trim(),
          group: values.group.trim() || "默认",
          ai_policy: values.ai_policy,
          tags: serializeTags(splitTagInput(values.tags ?? "")),
        },
        values.auth_type === "password"
          ? values.password
            ? { password: values.password }
            : undefined
          : values.privateKeyPath
            ? {
                privateKeyPath: values.privateKeyPath.trim(),
                passphrase: values.passphrase || undefined,
              }
            : undefined
      );
    } finally {
      setSaving(false);
    }
  };

  const modalTitle = (
    <div className="flex items-center gap-2.5">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-lg"
        style={{ background: "rgba(99, 102, 241, 0.16)", color: "var(--accent-hover)" }}
      >
        <ServerIcon size={16} />
      </span>
      <div>
        <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {server ? "编辑服务器属性" : "新增纳管服务器节点"}
        </div>
        <div className="text-[11px] font-normal" style={{ color: "var(--text-muted)" }}>
          Agentless 无侵入架构 · 支持原生 SSH 与 Windows OpenSSH
        </div>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      rootClassName="ops-modal"
      title={modalTitle}
      onCancel={onCancel}
      width={700}
      destroyOnHidden
      maskClosable={false}
      footer={
        <div className="flex items-center justify-between gap-3">
          <Button
            icon={testing ? <Loader2 size={13} className="animate-spin" /> : <Zap size={13} />}
            onClick={handleTest}
            disabled={testing}
          >
            连通性测试
          </Button>
          <div className="flex items-center gap-2">
            <Button onClick={onCancel}>取消</Button>
            <Button
              type="primary"
              icon={<Check size={14} />}
              loading={saving}
              onClick={handleOk}
            >
              {server ? "保存更新" : "保存并纳管"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="max-h-[66vh] overflow-y-auto custom-scrollbar px-1 pb-1">
        <Form
          form={form}
          layout="vertical"
          size="small"
          initialValues={DEFAULT_VALUES}
          style={{ marginTop: 4 }}
        >
          <section className="space-y-2.5">
            <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              目标平台与协议类型
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <ProtocolCard
                active={protocol === "linux"}
                icon={<Terminal size={16} />}
                title="Linux (OpenSSH)"
                description="主流发行版 · 端口 22"
                onClick={() => selectProtocol("linux")}
              />
              <ProtocolCard
                active={protocol === "windows"}
                icon={<Monitor size={16} />}
                title="Windows (OpenSSH)"
                description="原生 PowerShell 免代理"
                onClick={() => selectProtocol("windows")}
              />
              <ProtocolCard
                disabled
                icon={<GitBranch size={16} />}
                title="跳板机穿透"
                description="ProxyJump · 即将支持"
                onClick={() => undefined}
              />
            </div>
          </section>

          <section className="mt-4 space-y-1">
            <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-3">
              <Form.Item
                className="sm:col-span-2"
                name="alias"
                label="主机别名"
                rules={[{ required: true, message: "请填写主机别名" }]}
              >
                <Input placeholder="如：prod-k8s-master-01" />
              </Form.Item>
              <Form.Item name="group" label="归属分组">
                <Input placeholder="如：生产集群" />
              </Form.Item>
            </div>

            <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-4">
              <Form.Item
                className="sm:col-span-3"
                name="hostname"
                label="连接地址 (IPv4 / IPv6 / 域名)"
                rules={[{ required: true, message: "请填写连接地址" }]}
              >
                <Input
                  prefix={<Terminal size={13} style={{ color: "var(--text-muted)" }} />}
                  style={{ fontFamily: "var(--font-mono)" }}
                  placeholder="如：192.168.1.120 或 api.internal.corp"
                />
              </Form.Item>
              <Form.Item
                name="port"
                label="端口"
                rules={[{ required: true, message: "请填写端口" }]}
              >
                <Input type="number" min={1} max={65535} style={{ fontFamily: "var(--font-mono)" }} />
              </Form.Item>
            </div>
          </section>

          <section
            className="mt-2 space-y-3 rounded-xl p-3.5"
            style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                <KeyRound size={14} style={{ color: "var(--accent-hover)" }} />
                登录鉴权凭据
              </div>
              <Tag color="blue" className="m-0 text-[10px]">
                仅用于本次验证，不会保存
              </Tag>
            </div>
            <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-3">
              <Form.Item name="username" label="登录用户名">
                <Input style={{ fontFamily: "var(--font-mono)" }} placeholder="root" />
              </Form.Item>
              <Form.Item className="sm:col-span-2" name="auth_type" label="凭据类型与密钥来源">
                <Select
                  options={(Object.keys(AUTH_TYPE_LABEL) as AuthType[]).map((value) => ({
                    value,
                    label:
                      value === "key"
                        ? "系统私钥（在 SSH 验证时选择）"
                        : AUTH_TYPE_LABEL[value],
                  }))}
                />
              </Form.Item>
            </div>
            {authType === "password" ? (
              <Form.Item
                name="password"
                label="SSH 登录密码"
                rules={server ? undefined : [{ required: true, message: "请输入 SSH 登录密码" }]}
              >
                <Input.Password
                  prefix={<KeyRound size={14} />}
                  autoComplete="new-password"
                  placeholder={server ? "留空则只保存服务器属性" : "输入本次连接凭据"}
                />
              </Form.Item>
            ) : (
              <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
                <Form.Item
                  name="privateKeyPath"
                  label="私钥路径"
                  rules={server ? undefined : [{ required: true, message: "请输入私钥文件路径" }]}
                >
                  <Input
                    prefix={<KeyRound size={14} />}
                    autoComplete="off"
                    placeholder="~/.ssh/id_ed25519"
                  />
                </Form.Item>
                <Form.Item name="passphrase" label="私钥口令（可选）">
                  <Input.Password autoComplete="new-password" placeholder="未加密私钥可留空" />
                </Form.Item>
              </div>
            )}
            <div className="text-[11px] leading-5" style={{ color: "var(--text-muted)" }}>
              凭据不会写入资产表或审计日志。填写后，保存服务器将自动进入 SSH 验证。
            </div>
          </section>

          <div className="mt-3 grid grid-cols-1 gap-x-3 sm:grid-cols-2">
            <Form.Item name="tags" label="业务标签（英文逗号分隔）">
              <Input placeholder="如：生产环境, K8s, 华东一区" />
            </Form.Item>
            <Form.Item
              name="ai_policy"
              label="AI 运维执行权限策略"
              tooltip="决定 AI 在这台机器上能做什么"
            >
              <Select
                options={AI_POLICY_ORDER.map((value) => ({
                  value,
                  label: `${AI_POLICY_META[value].label} — ${AI_POLICY_META[value].hint}`,
                }))}
              />
            </Form.Item>
          </div>

        </Form>
      </div>

      {/* 探测结果固定在滚动区之外：表单主体是可滚动的，结果条放在里面会落在视口下方，
          用户点了「连通性测试」看不到任何变化，会以为按钮没生效。 */}
      {(testing || pingResult) && (
        <div
          className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-xs"
          style={{
            border: "1px solid var(--border)",
            background: "var(--bg-secondary)",
          }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{
                background: testing
                  ? "var(--warning)"
                  : pingResult?.ok
                    ? "var(--success)"
                    : "var(--danger)",
              }}
            />
            <span className="truncate" style={{ color: "var(--text-secondary)" }}>
              {testing
                ? `正在连接 ${form.getFieldValue("hostname") || "目标主机"} 进行 TCP 握手...`
                : pingResult?.message}
            </span>
          </div>
          {!testing && pingResult?.latency_ms !== null && (
            <span className="font-mono font-semibold" style={{ color: "var(--success)" }}>
              {pingResult?.latency_ms} ms
            </span>
          )}
        </div>
      )}
    </Modal>
  );
}

function ProtocolCard({
  active = false,
  disabled = false,
  icon,
  title,
  description,
  onClick,
}: {
  active?: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-xl p-2.5 text-left transition"
      style={{
        border: `2px solid ${active ? "var(--accent)" : "var(--border)"}`,
        background: active ? "rgba(99, 102, 241, 0.1)" : "var(--bg-secondary)",
        color: disabled ? "var(--text-muted)" : "var(--text-primary)",
        opacity: disabled ? 0.58 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <span style={{ color: active ? "var(--accent-hover)" : "var(--text-muted)", display: "flex" }}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold">{title}</span>
        <span className="mt-0.5 block truncate text-[10px]" style={{ color: "var(--text-muted)" }}>
          {description}
        </span>
      </span>
    </button>
  );
}
