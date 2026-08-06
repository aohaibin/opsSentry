import { useEffect, useState } from "react";
import { ConfigProvider } from "antd";
import { StyleProvider } from "@ant-design/cssinjs";
import GlobalNativeTooltip from "@/components/GlobalNativeTooltip";
import zhCN from "antd/locale/zh_CN";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { useAppStore } from "@/store";
import { resolveTheme } from "@/store/app";
import { getAntdTheme } from "@/theme/antdTheme";
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

  // 将 resolved theme 写入 DOM，驱动 CSS 变量切换
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
  }, [resolved]);

  return (
    // StyleProvider layer：把 antd 运行时注入的样式装进 @layer antd。
    // 层顺序由 src/styles/global.css 首行的 @layer 声明决定（antd 排在 utilities 之前），
    // 否则 antd 层会被追加到序列末尾，Tailwind 工具类照样覆盖不了。
    <StyleProvider layer>
      <ConfigProvider locale={zhCN} theme={getAntdTheme(resolved)}>
        <ErrorBoundary>
          <AppRouter />
        </ErrorBoundary>
        <GlobalNativeTooltip />
      </ConfigProvider>
    </StyleProvider>
  );
}

export default App;
