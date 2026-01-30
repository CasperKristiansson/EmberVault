<script lang="ts">
  import { onMount } from "svelte";
  import { Editor, type JSONContent } from "@tiptap/core";
  import {
    createEmptyDocument,
    createTiptapExtensions,
  } from "$lib/core/editor/tiptap-config";

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
    lastContent = content;
  };

  onMount(() => {
    initializeEditor();
    return () => {
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
