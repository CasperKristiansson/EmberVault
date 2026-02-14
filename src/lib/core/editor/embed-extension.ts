import { Node as TiptapNode, mergeAttributes } from "@tiptap/core";

const resolveEmbedUrl = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "";
  }
  if (!/^https?:\/\/\S+$/u.test(trimmed)) {
    return "";
  }
  return trimmed;
};

export const Embed = TiptapNode.create({
  name: "embed",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      url: {
        default: "",
        parseHTML(element) {
          return resolveEmbedUrl(element.getAttribute("data-url"));
        },
        renderHTML(attributes) {
          return { "data-url": resolveEmbedUrl(attributes.url) };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="embed"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const url =
      typeof HTMLAttributes["data-url"] === "string"
        ? HTMLAttributes["data-url"]
        : "";
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "embed" }),
      [
        "a",
        {
          href: url,
          target: "_blank",
          rel: "noopener",
          "data-embed-link": "true",
        },
        url || "Embed URL",
      ],
    ];
  },

  renderText({ node }) {
    const url = resolveEmbedUrl((node.attrs as { url?: unknown }).url);
    return url.length > 0 ? url : "Embed";
  },
});
