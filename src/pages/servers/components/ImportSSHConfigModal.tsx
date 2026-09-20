import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Checkbox, Empty, Modal, Spin, Tag, message } from "antd";
import { FileCode, Loader2 } from "lucide-react";
import type { SshConfigHost } from "@/types";
import { serverApi } from "@/lib/api/server";
import { getErrorMessage } from "@/lib/api/client";

interface ImportSSHConfigModalProps {
  open: boolean;
  /** 已在资产表中存在的别名，用于标记冲突并禁止重复导入 */
  existingAliases: string[];
  onCancel: () => void;
  /** 导入流程结束后回调（无论成功几条），用于刷新列表 */
  onImported: () => void;
}

/** 导入时统一打的来源标签，方便日后按来源筛选 */
const IMPORT_TAG = "导入自 ssh config";

export function ImportSSHConfigModal({
  open,
  existingAliases,
  onCancel,
  onImported,
}: ImportSSHConfigModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hosts, setHosts] = useState<SshConfigHost[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const existing = new Set(existingAliases);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelected([]);
    try {
      const list = await serverApi.importSshConfig();
      setHosts(list);
      // 默认不勾选：该文件里常混有跳板机、生产机，导入必须由用户显式挑选
      setSelected([]);
    } catch (e) {
      setError(getErrorMessage(e));
      setHosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [open, load]);

  const importable = hosts.filter((h) => !existing.has(h.alias));
  const allSelected =
    importable.length > 0 && importable.every((h) => selected.includes(h.alias));

  const handleToggleAll = (checked: boolean) => {
    setSelected(checked ? importable.map((h) => h.alias) : []);
  };

  const handleToggle = (alias: string, checked: boolean) => {
    setSelected((prev) =>
      checked ? [...prev, alias] : prev.filter((item) => item !== alias)
    );
  };

  const handleImport = async () => {
    const targets = hosts.filter((h) => selected.includes(h.alias));
    if (targets.length === 0) {
      message.warning("请至少勾选一台要导入的主机");
      return;
    }

    setImporting(true);
    const failures: string[] = [];
    let succeeded = 0;

    for (const host of targets) {
      try {
        await serverApi.add({
          alias: host.alias,
          hostname: host.hostname,
          port: host.port,
          username: host.username,
          // ssh config 只能说明「用了哪种登录方式」，私钥路径本身不入库（凭据金库尚未开放）
          auth_type: host.identity_file ? "key" : "password",
          os_type: "linux",
          arch: "",
          group: "默认",
          // 导入的主机未经评估，默认给最保守的档位：宁可多一次审批，也不要默默放行
          ai_policy: "approval",
          tags: JSON.stringify([IMPORT_TAG]),
        });
        succeeded += 1;
      } catch (e) {
        failures.push(`${host.alias}：${getErrorMessage(e)}`);
      }
    }

    setImporting(false);

    if (succeeded > 0) {
      message.success(`已导入 ${succeeded} 台主机，默认 AI 策略为「需审批」`);
    }
    if (failures.length > 0) {
      // 逐条列出失败原因，避免用户只知道「有失败」却不知道是哪几台
      Modal.warning({
        title: `${failures.length} 台主机导入失败`,
        width: 520,
        content: (
          <ul className="pl-4 space-y-1 text-xs" style={{ listStyle: "disc" }}>
            {failures.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ),
      });
    }

    onImported();
    if (failures.length === 0) {
      onCancel();
    } else {
      void load();
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title={
        <span className="flex items-center gap-2">
          <FileCode size={16} />
          导入 ~/.ssh/config
        </span>
      }
      width={680}
      footer={
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            已选 {selected.length} / 可导入 {importable.length}
          </span>
          <div className="flex gap-2">
            <Button onClick={onCancel}>取消</Button>
            <Button
              type="primary"
              onClick={handleImport}
              loading={importing}
              disabled={selected.length === 0}
            >
              导入所选主机
            </Button>
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="py-10 flex flex-col items-center gap-3">
          <Spin size="large" />
          <span className="text-xs" style={{ color: "var(--text-muted)" }}>
            正在读取 ~/.ssh/config
          </span>
        </div>
      ) : error ? (
        <Alert
          type="warning"
          showIcon
          message="未能读取 SSH 配置"
          description={
            <span className="text-xs">
              {error}
              <br />
              若本机确实没有该文件，可直接用「新增服务器」手动纳管。
            </span>
          }
        />
      ) : hosts.length === 0 ? (
        <Empty description="配置文件里没有可导入的 Host（通配符 Host 会被跳过）" />
      ) : (
        <div className="space-y-2">
          <Alert
            type="info"
            showIcon
            message="导入只登记连接元数据"
            description="私钥路径不会写入资产表；导入后的主机默认 AI 策略为「需审批」，请按实际情况调整。"
          />

          <div
            className="flex items-center justify-between px-2 py-1.5 rounded"
            style={{ background: "var(--bg-secondary)" }}
          >
            <Checkbox
              checked={allSelected}
              indeterminate={selected.length > 0 && !allSelected}
              onChange={(e) => handleToggleAll(e.target.checked)}
              disabled={importable.length === 0}
            >
              <span className="text-xs">全选可导入项</span>
            </Checkbox>
          </div>

          <div className="max-h-72 overflow-y-auto custom-scrollbar space-y-1">
            {hosts.map((host) => {
              const conflict = existing.has(host.alias);
              return (
                <label
                  key={host.alias}
                  className="flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer"
                  style={{
                    background: "var(--bg-secondary)",
                    border: "1px solid var(--border)",
                    opacity: conflict ? 0.55 : 1,
                  }}
                >
                  <Checkbox
                    checked={selected.includes(host.alias)}
                    disabled={conflict}
                    onChange={(e) => handleToggle(host.alias, e.target.checked)}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-xs font-medium truncate">
                        {host.alias}
                      </span>
                      {conflict && <Tag color="default">已纳管</Tag>}
                      {host.identity_file && (
                        <Tag color="blue" className="text-[10px]">
                          私钥
                        </Tag>
                      )}
                    </span>
                    <span
                      className="text-[11px] block truncate"
                      style={{
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {host.username}@{host.hostname}:{host.port}
                      {host.identity_file ? `  ·  ${host.identity_file}` : ""}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {importing && (
            <p
              className="text-xs flex items-center gap-1.5"
              style={{ color: "var(--text-muted)" }}
            >
              <Loader2 size={12} className="animate-spin" />
              正在逐条写入资产表...
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
