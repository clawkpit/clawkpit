import type { FormField, FormSchema, ValidationError } from "@/lib/formParser";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface FormRendererProps {
  schema: FormSchema;
  values: Record<string, string | string[]>;
  onChange: (name: string, value: string | string[]) => void;
  errors: ValidationError[];
}

function FieldRender({
  field,
  value,
  onChange,
  error,
}: {
  field: FormField;
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
  error: string | undefined;
}) {
  const name = field.name;
  const id = `field-${name}`;

  if (field.type === "info") {
    return (
      <div className="text-sm text-muted-foreground">
        {field.description && <p>{field.description}</p>}
      </div>
    );
  }

  if (field.type === "text") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{field.label}</Label>
        {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
        <Input
          id={id}
          type="text"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={error ? "border-destructive" : undefined}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  if (field.type === "textarea") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{field.label}</Label>
        {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
        <Textarea
          id={id}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={cn("min-h-[80px]", error && "border-destructive")}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  if (field.type === "date") {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{field.label}</Label>
        {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
        <Input
          id={id}
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={error ? "border-destructive" : undefined}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  if (field.type === "radio" && field.options?.length) {
    return (
      <div className="space-y-1.5">
        <Label>{field.label}</Label>
        {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
        <div className="flex flex-col gap-touch">
          {field.options.map((opt) => (
            <label key={opt} className="pressable flex min-h-12 items-center gap-3 cursor-pointer rounded-md px-1 -mx-1">
              <input
                type="radio"
                name={name}
                value={opt}
                checked={(value as string) === opt}
                onChange={() => onChange(opt)}
                className="size-4 shrink-0 rounded-full border-input accent-primary"
              />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  if (field.type === "checkbox" && field.options?.length) {
    const arr = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-1.5">
        <Label>{field.label}</Label>
        {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
        <div className="flex flex-col gap-touch">
          {field.options.map((opt) => (
            <label key={opt} className="pressable flex min-h-12 items-center gap-3 cursor-pointer rounded-md px-1 -mx-1">
              <Checkbox
                checked={arr.includes(opt)}
                onCheckedChange={(checked) => {
                  const next = checked ? [...arr, opt] : arr.filter((x) => x !== opt);
                  onChange(next);
                }}
              />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  if (field.type === "select" && field.options?.length) {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={id}>{field.label}</Label>
        {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
        <Select
          value={(value as string) ?? ""}
          onValueChange={(v) => onChange(v)}
        >
          <SelectTrigger id={id} className={error ? "border-destructive" : undefined}>
            <SelectValue placeholder={field.placeholder || "Select…"} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  if (field.type === "scale" && field.min != null && field.max != null) {
    const options = Array.from(
      { length: field.max - field.min + 1 },
      (_, i) => String(field.min! + i)
    );
    return (
      <div className="space-y-1.5">
        <Label>{field.label}</Label>
        {field.description && <p className="text-xs text-muted-foreground">{field.description}</p>}
        <div className="flex flex-wrap gap-touch">
          {options.map((opt) => (
            <label key={opt} className="pressable flex min-h-12 min-w-12 items-center justify-center gap-1.5 cursor-pointer rounded-md border border-border px-3">
              <input
                type="radio"
                name={name}
                value={opt}
                checked={String(value) === opt}
                onChange={() => onChange(opt)}
                className="size-4 shrink-0 rounded-full border-input accent-primary"
              />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{field.label}</Label>
      <Input
        id={id}
        type="text"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        className={error ? "border-destructive" : undefined}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function FormRenderer({ schema, values, onChange, errors }: FormRendererProps) {
  const sections = schema.sections ?? [{ title: "", fields: schema.fields }];
  return (
    <div className="space-y-6">
      {schema.description && (
        <p className="text-sm text-muted-foreground">{schema.description}</p>
      )}
      {sections.map((section, si) => (
        <div key={si} className="space-y-4">
          {section.title && (
            <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
          )}
          <div className="space-y-4">
            {section.fields
              .filter((f) => !f.hidden)
              .map((field) => (
                <FieldRender
                  key={field.name}
                  field={field}
                  value={values[field.name]}
                  onChange={(v) => onChange(field.name, v)}
                  error={errors.find((e) => e.name === field.name)?.message}
                />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
