import Image from "@tiptap/extension-image";

const parseDimension = (value: string | null): number | null => {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

export const AssetImage = Image.extend({
  inline() {
    return false;
  },
  group() {
    return "block";
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      assetId: {
        default: null,
        parseHTML(element) {
          return element.getAttribute("data-asset-id");
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          const assetId =
            typeof attributes.assetId === "string" ? attributes.assetId : null;
          return assetId ? { "data-asset-id": assetId } : {};
        },
      },
      mime: {
        default: null,
        parseHTML(element) {
          return element.getAttribute("data-mime");
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          const mime =
            typeof attributes.mime === "string" ? attributes.mime : null;
          return mime ? { "data-mime": mime } : {};
        },
      },
      width: {
        default: null,
        parseHTML(element) {
          return parseDimension(element.getAttribute("width"));
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          const width =
            typeof attributes.width === "number" &&
            Number.isFinite(attributes.width)
              ? attributes.width
              : null;
          return width ? { width } : {};
        },
      },
      height: {
        default: null,
        parseHTML(element) {
          return parseDimension(element.getAttribute("height"));
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          const height =
            typeof attributes.height === "number" &&
            Number.isFinite(attributes.height)
              ? attributes.height
              : null;
          return height ? { height } : {};
        },
      },
    };
  },
});
