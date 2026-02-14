import { describe, expect, it } from "vitest";
import {
  ensureTitleHeadingInPmDocument,
  extractTitleFromPmDocument,
  setTitleInPmDocument,
  splitEditorTextIntoTitleAndBody,
} from "../title-line";

describe("title line", () => {
  it("extracts title from first block", () => {
    expect(
      extractTitleFromPmDocument({
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 1 },
            content: [{ type: "text", text: "Hello world" }],
          },
          { type: "paragraph", content: [{ type: "text", text: "Body" }] },
        ],
      })
    ).toBe("Hello world");
  });

  it("splits editor text into title and body", () => {
    expect(splitEditorTextIntoTitleAndBody("Title\nLine 1\nLine 2")).toEqual({
      title: "Title",
      body: "Line 1\nLine 2",
    });
  });

  it("ensures title heading is present", () => {
    const pmDocument = ensureTitleHeadingInPmDocument({
      pmDocument: {
        type: "doc",
        content: [{ type: "paragraph", content: [] }],
      },
      title: "My note",
    });

    expect(extractTitleFromPmDocument(pmDocument)).toBe("My note");
    expect(Array.isArray(pmDocument.content)).toBe(true);
  });

  it("sets the title in an existing heading", () => {
    const pmDocument = setTitleInPmDocument({
      pmDocument: {
        type: "doc",
        content: [
          { type: "heading", attrs: { level: 1 }, content: [] },
          { type: "paragraph", content: [] },
        ],
      },
      title: "Updated",
    });

    expect(extractTitleFromPmDocument(pmDocument)).toBe("Updated");
  });
});
