import { useState, useEffect } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getMarkdownContent, markDone } from "@/api/client";
import { CheckIcon } from "lucide-react";

interface MarkdownModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: string | null;
  itemId: string | null;
  onMarkRead?: () => void;
}

export function MarkdownModal({
  open,
  onOpenChange,
  contentId,
  itemId,
  onMarkRead,
}: MarkdownModalProps) {
  const [title, setTitle] = useState<string | null>(null);
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !contentId) {
      setTitle(null);
      setHtml("");
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    getMarkdownContent(contentId)
      .then((data) => {
        setTitle(data.title ?? "Read");
        const raw = marked.parse(data.markdown, { async: false }) as string;
        setHtml(DOMPurify.sanitize(raw));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [open, contentId]);

  const handleMarkRead = async () => {
    if (!itemId) {
      onOpenChange(false);
      onMarkRead?.();
      return;
    }
    setMarking(true);
    try {
      await markDone(itemId);
      onOpenChange(false);
      onMarkRead?.();
    } catch {
      setError("Failed to mark as read");
    } finally {
      setMarking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col" showCloseButton>
        <DialogHeader>
          <DialogTitle>{title ?? "Read"}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && !error && html && (
            <div
              className="prose prose-sm dark:prose-invert max-w-none text-foreground"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleMarkRead} disabled={marking}>
            <CheckIcon className="w-4 h-4 mr-2" />
            {marking ? "Marking…" : "Mark Read"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
