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

Tauri 桌面应用的前端运行在系统 WebView 中,使用 React 19 + TypeScript 开发。与 Web 应用的主要区别是:窗口大小可控、无需考虑 SEO、可调用系统 API。

---

## UI 组件库选择

| 库 | 特点 | 适用场景 | 安装 |
|-----|------|---------|------|
| **Ant Design** | 企业级组件丰富 | 管理后台类桌面应用 | `pnpm add antd` |
| **MUI (Material UI)** | Material Design 风格 | 通用桌面应用 | `pnpm add @mui/material` |
| **Shadcn/ui** | 可复制组件、高度可定制 | 需要深度定制 UI | 按组件安装 |
| **Headless UI** | 无样式、纯逻辑 | 配合 Tailwind 使用 | `pnpm add @headlessui/react` |
| **Radix UI** | 无障碍优先 | 高质量组件基础 | `pnpm add @radix-ui/react-*` |
| 无(纯 CSS) | 最轻量 | 简单应用 | 无需安装 |

---

## 组件开发模式

### 基础组件模板

```tsx
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Props {
  title: string;
}

function FeaturePage({ title }: Props) {
  const [data, setData] = useState<DataType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<DataType[]>("get_data");
      setData(result);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="loading">加载中...</div>;
  if (error) return <div className="error">错误: {error}</div>;

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

### 表单组件

```tsx
import { useState, FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";

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
      alert(`保存失败: ${e}`);
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

## 桌面应用 UI 注意事项

| 注意事项 | 说明 |
|---------|------|
| 窗口大小 | 默认 800x600,可在 tauri.conf.json 配置 |
| 无滚动条 | 桌面应用通常避免页面级滚动 |
| 系统菜单 | 可通过 Tauri Menu API 实现原生菜单 |
| 拖拽区域 | 使用 `data-tauri-drag-region` 创建可拖拽标题栏 |
| 快捷键 | 可通过 Tauri 全局快捷键 API 注册 |
| 深色模式 | 使用 CSS `prefers-color-scheme` 媒体查询 |

---

## 常见错误

| 错误做法 | 正确做法 |
|---------|---------|
| 使用 `window.alert()` | 使用自定义弹窗组件或 Tauri dialog 插件 |
| 使用 `window.open()` | 使用 Tauri 窗口 API 或 opener 插件 |
| 不考虑深色模式 | 使用 CSS 变量 + prefers-color-scheme |
| 使用绝对像素布局 | 使用 flexbox/grid 响应式布局 |
| 组件过大不拆分 | 按功能拆分为 < 200 行的小组件 |
