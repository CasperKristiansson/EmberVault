import { CodeBlock } from "@tiptap/extension-code-block";
import { Link } from "@tiptap/extension-link";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import { TaskItem } from "@tiptap/extension-task-item";
import { TaskList } from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";
import type { Extensions } from "@tiptap/core";

const emptyDocument: Record<string, unknown> = {
  type: "doc",
  content: [],
};

export const createEmptyDocument = (): Record<string, unknown> =>
  structuredClone(emptyDocument);

export const createTiptapExtensions = (): Extensions => [
  StarterKit.configure({
    codeBlock: false,
    link: false,
    undoRedo: {},
  }),
  CodeBlock,
  TaskList,
  TaskItem,
  Table.configure({
    resizable: false,
  }),
  TableRow,
  TableHeader,
  TableCell,
  Link.configure({
    autolink: true,
    linkOnPaste: true,
    openOnClick: false,
  }),
  Placeholder.configure({
    placeholder: "Start writing...",
  }),
];
