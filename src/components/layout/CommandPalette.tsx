/**
 * 全局搜索 / 命令面板（Ctrl K）。
 *
 * 原型顶栏中部有一个「搜索 / 问AI... Ctrl K」入口，点开是命令面板。
 * 这里先实现「按模块名与能力关键词快速跳转」这一层——它是纯前端的，
 * 不需要后端支持就能真的用起来；「问 AI」那部分等 AI 桥接中心落地后再接。
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Modal } from "antd";
import { CornerDownLeft, Search } from "lucide-react";
import { MODULES, modulePath } from "@/navigation/modules";
import { useAppStore } from "@/store/app";

export function CommandPalette() {
  const open = useAppStore((s) => s.commandPaletteOpen);
  const setOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 全局热键：Ctrl+K / Cmd+K 开合面板
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!useAppStore.getState().commandPaletteOpen);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setOpen]);

  // 每次打开都重置，避免上次的搜索词突然出现
  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      // Modal 有入场动画，等一帧再聚焦更稳
      const t = window.setTimeout(() => inputRef.current?.focus(), 60);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MODULES;
    return MODULES.filter((m) =>
      [m.title, m.navLabel, m.subtitle, m.desc, ...m.capabilities]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [query]);

  // 结果变短时把光标收回范围内，否则回车会落到不存在的项上
  useEffect(() => {
    setCursor((c) => (c >= results.length ? 0 : c));
  }, [results.length]);

  function go(index: number) {
    const target = results[index];
    if (!target) return;
    setOpen(false);
    navigate(modulePath(target.key));
  }

  function onInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (results.length === 0 ? 0 : (c + 1) % results.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (results.length === 0 ? 0 : (c - 1 + results.length) % results.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(cursor);
    }
  }

  return (
    <Modal
      open={open}
      onCancel={() => setOpen(false)}
      footer={null}
      closable={false}
      width={560}
      styles={{ body: { padding: 0 } }}
      className="ops-modal"
    >
      <div className="flex items-center" style={{ gap: 10, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <Search size={15} style={{ color: "var(--brand-400)", flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder="搜索模块，或输入运维意图…"
          style={{
            flex: 1,
            border: "none",
            outline: "none",
            background: "transparent",
            color: "var(--text-primary)",
            fontSize: 13,
          }}
        />
        <kbd
          style={{
            padding: "2px 6px",
            borderRadius: 4,
            background: "var(--surface-950)",
            border: "1px solid var(--border)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--text-muted)",
          }}
        >
          Esc
        </kbd>
      </div>

      <div className="custom-scrollbar" style={{ maxHeight: 360, overflowY: "auto", padding: 8 }}>
        {results.length === 0 ? (
          <div style={{ padding: "28px 0", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
            没有匹配的模块
          </div>
        ) : (
          results.map((m, idx) => {
            const Icon = m.icon;
            const active = idx === cursor;
            return (
              <button
                key={m.key}
                type="button"
                onMouseEnter={() => setCursor(idx)}
                onClick={() => go(idx)}
                className="flex items-center w-full"
                style={{
                  gap: 10,
                  padding: "9px 10px",
                  borderRadius: 8,
                  border: "none",
                  textAlign: "left",
                  background: active ? "var(--bg-hover)" : "transparent",
                  cursor: "pointer",
                }}
              >
                <Icon size={16} style={{ color: active ? "var(--nav-active-icon)" : "var(--text-muted)", flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    className="block truncate"
                    style={{ fontSize: 13, color: "var(--text-primary)" }}
                  >
                    {m.title}
                  </span>
                  <span
                    className="block truncate"
                    style={{ fontSize: 11, color: "var(--text-muted)" }}
                  >
                    {m.subtitle || m.desc}
                  </span>
                </span>
                {!m.implemented && (
                  <span
                    style={{
                      flexShrink: 0,
                      padding: "1px 6px",
                      borderRadius: 4,
                      border: "1px solid var(--border)",
                      fontSize: 10,
                      color: "var(--text-muted)",
                    }}
                  >
                    规划中
                  </span>
                )}
                {active && <CornerDownLeft size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />}
              </button>
            );
          })
        )}
      </div>
    </Modal>
  );
}

/** 顶栏中部的搜索入口按钮（原型：搜索 / 问AI... + Ctrl K 键位提示） */
export function CommandPaletteButton() {
  const setOpen = useAppStore((s) => s.setCommandPaletteOpen);

  return (
    <button
      type="button"
      className="header-pill"
      onClick={() => setOpen(true)}
      title="全局搜索与命令面板"
      style={{ gap: 8, height: 30, paddingLeft: 10, minWidth: 220, color: "var(--text-muted)" }}
    >
      <Search size={13} style={{ color: "var(--brand-400)" }} />
      <span style={{ flex: 1, textAlign: "left" }}>搜索 / 问AI...</span>
      <kbd
        style={{
          padding: "1px 5px",
          borderRadius: 4,
          background: "var(--surface-950)",
          border: "1px solid var(--border)",
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 600,
          color: "var(--text-muted)",
        }}
      >
        Ctrl K
      </kbd>
    </button>
  );
}
