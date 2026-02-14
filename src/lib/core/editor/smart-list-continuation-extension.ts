import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/core";

type ListMarker =
  | { kind: "bullet"; indent: string; bullet: string }
  | { kind: "ordered"; indent: string; number: number; separator: "." | ")" }
  | { kind: "task"; indent: string; bullet: string };

const resolveCurrentLine = (
  text: string,
  offset: number
): { line: string; lineStart: number; cursorInLine: number } => {
  const before = text.slice(0, offset);
  const lastNewline = before.lastIndexOf("\n");
  const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
  const cursorInLine = offset - lineStart;
  const nextNewline = text.indexOf("\n", offset);
  const lineEnd = nextNewline === -1 ? text.length : nextNewline;
  return {
    line: text.slice(lineStart, lineEnd),
    lineStart,
    cursorInLine,
  };
};

const parseListMarker = (
  line: string
): { marker: ListMarker; length: number } | null => {
  const task = /^(?<indent>\s*)(?<bullet>[-+*])\s+\[[ xX]\]\s+/u.exec(line);
  if (task?.groups) {
    return {
      marker: {
        kind: "task",
        indent: task.groups.indent,
        bullet: task.groups.bullet,
      },
      length: task[0].length,
    };
  }

  const ordered = /^(?<indent>\s*)(?<number>\d+)(?<separator>[.)])\s+/u.exec(
    line
  );
  if (ordered?.groups) {
    const number = Number.parseInt(ordered.groups.number, 10);
    const separator = ordered.groups.separator === ")" ? ")" : ".";
    return {
      marker: {
        kind: "ordered",
        indent: ordered.groups.indent,
        number,
        separator,
      },
      length: ordered[0].length,
    };
  }

  const bullet = /^(?<indent>\s*)(?<bullet>[-+*])\s+/u.exec(line);
  if (bullet?.groups) {
    return {
      marker: {
        kind: "bullet",
        indent: bullet.groups.indent,
        bullet: bullet.groups.bullet,
      },
      length: bullet[0].length,
    };
  }

  return null;
};

const toNextMarkerText = (marker: ListMarker): string => {
  if (marker.kind === "ordered") {
    return `${marker.indent}${marker.number + 1}${marker.separator} `;
  }
  if (marker.kind === "task") {
    return `${marker.indent}${marker.bullet} [ ] `;
  }
  return `${marker.indent}${marker.bullet} `;
};

const hasEnabledFlag = (value: unknown): value is { enabled?: unknown } =>
  typeof value === "object" &&
  value !== null &&
  Object.hasOwn(value, "enabled");

const isSmartStorageEnabled = (storage: unknown): boolean =>
  !hasEnabledFlag(storage) || storage.enabled !== false;

const insertTextAt = (editor: Editor, from: number, text: string): boolean =>
  editor.commands.command(({ tr, dispatch }) => {
    tr.insertText(text, from);
    if (dispatch) {
      dispatch(tr.scrollIntoView());
    }
    return true;
  });

const deleteRangeAndInsertText = (
  editor: Editor,
  input: { from: number; to: number; insertPos: number; text: string }
): boolean =>
  editor.commands.command(({ tr, dispatch }) => {
    tr.delete(input.from, input.to);
    tr.insertText(input.text, input.insertPos);
    if (dispatch) {
      dispatch(tr.scrollIntoView());
    }
    return true;
  });

const handleEnter = (editor: Editor, storage: unknown): boolean => {
  if (!isSmartStorageEnabled(storage)) {
    return false;
  }

  const { commands, state } = editor;

  if (editor.isActive("taskItem")) {
    return commands.splitListItem("taskItem");
  }
  if (editor.isActive("listItem")) {
    return commands.splitListItem("listItem");
  }

  if (!editor.isActive("codeBlock")) {
    return false;
  }

  if (!state.selection.empty) {
    return false;
  }

  const { $from, from } = state.selection;
  const { parent, parentOffset } = $from;
  if (parent.type.name !== "codeBlock") {
    return false;
  }

  const fullText = parent.textBetween(0, parent.content.size, "\n", "\n");
  const { line, lineStart, cursorInLine } = resolveCurrentLine(
    fullText,
    parentOffset
  );
  const parsed = parseListMarker(line);
  if (!parsed) {
    return false;
  }

  if (cursorInLine < parsed.length) {
    return false;
  }

  const trailing = line.slice(parsed.length).trim();
  const lineStartPos = $from.start() + lineStart;
  const markerFrom = lineStartPos;
  const markerTo = lineStartPos + parsed.length;

  if (trailing.length === 0) {
    return deleteRangeAndInsertText(editor, {
      from: markerFrom,
      to: markerTo,
      insertPos: from - parsed.length,
      text: "\n",
    });
  }

  return insertTextAt(editor, from, `\n${toNextMarkerText(parsed.marker)}`);
};

export const SmartListContinuation = Extension.create<
  { enabled: boolean },
  { enabled: boolean }
>({
  name: "smartListContinuation",

  addOptions() {
    return {
      enabled: true,
    };
  },

  addStorage() {
    return {
      enabled: this.options.enabled,
    };
  },

  addKeyboardShortcuts() {
    const { editor, storage } = this;
    return {
      Enter: handleEnter.bind(null, editor, storage),
    };
  },
});
