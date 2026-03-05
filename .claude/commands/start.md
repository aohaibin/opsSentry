# /start - 新窗口快速了解项目

作为项目引导助手，帮我快速了解 Tauri 桌面应用项目的当前状态。

## 你需要做的：

1. 项目基本信息
   - 识别项目类型（Tauri 2.x + Rust + React 19 + TypeScript）
   - 查看最近 5 条 Git 提交
   ```bash
   git log -5 --format="%H|%an|%cn|%s" --no-merges
   ```

2. 智能检测项目状态

   第一步：检测 Rust 模块
   ```
   Glob pattern: "src-tauri/src/**/*.rs"
   Grep pattern: "#\[tauri::command\]" path: src-tauri/src/ output_mode: count
   ```

   第二步：检查前端组件
   ```
   Glob pattern: "src/**/*.tsx"
   Glob pattern: "src/**/*.ts"
   ```

   第三步：检查 Tauri 配置
   ```
   Read src-tauri/tauri.conf.json
   Glob pattern: "src-tauri/capabilities/*.json"
   ```

   第四步：检查 Git 状态
   ```bash
   git status --short
   ```

3. 输出简洁报告

   ```markdown
   # 欢迎回到 Tauri 桌面应用项目

   ## 项目信息
   - 项目名称: Tauri Desktop App
   - 技术栈: Rust 2021 + React 19 + TypeScript 5.8 + Tauri 2.x
   - 应用标识: com.agilefr.tauri

   ## 最近动态
   [最近提交信息]

   ## 当前状态

   ### Rust 后端 (src-tauri/src/)
   | 指标 | 数量 |
   |------|------|
   | Rust 源文件 | X |
   | Tauri Commands | X |

   ### React 前端 (src/)
   | 指标 | 数量 |
   |------|------|
   | 组件文件 (.tsx) | X |
   | 工具文件 (.ts) | X |

   ### Tauri 配置
   - 应用标题: ...
   - 窗口大小: ... x ...
   - 权限文件: X 个

   ## 你可以：
   1. /next - 获取下一步开发建议（推荐）
   2. /progress - 查看详细进度报告
   3. /dev - 开发新功能（Rust Command + React UI）
   4. /command - 快速创建 Tauri Command
   5. /check - 代码规范检查

   ## 快速开始：
   - "帮我创建一个文件管理器功能"
   - "添加系统托盘支持"
   - "检查代码规范"
   ```

## 注意事项：
- 输出要简洁，一屏内能看完
- 明确展示双端结构（Rust + React）
- 语气友好、轻松
- 不预估时间
