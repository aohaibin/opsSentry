import { Outlet } from "react-router-dom";
import { Layout, Button, theme as antdTheme } from "antd";
import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import { Sun, Moon } from "lucide-react";
import { useAppStore } from "@/store";
import { Sidebar } from "./Sidebar";

const { Header, Sider, Content } = Layout;

export function AppLayout() {
  const { sidebarCollapsed, toggleSidebar, theme, toggleTheme } =
    useAppStore();
  const { token } = antdTheme.useToken();

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
            padding: "0 16px",
            height: 48,
            lineHeight: "48px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: token.colorBgContainer,
            borderBottom: `1px solid ${token.colorBorderSecondary}`,
          }}
          data-tauri-drag-region
        >
          <Button
            type="text"
            icon={
              sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />
            }
            onClick={toggleSidebar}
          />
          <Button
            type="text"
            icon={theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            onClick={toggleTheme}
          />
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
