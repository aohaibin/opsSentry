/**
 * 顶栏告警铃铛。
 *
 * 原型行为很简单：显示活跃告警数角标，点击跳到告警页。
 * 这里的角标数暂由 store 提供（告警模块未实现，固定为原型的 2），
 * 等告警规则落地后改成订阅真实数据即可，组件本身不用动。
 */

import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { useAppStore } from "@/store/app";

export function AlertBell() {
  const count = useAppStore((s) => s.activeAlertCount);

  return (
    <Link
      to="/alerts"
      className="header-icon-btn"
      title={count > 0 ? `${count} 个活跃告警待处理` : "暂无活跃告警"}
      style={{ position: "relative" }}
    >
      <Bell size={16} />
      {count > 0 && (
        <span
          className="flex items-center justify-center"
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            minWidth: 16,
            height: 16,
            padding: "0 4px",
            borderRadius: 9999,
            background: "#f43f5e",
            color: "#fff",
            fontSize: 10,
            fontWeight: 700,
            lineHeight: 1,
            boxShadow: "0 0 12px rgba(244, 63, 94, 0.4)",
          }}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
