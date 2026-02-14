export type SlashMenuItemId =
  | "heading"
  | "list"
  | "checklist"
  | "quote"
  | "code"
  | "table"
  | "image"
  | "math"
  | "divider"
  | "callout"
  | "embed";

export type SlashMenuItem = {
  id: SlashMenuItemId;
  label: string;
  enabled: boolean;
};

export type SlashMenuChain = {
  deleteRange: (options: { from: number; to: number }) => SlashMenuChain;
  toggleHeading: (options: { level: number }) => SlashMenuChain;
  toggleBulletList: () => SlashMenuChain;
  toggleTaskList: () => SlashMenuChain;
  toggleBlockquote: () => SlashMenuChain;
  toggleCodeBlock: () => SlashMenuChain;
  insertTable: (options: {
    rows: number;
    cols: number;
    withHeaderRow: boolean;
  }) => SlashMenuChain;
  insertMathBlock: () => SlashMenuChain;
  setHorizontalRule: () => SlashMenuChain;
  run: () => void;
};

const baseItems: Omit<SlashMenuItem, "enabled">[] = [
  { id: "heading", label: "Heading" },
  { id: "list", label: "List" },
  { id: "checklist", label: "Checklist" },
  { id: "quote", label: "Quote" },
  { id: "code", label: "Code" },
  { id: "table", label: "Table" },
  { id: "image", label: "Image" },
  { id: "math", label: "Math" },
  { id: "divider", label: "Divider" },
  { id: "callout", label: "Callout" },
  { id: "embed", label: "Embed URL" },
];

const enabledItems = new Set<SlashMenuItemId>([
  "heading",
  "list",
  "checklist",
  "quote",
  "code",
  "table",
  "image",
  "callout",
  "embed",
  "divider",
  "math",
]);

/* eslint-disable sonarjs/arrow-function-convention */

export const getSlashMenuItems = (): SlashMenuItem[] =>
  baseItems.map((item) => ({
    ...item,
    enabled: enabledItems.has(item.id),
  }));

export const isSlashMenuItemEnabled = (id: SlashMenuItemId): boolean =>
  enabledItems.has(id);

const noop = (): undefined => undefined;

const applyHeading = (chain: SlashMenuChain): void => {
  chain.toggleHeading({ level: 2 });
};

const applyList = (chain: SlashMenuChain): void => {
  chain.toggleBulletList();
};

const applyChecklist = (chain: SlashMenuChain): void => {
  chain.toggleTaskList();
};

const applyQuote = (chain: SlashMenuChain): void => {
  chain.toggleBlockquote();
};

const applyCode = (chain: SlashMenuChain): void => {
  chain.toggleCodeBlock();
};

const applyTable = (chain: SlashMenuChain): void => {
  chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true });
};

const applyDivider = (chain: SlashMenuChain): void => {
  chain.setHorizontalRule();
};

const applyMath = (chain: SlashMenuChain): void => {
  chain.insertMathBlock();
};

const commandMap: Record<SlashMenuItemId, (chain: SlashMenuChain) => void> = {
  heading: applyHeading,
  list: applyList,
  checklist: applyChecklist,
  quote: applyQuote,
  code: applyCode,
  table: applyTable,
  math: applyMath,
  divider: applyDivider,
  image: noop,
  callout: noop,
  embed: noop,
};

export const applySlashMenuCommand = (
  chain: SlashMenuChain,
  itemId: SlashMenuItemId
): boolean => {
  if (!enabledItems.has(itemId)) {
    return false;
  }

  commandMap[itemId](chain);
  return true;
};
