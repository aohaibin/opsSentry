---
name: release-publish
description: |
  发布版本/发布更新/release/推送Gitee/签名构建/update.json/版本发布/R2 CDN/rclone

  触发场景：
  - 需要发布新版本
  - 需要执行发布流程
  - 需要更新版本号并推送

  触发词：发布、release、版本发布、推送、打Tag、update.json、签名构建
---

# 发布更新

## 概述

Tauri 桌面应用采用 **CI 构建 + 本地推送** 模式（可选 R2 CDN 加速）：

```
本地：更新版本号 → 提交 → 打 Tag → 推送（触发 CI）
  ↓ CI 构建中（不推送任何内容到 release 仓库）
CI：构建安装包（按配置的平台） → 上传到 GitHub Release（草稿）
  ↓ CI 完成后，用户下载产物
本地：[可选] 上传产物到 R2 CDN + 更新 README + 复制产物 + 生成 update.json → 推送到 Gitee/GitHub release 仓库
```

> **关键原则**：CI 构建完成、用户提供下载文件之前，**不要推送任何内容到 release 仓库**。
> README 更新、产物复制、update.json 生成在获得产物后一次性完成并推送。

> **本地不需要执行 `pnpm tauri build`**。CI 负责构建和签名。
> 构建完成后，用户手动从 GitHub Release 下载产物，Claude 负责本地处理和推送。

### 平台配置

发布流程支持按需选择构建平台，通过 `.claude/release-config.json` 的 `platforms` 字段配置：

| platforms 值 | CI 构建矩阵 | 产物数量 |
|-------------|------------|---------|
| `["windows", "macos"]` | Windows + macOS ARM + macOS Intel | 8 个 |
| `["windows", "macos", "linux"]` | 全平台 | 11 个 |
| `["windows"]` | 仅 Windows | 2 个 |
| `["macos"]` | 仅 macOS ARM + Intel | 6 个 |

> **首次发布时通过 `/release` 命令询问用户选择平台，记录后不再重复询问。**
> 去掉 Linux 可节省 CI 时间、减少产物体积（Linux AppImage 约 80MB）。

### 三级分发策略

支持可选的 R2 CDN 作为主下载源，通过 `.claude/release-config.json` 的 `r2.enabled` 字段控制：

**R2 CDN 启用时（r2.enabled = true）：**

| 用途 | 平台 | 角色 | 原因 |
|------|------|------|------|
| **源码托管** | GitHub（私有） | — | 代码管理 + CI 构建 |
| **CI 构建** | GitHub Actions | — | 跨平台构建 + 签名 |
| **安装包下载 + 自动更新** | Cloudflare R2 CDN | **主源** | 全球 CDN，零流量费，上传秒级 |
| **自动更新兜底** | Gitee（公开） | **备源** | R2 不通时兜底，中国大陆可访问 |
| **备份存档** | GitHub（公开） | **存档** | 海外用户 + 历史备份 |

> **R2 CDN 优势**：上传 24MB 产物仅需 ~8 秒，零流量费，全球 CDN 加速。
> 自定义域名（如 `dl.example.com`）为可选配置，需将域名 DNS 迁移到 Cloudflare。
> 当前使用 R2.dev 公开 URL，功能完全等价。

**R2 CDN 未启用时（默认模式）：**

| 用途 | 平台 | 原因 |
|------|------|------|
| **源码托管** | GitHub（私有） | 代码管理 + CI 构建 |
| **CI 构建** | GitHub Actions | 跨平台构建 + 签名 |
| **自动更新端点** | Gitee（公开） | 中国大陆可访问 |
| **安装包下载** | Gitee（公开） | 中国大陆可下载 |
| **备份存档** | GitHub（公开） | 海外用户 + 备份 |

### 为什么不让 CI 推送到 release 仓库？

GitHub Actions 在美国服务器运行，推送二进制产物到 Gitee（中国）经常超时（50 分钟+）。
因此改为用户本地下载产物后，由 Claude 在本地完成推送，速度更快且更可控。

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

每个仓库需要一个 `README.md` 和 `update.json`（本地推送时自动生成 update.json）。

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

> **注意**：不再需要 `RELEASE_REPO_TOKEN`、`GITEE_USERNAME`、`GITEE_TOKEN`，
> 因为 CI 不再推送到 release 仓库，推送由本地完成。

### 4. 配置 tauri.conf.json

**如果 R2 CDN 启用（r2.enabled = true）：**

```json
{
  "plugins": {
    "updater": {
      "endpoints": [
        "<r2.publicUrl>/<r2.pathPrefix>/update.json",
        "https://gitee.com/<用户名>/<项目名>-release/raw/master/update.json"
      ],
      "pubkey": "<公钥内容>"
    }
  },
  "bundle": {
    "targets": ["nsis"],
    "createUpdaterArtifacts": "v1Compatible"
  }
}
```

> R2 作为第一端点（主源），Gitee 作为第二端点（备源）。Tauri updater 按顺序尝试，第一个失败自动 fallback。

**如果 R2 未启用（默认）：**

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

### 7. 根据平台配置修改 CI workflow

根据 `.claude/release-config.json` 中的 `platforms` 配置，修改 `.github/workflows/release.yml` 的构建矩阵：

**Windows + macOS（推荐，不含 Linux）：**
```yaml
matrix:
  include:
    - platform: windows-latest
      args: '--bundles nsis'
    - platform: macos-latest
      args: '--bundles app,dmg'
      target: aarch64-apple-darwin
    - platform: macos-latest
      args: '--bundles app,dmg'
      target: x86_64-apple-darwin
```

**全平台（含 Linux）：**
```yaml
matrix:
  include:
    - platform: windows-latest
      args: '--bundles nsis'
    - platform: macos-latest
      args: '--bundles app,dmg'
      target: aarch64-apple-darwin
    - platform: macos-latest
      args: '--bundles app,dmg'
      target: x86_64-apple-darwin
    - platform: ubuntu-22.04
      args: '--bundles deb,appimage'
```

---

## 关键配置（用户须在首次发布时提供）

> **以下信息在首次发布时通过 `/release` 命令询问用户获取，后续自动记忆。**

| 配置项 | 说明 | 示例 |
|--------|------|------|
| **应用名称** | CI 产物前缀（productName） | `MyApp` |
| **支持平台** | 构建哪些平台 | `["windows", "macos"]` |
| **源码仓库 GitHub remote 名** | 推送源码用 | `github` 或 `origin` |
| **源码仓库 GitHub URL** | CI 所在仓库 | `https://github.com/user/my-app` |
| **Release 仓库（Gitee）URL** | 更新端点（主/备取决于 R2） | `https://gitee.com/user/my-app-release` |
| **Release 仓库（GitHub）URL** | 备份存档 | `https://github.com/user/my-app-release` |
| **本地 Release 仓库（Gitee）路径** | 本地 clone 目录 | `../my-app-release-gitee` |
| **本地 Release 仓库（GitHub）路径** | 本地 clone 目录 | `../my-app-release` |
| **主分支名** | master 或 main | `master` |
| **R2 CDN 启用**（可选） | 是否使用 R2 作为主源 | `true` / `false` |
| **R2 公开地址**（可选） | R2.dev 或自定义域名 | `https://pub-xxx.r2.dev` |
| **R2 rclone remote**（可选） | rclone 配置名 | `r2` |
| **R2 bucket**（可选） | R2 存储桶名 | `downloads` |
| **R2 路径前缀**（可选） | 多项目隔离路径 | `myapp` |

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

### 步骤 3：提交源码仓库并打 Tag 触发 CI

> **注意**：此阶段只操作源码仓库，**不推送任何内容到 release 仓库**。
> release 仓库的 README、产物、update.json 全部在步骤 5（CI 完成后）一次性处理。

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

### 步骤 4：等待 CI 构建完成

根据 `platforms` 配置输出对应平台的文件清单。

**各平台对应的 CI 产物**：

| 平台 | 产物数量 | 文件列表 |
|------|---------|---------|
| Windows | 2 个 | `.exe` + `.exe.sig` |
| macOS ARM | 3 个 | `_aarch64.dmg` + `_aarch64.app.tar.gz` + `_aarch64.app.tar.gz.sig` |
| macOS Intel | 3 个 | `_x64.dmg` + `_x64.app.tar.gz` + `_x64.app.tar.gz.sig` |
| Linux | 3 个 | `.AppImage` + `.AppImage.sig` + `.deb` |

使用 AskUserQuestion 询问：**文件下载到了哪个目录？**

### 步骤 5：处理下载的产物 + 更新 README（Claude 自动执行）

用户提供下载目录后，Claude 自动执行以下操作：

```bash
VERSION="x.y.z"
DOWNLOAD_DIR="<用户提供的下载目录>"
GITEE_DIR="<本地 Gitee Release 仓库路径>"
GITHUB_DIR="<本地 GitHub Release 仓库路径>"

# === R2 配置（从 release-config.json 读取，r2.enabled 时才有值） ===
R2_ENABLED=<true/false>
R2_PUBLIC_URL="<r2.publicUrl>"          # 如 https://pub-xxx.r2.dev
RCLONE_REMOTE="<r2.rcloneRemote>"      # 如 r2
R2_BUCKET="<r2.bucket>"                # 如 downloads
R2_PREFIX="<r2.pathPrefix>"            # 如 myapp
RCLONE="$HOME/bin/rclone.exe"          # rclone 程序路径

# ========== 1. [可选] 上传产物到 R2 CDN（如果 r2.enabled） ==========
if [ "$R2_ENABLED" = "true" ]; then
  $RCLONE copy "$DOWNLOAD_DIR"/ ${RCLONE_REMOTE}:${R2_BUCKET}/${R2_PREFIX}/releases/v${VERSION}/ --progress \
    --include "*.exe" --include "*.exe.sig" --include "*.dmg" \
    --include "*.app.tar.gz" --include "*.app.tar.gz.sig" \
    --include "*.AppImage" --include "*.AppImage.sig" --include "*.deb"
fi

# ========== 2. 复制所有产物到两个 release 仓库 ==========
for DIR in "$GITEE_DIR" "$GITHUB_DIR"; do
  mkdir -p "$DIR/releases/v$VERSION"
  # 按 platforms 配置复制对应文件
  cp "$DOWNLOAD_DIR"/*.exe "$DIR/releases/v$VERSION/" 2>/dev/null         # windows
  cp "$DOWNLOAD_DIR"/*.exe.sig "$DIR/releases/v$VERSION/" 2>/dev/null     # windows
  cp "$DOWNLOAD_DIR"/*.dmg "$DIR/releases/v$VERSION/" 2>/dev/null         # macos
  cp "$DOWNLOAD_DIR"/*.app.tar.gz "$DIR/releases/v$VERSION/" 2>/dev/null  # macos
  cp "$DOWNLOAD_DIR"/*.app.tar.gz.sig "$DIR/releases/v$VERSION/" 2>/dev/null # macos
  cp "$DOWNLOAD_DIR"/*.AppImage "$DIR/releases/v$VERSION/" 2>/dev/null    # linux
  cp "$DOWNLOAD_DIR"/*.AppImage.sig "$DIR/releases/v$VERSION/" 2>/dev/null # linux
  cp "$DOWNLOAD_DIR"/*.deb "$DIR/releases/v$VERSION/" 2>/dev/null         # linux
done

# ========== 3. 读取签名文件，生成 update.json（仅包含已配置平台） ==========
# 如果 r2.enabled：生成 R2 版（URL 指向 R2 CDN）+ Gitee 版 + GitHub 版（3 个版本）
# 如果 r2 未启用：生成 Gitee 版 + GitHub 版（2 个版本）
#
# R2 版 URL 基准: ${R2_PUBLIC_URL}/${R2_PREFIX}/releases/v${VERSION}
# Gitee 版 URL 基准: https://gitee.com/<用户名>/<项目名>-release/raw/master/releases/vx.y.z
# GitHub 版 URL 基准: https://github.com/<用户名>/<项目名>-release/raw/master/releases/vx.y.z

# ========== 4. [可选] 上传 R2 版 update.json（如果 r2.enabled） ==========
if [ "$R2_ENABLED" = "true" ]; then
  # 生成 R2 版 update.json（URL 指向 R2 CDN），写入临时文件后上传
  $RCLONE copyto /tmp/update-r2.json ${RCLONE_REMOTE}:${R2_BUCKET}/${R2_PREFIX}/update.json --progress

  # ========== 4b. [可选] 更新 R2 版本列表（文档站下载页依赖此文件） ==========
  # 下载当前 versions.json → 在数组头部插入新版本 → 上传回 R2
  # versions.json 格式: {"versions": ["v2.8.2", "v2.8.1", ...]}
  # 如果文档站使用 R2 versions.json 获取版本列表，则需要维护此文件
  curl -s "${R2_PUBLIC_URL}/${R2_PREFIX}/versions.json" -o /tmp/versions.json 2>/dev/null || echo '{"versions":[]}' > /tmp/versions.json
  # 在 versions 数组头部插入 "v${VERSION}"
  $RCLONE copyto /tmp/versions.json ${RCLONE_REMOTE}:${R2_BUCKET}/${R2_PREFIX}/versions.json --progress
fi

# ========== 5. 更新两个 release 仓库的 README.md（三处更新） ==========
#    - 最新版本下载表格（版本号 + 多平台链接）
#    - 版本历史（添加新版本条目）
#    - 项目结构树（添加新版本目录）
#    两个仓库的 README.md 内容一致，同步更新
Edit "$GITEE_DIR/README.md"
Edit "$GITHUB_DIR/README.md"
```

**下载表格模板**（根据 platforms 配置选择包含哪些平台）：

```markdown
### 最新版本: vx.y.z

| 平台 | 下载链接 |
|------|---------|
| Windows x64 | [AppName_x.y.z_x64-setup.exe](releases/vx.y.z/AppName_x.y.z_x64-setup.exe) |
| macOS Apple Silicon | [AppName_x.y.z_aarch64.dmg](releases/vx.y.z/AppName_x.y.z_aarch64.dmg) |
| macOS Intel | [AppName_x.y.z_x64.dmg](releases/vx.y.z/AppName_x.y.z_x64.dmg) |
| Linux | [AppName_x.y.z_amd64.AppImage](releases/vx.y.z/AppName_x.y.z_amd64.AppImage) |
```

**项目结构树模板**（根据 platforms 配置选择包含哪些文件）：

```
    └── vx.y.z/         # vx.y.z 版本
        ├── AppName_x.y.z_x64-setup.exe           # Windows 安装包
        ├── AppName_x.y.z_x64-setup.exe.sig       # Windows updater 签名
        ├── AppName_x.y.z_aarch64.dmg             # macOS Apple Silicon
        ├── AppName_aarch64.app.tar.gz            # macOS ARM updater 产物
        ├── AppName_aarch64.app.tar.gz.sig        # macOS ARM updater 签名
        ├── AppName_x.y.z_x64.dmg                 # macOS Intel
        ├── AppName_x64.app.tar.gz               # macOS Intel updater 产物
        └── AppName_x64.app.tar.gz.sig           # macOS Intel updater 签名
```

**update.json 模板**（根据 platforms 配置选择包含哪些平台）：

```json
{
  "version": "x.y.z",
  "notes": "Release vx.y.z",
  "pub_date": "2026-03-10T12:00:00Z",
  "platforms": {
    "windows-x86_64": { ... },      // ← platforms 含 windows
    "darwin-aarch64": { ... },       // ← platforms 含 macos
    "darwin-x86_64": { ... },        // ← platforms 含 macos
    "linux-x86_64": { ... }          // ← platforms 含 linux
  }
}
```

> **注意**：各版本 update.json 只有 URL 中的 `<BASE>` 不同。
> - R2（如果启用）: `<r2.publicUrl>/<r2.pathPrefix>/releases/vx.y.z`
> - Gitee: `https://gitee.com/<用户名>/<项目名>-release/raw/master/releases/vx.y.z`
> - GitHub: `https://github.com/<用户名>/<项目名>-release/raw/master/releases/vx.y.z`
>
> R2 版 update.json 上传到 R2 CDN 作为主更新端点，Gitee 版写入 Gitee release 仓库作为备用。

### 步骤 6：推送 release 仓库（README + 产物 + update.json）

> **推送前必须先拉取**：上一版本可能已推送产物到远程，本地可能落后。
> **推送超时处理**：release 仓库包含大量二进制文件，`git push` 可能超时。如果推送失败（SSL_ERROR_SYSCALL / RPC failed / hung up），**不要重试**，直接提示用户手动执行推送命令，然后继续后续步骤。

```bash
# === Gitee release 仓库 ===
cd "$GITEE_DIR"
git add -A
git commit -m "release: v$VERSION

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git pull --rebase origin master
git push origin master

# === GitHub release 仓库 ===
cd "$GITHUB_DIR"
git add -A
git commit -m "release: v$VERSION

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
git pull --rebase origin master
git push origin master
```

### 步骤 7：完成报告

```markdown
## 发布完成

| 项目 | 值 |
|------|-----|
| 版本 | vx.y.z |
| 支持平台 | <从 platforms 配置读取> |
| 源码仓库 | 已推送到 <GitHub URL> |
| CI 构建 | 已完成，产物已上传到 GitHub Release |
| R2 CDN | 产物 + update.json 已上传（如果 r2.enabled，否则显示"未启用"） |
| Release 仓库（Gitee） | 产物 + update.json 已推送 |
| Release 仓库（GitHub） | 产物 + update.json 已推送 |
| 应用内自动更新 | R2 主 + Gitee 备，双端点已生效（如果 r2.enabled）/ Gitee 端点已生效（如果 r2 未启用） |
```

---

## CI 构建流程

### 概述

通过 GitHub Actions 在云端自动构建安装包并签名，无需本地构建。
CI **只负责构建和上传到 GitHub Release**，不负责推送到 release 仓库。
构建矩阵由 `platforms` 配置决定。

### 工作流文件

`.github/workflows/release.yml`

### 触发方式

推送 `v*.*.*` 格式的 Git Tag 时自动触发：

```bash
git tag v0.2.0
git push <github_remote> v0.2.0
```

### 构建矩阵（按 platforms 配置）

| 平台 | Runner | Bundle 参数 | Updater 产物 | 安装包产物 | platforms 值 |
|------|--------|-------------|-------------|-----------|-------------|
| Windows | `windows-latest` | `--bundles nsis` | `.exe` + `.exe.sig` | `.exe` (NSIS) | `windows` |
| macOS (ARM) | `macos-latest` | `--bundles app,dmg` | `.app.tar.gz` + `.sig` | `.dmg` (aarch64) | `macos` |
| macOS (Intel) | `macos-latest` | `--bundles app,dmg` | `.app.tar.gz` + `.sig` | `.dmg` (x86_64) | `macos` |
| Linux | `ubuntu-22.04` | `--bundles deb,appimage` | `.AppImage` + `.sig` | `.deb` + `.AppImage` | `linux` |

> **macOS 必须包含 `app` bundle**
> - `dmg` 只生成安装用的 DMG 镜像，**不生成 updater 产物**
> - `app` 生成 `.app` 应用包，Tauri 会自动打包为 `.app.tar.gz` 并签名
> - 正确写法：`--bundles app,dmg`（先 app 再 dmg）

### 签名说明

- CI 构建时自动使用 `TAURI_SIGNING_PRIVATE_KEY` 进行签名
- **签名文件（`.sig`）已包含在 CI 产物中**，用户只需下载即可
- 用户不需要在本地做任何签名操作
- Claude 读取 `.sig` 文件内容来生成 `update.json`

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

## Cloudflare R2 CDN 配置（可选）

> 以下内容仅在 `release-config.json` 中 `r2.enabled = true` 时适用。

### R2 目录规划（支持多项目）

```
<bucket>/                              ← Bucket 根目录（如 downloads）
├── <pathPrefix>/                      ← 项目隔离目录（如 myapp）
│   ├── releases/vX.Y.Z/              ← 版本产物
│   └── update.json                   ← Tauri 自动更新端点
├── other-project/                     ← 其他项目
│   └── releases/
└── shared/                            ← 共享资源
```

### 自定义域名（可选）

> 当前使用 R2.dev 公开 URL（如 `https://pub-xxx.r2.dev`），功能完全等价。
> 如需绑定自定义域名（如 `dl.example.com`），需要：
> 1. 将域名 DNS 迁移到 Cloudflare（NS 变更）
> 2. R2 Settings → Custom Domains → 添加子域名
> 3. 更新 `tauri.conf.json` 和 release-config.json 中的 URL
>
> **注意**：DNS 迁移会影响现有域名解析，需提前导入所有 DNS 记录。

### R2 成本（永久免费额度内）

| 项目 | 免费额度 | 实际用量（估） |
|------|---------|--------------|
| 存储 | 10 GB/月 | ~500MB（20 版本） |
| 上传操作 | 100万次/月 | ~50次/月 |
| 下载操作 | 1000万次/月 | ~2000次/月 |
| 出站流量 | **无限免费** | ~50GB/月 |

### rclone 配置方法

```bash
# 1. 安装 rclone（下载到 ~/bin/rclone.exe 或其他位置）
# 2. 配置 R2 remote
rclone config
# 选 "New remote" → 名称填 r2 → 类型选 "Cloudflare R2" → 填入 Access Key ID + Secret
# 配置完成后验证：
rclone ls r2:<bucket>/

# 3. 测试上传
rclone copy ./test.txt r2:<bucket>/<pathPrefix>/test/ --progress
```

> rclone 配置文件位于 `~/.config/rclone/rclone.conf`。

### Tauri updater 端点配置（R2 启用时）

```json
{
  "plugins": {
    "updater": {
      "endpoints": [
        "<r2.publicUrl>/<r2.pathPrefix>/update.json",
        "https://gitee.com/<用户名>/<项目名>-release/raw/master/update.json"
      ]
    }
  }
}
```

> R2 作为第一端点（主源），Gitee 作为第二端点（备源）。Tauri updater 会按顺序尝试，第一个失败自动 fallback。

---

## 常见问题排查

### 应用内更新问题

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 应用检查不到更新 | release 仓库是私有的 | 将仓库设为公开，否则 raw 地址需认证 |
| 应用检查不到更新 | update.json 中版本号 <= 当前版本 | 确保 update.json 的 version 大于已安装版本 |
| 签名验证失败 | 公钥不匹配 | 确保 `tauri.conf.json` 中的 pubkey 与签名使用的私钥配对 |

### R2 CDN 问题（r2.enabled 时）

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| R2 下载失败 | R2.dev 域名偶尔被墙 | Tauri updater 自动 fallback 到 Gitee 备源端点 |
| rclone 上传失败 | Access Key 过期或 bucket 名错误 | 检查 `~/.config/rclone/rclone.conf` 中的 R2 配置 |
| R2 update.json 未更新 | rclone copyto 命令未执行 | 检查 `release-config.json` 中 `r2.enabled` 是否为 `true` |
| R2 产物 URL 404 | pathPrefix 或 bucket 名不匹配 | 确认 `r2.publicUrl` + `r2.pathPrefix` 与 rclone 上传路径一致 |
| 自定义域名不生效 | DNS 未迁移到 Cloudflare | 使用 R2.dev 公开 URL 作为替代 |

### Git 推送问题

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| Release 仓库 push rejected | 上一版本已推送产物到远程，本地落后 | **先 `git pull --rebase origin master` 再 push** |

### CI 构建问题（踩坑总结）

| 问题 | 根因 | 解决方案 |
|------|------|---------|
| macOS updater 产物缺失 | `--bundles dmg` 不生成 updater 产物 | **必须用 `--bundles app,dmg`** |
| Linux 编译 unused import 警告 | `#[cfg(target_os = "windows")]` 下的 import 在 Linux 不使用 | 将 import 也放在 `#[cfg()]` 块内 |
| CI 推送 Gitee 超时 | GitHub Actions（美国）推送到 Gitee（中国）太慢 | **已改为本地推送**，不再由 CI 推送 |

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
