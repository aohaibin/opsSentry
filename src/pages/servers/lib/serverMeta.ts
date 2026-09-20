import type { AIPolicy, AuthType, OsType } from "@/types";

/** AI 策略档位的展示元数据 */
export interface AIPolicyMeta {
  label: string;
  /** 表格里的紧凑叫法，窄列下比 label 更好排 */
  short: string;
  /** Ant Design Tag 的颜色 */
  color: string;
  /** 悬停说明：让用户知道这一档到底意味着什么 */
  hint: string;
}

export const AI_POLICY_META: Record<AIPolicy, AIPolicyMeta> = {
  trusted: {
    label: "已信任",
    short: "放行",
    color: "green",
    hint: "AI 命中策略直接执行，仅记录审计日志",
  },
  allowlist: {
    label: "白名单",
    short: "白名单",
    color: "blue",
    hint: "仅允许白名单内的只读命令，其余一律拒绝",
  },
  approval: {
    label: "需审批",
    short: "审批",
    color: "orange",
    hint: "AI 执行前必须由工程师人工裁决放行",
  },
  denied: {
    label: "已锁定",
    short: "锁定",
    color: "red",
    hint: "AI 完全禁止在此主机执行任何命令",
  },
};

export const AI_POLICY_ORDER: AIPolicy[] = [
  "trusted",
  "allowlist",
  "approval",
  "denied",
];

export const AUTH_TYPE_LABEL: Record<AuthType, string> = {
  password: "密码",
  key: "私钥",
};

export const OS_TYPE_LABEL: Record<OsType, string> = {
  linux: "Linux",
  windows: "Windows",
};

/** 内置分组：这三个不是数据里的 group 字段，而是由记录状态推导出来的虚拟分组 */
export const VIRTUAL_GROUP_ALL = "all";
export const VIRTUAL_GROUP_STARRED = "starred";
export const VIRTUAL_GROUP_RECENT = "recent";

/**
 * 解析标签字段
 *
 * 后端历史上存过两种格式（JSON 数组、逗号分隔），读取端必须容错，
 * 否则旧数据会让整个列表渲染直接抛错。
 */
export function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];

  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean);
      }
    } catch {
      // 落入下面的分隔符分支，按普通文本处理
    }
  }

  return splitTagInput(trimmed);
}

/** 把逗号/顿号分隔的输入切成去重后的标签数组 */
export function splitTagInput(raw: string): string[] {
  const result: string[] = [];
  for (const part of raw.split(/[,，、]/)) {
    const tag = part.trim();
    if (tag && !result.includes(tag)) {
      result.push(tag);
    }
  }
  return result;
}

/** 收集一组服务器的全部标签，按出现次数降序排列 */
export function collectTagStats(servers: { tags: string }[]): {
  tag: string;
  count: number;
}[] {
  const counter = new Map<string, number>();
  for (const server of servers) {
    for (const tag of parseTags(server.tags)) {
      counter.set(tag, (counter.get(tag) ?? 0) + 1);
    }
  }
  return [...counter.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "zh-CN"));
}

/** 把标签数组序列化成后端要求的 JSON 数组字符串 */
export function serializeTags(tags: string[]): string {
  return JSON.stringify(tags);
}

/**
 * 相对时间展示
 *
 * 后端存的是本地时间字符串（YYYY-MM-DD HH:MM:SS），把它换成 T 分隔再交给 Date，
 * 避免个别 WebView 把空格分隔的格式当成 UTC 解析、导致时间整体偏移 8 小时。
 */
export function formatRelativeTime(value: string | null | undefined): string {
  if (!value) return "从未";

  const timestamp = new Date(value.replace(" ", "T")).getTime();
  if (Number.isNaN(timestamp)) return value;

  const diffSeconds = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSeconds < 0) return "刚刚";
  if (diffSeconds < 60) return "刚刚";
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} 分钟前`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} 小时前`;
  if (diffSeconds < 2592000) return `${Math.floor(diffSeconds / 86400)} 天前`;
  return value.slice(0, 10);
}

/** 模糊搜索：在别名、地址、端口、账号、标签、系统、架构里找关键词 */
export function matchServer(
  server: {
    alias: string;
    hostname: string;
    port: number;
    username: string;
    group: string;
    os_type: string;
    arch: string;
    tags: string;
  },
  keyword: string
): boolean {
  const needle = keyword.trim().toLowerCase();
  if (!needle) return true;

  return [
    server.alias,
    server.hostname,
    String(server.port),
    server.username,
    server.group,
    server.os_type,
    server.arch,
    OS_TYPE_LABEL[server.os_type as OsType] ?? server.os_type,
    ...parseTags(server.tags),
  ]
    .join(" ")
    .toLowerCase()
    .includes(needle);
}
