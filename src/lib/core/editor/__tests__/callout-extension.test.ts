import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createTiptapExtensions } from "../tiptap-config";

describe("callout extension", () => {
  it("stores tone on callout nodes", () => {
    const editor = new Editor({
      element: document.createElement("div"),
      extensions: createTiptapExtensions(),
      content: { type: "doc", content: [] },
    });

    editor.commands.insertContent({
      type: "callout",
      attrs: { tone: "info" },
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
      ],
    });

    const json = editor.getJSON();
    if (!Array.isArray(json.content) || json.content.length === 0) {
      throw new Error("Expected callout node to be present.");
    }
    const [calloutNode] = json.content;
    expect(calloutNode.attrs?.tone).toBe("info");

    editor.destroy();
  });
});
