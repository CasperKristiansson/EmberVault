import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createEmptyDocument, createTiptapExtensions } from "../tiptap-config";

describe("undo/redo", () => {
  it("enables undo/redo commands", () => {
    const editor = new Editor({
      element: document.createElement("div"),
      extensions: createTiptapExtensions(),
      content: createEmptyDocument(),
    });

    const extensionNames: string[] = [];
    for (const extension of editor.extensionManager.extensions) {
      extensionNames.push(extension.name);
    }

    expect(extensionNames).toContain("undoRedo");
    expect(typeof editor.commands.undo).toBe("function");
    expect(typeof editor.commands.redo).toBe("function");

    editor.destroy();
  });
});
