import katex from "katex";
import { InputRule, Node as TiptapNode, mergeAttributes } from "@tiptap/core";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { CommandProps, NodeViewRendererProps } from "@tiptap/core";
import type { ViewMutationRecord } from "@tiptap/pm/view";

type MathInsertOptions = {
  latex?: string;
};

/* eslint-disable @typescript-eslint/consistent-type-definitions */
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    math: {
      insertMathInline: (options?: MathInsertOptions) => ReturnType;
      insertMathBlock: (options?: MathInsertOptions) => ReturnType;
    };
  }
}
/* eslint-enable @typescript-eslint/consistent-type-definitions */

const inlineInputRegex = /\$(?<latex>[^$]+)\$$/u;
const blockInputRegex = /\$\$(?<latex>[^$]+)\$\$$/u;

const renderKatex = (
  target: HTMLElement,
  latex: string,
  displayMode: boolean
): void => {
  target.replaceChildren();
  const trimmed = latex.trim();
  if (trimmed.length === 0) {
    return;
  }
  try {
    katex.render(trimmed, target, {
      displayMode,
      throwOnError: false,
      strict: "ignore",
    });
  } catch {
    target.replaceChildren();
  }
};

const createMathNodeView =
  (inline: boolean) =>
  ({ editor, node }: NodeViewRendererProps) => {
    if (!(node instanceof ProseMirrorNode)) {
      throw new TypeError("Expected ProseMirror node.");
    }

    const wrapper = document.createElement(inline ? "span" : "div");
    wrapper.className = inline
      ? "embervault-math-inline"
      : "embervault-math-block";
    wrapper.setAttribute("data-type", inline ? "math-inline" : "math-block");

    const raw = document.createElement(inline ? "span" : "pre");
    raw.className = "embervault-math-raw";
    raw.spellcheck = false;

    const rendered = document.createElement(inline ? "span" : "div");
    rendered.className = "embervault-math-render";

    wrapper.append(raw, rendered);

    const syncFromNode = (nextNode: ProseMirrorNode): void => {
      const { textContent: latex } = nextNode;
      const { isEditable } = editor;
      wrapper.setAttribute("data-latex", latex);
      raw.hidden = !isEditable;
      rendered.hidden = isEditable;
      if (isEditable) {
        rendered.replaceChildren();
        return;
      }
      renderKatex(rendered, latex, !inline);
    };

    syncFromNode(node);

    const handleUpdate = (updatedNode: ProseMirrorNode): boolean => {
      if (updatedNode.type.name !== node.type.name) {
        return false;
      }
      syncFromNode(updatedNode);
      return true;
    };

    const handleStopEvent = (event: Event): boolean =>
      event.target instanceof globalThis.Node && raw.contains(event.target);

    const handleIgnoreMutation = (mutation: ViewMutationRecord): boolean =>
      raw.contains(mutation.target);

    return {
      dom: wrapper,
      contentDOM: raw,
      update: handleUpdate,
      stopEvent: handleStopEvent,
      ignoreMutation: handleIgnoreMutation,
    };
  };

const createMathInputRule = (options: {
  type: string;
  find: RegExp;
  block?: boolean;
  shouldIgnore?: (match: RegExpMatchArray) => boolean;
}) =>
  new InputRule({
    find: options.find,
    handler: ({ range, match, commands, state }) => {
      if (options.shouldIgnore?.(match)) {
        return;
      }
      const latex = match.groups?.latex ?? "";
      const trimmed = latex.trim();
      if (trimmed.length === 0) {
        return;
      }
      const { doc } = state;
      const content = {
        type: options.type,
        content: [{ type: "text", text: trimmed }],
      };
      if (options.block) {
        const $from = doc.resolve(range.from);
        const start = $from.depth > 0 ? $from.before() : range.from;
        const end = $from.depth > 0 ? $from.after() : range.to;
        commands.insertContentAt({ from: start, to: end }, content);
        const selectionPos = Math.min(start + 1, doc.content.size);
        commands.setTextSelection(selectionPos);
        return;
      }
      commands.insertContentAt(range, content);
      const selectionPos = Math.min(range.from + 1, doc.content.size);
      commands.setTextSelection(selectionPos);
    },
  });

const shouldIgnoreInlineMath = (match: RegExpMatchArray): boolean => {
  const index = typeof match.index === "number" ? match.index : undefined;
  const input = typeof match.input === "string" ? match.input : "";
  if (index === undefined || index === 0) {
    return false;
  }
  return input[index - 1] === "$";
};

export const MathInline = TiptapNode.create({
  name: "mathInline",
  inline: true,
  group: "inline",
  content: "text*",
  marks: "",
  selectable: true,
  parseHTML() {
    return [{ tag: 'span[data-type="math-inline"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { "data-type": "math-inline" }),
      0,
    ];
  },
  renderText({ node }) {
    const { textContent: latex } = node;
    return `$${latex}$`;
  },
  addNodeView() {
    return createMathNodeView(true);
  },
  addCommands() {
    return {
      insertMathInline:
        (options: MathInsertOptions = {}) =>
        ({ state, dispatch }: CommandProps) => {
          const nodeType = state.schema.nodes[this.name];
          const trimmed = options.latex?.trim();
          const content = trimmed ? [state.schema.text(trimmed)] : undefined;
          const mathNode = nodeType.create(null, content);
          const tr = state.tr
            .replaceSelectionWith(mathNode, false)
            .scrollIntoView();
          if (dispatch) {
            dispatch(tr);
          }
          return true;
        },
    };
  },
  addInputRules() {
    return [
      createMathInputRule({
        type: this.name,
        find: inlineInputRegex,
        shouldIgnore: shouldIgnoreInlineMath,
      }),
    ];
  },
});

export const MathBlock = TiptapNode.create({
  name: "mathBlock",
  group: "block",
  content: "text*",
  marks: "",
  defining: true,
  parseHTML() {
    return [
      {
        tag: 'div[data-type="math-block"]',
        contentElement: "pre",
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "math-block" }),
      ["pre", 0],
    ];
  },
  renderText({ node }) {
    const { textContent: latex } = node;
    return `$$${latex}$$`;
  },
  addNodeView() {
    return createMathNodeView(false);
  },
  addCommands() {
    return {
      insertMathBlock:
        (options: MathInsertOptions = {}) =>
        ({ state, dispatch }: CommandProps) => {
          const nodeType = state.schema.nodes[this.name];
          const trimmed = options.latex?.trim();
          const content = trimmed ? [state.schema.text(trimmed)] : undefined;
          const mathNode = nodeType.create(null, content);
          const tr = state.tr
            .replaceSelectionWith(mathNode, false)
            .scrollIntoView();
          if (dispatch) {
            dispatch(tr);
          }
          return true;
        },
    };
  },
  addInputRules() {
    return [
      createMathInputRule({
        type: this.name,
        find: blockInputRegex,
        block: true,
      }),
    ];
  },
});
