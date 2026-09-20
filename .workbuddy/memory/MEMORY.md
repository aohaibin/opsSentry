# 项目长期约定（template-tauri / 远程运维部署助手）

## 原型是唯一视觉基线
`docs/remote-ops-ai-prototype.html`（8049 行，17 个一级模块）是本项目的设计基线。
原型另见 `docs/prototype-fit-review-20260917.md`（逐模块符合性评审）。

**原型色板即项目令牌**，两者同源，不要另起一套：
- `brand` = 靛蓝 `#6366f1`（= `--accent` / `--brand-500`）
- `surface` = `#090d16 / #0f172a / #141e33 / #1e293b / #334155`
- **导航选中态用 emerald 绿**（`--nav-active-*`），语义是「活跃/在线」，与品牌色刻意区分，勿合并。

原型是 Tailwind CDN 3.4 + 原生 `switchTab` 单页；项目是 React 19 + AntD + 多路由。
因此「对齐原型」= **视觉与结构还原**，不复刻代码。

## 模块注册表是单一数据源
`src/navigation/modules.ts` 定义全部 17 个模块（key / 短标签 / 全名 / 副标题 / 说明 /
能力点 / 图标 / 分组 / 角标 / 是否已实现）。
**导航轨、路由、占位页三处都从这里读**。新增模块只改这一个文件。
页面顶部标题用 `requireModule("<key>")` 取，避免与导航 tooltip 文案漂移。

## 已实现 vs 占位
- 已实现：`servers`（服务器资产）、`workbench`（主机工作台）、`settings`（系统与模型配置）
- 其余 14 个走 `src/pages/module/index.tsx` 通用占位页

**占位页原则**：宁可明确说明「规划中 + 为什么现在是空的」，也不摆一屏点不动的假按钮。
后端能力（SSH 会话通道、命令执行与超时、指标采集、审计存证链路）未就绪前不做对应界面。

## 关键组件约定
- `AppLayout` 顶栏 + `NavRail` 图标导轨。**内层 `<Layout>` 必须显式 `flexDirection: "row"`**
  （antd 只在有 `<Sider>` 子组件时才自动转横向，用原生 `<aside>` 拿不到那个类）。
- 顶栏下拉统一用 `HeaderDropdown` 外壳，不要各自写定位与关闭逻辑。
- 主题：`data-theme`（明暗族，受「跟随系统」影响）+ `data-skin`（6 套皮肤，只覆盖背景与品牌色）。
  两者分开，才能让「换皮肤」与「跟随系统」互不干扰。
- 路由用 **HashRouter**（asset 协议下 history 模式刷新/深链会 404）。

## 后端 / IPC
- **Tauri v2 IPC 参数名默认 camelCase**，运行时精确查找、无 snake_case 兜底。
  前端调 `invoke` 传 snake_case 键会直接报 `missing required key`。
- 所有 Tauri API 调用（尤其模块顶层的 `getCurrentWindow()`）必须包 try/catch，
  否则在 webview 之外会抛错并导致整个入口模块不执行（白屏）。
- Schema 版本迁移走 `PRAGMA user_version`，当前 v6。

## antd Form 的隐藏字段陷阱（已踩一次，勿再犯）
`form.validateFields()` 的返回值**只包含渲染过 `Form.Item` 的字段**——
源码是 `getFieldsValue(finalValueNamePathList)`，而该列表由 `getFieldEntities(true)` 填充。
凡是「由卡片/开关驱动、不渲染 Form.Item」的字段（如 `os_type` 由协议卡片决定），
`values.xxx` 恒为 `undefined`；传给 `invoke` 时 `undefined` 会在 JSON 序列化中**整键消失**，
后端随即报 `missing required key osType`（因为 IPC 精确匹配键名、无 snake_case 兜底）。
修法二选一：给该字段渲染一个 `Form.Item`，或从组件 state 取值（不要依赖 `values`）。
`src/lib/api/server.ts` 的 `toIpcPayload` 已对 authType/aiPolicy/osType/group 做兜底。

## 构建 / 签名
- 生产构建需要 `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  两个**环境变量**（`.env` 文件无效）。已设为本机用户级变量，密钥在 `src-tauri/keys/`（已 gitignore）。
- `.env` 未被 Tauri CLI 加载，不要依赖它。

## 协作习惯
- **禁止自动 git commit**。改动完成后留在工作区，等用户审计 + 实机测试后再提交。
- 无头 Chrome 可零安装截图验证界面（见当日工作记录）。
