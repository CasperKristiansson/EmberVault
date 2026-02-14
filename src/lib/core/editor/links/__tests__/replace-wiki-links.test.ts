import { describe, expect, it } from "vitest";
import { replaceWikiLinksInPmDocument } from "../replace-wiki-links";

describe("replaceWikiLinksInPmDocument", () => {
  it("replaces matching wiki links with a stable id", () => {
    const pmDocument: Record<string, unknown> = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "See [[Alpha]] and [[ Beta ]]." }],
        },
      ],
    };

    const next = replaceWikiLinksInPmDocument({
      pmDocument,
      replacements: [
        { raw: "Alpha", targetId: "01AAA" },
        { raw: "Beta", targetId: "01BBB" },
      ],
    });

    const text = JSON.stringify(next);
    expect(text).toContain("[[01AAA]]");
    expect(text).toContain("[[01BBB]]");
  });

  it("returns the original document when replacements are empty", () => {
    const pmDocument: Record<string, unknown> = { type: "doc", content: [] };
    expect(replaceWikiLinksInPmDocument({ pmDocument, replacements: [] })).toBe(
      pmDocument
    );
  });
});
