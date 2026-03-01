import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getFormContent, submitFormResponse } from "@/api/client";
import { parseFormMarkdown, validateFormData, type FormSchema, type ValidationError } from "@/lib/formParser";
import { FormRenderer } from "@/components/FormRenderer";
import { CheckIcon } from "lucide-react";

interface FormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: string | null;
  itemId: string | null;
  onSubmit?: () => void;
}

export function FormModal({
  open,
  onOpenChange,
  contentId,
  itemId,
  onSubmit,
}: FormModalProps) {
  const [schema, setSchema] = useState<FormSchema | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !contentId) {
      setSchema(null);
      setTitle(null);
      setValues({});
      setErrors([]);
      setFetchError(null);
      return;
    }
    setLoading(true);
    setFetchError(null);
    getFormContent(contentId)
      .then((data) => {
        setTitle(data.title ?? "Form");
        setSchema(parseFormMarkdown(data.formMarkdown));
        setValues({});
      })
      .catch((e) => setFetchError(e instanceof Error ? e.message : "Failed to load form"))
      .finally(() => setLoading(false));
  }, [open, contentId]);

  const handleChange = (name: string, value: string | string[]) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => prev.filter((e) => e.name !== name));
  };

  const handleSubmit = async () => {
    if (!contentId || !schema) return;
    const result = validateFormData(schema, values);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    setSubmitting(true);
    setErrors([]);
    try {
      const response: Record<string, unknown> = {};
      schema.fields.forEach((f) => {
        if (f.type === "info" || f.type === "todo-list") return;
        const v = values[f.name];
        if (v !== undefined) response[f.name] = v;
      });
      await submitFormResponse(contentId, { itemId: itemId ?? undefined, response });
      onOpenChange(false);
      onSubmit?.();
    } catch (e) {
      setErrors([{ name: "_", message: e instanceof Error ? e.message : "Submit failed" }]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col" showCloseButton>
        <DialogHeader>
          <DialogTitle>{title ?? "Form"}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto min-h-0 -mx-1 px-1">
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {fetchError && <p className="text-sm text-destructive">{fetchError}</p>}
          {!loading && !fetchError && schema && (
            <>
              {errors.find((e) => e.name === "_") && (
                <p className="text-sm text-destructive mb-3">{errors.find((e) => e.name === "_")!.message}</p>
              )}
              <FormRenderer schema={schema} values={values} onChange={handleChange} errors={errors} />
            </>
          )}
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting || !schema}>
            <CheckIcon className="w-4 h-4 mr-2" />
            {submitting ? "Submitting…" : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
