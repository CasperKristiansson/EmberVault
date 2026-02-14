import { describe, expect, it } from "vitest";

import { toDerivedMarkdown } from "$lib/core/utils/derived-markdown";

describe("toDerivedMarkdown", () => {
  it("returns the body when title is empty", () => {
    expect(toDerivedMarkdown("", "Body")).toBe("Body");
    expect(toDerivedMarkdown("   ", "Body")).toBe("Body");
  });

  it("returns an h1 when the body is empty", () => {
    expect(toDerivedMarkdown("Title", "")).toBe("# Title");
    expect(toDerivedMarkdown(" Title ", "   ")).toBe("# Title");
  });

  it("returns title + body when both are present", () => {
    expect(toDerivedMarkdown("Title", "Body")).toBe("# Title\n\nBody");
  });
});
