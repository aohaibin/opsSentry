/**
 * AI 策略档位徽章与下拉菜单。
 *
 * 视觉完全对齐用户截图 media_1790004662510.png：
 * 5 档彩色胶囊药丸：
 * 1. 禁用 (灰色)
 * 2. 只读 (翠绿色)
 * 3. 审批 (天青色)
 * 4. 白名单 (金黄色)
 * 5. 信任 (珊瑚玫红色)
 */

import { useState } from "react";
import { Popover } from "antd";
import { ChevronDown } from "lucide-react";
import type { AIPolicy } from "@/types";
import {
  AI_POLICY_META,
  AI_POLICY_ORDER,
  POLICY_STYLES,
  normalizeAIPolicy,
} from "../lib/serverMeta";


interface AiPolicyBadgeProps {
  policy: AIPolicy;
  /** 不传则退化成纯展示；传了才可点 */
  onChange?: (policy: AIPolicy) => void;
}

export function AiPolicyBadge({ policy, onChange }: AiPolicyBadgeProps) {
  const [open, setOpen] = useState(false);
  const normKey = normalizeAIPolicy(policy);
  const curStyle = POLICY_STYLES[normKey] || POLICY_STYLES.trusted;
  const meta = AI_POLICY_META[policy as AIPolicy] || AI_POLICY_META[normKey as AIPolicy] || AI_POLICY_META.trusted;

  const triggerBadge = (
    <button
      type="button"
      onClick={() => onChange && setOpen(!open)}
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium transition cursor-pointer hover:opacity-90 shadow-sm"
      style={{
        background: curStyle.bg,
        color: curStyle.fg,
        border: `1px solid ${curStyle.border}`,
      }}
      title={`AI 策略：${meta?.label || curStyle.label}（点击切换）`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: curStyle.dot }}
      />
      <span>{curStyle.label}</span>
      {onChange && <ChevronDown size={11} className="opacity-70" />}
    </button>
  );

  if (!onChange) {
    return triggerBadge;
  }

  const menuContent = (
    <div
      className="p-1.5 rounded-2xl flex flex-col gap-1.5 select-none"
      style={{
        minWidth: 104,
        background: "#18181c",
      }}
    >
      {AI_POLICY_ORDER.map((item) => {
        const itemStyle = POLICY_STYLES[item] || POLICY_STYLES.trusted;
        const isSelected = normKey === item;

        return (
          <button
            key={item}
            type="button"
            onClick={() => {
              onChange(item);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer text-left"
            style={{
              background: isSelected ? itemStyle.hoverBg : itemStyle.bg,
              color: itemStyle.fg,
              border: `1px solid ${itemStyle.border}`,
            }}
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ background: itemStyle.dot }}
            />
            <span>{itemStyle.label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <Popover
      content={menuContent}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement="bottomLeft"
      overlayInnerStyle={{
        padding: 0,
        borderRadius: 16,
        background: "#18181c",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
      }}
    >
      {triggerBadge}
    </Popover>
  );
}
