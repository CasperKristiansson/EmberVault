import { describe, expect, it } from "vitest";

import { importMarkdownToNote } from "$lib/core/utils/markdown-import";

describe("importMarkdownToNote", () => {
  it("uses the first H1 heading as the title", () => {
    const result = importMarkdownToNote({
      fileName: "note.md",
      markdown: "# Hello\n\nBody line",
    });
    expect(result.title).toBe("Hello");
    expect(result.plainText).toContain("Body line");
  });

  it("falls back to filename when no H1 is present", () => {
    const result = importMarkdownToNote({
      fileName: "Project plan.md",
      markdown: "No heading here\n\nSecond paragraph",
    });
    expect(result.title).toBe("Project plan");
    expect(result.plainText).toContain("No heading here");
  });

  it("strips YAML frontmatter and imports fenced code blocks", () => {
    const result = importMarkdownToNote({
      fileName: "front.md",
      markdown:
        "---\n" +
        "title: Ignored\n" +
        "---\n" +
        "\n" +
        "# Real title\n" +
        "\n" +
        "```ts\n" +
        "const x = 1;\n" +
        "```\n",
    });
    expect(result.title).toBe("Real title");
    expect(result.plainText).toContain("const x = 1;");
  });
});
