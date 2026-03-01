/**
 * Copied from marketingcofounder/client/src/lib/formParser.ts.
 * Keep in sync with the source when making changes.
 */

export type FormFieldType =
  | "text"
  | "textarea"
  | "radio"
  | "checkbox"
  | "select"
  | "date"
  | "scale"
  | "info"
  | "todo-list";

export interface TodoListRow {
  id: string;
  cells: string[];
}

export interface FormField {
  type: FormFieldType;
  label: string;
  description: string;
  required: boolean;
  name: string;
  placeholder: string;
  hidden?: boolean;
  options?: string[];
  min?: number;
  max?: number;
  step?: number;
  /** For type "todo-list": table rows. cells[7] is the Status column (editable). */
  rows?: TodoListRow[];
}

export interface FormSection {
  title: string;
  fields: FormField[];
  /** When true, this section is shown on a new page (e.g. ### Section [next]). */
  startsNewPage?: boolean;
}

export interface FormSchema {
  title: string;
  description: string;
  fields: FormField[];
  /** When present, fields are grouped under these sections for display. */
  sections?: FormSection[];
  /** When present and length > 1, form is split into pages. Each page is an array of sections. */
  pages?: FormSection[][];
}

export interface ValidationError {
  name: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export function parseFormMarkdown(markdown: string): FormSchema {
  const withoutComments = markdown.replace(/<!--[\s\S]*?-->/g, "");
  const lines = withoutComments.replace(/\r\n?/g, "\n").split("\n");
  let title = "";
  const descriptionLines: string[] = [];
  const fields: FormField[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith("# ")) {
      title = line.slice(2).trim();
      i += 1;
      break;
    }
    i += 1;
  }

  while (i < lines.length) {
    const line = lines[i].trim();
    if (line.startsWith("## ") || line.startsWith("### ")) break;
    if (line.length > 0) descriptionLines.push(line);
    i += 1;
  }

  const sections: FormSection[] = [];
  let currentSection: FormSection = { title: "", fields: [] };

  while (i < lines.length) {
    const line = lines[i].trim();

    if (line.startsWith("### ")) {
      const rest = line.slice(4).trim();
      const sectionMatch = rest.match(/^(.*?)\s*\[(next|same)\]\s*$/i);
      const sectionTitle = sectionMatch ? sectionMatch[1].trim() : rest;
      const startsNewPage = sectionMatch
        ? sectionMatch[2].toLowerCase() === "next"
        : false;
      if (currentSection.fields.length > 0 || currentSection.title !== "") {
        sections.push(currentSection);
      }
      currentSection = {
        title: sectionTitle,
        fields: [],
        startsNewPage,
      };
      i += 1;
      continue;
    }

    if (!line.startsWith("## ")) {
      i += 1;
      continue;
    }

    const header = line.slice(3).trim();
    const match = header.match(/^(.*)\[(.+)\]\s*$/);
    const label = match ? match[1].trim() : header;
    const type = (match ? match[2].trim().toLowerCase() : "text") as FormFieldType;

    i += 1;
    const desc: string[] = [];
    const tableLines: string[] = [];
    const attrs: Record<string, string> = {};

    while (i < lines.length) {
      const current = lines[i];
      const trimmed = current.trim();
      if (trimmed.startsWith("## ") || trimmed.startsWith("### ")) break;
      if (trimmed.startsWith("- ")) {
        const kv = trimmed.slice(2).split(":");
        const key = kv[0].trim().toLowerCase();
        const value = kv.slice(1).join(":").trim();
        attrs[key] = value;
      } else if (trimmed.length > 0) {
        if (type === "todo-list" && /^\|.+\|$/.test(trimmed)) {
          tableLines.push(trimmed);
        } else {
          desc.push(trimmed);
        }
      }
      i += 1;
    }

    const field: FormField = {
      type,
      label,
      description: desc.join("\n"),
      required: parseBoolean(attrs.required),
      name: attrs.name ? attrs.name.trim() : slugify(label),
      placeholder: attrs.placeholder ? attrs.placeholder.trim() : "",
      hidden: parseBoolean(attrs.hidden),
      options: parseOptions(attrs.options),
      min: attrs.min ? Number(attrs.min) : undefined,
      max: attrs.max ? Number(attrs.max) : undefined,
      step: attrs.step ? Number(attrs.step) : undefined,
    };

    if (type === "todo-list" && tableLines.length > 0) {
      field.rows = parseTodoListTable(tableLines);
    }

    normalizeScale(field);
    fields.push(field);
    currentSection.fields.push(field);
  }

  if (currentSection.fields.length > 0 || currentSection.title !== "") {
    sections.push(currentSection);
  }

  const pages: FormSection[][] = [];
  if (sections.length > 0) {
    let currentPage: FormSection[] = [];
    for (const section of sections) {
      if (section.startsNewPage && currentPage.length > 0) {
        pages.push(currentPage);
        currentPage = [section];
      } else {
        currentPage.push(section);
      }
    }
    if (currentPage.length > 0) pages.push(currentPage);
  }

  return {
    title,
    description: descriptionLines.join(" "),
    fields,
    sections: sections.length > 0 ? sections : undefined,
    pages: pages.length > 0 ? pages : undefined,
  };
}

export function validateFormData(
  schema: FormSchema,
  data: Record<string, string | string[]>,
  options?: { fieldNames?: string[] }
): ValidationResult {
  const errors: ValidationError[] = [];
  const onlyFields =
    options?.fieldNames && options.fieldNames.length > 0
      ? new Set(options.fieldNames)
      : null;

  schema.fields.forEach((field) => {
    if (onlyFields && !onlyFields.has(field.name)) return;
    if (field.type === "info" || field.type === "todo-list") return;
    const value = data[field.name];
    if (field.required) {
      if (field.type === "checkbox") {
        if (!Array.isArray(value) || value.length === 0) {
          errors.push({ name: field.name, message: "Select at least one option." });
        }
      } else if (
        value === undefined ||
        value === null ||
        (typeof value === "string" && value.trim() === "")
      ) {
        errors.push({ name: field.name, message: "This field is required." });
      }
    }

    if (field.options && field.options.length > 0) {
      if (field.type === "radio" || field.type === "select") {
        if (value && typeof value === "string" && !field.options.includes(value)) {
          errors.push({ name: field.name, message: "Invalid selection." });
        }
      }
      if (field.type === "checkbox" && Array.isArray(value)) {
        const invalid = value.filter((item) => !field.options!.includes(item));
        if (invalid.length > 0) {
          errors.push({ name: field.name, message: "Invalid selection." });
        }
      }
    }
  });

  return { valid: errors.length === 0, errors };
}

function parseOptions(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBoolean(value: string | undefined): boolean {
  if (!value) return false;
  return value.trim().toLowerCase() === "true";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseTodoListTable(tableLines: string[]): TodoListRow[] {
  const rows: TodoListRow[] = [];
  let skippedHeader = false;
  for (const line of tableLines) {
    const cells = line
      .split("|")
      .map((s) => s.trim())
      .slice(1, -1);
    if (cells.length === 0) continue;
    const isSeparator = cells.every((c) => /^-+$/.test(c));
    if (isSeparator) continue;
    if (!skippedHeader) {
      skippedHeader = true;
      continue;
    }
    const id = cells[0] ?? String(rows.length);
    rows.push({ id, cells });
  }
  return rows;
}

function normalizeScale(field: FormField): void {
  if (field.type !== "scale") return;
  if (field.options && field.options.length > 0) {
    const numeric = field.options.map((opt) => Number(opt));
    if (numeric.every((num) => Number.isFinite(num))) {
      field.min = Math.min(...numeric);
      field.max = Math.max(...numeric);
      field.step = 1;
      field.options = [];
    }
  }

  if (!Number.isFinite(field.min)) field.min = 1;
  if (!Number.isFinite(field.max)) field.max = 5;
  if (!Number.isFinite(field.step)) field.step = 1;
}
