<script lang="ts">
  import { onMount } from "svelte";
  import { Editor, type JSONContent } from "@tiptap/core";
  import {
    applySlashMenuCommand,
    getSlashMenuItems,
    isSlashMenuItemEnabled,
    type SlashMenuChain,
    type SlashMenuItemId,
  } from "$lib/core/editor/slash-menu";
  import {
    createEmptyDocument,
    createTiptapExtensions,
  } from "$lib/core/editor/tiptap-config";
  import SlashMenu from "./SlashMenu.svelte";

  export let content: Record<string, unknown> = createEmptyDocument();
  export let editable = true;
  export let ariaLabel = "Note content";
  export let dataTestId = "note-body";
  export let onUpdate: (payload: {
    json: Record<string, unknown>;
    text: string;
  }) => void = () => {};

  let element: HTMLDivElement | null = null;
  let editor: Editor | null = null;
  let lastContent: Record<string, unknown> | null = null;

  let slashMenuOpen = false;
  let slashMenuPosition: { x: number; y: number } | null = null;
  let slashMenuSelectedIndex = 0;
  let slashMenuElement: HTMLDivElement | null = null;
  let slashMenuSlashPosition: number | null = null;
  const slashMenuItems = getSlashMenuItems();

  const menuWidth = 240;
  const menuHeight = 320;
  const menuMargin = 8;

  const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, min), max);

  const getFirstEnabledIndex = (): number => {
    const index = slashMenuItems.findIndex(item => item.enabled);
    return index === -1 ? 0 : index;
  };

  const getNextEnabledIndex = (
    startIndex: number,
    direction: 1 | -1
  ): number => {
    if (slashMenuItems.length === 0) {
      return 0;
    }
    let nextIndex = startIndex;
    for (let step = 0; step < slashMenuItems.length; step += 1) {
      nextIndex =
        (nextIndex + direction + slashMenuItems.length) %
        slashMenuItems.length;
      if (slashMenuItems[nextIndex]?.enabled) {
        return nextIndex;
      }
    }
    return startIndex;
  };

  const resolveMenuPosition = (coords: {
    left: number;
    bottom: number;
  }): { x: number; y: number } => {
    const maxX = Math.max(menuMargin, window.innerWidth - menuWidth - menuMargin);
    const maxY = Math.max(
      menuMargin,
      window.innerHeight - menuHeight - menuMargin
    );

    return {
      x: clamp(coords.left, menuMargin, maxX),
      y: clamp(coords.bottom + 6, menuMargin, maxY),
    };
  };

  const openSlashMenu = (slashPos: number | null): void => {
    if (!editor) {
      return;
    }
    const coords = editor.view.coordsAtPos(editor.state.selection.from);
    slashMenuPosition = resolveMenuPosition({
      left: coords.left,
      bottom: coords.bottom,
    });
    slashMenuOpen = true;
    slashMenuSlashPosition = slashPos;
    slashMenuSelectedIndex = getFirstEnabledIndex();
  };

  const closeSlashMenu = (): void => {
    slashMenuOpen = false;
    slashMenuPosition = null;
    slashMenuSlashPosition = null;
  };

  const deleteSlashIfPresent = (chain: SlashMenuChain): void => {
    if (!editor || slashMenuSlashPosition === null) {
      return;
    }
    const slashPos = slashMenuSlashPosition;
    if (slashPos < 0 || slashPos + 1 > editor.state.doc.content.size) {
      return;
    }
    const text = editor.state.doc.textBetween(
      slashPos,
      slashPos + 1,
      "\0",
      "\0"
    );
    if (text === "/") {
      chain.deleteRange({ from: slashPos, to: slashPos + 1 });
    }
  };

  const selectSlashMenuItem = (itemId: SlashMenuItemId): void => {
    if (!editor || !isSlashMenuItemEnabled(itemId)) {
      return;
    }
    const chain = editor.chain().focus() as SlashMenuChain;
    deleteSlashIfPresent(chain);
    if (applySlashMenuCommand(chain, itemId)) {
      chain.run();
    }
    closeSlashMenu();
  };

  const handleSlashMenuHighlight = (index: number): void => {
    if (slashMenuItems[index]?.enabled) {
      slashMenuSelectedIndex = index;
    }
  };

  const initializeEditor = (): void => {
    if (!element) {
      return;
    }
    editor = new Editor({
      element,
      editorProps: {
        attributes: {
          "aria-label": ariaLabel,
          "aria-multiline": "true",
          "data-testid": dataTestId,
          role: "textbox",
          spellcheck: "true",
        },
        handleKeyDown: (_view, event) => {
          if (slashMenuOpen) {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              slashMenuSelectedIndex = getNextEnabledIndex(
                slashMenuSelectedIndex,
                1
              );
              return true;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              slashMenuSelectedIndex = getNextEnabledIndex(
                slashMenuSelectedIndex,
                -1
              );
              return true;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              const selected = slashMenuItems[slashMenuSelectedIndex];
              if (selected) {
                selectSlashMenuItem(selected.id);
              }
              return true;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              closeSlashMenu();
              return true;
            }
          }

          if ((event.metaKey || event.ctrlKey) && event.key === "/") {
            event.preventDefault();
            openSlashMenu(null);
            return true;
          }
          return false;
        },
        handleTextInput: (_view, from, _to, text) => {
          if (text === "/" && editor && !editor.isActive("codeBlock")) {
            const slashPos = from;
            queueMicrotask(() => openSlashMenu(slashPos));
          }
          return false;
        },
      },
      extensions: createTiptapExtensions(),
      content: content as JSONContent,
      editable,
      onUpdate: ({ editor }) => {
        onUpdate({
          json: editor.getJSON() as Record<string, unknown>,
          text: editor.getText(),
        });
      },
    });
    editor.on("transaction", ({ transaction }) => {
      if (!slashMenuOpen || slashMenuSlashPosition === null) {
        return;
      }
      slashMenuSlashPosition = transaction.mapping.map(slashMenuSlashPosition);
    });
    lastContent = content;
  };

  onMount(() => {
    initializeEditor();
    const handleClick = (event: MouseEvent) => {
      if (!slashMenuOpen) {
        return;
      }
      if (slashMenuElement && slashMenuElement.contains(event.target as Node)) {
        return;
      }
      closeSlashMenu();
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && slashMenuOpen) {
        closeSlashMenu();
      }
    };

    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeydown);
      editor?.destroy();
      editor = null;
    };
  });

  $: if (element && !editor) {
    initializeEditor();
  }

  $: if (editor) {
    editor.setEditable(editable);
  }

  $: if (editor && content && content !== lastContent) {
    editor.commands.setContent(content as JSONContent, { emitUpdate: false });
    lastContent = content;
  }
</script>

<div class="editor-surface" data-testid="tiptap-surface">
  <div
    bind:this={element}
    class="editor-mount"
  ></div>
</div>

<SlashMenu
  open={slashMenuOpen}
  position={slashMenuPosition}
  items={slashMenuItems}
  selectedIndex={slashMenuSelectedIndex}
  bind:element={slashMenuElement}
  onSelect={selectSlashMenuItem}
  onHighlight={handleSlashMenuHighlight}
/>

<style>
  .editor-surface {
    width: 100%;
    background: var(--bg-2);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-md);
    padding: 8px 12px;
  }

  .editor-surface:focus-within {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .editor-surface :global(.ProseMirror) {
    min-height: 320px;
    font-size: 15px;
    line-height: 1.55;
    color: var(--text-0);
    outline: none;
  }

  .editor-surface :global(.ProseMirror p) {
    margin: 0;
  }

  .editor-surface :global(.ProseMirror p + p) {
    margin-top: 8px;
  }

  .editor-surface :global(.ProseMirror a) {
    color: var(--accent-0);
  }

  .editor-surface :global(.ProseMirror pre) {
    margin: 12px 0;
    padding: 12px;
    border-radius: var(--r-sm);
    border: 1px solid var(--stroke-0);
    background: var(--bg-3);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
    color: var(--text-0);
    overflow-x: auto;
  }

  .editor-surface :global(.ProseMirror code) {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
  }

  .editor-surface :global(.ProseMirror table) {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
  }

  .editor-surface :global(.ProseMirror th),
  .editor-surface :global(.ProseMirror td) {
    border: 1px solid var(--stroke-0);
    padding: 6px 8px;
    text-align: left;
  }

  .editor-surface :global(.ProseMirror tr:hover) {
    background: var(--bg-3);
  }

  .editor-surface :global(.ProseMirror ul[data-type="taskList"]) {
    list-style: none;
    padding-left: 0;
  }

  .editor-surface :global(.ProseMirror li[data-type="taskItem"]) {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .editor-surface :global(.ProseMirror li[data-type="taskItem"] > label) {
    margin-top: 2px;
  }

  .editor-surface
    :global(.ProseMirror li[data-type="taskItem"] input[type="checkbox"]) {
    accent-color: var(--accent-0);
  }

  .editor-surface
    :global(.ProseMirror p.is-editor-empty:first-child::before) {
    content: attr(data-placeholder);
    color: var(--text-2);
    float: left;
    height: 0;
    pointer-events: none;
  }
</style>
