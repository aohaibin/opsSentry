/**
 * 系统与模型配置。
 *
 * 结构对齐原型 VIEW「系统与模型配置」：左侧三段式子导航（外观与交互 / AI 与网络 /
 * 安全与审计），右侧是对应设置面板。
 *
 * 诚实原则：已经能跑通的设置（语言、皮肤、主题模式、配置项、软件更新）接真实逻辑，
 * 并持久化到后端 config 表；后端还不支持的部分（代理白名单、主密码、备份还原）
 * 明确标注为未实现，不摆一个点不动的开关骗人。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Table, Tag, message } from "antd";
import {
  AppWindow,
  Database,
  Languages,
  Network,
  Palette,
  RotateCw,
  Shield,
  Sparkles,
  SunMoon,
} from "lucide-react";
import type { Update } from "@tauri-apps/plugin-updater";
import type { AppConfig } from "@/types";
import { configApi, systemApi, updaterApi } from "@/lib/api";
import { UpdateModal } from "@/components/ui/UpdateModal";
import { SKINS, useAppStore, useSettingsStore } from "@/store";
import { requireModule } from "@/navigation/modules";

const MODULE = requireModule("settings");

/** config 表中与本页相关的键，集中在这里避免散落的字符串字面量 */
const CONFIG_KEY_LANGUAGE = "ui.language";
const CONFIG_KEY_CLOSE_BEHAVIOR = "ui.close_behavior";

type TabKey = "appearance" | "window" | "llm" | "proxy" | "safety" | "backup";

const TAB_GROUPS: {
  group: string;
  items: { key: TabKey; label: string; icon: typeof Palette }[];
}[] = [
  {
    group: "外观与交互",
    items: [
      { key: "appearance", label: "界面与主题", icon: Palette },
      { key: "window", label: "启动行为与托盘", icon: AppWindow },
    ],
  },
  {
    group: "AI 与网络",
    items: [
      { key: "llm", label: "API Profiles 模型", icon: Sparkles },
      { key: "proxy", label: "网络代理与白名单", icon: Network },
    ],
  },
  {
    group: "安全与审计",
    items: [
      { key: "safety", label: "主密码与黑名单", icon: Shield },
      { key: "backup", label: "数据备份与还原", icon: Database },
    ],
  },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<TabKey>("appearance");
  const [configs, setConfigs] = useState<AppConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [update, setUpdate] = useState<Update | null>(null);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [appVersion, setAppVersion] = useState("0.1.0");

  // 皮肤 / 主题来自 App Store（与顶栏调色盘共用同一份状态，两处不会打架）
  const skin = useAppStore((s) => s.skin);
  const setSkin = useAppStore((s) => s.setSkin);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const closeBehavior = useSettingsStore((s) => s.closeBehavior);
  const setCloseBehavior = useSettingsStore((s) => s.setCloseBehavior);

  const loadConfigs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await configApi.getAll();
      setConfigs(data);

      // 把已持久化的设置回填进 store，否则重启后界面显示的仍是默认值
      const pick = (key: string) => data.find((c) => c.key === key)?.value;
      const savedLang = pick(CONFIG_KEY_LANGUAGE);
      if (savedLang) setLanguage(savedLang);
      const savedClose = pick(CONFIG_KEY_CLOSE_BEHAVIOR);
      if (savedClose === "minimize" || savedClose === "exit") {
        setCloseBehavior(savedClose);
      }
    } catch (e) {
      message.error(String(e));
    } finally {
      setLoading(false);
    }
  }, [setLanguage, setCloseBehavior]);

  useEffect(() => {
    void loadConfigs();
    systemApi
      .getSystemInfo()
      .then((info) => setAppVersion(info.appVersion))
      .catch(() => {
        // 后端未就绪时保留默认版本号
      });
  }, [loadConfigs]);

  /** 写库失败不阻断交互，但要告诉用户「这次改动没存上」 */
  async function persist(key: string, value: string, failHint: string) {
    try {
      await configApi.set(key, value);
      setConfigs((prev) => {
        const next = prev.filter((c) => c.key !== key);
        next.push({ key, value } as AppConfig);
        return next;
      });
    } catch (e) {
      message.warning(`${failHint}（${String(e)}）`);
    }
  }

  async function handleCheckUpdate() {
    setChecking(true);
    try {
      const result = await updaterApi.checkUpdate();
      if (result) {
        setUpdate(result);
        setUpdateModalOpen(true);
      } else {
        message.success("当前已是最新版本");
      }
    } catch (e) {
      message.warning(`检查更新失败: ${String(e)}`);
    } finally {
      setChecking(false);
    }
  }

  const configColumns = useMemo(
    () => [
      {
        title: "配置键",
        dataIndex: "key",
        key: "key",
        render: (text: string) => <Tag color="blue">{text}</Tag>,
      },
      { title: "配置值", dataIndex: "value", key: "value" },
    ],
    []
  );

  return (
    <div className="ops-page space-y-4">
      <div className="ops-page-head">
        <div style={{ minWidth: 0 }}>
          <h1 className="ops-page-title">
            <MODULE.icon size={18} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
            <span>系统与 AI 设置</span>
          </h1>
          <p className="ops-page-desc">
            内置 AI 对话顶配 API Profile / 托盘与失焦安全收敛 / 外观交互 / 网络代理 / 自动化生命周期
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* 左侧子导航 */}
        <nav className="glass-card lg:col-span-1" style={{ padding: 12, borderRadius: 12 }}>
          {TAB_GROUPS.map((g, idx) => (
            <div
              key={g.group}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                paddingTop: idx === 0 ? 0 : 10,
                marginTop: idx === 0 ? 0 : 10,
                borderTop: idx === 0 ? "none" : "1px solid var(--border)",
              }}
            >
              <div
                style={{
                  padding: "4px 8px",
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                }}
              >
                {g.group}
              </div>
              {g.items.map((item) => {
                const Icon = item.icon;
                const active = tab === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setTab(item.key)}
                    className="flex items-center"
                    style={{
                      gap: 8,
                      width: "100%",
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "none",
                      textAlign: "left",
                      fontSize: 12,
                      background: active ? "var(--bg-secondary)" : "transparent",
                      color: active ? "var(--brand-400)" : "var(--text-secondary)",
                      fontWeight: active ? 500 : 400,
                      cursor: "pointer",
                      transition: "background 0.15s ease, color 0.15s ease",
                    }}
                  >
                    <Icon size={13} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* 右侧面板 */}
        <section
          className="glass-card lg:col-span-3"
          style={{ padding: 20, borderRadius: 12, display: "flex", flexDirection: "column", gap: 20 }}
        >
          {tab === "appearance" && (
            <>
              <Section icon={<Languages size={15} />} title="界面语言" desc="切换后立即生效，本设置会持久化">
                <div className="flex items-center" style={{ gap: 10 }}>
                  {[
                    { id: "zh-CN", label: "简体中文" },
                    { id: "en-US", label: "English" },
                  ].map((l) => {
                    const active = language === l.id;
                    return (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => {
                          setLanguage(l.id);
                          void persist(CONFIG_KEY_LANGUAGE, l.id, "语言设置未写入配置库");
                        }}
                        style={{
                          padding: "6px 16px",
                          borderRadius: 8,
                          border: active ? "1px solid #059669" : "1px solid var(--border)",
                          background: active ? "#059669" : "var(--surface-900)",
                          color: active ? "#fff" : "var(--text-secondary)",
                          fontSize: 12,
                          fontWeight: active ? 500 : 400,
                          cursor: "pointer",
                        }}
                      >
                        {l.label}
                      </button>
                    );
                  })}
                </div>
              </Section>

              <Section icon={<Palette size={15} />} title="外观主题皮肤" desc="6 套皮肤，与顶栏调色盘共用同一份设置">
                <div className="grid grid-cols-3 xl:grid-cols-6" style={{ gap: 8 }}>
                  {SKINS.map((s) => {
                    const active = skin === s.id;
                    const onSkin = s.family === "dark" ? "#e2e8f0" : "#1e293b";
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSkin(s.id)}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 5,
                          padding: 10,
                          borderRadius: 12,
                          background: s.preview,
                          border: `2px solid ${active ? "#10b981" : "var(--border)"}`,
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ width: 14, height: 14, borderRadius: 9999, background: s.swatch }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: onSkin }}>{s.name}</span>
                        <span
                          style={{
                            fontSize: 9,
                            fontFamily: "var(--font-mono)",
                            color: active ? "#34d399" : "transparent",
                          }}
                        >
                          {active ? "当前" : "-"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </Section>

              <Section icon={<SunMoon size={15} />} title="主题模式" desc="覆盖皮肤所属的明暗族；跟随系统会实时响应系统切换">
                <div className="flex items-center" style={{ gap: 10 }}>
                  {[
                    { id: "system", label: "跟随系统" },
                    { id: "dark", label: "暗色" },
                    { id: "light", label: "亮色" },
                  ].map((m) => {
                    const active = theme === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setTheme(m.id as "system" | "dark" | "light")}
                        style={{
                          padding: "6px 16px",
                          borderRadius: 8,
                          border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                          background: active ? "var(--accent)" : "var(--surface-900)",
                          color: active ? "#fff" : "var(--text-secondary)",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>
              </Section>
            </>
          )}

          {tab === "window" && (
            <Section
              icon={<AppWindow size={15} />}
              title="关闭窗口时的行为"
              desc="点击右上角关闭按钮后的动作"
            >
              <div className="flex items-center" style={{ gap: 10 }}>
                {[
                  { id: "minimize", label: "最小化到托盘" },
                  { id: "exit", label: "直接退出" },
                ].map((b) => {
                  const active = closeBehavior === b.id;
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setCloseBehavior(b.id as "minimize" | "exit");
                        void persist(CONFIG_KEY_CLOSE_BEHAVIOR, b.id, "关闭行为未写入配置库");
                      }}
                      style={{
                        padding: "6px 16px",
                        borderRadius: 8,
                        border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                        background: active ? "var(--accent)" : "var(--surface-900)",
                        color: active ? "#fff" : "var(--text-secondary)",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>
              <Notice tone="warning">
                该选项已持久化，但后端尚未接入窗口关闭拦截逻辑 —— 目前点关闭仍会直接退出程序。
                要做成真正的「最小化到托盘」需要注册 <code>WindowEvent::CloseRequested</code> 并接入托盘插件。
              </Notice>
            </Section>
          )}

          {tab === "llm" && (
            <>
              <Section icon={<RotateCw size={15} />} title="软件更新" desc="从配置的更新仓库检查新版本">
                <div className="flex items-center" style={{ gap: 12 }}>
                  <Button icon={<RotateCw size={14} />} onClick={handleCheckUpdate} loading={checking}>
                    检查更新
                  </Button>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    当前版本: {appVersion}
                  </span>
                </div>
              </Section>

              <Section
                icon={<Sparkles size={15} />}
                title="配置项"
                desc="来自 Rust SQLite 的 config 表，界面设置也写在这里"
              >
                <Table
                  columns={configColumns}
                  dataSource={configs}
                  rowKey="key"
                  loading={loading}
                  pagination={false}
                  size="small"
                  className="ops-table"
                />
              </Section>

              <Notice tone="warning">
                API Profiles（多套模型端点、密钥、温度等）尚未实现。凭据本身要存进服务凭据金库，
                金库未落地前不提供填写入口 —— 填了也没有安全的地方放。
              </Notice>
            </>
          )}

          {tab === "proxy" && (
            <UnknownPanel
              title="网络代理与白名单"
              points={[
                "HTTP / SOCKS5 代理配置与连通性测试",
                "出站域名白名单，防止凭据被发送到未授权端点",
                "代理凭据同样走服务凭据金库，不落明文",
              ]}
            />
          )}

          {tab === "safety" && (
            <UnknownPanel
              title="主密码与黑名单"
              points={[
                "启动主密码与自动锁定超时",
                "危险命令黑名单（rm -rf / mkfs / dd 等）",
                "黑名单命中时的拦截与审计留痕",
              ]}
            />
          )}

          {tab === "backup" && (
            <UnknownPanel
              title="数据备份与还原"
              points={[
                "导出全部资产、技能、审计数据为加密归档",
                "从归档还原并校验完整性",
                "定时自动备份到指定目录",
              ]}
            />
          )}
        </section>
      </div>

      <UpdateModal open={updateModalOpen} onClose={() => setUpdateModalOpen(false)} update={update} />
    </div>
  );
}

/** 设置面板里的一个分区：图标 + 标题 + 说明 + 内容 */
function Section({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className="flex items-center"
        style={{ gap: 8, fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}
      >
        <span style={{ color: "var(--brand-400)", display: "flex" }}>{icon}</span>
        <span>{title}</span>
      </div>
      <p style={{ marginTop: 2, fontSize: 12, color: "var(--text-secondary)" }}>{desc}</p>
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}

/** 未实现功能的统一说明块，避免各面板各写一遍 */
function UnknownPanel({ title, points }: { title: string; points: string[] }) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div
          className="flex items-center"
          style={{ gap: 8, fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}
        >
          <span style={{ color: "var(--brand-400)", display: "flex" }}>
            <Shield size={15} />
          </span>
          <span>{title}</span>
        </div>
        <span
          style={{
            padding: "3px 9px",
            borderRadius: 8,
            border: "1px solid rgba(245, 158, 11, 0.35)",
            background: "rgba(245, 158, 11, 0.12)",
            color: "#fbbf24",
            fontSize: 11,
          }}
        >
          未实现
        </span>
      </div>

      <div>
        <h3 style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 8 }}>计划中的能力</h3>
        <ul style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {points.map((p) => (
            <li key={p} className="flex" style={{ gap: 8, alignItems: "flex-start" }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 9999,
                  background: "var(--text-muted)",
                  marginTop: 6,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12, lineHeight: 1.7, color: "var(--text-secondary)" }}>{p}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

/** 面板内的提示条 */
function Notice({ tone, children }: { tone: "warning" | "info"; children: React.ReactNode }) {
  const color = tone === "warning" ? "var(--warning)" : "var(--info)";
  return (
    <div
      style={{
        marginTop: 14,
        padding: "10px 12px",
        borderRadius: 8,
        background: "var(--bg-secondary)",
        borderLeft: `2px solid ${color}`,
      }}
    >
      <p style={{ fontSize: 11, lineHeight: 1.8, color: "var(--text-secondary)" }}>{children}</p>
    </div>
  );
}
