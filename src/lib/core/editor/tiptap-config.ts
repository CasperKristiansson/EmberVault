import { CodeBlockLowlight } from "@tiptap/extension-code-block-lowlight";
import { Link } from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";
import { common, createLowlight } from "lowlight";
import { AssetImage } from "./image-extension";
import { MathBlock, MathInline } from "./math/katex";
import { Callout } from "./callout-extension";
import { Embed } from "./embed-extension";
import { SmartListContinuation } from "./smart-list-continuation-extension";
import type { Extensions } from "@tiptap/core";

const lowlight = createLowlight(common);

const emptyDocument: Record<string, unknown> = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [],
    },
    {
      type: "paragraph",
      content: [],
    },
  ],
};

export const createEmptyDocument = (): Record<string, unknown> =>
  structuredClone(emptyDocument);

export const createTiptapExtensions = (
  options: { smartListContinuation?: boolean } = {}
): Extensions => [
  StarterKit.configure({
    codeBlock: false,
    link: false,
    undoRedo: {},
  }),
  CodeBlockLowlight.configure({ lowlight }),
  AssetImage,
  Callout,
  Embed,
  SmartListContinuation.configure({
    enabled: options.smartListContinuation !== false,
  }),
  TaskList,
  TaskItem,
  Table.configure({
    resizable: false,
  }),
  TableRow,
  TableHeader,
  TableCell,
  MathInline,
  MathBlock,
  Link.configure({
    autolink: true,
    linkOnPaste: true,
    openOnClick: false,
  }),
  Placeholder.configure({
    placeholder: ({ node }) => {
      if (node.type.name === "heading") {
        return "Untitled";
      }
      return "Start writing...";
    },
  }),
];
