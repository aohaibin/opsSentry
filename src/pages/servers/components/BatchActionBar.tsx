import { Button } from "antd";
import { Activity, Loader2, Shield, Tags, Terminal, Trash2, X } from "lucide-react";

interface BatchActionBarProps {
  count: number;
  pinging: boolean;
  onBatchPing: () => void;
  onOpenTagModal: () => void;
  onOpenPolicyModal: () => void;
  onBatchExecute: () => void;
  onBatchDelete: () => void;
  onClear: () => void;
}

export function BatchActionBar({
  count,
  pinging,
  onBatchPing,
  onOpenTagModal,
  onOpenPolicyModal,
  onBatchExecute,
  onBatchDelete,
  onClear,
}: BatchActionBarProps) {
  if (count === 0) return null;

  return (
    <div
      className="absolute bottom-3 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-4 py-2 rounded-2xl"
      style={{
        background: "var(--overlay-bg)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(99, 102, 241, 0.4)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <span
        className="flex items-center gap-2 pr-3 text-xs font-medium whitespace-nowrap"
        style={{ color: "var(--text-primary)", borderRight: "1px solid var(--border)" }}
      >
        <span
          className="inline-block w-2 h-2 rounded-full animate-ping"
          style={{ background: "var(--accent)" }}
        />
        已选中 <strong style={{ color: "var(--accent-hover)" }}>{count}</strong> 台服务器
      </span>

      <div className="flex items-center gap-1.5">
        <Button
          size="small"
          icon={pinging ? <Loader2 size={13} className="animate-spin" /> : <Activity size={13} />}
          onClick={onBatchPing}
          disabled={pinging}
        >
          批量测通
        </Button>
        <Button size="small" icon={<Tags size={13} />} onClick={onOpenTagModal}>
          批量标签
        </Button>
        <Button size="small" icon={<Shield size={13} />} onClick={onOpenPolicyModal}>
          AI 策略
        </Button>
        <Button size="small" icon={<Terminal size={13} />} onClick={onBatchExecute}>
          批量执行
        </Button>
        <Button size="small" danger icon={<Trash2 size={13} />} onClick={onBatchDelete}>
          移除
        </Button>
      </div>

      <button
        type="button"
        onClick={onClear}
        title="取消全部选择"
        className="p-1 rounded ml-1"
        style={{ color: "var(--text-muted)" }}
      >
        <X size={15} />
      </button>
    </div>
  );
}
