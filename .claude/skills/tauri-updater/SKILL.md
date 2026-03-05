---
name: tauri-updater
description: |
  Tauri 应用自动更新技能,使用 tauri-plugin-updater 实现版本更新。

  触发场景:
  - 需要实现应用自动更新
  - 需要配置更新服务器
  - 需要处理更新 UI 和流程
  - 需要管理更新签名和安全

  触发词: 更新、update、自动更新、版本更新、升级、updater、OTA
---

# Tauri 应用自动更新

## 安装

```toml
# Cargo.toml
tauri-plugin-updater = "2"
```

```bash
pnpm add @tauri-apps/plugin-updater
```

## 注册

```rust
tauri::Builder::default()
    .plugin(tauri_plugin_updater::Builder::new().build())
```

## Capabilities

```json
{ "permissions": ["updater:default"] }
```

---

## 更新端点配置

### tauri.conf.json

```json
{
  "plugins": {
    "updater": {
      "endpoints": [
        "https://releases.myapp.com/{{target}}/{{arch}}/{{current_version}}"
      ],
      "pubkey": "YOUR_PUBLIC_KEY_HERE"
    }
  }
}
```

### 更新服务器响应格式

```json
{
  "version": "1.1.0",
  "notes": "修复了若干问题,提升了性能",
  "pub_date": "2026-03-05T12:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "url": "https://releases.myapp.com/MyApp_1.1.0_x64-setup.nsis.zip",
      "signature": "SIGNATURE_HERE"
    },
    "darwin-x86_64": {
      "url": "https://releases.myapp.com/MyApp.app.tar.gz",
      "signature": "SIGNATURE_HERE"
    },
    "linux-x86_64": {
      "url": "https://releases.myapp.com/MyApp_1.1.0_amd64.AppImage.tar.gz",
      "signature": "SIGNATURE_HERE"
    }
  }
}
```

---

## 前端更新检查

```typescript
import { check } from "@tauri-apps/plugin-updater";

async function checkForUpdate() {
  const update = await check();

  if (update) {
    console.log(`发现新版本: ${update.version}`);
    console.log(`更新说明: ${update.body}`);

    // 下载并安装
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case "Started":
          console.log(`开始下载,总大小: ${event.data.contentLength}`);
          break;
        case "Progress":
          console.log(`下载中: ${event.data.chunkLength} bytes`);
          break;
        case "Finished":
          console.log("下载完成");
          break;
      }
    });

    // 安装完成后需要重启
    // await relaunch();
  } else {
    console.log("已是最新版本");
  }
}
```

---

## 生成签名密钥

```bash
# 生成更新签名密钥对
pnpm tauri signer generate -w ~/.tauri/myapp.key

# 输出:
# 私钥: ~/.tauri/myapp.key
# 公钥: 显示在终端(复制到 tauri.conf.json 的 pubkey)
```

### 环境变量

```bash
# 构建时设置签名密钥
TAURI_SIGNING_PRIVATE_KEY=~/.tauri/myapp.key pnpm tauri build
```

---

## GitHub Releases 方案

使用 GitHub Actions 自动发布更新:

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ["v*"]

jobs:
  build:
    strategy:
      matrix:
        platform: [macos-latest, ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: pnpm install
      - uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
        with:
          tagName: v__VERSION__
          releaseName: "v__VERSION__"
          releaseBody: "See the assets to download this version and install."
```

---

## 常见错误

| 错误做法 | 正确做法 |
|---------|---------|
| 不签名更新包 | 必须使用签名确保安全 |
| 私钥提交到仓库 | 私钥只放在 CI 密钥或本地 |
| 更新后不提示重启 | 提示用户重启以应用更新 |
| 不处理下载失败 | catch 错误并允许重试 |
| 不做灰度发布 | 先小范围测试再全量推送 |
