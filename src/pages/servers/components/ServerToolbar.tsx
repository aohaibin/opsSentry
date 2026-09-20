import { useState } from "react";
import { Badge, Checkbox, Input, Popover } from "antd";
import { ChevronDown, Search } from "lucide-react";
import type { OsType } from "@/types";

export type OsFilter = "all" | OsType;

interface ServerToolbarProps {
  keyword: string;
  onKeywordChange: (value: string) => void;
  osFilter: OsFilter;
  onOsFilterChange: (value: OsFilter) => void;
  /** 各系统档位的主机数量，展示在筛选按钮上 */
  osCounts: Record<OsFilter, number>;
  tagStats: { tag: string; count: number }[];
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onResetTags: () => void;
}

const OS_TABS: { key: OsFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "linux", label: "Linux" },
  { key: "windows", label: "Windows" },
];

export function ServerToolbar({
  keyword,
  onKeywordChange,
  osFilter,
  onOsFilterChange,
  osCounts,
  tagStats,
  selectedTags,
  onToggleTag,
  onResetTags,
}: ServerToolbarProps) {
  const [tagPanelOpen, setTagPanelOpen] = useState(false);

  const tagPanel = (
    <div className="w-56 space-y-2">
      <div
        className="flex items-center justify-between pb-1.5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <span className="text-[11px] font-medium" style={{ color: "var(--text-secondary)" }}>
          选择过滤标签
        </span>
        <button
          type="button"
          onClick={onResetTags}
          className="text-[10px]"
          style={{ color: "var(--accent-hover)" }}
        >
          重置
        </button>
      </div>

      {tagStats.length === 0 ? (
        <p className="text-[11px] py-2" style={{ color: "var(--text-muted)" }}>
          还没有任何标签，可在编辑服务器时添加
        </p>
      ) : (
        <div className="max-h-48 overflow-y-auto space-y-1 custom-scrollbar">
          {tagStats.map(({ tag, count }) => (
            <label
              key={tag}
              className="flex items-center justify-between gap-2 px-1 py-0.5 rounded cursor-pointer text-xs"
              style={{ color: "var(--text-primary)" }}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Checkbox
                  checked={selectedTags.includes(tag)}
                  onChange={() => onToggleTag(tag)}
                />
                <span className="truncate">{tag}</span>
              </span>
              <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                {count}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div
      className="p-3 flex flex-wrap items-center justify-between gap-3"
      style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-secondary)",
      }}
    >
      <div className="flex-1 min-w-[220px] max-w-md">
        <Input
          allowClear
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
          placeholder="搜索名称、IP、账号、标签、系统架构..."
          prefix={<Search size={13} style={{ color: "var(--text-muted)" }} />}
        />
      </div>

      <div className="flex items-center gap-1.5">
        {OS_TABS.map(({ key, label }) => {
          const active = osFilter === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onOsFilterChange(key)}
              className="px-2.5 py-1 rounded-lg text-xs transition"
              style={{
                background: active ? "rgba(99, 102, 241, 0.2)" : "var(--bg-tertiary)",
                color: active ? "var(--accent-hover)" : "var(--text-secondary)",
                border: active
                  ? "1px solid rgba(99, 102, 241, 0.4)"
                  : "1px solid transparent",
                fontWeight: active ? 500 : 400,
              }}
            >
              {label} ({osCounts[key]})
            </button>
          );
        })}

        <Popover
          content={tagPanel}
          trigger="click"
          open={tagPanelOpen}
          onOpenChange={setTagPanelOpen}
          placement="bottomRight"
        >
          <button
            type="button"
            className="px-2.5 py-1 rounded-lg text-xs flex items-center gap-1 transition"
            style={{
              background: "var(--bg-tertiary)",
              color: selectedTags.length
                ? "var(--accent-hover)"
                : "var(--text-secondary)",
              border: "1px solid var(--border)",
            }}
          >
            <span>标签筛选</span>
            {selectedTags.length > 0 && (
              <Badge
                count={selectedTags.length}
                size="small"
                style={{ backgroundColor: "var(--accent)" }}
              />
            )}
            <ChevronDown size={12} />
          </button>
        </Popover>
      </div>
    </div>
  );
}
