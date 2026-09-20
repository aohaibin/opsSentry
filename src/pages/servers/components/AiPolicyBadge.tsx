/**
 * AI 策略档位徽章。
 *
 * 视觉严格对齐原型 renderServerTable() 里的 policyBadge：
 * 10px 小胶囊 + 半透明同色底 + 同色描边（原型是 strict / readonly / autonomous / disabled 四档）。
 *
 * 与原型唯一的行为差异：原型里它是纯展示，这里挂了点击下拉。
 * 理由——策略是这套产品里被调得最频繁的字段，
 * 「先勾选 → 再开批量弹窗」改单台机器的代价太高。
 * 收缩状态下与原型完全一致，不会破坏视觉基线。
 *
 * 配色刻意不写死十六进制：改用 color-mix 从主题令牌派生，
 * 这样 6 套皮肤（含 3 套亮色）切换时徽章文字仍有足够对比度。
 * color-mix 在本项目已有先例（variables.css 的 .ops-modal .ant-modal-header）。
 */

import { Dropdown, type MenuProps } from "antd";
import type { AIPolicy } from "@/types";
import { AI_POLICY_META, AI_POLICY_ORDER } from "../lib/serverMeta";

/**
 * 档位 → 配色。左侧是我们的策略档，右侧括号里是原型对应的档位。
 * 两套梯次都是「越往下越严」的四级，逐级对齐：
 *   trusted ↔ autonomous、allowlist ↔ readonly、approval ↔ strict、denied ↔ disabled
 */
const TONE: Record<AIPolicy, { bg: string; fg: string; border: string }> = {
  trusted: {
    bg: "color-mix(in srgb, var(--success) 16%, transparent)",
    fg: "var(--success)",
    border: "color-mix(in srgb, var(--success) 34%, transparent)",
  },
  allowlist: {
    bg: "color-mix(in srgb, var(--info) 16%, transparent)",
    fg: "var(--info)",
    border: "color-mix(in srgb, var(--info) 34%, transparent)",
  },
  approval: {
    bg: "color-mix(in srgb, var(--warning) 16%, transparent)",
    fg: "var(--warning)",
    border: "color-mix(in srgb, var(--warning) 34%, transparent)",
  },
  denied: {
    bg: "var(--bg-tertiary)",
    fg: "var(--text-secondary)",
    border: "var(--border)",
  },
};

interface AiPolicyBadgeProps {
  policy: AIPolicy;
  /** 不传则退化成纯展示（原型形态）；传了才可点 */
  onChange?: (policy: AIPolicy) => void;
}

export function AiPolicyBadge({ policy, onChange }: AiPolicyBadgeProps) {
  // 数据库里可能存着历史档位（例如早期写入的未知值），取不到就退到「需审批」这一档，
  // 宁可显示保守的档位，也不要在表格里渲染一个没有语义的空白
  const meta = AI_POLICY_META[policy] ?? AI_POLICY_META.approval;
  const tone = TONE[policy] ?? TONE.approval;

  const badge = (
    <span
      className="inline-flex items-center whitespace-nowrap"
      style={{
        padding: "1px 8px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 500,
        lineHeight: "17px",
        background: tone.bg,
        color: tone.fg,
        border: `1px solid ${tone.border}`,
      }}
    >
      {meta.label}
    </span>
  );

  if (!onChange) {
    return <span title={meta.hint}>{badge}</span>;
  }

  const items: MenuProps["items"] = AI_POLICY_ORDER.map((item) => ({
    key: item,
    label: (
      <div style={{ lineHeight: 1.4 }}>
        <div style={{ fontSize: 12 }}>{AI_POLICY_META[item].label}</div>
        <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
          {AI_POLICY_META[item].hint}
        </div>
      </div>
    ),
  }));

  return (
    <Dropdown
      trigger={["click"]}
      menu={{
        items,
        selectedKeys: [policy],
        onClick: ({ key }) => onChange(key as AIPolicy),
      }}
    >
      <span
        style={{ display: "inline-flex", cursor: "pointer" }}
        title={`点击调整 AI 策略（当前：${meta.label} — ${meta.hint}）`}
      >
        {badge}
      </span>
    </Dropdown>
  );
}
