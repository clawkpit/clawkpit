import { describe, expect, it } from "vitest";
import { boardItemDeepLinkUrl } from "../src/services/pushService";

describe("boardItemDeepLinkUrl", () => {
  it("includes encoded item id in board query param", () => {
    const itemId = "550e8400-e29b-41d4-a716-446655440000";
    expect(boardItemDeepLinkUrl(itemId)).toBe(`/board?item=${encodeURIComponent(itemId)}`);
  });

  it("encodes special characters in item id", () => {
    const itemId = "id/with?chars&more";
    expect(boardItemDeepLinkUrl(itemId)).toBe(`/board?item=${encodeURIComponent(itemId)}`);
  });
});
