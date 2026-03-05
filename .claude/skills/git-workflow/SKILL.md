---
name: git-workflow
description: |
  Git 工作流与版本管理技能，规范分支策略、提交信息和发布流程。

  触发场景：
  - 用户需要创建分支或合并代码
  - 用户需要规范提交信息格式
  - 用户需要管理版本发布流程

  触发词：Git、分支、提交、合并、版本发布
---

# Git 工作流与版本管理

## 概述

Tauri Desktop App 的 Git 工作流与版本管理技能，规范分支命名、提交信息格式和发布流程。

---

## 分支策略

### 分支命名规范

| 分支类型 | 命名格式 | 示例 |
|---------|---------|------|
| 主分支 | `master` / `main` | `master` |
| 开发分支 | `dev` | `dev` |
| 功能分支 | `feature/{功能名}` | `feature/file-manager` |
| 修复分支 | `fix/{问题描述}` | `fix/window-resize-crash` |
| 发布分支 | `release/v{版本}` | `release/v0.2.0` |

---

## 提交信息规范

### Conventional Commits

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Type 定义

| Type | 说明 | 示例 |
|------|------|------|
| `feat` | 新功能 | `feat(rust): 添加文件读写 Command` |
| `fix` | 修复 Bug | `fix(react): 修复状态更新不生效` |
| `refactor` | 重构 | `refactor(rust): 重构错误处理为 thiserror` |
| `docs` | 文档 | `docs: 更新 README` |
| `style` | 格式 | `style(rust): cargo fmt 格式化` |
| `test` | 测试 | `test(rust): 添加 Command 单元测试` |
| `chore` | 杂务 | `chore: 更新 Cargo.toml 依赖` |
| `build` | 构建 | `build: 配置 Tauri 打包参数` |

### Scope 建议

| Scope | 说明 |
|-------|------|
| `rust` | Rust 后端代码 |
| `react` | React 前端代码 |
| `tauri` | Tauri 配置 (tauri.conf.json) |
| `caps` | Capabilities 权限配置 |
| `deps` | 依赖更新 |

---

## 发布流程

```
1. 更新版本号
   - package.json: version
   - src-tauri/Cargo.toml: version
   - src-tauri/tauri.conf.json: version
2. 更新 CHANGELOG
3. 创建 release 分支
4. 构建各平台安装包: pnpm tauri build
5. 测试安装包
6. 合并到 master，打 tag
7. 发布 GitHub Release（附带安装包）
```

---

## 常见错误

| 错误做法 | 正确做法 |
|---------|---------|
| 直接在 master 上开发 | 创建功能分支开发 |
| 提交信息写"修改代码" | 按 Conventional Commits 规范编写 |
| 版本号只改 package.json | 同步修改 Cargo.toml 和 tauri.conf.json |
| 提交 target/ 编译产物 | 确保 .gitignore 正确配置 |
