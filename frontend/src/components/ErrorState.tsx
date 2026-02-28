import { AlertCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  message: string;
  suggestion?: string;
  className?: string;
}

export function ErrorState({ message, suggestion, className }: ErrorStateProps) {
  return (
    <div className={cn("flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border", className)}>
      <AlertCircleIcon className="w-5 h-5 text-foreground/60 mt-0.5 flex-shrink-0" />
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium text-foreground">{message}</p>
        {suggestion && <p className="text-sm text-muted-foreground">{suggestion}</p>}
      </div>
    </div>
  );
}
