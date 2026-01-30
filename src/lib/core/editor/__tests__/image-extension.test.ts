import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createTiptapExtensions } from "../tiptap-config";

describe("image extension", () => {
  it("stores caption on image nodes", () => {
    const editor = new Editor({
      element: document.createElement("div"),
      extensions: createTiptapExtensions(),
      content: { type: "doc", content: [] },
    });

    editor.commands.insertContent({
      type: "image",
      attrs: {
        src: "blob:test",
        assetId: "asset-123",
        caption: "Sample caption",
      },
    });

    const json = editor.getJSON();
    const { content } = json;
    if (!Array.isArray(content) || content.length === 0) {
      throw new Error("Expected image node to be present.");
    }
    const imageNode = content[0] as { attrs?: Record<string, unknown> };
    expect(imageNode.attrs?.caption).toBe("Sample caption");

    editor.destroy();
  });
});
