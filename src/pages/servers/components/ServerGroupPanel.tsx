import { useMemo } from "react";
import { FolderTree, History, Layers, Plus, Star } from "lucide-react";
import type { Server } from "@/types";
import {
  VIRTUAL_GROUP_ALL,
  VIRTUAL_GROUP_RECENT,
  VIRTUAL_GROUP_STARRED,
} from "../lib/serverMeta";

interface ServerGroupPanelProps {
  /** 未经筛选的全部服务器，用于统计各分组数量 */
  servers: Server[];
  activeGroup: string;
  onSelectGroup: (key: string) => void;
  /** 点「+」新建分组 */
  onCreateGroup: () => void;
  /** 全量标签及计数 */
  tagStats: { tag: string; count: number }[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onClearTags: () => void;
}

/** 分组图标：虚拟分组固定图标，自定义分组统一用文件夹 */
function GroupIcon({ groupKey }: { groupKey: string }) {
  const size = 14;
  if (groupKey === VIRTUAL_GROUP_ALL) return <Layers size={size} />;
  if (groupKey === VIRTUAL_GROUP_STARRED) return <Star size={size} />;
  if (groupKey === VIRTUAL_GROUP_RECENT) return <History size={size} />;
  return <FolderTree size={size} />;
}

export function ServerGroupPanel({
  servers,
  activeGroup,
  onSelectGroup,
  onCreateGroup,
  tagStats,
  selectedTags,
  onToggleTag,
  onClearTags,
}: ServerGroupPanelProps) {
  // 分组是从记录里推导出来的，没有独立的分组表：
  // 「生产集群」这类分组只有挂了主机才存在，避免出现一个点进去空无一物的分组。
  const groups = useMemo(() => {
    const custom = new Map<string, number>();
    for (const server of servers) {
      const name = server.group?.trim();
      if (name) {
        custom.set(name, (custom.get(name) ?? 0) + 1);
      }
    }

    return [
      {
        key: VIRTUAL_GROUP_ALL,
        label: "全部主机",
        count: servers.length,
        accent: "#818cf8",
      },
      {
        key: VIRTUAL_GROUP_STARRED,
        label: "我的收藏",
        count: servers.filter((s) => s.favorite).length,
        accent: "#fbbf24",
      },
      {
        key: VIRTUAL_GROUP_RECENT,
        label: "最近用过",
        count: servers.filter((s) => s.last_used_at).length,
        accent: "#22d3ee",
      },
      ...[...custom.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
        .map(([name, count]) => ({
          key: name,
          label: name,
          count,
          accent: "#fb7185",
        })),
    ];
  }, [servers]);

  return (
    <div className="glass-card ops-server-group rounded-xl p-3 space-y-3">
      <div
        className="flex items-center justify-between pb-2"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span
          className="flex items-center gap-1.5 text-xs font-medium"
          style={{ color: "var(--text-secondary)" }}
        >
          <FolderTree size={14} />
          <span>服务器分组</span>
        </span>
        <button
          type="button"
          onClick={onCreateGroup}
          title="新建分组（分组随主机一起创建）"
          className="p-1 rounded transition"
          style={{ color: "var(--text-muted)" }}
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="ops-server-group-list custom-scrollbar space-y-1 pr-0.5">
        {groups.map((group) => {
          const active = group.key === activeGroup;
          return (
            <button
              key={group.key}
              type="button"
              onClick={() => onSelectGroup(group.key)}
              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition"
              style={{
                background: active ? "rgba(99, 102, 241, 0.15)" : "transparent",
                color: active ? "var(--accent-hover)" : "var(--text-secondary)",
                fontWeight: active ? 500 : 400,
              }}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span style={{ color: group.accent, display: "flex" }}>
                  <GroupIcon groupKey={group.key} />
                </span>
                <span className="truncate">{group.label}</span>
              </span>
              <span
                className="text-[11px] font-mono shrink-0"
                style={{ color: active ? "var(--accent)" : "var(--text-muted)" }}
              >
                {group.count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="pt-2 space-y-2" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex items-center justify-between">
          <span
            className="text-[10px] font-medium uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            标签快捷过滤
          </span>
          {selectedTags.length > 0 && (
            <button
              type="button"
              onClick={onClearTags}
              className="text-[10px]"
              style={{ color: "var(--accent-hover)" }}
            >
              清空
            </button>
          )}
        </div>

        {tagStats.length === 0 ? (
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            暂无标签
          </p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {/* 只展示出现最多的前 12 个标签，全量标签交给右侧筛选下拉，
                否则左栏会被长尾标签撑得很长，把分组列表挤下去 */}
            {tagStats.slice(0, 12).map(({ tag, count }) => {
              const active = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => onToggleTag(tag)}
                  title={`${count} 台主机使用该标签`}
                  className="px-2 py-0.5 rounded text-[10px] transition"
                  style={{
                    background: active
                      ? "rgba(99, 102, 241, 0.25)"
                      : "var(--bg-tertiary)",
                    color: active ? "var(--accent-hover)" : "var(--text-secondary)",
                  }}
                >
                  {tag}
                  <span className="ml-1 opacity-60">{count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
