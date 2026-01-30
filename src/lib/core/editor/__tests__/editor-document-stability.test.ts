import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createTiptapExtensions } from "../tiptap-config";

const createEditor = (): Editor =>
  new Editor({
    element: document.createElement("div"),
    extensions: createTiptapExtensions(),
    content: { type: "doc", content: [] },
  });

const sampleDocument: Record<string, unknown> = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Sample heading" }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "Plain paragraph text." }],
    },
    {
      type: "bulletList",
      content: [
        {
          type: "listItem",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Bullet item" }],
            },
          ],
        },
      ],
    },
    {
      type: "taskList",
      content: [
        {
          type: "taskItem",
          attrs: { checked: false },
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Checklist item" }],
            },
          ],
        },
      ],
    },
    {
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Quoted text" }],
        },
      ],
    },
    {
      type: "codeBlock",
      attrs: { language: "ts" },
      content: [{ type: "text", text: "const value = 1;" }],
    },
    {
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            {
              type: "tableCell",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Cell A" }],
                },
              ],
            },
            {
              type: "tableCell",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Cell B" }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("editor doc stability", () => {
  it("round trips editor JSON content", () => {
    const editor = createEditor();
    editor.commands.setContent(sampleDocument);
    const saved = editor.getJSON();
    editor.destroy();

    const rehydratedEditor = createEditor();
    rehydratedEditor.commands.setContent(saved);
    const reloaded = rehydratedEditor.getJSON();
    rehydratedEditor.destroy();

    expect(reloaded).toEqual(saved);
  });
});
