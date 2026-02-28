import type { Item, ItemColumn } from "@/types/items";
import { formatRelativeTime, formatDeadline, COLUMNS_URGENCY } from "@/types/items";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BoardCardProps {
  item: Item;
  /** When "tag", show urgency badge (Do Now, Do Today...); when "urgency", show activity/tag badge. */
  viewMode?: "urgency" | "tag";
  onClick?: () => void;
  onDragStart?: (item: Item) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
}

const URGENCY_TITLE: Record<ItemColumn, string> = Object.fromEntries(
  COLUMNS_URGENCY.map((c) => [c.key, c.title])
) as Record<ItemColumn, string>;

export function BoardCard({ item, viewMode = "urgency", onClick, onDragStart, onDragEnd, isDragging }: BoardCardProps) {
  const isUrgent = item.deadline && item.deadline.getTime() - Date.now() < 24 * 60 * 60 * 1000;
  const isOverdue = item.deadline && item.deadline.getTime() < Date.now();

  const showUrgencyBadge = viewMode === "tag";
  const badgeLabel = showUrgencyBadge ? URGENCY_TITLE[item.column] : item.tag;
  const badgeClass = showUrgencyBadge
    ? "text-[11px] font-medium px-2 py-0.5 h-5 bg-muted text-muted-foreground"
    : cn(
        "text-[11px] font-medium px-2 py-0.5 h-5",
        item.tag === "To Read" && "bg-blue-500/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
        item.tag === "To Think About" && "bg-purple-500/10 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
        item.tag === "To Use" && "bg-green-500/10 text-green-700 dark:bg-green-500/20 dark:text-green-300",
        item.tag === "To Do" && "bg-orange-500/10 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300"
      );

  return (
    <div
      data-board-card
      draggable
      onClick={onClick}
      onDragStart={(e) => {
        e.stopPropagation();
        onDragStart?.(item);
      }}
      onDragEnd={() => onDragEnd?.()}
      className={cn(
        "group relative bg-card border border-border rounded-lg p-3.5 cursor-pointer transition-all hover:border-foreground/20 hover:shadow-sm",
        item.hasAIChanges && "border-l-2 border-l-foreground/40",
        isDragging && "opacity-50 cursor-grabbing",
        !isDragging && "cursor-grab active:cursor-grabbing"
      )}
    >
      {item.hasAIChanges && (
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-foreground/60 rounded-full" />
      )}
      <h3 className="text-[15px] font-medium leading-snug mb-2.5 pr-2 flex items-baseline gap-2">
        <span className="text-[11px] text-muted-foreground/70 font-mono shrink-0" aria-hidden>
          #{item.humanId}
        </span>
        <span className="min-w-0 truncate">{item.title}</span>
      </h3>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="secondary" className={badgeClass}>
          {badgeLabel}
        </Badge>
        <span
          className={cn(
            "text-[11px] font-semibold px-1.5 py-0.5 rounded",
            item.importance === "H" && "bg-foreground/10 text-foreground",
            item.importance === "M" && "bg-muted text-muted-foreground",
            item.importance === "L" && "bg-muted/50 text-muted-foreground/70"
          )}
        >
          {item.importance}
        </span>
        {item.deadline && (
          <span
            className={cn(
              "text-[11px] font-medium",
              isOverdue && "text-red-600 dark:text-red-400",
              isUrgent && !isOverdue && "text-orange-600 dark:text-orange-400",
              !isUrgent && !isOverdue && "text-muted-foreground"
            )}
          >
            {formatDeadline(item.deadline)}
          </span>
        )}
        <div className="flex-1" />
        <span className="text-[11px] text-muted-foreground/70">{formatRelativeTime(item.modifiedAt)}</span>
      </div>
    </div>
  );
}
