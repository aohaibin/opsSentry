---
name: ui-frontend
description: |
  React 前端 UI 组件开发技能,指导 Tauri 桌面应用的界面开发。

  触发场景:
  - 需要开发 React 页面或组件
  - 需要选择和使用 UI 组件库
  - 需要处理表单、表格、弹窗等常见 UI
  - 需要实现响应式布局

  触发词: UI、组件、页面、前端、界面、表单、表格、弹窗、布局、样式、React
---

# React 前端 UI 开发

## 概述

Tauri 桌面应用的前端运行在系统 WebView 中,使用 React 19 + TypeScript 5.8 + Ant Design + TailwindCSS 4 开发。与 Web 应用的主要区别是:窗口大小可控、无需考虑 SEO、可调用系统 API。

### 前端项目结构

```
src/
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx        # 主布局（Ant Design Layout）
│   │   └── Sidebar.tsx          # 侧边栏导航
│   └── ui/
│       └── ErrorBoundary.tsx    # 错误边界
├── hooks/
│   └── useCommand.ts           # invoke 封装
├── lib/
│   └── api/
│       ├── client.ts           # invoke 封装 + getErrorMessage 工具
│       ├── config.ts           # 配置相关 API
│       ├── system.ts           # 系统相关 API
│       └── index.ts            # 统一导出
├── pages/
│   ├── home/index.tsx           # 首页
│   ├── settings/index.tsx       # 设置页
│   └── about/index.tsx          # 关于页
├── store/
│   ├── app.ts                  # 应用状态（主题/侧边栏）
│   ├── settings.ts             # 设置状态（持久化 ↔ tauri-plugin-store）
│   └── index.ts                # 统一导出
├── styles/
│   ├── variables.css           # CSS 设计令牌（双主题颜色/间距/阴影）
│   └── global.css              # TailwindCSS + 全局样式
├── theme/
│   └── antdTheme.ts            # Ant Design 主题配置（dark/light）
├── types/
│   ├── config.ts               # 配置相关类型
│   ├── system.ts               # 系统相关类型
│   └── index.ts                # 统一导出
├── App.tsx                      # 根组件（ConfigProvider + Router）
├── Router.tsx                   # React Router 配置
└── main.tsx                     # 入口
```

### 当前技术栈

| 技术 | 用途 |
|------|------|
| **Ant Design** | UI 组件库（Layout/Form/Table 等） |
| **TailwindCSS 4** | 原子化 CSS 样式 |
| **React Router** | 客户端路由 |
| **Zustand** | 全局状态管理 |

---

## UI 组件库（已选用 Ant Design）

项目已集成 **Ant Design** 作为主要 UI 组件库,配合 **TailwindCSS 4** 做原子化样式补充。

| 关键组件 | 用途 | 参考文件 |
|---------|------|---------|
| `Layout / Sider / Content` | 主布局 | `src/components/layout/AppLayout.tsx` |
| `Menu` | 侧边栏导航 | `src/components/layout/Sidebar.tsx` |
| `ConfigProvider` | 全局主题配置 | `src/App.tsx` |
| `Form / Input / Select` | 表单 | 各页面组件 |
| `Table` | 数据表格 | 各页面组件 |
| `Modal / message` | 弹窗/消息 | 各页面组件 |

---

## 组件开发模式

### 基础组件模板

```tsx
import { useState } from "react";
import { message } from "antd";
import { invoke } from "@tauri-apps/api/core";
import { getErrorMessage } from "@/lib/api";

interface Props {
  title: string;
}

function FeaturePage({ title }: Props) {
  const [data, setData] = useState<DataType[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
      const result = await invoke<DataType[]>("get_data");
      setData(result);
    } catch (e) {
      message.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="loading">加载中...</div>;

  return (
    <div className="page">
      <h1>{title}</h1>
      <div className="content">
        {data.map(item => (
          <div key={item.id}>{item.name}</div>
        ))}
      </div>
    </div>
  );
}

export default FeaturePage;
```

> **错误处理规范**: 所有 catch 块统一使用 `getErrorMessage(error)` 提取错误信息，禁止 `` `加载失败: ${error}` `` 模板字符串拼接。
> ```tsx
> import { getErrorMessage } from "@/lib/api";
> // catch (e) { message.error(getErrorMessage(e)); }
> ```

### 表单组件

```tsx
import { useState, FormEvent } from "react";
import { message } from "antd";
import { invoke } from "@tauri-apps/api/core";
import { getErrorMessage } from "@/lib/api";

interface FormData {
  name: string;
  email: string;
  description: string;
}

function CreateForm() {
  const [form, setForm] = useState<FormData>({
    name: "", email: "", description: ""
  });

  function handleChange(field: keyof FormData, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await invoke("create_item", { input: form });
      setForm({ name: "", email: "", description: "" });
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label>
        名称
        <input value={form.name} onChange={e => handleChange("name", e.target.value)} required />
      </label>
      <label>
        邮箱
        <input type="email" value={form.email} onChange={e => handleChange("email", e.target.value)} />
      </label>
      <label>
        描述
        <textarea value={form.description} onChange={e => handleChange("description", e.target.value)} />
      </label>
      <button type="submit">保存</button>
    </form>
  );
}
```

### 列表 + CRUD 页面

```tsx
function ItemList() {
  const [items, setItems] = useState<Item[]>([]);
  const [editing, setEditing] = useState<Item | null>(null);

  useEffect(() => { loadItems(); }, []);

  async function loadItems() {
    const list = await invoke<Item[]>("list_items");
    setItems(list);
  }

  async function deleteItem(id: number) {
    if (!confirm("确认删除?")) return;
    await invoke("delete_item", { id });
    await loadItems();
  }

  return (
    <div>
      <table>
        <thead>
          <tr><th>ID</th><th>名称</th><th>操作</th></tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              <td>{item.id}</td>
              <td>{item.name}</td>
              <td>
                <button onClick={() => setEditing(item)}>编辑</button>
                <button onClick={() => deleteItem(item.id)}>删除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## 设置页规范

设置页使用 **Drawer + Tabs + Form** 模式，从右侧滑入，无需路由切换。

### 设计原则

| 原则 | 说明 |
|------|------|
| **Drawer 而非路由** | 设置面板用 `Drawer` 从右侧滑入，不占用路由 |
| **Tabs 分类** | 使用 `Tabs` 对设置项分类（通用、外观、关于等） |
| **自动保存** | `onValuesChange` 触发自动保存，无需手动点击保存按钮 |
| **持久化** | Zustand store 与 tauri-plugin-store 双向同步 |

### SettingsDrawer 标准模板

```tsx
import { Drawer, Tabs, Form, Switch, Select, message } from "antd";
import { useAppStore } from "@/store";
import { useSettingsStore } from "@/store";
import { getErrorMessage } from "@/lib/api";

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsDrawer({ open, onClose }: SettingsDrawerProps) {
  const [form] = Form.useForm();
  const settings = useSettingsStore();

  // Tabs 切换时重置 form 值（防止脏数据）
  function handleTabChange() {
    form.resetFields();
  }

  // 自动保存：任意值变化时触发
  async function handleValuesChange(changed: Record<string, unknown>) {
    try {
      await settings.update(changed);
    } catch (e) {
      message.error(getErrorMessage(e));
    }
  }

  const tabItems = [
    {
      key: "general",
      label: "通用",
      children: (
        <Form
          form={form}
          layout="vertical"
          initialValues={settings.general}
          onValuesChange={handleValuesChange}
        >
          <Form.Item name="autoStart" label="开机启动" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="language" label="语言">
            <Select options={[
              { label: "简体中文", value: "zh-CN" },
              { label: "English", value: "en-US" },
            ]} />
          </Form.Item>
        </Form>
      ),
    },
    {
      key: "appearance",
      label: "外观",
      children: (
        <Form
          form={form}
          layout="vertical"
          initialValues={settings.appearance}
          onValuesChange={handleValuesChange}
        >
          <Form.Item name="theme" label="主题">
            <Select options={[
              { label: "跟随系统", value: "system" },
              { label: "浅色", value: "light" },
              { label: "深色", value: "dark" },
            ]} />
          </Form.Item>
          <Form.Item name="fontSize" label="字号">
            <Select options={[
              { label: "小", value: "small" },
              { label: "中", value: "medium" },
              { label: "大", value: "large" },
            ]} />
          </Form.Item>
        </Form>
      ),
    },
    {
      key: "about",
      label: "关于",
      children: <div className="text-sm text-gray-500">版本信息、开源协议等</div>,
    },
  ];

  return (
    <Drawer
      title="设置"
      placement="right"
      width={480}
      open={open}
      onClose={onClose}
      destroyOnClose
      maskClosable={false}
    >
      <Tabs items={tabItems} onChange={handleTabChange} />
    </Drawer>
  );
}
```

### 持久化同步模式（Zustand + tauri-plugin-store）

```tsx
// src/store/settings.ts
import { create } from "zustand";
import { load } from "@tauri-apps/plugin-store";

interface SettingsState {
  general: { autoStart: boolean; language: string };
  appearance: { theme: string; fontSize: string };
  load: () => Promise<void>;
  update: (changed: Record<string, unknown>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  general: { autoStart: false, language: "zh-CN" },
  appearance: { theme: "system", fontSize: "medium" },

  load: async () => {
    const store = await load("settings.json", { autoSave: false });
    const general = await store.get<SettingsState["general"]>("general");
    const appearance = await store.get<SettingsState["appearance"]>("appearance");
    if (general) set({ general });
    if (appearance) set({ appearance });
  },

  update: async (changed) => {
    const store = await load("settings.json", { autoSave: false });
    // 合并到当前状态
    const state = get();
    const newState = { ...state, ...changed };
    set(newState);
    // 持久化到 tauri-plugin-store
    for (const [key, value] of Object.entries(changed)) {
      await store.set(key, value);
    }
    await store.save();
  },
}));
```

> **要点**: 应用启动时调用 `useSettingsStore.getState().load()` 从磁盘加载设置。

---

## 弹窗/面板遮罩关闭交互规范

桌面应用的 Modal/Drawer 要按"用户失去的成本 vs 得到的便利"决定是否允许点击遮罩关闭。

### 三类场景与对应设置

| 类型 | 示例 | `maskClosable` | 理由 |
|------|------|----------------|------|
| **编辑/表单/操作类** | 新建/编辑表单、设置、激活码输入、多步操作弹窗 | `false` | 含用户输入，误点遮罩会丢数据 |
| **纯查看/信息展示类** | 关于/版本信息、只读详情弹窗 | `true`（默认） | 纯浏览，快速关闭体验更好 |
| **命令浮层类** | 命令面板、搜索、快速选择 | `true`（默认） | VSCode 风格，失焦即关 |

### Ant Design 组件配置

```tsx
// ✅ 编辑/表单类 Modal：必须 maskClosable={false}
<Modal
  open={visible}
  title="编辑项目"
  onCancel={onClose}
  onOk={handleSubmit}
  maskClosable={false}   // ← 关键
>
  <Form>
    <Form.Item name="name" label="名称"><Input /></Form.Item>
  </Form>
</Modal>

// ✅ 纯信息 Modal：保持默认即可
<Modal open={visible} title="关于" onCancel={onClose}>
  <div>版本 1.0.0</div>
</Modal>

// ✅ Drawer 同理（设置 Drawer 包含表单时必须禁用遮罩关闭）
<Drawer
  title="设置"
  open={open}
  onClose={onClose}
  maskClosable={false}   // ← 表单类 Drawer 必加
>
  <Form onValuesChange={handleValuesChange}>...</Form>
</Drawer>
```

> **Ant Design v6 新写法**：`mask={{ closable: false }}` 等价于 `maskClosable={false}`，两者任选其一，**不要同时写**。

### 判断口诀

- **里面有 input/textarea/form 或多步操作** → `maskClosable={false}`
- **只是查看一段信息、没有输入** → 保持默认 `true`
- **命令面板/搜索/快速选择** → 保持默认 `true`（VSCode 惯例）

### 配套建议

- 所有含表单的弹窗都应同时支持 **Esc 关闭** 和 **右上角 X 按钮**（Ant Design 默认已提供）
- 关闭前可弹二次确认提示（有 unsaved 变更时）

---

## 🔴 Tailwind 与 antd 共存（样式失效必查）

> 本项目是 **Tailwind 4 + antd v6**。下方「样式选择规则」里"布局/间距用 TailwindCSS 原子类"这条，
> **能否作用在 antd 组件上，取决于本节的 layer 配置**。配错会静默失效，没有任何报错。

### 三种故障，同一个根因

| 症状 | 根因 |
|------|------|
| 给 antd 组件写的 Tailwind 类（`mt-4` / `flex-1` / `text-xs`）**静默失效**，代码里写了间距界面上没有 | antd 样式「未分层」，按 CSS Cascade Layers 规范优先级**高于**任何 `@layer` |
| **包也装了、`StyleProvider layer` 也加了，Tailwind 类照样不生效** | 漏了 `global.css` 里的 `@layer` 声明行 —— 见下方「为什么少一行就全废」 |
| antd 组件**整体崩坏**：弹窗不居中、输入框没边框、按钮挤成一团 | antd 层排到了 `base` 之前，被 Tailwind preflight（CSS reset）冲掉 |

#### 为什么少一行就全废（源码依据）

`@ant-design/cssinjs-utils/es/util/genStyleUtils.js` 里 antd 传的 layer 配置是：

```js
var mergedLayer = config.layer || { name: 'antd' };   // 注意：没有 dependencies
```

而 `@ant-design/cssinjs/es/hooks/useStyleRegister.js` **只在 `layer.dependencies` 存在时**才会 prepend 层顺序声明：

```js
if (layer.dependencies) {
  effectStyle[`@layer ${layer.name}`] = layer.dependencies.map(d => `@layer ${d}, ${layer.name};`)
}
```

**结论：antd 从不自己声明层顺序。** 所以只加 `StyleProvider layer` 而不写声明行时，`@layer antd`
首次出现会被**追加到已有序列末尾** → 实际顺序变成 `theme, base, components, utilities, antd`
→ antd 排在 utilities **之后** → Tailwind 类依旧覆盖不了，而且人会误以为"我明明配了"。

> layer 名**固定是 `antd`**（`genStyleUtils.js` 与 `theme/util/useResetIconStyle.js` 两处硬编码），
> 声明行里的名字必须一字不差，改了就对不上。

### 正解：antd 必须夹在中间（"三明治"）

```css
/* src/styles/global.css —— 必须写在 @import "tailwindcss" 之前（先声明的 layer 优先级更低） */
@layer theme, base, components, antd, utilities;

@import "tailwindcss";
```

```tsx
// src/App.tsx —— 把 antd 运行时样式装进 @layer antd
import { StyleProvider } from "@ant-design/cssinjs";

<StyleProvider layer>
  <ConfigProvider locale={antdLocale} theme={getAntdTheme(appTheme)}>
    {/* ... */}
  </ConfigProvider>
</StyleProvider>
```

两侧都不能挪：
- **排在 `base` 之后** → 不被 Tailwind preflight 的 reset 冲掉
- **排在 `utilities` 之前** → Tailwind 工具类才能覆盖 antd 默认样式

⚠️ **删掉三处中任何一处，全项目 antd 组件上的 Tailwind 类都会失效**，且失效是静默的。

### 第三处：依赖必须显式装，且版本必须可 dedupe

`@ant-design/cssinjs` 是 antd 的传递依赖，pnpm 严格模式下**不会提升到 `node_modules/` 顶层**，
不显式声明就 `import` 会直接解析失败。

```jsonc
"@ant-design/cssinjs": "^2.1.0"   // ✅ 与 antd 自身声明同范围，pnpm 复用同一份
"@ant-design/cssinjs": "2.1.2"    // ❌ 写死；antd 将来升到 ^3 就会装两份
```

🔴 **版本写死的后果极其隐蔽**：装两份 = 两个 React Context 实例 → `StyleProvider` 设的 layer
写进 A 实例，antd 内部 `useContext(StyleContext)` 读的是 B 实例 → 配置读不到，**静默退回未配状态**，
但代码看上去完全正确。装完务必验证只有一份：

```bash
ls -d node_modules/.pnpm/@ant-design+cssinjs@* | grep -v utils   # 必须只有 1 行
```

### 兼容性：不引入任何新的运行环境下限

常见顾虑是"`@layer` 会不会让老 WebView 挂掉"。结论是**不会新增约束**：

| | Chrome | Safari | Firefox |
|---|---|---|---|
| CSS Cascade Layers | 99 | **15.4** | 97 |
| **Tailwind 4 官方要求** | **111** | **16.4** | **128** |

项目选用 Tailwind 4 的那一刻下限就已是 Safari 16.4，**严于** `@layer` 的 15.4。对应到 Tauri 三平台：
Windows WebView2 常青自动更新、Linux 被 `webkit2gtk-4.1`（Tauri 2 硬性要求）覆盖、macOS 的
WKWebView 门槛由 Tailwind 4 决定而非 `@layer`。

体积同理是**零增量** —— cssinjs 本来就随 antd 打进 bundle，显式声明只是把传递依赖提为直接依赖。

### 验证：必须双向测，且**两个方向都取页面上真实渲染的元素**

🔴 **两个方向都不能用 `document.createElement` 造元素**。antd v6 的选择器带 hash 前缀
（`.css-var-_r_0_.ant-card`），手工造的裸 `.ant-card` 匹配不到任何 antd 规则：
- 方向 2 会得到全 0 的**假阴性**（看起来 antd 崩了，其实没崩）
- 方向 1 更危险 —— 裸元素上只有 Tailwind 规则生效，`mt-4` 必然返回 16px，**无论 layer 配没配都"通过"**，是彻底的**假阳性**

正确做法是先在页面上渲染一个真的带 Tailwind 类的 antd 组件（如 `<Card className="mt-6">`），再测：

```js
(() => {
  const card = document.querySelector('.ant-card.mt-6');           // 页面真实元素
  const btn  = document.querySelector('button.ant-btn');
  const antdStyles = [...document.querySelectorAll('style[data-css-hash]')];
  return {
    // 方向 1：Tailwind 能覆盖 antd？mt-6 期望 24px（配置错误时为 0px）
    cardMarginTop: card && getComputedStyle(card).marginTop,
    // 方向 2：antd 自己没被 preflight 冲掉？期望 radius 非 0
    btnRadius:  btn && getComputedStyle(btn).borderRadius,
    cardRadius: card && getComputedStyle(card).borderRadius,
    // 旁证：应有相当一部分 style 标签带 @layer antd（改前为 0）
    layered: antdStyles.filter(s => s.textContent.includes('@layer antd')).length + '/' + antdStyles.length,
  };
})()
```

本框架实测基线（antd 6.3.1 + Tailwind 4，light 主题）：

| 指标 | 配置前 | 配置后 |
|------|--------|--------|
| `.ant-card.mt-6` marginTop | `0px` ❌ | `24px` ✅ |
| btnRadius / cardRadius | 6px / 8px | 6px / 8px（**不变**才对） |
| 带 `@layer antd` 的 style 标签 | 0 / 32 | 14 / 32 |

🔴 **只测一个方向会漏掉反向破坏** —— 只确认"Tailwind 生效"，很可能整套 antd 样式已经崩了。
方向 2 的正确期望是**与改动前完全一致**，所以改之前要先把基线量下来。

### 还要验生产构建：lightningcss 会重写声明行

dev 通过 ≠ 生产没问题。Tailwind 4 的 lightningcss 在打包时会把**已实际使用的层内联展开**，
只为剩下的层保留声明，源码里那行完整声明在产物里会变成残缺的样子：

```bash
grep -ob "@layer properties{\|@layer theme{\|@layer base{\|@layer utilities{\|@layer components,antd;" dist/assets/index-*.css
```

本框架实测输出（字节偏移，**`components,antd` 必须小于 `utilities` 的偏移**）：

```
0     @layer properties{
360   @layer theme{
1373  @layer base{
4875  @layer components,antd;   ← 在 utilities 之前 = 语义保留 ✅
4898  @layer utilities{
```

lightningcss 会把剩余声明精确插在 `utilities` 块之前，顺序语义完整。但**这是它按源码顺序推导出来的** ——
一旦把 `@layer` 声明行误写到 `@import "tailwindcss"` 之后，产物里的相对位置就会变，而 dev 模式未必暴露。
改动过 `global.css` 的层声明后，务必跑一次 `pnpm build` 并用上面这条命令复核偏移。

---

## 组件间距规范（单边控制）

**规则：相邻两元素的间距，只由后一个元素的 `mt-*` 给，前一个不设 `mb-*`。**

```tsx
// ✅ 正确：间距 = 你写的那个数，可预测
<Input value={displayName} onChange={...} />
<Alert className="mt-3" ... />

// ❌ 错误：间距是 12 还是 28，取决于会不会 margin 折叠
<Input className="mb-3" ... />
<Alert className="mt-4" ... />
```

**为什么两边都设会出问题**：

| 情况 | 结果 |
|------|------|
| 相邻块级元素 | margin 折叠，取 `max(12,16)` = **16px** |
| antd `Input` 根元素是 `inline-block` | **不折叠**，`12+16` = **28px** |

同一个 antd 组件，**加不加 prefix/suffix 会改变根元素**（`<input class="ant-input">` ↔
`<span class="ant-input-affix-wrapper">`），导致间距在 16 和 28 之间跳。单边控制可以绕开整个问题。

---

## antd Alert 使用注意

| 注意事项 | 做法 |
|---------|------|
| **带 description 时内边距过大** | antd 默认给 `16px 24px`，紧凑表单里要收窄：`style={{ padding: "10px 14px" }}` |
| **长错误提示不能用 toast** | `message.error()` 几秒自动消失，用户来不及照做。含"下一步动作"的多句提示必须用**常驻可关闭的 Alert** |
| **阻断性提示放在输入框上方** | 例如"此邮箱不支持密码登录"，要在用户动手填之前就告知，而不是填完提交才报错 |
| **占位元素别留空高** | 状态提示区若用 `min-h-[20px]` 占位，在不会触发该状态的模式下应整块 `{cond && ...}` 不渲染，否则留下莫名空白 |

---

## 桌面应用 UI 注意事项

| 注意事项 | 说明 |
|---------|------|
| 窗口大小 | 默认 800x600,可在 tauri.conf.json 配置 |
| 无滚动条 | 桌面应用通常避免页面级滚动 |
| 系统菜单 | 可通过 Tauri Menu API 实现原生菜单 |
| 拖拽区域 | 使用 `data-tauri-drag-region` 创建可拖拽标题栏 |
| 快捷键 | 可通过 Tauri 全局快捷键 API 注册 |
| 主题系统 | 通过 `data-theme` 属性 + CSS 变量切换暗色/亮色，详见 `theme-system` 技能 |

### 样式选择规则

| 场景 | 方案 | 示例 |
|------|------|------|
| Ant Design 组件内 | `token.*`（`useToken()`） | `token.colorBgContainer` |
| 自定义组件颜色 | CSS 变量 `var(--xxx)` | `background: var(--bg-secondary)` |
| 布局/间距 | TailwindCSS 原子类 | `className="flex gap-4 p-6"` |
| ⚠️ 作用在 **antd 组件**上的 Tailwind 类 | 需 layer 配置就位，见上方「Tailwind 与 antd 共存」 | 配错则静默失效 |
| 边框颜色 | CSS 变量 | `border: 1px solid var(--border)` |
| TailwindCSS 引用变量 | arbitrary values | `bg-[var(--bg-hover)]` |

### 关键主题文件

| 文件 | 职责 |
|------|------|
| `src/styles/variables.css` | 设计令牌（颜色/间距/阴影/圆角/字体） |
| `src/theme/antdTheme.ts` | Ant Design 主题配置（`getAntdTheme(resolved)`） |
| `src/store/app.ts` | 主题状态管理（dark/light/system 三态） |

---

## 常见错误

| 错误做法 | 正确做法 |
|---------|---------|
| 使用 `window.alert()` | 使用自定义弹窗组件或 Tauri dialog 插件 |
| 使用 `window.open()` | 使用 Tauri 窗口 API 或 opener 插件 |
| 硬编码颜色值 `#1a1a1c` | 使用 `var(--bg-primary)` 或 `token.colorBgLayout` |
| 使用 TailwindCSS `dark:` 前缀 | 使用 CSS 变量 `var(--xxx)` 或 `data-theme` 选择器 |
| 使用绝对像素布局 | 使用 flexbox/grid 响应式布局 |
| 组件过大不拆分 | 按功能拆分为 < 200 行的小组件 |
| `` message.error(`加载失败: ${error}`) `` | `message.error(getErrorMessage(error))` + `import { getErrorMessage } from "@/lib/api"` |
| 设置页用独立路由 | 使用 `Drawer` 从右侧滑入，无需路由切换 |
| 所有 API/类型/store 写在单文件 | 按模块拆分（`api/config.ts`、`store/settings.ts`、`types/system.ts`） |
| 表单 Modal/Drawer 允许点击遮罩关闭 | 必须加 `maskClosable={false}`，防止误点丢失输入 |
| 给 antd 组件写 Tailwind 类却不生效，改用 `!important`（`!mt-4`）硬顶 | 治标不治本 —— 查 `@layer` 三明治**三处是否都到位**（见「Tailwind 与 antd 共存」） |
| `@ant-design/cssinjs` 版本写死成 `"2.1.2"` | 用 `"^2.1.0"`；写死会在 antd 升 major 时装出两份实例，layer 配置静默失效 |
| 只加 `StyleProvider layer`，没在 `global.css` 写 `@layer` 声明行 | antd 不自带 `dependencies`，层会被追加到 `utilities` 之后，等于没配 |
| 用 `document.createElement` 造元素验证 layer 是否生效 | 必须取页面真实渲染的 antd 元素；裸元素让方向 1 恒为假阳性 |
| 相邻元素两边都设间距（前 `mb-3` + 后 `mt-4`） | 只由后一个元素的 `mt-*` 单边控制，避免 margin 折叠导致间距不可预测 |
| 长错误提示用 `message.error()` 弹 toast | 含"下一步动作"的多句提示用常驻 Alert，toast 会自动消失、用户来不及照做 |
| `<iframe src={convertFileSrc(abs)}>` 预览本地 PDF/HTML，内嵌在 Modal | 部分老 WebView2 / 严格 CSP 下 iframe 加载 asset: 协议被拦成「已阻止此内容」；各机器行为不一 | Modal title 右侧固定加一个「用系统应用打开」小按钮调 `openPath(abs)`，作为跨环境兜底；不要依赖 iframe 的 onerror（拦截不会触发） |


## 悬停提示统一（原生 title → AntD Tooltip）

🔴 **本项目全站禁用浏览器原生 `title` 黄条**。`src/App.tsx` 挂了全局 `src/components/GlobalNativeTooltip.tsx`：
捕获阶段监听 hover，把**任意元素的 `title`** 一次性「借走」存到 `data-native-title`（浏览器从此不弹黄条）+ 补 `aria-label`，
再用**受控 AntD Tooltip** 在该元素矩形上渲染同款深色气泡（跟随主题，150ms 延迟防扫过狂闪）。

- 只作用于「带 title 特性的 DOM 元素」；AntD 自己的 Tooltip/Modal/Drawer 触发器上没有 `title` 特性 → **零冲突、零布局改动**。
- **新写交互提示：直接给元素加 `title="文案"` 即可自动升级成气泡**（面向未来，不用逐个手包 `<Tooltip>`）。
- 需要**富文本 / 受控 open / 动态文案**时才显式用 AntD `<Tooltip>`（`placement` + `mouseEnterDelay={0.2}`）。
- ❌ 别再留原生黄条，也别逐个手包 Tooltip。
