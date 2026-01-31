import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createTiptapExtensions } from "../tiptap-config";

type JsonNode = {
  type?: string;
  content?: JsonNode[];
};

const createEditor = (editable = true): Editor =>
  new Editor({
    element: document.createElement("div"),
    extensions: createTiptapExtensions(),
    content: { type: "doc", content: [] },
    editable,
  });

const collectTypes = (node: JsonNode, bucket: string[] = []): string[] => {
  if (typeof node.type === "string") {
    bucket.push(node.type);
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      collectTypes(child, bucket);
    }
  }
  return bucket;
};

describe("math extension", () => {
  it("serializes inline and block math nodes", () => {
    const editor = createEditor();
    editor.commands.setContent({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "E = " },
            {
              type: "mathInline",
              content: [{ type: "text", text: "mc^2" }],
            },
          ],
        },
        {
          type: "mathBlock",
          content: [{ type: "text", text: String.raw`\int_0^1 x^2 dx` }],
        },
      ],
    });

    const json = editor.getJSON() as JsonNode;
    const types = collectTypes(json);

    expect(types).toContain("mathInline");
    expect(types).toContain("mathBlock");

    editor.destroy();
  });

  it("renders KaTeX output when read-only", () => {
    const editor = createEditor(false);
    editor.commands.setContent({
      type: "doc",
      content: [
        {
          type: "mathBlock",
          content: [{ type: "text", text: String.raw`c = \sqrt{a^2 + b^2}` }],
        },
      ],
    });

    const rendered = editor.view.dom.querySelector(
      ".embervault-math-render .katex"
    );

    expect(rendered).not.toBeNull();

    editor.destroy();
  });
});
