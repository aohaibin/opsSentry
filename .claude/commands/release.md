# /release - 发布新版本

作为版本发布助手，执行 Tauri 桌面应用的发布流程：更新版本号 → 更新 README → 推送 → 打 Tag 触发 CI 全自动构建。

> **本地不需要执行 `pnpm tauri build`**。CI 会自动构建所有平台安装包并推送产物到 release 仓库。

## 执行流程

### 第一步：读取当前版本和发布配置

```bash
Read src-tauri/tauri.conf.json  # 读取当前 version 和 productName
```

检查是否存在发布配置文件 `.claude/release-config.json`：
- **存在**：读取配置，跳到第三步
- **不存在**：进入第二步（首次配置）

### 第二步：首次配置（仅首次执行）

使用 AskUserQuestion 询问以下信息：

**问题1**：源码仓库的 GitHub remote 名称是什么？
- 选项：`github`、`origin`、自定义

**问题2**：请提供以下信息（自由文本）：
- 源码仓库 GitHub URL（如 `https://github.com/user/my-app`）
- Release 仓库 Gitee URL（如 `https://gitee.com/user/my-app-release`）
- Release 仓库 GitHub URL（如 `https://github.com/user/my-app-release`）
- 本地 Release 仓库（Gitee）路径
- 本地 Release 仓库（GitHub）路径
- 主分支名（master/main）

将信息保存到 `.claude/release-config.json`：

```json
{
  "appName": "<从 tauri.conf.json 的 productName 读取>",
  "githubRemote": "github",
  "sourceRepoUrl": "https://github.com/user/my-app",
  "releaseRepoGiteeUrl": "https://gitee.com/user/my-app-release",
  "releaseRepoGithubUrl": "https://github.com/user/my-app-release",
  "localReleaseGiteePath": "<绝对路径>",
  "localReleaseGithubPath": "<绝对路径>",
  "mainBranch": "master"
}
```

### 第三步：询问发布信息

使用 AskUserQuestion 询问：

**问题1**：新版本号是什么？（当前: {当前版本}）
- 选项：patch（x.y.Z+1）、minor（x.Y+1.0）、major（X+1.0.0）、自定义

**问题2**：更新说明（将写入 README.md 版本历史）

### 第四步：激活 release-publish 技能

```
Skill(release-publish)
```

### 第五步：按技能中的步骤自动执行全部流程

1. 更新三处版本号（tauri.conf.json / Cargo.toml / package.json）
2. 更新两个 release 仓库的 README.md（下载链接 + 版本历史 + 项目结构树）
3. 提交 + pull rebase + 推送 release 仓库 README 变更（Gitee 先推，GitHub 后推）
4. 提交源码仓库 + 推送到 GitHub
5. 打 Tag + 推送（触发 CI 构建三平台安装包）
6. 输出完成报告

---

## AI 执行规则

### 配置管理
1. **首次自动配置**：首次执行时询问仓库信息，保存到 `.claude/release-config.json`
2. **后续自动读取**：后续发布直接读取配置，不再重复询问

### 版本号
3. **全自动执行**：除询问版本号和更新说明外，不再中途询问确认
4. **三处同步**：tauri.conf.json / Cargo.toml / package.json 版本号必须一致

### README 更新
5. **三处更新**：下载链接表格 + 版本历史条目 + 项目结构树
6. **两个仓库同步**：Gitee 和 GitHub release 仓库的 README.md 内容一致
7. **CI 产物文件名**：使用 `<productName>_` 作为前缀（从 tauri.conf.json 读取）

### 推送相关
8. **推送前先拉取**：release 仓库 push 前必须 `git pull --rebase origin master`
9. **Gitee 优先推送**：release 仓库先推 Gitee（主更新端点），后推 GitHub（备份）
10. **Git remote 名**：从 release-config.json 读取
11. **打 Tag 触发 CI**：`git tag vX.Y.Z && git push <remote> vX.Y.Z`

### 不需要做的事
12. **不需要本地构建**：`pnpm tauri build` 由 CI 执行
13. **不需要手动更新 update.json**：CI 自动生成全平台 update.json
14. **不需要手动复制产物**：CI 自动下载产物并推送到 release 仓库
15. **不需要手动推送签名**：CI 构建时自动签名
