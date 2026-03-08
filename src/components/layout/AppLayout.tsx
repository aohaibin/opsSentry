import { Outlet, useNavigate } from "react-router-dom";
import { Layout, Button, theme as antdTheme } from "antd";
import { MenuFoldOutlined, MenuUnfoldOutlined, SettingOutlined } from "@ant-design/icons";
import { Sun, Moon } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useAppStore } from "@/store";
import { Sidebar } from "./Sidebar";
import { WindowControls } from "./WindowControls";

const { Header, Sider, Content } = Layout;

const appWindow = getCurrentWindow();

/** Header 中间的可拖拽空白区域 */
function DragRegion() {
  function handleMouseDown(e: React.MouseEvent) {
    if (e.buttons === 1) {
      if (e.detail === 2) {
        appWindow.toggleMaximize();
      } else {
        appWindow.startDragging();
      }
    }
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        flex: 1,
        height: "100%",
        cursor: "default",
        userSelect: "none",
      }}
    />
  );
}

export function AppLayout() {
  const { sidebarCollapsed, toggleSidebar, theme, toggleTheme } =
    useAppStore();
  const { token } = antdTheme.useToken();
  const navigate = useNavigate();

  return (
    <Layout style={{ height: "100vh" }}>
      <Sider
        collapsed={sidebarCollapsed}
        collapsedWidth={60}
        width={220}
        theme={theme === "dark" ? "dark" : "light"}
        style={{
          borderRight: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Sidebar />
      </Sider>
      <Layout>
        <Header
          style={{
            padding: 0,
            height: 48,
            lineHeight: "48px",
            display: "flex",
            alignItems: "center",
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 4, paddingLeft: 16 }}>
            <Button
              type="text"
              icon={
                sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />
              }
              onClick={toggleSidebar}
            />
          </div>
          <DragRegion />
          <div style={{ display: "flex", alignItems: "center" }}>
            <Button
              type="text"
              icon={theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              onClick={toggleTheme}
            />
            <Button
              type="text"
              icon={<SettingOutlined />}
              onClick={() => navigate("/settings")}
              title="设置"
            />
            <WindowControls />
          </div>
        </Header>
        <Content
          style={{
            padding: 24,
            overflow: "auto",
            background: token.colorBgLayout,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
