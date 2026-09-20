import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const isBuild = args.includes("build");
const env = { ...process.env };

if (isBuild && !env.TAURI_SIGNING_PRIVATE_KEY?.trim()) {
  const keyCandidates = [
    path.resolve("src-tauri/keys/opsentr.key"),
    path.resolve("src-tauri/keys/tauri-updater.key"),
  ];
  const keyPath = keyCandidates.find((candidate) => fs.existsSync(candidate));

  if (keyPath) {
    // 仅将本地忽略目录中的密钥注入当前构建子进程，不把密钥写入仓库或命令行参数。
    env.TAURI_SIGNING_PRIVATE_KEY = fs.readFileSync(keyPath, "utf8").trim();

    if (!env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD?.trim()) {
      const passwordPath = `${keyPath}.password`;
      if (fs.existsSync(passwordPath)) {
        env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = fs
          .readFileSync(passwordPath, "utf8")
          .trim();
      }
    }
  }
}

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const result = spawnSync(pnpm, ["exec", "tauri", ...args], {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});

if (result.error) {
  console.error(`无法启动 Tauri CLI: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
