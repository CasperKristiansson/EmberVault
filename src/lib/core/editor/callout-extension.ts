import { Node as TiptapNode, mergeAttributes } from "@tiptap/core";

export const Callout = TiptapNode.create({
  name: "callout",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      tone: {
        default: "info",
        parseHTML(element) {
          return element.getAttribute("data-tone") ?? "info";
        },
        renderHTML(attributes) {
          return typeof attributes.tone === "string"
            ? { "data-tone": attributes.tone }
            : {};
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="callout"]',
        contentElement: "div[data-callout-body]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "callout" }),
      ["div", { "data-callout-body": "" }, 0],
    ];
  },
});
