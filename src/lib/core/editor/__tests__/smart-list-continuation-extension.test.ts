import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { createTiptapExtensions } from "../tiptap-config";

const createEditor = (content: Record<string, unknown>): Editor =>
  new Editor({
    element: document.createElement("div"),
    extensions: createTiptapExtensions(),
    content,
  });

const getCodeBlockEndPos = (editor: Editor): number => {
  const { doc: proseMirrorDocument } = editor.state;
  const codeBlock = proseMirrorDocument.firstChild;
  if (codeBlock?.type.name !== "codeBlock") {
    throw new Error("Expected a code block node.");
  }
  const documentContentStart = 1;
  const nodeContentStart = 1;
  return documentContentStart + nodeContentStart + codeBlock.content.size;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

describe("SmartListContinuation", () => {
  it("continues markdown bullet markers inside code blocks when enabled", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "codeBlock",
          content: [{ type: "text", text: "- item" }],
        },
      ],
    });

    const endPos = getCodeBlockEndPos(editor);
    editor.commands.setTextSelection(endPos);

    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );

    expect(editor.getText()).toContain("- item\n- ");
    editor.destroy();
  });

  it("does not continue markers when disabled", () => {
    const editor = createEditor({
      type: "doc",
      content: [
        {
          type: "codeBlock",
          content: [{ type: "text", text: "- item" }],
        },
      ],
    });

    const root = editor.storage as unknown;
    if (!isRecord(root)) {
      throw new Error("Missing editor storage.");
    }
    const smartStorage = root.smartListContinuation;
    if (!isRecord(smartStorage)) {
      throw new Error("Missing smartListContinuation storage.");
    }
    smartStorage.enabled = false;

    const endPos = getCodeBlockEndPos(editor);
    editor.commands.setTextSelection(endPos);

    editor.view.dom.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
    );

    expect(editor.getText()).toContain("- item\n");
    expect(editor.getText()).not.toContain("- item\n- ");
    editor.destroy();
  });
});
