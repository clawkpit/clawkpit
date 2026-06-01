export type McpToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

export function toolOk(data: unknown): McpToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

export function toolError(message: string): McpToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

export function mapServiceError(e: unknown): string {
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") {
    const msg = (e as { message: string }).message;
    switch (msg) {
      case "NOT_FOUND":
        return "Not found.";
      case "DONE_NOTE_REQUIRED":
        return "Add a note with your reflection before marking this To Think About item done.";
      case "DROP_NOTE_REQUIRED":
        return "Add a short note explaining why you are dropping this item.";
      case "AI_EDIT_FORBIDDEN":
        return "AI cannot edit existing notes.";
      case "NOT_A_FORM":
        return "Content is not a form.";
      default:
        if (process.env.NODE_ENV === "production") return "Request failed.";
        return msg;
    }
  }
  if (process.env.NODE_ENV === "production") return "Request failed.";
  return e instanceof Error ? e.message : "Request failed.";
}
