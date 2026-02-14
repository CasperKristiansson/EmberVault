import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createTiptapExtensions } from "../tiptap-config";

describe("embed extension", () => {
  it("stores url on embed nodes", () => {
    const editor = new Editor({
      element: document.createElement("div"),
      extensions: createTiptapExtensions(),
      content: { type: "doc", content: [] },
    });

    editor.commands.insertContent({
      type: "embed",
      attrs: { url: "https://example.com/" },
    });

    const json = editor.getJSON();
    if (!Array.isArray(json.content) || json.content.length === 0) {
      throw new Error("Expected embed node to be present.");
    }
    const [embedNode] = json.content;
    expect(embedNode.attrs?.url).toBe("https://example.com/");

    editor.destroy();
  });
});
