import { useState } from "react";
import { Button, Modal, message } from "antd";
import { Check, Copy, Monitor } from "lucide-react";

interface WindowsGuideModalProps {
  open: boolean;
  onCancel: () => void;
}

/** 受控 Windows 侧的一键配置脚本（Windows 自带 OpenSSH Server，无需装第三方 Agent） */
const POWERSHELL_SCRIPT = `# 1. 安装 Windows 原生 OpenSSH 服务
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0

# 2. 启动服务并配置为开机自启
Start-Service sshd
Set-Service -Name sshd -StartupType 'Automatic'

# 3. 配置 Windows 防火墙放行 TCP 22 端口
New-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -DisplayName 'OpenSSH Server (sshd)' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22`;

export function WindowsGuideModal({ open, onCancel }: WindowsGuideModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(POWERSHELL_SCRIPT);
      setCopied(true);
      message.success("脚本已复制到剪贴板");
      // 2 秒后复原按钮文案，给用户一个「确实复制了」的即时反馈
      window.setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      message.error(`复制失败，请手动选择文本复制：${String(e)}`);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title={
        <span className="flex items-center gap-2">
          <Monitor size={16} />
          Windows 原生免代理接入向导
        </span>
      }
      footer={
        <Button type="primary" onClick={onCancel}>
          我知道了
        </Button>
      }
      width={680}
    >
      <div className="space-y-3.5 text-xs leading-relaxed">
        <p style={{ color: "var(--text-secondary)" }}>
          无需在受控 Windows 上安装任何专有 Agent。只需以管理员权限运行 PowerShell，
          即可一键启用 Windows 自带的 OpenSSH Server。
        </p>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              PowerShell 一键配置脚本（复制后直接在管理员终端执行）
            </span>
            <Button
              type="link"
              size="small"
              icon={copied ? <Check size={12} /> : <Copy size={12} />}
              onClick={handleCopy}
            >
              {copied ? "已复制" : "复制脚本"}
            </Button>
          </div>

          <pre
            className="p-3 rounded-xl text-[11px] overflow-x-auto"
            style={{
              background: "var(--bg-primary)",
              border: "1px solid var(--border)",
              color: "var(--success)",
              fontFamily: "var(--font-mono)",
              margin: 0,
            }}
          >
            {POWERSHELL_SCRIPT}
          </pre>
        </div>

        <div
          className="p-3 rounded-xl space-y-1 text-[11px]"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            color: "var(--text-secondary)",
          }}
        >
          <p className="font-medium" style={{ color: "var(--text-primary)" }}>
            验证连接
          </p>
          <p>
            配置完成后回到本页点击「新增服务器」，操作系统选 Windows，
            填入该机器 IP 与登录账号，先点「连通性测试」确认 TCP 22 端口可达，再保存纳管。
          </p>
        </div>
      </div>
    </Modal>
  );
}
