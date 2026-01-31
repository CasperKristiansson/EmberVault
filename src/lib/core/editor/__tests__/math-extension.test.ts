import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createTiptapExtensions } from "../tiptap-config";

type JsonNode = {
  type?: string;
  content?: JsonNode[];
  text?: string;
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

const findNodesByType = (node: JsonNode, type: string): JsonNode[] => {
  const matches: JsonNode[] = [];
  if (node.type === type) {
    matches.push(node);
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      matches.push(...findNodesByType(child, type));
    }
  }
  return matches;
};

const extractText = (node: JsonNode): string => {
  if (typeof node.text === "string") {
    return node.text;
  }
  if (!Array.isArray(node.content)) {
    return "";
  }
  let text = "";
  for (const child of node.content) {
    text += extractText(child);
  }
  return text;
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

  it("serializes math nodes to HTML", () => {
    const editor = createEditor();
    const latex = String.raw`\int_0^1 x^2 dx`;
    editor.commands.setContent({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Formula " },
            { type: "mathInline", content: [{ type: "text", text: "mc^2" }] },
          ],
        },
        {
          type: "mathBlock",
          content: [{ type: "text", text: latex }],
        },
      ],
    });

    const parsed = new DOMParser().parseFromString(
      editor.getHTML(),
      "text/html"
    );
    const inlineNode = parsed.body.querySelector(
      'span[data-type="math-inline"]'
    );
    const blockNode = parsed.body.querySelector(
      'div[data-type="math-block"] pre'
    );

    expect(inlineNode?.textContent).toBe("mc^2");
    expect(blockNode?.textContent).toBe(latex);

    editor.destroy();
  });

  it("deserializes math nodes from HTML", () => {
    const editor = createEditor();
    const latex = String.raw`\int_0^1 x^2 dx`;
    const html = `<p>Formula <span data-type="math-inline">mc^2</span></p><div data-type="math-block"><pre>${latex}</pre></div>`;
    editor.commands.setContent(html);

    const json = editor.getJSON() as JsonNode;
    const inlineNodes = findNodesByType(json, "mathInline");
    const blockNodes = findNodesByType(json, "mathBlock");

    expect(inlineNodes).toHaveLength(1);
    expect(blockNodes).toHaveLength(1);
    expect(extractText(inlineNodes[0])).toBe("mc^2");
    expect(extractText(blockNodes[0])).toBe(latex);

    editor.destroy();
  });
});
