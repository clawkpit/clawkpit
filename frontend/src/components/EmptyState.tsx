import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PlusIcon } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: string;
  className?: string;
  onAction?: () => void;
  actionLabel?: string;
}

export function EmptyState({
  title,
  description,
  className,
  onAction,
  actionLabel = "Create item",
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-6 text-center", className)}>
      {onAction ? (
        <Button
          type="button"
          variant="default"
          size="icon"
          onClick={onAction}
          className="mb-4 size-12 rounded-full"
          aria-label={actionLabel}
          title={actionLabel}
          haptic="success"
        >
          <PlusIcon className="size-5" strokeWidth={2.25} />
        </Button>
      ) : (
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-muted/50">
          <div className="size-6 rounded-full border-2 border-muted-foreground/30" />
        </div>
      )}
      <h3 className="text-sm font-medium text-foreground mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-xs">{description}</p>}
    </div>
  );
}
