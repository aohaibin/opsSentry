/**
 * 顶栏下拉卡片的通用外壳。
 *
 * 原型里版本号 / AI 锁定 / 皮肤调色盘都是「按钮 + 浮层卡片」的同一套交互
 * （圆角 2xl、半透明、毛玻璃、右上角对齐），各自复制一遍会有三份几乎相同的
 * 定位与关闭逻辑。这里收敛成一个外壳，只管开合与浮层样式，内容由调用方给。
 */

import { useEffect, useRef, useState, type ReactNode } from "react";

interface HeaderDropdownProps {
  /** 触发按钮。拿到 open 与 toggle，自行决定按钮长什么样 */
  trigger: (state: { open: boolean; toggle: () => void }) => ReactNode;
  children: ReactNode;
  /** 浮层宽度，默认 320（原型的 w-80） */
  width?: number;
}

export function HeaderDropdown({
  trigger,
  children,
  width = 320,
}: HeaderDropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    // 点击浮层或按钮之外的地方收起
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    // Esc 收起，键盘用户不必去够按钮
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      {trigger({ open, toggle: () => setOpen((v) => !v) })}

      {open && (
        <div
          className="absolute right-0 z-50 shadow-2xl"
          style={{
            top: 44,
            width,
            padding: 16,
            borderRadius: 16,
            border: "1px solid var(--border)",
            background: "var(--surface-900)",
            boxShadow: "0 20px 45px -10px rgba(0, 0, 0, 0.6), 0 0 0 1px var(--border)",
            zIndex: 100,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

/** 浮层顶部标题行：图标 + 标题 + 右侧说明 */
export function DropdownHeading({
  icon,
  title,
  hint,
  onClose,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  onClose?: () => void;
}) {
  return (
    <div
      className="flex items-center justify-between"
      style={{
        paddingBottom: 8,
        borderBottom: "1px solid var(--border)",
        cursor: onClose ? "pointer" : undefined,
      }}
      onClick={onClose}
    >
      <span
        className="flex items-center"
        style={{ gap: 6, fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}
      >
        {icon}
        {title}
      </span>
      {hint && (
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{hint}</span>
      )}
    </div>
  );
}
