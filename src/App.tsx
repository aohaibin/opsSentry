import { useEffect, useState } from "react";
import { ConfigProvider, theme } from "antd";
import zhCN from "antd/locale/zh_CN";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useAppStore } from "@/store";
import { resolveTheme } from "@/store/app";
import { AppRouter } from "@/Router";

function App() {
  const appTheme = useAppStore((s) => s.theme);
  const [resolved, setResolved] = useState<"light" | "dark">(
    resolveTheme(appTheme)
  );

  useEffect(() => {
    // 非 system 模式直接应用
    if (appTheme !== "system") {
      setResolved(appTheme);
      return;
    }

    // system 模式：立即解析 + 监听系统变化
    setResolved(resolveTheme("system"));
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) =>
      setResolved(e.matches ? "dark" : "light");
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [appTheme]);

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm:
          resolved === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: {
          borderRadius: 6,
        },
      }}
    >
      <ErrorBoundary>
        <AppRouter />
      </ErrorBoundary>
    </ConfigProvider>
  );
}

export default App;
