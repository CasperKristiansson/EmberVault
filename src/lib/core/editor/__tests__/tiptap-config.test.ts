/* eslint-disable sonarjs/arrow-function-convention */
import { describe, expect, it } from "vitest";
import { createEmptyDocument, createTiptapExtensions } from "../tiptap-config";

const requiredExtensions = [
  "codeBlock",
  "link",
  "table",
  "tableRow",
  "tableHeader",
  "tableCell",
  "taskList",
  "taskItem",
  "image",
  "mathInline",
  "mathBlock",
];

describe("tiptap config", () => {
  it("includes required extensions", () => {
    const extensions = createTiptapExtensions();
    const names = extensions.map(({ name }) => name);

    expect(names).toEqual(expect.arrayContaining(requiredExtensions));

    const codeBlockExtension = extensions.find(
      (extension) => extension.name === "codeBlock"
    );

    expect(codeBlockExtension?.options).toHaveProperty("lowlight");
  });

  it("creates an empty doc shape", () => {
    const emptyDocument = createEmptyDocument();

    expect(emptyDocument).toEqual({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 1 }, content: [] },
        { type: "paragraph", content: [] },
      ],
    });
  });
});
