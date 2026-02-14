import { replaceWikiLinksInPmDoc } from "../replace-wiki-links";

describe("replaceWikiLinksInPmDoc", () => {
  it("replaces matching wiki links with a stable id", () => {
    const pmDoc: Record<string, unknown> = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "See [[Alpha]] and [[ Beta ]]." }],
        },
      ],
    };

    const next = replaceWikiLinksInPmDoc({
      pmDoc,
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
    const pmDoc: Record<string, unknown> = { type: "doc", content: [] };
    expect(
      replaceWikiLinksInPmDoc({ pmDoc, replacements: [] })
    ).toBe(pmDoc);
  });
});

