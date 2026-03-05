# /progress - 项目进度报告

作为项目进度分析助手，综合分析 Tauri 桌面应用项目全貌后，输出结构化的全面进度报告。

> 与 /next 的区别：/progress 是全面的只读报告（当前状态的快照），/next 是精简的下一步建议。

---

## 第一步：收集项目全貌（并行执行）

### 1.1 Git 提交分析
```bash
git log -20 --format="%H|%an|%cn|%s" --no-merges
```

### 1.2 Rust 后端扫描
```
# Tauri Commands
Grep pattern: "#\[tauri::command\]" path: src-tauri/src/ output_mode: content
# Rust 模块文件
Glob pattern: "src-tauri/src/**/*.rs"
# 依赖
Read src-tauri/Cargo.toml
```

### 1.3 React 前端扫描
```
Glob pattern: "src/**/*.tsx"
Glob pattern: "src/**/*.ts"
# 依赖
Read package.json
```

### 1.4 Tauri 配置扫描
```
Read src-tauri/tauri.conf.json
Glob pattern: "src-tauri/capabilities/*.json"
```

### 1.5 代码待办扫描
```
Grep pattern: "FIXME|TODO|todo!" path: src-tauri/src/ glob: "*.rs" output_mode: count
Grep pattern: "FIXME|TODO" path: src/ glob: "*.{tsx,ts}" output_mode: count
```

---

## 第二步：输出进度报告

```markdown
# 项目进度报告 - Tauri Desktop App

生成时间: YYYY-MM-DD HH:MM

---

## 开发活动概览
最近开发活动概要...

## 代码模块进度

### Rust 后端（src-tauri/src/）
| 指标 | 数量 |
|------|------|
| Rust 源文件 | X 个 |
| Tauri Commands | X 个 |
| 已注册插件 | X 个 |

### React 前端（src/）
| 指标 | 数量 |
|------|------|
| 组件文件 (.tsx) | X 个 |
| 工具文件 (.ts) | X 个 |

### Tauri 配置
| 指标 | 状态 |
|------|------|
| Capabilities 文件 | X 个 |
| 已声明权限 | X 项 |

## 代码质量指标
| 指标 | Rust | TypeScript |
|------|------|-----------|
| FIXME | X 处 | X 处 |
| TODO | X 处 | X 处 |

## 综合健康度
...

## 下一步
> 运行 /next 获取具体的下一步开发建议
```

---

## 强制规则
| 规则 | 说明 |
|------|------|
| 不预估时间 | 禁止输出"预计 X 小时/天" |
| 只读不写 | /progress 只分析不修改文件 |
| 客观评估 | 给出客观的进度评估 |
| 结尾联动 | 报告末尾推荐运行 /next |
