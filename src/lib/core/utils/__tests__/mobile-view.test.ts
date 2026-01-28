import { describe, expect, it } from "vitest";
import { resolveMobileView } from "../mobile-view";

describe("resolveMobileView", () => {
  it("falls back to notes when editor is unavailable", () => {
    expect(resolveMobileView("editor", false)).toBe("notes");
  });

  it("keeps the requested view when editor is available", () => {
    expect(resolveMobileView("editor", true)).toBe("editor");
  });
});
