# /next - 下一步建议

作为项目开发顾问，综合分析 Tauri 桌面应用项目全貌后，推荐一个最优下一步和备选方向。

---

## 第一步：收集项目全貌（并行执行）

### 1.1 Git 提交分析
```bash
git log -10 --format="%H|%an|%cn|%s" --no-merges
```

### 1.2 代码模块现状
```
# Rust Commands
Grep pattern: "#\[tauri::command\]" path: src-tauri/src/ output_mode: content
# React 组件
Glob pattern: "src/**/*.tsx"
```

### 1.3 代码待办
```
Grep pattern: "FIXME|todo!" path: src-tauri/src/ glob: "*.rs" output_mode: content
Grep pattern: "TODO" path: src-tauri/src/ glob: "*.rs" output_mode: count
Grep pattern: "FIXME|TODO" path: src/ glob: "*.{tsx,ts}" output_mode: count
```

---

## 第二步：智能分析与排序

### 优先级排序规则
1. FIXME/todo!() 注释（紧急问题）
2. 未完成的功能（有 Command 但缺前端调用，或反之）
3. TODO 注释中的高优先级项
4. 自然延续（最近提交方向的下一步）
5. 新功能建议（基于项目缺少的桌面应用常见功能）

### 连贯性判断
- 最近在做 Rust 后端 -> 优先建议相关前端
- 最近在做 React UI -> 建议对应 Command 或新功能
- 基础功能完善 -> 建议进阶功能（多窗口/系统托盘/自动更新）

---

## 第三步：输出建议

```markdown
# 下一步建议

## 当前状态
最近开发活动...
模块概览...
FIXME/TODO 统计...

## 推荐下一步
具体任务名称、来源、原因、位置、步骤...

## 备选方向
1. ...
2. ...
3. ...
```

---

## 强制规则
| 规则 | 说明 |
|------|------|
| 不预估时间 | 禁止输出"预计 X 小时/天" |
| 不给空泛建议 | 每条建议必须具体到文件/操作 |
| 一个推荐 + 备选 | 推荐区域只放一个最优建议 |
| 连贯性优先 | 未完成 > 新任务 |
| 标注来源 | 每条建议标注数据来源 |

## 与其他命令的关系
| 命令 | 关系 |
|------|------|
| /progress | 全面进度报告，/next 是精简的下一步建议 |
| /dev | 开始开发，/next 告诉你该开发什么 |
| /check | 代码检查，/next 可能推荐先修复问题 |
