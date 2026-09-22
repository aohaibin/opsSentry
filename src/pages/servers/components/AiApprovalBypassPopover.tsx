import { useState, useEffect } from "react";
import { Popover, Tooltip, message } from "antd";
import { Bot } from "lucide-react";
import type { Server } from "@/types";

export type BypassDuration = "30m" | "2h" | "4h" | "permanent";

export interface ServerBypassRule {
  serverId: number;
  durationType: BypassDuration;
  expiresAt: number | null;
  startedAt: number;
}

const STORAGE_KEY = "ops_ai_bypass_rules";

/** 从 localStorage 读取免审批规则字典 */
export function getBypassRules(): Record<number, ServerBypassRule> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const valid: Record<number, ServerBypassRule> = {};
    const now = Date.now();
    for (const [key, rule] of Object.entries(parsed as Record<string, ServerBypassRule>)) {
      if (rule.durationType === "permanent" || (rule.expiresAt && rule.expiresAt > now)) {
        valid[Number(key)] = rule;
      }
    }
    return valid;
  } catch {
    return {};
  }
}

/** 保存免审批规则字典 */
export function saveBypassRules(rules: Record<number, ServerBypassRule>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
  } catch {}
}

interface AiApprovalBypassPopoverProps {
  server: Server;
  /** 当前服务器免审批规则（可选外部传入，或组件内维护） */
  rule?: ServerBypassRule | null;
  /** 当免审批规则变更时的回调 */
  onRuleChange?: (rule: ServerBypassRule | null) => void;
}

export function AiApprovalBypassPopover({
  server,
  rule: externalRule,
  onRuleChange,
}: AiApprovalBypassPopoverProps) {
  const [open, setOpen] = useState(false);
  const [internalRule, setInternalRule] = useState<ServerBypassRule | null>(() => {
    const rules = getBypassRules();
    return rules[server.id] || null;
  });

  const currentRule = externalRule !== undefined ? externalRule : internalRule;

  // 定时刷新倒计时
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!currentRule || currentRule.durationType === "permanent") return;
    const timer = setInterval(() => {
      if (currentRule.expiresAt && Date.now() >= currentRule.expiresAt) {
        // 已过期
        handleCloseBypass(true);
      } else {
        setTick((t) => t + 1);
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [currentRule]);

  const isActive = Boolean(
    currentRule &&
      (currentRule.durationType === "permanent" ||
        (currentRule.expiresAt && Date.now() < currentRule.expiresAt))
  );

  // 格式化当前剩余时间
  const getRemainingText = (): string => {
    if (!currentRule || !isActive) return "未开启";
    if (currentRule.durationType === "permanent") return "已开启 (永久有效)";
    const diffMs = (currentRule.expiresAt || 0) - Date.now();
    if (diffMs <= 0) return "已过期";
    const totalMinutes = Math.ceil(diffMs / (60 * 1000));
    if (totalMinutes < 60) return `已开启 (剩余 ${totalMinutes} 分钟)`;
    const hours = Math.floor(totalMinutes / 60);
    const remMinutes = totalMinutes % 60;
    return `已开启 (剩余 ${hours} 小时${remMinutes > 0 ? ` ${remMinutes} 分钟` : ""})`;
  };

  const handleApplyBypass = (type: BypassDuration) => {
    const now = Date.now();
    let expiresAt: number | null = null;
    let label = "";

    if (type === "30m") {
      expiresAt = now + 30 * 60 * 1000;
      label = "30 分钟";
    } else if (type === "2h") {
      expiresAt = now + 2 * 3600 * 1000;
      label = "2 小时";
    } else if (type === "4h") {
      expiresAt = now + 4 * 3600 * 1000;
      label = "4 小时";
    } else if (type === "permanent") {
      expiresAt = null;
      label = "永久有效";
    }

    const newRule: ServerBypassRule = {
      serverId: server.id,
      durationType: type,
      expiresAt,
      startedAt: now,
    };

    const allRules = getBypassRules();
    allRules[server.id] = newRule;
    saveBypassRules(allRules);

    setInternalRule(newRule);
    onRuleChange?.(newRule);
    setOpen(false);
    message.success(`已为 [${server.alias || server.hostname}] 开启 AI 免审批（${label}）`);
  };

  const handleCloseBypass = (quiet = false) => {
    const allRules = getBypassRules();
    delete allRules[server.id];
    saveBypassRules(allRules);

    setInternalRule(null);
    onRuleChange?.(null);
    if (!quiet) {
      message.info(`已关闭 [${server.alias || server.hostname}] 的 AI 免审批，恢复常规审批`);
    }
  };

  const popoverContent = (
    <div
      className="p-3.5 rounded-2xl flex flex-col select-none"
      style={{
        width: 290,
        background: "#18181c",
        color: "#e2e8f0",
      }}
    >
      {/* 顶部标题行 */}
      <div className="flex items-center gap-2 mb-2">
        <Bot size={16} className="text-cyan-400" />
        <span className="font-semibold text-xs text-slate-100">AI 限时免审批</span>
      </div>

      {/* 说明文案（完全对齐截图） */}
      <p
        className="text-[11px] leading-relaxed mb-3"
        style={{ color: "rgba(226, 232, 240, 0.72)" }}
      >
        窗口内，AI 在本服务器上的命令 / 文件写入 / 部署，凡是「只因需要审批」被拦的自动放行，不再弹窗。仍会拦：危险命令、连白名单外的地址、来源可疑的命令；全局总开关关闭或档位为「禁用 / 只读」时一样不放行。单次最长 4 小时，到点自动失效。
      </p>

      {/* 当前状态与快捷关闭 */}
      <div
        className="flex items-center justify-between text-xs mb-3 pb-2"
        style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}
      >
        <span
          className="text-[11px] font-medium"
          style={{ color: isActive ? "#22d3ee" : "#94a3b8" }}
        >
          {getRemainingText()}
        </span>
        {isActive && (
          <button
            type="button"
            onClick={() => handleCloseBypass(false)}
            className="text-[11px] text-rose-400 hover:text-rose-300 transition cursor-pointer hover:underline"
          >
            关闭免审批
          </button>
        )}
      </div>

      {/* 选项按钮列表（30分钟、2小时、4小时、永久） */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => handleApplyBypass("30m")}
          className="px-2.5 py-1 rounded-lg text-xs transition cursor-pointer"
          style={{
            background:
              isActive && currentRule?.durationType === "30m"
                ? "rgba(34, 211, 238, 0.2)"
                : "rgba(255, 255, 255, 0.06)",
            color:
              isActive && currentRule?.durationType === "30m" ? "#67e8f9" : "#cbd5e1",
            border:
              isActive && currentRule?.durationType === "30m"
                ? "1px solid rgba(34, 211, 238, 0.5)"
                : "1px solid rgba(255, 255, 255, 0.12)",
          }}
        >
          开 30 分钟
        </button>

        <button
          type="button"
          onClick={() => handleApplyBypass("2h")}
          className="px-2.5 py-1 rounded-lg text-xs transition cursor-pointer"
          style={{
            background:
              isActive && currentRule?.durationType === "2h"
                ? "rgba(34, 211, 238, 0.2)"
                : "rgba(255, 255, 255, 0.06)",
            color:
              isActive && currentRule?.durationType === "2h" ? "#67e8f9" : "#cbd5e1",
            border:
              isActive && currentRule?.durationType === "2h"
                ? "1px solid rgba(34, 211, 238, 0.5)"
                : "1px solid rgba(255, 255, 255, 0.12)",
          }}
        >
          开 2 小时
        </button>

        <button
          type="button"
          onClick={() => handleApplyBypass("4h")}
          className="px-2.5 py-1 rounded-lg text-xs transition cursor-pointer"
          style={{
            background:
              isActive && currentRule?.durationType === "4h"
                ? "rgba(34, 211, 238, 0.2)"
                : "rgba(255, 255, 255, 0.06)",
            color:
              isActive && currentRule?.durationType === "4h" ? "#67e8f9" : "#cbd5e1",
            border:
              isActive && currentRule?.durationType === "4h"
                ? "1px solid rgba(34, 211, 238, 0.5)"
                : "1px solid rgba(255, 255, 255, 0.12)",
          }}
        >
          开 4 小时
        </button>

        <button
          type="button"
          onClick={() => handleApplyBypass("permanent")}
          className="px-2.5 py-1 rounded-lg text-xs transition cursor-pointer"
          style={{
            background:
              isActive && currentRule?.durationType === "permanent"
                ? "rgba(34, 211, 238, 0.2)"
                : "rgba(255, 255, 255, 0.06)",
            color:
              isActive && currentRule?.durationType === "permanent"
                ? "#67e8f9"
                : "#cbd5e1",
            border:
              isActive && currentRule?.durationType === "permanent"
                ? "1px solid rgba(34, 211, 238, 0.5)"
                : "1px solid rgba(255, 255, 255, 0.12)",
          }}
        >
          永久有效
        </button>
      </div>
    </div>
  );

  // 悬停提示文字：不点击鼠标放上去显示「AI免审批：点击设置」
  const tooltipText = isActive
    ? `AI免审批：${getRemainingText()}，点击修改`
    : "AI免审批：点击设置";

  return (
    <Popover
      content={popoverContent}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomLeft"
      overlayInnerStyle={{
        padding: 0,
        borderRadius: 16,
        background: "#18181c",
        border: "1px solid rgba(255, 255, 255, 0.14)",
        boxShadow:
          "0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
      }}
    >
      <Tooltip title={open ? "" : tooltipText} placement="top">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="inline-flex items-center justify-center p-0.5 rounded transition cursor-pointer hover:bg-slate-700/30"
          style={{
            outline: "none",
            border: "none",
            background: "transparent",
          }}
        >
          <Bot
            size={13}
            className={`transition-all ${
              isActive
                ? "text-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.75)]"
                : "text-slate-400 hover:text-slate-200"
            }`}
          />
        </button>
      </Tooltip>
    </Popover>
  );
}
