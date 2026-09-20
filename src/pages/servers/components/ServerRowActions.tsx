/**
 * 表格行「操作」列。
 *
 * 按钮集合与配色对齐原型 renderServerTable() 的操作列：
 * 工作台 / 终端 / SFTP / 数据库 / 快速测通 / 编辑 / 移除。
 *
 * 与原型的两处刻意差异：
 * 1. 原型用 emoji 字形（⚡ ✏️ ✕），这里换成 Lucide 图标——
 *    项目技术栈统一 Lucide（AGENTS.md），且 emoji 在 Windows / macOS 上的字形差异会破坏一致性。
 * 2. 原型的前三个按钮直接切到对应 tab，这里走路由跳转并把目标主机写进「当前会话」，
 *    否则切过去看到的会是另一台机器。
 */

import type { ReactNode } from "react";
import { Loader2, Pencil, X, Zap } from "lucide-react";
import type { Server } from "@/types";

type Tone = "brand" | "info" | "amber" | "plainInfo" | "plain" | "danger";

/** 按语义分档的配色，全部走主题令牌，明暗皮肤下都不会失去对比度 */
const TONE: Record<Tone, { bg: string; fg: string; border: string }> = {
  // 原型：bg-brand-600/30 + text-brand-300
  brand: {
    bg: "color-mix(in srgb, var(--accent) 26%, transparent)",
    fg: "var(--accent-hover)",
    border: "1px solid transparent",
  },
  // 原型：bg-cyan-500/20 + text-cyan-300
  info: {
    bg: "color-mix(in srgb, var(--info) 22%, transparent)",
    fg: "var(--info)",
    border: "1px solid transparent",
  },
  // 原型：bg-amber-500/20 + text-amber-300
  amber: {
    bg: "color-mix(in srgb, var(--warning) 22%, transparent)",
    fg: "var(--warning)",
    border: "1px solid transparent",
  },
  // 原型「终端」：slate 底 + cyan 字（与「数据库」的实心 cyan 底刻意区分）
  plainInfo: {
    bg: "var(--bg-secondary)",
    fg: "var(--info)",
    border: "1px solid var(--border)",
  },
  plain: {
    bg: "var(--bg-secondary)",
    fg: "var(--text-secondary)",
    border: "1px solid var(--border)",
  },
  danger: {
    bg: "var(--bg-secondary)",
    fg: "var(--text-muted)",
    border: "1px solid var(--border)",
  },
};

interface ActionButtonProps {
  tone: Tone;
  title: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}

function ActionButton({ tone, title, disabled, onClick, children }: ActionButtonProps) {
  const style = TONE[tone];
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center justify-center whitespace-nowrap transition-opacity hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        padding: "3px 8px",
        borderRadius: 6,
        fontSize: 11,
        fontWeight: 500,
        background: style.bg,
        color: style.fg,
        border: style.border,
        minWidth: 26,
      }}
    >
      {children}
    </button>
  );
}

interface ServerRowActionsProps {
  server: Server;
  /** 该行正在探测中，避免重复触发 */
  probing: boolean;
  /** 进入主机工作台（模块已实现，带 SSH 指纹核验） */
  onOpenWorkbench: (server: Server) => void;
  /** 进入尚未实现的模块（终端 / SFTP / 数据库），落到占位页 */
  onOpenModule: (moduleKey: string, server: Server) => void;
  onProbe: (server: Server) => void;
  onEdit: (server: Server) => void;
  onDelete: (server: Server) => void;
}

export function ServerRowActions({
  server,
  probing,
  onOpenWorkbench,
  onOpenModule,
  onProbe,
  onEdit,
  onDelete,
}: ServerRowActionsProps) {
  return (
    <div className="flex items-center justify-end flex-nowrap gap-1">
      <ActionButton tone="brand" title="进入该主机的工作台" onClick={() => onOpenWorkbench(server)}>
        工作台
      </ActionButton>
      <ActionButton
        tone="plainInfo"
        title="打开远程终端（该模块尚未实现，将落到规划说明页）"
        onClick={() => onOpenModule("terminal", server)}
      >
        终端
      </ActionButton>
      <ActionButton
        tone="amber"
        title="打开 SFTP 文件传输（该模块尚未实现，将落到规划说明页）"
        onClick={() => onOpenModule("sftp", server)}
      >
        SFTP
      </ActionButton>
      <ActionButton
        tone="info"
        title="打开数据库工作台（该模块尚未实现，将落到规划说明页）"
        onClick={() => onOpenModule("database", server)}
      >
        数据库
      </ActionButton>
      <ActionButton
        tone="plain"
        title="快速连通性 Ping 测通（仅 TCP 三次握手）"
        disabled={probing}
        onClick={() => onProbe(server)}
      >
        {probing ? <Loader2 size={11} className="animate-spin" /> : <Zap size={11} />}
      </ActionButton>
      <ActionButton tone="plain" title="编辑服务器属性" onClick={() => onEdit(server)}>
        <Pencil size={11} />
      </ActionButton>
      <ActionButton tone="danger" title="移除此资产" onClick={() => onDelete(server)}>
        <X size={11} />
      </ActionButton>
    </div>
  );
}
