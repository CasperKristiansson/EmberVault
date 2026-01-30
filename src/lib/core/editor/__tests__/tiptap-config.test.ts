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
];

describe("tiptap config", () => {
  it("includes required extensions", () => {
    const extensions = createTiptapExtensions();
    const names = extensions.map(({ name }) => name);

    expect(names).toEqual(expect.arrayContaining(requiredExtensions));
  });

  it("creates an empty doc shape", () => {
    const emptyDocument = createEmptyDocument();

    expect(emptyDocument).toEqual({ type: "doc", content: [] });
  });
});
