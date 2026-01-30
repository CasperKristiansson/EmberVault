import Image from "@tiptap/extension-image";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { NodeViewRendererProps } from "@tiptap/core";
import type { ViewMutationRecord } from "@tiptap/pm/view";

const parseDimension = (value: string | null): number | null => {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

const dataEmptyAttribute = "data-empty";
const dataCaptionAttribute = "data-caption";
const dataAssetIdAttribute = "data-asset-id";
const dataMimeAttribute = "data-mime";
const dataPlaceholderAttribute = "data-placeholder";

const setOptionalAttribute = (
  element: HTMLElement,
  name: string,
  value: unknown
): void => {
  if (typeof value === "string" && value.length > 0) {
    element.setAttribute(name, value);
    return;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    element.setAttribute(name, String(value));
    return;
  }
  element.removeAttribute(name);
};

const setCaptionState = ({
  figure,
  caption,
  captionText,
  editable,
}: {
  figure: HTMLElement;
  caption: HTMLElement;
  captionText: string;
  editable: boolean;
}): void => {
  const trimmed = captionText.trim();
  caption.textContent = trimmed;
  caption.setAttribute(
    dataEmptyAttribute,
    trimmed.length === 0 ? "true" : "false"
  );
  caption.contentEditable = editable ? "true" : "false";
  caption.hidden = !editable && trimmed.length === 0;
  if (trimmed.length > 0) {
    figure.setAttribute(dataCaptionAttribute, trimmed);
  } else {
    figure.removeAttribute(dataCaptionAttribute);
  }
};

const isCaptionEventTarget = (
  caption: HTMLElement,
  target: EventTarget | null
): boolean => (target instanceof Node ? caption.contains(target) : false);

const createAssetImageNodeView = (properties: NodeViewRendererProps) => {
  const { editor, getPos, node } = properties;
  if (!(node instanceof ProseMirrorNode)) {
    throw new TypeError("Expected ProseMirror node.");
  }
  const figure = document.createElement("figure");
  figure.className = "embervault-image";

  const image = document.createElement("img");
  image.draggable = false;
  figure.append(image);

  const caption = document.createElement("figcaption");
  caption.className = "embervault-image-caption";
  caption.setAttribute(dataPlaceholderAttribute, "Add caption");
  figure.append(caption);

  let lastCaption = "";
  let currentNode = node;

  const updateNodeAttributes = (attributes: Record<string, unknown>): void => {
    if (typeof getPos !== "function") {
      return;
    }
    const position = getPos();
    if (typeof position !== "number") {
      return;
    }
    const nextAttributes = {
      ...currentNode.attrs,
      ...attributes,
    };
    const transaction = editor.state.tr.setNodeMarkup(
      position,
      undefined,
      nextAttributes
    );
    editor.view.dispatch(transaction);
  };

  const focusEditor = (): void => {
    const focusCommand = editor.commands.focus as (() => void) | undefined;
    if (typeof focusCommand === "function") {
      focusCommand();
    }
  };

  const syncFromNode = (nextNode: ProseMirrorNode): void => {
    const attributes = nextNode.attrs as Record<string, unknown>;
    const assetId =
      typeof attributes.assetId === "string" ? attributes.assetId : null;
    const mime = typeof attributes.mime === "string" ? attributes.mime : null;
    const alt = typeof attributes.alt === "string" ? attributes.alt : "";
    const source = typeof attributes.src === "string" ? attributes.src : "";
    const captionText =
      typeof attributes.caption === "string" ? attributes.caption : "";

    image.src = source;
    image.alt = alt;
    setOptionalAttribute(image, dataAssetIdAttribute, assetId);
    setOptionalAttribute(image, dataMimeAttribute, mime);
    setOptionalAttribute(image, "width", attributes.width);
    setOptionalAttribute(image, "height", attributes.height);

    if (assetId) {
      figure.setAttribute(dataAssetIdAttribute, assetId);
    } else {
      figure.removeAttribute(dataAssetIdAttribute);
    }

    setCaptionState({
      figure,
      caption,
      captionText,
      editable: editor.isEditable,
    });
    lastCaption = captionText.trim();
  };

  const commitCaption = (): void => {
    if (!editor.isEditable) {
      return;
    }
    const text =
      typeof caption.textContent === "string" ? caption.textContent.trim() : "";
    if (text === lastCaption) {
      return;
    }
    lastCaption = text;
    updateNodeAttributes({
      caption: text.length > 0 ? text : null,
    });
  };

  caption.addEventListener("input", () => {
    if (!editor.isEditable) {
      return;
    }
    const text =
      typeof caption.textContent === "string" ? caption.textContent.trim() : "";
    setCaptionState({
      figure,
      caption,
      captionText: text,
      editable: true,
    });
    if (text !== lastCaption) {
      lastCaption = text;
      updateNodeAttributes({
        caption: text.length > 0 ? text : null,
      });
    }
  });

  caption.addEventListener("blur", () => {
    commitCaption();
  });

  const handleCaptionKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitCaption();
      focusEditor();
    }
  };

  caption.addEventListener("keydown", handleCaptionKeydown);

  syncFromNode(currentNode);

  const handleUpdate = (updatedNode: ProseMirrorNode): boolean => {
    if (updatedNode.type.name !== currentNode.type.name) {
      return false;
    }
    currentNode = updatedNode;
    const captionText =
      typeof updatedNode.attrs.caption === "string"
        ? updatedNode.attrs.caption
        : "";
    lastCaption = captionText.trim();
    syncFromNode(updatedNode);
    return true;
  };

  const handleStopEvent = (event: Event): boolean =>
    isCaptionEventTarget(caption, event.target);

  const handleIgnoreMutation = (mutation: ViewMutationRecord): boolean => {
    if (mutation.type === "selection") {
      return true;
    }
    return caption.contains(mutation.target);
  };

  return {
    dom: figure,
    update: handleUpdate,
    selectNode: () => {
      figure.classList.add("is-selected");
    },
    deselectNode: () => {
      figure.classList.remove("is-selected");
    },
    stopEvent: handleStopEvent,
    ignoreMutation: handleIgnoreMutation,
  };
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
      caption: {
        default: null,
        parseHTML(element) {
          return element.getAttribute(dataCaptionAttribute);
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          const caption =
            typeof attributes.caption === "string" ? attributes.caption : null;
          return caption ? { [dataCaptionAttribute]: caption } : {};
        },
      },
      assetId: {
        default: null,
        parseHTML(element) {
          return element.getAttribute(dataAssetIdAttribute);
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          const assetId =
            typeof attributes.assetId === "string" ? attributes.assetId : null;
          return assetId ? { [dataAssetIdAttribute]: assetId } : {};
        },
      },
      mime: {
        default: null,
        parseHTML(element) {
          return element.getAttribute(dataMimeAttribute);
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          const mime =
            typeof attributes.mime === "string" ? attributes.mime : null;
          return mime ? { [dataMimeAttribute]: mime } : {};
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
  addNodeView() {
    return createAssetImageNodeView;
  },
});
