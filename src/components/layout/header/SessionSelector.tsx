/**
 * 顶栏「当前会话」选择器。
 *
 * 原型用一个原生 <select> 承载，这里沿用原生控件：
 * 键鼠可达性、长列表滚动、输入法行为都由浏览器保证，比自绘下拉省事且更稳。
 * 样式上只把边框和背景抹平，塞进顶栏的胶囊里。
 */

import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { serverApi } from "@/lib/api/server";
import { useAppStore } from "@/store/app";
import type { Server } from "@/types";

export function SessionSelector() {
  const [servers, setServers] = useState<Server[]>([]);
  const activeServerId = useAppStore((s) => s.activeServerId);
  const setActiveServerId = useAppStore((s) => s.setActiveServerId);
  const pathname = useLocation().pathname;

  // 路由一变就重新拉一次：资产页增删服务器后，顶栏的会话列表要跟着走。
  useEffect(() => {
    let cancelled = false;

    serverApi
      .list()
      .then((data) => {
        if (cancelled) return;
        setServers(data);

        const current = useAppStore.getState().activeServerId;
        const stillExists = data.some((s) => s.id === current);
        if (!stillExists) {
          // 会话被删掉、或首次进入尚无会话时，落到第一台，避免顶栏出现空会话
          useAppStore.getState().setActiveServerId(data[0]?.id ?? null);
        }
      })
      .catch(() => {
        // 资产库尚未就绪（例如表还在迁移）时静默处理，不拿顶栏去打扰用户
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const empty = servers.length === 0;

  return (
    <div className="header-pill" style={{ gap: 8, paddingLeft: 10, paddingRight: 8 }}>
      <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8 }}>
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 9999,
            background: "#34d399",
            opacity: 0.75,
            animation: "nav-dot-pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
          }}
        />
        <span
          style={{ position: "relative", width: 8, height: 8, borderRadius: 9999, background: "#10b981" }}
        />
      </span>

      <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>当前会话:</span>

      <select
        value={activeServerId ?? ""}
        onChange={(e) => setActiveServerId(e.target.value ? Number(e.target.value) : null)}
        disabled={empty}
        style={{
          maxWidth: 240,
          border: "none",
          outline: "none",
          background: "transparent",
          color: empty ? "var(--text-muted)" : "var(--text-primary)",
          fontSize: 12,
          fontWeight: 500,
          cursor: empty ? "not-allowed" : "pointer",
        }}
      >
        {empty ? (
          <option value="">暂无纳管服务器</option>
        ) : (
          servers.map((s) => (
            <option
              key={s.id}
              value={s.id}
              style={{ background: "var(--surface-900)", color: "var(--text-primary)" }}
            >
              {s.alias} ({s.hostname}){s.group ? ` [${s.group}]` : ""}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
