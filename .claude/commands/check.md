# /check - 全栈代码规范检查

作为代码规范检查助手，自动检测 Tauri 桌面应用项目代码是否符合全栈规范。

## 检查范围

支持三种检查模式：

1. **全量检查**：`/check` - 检查所有代码（Rust + React + Tauri 配置）
2. **后端检查**：`/check rust` - 仅检查 Rust 后端代码
3. **前端检查**：`/check react` - 仅检查 React/TypeScript 前端代码

---

## 检查清单总览

### Rust 后端检查（src-tauri/src/）

| 检查项 | 级别 | 说明 |
|--------|------|------|
| unwrap 使用 | 严重 | Command 函数中禁止 unwrap()，必须用 `?` 或 `map_err` |
| panic 使用 | 严重 | Command 函数中禁止 panic!() / todo!() / unimplemented!()，必须用 Result 返回错误 |
| Command 注册 | 严重 | 所有 `#[tauri::command]` 函数必须在 `generate_handler![]` 中注册 |
| Command 返回类型 | 严重 | 必须返回 `Result<T, String>` 或自定义错误类型（实现 `Into<InvokeError>`） |
| unsafe 代码 | 严重 | 禁止无注释的 unsafe 块，必须注明安全性理由 |
| serde derive | 警告 | 跨前后端传输的结构体必须 `#[derive(Serialize, Deserialize)]` |
| 阻塞操作 | 警告 | 同步 Command 中禁止长时间阻塞（文件 IO / 网络请求 / sleep），应使用 `async` Command |
| Clone 滥用 | 警告 | 避免对大型结构体不必要的 `.clone()`，优先使用引用 |
| 命名规范 | 建议 | 函数/变量 `snake_case`，结构体/枚举 `PascalCase`，常量 `SCREAMING_SNAKE_CASE` |
| 文档注释 | 建议 | 公共函数和结构体应有 `///` 文档注释 |

### React 前端检查（src/）

| 检查项 | 级别 | 说明 |
|--------|------|------|
| invoke 错误处理 | 严重 | `invoke()` 调用必须用 try-catch 包裹或 `.catch()` 处理 |
| any 类型 | 严重 | 禁止使用 `any` 类型，必须定义明确的 TypeScript 接口 |
| class 组件 | 严重 | 禁止使用 class 组件，必须使用函数组件 + Hooks |
| Node.js API | 严重 | 禁止导入 Node.js 模块（fs/path/http/child_process），使用 Tauri API 替代 |
| 事件监听清理 | 警告 | `listen()` / `once()` 返回的 unlisten 函数必须在组件卸载时调用 |
| 硬编码路径 | 警告 | 禁止硬编码文件路径字符串，使用 `@tauri-apps/api/path` API |
| console.log 残留 | 警告 | 生产代码中不应残留 `console.log` 调试语句 |
| useEffect 依赖 | 警告 | useEffect 必须正确声明依赖数组，禁止空依赖但引用外部变量 |
| 组件文件命名 | 建议 | 组件文件使用 PascalCase（如 `UserProfile.tsx`） |
| 导入排序 | 建议 | 导入顺序：React → 第三方库 → @tauri-apps → 本地模块 → 样式 |

### Tauri 配置检查（src-tauri/）

| 检查项 | 级别 | 说明 |
|--------|------|------|
| capabilities 完整性 | 严重 | 代码中使用的 Tauri 插件 API 必须在 capabilities 中声明权限 |
| allowlist 最小化 | 严重 | 不使用的 API 权限不应开启，遵循最小权限原则 |
| identifier 格式 | 警告 | `tauri.conf.json` 中 identifier 必须是反向域名格式（如 `com.example.app`） |
| CSP 配置 | 警告 | 生产环境必须配置 Content Security Policy |
| 版本号格式 | 建议 | version 应使用语义化版本号（semver） |
| 图标完整性 | 建议 | icons 目录应包含所有平台所需图标 |

---

## Rust 检查详情

### 1. unwrap 使用检查 [严重]

```bash
Grep pattern: "\.unwrap()" path: src-tauri/src/ output_mode: content -n
```

```rust
// 错误
let config = std::fs::read_to_string("config.json").unwrap();
let state = app_state.lock().unwrap();

// 正确
let config = std::fs::read_to_string("config.json")
    .map_err(|e| format!("Failed to read config: {}", e))?;
let state = app_state.lock()
    .map_err(|e| format!("Failed to acquire lock: {}", e))?;
```

**豁免**：测试代码（`#[cfg(test)]` 块内）和 `main()` 函数中允许使用 `unwrap()`。

### 2. panic 使用检查 [严重]

```bash
Grep pattern: "panic!\|todo!\|unimplemented!" path: src-tauri/src/ output_mode: content -n
```

```rust
// 错误
fn process_data(data: &str) -> String {
    if data.is_empty() {
        panic!("Data cannot be empty");
    }
    todo!()
}

// 正确
fn process_data(data: &str) -> Result<String, String> {
    if data.is_empty() {
        return Err("Data cannot be empty".to_string());
    }
    Ok(data.to_uppercase())
}
```

**豁免**：`unreachable!()` 在已穷举的 match 分支中允许使用。

### 3. Command 注册检查 [严重]

```bash
# 步骤 1：找出所有标记为 command 的函数名
Grep pattern: "#\[tauri::command\]" path: src-tauri/src/ output_mode: content -A 2

# 步骤 2：找出 generate_handler 中的注册列表
Grep pattern: "generate_handler" path: src-tauri/src/ output_mode: content -A 20
```

**检查方法**：对比两个列表，确保每个 `#[tauri::command]` 函数都出现在 `generate_handler![]` 中。遗漏注册的 Command 前端调用时会返回 "command not found" 错误。

### 4. Command 返回类型检查 [严重]

```bash
# 检查 command 函数的返回类型
Grep pattern: "#\[tauri::command\]" path: src-tauri/src/ output_mode: content -A 5
```

```rust
// 错误：返回裸类型，错误无法传递给前端
#[tauri::command]
fn read_file(path: String) -> String {
    std::fs::read_to_string(path).unwrap() // 双重错误：裸返回 + unwrap
}

// 正确：返回 Result，错误信息可序列化给前端
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file: {}", e))
}

// 最佳：自定义错误类型
#[tauri::command]
async fn read_file(path: String) -> Result<String, AppError> {
    let content = tokio::fs::read_to_string(path).await?;
    Ok(content)
}
```

### 5. unsafe 代码检查 [严重]

```bash
Grep pattern: "unsafe " path: src-tauri/src/ output_mode: content -B 2 -A 5
```

每个 `unsafe` 块必须有 `// SAFETY:` 注释说明安全性理由。

### 6. serde derive 检查 [警告]

```bash
# 找出 Command 参数和返回值中使用的结构体
Grep pattern: "struct " path: src-tauri/src/ output_mode: content -B 3
```

```rust
// 错误：缺少 serde derive
struct FileInfo {
    name: String,
    size: u64,
}

// 正确
#[derive(Debug, Serialize, Deserialize)]
struct FileInfo {
    name: String,
    size: u64,
}
```

### 7. 阻塞操作检查 [警告]

```bash
# 检查同步 Command 中的阻塞调用
Grep pattern: "std::fs::|std::thread::sleep|std::net::|reqwest::blocking" path: src-tauri/src/ output_mode: content -B 5
```

```rust
// 错误：同步 Command 中执行阻塞 IO
#[tauri::command]
fn download_file(url: String) -> Result<Vec<u8>, String> {
    let resp = reqwest::blocking::get(&url).map_err(|e| e.to_string())?;
    resp.bytes().map(|b| b.to_vec()).map_err(|e| e.to_string())
}

// 正确：使用 async Command
#[tauri::command]
async fn download_file(url: String) -> Result<Vec<u8>, String> {
    let resp = reqwest::get(&url).await.map_err(|e| e.to_string())?;
    resp.bytes().await.map(|b| b.to_vec()).map_err(|e| e.to_string())
}
```

---

## React 检查详情

### 1. invoke 错误处理 [严重]

```bash
# 检查所有 invoke 调用
Grep pattern: "invoke\(" path: src/ glob: "*.{tsx,ts}" output_mode: content -B 3 -A 3
```

```typescript
// 错误：无错误处理
const result = await invoke("read_file", { path: filePath });

// 错误：空 catch
try {
  const result = await invoke("read_file", { path: filePath });
} catch {}

// 正确：有错误处理逻辑
try {
  const result = await invoke<string>("read_file", { path: filePath });
  setContent(result);
} catch (error) {
  console.error("Failed to read file:", error);
  setError(String(error));
}
```

### 2. any 类型检查 [严重]

```bash
Grep pattern: ": any\b|as any\b|<any>" path: src/ glob: "*.{tsx,ts}" output_mode: content -n
```

```typescript
// 错误
const handleData = (data: any) => { ... }
const result = response as any;

// 正确
interface FileData {
  name: string;
  size: number;
  content: string;
}
const handleData = (data: FileData) => { ... }
const result = response as FileData;
```

### 3. class 组件检查 [严重]

```bash
Grep pattern: "class .* extends (React\.)?Component" path: src/ glob: "*.{tsx,ts}" output_mode: files_with_matches
```

```typescript
// 错误
class UserProfile extends React.Component { ... }

// 正确
function UserProfile() { ... }
// 或
const UserProfile: React.FC = () => { ... }
```

### 4. Node.js API 检查 [严重]

```bash
Grep pattern: "from ['\"]fs['\"]|from ['\"]path['\"]|from ['\"]http['\"]|from ['\"]child_process['\"]|require\(['\"]fs|require\(['\"]path" path: src/ glob: "*.{tsx,ts}" output_mode: content -n
```

```typescript
// 错误：使用 Node.js 模块
import fs from "fs";
import path from "path";
const data = fs.readFileSync("config.json");

// 正确：使用 Tauri API
import { readTextFile } from "@tauri-apps/plugin-fs";
import { join, appDataDir } from "@tauri-apps/api/path";
const appDir = await appDataDir();
const configPath = await join(appDir, "config.json");
const data = await readTextFile(configPath);
```

### 5. 事件监听清理 [警告]

```bash
# 检查 listen 调用是否有对应的 unlisten
Grep pattern: "listen\(|once\(" path: src/ glob: "*.{tsx,ts}" output_mode: content -B 2 -A 10
```

```typescript
// 错误：未清理事件监听
useEffect(() => {
  listen("download-progress", (event) => {
    setProgress(event.payload as number);
  });
}, []);

// 正确：在 cleanup 中调用 unlisten
useEffect(() => {
  let unlisten: (() => void) | undefined;

  const setupListener = async () => {
    unlisten = await listen<number>("download-progress", (event) => {
      setProgress(event.payload);
    });
  };
  setupListener();

  return () => {
    unlisten?.();
  };
}, []);
```

### 6. 硬编码路径检查 [警告]

```bash
Grep pattern: "C:\\\\|D:\\\\|/home/|/Users/|/tmp/|/var/" path: src/ glob: "*.{tsx,ts}" output_mode: content -n
```

```typescript
// 错误：硬编码绝对路径
const configPath = "C:\\Users\\admin\\AppData\\config.json";
const logPath = "/home/user/.app/logs";

// 正确：使用 Tauri path API
import { appDataDir, appLogDir } from "@tauri-apps/api/path";
const dataDir = await appDataDir();
const logDir = await appLogDir();
```

### 7. console.log 残留 [警告]

```bash
Grep pattern: "console\.(log|debug|info|warn)\(" path: src/ glob: "*.{tsx,ts}" output_mode: content -n
```

**豁免**：`console.error` 用于错误日志记录允许保留。

### 8. useEffect 依赖检查 [警告]

```bash
# 检查空依赖数组的 useEffect
Grep pattern: "useEffect\(" path: src/ glob: "*.{tsx,ts}" output_mode: content -A 10
```

手动审查每个 `useEffect`：
- 空依赖 `[]` 但回调中引用了 state/props -> 错误
- 缺少依赖数组 -> 可能导致无限循环

---

## Tauri 配置检查详情

### 1. capabilities 完整性 [严重]

```bash
# 步骤 1：找出代码中使用的 Tauri 插件 API
Grep pattern: "@tauri-apps/plugin-" path: src/ glob: "*.{tsx,ts}" output_mode: content

# 步骤 2：检查 capabilities 配置
Glob pattern: "src-tauri/capabilities/*.json"
# 或检查 tauri.conf.json 中的 capabilities 部分
```

**检查方法**：代码中 import 了 `@tauri-apps/plugin-fs` 则 capabilities 中必须包含 `fs:default` 或具体的 `fs:allow-read` 等权限。

常见插件与权限对照：

| 插件导入 | 所需 capability |
|---------|----------------|
| `@tauri-apps/plugin-fs` | `fs:default` 或细粒度权限 |
| `@tauri-apps/plugin-dialog` | `dialog:default` |
| `@tauri-apps/plugin-shell` | `shell:default` |
| `@tauri-apps/plugin-http` | `http:default` |
| `@tauri-apps/plugin-notification` | `notification:default` |
| `@tauri-apps/plugin-clipboard-manager` | `clipboard-manager:default` |
| `@tauri-apps/plugin-os` | `os:default` |
| `@tauri-apps/plugin-process` | `process:default` |
| `@tauri-apps/plugin-updater` | `updater:default` |

### 2. allowlist 最小化 [严重]

```bash
# 检查 capabilities 中声明的权限
Grep pattern: "\"permissions\"" path: src-tauri/capabilities/ output_mode: content -A 20
```

对比代码实际使用的 API 和声明的权限，移除未使用的权限。

### 3. identifier 格式 [警告]

```bash
Grep pattern: "\"identifier\"" path: src-tauri/tauri.conf.json output_mode: content
```

```json
// 错误
"identifier": "my-app"
"identifier": "MyApp"

// 正确
"identifier": "com.example.myapp"
"identifier": "io.github.user.appname"
```

### 4. CSP 配置 [警告]

```bash
Grep pattern: "\"csp\"" path: src-tauri/tauri.conf.json output_mode: content
```

```json
// 建议的 CSP 配置
"security": {
  "csp": "default-src 'self'; img-src 'self' asset: https://asset.localhost; style-src 'self' 'unsafe-inline'"
}
```

如果未配置 CSP，报出警告。

---

## 输出格式

```markdown
# 代码规范检查报告

**检查时间**：YYYY-MM-DD HH:mm
**检查范围**：[全量 / rust / react]

---

## 检查结果汇总

| 类别 | 通过 | 警告 | 错误 |
|------|------|------|------|
| Rust 后端 | X | X | X |
| React 前端 | X | X | X |
| Tauri 配置 | X | X | X |
| **合计** | **X** | **X** | **X** |

---

## 严重问题（必须修复）

### 1. [问题类型] - [级别]
**文件**：`src-tauri/src/commands/file.rs:42`
**问题**：Command 函数中使用了 unwrap()
**当前代码**：
    let content = std::fs::read_to_string(path).unwrap();
**修复建议**：
    let content = std::fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

---

## 警告（建议修复）

### 1. [问题类型] - [级别]
**文件**：`src/components/FileViewer.tsx:15`
**问题**：...
**修复建议**：...

---

## 检查通过项

- [x] unwrap 使用 - 无违规
- [x] panic 使用 - 无违规
- [x] Command 注册 - 全部已注册（N 个）
- [x] invoke 错误处理 - 全部有 try-catch
- ...

---

## 相关规范
- 后端规范：`.claude/skills/crud-development/SKILL.md`
- 前端规范：`.claude/skills/ui-frontend/SKILL.md`
- Tauri 规范：`.claude/skills/tauri-integration/SKILL.md`
```

---

## 检查优先级

### 开发完成后必查（按优先级排序）

1. **Rust 中是否有 unwrap() 和 panic!()**
   - 这是最常见且最危险的问题，会导致程序崩溃
2. **Command 是否全部注册到 generate_handler![]**
   - 遗漏注册会导致前端调用失败，且错误信息不直观
3. **invoke 调用是否有错误处理**
   - 未处理的 invoke 错误会导致 Unhandled Promise Rejection
4. **capabilities 权限是否完整且最小化**
   - 权限缺失导致 API 调用被拒绝；权限过多产生安全风险
5. **是否使用了 any 类型**
   - 破坏 TypeScript 类型安全，隐藏潜在的类型错误
6. **事件监听是否正确清理**
   - 未清理的监听器导致内存泄漏和重复回调
7. **是否存在 Node.js API 调用**
   - Tauri 前端运行在 WebView 中，无 Node.js 运行时
8. **async Command 中是否有阻塞操作**
   - 阻塞主线程会导致界面卡顿无响应
9. **serde derive 是否完整**
   - 缺少序列化 derive 会导致编译错误或运行时序列化失败
10. **unsafe 代码是否有安全性注释**
    - 无注释的 unsafe 代码难以审查和维护
