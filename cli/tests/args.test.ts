import { describe, expect, it } from "vitest";
import { mergeInputs, parseArgs } from "../src/args.js";
import { resolveCommand } from "../src/commands.js";
import { urgencyFromDeadline } from "../src/urgency.js";

describe("parseArgs", () => {
  it("parses command, flags, and json", () => {
    const parsed = parseArgs([
      "create-task",
      "--title",
      "Hello",
      "--assigned-to",
      "AI",
      "--json",
      '{"tag":"ToDo","urgency":"DoNow"}',
    ]);
    expect(parsed.command).toBe("create-task");
    expect(parsed.flags.title).toBe("Hello");
    expect(parsed.flags.assigned_to).toBe("AI");
    expect(parsed.json).toEqual({ tag: "ToDo", urgency: "DoNow" });
    expect(mergeInputs(parsed.flags, parsed.json)).toEqual({
      tag: "ToDo",
      urgency: "DoNow",
      title: "Hello",
      assigned_to: "AI",
    });
  });

  it("treats bare flags as true and null literal", () => {
    const parsed = parseArgs([
      "get-next-action",
      "--include-notes",
      "--deadline",
      "null",
    ]);
    expect(parsed.flags.include_notes).toBe(true);
    expect(mergeInputs(parsed.flags, undefined).deadline).toBeNull();
  });

  it("parses --key=value", () => {
    const parsed = parseArgs(["list-tasks", "--status=Done", "--page=2"]);
    expect(parsed.flags.status).toBe("Done");
    expect(parsed.flags.page).toBe("2");
  });
});

describe("resolveCommand", () => {
  it("accepts kebab and snake aliases", () => {
    expect(resolveCommand("create-task")).toBe("create-task");
    expect(resolveCommand("create_task")).toBe("create-task");
    expect(resolveCommand("get_next_action")).toBe("get-next-action");
    expect(resolveCommand("nope")).toBeUndefined();
  });
});

describe("urgencyFromDeadline", () => {
  it("maps deadlines like MCP", () => {
    const now = Date.now();
    expect(urgencyFromDeadline(new Date(now + 12 * 3600 * 1000).toISOString())).toBe("DoToday");
    expect(urgencyFromDeadline(new Date(now + 3 * 24 * 3600 * 1000).toISOString())).toBe("DoThisWeek");
    expect(urgencyFromDeadline(new Date(now + 14 * 24 * 3600 * 1000).toISOString())).toBe("DoLater");
  });
});
