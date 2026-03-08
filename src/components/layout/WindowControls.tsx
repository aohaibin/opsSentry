import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, Copy, X } from "lucide-react";

const appWindow = getCurrentWindow();

export function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // 初始化最大化状态
    appWindow.isMaximized().then(setIsMaximized);

    // 监听窗口大小变化以更新最大化状态
    const unlisten = appWindow.onResized(async () => {
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <div className="flex items-center" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
      <button
        className="window-control-btn"
        onClick={() => appWindow.minimize()}
        title="最小化"
      >
        <Minus size={16} />
      </button>
      <button
        className="window-control-btn"
        onClick={async () => {
          await appWindow.toggleMaximize();
        }}
        title={isMaximized ? "还原" : "最大化"}
      >
        {isMaximized ? <Copy size={14} /> : <Square size={14} />}
      </button>
      <button
        className="window-control-btn window-control-close"
        onClick={() => appWindow.close()}
        title="关闭"
      >
        <X size={16} />
      </button>
    </div>
  );
}
