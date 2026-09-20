/**
 * 通用模块占位页。
 *
 * 原型有 17 个一级模块，当前项目只落地了服务器资产 / 主机工作台 / 系统配置三块。
 * 与其为了让导航看起来完整而塞一堆「敬请期待」空图，这里的占位页明确交代三件事：
 *   1. 这个模块在产品里的定位（desc）
 *   2. 它计划具备哪些能力（capabilities）
 *   3. 当前为什么是空的（避免被误读成「做坏了」）
 *
 * 一个组件承载全部 14 个模块，靠 navigation/modules.ts 的数据驱动，
 * 不建 14 个几乎一样的文件。
 */

import { Link } from "react-router-dom";
import { ArrowRight, Circle, Clock3, Info } from "lucide-react";
import { MODULES, modulePath, type ModuleDef } from "@/navigation/modules";

export function ModulePlaceholder({ module: mod }: { module: ModuleDef }) {
  const Icon = mod.icon;
  // 同组的相邻模块，给用户一条继续往下走的路径，而不是走到死胡同
  const siblings = MODULES.filter((m) => m.key !== mod.key && m.group === mod.group).slice(0, 4);

  return (
    <div className="ops-page space-y-4">
      <div className="ops-page-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="ops-page-title">
            <Icon size={18} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
            <span>{mod.title}</span>
            {mod.subtitle && <span className="ops-page-subtitle">（{mod.subtitle}）</span>}
          </h1>
          <p className="ops-page-desc">{mod.desc}</p>
        </div>

        <span
          className="flex items-center shrink-0"
          style={{
            gap: 5,
            padding: "4px 10px",
            borderRadius: 8,
            border: "1px solid rgba(245, 158, 11, 0.35)",
            background: "rgba(245, 158, 11, 0.12)",
            color: "#fbbf24",
            fontSize: 11,
            fontWeight: 500,
          }}
        >
          <Clock3 size={12} />
          模块规划中
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="ops-panel" style={{ borderRadius: 12, padding: 14 }}>
          <h2 className="ops-section-title" style={{ marginBottom: 10 }}>
            <Icon size={13} />
            规划中的能力
          </h2>
          <ul style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {mod.capabilities.map((cap) => (
              <li key={cap} className="flex" style={{ gap: 8, alignItems: "flex-start" }}>
                <Circle
                  size={7}
                  fill="var(--text-muted)"
                  color="var(--text-muted)"
                  style={{ marginTop: 6, flexShrink: 0 }}
                />
                <span style={{ fontSize: 12, lineHeight: 1.7, color: "var(--text-secondary)" }}>
                  {cap}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="ops-panel" style={{ borderRadius: 12, padding: 14 }}>
          <h2 className="ops-section-title" style={{ marginBottom: 10 }}>
            <Info size={13} />
            当前状态说明
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 12, lineHeight: 1.9, color: "var(--text-secondary)" }}>
              这一页是按照原型 <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-primary)" }}>
                docs/remote-ops-ai-prototype.html
              </span>{" "}
              的模块定位先行占位的。导航、路由、文案已经与原型对齐，但页面内还没有真实功能
              —— 它现在是空的，不是坏掉了。
            </p>

            <div
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                background: "var(--bg-secondary)",
                borderLeft: "2px solid var(--warning)",
              }}
            >
              <p style={{ fontSize: 11, lineHeight: 1.8, color: "var(--text-secondary)" }}>
                该模块依赖的后端能力（SSH 会话通道、命令执行与超时控制、审计存证链路等）
                尚未实现。在后端就绪前，硬做界面只会产出一屏点不动的按钮。
              </p>
            </div>

            <div>
              <h3 style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>
                相关模块
              </h3>
              <div className="flex flex-wrap" style={{ gap: 6 }}>
                {siblings.map((s) => (
                  <Link
                    key={s.key}
                    to={modulePath(s.key)}
                    className="flex items-center"
                    style={{
                      gap: 4,
                      padding: "4px 9px",
                      borderRadius: 9999,
                      border: "1px solid var(--border)",
                      background: "var(--bg-secondary)",
                      fontSize: 11,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {s.navLabel}
                    <ArrowRight size={11} />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
