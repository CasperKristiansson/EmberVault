/* eslint-disable sonarjs/arrow-function-convention */
import { describe, expect, it } from "vitest";
import {
  applySlashMenuCommand,
  getSlashMenuItems,
  isSlashMenuItemEnabled,
} from "../slash-menu";
import type { SlashMenuChain, SlashMenuItemId } from "../slash-menu";

type Call = { name: string; args?: unknown };

const createChainRecorder = () => {
  const calls: Call[] = [];
  const chain: SlashMenuChain = {
    deleteRange: (options) => {
      calls.push({ name: "deleteRange", args: options });
      return chain;
    },
    toggleHeading: (options) => {
      calls.push({ name: "toggleHeading", args: options });
      return chain;
    },
    toggleBulletList: () => {
      calls.push({ name: "toggleBulletList" });
      return chain;
    },
    toggleTaskList: () => {
      calls.push({ name: "toggleTaskList" });
      return chain;
    },
    toggleBlockquote: () => {
      calls.push({ name: "toggleBlockquote" });
      return chain;
    },
    toggleCodeBlock: () => {
      calls.push({ name: "toggleCodeBlock" });
      return chain;
    },
    insertTable: (options) => {
      calls.push({ name: "insertTable", args: options });
      return chain;
    },
    insertMathBlock: () => {
      calls.push({ name: "insertMathBlock" });
      return chain;
    },
    setHorizontalRule: () => {
      calls.push({ name: "setHorizontalRule" });
      return chain;
    },
    run: () => {
      calls.push({ name: "run" });
    },
  };
  return { chain, calls };
};

describe("slash menu", () => {
  it("exposes the required menu items", () => {
    const items = getSlashMenuItems();

    expect(items.map((item) => item.id)).toEqual([
      "heading",
      "list",
      "checklist",
      "quote",
      "code",
      "table",
      "image",
      "math",
      "divider",
      "callout",
      "embed",
    ]);

    const disabledItems = items
      .filter((item) => !item.enabled)
      .map((item) => item.id);
    expect(disabledItems).toEqual([]);
  });

  const commandCases = [
    ["heading", { name: "toggleHeading", args: { level: 2 } }],
    ["list", { name: "toggleBulletList" }],
    ["checklist", { name: "toggleTaskList" }],
    ["quote", { name: "toggleBlockquote" }],
    ["code", { name: "toggleCodeBlock" }],
    [
      "table",
      {
        name: "insertTable",
        args: { rows: 3, cols: 3, withHeaderRow: true },
      },
    ],
    ["math", { name: "insertMathBlock" }],
    ["divider", { name: "setHorizontalRule" }],
  ] as const satisfies readonly (readonly [SlashMenuItemId, Call])[];

  it.each(commandCases)("applies the %s command", (itemId, expectedCall) => {
    const { chain, calls } = createChainRecorder();

    const applied = applySlashMenuCommand(chain, itemId);

    expect(applied).toBe(true);
    expect(calls).toContainEqual(expectedCall as Call);
  });

  it("enables image, callout, and embed", () => {
    const enabled: SlashMenuItemId[] = ["image", "callout", "embed"];
    for (const itemId of enabled) {
      expect(isSlashMenuItemEnabled(itemId)).toBe(true);
    }
  });
});
