import type { ThemeConfig } from "antd";
import { theme } from "antd";

/**
 * 暗色/亮色主题的共享 token
 * 与 variables.css 设计令牌保持同步
 */
const sharedToken: ThemeConfig["token"] = {
  borderRadius: 8,
  borderRadiusSM: 6,
  borderRadiusLG: 12,
  fontSize: 13,
  controlHeight: 32,
  controlHeightSM: 24,
  controlHeightLG: 40,
};

/** 共享的组件级覆盖 */
const sharedComponents: ThemeConfig["components"] = {
  Button: {
    borderRadius: 6,
  },
  Input: {
    borderRadius: 6,
  },
  Select: {
    borderRadius: 6,
  },
  Modal: {
    borderRadiusLG: 12,
  },
  Table: {
    borderRadius: 6,
  },
};

/** 暗色主题（与 variables.css :root[data-theme="dark"] 同步 - 运维助手风格） */
export const darkTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    ...sharedToken,
    colorPrimary: "#6366f1",
    colorSuccess: "#22c55e",
    colorWarning: "#f59e0b",
    colorError: "#ef4444",
    colorInfo: "#3b82f6",
    colorBgContainer: "#1e293b",
    colorBgElevated: "#334155",
    colorBgLayout: "#0f172a",
    colorText: "#f1f5f9",
    colorTextSecondary: "#94a3b8",
    colorTextTertiary: "#64748b",
    colorBorder: "rgba(255, 255, 255, 0.08)",
    colorBorderSecondary: "rgba(255, 255, 255, 0.04)",
  },
  components: {
    ...sharedComponents,
    Layout: {
      bodyBg: "#0f172a",
      siderBg: "#1e293b",
      headerBg: "rgba(15, 23, 42, 0.95)",
    },
    Menu: {
      darkItemBg: "#1e293b",
      darkItemSelectedBg: "rgba(99, 102, 241, 0.15)",
      darkItemHoverBg: "#334155",
    },
    Card: {
      borderRadiusLG: 12,
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
    },
    Tooltip: {
      colorBgSpotlight: "#334155",
      colorTextLightSolid: "#f1f5f9",
    },
    Table: {
      headerBg: "#1e293b",
      rowHoverBg: "#334155",
    },
  },
};

/** 亮色主题 */
export const lightTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: {
    ...sharedToken,
    colorPrimary: "#4f46e5",
    colorSuccess: "#22c55e",
    colorWarning: "#f59e0b",
    colorError: "#ef4444",
    colorInfo: "#3b82f6",
    colorBgContainer: "#ffffff",
    colorBgElevated: "#ffffff",
    colorBgLayout: "#f8fafc",
    colorText: "#0f172a",
    colorTextSecondary: "#475569",
    colorTextTertiary: "#94a3b8",
    colorBorder: "#e2e8f0",
    colorBorderSecondary: "#f1f5f9",
  },
  components: {
    ...sharedComponents,
    Tooltip: {
      colorBgSpotlight: "#0f172a",
      colorTextLightSolid: "#ffffff",
    },
  },
};

/** 根据 resolved theme 获取对应 Ant Design 主题配置 */
export function getAntdTheme(resolved: "light" | "dark"): ThemeConfig {
  return resolved === "dark" ? darkTheme : lightTheme;
}
