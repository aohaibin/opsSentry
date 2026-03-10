---
name: release-publish
description: |
  发布版本/发布更新/release/推送Gitee/签名构建/update.json/版本发布

  触发场景：
  - 需要发布新版本
  - 需要执行发布流程
  - 需要更新版本号并推送

  触发词：发布、release、版本发布、推送、打Tag、update.json、签名构建
---

# 发布更新

## 概述

Tauri 桌面应用采用 **CI 全自动发布** 模式：

```
本地：更新版本号 → 提交 → 打 Tag → 推送
  ↓ 触发
CI：构建三平台安装包 → 上传 GitHub Release → 推送产物和 update.json 到 Gitee/GitHub release 仓库
```

> **本地不需要执行 `pnpm tauri build`**。CI 会自动构建所有平台（Windows/macOS/Linux），
> 并自动推送产物、签名、update.json 到 release 仓库。本地只负责版本号更新和打 Tag。

### 双仓库发布策略

由于 GitHub raw URL 在中国大陆不稳定，应用内自动更新使用 **Gitee** 作为更新端点：

| 用途 | 平台 | 原因 |
|------|------|------|
| **源码托管** | GitHub（私有） | 代码管理 + CI 构建 |
| **CI 构建** | GitHub Actions | 跨平台构建 |
| **自动更新端点** | Gitee（公开） | 中国大陆可访问 |
| **安装包下载** | Gitee（公开） | 中国大陆可下载 |
| **备份存档** | GitHub（公开） | 海外用户 + 备份 |

---

## 首次发布前的准备工作

> **首次使用发布功能时，必须先完成以下配置。后续发布跳过此节。**

### 1. 创建 Release 仓库

需要创建两个 **公开** 仓库用于存放安装包和 update.json：

```bash
# Gitee（主更新端点，中国大陆可访问）
https://gitee.com/<用户名>/<项目名>-release

# GitHub（备份）
https://github.com/<用户名>/<项目名>-release
```

每个仓库需要一个 `README.md` 和 `update.json`（CI 会自动更新 update.json）。

### 2. 生成签名密钥

```bash
# 在项目根目录生成更新签名密钥对
pnpm tauri signer generate -w src-tauri/keys/tauri-updater.key
# 密码提示时直接按两次回车（空密码）
```

生成后：
- 将 `.key.pub` 文件内容复制到 `tauri.conf.json` → `plugins.updater.pubkey`
- 将 `.key` 文件内容添加到 GitHub Secrets → `TAURI_SIGNING_PRIVATE_KEY`
- 确保 `src-tauri/keys/` 已加入 `.gitignore`

### 3. 配置 GitHub Secrets

在 **源码仓库**（私有）的 Settings → Secrets and variables → Actions 中添加：

| Secret 名称 | 值 | 说明 |
|-------------|-----|------|
| `TAURI_SIGNING_PRIVATE_KEY` | `src-tauri/keys/tauri-updater.key` 文件的完整内容 | 更新签名私钥 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 空字符串（留空即可） | 私钥密码（无密码） |
| `RELEASE_REPO_TOKEN` | GitHub Fine-grained PAT（需 Contents R/W 权限） | 用于推送到 GitHub release 仓库 |
| `GITEE_USERNAME` | Gitee 用户名 | 用于推送到 Gitee release 仓库 |
| `GITEE_TOKEN` | Gitee 私人令牌（需仓库读写权限） | 用于推送到 Gitee release 仓库 |

### 4. 配置 tauri.conf.json

```json
{
  "plugins": {
    "updater": {
      "endpoints": ["https://gitee.com/<用户名>/<项目名>-release/raw/master/update.json"],
      "pubkey": "<公钥内容>"
    }
  },
  "bundle": {
    "targets": ["nsis"],
    "createUpdaterArtifacts": "v1Compatible"
  }
}
```

### 5. 添加 GitHub remote（如仅有 Gitee remote）

```bash
git remote add github https://github.com/<用户名>/<项目名>.git
```

### 6. 克隆 Release 仓库到本地

```bash
# 建议放在源码仓库的同级目录
git clone https://gitee.com/<用户名>/<项目名>-release.git   # Gitee
git clone https://github.com/<用户名>/<项目名>-release.git  # GitHub（另一个目录名）
```

---

## 关键配置（用户须在首次发布时提供）

> **以下信息在首次发布时通过 `/release` 命令询问用户获取，后续自动记忆。**

| 配置项 | 说明 | 示例 |
|--------|------|------|
| **应用名称** | CI 产物前缀（productName） | `MyApp` |
| **源码仓库 GitHub remote 名** | 推送源码用 | `github` 或 `origin` |
| **源码仓库 GitHub URL** | CI 所在仓库 | `https://github.com/user/my-app` |
| **Release 仓库（Gitee）URL** | 主更新端点 | `https://gitee.com/user/my-app-release` |
| **Release 仓库（GitHub）URL** | 备份 | `https://github.com/user/my-app-release` |
| **本地 Release 仓库（Gitee）路径** | 本地 clone 目录 | `../my-app-release-gitee` |
| **本地 Release 仓库（GitHub）路径** | 本地 clone 目录 | `../my-app-release` |
| **主分支名** | master 或 main | `master` |

---

## 版本号位置（三处必须同步）

| 文件 | 字段 |
|------|------|
| `src-tauri/tauri.conf.json` | `"version": "x.y.z"` |
| `src-tauri/Cargo.toml` | `version = "x.y.z"` |
| `package.json` | `"version": "x.y.z"` |

---

## 完整发布流程

### 步骤 1：询问版本号和更新说明

```
使用 AskUserQuestion 询问：
1. 新版本号？（当前版本读取自 tauri.conf.json）
2. 更新说明？（将写入 release 仓库 README.md 版本历史）
```

### 步骤 2：更新三处版本号

```bash
Edit src-tauri/tauri.conf.json   # "version": "新版本号"
Edit src-tauri/Cargo.toml        # version = "新版本号"
Edit package.json                # "version": "新版本号"
```

### 步骤 3：更新两个 release 仓库的 README.md

> CI 会自动推送产物和 update.json，但 **README.md 需要本地更新**。
> 在打 Tag 触发 CI 之前先推送 README 变更，CI 推送产物时会自动 rebase。

> **CI 产物文件名规则**：CI 构建的产物前缀为 `<productName>_`，
> 由 `tauri.conf.json` 的 `productName` 决定（空格会被替换为连字符或下划线）。
> README 中的下载链接和项目结构树必须使用 CI 实际产物文件名。

```bash
VERSION="x.y.z"
GITEE_DIR="<本地 Gitee Release 仓库路径>"
GITHUB_DIR="<本地 GitHub Release 仓库路径>"

# 需要更新 3 处：
# 1. 最新版本下载表格（版本号 + 多平台链接）
# 2. 版本历史（添加新版本条目）
# 3. 项目结构树（添加新版本目录）

# 两个仓库的 README.md 内容一致，同步更新
Edit "$GITEE_DIR/README.md"
Edit "$GITHUB_DIR/README.md"
```

**下载表格模板**（使用 CI 产物文件名）：

```markdown
### 最新版本: vx.y.z

| 平台 | 下载链接 |
|------|---------|
| Windows x64 | [<AppName>_x.y.z_x64-setup.exe](releases/vx.y.z/<AppName>_x.y.z_x64-setup.exe) |
| macOS Apple Silicon | [<AppName>_x.y.z_aarch64.dmg](releases/vx.y.z/<AppName>_x.y.z_aarch64.dmg) |
| macOS Intel | [<AppName>_x.y.z_x64.dmg](releases/vx.y.z/<AppName>_x.y.z_x64.dmg) |
| Linux x64 (AppImage) | [<AppName>_x.y.z_amd64.AppImage](releases/vx.y.z/<AppName>_x.y.z_amd64.AppImage) |
| Linux x64 (deb) | [<AppName>_x.y.z_amd64.deb](releases/vx.y.z/<AppName>_x.y.z_amd64.deb) |
```

**项目结构树模板**：

```
    └── vx.y.z/         # vx.y.z 版本（CI 自动推送）
        ├── <AppName>_x.y.z_x64-setup.exe           # Windows 安装包
        ├── <AppName>_x.y.z_aarch64.dmg             # macOS Apple Silicon
        ├── <AppName>_x.y.z_x64.dmg                 # macOS Intel
        ├── <AppName>_x.y.z_amd64.AppImage          # Linux AppImage
        ├── <AppName>_x.y.z_amd64.deb               # Linux deb
        └── ...                                      # updater 签名文件
```

### 步骤 4：提交并推送 release 仓库 README 变更

> **推送前必须先拉取**：CI 上一版本可能已推送产物到远程，本地可能落后。

```bash
# === Gitee release 仓库 ===
cd "$GITEE_DIR"
git add README.md
git commit -m "docs: 更新 README 至 v$VERSION

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git pull --rebase origin master
git push origin master

# === GitHub release 仓库 ===
cd "$GITHUB_DIR"
git add README.md
git commit -m "docs: 更新 README 至 v$VERSION

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git pull --rebase origin master
git push origin master
```

### 步骤 5：提交源码仓库并打 Tag 触发 CI

```bash
cd "<源码仓库路径>"

# 提交版本号更新 + 其他变更
git add src-tauri/tauri.conf.json src-tauri/Cargo.toml package.json
git commit -m "release: v$VERSION

<更新说明摘要>

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

# 推送到 GitHub（remote 名根据用户配置）
git push <github_remote> <主分支名>

# 打 Tag 并推送（触发 GitHub Actions CI）
git tag "v$VERSION"
git push <github_remote> "v$VERSION"
```

### 步骤 6：完成报告

```markdown
## 发布完成

| 项目 | 值 |
|------|-----|
| 版本 | vx.y.z |
| 源码仓库 | 已推送到 <GitHub URL> |
| CI 构建 | Tag vx.y.z 已推送，GitHub Actions 正在构建 |
| Release 仓库 README | 已更新（Gitee + GitHub） |

CI 将自动完成以下工作：
1. 构建 Windows (.exe) + macOS (.dmg) + Linux (.deb/.AppImage) 三平台安装包
2. 上传到 GitHub Release（草稿）
3. 推送所有产物和 update.json 到 Gitee + GitHub release 仓库
4. 应用内自动更新端点（Gitee）将在 CI 完成后生效
```

---

## CI 全自动化流程

### 概述

通过 GitHub Actions 在云端自动构建三平台安装包，无需本地构建。
CI 构建完成后会自动将所有平台产物同步推送到 Gitee 和 GitHub 的 release 仓库，并更新各自的 `update.json`。

### 工作流文件

`.github/workflows/release.yml`

### 触发方式

推送 `v*.*.*` 格式的 Git Tag 时自动触发：

```bash
git tag v0.2.0
git push <github_remote> v0.2.0
```

### CI 完成后的产物（以 v1.0.0 为例）

```
<AppName>_1.0.0_x64-setup.exe          # Windows 安装包（NSIS）
<AppName>_1.0.0_x64-setup.exe.sig      # Windows updater 签名
<AppName>_1.0.0_aarch64.dmg            # macOS Apple Silicon 安装包
<AppName>_aarch64.app.tar.gz           # macOS Apple Silicon updater 产物
<AppName>_aarch64.app.tar.gz.sig       # macOS Apple Silicon updater 签名
<AppName>_1.0.0_x64.dmg                # macOS Intel 安装包
<AppName>_x64.app.tar.gz               # macOS Intel updater 产物
<AppName>_x64.app.tar.gz.sig           # macOS Intel updater 签名
<AppName>_1.0.0_amd64.AppImage         # Linux AppImage
<AppName>_1.0.0_amd64.AppImage.sig     # Linux updater 签名
<AppName>_1.0.0_amd64.deb              # Linux Debian 安装包
```

### 构建矩阵

| 平台 | Runner | Bundle 参数 | Updater 产物 | 安装包产物 |
|------|--------|-------------|-------------|-----------|
| Windows | `windows-latest` | `--bundles nsis` | `.exe` + `.exe.sig` | `.exe` (NSIS) |
| macOS (Apple Silicon) | `macos-latest` | `--bundles app,dmg` | `.app.tar.gz` + `.app.tar.gz.sig` | `.dmg` (aarch64) |
| macOS (Intel) | `macos-latest` | `--bundles app,dmg` | `.app.tar.gz` + `.app.tar.gz.sig` | `.dmg` (x86_64) |
| Linux | `ubuntu-22.04` | `--bundles deb,appimage` | `.AppImage` + `.AppImage.sig` | `.deb` + `.AppImage` |

> **macOS 必须包含 `app` bundle**
> - `dmg` 只生成安装用的 DMG 镜像，**不生成 updater 产物**
> - `app` 生成 `.app` 应用包，Tauri 会自动打包为 `.app.tar.gz` 并签名
> - 正确写法：`--bundles app,dmg`（先 app 再 dmg）

### CI 自动化流程

```
本地打 Tag 推送
    ↓
4 个平台并行构建（release job）
    ↓ 所有完成后
update-release-repo job
    ↓ 等待 Release 资产上传（最多 10 分钟）
    ↓ 下载所有 updater 产物 + 安装包
    ↓ 复制到 release 仓库 releases/vX.Y.Z/ 目录
    ↓ 生成 update.json（Gitee 版 + GitHub 版，含全平台签名）
    ↓ 推送到 Gitee（主端点，优先）
    ↓ 推送到 GitHub（备份，continue-on-error）
```

### 关键 CI 配置要点（踩坑总结）

#### 1. update-release-repo 权限必须是 `contents: write`

```yaml
update-release-repo:
  needs: release
  permissions:
    contents: write  # 必须 write，read 无法查看草稿 Release
```

**原因**：`tauri-action` 使用 `releaseDraft: true` 创建草稿 Release。GitHub API 对草稿 Release 要求 push 权限。

#### 2. 推送顺序：Gitee 优先，GitHub 备份

```yaml
- name: Push to Gitee release repo (primary)
  run: |
    cd release-repo-gitee
    # ... git add/commit/push

- name: Push to GitHub release repo (backup)
  continue-on-error: true  # GitHub 失败不阻塞 Gitee
  run: |
    cd release-repo-github
    # ... git add/commit/push
```

#### 3. 查询草稿 Release 的正确 API

```bash
# 错误：/releases/tags/ 无法查到草稿 Release
gh api "repos/OWNER/REPO/releases/tags/v0.1.8"

# 正确：用 /releases 列表 API 按 tag_name 过滤
gh api "repos/OWNER/REPO/releases" --jq "[.[] | select(.tag_name == \"v0.1.8\")] | .[0].assets | length"
```

---

## 密钥管理

### 重新生成密钥（需手动执行）

```bash
pnpm tauri signer generate -w src-tauri/keys/tauri-updater.key
# 密码提示时直接按两次回车（空密码）
```

**重新生成后必须：**
1. 更新 `tauri.conf.json` 中的 `pubkey`（读取 `.key.pub` 文件内容）
2. 更新 GitHub Secrets 中的 `TAURI_SIGNING_PRIVATE_KEY`（读取 `.key` 文件内容）
3. 重新构建并发布（旧版本的签名将不可用，但不影响已安装用户）

### 安全提醒

- **私钥 (`tauri-updater.key`) 绝不能提交到公开仓库**
- `src-tauri/keys/` 应加入主项目的 `.gitignore`

---

## 常见问题排查

### 应用内更新问题

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 应用检查不到更新 | release 仓库是私有的 | 将仓库设为公开，否则 raw 地址需认证 |
| 应用检查不到更新 | update.json 中版本号 <= 当前版本 | 确保 update.json 的 version 大于已安装版本 |
| 签名验证失败 | 公钥不匹配 | 确保 `tauri.conf.json` 中的 pubkey 与签名使用的私钥配对 |

### Git 推送问题

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| Release 仓库 push rejected | CI 上一版本已推送产物到远程，本地落后 | **先 `git pull --rebase origin master` 再 push** |
| GitHub release 仓库推送 403 | `RELEASE_REPO_TOKEN` 过期 | 重新生成 Fine-grained PAT |
| Gitee 推送失败 | Token 过期或权限不足 | 重新生成 Gitee 私人令牌 |

### CI 构建问题（踩坑总结）

| 问题 | 根因 | 解决方案 |
|------|------|---------|
| update-release-repo 找不到 Release | `contents: read` 无法查看草稿 Release | **必须设 `contents: write`** |
| macOS updater 产物缺失 | `--bundles dmg` 不生成 updater 产物 | **必须用 `--bundles app,dmg`** |
| Gitee 推送被 GitHub 失败阻塞 | GitHub push 在前且失败 | **Gitee 优先推送**，GitHub 加 `continue-on-error` |
| Linux 编译 unused import 警告 | `#[cfg(target_os = "windows")]` 下的 import 在 Linux 不使用 | 将 import 也放在 `#[cfg()]` 块内 |

---

## 附录：本地构建（仅在 CI 不可用时使用）

> 正常发布流程使用 CI，以下仅作为 CI 不可用时的备用方案。

### Windows 本地签名构建

> **Windows 环境变量设置注意事项**
>
> Claude Code 的 Bash 工具运行在 Git Bash (MSYS2) 环境中。
> - **正确**：`export VAR=value && command`（bash export 语法）
> - **失败**：`set VAR=value && command`（CMD 语法在 bash 中无效）
> - **失败**：`$env:VAR='value'; command`（PowerShell 语法）

```bash
# 读取私钥并构建（单条 Bash 调用）
export TAURI_SIGNING_PRIVATE_KEY="<src-tauri/keys/tauri-updater.key 文件完整内容>" && \
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" && \
pnpm tauri build 2>&1

# 构建超时设置：600000ms（10分钟）
# 建议后台运行：run_in_background: true
# 构建成功标志：输出末尾出现 `Finished 1 updater signature at:`
```
