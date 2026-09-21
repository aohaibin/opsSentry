import { useEffect, useRef } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import type { Server, TerminalSessionInfo } from "@/types";

interface TerminalPaneProps {
  session: TerminalSessionInfo;
  server: Server;
  output: string;
  statusMessage: string;
  fontSize: number;
  onInput: (sessionId: string, data: string) => void;
  onResize: (sessionId: string, cols: number, rows: number) => void;
  onFocus: (sessionId: string) => void;
}

export function TerminalPane({
  session,
  server,
  output,
  statusMessage,
  fontSize,
  onInput,
  onResize,
  onFocus,
}: TerminalPaneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const writtenOutputRef = useRef("");
  const inputHandlerRef = useRef(onInput);
  const resizeHandlerRef = useRef(onResize);
  const focusHandlerRef = useRef(onFocus);

  inputHandlerRef.current = onInput;
  resizeHandlerRef.current = onResize;
  focusHandlerRef.current = onFocus;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const terminal = new Terminal({
      allowProposedApi: false,
      convertEol: false,
      cursorBlink: true,
      cursorStyle: "block",
      fontFamily: "Cascadia Code, JetBrains Mono, Consolas, monospace",
      fontSize,
      lineHeight: 1.2,
      scrollback: 8_000,
      theme: {
        background: "#020409",
        foreground: "#d7e3f4",
        cursor: "#34d399",
        cursorAccent: "#020409",
        selectionBackground: "#155e7566",
        black: "#111827",
        red: "#fb7185",
        green: "#34d399",
        yellow: "#fbbf24",
        blue: "#60a5fa",
        magenta: "#c084fc",
        cyan: "#22d3ee",
        white: "#e2e8f0",
        brightBlack: "#64748b",
        brightRed: "#fda4af",
        brightGreen: "#6ee7b7",
        brightYellow: "#fde68a",
        brightBlue: "#93c5fd",
        brightMagenta: "#d8b4fe",
        brightCyan: "#67e8f9",
        brightWhite: "#f8fafc",
      },
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(host);
    terminalRef.current = terminal;
    fitRef.current = fit;

    const dataDisposable = terminal.onData((data) => {
      inputHandlerRef.current(session.sessionId, data);
    });
    const resizeDisposable = terminal.onResize(({ cols, rows }) => {
      resizeHandlerRef.current(session.sessionId, cols, rows);
    });
    const handleFocus = () => {
      focusHandlerRef.current(session.sessionId);
    };
    host.addEventListener("focusin", handleFocus);

    const observer = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        try {
          fit.fit();
        } catch {
          // 分屏切换过程中容器可能短暂为 0 尺寸，下一次 ResizeObserver 会重试。
        }
      });
    });
    observer.observe(host);
    window.requestAnimationFrame(() => {
      fit.fit();
      terminal.focus();
    });

    return () => {
      observer.disconnect();
      dataDisposable.dispose();
      resizeDisposable.dispose();
      host.removeEventListener("focusin", handleFocus);
      terminal.dispose();
      terminalRef.current = null;
      fitRef.current = null;
      writtenOutputRef.current = "";
    };
  }, [session.sessionId]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.fontSize = fontSize;
    window.requestAnimationFrame(() => fitRef.current?.fit());
  }, [fontSize]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal || output === writtenOutputRef.current) return;

    if (output.startsWith(writtenOutputRef.current)) {
      terminal.write(output.slice(writtenOutputRef.current.length));
    } else {
      terminal.reset();
      terminal.write(output);
    }
    writtenOutputRef.current = output;
  }, [output]);

  const disconnected = session.status === "closed" || session.status === "error";

  return (
    <div
      className={`ops-terminal-pane ${disconnected ? "is-disconnected" : ""}`}
      onMouseDown={() => onFocus(session.sessionId)}
    >
      <div className="ops-terminal-pane-head">
        <span>
          <span className="ops-terminal-online-dot" data-status={session.status} />
          {server.username}@{server.alias} ({server.hostname}:{server.port})
        </span>
        <span>{session.status === "connected" ? "SSH PTY · UTF-8" : statusMessage}</span>
      </div>
      <div className="ops-terminal-xterm" ref={hostRef} />
      {disconnected && (
        <div className="ops-terminal-disconnected">
          <strong>{session.status === "error" ? "会话异常中断" : "会话已断开"}</strong>
          <span>{statusMessage || "重新连接需要再次验证凭据"}</span>
        </div>
      )}
    </div>
  );
}
