import { useNavigate, useLocation } from "react-router-dom";
import { Menu } from "antd";
import {
  Home,
  Settings,
  Info,
} from "lucide-react";
import { useAppStore } from "@/store";

const menuItems = [
  {
    key: "/",
    icon: <Home size={18} />,
    label: "首页",
  },
  {
    key: "/settings",
    icon: <Settings size={18} />,
    label: "设置",
  },
  {
    key: "/about",
    icon: <Info size={18} />,
    label: "关于",
  },
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const collapsed = useAppStore((s) => s.sidebarCollapsed);

  return (
    <div className="flex flex-col h-full">
      <div className="h-12 flex items-center justify-center font-bold text-base border-b border-gray-200 dark:border-gray-700">
        {collapsed ? "TF" : "Tauri Framework"}
      </div>
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        onClick={({ key }) => navigate(key)}
        style={{ border: "none", flex: 1 }}
      />
    </div>
  );
}
