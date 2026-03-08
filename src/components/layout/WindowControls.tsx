import { useEffect, useState, useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, Copy, X } from "lucide-react";
import { theme as antdTheme } from "antd";

export function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const { token } = antdTheme.useToken();

  const appWindow = getCurrentWindow();

  useEffect(() => {
    appWindow.isMaximized().then(setIsMaximized);

    const unlisten = appWindow.onResized(async () => {
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [appWindow]);

  const handleMinimize = useCallback(() => {
    appWindow.minimize();
  }, [appWindow]);

  const handleToggleMaximize = useCallback(() => {
    appWindow.toggleMaximize();
  }, [appWindow]);

  const handleClose = useCallback(() => {
    appWindow.close();
  }, [appWindow]);

  function getButtonStyle(id: string): React.CSSProperties {
    const isHovered = hovered === id;
    const isClose = id === "close";

    if (isHovered && isClose) {
      return { backgroundColor: "#e81123", color: "#fff" };
    }
    if (isHovered) {
      return { backgroundColor: token.colorFillSecondary };
    }
    return {};
  }

  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 46,
    height: 34,
    border: "none",
    background: "transparent",
    color: token.colorText,
    cursor: "pointer",
    transition: "background-color 0.15s, color 0.15s",
    outline: "none",
    padding: 0,
  };

  return (
    <div style={{ display: "flex", alignItems: "center", height: 48 }}>
      <button
        style={{ ...baseStyle, ...getButtonStyle("min") }}
        onMouseEnter={() => setHovered("min")}
        onMouseLeave={() => setHovered(null)}
        onClick={handleMinimize}
        title="最小化"
      >
        <Minus size={16} strokeWidth={1.5} />
      </button>
      <button
        style={{ ...baseStyle, ...getButtonStyle("max") }}
        onMouseEnter={() => setHovered("max")}
        onMouseLeave={() => setHovered(null)}
        onClick={handleToggleMaximize}
        title={isMaximized ? "还原" : "最大化"}
      >
        {isMaximized ? (
          <Copy size={13} strokeWidth={1.5} />
        ) : (
          <Square size={13} strokeWidth={1.5} />
        )}
      </button>
      <button
        style={{ ...baseStyle, ...getButtonStyle("close") }}
        onMouseEnter={() => setHovered("close")}
        onMouseLeave={() => setHovered(null)}
        onClick={handleClose}
        title="关闭"
      >
        <X size={16} strokeWidth={1.5} />
      </button>
    </div>
  );
}
